# Grafana Dashboards

Custom Grafana dashboards for monitoring PR ephemeral environments.

## Dashboards

### PR Environment Overview

- **UID:** `pr-environment-overview`
- **Purpose:** High-level overview of a PR namespace
- **Panels:**
  - Running Pods count
  - CPU/Memory quota usage gauges
  - Pod restarts count
  - CPU usage by pod
  - Memory usage by pod
  - Network I/O
  - Recent logs (Loki)

### Application Metrics

- **UID:** `application-metrics`
- **Purpose:** Application-level metrics from demo-app
- **Panels:**
  - Request rate by route
  - Request duration (p50/p95/p99)
  - Error rate (5xx)
  - Requests by status code (pie chart)
  - Database connection pool (total, idle, waiting)
  - Database query duration (by operation and success)
  - Node.js memory (resident, heap used, heap total)
  - Event loop lag

**Database Query Duration Labels:**
- `operation`: Query type (`query`, `health_check`, `list_tables`, `db_size`)
- `success`: Whether query succeeded (`true`, `false`)

## Deployment

### Deploy dashboards to cluster

The dashboards are deployed via a ConfigMap with a special label that the Grafana sidecar watches.

```bash
# Create ConfigMap with the dashboard JSON files and required label
kubectl create configmap grafana-dashboards-ephemeral \
  --from-file=pr-environment-overview.json \
  --from-file=application-metrics.json \
  -n observability --dry-run=client -o yaml | \
kubectl label --local -f - grafana_dashboard=1 -o yaml | \
kubectl apply -f -

# Restart Grafana to reload dashboards (or wait ~30 seconds)
kubectl rollout restart deployment prometheus-grafana -n observability
```

### Verify deployment

```bash
# Check ConfigMap exists with correct label
kubectl get configmap grafana-dashboards-ephemeral -n observability --show-labels

# Verify dashboards are loaded in sidecar
kubectl exec -n observability $(kubectl get pod -n observability -l app.kubernetes.io/name=grafana -o name | head -1) \
  -c grafana-sc-dashboard -- ls -la /tmp/dashboards/

# Check sidecar logs for errors
kubectl logs -n observability -l app.kubernetes.io/name=grafana -c grafana-sc-dashboard
```

### Access dashboards

1. Open Grafana: https://grafana.k8s-ee.genesluna.dev
2. Navigate to **Dashboards** > **Browse**
3. Find "PR Environment Overview" and "Application Metrics"

Or use direct URLs:
- https://grafana.k8s-ee.genesluna.dev/d/pr-environment-overview
- https://grafana.k8s-ee.genesluna.dev/d/application-metrics

## Creating New Dashboards

### Step 1: Create dashboard JSON

1. Create dashboard in Grafana UI (easier for initial design)
2. Export as JSON: Dashboard Settings > JSON Model > Copy
3. Save to `k8s/observability/dashboards/<name>.json`

### Step 2: Fix datasource UIDs

Dashboard JSON must use the correct datasource UIDs. Check available datasources:

```bash
kubectl get configmap prometheus-grafana-datasource -n observability -o yaml
```

Current datasource UIDs:
- **Prometheus:** `prometheus`
- **Loki:** `loki`
- **Alertmanager:** `alertmanager`

In dashboard JSON, update all datasource references:
```json
{
  "datasource": {
    "type": "prometheus",
    "uid": "prometheus"
  }
}
```

### Step 3: Verify Prometheus metrics exist

Before using a metric in a query, verify it exists:

```bash
# List available metrics
kubectl exec -n observability prometheus-prometheus-prometheus-0 -c prometheus -- \
  sh -c 'wget -q -O - "http://localhost:9090/api/v1/label/__name__/values"' | grep <metric_name>

# Test a specific query
kubectl exec -n observability prometheus-prometheus-prometheus-0 -c prometheus -- \
  sh -c 'wget -q -O - "http://localhost:9090/api/v1/query?query=<your_query>"'
```

**Common gotcha:** `kube_namespace_labels` doesn't exist in kube-state-metrics. Use `kube_namespace_status_phase` instead for namespace variables.

### Step 4: Configure namespace variable

For dashboards that filter by PR namespace, use this variable query:

```json
{
  "definition": "label_values(kube_namespace_status_phase{namespace=~\".*-pr-.*\"}, namespace)",
  "query": {
    "query": "label_values(kube_namespace_status_phase{namespace=~\".*-pr-.*\"}, namespace)",
    "refId": "StandardVariableQuery"
  }
}
```

### Step 5: Deploy to cluster

```bash
# Add to ConfigMap and apply
kubectl create configmap grafana-dashboards-ephemeral \
  --from-file=pr-environment-overview.json \
  --from-file=application-metrics.json \
  --from-file=<your-new-dashboard>.json \
  -n observability --dry-run=client -o yaml | \
kubectl label --local -f - grafana_dashboard=1 -o yaml | \
kubectl apply -f -

# Restart Grafana
kubectl rollout restart deployment prometheus-grafana -n observability
```

## How It Works

1. **Grafana sidecar** (`grafana-sc-dashboard`) watches for ConfigMaps with label `grafana_dashboard=1`
2. When found, it extracts `.json` files from the ConfigMap data
3. Files are written to `/tmp/dashboards/` in the Grafana pod
4. Grafana's provisioning reads from this directory every 30 seconds
5. Dashboards appear in the Grafana UI

## Dependencies

### PR Environment Overview
- **Prometheus metrics:** kube-state-metrics, cadvisor (kubelet)
- **Loki:** for logs panel

### Application Metrics
- **Custom metrics:** demo-app `/metrics` endpoint (prom-client)
- **ServiceMonitor:** configured in demo-app Helm chart
- **Scraping:** Prometheus Operator auto-discovers via ServiceMonitor

**Key metrics:**
- `http_requests_total` - Request counter with route, method, status_code
- `http_request_duration_seconds` - Request latency histogram
- `db_pool_connections_*` - Database connection pool gauges
- `db_query_duration_seconds` - Query duration with operation, success labels

See [demo-app API README](../../../demo-app/apps/api/README.md#prometheus-metrics) for full metrics documentation.

## Troubleshooting

### Dashboards not appearing in Grafana

1. **Check ConfigMap label:**
   ```bash
   kubectl get configmap grafana-dashboards-ephemeral -n observability -o jsonpath='{.metadata.labels}'
   # Should include: grafana_dashboard: "1"
   ```

2. **Verify sidecar loaded files:**
   ```bash
   kubectl exec -n observability $(kubectl get pod -n observability -l app.kubernetes.io/name=grafana -o name | head -1) \
     -c grafana-sc-dashboard -- ls /tmp/dashboards/
   ```

3. **Check sidecar logs:**
   ```bash
   kubectl logs -n observability -l app.kubernetes.io/name=grafana -c grafana-sc-dashboard
   ```

4. **Force reload:**
   ```bash
   kubectl delete pod -n observability -l app.kubernetes.io/name=grafana
   ```

### Namespace dropdown is empty

The variable query metric doesn't exist or returns no results:

```bash
# Test the query
kubectl exec -n observability prometheus-prometheus-prometheus-0 -c prometheus -- \
  sh -c 'wget -q -O - "http://localhost:9090/api/v1/query?query=kube_namespace_status_phase{namespace=~\".*-pr-.*\"}"'
```

If empty, no PR namespaces exist. Create a PR to generate one.

### No data in panels

1. **Check namespace is selected** in the dropdown
2. **Verify metrics exist** for that namespace:
   ```bash
   kubectl exec -n observability prometheus-prometheus-prometheus-0 -c prometheus -- \
     sh -c 'wget -q -O - "http://localhost:9090/api/v1/query?query=kube_pod_status_phase{namespace=\"k8s-ee-pr-XX\"}"'
   ```

3. **For Application Metrics**, verify ServiceMonitor:
   ```bash
   kubectl get servicemonitor -n k8s-ee-pr-XX
   ```

### Loki panel shows no logs

1. **Check Loki datasource UID** in dashboard JSON matches actual UID
2. **Verify logs exist:**
   ```bash
   kubectl exec -n observability $(kubectl get pod -n observability -l app.kubernetes.io/name=grafana -o name | head -1) \
     -c grafana -- wget -q -O - 'http://loki-gateway.observability:80/loki/api/v1/query?query={namespace="k8s-ee-pr-XX"}'
   ```
