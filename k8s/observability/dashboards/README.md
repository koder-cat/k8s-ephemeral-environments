# Grafana Dashboards

Custom Grafana dashboards for monitoring PR ephemeral environments and platform health.

## Dashboard Overview

| Dashboard | UID | Purpose | Key Use Case |
|-----------|-----|---------|--------------|
| [PR Developer Insights](#pr-developer-insights) | `pr-developer-insights` | Developer debugging view | Quick health check, errors, performance |
| [PR Environment Overview](#pr-environment-overview) | `pr-environment-overview` | Single PR namespace monitoring | Debug specific PR environment issues |
| [Application Metrics](#application-metrics) | `application-metrics` | Application-level metrics | Monitor app performance and database |
| [Multi-PR Comparison](#multi-pr-comparison) | `multi-pr-comparison` | Compare multiple PR environments | A/B testing, performance comparison |
| [Platform Health](#platform-health) | `platform-health` | Infrastructure monitoring | Monitor Prometheus, Loki, nodes |
| [PR Lifecycle](#pr-lifecycle) | `pr-lifecycle` | Environment lifecycle tracking | Monitor cleanup jobs, preserved envs |
| [Resource Allocation](#resource-allocation) | `resource-allocation` | Capacity planning | Track quota usage, top consumers |
| [SLO Dashboard](#slo-dashboard) | `slo-dashboard` | Service Level Objectives | Track availability, latency SLOs |

---

## Dashboards

### PR Developer Insights

- **UID:** `pr-developer-insights`
- **Purpose:** Developer-focused view for quickly debugging PR environments
- **Tags:** `k8s-ee`, `ephemeral`, `developer`
- **Variable:** `namespace` - PR environment to monitor

**Panels:**

| Row | Panels |
|-----|--------|
| Health at a Glance | App Status, Error Rate, P95 Latency, Request Rate, DB Connected, Pods Running |
| Errors & Problems | 5xx Errors by Endpoint, Recent Error Logs (pre-filtered) |
| Performance | P95 Response Time by Endpoint, Requests by Status, Slowest Endpoints |
| Database | Connection Pool, Query Duration by Operation, Failed Queries |

**Key Features:**
- Color-coded health indicators (green/yellow/red)
- Error logs pre-filtered to show only errors, exceptions, and failures
- P95 latency prominently displayed for performance awareness
- Slowest endpoints bar gauge for quick identification
- Database connection pool and query performance visibility
- Links to Application Metrics and PR Environment Overview for deeper dives

**Best For:**
- Developers checking if their PR environment is healthy
- Quick identification of errors and performance issues
- First stop when something seems wrong

---

### PR Environment Overview

- **UID:** `pr-environment-overview`
- **Purpose:** High-level overview of a single PR namespace
- **Tags:** `k8s-ee`, `ephemeral`, `overview`
- **Variable:** `namespace` - PR environment to monitor

**Panels:**

| Row | Panels |
|-----|--------|
| Overview | Running Pods, OOM Kills, Init Containers Waiting, Pod Status Breakdown |
| Resource Usage | CPU Usage, Memory Usage, Network I/O |
| Logs | Pod Logs (filterable by text) |

**Key Features:**
- OOM kills alert (red threshold when > 0)
- Init container stuck detection
- Pod status breakdown (Running/Pending/Failed/Succeeded)
- Log text filter for searching logs
- Link to Application Metrics dashboard

---

### Application Metrics

- **UID:** `application-metrics`
- **Purpose:** Application-level metrics from demo-app
- **Tags:** `k8s-ee`, `ephemeral`, `application`
- **Variable:** `namespace` - PR environment to monitor

**Panels:**

| Row | Panels |
|-----|--------|
| HTTP Metrics | Request Rate, Requests by Status, Request Rate by Status Code, Request Duration (p50/p95/p99) |
| Database Metrics | Pool Connections, Query Duration by Operation, DB Query Success vs Failed |
| Node.js Runtime | Memory Usage, Event Loop Lag, Active Handles & Requests |

**Key Features:**
- Status code color coding (2xx=green, 3xx=blue, 4xx=yellow, 5xx=red)
- Database query breakdown by operation type
- Success vs failed query tracking
- Event loop lag monitoring
- Link to PR Environment Overview dashboard

**Database Query Labels:**
- `operation`: Query type (`query`, `health_check`, `list_tables`, `db_size`)
- `success`: Whether query succeeded (`true`, `false`)

---

### Multi-PR Comparison

- **UID:** `multi-pr-comparison`
- **Purpose:** Compare metrics across multiple PR environments
- **Tags:** `k8s-ee`, `ephemeral`, `comparison`, `multi-pr`
- **Variable:** `namespaces` - Multi-select PR environments

**Panels:**

| Row | Panels |
|-----|--------|
| Overview | Total Active PRs, Running Pods by Namespace |
| Performance | Request Rate (stacked), P95 Latency Comparison, Error Rate Comparison |
| Resources | CPU Usage, Memory Usage, Network I/O |

**Key Features:**
- Multi-select namespace variable
- Stacked visualizations for comparison
- Side-by-side performance metrics
- Useful for A/B testing different PR implementations

---

### Platform Health

- **UID:** `platform-health`
- **Purpose:** Monitor permanent infrastructure components
- **Tags:** `k8s-ee`, `platform`, `infrastructure`, `health`
- **Variable:** None (monitors fixed namespaces)

**Panels:**

| Row | Panels |
|-----|--------|
| Platform Overview | Active PR Environments, Node CPU/Memory/Disk, GitHub Runners, Scrape Success Rate |
| Prometheus | Storage Used, Active Targets, Ingestion Rate, Query Duration |
| Loki | Ingestion Rate, Active Streams |
| GitHub Runners | CPU Usage, Memory Usage |
| Node Resources | CPU Trend, Memory Trend |

**Key Features:**
- Node resource monitoring with threshold alerts
- Prometheus TSDB storage tracking
- Loki ingestion monitoring
- GitHub runner resource usage
- No namespace variable (platform-wide view)

---

### PR Lifecycle

- **UID:** `pr-lifecycle`
- **Purpose:** Track PR environment lifecycle, cleanup, and preservation
- **Tags:** `k8s-ee`, `ephemeral`, `lifecycle`, `cleanup`
- **Variable:** None (monitors all PR namespaces)

**Panels:**

| Row | Panels |
|-----|--------|
| Current State | Active Environments, Preserved Environments, Total Pod Restarts, Pod Status Over Time |
| Resource Usage | CPU by Environment, Memory by Environment |
| Cleanup Status | Cleanup Job Last Success, Preserve Job Last Success |
| Active Environments | Table with Namespace, PR Number, Age, CPU, Memory |

**Key Features:**
- Preserved environment tracking
- Cleanup job monitoring
- Environment age tracking
- Detailed environment table with resource usage
- Pod restart aggregation across all PRs

---

### Resource Allocation

- **UID:** `resource-allocation`
- **Purpose:** Capacity planning and resource efficiency tracking
- **Tags:** `k8s-ee`, `ephemeral`, `resources`, `capacity`
- **Variable:** None (monitors all PR namespaces)

**Panels:**

| Row | Panels |
|-----|--------|
| Overview | CPU Used vs Quota (gauge), Memory Used vs Quota (gauge), CPU/Memory quota totals |
| Top Consumers | Top 10 CPU Consumers, Top 10 Memory Consumers |
| Trends | CPU Usage Over Time (stacked), Memory Usage Over Time (stacked) |
| Node Capacity | Node CPU Available, Node Memory Available, Memory Breakdown |

**Key Features:**
- Quota vs actual usage gauges
- Top consumer identification
- Historical usage trends
- Node capacity headroom monitoring
- Resource efficiency metrics

---

### SLO Dashboard

- **UID:** `slo-dashboard`
- **Purpose:** Service Level Objective tracking and error budget management
- **Tags:** `k8s-ee`, `ephemeral`, `slo`, `reliability`
- **Variable:** `namespace` - PR environment to monitor

**SLO Definitions:**
- **Availability SLO:** 99.9% (probe success rate)
- **Latency SLO:** 99% of requests < 500ms
- **Allowed Error Rate:** 1%

**Panels:**

| Row | Panels |
|-----|--------|
| SLO Status | Availability SLO (gauge), Latency SLO (gauge), Error Budget Remaining (gauge) |
| Current Metrics | Current Error Rate, P99 Latency, Request Rate, Running Pods |
| Burn Rate | Error Budget Burn Rate (1h window), Error Budget Burn Rate (6h window) |
| Historical | Error Rate Over Time, Latency Percentiles (p50/p95/p99), Request Rate by Status Code |

**Key Features:**
- Color-coded SLO compliance gauges
- Error budget tracking with burn rate
- Multi-window burn rate analysis (1h, 6h)
- Latency percentile trends
- Status code breakdown for debugging

---

## Deployment

> **See [Grafana Dashboards Runbook](../../../docs/runbooks/grafana-dashboards.md) for step-by-step operational instructions.**

### Deploy dashboards to cluster

The dashboards are deployed via a ConfigMap with a special label that the Grafana sidecar watches.

> **WARNING: Do NOT restart Grafana after updating dashboards.** The sidecar automatically reloads dashboards every ~30 seconds. Restarting Grafana can cause race conditions where it crashes with "data source not found" errors.

```bash
# Copy dashboard files to VPS
scp k8s/observability/dashboards/*.json ubuntu@168.138.151.63:/tmp/dashboards/

# Update ConfigMap (sidecar auto-reloads - NO restart needed)
ssh ubuntu@168.138.151.63 "kubectl create configmap grafana-dashboards-ephemeral \
  --from-file=/tmp/dashboards/ \
  -n observability --dry-run=client -o yaml | \
kubectl label --local -f - grafana_dashboard=1 -o yaml | \
kubectl apply -f -"

# Wait ~30 seconds for sidecar to detect changes
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
3. Filter by tag `k8s-ee` to find all project dashboards

**Direct URLs:**
- https://grafana.k8s-ee.genesluna.dev/d/pr-environment-overview
- https://grafana.k8s-ee.genesluna.dev/d/application-metrics
- https://grafana.k8s-ee.genesluna.dev/d/multi-pr-comparison
- https://grafana.k8s-ee.genesluna.dev/d/platform-health
- https://grafana.k8s-ee.genesluna.dev/d/pr-lifecycle
- https://grafana.k8s-ee.genesluna.dev/d/resource-allocation
- https://grafana.k8s-ee.genesluna.dev/d/slo-dashboard

---

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
- **Prometheus:** `prometheus` (hardcoded)
- **Loki:** `${DS_LOKI}` (variable - see below)
- **Alertmanager:** `alertmanager` (hardcoded)

**Prometheus/Alertmanager** - use hardcoded UID:
```json
{
  "datasource": {
    "type": "prometheus",
    "uid": "prometheus"
  }
}
```

**Loki** - MUST use `${DS_LOKI}` variable (hardcoded `"uid": "loki"` will NOT work):
```json
{
  "datasource": {
    "type": "loki",
    "uid": "${DS_LOKI}"
  }
}
```

Dashboards using Loki must also include this variable in `templating.list`:
```json
{
  "current": {},
  "hide": 2,
  "name": "DS_LOKI",
  "query": "loki",
  "type": "datasource"
}
```

### Step 3: Add required tags

All dashboards should include the `k8s-ee` tag for easy filtering:

```json
{
  "tags": ["k8s-ee", "your-other-tags"]
}
```

### Step 4: Verify Prometheus metrics exist

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

### Step 5: Configure namespace variable

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

### Step 6: Deploy to cluster

Add your dashboard to the ConfigMap and apply (see [Deployment](#deployment) section).

---

## How It Works

1. **Grafana sidecar** (`grafana-sc-dashboard`) watches for ConfigMaps with label `grafana_dashboard=1`
2. When found, it extracts `.json` files from the ConfigMap data
3. Files are written to `/tmp/dashboards/` in the Grafana pod
4. Grafana's provisioning reads from this directory every 30 seconds
5. Dashboards appear in the Grafana UI

---

## Dependencies

### Metrics Sources

| Dashboard | Required Metrics |
|-----------|-----------------|
| PR Environment Overview | kube-state-metrics, cAdvisor, Loki |
| Application Metrics | demo-app `/metrics` (prom-client), ServiceMonitor |
| Multi-PR Comparison | Same as PR Environment Overview + Application Metrics |
| Platform Health | node-exporter, Prometheus internal metrics, Loki metrics |
| PR Lifecycle | kube-state-metrics, CronJob metrics |
| Resource Allocation | kube-state-metrics, cAdvisor, node-exporter |
| SLO Dashboard | demo-app metrics, probe metrics |

### Key Metrics

**Kubernetes (kube-state-metrics):**
- `kube_pod_status_phase` - Pod phase (Running/Pending/etc)
- `kube_pod_container_status_restarts_total` - Container restarts
- `kube_pod_container_status_last_terminated_reason` - Termination reason (OOMKilled)
- `kube_namespace_status_phase` - Namespace status
- `kube_resourcequota` - ResourceQuota limits and usage

**Container (cAdvisor):**
- `container_cpu_usage_seconds_total` - CPU usage
- `container_memory_working_set_bytes` - Memory usage
- `container_network_*` - Network I/O

**Node (node-exporter):**
- `node_cpu_seconds_total` - Node CPU
- `node_memory_*` - Node memory
- `node_filesystem_*` - Node disk

**Application (demo-app):**
- `http_requests_total` - Request counter with route, method, status_code
- `http_request_duration_seconds` - Request latency histogram
- `db_pool_connections_*` - Database connection pool gauges
- `db_query_duration_seconds` - Query duration with operation, success labels

**Route Label Normalization:**

The metrics middleware normalizes dynamic path segments to prevent high cardinality:

| Actual Path | Normalized Route Label |
|-------------|----------------------|
| `/api/simulator/status/500` | `/api/simulator/status/:code` |
| `/api/simulator/latency/slow` | `/api/simulator/latency/:preset` |
| `/api/db-test/heavy-query/medium` | `/api/db-test/heavy-query/:intensity` |
| `/api/users/123` | `/api/users/:id` |
| `/api/items/550e8400-e29b-41d4-a716-446655440000` | `/api/items/:uuid` |

Static assets (`/assets/*`) and the `/metrics` endpoint are excluded from metrics recording.

See [demo-app API README](../../../demo-app/apps/api/README.md#prometheus-metrics) for full metrics documentation.

---

## Troubleshooting

> **See [Grafana Dashboards Runbook](../../../docs/runbooks/grafana-dashboards.md) for detailed troubleshooting steps.**

### Grafana crashed after restart

**Symptoms:** Pod in CrashLoopBackOff with "Datasource provisioning error: data source not found"

**Cause:** Race condition - Grafana starts before sidecar writes datasource files

**Fix:**
```bash
kubectl rollout undo deployment prometheus-grafana -n observability
```

**Prevention:** Never restart Grafana manually. The sidecar auto-reloads dashboards.

### Dashboards not appearing in Grafana

1. **Wait 30 seconds** for sidecar to reload

2. **Check ConfigMap label:**
   ```bash
   kubectl get configmap grafana-dashboards-ephemeral -n observability -o jsonpath='{.metadata.labels}'
   # Should include: grafana_dashboard: "1"
   ```

3. **Verify sidecar loaded files:**
   ```bash
   kubectl exec -n observability $(kubectl get pod -n observability -l app.kubernetes.io/name=grafana -o name | head -1) \
     -c grafana -- ls /tmp/dashboards/
   ```

4. **Check sidecar logs:**
   ```bash
   kubectl logs -n observability -l app.kubernetes.io/name=grafana -c grafana-sc-dashboard
   ```

5. **Last resort - delete pod (NOT rollout restart):**
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

1. **Check if Explore works** - Go to Grafana Explore, select Loki, run `{namespace="k8s-ee-pr-XX"}`
2. **If Explore works but dashboard doesn't:**
   - Dashboard is using hardcoded `"uid": "loki"` instead of `${DS_LOKI}` variable
   - Fix: Change datasource to `"uid": "${DS_LOKI}"` and add `DS_LOKI` variable to templating
   - See "Datasource UIDs" section above for details
3. **If Explore also fails**, verify logs exist:
   ```bash
   kubectl exec -n observability $(kubectl get pod -n observability -l app.kubernetes.io/name=grafana -o name | head -1) \
     -c grafana -- wget -q -O - 'http://loki-gateway.observability:80/loki/api/v1/query?query={namespace="k8s-ee-pr-XX"}'
   ```

### SLO metrics showing 0 or no data

1. **Verify probe_success metric exists** (requires blackbox-exporter or similar)
2. **Check http_requests_total** is being scraped
3. **Ensure ServiceMonitor** is configured for the namespace
