# External Integrations

**Analysis Date:** 2026-01-25

## APIs & External Services

**GitHub:**
- GitHub Actions - Workflow orchestration for PR environment lifecycle
  - SDK/Client: GitHub CLI (`gh`)
  - Webhooks: PR events (opened, reopened, synchronize, closed)
  - Auth: `GITHUB_TOKEN` secret (workflow-injected)
- GitHub Container Registry (GHCR) - Helm chart and image distribution
  - Auth: `GITHUB_TOKEN` for helm registry login

**Object Storage (S3-compatible):**
- MinIO (local K8s deployment in preview environments)
  - SDK/Client: `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`
  - Connection: Configured via environment variables
  - Auth: Access key and secret key (MINIO_ACCESS_KEY, MINIO_SECRET_KEY)
  - File: `demo-app/apps/api/src/storage/storage.service.ts`

## Data Storage

**Databases:**

- **PostgreSQL 16** (optional, via CloudNativePG operator)
  - Connection: `DATABASE_URL=postgresql://user:pass@host:5432/db`
  - Client: `pg` (native PostgreSQL client)
  - ORM: Drizzle ORM (declarative SQL with migrations)
  - Schema: `demo-app/apps/api/src/db/schema.ts`
  - Migrations: `drizzle-kit` CLI, stored in `drizzle/` directory
  - File: `demo-app/apps/api/drizzle.postgresql.config.ts`

- **MariaDB 11** (default/primary, always enabled)
  - Connection: `MYSQL_URL=mysql://user:pass@host:3306/db`
  - Client: `mysql2` (MySQL protocol client)
  - ORM: Drizzle ORM (same schema, different dialect)
  - Schema: `demo-app/apps/api/src/db/schema.mariadb.ts`
  - Migrations: `drizzle-kit` CLI
  - File: `demo-app/apps/api/drizzle.mariadb.config.ts`
  - Note: Only one SQL database (PostgreSQL OR MariaDB) enabled at a time

- **MongoDB 7** (optional, for audit logging)
  - Connection: `MONGODB_URL=mongodb://user:pass@host:27017/db?authSource=admin`
  - Client: `mongodb` native driver
  - TTL Index: Automatic cleanup of audit documents after 7 days
  - File: `demo-app/apps/api/src/audit/audit.service.ts`
  - Purpose: Fire-and-forget activity audit trail logging

**File Storage:**

- Local filesystem only in development (via docker volumes)
- MinIO S3-compatible storage in Kubernetes preview environments
  - Endpoint: MINIO_ENDPOINT, MINIO_PORT environment variables
  - Credentials: MINIO_ACCESS_KEY, MINIO_SECRET_KEY
  - Bucket: Configured in application code
  - File: `demo-app/apps/api/src/storage/storage.service.ts`

**Caching:**

- Redis 7 (optional, for application caching and rate limiting)
  - Connection: `REDIS_URL=redis://host:6379`
  - Client: `ioredis` (async Redis client)
  - Features: Key-value caching with TTL, sliding window rate limiting
  - File: `demo-app/apps/api/src/cache/cache.service.ts`
  - Note: Gracefully disabled if REDIS_URL not set

## Authentication & Identity

**Auth Provider:**
- Custom (no external auth provider)
  - Implementation: No authentication in demo-app
  - Security: Helmet CSP headers, CORS validation

**Internal Authentication (K8s namespaces):**
- Organization allowlist via `.github/config/allowed-orgs.json`
- Validated at PR open time
- File: GitHub Actions validation in workflow

## Monitoring & Observability

**Error Tracking:**
- None detected (no Sentry, DataDog, or similar)
- Logs sent to Loki via Promtail

**Logs:**
- **Loki** (Grafana) - Log aggregation in SingleBinary mode
  - Collected by: Promtail DaemonSet (pod and container logs)
  - Endpoint: `http://loki-gateway.observability.svc.cluster.local/loki/api/v1/push`
  - Storage: Filesystem (single-node) with default retention
  - Access: Grafana datasource integration
  - File: `k8s/observability/loki/values.yaml`, `k8s/observability/promtail/values.yaml`

**Metrics:**
- **Prometheus** - Metrics scraping and storage
  - Scrapes: ServiceMonitor CRDs in all namespaces
  - Retention: 7 days, 6GB limit
  - Storage: Local-path PVC
  - File: `k8s/observability/kube-prometheus-stack/values.yaml`

**Dashboarding/Visualization:**
- **Grafana** - Metrics dashboarding and alerting
  - Datasources: Prometheus, Loki
  - Init containers: Wait for Prometheus and Loki before starting
  - OAuth: Optional configuration via secrets
  - Ingress: Accessible at `grafana.k8s-ee.genesluna.dev` (custom domain)
  - File: `k8s/observability/grafana-ingress.yaml`

**Alerting:**
- **Alertmanager** - Alert routing and deduplication
  - Rules: Custom alerts in `k8s/platform/alerts/` and `k8s/observability/custom-alerts.yaml`
  - Scrape target: Prometheus scrapes `ServiceMonitor` resources

**Application Metrics:**
- Prometheus client: `prom-client` 15.1.0
- Metrics endpoint: `/metrics` (excluded from request logging)
- Instrumentation: `demo-app/apps/api/src/metrics/metrics.service.ts`
- ServiceMonitor: Auto-created for PR environments
- Scrape interval: 30s (configurable in k8s-ee.yaml)

## CI/CD & Deployment

**Hosting:**
- k3s single-node Kubernetes cluster on VPS
- Oracle Cloud Ampere (ARM64) - genilda.genesluna.dev
- Namespace structure:
  - `kube-system` - k3s components (permanent)
  - `observability` - Prometheus, Loki, Grafana (permanent)
  - `arc-systems` - ARC controller (permanent)
  - `arc-runners` - GitHub Actions runner pods (permanent)
  - `platform` - Shared base components (permanent)
  - `{projectId}-pr-{number}` - Ephemeral environments (e.g., `k8s-ee-pr-28`)

**CI Pipeline:**
- **GitHub Actions** - Workflow orchestration
  - Trigger: PR events (opened, reopened, synchronize, closed)
  - Reusable workflow: `.github/workflows/pr-environment-reusable.yml`
  - Main workflow: `.github/workflows/pr-environment.yml` (dogfooding in this repo)
  - Custom actions in `.github/actions/`:
    - `setup-tools/` - Install kubectl, helm
    - `validate-config/` - Validate k8s-ee.yaml
    - `build-image/` - Docker build and push
    - `create-namespace/` - Set up ephemeral namespace
    - `deploy-app/` - Deploy Helm chart
    - `destroy-namespace/` - Cleanup on PR close
    - `pr-comment/` - Post environment URL comment

**Image Registry:**
- GHCR (GitHub Container Registry)
  - Registry: `ghcr.io/{owner}/k8s-ephemeral-environments`
  - Images: Demo-app built per PR
  - Helm charts: Published to OCI registry
  - Auth: `GITHUB_TOKEN` (automatic in GitHub Actions)

**Helm Charts:**
- Published to: `oci://ghcr.io/{owner}/k8s-ephemeral-environments/charts`
- Database charts: `k8s-ee-postgresql`, `k8s-ee-mongodb`, `k8s-ee-redis`, `k8s-ee-minio`, `k8s-ee-mariadb`
- Application chart: `k8s-ee-app` (depends on database charts)
- Publish workflow: `.github/workflows/publish-charts.yml` (on push to main)

**Runners:**
- Actions Runner Controller (ARC) for self-hosted runners
- Runs on k3s in `arc-runners` namespace
- Runner set: Dynamically scaled based on queue demand
- Controller values: `k8s/arc/values-controller.yaml`
- Runner set values: `k8s/arc/values-runner-set.yaml`

**Cleanup & Maintenance:**
- **Cleanup Job**: CronJob runs every 6 hours
  - Destroys orphaned namespaces (PR closed without cleanup)
  - Script: `scripts/cleanup-orphaned-namespaces.py`
  - Config: `k8s/platform/cleanup-job/cleanup-cronjob.yaml`

- **Preserve Expiry**: CronJob for preservation cleanup
  - Handles `/preserve` command expiry (48h default)
  - Script: `scripts/preserve-expiry.py`
  - Config: `k8s/platform/preserve-expiry/preserve-expiry-cronjob.yaml`

## Environment Configuration

**Required env vars:**

For local development (`.env`):
- `DATABASE_URL` or `MYSQL_URL`/`DATABASE_URL` - Database connection
- `PORT` - API port (default 3000)
- `LOG_LEVEL` - Log verbosity
- `NODE_ENV` - Environment mode

For preview environments (auto-injected):
- `PR_NUMBER` - GitHub PR number
- `COMMIT_SHA` - PR head commit
- `BRANCH_NAME` - PR branch name
- `PREVIEW_URL` - Environment ingress URL

Optional (feature-gated):
- `MONGODB_URL` - Enable audit logging
- `REDIS_URL` - Enable caching/rate limiting
- `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` - Enable S3 storage
- `CORS_ORIGIN` - CORS origin (default: false)

**Secrets location:**

- GitHub Actions: Repository secrets tab
  - `GITHUB_TOKEN` - Automatic, used for GHCR login and API access
- Kubernetes: K8s Secrets (via Sealed Secrets if needed)
  - Database passwords in chart values
  - MinIO credentials in environment variables
  - GitHub webhook secrets (for listener validation)

## Webhooks & Callbacks

**Incoming:**
- GitHub PR events: Pull request lifecycle webhooks
  - Trigger: PR opened, reopened, synchronize, closed
  - Payload: PR metadata, commit SHA, branch name
  - Handler: GitHub Actions `pr-environment.yml` workflow

**Outgoing:**
- PR Comments: Bot posts preview URL on PR open
  - Posted by: `pr-comment` GitHub action
  - Content: Environment URL, health status, database info
- Metrics export: ServiceMonitor sends metrics to Prometheus
- Logs export: Promtail ships logs to Loki

## Additional Integrations

**GitHub Sync Script:**
- File: `scripts/sync-stories.py`
- Purpose: Bi-directional sync of user stories between docs and GitHub Issues
- Auth: GitHub CLI (`gh`) with authentication
- Uses: GitHub GraphQL API via CLI
- Run trigger: Manual, or via `.github/workflows/sync-stories.yml`

**Configuration Validation:**
- Schema validation for `k8s-ee.yaml`
- JSON schema: `.github/actions/validate-config/schema.json`
- Used by: PR environment workflow pre-flight checks

---

*Integration audit: 2026-01-25*
