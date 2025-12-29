# Tasks for US-019: Configure Network Policies

**Status:** All tasks complete

## Tasks

### T-019.1: Enable Network Policy Support ✅
- **Description:** Verify k3s supports NetworkPolicies
- **Acceptance Criteria:**
  - NetworkPolicy controller running
  - Test policy can be applied
  - Policy takes effect
- **Estimate:** S
- **Implementation:** k3s uses kube-router for NetworkPolicy enforcement

### T-019.2: Create Default Deny Policy ✅
- **Description:** Create policy to deny cross-namespace traffic
- **Acceptance Criteria:**
  - Ingress from other PR namespaces denied
  - Policy template created
  - Applied to all PR namespaces
- **Estimate:** S
- **Implementation:** `k8s/ephemeral/network-policy-default-deny.yaml` (blocks ingress + egress)

### T-019.3: Create Allow Same-Namespace Policy ✅
- **Description:** Allow traffic within namespace
- **Acceptance Criteria:**
  - Pods in same namespace can communicate
  - App can reach database
  - Service discovery works
- **Estimate:** S
- **Implementation:** `k8s/ephemeral/network-policy-allow-same-namespace.yaml`

### T-019.4: Create Ingress Allow Policy ✅
- **Description:** Allow traffic from ingress controller
- **Acceptance Criteria:**
  - Traffic from Traefik namespace allowed
  - External HTTP requests work
  - Only ingress traffic allowed
- **Estimate:** S
- **Implementation:** `k8s/ephemeral/network-policy-allow-ingress.yaml` (matches Traefik pod label)

### T-019.5: Create Observability Allow Policy ✅
- **Description:** Allow traffic to/from observability
- **Acceptance Criteria:**
  - Prometheus can scrape metrics
  - Promtail can collect logs
  - Grafana accessible
- **Estimate:** S
- **Implementation:** `k8s/ephemeral/network-policy-allow-observability.yaml` (Promtail reads from node filesystem, no network policy needed)

### T-019.6: Configure Egress Policies ✅
- **Description:** Allow required egress traffic
- **Acceptance Criteria:**
  - DNS resolution works (port 53)
  - External API calls work
  - Container registry accessible
- **Estimate:** S
- **Implementation:** `k8s/ephemeral/network-policy-allow-egress.yaml` (DNS, K8s API at 10.0.0.39:6443, external internet)

### T-019.7: Test Network Isolation ✅
- **Description:** Verify isolation is working
- **Acceptance Criteria:**
  - Pod in PR-1 cannot ping pod in PR-2
  - Pod in PR-1 can reach own database
  - External traffic works
  - Ingress works
- **Estimate:** M
- **Implementation:** Tested on VPS - cross-namespace TCP blocked, same-namespace works, ingress/egress works. Note: ICMP not filtered by kube-router.

## Additional Implementation Notes

- ARC runner RBAC updated to manage NetworkPolicies (`k8s/arc/runner-rbac.yaml`)
- K8s API access required for CNPG job status reporting - uses host IP not service IP
- Documentation: `docs/runbooks/network-policies.md`

---

## Estimate Legend
- **XS:** < 1 hour
- **S:** 1-4 hours
- **M:** 4-8 hours (1 day)
- **L:** 2-3 days
- **XL:** 4-5 days
