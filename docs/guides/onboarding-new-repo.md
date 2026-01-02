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

### 3. Organization Package Settings

Your organization must allow public container packages.

| Setting | Location | Value |
|---------|----------|-------|
| **Package visibility** | `https://github.com/organizations/{your-org}/settings/packages` | Enable "Allow members to change container package visibility to public" |

Without this setting, deployments fail with `403 Forbidden` when pulling images.

### 4. Runner Group Settings (Public Repos)

If using public repositories, the runner group must allow them.

| Setting | Location | Value |
|---------|----------|-------|
| **Allow public repos** | `https://github.com/organizations/{your-org}/settings/actions/runner-groups` | Enable "Allow public repositories" on the Default group |

### 5. Repository Visibility

> **Important:** Currently, only **public repositories** are supported. Private repositories are not supported because container images are made public for Kubernetes to pull without authentication.

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
| `GITHUB_TOKEN` | Build/push images, post PR comments | Automatic (workflow) | GitHub Actions |
| `github-app-secret` | ARC runner authentication | Kubernetes cluster | Platform admin |

**No additional secrets are required from onboarding organizations.** The `secrets: inherit` in the workflow file passes the automatic `GITHUB_TOKEN` to the reusable workflow.

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

### Step 2: Add Workflow File

Create `.github/workflows/pr-environment.yml`:

```yaml
name: PR Environment

on:
  pull_request:
    types: [opened, reopened, synchronize, closed]

concurrency:
  group: pr-env-${{ github.event.pull_request.number }}
  cancel-in-progress: false

permissions:
  contents: read
  packages: write
  pull-requests: write
  security-events: write

jobs:
  pr-environment:
    uses: koder-cat/k8s-ephemeral-environments/.github/workflows/pr-environment-reusable.yml@main
    with:
      pr-number: ${{ github.event.pull_request.number }}
      pr-action: ${{ github.event.action }}
      head-sha: ${{ github.event.pull_request.head.sha }}
      head-ref: ${{ github.head_ref }}
      repository: ${{ github.repository }}
    secrets: inherit
```

### Step 3: Have a Dockerfile

Your repository needs a Dockerfile at the root (or configured path). The platform builds ARM64 images automatically.

**That's it!** Open a PR and get a preview URL within minutes.

---

## What Happens When You Open a PR

1. Configuration validated against schema
2. Namespace created: `{projectId}-pr-{number}`
3. ARM64 image built and pushed to GHCR
4. Application deployed with Helm
5. Preview URL posted as PR comment: `https://{projectId}-pr-{number}.k8s-ee.genesluna.dev`
6. On PR close: namespace automatically destroyed

---

## Requirements

| Requirement | Description |
|-------------|-------------|
| **Public repository** | Private repositories are not currently supported |
| **Dockerfile** | Build your application as a container |
| **Health endpoint** | Returns 200 for Kubernetes probes (default: `/health`) |
| **Package permissions** | GHCR write access (automatic for same org) |
| **ARM64 compatible** | Base images must support `linux/arm64` |

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

## Optional Workflow Inputs

Customize the reusable workflow with additional inputs:

```yaml
with:
  pr-number: ${{ github.event.pull_request.number }}
  pr-action: ${{ github.event.action }}
  head-sha: ${{ github.event.pull_request.head.sha }}
  head-ref: ${{ github.head_ref }}
  repository: ${{ github.repository }}
  config-path: 'k8s-ee.yaml'              # Path to config file
  preview-domain: 'k8s-ee.genesluna.dev'  # Base domain for URLs
  chart-version: '1.1.0'                  # k8s-ee-app chart version
```

### Version Pinning

For production stability, pin to a specific version:

```yaml
# Pin to a release tag (when available)
uses: koder-cat/k8s-ephemeral-environments/.github/workflows/pr-environment-reusable.yml@v1

# Pin to a specific commit SHA (available now)
uses: koder-cat/k8s-ephemeral-environments/.github/workflows/pr-environment-reusable.yml@79d3549
```

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

### Image pull failed (403 Forbidden)

Container images are automatically set to public by the build step. If you see 403 errors:

1. **Check org setting:** Go to `https://github.com/organizations/{org}/settings/packages`
2. **Enable:** "Allow members to change container package visibility to public"
3. **Re-run the workflow** to make the package public

**First-time deployment:** The first PR for a new repository creates a new GHCR package. If the org setting wasn't enabled before the first build, you may need to manually make the package public:
1. Go to `https://github.com/orgs/{org}/packages/container/package/{repo}%2F{app}`
2. Click "Package settings" → "Change package visibility" → "Public"

### Deployment failed

- Check pod logs: `kubectl logs -n {namespace} -l k8s-ee/project-id={projectId}`
- Verify health endpoint returns 200
- Check resource limits fit within quota

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

---

## See Also

- [Configuration Reference](./k8s-ee-config-reference.md) - All configuration options
- [Service Development Guide](./service-development.md) - Best practices for database/storage services
- [Migration Guide](./migration-guide.md) - Migrate from manual workflow setup
- [Troubleshooting Guide](./troubleshooting.md) - Detailed problem resolution
