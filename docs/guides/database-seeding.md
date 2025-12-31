# Database Seeding Guide

This guide covers database seeding using `drizzle-seed` for applications deployed to ephemeral PR environments.

## Why Seed Data?

- **Testing:** Provide realistic data for QA and manual testing
- **Development:** Start with meaningful data instead of empty tables
- **Demos:** Pre-populate environments for stakeholder reviews
- **Deterministic:** Same seed produces same data across environments

## Quick Start

### 1. Install Dependencies

```bash
pnpm add -D drizzle-seed
```

### 2. Create Seed Script

Create `src/db/seed.ts`:

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { seed } from 'drizzle-seed';
import { Pool } from 'pg';
import * as schema from './schema';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  await seed(db, schema);

  console.log('Seeding completed');
  await pool.end();
}

main();
```

### 3. Add Script to Package.json

```json
{
  "scripts": {
    "db:seed": "tsx src/db/seed.ts"
  }
}
```

### 4. Run Seeding

```bash
pnpm db:seed
```

## Built-in Generators

`drizzle-seed` provides many built-in generators for realistic data:

### Personal Information

```typescript
await seed(db, schema).refine((funcs) => ({
  users: {
    count: 100,
    columns: {
      firstName: funcs.firstName(),
      lastName: funcs.lastName(),
      fullName: funcs.fullName(),
      email: funcs.email(),
      phone: funcs.phoneNumber({ template: '(###) ###-####' }),
    },
  },
}));
```

### Business Data

```typescript
await seed(db, schema).refine((funcs) => ({
  companies: {
    count: 50,
    columns: {
      name: funcs.companyName(),
      address: funcs.streetAddress(),
      city: funcs.city(),
      state: funcs.state(),
      country: funcs.country(),
      postalCode: funcs.postcode(),
    },
  },
}));
```

### Professional

```typescript
await seed(db, schema).refine((funcs) => ({
  employees: {
    count: 200,
    columns: {
      title: funcs.jobTitle(),
      hireDate: funcs.date({ minDate: '2020-01-01', maxDate: '2024-12-31' }),
    },
  },
}));
```

### Content

```typescript
await seed(db, schema).refine((funcs) => ({
  posts: {
    count: 500,
    columns: {
      title: funcs.loremIpsum({ sentenceCount: 1 }),
      content: funcs.loremIpsum({ sentenceCount: 10 }),
    },
  },
}));
```

## Custom Values

### From Array

```typescript
const statuses = ['active', 'pending', 'inactive', 'banned'];

await seed(db, schema).refine((funcs) => ({
  users: {
    count: 100,
    columns: {
      status: funcs.valuesFromArray({ values: statuses }),
    },
  },
}));
```

### Weighted Random

```typescript
await seed(db, schema).refine((funcs) => ({
  orders: {
    count: 1000,
    columns: {
      status: funcs.weightedRandom([
        { weight: 0.7, value: funcs.default({ defaultValue: 'completed' }) },
        { weight: 0.2, value: funcs.default({ defaultValue: 'processing' }) },
        { weight: 0.1, value: funcs.default({ defaultValue: 'cancelled' }) },
      ]),
    },
  },
}));
```

### Numbers and Ranges

```typescript
await seed(db, schema).refine((funcs) => ({
  products: {
    count: 200,
    columns: {
      price: funcs.number({ minValue: 9.99, maxValue: 999.99, precision: 100 }),
      quantity: funcs.int({ minValue: 0, maxValue: 1000 }),
    },
  },
}));
```

## Conditional Seeding

### Check for Existing Data

```typescript
import { count } from 'drizzle-orm';
import { users } from './schema';

async function seedIfEmpty(db) {
  const result = await db.select({ count: count() }).from(users);

  if (result[0].count > 0) {
    console.log('Database already has data, skipping seed');
    return false;
  }

  await seed(db, schema);
  return true;
}
```

### Auto-Seed on App Startup

```typescript
// In your database service initialization
async onModuleInit() {
  // Run migrations first
  await migrate(this.db, { migrationsFolder: './drizzle' });

  // Then seed if empty
  const result = await this.db.select({ count: count() }).from(users);
  if (result[0].count === 0) {
    await seedDatabase(this.pool);
    console.log('Database seeded with initial data');
  }
}
```

## Deterministic Seeding

For reproducible data across environments, use versioned seeding:

```typescript
await seed(db, schema, { version: '1' });
```

The same version always produces the same data, which is useful for:
- Consistent test data across CI runs
- Reproducible bug reports
- Stable demo environments

## Resetting Data

Clear all data before re-seeding:

```typescript
import { reset } from 'drizzle-seed';

async function resetAndSeed(db) {
  // Clear all tables
  await reset(db, schema);

  // Re-seed
  await seed(db, schema);
}
```

**Warning:** `reset` deletes all data. Use with caution.

## Relationships (Coming Soon)

Drizzle-seed supports seeding related tables:

```typescript
await seed(db, schema).refine((funcs) => ({
  users: {
    count: 10,
  },
  posts: {
    count: 100,
    // Each post will be assigned to an existing user
    with: {
      users: { weight: 1 },
    },
  },
}));
```

## Best Practices

### 1. Seed Only in Development/Testing

```typescript
if (process.env.NODE_ENV !== 'production') {
  await seedDatabase(pool);
}
```

### 2. Keep Seed Data Realistic

Use built-in generators that produce realistic data rather than "test1", "test2", etc.

### 3. Version Your Seeds

```typescript
// Increment version when seed logic changes
await seed(db, schema, { version: '2' });
```

### 4. Document Seed Data

```typescript
/**
 * Seed data for demo environments:
 * - 10 users (various roles)
 * - 100 posts (assigned to users)
 * - 500 comments (on posts)
 */
async function seedDemoData(db) {
  // ...
}
```

### 5. Handle Errors Gracefully

```typescript
try {
  await seedDatabase(pool);
} catch (error) {
  console.error('Seeding failed:', error);
  // Don't crash the app - seeding is nice-to-have
}
```

## Integration with CI/CD

### GitHub Actions

```yaml
- name: Seed database
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
  run: pnpm db:seed
```

### Ephemeral Environments

For ephemeral PR environments, seed automatically at app startup:

```typescript
// In DatabaseService
async onModuleInit() {
  await this.runMigrations();
  await this.seedIfEmpty();
}
```

## Troubleshooting

### Seed Data Not Appearing

1. Check migrations ran first (tables must exist)
2. Verify DATABASE_URL is correct
3. Check for errors in seed script output

### Duplicate Data

1. Add check for existing data before seeding
2. Use `reset()` if you need to re-seed

### Type Errors

1. Ensure schema types match seed values
2. Update drizzle-seed to latest version

## See Also

- [Database Migrations Guide](./database-migrations.md)
- [Database Setup](./database-setup.md)
- [Drizzle Seed Documentation](https://orm.drizzle.team/docs/seed-overview)
