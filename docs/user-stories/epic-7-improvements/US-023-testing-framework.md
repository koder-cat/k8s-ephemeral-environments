# US-023: Testing Framework Setup

**Status:** Done

## User Story

**As a** developer,
**I want** automated tests for the demo-app,
**So that** broken code doesn't reach PR environments.

## Acceptance Criteria

- [x] Vitest configured for API and Web apps
- [x] Unit test examples created
- [x] Linting runs in CI before build
- [x] Helm chart validation runs before deploy
- [x] Duplicate cleanup script issue resolved
- [x] CI validates script sync

## Priority

**Must** - Critical for MVP

## Story Points

8

## Dependencies

- None (standalone improvement)

## Notes

- Currently there are ZERO automated tests
- Demo-app has no test framework configured
- Cleanup script is duplicated in two locations:
  - `scripts/cleanup-orphaned-namespaces.py`
  - `k8s/platform/cleanup-job/cleanup-configmap.yaml` (embedded 367 lines)
- No linting or Helm chart validation in CI

## Implementation

- **Demo App Testing:**
  - Add Vitest to `demo-app/apps/api/package.json`
  - Add Vitest to `demo-app/apps/web/package.json`
  - Create `vitest.config.ts` for both apps
  - Create example unit tests in `demo-app/apps/api/src/**/*.spec.ts`

- **CI Improvements:**
  - Add linting step to `.github/workflows/pr-environment.yml`
  - Add `helm lint` step before deployment
  - Create `.github/workflows/validate-scripts.yml` for script sync validation

- **Script Deduplication:**
  - Update `k8s/platform/cleanup-job/cleanup-configmap.yaml` to use single source
