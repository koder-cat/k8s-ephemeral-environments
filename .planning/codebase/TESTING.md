# Testing Patterns

**Analysis Date:** 2026-01-25

## Test Framework

**Runner:**
- Vitest v3.0.0 (modern, fast, Vue/React optimized but works for NestJS)
- Config: `/home/genesluna/repos/k8s-ephemeral-environments/demo-app/apps/api/vitest.config.ts`

**Assertion Library:**
- Vitest built-in expect() (compatible with Jest)

**Run Commands:**
```bash
pnpm test              # Run all tests once
pnpm test:watch       # Run tests in watch mode
pnpm test:cov         # Generate coverage report
```

**Coverage Configuration:**
```javascript
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html'],
  include: ['src/**/*.ts'],
  exclude: ['src/**/*.spec.ts', 'src/**/*.test.ts', 'src/main.ts'],
  thresholds: {
    lines: 50,
    functions: 50,
    branches: 50,
    statements: 50,
  },
}
```

## Test File Organization

**Location:**
- Co-located in same directory as implementation file
- Pattern: Place `.spec.ts` file next to source file

**Naming:**
- Pattern: `[SourceName].spec.ts` (e.g., `metrics.service.spec.ts` for `metrics.service.ts`)
- Files follow strict naming to match Vitest include pattern: `src/**/*.spec.ts`

**Structure:**
```
src/
  metrics/
    metrics.service.ts
    metrics.service.spec.ts      # Test file co-located
    metrics.controller.ts
    metrics.controller.spec.ts
  database-test/
    database-test.service.ts
    database-test.controller.spec.ts
```

**Test File Count:**
- 12 spec files found in API codebase at `demo-app/apps/api/src/`

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ServiceName', () => {
  let service: ServiceName;
  let mockDependency: MockType;

  beforeEach(() => {
    // Setup before each test
    mockDependency = { /* mocked methods */ };
    service = new ServiceName(mockDependency as unknown as DependencyType);
  });

  describe('methodName', () => {
    it('should do something', async () => {
      // Arrange
      const input = { /* test data */ };

      // Act
      const result = await service.methodName(input);

      // Assert
      expect(result).toBeDefined();
    });

    it('should throw error on failure', async () => {
      // Arrange
      mockDependency.query.mockRejectedValue(new Error('DB error'));

      // Act & Assert
      await expect(service.methodName(input)).rejects.toThrow(HttpException);
    });
  });
});
```

**Patterns:**

1. **Setup/Teardown:**
   - `beforeEach()` for test initialization (setup mocks, create instances)
   - `afterEach()` for cleanup (especially environment variables)
   - No shared state between tests

2. **Nested Describes:**
   - Top-level: class/function name
   - Second level: method name
   - Third level (optional): specific scenarios or branches

3. **Test Naming:**
   - `it('should [expected behavior]', ...)`
   - Clear description of what should happen
   - Example: `it('should return all records')`
   - Include error conditions: `it('should throw HttpException on error')`

4. **Async Testing:**
   - Tests are `async` when testing async methods
   - Use `await` for promises
   - Use `rejects.toThrow()` for error assertions on async methods

## Mocking

**Framework:** Vitest's `vi` mock utilities (compatible with Jest)

**Patterns:**

```typescript
// Creating mocks with vi.fn()
mockService = {
  findAll: vi.fn(),
  findOne: vi.fn(),
  create: vi.fn(),
};

// Setting up return values
mockService.findAll.mockResolvedValue([mockRecord]);
mockService.findOne.mockRejectedValue(new NotFoundException('Not found'));

// Verifying mocks were called
expect(mockService.create).toHaveBeenCalledWith(expectedInput);
expect(mockService.findOne).toHaveBeenCalledTimes(1);

// Partial mocking (mix real and mocked)
const mockDatabaseService: MockDatabaseService = {
  enabled: false,
  getStatus: vi.fn().mockResolvedValue({ enabled: false, connected: false }),
  query: vi.fn(),
};
```

**What to Mock:**
- External dependencies injected in constructor (DatabaseService, CacheService, Logger)
- HTTP/Network calls
- Database operations (when testing service layer)
- Time-based operations (though not observed in these tests)
- Third-party library calls (prom-client, etc.)

**What NOT to Mock:**
- Internal service methods (test the whole service, not isolated methods)
- Built-in JavaScript objects (unless truly necessary)
- NestJS decorators (they work at runtime)
- Custom validation logic (test it)

**Example from `database-test.controller.spec.ts`:**
```typescript
const mockService = {
  findAll: vi.fn(),
  findOne: vi.fn(),
  create: vi.fn(),
  // ... other methods
};
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

controller = new DatabaseTestController(
  mockService as unknown as DatabaseTestService,
  mockLogger as unknown as PinoLogger,
);
```

## Fixtures and Factories

**Test Data:**
```typescript
// Simple fixture object at top of describe block
const mockRecord: TestRecord = {
  id: 1,
  name: 'Test Record',
  data: { foo: 'bar' },
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
};

// Used in multiple tests
mockService.findAll.mockResolvedValue([mockRecord]);
mockService.findOne.mockResolvedValue(mockRecord);
mockService.create.mockResolvedValue(mockRecord);
```

**Location:**
- Defined directly in test file (no separate fixture file detected)
- Defined at top level within `describe()` block for easy reference
- Variables named with `mock` prefix to indicate test data

**Factory-like patterns:**
- Not observed - static fixtures used instead
- Could be created with factory functions if more complex setup needed

## Coverage

**Requirements:**
- Minimum thresholds: 50% for lines, functions, branches, statements
- Coverage enforced via vitest config thresholds
- Report formats: text, json, html

**View Coverage:**
```bash
pnpm test:cov
# Generates HTML report at coverage/index.html
```

**Coverage Gaps Observed:**
- Main entry point `src/main.ts` excluded from coverage
- Some integration tests missing (only unit tests found)
- No E2E tests detected

## Test Types

**Unit Tests:**
- **Scope:** Individual service or controller methods
- **Approach:** Isolate class under test with mocked dependencies
- **Example:** `MetricsService.recordRequest()` tested independently
- **Mocking strategy:** Mock all constructor dependencies
- **Assertions:** Verify method behavior, side effects logged, exceptions thrown

**Example from `metrics.service.spec.ts`:**
```typescript
it('should track http request count', async () => {
  const labels = { method: 'GET', route: '/api/test', status_code: '200' };
  service.httpRequestTotal.inc(labels);

  const metrics = await service.getMetrics();

  expect(metrics).toContain('http_requests_total');
});
```

**Integration Tests:**
- Not explicitly separated or labeled
- Could be added for testing multiple services working together
- Would test database + cache + audit flow end-to-end

**E2E Tests:**
- Framework: Not used
- Could use: Vitest + supertest or similar
- Would test full HTTP request → response cycle
- Currently missing from codebase

## Common Patterns

**Async Testing:**
```typescript
// Pattern 1: Resolved value
it('should return a single record', async () => {
  mockService.findOne.mockResolvedValue(mockRecord);
  const result = await controller.findOne('1', mockRequest as any);
  expect(result).toEqual(mockRecord);
});

// Pattern 2: Rejected error
it('should throw HttpException on error', async () => {
  mockService.findAll.mockRejectedValue(new Error('Database error'));
  await expect(controller.findAll(mockRequest as any)).rejects.toThrow(HttpException);
});

// Pattern 3: Manual promise handling
it('should handle async operation', async () => {
  const promise = controller.someAsyncMethod();
  await expect(promise).resolves.toBeDefined();
});
```

**Error Testing:**
```typescript
// Pattern 1: Specific exception type
it('should throw NotFoundException for missing record', async () => {
  mockService.findOne.mockRejectedValue(new NotFoundException('Not found'));
  await expect(controller.findOne('999', mockRequest as any)).rejects.toThrow(NotFoundException);
});

// Pattern 2: HTTP status code validation
it('should throw HttpException with 400 status', async () => {
  try {
    await controller.runHeavyQuery('invalid', mockRequest as any);
    expect.fail('Should have thrown');
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(400);
  }
});

// Pattern 3: Error message validation
it('should include error message in response', async () => {
  const errorMsg = 'Database error';
  mockService.create.mockRejectedValue(new Error(errorMsg));

  try {
    await controller.create({ name: 'Test' }, mockRequest as any);
  } catch (error) {
    expect(error).toContain(errorMsg);
  }
});
```

**Validation Testing:**
```typescript
// Pattern: Testing DTOs with class-validator decorators
it('should throw HttpException for empty name', async () => {
  await expect(controller.create({ name: '' }, mockRequest as any)).rejects.toThrow(HttpException);
});

it('should throw HttpException for missing name', async () => {
  await expect(controller.create({} as any, mockRequest as any)).rejects.toThrow(HttpException);
});
```

**Setup and Fixture Patterns:**
```typescript
// Pattern: beforeEach for test data setup
beforeEach(() => {
  mockRequest = { correlationId: 'test-123' };
  mockResponse = { setHeader: vi.fn() };
  mockService = { /* all mocked methods */ };
});

// Pattern: afterEach for cleanup
afterEach(() => {
  delete process.env.PR_NUMBER;
  delete process.env.COMMIT_SHA;
});
```

---

*Testing analysis: 2026-01-25*
