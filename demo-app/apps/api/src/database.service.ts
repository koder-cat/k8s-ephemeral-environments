import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { Pool, PoolClient } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { resolve } from 'node:path';
import { MetricsService } from './metrics/metrics.service';
import { DrizzleDB } from './db';
import * as schema from './db/schema';
import { seedDatabase } from './db/seed';

/**
 * Valid operation types for database query metrics.
 * Used to categorize queries in Prometheus histograms.
 */
export type DbOperation =
  | 'query'
  | 'health_check'
  | 'list_tables'
  | 'db_size'
  | 'create_record'
  | 'read_record'
  | 'update_record'
  | 'delete_record'
  | 'heavy_query'
  | 'migration'
  | 'seed';

/**
 * Database pool statistics
 */
export interface PoolStats {
  total: number;
  idle: number;
  active: number;
  waiting: number;
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool | null = null;
  private _db: DrizzleDB | null = null;
  private isConnected = false;

  constructor(
    @InjectPinoLogger(DatabaseService.name)
    private readonly logger: PinoLogger,
    private readonly metrics: MetricsService,
  ) {}

  get enabled(): boolean {
    return !!process.env.DATABASE_URL;
  }

  /**
   * Get the Drizzle database instance for type-safe queries.
   * @throws Error if database is not connected
   */
  get db(): DrizzleDB {
    if (!this._db) {
      throw new Error('Database not connected');
    }
    return this._db;
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

      // Initialize Drizzle with the pool
      this._db = drizzle(this.pool, { schema });

      // Run migrations at startup (for ephemeral environments)
      await this.runMigrations();

      // Seed database if empty (auto-seed on first run)
      await this.runSeeding();

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

  /**
   * Run database migrations at startup.
   * For ephemeral PR environments, this ensures schema is always up-to-date.
   */
  private async runMigrations(): Promise<void> {
    if (!this._db || !this.pool) return;

    const endTimer = this.metrics.dbQueryDuration.startTimer({
      operation: 'migration',
    });
    let success = true;

    try {
      this.logger.info('Running database migrations...');

      // Migrations folder is relative to the compiled output
      // In production: dist/drizzle, in development: drizzle
      const migrationsFolder = resolve(__dirname, '../drizzle');

      await migrate(this._db, { migrationsFolder });

      this.logger.info('Migrations completed successfully');
    } catch (error) {
      success = false;
      this.logger.error({ error }, 'Migration failed');
      throw error;
    } finally {
      endTimer({ success: String(success) });
    }
  }

  /**
   * Seed the database with initial data if empty.
   * This runs automatically after migrations on first startup.
   */
  private async runSeeding(): Promise<void> {
    if (!this.pool) return;

    const endTimer = this.metrics.dbQueryDuration.startTimer({
      operation: 'seed',
    });
    let success = true;

    try {
      const result = await seedDatabase(this.pool);
      if (result.seeded) {
        this.logger.info({ count: result.count }, 'Database seeded successfully');
      }
    } catch (error) {
      success = false;
      this.logger.error({ error }, 'Seeding failed');
      // Don't throw - seeding failure shouldn't prevent app startup
    } finally {
      endTimer({ success: String(success) });
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
   * Execute a raw database query with metrics instrumentation.
   * Use this for complex queries that can't be expressed with Drizzle,
   * or when you need explicit metrics categorization.
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

  /**
   * Get current connection pool statistics
   */
  getPoolStats(): PoolStats {
    if (!this.pool) {
      return { total: 0, idle: 0, active: 0, waiting: 0 };
    }
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      active: this.pool.totalCount - this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
  }
}
