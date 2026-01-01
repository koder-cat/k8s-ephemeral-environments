# Database Migrations Guide

This guide covers database schema management using Drizzle ORM migrations for applications deployed to ephemeral PR environments.

## Why Migrations Over Bootstrap SQL?

| Feature | Bootstrap SQL | Migrations |
|---------|---------------|------------|
| Schema versioning | No | Yes |
| Incremental changes | No | Yes |
| Rollback support | No | Yes |
| Works with existing data | No | Yes |
| Type safety | No | Yes |
| IDE autocompletion | No | Yes |

**Recommendation:** Use migrations for production-grade applications. Bootstrap SQL is only suitable for simple, static schemas that never change.

## Quick Start

### 1. Install Dependencies

```bash
pnpm add drizzle-orm
pnpm add -D drizzle-kit
```

### 2. Define Your Schema

Create `src/db/schema.ts`:

```typescript
import { pgTable, serial, varchar, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

### 3. Create Drizzle Config

Create `drizzle.config.ts` in your app root:

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

### 4. Add Package Scripts

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio"
  }
}
```

### 5. Generate Migration

```bash
pnpm db:generate --name=create_users
```

This creates a SQL migration file in `drizzle/0000_create_users.sql`.

## Running Migrations

### At Application Startup (Recommended for Ephemeral Environments)

For ephemeral PR environments, run migrations programmatically at startup:

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

async function runMigrations() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  await migrate(db, { migrationsFolder: './drizzle' });

  console.log('Migrations completed');
  await pool.end();
}
```

This approach ensures:
- Schema is always up-to-date on deployment
- No manual migration step needed
- Works seamlessly with ephemeral environments

### Via CLI (Development)

```bash
# Apply pending migrations
pnpm db:migrate

# Open Drizzle Studio for database inspection
pnpm db:studio
```

## Schema Changes Workflow

### Adding a New Column

1. Update your schema:

```typescript
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  // New column
  avatarUrl: varchar('avatar_url', { length: 500 }),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

2. Generate migration:

```bash
pnpm db:generate --name=add_avatar_url
```

3. Verify the generated SQL in `drizzle/0001_add_avatar_url.sql`

4. Deploy - migrations run automatically at startup

### Adding a New Table

1. Add to schema:

```typescript
export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content'),
  authorId: integer('author_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

2. Generate and deploy as above

## Using Drizzle in Your Application

### NestJS Integration

```typescript
// database.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from './db/schema';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private pool: Pool;
  private _db: NodePgDatabase<typeof schema>;

  get db() {
    return this._db;
  }

  async onModuleInit() {
    this.pool = new Pool({ connectionString: process.env.DATABASE_URL });
    this._db = drizzle(this.pool, { schema });

    // Run migrations at startup
    await migrate(this._db, { migrationsFolder: './drizzle' });
  }
}
```

### Type-Safe Queries

```typescript
import { eq, desc, count } from 'drizzle-orm';
import { users } from './db/schema';

// Select all
const allUsers = await db.select().from(users);

// Select with conditions
const user = await db.select().from(users).where(eq(users.id, 1));

// Insert
const newUser = await db.insert(users).values({
  name: 'John Doe',
  email: 'john@example.com',
}).returning();

// Update
await db.update(users)
  .set({ name: 'Jane Doe' })
  .where(eq(users.id, 1));

// Delete
await db.delete(users).where(eq(users.id, 1));

// Count
const result = await db.select({ count: count() }).from(users);
```

## Multi-Dialect Support (PostgreSQL + MariaDB)

If your application needs to support both PostgreSQL and MariaDB, use separate schema files and configs:

### Separate Schema Files

```typescript
// src/db/schema.ts (PostgreSQL)
import { pgTable, serial, varchar, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// src/db/schema.mariadb.ts (MariaDB)
import { mysqlTable, int, varchar, json, timestamp } from 'drizzle-orm/mysql-core';

export const users = mysqlTable('users', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 255 }).notNull(),
  metadata: json('metadata').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

### Separate Config Files

```typescript
// drizzle.postgresql.config.ts
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL! },
});

// drizzle.mariadb.config.ts
export default defineConfig({
  dialect: 'mysql',
  schema: './src/db/schema.mariadb.ts',
  out: './drizzle-mariadb',
  dbCredentials: { url: process.env.MYSQL_URL! },
});
```

### Package Scripts

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate --config=drizzle.postgresql.config.ts",
    "db:generate:mariadb": "drizzle-kit generate --config=drizzle.mariadb.config.ts",
    "db:migrate": "drizzle-kit migrate --config=drizzle.postgresql.config.ts",
    "db:migrate:mariadb": "drizzle-kit migrate --config=drizzle.mariadb.config.ts"
  }
}
```

### Runtime Database Selection

```typescript
import { getDatabaseType } from './db';

const dbType = getDatabaseType(); // reads from DATABASE_TYPE env var

if (dbType === 'mariadb') {
  await migrate(db, { migrationsFolder: './drizzle-mariadb' });
} else {
  await migrate(db, { migrationsFolder: './drizzle' });
}
```

### Dockerfile with Both Migrations

```dockerfile
# Copy both migration folders
COPY apps/api/drizzle ./apps/api/dist/drizzle
COPY apps/api/drizzle-mariadb ./apps/api/dist/drizzle-mariadb
```

## Best Practices

### 1. Never Edit Generated Migrations

Once a migration is deployed, treat it as immutable. Create new migrations for changes.

### 2. Review Generated SQL

Always inspect generated migrations before deploying:

```bash
cat drizzle/0001_*.sql
```

### 3. Use Meaningful Migration Names

```bash
pnpm db:generate --name=add_user_roles
pnpm db:generate --name=create_posts_table
pnpm db:generate --name=add_email_index
```

### 4. Include Migrations in Docker Build

```dockerfile
# Copy migrations to dist
COPY apps/api/drizzle ./apps/api/dist/drizzle
```

### 5. Handle Migration Failures Gracefully

```typescript
try {
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrations completed');
} catch (error) {
  console.error('Migration failed:', error);
  // Decide: fail fast or continue without migrations
  throw error;
}
```

## Troubleshooting

### Migration Failed

**Symptoms:** App crashes on startup with migration error

**Common Causes:**
1. Database connection failed
2. Conflicting schema changes
3. Migration file corrupted

**Resolution:**
```bash
# Check database connectivity
psql $DATABASE_URL -c 'SELECT 1'

# Check migration status
psql $DATABASE_URL -c 'SELECT * FROM drizzle.__drizzle_migrations'

# For ephemeral environments, recreate the namespace
kubectl delete ns {namespace}
# Let CI/CD recreate it
```

### Schema Out of Sync

**Symptoms:** Type errors in IDE, runtime query failures

**Resolution:**
```bash
# Regenerate types (if using separate type generation)
pnpm db:generate

# Or verify schema matches database
pnpm db:studio
```

## See Also

- [Database Seeding Guide](./database-seeding.md)
- [Database Setup](./database-setup.md)
- [Troubleshooting](./troubleshooting.md)
- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)
