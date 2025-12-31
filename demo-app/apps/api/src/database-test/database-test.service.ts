import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database.service';
import { CreateRecordDto, UpdateRecordDto } from './dto/record.dto';

export interface TestRecord {
  id: number;
  name: string;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

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
  private readonly logger = new Logger(DatabaseTestService.name);

  constructor(private readonly database: DatabaseService) {}

  /**
   * Get all test records
   */
  async findAll(): Promise<TestRecord[]> {
    this.logger.log('Fetching all test records');

    const records = await this.database.query<TestRecord>(
      `SELECT id, name, data, created_at, updated_at
       FROM test_records
       ORDER BY created_at DESC
       LIMIT 100`,
      undefined,
      'read_record',
    );

    this.logger.log(`Found ${records.length} test records`);
    return records;
  }

  /**
   * Get a single test record by ID
   */
  async findOne(id: number): Promise<TestRecord> {
    this.logger.log({ id }, 'Fetching test record');

    const records = await this.database.query<TestRecord>(
      `SELECT id, name, data, created_at, updated_at
       FROM test_records
       WHERE id = $1`,
      [id],
      'read_record',
    );

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
    this.logger.log({ name: dto.name }, 'Creating test record');

    const records = await this.database.query<TestRecord>(
      `INSERT INTO test_records (name, data)
       VALUES ($1, $2)
       RETURNING id, name, data, created_at, updated_at`,
      [dto.name, JSON.stringify(dto.data || {})],
      'create_record',
    );

    this.logger.log({ id: records[0].id, name: dto.name }, 'Test record created');
    return records[0];
  }

  /**
   * Update an existing test record
   */
  async update(id: number, dto: UpdateRecordDto): Promise<TestRecord> {
    this.logger.log({ id, updates: dto }, 'Updating test record');

    // Build dynamic update query
    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (dto.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(dto.name);
    }
    if (dto.data !== undefined) {
      updates.push(`data = $${paramIndex++}`);
      params.push(JSON.stringify(dto.data));
    }

    if (updates.length === 0) {
      return this.findOne(id);
    }

    params.push(id);

    const records = await this.database.query<TestRecord>(
      `UPDATE test_records
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, name, data, created_at, updated_at`,
      params,
      'update_record',
    );

    if (records.length === 0) {
      this.logger.warn({ id }, 'Test record not found for update');
      throw new NotFoundException(`Record with ID ${id} not found`);
    }

    this.logger.log({ id }, 'Test record updated');
    return records[0];
  }

  /**
   * Delete a test record
   */
  async remove(id: number): Promise<{ deleted: boolean; id: number }> {
    this.logger.log({ id }, 'Deleting test record');

    const result = await this.database.query<{ id: number }>(
      `DELETE FROM test_records WHERE id = $1 RETURNING id`,
      [id],
      'delete_record',
    );

    if (result.length === 0) {
      this.logger.warn({ id }, 'Test record not found for deletion');
      throw new NotFoundException(`Record with ID ${id} not found`);
    }

    this.logger.log({ id }, 'Test record deleted');
    return { deleted: true, id };
  }

  /**
   * Delete all test records
   */
  async removeAll(): Promise<{ deleted: number }> {
    this.logger.log('Deleting all test records');

    const result = await this.database.query<{ count: string }>(
      `WITH deleted AS (DELETE FROM test_records RETURNING *)
       SELECT COUNT(*) as count FROM deleted`,
      undefined,
      'delete_record',
    );

    const count = parseInt(result[0]?.count || '0', 10);
    this.logger.log({ count }, 'All test records deleted');
    return { deleted: count };
  }

  /**
   * Get record count
   */
  async count(): Promise<{ count: number }> {
    const result = await this.database.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM test_records`,
      undefined,
      'read_record',
    );

    return { count: parseInt(result[0]?.count || '0', 10) };
  }

  /**
   * Run a heavy query to simulate slow database operations
   */
  async runHeavyQuery(preset: string): Promise<HeavyQueryResult> {
    const config = HEAVY_QUERY_PRESETS[preset];

    if (!config) {
      throw new Error(
        `Unknown preset: ${preset}. Valid presets: ${Object.keys(HEAVY_QUERY_PRESETS).join(', ')}`,
      );
    }

    this.logger.log(
      { preset, sleepSeconds: config.sleepSeconds, rows: config.rows },
      'Starting heavy query',
    );

    const startTime = Date.now();

    // Run a query that simulates heavy load
    // 1. pg_sleep for artificial delay (in CTE to run only once)
    // 2. generate_series for row generation
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

    this.logger.log(
      { preset, durationMs, rowCount: config.rows },
      'Heavy query completed',
    );

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
