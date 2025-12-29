# MongoDB Community Operator

MongoDB Community Operator for managing MongoDB deployments on Kubernetes.

> **Note:** The MongoDB Community Operator is being unified with the Enterprise operator.
> See [mongodb/mongodb-kubernetes](https://github.com/mongodb/mongodb-kubernetes) for the new unified operator.
> The community operator will be supported until November 2025.

## Installation

```bash
# Add the MongoDB Helm repository
helm repo add mongodb https://mongodb.github.io/helm-charts
helm repo update

# Install the operator
helm upgrade --install mongodb-community-operator mongodb/community-operator \
  --namespace mongodb-system \
  --create-namespace \
  --values k8s/operators/mongodb-community/values.yaml \
  --wait
```

## Verify Installation

```bash
# Check operator pod is running
kubectl get pods -n mongodb-system

# Check CRDs are installed
kubectl get crds | grep mongodb

# Expected CRDs:
# - mongodbcommunity.mongodbcommunity.mongodb.com
```

## Usage

Once installed, projects can create MongoDB clusters by deploying a `MongoDBCommunity` resource:

```yaml
apiVersion: mongodbcommunity.mongodb.com/v1
kind: MongoDBCommunity
metadata:
  name: my-mongodb
spec:
  members: 1
  type: ReplicaSet
  version: "7.0.5"
  security:
    authentication:
      modes: ["SCRAM"]
  users:
    - name: my-user
      db: admin
      passwordSecretRef:
        name: my-mongodb-password
      roles:
        - name: readWrite
          db: app
      scramCredentialsSecretName: my-mongodb-scram
```

## Auto-Generated Secrets

MongoDB Community Operator creates these secrets:

| Secret | Contents |
|--------|----------|
| `{user}-{resource}-{db}` | User credentials with `connectionString.standard` and `connectionString.standardSrv` |

## Uninstallation

```bash
helm uninstall mongodb-community-operator -n mongodb-system
kubectl delete namespace mongodb-system
```

## References

- [MongoDB Community Operator](https://github.com/mongodb/mongodb-kubernetes-operator)
- [Helm Chart](https://artifacthub.io/packages/helm/mongodb-helm-charts/community-operator)
- [MongoDB Kubernetes Operator (Unified)](https://github.com/mongodb/mongodb-kubernetes)
