# CloudNativePG Operator

CloudNativePG is a Kubernetes operator for managing PostgreSQL databases.

## Installation

```bash
# Add the CloudNativePG Helm repository
helm repo add cnpg https://cloudnative-pg.github.io/charts
helm repo update

# Install the operator
helm upgrade --install cnpg cnpg/cloudnative-pg \
  --namespace cnpg-system \
  --create-namespace \
  --values k8s/operators/cloudnative-pg/values.yaml \
  --wait
```

## Verify Installation

```bash
# Check operator pod is running
kubectl get pods -n cnpg-system

# Check CRDs are installed
kubectl get crds | grep cnpg

# Expected CRDs:
# - backups.postgresql.cnpg.io
# - clusters.postgresql.cnpg.io
# - poolers.postgresql.cnpg.io
# - scheduledbackups.postgresql.cnpg.io
```

## Usage

Once installed, projects can create PostgreSQL clusters by deploying a `Cluster` resource:

```yaml
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: my-database
spec:
  instances: 1
  storage:
    size: 1Gi
```

The operator will:
1. Create the PostgreSQL StatefulSet
2. Generate credentials and store in a Secret (`my-database-app`)
3. Create Services for connectivity

## Auto-Generated Secrets

CloudNativePG automatically creates these secrets:

| Secret | Contents |
|--------|----------|
| `{cluster}-app` | Application credentials: `host`, `port`, `dbname`, `user`, `password`, `uri` |
| `{cluster}-superuser` | Superuser credentials (for admin tasks) |

## Uninstallation

```bash
helm uninstall cnpg -n cnpg-system
kubectl delete namespace cnpg-system
```

## References

- [CloudNativePG Documentation](https://cloudnative-pg.io/documentation/)
- [Helm Chart Repository](https://github.com/cloudnative-pg/charts)
- [Artifact Hub](https://artifacthub.io/packages/helm/cloudnative-pg/cloudnative-pg)
