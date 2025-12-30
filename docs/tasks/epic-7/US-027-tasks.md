# Tasks for US-027: Kubernetes Best Practices

**Status:** Done

## Tasks

### T-027.1: Create PriorityClasses ✅
- **Description:** Define priority classes for workload scheduling
- **Acceptance Criteria:**
  - ✅ `platform-critical` class (value: 1000000) for platform components
  - ✅ `default-app` class (value: 100) for PR environments
  - ✅ Applied to cleanup jobs and preserve-expiry job
  - ✅ Documented in phase2-migration.md
- **Estimate:** S
- **Files:** `k8s/platform/priority-classes.yaml`
- **Note:** Renamed from `system-platform` to `platform-critical` (system- prefix is reserved)

### T-027.2: Add Pod Disruption Budgets (Skipped)
- **Description:** Protect system components during maintenance
- **Status:** Skipped for Phase 1
- **Rationale:**
  - CronJobs create single pods on-demand, PDBs don't apply
  - Single-node k3s architecture doesn't benefit from PDBs
  - Documented in `docs/guides/phase2-migration.md` for Phase 2 implementation
- **Estimate:** S
- **Files:** N/A (documented in phase2-migration.md)

### T-027.3: Add Startup Probes to Databases ✅
- **Description:** Handle slow database initialization
- **Acceptance Criteria:**
  - ✅ Startup probe added to MongoDB chart (TCP port 27017)
  - ✅ Startup probe added to MinIO chart (HTTP /minio/health/live)
  - ✅ Initial delay (10s) and period (10s) configured
  - ✅ Failure threshold (30) allows 5 minutes startup time
- **Estimate:** S
- **Files:**
  - `charts/mongodb/templates/mongodb.yaml`
  - `charts/mongodb/values.yaml`
  - `charts/minio/templates/tenant.yaml`
  - `charts/minio/values.yaml`

### T-027.4: Add Lifecycle Hooks ✅
- **Description:** Enable graceful shutdown for applications
- **Acceptance Criteria:**
  - ✅ preStop hook added to demo-app deployment (sleep 5)
  - ✅ terminationGracePeriodSeconds: 30
  - ✅ Graceful connection draining via preStop sleep
- **Estimate:** S
- **Files:**
  - `charts/demo-app/templates/deployment.yaml`
  - `charts/demo-app/values.yaml`

### T-027.5: Improve Helm Chart Metadata ✅
- **Description:** Follow Helm best practices for Chart.yaml
- **Acceptance Criteria:**
  - ✅ kubeVersion: ">=1.25.0-0" specified in all charts
  - ✅ home URL set to repository (demo-app)
  - ✅ sources added (demo-app)
  - ✅ maintainers already populated
- **Estimate:** S
- **Files:**
  - `charts/demo-app/Chart.yaml`
  - `charts/postgresql/Chart.yaml`
  - `charts/mongodb/Chart.yaml`
  - `charts/minio/Chart.yaml`
  - `charts/redis/Chart.yaml`

### T-027.6: Abstract Cluster-Specific Configs ✅
- **Description:** Prepare configurations for Phase 2 EKS migration
- **Acceptance Criteria:**
  - ✅ Hardcoded K8s API IP replaced with ${K8S_API_IP} variable
  - ✅ K8S_API_IP added to GitHub workflow env vars
  - ✅ NetworkPolicy documented for EKS differences
  - ✅ Migration guide created at docs/guides/phase2-migration.md
- **Estimate:** M
- **Files:**
  - `k8s/ephemeral/network-policy-allow-egress.yaml`
  - `.github/workflows/pr-environment.yml`
  - `docs/guides/phase2-migration.md`

---

## Estimate Legend
- **XS:** < 1 hour
- **S:** 1-4 hours
- **M:** 4-8 hours (1 day)
- **L:** 2-3 days
- **XL:** 4-5 days
