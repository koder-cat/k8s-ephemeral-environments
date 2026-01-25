# Technology Stack

**Analysis Date:** 2026-01-25

## Languages

**Primary:**
- TypeScript 5.7.0 - Full codebase (API, Web frontend, scripts)
- YAML - Kubernetes manifests, Helm charts, GitHub Actions workflows
- Shell (bash) - Automation scripts for environment setup
- Python 3.8+ - CLI scripts for GitHub sync and maintenance tasks

**Secondary:**
- JavaScript - Build outputs, Node.js runtime for API and web

## Runtime

**Environment:**
- Node.js 22.0.0+ (specified in `demo-app/.nvmrc` and `package.json` engines)
- Kubernetes 1.25.0+ (k3s single-node cluster on ARM64)
- Container runtime: containerd (via k3s)

**Package Manager:**
- pnpm 10.26.2 - Workspace-based package management
- npm/yarn - Available as alternatives
- Lockfile: `pnpm-lock.yaml` (present and tracked)

## Frameworks

**Core (Backend):**
- NestJS 11.1.11 - API framework in `demo-app/apps/api`
- Express (via NestJS platform-express) - HTTP server

**Core (Frontend):**
- React 19.0.0 - Web UI in `demo-app/apps/web`
- Vite 6.0.0 - Frontend build tool and dev server

**Database/ORM:**
- Drizzle ORM 0.45.0 - SQL database abstraction (PostgreSQL and MariaDB support)
- MongoDB native driver 6.12.0 - Document database for audit logging

**Testing:**
- Vitest 3.0.0 - Unit and component tests (both API and Web)
- @vitest/coverage-v8 3.0.0 - Test coverage reporting
- @testing-library/react 16.0.0 - React component testing
- @testing-library/jest-dom 6.6.0 - DOM matchers for vitest
- @nestjs/testing 11.0.0 - NestJS module testing

**Build/Dev:**
- @vitejs/plugin-react 4.3.0 - React plugin for Vite
- @nestjs/cli 11.0.0 - NestJS scaffold and build tools
- tsx 4.19.0 - TypeScript execution for Node scripts
- drizzle-kit 0.31.0 - Database migration CLI

## Key Dependencies

**Critical:**

- **@nestjs/common 11.1.11** - Core NestJS module with decorators, pipes, guards
- **@nestjs/core 11.1.11** - NestJS application factory and dependency injection
- **@nestjs/serve-static 5.0.0** - Static file serving for compiled React app
- **drizzle-orm 0.45.0** - Database query builder and migration runner
- **pg 8.13.0** - PostgreSQL client (Drizzle dialect)
- **mysql2 3.11.0** - MariaDB/MySQL client (Drizzle dialect)
- **mongodb 6.12.0** - MongoDB client for audit logging
- **ioredis 5.4.1** - Redis client for caching and rate limiting

**Observability/Logging:**

- **nestjs-pino 4.2.0** - Structured logging via Pino
- **pino-http 10.3.0** - HTTP request logging middleware
- **pino-pretty 13.0.0** - Pretty-printing for development logs
- **prom-client 15.1.0** - Prometheus metrics instrumentation
- **helmet 8.0.0** - Security headers middleware

**API/Storage:**

- **@aws-sdk/client-s3 3.700.0** - S3-compatible object storage client (MinIO)
- **@aws-sdk/s3-request-presigner 3.700.0** - Pre-signed URL generation for S3
- **multer 2.0.2** - Multipart form data (file uploads)

**Data Validation:**

- **class-validator 0.14.3** - Decorator-based DTO validation
- **class-transformer 0.5.1** - DTO serialization and deserialization

**Utilities:**

- **rxjs 7.8.1** - Reactive programming (NestJS standard)
- **uuid 11.0.3** - UUID generation
- **file-type 21.2.0** - File MIME type detection
- **reflect-metadata 0.2.2** - TypeScript metadata reflection (NestJS requirement)

**Linting/Formatting:**

- **eslint 9.17.0** - Code linting
- **@eslint/js 9.17.0** - ESLint JavaScript configuration
- **typescript-eslint 8.18.0** - TypeScript support for ESLint
- **eslint-plugin-react 7.37.0** - React-specific ESLint rules
- **eslint-plugin-react-hooks 5.1.0** - React hooks ESLint rules

**Testing/Coverage:**

- **jsdom 26.0.0** - DOM environment for Node.js testing

## Infrastructure Dependencies

**Kubernetes Operators (Helm charts):**

- **CloudNativePG operator** - PostgreSQL operator for Kubernetes
- **MongoDB Community operator** - MongoDB cluster operator
- **actions-runner-controller (ARC)** - GitHub Actions self-hosted runner controller
- **kube-prometheus-stack** - Prometheus, Grafana, Alertmanager

**Observability Stack (Helm charts):**

- **Loki 2.x** - Log aggregation (SingleBinary mode)
- **Promtail** - Log collector/shipper for Loki
- **Prometheus** - Metrics collection and storage
- **Grafana** - Metrics visualization and dashboarding
- **Alertmanager** - Alert routing and deduplication

**Database Images:**

- **PostgreSQL 16** (via Docker/K8s) - Primary relational database option
- **MariaDB 11** (via Docker/K8s) - Alternative relational database
- **MongoDB 7** (via Docker/K8s) - Document database for audit logs
- **Redis 7** (via Docker/K8s) - Caching and rate limiting
- **MinIO (latest)** - S3-compatible object storage

**Container Registry:**

- **GHCR (GitHub Container Registry)** - Helm charts and container images
- **Docker Hub** - Base images (node, postgres, mongo, redis, minio)

## Configuration

**Environment:**

Primary environment variables (see `demo-app/.env.example`):

- `DATABASE_URL` - Drizzle ORM database connection string (PostgreSQL or MariaDB)
- `MYSQL_URL` / `POSTGRESQL_URL` - Alternative database URL format
- `MONGODB_URL` - MongoDB connection string (optional, for audit logging)
- `REDIS_URL` - Redis connection string (optional, for caching)
- `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` - MinIO S3 credentials
- `PORT` - API server port (default 3000)
- `CORS_ORIGIN` - CORS allowed origin (dev: http://localhost:5173)
- `LOG_LEVEL` - Pino log level (debug, info, warn, error)
- `NODE_ENV` - development, production, test
- `PR_NUMBER`, `COMMIT_SHA`, `BRANCH_NAME`, `PREVIEW_URL` - PR metadata (injected in K8s)

**Build:**

- `tsconfig.json` - TypeScript configuration (workspace root)
- `.eslintrc` - ESLint configuration (workspace root)
- `vitest.config.ts` - Vitest configuration (per app if present)
- `vite.config.ts` - Vite configuration (web app)
- Dockerfile - Single multi-stage build for API in `demo-app/Dockerfile`

**Workspace:**

- `pnpm-workspace.yaml` - Defines workspace packages at `apps/*`
- Root `package.json` - Workspace scripts and shared dependencies
- Per-app `package.json` - App-specific dependencies

## Platform Requirements

**Development:**

- Node.js 22.0.0+
- pnpm 9.0.0+
- Docker (for local database services via docker-compose)
- kubectl and helm (for K8s operations)
- GitHub CLI (`gh`) authenticated (for story sync script)
- TypeScript 5.7.0+

**Production (K8s Deployment):**

- Kubernetes 1.25.0+ cluster
- k3s (ARM64 compatible)
- Container images must support `linux/arm64` architecture
- At minimum: 4GB RAM, 2 CPU cores, 20GB storage for single VPS deployment
- Traefik ingress (bundled with k3s)
- Local-path storage provisioner (bundled with k3s)

**Deployment Target:**

- VPS with Ubuntu 24.04 (ARM64) - Oracle Cloud, 4GB RAM
- Self-hosted k3s single-node cluster
- GitHub Actions with self-hosted runners (ARC on k3s)
- GHCR for container image storage

---

*Stack analysis: 2026-01-25*
