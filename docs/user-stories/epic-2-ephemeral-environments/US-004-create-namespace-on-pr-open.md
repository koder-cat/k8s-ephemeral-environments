# US-004: Create Namespace on PR Open

**Status:** Done

## User Story

**As a** developer,
**I want** a Kubernetes namespace to be created automatically when I open a PR,
**So that** my changes are deployed to an isolated environment.

## Acceptance Criteria

- [x] GitHub Actions workflow triggers on `pull_request: opened` event
- [x] Namespace created with naming convention: `{project-id}-pr-{number}` (e.g., `k8s-ee-pr-28`)
- [x] Namespace has standard labels (pr-number, branch, commit-sha)
- [x] ResourceQuota and LimitRange applied to namespace
- [x] Workflow completes in < 2 minutes

## Priority

**Must** - Critical for MVP

## Story Points

5

## Dependencies

- US-002: Install and Configure k3s Cluster

## Implementation Notes

- Uses Actions Runner Controller (ARC) with GitHub App authentication
- Runners run inside the cluster with ServiceAccount for kubectl access
- Namespace is idempotent (re-running updates labels/annotations)
- Uses envsubst for manifest templating
- See `k8s/arc/README.md` for ARC setup instructions
- See `docs/runbooks/arc-operations.md` for operations guide
