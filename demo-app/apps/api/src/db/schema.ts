/**
 * Drizzle ORM Schema Definition
 *
 * This file defines the database schema using Drizzle ORM's type-safe schema builder.
 * Types are automatically inferred from the schema - no manual interfaces needed.
 *
 * @see https://orm.drizzle.team/docs/sql-schema-declaration
 */

import {
  pgTable,
  serial,
  varchar,
  jsonb,
  timestamp,
  index,
  integer,
} from 'drizzle-orm/pg-core';
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

/**
 * File metadata table for MinIO file storage.
 *
 * Stores metadata about files uploaded to MinIO/S3.
 * Actual file content is stored in MinIO bucket.
 */
export const fileMetadata = pgTable(
  'file_metadata',
  {
    id: serial('id').primaryKey(),
    fileId: varchar('file_id', { length: 36 }).notNull().unique(),
    filename: varchar('filename', { length: 255 }).notNull(),
    originalName: varchar('original_name', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    size: integer('size').notNull(),
    bucket: varchar('bucket', { length: 100 }).notNull(),
    key: varchar('key', { length: 500 }).notNull(),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_file_metadata_file_id').on(table.fileId),
    index('idx_file_metadata_uploaded_at').on(table.uploadedAt),
    index('idx_file_metadata_mime_type').on(table.mimeType),
  ],
);

export type FileMetadata = InferSelectModel<typeof fileMetadata>;
export type NewFileMetadata = InferInsertModel<typeof fileMetadata>;
