# US-010: Secure Database Credentials Management

## User Story

**As a** developer,
**I want** database credentials securely managed and injected into my application,
**So that** I don't need to handle secrets manually and they're not exposed.

## Context

With the database-agnostic platform architecture (US-009), credentials management is handled by:
1. **Database operators** - Auto-generate credentials when creating database instances
2. **Library Helm charts** - Standardize secret naming and environment variable injection
3. **Kubernetes Secrets** - Store credentials securely, destroyed with namespace

## Architecture

### Credential Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Project enables database in values.yaml                     │
│     postgresql:                                                 │
│       enabled: true                                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Library chart creates database CRD                          │
│     CloudNativePG Cluster / MongoDBCommunity / MinIO Tenant     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Operator auto-generates credentials                         │
│     - Random secure password                                    │
│     - Creates Kubernetes Secret                                 │
│     - Secret named: {cluster-name}-app (CloudNativePG)          │
│                     {name}-admin-my-user (MongoDB)              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Library chart injects credentials into app                  │
│     env:                                                        │
│       - name: DATABASE_URL                                      │
│         valueFrom:                                              │
│           secretKeyRef:                                         │
│             name: myapp-postgresql-app                          │
│             key: uri                                            │
└─────────────────────────────────────────────────────────────────┘
```

### Credential Secrets by Operator

| Operator | Secret Name Pattern | Key Fields |
|----------|---------------------|------------|
| CloudNativePG | `{cluster}-app` | `host`, `port`, `dbname`, `user`, `password`, `uri` |
| MongoDB Community | `{name}-admin-my-user` | `connectionString.standard`, `connectionString.standardSrv` |
| Percona MySQL | `{cluster}-secrets` | `root`, `operator`, `replication` |
| Redis Operator | `{name}-redis` | `password` |
| MinIO | `{tenant}-secret` | `accesskey`, `secretkey` |

## Acceptance Criteria

- [ ] Library charts configure operator to auto-generate credentials
- [ ] Standardized environment variable names documented
- [ ] Application deployment templates inject credentials from secrets
- [ ] No credentials hardcoded or committed to git
- [ ] Credentials unique per PR environment (operator generates per instance)
- [ ] Credentials destroyed with namespace cleanup (cascade deletion)
- [ ] Demo-app reads DATABASE_URL from environment

## Priority

**Must** - Critical for MVP

## Story Points

5 (increased slightly for multi-database support)

## Dependencies

- US-009: Create Isolated Database per PR

## Technical Notes

### Standard Environment Variables

Projects should expect these environment variables:

| Database | Environment Variable | Format |
|----------|---------------------|--------|
| PostgreSQL | `DATABASE_URL` | `postgresql://user:pass@host:5432/dbname` |
| MongoDB | `MONGODB_URI` | `mongodb://user:pass@host:27017/dbname` |
| MySQL | `DATABASE_URL` | `mysql://user:pass@host:3306/dbname` |
| Redis | `REDIS_URL` | `redis://:pass@host:6379` |
| MinIO | `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` | Individual values |

### Library Chart Responsibilities

Each library chart must:
1. Create the database CRD with credential generation enabled
2. Export a named template for env var injection (e.g., `postgresql.envVars`)
3. Document which secrets and keys are available

### Example: Using PostgreSQL Credentials

```yaml
# Application deployment.yaml
spec:
  containers:
    - name: app
      env:
        {{- include "postgresql.envVars" . | nindent 8 }}
        # Injects DATABASE_URL from the operator-generated secret
```

### Security Considerations

- Secrets are namespace-scoped (PR isolation)
- Secrets are deleted when namespace is destroyed
- No secrets in git (operators generate at runtime)
- RBAC prevents cross-namespace secret access
- Future: Consider Sealed Secrets for any static secrets needed
