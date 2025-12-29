# Actions Runner Controller (ARC) Setup

This guide covers setting up GitHub Actions self-hosted runners using ARC (Actions Runner Controller) with GitHub App authentication.

## Prerequisites

- k3s cluster running (see `docs/runbooks/k3s-operations.md`)
- Helm 3.x installed on VPS
- GitHub repository admin access

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    k3s Cluster                          │
│  ┌─────────────────┐     ┌─────────────────────────┐   │
│  │   arc-systems   │     │      arc-runners        │   │
│  │                 │     │                         │   │
│  │ ARC Controller  │────▶│  Runner Scale Set       │   │
│  │                 │     │  (ephemeral pods)       │   │
│  └─────────────────┘     └─────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
                    GitHub Actions API
```

## Step 1: Create GitHub App

1. Go to https://github.com/settings/apps (or org settings for org-level)

2. Click **New GitHub App**

3. Configure the app:
   - **Name:** `k8s-ee-arc-runner` (or any unique name)
   - **Homepage URL:** `https://github.com/genesluna/k8s-ephemeral-environments`
   - **Webhook:** Uncheck "Active" (not needed)

4. Set **Repository Permissions:**
   | Permission | Access |
   |------------|--------|
   | Actions | Read-only |
   | Administration | Read and write |
   | Metadata | Read-only |

5. Click **Create GitHub App**

6. Note the **App ID** (displayed at top of app settings page)

7. Generate a **Private Key:**
   - Scroll to "Private keys" section
   - Click **Generate a private key**
   - Save the downloaded `.pem` file

8. **Install the App** on your repository:
   - Go to "Install App" in left sidebar
   - Select your account/org
   - Choose "Only select repositories"
   - Select `k8s-ephemeral-environments`
   - Click **Install**

9. Note the **Installation ID** from the URL:
   - After install, URL will be: `https://github.com/settings/installations/INSTALLATION_ID`

## Step 2: Install ARC Controller

SSH into the VPS:

```bash
ssh ubuntu@168.138.151.63
```

Add the ARC Helm repository:

```bash
helm repo add actions-runner-controller https://actions-runner-controller.github.io/actions-runner-controller
helm repo update
```

Create the controller namespace:

```bash
kubectl create namespace arc-systems
```

Install the ARC controller:

```bash
helm install arc \
  --namespace arc-systems \
  oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set-controller \
  --version 0.10.1
```

Verify the controller is running:

```bash
kubectl get pods -n arc-systems
```

## Step 3: Apply RBAC Configuration

Apply the RBAC rules for the controller and runners:

```bash
kubectl apply -f k8s/arc/controller-rbac.yaml
kubectl apply -f k8s/arc/runner-rbac.yaml
```

### Runner RBAC Permissions

The `arc-runner-role` ClusterRole grants runners the following permissions:

| API Group | Resources | Purpose |
|-----------|-----------|---------|
| `""` (core) | namespaces | Create/delete PR namespaces |
| `""` (core) | resourcequotas, limitranges | Apply resource limits |
| `""` (core) | pods, services, configmaps, secrets, pvcs | Manage workloads |
| `""` (core) | pods/portforward, pods/log | Health checks and debugging |
| `apps` | deployments, replicasets, statefulsets | Manage deployments |
| `networking.k8s.io` | ingresses, networkpolicies | Preview URLs and isolation |
| `traefik.io` | ingressroutes, middlewares | Traefik CRDs |
| `postgresql.cnpg.io` | clusters, poolers, scheduledbackups | CloudNativePG |
| `batch` | jobs | Database migrations |

## Step 4: Create GitHub App Secret

Create the secret with GitHub App credentials:

```bash
# Replace with your values
APP_ID="YOUR_APP_ID"
INSTALLATION_ID="YOUR_INSTALLATION_ID"
PRIVATE_KEY_FILE="path/to/private-key.pem"

kubectl create secret generic github-app-secret \
  --namespace arc-runners \
  --from-literal=github_app_id="$APP_ID" \
  --from-literal=github_app_installation_id="$INSTALLATION_ID" \
  --from-file=github_app_private_key="$PRIVATE_KEY_FILE"
```

## Step 5: Deploy Runner Scale Set

Deploy the runner scale set using the values file:

```bash
helm install arc-runner-set \
  --namespace arc-runners \
  oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set \
  --version 0.10.1 \
  -f /path/to/values-runner-set.yaml
```

Or with inline values:

```bash
helm install arc-runner-set \
  --namespace arc-runners \
  oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set \
  --version 0.10.1 \
  --set githubConfigUrl="https://github.com/genesluna/k8s-ephemeral-environments" \
  --set githubConfigSecret="github-app-secret" \
  --set minRunners=0 \
  --set maxRunners=3
```

## Step 6: Verify Runner Registration

Check runner pods (should scale from 0 when jobs arrive):

```bash
kubectl get pods -n arc-runners
```

Verify runner registered with GitHub:
1. Go to repository **Settings > Actions > Runners**
2. You should see the runner scale set listed

## Using the Runners

In your GitHub Actions workflow, use:

```yaml
jobs:
  my-job:
    runs-on: arc-runner-set
    steps:
      - uses: actions/checkout@v4
      # Runner has kubectl access via ServiceAccount
      - run: kubectl get nodes
```

## Troubleshooting

### Controller not starting
```bash
kubectl logs -n arc-systems -l app.kubernetes.io/name=gha-runner-scale-set-controller
```

### Runners not registering
```bash
kubectl logs -n arc-runners -l app.kubernetes.io/component=runner
```

### Check secret configuration
```bash
kubectl get secret github-app-secret -n arc-runners -o yaml
```

## Cleanup

To remove ARC completely:

```bash
helm uninstall arc-runner-set -n arc-runners
helm uninstall arc -n arc-systems
kubectl delete namespace arc-runners
kubectl delete namespace arc-systems
```
