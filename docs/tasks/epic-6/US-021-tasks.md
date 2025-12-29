# Tasks for US-021: Preserve Environment Feature

**Status:** All tasks complete

## Tasks

### T-021.1: Modify Cleanup Workflow ✅
- **Description:** Update cleanup to check for preserve label
- **Acceptance Criteria:**
  - Check namespace for `preserve=true` label
  - Skip cleanup if label present
  - Log that cleanup was skipped
- **Estimate:** S
- **Implementation:** Done in US-020 (cleanup job respects preserve=true label)

### T-021.2: Implement Preserve Label Application ✅
- **Description:** Allow setting preserve label via PR comment
- **Acceptance Criteria:**
  - Comment `/preserve` adds label to namespace
  - Label applied with timestamp annotation
  - Confirmation comment posted
- **Estimate:** M
- **Implementation:** `.github/workflows/preserve-environment.yml`

### T-021.3: Create Preserve Expiry Job ✅
- **Description:** CronJob to remove expired preserve labels
- **Acceptance Criteria:**
  - Runs hourly
  - Checks preserve timestamp
  - Removes label after 48 hours
  - Triggers cleanup for expired namespaces
- **Estimate:** M
- **Implementation:** `k8s/platform/preserve-expiry/preserve-expiry-cronjob.yaml`

### T-021.4: Implement Preserve Quota ✅
- **Description:** Limit number of preserved environments
- **Acceptance Criteria:**
  - Maximum 3 preserved at a time
  - Reject preserve request if quota reached
  - Clear error message to user
- **Estimate:** S
- **Implementation:** Quota check in preserve workflow

### T-021.5: Add Preserve Warning Comment ✅
- **Description:** Notify user when preserve expires
- **Acceptance Criteria:**
  - Comment posted 1 hour before expiry
  - Comment posted when preserve removed
  - Instructions for extending included
- **Estimate:** S
- **Implementation:** Warning logic in expiry script

### T-021.6: Document Preserve Feature ✅
- **Description:** Create user documentation
- **Acceptance Criteria:**
  - How to preserve documented
  - Limits documented
  - Examples provided
- **Estimate:** S
- **Implementation:**
  - `k8s/platform/preserve-expiry/README.md`
  - `docs/runbooks/preserve-environment.md`

---

## Additional Implementation Notes

- Preserve workflow triggered by `issue_comment` event on `/preserve` command
- Expiry job reuses `cleanup-job-sa` ServiceAccount and `github-cleanup-token` Secret
- Uses `bitnami/kubectl:latest` for ARM64 compatibility
- PrometheusRule alerts in `k8s/platform/alerts/preserve-alerts.yaml`

---

## Estimate Legend
- **XS:** < 1 hour
- **S:** 1-4 hours
- **M:** 4-8 hours (1 day)
- **L:** 2-3 days
- **XL:** 4-5 days
