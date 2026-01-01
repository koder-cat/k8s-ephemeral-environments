# Security Model

This document describes the security architecture of the k8s-ephemeral-environments platform.

## Overview

The platform implements defense-in-depth with multiple security layers:

1. **Access Control** - Organization allowlist restricts who can create environments
2. **Network Isolation** - NetworkPolicies restrict pod-to-pod communication
3. **Secret Management** - Sealed Secrets for GitOps-safe secret storage
4. **Container Security** - Non-root containers with dropped capabilities
5. **Image Security** - CVE scanning and SBOM generation
6. **Resource Isolation** - ResourceQuota and LimitRange per namespace

## Access Control

### Organization Allowlist

The platform uses an organization allowlist to control which GitHub organizations and users can create ephemeral environments. This prevents unauthorized use of cluster resources.

**Configuration:** `.github/config/allowed-orgs.json`

```json
{
  "mode": "allowlist",
  "organizations": ["genesluna", "koder-cat"],
  "repositories": []
}
```

### How It Works

1. When a PR triggers the reusable workflow, the owner is extracted from the repository name
2. The owner is checked against the allowlist (case-insensitive)
3. If not authorized, the workflow fails immediately with a clear error message
4. Only authorized organizations/users can consume cluster resources

### Security Properties

| Property | Description |
|----------|-------------|
| **Case-insensitive** | Prevents bypass via case manipulation |
| **Fail-safe** | Empty allowlist denies all access |
| **Audit trail** | Changes tracked in git history |
| **CODEOWNERS protected** | Requires owner approval to modify |

### Modes

- `allowlist` - Only listed organizations allowed (recommended)
- `denylist` - All except listed organizations allowed
- `disabled` - No access control (not recommended)

See [Access Control Guide](./access-control.md) for complete documentation.

## Network Isolation

### Default Deny Policy

All PR namespaces start with a default-deny policy that blocks all ingress and egress traffic:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
```

### Allowed Traffic

Specific policies allow only necessary traffic:

| Policy | Direction | From/To | Port | Purpose |
|--------|-----------|---------|------|---------|
| allow-ingress-controller | Ingress | Traefik (kube-system) | 3000 | External HTTP/HTTPS via preview URLs |
| allow-same-namespace | Ingress | Same namespace | All | App-to-database communication |
| allow-egress | Egress | DNS, K8s API, Internet | 53, 6443, * | DNS resolution, external APIs |
| allow-observability | Ingress | Prometheus (observability) | All | Metrics scraping |

### Cross-Namespace Isolation

- PR namespaces cannot communicate with each other
- Only platform namespaces (kube-system, observability) can access PR namespaces
- Database access is restricted to the same namespace

## Secret Management

### Sealed Secrets

The platform uses Bitnami Sealed Secrets for encrypting secrets in Git:

```bash
# Encrypt a secret
kubeseal --controller-name=sealed-secrets \
  --controller-namespace=kube-system \
  --format yaml < secret.yaml > sealed-secret.yaml
```

### Auto-Generated Credentials

Database operators (CloudNativePG, MongoDB Community, MinIO) automatically generate secure credentials:

- Credentials stored in Kubernetes Secrets
- Secrets scoped to the PR namespace
- Automatic cleanup on namespace deletion

### Secrets Not Committed to Git

- `.gitignore` excludes all secret files
- Sealed Secrets allow encrypted secrets in Git
- CI/CD uses GitHub Secrets for deployment credentials

## Container Security

### Security Context (Pod Level)

All workloads run with restricted pod security contexts:

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1001
  runAsGroup: 1001
  fsGroup: 1001
```

### Security Context (Container Level)

Containers have additional restrictions:

```yaml
securityContext:
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true  # where possible
  capabilities:
    drop:
      - ALL
```

### Workload-Specific Settings

| Workload | UID | readOnlyRootFilesystem | Notes |
|----------|-----|------------------------|-------|
| Demo App | 1001 | true | NestJS + React |
| PostgreSQL | Operator-managed | Operator-managed | CloudNativePG |
| MongoDB | 999 | false | Needs data writes |
| MinIO | 1000 | false | Needs data writes |
| Redis | 999 | true | No persistent data |
| Cleanup Jobs | 1000 | true | Python scripts |

## Image Security

### CVE Scanning

All container images are scanned with Trivy before deployment:

- Scans run after Docker build in CI/CD
- Reports CRITICAL and HIGH severity vulnerabilities
- Ignores unfixed vulnerabilities (no available patches)
- Results uploaded to GitHub Security tab (SARIF format)
- Findings are informational (don't block PR deployments)

### SBOM Generation

Software Bill of Materials (SBOM) generated for supply chain transparency:

- Format: SPDX JSON
- Generated using Anchore's sbom-action
- Uploaded as workflow artifact (30-day retention)

### Image Pinning

All images use pinned versions for reproducibility:

| Image | Version | Notes |
|-------|---------|-------|
| bitnami/kubectl | 1.31.4 | ARM64 verified |
| python | 3.12-alpine | Scripts |
| node | 22-alpine | Demo app base |

## Resource Isolation

### ResourceQuota

Each PR namespace has **dynamically calculated** resource limits based on enabled databases:

| Configuration | CPU Limit | Memory Limit | Storage |
|---------------|-----------|--------------|---------|
| App only | 300m | 512Mi | 1Gi |
| App + PostgreSQL | 800m | 1Gi | 3Gi |
| App + PostgreSQL + Redis | 1000m | 1.1Gi | 3Gi |
| All databases enabled | 2100m | 2.4Gi | 9Gi |

The quota is calculated at namespace creation based on the `databases` section in `k8s-ee.yaml`. See [Resource Requirements by Database](./k8s-ee-config-reference.md#resource-requirements-by-database) for details.

Example quota (with PostgreSQL + MongoDB enabled):

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: pr-quota
spec:
  hard:
    requests.cpu: "600m"
    requests.memory: 768Mi
    limits.cpu: "1300m"
    limits.memory: 1536Mi
    persistentvolumeclaims: "3"
    requests.storage: 5Gi
```

### LimitRange

Default limits for pods without explicit resource requests:

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: pr-limits
spec:
  limits:
    - type: Container
      defaultRequest:
        cpu: 50m
        memory: 64Mi
      default:
        cpu: 200m
        memory: 256Mi
```

## Platform Components Security

| Component | Security Measures |
|-----------|-------------------|
| Reusable Workflow | Organization allowlist, CODEOWNERS protection |
| GitHub Actions Runners | Ephemeral pods, isolated namespace, limited RBAC |
| Traefik Ingress | TLS termination, rate limiting, security headers |
| Prometheus/Loki | Read-only access to PR namespaces |
| Cleanup Jobs | Minimal RBAC, non-root, read-only filesystem |

## RBAC

### Cleanup Job Service Account

The cleanup job uses a dedicated service account with minimal permissions:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: cleanup-job-role
rules:
  - apiGroups: [""]
    resources: ["namespaces"]
    verbs: ["get", "list", "delete", "patch"]
  - apiGroups: [""]
    resources: ["persistentvolumeclaims"]
    verbs: ["get", "list", "patch"]
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list"]
```

### GitHub Actions Runner

Runners have cluster-admin access within their assigned namespace only.

## Security Checklist for New Projects

- [ ] Verify organization is in allowlist (`.github/config/allowed-orgs.json`)
- [ ] Use pinned image tags (never `:latest`)
- [ ] Set resource requests and limits
- [ ] Configure security context (runAsNonRoot)
- [ ] Drop all capabilities
- [ ] Use readOnlyRootFilesystem where possible
- [ ] Store secrets in Sealed Secrets
- [ ] Review NetworkPolicy compatibility

## Incident Response

### Compromised Container

1. Delete the PR environment: `kubectl delete ns <namespace>`
2. Revoke any exposed secrets
3. Review audit logs in Loki
4. Check for lateral movement attempts in other namespaces

### Orphaned Resources

The cleanup CronJob runs every 6 hours to remove:
- Namespaces for closed PRs
- Expired preserve labels

Manual cleanup: `kubectl delete ns <namespace>`

## References

- [Access Control Guide](./access-control.md) - Organization allowlist configuration
- [Kubernetes Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
- [Sealed Secrets](https://sealed-secrets.netlify.app/)
- [Trivy Scanner](https://aquasecurity.github.io/trivy/)
- [NetworkPolicy Recipes](https://github.com/ahmetb/kubernetes-network-policy-recipes)
