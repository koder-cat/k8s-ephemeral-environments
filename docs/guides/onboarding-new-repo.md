# Onboarding a New Repository

Add ephemeral PR environments to any repository in 3 simple steps.

## Prerequisites

Before onboarding, ensure your organization meets the following requirements:

### 1. Organization Allowlist

Your GitHub organization must be added to the platform allowlist.

| Item | Details |
|------|---------|
| **Check status** | View [allowed-orgs.json](https://github.com/koder-cat/k8s-ephemeral-environments/blob/main/.github/config/allowed-orgs.json) |
| **Request access** | Open an [issue](https://github.com/koder-cat/k8s-ephemeral-environments/issues) with org name and use case |

See [Access Control Guide](./access-control.md) for details.

### 2. GitHub App Installation

The ARC (Actions Runner Controller) GitHub App must be installed on your organization to run workflows on the self-hosted runners.

| Item | Details |
|------|---------|
| **App name** | `k8s-ee-arc-runner` |
| **Install location** | `https://github.com/organizations/{your-org}/settings/installations` |
| **Repository access** | Select "All repositories" or choose specific repos |

> **Note:** Contact the platform administrator if your organization doesn't have the GitHub App installed.

### 3. Organization Package Settings (GHCR only)

If using the default GHCR registry, your organization must allow public container packages.

| Setting | Location | Value |
|---------|----------|-------|
| **Package visibility** | `https://github.com/organizations/{your-org}/settings/packages` | Enable "Allow members to change container package visibility to public" |

Without this setting, GHCR deployments fail with `403 Forbidden` when pulling images.

> **Note:** This requirement does not apply when using ECR (`registry-type: ecr`). ECR uses image pull secrets for authentication.

### 4. Runner Group Settings (Public Repos)

If using public repositories, the runner group must allow them.

| Setting | Location | Value |
|---------|----------|-------|
| **Allow public repos** | `https://github.com/organizations/{your-org}/settings/actions/runner-groups` | Enable "Allow public repositories" on the Default group |

### 5. Repository Visibility

**Public repositories** work out of the box with GHCR (the default registry).

**Private repositories** are supported when using ECR (`registry-type: ecr`). ECR authenticates image pulls via a Kubernetes pull secret, so images don't need to be public. See [ECR Registry Setup](#ecr-registry-setup-private-repos) for configuration.

---

## Configuration Summary

| Requirement | Who Configures | Where |
|-------------|----------------|-------|
| Organization allowlist | Platform admin | `.github/config/allowed-orgs.json` |
| GitHub App installation | Org admin | GitHub org settings → Installations |
| Package visibility setting | Org admin | GitHub org settings → Packages |
| Runner group (public repos) | Org admin | GitHub org settings → Actions → Runner groups |
| `k8s-ee.yaml` config | Repo maintainer | Repository root |
| Workflow file | Repo maintainer | `.github/workflows/pr-environment.yml` |

---

## Secrets and Tokens

The platform uses the following authentication:

| Token/Secret | Purpose | Scope | Managed By |
|--------------|---------|-------|------------|
| `GITHUB_TOKEN` | Build/push images to GHCR, post PR comments | Automatic (workflow) | GitHub Actions |
| `github-app-secret` | ARC runner authentication | Kubernetes cluster | Platform admin |

**For GHCR (default):** No additional secrets are required. The `secrets: inherit` in the workflow passes the automatic `GITHUB_TOKEN`.

**For ECR:** Set the `ECR_ROLE_TO_ASSUME` repository variable with the IAM role ARN. The workflow uses OIDC to assume this role — no access keys needed. See [ECR Registry Setup](#ecr-registry-setup-private-repos) for details.

## Fork / Multi-Cluster Setup

If you're running your own k8s-ee cluster (not the upstream koder-cat instance), set these **repository variables** on the fork. No file changes needed — all workflows read these variables with sensible defaults.

| Variable | Default (koder-cat) | Description |
|----------|---------------------|-------------|
| `ARCHITECTURE` | `arm64` | Target architecture for tool/image builds (`arm64` or `amd64`) |
| `DOMAIN` | `k8s-ee.genesluna.dev` | Base domain for preview URLs |
| `ORG_NAME` | `koder-cat` | GitHub organization name (used in CLA, issue URLs) |
| `REGISTRY_TYPE` | `ghcr` | Container registry: `ghcr` or `ecr` |
| `ECR_REGION` | _(none)_ | AWS region for ECR (required when `REGISTRY_TYPE` is `ecr`) |
| `ECR_ROLE_TO_ASSUME` | _(none)_ | AWS IAM role ARN for OIDC auth (required when `REGISTRY_TYPE` is `ecr`) |

Set them at **Settings → Secrets and variables → Actions → Variables → New repository variable**.

> **Note:** For ECR, set the `ECR_ROLE_TO_ASSUME` variable with the IAM role ARN (e.g., `arn:aws:iam::123456789012:role/github-actions-ecr`). See [ECR Registry Setup](#ecr-registry-setup-private-repos) for details.

---

## Quick Start

### Step 1: Create Configuration File

Create `k8s-ee.yaml` in your repository root:

```yaml
# k8s-ee.yaml - minimal configuration
projectId: myapp  # Unique ID, max 20 chars, lowercase alphanumeric + hyphens

app:
  port: 3000
  healthPath: /health

# Enable databases as needed
databases:
  postgresql: true    # Connection details injected as DATABASE_URL
```

**[Full Configuration Reference](./k8s-ee-config-reference.md)** - All available options with examples.

> **On-demand mode:** To create environments only when needed (via `/deploy-preview` comment), add `trigger: on-demand` to your `k8s-ee.yaml`. The universal workflow template below handles both modes — once you have it, switching between automatic and on-demand is a one-line config change.

### Step 2: Add Workflow File

Create `.github/workflows/pr-environment.yml`:

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
  id-token: write    # Required by the reusable workflow for AWS OIDC authentication

jobs:
  pr-environment:
    if: |
      github.event_name == 'pull_request' ||
      (github.event_name == 'issue_comment' &&
       github.event.issue.pull_request &&
       (startsWith(github.event.comment.body, '/deploy-preview') ||
        startsWith(github.event.comment.body, '/destroy-preview')))
    uses: koder-cat/k8s-ephemeral-environments/.github/workflows/pr-environment-reusable.yml@main
    with:
      pr-number: ${{ github.event.pull_request.number || 0 }}
      pr-action: ${{ github.event.action || '' }}
      head-sha: ${{ github.event.pull_request.head.sha || '' }}
      head-ref: ${{ github.head_ref || '' }}
      repository: ${{ github.repository }}
      comment-body: ${{ github.event.comment.body || '' }}
      comment-id: ${{ github.event.comment.id || 0 }}
      issue-number: ${{ github.event.issue.number || 0 }}
    secrets: inherit
```

This single workflow handles both **automatic** and **on-demand** trigger modes. The reusable workflow reads `trigger` from your `k8s-ee.yaml` and routes events accordingly.

> **Note:** The `issue_comment` trigger causes workflow runs to appear in the Actions tab for all PR comments, but the `if:` filter ensures only `/deploy-preview` and `/destroy-preview` commands are actually processed.

**On-demand commands** (when `trigger: on-demand` is set in `k8s-ee.yaml`):

| Command | Action |
|---------|--------|
| `/deploy-preview` | Creates or redeploys the PR environment |
| `/destroy-preview` | Destroys the environment (PR stays open) |

After the first `/deploy-preview`, subsequent pushes to the PR automatically redeploy.

### Step 3: Have a Dockerfile

Your repository needs a Dockerfile at the root (or configured path). The platform builds images for the target architecture automatically (ARM64 by default, configurable via the `ARCHITECTURE` repository variable).

**That's it!** Open a PR and get a preview URL within minutes.

---

## What Happens When You Open a PR

1. Configuration validated against schema
2. Namespace created: `{projectId}-pr-{number}`
3. Container image built for cluster architecture and pushed to registry (GHCR or ECR)
4. Application deployed with Helm
5. Preview URL posted as PR comment: `https://{projectId}-pr-{number}.{DOMAIN}`
6. On PR close: namespace automatically destroyed

---

## Requirements

| Requirement | Description |
|-------------|-------------|
| **Public repository** | Or private with ECR (`registry-type: ecr`) |
| **Dockerfile** | Build your application as a container |
| **Health endpoint** | Returns 200 for Kubernetes probes (default: `/health`) |
| **Package permissions** | GHCR write access (automatic) or ECR credentials (via OIDC) |
| **Architecture compatible** | Base images must support the cluster architecture (default: `linux/arm64`, configurable via `ARCHITECTURE` variable) |

---

## Port Configuration

Configure your application's port in `k8s-ee.yaml`:

```yaml
app:
  port: 8080  # Default: 3000
```

### Common Ports by Stack

| Stack | Typical Port | Configuration |
|-------|-------------|---------------|
| Node.js, Express, NestJS | 3000 | Default, no config needed |
| .NET, Go, Java Spring Boot | 8080 | `app.port: 8080` |
| Python FastAPI, Django | 8000 | `app.port: 8000` |

The platform automatically configures the NetworkPolicy to allow ingress traffic on your specified port.

---

## Environment Variables

Add custom environment variables in the `env` section of `k8s-ee.yaml`:

```yaml
env:
  NODE_ENV: staging
  LOG_LEVEL: info
  JWT_SECRET: "ephemeral-preview-secret-not-for-production"
  FEATURE_FLAG_X: "true"
```

These are injected into the pod via a Kubernetes ConfigMap. All values must be strings — wrap booleans and numbers in quotes.

> **Database variables are automatic:** Connection details like `DATABASE_URL`, `PGHOST`, `MINIO_ENDPOINT`, etc. are injected by the database charts when you enable databases. You do not need to add them to `env`.

> **CORS:** The platform injects `PREVIEW_URL` as an environment variable (e.g., `https://myapp-pr-42.k8s-ee.genesluna.dev`). If your app has a CORS allowlist, add `process.env.PREVIEW_URL` to it. See [CORS troubleshooting](./troubleshooting.md#cors-errors-on-preview-url).

See the [full env reference](./k8s-ee-config-reference.md#env) for details.

---

## Optional Workflow Inputs

Customize the reusable workflow with additional inputs:

```yaml
with:
  # Standard inputs (already in the template above)
  pr-number: ${{ github.event.pull_request.number || 0 }}
  pr-action: ${{ github.event.action || '' }}
  head-sha: ${{ github.event.pull_request.head.sha || '' }}
  head-ref: ${{ github.head_ref || '' }}
  repository: ${{ github.repository }}
  comment-body: ${{ github.event.comment.body || '' }}
  comment-id: ${{ github.event.comment.id || 0 }}
  issue-number: ${{ github.event.issue.number || 0 }}
  # Optional customization
  config-path: 'k8s-ee.yaml'              # Path to config file
  preview-domain: 'k8s-ee.genesluna.dev'  # Base domain for URLs
  chart-version: '1.1.0'                  # k8s-ee-app chart version
  platforms: 'linux/amd64'               # Build platform (default: linux/arm64)
  architecture: 'amd64'                  # Tool download architecture (default: arm64)
  k8s-ee-repo: 'my-org/k8s-ee-fork'     # Use a fork of k8s-ee
  registry-type: 'ecr'                  # Use ECR instead of GHCR (default: 'ghcr')
  ecr-region: 'us-east-2'              # AWS region for ECR (required when registry-type is ecr)
  ecr-role-to-assume: 'arn:aws:iam::123456789012:role/github-actions-ecr'  # IAM role for OIDC (required for ECR)
```

| Input | Default | Description |
|-------|---------|-------------|
| `platforms` | `linux/arm64` | Target architecture for the Docker build. Change to `linux/amd64` if your cluster runs x86_64 nodes. |
| `architecture` | `arm64` | Target architecture for tool downloads (kubectl, Helm, Trivy). Must match `platforms`. |
| `k8s-ee-repo` | `koder-cat/k8s-ephemeral-environments` | Repository that provides the reusable actions and Helm charts. Override when running a fork of k8s-ee. |
| `registry-type` | `ghcr` | Container registry: `ghcr` (GitHub Container Registry) or `ecr` (AWS ECR). |
| `ecr-region` | _(none)_ | AWS region for ECR (required when `registry-type` is `ecr`). |
| `ecr-role-to-assume` | _(none)_ | AWS IAM role ARN for OIDC authentication (required when `registry-type` is `ecr`). |

> **Private images:** The deploy step automatically creates an `imagePullSecrets` entry so Kubernetes can pull from the configured registry (GHCR or ECR). No manual secret configuration is required beyond org-level secrets.

### Version Pinning

For production stability, pin to a specific version:

```yaml
# Pin to a release tag (when available)
uses: koder-cat/k8s-ephemeral-environments/.github/workflows/pr-environment-reusable.yml@v1

# Pin to a specific commit SHA (available now)
uses: koder-cat/k8s-ephemeral-environments/.github/workflows/pr-environment-reusable.yml@79d3549
```

> **Note:** Pinning the workflow ref automatically pins the entire k8s-ee stack — the reusable workflow, all composite actions, and Helm chart defaults are all checked out at the same ref. No extra `with:` parameters are needed.

---

## Resource Limits

Each PR namespace has **dynamic limits** calculated based on enabled databases:

| Configuration | CPU Limit | Memory | Storage |
|---------------|-----------|--------|---------|
| App only | 300m | 512Mi | 1Gi |
| App + PostgreSQL | 800m | 1Gi | 3Gi |
| App + PostgreSQL + Redis | 1000m | 1.1Gi | 3Gi |
| All databases enabled | 2100m | 2.4Gi | 9Gi |

Individual containers: max 512Mi memory, 500m CPU. See [Resource Requirements](./k8s-ee-config-reference.md#resource-requirements-by-database) for details.

---

## Troubleshooting

### Config validation failed

- `projectId` must be lowercase alphanumeric with hyphens only
- `projectId` maximum 20 characters
- Health path must start with `/`

### Image build failed

- Ensure Dockerfile works locally: `docker build .`
- Check base image supports ARM64
- Verify all dependencies are included

### Image pull failed (403 Forbidden) — GHCR

Container images are automatically set to public by the build step. If you see 403 errors:

1. **Check org setting:** Go to `https://github.com/organizations/{org}/settings/packages`
2. **Enable:** "Allow members to change container package visibility to public"
3. **Re-run the workflow** to make the package public

**First-time deployment:** The first PR for a new repository creates a new GHCR package. If the org setting wasn't enabled before the first build, you may need to manually make the package public:
1. Go to `https://github.com/orgs/{org}/packages/container/package/{repo}%2F{app}`
2. Click "Package settings" → "Change package visibility" → "Public"

### Image pull failed — ECR

If using `registry-type: ecr` and image pulls fail:

1. **Check OIDC role:** Ensure `ECR_ROLE_TO_ASSUME` repository variable is set with the correct IAM role ARN
2. **Check IAM permissions:** The IAM role needs `ecr:GetAuthorizationToken`, `ecr:BatchGetImage`, `ecr:GetDownloadUrlForLayer`, `ecr:BatchCheckLayerAvailability`, `ecr:CreateRepository`, `ecr:PutImage`, `ecr:InitiateLayerUpload`, `ecr:UploadLayerPart`, `ecr:CompleteLayerUpload`, `ecr:PutLifecyclePolicy`
3. **Check region:** Ensure `ecr-region` in the workflow matches the region where the ECR repository should exist
4. **Check trust policy:** The IAM role's trust policy must allow `token.actions.githubusercontent.com` as a federated principal for your repository

### Deployment failed

- Check pod logs: `kubectl logs -n {namespace} -l k8s-ee/project-id={projectId}`
- Verify health endpoint returns 200
- Check resource limits fit within quota
- If crashing due to missing env vars, verify them in the ConfigMap: `kubectl get configmap {namespace}-app-config -n {namespace} -o yaml`

See [Missing User-Defined Environment Variables](./troubleshooting.md#missing-user-defined-environment-variables) for detailed troubleshooting.

### Database not deployed

- Verify `databases.postgresql: true` (or other DB) is set in `k8s-ee.yaml`
- Check database pod status: `kubectl get pods -n {namespace} -l app=postgresql`
- View database logs: `kubectl logs -n {namespace} -l app=postgresql`
- Connection details are injected as `DATABASE_URL` environment variable

### App can't connect to database

- Database pods may take 30-60 seconds to become ready
- Verify `DATABASE_URL` is correctly parsed by your app
- Check your app's database client configuration
- View app logs for connection errors: `kubectl logs -n {namespace} -l k8s-ee/project-id={projectId}`

### Schema management

For production applications with evolving schemas, use database migrations instead of bootstrap SQL. See [Database Migrations Guide](./database-migrations.md) for Drizzle ORM setup with automatic migrations at startup.

### PR comment not appearing

- Verify `secrets: inherit` is set in workflow
- Check repository has Actions permissions

### Metrics not being scraped

- Verify `metrics.enabled: true` is set in `k8s-ee.yaml`
- Check ServiceMonitor exists: `kubectl get servicemonitor -n {namespace}`
- Verify your app exposes a `/metrics` endpoint (or custom path via `app.metricsPath`)
- The ServiceMonitor automatically adds a `namespace` label for Grafana filtering

> **Important:** When `metrics.enabled: true`, your app **must** expose a `/metrics` endpoint returning Prometheus text format with the required metrics (`http_requests_total`, `http_request_duration_seconds`, etc.). Without instrumentation, the Grafana "PR Developer Insights" dashboard will show misleading DOWN/NO indicators. See the [Metrics Instrumentation Guide](./k8s-ee-config-reference.md#metrics-instrumentation-guide) for required metric names and example code.

---

## ECR Registry Setup (Private Repos)

For private repositories that cannot use GHCR, the platform supports AWS ECR as an alternative container registry using OIDC (OpenID Connect) for keyless authentication.

### 1. Configure Repository Variables

Set these as **repository variables** (Settings → Secrets and variables → Actions → Variables):

| Variable | Description | Example |
|----------|-------------|---------|
| `REGISTRY_TYPE` | Must be `ecr` | `ecr` |
| `ECR_REGION` | AWS region for ECR | `us-east-2` |
| `ECR_ROLE_TO_ASSUME` | IAM role ARN for OIDC auth | `arn:aws:iam::123456789012:role/github-actions-ecr` |

The IAM role must have a trust policy that allows GitHub Actions OIDC for your repository. See [AWS docs on configuring OIDC](https://docs.github.com/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services).

### 2. Add Workflow Inputs

Add `registry-type`, `ecr-region`, and `ecr-role-to-assume` to your calling workflow. The caller **must** include `id-token: write` in its `permissions:` block for OIDC authentication:

```yaml
permissions:
  contents: read
  packages: write
  pull-requests: write
  security-events: write
  id-token: write    # Required for OIDC authentication with AWS ECR

jobs:
  pr-environment:
    uses: your-org/k8s-ephemeral-environments/.github/workflows/pr-environment-reusable.yml@main
    with:
      # ... standard inputs ...
      registry-type: 'ecr'
      ecr-region: 'us-east-2'   # Your AWS region
      ecr-role-to-assume: 'arn:aws:iam::123456789012:role/github-actions-ecr'  # Your IAM role
    secrets: inherit             # Passes GITHUB_TOKEN
```

### 3. How It Works

- The `build-image` action automatically creates the ECR repository on first push
- Images are pushed to `<account-id>.dkr.ecr.<region>.amazonaws.com/<org>/<repo>/<project-id>`
- The `deploy-app` action creates a Kubernetes `ecr-pull-secret` for authenticated image pulls
- Untagged images are automatically expired after 7 days via ECR lifecycle policy

No GHCR package visibility settings or long-lived access keys are needed — ECR authentication uses short-lived OIDC tokens.

### Migrating from Access Keys to OIDC

If your repository was previously using ECR with org secrets (`ECR_AWS_ACCESS_KEY_ID`/`ECR_AWS_SECRET_ACCESS_KEY`), update your caller workflow:

1. **Add `id-token: write`** to the `permissions:` block (required for all callers, even GHCR-only)
2. **Add `ecr-role-to-assume`** to the `with:` block:
   ```yaml
   ecr-role-to-assume: ${{ vars.ECR_ROLE_TO_ASSUME || '' }}
   ```
3. **Set the `ECR_ROLE_TO_ASSUME` repository variable** with your IAM role ARN
4. **Remove `ECR_AWS_ACCESS_KEY_ID`/`ECR_AWS_SECRET_ACCESS_KEY` org secrets** (after verifying OIDC works)

> **Important:** The `ecr-role-to-assume` input must be explicitly passed in your caller workflow's `with:` block. The reusable workflow defaults to an empty string, so omitting it will cause the build to fail with a validation error.

---

## See Also

- [Configuration Reference](./k8s-ee-config-reference.md) - All configuration options
- [Service Development Guide](./service-development.md) - Best practices for database/storage services
- [Migration Guide](./migration-guide.md) - Migrate from manual workflow setup
- [Troubleshooting Guide](./troubleshooting.md) - Detailed problem resolution
