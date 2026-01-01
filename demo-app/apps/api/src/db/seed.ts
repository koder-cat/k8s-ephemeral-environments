/**
 * Database Seeding Script
 *
 * Seeds the database with deterministic test data using drizzle-seed.
 * Supports both PostgreSQL and MariaDB dialects.
 * Can be run manually via `pnpm db:seed` or automatically at app startup
 * when the database is empty.
 *
 * @see https://orm.drizzle.team/docs/seed-overview
 */

import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { drizzle as drizzleMysql } from 'drizzle-orm/mysql2';
import { seed } from 'drizzle-seed';
import { Pool as PgPool } from 'pg';
import mysql, { Pool as MysqlPool } from 'mysql2/promise';
import { count } from 'drizzle-orm';
import * as pgSchema from './schema';
import * as mariadbSchema from './schema.mariadb';
import { DatabaseType, getDatabaseType } from './index';

/**
 * Seed data configuration
 */
const SEED_COUNT = 10;

type AnyPool = PgPool | MysqlPool;

/**
 * Check if the database already has data (PostgreSQL)
 */
async function hasExistingDataPg(db: ReturnType<typeof drizzlePg>): Promise<boolean> {
  const result = await db.select({ count: count() }).from(pgSchema.testRecords);
  return (result[0]?.count ?? 0) > 0;
}

/**
 * Check if the database already has data (MariaDB)
 */
async function hasExistingDataMysql(db: ReturnType<typeof drizzleMysql>): Promise<boolean> {
  const result = await db.select({ count: count() }).from(mariadbSchema.testRecords);
  return (result[0]?.count ?? 0) > 0;
}

/**
 * Reset PostgreSQL sequence after seeding
 */
async function resetPostgresSequence(pool: PgPool): Promise<void> {
  await pool.query(`
    SELECT setval(
      pg_get_serial_sequence('test_records', 'id'),
      COALESCE((SELECT MAX(id) FROM test_records), 0) + 1,
      false
    )
  `);
}

/**
 * Reset MariaDB AUTO_INCREMENT after seeding
 * MariaDB doesn't allow subqueries in ALTER TABLE, so we use two steps
 */
async function resetMariaDbAutoIncrement(pool: MysqlPool): Promise<void> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT COALESCE(MAX(id), 0) + 1 as next_id FROM test_records'
  );
  const rawNextId = rows[0]?.next_id;
  const nextId = Number(rawNextId);

  // Validate nextId is a safe positive integer to prevent SQL injection
  if (!Number.isInteger(nextId) || nextId < 1 || nextId > 2147483647) {
    throw new Error(`Invalid AUTO_INCREMENT value: ${rawNextId}`);
  }

  await pool.query(`ALTER TABLE test_records AUTO_INCREMENT = ${nextId}`);
}

/**
 * Seed the database with test records
 *
 * Uses drizzle-seed's built-in generators for deterministic,
 * reproducible data generation.
 */
export async function seedDatabase(
  pool: AnyPool,
  dbType: DatabaseType = 'postgresql'
): Promise<{ seeded: boolean; count: number }> {
  console.log(`Seeding database (${dbType}) with ${SEED_COUNT} test records...`);

  if (dbType === 'mariadb') {
    const mysqlPool = pool as MysqlPool;
    const db = drizzleMysql(mysqlPool, { schema: mariadbSchema, mode: 'default' });

    // Check if data already exists (cast to any for type compatibility)
    if (await hasExistingDataMysql(db as any)) {
      console.log('Database already has data, skipping seed');
      return { seeded: false, count: 0 };
    }

    // Use drizzle-seed for deterministic data generation
    await seed(db, { testRecords: mariadbSchema.testRecords }).refine((funcs) => ({
      testRecords: {
        count: SEED_COUNT,
        columns: {
          name: funcs.fullName(),
          data: funcs.default({
            defaultValue: {
              type: 'seed',
              environment: 'ephemeral',
              generated: true,
            },
          }),
        },
      },
    }));

    // Reset the AUTO_INCREMENT to avoid duplicate key errors after seeding
    await resetMariaDbAutoIncrement(mysqlPool);

    console.log(`Seeded ${SEED_COUNT} test records successfully (MariaDB)`);
    return { seeded: true, count: SEED_COUNT };
  } else {
    const pgPool = pool as PgPool;
    const db = drizzlePg(pgPool, { schema: pgSchema });

    // Check if data already exists
    if (await hasExistingDataPg(db)) {
      console.log('Database already has data, skipping seed');
      return { seeded: false, count: 0 };
    }

    // Use drizzle-seed for deterministic data generation
    await seed(db, { testRecords: pgSchema.testRecords }).refine((funcs) => ({
      testRecords: {
        count: SEED_COUNT,
        columns: {
          name: funcs.fullName(),
          data: funcs.default({
            defaultValue: {
              type: 'seed',
              environment: 'ephemeral',
              generated: true,
            },
          }),
        },
      },
    }));

    // Reset the sequence to avoid duplicate key errors after seeding
    await resetPostgresSequence(pgPool);

    console.log(`Seeded ${SEED_COUNT} test records successfully (PostgreSQL)`);
    return { seeded: true, count: SEED_COUNT };
  }
}

/**
 * CLI entry point
 * Run with: pnpm db:seed
 */
async function main() {
  const dbType = getDatabaseType();

  if (dbType === 'mariadb') {
    if (!process.env.MYSQL_URL) {
      console.error('MYSQL_URL environment variable is required for MariaDB');
      process.exit(1);
    }

    const pool = mysql.createPool({
      uri: process.env.MYSQL_URL,
      waitForConnections: true,
      connectionLimit: 1,
    });

    try {
      const result = await seedDatabase(pool, dbType);
      if (result.seeded) {
        console.log(`Successfully seeded ${result.count} records`);
      }
    } catch (error) {
      console.error('Seed failed:', error);
      process.exit(1);
    } finally {
      await pool.end();
    }
  } else {
    if (!process.env.DATABASE_URL) {
      console.error('DATABASE_URL environment variable is required for PostgreSQL');
      process.exit(1);
    }

    const pool = new PgPool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
    });

    try {
      const result = await seedDatabase(pool, dbType);
      if (result.seeded) {
        console.log(`Successfully seeded ${result.count} records`);
      }
    } catch (error) {
      console.error('Seed failed:', error);
      process.exit(1);
    } finally {
      await pool.end();
    }
  }
}

// Run if executed directly (not imported)
if (require.main === module) {
  main();
}
