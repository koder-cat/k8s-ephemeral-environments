/**
 * Drizzle Kit Configuration for PostgreSQL
 *
 * Configuration for drizzle-kit CLI tools with PostgreSQL dialect:
 * - `pnpm db:generate` - Generate SQL migrations from schema changes
 * - `pnpm db:migrate` - Apply pending migrations to database
 * - `pnpm db:studio` - Open Drizzle Studio for database inspection
 *
 * @see https://orm.drizzle.team/kit-docs/overview
 */

import { defineConfig } from 'drizzle-kit';

// Validate DATABASE_URL is set when using drizzle-kit commands
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('ERROR: DATABASE_URL environment variable is not set.');
  console.error('Set it before running drizzle-kit commands:');
  console.error('  export DATABASE_URL=postgresql://user:pass@localhost:5432/dbname');
  process.exit(1);
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: databaseUrl,
  },
});
