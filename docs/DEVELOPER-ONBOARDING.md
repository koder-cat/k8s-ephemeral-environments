# Developer Onboarding Guide

Welcome to the k8s-ephemeral-environments project! This guide will help you get set up and productive quickly.

## Table of Contents

- [Prerequisites](#prerequisites)
- [First-Time Setup](#first-time-setup)
- [Cluster Access](#cluster-access)
- [Grafana Dashboard Access](#grafana-dashboard-access)
- [Development Workflow](#development-workflow)
- [Quick Reference](#quick-reference)
- [Next Steps](#next-steps)

## Prerequisites

Install the following tools before starting:

| Tool | Version | Installation |
|------|---------|--------------|
| Node.js | 22+ | [nodejs.org](https://nodejs.org/) |
| pnpm | 9+ | `npm install -g pnpm` |
| Docker | Latest | [docker.com](https://www.docker.com/) |
| kubectl | 1.31+ | [kubernetes.io](https://kubernetes.io/docs/tasks/tools/) |
| Helm | 3.16+ | [helm.sh](https://helm.sh/docs/intro/install/) |
| GitHub CLI | Latest | [cli.github.com](https://cli.github.com/) |

Verify installations:
```bash
node --version      # v22.x.x
pnpm --version      # 9.x or later
docker --version    # Docker version 2x.x.x
kubectl version --client  # v1.31.x
helm version        # v3.16.x
gh --version        # gh version 2.x.x
```

## First-Time Setup

### 1. Clone the Repository

```bash
git clone https://github.com/genesluna/k8s-ephemeral-environments.git
cd k8s-ephemeral-environments
```

### 2. Install Demo App Dependencies

```bash
cd demo-app
pnpm install
```

### 3. Run Locally (Optional)

Start the development servers:
```bash
# Run both API and Web in parallel
pnpm dev

# Or run separately
pnpm dev:api  # API on http://localhost:3000
pnpm dev:web  # Web on http://localhost:5173
```

### 4. Run Tests

```bash
pnpm test       # Run all tests
pnpm test:cov   # Run with coverage report
```

## Cluster Access

The development cluster runs on an Oracle Cloud VPS with k3s.

### SSH Access

```bash
ssh ubuntu@168.138.151.63
```

> **Note:** Request SSH key access from the team lead.

### Kubeconfig Setup

1. Copy the kubeconfig from the VPS:
   ```bash
   scp ubuntu@168.138.151.63:~/.kube/config ~/.kube/k8s-ee-config
   ```

2. Set the context:
   ```bash
   export KUBECONFIG=~/.kube/k8s-ee-config
   ```

3. Verify connection:
   ```bash
   kubectl get nodes
   # NAME      STATUS   ROLES                  AGE   VERSION
   # genilda   Ready    control-plane,master   Xd    v1.31.x+k3s1
   ```

### Key Namespaces

| Namespace | Purpose |
|-----------|---------|
| `kube-system` | k3s core components, Traefik |
| `observability` | Prometheus, Loki, Grafana |
| `arc-systems` | ARC controller (manages runner lifecycle) |
| `arc-runners` | GitHub Actions self-hosted runner pods |
| `platform` | Shared platform components |
| `k8s-ee-pr-{N}` | Ephemeral PR environments |

## Grafana Dashboard Access

Access Grafana for logs and metrics:

**URL:** `https://grafana.k8s-ee.genesluna.dev`

### Key Dashboards

| Dashboard | Purpose |
|-----------|---------|
| Kubernetes / Pods | Pod resource usage |
| Loki / Logs | Application and system logs |
| Node Exporter | VPS system metrics |

### Viewing PR Environment Logs

1. Open Grafana → Explore
2. Select "Loki" data source
3. Use LogQL query:
   ```
   {namespace="k8s-ee-pr-42"}
   ```
   Replace `42` with your PR number.

## Development Workflow

### Creating a New Feature

1. **Create a branch:**
   ```bash
   git checkout -b feat/us-XXX-description
   ```

2. **Make changes and test locally:**
   ```bash
   cd demo-app
   pnpm dev
   pnpm test
   pnpm lint
   ```

3. **Commit with conventional format:**
   ```bash
   git commit -m "feat(scope): add new feature"
   ```

4. **Push and create PR:**
   ```bash
   git push -u origin feat/us-XXX-description
   gh pr create
   ```

5. **Wait for preview environment:**
   - CI creates namespace `k8s-ee-pr-{number}`
   - Preview URL: `k8s-ee-pr-{number}.k8s-ee.genesluna.dev`
   - Bot comments on PR with the URL

6. **Verify in preview environment:**
   - Check the preview URL works
   - View logs in Grafana if needed
   - Run kubectl commands against the namespace

7. **Merge when approved:**
   - PR merged → namespace automatically destroyed
   - Use `/preserve` comment to keep environment after merge

### Debugging a PR Environment

```bash
# Set namespace
export NS=k8s-ee-pr-42

# Check pod status
kubectl get pods -n $NS

# View logs
kubectl logs -n $NS deployment/k8s-ee-pr-42-demo-app

# Check database
kubectl get clusters.postgresql.cnpg.io -n $NS

# Describe failed pod
kubectl describe pod -n $NS <pod-name>

# Port forward to access locally
kubectl port-forward -n $NS svc/k8s-ee-pr-42-demo-app 3000:80
```

## Quick Reference

### Essential Commands

| Task | Command |
|------|---------|
| List PR namespaces | `kubectl get ns -l k8s-ee/pr-number` |
| View pod logs | `kubectl logs -n $NS deploy/<name>` |
| Check events | `kubectl get events -n $NS --sort-by='.lastTimestamp'` |
| Database status | `kubectl get clusters.postgresql.cnpg.io -n $NS` |
| Delete namespace | `kubectl delete ns $NS` |

### Helm Commands

| Task | Command |
|------|---------|
| List releases | `helm list -n $NS` |
| Get values | `helm get values -n $NS <release>` |
| Upgrade/install | `helm upgrade --install -n $NS <release> ./charts/demo-app` |
| Rollback | `helm rollback -n $NS <release> <revision>` |

### GitHub CLI

| Task | Command |
|------|---------|
| Create PR | `gh pr create` |
| View PR | `gh pr view` |
| Check CI status | `gh pr checks` |
| Merge PR | `gh pr merge --squash` |

## Next Steps

Now that you're set up, explore these resources:

- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contribution guidelines
- [Troubleshooting Guide](guides/troubleshooting.md) - Debug common issues
- [Security Guide](guides/security.md) - Security architecture
- [Demo App README](../demo-app/README.md) - Application documentation
- [PRD](PRD.md) - Product requirements and architecture
