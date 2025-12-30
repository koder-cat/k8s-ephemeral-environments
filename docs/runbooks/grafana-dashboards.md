# Grafana Dashboard Operations Runbook

## Quick Reference

```bash
# Deploy dashboard changes (DO NOT restart Grafana)
scp k8s/observability/dashboards/*.json ubuntu@168.138.151.63:/tmp/dashboards/
ssh ubuntu@168.138.151.63 "kubectl create configmap grafana-dashboards-ephemeral \
  --from-file=/tmp/dashboards/ \
  -n observability --dry-run=client -o yaml | \
kubectl label --local -f - grafana_dashboard=1 -o yaml | \
kubectl apply -f -"

# Verify dashboards loaded (wait ~30 seconds)
ssh ubuntu@168.138.151.63 "kubectl exec \$(kubectl get pod -n observability -l app.kubernetes.io/name=grafana -o name | head -1) \
  -n observability -c grafana -- ls /tmp/dashboards/"
```

---

## Key Principle: Never Restart Grafana

The Grafana sidecar (`grafana-sc-dashboard`) watches ConfigMaps and **automatically reloads dashboards every 30 seconds**.

**DO NOT run `kubectl rollout restart`** - it can cause provisioning race conditions where Grafana crashes with "data source not found" errors.

---

## Step-by-Step: Update Dashboards

### 1. Edit dashboard JSON files locally

```bash
# Edit files in k8s/observability/dashboards/
code k8s/observability/dashboards/my-dashboard.json
```

### 2. Copy files to VPS

```bash
# Create temp directory on VPS
ssh ubuntu@168.138.151.63 "mkdir -p /tmp/dashboards"

# Copy all dashboard JSON files
scp k8s/observability/dashboards/*.json ubuntu@168.138.151.63:/tmp/dashboards/
```

### 3. Update ConfigMap

```bash
ssh ubuntu@168.138.151.63 "kubectl create configmap grafana-dashboards-ephemeral \
  --from-file=/tmp/dashboards/ \
  -n observability --dry-run=client -o yaml | \
kubectl label --local -f - grafana_dashboard=1 -o yaml | \
kubectl apply -f -"
```

Output should show: `configmap/grafana-dashboards-ephemeral configured`

> **If you get "Too long: may not be more than 262144 bytes" error:**
> The ConfigMap is too large for `kubectl apply` annotations. Use delete and create instead:
> ```bash
> ssh ubuntu@168.138.151.63 "kubectl delete configmap grafana-dashboards-ephemeral -n observability && \
> kubectl create configmap grafana-dashboards-ephemeral --from-file=/tmp/dashboards/ -n observability && \
> kubectl label configmap grafana-dashboards-ephemeral grafana_dashboard=1 -n observability"
> ```

### 4. Wait for sidecar to reload (~30 seconds)

The sidecar automatically detects ConfigMap changes. No restart needed.

### 5. Verify dashboards loaded

```bash
# Check files in sidecar directory
ssh ubuntu@168.138.151.63 "kubectl exec \$(kubectl get pod -n observability -l app.kubernetes.io/name=grafana -o name | head -1) \
  -n observability -c grafana -- ls /tmp/dashboards/"

# Should list all your dashboard JSON files
```

### 6. Test in browser

Open https://grafana.k8s-ee.genesluna.dev and verify dashboards work correctly.

---

## Adding a New Dashboard

### 1. Create dashboard JSON

Option A: Export from Grafana UI
1. Create dashboard in Grafana
2. Dashboard Settings > JSON Model > Copy
3. Save to `k8s/observability/dashboards/<name>.json`

Option B: Create JSON manually (use existing dashboards as templates)

### 2. Required JSON fields

```json
{
  "uid": "unique-dashboard-id",
  "title": "Dashboard Title",
  "tags": ["k8s-ee"],
  "templating": {
    "list": [
      {
        "name": "namespace",
        "query": "label_values(kube_namespace_status_phase{namespace=~\".*-pr-.*\"}, namespace)"
      }
    ]
  }
}
```

### 3. Datasource UIDs

All panels must use correct datasource references:

| Datasource | UID Pattern | Type |
|------------|-------------|------|
| Prometheus | `prometheus` (hardcoded) | `prometheus` |
| Loki | `${DS_LOKI}` (variable) | `loki` |
| Alertmanager | `alertmanager` (hardcoded) | `alertmanager` |

**Prometheus example** (hardcoded UID):
```json
{
  "datasource": {
    "type": "prometheus",
    "uid": "prometheus"
  }
}
```

**Loki example** (MUST use variable):
```json
{
  "datasource": {
    "type": "loki",
    "uid": "${DS_LOKI}"
  }
}
```

> **Critical:** Loki panels MUST use `${DS_LOKI}` variable, NOT hardcoded `"uid": "loki"`. Hardcoded UIDs will cause "No data" errors even when Explore works fine.

### 4. Loki Datasource Variable (Required for log panels)

Any dashboard with Loki log panels must include this variable in the `templating.list` array:

```json
{
  "templating": {
    "list": [
      {
        "current": {},
        "hide": 2,
        "includeAll": false,
        "multi": false,
        "name": "DS_LOKI",
        "options": [],
        "query": "loki",
        "refresh": 1,
        "regex": "",
        "skipUrlSync": false,
        "type": "datasource"
      }
    ]
  }
}
```

- `hide: 2` makes the variable hidden from the UI
- `query: "loki"` finds datasources of type loki
- `type: "datasource"` makes it a datasource selector variable

### 5. Deploy using steps above

---

## Troubleshooting

### Dashboard changes not appearing

1. **Wait 30 seconds** - sidecar polls periodically
2. **Hard refresh browser** - Ctrl+Shift+R
3. **Check sidecar logs:**
   ```bash
   ssh ubuntu@168.138.151.63 "kubectl logs -n observability -l app.kubernetes.io/name=grafana -c grafana-sc-dashboard --tail=20"
   ```

### Grafana pod crashing after restart

**Symptoms:** Pod in CrashLoopBackOff, logs show "Datasource provisioning error: data source not found"

**Cause:** Race condition - Grafana starts before sidecar writes datasource files

**Fix:**
```bash
# Rollback to previous working version
ssh ubuntu@168.138.151.63 "kubectl rollout undo deployment prometheus-grafana -n observability"

# Wait for pod to stabilize
ssh ubuntu@168.138.151.63 "kubectl get pods -n observability -l app.kubernetes.io/name=grafana -w"
```

**Prevention:** Never restart Grafana - use sidecar auto-reload instead.

### ConfigMap not updating

```bash
# Verify ConfigMap exists with correct label
ssh ubuntu@168.138.151.63 "kubectl get configmap grafana-dashboards-ephemeral -n observability --show-labels"

# Label must include: grafana_dashboard=1
```

### Empty namespace dropdown

PR namespace variable returns no results:

```bash
# Test the metric query
ssh ubuntu@168.138.151.63 "kubectl exec prometheus-prometheus-prometheus-0 -n observability -c prometheus -- \
  wget -q -O - 'http://localhost:9090/api/v1/query?query=kube_namespace_status_phase{namespace=~\".*-pr-.*\"}'"
```

If empty, no PR environments exist. Create a PR to generate one.

### No data in panels

1. Check namespace is selected
2. Verify metrics exist:
   ```bash
   ssh ubuntu@168.138.151.63 "kubectl exec prometheus-prometheus-prometheus-0 -n observability -c prometheus -- \
     wget -q -O - 'http://localhost:9090/api/v1/query?query=kube_pod_status_phase{namespace=\"k8s-ee-pr-XX\"}'"
   ```

### Log panels showing no data

**Symptoms:** Logs panels (type: logs) show "No data" even when Explore works fine.

**Cause:** Dashboard uses hardcoded `"uid": "loki"` instead of the `${DS_LOKI}` variable.

**Fix:**
1. Add `DS_LOKI` variable to dashboard's `templating.list` (see section 4 above)

2. Change all Loki panel datasource references from:
   ```json
   "datasource": { "type": "loki", "uid": "loki" }
   ```
   To:
   ```json
   "datasource": { "type": "loki", "uid": "${DS_LOKI}" }
   ```

3. Update both the panel-level AND target-level datasource references

4. Redeploy the dashboard ConfigMap

### Loki metrics panels showing no data

**Symptoms:** Panels showing Loki metrics (e.g., Active Streams, Ingestion Rate) display "No data".

**Cause:** Loki ServiceMonitor not enabled - Prometheus isn't scraping Loki metrics.

**Fix:**
1. Enable ServiceMonitor in Loki Helm values:
   ```yaml
   # k8s/observability/loki/values.yaml
   monitoring:
     serviceMonitor:
       enabled: true
       labels:
         release: prometheus
   ```

2. Upgrade Loki:
   ```bash
   helm upgrade loki grafana/loki -n observability -f k8s/observability/loki/values.yaml
   ```

3. Verify ServiceMonitor exists:
   ```bash
   kubectl get servicemonitor -n observability | grep loki
   ```

---

## Dashboard Layout Best Practices

### Panel sizing

| Panel Type | Height (h) | Width (w) |
|------------|------------|-----------|
| Stat | 4 | 3-6 |
| Gauge | 4-5 | 4-6 |
| Time Series | 7 | 8 or 12 |
| Bar Chart | 7 | 8 |
| Pie/Donut | 7 | 8 |
| Table | 8 | 24 |
| Logs | 10 | 24 |

### Visual settings

```json
{
  "fieldConfig": {
    "defaults": {
      "custom": {
        "lineWidth": 2,
        "fillOpacity": 20,
        "gradientMode": "opacity",
        "lineInterpolation": "smooth"
      }
    }
  },
  "options": {
    "tooltip": {
      "mode": "multi"
    }
  }
}
```

### Color overrides by status

```json
{
  "overrides": [
    {
      "matcher": { "id": "byName", "options": "Running" },
      "properties": [{ "id": "color", "value": { "fixedColor": "green" }}]
    },
    {
      "matcher": { "id": "byName", "options": "Pending" },
      "properties": [{ "id": "color", "value": { "fixedColor": "yellow" }}]
    },
    {
      "matcher": { "id": "byName", "options": "Failed" },
      "properties": [{ "id": "color", "value": { "fixedColor": "red" }}]
    }
  ]
}
```

---

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    Dashboard Reload Flow                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Update ConfigMap (grafana-dashboards-ephemeral)          │
│                          ↓                                   │
│  2. Sidecar detects change (polls every 30s)                 │
│                          ↓                                   │
│  3. Sidecar writes JSON to /tmp/dashboards/                  │
│                          ↓                                   │
│  4. Grafana provisioner reads directory                      │
│                          ↓                                   │
│  5. Dashboard appears in Grafana UI                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Components:**
- **grafana-sc-dashboard** - Sidecar that watches ConfigMaps with `grafana_dashboard=1` label
- **Grafana provisioner** - Reads dashboard JSON from `/tmp/dashboards/`
- **ConfigMap** - Stores dashboard JSON files with required label

---

## Related Documentation

- [Dashboard README](../../k8s/observability/dashboards/README.md) - Dashboard descriptions and metrics
- [VPS Access](./vps-access.md) - SSH connection details
