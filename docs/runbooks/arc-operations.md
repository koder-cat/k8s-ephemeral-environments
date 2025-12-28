# ARC Operations Runbook

This runbook covers common operations for the Actions Runner Controller (ARC).

## Overview

ARC provides self-hosted GitHub Actions runners that run inside the k3s cluster. Runners have native kubectl access and scale automatically based on workflow demand.

| Component | Namespace | Purpose |
|-----------|-----------|---------|
| ARC Controller | `arc-systems` | Manages runner lifecycle |
| Runner Scale Set | `arc-runners` | Ephemeral runner pods |

## Common Operations

### Check Runner Status

```bash
# View controller pods
kubectl get pods -n arc-systems

# View runner pods (will be empty when no jobs running)
kubectl get pods -n arc-runners

# Check runner scale set status
kubectl get autoscalingrunnerset -n arc-runners
```

### View Logs

```bash
# Controller logs
kubectl logs -n arc-systems -l app.kubernetes.io/name=gha-runner-scale-set-controller -f

# Runner logs (when a job is running)
kubectl logs -n arc-runners -l app.kubernetes.io/component=runner -f
```

### Verify GitHub Registration

1. Go to repository **Settings > Actions > Runners**
2. Look for `arc-runner-set` in the list
3. Status should show "Idle" or "Active"

### Force Runner Restart

If runners are stuck:

```bash
# Delete runner pods (new ones will be created)
kubectl delete pods -n arc-runners -l app.kubernetes.io/component=runner

# If controller is stuck, restart it
kubectl rollout restart deployment -n arc-systems -l app.kubernetes.io/name=gha-runner-scale-set-controller
```

### Update Runner Configuration

1. Edit the values file: `k8s/arc/values-runner-set.yaml`
2. Apply the update:

```bash
helm upgrade arc-runner-set \
  --namespace arc-runners \
  oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set \
  --version 0.10.1 \
  -f k8s/arc/values-runner-set.yaml
```

### Scale Runners Manually

```bash
# Increase max runners temporarily
helm upgrade arc-runner-set \
  --namespace arc-runners \
  oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set \
  --version 0.10.1 \
  --set maxRunners=5 \
  --reuse-values
```

## Troubleshooting

### Runners Not Registering

1. Check the secret exists:
   ```bash
   kubectl get secret github-app-secret -n arc-runners
   ```

2. Verify secret contents:
   ```bash
   kubectl get secret github-app-secret -n arc-runners -o jsonpath='{.data.github_app_id}' | base64 -d
   ```

3. Check controller logs for auth errors:
   ```bash
   kubectl logs -n arc-systems -l app.kubernetes.io/name=gha-runner-scale-set-controller | grep -i error
   ```

### Workflow Stuck on "Queued"

1. Verify runners are registered in GitHub
2. Check if `runs-on: arc-runner-set` matches the scale set name
3. Verify runner pods can be scheduled:
   ```bash
   kubectl describe pods -n arc-runners
   ```

### Runner Pods CrashLooping

1. Check pod logs:
   ```bash
   kubectl logs -n arc-runners <pod-name>
   ```

2. Check events:
   ```bash
   kubectl get events -n arc-runners --sort-by='.lastTimestamp'
   ```

3. Common causes:
   - Memory limits too low
   - Image pull errors (check ARM64 compatibility)
   - ServiceAccount permissions

### kubectl Access Issues in Workflow

1. Verify RBAC is applied:
   ```bash
   kubectl get clusterrolebinding arc-runner-binding
   ```

2. Test permissions:
   ```bash
   kubectl auth can-i create namespaces --as=system:serviceaccount:arc-runners:arc-runner-sa
   ```

## Maintenance

### Update ARC Version

```bash
# Update controller
helm upgrade arc \
  --namespace arc-systems \
  oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set-controller \
  --version NEW_VERSION

# Update runner scale set
helm upgrade arc-runner-set \
  --namespace arc-runners \
  oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set \
  --version NEW_VERSION \
  -f k8s/arc/values-runner-set.yaml
```

### Rotate GitHub App Private Key

1. Generate new key in GitHub App settings
2. Update the secret:
   ```bash
   kubectl create secret generic github-app-secret \
     --namespace arc-runners \
     --from-literal=github_app_id="APP_ID" \
     --from-literal=github_app_installation_id="INSTALLATION_ID" \
     --from-file=github_app_private_key="new-private-key.pem" \
     --dry-run=client -o yaml | kubectl apply -f -
   ```
3. Restart controller:
   ```bash
   kubectl rollout restart deployment -n arc-systems
   ```

### Clean Up Completed Runner Pods

Runner pods should be automatically cleaned up, but if needed:

```bash
kubectl delete pods -n arc-runners --field-selector=status.phase=Succeeded
kubectl delete pods -n arc-runners --field-selector=status.phase=Failed
```

## Disaster Recovery

### Complete Reinstall

If ARC is completely broken:

```bash
# Remove everything
helm uninstall arc-runner-set -n arc-runners
helm uninstall arc -n arc-systems
kubectl delete namespace arc-runners
kubectl delete namespace arc-systems

# Wait for cleanup
sleep 30

# Reinstall following k8s/arc/README.md
```

### Backup Configuration

Key items to backup:
- GitHub App private key (stored securely outside cluster)
- `k8s/arc/values-*.yaml` files (in git)
- App ID and Installation ID (document in secure location)
