# Coding Conventions

**Analysis Date:** 2026-01-25

## Naming Patterns

**Files:**
- Classes/Services: PascalCase with descriptive suffix (e.g., `MetricsService`, `DatabaseTestController`, `CorrelationIdMiddleware`)
- DTOs: PascalCase ending in `Dto` (e.g., `CreateRecordDto`, `UpdateRecordDto`)
- Test files: Same name as source with `.spec.ts` suffix (e.g., `metrics.service.spec.ts`)
- Modules: PascalCase ending in `Module` (e.g., `DatabaseModule`, `MetricsModule`)

**Functions:**
- camelCase for all functions (both sync and async)
- Descriptive names following action-noun pattern (e.g., `findAll()`, `findOne()`, `recordRequest()`, `invalidateCache()`)
- Private helper methods prefixed with `private readonly` and use camelCase (e.g., `logDbOperation()`, `trySetCache()`)
- Async functions always explicitly declared with `async` keyword

**Variables:**
- camelCase for regular variables
- Constants: UPPER_SNAKE_CASE for module-level constants (e.g., `CACHE_KEY_RECORDS`, `DEFAULT_CACHE_TTL`, `HEAVY_QUERY_PRESETS`)
- Private class fields: camelCase with `readonly` where immutable (e.g., `private readonly startTime`, `private readonly recentErrors`)
- Unused parameters: Prefix with underscore to satisfy linter (e.g., `argsIgnorePattern: '^_'` in ESLint config)

**Types:**
- Interfaces: PascalCase, exported from source files (e.g., `RecentError`, `MetricsSummary`, `HeavyQueryResult`)
- Generic type parameters: PascalCase single letters (T, U, V) or descriptive (e.g., `<T>`, `<TestRecord>`)
- Type assertions: Used sparingly, documented when necessary (e.g., `as unknown as DatabaseService`)

## Code Style

**Formatting:**
- Tool: ESLint with TypeScript support (no Prettier detected)
- Language: TypeScript with `strict: true` mode enabled
- Target: ES2022 with CommonJS module output
- Indentation: 2 spaces (observed in all source files)
- Line length: Not enforced (files observed with lines up to 100+ characters)

**Linting:**
- Tool: ESLint v9.17.0 with typescript-eslint
- Config file: `eslint.config.mjs` (flat config format)
- Key rules:
  - `@typescript-eslint/no-explicit-any`: warn (strict any usage)
  - `@typescript-eslint/no-unused-vars`: error with pattern `^_` (underscores exempt)
  - `@typescript-eslint/explicit-function-return-type`: off
  - `@typescript-eslint/explicit-module-boundary-types`: off
  - `@typescript-eslint/no-floating-promises`: off

## Import Organization

**Order:**
1. NestJS and framework imports (`@nestjs/common`, `@nestjs/core`, etc.)
2. Third-party libraries (`prom-client`, `helmet`, `ioredis`, etc.)
3. Local absolute imports (`drizzle-orm` functions, decorator libraries)
4. Local relative imports from parent directories (`../database.service`, `../db/schema`)
5. DTOs and local module types (last within category)

**Example pattern from `database-test.service.ts`:**
```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { eq, desc, count } from 'drizzle-orm';
import { DatabaseService } from '../database.service';
import { CacheService } from '../cache/cache.service';
import { AuditService } from '../audit/audit.service';
import { testRecords, TestRecord } from '../db/schema';
import { CreateRecordDto, UpdateRecordDto } from './dto/record.dto';
```

**Path Aliases:**
- Not detected - all imports use relative paths starting with `./` or `../`

## Error Handling

**Patterns:**
- NestJS HttpException for API errors with status codes (e.g., `HttpException(..., HttpStatus.BAD_REQUEST)`)
- Custom error checking: `if (isNaN(id))` for input validation before throwing
- Database not found: `throw new NotFoundException()` for missing records (NestJS built-in)
- Catch-all try-catch for service methods with proper error typing: `error instanceof Error ? error.message : 'Unknown error'`
- Fire-and-forget patterns for non-critical operations (cache invalidation wrapped in try-catch with logging, not re-thrown)
- Error context includes correlation ID when logging (from request middleware)

**Example from `database-test.controller.ts`:**
```typescript
try {
  const records = await this.dbTestService.findAll();
  return { records, count: records.length, timestamp: new Date().toISOString() };
} catch (error) {
  this.logger.error({
    message: 'Failed to fetch records',
    error: error instanceof Error ? error.message : 'Unknown error',
    correlationId: req.correlationId,
  });
  throw new HttpException(
    { message: 'Failed to fetch records', error: error instanceof Error ? error.message : 'Unknown error' },
    HttpStatus.INTERNAL_SERVER_ERROR,
  );
}
```

## Logging

**Framework:** nestjs-pino (Pino logger integration)

**Patterns:**
- Injected via decorator: `@InjectPinoLogger(ServiceName.name)`
- Type: `PinoLogger` from `nestjs-pino` package
- Structured logging with object fields: `logger.info({ key: value, message: 'text' })`
- Log levels: `info`, `warn`, `error`
- Always include context objects with operation details:
  - API endpoints log method, path, correlationId
  - Database operations log id, count, durationMs
  - Errors include error message and correlation ID for tracing

**Example from `metrics.service.ts`:**
```typescript
this.logger.info({ count: cached.length }, 'Returning cached records');
this.logger.info(`Found ${records.length} test records, cached for ${CACHE_TTL_SECONDS}s`);
this.logger.warn({ error }, 'Failed to invalidate cache');
```

## Comments

**When to Comment:**
- Function/method purpose documented with JSDoc comments starting with `/**` (used throughout)
- Complex logic documented inline with `//` comments
- Important invariants documented (e.g., "Date fields become strings after JSON serialization in Redis")
- Parameter documentation in JSDoc blocks for public methods

**JSDoc/TSDoc:**
- Used consistently for public methods and services
- Format: `/** Single line or multi-line description */` above method signature
- Example from `database-test.service.ts`:
```typescript
/**
 * Get all test records using Drizzle ORM (with caching).
 * - Checks cache first, validates structure before returning
 * - Caches results on cache miss
 */
async findAll(): Promise<TestRecord[]>
```

## Function Design

**Size:**
- No enforced limit, but methods typically 20-50 lines
- Complex methods broken into private helpers (e.g., `logDbOperation()`, `trySetCache()`, `isValidCachedRecords()`)

**Parameters:**
- Use DTOs for request bodies: `@Body() dto: CreateRecordDto`
- Extract from decorators: `@Param('id')`, `@Req()`, `@Req() req: Request`
- Avoid long parameter lists - use object parameters or DTOs
- All parameters typed with TypeScript types

**Return Values:**
- Explicit return types on all functions (despite ESLint rule being off, practice shows explicit returns)
- Async functions return `Promise<T>`
- Controllers return plain objects (NestJS auto-serializes to JSON)
- Services return typed objects or throw exceptions (no null returns detected)
- Example: `async findAll(): Promise<TestRecord[]>`

## Module Design

**Exports:**
- Each feature module exports a Module class decorated with `@Module()`
- Services export the service class with `@Injectable()` decorator
- Controllers export the controller class with `@Controller(path)` decorator
- DTOs exported from `dto/` subdirectories
- Types/interfaces exported from source service files
- Barrel files (`index.ts`) export main types for re-export (e.g., `export type { TestRecord }`)

**Barrel Files:**
- `index.ts` used selectively in feature modules (e.g., `database-test/index.ts`)
- Barrel files re-export main service and types: `export { DatabaseTestService, type TestRecord }`
- Used to simplify imports: `import { TestRecord } from '../database-test'` instead of full path

**NestJS-Specific:**
- Services marked with `@Injectable()` and injected via constructor
- Controllers decorated with `@Controller('route-path')` with methods decorated by HTTP verb (`@Get`, `@Post`, `@Put`, `@Delete`)
- Modules decorated with `@Module({ imports: [...], providers: [...], controllers: [...] })`
- Dependency injection through constructor parameters (typed services auto-resolved by NestJS)

---

*Convention analysis: 2026-01-25*
