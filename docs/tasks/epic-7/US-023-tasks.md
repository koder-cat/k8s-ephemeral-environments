# Tasks for US-023: Testing Framework Setup

**Status:** Done

## Tasks

### T-023.1: Add Vitest to Demo App Packages
- **Description:** Configure Vitest testing framework for API and Web apps
- **Acceptance Criteria:**
  - Vitest added to `demo-app/apps/api/package.json`
  - Vitest added to `demo-app/apps/web/package.json`
  - `vitest.config.ts` created for both apps
  - Test script added to package.json
  - Root workspace test command works
- **Estimate:** M
- **Files:**
  - `demo-app/apps/api/package.json`
  - `demo-app/apps/web/package.json`
  - `demo-app/apps/api/vitest.config.ts`
  - `demo-app/apps/web/vitest.config.ts`

### T-023.2: Create Unit Test Examples
- **Description:** Write example unit tests as reference patterns
- **Acceptance Criteria:**
  - API service tests created
  - Controller tests created
  - Test coverage > 50% for demo purposes
  - Tests pass locally and in CI
- **Estimate:** M
- **Files:** `demo-app/apps/api/src/**/*.spec.ts`

### T-023.3: Add Linting Step to CI
- **Description:** Add code linting before build in workflow
- **Acceptance Criteria:**
  - ESLint runs before build step
  - Build fails on lint errors
  - Lint warnings logged but don't fail build
- **Estimate:** S
- **Files:** `.github/workflows/pr-environment.yml`

### T-023.4: Add Helm Lint Step to CI
- **Description:** Validate Helm charts before deployment
- **Acceptance Criteria:**
  - `helm lint` runs before deployment
  - Chart validation errors fail the build
  - All charts in `charts/` directory validated
- **Estimate:** XS
- **Files:** `.github/workflows/pr-environment.yml`

### T-023.5: Fix Duplicate Cleanup Script
- **Description:** Resolve script duplication between files
- **Acceptance Criteria:**
  - Single source of truth for cleanup script
  - ConfigMap references external script OR embeds via build
  - Documentation updated
  - No manual sync required
- **Estimate:** M
- **Files:**
  - `scripts/cleanup-orphaned-namespaces.py`
  - `k8s/platform/cleanup-job/cleanup-configmap.yaml`

### T-023.6: Add Script Sync Validation
- **Description:** CI workflow to validate script consistency
- **Acceptance Criteria:**
  - Workflow validates scripts match if duplicated
  - Runs on push to main and PRs
  - Clear error message on mismatch
- **Estimate:** S
- **Files:** `.github/workflows/validate-scripts.yml`

---

## Estimate Legend
- **XS:** < 1 hour
- **S:** 1-4 hours
- **M:** 4-8 hours (1 day)
- **L:** 2-3 days
- **XL:** 4-5 days
