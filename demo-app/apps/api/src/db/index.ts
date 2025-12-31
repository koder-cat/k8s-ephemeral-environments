/**
 * Database Module
 *
 * Central export point for database-related functionality.
 * Provides Drizzle ORM instance factory and schema exports.
 */

import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export type DrizzleDB = NodePgDatabase<typeof schema>;

/**
 * Creates a Drizzle database instance from a pg Pool.
 * This allows sharing the pool with metrics and existing infrastructure.
 *
 * @param pool - PostgreSQL connection pool
 * @returns Drizzle database instance with full schema type inference
 */
export function createDrizzleDb(pool: Pool): DrizzleDB {
  return drizzle(pool, { schema });
}

// Re-export schema and types
export * from './schema';
