# Phase 4: Pilot Project Integration (htm-gestor-documentos)

## Context

This is Phase 4 of the Edge/UFAL pilot migration — the final phase. Phases 1-3 are complete (platform fixes, ECR integration, infrastructure setup on EC2). This phase integrates `htm-gestor-documentos` with the k8s-ee platform so the Edge team can open PRs and get working preview environments.

**Approach:** Combined single image (backend + frontend in one Dockerfile) with mock authentication (AUTH_BYPASS_LDAP + seeded test users). No Samba AD, no multi-container support.

**Branch:** `feat/k8s-ee-integration` based on `gd-sprint-17` in `/home/genesluna/repos/htm-gestor-documentos`

**Requirements covered:** PILOT-01, PILOT-02, PILOT-03, PILOT-04

---

## Step 1: Create branch

```bash
cd /home/genesluna/repos/htm-gestor-documentos
git checkout gd-sprint-17
git checkout -b feat/k8s-ee-integration
```

---

## Step 2: AUTH_BYPASS_LDAP (EDGE-00)

**File:** `backend/src/shared/infrastructure/auth/auth-ldap.service.ts`

Add bypass logic at the top of the `authenticate()` method (line 122). When `AUTH_BYPASS_LDAP=true`, skip LDAP bind and validate the password against `AUTH_TEST_PASSWORD` env var instead.

```typescript
async authenticate(username: string, password: string): Promise<boolean> {
    if (!username || !password) {
      throw new Error(ERROR_MESSAGES.AUTH_USERNAME_PASSWORD_REQUIRED);
    }

    // Bypass LDAP in ephemeral environments (k8s-ee)
    if (process.env.AUTH_BYPASS_LDAP === 'true') {
      const testPassword = process.env.AUTH_TEST_PASSWORD;
      if (!testPassword) {
        throw new Error('AUTH_TEST_PASSWORD must be set when AUTH_BYPASS_LDAP is enabled');
      }
      if (password !== testPassword) {
        logging.warn({ username, reason: 'invalid_test_password' }, 'Mock auth failed');
        return false;
      }
      logging.info({ username }, 'Mock auth successful (LDAP bypass)');
      return true;
    }

    // ... existing LDAP bind logic unchanged ...
```

**Why this works:** The `LoginHandler` calls `authenticate()` → gets `true` → then proceeds to `getUserWithMemberships()` (database lookup) → generates JWT tokens. The entire downstream flow (token generation, membership loading, permissions) remains unchanged. Seeded users in the database are found by username as normal.

**Key detail:** The `LDAP_SYNC_ON_STARTUP` must be `false` in k8s-ee environments to prevent the startup LDAP sync attempt. This is already controlled by env var in `auth.config.ts:58`.

### Unit tests

**File:** `backend/src/shared/infrastructure/auth/auth-ldap.service.test.ts` (edit existing)

Add a new `describe('AUTH_BYPASS_LDAP')` block inside the existing `describe('AuthServiceLdapjs')` suite. Follows the existing test patterns: `@jest/globals` imports, `process.env` manipulation with cleanup, `jest.spyOn(logging, ...)` for log assertions.

```typescript
describe('AUTH_BYPASS_LDAP', () => {
  let originalBypass: string | undefined;
  let originalTestPassword: string | undefined;

  beforeEach(() => {
    originalBypass = process.env.AUTH_BYPASS_LDAP;
    originalTestPassword = process.env.AUTH_TEST_PASSWORD;
  });

  afterEach(() => {
    process.env.AUTH_BYPASS_LDAP = originalBypass;
    process.env.AUTH_TEST_PASSWORD = originalTestPassword;
  });

  it('should return true when bypass enabled and password matches', async () => {
    process.env.AUTH_BYPASS_LDAP = 'true';
    process.env.AUTH_TEST_PASSWORD = 'test-pass';

    const result = await authService.authenticate('anyuser', 'test-pass');

    expect(result).toBe(true);
    expect(mockClient.bind).not.toHaveBeenCalled();
  });

  it('should return false when bypass enabled and password does not match', async () => {
    process.env.AUTH_BYPASS_LDAP = 'true';
    process.env.AUTH_TEST_PASSWORD = 'test-pass';

    const result = await authService.authenticate('anyuser', 'wrong-pass');

    expect(result).toBe(false);
    expect(mockClient.bind).not.toHaveBeenCalled();
  });

  it('should throw when bypass enabled but AUTH_TEST_PASSWORD not set', async () => {
    process.env.AUTH_BYPASS_LDAP = 'true';
    delete process.env.AUTH_TEST_PASSWORD;

    await expect(authService.authenticate('anyuser', 'pass'))
      .rejects.toThrow('AUTH_TEST_PASSWORD must be set when AUTH_BYPASS_LDAP is enabled');
  });

  it('should fall through to LDAP when AUTH_BYPASS_LDAP is not set', async () => {
    delete process.env.AUTH_BYPASS_LDAP;
    mockClient.bind.mockImplementation((_dn, _password, callback) => {
      callback(null);
    });

    const result = await authService.authenticate('user', 'pass');

    expect(result).toBe(true);
    expect(mockClient.bind).toHaveBeenCalled();
  });

  it('should fall through to LDAP when AUTH_BYPASS_LDAP is false', async () => {
    process.env.AUTH_BYPASS_LDAP = 'false';
    mockClient.bind.mockImplementation((_dn, _password, callback) => {
      callback(null);
    });

    const result = await authService.authenticate('user', 'pass');

    expect(result).toBe(true);
    expect(mockClient.bind).toHaveBeenCalled();
  });

  it('should log warning on mock auth failure', async () => {
    process.env.AUTH_BYPASS_LDAP = 'true';
    process.env.AUTH_TEST_PASSWORD = 'test-pass';
    const logWarnSpy = jest.spyOn(logging, 'warn').mockImplementation(() => {});

    await authService.authenticate('user', 'wrong');

    expect(logWarnSpy).toHaveBeenCalledWith(
      { username: 'user', reason: 'invalid_test_password' },
      'Mock auth failed'
    );
    logWarnSpy.mockRestore();
  });

  it('should log info on mock auth success', async () => {
    process.env.AUTH_BYPASS_LDAP = 'true';
    process.env.AUTH_TEST_PASSWORD = 'test-pass';
    const logInfoSpy = jest.spyOn(logging, 'info').mockImplementation(() => {});

    await authService.authenticate('user', 'test-pass');

    expect(logInfoSpy).toHaveBeenCalledWith(
      { username: 'user' },
      'Mock auth successful (LDAP bypass)'
    );
    logInfoSpy.mockRestore();
  });

  it('should still require username and password even with bypass', async () => {
    process.env.AUTH_BYPASS_LDAP = 'true';
    process.env.AUTH_TEST_PASSWORD = 'test-pass';

    await expect(authService.authenticate('', 'pass'))
      .rejects.toThrow(ERROR_MESSAGES.AUTH_USERNAME_PASSWORD_REQUIRED);

    await expect(authService.authenticate('user', ''))
      .rejects.toThrow(ERROR_MESSAGES.AUTH_USERNAME_PASSWORD_REQUIRED);
  });
});
```

**Test design notes:**
- Environment variables are saved/restored in `beforeEach`/`afterEach` to prevent test pollution
- `mockClient.bind` is asserted as NOT called when bypass is active — proves LDAP is skipped
- `mockClient.bind` IS called when bypass is disabled — proves existing flow is preserved
- Follows the existing test naming convention (English for new tests, consistent with recent additions)
- The `logging` spy pattern matches the existing test at line 132-150 of the test file

**Acceptance criteria:**
- [ ] `authenticate()` returns `true` when `AUTH_BYPASS_LDAP=true` and password matches `AUTH_TEST_PASSWORD`
- [ ] `authenticate()` returns `false` when `AUTH_BYPASS_LDAP=true` and password does NOT match
- [ ] `authenticate()` throws when `AUTH_BYPASS_LDAP=true` but `AUTH_TEST_PASSWORD` is not set
- [ ] Existing LDAP flow is unchanged when `AUTH_BYPASS_LDAP` is unset or `false`
- [ ] No new dependencies added
- [ ] 8 new unit tests pass (`yarn test --testPathPattern auth-ldap`)
- [ ] Existing auth tests still pass (no regressions)
- [ ] Code-reviewer sub-agent passes with no blocking issues

**Commit:** `feat(auth): add AUTH_BYPASS_LDAP for ephemeral environments`

---

## Step 3: Express static file serving

### 3a. SPA fallback middleware

**File:** `backend/src/shared/middleware/spa-fallback.middleware.ts` (new)

Extract the SPA fallback into a standalone middleware factory for testability. Follows the existing middleware pattern (see `auth.middleware.ts`, `date-formatter.middleware.ts`).

```typescript
import type { Request, Response, NextFunction } from 'express';

/**
 * Creates middleware that serves index.html for client-side routes.
 * Skips API paths and non-GET requests so they fall through to 404/other handlers.
 */
export function createSpaFallback(indexHtmlPath: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) {
      next();
      return;
    }
    res.sendFile(indexHtmlPath);
  };
}
```

### 3b. Static serving in index.ts

**File:** `backend/src/index.ts`

Add static file serving and SPA fallback inside `startServer()`, right after routes are loaded (after line 169: `app.use('/api', router)`).

```typescript
// Add imports at top of file
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createSpaFallback } from '@shared/middleware/spa-fallback.middleware';
```

```typescript
// After app.use('/api', router); (line 169)

// Serve frontend static files (combined image mode)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
const indexHtml = path.join(publicDir, 'index.html');

if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  logger.info('Serving frontend static files from public/');
  app.use(createSpaFallback(indexHtml));
}
```

**Why conditional:** The `fs.existsSync` check ensures this is a no-op in development (no `public/` directory exists relative to `dist/`). Only activates in the combined Docker image where the frontend is copied to `/app/public/`.

**Why middleware instead of `app.get('*')`:** Express 5 changed wildcard route syntax — `*` is no longer valid as a standalone route pattern. Using `app.use()` with a middleware function avoids this breaking change entirely.

**Path resolution:** In the Docker image, compiled backend is at `/app/dist/index.js` → `__dirname` = `/app/dist` → `publicDir` = `/app/public/`. Correct.

**Middleware order matters:**
1. CORS, json, urlencoded (top-level) — runs for all requests
2. `/api-docs` swagger — catches swagger requests
3. `/api` content-type header — sets JSON headers for API routes only
4. `/api` router — handles API routes
5. `express.static` — serves known static files (JS, CSS, images)
6. SPA fallback middleware — serves `index.html` for Vue Router paths (GET only, skips `/api`)

**CORS note:** Same-origin requests (frontend served from same host) don't include the `Origin` header. The existing `!origin` check in the CORS config handles this correctly. No CORS changes needed.

### 3c. Unit tests

**File:** `backend/src/shared/middleware/spa-fallback.middleware.test.ts` (new)

Follows the existing middleware test pattern from `auth.middleware.test.ts` — partial `Request`/`Response` mocks, `NextFunction` as `jest.fn()`.

```typescript
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { createSpaFallback } from '@shared/middleware/spa-fallback.middleware';

describe('createSpaFallback', () => {
  let res: Partial<Response>;
  let next: jest.Mock;
  const indexHtml = '/app/public/index.html';
  let middleware: ReturnType<typeof createSpaFallback>;

  beforeEach(() => {
    res = {
      sendFile: jest.fn(),
    };
    next = jest.fn();
    middleware = createSpaFallback(indexHtml);
  });

  it('should serve index.html for GET requests to non-API paths', () => {
    const req = { method: 'GET', path: '/dashboard' } as Partial<Request>;

    middleware(req as Request, res as Response, next as NextFunction);

    expect(res.sendFile).toHaveBeenCalledWith(indexHtml);
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next() for POST requests', () => {
    const req = { method: 'POST', path: '/some-path' } as Partial<Request>;

    middleware(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalled();
    expect(res.sendFile).not.toHaveBeenCalled();
  });

  it('should call next() for PUT requests', () => {
    const req = { method: 'PUT', path: '/some-path' } as Partial<Request>;

    middleware(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalled();
    expect(res.sendFile).not.toHaveBeenCalled();
  });

  it('should call next() for DELETE requests', () => {
    const req = { method: 'DELETE', path: '/some-path' } as Partial<Request>;

    middleware(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalled();
    expect(res.sendFile).not.toHaveBeenCalled();
  });

  it('should call next() for PATCH requests', () => {
    const req = { method: 'PATCH', path: '/some-path' } as Partial<Request>;

    middleware(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalled();
    expect(res.sendFile).not.toHaveBeenCalled();
  });

  it('should call next() for GET requests to /api paths', () => {
    const req = { method: 'GET', path: '/api/users' } as Partial<Request>;

    middleware(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalled();
    expect(res.sendFile).not.toHaveBeenCalled();
  });

  it('should call next() for GET requests to /api root', () => {
    const req = { method: 'GET', path: '/api/' } as Partial<Request>;

    middleware(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalled();
    expect(res.sendFile).not.toHaveBeenCalled();
  });

  it('should serve index.html for root path', () => {
    const req = { method: 'GET', path: '/' } as Partial<Request>;

    middleware(req as Request, res as Response, next as NextFunction);

    expect(res.sendFile).toHaveBeenCalledWith(indexHtml);
    expect(next).not.toHaveBeenCalled();
  });

  it('should serve index.html for deep nested paths', () => {
    const req = { method: 'GET', path: '/documents/123/edit' } as Partial<Request>;

    middleware(req as Request, res as Response, next as NextFunction);

    expect(res.sendFile).toHaveBeenCalledWith(indexHtml);
    expect(next).not.toHaveBeenCalled();
  });
});
```

**Test design notes:**
- Follows `auth.middleware.test.ts` pattern: partial `Request`/`Response`, `jest.fn()` for `next`
- Tests both positive (serve index.html) and negative (call next) paths
- Covers all HTTP methods that should be skipped (POST, PUT, DELETE, PATCH)
- Covers `/api` prefix filtering with both nested paths and root
- Covers SPA deep route serving (`/documents/123/edit`)

**Acceptance criteria:**
- [ ] `spa-fallback.middleware.ts` exports `createSpaFallback` factory function
- [ ] Factory returns Express middleware `(req, res, next) => void`
- [ ] `express.static` middleware registered after `/api` router in `index.ts`
- [ ] SPA fallback uses `app.use()` middleware (not `app.get('*')`) for Express 5 compatibility
- [ ] SPA fallback skips `/api` paths and non-GET methods
- [ ] Static serving is conditional — only activates when `public/` directory exists (`fs.existsSync`)
- [ ] `path`, `fs`, `fileURLToPath`, `createSpaFallback` imports added at file top
- [ ] `__dirname` computed via `fileURLToPath(import.meta.url)` (ES module compatible)
- [ ] Existing middleware, routes, CORS config unchanged
- [ ] 9 new unit tests pass (`yarn test --testPathPattern spa-fallback`)
- [ ] Existing tests still pass (no regressions)
- [ ] Code-reviewer sub-agent passes with no blocking issues

**Commit:** `feat(backend): add static file serving for combined image mode`

---

## Step 4: Dockerfile.k8s-ee + entrypoint

### 4a. Entrypoint script

**File:** `docker/k8s-ee-entrypoint.sh` (new)

```bash
#!/bin/sh
set -e

echo "=== k8s-ee Entrypoint ==="
echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Starting application..."
exec "$@"
```

**Why no wait-for-it:** The k8s-ee platform deploys init containers that wait for database readiness before starting the app container. The existing `backend/entrypoint.sh` waits for PostgreSQL and LDAP — neither is needed here.

**Why no explicit seed step:** The app auto-seeds when the database is empty (`index.ts:157-165` — checks `userCount === 0 || branchCount === 0` and calls `seed()`). This creates all reference data, users, memberships, documents, and folders. MinIO is available because the platform's init containers ensure it.

### 4b. Dockerfile

**File:** `Dockerfile.k8s-ee` (new, at repo root)

Four-stage build using the yarn workspace install pattern from the existing `backend/Dockerfile.prod` (lines 5-9).

**Critical workspace detail:** This is a yarn classic (v1) monorepo with a single root `yarn.lock`. There are NO per-workspace `yarn.lock` files. The install pattern must copy root `package.json` + `yarn.lock` + all workspace `package.json` files, then run `yarn install` at the root.

```dockerfile
# Dockerfile.k8s-ee — Combined image for k8s-ephemeral-environments
# Bundles backend (Express API) + frontend (Vue 3 SPA) in a single container

# =============================================================================
# Stage 1: Dependencies (workspace-aware install)
# =============================================================================
FROM node:22-alpine AS deps
WORKDIR /app

# Yarn workspace install: root package.json + yarn.lock + all workspace package.json
COPY package.json yarn.lock ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

RUN yarn install --frozen-lockfile

# =============================================================================
# Stage 2: Backend Builder
# =============================================================================
FROM deps AS backend-builder

COPY backend/ ./backend/
WORKDIR /app/backend
RUN yarn prisma generate && yarn build

# =============================================================================
# Stage 3: Frontend Builder
# =============================================================================
FROM deps AS frontend-builder

COPY frontend/ ./frontend/
WORKDIR /app/frontend

ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN yarn build

# =============================================================================
# Stage 4: Production Runtime
# =============================================================================
FROM node:22-alpine AS runtime
WORKDIR /app

# Copy all node_modules from backend-builder (includes generated Prisma client
# + prisma CLI for migrate deploy). prisma is a devDep so yarn install --production
# would exclude it — copying from builder avoids that problem.
# NOTE: Includes devDeps; can be optimized later with selective copy.
COPY --chown=node:node --from=backend-builder /app/node_modules ./node_modules

# Copy backend package.json (has "type": "module" needed for ESM)
COPY --chown=node:node --from=backend-builder /app/backend/package.json ./

# Copy Prisma schema + migrations
COPY --chown=node:node --from=backend-builder /app/backend/prisma ./prisma

# Copy compiled backend (kept under dist/ for correct __dirname resolution)
COPY --chown=node:node --from=backend-builder /app/backend/dist ./dist

# Copy compiled frontend → served by Express as static files
COPY --chown=node:node --from=frontend-builder /app/frontend/dist ./public

# Copy entrypoint
COPY docker/k8s-ee-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Run as non-root (matches existing Dockerfile.prod pattern)
USER node

ENV NODE_ENV=production \
    PORT=3000 \
    PINO_LOG_LEVEL=info

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget -q --spider http://localhost:3000/api/ || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "dist/index.js"]
```

**Key decisions:**
- **4-stage build (deps → backend-builder → frontend-builder → runtime):** Both builder stages inherit from `deps`, sharing the cached `yarn install` layer. This avoids duplicating dependency installation.
- **Workspace install pattern:** Follows existing `backend/Dockerfile.prod` — copies root `package.json` + `yarn.lock` + workspace `package.json` files. Yarn classic creates hoisted `node_modules/` at `/app/node_modules/` plus workspace-level `.bin/` symlinks at `/app/backend/node_modules/.bin/` and `/app/frontend/node_modules/.bin/`.
- **`yarn build` works in workspace context:** The build script is `node_modules/.bin/tsc && node fix-import.js`. Both resolve correctly from `WORKDIR /app/backend` — `tsc` via workspace `.bin/` symlink, `fix-import.js` via CWD (copied from `backend/`).
- **Full node_modules in runtime:** `prisma` is a devDependency, but the entrypoint needs `npx prisma migrate deploy`. Copying all node_modules from builder ensures prisma CLI is available. Image size can be optimized later.
- **`VITE_API_BASE_URL=/api`**: Baked into the frontend build. Axios uses `/api` as `baseURL`, making requests to the same origin. No proxy needed.
- **`start-period=60s`**: Migrations + auto-seed can take time on first run.
- **No wait-for-it.sh**: Platform deploys init containers that wait for PostgreSQL (`pg_isready`) and MinIO (`curl health endpoint`) before starting the app container (see `charts/k8s-ee-app/templates/deployment.yaml:38-171`).

**Acceptance criteria:**
- [ ] Dockerfile uses 4-stage build: `deps` → `backend-builder` → `frontend-builder` → `runtime`
- [ ] Stage 1 copies root `package.json` + `yarn.lock` + workspace `package.json` files (NOT per-workspace lock files)
- [ ] Backend build runs from `WORKDIR /app/backend` (correct CWD for `fix-import.js`)
- [ ] Frontend build uses `VITE_API_BASE_URL=/api` as build arg
- [ ] Runtime copies `node_modules` from `backend-builder` (includes prisma CLI + generated client)
- [ ] All COPY instructions in runtime use `--chown=node:node`
- [ ] Runtime runs as `USER node`
- [ ] HEALTHCHECK uses correct path (`/api/`)
- [ ] Entrypoint runs `npx prisma migrate deploy` then `exec "$@"`
- [ ] Entrypoint uses `#!/bin/sh` with `set -e`
- [ ] `.dockerignore` updated (not replaced) — adds `**/dist`, `**/.env`, `**/.env.*`, `!**/.env.example`
- [ ] Existing `.dockerignore` entries preserved (especially `!backend/prisma/migrations/**`)
- [ ] `docker/` directory created for entrypoint script
- [ ] Code-reviewer sub-agent passes with no blocking issues

**Commit:** `feat(docker): add Dockerfile.k8s-ee and entrypoint`

---

## Step 5: k8s-ee.yaml

**File:** `k8s-ee.yaml` (new, at repo root)

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/koder-cat/k8s-ephemeral-environments/main/.github/actions/validate-config/schema.json

projectId: htm-gestor-docs

trigger: on-demand

app:
  port: 3000
  healthPath: /api/

image:
  context: .
  dockerfile: Dockerfile.k8s-ee

env:
  NODE_ENV: production
  PINO_LOG_LEVEL: info
  JWT_SECRET: "k8s-ee-ephemeral-preview-secret-not-for-production-use"
  JWT_EXPIRATION: 7d
  JWT_REFRESH: 30d
  AUTH_BYPASS_LDAP: "true"
  AUTH_TEST_PASSWORD: "Senh@Valida123"
  LDAP_SYNC_ON_STARTUP: "false"
  MINIO_USE_SSL: "false"
  MINIO_DEV_MODE: "true"

databases:
  postgresql:
    enabled: true
    version: "17"
  minio:
    enabled: true
    bucket: htm-gestor-documentos

metrics:
  enabled: true
  interval: 30s
```

**Key env vars:**
- `AUTH_BYPASS_LDAP=true` + `AUTH_TEST_PASSWORD`: Enables mock auth (Step 2)
- `LDAP_SYNC_ON_STARTUP=false`: Prevents startup LDAP connection attempt
- `JWT_SECRET`: Fixed value (>32 chars) required by `auth.config.ts` in production mode
- Database vars (`DATABASE_URL`, `PGHOST`, `MINIO_ENDPOINT`, etc.) are injected automatically by the platform when databases are enabled
- `MINIO_BUCKET` is NOT in env — it's set via `databases.minio.bucket` which passes through to the minio Helm chart as `.Values.bucket` (used in `_helpers.tpl:103`). Setting it in `env:` would be silently overridden by the chart's `env:` injection (Kubernetes `env:` takes precedence over `envFrom:`)

**Health path:** `healthPath: /api/` — The health check endpoint is `GET /api/` (routes.ts:58), NOT `/api/health`. The health-check feature is mounted at `router.use('/', healthCheckRoutes)` with `router.get('/', handler)`, so both the root API response and health handler are at `/api/`.

**Trigger mode:** `on-demand` — environments created via `/deploy-preview` comment, not on every PR. Appropriate for initial pilot rollout.

---

## Step 6: GitHub Actions workflow

**File:** `.github/workflows/pr-environment.yml` (new)

```yaml
name: PR Environment

on:
  issue_comment:
    types: [created]
  pull_request:
    types: [opened, reopened, synchronize, closed]

concurrency:
  group: pr-env-${{ github.event.pull_request.number || github.event.issue.number }}
  cancel-in-progress: false

permissions:
  contents: read
  packages: write
  pull-requests: write
  security-events: write

jobs:
  pr-environment:
    if: |
      github.event_name == 'pull_request' ||
      (github.event_name == 'issue_comment' &&
       github.event.issue.pull_request &&
       (startsWith(github.event.comment.body, '/deploy-preview') ||
        startsWith(github.event.comment.body, '/destroy-preview')))
    uses: edgebr/k8s-ephemeral-environments/.github/workflows/pr-environment-reusable.yml@main
    with:
      pr-number: ${{ github.event.pull_request.number || 0 }}
      pr-action: ${{ github.event.action || '' }}
      head-sha: ${{ github.event.pull_request.head.sha || '' }}
      head-ref: ${{ github.head_ref || '' }}
      repository: ${{ github.repository }}
      comment-body: ${{ github.event.comment.body || '' }}
      comment-id: ${{ github.event.comment.id || 0 }}
      issue-number: ${{ github.event.issue.number || 0 }}
      platforms: 'linux/amd64'
      architecture: 'amd64'
      preview-domain: 'k8s-ee.edge.net.br'
      k8s-ee-repo: 'edgebr/k8s-ephemeral-environments'
      registry-type: 'ecr'
      ecr-region: 'us-east-2'
    secrets: inherit
```

**Acceptance criteria:**
- [ ] `k8s-ee.yaml` validates against the JSON schema (projectId pattern, trigger enum, port range, healthPath pattern, env key pattern, metrics interval pattern)
- [ ] `projectId: htm-gestor-docs` — max 20 chars, lowercase alphanumeric + hyphens
- [ ] `healthPath: /api/` — matches actual endpoint (routes.ts:58)
- [ ] `databases.minio.bucket: htm-gestor-documentos` — passed through Helm values, not set in env (avoids silent override)
- [ ] `MINIO_BUCKET` is NOT in the `env:` section
- [ ] `JWT_SECRET` value is >32 characters (required by `auth.config.ts` in production mode)
- [ ] `AUTH_BYPASS_LDAP`, `AUTH_TEST_PASSWORD`, `LDAP_SYNC_ON_STARTUP` all present in env
- [ ] Workflow `uses:` points to `edgebr/k8s-ephemeral-environments` (not `koder-cat`)
- [ ] Workflow inputs match reusable workflow interface: `platforms`, `architecture`, `preview-domain`, `registry-type`, `ecr-region`
- [ ] `secrets: inherit` passes ECR credentials
- [ ] Workflow `if:` filter handles both `pull_request` and `issue_comment` events
- [ ] Code-reviewer sub-agent passes with no blocking issues

**Commit:** `feat: add k8s-ee platform configuration and workflow`

---

## Step 7: Update .dockerignore

**File:** `.dockerignore` (edit existing, NOT replace)

A `.dockerignore` already exists with good exclusions (node_modules, .git, .github, .claude, .cursor, coverage, e2e, ec2, k8s, ad, *.log, *.md, `!backend/prisma/migrations/**`). Add entries needed for the k8s-ee build:

```diff
 node_modules
 frontend/node_modules
 backend/node_modules
 .git
 .github
 .claude
 .cursor
 .taskmaster
 .vscode
 .idea
 coverage
 e2e
 ec2
 k8s
 ad
 *.log
 *.md
 !backend/prisma/migrations/**
+**/dist
+**/.env
+**/.env.*
+!**/.env.example
```

**Key preservations from existing file:**
- `!backend/prisma/migrations/**` — exceptions for migration files (critical; without this, `*.md` could exclude migration-related files)
- `ec2/`, `ad/`, `k8s/` — deployment dirs not needed in build context
- `.claude`, `.cursor`, `.taskmaster` — editor/AI config dirs

Include this in the Dockerfile commit (Step 4).

---

## Commit Strategy (4 commits, each reviewed)

Each commit goes through a **code-reviewer sub-agent** validation before committing. If the reviewer finds issues, fix them before proceeding.

| # | Commit message | Files | Review focus |
|---|---------------|-------|-------------|
| 1 | `feat(auth): add AUTH_BYPASS_LDAP for ephemeral environments` | `auth-ldap.service.ts` + `auth-ldap.service.test.ts` | Auth bypass correctness, error handling, 8 new tests |
| 2 | `feat(backend): add static file serving for combined image mode` | `index.ts` + `spa-fallback.middleware.ts` + `spa-fallback.middleware.test.ts` | Express 5 compat, middleware order, 9 new tests |
| 3 | `feat(docker): add Dockerfile.k8s-ee and entrypoint` | `Dockerfile.k8s-ee`, `docker/k8s-ee-entrypoint.sh`, `.dockerignore` (edit) | Workspace build, layer order, non-root user, entrypoint |
| 4 | `feat: add k8s-ee platform configuration and workflow` | `k8s-ee.yaml`, `.github/workflows/pr-environment.yml` | Schema validation, workflow inputs, env vars |

---

## Verification

### Local verification (before pushing)

1. **Run unit tests:**
   ```bash
   cd /home/genesluna/repos/htm-gestor-documentos/backend
   yarn test --testPathPattern "auth-ldap|spa-fallback"
   # Expected: 17 new tests pass (8 auth bypass + 9 SPA fallback)
   yarn test
   # Expected: all existing tests still pass (no regressions)
   ```

2. **Build the Docker image:**
   ```bash
   cd /home/genesluna/repos/htm-gestor-documentos
   docker build -f Dockerfile.k8s-ee -t htm-gestor-docs:local .
   ```

3. **Verify image architecture:**
   ```bash
   docker inspect htm-gestor-docs:local | grep Architecture
   # Expected: "Architecture": "amd64"
   ```

4. **Verify static files are in the image:**
   ```bash
   docker run --rm htm-gestor-docs:local ls /app/public/
   # Expected: index.html, assets/
   ```

5. **Verify entrypoint exists:**
   ```bash
   docker run --rm htm-gestor-docs:local cat /entrypoint.sh
   ```

### End-to-end verification (after pushing)

1. Push branch and open PR against `gd-sprint-17`
2. Comment `/deploy-preview` on the PR
3. Wait for workflow to complete — check GitHub Actions tab
4. Verify preview URL: `https://htm-gestor-docs-pr-{N}.k8s-ee.edge.net.br`
5. Test login with seeded user: `admin` / `Senh@Valida123`
6. Verify frontend loads (Vue SPA)
7. Verify API works (`/api/`)
8. Close PR — verify namespace cleanup

---

## Files Summary

All changes are in `/home/genesluna/repos/htm-gestor-documentos`:

| File | Action | Purpose |
|------|--------|---------|
| `backend/src/shared/infrastructure/auth/auth-ldap.service.ts` | Edit | AUTH_BYPASS_LDAP bypass in `authenticate()` |
| `backend/src/shared/infrastructure/auth/auth-ldap.service.test.ts` | Edit | 8 new tests for AUTH_BYPASS_LDAP |
| `backend/src/shared/middleware/spa-fallback.middleware.ts` | Create | SPA fallback middleware factory |
| `backend/src/shared/middleware/spa-fallback.middleware.test.ts` | Create | 9 new tests for SPA fallback |
| `backend/src/index.ts` | Edit | `express.static` + SPA fallback import |
| `Dockerfile.k8s-ee` | Create | Combined multi-stage build |
| `docker/k8s-ee-entrypoint.sh` | Create | Migrations + exec |
| `.dockerignore` | Edit | Add dist/env exclusions to existing file |
| `k8s-ee.yaml` | Create | Platform config with mock auth env vars |
| `.github/workflows/pr-environment.yml` | Create | Reusable workflow call with ECR inputs |
