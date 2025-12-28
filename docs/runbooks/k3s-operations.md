# Runbook: k3s Operations

## Overview

This runbook documents k3s cluster operations for the ephemeral environments platform.

## Cluster Details

| Attribute | Value |
|-----------|-------|
| **k3s Version** | v1.33.6+k3s1 |
| **Node** | genilda (single-node) |
| **Architecture** | ARM64 |
| **Ingress** | Traefik (bundled) |
| **Storage** | Local Path Provisioner |

## kubectl Access

### On the VPS

```bash
# kubectl is pre-configured for ubuntu user
kubectl get nodes
kubectl get pods -A
```

### From Local Machine

1. Ensure port 6443 is open in Oracle Cloud security list
2. Copy kubeconfig:

```bash
ssh ubuntu@168.138.151.63 "sudo cat /etc/rancher/k3s/k3s.yaml" | \
  sed 's/127.0.0.1/168.138.151.63/g' > ~/.kube/k3s-config
```

3. Use the config:

```bash
export KUBECONFIG=~/.kube/k3s-config
kubectl get nodes
```

## Common Commands

### Cluster Status

```bash
# Node status
kubectl get nodes -o wide

# All pods
kubectl get pods -A

# System components
kubectl get pods -n kube-system

# Events
kubectl get events -A --sort-by='.lastTimestamp'
```

### k3s Service Management

```bash
# Check k3s status
sudo systemctl status k3s

# View k3s logs
sudo journalctl -u k3s -f

# Restart k3s
sudo systemctl restart k3s

# Stop k3s (careful!)
sudo systemctl stop k3s
```

### Resource Usage

```bash
# Node resources
kubectl top nodes

# Pod resources (requires metrics-server)
kubectl top pods -A

# Detailed node info
kubectl describe node genilda
```

### Storage

```bash
# List storage classes
kubectl get sc

# List PVCs
kubectl get pvc -A

# List PVs
kubectl get pv
```

### Ingress (Traefik)

```bash
# Traefik status
kubectl get pods -n kube-system -l app.kubernetes.io/name=traefik

# Ingress resources
kubectl get ingress -A

# Traefik IngressRoutes (CRD)
kubectl get ingressroute -A
```

## Troubleshooting

### k3s Won't Start

1. Check service status:
   ```bash
   sudo systemctl status k3s
   ```

2. Check logs:
   ```bash
   sudo journalctl -u k3s --no-pager -n 100
   ```

3. Check disk space:
   ```bash
   df -h
   ```

4. Manual restart:
   ```bash
   sudo systemctl restart k3s
   ```

### Pods Stuck in Pending

1. Check events:
   ```bash
   kubectl describe pod <pod-name> -n <namespace>
   ```

2. Common causes:
   - Insufficient resources: check `kubectl describe node`
   - PVC not binding: check `kubectl get pvc -A`
   - Image pull issues: check pod events

### Traefik Not Working

1. Check Traefik pods:
   ```bash
   kubectl get pods -n kube-system -l app.kubernetes.io/name=traefik
   kubectl logs -n kube-system -l app.kubernetes.io/name=traefik
   ```

2. Check service:
   ```bash
   kubectl get svc -n kube-system traefik
   ```

3. Verify ports 80/443 are open in Oracle Cloud firewall

### Node NotReady

1. Check kubelet:
   ```bash
   sudo systemctl status k3s
   ```

2. Check node conditions:
   ```bash
   kubectl describe node genilda | grep -A5 Conditions
   ```

3. Common causes:
   - Disk pressure
   - Memory pressure
   - Network issues

## Maintenance

### Clean Up Old Images

```bash
sudo crictl rmi --prune
```

### Clean Up Old Logs

```bash
sudo journalctl --vacuum-time=3d
```

### Backup kubeconfig

```bash
sudo cp /etc/rancher/k3s/k3s.yaml /root/k3s-backup.yaml
```

## Uninstall k3s

**Warning:** This will destroy all data!

```bash
/usr/local/bin/k3s-uninstall.sh
```

## Recovery After VPS Reboot

k3s is configured to start automatically. After reboot:

1. Wait ~1 minute for services to start
2. Verify cluster:
   ```bash
   kubectl get nodes
   kubectl get pods -n kube-system
   ```

3. All pods should recover automatically (may show restarts)

## Related Runbooks

- [VPS Access](./vps-access.md)
- [Cluster Recovery](./cluster-recovery.md) (to be created)
