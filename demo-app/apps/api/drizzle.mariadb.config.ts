/**
 * Drizzle Kit Configuration for MariaDB
 *
 * Configuration for drizzle-kit CLI tools with MariaDB dialect:
 * - `pnpm db:generate:mariadb` - Generate SQL migrations from schema changes
 * - `pnpm db:migrate:mariadb` - Apply pending migrations to database
 * - `pnpm db:studio:mariadb` - Open Drizzle Studio for database inspection
 *
 * @see https://orm.drizzle.team/kit-docs/overview
 */

import { defineConfig } from 'drizzle-kit';

// Validate MYSQL_URL is set when using drizzle-kit commands
const databaseUrl = process.env.MYSQL_URL;
if (!databaseUrl) {
  console.error('ERROR: MYSQL_URL environment variable is not set.');
  console.error('Set it before running drizzle-kit commands:');
  console.error('  export MYSQL_URL=mysql://user:pass@localhost:3306/dbname');
  process.exit(1);
}

export default defineConfig({
  dialect: 'mysql',
  schema: './src/db/schema.mariadb.ts',
  out: './drizzle-mariadb',
  dbCredentials: {
    url: databaseUrl,
  },
});
