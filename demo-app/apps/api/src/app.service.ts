import { Injectable } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { AuditService } from './audit/audit.service';
import { CacheService } from './cache/cache.service';
import { StorageService } from './storage/storage.service';

@Injectable()
export class AppService {
  private readonly startTime = Date.now();

  constructor(
    private readonly database: DatabaseService,
    private readonly audit: AuditService,
    private readonly cache: CacheService,
    private readonly storage: StorageService,
  ) {}

  async getHealth() {
    // Fetch all service statuses in parallel
    const [dbStatus, mongoStatus, redisStatus, minioStatus] = await Promise.all([
      this.database.getStatus(),
      this.audit.getStatus(),
      this.cache.getStatus(),
      this.storage.getStatus(),
    ]);

    // Use dynamic key based on database type
    const dbKey = this.database.dbType === 'mariadb' ? 'mariadb' : 'postgresql';

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      services: {
        [dbKey]: dbStatus,
        mongodb: mongoStatus,
        redis: redisStatus,
        minio: minioStatus,
      },
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
    const envVar = this.database.dbType === 'mariadb' ? 'MYSQL_URL' : 'DATABASE_URL';

    if (!this.database.enabled) {
      return {
        enabled: false,
        type: this.database.dbType,
        message: `Database is not configured (${envVar} not set)`,
      };
    }

    const status = await this.database.getStatus();

    if (!status.connected) {
      return {
        enabled: true,
        connected: false,
        type: this.database.dbType,
        message: 'Database connection failed',
      };
    }

    // Get some basic database info
    try {
      let tables: { table_name: string }[];
      let dbSize: { size: string }[];

      if (this.database.dbType === 'mariadb') {
        // MariaDB: Use information_schema with DATABASE()
        tables = await this.database.query<{ table_name: string }>(
          `SELECT TABLE_NAME as table_name FROM information_schema.TABLES
           WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME`,
          undefined,
          'list_tables',
        );

        dbSize = await this.database.query<{ size: string }>(
          `SELECT CONCAT(ROUND(SUM(DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2), ' MB') as size
           FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()`,
          undefined,
          'db_size',
        );
      } else {
        // PostgreSQL: Use information_schema with 'public' schema
        tables = await this.database.query<{ table_name: string }>(
          `SELECT table_name FROM information_schema.tables
           WHERE table_schema = 'public' ORDER BY table_name`,
          undefined,
          'list_tables',
        );

        dbSize = await this.database.query<{ size: string }>(
          `SELECT pg_size_pretty(pg_database_size(current_database())) as size`,
          undefined,
          'db_size',
        );
      }

      return {
        enabled: true,
        connected: true,
        type: this.database.dbType,
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
        type: this.database.dbType,
        host: status.host,
        database: status.database,
        version: status.version,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
