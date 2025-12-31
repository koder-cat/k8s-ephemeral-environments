/**
 * Drizzle ORM Schema Definition
 *
 * This file defines the database schema using Drizzle ORM's type-safe schema builder.
 * Types are automatically inferred from the schema - no manual interfaces needed.
 *
 * @see https://orm.drizzle.team/docs/sql-schema-declaration
 */

import { pgTable, serial, varchar, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { InferSelectModel, InferInsertModel } from 'drizzle-orm';

/**
 * Test records table for CRUD operations and observability testing.
 *
 * Used by the demo-app to demonstrate:
 * - Database connectivity in ephemeral environments
 * - Prometheus metrics for database operations
 * - Type-safe queries with Drizzle ORM
 */
export const testRecords = pgTable(
  'test_records',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    data: jsonb('data').default({}).$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_test_records_created_at').on(table.createdAt),
    index('idx_test_records_name').on(table.name),
  ],
);

// Type inference from schema - replaces manual TestRecord interface
export type TestRecord = InferSelectModel<typeof testRecords>;
export type NewTestRecord = InferInsertModel<typeof testRecords>;
