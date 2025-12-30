# Demo App

A full-stack demonstration application for the k8s-ephemeral-environments platform. Built with NestJS (API) and React (Web) in a pnpm monorepo.

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Available Scripts](#available-scripts)
- [Docker Build](#docker-build)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Configuration](#configuration)

## Overview

This demo app showcases the ephemeral environment platform by displaying PR-specific information:
- PR number and branch name
- Commit SHA and version
- Database connection status
- Preview URL

The app is automatically deployed to a preview environment for every Pull Request.

## Tech Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Runtime | Node.js | 22+ |
| Package Manager | pnpm | 9+ |
| API Framework | NestJS | 11.x |
| Frontend | React | 19.x |
| Build Tool | Vite | 6.x |
| Testing | Vitest | 3.x |
| Database | PostgreSQL | 16 |
| Container | Docker | Multi-stage |

## Project Structure

```
demo-app/
├── apps/
│   ├── api/                 # NestJS backend
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── app.controller.ts
│   │   │   ├── app.service.ts
│   │   │   └── database.service.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                 # React frontend
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   └── App.css
│       ├── index.html
│       ├── package.json
│       └── vite.config.ts
│
├── Dockerfile               # Multi-stage build
├── package.json             # Monorepo root
├── pnpm-workspace.yaml      # Workspace config
└── pnpm-lock.yaml
```

## Quick Start

### Prerequisites

- Node.js 22+
- pnpm 9+

### Installation

```bash
# Install dependencies
pnpm install

# Start development servers
pnpm dev
```

The API runs on `http://localhost:3000` and the Web app on `http://localhost:5173`.

### With Database (Optional)

To run with PostgreSQL locally:

```bash
# Start PostgreSQL container
docker run -d \
  --name demo-postgres \
  -e POSTGRES_USER=app \
  -e POSTGRES_PASSWORD=secret \
  -e POSTGRES_DB=app \
  -p 5432:5432 \
  postgres:16-alpine

# Set connection string
export DATABASE_URL="postgresql://app:secret@localhost:5432/app"

# Start the API
pnpm dev:api
```

## Available Scripts

Run from the `demo-app` directory:

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start both API and Web in development mode |
| `pnpm dev:api` | Start only the API (port 3000) |
| `pnpm dev:web` | Start only the Web (port 5173) |
| `pnpm build` | Build both apps for production |
| `pnpm build:api` | Build only the API |
| `pnpm build:web` | Build only the Web |
| `pnpm start` | Run production build |
| `pnpm test` | Run all tests |
| `pnpm test:cov` | Run tests with coverage |
| `pnpm lint` | Lint all code |
| `pnpm clean` | Remove build artifacts |

## Docker Build

The Dockerfile uses a multi-stage build for optimization:

```bash
# Build the image
docker build -t demo-app .

# Run the container
docker run -p 3000:3000 demo-app
```

### Build Stages

1. **deps** - Install all dependencies
2. **prod-deps** - Install production dependencies only
3. **builder** - Build Web and API, copy Web dist to API public
4. **runner** - Production image with non-root user

### Image Details

- Base: `node:22-alpine`
- User: `nestjs` (UID 1001)
- Port: 3000
- Platform: `linux/arm64` (for VPS deployment)

## Kubernetes Deployment

The app is deployed via Helm chart with PostgreSQL:

```bash
# Deploy to a namespace
helm upgrade --install demo-app ./charts/demo-app \
  --namespace my-namespace \
  --set prNumber=42 \
  --set previewDomain=k8s-ee.genesluna.dev
```

See [charts/demo-app/README.md](../charts/demo-app/README.md) for full configuration options.

### Preview URL Format

```
k8s-ee-pr-{number}.k8s-ee.genesluna.dev
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | API server port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | - |
| `CORS_ORIGIN` | Allowed CORS origins | `false` |
| `PR_NUMBER` | Pull request number | - |
| `COMMIT_SHA` | Git commit SHA | - |
| `BRANCH_NAME` | Git branch name | - |
| `APP_VERSION` | Application version | `1.0.0` |
| `PREVIEW_URL` | Preview environment URL | - |

See individual app READMEs for more details:
- [API README](apps/api/README.md)
- [Web README](apps/web/README.md)
