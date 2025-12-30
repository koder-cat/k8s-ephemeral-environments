import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { Pool, PoolClient } from 'pg';
import { MetricsService } from './metrics/metrics.service';

/**
 * Valid operation types for database query metrics.
 * Used to categorize queries in Prometheus histograms.
 */
export type DbOperation =
  | 'query'
  | 'health_check'
  | 'list_tables'
  | 'db_size';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool | null = null;
  private isConnected = false;

  constructor(
    @InjectPinoLogger(DatabaseService.name)
    private readonly logger: PinoLogger,
    private readonly metrics: MetricsService,
  ) {}

  get enabled(): boolean {
    return !!process.env.DATABASE_URL;
  }

  private updatePoolMetrics() {
    if (this.pool) {
      this.metrics.dbPoolTotal.set(this.pool.totalCount);
      this.metrics.dbPoolIdle.set(this.pool.idleCount);
      this.metrics.dbPoolWaiting.set(this.pool.waitingCount);
    }
  }

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.info('DATABASE_URL not set, database features disabled');
      return;
    }

    try {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 5, // Small pool for ephemeral environments
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();

      this.isConnected = true;
      this.updatePoolMetrics();
      this.logger.info('Database connection established');
    } catch (error) {
      this.logger.error({ error }, 'Failed to connect to database');
      this.isConnected = false;
    }
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
      this.logger.info('Database connection closed');
    }
  }

  async getStatus(): Promise<{
    enabled: boolean;
    connected: boolean;
    host?: string;
    database?: string;
    version?: string;
  }> {
    if (!this.enabled) {
      return { enabled: false, connected: false };
    }

    if (!this.isConnected || !this.pool) {
      return { enabled: true, connected: false };
    }

    try {
      const result = await this.query<{ version: string }>(
        'SELECT version()',
        undefined,
        'health_check',
      );
      return {
        enabled: true,
        connected: true,
        host: process.env.PGHOST || 'unknown',
        database: process.env.PGDATABASE || 'unknown',
        version: result[0]?.version?.split(' ')[1] || 'unknown',
      };
    } catch {
      return { enabled: true, connected: false };
    }
  }

  /**
   * Execute a database query with metrics instrumentation.
   *
   * @param text - SQL query string
   * @param params - Query parameters for parameterized queries
   * @param operation - Operation type for metrics categorization
   * @returns Query result rows
   * @throws Error if database is not connected
   */
  async query<T = unknown>(
    text: string,
    params?: unknown[],
    operation: DbOperation = 'query',
  ): Promise<T[]> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }

    const endTimer = this.metrics.dbQueryDuration.startTimer({
      operation,
    });
    let success = true;

    try {
      const result = await this.pool.query(text, params);
      return result.rows as T[];
    } catch (error) {
      success = false;
      throw error;
    } finally {
      endTimer({ success: String(success) });
      this.updatePoolMetrics();
    }
  }

  async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }
    return this.pool.connect();
  }
}
