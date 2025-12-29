# kube-prometheus-stack

The kube-prometheus-stack provides a complete monitoring solution including Prometheus, Grafana, Alertmanager, and various exporters.

## Components

| Component | Purpose |
|-----------|---------|
| Prometheus | Metrics collection and storage |
| Grafana | Visualization and dashboards |
| Alertmanager | Alert routing and notifications |
| node-exporter | Node-level metrics (CPU, memory, disk) |
| kube-state-metrics | Kubernetes object metrics |
| Prometheus Operator | CRD-based Prometheus management |

## Prerequisites

1. **GitHub Organization** for access control:
   - Create a GitHub organization (e.g., `koder-cat`)
   - Add team members who should have Grafana access

2. **GitHub OAuth App** for Grafana authentication:
   - Go to https://github.com/settings/developers
   - Create new OAuth App with:
     - Homepage URL: `https://grafana.k8s-ee.genesluna.dev`
     - Callback URL: `https://grafana.k8s-ee.genesluna.dev/login/github`
   - Save the Client ID and Client Secret

## Installation

```bash
# Add the Helm repository
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Create the namespace
kubectl create namespace observability

# Create OAuth secrets (DO NOT commit actual credentials to git!)
# Option 1: Create secret from template
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Secret
metadata:
  name: grafana-oauth-secrets
  namespace: observability
type: Opaque
stringData:
  GF_AUTH_GITHUB_CLIENT_ID: "<YOUR_CLIENT_ID>"
  GF_AUTH_GITHUB_CLIENT_SECRET: "<YOUR_CLIENT_SECRET>"
EOF

# Option 2: Create secret using kubectl
kubectl create secret generic grafana-oauth-secrets \
  --namespace observability \
  --from-literal=GF_AUTH_GITHUB_CLIENT_ID="<YOUR_CLIENT_ID>" \
  --from-literal=GF_AUTH_GITHUB_CLIENT_SECRET="<YOUR_CLIENT_SECRET>"

# Install kube-prometheus-stack
helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
  --namespace observability \
  --values k8s/observability/kube-prometheus-stack/values.yaml \
  --wait --timeout 10m

# Apply the Grafana ingress
kubectl apply -f k8s/observability/grafana-ingress.yaml
```

## Verify Installation

```bash
# Check all pods are running
kubectl get pods -n observability

# Expected pods:
# - prometheus-prometheus-kube-prometheus-prometheus-0
# - prometheus-grafana-*
# - prometheus-kube-prometheus-operator-*
# - prometheus-kube-state-metrics-*
# - prometheus-prometheus-node-exporter-*
# - alertmanager-prometheus-kube-prometheus-alertmanager-0

# Check Prometheus targets
kubectl port-forward -n observability svc/prometheus-kube-prometheus-prometheus 9090:9090
# Open http://localhost:9090/targets

# Check Grafana
kubectl port-forward -n observability svc/prometheus-grafana 3000:80
# Open http://localhost:3000 (or use the ingress URL)
```

## Access

| Service | URL | Notes |
|---------|-----|-------|
| Grafana | https://grafana.k8s-ee.genesluna.dev | GitHub OAuth only (password login disabled) |
| Prometheus | Port-forward only | `kubectl port-forward svc/prometheus-kube-prometheus-prometheus 9090:9090 -n observability` |
| Alertmanager | Port-forward only | `kubectl port-forward svc/prometheus-kube-prometheus-alertmanager 9093:9093 -n observability` |

**Authentication:** Only members of the configured GitHub organization can access Grafana. Password-based login is disabled for security.

**User Role:** All OAuth users are assigned the **Editor** role, which allows access to:
- Explore (query Prometheus metrics and Loki logs)
- Dashboards (view and edit)
- Alerting (view alert rules)

## Resource Usage

| Component | Memory Request | Memory Limit |
|-----------|----------------|--------------|
| Prometheus | 512Mi | 1536Mi |
| Grafana | 128Mi | 256Mi |
| Alertmanager | 32Mi | 64Mi |
| node-exporter | 32Mi | 64Mi |
| kube-state-metrics | 32Mi | 64Mi |
| Prometheus Operator | 64Mi | 128Mi |

## Configuration

### Adding ServiceMonitors

To scrape metrics from your applications, create a ServiceMonitor:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: my-app
  namespace: my-namespace
  labels:
    release: prometheus  # Must match the Helm release
spec:
  selector:
    matchLabels:
      app: my-app
  endpoints:
    - port: metrics
      interval: 30s
```

### Adding Custom Alerts

Create a PrometheusRule resource:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: my-alerts
  namespace: observability
  labels:
    release: prometheus
spec:
  groups:
    - name: my-alerts
      rules:
        - alert: HighMemoryUsage
          expr: container_memory_usage_bytes > 1e9
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: "High memory usage detected"
```

## Upgrade

```bash
helm repo update
helm upgrade prometheus prometheus-community/kube-prometheus-stack \
  --namespace observability \
  --values k8s/observability/kube-prometheus-stack/values.yaml \
  --wait --timeout 10m
```

Note: OAuth credentials are stored in the `grafana-oauth-secrets` Kubernetes Secret and persist across upgrades.

## Uninstallation

```bash
# Delete the Helm release
helm uninstall prometheus -n observability

# Delete PVCs (optional - removes all data)
kubectl delete pvc -n observability -l app.kubernetes.io/instance=prometheus

# Delete the namespace (optional)
kubectl delete namespace observability
```

## Troubleshooting

### Prometheus Not Scraping Targets

1. Check ServiceMonitor labels match `release: prometheus`
2. Verify the service has the correct port name
3. Check Prometheus configuration: `kubectl get prometheus -n observability -o yaml`

### Grafana Login Issues

1. Verify GitHub OAuth App callback URL is correct
2. Check Grafana logs: `kubectl logs -n observability -l app.kubernetes.io/name=grafana`
3. Verify OAuth secrets exist: `kubectl get secret grafana-oauth-secrets -n observability`
4. Verify your GitHub account is a member of the allowed organization (configured in `values.yaml` under `allowed_organizations`)
5. If you see "not a member of required organizations" error, ensure you've joined the GitHub organization

### High Memory Usage

1. Reduce retention period in values.yaml
2. Add more specific label selectors to reduce cardinality
3. Check for high-cardinality metrics

## References

- [kube-prometheus-stack Chart](https://artifacthub.io/packages/helm/prometheus-community/kube-prometheus-stack)
- [Prometheus Operator Documentation](https://prometheus-operator.dev/)
- [Grafana Documentation](https://grafana.com/docs/grafana/latest/)
