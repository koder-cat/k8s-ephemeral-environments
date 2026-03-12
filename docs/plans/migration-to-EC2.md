# EC2 Cluster Setup Plan for edgebr Organization

## Context

Setting up a k3s cluster on EC2 (`ubuntu@13.58.99.235`) for the **edgebr** organization, following the edge organization guide (`docs/guides/configuracao-organizacao-edge.md` - Parte 2). This is the first external organization deployment of the k8s-ephemeral-environments platform.

**Current EC2 state:** Ubuntu 24.04, x86_64, 4 vCPUs / 15GB RAM / 96GB disk. k3s v1.34.4 installed. Platform stack running (Steps 0-8 complete). ARC runners registered. TLS + Grafana Ingress live at `https://grafana.k8s-ee.edge.net.br`.

**Remaining blockers:**
- OAuth App credentials (Grafana) from edgebr DevOps — blocks Step 9
- GITHUB_TOKEN for edgebr repos — blocks Step 11
- Fork workflow adaptation (architecture `arm64` → `amd64`) — blocks end-to-end PR environments

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

### Step 7: ARC Runner Scale Set ✅

**Completed 2026-03-12.** Runner scale set registered with GitHub for edgebr org.

**Lessons learned during execution:**
- GitHub App initially returned 403 "Resource not accessible by integration" — the **Organization: Self-hosted runners: Read and write** permission was set on the App but not yet **approved on the installation**. After approval, registration succeeded immediately.

**Files created:**
- `k8s/arc/values-runner-set-edgebr.yaml` — Runner scale set config (org: edgebr, minRunners: 0, maxRunners: 3)

**Secrets created on cluster:**
- `github-app-secret-edgebr` in `arc-runners` (App ID: 2999114, Installation ID: 113788735, private key)

**Helm release:** `arc-runner-set-edgebr` (chart: gha-runner-scale-set 0.13.1)

**Verified:** Listener pod running in `arc-systems`, runner scale set registered with GitHub

### Step 8: TLS + Grafana Ingress ✅

**Completed 2026-03-12.** TLS via Route 53 DNS challenge + Grafana Ingress.

**Lessons learned during execution:**
- Route 53 provider requires `AWS_REGION` env var (set to `us-east-1`) — missing this caused `Invalid Configuration: Missing Region` error
- k3s was installed with `--disable=servicelb`, so Traefik's LoadBalancer service stayed `<pending>` — fixed by adding `hostPort: 80/443` in the Traefik Helm values

**Files created:**
- `k8s/traefik/traefik-config-edgebr.yaml` — HelmChartConfig with Route 53 provider, hostPort bindings
- `k8s/observability/grafana-ingress-edgebr.yaml` — Grafana Ingress for `grafana.k8s-ee.edge.net.br`

**Secrets created on cluster:**
- `route53-credentials` in `kube-system` (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)

**Verified:** `curl -I https://grafana.k8s-ee.edge.net.br` → HTTP/2 302 with valid Let's Encrypt TLS

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

### Step 10: KUBECONFIG for GitHub Actions ✅

**Completed 2026-03-12.** KUBECONFIG secret set on `edgebr/k8s-ephemeral-environments` via `gh secret set`.

**Lessons learned during execution:**
- KUBECONFIG uses the **internal IP** (`192.168.23.55`) instead of the public IP (`13.58.99.235`), because ARC runners run inside the cluster and can't reach the k3s API via the public IP (EC2 security group blocks port 6443 / hairpin NAT issue).
- Test PR verified: ARC runner spun up, kubectl connected, listed nodes and namespaces successfully.
- The fork's existing workflows (`PR Environment`) fail with `Exec format error` because `.github/actions/setup-tools` defaults to `architecture: arm64` (original VPS). **Fork workflows must be adapted to use `architecture: amd64` for the EC2 cluster.**

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
