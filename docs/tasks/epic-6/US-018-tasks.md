# Tasks for US-018: Configure Resource Quotas

**Status:** All tasks complete (implemented as part of US-004)

**Update:** ResourceQuota now uses **dynamic calculation** based on enabled databases in `k8s-ee.yaml`. See [Resource Requirements by Database](../../guides/k8s-ee-config-reference.md#resource-requirements-by-database).

## Tasks

### T-018.1: Create ResourceQuota Template ✅
- **Description:** Define ResourceQuota manifest for PR namespaces
- **Acceptance Criteria:**
  - CPU requests/limits defined
  - Memory requests/limits defined
  - Storage requests defined
  - Pod count limit defined
- **Estimate:** S
- **Implementation:** Dynamic calculation in `.github/actions/create-namespace/action.yml`
- **Note:** Quota now scales based on enabled databases (PostgreSQL, MongoDB, Redis, MinIO, MariaDB)

### T-018.2: Create LimitRange Template ✅
- **Description:** Define default container limits
- **Acceptance Criteria:**
  - Default CPU request/limit
  - Default memory request/limit
  - Maximum container limits
  - Minimum container limits
- **Estimate:** S
- **Implementation:** `k8s/ephemeral/limit-range.yaml`

### T-018.3: Integrate with Namespace Creation ✅
- **Description:** Apply quotas when creating PR namespace
- **Acceptance Criteria:**
  - ResourceQuota calculated based on enabled databases
  - LimitRange applied automatically
  - Part of namespace setup workflow
- **Estimate:** S
- **Implementation:** `.github/actions/create-namespace/action.yml` (dynamic quota calculation)

### T-018.4: Test Quota Enforcement ✅
- **Description:** Verify quotas are enforced
- **Acceptance Criteria:**
  - Pod exceeding limits rejected
  - Error message clear
  - Existing pods not affected
- **Estimate:** S
- **Implementation:** Verified during PR environment deployments

### T-018.5: Create Quota Monitoring Dashboard
- **Description:** Add quota metrics to Grafana
- **Acceptance Criteria:**
  - Dashboard shows quota usage per namespace
  - Alerts when approaching limits
  - Historical usage visible
- **Estimate:** M
- **Status:** Deferred - kube-prometheus-stack includes quota metrics out of the box

---

## Estimate Legend
- **XS:** < 1 hour
- **S:** 1-4 hours
- **M:** 4-8 hours (1 day)
- **L:** 2-3 days
- **XL:** 4-5 days
