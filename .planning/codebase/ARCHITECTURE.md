# Architecture

**Analysis Date:** 2026-01-25

## Pattern Overview

**Overall:** Event-driven infrastructure-as-code platform with multi-layered abstractions for Kubernetes environment management and GitHub Actions CI/CD integration.

**Key Characteristics:**
- GitHub Actions as orchestration layer (stateless, declarative job execution)
- Kubernetes as infrastructure layer (namespace-per-PR isolation model)
- Infrastructure-as-Code (IaC) templates with environment variable substitution
- Helm charts for application deployment (configurable services)
- Python utility scripts for lifecycle management (cleanup, preservation)
- Monorepo structure with demo application and platform components

## Layers

**GitHub Actions Workflow Layer:**
- Purpose: Orchestrate PR environment lifecycle and maintain event-driven semantics
- Location: `.github/workflows/` (main entry points) and `.github/actions/` (reusable steps)
- Contains: Workflow definitions (YAML), custom GitHub Actions (JS/Shell/Python)
- Depends on: Kubernetes cluster, GitHub API, container registry (GHCR)
- Used by: External repositories via reusable workflow pattern

**Kubernetes Infrastructure Layer:**
- Purpose: Define and manage namespace templates, networking policies, resource quotas, and observability infrastructure
- Location: `k8s/` directory (ephemeral, operators, observability, platform, ARC)
- Contains: YAML manifests (templates with envsubst), Helm values, ConfigMaps, CronJobs
- Depends on: kubectl, Helm, environment variables (PROJECT_ID, PR_NUMBER, etc.)
- Used by: GitHub Actions deploy-app action via Helm/kubectl

**Helm Chart Layer:**
- Purpose: Define reusable application and service deployments with configurable values
- Location: `charts/` directory (k8s-ee-app, postgresql, mongodb, redis, minio, mariadb, demo-app)
- Contains: Chart metadata, templates, values, dependencies
- Depends on: Kubernetes API, container images
- Used by: deploy-app action for application and database releases

**Application Layer (Demo App):**
- Purpose: Reference implementation demonstrating platform capabilities
- Location: `demo-app/` (monorepo with pnpm workspaces)
- Contains: NestJS API (`apps/api/`), React frontend (`apps/web/`), shared dependencies
- Depends on: Multiple databases (MariaDB, MongoDB, Redis), MinIO storage, Prometheus metrics
- Used by: CI/CD pipeline for building container images, integration testing

**Utility Scripts Layer:**
- Purpose: Provide operational tools for lifecycle management and synchronization
- Location: `scripts/` directory (Python/Shell scripts)
- Contains: cleanup job script, preservation expiry handler, story sync tool
- Depends on: kubectl, GitHub CLI, Python runtime
- Used by: CronJobs in cluster, GitHub Actions workflows

## Data Flow

**PR Environment Creation Flow:**

1. GitHub PR event (opened, reopened, synchronize) triggers `.github/workflows/pr-environment.yml`
2. pr-environment-reusable.yml orchestrates five parallel/sequential jobs:
   - **validate-config**: Parses k8s-ee.yaml from calling repository, validates schema, extracts configuration
   - **build-image** (parallel): Builds container from Dockerfile, pushes to GHCR with tag `pr-{number}`
   - **create-namespace** (parallel): Executes in-cluster via arc-runner-set
     - Creates namespace `{projectId}-pr-{prNumber}` from template
     - Applies ResourceQuota and LimitRange (dynamically sized based on enabled databases)
     - Applies 5 NetworkPolicies for isolation (default-deny, allow-same-namespace, allow-ingress-controller, allow-observability, allow-egress)
   - **deploy-app** (sequential after create/build): Deploys via Helm charts
     - k8s-ee-app chart with user application image
     - Conditional database charts (PostgreSQL, MongoDB, Redis, MinIO, MariaDB) based on k8s-ee.yaml
     - Creates Ingress for preview URL
     - Configures environment variables and secrets
   - **pr-comment-deploy**: Posts deployment status/URL to PR comment

3. Monitoring during deployment:
   - Prometheus scrapes metrics from app (if enabled)
   - Promtail reads pod logs and ships to Loki
   - Grafana dashboards aggregate metrics/logs

**PR Closure/Preservation Flow:**

1. GitHub PR event (closed) triggers pr-environment-reusable.yml with `pr-action=closed`
2. destroy-namespace job:
   - Checks for `/preserve` command in PR comments
   - If preserved: adds label `k8s-ee/preserved-until` (48h max, 3 env quota)
   - If not preserved: deletes namespace immediately
3. Background cleanup (CronJob every 6h):
   - Scans for orphaned namespaces (no recent GitHub PR match)
   - Deletes namespaces older than 24h without /preserve
   - Removes expired preserved namespaces (beyond 48h TTL)

**State Management:**

- **Transient State**: PR environment (namespace, deployments, databases) — lifecycle bound to PR
- **Metadata State**: Kubernetes labels/annotations on namespaces (PR number, branch, commit, created-at)
- **Observability State**: Logs in Loki, metrics in Prometheus (retention policies per component)
- **Configuration State**: k8s-ee.yaml in repository (single source of truth for environment config)
- **Preservation State**: Annotation `k8s-ee/preserved-until` on namespace (tracks 48h expiry)

## Key Abstractions

**k8s-ee.yaml (Configuration Contract):**
- Purpose: Defines environment requirements declaratively
- Examples: `k8s-ee.yaml` (root), demo-app's configuration shows projectId, app port, database selections, metrics enable/disable
- Pattern: YAML schema with JSON schema validation via `.github/actions/validate-config`
- Structure: Top-level keys (projectId, app, image, databases, metrics)

**Namespace Templates (IaC Pattern):**
- Purpose: Define Kubernetes objects with template variables for dynamic provisioning
- Examples:
  - `k8s/ephemeral/namespace-template.yaml` (Namespace with labels)
  - `k8s/ephemeral/resource-quota.yaml` (dynamically calculated limits)
  - `k8s/ephemeral/network-policy-*.yaml` (5 policies for isolation)
- Pattern: envsubst substitution of variables like `${PROJECT_ID}`, `${PR_NUMBER}`, `${BRANCH_NAME}`, `${COMMIT_SHA}`

**Helm Charts (Application Packaging):**
- Purpose: Bundle and configure application + services with values-based overrides
- Examples:
  - `charts/k8s-ee-app/` (generic app chart for any image + databases)
  - `charts/postgresql/`, `charts/mongodb/`, etc. (database service charts)
- Pattern: Conditional dependencies via `condition` in Chart.yaml (e.g., `postgresql.enabled`)

**GitHub Actions (Workflow Orchestration):**
- Purpose: Coordinate multi-step deployment and cleanup
- Examples:
  - `.github/actions/validate-config/action.yml` (JSON schema validation + configuration parsing)
  - `.github/actions/create-namespace/action.yml` (templating + kubectl apply)
  - `.github/actions/deploy-app/action.yml` (Helm release management)
- Pattern: Composite actions that bundle shell/JavaScript logic with input/output contracts

**Python Utility Scripts (Background Operations):**
- Purpose: Handle asynchronous lifecycle events (cleanup, preservation expiry)
- Examples:
  - `scripts/cleanup-orphaned-namespaces.py` (compares GitHub PRs vs K8s namespaces)
  - `scripts/preserve-expiry.py` (checks TTL annotations and deletes)
- Pattern: Scheduled via Kubernetes CronJob, uses kubectl and GitHub API

## Entry Points

**Primary (GitHub Action Workflow):**
- Location: `.github/workflows/pr-environment-reusable.yml` (core orchestration)
- Triggers: `pull_request` event (opened, reopened, synchronize, closed) via calling repository
- Responsibilities:
  - Route to validate-config → build-image/create-namespace → deploy-app OR destroy-namespace
  - Manage job ordering and dependencies
  - Post results to PR via comment action

**Secondary (In-Cluster CronJob):**
- Location: `k8s/platform/cleanup-job/cleanup-cronjob.yaml`
- Triggers: Schedule every 6h (0:00, 6:00, 12:00, 18:00 UTC)
- Responsibilities: Execute cleanup-orphaned-namespaces.py script to detect and remove stale namespaces

**Configuration Entry Point:**
- Location: `k8s-ee.yaml` in calling repository root
- Parsed by: validate-config action
- Responsibilities: Declare what services/features are enabled for this environment

**Application Entry Point (Demo):**
- Location: `demo-app/apps/api/src/main.ts` (NestJS bootstrap)
- Triggers: Container startup
- Responsibilities: Initialize NestJS application, configure middleware (logging, metrics, security), listen on port

## Error Handling

**Strategy:** Progressive validation with fail-fast approach for configuration; graceful degradation for deployments.

**Patterns:**
- **Configuration Validation**: Early-exit in validate-config action (JSON schema) prevents downstream job execution if k8s-ee.yaml is invalid
- **Namespace Creation Failure**: If create-namespace fails, downstream deploy-app is skipped (via `needs` dependency)
- **Deployment Failure**: deploy-app posts failure status to PR comment; namespace remains for debugging (automatic cleanup via 24h threshold)
- **Application Startup Failure**: liveness/readiness probes detect failed apps; Kubernetes restarts container after threshold
- **Cleanup Failure**: Orphaned cleanup retries in next 6h CronJob run; manual intervention via `kubectl delete namespace` if persistent

## Cross-Cutting Concerns

**Logging:**
- Application: NestJS Pino logger with structured JSON, correlation ID injection, header redaction
- Location: `demo-app/apps/api/src/app.module.ts` (LoggerModule.forRoot with custom props for correlationId)
- Observability: Promtail ships logs to Loki; Grafana queries by namespace/pod labels
- Pattern: Correlation ID middleware attaches request ID to all logs

**Validation:**
- Configuration: JSON Schema validation in validate-config action (`.github/actions/validate-config/action.yml`)
- Application: NestJS ValidationPipe for DTO validation (whitelist, forbid unlisted, transform)
- Network: NetworkPolicies enforce at Kubernetes layer (default-deny, selective allow)

**Authentication & Authorization:**
- GitHub: OAuth2 via GitHub Actions `secrets.GITHUB_TOKEN` (implicit for calling repo access)
- Kubernetes: RBAC for cleanup job (`k8s/platform/cleanup-job/cleanup-rbac.yaml`)
- Application: No built-in auth in demo-app (reference implementation assumes internal network)
- Database: Per-PR isolated credentials (unique per namespace, injected as environment variables)

**Metrics & Monitoring:**
- Prometheus scraping: Enabled via ServiceMonitor (if metrics.enabled in k8s-ee.yaml)
- Scrape interval: 30s (configurable in k8s-ee.yaml)
- Endpoints: `/metrics` on application (Prometheus client library in NestJS)
- Dashboards: Grafana dashboards aggregate metrics by namespace (Loki logs + Prometheus metrics)

---

*Architecture analysis: 2026-01-25*
