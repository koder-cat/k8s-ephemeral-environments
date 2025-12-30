# Demo App Helm Chart

Helm chart for deploying the demo application with PostgreSQL database support.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Database](#database)
- [Ingress](#ingress)
- [Security](#security)
- [Examples](#examples)

## Overview

| Property | Value |
|----------|-------|
| Chart Version | 0.2.0 |
| App Version | 1.0.0 |
| Type | Application |

This chart deploys:
- Demo application (NestJS API + React frontend)
- PostgreSQL database (via CloudNativePG)
- Kubernetes Ingress with TLS
- ConfigMap with PR metadata
- ResourceQuota and LimitRange (optional)

## Prerequisites

- Kubernetes 1.28+
- Helm 3.16+
- CloudNativePG operator installed (for PostgreSQL)
- Traefik ingress controller (default with k3s)

## Installation

### Basic Installation

```bash
helm upgrade --install demo-app ./charts/demo-app \
  --namespace my-namespace \
  --create-namespace
```

### PR Environment Installation

```bash
helm upgrade --install k8s-ee-pr-42-demo-app ./charts/demo-app \
  --namespace k8s-ee-pr-42 \
  --set projectId=k8s-ee \
  --set prNumber=42 \
  --set commitSha=abc1234 \
  --set branchName=feat/my-feature \
  --set previewDomain=k8s-ee.genesluna.dev
```

### Uninstallation

```bash
helm uninstall demo-app --namespace my-namespace
```

## Configuration

### Image Settings

| Parameter | Description | Default |
|-----------|-------------|---------|
| `image.repository` | Image repository | `ghcr.io/genesluna/k8s-ephemeral-environments/demo-app` |
| `image.tag` | Image tag | `latest` |
| `image.digest` | Image digest (overrides tag) | `""` |
| `image.pullPolicy` | Pull policy | `Always` |

### Application Settings

| Parameter | Description | Default |
|-----------|-------------|---------|
| `app.port` | Container port | `3000` |
| `app.logLevel` | Log level | `info` |

### PR Metadata

| Parameter | Description | Default |
|-----------|-------------|---------|
| `projectId` | Project identifier | `k8s-ee` |
| `prNumber` | Pull request number | `""` |
| `commitSha` | Git commit SHA | `""` |
| `branchName` | Git branch name | `""` |
| `previewDomain` | Base domain for ingress | `k8s-ee.genesluna.dev` |

### Resource Settings

| Parameter | Description | Default |
|-----------|-------------|---------|
| `resources.requests.cpu` | CPU request | `50m` |
| `resources.requests.memory` | Memory request | `128Mi` |
| `resources.limits.cpu` | CPU limit | `200m` |
| `resources.limits.memory` | Memory limit | `384Mi` |

### Probe Settings

| Parameter | Description | Default |
|-----------|-------------|---------|
| `probes.startup.failureThreshold` | Startup probe failures | `30` |
| `probes.startup.periodSeconds` | Startup probe period | `2` |
| `probes.liveness.initialDelaySeconds` | Liveness initial delay | `10` |
| `probes.liveness.periodSeconds` | Liveness period | `10` |
| `probes.liveness.timeoutSeconds` | Liveness timeout | `5` |
| `probes.liveness.failureThreshold` | Liveness failures | `3` |
| `probes.readiness.initialDelaySeconds` | Readiness initial delay | `5` |
| `probes.readiness.periodSeconds` | Readiness period | `5` |
| `probes.readiness.timeoutSeconds` | Readiness timeout | `3` |
| `probes.readiness.failureThreshold` | Readiness failures | `3` |

## Database

PostgreSQL is deployed using the CloudNativePG operator.

### Enable/Disable

```yaml
postgresql:
  enabled: true  # Set to false to skip database deployment
```

### PostgreSQL Settings

| Parameter | Description | Default |
|-----------|-------------|---------|
| `postgresql.enabled` | Enable PostgreSQL | `true` |
| `postgresql.instances` | Number of instances | `1` |
| `postgresql.version` | PostgreSQL version | `"16"` |
| `postgresql.database` | Database name | `app` |
| `postgresql.owner` | Database owner | `app` |
| `postgresql.storage.size` | Storage size | `1Gi` |
| `postgresql.storage.storageClass` | Storage class | `""` (default) |

### PostgreSQL Parameters

```yaml
postgresql:
  parameters:
    shared_buffers: "128MB"
    max_connections: "20"
    log_statement: "ddl"
    log_min_duration_statement: "1000"
```

### Connection String

The chart automatically creates environment variables for database connection:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Full connection URI |
| `PGHOST` | PostgreSQL host |
| `PGPORT` | PostgreSQL port |
| `PGDATABASE` | Database name |
| `PGUSER` | Username |
| `PGPASSWORD` | Password |

These are injected from the CloudNativePG-generated secret.

## Ingress

Ingress is configured for Traefik with automatic TLS via Let's Encrypt.

### Hostname Generation

The hostname is generated as:
```
{projectId}-pr-{prNumber}.{previewDomain}
```

Example: `k8s-ee-pr-42.k8s-ee.genesluna.dev`

### TLS Configuration

TLS is automatically configured using Traefik's Let's Encrypt integration:

```yaml
annotations:
  traefik.ingress.kubernetes.io/router.entrypoints: websecure
  traefik.ingress.kubernetes.io/router.tls.certresolver: letsencrypt-prod
```

## Security

### Pod Security Context

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1001
  runAsGroup: 1001
  fsGroup: 1001
```

### Container Security Context

```yaml
containerSecurityContext:
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop:
      - ALL
```

### Read-Only Filesystem

The container runs with a read-only root filesystem. A writable `/tmp` directory is provided via emptyDir volume.

## Examples

### Minimal Deployment

```bash
helm upgrade --install demo ./charts/demo-app \
  --namespace demo \
  --create-namespace
```

### Without Database

```bash
helm upgrade --install demo ./charts/demo-app \
  --namespace demo \
  --set postgresql.enabled=false
```

### Custom Resources

```bash
helm upgrade --install demo ./charts/demo-app \
  --namespace demo \
  --set resources.requests.cpu=100m \
  --set resources.requests.memory=256Mi \
  --set resources.limits.cpu=500m \
  --set resources.limits.memory=512Mi
```

### Custom Image

```bash
helm upgrade --install demo ./charts/demo-app \
  --namespace demo \
  --set image.repository=my-registry/my-app \
  --set image.tag=v1.2.3
```

### Using Image Digest

```bash
helm upgrade --install demo ./charts/demo-app \
  --namespace demo \
  --set image.digest=sha256:abc123...
```

### Full PR Environment

```bash
helm upgrade --install k8s-ee-pr-42-demo-app ./charts/demo-app \
  --namespace k8s-ee-pr-42 \
  --set projectId=k8s-ee \
  --set prNumber=42 \
  --set commitSha=abc1234def5678 \
  --set branchName=feat/awesome-feature \
  --set previewDomain=k8s-ee.genesluna.dev \
  --set image.tag=pr-42 \
  --set postgresql.enabled=true \
  --set postgresql.storage.size=2Gi
```

## Troubleshooting

### Pod Not Starting

Check init container waiting for database:
```bash
kubectl logs -n <namespace> <pod> -c wait-for-db
```

### Database Connection Issues

Verify secret was created:
```bash
kubectl get secret -n <namespace> | grep postgresql
```

### Ingress Not Working

Check ingress status:
```bash
kubectl describe ingress -n <namespace>
```

## Related Documentation

- [Demo App README](../../demo-app/README.md)
- [Troubleshooting Guide](../../docs/guides/troubleshooting.md)
- [Database Setup Guide](../../docs/guides/database-setup.md)
