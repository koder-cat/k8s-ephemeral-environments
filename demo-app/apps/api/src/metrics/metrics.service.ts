import { Injectable, OnModuleInit } from '@nestjs/common';
import * as client from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly registry: client.Registry;

  // HTTP metrics
  public readonly httpRequestDuration: client.Histogram<string>;
  public readonly httpRequestTotal: client.Counter<string>;

  // Database metrics
  public readonly dbPoolTotal: client.Gauge<string>;
  public readonly dbPoolIdle: client.Gauge<string>;
  public readonly dbPoolWaiting: client.Gauge<string>;
  public readonly dbQueryDuration: client.Histogram<string>;

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
}
