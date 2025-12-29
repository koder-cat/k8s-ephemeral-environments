# Database Operators Runbook

This runbook covers operations for the database operators installed on the k8s-ephemeral-environments platform.

## Installed Operators

| Operator | Namespace | CRD | Purpose |
|----------|-----------|-----|---------|
| CloudNativePG | `cnpg-system` | `clusters.postgresql.cnpg.io` | PostgreSQL |
| MongoDB Community | `mongodb-system` | `mongodbcommunity.mongodbcommunity.mongodb.com` | MongoDB |
| MinIO | `minio-operator` | `tenants.minio.min.io` | S3-compatible storage |

## Health Checks

### Check All Operators

```bash
# Quick status of all operator pods
kubectl get pods -n cnpg-system
kubectl get pods -n mongodb-system
kubectl get pods -n minio-operator

# Check CRDs are installed
kubectl get crds | grep -E 'cnpg|mongodb|minio'
```

### Check CloudNativePG

```bash
# Operator pod status
kubectl get pods -n cnpg-system

# Operator logs
kubectl logs -n cnpg-system -l app.kubernetes.io/name=cloudnative-pg --tail=100

# List all PostgreSQL clusters
kubectl get clusters.postgresql.cnpg.io -A
```

### Check MongoDB

```bash
# Operator pod status
kubectl get pods -n mongodb-system

# Operator logs
kubectl logs -n mongodb-system -l app.kubernetes.io/name=mongodb-kubernetes-operator --tail=100

# List all MongoDB instances
kubectl get mongodbcommunity -A
```

### Check MinIO

```bash
# Operator pod status
kubectl get pods -n minio-operator

# Operator logs
kubectl logs -n minio-operator -l app.kubernetes.io/name=operator --tail=100

# List all MinIO tenants
kubectl get tenants.minio.min.io -A
```

## Troubleshooting

### Database Not Starting

1. **Check the database resource status:**
   ```bash
   # PostgreSQL
   kubectl describe cluster <name> -n <namespace>

   # MongoDB
   kubectl describe mongodbcommunity <name> -n <namespace>

   # MinIO
   kubectl describe tenant <name> -n <namespace>
   ```

2. **Check operator logs:**
   ```bash
   kubectl logs -n cnpg-system -l app.kubernetes.io/name=cloudnative-pg --tail=200
   ```

3. **Check events in namespace:**
   ```bash
   kubectl get events -n <namespace> --sort-by='.lastTimestamp'
   ```

### Credentials Not Generated

Operators create secrets asynchronously. Check if the secret exists:

```bash
# List secrets in namespace
kubectl get secrets -n <namespace>

# PostgreSQL secrets follow pattern: {cluster-name}-app
kubectl get secret <cluster-name>-app -n <namespace> -o yaml

# MongoDB secrets follow pattern: {user}-{resource}-{db}
kubectl get secret <user>-<resource>-admin -n <namespace> -o yaml
```

### Resource Quota Exceeded

Database pods may fail if namespace quota is exceeded:

```bash
# Check quota usage
kubectl describe resourcequota -n <namespace>

# Reduce database resources in values.yaml if needed
```

### PVC Stuck in Pending

```bash
# Check PVC status
kubectl get pvc -n <namespace>

# Describe PVC for events
kubectl describe pvc <pvc-name> -n <namespace>

# Check storage class exists
kubectl get storageclass
```

## Operator Upgrades

### Upgrade CloudNativePG

```bash
helm repo update
helm upgrade cnpg cnpg/cloudnative-pg \
  --namespace cnpg-system \
  --values k8s/operators/cloudnative-pg/values.yaml
```

### Upgrade MongoDB Operator

```bash
helm repo update
helm upgrade mongodb-community-operator mongodb/community-operator \
  --namespace mongodb-system \
  --values k8s/operators/mongodb-community/values.yaml
```

### Upgrade MinIO Operator

```bash
helm repo update
helm upgrade minio-operator minio-operator/operator \
  --namespace minio-operator \
  --values k8s/operators/minio/values.yaml
```

## Uninstallation

> **Warning:** Uninstalling operators will NOT delete existing database instances, but they will become unmanaged.

### Remove CloudNativePG

```bash
# First, delete all clusters
kubectl delete clusters.postgresql.cnpg.io -A --all

# Then uninstall operator
helm uninstall cnpg -n cnpg-system
kubectl delete namespace cnpg-system
```

### Remove MongoDB Operator

```bash
# First, delete all instances
kubectl delete mongodbcommunity -A --all

# Then uninstall operator
helm uninstall mongodb-community-operator -n mongodb-system
kubectl delete namespace mongodb-system
```

### Remove MinIO Operator

```bash
# First, delete all tenants
kubectl delete tenants.minio.min.io -A --all

# Then uninstall operator
helm uninstall minio-operator -n minio-operator
kubectl delete namespace minio-operator
```

## Monitoring

### View Database Metrics

Database pods expose metrics that can be scraped by Prometheus:

- **PostgreSQL:** Port 9187 (via CloudNativePG)
- **MongoDB:** Port 9216 (mongodb-exporter sidecar)
- **MinIO:** Port 9000/minio/v2/metrics/cluster

### Useful Queries

```promql
# PostgreSQL connections
cnpg_backends_total

# MongoDB operations
mongodb_op_counters_total

# MinIO storage used
minio_bucket_usage_total_bytes
```

## Backup Considerations

For ephemeral PR environments, backups are typically not needed. For staging environments:

### PostgreSQL Backup

CloudNativePG supports scheduled backups:

```yaml
apiVersion: postgresql.cnpg.io/v1
kind: ScheduledBackup
metadata:
  name: backup-schedule
spec:
  schedule: "0 0 * * *"
  cluster:
    name: my-cluster
  backupOwnerReference: self
```

### MongoDB Backup

Use `mongodump` in a CronJob or MongoDB Ops Manager for enterprise.

### MinIO Backup

MinIO supports bucket replication for disaster recovery.

## References

- [CloudNativePG Documentation](https://cloudnative-pg.io/documentation/)
- [MongoDB Community Operator](https://github.com/mongodb/mongodb-kubernetes-operator)
- [MinIO Operator](https://min.io/docs/minio/kubernetes/upstream/)
