# Codebase Structure

**Analysis Date:** 2026-01-25

## Directory Layout

```
k8s-ephemeral-environments/
├── .claude/                           # Claude Code integration
│   ├── commands/                      # Custom commands for Claude
│   └── skills/                        # Model-invoked skills
├── .github/                           # GitHub repository automation
│   ├── actions/                       # Reusable GitHub Actions (composite)
│   │   ├── build-image/               # Docker image build & push to GHCR
│   │   ├── create-namespace/          # Kubernetes namespace + quota + policies
│   │   ├── deploy-app/                # Helm chart deployment
│   │   ├── destroy-namespace/         # Namespace deletion (with preservation check)
│   │   ├── pr-comment/                # Post deployment status to PR
│   │   ├── setup-tools/               # Install kubectl, helm, etc.
│   │   └── validate-config/           # Parse & validate k8s-ee.yaml
│   ├── config/                        # Configuration (allowed-orgs.json for access control)
│   └── workflows/                     # GitHub Action workflows
│       ├── pr-environment.yml         # Primary: triggers reusable workflow
│       ├── pr-environment-reusable.yml # Reusable: orchestration logic
│       ├── preserve-environment.yml   # Preserve PR env for 48h
│       ├── publish-charts.yml         # Publish Helm charts to OCI registry
│       ├── sync-stories.yml           # Sync user stories ↔ GitHub issues
│       └── cla.yml                    # CLA bot
├── .planning/                         # GSD planning artifacts
│   └── codebase/                      # Codebase analysis documents
├── assets/                            # Images & static content for documentation
├── charts/                            # Helm charts (application & services)
│   ├── k8s-ee-app/                    # Generic application chart (configurable)
│   │   ├── Chart.yaml                 # Chart metadata & dependencies
│   │   ├── values.yaml                # Default values
│   │   ├── templates/                 # Deployment, Service, Ingress, ConfigMap
│   │   └── charts/                    # Bundled database charts (optional)
│   ├── demo-app/                      # Reference demo app chart
│   ├── postgresql/                    # CloudNativePG PostgreSQL service
│   ├── mongodb/                       # MongoDB community service
│   ├── redis/                         # Redis service
│   ├── minio/                         # MinIO S3-compatible storage
│   ├── mariadb/                       # MariaDB service
│   └── README.md
├── demo-app/                          # Reference implementation (dogfoods platform)
│   ├── apps/                          # pnpm workspace monorepo
│   │   ├── api/                       # NestJS backend API
│   │   │   ├── src/
│   │   │   │   ├── main.ts            # Application bootstrap entry point
│   │   │   │   ├── app.module.ts      # Root NestJS module (all imports)
│   │   │   │   ├── middleware/        # Correlation ID, metrics middleware
│   │   │   │   ├── metrics/           # Prometheus metrics service & controller
│   │   │   │   ├── database.module.ts # Database connection service
│   │   │   │   ├── db/                # Drizzle ORM schema & migrations
│   │   │   │   ├── audit/             # Activity logging interceptor & MongoDB storage
│   │   │   │   ├── cache/             # Redis caching service
│   │   │   │   ├── storage/           # MinIO file storage service
│   │   │   │   ├── simulator/         # Load simulation for testing
│   │   │   │   └── database-test/     # Database connectivity test endpoints
│   │   │   ├── package.json           # Dependencies (NestJS, Drizzle, ioredis, S3 client, etc.)
│   │   │   ├── drizzle.*.config.ts    # Separate ORM configs (PostgreSQL vs MariaDB)
│   │   │   ├── vitest.config.ts       # Test runner config
│   │   │   └── Dockerfile             # Build stage: compile TypeScript, production stage: Node.js runtime
│   │   └── web/                       # React frontend
│   │       ├── src/                   # React components & pages
│   │       ├── index.html             # HTML entry point
│   │       ├── package.json           # Dependencies (React 19, Vite, Vitest)
│   │       ├── vite.config.ts         # Vite build config
│   │       └── vitest.config.ts       # Test runner
│   ├── Dockerfile                     # Multi-stage build (includes both api & web)
│   ├── docker-compose.yml             # Local development (PostgreSQL, MongoDB, Redis, MinIO, MariaDB)
│   ├── package.json                   # Root workspace config (pnpm)
│   ├── pnpm-workspace.yaml            # pnpm monorepo definition
│   ├── pnpm-lock.yaml                 # Dependency lock file
│   └── .env.example                   # Template environment variables
├── docs/                              # Documentation
│   ├── PRD.md                         # Product Requirements Document (architecture, OKRs, phase planning)
│   ├── DEVELOPER-ONBOARDING.md        # Getting started guide
│   ├── roadmap.md                     # Project roadmap & milestones
│   ├── guides/                        # How-to & reference guides
│   │   ├── k8s-ee-config-reference.md # k8s-ee.yaml schema documentation
│   │   ├── security.md                # Security architecture & hardening
│   │   ├── access-control.md          # Organization allowlist setup
│   │   ├── service-development.md     # Best practices for databases
│   │   └── troubleshooting.md         # Debugging & runbooks
│   ├── runbooks/                      # Operational procedures
│   │   └── network-policies.md        # NetworkPolicy architecture & debugging
│   ├── tasks/                         # Implementation task lists (per epic)
│   │   ├── epic-1/ through epic-9/    # Task breakdown for each user story
│   │   └── US-XXX-tasks.md files
│   └── user-stories/                  # User story definitions (per epic)
│       ├── epic-1-infrastructure/     # Base k3s cluster setup
│       ├── epic-2-ephemeral-environments/
│       ├── epic-3-database/
│       ├── epic-4-observability/
│       ├── epic-5-github-runners/
│       ├── epic-6-security/
│       ├── epic-7-improvements/
│       ├── epic-8-simplified-onboarding/
│       └── epic-9-developer-experience/
├── k8s/                               # Kubernetes manifests & configurations
│   ├── ephemeral/                     # Templates for PR namespaces
│   │   ├── namespace-template.yaml    # Namespace definition (with labels/annotations)
│   │   ├── resource-quota.yaml        # CPU/Memory/Storage/Pod limits (dynamically sized)
│   │   ├── limit-range.yaml           # Default container resource limits
│   │   ├── network-policy-*.yaml      # 5 isolation policies (default-deny, allow-same-namespace, etc.)
│   │   └── README.md
│   ├── operators/                     # Database operators configuration
│   │   ├── cloudnative-pg/            # CloudNativePG PostgreSQL operator
│   │   ├── mongodb-community/         # MongoDB community operator
│   │   └── minio/                     # MinIO operator
│   ├── observability/                 # Prometheus, Loki, Grafana stack
│   │   ├── kube-prometheus-stack/     # Prometheus & Alertmanager config
│   │   ├── loki/                      # Loki log aggregation
│   │   ├── promtail/                  # Promtail log shipper
│   │   ├── dashboards/                # Grafana dashboards
│   │   ├── custom-alerts.yaml         # Custom Prometheus alert rules
│   │   ├── grafana-ingress.yaml       # Grafana public URL
│   │   └── README.md
│   ├── platform/                      # Platform-wide components (permanent namespaces)
│   │   ├── namespace.yaml             # Platform namespace
│   │   ├── priority-classes.yaml      # Priority class definitions
│   │   ├── cleanup-job/               # Orphan namespace cleanup
│   │   │   ├── cleanup-cronjob.yaml   # CronJob: every 6h
│   │   │   ├── cleanup-configmap.yaml # Cleanup script (Python)
│   │   │   ├── cleanup-rbac.yaml      # RBAC for cleanup job
│   │   │   └── README.md
│   │   ├── preserve-expiry/           # Preservation TTL enforcement
│   │   │   ├── preserve-cronjob.yaml  # CronJob: every 1h
│   │   │   └── README.md
│   │   └── alerts/                    # Alert rules for platform operations
│   ├── arc/                           # Actions Runner Controller setup
│   │   ├── values-controller.yaml     # ARC controller Helm values
│   │   ├── values-runner-set.yaml     # ARC runner set Helm values
│   │   ├── controller-rbac.yaml       # RBAC for ARC controller
│   │   ├── runner-rbac.yaml           # RBAC for runners
│   │   └── README.md
│   └── traefik/                       # Traefik ingress controller config
│       └── traefik-config.yaml        # Custom routing rules
├── scripts/                           # Operational & development scripts
│   ├── cleanup-orphaned-namespaces.py # Detect & delete stale PR namespaces
│   ├── preserve-expiry.py             # Enforce 48h TTL on preserved environments
│   ├── sync-stories.py                # Bi-directional sync: docs ↔ GitHub issues
│   ├── generate-configmaps.sh         # Generate ConfigMap manifests
│   └── README.md
├── site/                              # Static website (project documentation)
│   └── images/
├── signatures/                        # Signed commits/certificates
├── k8s-ee.yaml                        # Configuration for this repo (demo-app setup)
├── Dockerfile                         # Dockerfile for demo-app (multi-stage)
├── CONTRIBUTING.md                    # Contribution guidelines
├── CLAUDE.local.md                    # Claude Code instructions (private)
├── README.md                          # Project overview
└── LICENSE files
```

## Directory Purposes

**`.github/actions/`**
- Purpose: Reusable GitHub Actions for PR environment workflow
- Contains: Composite actions (shell + JavaScript + Python) with input/output contracts
- Key files: `action.yml` in each subdirectory defines inputs/outputs
- Pattern: Referenced in workflows via `uses: ./.github/actions/{action-name}`

**`.github/workflows/`**
- Purpose: Define GitHub Actions workflows for CI/CD and automation
- Contains: YAML workflow definitions (on: triggers, jobs, steps)
- Key orchestration: `pr-environment-reusable.yml` is the core (called by external repos)

**`charts/`**
- Purpose: Helm charts for packaging application and services
- Key chart: `k8s-ee-app/` is generic (any image + conditional databases)
- Deployment pattern: `deploy-app` action uses `helm upgrade --install` to release charts

**`demo-app/`**
- Purpose: Reference implementation demonstrating platform features (dogfooding)
- Multi-layer: pnpm workspace (API + web), Drizzle ORM, multiple database drivers
- Docker build: Multi-stage Dockerfile for optimized image size

**`docs/`**
- Purpose: Complete project documentation (requirements, guides, runbooks)
- Key document: `PRD.md` describes overall architecture and phases
- User stories: Epic-based structure with tasks per story

**`k8s/ephemeral/`**
- Purpose: Templates for ephemeral PR namespaces (Kubernetes manifests)
- Pattern: envsubst variables (`${PROJECT_ID}`, `${PR_NUMBER}`, etc.)
- Applied by: `create-namespace` action during PR environment creation

**`k8s/platform/`**
- Purpose: Platform infrastructure (cleanup CronJob, preservation TTL, alerts)
- CronJobs: Run background operations (every 6h cleanup, every 1h TTL check)
- Location: Deployed in permanent `platform` namespace

**`k8s/observability/`**
- Purpose: Prometheus, Loki, Grafana stack for centralized monitoring
- Permanent namespace: `observability` (deployed once, never deleted)
- Log aggregation: Promtail ships pod logs from all namespaces to Loki

**`scripts/`**
- Purpose: Utility scripts for operational tasks
- `cleanup-orphaned-namespaces.py`: Executed by CronJob to detect stale environments
- `sync-stories.py`: Bi-directional synchronization of user stories with GitHub issues

## Key File Locations

**Entry Points:**
- `.github/workflows/pr-environment.yml`: Primary workflow trigger for dogfooding repo
- `.github/workflows/pr-environment-reusable.yml`: Core orchestration (imported by external repos)
- `demo-app/apps/api/src/main.ts`: Application bootstrap (NestJS factory)
- `k8s-ee.yaml`: Configuration contract (parsed by validate-config action)

**Configuration:**
- `k8s-ee.yaml`: Environment configuration (projectId, app port, database enablement, metrics)
- `.github/actions/validate-config/action.yml`: Configuration schema & validation
- `charts/k8s-ee-app/values.yaml`: Helm defaults for generic app chart
- `demo-app/.env.example`: Template for application environment variables

**Core Logic:**
- `.github/actions/create-namespace/action.yml`: Namespace + quota + policies creation logic
- `.github/actions/deploy-app/action.yml`: Helm deployment orchestration
- `k8s/ephemeral/namespace-template.yaml`: Namespace definition template
- `k8s/ephemeral/network-policy-*.yaml`: Network isolation policies (5 total)
- `scripts/cleanup-orphaned-namespaces.py`: Orphan detection & cleanup logic

**Testing:**
- `demo-app/apps/api/src/**/*.spec.ts`: Unit tests (Vitest + NestJS testing utilities)
- `demo-app/apps/web/src/**/*.test.tsx`: React component tests
- `demo-app/vitest.config.ts`: Root test configuration

**Database Schema:**
- `demo-app/apps/api/src/db/schema.ts`: PostgreSQL Drizzle ORM schema
- `demo-app/apps/api/src/db/schema.mariadb.ts`: MariaDB Drizzle ORM schema
- `demo-app/apps/api/drizzle/`: PostgreSQL migrations (auto-generated)
- `demo-app/apps/api/drizzle-mariadb/`: MariaDB migrations (auto-generated)

## Naming Conventions

**Files:**
- GitHub workflows: `kebab-case.yml` (e.g., `pr-environment.yml`)
- Kubernetes manifests: `noun-descriptor.yaml` (e.g., `namespace-template.yaml`, `network-policy-default-deny.yaml`)
- Docker/Python scripts: `kebab-case.py` or `kebab-case.sh`
- Helm charts: `kebab-case/` directories with `Chart.yaml`, `values.yaml`

**Directories:**
- GitHub: `.github/{actions,config,workflows}/`
- Kubernetes: `k8s/{ephemeral,operators,observability,platform,arc,traefik}/`
- Application code: `demo-app/apps/{api,web}/src/`
- Database: `demo-app/apps/api/{src/db,drizzle,drizzle-mariadb}/`

**Kubernetes Objects:**
- Namespaces: `{project-id}-pr-{number}` (e.g., `k8s-ee-pr-28`)
- Labels: `k8s-ee/{type,project-id,pr-number,branch,commit-sha}` (consistent across all resources)
- ConfigMaps: `app-config` (for k8s-ee.yaml), `cleanup-script` (for Python cleanup)

**Environment Variables:**
- Database URLs: `{DB_TYPE}_URL` (e.g., `MYSQL_URL`, `MONGODB_URL`)
- Ports: `PORT` (application), `{SERVICE}_PORT` (for services)
- Feature flags: `{SERVICE}_ENABLED` (e.g., `METRICS_ENABLED`)
- GitHub: `GITHUB_TOKEN` (secrets)

## Where to Add New Code

**New Feature (API Endpoint):**
- Primary code: `demo-app/apps/api/src/{feature}/` (create feature module)
  - `{feature}.module.ts` - NestJS module with imports/providers
  - `{feature}.controller.ts` - HTTP routes
  - `{feature}.service.ts` - Business logic
- Database changes: Add schema updates to `demo-app/apps/api/src/db/schema.ts` and `schema.mariadb.ts`
- Tests: `demo-app/apps/api/src/{feature}/{feature}.service.spec.ts` (co-located)
- Example: See `database-test/` module structure

**New UI Component (React):**
- Component code: `demo-app/apps/web/src/` (organize by feature)
- Tests: `demo-app/apps/web/src/{component}.test.tsx` (co-located)
- Build config: `demo-app/apps/web/vite.config.ts` (already configured for React)

**New Database Service:**
- Helm chart: Create `charts/{service-name}/` with `Chart.yaml`, `values.yaml`, templates
- Conditional enablement: Add to `charts/k8s-ee-app/Chart.yaml` dependencies with `condition: {service-name}.enabled`
- Integration: Update `deploy-app` action to pass config for new service
- Configuration schema: Update validate-config action to parse service config from k8s-ee.yaml

**New Kubernetes Manifest:**
- Ephemeral resources (deleted with PR): Add to `k8s/ephemeral/` (applied by create-namespace)
- Platform resources (permanent): Add to `k8s/platform/` (deployed once during setup)
- Operators: Add to `k8s/operators/{operator-name}/` with values files
- Observability: Add to `k8s/observability/` with alert rules if applicable

**New GitHub Action:**
- Create `{action-name}/` directory in `.github/actions/`
- Add `action.yml` with inputs/outputs/description
- Implement logic in `action.yml` (shell/JavaScript) or reference external script
- Call from workflow: `uses: ./.github/actions/{action-name}`

**Utilities & Scripts:**
- Operational scripts: `scripts/{script-name}.py` (scheduled via CronJob)
- Build scripts: `scripts/{script-name}.sh` (one-time setup or CI step)

## Special Directories

**`k8s/ephemeral/`**
- Purpose: Namespace templates applied to each PR environment
- Generated: No (manually maintained templates)
- Committed: Yes (source of truth for namespace structure)
- Deployment: Applied via envsubst + kubectl apply in create-namespace action

**`k8s/platform/`**
- Purpose: Permanent infrastructure (cleanup, preservation, alerts)
- Generated: No (manually maintained manifests)
- Committed: Yes
- Deployment: One-time setup, persists across all PR environments

**`demo-app/dist/`, `demo-app/apps/*/dist/`**
- Purpose: Compiled TypeScript output
- Generated: Yes (compiled from src/)
- Committed: No (.gitignore)
- Build time: Docker multi-stage build compiles TypeScript during image build

**`demo-app/drizzle/`, `demo-app/apps/api/drizzle-mariadb/`**
- Purpose: Database migration files (ORM-generated)
- Generated: Yes (by Drizzle `generate` command)
- Committed: Yes (migrations are part of schema version control)
- Applied: At container startup (if MIGRATE=true)

**`demo-app/node_modules/`**
- Purpose: Dependency artifacts
- Generated: Yes (installed by pnpm)
- Committed: No (.gitignore)
- Installation: `pnpm install` or Docker RUN command

**`charts/k8s-ee-app/charts/`**
- Purpose: Bundled database charts (sub-dependencies)
- Generated: No (curated by platform team)
- Committed: Yes (included in Helm chart package)
- Pattern: Managed via Chart.yaml dependencies section

---

*Structure analysis: 2026-01-25*
