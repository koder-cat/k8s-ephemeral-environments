import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

export type AlertType = 'high-error-rate' | 'high-latency' | 'slow-database';
export const VALID_ALERT_TYPES: readonly AlertType[] = ['high-error-rate', 'high-latency', 'slow-database'] as const;

export interface AlertDemoStatus {
  running: boolean;
  alertType: AlertType | null;
  startedAt: string | null;
  endsAt: string | null;
  remainingSeconds: number;
  requestsSent: number;
  progress: number;
}

interface AlertConfig {
  durationMs: number;
  intervalMs: number;
  description: string;
}

const ALERT_CONFIGS: Record<AlertType, AlertConfig> = {
  'high-error-rate': {
    durationMs: 5 * 60 * 1000 + 30 * 1000, // 5.5 minutes (buffer for alert to fire)
    intervalMs: 500, // Send error every 500ms
    description: 'Generates 5xx errors to trigger APIHighErrorRate alert',
  },
  'high-latency': {
    durationMs: 5 * 60 * 1000 + 30 * 1000,
    intervalMs: 2000, // Send slow request every 2s
    description: 'Generates slow responses to trigger APIHighLatency alert',
  },
  'slow-database': {
    durationMs: 5 * 60 * 1000 + 30 * 1000,
    intervalMs: 3000, // Run heavy query every 3s
    description: 'Runs heavy database queries to trigger DatabaseQuerySlow alert',
  },
};

// Cache alert types info since ALERT_CONFIGS is constant
const ALERT_TYPES_INFO = Object.fromEntries(
  Object.entries(ALERT_CONFIGS).map(([type, config]) => [
    type,
    {
      description: config.description,
      durationMinutes: Math.ceil(config.durationMs / 60000),
    },
  ]),
) as Record<AlertType, { description: string; durationMinutes: number }>;

// Maximum concurrent pending operations to prevent resource exhaustion
const MAX_PENDING_OPERATIONS = 10;

// Request timeout in milliseconds (30s covers slow latency/database operations)
const REQUEST_TIMEOUT_MS = 30000;

@Injectable()
export class AlertDemoService implements OnModuleDestroy {
  private readonly logger = new Logger(AlertDemoService.name);
  // Uses localhost since the service calls its own API endpoints
  // This works in Kubernetes because the pod's loopback interface is available
  private readonly baseUrl = `http://localhost:${process.env.PORT || 3000}`;

  private running = false;
  private starting = false; // Mutex flag for start operation
  private currentAlertType: AlertType | null = null;
  private startedAt: Date | null = null;
  private endsAt: Date | null = null;
  private requestsSent = 0;
  private pendingOperations = 0; // Track pending async operations
  private intervalId: NodeJS.Timeout | null = null;
  private timeoutId: NodeJS.Timeout | null = null;
  private abortController: AbortController | null = null;

  /**
   * Clean up timers when module is destroyed (hot-reload, shutdown)
   */
  onModuleDestroy(): void {
    this.logger.log('Module destroying, cleaning up alert demo...');
    this.stop();
  }

  /**
   * Get available alert types and their configurations (cached)
   */
  getAlertTypes(): Record<AlertType, { description: string; durationMinutes: number }> {
    return ALERT_TYPES_INFO;
  }

  /**
   * Get current status of alert demo
   */
  getStatus(): AlertDemoStatus {
    const now = Date.now();
    const remainingMs = this.endsAt ? Math.max(0, this.endsAt.getTime() - now) : 0;
    const totalMs = this.currentAlertType
      ? ALERT_CONFIGS[this.currentAlertType].durationMs
      : 0;
    const elapsedMs = totalMs - remainingMs;
    const progress = totalMs > 0 ? Math.min(100, (elapsedMs / totalMs) * 100) : 0;

    return {
      running: this.running,
      alertType: this.currentAlertType,
      startedAt: this.startedAt?.toISOString() || null,
      endsAt: this.endsAt?.toISOString() || null,
      remainingSeconds: Math.ceil(remainingMs / 1000),
      requestsSent: this.requestsSent,
      progress: Math.round(progress),
    };
  }

  /**
   * Start an alert demo
   */
  async start(alertType: AlertType): Promise<AlertDemoStatus> {
    // Mutex: prevent concurrent start calls
    if (this.starting) {
      throw new Error('Another start operation is in progress');
    }

    if (this.running) {
      throw new Error(`Alert demo already running: ${this.currentAlertType}`);
    }

    const config = ALERT_CONFIGS[alertType];
    if (!config) {
      throw new Error(`Unknown alert type: ${alertType}`);
    }

    // Set mutex flag
    this.starting = true;

    try {
      this.logger.log({
        message: 'Starting alert demo',
        alertType,
        durationMs: config.durationMs,
        intervalMs: config.intervalMs,
      });

      this.running = true;
      this.currentAlertType = alertType;
      this.startedAt = new Date();
      this.endsAt = new Date(Date.now() + config.durationMs);
      this.requestsSent = 0;
      this.pendingOperations = 0;
      this.abortController = new AbortController();

      // Start the interval to send requests
      this.intervalId = setInterval(() => {
        this.executeAlertAction(alertType);
      }, config.intervalMs);

      // Set timeout to stop after duration
      this.timeoutId = setTimeout(() => {
        // Capture count before stop() resets it
        const totalRequests = this.requestsSent;
        this.stop();
        this.logger.log({
          message: 'Alert demo completed',
          alertType,
          totalRequests,
        });
      }, config.durationMs);

      // Execute first action immediately
      this.executeAlertAction(alertType);

      return this.getStatus();
    } finally {
      // Release mutex
      this.starting = false;
    }
  }

  /**
   * Stop the current alert demo
   */
  stop(): AlertDemoStatus {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    // Cancel any in-flight HTTP requests
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    const finalStatus = this.getStatus();

    if (this.running) {
      this.logger.log({
        message: 'Alert demo stopped',
        alertType: this.currentAlertType,
        requestsSent: this.requestsSent,
      });
    }

    this.running = false;
    this.currentAlertType = null;
    this.startedAt = null;
    this.endsAt = null;
    this.requestsSent = 0;
    this.pendingOperations = 0;

    return finalStatus;
  }

  /**
   * Make an HTTP request with timeout and abort support.
   * Errors are logged but not thrown (fire-and-forget pattern).
   */
  private fetchWithTimeout(
    url: string,
    errorMessage: string,
    method: 'GET' | 'POST' = 'GET',
  ): Promise<Response | null> {
    // Don't start new requests if demo is stopped
    if (!this.abortController) {
      return Promise.resolve(null);
    }

    // Combine stop signal with timeout signal for proper cancellation
    const signal = AbortSignal.any([
      this.abortController.signal,
      AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    ]);

    return fetch(url, { method, signal }).catch((err) => {
      // Ignore abort errors (expected when demo is stopped or request times out)
      if (err instanceof Error && err.name === 'AbortError') {
        return null;
      }
      this.logger.error({
        message: errorMessage,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    });
  }

  /**
   * Execute the action for the given alert type.
   * Makes actual HTTP requests to generate Prometheus metrics via the middleware.
   */
  private executeAlertAction(alertType: AlertType): void {
    switch (alertType) {
      case 'high-error-rate':
        // Make actual HTTP request to generate 500 error metrics
        this.requestsSent++;
        this.fetchWithTimeout(
          `${this.baseUrl}/api/simulator/status/500`,
          'Error rate simulation request failed',
        );
        break;

      case 'high-latency':
        // Skip if too many pending operations to prevent resource exhaustion
        if (this.pendingOperations >= MAX_PENDING_OPERATIONS) {
          this.logger.warn('Skipping latency simulation - too many pending operations');
          return;
        }

        this.requestsSent++;
        this.pendingOperations++;

        // Make actual HTTP request to generate latency metrics
        this.fetchWithTimeout(
          `${this.baseUrl}/api/simulator/latency/slow`,
          'Latency simulation request failed',
        ).finally(() => {
          this.pendingOperations--;
        });
        break;

      case 'slow-database':
        // Skip if too many pending operations to prevent resource exhaustion
        if (this.pendingOperations >= MAX_PENDING_OPERATIONS) {
          this.logger.warn('Skipping database query - too many pending operations');
          return;
        }

        this.requestsSent++;
        this.pendingOperations++;

        // Make actual HTTP POST request to generate database query metrics
        this.fetchWithTimeout(
          `${this.baseUrl}/api/db-test/heavy-query/medium`,
          'Heavy query request failed',
          'POST',
        ).finally(() => {
          this.pendingOperations--;
        });
        break;
    }
  }
}
