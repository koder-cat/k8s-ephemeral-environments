# Observability Stack

This directory contains the configuration for the k8s-ephemeral-environments observability stack.

## Components

| Component | Description | Status |
|-----------|-------------|--------|
| [kube-prometheus-stack](./kube-prometheus-stack/) | Prometheus, Grafana, Alertmanager | Deployed |
| [loki](./loki/) | Log aggregation | Deployed |
| [promtail](./promtail/) | Log collection | Deployed |
| [custom-alerts.yaml](./custom-alerts.yaml) | PrometheusRule alerts | Manual (`kubectl apply`) |

> **Note:** Custom alerts require manual deployment. See [custom-alerts-README.md](./custom-alerts-README.md) for installation instructions.

## Architecture

```
                                    ┌─────────────────────┐
                                    │      Grafana        │
                                    │  grafana.k8s-ee.    │
                                    │   genesluna.dev     │
                                    └─────────┬───────────┘
                                              │
                        ┌─────────────────────┼─────────────────────┐
                        │                     │                     │
                        ▼                     ▼                     ▼
              ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
              │   Prometheus    │   │      Loki       │   │  Alertmanager   │
              │   (metrics)     │   │    (logs)       │   │   (alerts)      │
              └────────┬────────┘   └────────┬────────┘   └─────────────────┘
                       │                     │
         ┌─────────────┼─────────────┐       │
         │             │             │       │
         ▼             ▼             ▼       ▼
   ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐
   │  node-    │ │  kube-    │ │   App     │ │ Promtail  │
   │ exporter  │ │  state-   │ │  Pods     │ │ DaemonSet │
   │ (nodes)   │ │  metrics  │ │           │ │ (logs)    │
   └───────────┘ └───────────┘ └───────────┘ └───────────┘
```

## Quick Start

### 1. Deploy Prometheus + Grafana

See [kube-prometheus-stack/README.md](./kube-prometheus-stack/README.md) for detailed instructions.

```bash
# Prerequisites: Create GitHub OAuth App for Grafana

# Create namespace
kubectl create namespace observability

# Create OAuth secrets (replace with your credentials)
kubectl create secret generic grafana-oauth-secrets \
  --namespace observability \
  --from-literal=GF_AUTH_GITHUB_CLIENT_ID="<CLIENT_ID>" \
  --from-literal=GF_AUTH_GITHUB_CLIENT_SECRET="<CLIENT_SECRET>"

# Install kube-prometheus-stack
helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
  --namespace observability \
  --values k8s/observability/kube-prometheus-stack/values.yaml \
  --wait --timeout 10m

# Apply Grafana ingress
kubectl apply -f k8s/observability/grafana-ingress.yaml
```

### 2. Access Grafana

- URL: https://grafana.k8s-ee.genesluna.dev
- Authentication: GitHub OAuth only (password login disabled)
- Access Control: Only members of the configured GitHub organization can login
- User Role: **Editor** (allows access to Explore for querying logs and metrics)

## Resource Budget

The observability stack is designed to stay within ~4GB total memory:

| Component | Memory Limit |
|-----------|--------------|
| Prometheus | 1536Mi |
| Grafana | 256Mi |
| Alertmanager | 64Mi |
| node-exporter | 64Mi |
| kube-state-metrics | 64Mi |
| Prometheus Operator | 128Mi |
| Loki | 1024Mi |
| Promtail | 128Mi |
| **Total** | **~3.3GB** |

## Namespace

All observability components are deployed to the `observability` namespace:

```bash
kubectl get all -n observability
```

## Monitoring Ephemeral PR Environments

The Prometheus configuration is set to scrape all namespaces, including ephemeral PR namespaces (`*-pr-*`). This allows:

- Automatic discovery of new PR environment pods
- Metrics collection without additional configuration
- Dashboard filtering by namespace

To view metrics for a specific PR environment in Grafana:
1. Open a dashboard
2. Use the namespace filter dropdown
3. Select the PR namespace (e.g., `k8s-ee-pr-42`)

## Troubleshooting

### Check Pod Status

```bash
kubectl get pods -n observability
```

### View Logs

```bash
# Prometheus
kubectl logs -n observability -l app.kubernetes.io/name=prometheus --tail=100

# Grafana
kubectl logs -n observability -l app.kubernetes.io/name=grafana --tail=100

# Alertmanager
kubectl logs -n observability -l app.kubernetes.io/name=alertmanager --tail=100

# Loki
kubectl logs -n observability -l app.kubernetes.io/name=loki --tail=100

# Promtail
kubectl logs -n observability -l app.kubernetes.io/name=promtail --tail=100
```

### Port Forward for Debugging

```bash
# Prometheus UI
kubectl port-forward -n observability svc/prometheus-kube-prometheus-prometheus 9090:9090

# Grafana (alternative to ingress)
kubectl port-forward -n observability svc/prometheus-grafana 3000:80

# Alertmanager
kubectl port-forward -n observability svc/prometheus-kube-prometheus-alertmanager 9093:9093
```
