import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { eq, desc, count } from 'drizzle-orm';
import { DatabaseService } from '../database.service';
import { testRecords, TestRecord } from '../db/schema';
import { CreateRecordDto, UpdateRecordDto } from './dto/record.dto';

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
    @InjectPinoLogger(DatabaseTestService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Get all test records using Drizzle ORM
   */
  async findAll(): Promise<TestRecord[]> {
    this.logger.info('Fetching all test records');

    const records = await this.database.db
      .select()
      .from(testRecords)
      .orderBy(desc(testRecords.createdAt))
      .limit(100);

    this.logger.info(`Found ${records.length} test records`);
    return records;
  }

  /**
   * Get a single test record by ID
   */
  async findOne(id: number): Promise<TestRecord> {
    this.logger.info({ id }, 'Fetching test record');

    const records = await this.database.db
      .select()
      .from(testRecords)
      .where(eq(testRecords.id, id));

    if (records.length === 0) {
      this.logger.warn({ id }, 'Test record not found');
      throw new NotFoundException(`Record with ID ${id} not found`);
    }

    return records[0];
  }

  /**
   * Create a new test record
   */
  async create(dto: CreateRecordDto): Promise<TestRecord> {
    this.logger.info({ name: dto.name }, 'Creating test record');

    // Use raw SQL for insert to properly handle jsonb serialization
    const result = await this.database.query<TestRecord>(
      `INSERT INTO test_records (name, data)
       VALUES ($1, $2::jsonb)
       RETURNING id, name, data, created_at as "createdAt", updated_at as "updatedAt"`,
      [dto.name, JSON.stringify(dto.data || {})],
      'create_record',
    );

    if (result.length === 0) {
      throw new Error('Insert did not return a record');
    }

    this.logger.info({ id: result[0].id, name: dto.name }, 'Test record created');
    return result[0];
  }

  /**
   * Update an existing test record
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

    const records = await this.database.db
      .update(testRecords)
      .set(updateData)
      .where(eq(testRecords.id, id))
      .returning();

    if (records.length === 0) {
      this.logger.warn({ id }, 'Test record not found for update');
      throw new NotFoundException(`Record with ID ${id} not found`);
    }

    this.logger.info({ id }, 'Test record updated');
    return records[0];
  }

  /**
   * Delete a test record
   */
  async remove(id: number): Promise<{ deleted: boolean; id: number }> {
    this.logger.info({ id }, 'Deleting test record');

    const deleted = await this.database.db
      .delete(testRecords)
      .where(eq(testRecords.id, id))
      .returning({ id: testRecords.id });

    if (deleted.length === 0) {
      this.logger.warn({ id }, 'Test record not found for deletion');
      throw new NotFoundException(`Record with ID ${id} not found`);
    }

    this.logger.info({ id }, 'Test record deleted');
    return { deleted: true, id };
  }

  /**
   * Delete all test records
   */
  async removeAll(): Promise<{ deleted: number }> {
    this.logger.info('Deleting all test records');

    const deleted = await this.database.db.delete(testRecords).returning({ id: testRecords.id });

    this.logger.info({ count: deleted.length }, 'All test records deleted');
    return { deleted: deleted.length };
  }

  /**
   * Get record count using Drizzle
   */
  async count(): Promise<{ count: number }> {
    const result = await this.database.db.select({ count: count() }).from(testRecords);

    return { count: Number(result[0]?.count || 0) };
  }

  /**
   * Run a heavy query to simulate slow database operations.
   * Uses raw SQL for PostgreSQL-specific functions (pg_sleep, generate_series).
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

    // Use raw SQL for PostgreSQL-specific functions
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
  }> {
    const poolStats = this.database.getPoolStats();
    const countResult = await this.count();

    // Use raw SQL for PostgreSQL-specific function
    const sizeResult = await this.database.query<{ size: string }>(
      `SELECT pg_size_pretty(pg_total_relation_size('test_records')) as size`,
      undefined,
      'db_size',
    );

    return {
      poolStats,
      recordCount: countResult.count,
      tableSize: sizeResult[0]?.size || 'unknown',
    };
  }
}
