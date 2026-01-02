# US-029: Create Generic Application Chart

**Status:** Done

## User Story

**As a** platform user,
**I want** a generic Helm chart that works for any application,
**So that** I don't need to create or customize Helm charts for my app.

## Acceptance Criteria

- [x] Generic `k8s-ee-app` chart created with configurable values
- [x] Chart dependencies reference OCI registry (not `file://`)
- [x] Deployment template supports configurable port and health endpoints
- [x] Ingress template generates correct preview URLs
- [x] ServiceMonitor template for Prometheus metrics (optional)
- [x] Environment variable injection from config
- [x] Init containers for database readiness (conditional)
- [x] Chart published to GHCR alongside database charts

## Priority

**Must** - Required for simplified onboarding

## Story Points

8

## Dependencies

- US-028: Publish Helm Charts to OCI Registry

## Notes

- Chart should be completely generic - no app-specific code
- All customization via values.yaml populated from k8s-ee.yaml config
- Database subcharts conditionally included based on config
- Security context follows existing hardened patterns

## Implementation

### Chart Created

`charts/k8s-ee-app/` - Generic application chart with:

| File | Description |
|------|-------------|
| `Chart.yaml` | OCI dependencies for all 5 databases |
| `values.yaml` | Fully configurable with sensible defaults |
| `templates/_helpers.tpl` | Name, label, hostname functions |
| `templates/deployment.yaml` | Generic deployment with init containers |
| `templates/service.yaml` | ClusterIP service |
| `templates/ingress.yaml` | Traefik ingress with TLS |
| `templates/configmap.yaml` | User-defined environment variables |
| `templates/servicemonitor.yaml` | Optional Prometheus metrics |
| `templates/NOTES.txt` | Post-install instructions |

### Key Features

- **OCI Dependencies**: Uses `oci://ghcr.io/koder-cat/k8s-ephemeral-environments/charts` for all database subcharts
- **Required Validation**: Fails fast if `image.repository`, `image.tag`, or `projectId` missing
- **Security Hardened**: runAsNonRoot, seccompProfile, readOnlyRootFilesystem, capabilities dropped
- **Database Support**: PostgreSQL, MongoDB, Redis, MinIO, MariaDB (all conditional)
- **Environment Injection**: Database credentials auto-injected via subchart helpers
- **Configurable Health**: app.healthPath and app.metricsPath configurable

### Usage

```bash
# Pull chart
helm pull oci://ghcr.io/koder-cat/k8s-ephemeral-environments/charts/k8s-ee-app --version 1.0.0

# Install
helm install myapp k8s-ee-app \
  --set projectId=myproject \
  --set prNumber=42 \
  --set image.repository=ghcr.io/org/app \
  --set image.tag=abc123 \
  --set postgresql.enabled=true
```

### demo-app Improvements

As part of this work, demo-app was updated for consistency:

- Added MariaDB init container for database readiness
- Added environment variable injection for all 5 databases (was PostgreSQL only)
- Added MariaDB section to values.yaml
- Added seccompProfile to securityContext for security hardening
