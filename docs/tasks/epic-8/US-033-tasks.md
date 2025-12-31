# Tasks for US-033: Update Documentation and Dogfood

**Status:** Done

## Tasks

### T-033.1: Create k8s-ee.yaml for This Repo
- **Description:** Add k8s-ee.yaml config to dogfood the system
- **Acceptance Criteria:**
  - Config file at repository root
  - projectId: k8s-ee
  - PostgreSQL enabled
  - Health endpoint configured
  - Metrics endpoint configured
- **Estimate:** XS
- **Files:** `k8s-ee.yaml`

### T-033.2: Update PR Environment Workflow
- **Description:** Update workflow to use reusable workflow
- **Acceptance Criteria:**
  - Existing workflow calls reusable workflow
  - Or replace with minimal boilerplate
  - Keep original as reference (optional)
  - Verify deployment works
- **Estimate:** S
- **Files:** `.github/workflows/pr-environment.yml`

### T-033.3: Update Onboarding Guide
- **Description:** Simplify onboarding-new-repo.md for new process
- **Acceptance Criteria:**
  - Step 1: Create k8s-ee.yaml
  - Step 2: Copy boilerplate workflow
  - Step 3: Have Dockerfile
  - Remove sections about copying charts/templates
  - Add troubleshooting section
- **Estimate:** M
- **Files:** `docs/guides/onboarding-new-repo.md`

### T-033.4: Create Config Reference Guide
- **Description:** Create comprehensive config reference documentation
- **Acceptance Criteria:**
  - All config fields documented
  - Type, default, and description for each
  - Minimal config example
  - Common scenario examples
  - Advanced configuration examples
- **Estimate:** M
- **Files:** `docs/guides/k8s-ee-config-reference.md`

### T-033.5: Update Main README
- **Description:** Update README with new onboarding process
- **Acceptance Criteria:**
  - Quick start section updated
  - Link to onboarding guide
  - Example k8s-ee.yaml shown
  - Benefits of simplified onboarding highlighted
- **Estimate:** S
- **Files:** `README.md`

### T-033.6: End-to-End Testing
- **Description:** Test full onboarding flow with real PR
- **Acceptance Criteria:**
  - Create test PR using new system
  - Verify namespace creation
  - Verify deployment success
  - Verify PR comment posted
  - Verify cleanup on PR close
- **Estimate:** M
- **Files:** None (verification)

---

## Estimate Legend
- **XS:** < 1 hour
- **S:** 1-4 hours
- **M:** 4-8 hours (1 day)
- **L:** 2-3 days
- **XL:** 4-5 days
