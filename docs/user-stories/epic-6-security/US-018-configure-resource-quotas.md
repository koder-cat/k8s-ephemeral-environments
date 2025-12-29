# US-018: Configure Resource Quotas

**Status:** Done

## User Story

**As an** SRE/DevOps engineer,
**I want** resource quotas configured for PR namespaces,
**So that** one PR cannot consume all cluster resources.

## Acceptance Criteria

- [x] ResourceQuota template created for PR namespaces
- [x] CPU limit per namespace: 1 core
- [x] Memory limit per namespace: 2Gi
- [x] Storage limit per namespace: 5Gi
- [x] Pod count limit per namespace: 10
- [x] Quotas enforced on pod creation

## Priority

**Should** - Important but not blocking

## Story Points

3

## Dependencies

- US-004: Create Namespace on PR Open

## Implementation

Implemented as part of US-004 (Create Namespace on PR Open):

| Resource | File |
|----------|------|
| ResourceQuota | `k8s/ephemeral/resource-quota.yaml` |
| LimitRange | `k8s/ephemeral/limit-range.yaml` |

Applied limits per PR namespace:
- CPU: 1 core limit, 500m requests
- Memory: 2Gi limit, 1Gi requests
- Storage: 5Gi
- Pods: 10
- PVCs: 3

## Notes

- Quotas applied automatically in PR environment workflow
- LimitRange sets default container limits if not specified
- kube-prometheus-stack includes quota metrics for monitoring
