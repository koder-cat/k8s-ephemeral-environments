import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { eq, desc, count } from 'drizzle-orm';
import { DatabaseService } from '../database.service';
import { CacheService } from '../cache/cache.service';
import { AuditService } from '../audit/audit.service';
import { testRecords, TestRecord } from '../db/schema';
import { testRecords as mariadbTestRecords } from '../db/schema.mariadb';
import { CreateRecordDto, UpdateRecordDto } from './dto/record.dto';

/** Cache key for test records - exported for test verification */
export const CACHE_KEY_RECORDS = 'db:records';

/** Default cache TTL in seconds */
const DEFAULT_CACHE_TTL = 30;

/** Parse TTL from environment with NaN protection */
const parsedTtl = parseInt(process.env.CACHE_TTL_SECONDS || '', 10);
const CACHE_TTL_SECONDS = Number.isNaN(parsedTtl) || parsedTtl <= 0 ? DEFAULT_CACHE_TTL : parsedTtl;

// Re-export TestRecord type for consumers
export type { TestRecord } from '../db/schema';

export interface HeavyQueryResult {
  preset: string;
  rowCount: number;
  durationMs: number;
  timestamp: string;
}

const HEAVY_QUERY_PRESETS: Record<string, { sleepSeconds: number; rows: number }> = {
  light: { sleepSeconds: 0.5, rows: 100 },
  medium: { sleepSeconds: 1, rows: 1000 },
  heavy: { sleepSeconds: 3, rows: 5000 },
  extreme: { sleepSeconds: 5, rows: 10000 },
};

@Injectable()
export class DatabaseTestService {
  constructor(
    private readonly database: DatabaseService,
    private readonly cache: CacheService,
    private readonly audit: AuditService,
    @InjectPinoLogger(DatabaseTestService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Get the correct test records table reference based on database type.
   * This is needed because Drizzle ORM uses different table definitions per dialect.
   */
  private get testRecordsTable() {
    return this.database.dbType === 'mariadb' ? mariadbTestRecords : testRecords;
  }

  /**
   * Log a database operation to audit trail (fire-and-forget)
   */
  private logDbOperation(
    operation: string,
    table: string,
    recordId?: number,
    durationMs?: number,
  ): void {
    this.audit.logEvent({
      type: 'db_operation',
      timestamp: new Date(),
      metadata: {
        operation,
        table,
        recordId,
        durationMs,
      },
    });
  }

  /**
   * Invalidate cached data when records change.
   * Never throws - cache invalidation should not fail database operations.
   */
  private async invalidateCache(): Promise<void> {
    try {
      await this.cache.del(CACHE_KEY_RECORDS);
      this.logger.info('Cache invalidated');
    } catch (error) {
      this.logger.warn({ error }, 'Failed to invalidate cache');
    }
  }

  /**
   * Safely cache data without failing the operation.
   * Never throws - cache set should not fail database operations.
   */
  private async trySetCache<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await this.cache.set(key, value, ttlSeconds);
    } catch (error) {
      this.logger.warn({ error, key }, 'Failed to set cache');
    }
  }

  /**
   * Validate cached records have expected structure.
   * Note: Date fields become strings after JSON serialization in Redis.
   */
  private isValidCachedRecords(data: unknown): data is TestRecord[] {
    return (
      Array.isArray(data) &&
      data.every(
        (r) =>
          typeof r === 'object' &&
          r !== null &&
          typeof r.id === 'number' &&
          typeof r.name === 'string' &&
          typeof r.data === 'object' &&
          // Date fields are strings after JSON deserialization
          (typeof r.createdAt === 'string' || r.createdAt instanceof Date) &&
          (typeof r.updatedAt === 'string' || r.updatedAt instanceof Date),
      )
    );
  }

  /**
   * Get all test records using Drizzle ORM (with caching).
   * - Checks cache first, validates structure before returning
   * - Caches results on cache miss
   */
  async findAll(): Promise<TestRecord[]> {
    // Try cache first with validation
    const cached = await this.cache.get<TestRecord[]>(CACHE_KEY_RECORDS);
    if (cached && this.isValidCachedRecords(cached)) {
      this.logger.info({ count: cached.length }, 'Returning cached records');
      return cached;
    }

    this.logger.info('Fetching all test records from database');

    const table = this.testRecordsTable;
    const records = await (this.database.db as any)
      .select()
      .from(table)
      .orderBy(desc(table.createdAt))
      .limit(100);

    // Cache the results (fire-and-forget, won't block or fail the operation)
    this.trySetCache(CACHE_KEY_RECORDS, records, CACHE_TTL_SECONDS);

    this.logger.info(`Found ${records.length} test records, cached for ${CACHE_TTL_SECONDS}s`);
    return records;
  }

  /**
   * Get a single test record by ID
   */
  async findOne(id: number): Promise<TestRecord> {
    this.logger.info({ id }, 'Fetching test record');

    const table = this.testRecordsTable;
    const records = await (this.database.db as any)
      .select()
      .from(table)
      .where(eq(table.id, id));

    if (records.length === 0) {
      this.logger.warn({ id }, 'Test record not found');
      throw new NotFoundException(`Record with ID ${id} not found`);
    }

    return records[0];
  }

  /**
   * Create a new test record.
   * - Invalidates records cache
   * - Logs INSERT operation to audit trail with duration
   */
  async create(dto: CreateRecordDto): Promise<TestRecord> {
    this.logger.info({ name: dto.name }, 'Creating test record');

    const startTime = Date.now();
    let result: TestRecord[];

    if (this.database.dbType === 'mariadb') {
      // MariaDB: Use ? placeholders and separate SELECT for the inserted record
      await this.database.query(
        `INSERT INTO test_records (name, data) VALUES (?, ?)`,
        [dto.name, JSON.stringify(dto.data || {})],
        'create_record',
      );
      // Get the last inserted record
      result = await this.database.query<TestRecord>(
        `SELECT id, name, data, created_at as createdAt, updated_at as updatedAt
         FROM test_records WHERE id = LAST_INSERT_ID()`,
        undefined,
        'create_record',
      );
    } else {
      // PostgreSQL: Use $1, $2 placeholders with RETURNING
      result = await this.database.query<TestRecord>(
        `INSERT INTO test_records (name, data)
         VALUES ($1, $2::jsonb)
         RETURNING id, name, data, created_at as "createdAt", updated_at as "updatedAt"`,
        [dto.name, JSON.stringify(dto.data || {})],
        'create_record',
      );
    }

    const durationMs = Date.now() - startTime;

    if (result.length === 0) {
      throw new Error('Insert did not return a record');
    }

    // Invalidate cache after creating
    await this.invalidateCache();

    // Log to audit trail with duration
    this.logDbOperation('INSERT', 'test_records', result[0].id, durationMs);

    this.logger.info({ id: result[0].id, name: dto.name, durationMs }, 'Test record created');
    return result[0];
  }

  /**
   * Update an existing test record.
   * - Invalidates records cache
   * - Logs UPDATE operation to audit trail with duration
   */
  async update(id: number, dto: UpdateRecordDto): Promise<TestRecord> {
    this.logger.info({ id, updates: dto }, 'Updating test record');

    // Build update object dynamically with updatedAt
    const updateData: Partial<{
      name: string;
      data: Record<string, unknown>;
      updatedAt: Date;
    }> = {};

    if (dto.name !== undefined) {
      updateData.name = dto.name;
    }
    if (dto.data !== undefined) {
      updateData.data = dto.data;
    }

    if (Object.keys(updateData).length === 0) {
      return this.findOne(id);
    }

    // Always update the updatedAt timestamp
    updateData.updatedAt = new Date();

    const startTime = Date.now();
    let record: TestRecord;
    const table = this.testRecordsTable;

    if (this.database.dbType === 'mariadb') {
      // MariaDB: doesn't support RETURNING, check affectedRows then fetch
      // Build UPDATE dynamically to only update provided fields (matches PostgreSQL behavior)
      const setClauses: string[] = [];
      const params: unknown[] = [];

      if (updateData.name !== undefined) {
        setClauses.push('name = ?');
        params.push(updateData.name);
      }
      if (updateData.data !== undefined) {
        setClauses.push('data = ?');
        params.push(JSON.stringify(updateData.data));
      }
      // Always update timestamp
      setClauses.push('updated_at = ?');
      params.push(updateData.updatedAt);
      params.push(id);

      const result = await this.database.query<{ affectedRows: number }>(
        `UPDATE test_records SET ${setClauses.join(', ')} WHERE id = ?`,
        params,
        'update_record',
      );

      // MySQL2 returns affectedRows in the result header
      // If 0 rows affected, record doesn't exist
      const affectedRows = (result as unknown as { affectedRows?: number })?.affectedRows ?? 0;
      if (affectedRows === 0) {
        this.logger.warn({ id }, 'Test record not found for update');
        throw new NotFoundException(`Record with ID ${id} not found`);
      }

      // Fetch the updated record
      record = await this.findOne(id);
    } else {
      // PostgreSQL: use RETURNING for atomic update+fetch
      const records = await (this.database.db as any)
        .update(table)
        .set(updateData)
        .where(eq(table.id, id))
        .returning();

      if (records.length === 0) {
        this.logger.warn({ id }, 'Test record not found for update');
        throw new NotFoundException(`Record with ID ${id} not found`);
      }
      record = records[0];
    }

    const durationMs = Date.now() - startTime;

    // Invalidate cache after updating
    await this.invalidateCache();

    // Log to audit trail with duration
    this.logDbOperation('UPDATE', 'test_records', id, durationMs);

    this.logger.info({ id, durationMs }, 'Test record updated');
    return record;
  }

  /**
   * Delete a test record.
   * - Invalidates records cache
   * - Logs DELETE operation to audit trail with duration
   */
  async remove(id: number): Promise<{ deleted: boolean; id: number }> {
    this.logger.info({ id }, 'Deleting test record');

    const startTime = Date.now();
    const table = this.testRecordsTable;

    if (this.database.dbType === 'mariadb') {
      // MariaDB: Use DELETE and check affectedRows (single query, more atomic)
      const result = await this.database.query<{ affectedRows: number }>(
        `DELETE FROM test_records WHERE id = ?`,
        [id],
        'delete_record',
      );

      // MySQL2 returns affectedRows in the result header
      const affectedRows = (result as unknown as { affectedRows?: number })?.affectedRows ?? 0;
      if (affectedRows === 0) {
        this.logger.warn({ id }, 'Test record not found for deletion');
        throw new NotFoundException(`Record with ID ${id} not found`);
      }
    } else {
      // PostgreSQL: use RETURNING to verify deletion
      const deleted = await (this.database.db as any)
        .delete(table)
        .where(eq(table.id, id))
        .returning({ id: table.id });

      if (deleted.length === 0) {
        this.logger.warn({ id }, 'Test record not found for deletion');
        throw new NotFoundException(`Record with ID ${id} not found`);
      }
    }

    const durationMs = Date.now() - startTime;

    // Invalidate cache after deleting
    await this.invalidateCache();

    // Log to audit trail with duration
    this.logDbOperation('DELETE', 'test_records', id, durationMs);

    this.logger.info({ id, durationMs }, 'Test record deleted');
    return { deleted: true, id };
  }

  /**
   * Delete all test records.
   * - Invalidates records cache
   * - Logs DELETE_ALL operation to audit trail with duration
   */
  async removeAll(): Promise<{ deleted: number }> {
    this.logger.info('Deleting all test records');

    const startTime = Date.now();
    let deletedCount: number;
    const table = this.testRecordsTable;

    if (this.database.dbType === 'mariadb') {
      // MariaDB: Count first, then delete
      const countResult = await this.count();
      deletedCount = countResult.count;
      await (this.database.db as any).delete(table);
    } else {
      // PostgreSQL: use RETURNING to get count
      const deleted = await (this.database.db as any).delete(table).returning({ id: table.id });
      deletedCount = deleted.length;
    }

    const durationMs = Date.now() - startTime;

    // Invalidate cache after deleting all
    await this.invalidateCache();

    // Log to audit trail with duration
    this.logDbOperation('DELETE_ALL', 'test_records', undefined, durationMs);

    this.logger.info({ count: deletedCount, durationMs }, 'All test records deleted');
    return { deleted: deletedCount };
  }

  /**
   * Get record count using Drizzle
   */
  async count(): Promise<{ count: number }> {
    const table = this.testRecordsTable;
    const result = await (this.database.db as any).select({ count: count() }).from(table);

    return { count: Number(result[0]?.count || 0) };
  }

  /**
   * Run a heavy query to simulate slow database operations.
   * Uses raw SQL for database-specific functions.
   * - PostgreSQL: pg_sleep, generate_series
   * - MariaDB: SLEEP, recursive CTE
   */
  async runHeavyQuery(preset: string): Promise<HeavyQueryResult> {
    const config = HEAVY_QUERY_PRESETS[preset];

    if (!config) {
      throw new Error(
        `Unknown preset: ${preset}. Valid presets: ${Object.keys(HEAVY_QUERY_PRESETS).join(', ')}`,
      );
    }

    this.logger.info(
      { preset, sleepSeconds: config.sleepSeconds, rows: config.rows },
      'Starting heavy query',
    );

    const startTime = Date.now();

    if (this.database.dbType === 'mariadb') {
      // MariaDB: Use SLEEP() and recursive CTE for generate_series equivalent
      // First, set recursion depth if needed for extreme preset
      if (config.rows > 1000) {
        await this.database.query(
          `SET SESSION cte_max_recursion_depth = ?`,
          [config.rows + 1],
          'heavy_query',
        );
      }

      await this.database.query(
        `WITH RECURSIVE
           series AS (
             SELECT 1 as n
             UNION ALL
             SELECT n + 1 FROM series WHERE n < ?
           )
         SELECT
           (SELECT SLEEP(?)) as sleep_done,
           s.n,
           MD5(CAST(s.n AS CHAR)) as hash,
           NOW() as timestamp
         FROM series s
         LIMIT ?`,
        [config.rows, config.sleepSeconds, config.rows],
        'heavy_query',
      );
    } else {
      // PostgreSQL: Use pg_sleep and generate_series
      await this.database.query(
        `WITH sleep AS (SELECT pg_sleep($1))
         SELECT
           s.n,
           md5(s.n::text) as hash,
           NOW() as timestamp
         FROM sleep, generate_series(1, $2) s(n)`,
        [config.sleepSeconds, config.rows],
        'heavy_query',
      );
    }

    const durationMs = Date.now() - startTime;

    this.logger.info({ preset, durationMs, rowCount: config.rows }, 'Heavy query completed');

    return {
      preset,
      rowCount: config.rows,
      durationMs,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get available heavy query presets
   */
  getHeavyQueryPresets(): Record<string, { sleepSeconds: number; rows: number }> {
    return { ...HEAVY_QUERY_PRESETS };
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    poolStats: { total: number; idle: number; active: number; waiting: number };
    recordCount: number;
    tableSize: string;
    dbType: string;
  }> {
    const poolStats = this.database.getPoolStats();
    const countResult = await this.count();

    let sizeResult: { size: string }[];

    if (this.database.dbType === 'mariadb') {
      // MariaDB: Use information_schema.TABLES
      sizeResult = await this.database.query<{ size: string }>(
        `SELECT CONCAT(ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024, 2), ' KB') as size
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'test_records'`,
        undefined,
        'db_size',
      );
    } else {
      // PostgreSQL: Use pg_size_pretty
      sizeResult = await this.database.query<{ size: string }>(
        `SELECT pg_size_pretty(pg_total_relation_size('test_records')) as size`,
        undefined,
        'db_size',
      );
    }

    return {
      poolStats,
      recordCount: countResult.count,
      tableSize: sizeResult[0]?.size || 'unknown',
      dbType: this.database.dbType,
    };
  }
}
