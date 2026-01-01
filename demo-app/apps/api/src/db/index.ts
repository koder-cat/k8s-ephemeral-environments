/**
 * Database Module
 *
 * Central export point for database-related functionality.
 * Supports both PostgreSQL and MariaDB dialects with runtime switching.
 * Provides Drizzle ORM instance factory and schema exports.
 */

import { drizzle as drizzlePg, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { drizzle as drizzleMysql, MySql2Database } from 'drizzle-orm/mysql2';
import { Pool as PgPool } from 'pg';
import type { Pool as MysqlPool } from 'mysql2/promise';
import * as pgSchema from './schema';
import * as mariadbSchema from './schema.mariadb';

/**
 * Supported database types
 */
export type DatabaseType = 'postgresql' | 'mariadb';

/**
 * Union type for Drizzle database instances
 */
export type DrizzleDB = NodePgDatabase<typeof pgSchema> | MySql2Database<typeof mariadbSchema>;

/**
 * Determines the database type from environment variable.
 * Defaults to 'postgresql' if not specified.
 *
 * @returns The database type to use
 */
export function getDatabaseType(): DatabaseType {
  const dbType = process.env.DATABASE_TYPE?.toLowerCase();
  if (dbType === 'mariadb' || dbType === 'mysql') {
    return 'mariadb';
  }
  return 'postgresql';
}

/**
 * Creates a Drizzle database instance for PostgreSQL.
 *
 * @param pool - PostgreSQL connection pool
 * @returns Drizzle database instance with PostgreSQL schema type inference
 */
export function createPostgresDb(pool: PgPool): NodePgDatabase<typeof pgSchema> {
  return drizzlePg(pool, { schema: pgSchema });
}

/**
 * Creates a Drizzle database instance for MariaDB.
 *
 * @param pool - MySQL2 connection pool
 * @returns Drizzle database instance with MariaDB schema type inference
 */
export function createMariaDb(pool: MysqlPool): MySql2Database<typeof mariadbSchema> {
  return drizzleMysql(pool, { schema: mariadbSchema, mode: 'default' });
}

/**
 * Gets the appropriate schema based on database type.
 *
 * @returns The schema module for the current database type
 */
export function getSchema() {
  return getDatabaseType() === 'mariadb' ? mariadbSchema : pgSchema;
}

// Re-export schemas for direct access
export { pgSchema, mariadbSchema };

// Re-export PostgreSQL schema types for backwards compatibility
export * from './schema';
