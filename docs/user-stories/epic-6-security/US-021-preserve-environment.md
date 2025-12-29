# US-021: Preserve Environment Feature

**Status:** Done

## User Story

**As a** developer,
**I want** to mark my PR environment to be preserved for extended testing,
**So that** the environment isn't destroyed immediately when I close the PR.

## Acceptance Criteria

- [x] Adding label `preserve=true` to PR prevents cleanup
- [x] Maximum preserve time: 48 hours
- [x] CronJob removes "preserve" label after 48 hours
- [x] Maximum 3 preserved environments at a time
- [x] Warning comment added to PR when preserve expires

## Priority

**Could** - Nice to have

## Story Points

5

## Dependencies

- US-008: Destroy Environment on PR Close/Merge
- US-020: Implement Cleanup Job for Orphaned Resources

## Notes

- Prevents accidental resource exhaustion
- Useful for extended QA testing
- `/preserve` command can be used to extend preservation

## Implementation

- **Preserve Workflow:** `.github/workflows/preserve-environment.yml`
  - Triggered by `/preserve` PR comment
  - Adds `preserve=true` label to namespace
  - Adds `k8s-ee/preserve-until` annotation (48h from now)
  - Enforces max 3 preserved environments quota

- **Expiry CronJob:** `k8s/platform/preserve-expiry/`
  - Runs hourly to check for expired preservations
  - Posts warning comment 1 hour before expiry
  - Removes preserve label when expired
  - Cleanup job (US-020) handles actual deletion

- **Alerts:** `k8s/platform/alerts/preserve-alerts.yaml`
  - `PreserveExpiryJobFailed` - Job failures
  - `PreserveExpiryJobNotRunning` - Job not running
  - `TooManyPreservedEnvironments` - Quota exceeded

- **Documentation:**
  - `k8s/platform/preserve-expiry/README.md` - Installation and usage
  - `docs/runbooks/preserve-environment.md` - Operational runbook
