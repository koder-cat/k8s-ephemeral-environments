# EC2 Cluster Setup Plan for edgebr Organization

## Context

Setting up a k3s cluster on EC2 (`ubuntu@13.58.99.235`) for the **edgebr** organization, following the edge organization guide (`docs/guides/configuracao-organizacao-edge.md` - Parte 2). This is the first external organization deployment of the k8s-ephemeral-environments platform.

**Current EC2 state:** Ubuntu 24.04, x86_64, 4 vCPUs / 15GB RAM / 96GB disk. k3s v1.34.4 installed. Platform stack running (Steps 0-6 complete).

**Remaining blockers:**
- GitHub App credentials (ARC) from edgebr DevOps — blocks Step 7
- OAuth App credentials (Grafana) from edgebr DevOps — blocks Step 9
- DNS wildcard + AWS IAM credentials for Route 53 — blocks Step 8
- edgebr fork on GitHub — blocks Step 10
- GITHUB_TOKEN for edgebr repos — blocks Step 11

## Plan

### Step 0: Copy files to EC2 ✅

The k8s/ manifests must be on the EC2 before any kubectl/helm commands. Since the edgebr fork doesn't exist yet, scp from local:

```bash
scp -r k8s/ ubuntu@13.58.99.235:~/k8s/
```

### Step 1: Install k3s ✅

```bash
ssh ubuntu@13.58.99.235

curl -sfL https://get.k3s.io | sh -s - \
  --disable=servicelb \
  --write-kubeconfig-mode=644
```

Note: `--write-kubeconfig-mode=644` makes kubeconfig world-readable. Acceptable since EC2 has controlled SSH access.

Verify: `kubectl get nodes`

### Step 2: Core Infrastructure ✅

```bash
kubectl apply -f ~/k8s/platform/priority-classes.yaml
kubectl apply -f ~/k8s/platform/namespace.yaml
```

Files: `k8s/platform/priority-classes.yaml`, `k8s/platform/namespace.yaml`

### Step 3: Database Operators ✅

```bash
helm repo add cnpg https://cloudnative-pg.github.io/charts
helm repo add mongodb https://mongodb.github.io/helm-charts
helm repo add minio https://operator.min.io
helm repo update

# CloudNativePG
helm upgrade --install cnpg cnpg/cloudnative-pg \
  -n cnpg-system --create-namespace \
  -f ~/k8s/operators/cloudnative-pg/values.yaml

# MongoDB Community Operator
helm upgrade --install mongodb-operator mongodb/community-operator \
  -n mongodb-operator --create-namespace \
  -f ~/k8s/operators/mongodb-community/values.yaml

# MinIO Operator
helm upgrade --install minio-operator minio/operator \
  -n minio-operator --create-namespace \
  -f ~/k8s/operators/minio/values.yaml
```

Verify:
```bash
kubectl get pods -n cnpg-system
kubectl get pods -n mongodb-operator
kubectl get pods -n minio-operator
```

Files: `k8s/operators/cloudnative-pg/values.yaml`, `k8s/operators/mongodb-community/values.yaml`, `k8s/operators/minio/values.yaml`

### Step 4: Observability ✅

**4a. Create edgebr overlay values file**

Create `k8s/observability/kube-prometheus-stack/values-edgebr.yaml` locally in the repo:

```yaml
# Overlay for edgebr cluster
# Applied after base values.yaml to override org-specific settings
grafana:
  # No OAuth secret yet - will be added via helm upgrade when credentials arrive
  envFromSecret: null

  grafana.ini:
    server:
      root_url: https://grafana.k8s-ee.edge.net.br
    auth.github:
      allowed_organizations: edgebr
```

Copy to EC2: `scp k8s/observability/kube-prometheus-stack/values-edgebr.yaml ubuntu@13.58.99.235:~/k8s/observability/kube-prometheus-stack/`

**4b. Install stack:**

```bash
kubectl create namespace observability

helm repo add grafana https://grafana.github.io/helm-charts
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Loki first (Grafana depends on it)
helm upgrade --install loki grafana/loki \
  -n observability \
  -f ~/k8s/observability/loki/values.yaml

# Promtail
helm upgrade --install promtail grafana/promtail \
  -n observability \
  -f ~/k8s/observability/promtail/values.yaml

# Wait for Loki
kubectl wait --for=condition=ready pod -l app.kubernetes.io/component=single-binary \
  -n observability --timeout=300s

# Prometheus + Grafana (base values + edgebr overlay)
helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
  -n observability \
  -f ~/k8s/observability/kube-prometheus-stack/values.yaml \
  -f ~/k8s/observability/kube-prometheus-stack/values-edgebr.yaml
```

Note: Grafana Ingress deferred to when DNS is configured (Step 8).

Verify: `kubectl get pods -n observability`

Files: `k8s/observability/loki/values.yaml`, `k8s/observability/promtail/values.yaml`, `k8s/observability/kube-prometheus-stack/values.yaml`

### Step 5: ARC Controller ✅

Install controller only (runner scale set needs credentials).

```bash
kubectl create namespace arc-systems
kubectl create namespace arc-runners

helm install arc \
  oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set-controller \
  -n arc-systems \
  -f ~/k8s/arc/values-controller.yaml

kubectl apply -f ~/k8s/arc/controller-rbac.yaml
kubectl apply -f ~/k8s/arc/runner-rbac.yaml
```

Note: `arc-runners` namespace must be created before `runner-rbac.yaml` since it contains a ServiceAccount in that namespace.

Verify: `kubectl get pods -n arc-systems`

Files: `k8s/arc/values-controller.yaml`, `k8s/arc/controller-rbac.yaml`, `k8s/arc/runner-rbac.yaml`

### Step 6: Platform Jobs (partial) ✅

Apply RBAC and preserve-expiry (no secrets needed). Cleanup CronJob deferred until a GITHUB_TOKEN for edgebr repos is available.

```bash
kubectl apply -f ~/k8s/platform/cleanup-job/cleanup-rbac.yaml
kubectl apply -f ~/k8s/platform/preserve-expiry/
```

---

## Blocked Steps

### Step 7: ARC Runner Scale Set ⏳ (needs GitHub App credentials)

When App ID, Installation ID, and .pem arrive from edgebr DevOps:

```bash
# Create secret
kubectl create secret generic github-app-secret-edgebr \
  --namespace arc-runners \
  --from-literal=github_app_id="APP_ID" \
  --from-literal=github_app_installation_id="INSTALLATION_ID" \
  --from-file=github_app_private_key=/tmp/edgebr-private-key.pem

# Delete .pem immediately
rm /tmp/edgebr-private-key.pem
```

Create `k8s/arc/values-runner-set-edgebr.yaml`:

```yaml
githubConfigUrl: "https://github.com/edgebr"
githubConfigSecret: github-app-secret-edgebr
runnerScaleSetName: "arc-runner-set"
minRunners: 0
maxRunners: 3
template:
  spec:
    serviceAccountName: arc-runner-sa
controllerServiceAccount:
  namespace: arc-systems
  name: arc-controller
```

```bash
scp k8s/arc/values-runner-set-edgebr.yaml ubuntu@13.58.99.235:~/k8s/arc/
ssh ubuntu@13.58.99.235

helm install arc-runner-set-edgebr \
  --namespace arc-runners \
  oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set \
  -f ~/k8s/arc/values-runner-set-edgebr.yaml
```

Verify: Runners visible at `https://github.com/organizations/edgebr/settings/actions/runners`

### Step 8: TLS + Grafana Ingress ⏳ (needs DNS configured)

**TLS via AWS Route 53 DNS challenge:**

```bash
kubectl create secret generic route53-credentials \
  --namespace kube-system \
  --from-literal=AWS_ACCESS_KEY_ID="<ACCESS_KEY>" \
  --from-literal=AWS_SECRET_ACCESS_KEY="<SECRET_KEY>"
```

Create adapted `k8s/traefik/traefik-config-edgebr.yaml` based on `k8s/traefik/traefik-config.yaml` with the `route53` resolver, Hosted Zone ID, and ACME email for edgebr.

```bash
kubectl apply -f ~/k8s/traefik/traefik-config-edgebr.yaml
```

**Grafana Ingress** - create `k8s/observability/grafana-ingress-edgebr.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: grafana
  namespace: observability
  labels:
    app.kubernetes.io/name: grafana
    app.kubernetes.io/component: observability
  annotations:
    traefik.ingress.kubernetes.io/router.entrypoints: websecure
    traefik.ingress.kubernetes.io/router.tls: "true"
    traefik.ingress.kubernetes.io/router.tls.certresolver: letsencrypt-prod
spec:
  ingressClassName: traefik
  tls:
    - hosts:
        - grafana.k8s-ee.edge.net.br
  rules:
    - host: grafana.k8s-ee.edge.net.br
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: prometheus-grafana
                port:
                  number: 80
```

```bash
kubectl apply -f ~/k8s/observability/grafana-ingress-edgebr.yaml
```

### Step 9: Grafana OAuth ⏳ (needs OAuth App credentials)

When Client ID and Client Secret arrive:

```bash
kubectl create secret generic grafana-oauth-secrets \
  --namespace observability \
  --from-literal=GF_AUTH_GITHUB_CLIENT_ID="CLIENT_ID" \
  --from-literal=GF_AUTH_GITHUB_CLIENT_SECRET="CLIENT_SECRET"

# Upgrade to enable OAuth (remove the null override)
helm upgrade prometheus prometheus-community/kube-prometheus-stack \
  -n observability \
  -f ~/k8s/observability/kube-prometheus-stack/values.yaml \
  -f ~/k8s/observability/kube-prometheus-stack/values-edgebr-with-oauth.yaml
```

Where `values-edgebr-with-oauth.yaml` is the same overlay but with `envFromSecret: "grafana-oauth-secrets"` instead of `null`.

### Step 10: KUBECONFIG for GitHub Actions ⏳ (needs edgebr fork)

After k3s is installed, the edgebr fork needs a `KUBECONFIG` secret for GitHub Actions:

```bash
# On EC2: extract kubeconfig and replace localhost with public IP
sudo cat /etc/rancher/k3s/k3s.yaml | sed 's/127.0.0.1/13.58.99.235/' > /tmp/kubeconfig-edgebr.yaml
cat /tmp/kubeconfig-edgebr.yaml
rm /tmp/kubeconfig-edgebr.yaml
```

Add the output as a repository/organization secret `KUBECONFIG` in the edgebr fork on GitHub.

### Step 11: Cleanup Job ⏳ (needs GITHUB_TOKEN)

Create a GitHub PAT or fine-grained token that can read PR status in edgebr repos:

```bash
kubectl create secret generic github-cleanup-token \
  --namespace platform \
  --from-literal=GITHUB_TOKEN="ghp_xxx"

kubectl apply -f ~/k8s/platform/cleanup-job/cleanup-configmap.yaml
kubectl apply -f ~/k8s/platform/cleanup-job/cleanup-cronjob.yaml
```

---

## Verification (after all steps complete)

```bash
kubectl get nodes
kubectl get pods -A | grep -v Running | grep -v Completed  # Should be empty
curl -I https://grafana.k8s-ee.edge.net.br  # TLS + Grafana
# Open a test PR in an edgebr repo → verify end-to-end
```
