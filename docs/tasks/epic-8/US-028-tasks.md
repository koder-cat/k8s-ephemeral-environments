# Tasks for US-028: Publish Helm Charts to OCI Registry

**Status:** Done

## Tasks

### T-028.0: Create MariaDB Chart (Added)
- **Description:** Create new MariaDB chart following Redis simple deployment pattern
- **Acceptance Criteria:**
  - Chart.yaml with name `k8s-ee-mariadb` version 1.0.0
  - Simple deployment pattern (no operator)
  - Environment variable injection via `mariadb.envVars` template
  - Security hardening (runAsNonRoot, capabilities dropped)
- **Estimate:** S
- **Status:** Done
- **Files:** `charts/mariadb/`

### T-028.1: Rename PostgreSQL Chart
- **Description:** Rename postgresql chart to k8s-ee-postgresql for OCI registry
- **Acceptance Criteria:**
  - Chart.yaml name changed to `k8s-ee-postgresql`
  - All internal references updated
  - Chart version bumped to 1.1.0
- **Estimate:** XS
- **Status:** Done
- **Files:** `charts/postgresql/Chart.yaml`

### T-028.2: Rename MongoDB Chart
- **Description:** Rename mongodb chart to k8s-ee-mongodb for OCI registry
- **Acceptance Criteria:**
  - Chart.yaml name changed to `k8s-ee-mongodb`
  - All internal references updated
  - Chart version bumped to 1.1.0
- **Estimate:** XS
- **Status:** Done
- **Files:** `charts/mongodb/Chart.yaml`

### T-028.3: Rename Redis Chart
- **Description:** Rename redis chart to k8s-ee-redis for OCI registry
- **Acceptance Criteria:**
  - Chart.yaml name changed to `k8s-ee-redis`
  - All internal references updated
  - Chart version bumped to 1.1.0
- **Estimate:** XS
- **Status:** Done
- **Files:** `charts/redis/Chart.yaml`

### T-028.4: Rename MinIO Chart
- **Description:** Rename minio chart to k8s-ee-minio for OCI registry
- **Acceptance Criteria:**
  - Chart.yaml name changed to `k8s-ee-minio`
  - All internal references updated
  - Chart version bumped to 1.1.0
- **Estimate:** XS
- **Status:** Done
- **Files:** `charts/minio/Chart.yaml`

### T-028.5: Create Chart Publishing Workflow
- **Description:** Create GitHub workflow to publish charts to GHCR on push
- **Acceptance Criteria:**
  - Workflow triggers on push to main with changes in `charts/`
  - Logs into GHCR using GITHUB_TOKEN
  - Packages each chart with `helm package`
  - Pushes to `oci://ghcr.io/genesluna/k8s-ephemeral-environments/charts/`
  - Supports semantic versioning from Chart.yaml
- **Estimate:** M
- **Status:** Done
- **Files:** `.github/workflows/publish-charts.yml`

### T-028.6: Update Demo-app Dependencies
- **Description:** Update demo-app to use renamed charts with aliases
- **Acceptance Criteria:**
  - Dependencies use new `k8s-ee-*` names
  - Aliases preserve backward compatibility
  - MariaDB dependency added
- **Estimate:** XS
- **Status:** Done
- **Files:** `charts/demo-app/Chart.yaml`

### T-028.7: Verify Chart Publishing
- **Description:** Test chart publishing and pulling from GHCR
- **Acceptance Criteria:**
  - All 5 charts published successfully
  - Charts can be pulled with `helm pull oci://...`
  - Chart versions match Chart.yaml
- **Estimate:** S
- **Status:** Pending (requires merge to main)
- **Files:** None (verification)

---

## Estimate Legend
- **XS:** < 1 hour
- **S:** 1-4 hours
- **M:** 4-8 hours (1 day)
- **L:** 2-3 days
- **XL:** 4-5 days
