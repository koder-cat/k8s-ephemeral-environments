# Phase 2 Migration Guide: k3s to Amazon EKS

This guide documents cluster-specific configurations and considerations for migrating from the current k3s VPS deployment (Phase 1) to Amazon EKS (Phase 2).

## Current Architecture (Phase 1)

- **Cluster**: k3s on single VPS (Oracle Cloud, ARM64)
- **Node**: Ubuntu 24.04 on ARM64 (Ampere A1)
- **API Server**: Host network at `10.0.0.39:6443`
- **Pod CIDR**: `10.42.0.0/16`
- **Service CIDR**: `10.43.0.0/16`
- **Ingress**: Traefik (bundled with k3s)

## Cluster-Specific Configurations

### NetworkPolicy: Kubernetes API Access

The ephemeral environment NetworkPolicy requires access to the Kubernetes API server for CloudNativePG job status reporting.

**File**: `k8s/ephemeral/network-policy-allow-egress.yaml`

**Current Configuration (k3s)**:
```yaml
# K8S_API_IP environment variable set in GitHub workflow
- to:
    - ipBlock:
        cidr: ${K8S_API_IP}/32
  ports:
    - protocol: TCP
      port: 6443
```

**Environment Variable**: Set in `.github/workflows/pr-environment.yml`
```yaml
env:
  K8S_API_IP: "10.0.0.39"  # k3s API server on VPS host network
```

#### EKS Migration Notes

For EKS, the API server endpoint differs based on your configuration:

1. **Public Endpoint**: Use the EKS API server public IP (changes on updates)
2. **Private Endpoint**: Use VPC endpoint IP range
3. **Recommended**: Use CIDR ranges instead of single IPs

**EKS Example**:
```yaml
env:
  # Option 1: EKS public endpoint (requires periodic updates)
  K8S_API_IP: "x.x.x.x"

  # Option 2: Use broader CIDR for VPC endpoints
  # Modify network-policy-allow-egress.yaml to use CIDR range
```

Consider using the Kubernetes service IP (`kubernetes.default.svc`) which resolves to `10.100.0.1` on EKS (default service CIDR), though DNAT evaluation order issues may apply.

### PriorityClasses

**File**: `k8s/platform/priority-classes.yaml`

Currently defines two priority classes:
- `system-platform` (value: 1000000) - Platform components
- `default-app` (value: 100) - Ephemeral PR workloads

**EKS Consideration**: EKS includes additional system priority classes. Verify values don't conflict with:
- `system-cluster-critical` (2000000000)
- `system-node-critical` (2000001000)

### Pod Disruption Budgets

**Current Status**: Not implemented for Phase 1 (single-node k3s).

**Phase 2 Requirement**: When migrating to multi-node EKS, add PDBs for:
- Observability stack (Prometheus, Grafana, Loki)
- Database operators (CloudNativePG, MongoDB, MinIO)
- Platform CronJobs (if converted to Deployments)

**Recommended PDB Configuration**:
```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: prometheus-pdb
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: prometheus
```

### Ingress Controller

**Current**: Traefik (bundled with k3s)

**EKS Options**:
1. AWS Load Balancer Controller (recommended for AWS integration)
2. Traefik (via Helm, for consistency)
3. NGINX Ingress Controller

**Migration Steps**:
1. Update ingress annotations for chosen controller
2. Configure TLS certificate management (AWS ACM or cert-manager)
3. Update DNS to point to new load balancer

### Storage Classes

**Current**: k3s local-path provisioner

**EKS Options**:
- `gp3` (EBS General Purpose SSD, recommended)
- `gp2` (EBS General Purpose SSD, legacy)
- `io1`/`io2` (EBS Provisioned IOPS)

**Migration Steps**:
1. Update StorageClass references in Helm values
2. Plan PVC migration strategy (backup/restore)

### Container Architecture

**Current**: ARM64 (`linux/arm64`)

**EKS Considerations**:
- Use Graviton instances for ARM64 compatibility
- Or rebuild images for AMD64 if using x86 instances
- Update GitHub Actions workflow to build for target architecture

### GitHub Actions Runners

**Current**: Self-hosted runners on k3s (ARC)

**EKS Options**:
1. Continue with self-hosted runners on EKS
2. Use GitHub-hosted runners with `kubectl` access via VPN/PrivateLink
3. Use AWS CodeBuild for in-VPC execution

## Migration Checklist

- [ ] Provision EKS cluster with appropriate node groups
- [ ] Configure VPC networking and security groups
- [ ] Install required operators (CNPG, MongoDB, MinIO)
- [ ] Update `K8S_API_IP` environment variable in workflow
- [ ] Configure ingress controller and TLS
- [ ] Migrate DNS records
- [ ] Update storage class references
- [ ] Add Pod Disruption Budgets
- [ ] Configure GitHub Actions runner access
- [ ] Test ephemeral environment lifecycle
- [ ] Update monitoring and alerting

## Environment Variables Summary

| Variable | Phase 1 (k3s) | Phase 2 (EKS) |
|----------|---------------|---------------|
| `K8S_API_IP` | `10.0.0.39` | EKS API endpoint IP |
| `PREVIEW_DOMAIN` | `k8s-ee.genesluna.dev` | TBD |
| `PROJECT_ID` | `k8s-ee` | `k8s-ee` (unchanged) |

## References

- [Amazon EKS Documentation](https://docs.aws.amazon.com/eks/)
- [CloudNativePG on EKS](https://cloudnative-pg.io/documentation/current/installation_upgrade/)
- [Traefik on EKS](https://doc.traefik.io/traefik/providers/kubernetes-ingress/)
- [AWS Load Balancer Controller](https://kubernetes-sigs.github.io/aws-load-balancer-controller/)
