# Service Development Guide

This guide documents best practices for creating NestJS services that depend on external resources like databases and storage systems. Following these patterns prevents race conditions and ensures reliable service initialization in Kubernetes environments.

## Table of Contents

- [Database-Dependent Services](#database-dependent-services)
- [Storage Services (S3/MinIO)](#storage-services-s3minio)
- [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
- [Testing Your Service](#testing-your-service)
- [Kubernetes Considerations](#kubernetes-considerations)
  - [MongoDB Operator RBAC Requirements](#mongodb-operator-rbac-requirements)

## Database-Dependent Services

### The Problem: Initialization Race Conditions

When your service depends on a database, you must handle the case where the database isn't ready when your service starts. This is common in Kubernetes where pods start in parallel.

**Race condition timeline:**
```
1. PostgreSQL pod starts, port 5432 becomes available
2. Init container detects port availability → SUCCESS
3. App pod starts
4. onModuleInit() runs immediately
5. PostgreSQL is still initializing (not accepting connections)
6. Database operations fail
7. App starts with broken database state
```

### Required Patterns

#### 1. Short Startup Retry, Then Fail Fast

Init containers handle primary readiness. Application retry is only for the tiny timing window between init container exit and app startup:

```typescript
/**
 * Wait for database to be ready with short retry.
 *
 * Enterprise approach: Init containers handle primary readiness check.
 * This short retry (3 attempts, ~3s) handles only the tiny timing window
 * between init container exit and app startup. If still failing after
 * this, we fail fast and let Kubernetes restart us with its own backoff.
 */
private async waitForDatabase(
  maxRetries = 3,
  delayMs = 1000,
): Promise<void> {
  if (!this.pool) return;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      if (attempt > 1) {
        this.logger.info({ attempt }, 'Database connection established');
      }
      return;
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        this.logger.warn(
          { attempt, maxRetries, error: lastError.message },
          'Database not ready, retrying...',
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  // Fail fast - let Kubernetes handle restart with its own backoff
  throw new Error(
    `Database not available after ${maxRetries} attempts: ${lastError?.message}`,
  );
}
```

**Why short retry + fail fast:**
- Init containers are the primary defense (infrastructure layer)
- App retry handles only edge cases (~1% of situations)
- Long retries mask problems and delay failure detection
- Kubernetes restart backoff is designed for this - don't reinvent it

#### 2. Order Your Initialization Steps

In `onModuleInit()`, follow this exact order:

```typescript
async onModuleInit() {
  if (!this.enabled) {
    this.logger.info('DATABASE_URL not set, database features disabled');
    return;
  }

  try {
    // Step 1: Create connection pool (fast, no network I/O)
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    // Step 2: Initialize ORM (fast, no network I/O)
    this._db = drizzle(this.pool, { schema });

    // Step 3: Wait for database readiness (with retry)
    await this.waitForDatabase();

    // Step 4: Run migrations (only after confirmed ready)
    await this.runMigrations();

    // Step 5: Seed data (only after migrations complete)
    await this.runSeeding();

    // Step 6: Set connected flag (only after all steps pass)
    this.isConnected = true;
    this.logger.info('Database initialization complete');
  } catch (error) {
    this.logger.error({ error }, 'Failed to initialize database');
    this.isConnected = false;
    // Re-throw to prevent app from starting with broken database
    throw error;
  }
}
```

#### 3. Use Global Modules for Shared Resources

Database connections should be singleton across the app:

```typescript
import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';

@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
```

This ensures:
- Only one connection pool is created
- All services share the same pool
- Initialization happens once

#### 4. Never Catch and Swallow Initialization Errors

If initialization fails, let the app crash. Kubernetes will restart it. A running app with broken database is worse than a crash loop.

```typescript
// GOOD: Re-throw critical errors
try {
  await this.waitForDatabase();
  await this.runMigrations();
} catch (error) {
  this.logger.error({ error }, 'Failed to initialize database');
  throw error; // App will crash and restart
}

// BAD: Swallowing errors
try {
  await this.waitForDatabase();
} catch (error) {
  this.logger.error({ error }, 'Database init failed');
  // App continues with broken state!
}
```

**Exception:** Optional features like seeding can fail gracefully:

```typescript
private async runSeeding(): Promise<void> {
  try {
    await seedDatabase(this.pool);
  } catch (error) {
    this.logger.error({ error }, 'Seeding failed');
    // Don't throw - seeding failure shouldn't prevent app startup
  }
}
```

## Storage Services (S3/MinIO)

S3-compatible storage has different failure modes than databases:
- Temporary unavailability during uploads
- Network timeouts on large files
- Bucket not existing on first access
- Presigned URL expiration

### Required Patterns

#### 1. Retry Logic for All Operations

```typescript
async uploadWithRetry(
  bucket: string,
  key: string,
  data: Buffer,
  maxRetries = 3,
): Promise<void> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await this.s3Client.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: data }),
      );
      return;
    } catch (error) {
      lastError = error as Error;
      if (attempt === maxRetries) throw lastError;
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      this.logger.warn(
        { attempt, maxRetries, delayMs: delay, error: lastError.message },
        'Upload failed, retrying...',
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}
```

#### 2. Ensure Bucket Exists on Startup

```typescript
async onModuleInit() {
  await this.waitForStorage();
  await this.ensureBucketExists();
}

private async ensureBucketExists(): Promise<void> {
  try {
    await this.s3Client.send(
      new HeadBucketCommand({ Bucket: this.bucket }),
    );
    this.logger.info({ bucket: this.bucket }, 'Bucket exists');
  } catch (error) {
    if ((error as Error).name === 'NotFound') {
      await this.s3Client.send(
        new CreateBucketCommand({ Bucket: this.bucket }),
      );
      this.logger.info({ bucket: this.bucket }, 'Bucket created');
    } else {
      throw error;
    }
  }
}
```

#### 3. Handle Presigned URL Failures

```typescript
async getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  // Always verify object exists before generating URL
  try {
    await this.s3Client.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  } catch (error) {
    if ((error as Error).name === 'NotFound') {
      throw new NotFoundException(`Object not found: ${key}`);
    }
    throw error;
  }

  return getSignedUrl(
    this.s3Client,
    new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    { expiresIn },
  );
}
```

## Anti-Patterns to Avoid

| Anti-Pattern | Why It's Bad | Correct Approach |
|--------------|--------------|------------------|
| Assume port availability = service readiness | Port can be open while service initializes | Use native client health checks |
| Run migrations before testing connection | Migrations fail with confusing errors | Test connection first with retry |
| Set `isConnected = true` before verifying | Other code assumes database is ready | Set flag only after all init steps |
| Use boolean flags without retry logic | Single failure = permanent broken state | Retry with exponential backoff |
| Assume bucket exists | First request fails | Check/create bucket on startup |
| Upload without retry logic | Transient failures break uploads | Retry with backoff |
| Use infinite presigned URL expiration | Security risk | Use reasonable expiration (1-24h) |
| Ignore multipart upload cleanup | Failed uploads waste storage | Implement lifecycle policies |

## Testing Your Service

### Local Testing

1. **Start your service WITHOUT the database running:**
   ```bash
   # Don't start PostgreSQL
   npm run start:dev
   ```

2. **Verify it retries and fails fast:**
   ```
   [Nest] Database not ready, retrying... (attempt 1/3)
   [Nest] Database not ready, retrying... (attempt 2/3)
   [Nest] Database not available after 3 attempts
   ```
   With enterprise approach (3 attempts, ~3s), failures are detected quickly and Kubernetes restarts handle recovery with proper backoff.

3. **Test successful connection after retry:**
   Start the database during retry window to verify recovery:
   ```bash
   docker start postgres
   ```

4. **Verify it connects successfully:**
   ```
   [Nest] Database not ready, retrying... (attempt 1/3)
   [Nest] Database connection established (attempt 2)
   [Nest] Migrations completed successfully
   [Nest] Database initialization complete
   ```

### Integration Testing

```typescript
describe('DatabaseService', () => {
  it('should retry connection on failure', async () => {
    // Mock pool.connect to fail first 2 times, then succeed
    const connectMock = vi.fn()
      .mockRejectedValueOnce(new Error('Connection refused'))
      .mockRejectedValueOnce(new Error('Connection refused'))
      .mockResolvedValueOnce({
        query: vi.fn().mockResolvedValue({}),
        release: vi.fn(),
      });

    // Verify service eventually connects
    await service.onModuleInit();
    expect(connectMock).toHaveBeenCalledTimes(3);
    expect(service.isConnected).toBe(true);
  });
});
```

## Kubernetes Considerations

### Defense in Depth

Init containers provide first-line defense but are **not sufficient alone**:

| Layer | What It Checks | Limitation |
|-------|----------------|------------|
| Init container | Network reachability | Port open ≠ service ready |
| Application retry | Actual query execution | Handles init container gap |

Always implement **both layers**:

1. **Init container**: Uses native client tools (`pg_isready`, `redis-cli ping`)
2. **Application**: Retry with exponential backoff in `onModuleInit()`

### Init Container Best Practices

Use native client tools instead of netcat port checks:

```yaml
# PostgreSQL - uses pg_isready
- name: wait-for-postgresql
  image: postgres:16-alpine
  command: ["sh", "-c", "until pg_isready -h $HOST -p 5432 -U app; do sleep 2; done"]

# MongoDB - uses mongosh ping
- name: wait-for-mongodb
  image: mongo:7-jammy
  command: ["sh", "-c", "until mongosh --host $HOST --eval 'db.ping()'; do sleep 2; done"]

# Redis - uses redis-cli ping
- name: wait-for-redis
  image: redis:7-alpine
  command: ["sh", "-c", "until redis-cli -h $HOST ping | grep PONG; do sleep 2; done"]

# MinIO - uses health endpoint
- name: wait-for-minio
  image: curlimages/curl:8.5.0
  command: ["sh", "-c", "until curl -sf http://$HOST:9000/minio/health/live; do sleep 2; done"]
```

### Init Container Resource Requirements

Different init containers have different memory requirements based on their base images:

| Init Container | Image | Memory Limit | Notes |
|----------------|-------|--------------|-------|
| wait-for-postgresql | postgres:16-alpine | 64Mi | Lightweight |
| wait-for-mongodb | mongo:7-jammy | **256Mi** | `mongosh` requires more memory |
| wait-for-redis | redis:7-alpine | 64Mi | Lightweight |
| wait-for-minio | curlimages/curl | 32Mi | Minimal |

**Important:** The MongoDB init container will OOMKill at 128Mi. Always allocate at least 256Mi for `mongosh`-based readiness checks.

### MongoDB Operator RBAC Requirements

The MongoDB Community Operator requires specific RBAC permissions for its agent to function properly. The agent runs as a sidecar container and needs to:

1. **Read secrets** - Verify automation config
2. **Read/patch pods** - Update agent version annotations

Without these permissions, the agent's readiness probe fails with:
```
Warning  Unhealthy  pod/app-mongodb-0  Readiness probe failed: Error verifying agent is ready
```

The k8s-ee platform automatically creates these RBAC resources via the MongoDB chart:

```yaml
# charts/mongodb/templates/role.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: mongodb-database
rules:
  - apiGroups: [""]
    resources: ["secrets"]
    verbs: ["get"]
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "patch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: mongodb-database
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: mongodb-database
subjects:
  - kind: ServiceAccount
    name: mongodb-database
```

**Note:** The ARC runner ClusterRole includes `roles` and `rolebindings` permissions to deploy these RBAC resources.

### Why Both Layers?

Even with proper init containers, you still need application-level retry because:

1. **Timing gaps**: Small window between init container success and app startup
2. **Connection pool exhaustion**: Database might reject new connections temporarily
3. **Network transients**: Brief network issues during startup
4. **Graceful degradation**: App can log meaningful errors while retrying

## Summary

1. **Always implement retry logic** with exponential backoff
2. **Order initialization correctly**: pool → wait → migrate → seed → flag
3. **Use Global modules** for shared resources
4. **Let critical failures crash** the app (Kubernetes will restart)
5. **Use native client tools** in init containers
6. **Test failure scenarios** locally before deploying
