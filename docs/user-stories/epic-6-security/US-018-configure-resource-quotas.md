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
| ResourceQuota | Dynamically calculated in `.github/actions/create-namespace/action.yml` |
| LimitRange | `k8s/ephemeral/limit-range.yaml` |

**Dynamic Quota Calculation:**

Quotas are now **automatically calculated** based on enabled databases in `k8s-ee.yaml`:

| Configuration | CPU Limit | Memory Limit | Storage |
|---------------|-----------|--------------|---------|
| App only | 300m | 512Mi | 1Gi |
| App + PostgreSQL | 800m | 1Gi | 3Gi |
| App + all databases | 2100m | 2.4Gi | 9Gi |

See [Resource Requirements by Database](../../guides/k8s-ee-config-reference.md#resource-requirements-by-database) for details.

## Notes

- Quotas calculated and applied automatically in PR environment workflow
- Quota scales based on enabled databases (PostgreSQL, MongoDB, Redis, MinIO, MariaDB)
- LimitRange sets default container limits if not specified
- kube-prometheus-stack includes quota metrics for monitoring
