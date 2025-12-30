# Tasks for US-015: Deploy Actions Runner Controller (ARC)

## Tasks

### T-015.1: Create ARC Namespaces
- **Description:** Create dedicated namespaces for ARC controller and runners
- **Acceptance Criteria:**
  - Namespace `arc-systems` created for controller
  - Namespace `arc-runners` created for runner pods
  - Labels applied
  - ResourceQuota defined
- **Estimate:** XS

### T-015.2: Create GitHub App for Authentication
- **Description:** Set up GitHub App for ARC authentication
- **Acceptance Criteria:**
  - GitHub App created with required permissions
  - App installed on organization/repository
  - Private key generated and stored securely
- **Estimate:** M

### T-015.3: Install ARC via Helm
- **Description:** Deploy Actions Runner Controller
- **Acceptance Criteria:**
  - Helm chart installed
  - Controller running
  - CRDs created (Runner, RunnerDeployment, etc.)
- **Estimate:** M

### T-015.4: Configure ARC Authentication
- **Description:** Set up ARC to authenticate with GitHub
- **Acceptance Criteria:**
  - Secret created with GitHub App credentials
  - Controller configured to use credentials
  - Authentication verified in controller logs
- **Estimate:** S

### T-015.5: Verify Controller Health
- **Description:** Confirm controller is running correctly
- **Acceptance Criteria:**
  - Controller pods healthy
  - No errors in logs
  - Can communicate with GitHub API
- **Estimate:** S

---

## Estimate Legend
- **XS:** < 1 hour
- **S:** 1-4 hours
- **M:** 4-8 hours (1 day)
- **L:** 2-3 days
- **XL:** 4-5 days
