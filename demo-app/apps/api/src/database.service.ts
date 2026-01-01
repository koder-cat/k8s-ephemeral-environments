import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { Pool as PgPool, PoolClient as PgPoolClient } from 'pg';
import mysql, { Pool as MysqlPool, PoolConnection as MysqlPoolConnection } from 'mysql2/promise';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { drizzle as drizzleMysql } from 'drizzle-orm/mysql2';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import { migrate as migrateMysql } from 'drizzle-orm/mysql2/migrator';
import { resolve } from 'node:path';
import { MetricsService } from './metrics/metrics.service';
import { DrizzleDB, DatabaseType, getDatabaseType } from './db';
import * as pgSchema from './db/schema';
import * as mariadbSchema from './db/schema.mariadb';
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
  private pgPool: PgPool | null = null;
  private mysqlPool: MysqlPool | null = null;
  private _db: DrizzleDB | null = null;
  private _dbType: DatabaseType;
  private isConnected = false;

  constructor(
    @InjectPinoLogger(DatabaseService.name)
    private readonly logger: PinoLogger,
    private readonly metrics: MetricsService,
  ) {
    this._dbType = getDatabaseType();
  }

  /**
   * Get the current database type (postgresql or mariadb)
   */
  get dbType(): DatabaseType {
    return this._dbType;
  }

  /**
   * Check if database is enabled based on environment variables
   */
  get enabled(): boolean {
    if (this._dbType === 'mariadb') {
      return !!process.env.MYSQL_URL;
    }
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
    if (this._dbType === 'mariadb') {
      // MySQL2 pool doesn't expose the same stats as pg
      // We can only set basic metrics
      if (this.mysqlPool) {
        // MySQL2 pool has different API - limited stats available
        this.metrics.dbPoolTotal.set(1);
        this.metrics.dbPoolIdle.set(this.isConnected ? 1 : 0);
        this.metrics.dbPoolWaiting.set(0);
      }
    } else if (this.pgPool) {
      this.metrics.dbPoolTotal.set(this.pgPool.totalCount);
      this.metrics.dbPoolIdle.set(this.pgPool.idleCount);
      this.metrics.dbPoolWaiting.set(this.pgPool.waitingCount);
    }
  }

  async onModuleInit() {
    if (!this.enabled) {
      const envVar = this._dbType === 'mariadb' ? 'MYSQL_URL' : 'DATABASE_URL';
      this.logger.info(`${envVar} not set, database features disabled (type: ${this._dbType})`);
      return;
    }

    try {
      if (this._dbType === 'mariadb') {
        await this.initMariaDB();
      } else {
        await this.initPostgreSQL();
      }

      // Wait for database to be truly ready (with retry logic)
      await this.waitForDatabase();

      // Run migrations at startup (for ephemeral environments)
      await this.runMigrations();

      // Seed database if empty (auto-seed on first run)
      await this.runSeeding();

      this.isConnected = true;
      this.updatePoolMetrics();
      this.logger.info(`Database initialization complete (${this._dbType})`);
    } catch (error) {
      this.logger.error({ error }, 'Failed to initialize database');
      this.isConnected = false;
      // Re-throw to prevent app from starting with broken database
      throw error;
    }
  }

  /**
   * Initialize PostgreSQL connection pool and Drizzle instance
   */
  private async initPostgreSQL(): Promise<void> {
    this.pgPool = new PgPool({
      connectionString: process.env.DATABASE_URL,
      max: 5, // Small pool for ephemeral environments
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    this._db = drizzlePg(this.pgPool, { schema: pgSchema });
  }

  /**
   * Initialize MariaDB connection pool and Drizzle instance
   */
  private async initMariaDB(): Promise<void> {
    this.mysqlPool = mysql.createPool({
      uri: process.env.MYSQL_URL,
      waitForConnections: true,
      connectionLimit: 5, // Small pool for ephemeral environments
      queueLimit: 0,
      connectTimeout: 5000,
    });

    this._db = drizzleMysql(this.mysqlPool, { schema: mariadbSchema, mode: 'default' });
  }

  /**
   * Wait for database to be ready with short retry.
   *
   * Enterprise approach: Init containers handle primary readiness check.
   * This short retry (3 attempts, ~3s) handles only the tiny timing window
   * between init container exit and app startup. If still failing after
   * this, we fail fast and let Kubernetes restart us with its own backoff.
   */
  private async waitForDatabase(
    maxRetries = 3,
    delayMs = 1000,
  ): Promise<void> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (this._dbType === 'mariadb') {
          if (!this.mysqlPool) return;
          const connection = await this.mysqlPool.getConnection();
          await connection.query('SELECT 1');
          connection.release();
        } else {
          if (!this.pgPool) return;
          const client = await this.pgPool.connect();
          await client.query('SELECT 1');
          client.release();
        }

        if (attempt > 1) {
          this.logger.info({ attempt }, 'Database connection established');
        }
        return;
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries) {
          this.logger.warn(
            { attempt, maxRetries, error: lastError.message },
            'Database not ready, retrying...',
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    // Fail fast - let Kubernetes handle restart with its own backoff
    throw new Error(
      `Database not available after ${maxRetries} attempts: ${lastError?.message}`,
    );
  }

  /**
   * Run database migrations at startup.
   * For ephemeral PR environments, this ensures schema is always up-to-date.
   */
  private async runMigrations(): Promise<void> {
    if (!this._db) return;

    const endTimer = this.metrics.dbQueryDuration.startTimer({
      operation: 'migration',
    });
    let success = true;

    try {
      this.logger.info(`Running database migrations (${this._dbType})...`);

      // Migrations folder is copied to dist/drizzle or dist/drizzle-mariadb during Docker build
      const migrationsFolder = this._dbType === 'mariadb'
        ? resolve(__dirname, 'drizzle-mariadb')
        : resolve(__dirname, 'drizzle');

      if (this._dbType === 'mariadb') {
        // Cast through unknown to satisfy TypeScript with the union type
        await migrateMysql(this._db as unknown as ReturnType<typeof drizzleMysql>, { migrationsFolder });
      } else {
        await migratePg(this._db as unknown as ReturnType<typeof drizzlePg>, { migrationsFolder });
      }

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
    const endTimer = this.metrics.dbQueryDuration.startTimer({
      operation: 'seed',
    });
    let success = true;

    try {
      const pool = this._dbType === 'mariadb' ? this.mysqlPool : this.pgPool;
      if (!pool) return;

      const result = await seedDatabase(pool, this._dbType);
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
    if (this._dbType === 'mariadb' && this.mysqlPool) {
      await this.mysqlPool.end();
      this.logger.info('MariaDB connection closed');
    } else if (this.pgPool) {
      await this.pgPool.end();
      this.logger.info('PostgreSQL connection closed');
    }
  }

  async getStatus(): Promise<{
    enabled: boolean;
    connected: boolean;
    type?: DatabaseType;
    host?: string;
    database?: string;
    version?: string;
  }> {
    if (!this.enabled) {
      return { enabled: false, connected: false, type: this._dbType };
    }

    if (!this.isConnected) {
      return { enabled: true, connected: false, type: this._dbType };
    }

    try {
      const result = await this.query<{ version: string }>(
        'SELECT version() as version',
        undefined,
        'health_check',
      );

      const host = this._dbType === 'mariadb'
        ? (process.env.MYSQL_HOST || 'unknown')
        : (process.env.PGHOST || 'unknown');

      const database = this._dbType === 'mariadb'
        ? (process.env.MYSQL_DATABASE || 'unknown')
        : (process.env.PGDATABASE || 'unknown');

      // Parse version string (PostgreSQL: "PostgreSQL 16.1", MariaDB: "11.4.0-MariaDB")
      const versionStr = result[0]?.version || '';
      const version = this._dbType === 'mariadb'
        ? versionStr.split('-')[0] || 'unknown'
        : versionStr.split(' ')[1] || 'unknown';

      return {
        enabled: true,
        connected: true,
        type: this._dbType,
        host,
        database,
        version,
      };
    } catch {
      return { enabled: true, connected: false, type: this._dbType };
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
    const endTimer = this.metrics.dbQueryDuration.startTimer({
      operation,
    });
    let success = true;

    try {
      if (this._dbType === 'mariadb') {
        if (!this.mysqlPool) {
          throw new Error('Database not connected');
        }
        // MySQL2 returns [rows, fields] tuple
        const [rows] = await this.mysqlPool.query(text, params);
        return rows as T[];
      } else {
        if (!this.pgPool) {
          throw new Error('Database not connected');
        }
        // PostgreSQL returns { rows: T[] }
        const result = await this.pgPool.query(text, params);
        return result.rows as T[];
      }
    } catch (error) {
      success = false;
      throw error;
    } finally {
      endTimer({ success: String(success) });
      this.updatePoolMetrics();
    }
  }

  /**
   * Get a client/connection from the pool (PostgreSQL only)
   * @deprecated For PostgreSQL compatibility only. Use query() for both dialects.
   */
  async getClient(): Promise<PgPoolClient> {
    if (this._dbType === 'mariadb') {
      throw new Error('getClient() is not supported for MariaDB. Use query() instead.');
    }
    if (!this.pgPool) {
      throw new Error('Database not connected');
    }
    return this.pgPool.connect();
  }

  /**
   * Get a MySQL connection from the pool (MariaDB only)
   */
  async getMysqlConnection(): Promise<MysqlPoolConnection> {
    if (this._dbType !== 'mariadb') {
      throw new Error('getMysqlConnection() is only available for MariaDB');
    }
    if (!this.mysqlPool) {
      throw new Error('Database not connected');
    }
    return this.mysqlPool.getConnection();
  }

  /**
   * Get current connection pool statistics
   *
   * Note: MySQL2 pool does not expose public statistics like node-postgres does.
   * The mysql2 PoolConnection has internal properties (_allConnections, _freeConnections,
   * _connectionQueue) but these are private API and may change between versions.
   * For production MariaDB monitoring, consider using:
   * - Database-level metrics: SHOW STATUS LIKE 'Threads_%'
   * - Application-level connection tracking
   * - External monitoring tools (ProxySQL, PMM)
   */
  getPoolStats(): PoolStats {
    if (this._dbType === 'mariadb') {
      // MySQL2 pool does not expose connection statistics via public API
      // Return basic availability indicator only
      return {
        total: this.isConnected ? 1 : 0,
        idle: this.isConnected ? 1 : 0,
        active: 0,
        waiting: 0,
      };
    }

    if (!this.pgPool) {
      return { total: 0, idle: 0, active: 0, waiting: 0 };
    }
    return {
      total: this.pgPool.totalCount,
      idle: this.pgPool.idleCount,
      active: this.pgPool.totalCount - this.pgPool.idleCount,
      waiting: this.pgPool.waitingCount,
    };
  }
}
