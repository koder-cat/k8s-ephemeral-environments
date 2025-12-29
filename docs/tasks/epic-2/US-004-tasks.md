# Tasks for US-004: Create Namespace on PR Open

## Tasks

### T-004.1: Create GitHub Actions Workflow File
- **Description:** Create the base workflow file for PR open events
- **Acceptance Criteria:**
  - Workflow file created at `.github/workflows/pr-environment.yml`
  - Triggers on `pull_request: [opened, reopened, synchronize]`
  - Has proper permissions and concurrency settings
- **Estimate:** S

### T-004.2: Create Namespace Manifest Template
- **Description:** Create Kubernetes manifest for namespace with labels
- **Acceptance Criteria:**
  - Namespace manifest with templated name `{project-id}-pr-{number}`
  - Labels: pr-number, branch-name, commit-sha, created-at
  - Annotations for cleanup tracking
- **Estimate:** S

### T-004.3: Create ResourceQuota Manifest
- **Description:** Define resource limits for PR namespaces
- **Acceptance Criteria:**
  - ResourceQuota: CPU ≤ 1 core, RAM ≤ 2Gi, Storage ≤ 5Gi
  - Limits on number of pods, services, configmaps
  - Manifest templated for namespace name
- **Estimate:** S

### T-004.4: Create LimitRange Manifest
- **Description:** Define default container limits
- **Acceptance Criteria:**
  - Default CPU request/limit defined
  - Default memory request/limit defined
  - Prevents containers without limits
- **Estimate:** S

### T-004.5: Implement Namespace Creation Step
- **Description:** Add workflow step to create namespace and apply resources
- **Acceptance Criteria:**
  - kubectl apply creates namespace
  - ResourceQuota applied
  - LimitRange applied
  - Step is idempotent (can re-run safely)
- **Estimate:** M

### T-004.6: Test Workflow End-to-End
- **Description:** Verify workflow creates namespace correctly
- **Acceptance Criteria:**
  - Open test PR
  - Namespace created with correct name
  - Labels and quotas applied
  - Workflow completes in < 2 minutes
- **Estimate:** S

---

## Estimate Legend
- **XS:** < 1 hour
- **S:** 1-4 hours
- **M:** 4-8 hours (1 day)
- **L:** 2-3 days
- **XL:** 4-5 days
