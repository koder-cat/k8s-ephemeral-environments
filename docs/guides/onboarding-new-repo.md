# Onboarding a New Repository

Add ephemeral PR environments to any repository in 3 simple steps.

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
  postgresql: true    # Simple enable
  # Or with bootstrap SQL:
  # postgresql:
  #   enabled: true
  #   bootstrap:
  #     postInitApplicationSQL:
  #       - |
  #         CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255));
  #         GRANT ALL PRIVILEGES ON users TO app;
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
    uses: genesluna/k8s-ephemeral-environments/.github/workflows/pr-environment-reusable.yml@main
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
| **Dockerfile** | Build your application as a container |
| **Health endpoint** | Returns 200 for Kubernetes probes (default: `/health`) |
| **Package permissions** | GHCR write access (automatic for same org) |
| **ARM64 compatible** | Base images must support `linux/arm64` |

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
  chart-version: '1.0.0'                  # k8s-ee-app chart version
```

### Version Pinning

For production stability, pin to a specific version:

```yaml
# Pin to a release tag (when available)
uses: genesluna/k8s-ephemeral-environments/.github/workflows/pr-environment-reusable.yml@v1

# Pin to a specific commit SHA (available now)
uses: genesluna/k8s-ephemeral-environments/.github/workflows/pr-environment-reusable.yml@79d3549
```

---

## Resource Limits

Each PR namespace has these limits:

| Resource | Limit |
|----------|-------|
| CPU | 1 core |
| Memory | 2Gi |
| Storage | 5Gi |
| Pods | 10 |

Individual containers: max 512Mi memory, 500m CPU.

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

### PR comment not appearing

- Verify `secrets: inherit` is set in workflow
- Check repository has Actions permissions

---

## See Also

- [Configuration Reference](./k8s-ee-config-reference.md) - All configuration options
- [Migration Guide](./migration-guide.md) - Migrate from manual workflow setup
- [Troubleshooting Guide](./troubleshooting.md) - Detailed problem resolution
