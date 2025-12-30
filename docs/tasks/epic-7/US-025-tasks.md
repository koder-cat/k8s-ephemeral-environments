# Tasks for US-025: Developer Documentation

**Status:** Done

## Tasks

### T-025.1: Create Developer Onboarding Guide ✅
- **Description:** Single document for new team member onboarding
- **Acceptance Criteria:**
  - First-time setup instructions
  - kubeconfig and cluster access
  - Grafana dashboard access
  - Common tasks workflow
  - Troubleshooting quick start
- **Estimate:** M
- **Files:** `docs/DEVELOPER-ONBOARDING.md`

### T-025.2: Add Demo App Documentation ✅
- **Description:** Document the demo application structure and usage
- **Acceptance Criteria:**
  - Root README with overview and local setup
  - API README with endpoints, env vars, database schema
  - Web README with frontend structure, API client
  - Local development workflow documented
- **Estimate:** M
- **Files:**
  - `demo-app/README.md`
  - `demo-app/apps/api/README.md`
  - `demo-app/apps/web/README.md`

### T-025.3: Create Troubleshooting Guide ✅
- **Description:** Decision tree for common issues
- **Acceptance Criteria:**
  - PR namespace doesn't create - checklist
  - Deployment failures - debugging steps
  - Database credential issues - verification
  - Network policy blocking traffic - testing
  - Health check failures - investigation
- **Estimate:** M
- **Files:** `docs/guides/troubleshooting.md`

### T-025.4: Create CONTRIBUTING.md ✅
- **Description:** Contribution guidelines at project root
- **Acceptance Criteria:**
  - PR process documented
  - Code style guidelines
  - User story sync workflow
  - Documentation requirements
  - Testing expectations
- **Estimate:** S
- **Files:** `CONTRIBUTING.md`

### T-025.5: Create Cluster Recovery Runbook ✅
- **Description:** Disaster recovery procedures
- **Acceptance Criteria:**
  - VPS recovery procedures
  - k3s reinstallation steps
  - Data recovery (logs, metrics)
  - Service restoration checklist
  - Verification procedures
- **Estimate:** M
- **Files:** `docs/runbooks/cluster-recovery.md`

### T-025.6: Add Helm Chart README ✅
- **Description:** Document demo-app Helm chart customization
- **Acceptance Criteria:**
  - Chart overview and usage
  - Values.yaml parameters documented
  - Database enablement instructions
  - Ingress configuration
  - Resource limits customization
- **Estimate:** S
- **Files:** `charts/demo-app/README.md`

---

## Estimate Legend
- **XS:** < 1 hour
- **S:** 1-4 hours
- **M:** 4-8 hours (1 day)
- **L:** 2-3 days
- **XL:** 4-5 days
