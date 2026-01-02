# US-031: Create Reusable Workflow

**Status:** Done

## User Story

**As a** platform user,
**I want** a reusable workflow I can call from my repository,
**So that** I only need a minimal boilerplate workflow file.

## Acceptance Criteria

- [x] Reusable workflow created with `workflow_call` trigger
- [x] Workflow accepts PR metadata as inputs (number, action, sha, ref, repo)
- [x] Config file path is configurable (defaults to `k8s-ee.yaml`)
- [x] Workflow orchestrates all composite actions in correct order
- [x] Jobs run conditionally based on PR action (deploy vs destroy)
- [x] Secrets passed via `secrets: inherit`
- [x] Concurrency control prevents race conditions
- [x] Client workflow file is ~10 lines of copy-paste boilerplate

## Priority

**Must** - Required for simplified onboarding

## Story Points

8

## Dependencies

- US-030: Create Reusable Composite Actions

## Notes

- Client repos call workflow via `uses: koder-cat/k8s-ephemeral-environments/.github/workflows/pr-environment-reusable.yml@v1`
- Version pinning supported (@v1, @main, @sha)
- Job outputs passed between jobs for orchestration
- Health checks run after deployment

## Implementation

### Reusable Workflow

The reusable workflow is at `.github/workflows/pr-environment-reusable.yml` and orchestrates the 7 composite actions from US-030.

#### Workflow Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `pr-number` | Yes | - | Pull request number |
| `pr-action` | Yes | - | PR event action (opened, reopened, synchronize, closed) |
| `head-sha` | Yes | - | Full commit SHA (40 characters) |
| `head-ref` | Yes | - | Branch name |
| `repository` | Yes | - | GitHub repository (owner/repo) |
| `config-path` | No | `k8s-ee.yaml` | Path to configuration file |
| `preview-domain` | No | `k8s-ee.genesluna.dev` | Base domain for preview URLs |
| `kubectl-version` | No | `v1.31.0` | kubectl version |
| `helm-version` | No | `v3.16.0` | Helm version |
| `k8s-api-ip` | No | `10.0.0.39` | Kubernetes API server IP |
| `chart-version` | No | `1.0.0` | k8s-ee-app chart version |

#### Job Flow

```
Deploy Path (pr-action != 'closed'):
  validate-config ──┬──> create-namespace ──┐
                    │                       │
                    └──> build-image ───────┴──> deploy-app ──> pr-comment-deploy

Destroy Path (pr-action == 'closed'):
  validate-config ──> destroy-namespace ──> pr-comment-destroy
```

#### Jobs

| Job | Runner | Condition | Purpose |
|-----|--------|-----------|---------|
| `validate-config` | ubuntu-latest | Always | Parse k8s-ee.yaml, validate config |
| `create-namespace` | arc-runner-set | PR not closed | Create namespace with quotas and policies |
| `build-image` | ubuntu-latest | PR not closed | Build ARM64 image, push to GHCR, Trivy scan |
| `deploy-app` | arc-runner-set | PR not closed | Deploy with Helm, health check |
| `pr-comment-deploy` | ubuntu-latest | After deploy | Post success/failure comment |
| `destroy-namespace` | arc-runner-set | PR closed | Delete namespace (unless preserved) |
| `pr-comment-destroy` | ubuntu-latest | After destroy | Post destroyed/preserved comment |

### Client Workflow Template

Add this file to your repository as `.github/workflows/pr-environment.yml`:

```yaml
name: PR Environment

on:
  pull_request:
    types: [opened, reopened, synchronize, closed]

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

#### With Custom Options

```yaml
name: PR Environment

on:
  pull_request:
    types: [opened, reopened, synchronize, closed]

jobs:
  pr-environment:
    uses: koder-cat/k8s-ephemeral-environments/.github/workflows/pr-environment-reusable.yml@main
    with:
      pr-number: ${{ github.event.pull_request.number }}
      pr-action: ${{ github.event.action }}
      head-sha: ${{ github.event.pull_request.head.sha }}
      head-ref: ${{ github.head_ref }}
      repository: ${{ github.repository }}
      config-path: 'k8s-ee.yaml'      # Custom config path
      preview-domain: 'preview.example.com'  # Custom domain
      chart-version: '1.0.0'          # Pin chart version
    secrets: inherit
```

### Version Pinning

For production use, pin to a specific version or commit:

```yaml
# Pin to a release tag
uses: koder-cat/k8s-ephemeral-environments/.github/workflows/pr-environment-reusable.yml@v1

# Pin to a specific commit
uses: koder-cat/k8s-ephemeral-environments/.github/workflows/pr-environment-reusable.yml@abc1234

# Use latest main (for development)
uses: koder-cat/k8s-ephemeral-environments/.github/workflows/pr-environment-reusable.yml@main
```

### Required Secrets

The workflow uses `secrets: inherit` to pass secrets from the calling workflow. Required secrets:

| Secret | Purpose |
|--------|---------|
| `GITHUB_TOKEN` | Automatically provided by GitHub Actions for GHCR push and PR comments |

### Permissions

The calling workflow inherits permissions from the reusable workflow. Each job declares minimal required permissions:

- `contents: read` - Checkout repositories
- `packages: write` - Push images to GHCR
- `security-events: write` - Upload Trivy SARIF results
- `pull-requests: write` - Post PR comments
