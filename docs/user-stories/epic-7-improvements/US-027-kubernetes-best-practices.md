# US-027: Kubernetes Best Practices

**Status:** Done

## User Story

**As a** platform operator,
**I want** production-grade K8s configurations,
**So that** the cluster is resilient and maintainable.

## Acceptance Criteria

- [x] PriorityClasses ensure platform jobs run first
- [x] Pod Disruption Budgets protect maintenance (skipped for Phase 1, documented for Phase 2)
- [x] Startup probes handle slow database init
- [x] Lifecycle hooks enable graceful shutdown
- [x] Helm chart metadata follows best practices
- [x] Cluster-specific configs abstracted for Phase 2

## Priority

**Could** - Nice to have

## Story Points

5

## Dependencies

- None (standalone improvement)

## Notes

- No PriorityClasses defined; platform jobs could be starved during resource pressure
- No Pod Disruption Budgets for system components
- MongoDB and MinIO lack startup probes (may fail liveness during slow init)
- No preStop hooks for graceful shutdown
- Helm charts missing kubeVersion, icon, keywords
- K8s API IP hardcoded in NetworkPolicy (breaks EKS migration)

## Implementation

- **PriorityClasses:**
  - Create `k8s/platform/priority-classes.yaml`
  - `platform-critical` (1000000) for cleanup jobs, operators (renamed from system-platform; system- prefix is reserved)
  - `default-app` (100) for PR environments

- **Pod Disruption Budgets:**
  - Create `k8s/platform/pod-disruption-budgets.yaml`
  - Protect cleanup job, preserve expiry, observability stack

- **Startup Probes:**
  - Add to `charts/mongodb/templates/mongodb.yaml`
  - Add to `charts/minio/templates/tenant.yaml`

- **Lifecycle Hooks:**
  - Add preStop hook to `charts/demo-app/templates/deployment.yaml`
  - Add terminationGracePeriodSeconds

- **Helm Chart Metadata:**
  - Update all `Chart.yaml` files with kubeVersion, keywords, icon

- **Phase 2 Prep:**
  - Abstract hardcoded IP in `k8s/ephemeral/network-policy-allow-egress.yaml`
  - Document for EKS migration
