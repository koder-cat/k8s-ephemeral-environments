# US-016: Configure Runner Deployment

**Status:** Done

## User Story

**As a** developer,
**I want** GitHub Actions to run on self-hosted runners in the cluster,
**So that** my CI/CD jobs have kubectl access and run faster.

## Acceptance Criteria

- [x] Runner scale set created for target repository
- [x] Runners can install kubectl via workflow steps
- [x] Runners can execute jobs from GitHub Actions
- [x] Runner pods scale based on job queue (min 0, max 3)
- [x] Ephemeral runners (one job per pod)

## Priority

**Should** - Important but not blocking

## Story Points

5

## Dependencies

- US-015: Deploy Actions Runner Controller (ARC)

## Implementation Notes

- Implemented as part of US-004
- Scale set name: `arc-runner-set`
- Min runners: 0 (scale to zero when idle)
- Max runners: 3
- kubectl installed via workflow step (ARM64 binary)
- Config: `k8s/arc/values-runner-set.yaml`
