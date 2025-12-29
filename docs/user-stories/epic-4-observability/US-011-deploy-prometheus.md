# US-011: Deploy Prometheus for Metrics Collection

**Status:** Done

## User Story

**As an** SRE/DevOps engineer,
**I want** Prometheus deployed to collect cluster and application metrics,
**So that** I can monitor resource usage and application health.

## Acceptance Criteria

- [ ] Prometheus deployed in `observability` namespace
- [ ] Node metrics collected (CPU, memory, disk)
- [ ] Pod metrics collected from all namespaces
- [ ] Kubernetes API server metrics collected
- [ ] Retention configured (7 days)
- [ ] Resource usage < 2GB RAM

## Priority

**Must** - Critical for MVP

## Story Points

5

## Dependencies

- US-002: Install and Configure k3s Cluster

## Notes

- Use kube-prometheus-stack Helm chart for comprehensive setup
- Consider Prometheus Operator for easier management
- Configure ServiceMonitors for application metrics
