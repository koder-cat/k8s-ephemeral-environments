# Migration Guide: From Manual to Reusable Workflow

This guide helps you migrate from a manual PR environment workflow to the simplified reusable workflow.

## What's Changing

| Before | After |
|--------|-------|
| 500-800 line workflow | ~15 line workflow |
| Copy K8s templates to repo | Templates handled by platform |
| Custom Helm chart | Generic k8s-ee-app chart |
| Manual envsubst configuration | k8s-ee.yaml configuration |
| Copy composite actions | Use platform actions directly |

## Migration Steps

### 1. Create k8s-ee.yaml

Map your existing workflow `env` variables to `k8s-ee.yaml`:

**Before (workflow env vars):**
```yaml
env:
  PROJECT_ID: "myapp"
  PREVIEW_DOMAIN: "k8s-ee.genesluna.dev"
```

**After (k8s-ee.yaml):**
```yaml
projectId: myapp

app:
  port: 3000
  healthPath: /health

databases:
  postgresql: true
```

### 2. Map Helm Values

If you customized your Helm chart's `values.yaml`:

| Old Value | New k8s-ee.yaml Field |
|-----------|----------------------|
| `app.port` | `app.port` |
| `livenessProbe.httpGet.path` | `app.healthPath` |
| `postgresql.enabled` | `databases.postgresql` |
| `resources.requests.cpu` | `resources.requests.cpu` |
| `resources.limits.memory` | `resources.limits.memory` |
| Environment variables | `env.VAR_NAME` |

**Example conversion:**

```yaml
# Old values.yaml
app:
  port: 8080
livenessProbe:
  httpGet:
    path: /api/health
resources:
  requests:
    cpu: 100m
    memory: 256Mi
postgresql:
  enabled: true
```

```yaml
# New k8s-ee.yaml
projectId: myapp

app:
  port: 8080
  healthPath: /api/health

resources:
  requests:
    cpu: 100m
    memory: 256Mi

databases:
  postgresql: true
```

### 3. Replace Workflow

Replace your `.github/workflows/pr-environment.yml`:

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

### 4. Clean Up (Optional)

After successful migration, you can remove:

| Directory/File | Reason |
|----------------|--------|
| `k8s/ephemeral/` | Templates now in platform |
| `charts/your-app/` | Uses generic k8s-ee-app chart |
| `.github/actions/setup-tools/` | Uses platform composite actions |

**Keep** your `Dockerfile` - it's still required.

### 5. Test the Migration

1. Create a test branch and PR
2. Verify workflow runs successfully
3. Check preview URL works
4. Test health endpoint responds
5. Close PR and verify cleanup

## Keeping Custom Behavior

If you need customization beyond what k8s-ee.yaml provides:

### Custom Environment Variables

```yaml
# k8s-ee.yaml
env:
  API_KEY: "my-value"
  DEBUG: "true"
```

### Custom Resources

```yaml
# k8s-ee.yaml
resources:
  requests:
    cpu: 100m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 512Mi
```

### From Secrets/ConfigMaps

```yaml
# k8s-ee.yaml
envFrom:
  - secretRef:
      name: my-secret
  - configMapRef:
      name: my-config
```

## Rollback

If issues arise, restore your original workflow file. The reusable workflow doesn't modify your repository's structure.

```bash
# Restore original workflow
# First, find the commit before migration:
git log --oneline .github/workflows/pr-environment.yml

# Then restore from that commit:
git checkout COMMIT_HASH -- .github/workflows/pr-environment.yml
git commit -m "Revert to manual workflow"
```

## Support

- [Configuration Reference](./k8s-ee-config-reference.md) - All available options
- [Troubleshooting Guide](./troubleshooting.md) - Common issues and solutions
- [Onboarding Guide](./onboarding-new-repo.md) - Fresh setup instructions
