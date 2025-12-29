import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool | null = null;
  private isConnected = false;

  get enabled(): boolean {
    return !!process.env.DATABASE_URL;
  }

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.log('DATABASE_URL not set, database features disabled');
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
      this.logger.log('Database connection established');
    } catch (error) {
      this.logger.error('Failed to connect to database', error);
      this.isConnected = false;
    }
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
      this.logger.log('Database connection closed');
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
      const result = await this.pool.query('SELECT version()');
      return {
        enabled: true,
        connected: true,
        host: process.env.PGHOST || 'unknown',
        database: process.env.PGDATABASE || 'unknown',
        version: result.rows[0]?.version?.split(' ')[1] || 'unknown',
      };
    } catch {
      return { enabled: true, connected: false };
    }
  }

  async query<T = unknown>(text: string, params?: unknown[]): Promise<T[]> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }
    const result = await this.pool.query(text, params);
    return result.rows as T[];
  }

  async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }
    return this.pool.connect();
  }
}
