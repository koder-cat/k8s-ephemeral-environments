# Onboarding a New Repository

This guide explains how to configure a new or existing repository to use the PR ephemeral environment system.

## Quick Start: Reusable Workflow (Recommended)

The fastest way to onboard is using the reusable workflow. Just add two files to your repository:

### 1. Configuration File (`k8s-ee.yaml`)

```yaml
# k8s-ee.yaml - minimal configuration
projectId: myapp  # Unique ID, max 20 chars, lowercase alphanumeric + hyphens

# Optional: customize app settings
app:
  port: 3000
  healthPath: /health

# Optional: enable databases
databases:
  postgresql: true
  # mongodb: false
  # redis: false
  # minio: false
  # mariadb: false
```

> **See [Configuration Reference](./k8s-ee-config-reference.md) for all available options.**

### 2. Workflow File (`.github/workflows/pr-environment.yml`)

```yaml
name: PR Environment

on:
  pull_request:
    types: [opened, reopened, synchronize, closed]

jobs:
  pr-environment:
    uses: genesluna/k8s-ephemeral-environments/.github/workflows/pr-environment-reusable.yml@main
    with:
      pr-number: ${{ github.event.pull_request.number }}
      pr-action: ${{ github.event.action }}
      head-sha: ${{ github.event.pull_request.head.sha }}
      head-ref: ${{ github.head_ref }}
      repository: ${{ github.repository }}
    secrets: inherit
```

**That's it!** The reusable workflow handles:
- Configuration validation
- Namespace creation with quotas and network policies
- ARM64 image building and pushing to GHCR
- Trivy vulnerability scanning
- Helm deployment with health checks
- PR comments with preview URLs
- Cleanup on PR close

### Optional Workflow Inputs

```yaml
with:
  pr-number: ${{ github.event.pull_request.number }}
  pr-action: ${{ github.event.action }}
  head-sha: ${{ github.event.pull_request.head.sha }}
  head-ref: ${{ github.head_ref }}
  repository: ${{ github.repository }}
  config-path: 'k8s-ee.yaml'           # Path to config file
  preview-domain: 'k8s-ee.genesluna.dev'  # Base domain
  chart-version: '1.0.0'               # k8s-ee-app chart version
```

### Version Pinning

For production stability, pin to a specific version:

```yaml
# Pin to a release tag
uses: genesluna/k8s-ephemeral-environments/.github/workflows/pr-environment-reusable.yml@v1

# Pin to a specific commit
uses: genesluna/k8s-ephemeral-environments/.github/workflows/pr-environment-reusable.yml@abc1234
```

---

## Manual Setup (Advanced)

If you need more control, you can set up the workflow manually. The following sections cover the detailed approach.

## Prerequisites (Already Set Up)

The following infrastructure is already running on the VPS cluster:

- k3s cluster on VPS (168.138.151.63)
- DNS wildcard: `*.k8s-ee.genesluna.dev` → VPS
- ARC runners in `arc-runners` namespace (auto-scaled)
- Observability stack (Prometheus, Loki, Grafana)
- Operators: CloudNativePG, MongoDB, MinIO, Redis
- Traefik ingress with Let's Encrypt

## Step 1: Create the GitHub Actions Workflow

Copy and adapt `.github/workflows/pr-environment.yml` to your repo. Key environment variables to change:

```yaml
# .github/workflows/pr-environment.yml
env:
  PROJECT_ID: "your-project"      # Unique ID (max 20 chars, lowercase, alphanumeric + hyphens)
  PREVIEW_DOMAIN: "k8s-ee.genesluna.dev"
  K8S_API_IP: "10.0.0.39"
```

### PROJECT_ID Rules

- **Must be unique** across all repos using the cluster
- Maximum 20 characters (leaves room for `-pr-123` suffix)
- Lowercase, alphanumeric, hyphens only
- Results in namespaces like `your-project-pr-42`
- Preview URLs: `your-project-pr-42.k8s-ee.genesluna.dev`

## Step 2: Choose a Runner Strategy

### Option A: Use Existing ARC Runners (Recommended)

The cluster has self-hosted runners that already have kubectl access:

```yaml
jobs:
  deploy:
    runs-on: arc-runner-set  # Uses in-cluster runner with kubectl access
```

### Option B: Use GitHub-Hosted Runners + KUBECONFIG Secret

For repos that can't use self-hosted runners:

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Setup kubeconfig
        run: |
          mkdir -p ~/.kube
          echo "${{ secrets.KUBECONFIG }}" | base64 -d > ~/.kube/config
```

To create the KUBECONFIG secret:

```bash
# On VPS
cat /etc/rancher/k3s/k3s.yaml | base64 -w0
# Add as GitHub secret: KUBECONFIG
```

## Step 3: Choose Your Helm Chart Strategy

### Option A: Use the Generic k8s-ee-app Chart (Recommended)

The platform provides a generic application chart that works for most applications. Pull it directly from the OCI registry:

```bash
# Pull the generic chart
helm pull oci://ghcr.io/genesluna/k8s-ephemeral-environments/charts/k8s-ee-app --version 1.0.0

# Install with your configuration
helm install myapp k8s-ee-app \
  --namespace myproject-pr-42 \
  --set projectId=myproject \
  --set prNumber=42 \
  --set image.repository=ghcr.io/your-org/your-app \
  --set image.tag=abc123 \
  --set app.port=3000 \
  --set app.healthPath=/health \
  --set postgresql.enabled=true
```

**Features included:**
- Deployment with configurable resources and health probes
- Service (ClusterIP) and Ingress (Traefik + TLS)
- Init containers for database readiness
- Environment variable injection from database subcharts
- ServiceMonitor for Prometheus metrics (optional)
- Security hardened (runAsNonRoot, seccompProfile, capabilities dropped)

**Supported databases (all conditional):**
- PostgreSQL (`postgresql.enabled=true`)
- MongoDB (`mongodb.enabled=true`)
- Redis (`redis.enabled=true`)
- MinIO (`minio.enabled=true`)
- MariaDB (`mariadb.enabled=true`)

**Custom environment variables:**
```yaml
env:
  MY_VAR: "value"
  ANOTHER_VAR: "value2"
```

### Option B: Create Your Own Helm Chart

For applications requiring custom templates, create your own chart:

```
charts/
└── your-app/
    ├── Chart.yaml
    ├── values.yaml
    └── templates/
        ├── deployment.yaml
        ├── service.yaml
        ├── ingress.yaml
        └── serviceaccount.yaml
```

### Key values.yaml Settings

```yaml
projectId: "your-project"
prNumber: ""
previewDomain: "k8s-ee.genesluna.dev"

image:
  repository: ghcr.io/your-org/your-app
  pullPolicy: Always

# Must fit within LimitRange (512Mi memory max per container)
resources:
  requests:
    cpu: 50m
    memory: 128Mi
  limits:
    cpu: 200m
    memory: 384Mi

ingress:
  enabled: true
  className: traefik
  annotations:
    traefik.ingress.kubernetes.io/router.entrypoints: websecure
    traefik.ingress.kubernetes.io/router.tls: "true"
    traefik.ingress.kubernetes.io/router.tls.certresolver: letsencrypt-prod
```

### Ingress Template

```yaml
# templates/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ .Values.projectId }}-pr-{{ .Values.prNumber }}
  annotations:
    traefik.ingress.kubernetes.io/router.entrypoints: websecure
    traefik.ingress.kubernetes.io/router.tls: "true"
    traefik.ingress.kubernetes.io/router.tls.certresolver: letsencrypt-prod
spec:
  ingressClassName: traefik
  rules:
    - host: {{ .Values.projectId }}-pr-{{ .Values.prNumber }}.{{ .Values.previewDomain }}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: {{ .Values.projectId }}-pr-{{ .Values.prNumber }}
                port:
                  number: 80
  tls:
    - hosts:
        - {{ .Values.projectId }}-pr-{{ .Values.prNumber }}.{{ .Values.previewDomain }}
```

## Step 4: Copy Required K8s Templates

Copy these files from the k8s-ephemeral-environments repo to your new repo:

```
k8s/ephemeral/
├── namespace-template.yaml
├── resource-quota.yaml
├── limit-range.yaml
├── network-policy-default-deny.yaml
├── network-policy-allow-same-namespace.yaml
├── network-policy-allow-ingress.yaml
├── network-policy-allow-egress.yaml
└── network-policy-allow-observability.yaml
```

These templates use `envsubst` variables (`${NAMESPACE}`, `${PROJECT_ID}`, etc.) that get substituted at deploy time.

## Step 5: Copy the setup-kubectl Action

Copy the composite action for kubectl installation:

```
.github/actions/setup-kubectl/action.yml
```

Or install kubectl directly in your workflow steps.

## Step 6: Add Database (Optional)

### Using k8s-ee-app Chart (Recommended)

If using the generic k8s-ee-app chart, simply enable databases via Helm values:

```bash
helm install myapp k8s-ee-app \
  --set postgresql.enabled=true \
  --set redis.enabled=true
```

### Using Custom Chart with OCI Dependencies

Add database charts as OCI dependencies in your `Chart.yaml`:

```yaml
dependencies:
  - name: k8s-ee-postgresql
    alias: postgresql
    version: "1.1.0"
    repository: "oci://ghcr.io/genesluna/k8s-ephemeral-environments/charts"
    condition: postgresql.enabled
  - name: k8s-ee-mongodb
    alias: mongodb
    version: "1.1.0"
    repository: "oci://ghcr.io/genesluna/k8s-ephemeral-environments/charts"
    condition: mongodb.enabled
  - name: k8s-ee-redis
    alias: redis
    version: "1.1.0"
    repository: "oci://ghcr.io/genesluna/k8s-ephemeral-environments/charts"
    condition: redis.enabled
  - name: k8s-ee-minio
    alias: minio
    version: "1.1.0"
    repository: "oci://ghcr.io/genesluna/k8s-ephemeral-environments/charts"
    condition: minio.enabled
  - name: k8s-ee-mariadb
    alias: mariadb
    version: "1.0.0"
    repository: "oci://ghcr.io/genesluna/k8s-ephemeral-environments/charts"
    condition: mariadb.enabled
```

Build dependencies before deploying:

```bash
helm dependency build charts/your-app
```

Enable in `values.yaml`:

```yaml
postgresql:
  enabled: true
  instances: 1
  version: "16"
  database: app
  owner: app
  storage:
    size: 1Gi

mongodb:
  enabled: false

redis:
  enabled: false

minio:
  enabled: false

mariadb:
  enabled: false
```

### Available Database Charts

| Database | Chart | Version | Operator |
|----------|-------|---------|----------|
| PostgreSQL | k8s-ee-postgresql | 1.1.0 | CloudNativePG |
| MongoDB | k8s-ee-mongodb | 1.1.0 | MongoDB Community |
| Redis | k8s-ee-redis | 1.1.0 | Simple deployment |
| MinIO | k8s-ee-minio | 1.1.0 | MinIO Operator |
| MariaDB | k8s-ee-mariadb | 1.0.0 | Simple deployment |

## Step 7: Configure Image Build

The VPS runs ARM64 architecture. Your workflow must build ARM64 images:

```yaml
- name: Set up QEMU
  uses: docker/setup-qemu-action@v3

- name: Set up Docker Buildx
  uses: docker/setup-buildx-action@v3

- name: Build and push
  uses: docker/build-push-action@v6
  with:
    platforms: linux/arm64  # Required for this cluster
    push: true
    tags: ghcr.io/${{ github.repository }}/your-app:pr-${{ github.event.pull_request.number }}
```

## Minimal Workflow Template

Here's a minimal working workflow you can adapt:

```yaml
name: PR Environment

on:
  pull_request:
    types: [opened, reopened, synchronize, closed]

concurrency:
  group: myapp-pr-${{ github.event.pull_request.number }}
  cancel-in-progress: false

env:
  PROJECT_ID: "myapp"
  PREVIEW_DOMAIN: "k8s-ee.genesluna.dev"

jobs:
  deploy:
    if: github.event.action != 'closed'
    runs-on: arc-runner-set
    steps:
      - uses: actions/checkout@v4

      - name: Install envsubst
        run: sudo apt-get update && sudo apt-get install -y gettext-base

      - name: Set variables
        run: |
          echo "NAMESPACE=${{ env.PROJECT_ID }}-pr-${{ github.event.pull_request.number }}" >> $GITHUB_ENV
          echo "PR_NUMBER=${{ github.event.pull_request.number }}" >> $GITHUB_ENV
          echo "PROJECT_ID=${{ env.PROJECT_ID }}" >> $GITHUB_ENV
          echo "BRANCH_NAME=$(echo '${{ github.head_ref }}' | sed 's/[^a-zA-Z0-9._-]/-/g' | cut -c1-63)" >> $GITHUB_ENV
          echo "COMMIT_SHA=${{ github.event.pull_request.head.sha }}" >> $GITHUB_ENV
          echo "CREATED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> $GITHUB_ENV

      - name: Create namespace
        run: envsubst < k8s/ephemeral/namespace-template.yaml | kubectl apply -f -

      - name: Apply resource policies
        run: |
          envsubst < k8s/ephemeral/resource-quota.yaml | kubectl apply -f -
          envsubst < k8s/ephemeral/limit-range.yaml | kubectl apply -f -
          for f in k8s/ephemeral/network-policy-*.yaml; do
            envsubst < "$f" | kubectl apply -f -
          done

      - name: Deploy with Helm
        run: |
          helm upgrade --install myapp ./charts/myapp \
            --namespace "$NAMESPACE" \
            --set projectId="${{ env.PROJECT_ID }}" \
            --set prNumber="${{ github.event.pull_request.number }}" \
            --set image.tag="pr-${{ github.event.pull_request.number }}" \
            --atomic --timeout 5m

      - name: Output preview URL
        run: |
          echo "Preview URL: https://${{ env.PROJECT_ID }}-pr-${{ github.event.pull_request.number }}.${{ env.PREVIEW_DOMAIN }}"

  destroy:
    if: github.event.action == 'closed'
    runs-on: arc-runner-set
    steps:
      - name: Delete namespace
        run: |
          NAMESPACE="${{ env.PROJECT_ID }}-pr-${{ github.event.pull_request.number }}"
          if kubectl get namespace "$NAMESPACE" >/dev/null 2>&1; then
            kubectl delete namespace "$NAMESPACE" --timeout=2m
          fi
```

## Checklist for New Repos

| Item | Required | Notes |
|------|----------|-------|
| Unique `PROJECT_ID` | Yes | Must not conflict with existing projects |
| Helm chart | Yes | Use k8s-ee-app from OCI or create custom chart |
| ARM64 images | Yes | Build for `linux/arm64` |
| Resource limits | Yes | Within LimitRange (512Mi memory max) |
| Health endpoint | Yes | For readiness/liveness probes |
| GHCR access | Yes | Package permissions on the repo |
| K8s templates | Yes | Copy from `k8s/ephemeral/` |
| PR comment bot | Optional | Copy the github-script steps |
| Database | Optional | Enable PostgreSQL/MongoDB/Redis/MinIO/MariaDB as needed |

## DNS for Custom Domains

If you want a different base domain (e.g., `preview.example.com`):

1. Create wildcard DNS record: `*.preview.example.com` → `168.138.151.63`
2. Update `PREVIEW_DOMAIN` in your workflow
3. Let's Encrypt will auto-provision certificates via Traefik

## Resource Limits

Each PR namespace has these limits (defined in `resource-quota.yaml`):

| Resource | Limit |
|----------|-------|
| CPU | 1 core |
| Memory | 2Gi |
| Storage | 5Gi |
| Pods | 10 |

Individual containers are limited by `limit-range.yaml`:
- Max memory per container: 512Mi
- Max CPU per container: 500m

## Observability

PR environments automatically get:

- **Metrics**: Prometheus scrapes pods with `prometheus.io/scrape: "true"` annotation
- **Logs**: Promtail collects all container logs to Loki
- **Dashboards**: Grafana at `grafana.k8s-ee.genesluna.dev`

To enable Prometheus scraping, add to your deployment:

```yaml
annotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "3000"
  prometheus.io/path: "/metrics"
```

## Troubleshooting

### Namespace stuck in Terminating

```bash
kubectl get namespace <ns> -o json | jq '.spec.finalizers = []' | kubectl replace --raw "/api/v1/namespaces/<ns>/finalize" -f -
```

### Image pull errors

Ensure your repo has package permissions and the image is public or you've configured `imagePullSecrets`.

### Resource quota exceeded

Check current usage:
```bash
kubectl describe resourcequota -n <namespace>
```

### Ingress not working

Verify the ingress was created and has an address:
```bash
kubectl get ingress -n <namespace>
kubectl describe ingress -n <namespace>
```
