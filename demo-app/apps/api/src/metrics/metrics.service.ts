import { Injectable, OnModuleInit } from '@nestjs/common';
import * as client from 'prom-client';

export interface RecentError {
  timestamp: string;
  status: number;
  method: string;
  path: string;
  message?: string;
}

export interface MetricsSummary {
  requests: {
    total: number;
    perMinute: number;
    errorRate: number;
    avgLatencyMs: number;
  };
  system: {
    uptimeSeconds: number;
    memoryUsedMb: number;
    memoryTotalMb: number;
  };
  recentErrors: RecentError[];
  timestamp: string;
}

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly registry: client.Registry;
  private readonly startTime = Date.now();
  private readonly recentErrors: RecentError[] = [];
  private readonly maxRecentErrors = 10;
  private requestCount = 0;
  private errorCount = 0;
  private totalLatencyMs = 0;
  private lastMinuteRequests: number[] = [];

  // HTTP metrics
  public readonly httpRequestDuration: client.Histogram<string>;
  public readonly httpRequestTotal: client.Counter<string>;

  // Database metrics
  public readonly dbPoolTotal: client.Gauge<string>;
  public readonly dbPoolIdle: client.Gauge<string>;
  public readonly dbPoolWaiting: client.Gauge<string>;
  public readonly dbQueryDuration: client.Histogram<string>;

  // MongoDB/Audit metrics
  public readonly mongoOperationDuration: client.Histogram<string>;
  public readonly auditEventsTotal: client.Counter<string>;

  // Redis/Cache metrics
  public readonly cacheOperationDuration: client.Histogram<string>;
  public readonly cacheHitsTotal: client.Counter<string>;
  public readonly cacheMissesTotal: client.Counter<string>;
  public readonly rateLimitRejectionsTotal: client.Counter<string>;

  // MinIO/Storage metrics
  public readonly storageOperationDuration: client.Histogram<string>;
  public readonly storageUploadsTotal: client.Counter<string>;
  public readonly storageDownloadsTotal: client.Counter<string>;
  public readonly storageBytesReceived: client.Counter<string>;

  constructor() {
    this.registry = new client.Registry();

    // Default labels for all metrics
    this.registry.setDefaultLabels({
      app: 'demo-app',
      pr: process.env.PR_NUMBER || 'unknown',
    });

    // HTTP request duration histogram
    this.httpRequestDuration = new client.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    // HTTP request counter
    this.httpRequestTotal = new client.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    // Database pool metrics
    this.dbPoolTotal = new client.Gauge({
      name: 'db_pool_connections_total',
      help: 'Total number of connections in the pool',
      registers: [this.registry],
    });

    this.dbPoolIdle = new client.Gauge({
      name: 'db_pool_connections_idle',
      help: 'Number of idle connections in the pool',
      registers: [this.registry],
    });

    this.dbPoolWaiting = new client.Gauge({
      name: 'db_pool_connections_waiting',
      help: 'Number of clients waiting for a connection',
      registers: [this.registry],
    });

    this.dbQueryDuration = new client.Histogram({
      name: 'db_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['operation', 'success'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
      registers: [this.registry],
    });

    // MongoDB/Audit metrics
    this.mongoOperationDuration = new client.Histogram({
      name: 'mongo_operation_duration_seconds',
      help: 'Duration of MongoDB operations in seconds',
      labelNames: ['operation', 'success'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
      registers: [this.registry],
    });

    this.auditEventsTotal = new client.Counter({
      name: 'audit_events_total',
      help: 'Total number of audit events logged',
      labelNames: ['type'],
      registers: [this.registry],
    });

    // Redis/Cache metrics
    this.cacheOperationDuration = new client.Histogram({
      name: 'cache_operation_duration_seconds',
      help: 'Duration of cache operations in seconds',
      labelNames: ['operation', 'success'],
      buckets: [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1],
      registers: [this.registry],
    });

    this.cacheHitsTotal = new client.Counter({
      name: 'cache_hits_total',
      help: 'Total number of cache hits',
      registers: [this.registry],
    });

    this.cacheMissesTotal = new client.Counter({
      name: 'cache_misses_total',
      help: 'Total number of cache misses',
      registers: [this.registry],
    });

    this.rateLimitRejectionsTotal = new client.Counter({
      name: 'rate_limit_rejections_total',
      help: 'Total number of rate limit rejections',
      registers: [this.registry],
    });

    // MinIO/Storage metrics
    this.storageOperationDuration = new client.Histogram({
      name: 'storage_operation_duration_seconds',
      help: 'Duration of storage operations in seconds',
      labelNames: ['operation', 'success'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    this.storageUploadsTotal = new client.Counter({
      name: 'storage_uploads_total',
      help: 'Total number of file uploads',
      registers: [this.registry],
    });

    this.storageDownloadsTotal = new client.Counter({
      name: 'storage_downloads_total',
      help: 'Total number of file downloads (presigned URLs)',
      registers: [this.registry],
    });

    this.storageBytesReceived = new client.Counter({
      name: 'storage_bytes_received_total',
      help: 'Total bytes received from file uploads',
      registers: [this.registry],
    });
  }

  onModuleInit() {
    // Collect default Node.js metrics (memory, CPU, event loop)
    client.collectDefaultMetrics({ register: this.registry });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }

  /**
   * Record a request for summary statistics
   */
  recordRequest(
    method: string,
    path: string,
    status: number,
    durationMs: number,
    errorMessage?: string,
  ): void {
    this.requestCount++;
    this.totalLatencyMs += durationMs;

    // Track requests per minute
    const now = Date.now();
    this.lastMinuteRequests.push(now);
    // Remove requests older than 1 minute
    const oneMinuteAgo = now - 60000;
    this.lastMinuteRequests = this.lastMinuteRequests.filter((t) => t > oneMinuteAgo);

    // Track errors (4xx and 5xx)
    if (status >= 400) {
      this.errorCount++;
      this.recentErrors.unshift({
        timestamp: new Date().toISOString(),
        status,
        method,
        path,
        message: errorMessage,
      });
      // Keep only recent errors
      if (this.recentErrors.length > this.maxRecentErrors) {
        this.recentErrors.pop();
      }
    }
  }

  /**
   * Get metrics summary for the frontend dashboard
   */
  getSummary(): MetricsSummary {
    const memUsage = process.memoryUsage();
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    const perMinute = this.lastMinuteRequests.length;
    const avgLatencyMs =
      this.requestCount > 0 ? Math.round(this.totalLatencyMs / this.requestCount) : 0;
    const errorRate =
      this.requestCount > 0
        ? Math.round((this.errorCount / this.requestCount) * 1000) / 10
        : 0;

    return {
      requests: {
        total: this.requestCount,
        perMinute,
        errorRate,
        avgLatencyMs,
      },
      system: {
        uptimeSeconds,
        memoryUsedMb: Math.round(memUsage.heapUsed / 1024 / 1024),
        memoryTotalMb: Math.round(memUsage.heapTotal / 1024 / 1024),
      },
      recentErrors: [...this.recentErrors],
      timestamp: new Date().toISOString(),
    };
  }
}
