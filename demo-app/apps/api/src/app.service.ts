import { Injectable } from '@nestjs/common';
import { DatabaseService } from './database.service';

@Injectable()
export class AppService {
  private readonly startTime = Date.now();

  constructor(private readonly database: DatabaseService) {}

  async getHealth() {
    const dbStatus = await this.database.getStatus();

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      database: dbStatus,
    };
  }

  getInfo() {
    return {
      pr: process.env.PR_NUMBER || 'unknown',
      commit: process.env.COMMIT_SHA || 'unknown',
      branch: process.env.BRANCH_NAME || 'unknown',
      version: process.env.APP_VERSION || '1.0.0',
      previewUrl: process.env.PREVIEW_URL || 'unknown',
    };
  }

  async getDatabaseInfo() {
    if (!this.database.enabled) {
      return {
        enabled: false,
        message: 'Database is not configured (DATABASE_URL not set)',
      };
    }

    const status = await this.database.getStatus();

    if (!status.connected) {
      return {
        enabled: true,
        connected: false,
        message: 'Database connection failed',
      };
    }

    // Get some basic database info
    try {
      const tables = await this.database.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' ORDER BY table_name`,
      );

      const dbSize = await this.database.query<{ size: string }>(
        `SELECT pg_size_pretty(pg_database_size(current_database())) as size`,
      );

      return {
        enabled: true,
        connected: true,
        host: status.host,
        database: status.database,
        version: status.version,
        tables: tables.map((t) => t.table_name),
        size: dbSize[0]?.size || 'unknown',
      };
    } catch (error) {
      return {
        enabled: true,
        connected: true,
        host: status.host,
        database: status.database,
        version: status.version,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
