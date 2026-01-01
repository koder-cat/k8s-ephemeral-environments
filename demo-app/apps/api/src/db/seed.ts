/**
 * Database Seeding Script
 *
 * Seeds the database with deterministic test data using drizzle-seed.
 * Can be run manually via `pnpm db:seed` or automatically at app startup
 * when the database is empty.
 *
 * @see https://orm.drizzle.team/docs/seed-overview
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { seed } from 'drizzle-seed';
import { Pool } from 'pg';
import * as schema from './schema';
import { testRecords } from './schema';
import { count } from 'drizzle-orm';

/**
 * Seed data configuration
 */
const SEED_COUNT = 10;

/**
 * Check if the database already has data
 */
async function hasExistingData(db: ReturnType<typeof drizzle>): Promise<boolean> {
  const result = await db.select({ count: count() }).from(testRecords);
  return (result[0]?.count ?? 0) > 0;
}

/**
 * Seed the database with test records
 *
 * Uses drizzle-seed's built-in generators for deterministic,
 * reproducible data generation.
 */
export async function seedDatabase(pool: Pool): Promise<{ seeded: boolean; count: number }> {
  const db = drizzle(pool, { schema });

  // Check if data already exists
  if (await hasExistingData(db)) {
    console.log('Database already has data, skipping seed');
    return { seeded: false, count: 0 };
  }

  console.log(`Seeding database with ${SEED_COUNT} test records...`);

  // Use drizzle-seed for deterministic data generation
  await seed(db, { testRecords }).refine((funcs) => ({
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
  // drizzle-seed may set explicit IDs that don't update the sequence
  await pool.query(`
    SELECT setval(
      pg_get_serial_sequence('test_records', 'id'),
      COALESCE((SELECT MAX(id) FROM test_records), 0) + 1,
      false
    )
  `);

  console.log(`Seeded ${SEED_COUNT} test records successfully`);
  return { seeded: true, count: SEED_COUNT };
}

/**
 * CLI entry point
 * Run with: pnpm db:seed
 */
async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
  });

  try {
    const result = await seedDatabase(pool);
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

// Run if executed directly (not imported)
if (require.main === module) {
  main();
}
