# Custom Alerts

Custom PrometheusRule alerts for cluster health monitoring and application SLOs.

## Overview

### Infrastructure Alerts

| Alert | Condition | Severity | Duration |
|-------|-----------|----------|----------|
| DiskUsageHigh | Disk > 80% | warning | 5m |
| DiskUsageCritical | Disk > 90% | critical | 5m |
| MemoryUsageWarning | Memory > 80% | warning | 5m |
| MemoryUsageHigh | Memory > 90% | critical | 5m |
| PodCrashLooping | > 3 restarts in 10m | warning | 0m |
| NodeNotReady | Node not ready | critical | 2m |

### Application SLO Alerts

| Alert | Condition | Severity | Duration |
|-------|-----------|----------|----------|
| APIHighLatency | P99 latency > 500ms | warning | 5m |
| APIHighErrorRate | Error rate > 5% | warning | 5m |
| DatabaseQuerySlow | P99 query latency > 1s | warning | 5m |
| DatabasePoolExhausted | Queries waiting for connections | warning | 2m |

### Observability Alerts

| Alert | Condition | Severity | Duration |
|-------|-----------|----------|----------|
| PrometheusScrapeFailure | Scrape target down | warning | 5m |
| PrometheusTargetMissing | No demo-app targets | info | 10m |
| LokiIngestionErrors | Log ingestion stopped | warning | 10m |

### Namespace Quota Alerts

| Alert | Condition | Severity | Duration |
|-------|-----------|----------|----------|
| NamespaceQuotaCPUApproaching | CPU quota > 80% | warning | 5m |
| NamespaceQuotaMemoryApproaching | Memory quota > 80% | warning | 5m |

## How It Works

The PrometheusRule CRD is automatically discovered by Prometheus Operator because:
- It has the `release: prometheus` label matching the kube-prometheus-stack Helm release
- The `ruleSelectorNilUsesHelmValues: false` setting allows Prometheus to discover all PrometheusRules

## Installation

**IMPORTANT:** This file must be manually applied to the cluster. It is NOT automatically deployed.

```bash
# Apply custom alerts to the cluster
kubectl apply -f k8s/observability/custom-alerts.yaml

# After modifying the file, re-apply to update the rules
kubectl apply -f k8s/observability/custom-alerts.yaml
```

## Verify Installation

```bash
# Check PrometheusRule is created
kubectl get prometheusrule -n observability custom-alerts

# List all alert names in the rule
kubectl get prometheusrule -n observability custom-alerts -o jsonpath='{.spec.groups[0].rules[*].alert}'

# View alert rules in Prometheus
kubectl port-forward -n observability svc/prometheus-prometheus 9090:9090
# Open http://localhost:9090/rules and look for "custom.rules" group

# Check alert states
kubectl port-forward -n observability svc/prometheus-prometheus 9090:9090
# Open http://localhost:9090/alerts
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

### APIHighLatency

**Threshold:** P99 latency > 500ms for 5 minutes
**Severity:** warning

**Remediation:**
1. Check which routes are slow: Look at `route` label in alert
2. Check database query times: `kubectl logs -n <namespace> deployment/demo-app | grep "slow query"`
3. Check resource usage: `kubectl top pods -n <namespace>`
4. Review recent deployments for performance regressions
5. Consider scaling if traffic increased

### APIHighErrorRate

**Threshold:** Error rate > 5% for 5 minutes
**Severity:** warning

**Remediation:**
1. Check which routes have errors: Look at `route` label in alert
2. Check application logs: `kubectl logs -n <namespace> deployment/demo-app --tail=100`
3. Check if database is accessible: `kubectl exec -n <namespace> deployment/demo-app -- curl -s localhost:3000/api/health`
4. Check for recent deployments that may have introduced bugs
5. Review error details in Grafana logs dashboard

### DatabaseQuerySlow

**Threshold:** P99 query latency > 1s for 5 minutes
**Severity:** warning

**Remediation:**
1. Check which operations are slow: Look at `operation` label in alert
2. Check database connection pool: `kubectl logs -n <namespace> deployment/demo-app | grep "pool"`
3. Check PostgreSQL status: `kubectl exec -n <namespace> demo-app-postgresql-rw-0 -- psql -c "SELECT * FROM pg_stat_activity;"`
4. Review slow queries: Check Loki logs for query timing
5. Consider adding indexes or optimizing queries

### DatabasePoolExhausted

**Threshold:** Queries waiting for connections for 2 minutes
**Severity:** warning

**Remediation:**
1. Check pool stats: `kubectl logs -n <namespace> deployment/demo-app | grep "pool"`
2. Check for long-running queries: `kubectl exec -n <namespace> demo-app-postgresql-rw-0 -- psql -c "SELECT pid, now() - pg_stat_activity.query_start AS duration, query FROM pg_stat_activity WHERE state != 'idle' ORDER BY duration DESC;"`
3. Check for connection leaks in application code
4. Consider increasing pool size (current max: 5)

## Troubleshooting Alerts

### Alerts Not Firing

If alert demos run but alerts don't appear in Grafana:

1. **Verify PrometheusRule is applied:**
   ```bash
   kubectl get prometheusrule -n observability custom-alerts
   ```
   If not found, apply it:
   ```bash
   kubectl apply -f k8s/observability/custom-alerts.yaml
   ```

2. **Verify all alert rules are loaded:**
   ```bash
   kubectl get prometheusrule -n observability custom-alerts -o jsonpath='{.spec.groups[0].rules[*].alert}' | tr ' ' '\n'
   ```
   Should show 15 alerts including APIHighLatency, APIHighErrorRate, DatabaseQuerySlow.

3. **Check Prometheus is scraping metrics:**
   ```bash
   kubectl port-forward -n observability svc/prometheus-prometheus 9090:9090
   # Open http://localhost:9090/targets - look for demo-app targets
   ```

4. **Check alert state in Prometheus:**
   ```bash
   # Open http://localhost:9090/alerts
   # Look for alerts in "pending" or "firing" state
   ```

5. **Verify metrics exist:**
   ```bash
   # In Prometheus UI, query:
   http_requests_total{namespace=~"k8s-ee-pr-.*"}
   http_request_duration_seconds_bucket{namespace=~"k8s-ee-pr-.*"}
   ```

6. **Check timing requirements:**
   - Alert demos run for 10.5 minutes
   - Alerts need `rate(...[5m])` data + `for: 5m` pending duration
   - Total time to firing: ~7-10 minutes after demo start

7. **Check NetworkPolicy allows scraping:**
   ```bash
   kubectl get networkpolicy -n <pr-namespace>
   # Verify observability namespace can reach pod on port 3000
   ```

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
