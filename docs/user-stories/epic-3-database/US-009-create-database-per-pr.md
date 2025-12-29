# US-009: Create Isolated Database per PR

## User Story

**As a** developer,
**I want** an isolated database for my PR environment,
**So that** my tests don't affect other PRs and I have a clean database state.

## Context

This platform serves a software house with 100s of projects using different technology stacks. The database solution must be:
- **Database-agnostic:** Support PostgreSQL, MongoDB, MySQL, Redis, MinIO, and more
- **Self-service:** Project teams enable databases via simple configuration
- **Consistent:** Standardized patterns across all projects
- **Low friction:** One-line setup using library Helm charts

## Architecture

### Platform Provides (Cluster-Wide)

1. **Database Operators** - Installed once, available to all namespaces:
   - CloudNativePG (PostgreSQL)
   - MongoDB Community Operator
   - Percona XtraDB Operator (MySQL)
   - Redis Operator (Spotahome)
   - MinIO Operator (S3-compatible object storage)

2. **Library Helm Charts** - Reusable sub-charts projects depend on:
   - `k8s-ee/postgresql`
   - `k8s-ee/mongodb`
   - `k8s-ee/mysql`
   - `k8s-ee/redis`
   - `k8s-ee/minio`

### Projects Provide (Per Project)

Projects declare database dependencies in their Helm chart:

```yaml
# Chart.yaml
dependencies:
  - name: postgresql
    version: "1.0.0"
    repository: "file://../../../charts/postgresql"
    condition: postgresql.enabled
```

```yaml
# values.yaml
postgresql:
  enabled: true
  storage:
    size: 1Gi
```

## Acceptance Criteria

- [ ] CloudNativePG operator installed cluster-wide
- [ ] MongoDB Community operator installed cluster-wide
- [ ] MinIO operator installed cluster-wide
- [ ] PostgreSQL library chart created with sensible defaults
- [ ] MongoDB library chart created with sensible defaults
- [ ] MinIO library chart created with sensible defaults
- [ ] Demo-app updated to use PostgreSQL library chart
- [ ] Database provisioning completes in < 2 minutes
- [ ] Databases isolated per PR namespace (namespace scoping)
- [ ] Documentation for project onboarding

## Priority

**Must** - Critical for MVP

## Story Points

13 (increased due to multi-database support)

## Dependencies

- US-004: Create Namespace on PR Open

## Technical Notes

### Operator Installation

Operators are installed in dedicated namespaces:
- `cnpg-system` - CloudNativePG controller
- `mongodb-system` - MongoDB Community operator
- `minio-operator` - MinIO operator

### Library Chart Design

Each library chart:
- Creates the database CRD (Cluster, MongoDBCommunity, Tenant, etc.)
- Configures resource limits appropriate for ephemeral environments
- Uses ephemeral storage by default (no PVC persistence needed)
- Auto-generates credentials via operator

### Standardized Conventions

| Convention | Pattern | Example |
|------------|---------|---------|
| DB Secret | `{release}-{db}-credentials` | `myapp-postgresql-credentials` |
| DB Service | `{release}-{db}` | `myapp-postgresql` |
| Connection env | `DATABASE_URL` | `postgresql://user:pass@host:5432/db` |
| S3 endpoint env | `S3_ENDPOINT` | `http://myapp-minio:9000` |

### Resource Defaults (Ephemeral Environments)

| Database | Memory Request | Memory Limit | CPU Request | CPU Limit |
|----------|---------------|--------------|-------------|-----------|
| PostgreSQL | 256Mi | 512Mi | 100m | 500m |
| MongoDB | 256Mi | 512Mi | 100m | 500m |
| MySQL | 256Mi | 512Mi | 100m | 500m |
| Redis | 64Mi | 128Mi | 50m | 200m |
| MinIO | 256Mi | 512Mi | 100m | 500m |
