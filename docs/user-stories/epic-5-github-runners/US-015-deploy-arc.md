# US-015: Deploy Actions Runner Controller (ARC)

**Status:** Done

## User Story

**As an** SRE/DevOps engineer,
**I want** GitHub Actions runners running inside the Kubernetes cluster,
**So that** CI/CD jobs have direct access to the cluster and run faster.

## Acceptance Criteria

- [x] ARC (Actions Runner Controller) deployed in `arc-systems` namespace
- [x] Controller registered with GitHub repository via GitHub App
- [x] Runner pods can be scheduled on the cluster
- [x] Runners appear in GitHub Actions settings
- [x] Controller survives cluster restarts

## Priority

**Should** - Important but not blocking

## Story Points

5

## Dependencies

- US-002: Install and Configure k3s Cluster

## Implementation Notes

- Implemented as part of US-004 (required for PR environment workflow)
- Uses GitHub App authentication (more secure than PAT)
- Controller: `arc-systems` namespace
- Runners: `arc-runners` namespace
- Ephemeral runners (scale to zero when idle)
- See `k8s/arc/README.md` for setup instructions
- See `docs/runbooks/arc-operations.md` for operations guide
