# Cluster Recovery Runbook

Procedures for recovering the k3s cluster from various failure scenarios.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Severity Classification](#severity-classification)
- [Recovery Scenarios](#recovery-scenarios)
- [k3s Reinstallation](#k3s-reinstallation)
- [Service Restoration](#service-restoration)
- [Verification Procedures](#verification-procedures)

## Overview

This runbook covers disaster recovery procedures for the k8s-ephemeral-environments platform running on k3s. Use this when:
- k3s service fails to start
- Node becomes unresponsive
- Cluster state is corrupted
- Full reinstallation is required

## Prerequisites

Before starting recovery:

1. **VPS Access**
   ```bash
   ssh ubuntu@168.138.151.63
   ```

2. **Backup Locations**
   - kubeconfig: `/etc/rancher/k3s/k3s.yaml`
   - k3s data: `/var/lib/rancher/k3s/`
   - Sealed Secrets key: `sealed-secrets-key` secret in `kube-system`

3. **GitHub Secrets**
   - `KUBECONFIG` - Cluster access for GitHub Actions
   - `GHCR_TOKEN` - Container registry access

## Severity Classification

| Severity | Description | Examples |
|----------|-------------|----------|
| P1 - Critical | Cluster completely down | k3s won't start, node unreachable |
| P2 - High | Major functionality impacted | Operators failing, ingress down |
| P3 - Medium | Partial degradation | Single namespace issues |
| P4 - Low | Minor issues | Log collection gaps |

## Recovery Scenarios

### k3s Service Failure

**Symptoms:**
- `kubectl` commands fail with connection errors
- k3s service not running

**Diagnosis:**
```bash
# Check service status
sudo systemctl status k3s

# Check logs
sudo journalctl -u k3s -n 100 --no-pager

# Check disk space
df -h
```

**Resolution:**
```bash
# Restart k3s
sudo systemctl restart k3s

# Wait for node to be ready
kubectl get nodes --watch

# If restart fails, check for port conflicts
sudo netstat -tlnp | grep -E '6443|10250'
```

### Node Not Ready

**Symptoms:**
- Node shows `NotReady` status
- Pods stuck in `Pending` or `Unknown`

**Diagnosis:**
```bash
# Check node status
kubectl describe node genilda

# Check kubelet logs
sudo journalctl -u k3s -f
```

**Resolution:**
```bash
# Drain node (if possible)
kubectl drain genilda --ignore-daemonsets --delete-emptydir-data

# Restart k3s
sudo systemctl restart k3s

# Uncordon node
kubectl uncordon genilda
```

### Disk Full

**Symptoms:**
- Pods failing to start
- Logs show `no space left on device`

**Diagnosis:**
```bash
# Check disk usage
df -h
du -sh /var/lib/rancher/k3s/*
du -sh /var/log/*

# Check container images
sudo crictl images
```

**Resolution:**
```bash
# Clean unused images
sudo crictl rmi --prune

# Clean old logs
sudo journalctl --vacuum-time=3d

# Remove old PR namespaces
kubectl get ns -l k8s-ee/pr-number --sort-by='.metadata.creationTimestamp'
kubectl delete ns <old-namespaces>

# Clean k3s containerd
sudo k3s crictl rmi --prune
```

### etcd Corruption

**Symptoms:**
- k3s fails with etcd errors
- Inconsistent cluster state

**Diagnosis:**
```bash
# Check etcd status (k3s uses embedded sqlite by default)
sudo ls -la /var/lib/rancher/k3s/server/db/

# Check for corruption
sudo journalctl -u k3s | grep -i "etcd\|database"
```

**Resolution:**
```bash
# Stop k3s
sudo systemctl stop k3s

# Backup current state
sudo cp -r /var/lib/rancher/k3s/server/db /var/lib/rancher/k3s/server/db.backup

# If using sqlite (default), reset
sudo rm /var/lib/rancher/k3s/server/db/state.db*

# Restart k3s (will recreate database)
sudo systemctl start k3s
```

> **Warning:** This loses cluster state. Reapply all manifests after recovery.

### Network Issues

**Symptoms:**
- Pods can't communicate
- External traffic not reaching cluster

**Diagnosis:**
```bash
# Check Traefik
kubectl get pods -n kube-system -l app.kubernetes.io/name=traefik
kubectl logs -n kube-system -l app.kubernetes.io/name=traefik

# Check DNS
kubectl get pods -n kube-system -l k8s-app=kube-dns
kubectl logs -n kube-system -l k8s-app=kube-dns

# Test DNS resolution
kubectl run debug --rm -it --image=busybox -- nslookup kubernetes
```

**Resolution:**
```bash
# Restart CoreDNS
kubectl rollout restart deployment -n kube-system coredns

# Restart Traefik
kubectl rollout restart deployment -n kube-system traefik

# If networking completely broken, restart k3s
sudo systemctl restart k3s
```

## k3s Reinstallation

Complete reinstallation procedure when recovery isn't possible.

### Step 1: Backup Critical Data

```bash
# Backup kubeconfig
sudo cp /etc/rancher/k3s/k3s.yaml ~/k3s-backup.yaml

# Backup Sealed Secrets key (if accessible)
kubectl get secret -n kube-system sealed-secrets-key -o yaml > ~/sealed-secrets-key.yaml

# Export important secrets
kubectl get secrets -A -o yaml > ~/all-secrets-backup.yaml
```

### Step 2: Uninstall k3s

```bash
# Run uninstall script
/usr/local/bin/k3s-uninstall.sh

# Verify clean removal
ls /var/lib/rancher/
ls /etc/rancher/
```

### Step 3: Reinstall k3s

```bash
# Install k3s
curl -sfL https://get.k3s.io | sh -

# Wait for k3s to start
sudo systemctl status k3s
kubectl get nodes
```

### Step 4: Update GitHub Secrets

```bash
# Get new kubeconfig
sudo cat /etc/rancher/k3s/k3s.yaml

# Update KUBECONFIG secret in GitHub repository settings
# Replace server address: https://168.138.151.63:6443
```

### Step 5: Restore Platform

Follow the [Service Restoration](#service-restoration) section.

## Service Restoration

Order matters. Restore services in this sequence:

### Phase 1: Core Infrastructure

```bash
# 1. Verify k3s is running
kubectl get nodes
kubectl get pods -n kube-system

# 2. Apply platform namespace
kubectl apply -f k8s/platform/namespace.yaml

# 3. Restore Sealed Secrets (if backed up)
kubectl apply -f ~/sealed-secrets-key.yaml
```

### Phase 2: Operators

```bash
# 1. CloudNativePG (via Helm)
helm repo add cnpg https://cloudnative-pg.github.io/charts
helm upgrade --install cnpg cnpg/cloudnative-pg \
  -n cnpg-system --create-namespace \
  -f k8s/operators/cloudnative-pg/values.yaml
kubectl wait --for=condition=available deployment/cnpg-controller-manager -n cnpg-system

# 2. MongoDB Operator (via Helm)
helm repo add mongodb https://mongodb.github.io/helm-charts
helm upgrade --install mongodb-operator mongodb/community-operator \
  -n mongodb-operator --create-namespace \
  -f k8s/operators/mongodb-community/values.yaml
kubectl wait --for=condition=available deployment/mongodb-kubernetes-operator -n mongodb-operator

# 3. MinIO Operator (via Helm)
helm repo add minio https://operator.min.io
helm upgrade --install minio-operator minio/operator \
  -n minio-operator --create-namespace \
  -f k8s/operators/minio/values.yaml
kubectl wait --for=condition=available deployment/minio-operator -n minio-operator
```

### Phase 3: Observability

```bash
# 1. Create namespace
kubectl create namespace observability

# 2. Deploy kube-prometheus-stack (includes Prometheus + Grafana)
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  -n observability \
  -f k8s/observability/kube-prometheus-stack/values.yaml

# 3. Deploy Loki
helm repo add grafana https://grafana.github.io/helm-charts
helm upgrade --install loki grafana/loki \
  -n observability \
  -f k8s/observability/loki/values.yaml

# 4. Deploy Promtail
helm upgrade --install promtail grafana/promtail \
  -n observability \
  -f k8s/observability/promtail/values.yaml

# 5. Apply Grafana ingress
kubectl apply -f k8s/observability/grafana-ingress.yaml
```

### Phase 4: GitHub Runners

```bash
# 1. Create namespace
kubectl create namespace gh-runners

# 2. Install ARC controller
helm upgrade --install arc \
  oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set-controller \
  -n gh-runners \
  -f k8s/arc/values-controller.yaml

# 3. Apply RBAC
kubectl apply -f k8s/arc/controller-rbac.yaml
kubectl apply -f k8s/arc/runner-rbac.yaml

# 4. Install runner scale set
helm upgrade --install arc-runner-set \
  oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set \
  -n gh-runners \
  -f k8s/arc/values-runner-set.yaml
```

### Phase 5: Platform Jobs

```bash
# 1. Cleanup job
kubectl apply -f k8s/platform/cleanup-job/

# 2. Preserve expiry job
kubectl apply -f k8s/platform/preserve-expiry/
```

## Verification Procedures

### Cluster Health Check

```bash
#!/bin/bash
echo "=== Node Status ==="
kubectl get nodes

echo "=== System Pods ==="
kubectl get pods -n kube-system

echo "=== Operators ==="
kubectl get pods -n cnpg-system
kubectl get pods -n mongodb-operator
kubectl get pods -n minio-operator

echo "=== Observability ==="
kubectl get pods -n observability

echo "=== GitHub Runners ==="
kubectl get pods -n gh-runners

echo "=== Platform Jobs ==="
kubectl get cronjobs -n platform
```

### Test PR Deployment

Create a test PR or manually deploy:

```bash
# Create test namespace
kubectl create ns test-recovery

# Deploy demo app
helm upgrade --install test-app ./charts/demo-app \
  -n test-recovery \
  --set prNumber=0 \
  --set previewDomain=k8s-ee.genesluna.dev

# Verify
kubectl get pods -n test-recovery
kubectl get ingress -n test-recovery

# Cleanup
kubectl delete ns test-recovery
```

### Verify External Access

```bash
# Test Traefik ingress
curl -I https://grafana.k8s-ee.genesluna.dev

# Test DNS resolution
nslookup k8s-ee-pr-1.k8s-ee.genesluna.dev
```

## Related Documentation

- [VPS Access Runbook](vps-access.md)
- [k3s Operations Runbook](k3s-operations.md)
- [ARC Operations Runbook](arc-operations.md)
- [Database Operators Runbook](database-operators.md)
