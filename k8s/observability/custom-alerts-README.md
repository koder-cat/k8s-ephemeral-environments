# Custom Alerts

Custom PrometheusRule alerts for cluster health monitoring.

## Overview

| Alert | Condition | Severity | Duration |
|-------|-----------|----------|----------|
| DiskUsageHigh | Disk > 80% | warning | 5m |
| DiskUsageCritical | Disk > 90% | critical | 5m |
| MemoryUsageWarning | Memory > 80% | warning | 5m |
| MemoryUsageHigh | Memory > 90% | critical | 5m |
| PodCrashLooping | > 3 restarts in 10m | warning | 0m |
| NodeNotReady | Node not ready | critical | 2m |

## How It Works

The PrometheusRule CRD is automatically discovered by Prometheus Operator because:
- It has the `release: prometheus` label matching the kube-prometheus-stack Helm release
- The `ruleSelectorNilUsesHelmValues: false` setting allows Prometheus to discover all PrometheusRules

## Installation

```bash
kubectl apply -f k8s/observability/custom-alerts.yaml
```

## Verify Installation

```bash
# Check PrometheusRule is created
kubectl get prometheusrule -n observability custom-alerts

# View alert rules in Prometheus
kubectl port-forward -n observability svc/prometheus-kube-prometheus-prometheus 9090:9090
# Open http://localhost:9090/rules and look for "custom.rules" group
```

## Viewing Alerts

### In Grafana

1. Navigate to https://grafana.k8s-ee.genesluna.dev
2. Go to **Alerting > Alert rules**
3. Look for alerts in the "custom.rules" group

### In Alertmanager

```bash
kubectl port-forward -n observability svc/prometheus-kube-prometheus-alertmanager 9093:9093
# Open http://localhost:9093
```

## Alert Details

### DiskUsageHigh

**Threshold:** Disk usage > 80% for 5 minutes
**Severity:** warning

**Remediation:**
1. Identify large files: `du -sh /* | sort -hr | head -20`
2. Check container logs: `kubectl logs --all-namespaces | wc -l`
3. Clean up old images: `crictl rmi --prune`
4. Delete old PR environments if needed

### DiskUsageCritical

**Threshold:** Disk usage > 90% for 5 minutes
**Severity:** critical

**Remediation:**
1. Immediately free space - this is urgent
2. Find orphaned PVs: `kubectl get pv --field-selector status.phase=Released` (then reclaim or delete manually)
3. Clean container logs (WARNING: destroys log data): `sudo truncate -s 0 /var/log/pods/*/*/*.log`
4. Consider expanding disk if persistent

### MemoryUsageWarning

**Threshold:** Memory usage > 80% for 5 minutes
**Severity:** warning

**Remediation:**
1. Check top memory consumers: `kubectl top pods -A --sort-by=memory`
2. Monitor for continued increase
3. Review recent deployments for memory-hungry workloads
4. Plan capacity if memory usage is trending upward

### MemoryUsageHigh

**Threshold:** Memory usage > 90% for 5 minutes
**Severity:** critical

**Remediation:**
1. Check top memory consumers: `kubectl top pods -A --sort-by=memory`
2. Identify memory leaks in applications
3. Scale down non-essential workloads
4. Consider increasing node memory

### PodCrashLooping

**Threshold:** > 3 restarts in 10 minutes
**Severity:** warning

**Remediation:**
1. Check pod events: `kubectl describe pod <pod> -n <namespace>`
2. Check container logs: `kubectl logs <pod> -n <namespace> --previous`
3. Common causes:
   - OOMKilled (increase memory limits)
   - Image pull errors
   - Liveness probe failures
   - Application startup failures

### NodeNotReady

**Threshold:** Node not ready for 2 minutes
**Severity:** critical

**Remediation:**
1. Check node status: `kubectl describe node <node>`
2. SSH to node and check:
   - `systemctl status kubelet`
   - `journalctl -u kubelet -n 100`
   - `df -h` (disk space)
   - `free -m` (memory)
3. Check for network issues
4. Restart kubelet if needed: `sudo systemctl restart k3s`

## Silencing Alerts

To silence an alert temporarily:

1. Open Alertmanager UI (port-forward to 9093)
2. Click "Silence" on the active alert
3. Set duration and comment
4. Click "Create"

Or use kubectl:
```bash
# Create a silence via Alertmanager API
curl -XPOST http://localhost:9093/api/v2/silences -d '{
  "matchers": [{"name": "alertname", "value": "DiskUsageHigh", "isRegex": false}],
  "startsAt": "2024-01-01T00:00:00.000Z",
  "endsAt": "2024-01-01T01:00:00.000Z",
  "createdBy": "admin",
  "comment": "Maintenance window"
}'
```

## Adding New Alerts

1. Edit `k8s/observability/custom-alerts.yaml`
2. Add new rule under `spec.groups[0].rules`
3. Apply changes: `kubectl apply -f k8s/observability/custom-alerts.yaml`
4. Prometheus will automatically reload rules

Example alert template:
```yaml
- alert: MyNewAlert
  expr: |
    my_prometheus_query > threshold
  for: 5m
  labels:
    severity: warning  # or critical
  annotations:
    summary: "Short description"
    description: "Detailed description with {{ $labels.instance }} and {{ $value }}"
    runbook_url: "https://link-to-runbook"
```

## Uninstallation

```bash
kubectl delete -f k8s/observability/custom-alerts.yaml
```
