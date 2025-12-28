# US-017: Configure GitHub Actions Access to Cluster

**Status:** Done

## User Story

**As an** SRE/DevOps engineer,
**I want** GitHub Actions workflows to have secure access to the Kubernetes cluster,
**So that** CI/CD pipelines can deploy applications.

## Acceptance Criteria

- [x] Runners run inside cluster (no external kubeconfig needed)
- [x] ServiceAccount with appropriate permissions created
- [x] Workflows can execute kubectl commands
- [x] Access scoped to necessary permissions only
- [x] Credentials managed via ServiceAccount (auto-rotated by K8s)

## Priority

**Must** - Critical for MVP

## Story Points

3

## Dependencies

- US-002: Install and Configure k3s Cluster
- US-015: Deploy Actions Runner Controller (ARC)

## Implementation Notes

- Implemented as part of US-004
- Runners use ServiceAccount `arc-runner-sa` in `arc-runners` namespace
- ClusterRole `arc-runner-role` grants permissions for:
  - Namespace management
  - ResourceQuota/LimitRange management
  - Pod/Service/ConfigMap/Secret management
  - Deployment/StatefulSet management
  - Ingress management
  - CloudNativePG resources (for future database support)
- RBAC config: `k8s/arc/runner-rbac.yaml`
