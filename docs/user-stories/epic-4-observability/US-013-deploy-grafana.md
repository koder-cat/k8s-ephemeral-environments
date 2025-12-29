# US-013: Deploy Grafana Dashboards

**Status:** Done

## User Story

**As a** developer,
**I want** a Grafana interface to view logs and metrics,
**So that** I can monitor my PR environment through a single pane of glass.

## Acceptance Criteria

- [ ] Grafana deployed in `observability` namespace
- [ ] Prometheus configured as data source
- [ ] Loki configured as data source
- [ ] Pre-built dashboards available (cluster overview, namespace view)
- [ ] Grafana accessible via URL (e.g., grafana.preview.domain.com)
- [ ] Basic authentication or SSO configured

## Priority

**Should** - Important but not blocking

## Story Points

5

## Dependencies

- US-011: Deploy Prometheus for Metrics Collection
- US-012: Deploy Loki for Log Aggregation

## Notes

- Grafana often included in kube-prometheus-stack
- Consider Grafana Cloud for managed option (future)
- Dashboards can be provisioned as ConfigMaps
