# Actions Runner Controller (ARC) Setup

This guide covers setting up GitHub Actions self-hosted runners using ARC (Actions Runner Controller) with GitHub App authentication.

**Current Configuration:** Org-level runners for `koder-cat` organization. All repos in the org can use the shared runner pool.

## Prerequisites

- k3s cluster running (see `docs/runbooks/k3s-operations.md`)
- Helm 3.x installed on VPS
- GitHub organization admin access (for org-level runners)

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

1. Go to https://github.com/settings/apps

2. Click **New GitHub App**

3. Configure the app:
   - **Name:** `k8s-ee-arc-runner` (or any unique name)
   - **Homepage URL:** `https://github.com/koder-cat`
   - **Webhook:** Uncheck "Active" (not needed)
   - **Where can this GitHub App be installed?** Select "Any account" (for org-level)

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

8. **Install the App** on your organization:
   - Go to "Install App" in left sidebar
   - Select the **koder-cat** organization
   - Choose "All repositories" (recommended) or select specific repos
   - Click **Install**

9. Note the **Installation ID** from the URL:
   - After install, URL will be: `https://github.com/organizations/koder-cat/settings/installations/INSTALLATION_ID`

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

Deploy the runner scale set using the values file (`k8s/arc/values-runner-set.yaml`):

```bash
helm install arc-runner-set \
  --namespace arc-runners \
  oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set \
  --version 0.10.1 \
  -f k8s/arc/values-runner-set.yaml
```

Or with inline values (org-level URL):

```bash
helm install arc-runner-set \
  --namespace arc-runners \
  oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set \
  --version 0.10.1 \
  --set githubConfigUrl="https://github.com/koder-cat" \
  --set githubConfigSecret="github-app-secret" \
  --set minRunners=0 \
  --set maxRunners=3
```

## Step 6: Verify Runner Registration

Check runner pods (should scale from 0 when jobs arrive):

```bash
kubectl get pods -n arc-runners
```

Verify runner registered with GitHub (org-level):
1. Go to **https://github.com/organizations/koder-cat/settings/actions/runners**
2. You should see `arc-runner-set` listed under "Self-hosted runners"
3. Status should show as "Idle" (waiting for jobs)

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

## Important Configuration Notes

### JIT Config Injection

The ARC controller uses Just-In-Time (JIT) configuration to inject runner settings at pod creation time. **Do NOT override the container spec** in the template - only set `serviceAccountName`:

```yaml
# CORRECT - minimal template
template:
  spec:
    serviceAccountName: arc-runner-sa

# WRONG - breaks JIT config injection
template:
  spec:
    containers:
      - name: runner
        image: ghcr.io/actions/actions-runner:2.321.0  # DON'T DO THIS
        command: ["/home/runner/run.sh"]               # DON'T DO THIS
```

If you override the container spec, runners will fail with:
```
An error occurred: Not configured. Run config.(sh/cmd) to configure the runner.
```

### Public Repository Access

For org-level runners to accept jobs from **public repositories**, the runner group must allow public repos:

1. Go to https://github.com/organizations/koder-cat/settings/actions/runner-groups
2. Click on **Default** group
3. Enable **"Allow public repositories"**

Or via API:
```bash
gh api --method PATCH /orgs/koder-cat/actions/runner-groups/1 \
  -F allows_public_repositories=true
```

### GHCR Package Visibility

Container images pushed to GHCR are **automatically set to public** by the `build-image` action after pushing. This eliminates the need for `imagePullSecrets` and simplifies onboarding.

**How it works:**
1. `build-image` action pushes the image to GHCR
2. `build-image` action calls GitHub API to set package visibility to `public`
3. Kubernetes can pull the image without authentication

**Org Setting Required:** The organization must allow members to change package visibility:
1. Go to https://github.com/organizations/koder-cat/settings/packages
2. Enable "Allow members to change container package visibility to public"

## Troubleshooting

### Controller not starting
```bash
kubectl logs -n arc-systems -l app.kubernetes.io/name=gha-runner-scale-set-controller
```

### Runners not registering
```bash
kubectl logs -n arc-runners -l app.kubernetes.io/component=runner
```

### Runners crash with "Not configured"
This indicates JIT config injection failed. Check that you haven't overridden the container spec in `values-runner-set.yaml`. Only set `serviceAccountName` in the template.

### Jobs queued but not picked up
1. Check if the runner group allows public repos (if applicable)
2. Verify the GitHub App has correct permissions
3. Check listener logs: `kubectl logs -n arc-systems -l app.kubernetes.io/name=arc-runner-set`

See `docs/runbooks/arc-operations.md` for detailed troubleshooting steps.

### Check secret configuration
```bash
kubectl get secret github-app-secret -n arc-runners -o yaml
```

## Adding New Repos to the Runner

For org-level runners, adding a new repo is simple:

1. The GitHub App must be installed on the repo (or "All repositories" was selected during install)
2. If using "Only select repositories", add the repo to the App installation:
   - Go to https://github.com/organizations/koder-cat/settings/installations
   - Click **Configure** on the k8s-ee-arc-runner app
   - Add the new repo to the list
3. The repo can now use `runs-on: arc-runner-set` in workflows

No Kubernetes changes required - the runner automatically accepts jobs from all repos in the org.

## Multi-Org Setup

Each organization requires its own runner scale set because `githubConfigUrl` can only point to one org.

To support multiple orgs:
1. Create a new values file (e.g., `k8s/arc/values-runner-set-other-org.yaml`)
2. Install the GitHub App on the other org (new Installation ID)
3. Create a separate secret with the new Installation ID
4. Deploy a new runner scale set with a different name

Example:
```bash
helm install arc-runner-set-other-org \
  --namespace arc-runners \
  oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set \
  --version 0.10.1 \
  -f values-runner-set-other-org.yaml
```

## Cleanup

To remove ARC completely:

```bash
helm uninstall arc-runner-set -n arc-runners
helm uninstall arc -n arc-systems
kubectl delete namespace arc-runners
kubectl delete namespace arc-systems
```
