# US-028: Publish Helm Charts to OCI Registry

**Status:** Done

## User Story

**As a** platform user,
**I want** Helm charts published to an OCI registry,
**So that** I can pull them without copying chart files to my repository.

## Acceptance Criteria

- [x] PostgreSQL chart renamed to `k8s-ee-postgresql` and published to GHCR
- [x] MongoDB chart renamed to `k8s-ee-mongodb` and published to GHCR
- [x] Redis chart renamed to `k8s-ee-redis` and published to GHCR
- [x] MinIO chart renamed to `k8s-ee-minio` and published to GHCR
- [x] MariaDB chart created as `k8s-ee-mariadb` (new)
- [x] GitHub workflow automatically publishes charts on push to main
- [x] Charts accessible via `oci://ghcr.io/genesluna/k8s-ephemeral-environments/charts/`

## Priority

**Must** - Required for simplified onboarding

## Story Points

5

## Dependencies

- None (foundational for other stories)

## Notes

- Current charts use `file://` references requiring local copies
- OCI registry support added in Helm 3.8+
- Charts will be versioned using semantic versioning
- Publishing workflow triggers on changes to `charts/` directory

## Implementation

### Charts Renamed/Created

| Chart | Name | Version | Description |
|-------|------|---------|-------------|
| PostgreSQL | `k8s-ee-postgresql` | 1.1.0 | CloudNativePG operator |
| MongoDB | `k8s-ee-mongodb` | 1.1.0 | MongoDB Community Operator |
| Redis | `k8s-ee-redis` | 1.1.0 | Simple deployment |
| MinIO | `k8s-ee-minio` | 1.1.0 | MinIO Operator |
| MariaDB | `k8s-ee-mariadb` | 1.0.0 | Simple deployment (new) |

### Files Created

- `charts/mariadb/` - New MariaDB chart with simple deployment pattern
- `.github/workflows/publish-charts.yml` - Publishes charts on push to main

### Files Modified

- `charts/postgresql/Chart.yaml` - Name changed to `k8s-ee-postgresql`
- `charts/mongodb/Chart.yaml` - Name changed to `k8s-ee-mongodb`
- `charts/redis/Chart.yaml` - Name changed to `k8s-ee-redis`
- `charts/minio/Chart.yaml` - Name changed to `k8s-ee-minio`
- `charts/demo-app/Chart.yaml` - Dependencies updated with aliases

### Usage

Pull charts from OCI registry:
```bash
helm pull oci://ghcr.io/genesluna/k8s-ephemeral-environments/charts/k8s-ee-postgresql --version 1.1.0
helm pull oci://ghcr.io/genesluna/k8s-ephemeral-environments/charts/k8s-ee-mariadb --version 1.0.0
```
