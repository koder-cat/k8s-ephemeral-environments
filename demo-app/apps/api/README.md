# Demo App API

NestJS backend API for the demo application. Serves both the API endpoints and the static React frontend.

## Table of Contents

- [Overview](#overview)
- [API Endpoints](#api-endpoints)
- [Prometheus Metrics](#prometheus-metrics)
- [Environment Variables](#environment-variables)
- [Database Integration](#database-integration)
- [Development](#development)
- [Testing](#testing)
- [Security](#security)

## Overview

The API provides:
- Health check endpoint for Kubernetes probes
- PR environment information for the frontend
- Database connection status
- Static file serving for the React SPA

## API Endpoints

### GET /api/health

Health check for Kubernetes liveness/readiness probes.

**Response:**
```json
{
  "status": "ok",
  "uptime": 12345.678,
  "timestamp": "2025-01-01T00:00:00.000Z",
  "database": {
    "connected": true,
    "version": "PostgreSQL 16.1"
  }
}
```

### GET /api/info

Returns PR environment metadata.

**Response:**
```json
{
  "prNumber": "42",
  "commitSha": "abc1234",
  "branchName": "feat/new-feature",
  "version": "1.0.0",
  "previewUrl": "https://k8s-ee-pr-42.k8s-ee.genesluna.dev"
}
```

### GET /api/db

Returns database connection information.

**Response (connected):**
```json
{
  "enabled": true,
  "connected": true,
  "host": "demo-app-postgresql-rw",
  "database": "app",
  "tables": ["users", "posts"],
  "size": "8192 kB"
}
```

**Response (not configured):**
```json
{
  "enabled": false,
  "message": "Database not configured"
}
```

### GET /

Serves the React SPA (static files from `public/` directory).

### GET /metrics

Prometheus metrics endpoint for observability.

**Response:** Prometheus text format with all application metrics.

## Simulator Endpoints

The simulator module provides endpoints for observability testing.

### GET /api/simulator/status-codes

Returns available HTTP status codes for simulation.

### GET /api/simulator/status/:code

Simulates an HTTP response with the specified status code.

**Parameters:** `code` - HTTP status code (200, 201, 204, 400, 401, 403, 404, 422, 429, 500, 502, 503, 504)

### GET /api/simulator/latency-presets

Returns available latency presets.

### GET /api/simulator/latency/:preset

Simulates a response with the specified latency.

**Parameters:** `preset` - Latency preset (fast, normal, slow, verySlow, timeout) or custom delay in ms

### POST /api/simulator/stress/cpu

Runs a CPU stress test.

**Body:**
```json
{
  "duration": 5000,
  "intensity": 50
}
```

### POST /api/simulator/stress/memory

Runs a memory stress test.

**Body:**
```json
{
  "duration": 5000,
  "sizeMb": 64
}
```

## Alert Demo Endpoints

The alert demo module triggers sustained load to fire Prometheus alerts in Grafana.

### GET /api/simulator/alert-demo

Returns available alert types.

**Response:**
```json
{
  "alertTypes": {
    "high-error-rate": {
      "description": "Generates 5xx errors to trigger APIHighErrorRate alert",
      "durationMinutes": 11
    },
    "high-latency": {
      "description": "Generates slow responses to trigger APIHighLatency alert",
      "durationMinutes": 11
    },
    "slow-database": {
      "description": "Runs heavy database queries to trigger DatabaseQuerySlow alert",
      "durationMinutes": 11
    }
  },
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

### GET /api/simulator/alert-demo/status

Returns current alert demo status.

**Response:**
```json
{
  "running": true,
  "alertType": "high-error-rate",
  "startedAt": "2025-01-01T00:00:00.000Z",
  "endsAt": "2025-01-01T00:10:30.000Z",
  "remainingSeconds": 480,
  "requestsSent": 300,
  "progress": 25,
  "timestamp": "2025-01-01T00:02:30.000Z"
}
```

### POST /api/simulator/alert-demo/:alertType

Starts an alert demo.

**Parameters:** `alertType` - Alert type (high-error-rate, high-latency, slow-database)

**Response:** Same as status endpoint with additional `message` field.

### DELETE /api/simulator/alert-demo

Stops the running alert demo.

## Database Test Endpoints

The database test module provides CRUD operations for observability testing.

### GET /api/db-test/records

Returns all test records.

### POST /api/db-test/records

Creates a new test record.

**Body:**
```json
{
  "name": "Test Record",
  "data": { "key": "value" }
}
```

### GET /api/db-test/records/:id

Returns a specific test record.

### PUT /api/db-test/records/:id

Updates a test record.

### DELETE /api/db-test/records/:id

Deletes a test record.

### DELETE /api/db-test/records

Deletes all test records.

### GET /api/db-test/heavy-query-presets

Returns available heavy query presets.

### POST /api/db-test/heavy-query/:preset

Runs a heavy database query for testing.

**Parameters:** `preset` - Query preset (light, medium, heavy)

### GET /api/db-test/stats

Returns database statistics including pool stats and table size.

## Metrics Summary Endpoint

### GET /api/metrics/summary

Returns aggregated metrics for the UI dashboard.

**Response:**
```json
{
  "requests": {
    "total": 1000,
    "perMinute": 50,
    "errorRate": 2.5,
    "avgLatencyMs": 150
  },
  "system": {
    "uptimeSeconds": 3600,
    "memoryUsedMb": 128,
    "memoryTotalMb": 512
  },
  "recentErrors": [
    {
      "timestamp": "2025-01-01T00:00:00.000Z",
      "status": 500,
      "method": "GET",
      "path": "/api/simulator/status/500"
    }
  ],
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

## Prometheus Metrics

The API exposes Prometheus metrics at `/metrics` for monitoring and alerting.

### HTTP Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `http_requests_total` | Counter | `method`, `route`, `status_code` | Total HTTP requests |
| `http_request_duration_seconds` | Histogram | `method`, `route`, `status_code` | Request duration |

**Histogram buckets:** 10ms, 50ms, 100ms, 250ms, 500ms, 1s, 2.5s, 5s, 10s

### Database Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `db_pool_connections_total` | Gauge | - | Total connections in pool |
| `db_pool_connections_idle` | Gauge | - | Idle connections in pool |
| `db_pool_connections_waiting` | Gauge | - | Clients waiting for connection |
| `db_query_duration_seconds` | Histogram | `operation`, `success` | Query duration |

**Query operation types:**
- `query` - Generic queries
- `health_check` - Health check queries (SELECT version())
- `list_tables` - Schema introspection queries
- `db_size` - Database size queries

**Histogram buckets:** 1ms, 5ms, 10ms, 50ms, 100ms, 500ms, 1s

### Node.js Metrics

Default Node.js metrics from `prom-client`:
- `process_cpu_seconds_total` - CPU usage
- `process_resident_memory_bytes` - Memory usage
- `nodejs_heap_size_used_bytes` - Heap usage
- `nodejs_eventloop_lag_seconds` - Event loop lag

### Default Labels

All metrics include these default labels:
- `app` - Application name (`demo-app`)
- `pr` - PR number from environment

### Example Queries

```promql
# Request rate by route
sum(rate(http_requests_total{namespace="k8s-ee-pr-42"}[5m])) by (route)

# P95 latency
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{namespace="k8s-ee-pr-42"}[5m])) by (le))

# Database query duration by operation
histogram_quantile(0.95, sum(rate(db_query_duration_seconds_bucket{namespace="k8s-ee-pr-42"}[5m])) by (le, operation))

# Failed database queries
sum(rate(db_query_duration_seconds_count{success="false"}[5m]))
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | Server port |
| `DATABASE_URL` | No | - | PostgreSQL connection string |
| `CORS_ORIGIN` | No | `false` | Allowed CORS origins |
| `PR_NUMBER` | No | - | Pull request number |
| `COMMIT_SHA` | No | - | Git commit SHA |
| `BRANCH_NAME` | No | - | Git branch name |
| `APP_VERSION` | No | `1.0.0` | Application version |
| `PREVIEW_URL` | No | - | Preview environment URL |
| `PGHOST` | No | - | PostgreSQL host (alternative to DATABASE_URL) |
| `PGDATABASE` | No | - | PostgreSQL database name |
| `PGUSER` | No | - | PostgreSQL username |
| `PGPASSWORD` | No | - | PostgreSQL password |
| `PGPORT` | No | `5432` | PostgreSQL port |

## Database Integration

The database is optional. The API works with or without a database connection.

### Connection Pooling

When `DATABASE_URL` is configured:
- Max connections: 5
- Idle timeout: 30 seconds
- Connection timeout: 5 seconds

### Using DATABASE_URL

```bash
export DATABASE_URL="postgresql://user:password@host:5432/database"
```

### Using Individual Variables

CloudNativePG injects these variables via Secret:
- `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`

## Development

### Running Locally

```bash
cd demo-app

# Start in development mode with hot reload
pnpm dev:api

# Or from apps/api
cd apps/api
pnpm dev
```

### Building

```bash
pnpm build:api
```

Output is written to `apps/api/dist/`.

## Testing

Tests use Vitest with Node environment.

```bash
# Run tests
pnpm --filter @demo-app/api test

# Watch mode
pnpm --filter @demo-app/api test:watch

# Coverage report
pnpm --filter @demo-app/api test:cov
```

### Test Files

- `app.controller.spec.ts` - Controller unit tests
- `app.service.spec.ts` - Service unit tests

### Coverage Threshold

Minimum 50% coverage required for:
- Lines
- Functions
- Branches
- Statements

## Security

### Helmet Configuration

The API uses Helmet for security headers with custom CSP for the SPA:

```javascript
contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "https:"],
    fontSrc: ["'self'", "https:", "data:"],
    connectSrc: ["'self'"]
  }
}
```

### CORS

CORS is disabled by default. Enable with `CORS_ORIGIN` environment variable:

```bash
export CORS_ORIGIN="https://example.com"
```

### Database Security

- Connection uses TLS when available
- Credentials managed via Kubernetes Secrets
- Connection pooling prevents connection exhaustion
