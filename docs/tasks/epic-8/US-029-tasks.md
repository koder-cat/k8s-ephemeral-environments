# Tasks for US-029: Create Generic Application Chart

**Status:** Done

## Tasks

### T-029.1: Create Chart Structure
- **Description:** Create k8s-ee-app chart directory and Chart.yaml
- **Acceptance Criteria:**
  - Chart directory created at `charts/k8s-ee-app/`
  - Chart.yaml with metadata and OCI dependencies
  - Dependencies use `oci://ghcr.io/...` repository
  - Conditional dependencies for databases
- **Estimate:** S
- **Status:** Done
- **Files:** `charts/k8s-ee-app/Chart.yaml`

### T-029.2: Create Values Schema
- **Description:** Create values.yaml with all configurable options
- **Acceptance Criteria:**
  - All values map to k8s-ee.yaml config structure
  - Sensible defaults for all optional values
  - Comments documenting each value
  - Database toggles (postgresql, mongodb, redis, minio, mariadb)
- **Estimate:** S
- **Status:** Done
- **Files:** `charts/k8s-ee-app/values.yaml`

### T-029.3: Create Deployment Template
- **Description:** Create generic deployment template
- **Acceptance Criteria:**
  - Configurable image, port, and resources
  - Health probes using configurable paths
  - Environment variable injection from values
  - Init containers for database readiness (conditional)
  - Security context following hardened patterns
  - Required validation for image.repository and image.tag
- **Estimate:** M
- **Status:** Done
- **Files:** `charts/k8s-ee-app/templates/deployment.yaml`

### T-029.4: Create Service Template
- **Description:** Create service template exposing app port
- **Acceptance Criteria:**
  - Service type ClusterIP
  - Port from values.app.port
  - Correct selector labels
- **Estimate:** XS
- **Status:** Done
- **Files:** `charts/k8s-ee-app/templates/service.yaml`

### T-029.5: Create Ingress Template
- **Description:** Create ingress template for preview URLs
- **Acceptance Criteria:**
  - Host pattern: `{projectId}-pr-{prNumber}.{previewDomain}`
  - Traefik annotations for TLS
  - Let's Encrypt cert-resolver
- **Estimate:** S
- **Status:** Done
- **Files:** `charts/k8s-ee-app/templates/ingress.yaml`

### T-029.6: Create ServiceMonitor Template
- **Description:** Create optional ServiceMonitor for Prometheus
- **Acceptance Criteria:**
  - Conditional on metrics.enabled
  - Configurable metrics path and interval
  - Correct selector labels
- **Estimate:** S
- **Status:** Done
- **Files:** `charts/k8s-ee-app/templates/servicemonitor.yaml`

### T-029.7: Create Helpers Template
- **Description:** Create _helpers.tpl with common template functions
- **Acceptance Criteria:**
  - Name generation functions
  - Label generation functions
  - Selector functions
  - Hostname function for preview URLs
- **Estimate:** S
- **Status:** Done
- **Files:** `charts/k8s-ee-app/templates/_helpers.tpl`

### T-029.8: Update Publish Workflow
- **Description:** Add k8s-ee-app to chart publishing workflow
- **Acceptance Criteria:**
  - Path trigger includes k8s-ee-app
  - Lint step includes k8s-ee-app
  - Package step handles OCI dependencies
  - Summary includes k8s-ee-app
- **Estimate:** S
- **Status:** Done
- **Files:** `.github/workflows/publish-charts.yml`

### T-029.9: Test Chart
- **Description:** Test chart with helm lint and template
- **Acceptance Criteria:**
  - Chart passes `helm lint`
  - Chart templates correctly with required values
  - Database subcharts included when enabled
  - OCI dependencies pulled successfully
- **Estimate:** S
- **Status:** Done
- **Files:** None (verification)

---

## Estimate Legend
- **XS:** < 1 hour
- **S:** 1-4 hours
- **M:** 4-8 hours (1 day)
- **L:** 2-3 days
- **XL:** 4-5 days
