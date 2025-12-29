# MinIO Operator

MinIO Operator for managing S3-compatible object storage on Kubernetes.

## Installation

```bash
# Add the MinIO Operator Helm repository
helm repo add minio-operator https://operator.min.io/
helm repo update

# Install the operator
helm upgrade --install minio-operator minio-operator/operator \
  --namespace minio-operator \
  --create-namespace \
  --values k8s/operators/minio/values.yaml \
  --wait
```

## Verify Installation

```bash
# Check operator pod is running
kubectl get pods -n minio-operator

# Check CRDs are installed
kubectl get crds | grep minio

# Expected CRDs:
# - tenants.minio.min.io
```

## Usage

Once installed, projects can create MinIO tenants by deploying a `Tenant` resource:

```yaml
apiVersion: minio.min.io/v2
kind: Tenant
metadata:
  name: my-minio
spec:
  pools:
    - servers: 1
      volumesPerServer: 1
      size: 1Gi
  requestAutoCert: false
  users:
    - name: my-minio-user
  buckets:
    - name: data
```

## Auto-Generated Secrets

MinIO Operator creates these secrets:

| Secret | Contents |
|--------|----------|
| `{tenant}-secret` | Root credentials with `accesskey` and `secretkey` |
| `{tenant}-user-{n}` | User credentials |

## Uninstallation

```bash
helm uninstall minio-operator -n minio-operator
kubectl delete namespace minio-operator
```

## References

- [MinIO Operator](https://github.com/minio/operator)
- [Deploy Operator With Helm](https://min.io/docs/minio/kubernetes/upstream/operations/install-deploy-manage/deploy-operator-helm.html)
