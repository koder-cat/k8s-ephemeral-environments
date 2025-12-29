# Tasks for US-008: Destroy Environment on PR Close/Merge

## Tasks

### T-008.1: Create Cleanup Workflow
- **Description:** Create workflow for PR close/merge events
- **Acceptance Criteria:**
  - Workflow triggers on `pull_request: closed`
  - Handles both merge and close without merge
  - Has proper permissions for kubectl
- **Estimate:** S

### T-008.2: Implement Namespace Deletion
- **Description:** Add step to delete the PR namespace
- **Acceptance Criteria:**
  - `kubectl delete namespace {project-id}-pr-{number}`
  - Uses `--wait` to ensure completion
  - Timeout configured (5 minutes)
  - Handles "not found" gracefully
- **Estimate:** S

### T-008.3: Verify PVC Cleanup
- **Description:** Ensure persistent volumes are deleted
- **Acceptance Criteria:**
  - PVCs deleted with namespace
  - PVs released (reclaim policy: Delete)
  - No orphaned storage
- **Estimate:** S

### T-008.4: Update PR Comment on Cleanup
- **Description:** Update the PR comment to show environment destroyed
- **Acceptance Criteria:**
  - Comment updated with "Environment destroyed" status
  - Timestamp of destruction included
  - Links removed or marked as inactive
- **Estimate:** S

### T-008.5: Add Cleanup Verification
- **Description:** Verify no resources remain after cleanup
- **Acceptance Criteria:**
  - Check namespace doesn't exist
  - Check no pods with PR labels remain
  - Log verification results
- **Estimate:** S

### T-008.6: Test Cleanup Scenarios
- **Description:** Test cleanup in different scenarios
- **Acceptance Criteria:**
  - PR merged: cleanup runs
  - PR closed without merge: cleanup runs
  - PR with stuck pods: cleanup still completes
  - Cleanup completes in < 5 minutes
- **Estimate:** M

---

## Estimate Legend
- **XS:** < 1 hour
- **S:** 1-4 hours
- **M:** 4-8 hours (1 day)
- **L:** 2-3 days
- **XL:** 4-5 days
