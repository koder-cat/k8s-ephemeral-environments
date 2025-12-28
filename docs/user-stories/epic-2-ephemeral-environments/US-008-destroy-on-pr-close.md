# US-008: Destroy Environment on PR Close/Merge

**Status:** Done

## User Story

**As an** SRE/DevOps engineer,
**I want** PR environments destroyed automatically when PRs are closed or merged,
**So that** cluster resources are freed and costs are controlled.

## Acceptance Criteria

- [x] GitHub Actions workflow triggers on `pull_request: closed` event
- [x] Namespace and all resources deleted
- [x] Persistent volumes (PVCs) deleted (via namespace deletion)
- [x] Cleanup completes in < 5 minutes
- [x] No orphaned resources remain
- [ ] PR comment updated to indicate environment destroyed (future: US-007)

## Priority

**Must** - Critical for MVP

## Story Points

5

## Dependencies

- US-004: Create Namespace on PR Open

## Implementation Notes

- Implemented in `.github/workflows/pr-environment.yml` (same workflow as US-004)
- Uses `kubectl delete namespace --wait=true --timeout=5m`
- Deleting the namespace cascades to all resources within it
- Workflow summary shows cleanup status
