import { Injectable, Logger } from '@nestjs/common';

export interface StatusResponse {
  code: number;
  message: string;
  timestamp: string;
  correlationId?: string;
}

export interface LatencyResponse {
  preset: string;
  requestedDelay: number;
  actualDelay: number;
  timestamp: string;
}

export interface StressResult {
  type: 'cpu' | 'memory';
  duration: number;
  intensity?: number;
  sizeMb?: number;
  before: {
    memoryUsedMb: number;
    cpuUsage: number;
  };
  after: {
    memoryUsedMb: number;
    cpuUsage: number;
  };
  timestamp: string;
}

const STATUS_MESSAGES: Record<number, string> = {
  // Success
  200: 'OK - Request succeeded',
  201: 'Created - Resource was created successfully',
  204: 'No Content - Request succeeded with no response body',
  // Client errors
  400: 'Bad Request - The request was malformed or invalid',
  401: 'Unauthorized - Authentication is required',
  403: 'Forbidden - You do not have permission to access this resource',
  404: 'Not Found - The requested resource does not exist',
  422: 'Unprocessable Entity - The request was valid but cannot be processed',
  429: 'Too Many Requests - Rate limit exceeded, please slow down',
  // Server errors
  500: 'Internal Server Error - An unexpected error occurred',
  502: 'Bad Gateway - The upstream server returned an invalid response',
  503: 'Service Unavailable - The service is temporarily unavailable',
  504: 'Gateway Timeout - The upstream server did not respond in time',
};

const LATENCY_PRESETS: Record<string, { min: number; max: number }> = {
  fast: { min: 0, max: 100 },
  normal: { min: 450, max: 550 },
  slow: { min: 1900, max: 2100 },
  'very-slow': { min: 4800, max: 5200 },
  'timeout-risk': { min: 9500, max: 10500 },
};

// Safety limits
const MAX_CPU_DURATION = 30000; // 30 seconds
const MAX_MEMORY_SIZE = 256; // 256 MB
const MAX_MEMORY_DURATION = 30000; // 30 seconds
const MAX_LATENCY = 15000; // 15 seconds

@Injectable()
export class SimulatorService {
  private readonly logger = new Logger(SimulatorService.name);

  getStatusResponse(code: number): StatusResponse {
    const message =
      STATUS_MESSAGES[code] || `HTTP ${code} - Custom status code`;

    this.logger.log(`Simulating HTTP ${code} response`);

    return {
      code,
      message,
      timestamp: new Date().toISOString(),
    };
  }

  getSupportedStatusCodes(): {
    success: number[];
    clientError: number[];
    serverError: number[];
  } {
    return {
      success: [200, 201, 204],
      clientError: [400, 401, 403, 404, 422, 429],
      serverError: [500, 502, 503, 504],
    };
  }

  async simulateLatency(
    preset: string,
    customMs?: number,
  ): Promise<LatencyResponse> {
    let delay: number;

    if (preset === 'custom' && customMs !== undefined) {
      delay = Math.min(Math.max(0, customMs), MAX_LATENCY);
    } else if (LATENCY_PRESETS[preset]) {
      const { min, max } = LATENCY_PRESETS[preset];
      delay = Math.floor(Math.random() * (max - min + 1)) + min;
    } else {
      throw new Error(`Unknown latency preset: ${preset}`);
    }

    this.logger.log(`Simulating ${delay}ms latency (preset: ${preset})`);

    const startTime = process.hrtime.bigint();
    await this.sleep(delay);
    const endTime = process.hrtime.bigint();

    const actualDelay = Number(endTime - startTime) / 1_000_000; // Convert ns to ms

    return {
      preset,
      requestedDelay: delay,
      actualDelay: Math.round(actualDelay),
      timestamp: new Date().toISOString(),
    };
  }

  getLatencyPresets(): Record<string, { min: number; max: number }> {
    return { ...LATENCY_PRESETS };
  }

  async stressCpu(duration: number, intensity: number): Promise<StressResult> {
    const safeDuration = Math.min(Math.max(0, duration), MAX_CPU_DURATION);
    const safeIntensity = Math.min(Math.max(1, intensity), 100);

    this.logger.log(
      `Starting CPU stress: ${safeDuration}ms at ${safeIntensity}% intensity`,
    );

    const before = this.getResourceUsage();
    const startTime = Date.now();
    const YIELD_INTERVAL_MS = 10;
    let lastYield = Date.now();

    // Run CPU-intensive work with periodic yields
    while (Date.now() - startTime < safeDuration) {
      // Fibonacci calculation as CPU work
      const iterations = Math.floor(safeIntensity * 1000);
      this.fibonacci(iterations);

      // Yield to event loop every YIELD_INTERVAL_MS to prevent blocking
      if (Date.now() - lastYield >= YIELD_INTERVAL_MS) {
        await this.sleep(0);
        lastYield = Date.now();
      }
    }

    const after = this.getResourceUsage();

    return {
      type: 'cpu',
      duration: safeDuration,
      intensity: safeIntensity,
      before,
      after,
      timestamp: new Date().toISOString(),
    };
  }

  async stressMemory(sizeMb: number, duration: number): Promise<StressResult> {
    const safeSize = Math.min(Math.max(1, sizeMb), MAX_MEMORY_SIZE);
    const safeDuration = Math.min(Math.max(0, duration), MAX_MEMORY_DURATION);

    this.logger.log(
      `Starting memory stress: ${safeSize}MB for ${safeDuration}ms`,
    );

    const before = this.getResourceUsage();

    // Allocate memory
    const buffers: Buffer[] = [];
    const chunkSize = 1024 * 1024; // 1MB chunks
    for (let i = 0; i < safeSize; i++) {
      buffers.push(Buffer.alloc(chunkSize, 'x'));
    }

    // Hold for duration
    await this.sleep(safeDuration);

    const after = this.getResourceUsage();

    // Clear references (GC will clean up)
    buffers.length = 0;

    return {
      type: 'memory',
      duration: safeDuration,
      sizeMb: safeSize,
      before,
      after,
      timestamp: new Date().toISOString(),
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private fibonacci(n: number): number {
    if (n <= 1) return n;
    let a = 0,
      b = 1;
    for (let i = 2; i <= n; i++) {
      const temp = a + b;
      a = b;
      b = temp;
    }
    return b;
  }

  private getResourceUsage(): { memoryUsedMb: number; cpuUsage: number } {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      memoryUsedMb: Math.round(memUsage.heapUsed / 1024 / 1024),
      cpuUsage: Math.round((cpuUsage.user + cpuUsage.system) / 1000), // Convert to ms
    };
  }
}
