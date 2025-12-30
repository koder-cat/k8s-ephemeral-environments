# Demo App API

NestJS backend API for the demo application. Serves both the API endpoints and the static React frontend.

## Table of Contents

- [Overview](#overview)
- [API Endpoints](#api-endpoints)
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
