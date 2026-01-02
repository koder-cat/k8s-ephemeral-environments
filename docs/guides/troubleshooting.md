# Troubleshooting Guide

This guide helps diagnose and resolve common issues with PR environments.

## Table of Contents

- [Quick Diagnosis](#quick-diagnosis)
- [Initialization Race Conditions](#initialization-race-conditions)
- [PR Namespace Issues](#pr-namespace-issues)
  - [ResourceQuota Exceeded During Rolling Updates](#resourcequota-exceeded-during-rolling-updates)
- [Deployment Failures](#deployment-failures)
- [Database Issues](#database-issues)
  - [MongoDB Authorization Errors](#mongodb-authorization-errors)
- [Migration Issues](#migration-issues)
- [Network Policy Issues](#network-policy-issues)
- [Health Check Failures](#health-check-failures)
- [Common kubectl Commands](#common-kubectl-commands)
- [Metrics Issues](#metrics-issues)
- [Alert Demo Issues](#alert-demo-issues)

## Quick Diagnosis

Start here to identify the problem category:

```
Is the namespace created?
├── No → See "PR Namespace Issues"
└── Yes → Are pods running?
    ├── No → See "Deployment Failures"
    └── Yes → Is the app accessible?
        ├── No → See "Network Policy Issues"
        └── Yes → Is the database working?
            ├── No → See "Database Issues"
            └── Yes → See "Health Check Failures"
```

## Initialization Race Conditions

Race conditions occur when the app starts before dependencies (database, storage) are fully ready. This is one of the most common issues in Kubernetes environments.

### Symptoms
- "Migration failed" errors immediately at startup
- "Database not connected" errors on first requests
- App works after manual pod restart
- Logs show connection errors followed by app starting anyway

### Root Cause

Even with proper init containers using native client tools (`pg_isready`, etc.), a small timing window can exist between init container success and app startup:

```
1. PostgreSQL pod starts and initializes
2. Init container (pg_isready) confirms readiness → SUCCESS
3. App pod starts (small timing gap here)
4. onModuleInit() runs immediately
5. Transient connection issue → MIGRATION FAILS
6. App starts with broken database state
```

This is rare (~1% of deployments) but the app should handle it with short retry logic.

### Diagnosis

```bash
# Check if this is a race condition (look for timing)
kubectl logs -n k8s-ee-pr-{number} -l k8s-ee/project-id={projectId} | grep -E "(not ready|retry|connection refused)"

# Check init container logs
kubectl logs -n k8s-ee-pr-{number} <pod-name> -c wait-for-postgresql

# Verify database pod readiness
kubectl get pods -n k8s-ee-pr-{number} -l cnpg.io/cluster -o wide
```

### Resolution

**Immediate fix:** Restart the pod after database is ready:
```bash
kubectl rollout restart deployment -n k8s-ee-pr-{number} <app-deployment>
```

**Permanent fix:** Ensure your service implements retry logic:
```typescript
// In onModuleInit(), wait for database before migrations
await this.waitForDatabase();  // Retries 3 times, 1s delay (handles init container timing gap)
await this.runMigrations();    // Only after connection confirmed
```

### Prevention

1. **Application-level retry**: Implement `waitForDatabase()` with exponential backoff
2. **Proper init containers**: Use native client tools (`pg_isready`, `redis-cli ping`)
3. **Follow patterns**: See [Service Development Guide](./service-development.md)

**Best practice:** Both init containers AND application retry should be implemented (defense in depth).

## Authorization Issues

### Organization Not Authorized

**Symptoms:**
- Workflow fails with "Organization 'myorg' is not authorized"
- GitHub Actions shows error in validate-config job
- No namespace is created

**Error Message:**
```
============================================================
ERROR: Organization 'myorg' is not authorized
============================================================

Repository 'myorg/some-repo' attempted to use k8s-ephemeral-environments
but the organization is not in the allowed list.
```

**Cause:** Your organization is not in the platform allowlist.

**Resolution:**

1. Check if your organization is in the [allowed list](https://github.com/koder-cat/k8s-ephemeral-environments/blob/main/.github/config/allowed-orgs.json)
2. If not, [open an issue](https://github.com/koder-cat/k8s-ephemeral-environments/issues) to request access
3. Once approved, a maintainer will add your organization and merge the change
4. The change takes effect immediately for new workflow runs

See [Access Control Guide](./access-control.md) for more details.

## PR Namespace Issues

### Namespace Not Created

**Symptoms:**
- No namespace `k8s-ee-pr-{number}` exists
- GitHub Actions workflow failed or didn't run

**Diagnosis:**
```bash
# Check if namespace exists
kubectl get ns | grep k8s-ee-pr

# Check GitHub Actions logs
gh run list --branch <branch-name>
gh run view <run-id> --log-failed
```

**Common Causes:**

| Cause | Solution |
|-------|----------|
| Workflow not triggered | Check PR is from correct repo, not a fork |
| Runner unavailable | Check `arc-runners` namespace for healthy runners |
| Jobs queued indefinitely | Check runner group allows public repos |
| Runner crashes with "Not configured" | JIT config broken - check values file |
| kubectl auth failed | Verify runner ServiceAccount permissions |
| Previous run conflict | Delete stale namespace manually |

**Resolution:**
```bash
# Check runner status
kubectl get pods -n arc-runners

# Check listener pod (receives job notifications)
kubectl logs -n arc-systems -l app.kubernetes.io/name=arc-runner-set --tail=50

# Verify runner group allows public repos (if applicable)
gh api /orgs/{org}/actions/runner-groups --jq '.runner_groups[] | {name, allows_public_repositories}'

# Re-run failed workflow
gh run rerun <run-id>

# Manual namespace cleanup if stuck
kubectl delete ns {namespace} --force --grace-period=0
```

See `docs/runbooks/arc-operations.md` for detailed ARC troubleshooting.

### ResourceQuota Exceeded

**Symptoms:**
- Namespace created but pods pending
- Events show quota exceeded errors
- Error: `exceeded quota: pr-quota, requested: limits.cpu=200m, used: limits.cpu=900m, limited: limits.cpu=1`

**Note:** The platform now **automatically calculates** quotas based on enabled databases. This issue should be rare with current configurations.

**Diagnosis:**
```bash
kubectl describe resourcequota -n k8s-ee-pr-{number}
kubectl get events -n k8s-ee-pr-{number} --sort-by='.lastTimestamp'
```

**Common Causes:**

| Cause | Solution |
|-------|----------|
| Namespace created before quota fix | Close and reopen PR to recreate namespace with correct quota |
| Previous pods not cleaned | Old resources still consuming quota |
| Operator overhead higher than expected | See manual fix below |

**Resource Consumption by Service:**

| Service | Approx. CPU | Approx. Memory |
|---------|-------------|----------------|
| Application | 300m | 512Mi |
| PostgreSQL | 500m | 512Mi |
| MongoDB | 500m | 512Mi |
| Redis | 200m | 128Mi |
| MinIO | 500m | 512Mi |
| MariaDB | 300m | 256Mi |

**Resolution:**
```bash
# Check current usage vs. limits
kubectl describe resourcequota pr-quota -n k8s-ee-pr-{number}

# Option 1: Close and reopen PR to recreate with correct quota
# This is the cleanest solution

# Option 2: Manual patch (if Option 1 not feasible)
kubectl patch resourcequota pr-quota -n k8s-ee-pr-{number} --type='merge' \
  -p '{"spec":{"hard":{"limits.cpu":"3","limits.memory":"4Gi","requests.storage":"10Gi"}}}'
```

See [Resource Requirements by Database](./k8s-ee-config-reference.md#resource-requirements-by-database) for how quotas are calculated.

### ResourceQuota Exceeded During Rolling Updates

**Symptoms:**
- Deployment stuck with new ReplicaSet unable to create pods
- Events show: `exceeded quota: pr-quota, requested: requests.memory=128Mi, used: requests.memory=1242593Ki, limited: requests.memory=1280Mi`
- Rolling update fails while old pod still runs

**Root Cause:**
During rolling updates, Kubernetes runs both old and new pods simultaneously. The quota must accommodate this overlap:

```
Old pod: 128Mi memory requests (still running)
New pod: 128Mi memory requests (trying to start)
Total needed: 256Mi additional headroom
```

**Diagnosis:**
```bash
# Check if new ReplicaSet can't create pods
kubectl get events -n k8s-ee-pr-{number} | grep -i exceeded

# Check current quota usage vs limit
kubectl describe resourcequota pr-quota -n k8s-ee-pr-{number}
```

**Resolution:**

The platform now includes headroom buffer for rolling updates automatically:
- CPU requests: +100m for app overlap
- Memory requests: +256Mi for app overlap
- CPU/Memory limits: +15% buffer

If you see this on older namespaces, close and reopen the PR to recreate with updated quota.

## Deployment Failures

### Pod CrashLoopBackOff

**Symptoms:**
- Pod restarts repeatedly
- Status shows `CrashLoopBackOff`

**Diagnosis:**
```bash
# Check pod status
kubectl get pods -n k8s-ee-pr-{number}

# View logs (current attempt)
kubectl logs -n k8s-ee-pr-{number} <pod-name>

# View logs (previous crash)
kubectl logs -n k8s-ee-pr-{number} <pod-name> --previous

# Check events
kubectl describe pod -n k8s-ee-pr-{number} <pod-name>
```

**Common Causes:**

| Cause | Log Pattern | Solution |
|-------|-------------|----------|
| Missing env var | `undefined` errors | Check ConfigMap/Secret |
| Database connection | `ECONNREFUSED` | Wait for DB, check service |
| OOM killed | `OOMKilled` in status | Increase memory limits |
| Port conflict | `EADDRINUSE` | Check port configuration |

### ImagePullBackOff

**Symptoms:**
- Pod stuck in `ImagePullBackOff` or `ErrImagePull`
- Events show `403 Forbidden` from GHCR

**Diagnosis:**
```bash
kubectl describe pod -n {namespace} <pod-name> | grep -A10 Events
```

**Common Causes:**

| Cause | Solution |
|-------|----------|
| Image doesn't exist | Check GHCR for the tag |
| Package is private | Check org settings allow public packages |
| Wrong tag | Check commit SHA matches |

**Resolution:**
```bash
# Check if image exists
gh api /orgs/{org}/packages/container/{repo}%2F{image} --jq '.name'

# Check package visibility (should be "public")
gh api /orgs/{org}/packages/container/{repo}%2F{image} --jq '.visibility'
```

**If package is private:** The org must allow members to change package visibility:
1. Go to `https://github.com/organizations/{org}/settings/packages`
2. Enable "Allow members to change container package visibility to public"
3. Re-run the workflow to make the package public

**If org setting was enabled after first build:** You may need to manually make the package public:
1. Go to `https://github.com/orgs/{org}/packages/container/package/{repo}%2F{image}`
2. Click "Package settings" → "Change package visibility" → "Public"

### Init Container Stuck

**Symptoms:**
- Pod shows `Init:0/1` status
- Main container never starts

**Diagnosis:**
```bash
# Check init container logs
kubectl logs -n k8s-ee-pr-{number} <pod-name> -c wait-for-db

# Check init container status
kubectl describe pod -n k8s-ee-pr-{number} <pod-name>
```

**Common Causes:**

| Cause | Solution |
|-------|----------|
| Database not ready | Wait for PostgreSQL cluster |
| Wrong service name | Check service DNS name |
| Network policy blocking | Verify egress policy |

### Init Container OOMKilled

**Symptoms:**
- Pod shows `Init:OOMKilled` status
- Init container restarts repeatedly

**Common Causes:**

| Init Container | Issue | Solution |
|----------------|-------|----------|
| wait-for-mongodb | `mongo:7-jammy` image needs 256Mi | Increase memory limit to 256Mi |
| wait-for-postgresql | Usually fine at 64Mi | Check for unusual workload |

The MongoDB init container uses `mongosh` for readiness checks, which requires more memory than simple port checks.

### MongoDB ServiceAccount Not Found

**Symptoms:**
- MongoDB StatefulSet fails to create pods
- Error: `serviceaccount "mongodb-database" not found`

**Diagnosis:**
```bash
kubectl get sa -n k8s-ee-pr-{number}
kubectl get events -n k8s-ee-pr-{number} | grep mongodb
```

**Resolution:**
The MongoDB chart should create this ServiceAccount automatically. If missing:
```bash
# Check if Helm deployed the MongoDB chart correctly
helm get manifest app -n k8s-ee-pr-{number} | grep -A5 "kind: ServiceAccount"

# Manual fix (temporary)
kubectl create serviceaccount mongodb-database -n k8s-ee-pr-{number}
```

### Helm Chart Changes Not Taking Effect in PR

**Symptoms:**
- You modified a library chart (e.g., `charts/mongodb/`) but the change doesn't appear in the PR deployment
- ServiceAccounts, ConfigMaps, or other resources from your chart changes are missing
- Helm release uses old chart version

**Root Cause:**
Library charts (postgresql, mongodb, redis, minio, mariadb) are stored in an OCI registry (`oci://ghcr.io/koder-cat/k8s-ephemeral-environments/charts`). The PR workflow pulls charts from this registry, not from the local checkout. Chart changes are only published when merged to `main`.

**Diagnosis:**
```bash
# Check which chart version is deployed
helm list -n k8s-ee-pr-{number}

# Compare with local chart version
grep '^version:' charts/mongodb/Chart.yaml

# Check if your change is in the OCI registry
helm show chart oci://ghcr.io/koder-cat/k8s-ephemeral-environments/charts/k8s-ee-mongodb
```

**Resolution:**
PR environments now use local charts by default (`use-local-charts: 'true'`). This means chart changes in the PR are automatically tested. If you're seeing this issue, it may be from an older workflow run.

To verify local charts are being used, check the deploy logs for:
```
Using local charts from: ./charts/k8s-ee-app
```

If you need to test against published OCI charts instead:
```yaml
# In pr-environment-reusable.yml
- name: Deploy application
  uses: ./.github/actions/deploy-app
  with:
    use-local-charts: 'false'  # Use OCI registry charts
    # ... other inputs
```

**Prevention:**
- Local charts are now the default for all PR deployments
- Chart changes are automatically tested without needing OCI publication
- Ensure chart directory is included in sparse checkout for deploy-app job

### Local Chart Dependency Build Failures

**Symptoms:**
- Deploy App step fails with "helm dependency build" error
- Error: `the lock file (Chart.lock) is out of sync with the dependencies file (Chart.yaml)`

**Root Cause:**
When using local charts, the deploy-app action modifies `Chart.yaml` to use `file://` references instead of OCI URLs. The existing `Chart.lock` file still references the OCI URLs, causing a mismatch.

**Resolution:**
The deploy-app action automatically removes `Chart.lock` before building dependencies. If you see this error, ensure you're using the latest version of the action.

**Technical Details:**
The local chart build process:
1. Backs up `Chart.yaml`
2. Replaces OCI repository URLs with `file://../` paths
3. Renames chart dependencies (e.g., `k8s-ee-postgresql` → `postgresql`)
4. Removes `Chart.lock` to avoid sync issues
5. Runs `helm dependency build`
6. Restores original `Chart.yaml` on exit

### Sparse Checkout Missing Charts Directory

**Symptoms:**
- Deploy App step fails with "charts/k8s-ee-app directory not found"
- Local chart build cannot find chart files
- Error: `Chart.yaml file is missing` during `helm dependency build`

**Root Cause:**
The deploy-app job uses sparse checkout to minimize repository data. The pattern `charts` alone may not include all subdirectories properly. Each chart directory must be explicitly listed.

**Resolution:**
Ensure the deploy-app job's checkout step includes all chart directories explicitly:

```yaml
sparse-checkout: |
  .github/actions
  charts/k8s-ee-app
  charts/postgresql
  charts/mongodb
  charts/redis
  charts/minio
  charts/mariadb
sparse-checkout-cone-mode: false
```

## Database Issues

### Database Not Deployed (k8s-ee.yaml)

**Symptoms:**
- No database pod exists in the namespace
- App logs show connection refused to database
- `kubectl get pods -n k8s-ee-pr-{number}` shows no PostgreSQL/MongoDB/etc. pod

**Diagnosis:**
```bash
# Check if database is enabled in Helm values
helm get values app -n k8s-ee-pr-{number} | grep -A5 postgresql

# Verify k8s-ee.yaml has database enabled
cat k8s-ee.yaml | grep -A5 databases
```

**Common Causes:**

| Cause | Solution |
|-------|----------|
| `databases.postgresql: false` in k8s-ee.yaml | Change to `databases.postgresql: true` |
| Missing databases section | Add `databases:` section with enabled databases |
| Object form without `enabled` | Use `postgresql: { enabled: true }` or just `postgresql: true` |

**Resolution:**

Update your `k8s-ee.yaml`:
```yaml
databases:
  postgresql: true  # Simple boolean form
  # OR object form with custom settings:
  # postgresql:
  #   enabled: true
  #   version: "16"
  #   storage: 2Gi
```

Push the change to trigger a new deployment.

### MongoDB Authorization Errors

**Symptoms:**
- App logs show `not authorized on admin to execute command`
- Audit service fails to log events
- `/api/audit/events` returns 400 or 500 errors
- Console shows "Cannot read properties of undefined (reading 'toLocaleString')"

**Error Message:**
```json
{
  "errmsg": "not authorized on admin to execute command { insert: \"audit_events\" ... $db: \"admin\" }",
  "code": 13,
  "codeName": "Unauthorized"
}
```

**Root Cause:**
The MongoDB connection string uses `/admin` for authentication (required by MongoDB), but the app was trying to use the `admin` database for storing data instead of the `app` database.

**Diagnosis:**
```bash
# Check MongoDB connection string
kubectl get secret -n k8s-ee-pr-{number} app-mongodb-admin-app \
  -o jsonpath='{.data.connectionString\.standard}' | base64 -d

# Look for /admin in the connection string - that's the auth database, not data database
# mongodb://app:xxx@host:27017/admin?replicaSet=app-mongodb

# Check app logs for auth errors
kubectl logs -n k8s-ee-pr-{number} -l app.kubernetes.io/name=app | grep -i "not authorized"
```

**Resolution:**

The audit service now explicitly specifies the database name:
```typescript
const dbName = process.env.MONGODB_DATABASE || 'app';
this.db = this.client.db(dbName);
```

If you see this error on older deployments, redeploy the app to pick up the fix.

### Connection Refused

**Symptoms:**
- App logs show `ECONNREFUSED` to PostgreSQL
- Database endpoints not ready

**Diagnosis:**
```bash
# Check PostgreSQL cluster
kubectl get clusters.postgresql.cnpg.io -n k8s-ee-pr-{number}

# Check cluster pods
kubectl get pods -n k8s-ee-pr-{number} -l cnpg.io/cluster

# Check service endpoints
kubectl get endpoints -n k8s-ee-pr-{number} | grep postgresql
```

**Common Causes:**

| Cause | Solution |
|-------|----------|
| Cluster not ready | Wait for `Cluster is Ready` status |
| Pod crashed | Check PostgreSQL pod logs |
| Service missing | Verify Helm release deployed |

**Resolution:**
```bash
# Check cluster status details
kubectl describe clusters.postgresql.cnpg.io -n k8s-ee-pr-{number}

# View PostgreSQL logs
kubectl logs -n k8s-ee-pr-{number} -l cnpg.io/cluster

# Restart cluster (last resort)
kubectl delete pods -n k8s-ee-pr-{number} -l cnpg.io/cluster
```

### Authentication Failed

**Symptoms:**
- `password authentication failed` in logs
- App can't connect despite database running

**Diagnosis:**
```bash
# Check secret exists
kubectl get secret -n k8s-ee-pr-{number} | grep postgresql

# Verify secret contents
kubectl get secret k8s-ee-pr-{number}-postgresql-app -n k8s-ee-pr-{number} -o yaml
```

**Resolution:**
```bash
# Decode and verify password
kubectl get secret k8s-ee-pr-{number}-postgresql-app -n k8s-ee-pr-{number} \
  -o jsonpath='{.data.password}' | base64 -d

# Test connection manually
kubectl run psql --rm -it --image=postgres:16 -n k8s-ee-pr-{number} -- \
  psql "postgresql://app:$(kubectl get secret k8s-ee-pr-{number}-postgresql-app \
  -n k8s-ee-pr-{number} -o jsonpath='{.data.password}' | base64 -d)@k8s-ee-pr-{number}-postgresql-rw:5432/app"
```

### Bootstrap SQL Not Applied

**Symptoms:**
- Tables from `postInitApplicationSQL` don't exist
- Database schema is empty after deployment
- Bootstrap SQL changes not reflected in database

**Diagnosis:**
```bash
# Check if table exists
kubectl exec -n k8s-ee-pr-{number} -it $(kubectl get pods -n k8s-ee-pr-{number} \
  -l cnpg.io/cluster -o name | head -1) -- psql -U postgres -d app -c '\dt'

# Check initdb pod logs for bootstrap execution
kubectl logs -n k8s-ee-pr-{number} -l job-name --tail=100
```

**Common Causes:**

| Cause | Solution |
|-------|----------|
| Cluster existed before SQL change | Delete cluster to trigger re-init |
| Using `initSQL` instead of `postInitApplicationSQL` | `initSQL` runs on `postgres` database, not app database |
| Dollar-quote syntax error | Use `$func$` instead of `$$` for function bodies |

**Important:** Bootstrap SQL only runs during initial cluster creation. Modifying `postInitApplicationSQL` in values.yaml won't affect existing clusters.

**Resolution:**
```bash
# Option 1: Delete the PostgreSQL cluster to trigger re-init (data will be lost!)
# First, find the cluster name
kubectl get clusters.postgresql.cnpg.io -n k8s-ee-pr-{number}

# Delete it (usually named {namespace}-postgresql)
kubectl delete cluster -n k8s-ee-pr-{number} k8s-ee-pr-{number}-postgresql

# Re-run Helm to recreate the cluster with bootstrap SQL
helm upgrade app oci://ghcr.io/koder-cat/k8s-ephemeral-environments/charts/k8s-ee-app \
  --namespace k8s-ee-pr-{number} --reuse-values

# Option 2: Manually apply SQL to existing database (keeps data)
kubectl exec -n k8s-ee-pr-{number} -it $(kubectl get pods -n k8s-ee-pr-{number} \
  -l cnpg.io/cluster -o name | head -1) -- psql -U postgres -d app -c "
    CREATE TABLE IF NOT EXISTS your_table (...);
    GRANT ALL PRIVILEGES ON your_table TO app;
  "

# Option 3: For PR environments, close and reopen the PR
# This destroys and recreates the namespace with fresh bootstrap SQL
```

**Note:** For PR environments, simply closing and reopening the PR will recreate the namespace with fresh bootstrap SQL. This is the easiest approach when you don't need to preserve data.

### Permission Denied on Tables

**Symptoms:**
- App logs show `permission denied for table <table_name>`
- Database operations fail despite table existing
- CRUD endpoints return 500 errors

**Diagnosis:**
```bash
# Check table ownership
kubectl exec -n k8s-ee-pr-{number} -it $(kubectl get pods -n k8s-ee-pr-{number} \
  -l cnpg.io/cluster -o name | head -1) -- psql -U postgres -d app -c '\dt'

# Check current grants
kubectl exec -n k8s-ee-pr-{number} -it $(kubectl get pods -n k8s-ee-pr-{number} \
  -l cnpg.io/cluster -o name | head -1) -- psql -U postgres -d app -c '\dp test_records'
```

**Common Causes:**

| Cause | Solution |
|-------|----------|
| Missing GRANT statements | Add `GRANT ALL PRIVILEGES ON <table> TO app;` to bootstrap SQL |
| Missing sequence grants | Add `GRANT USAGE, SELECT ON SEQUENCE <table>_id_seq TO app;` |
| Table created by postgres user | Bootstrap SQL runs as superuser, app connects as `app` user |

**Resolution:**
```bash
# Apply grants manually for immediate fix
kubectl exec -n k8s-ee-pr-{number} -it $(kubectl get pods -n k8s-ee-pr-{number} \
  -l cnpg.io/cluster -o name | head -1) -- psql -U postgres -d app -c \
  "GRANT ALL PRIVILEGES ON test_records TO app; \
   GRANT USAGE, SELECT ON SEQUENCE test_records_id_seq TO app;"
```

**Prevention:** Always include GRANT statements in your `postInitApplicationSQL`.

## Migration Issues

### Migration Failed at Startup

**Symptoms:**
- App crashes immediately with migration error
- Logs show "Migration failed" or SQL errors
- Pod in CrashLoopBackOff with migration stack traces

**Diagnosis:**
```bash
# Check app logs for migration errors
kubectl logs -n k8s-ee-pr-{number} -l k8s-ee/project-id={projectId}

# Connect to database directly to check state
kubectl exec -n k8s-ee-pr-{number} -it $(kubectl get pods -n k8s-ee-pr-{number} \
  -l cnpg.io/cluster -o name | head -1) -- psql -U postgres -d app -c \
  'SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 5;'
```

**Common Causes:**

| Cause | Solution |
|-------|----------|
| Database not ready | App tried to migrate before DB was available |
| Conflicting migration | Schema change conflicts with existing state |
| Missing drizzle folder | Migrations not included in Docker build |
| Network policy blocking | App can't reach PostgreSQL service |

**Resolution:**
```bash
# Option 1: For ephemeral environments, close and reopen PR
# This recreates the namespace with fresh database

# Option 2: Check migration status
kubectl exec -n k8s-ee-pr-{number} -it $(kubectl get pods -n k8s-ee-pr-{number} \
  -l cnpg.io/cluster -o name | head -1) -- psql -U postgres -d app -c '\dt'

# Option 3: Verify drizzle folder exists in container
kubectl exec -n k8s-ee-pr-{number} -it $(kubectl get pods -n k8s-ee-pr-{number} \
  -l k8s-ee/project-id={projectId} -o name | head -1) -- ls -la /app/drizzle
```

### Schema Out of Sync

**Symptoms:**
- TypeScript errors in IDE for database queries
- Runtime errors: "column does not exist"
- Query results missing expected fields

**Diagnosis:**
```bash
# Compare schema to actual database
kubectl exec -n k8s-ee-pr-{number} -it $(kubectl get pods -n k8s-ee-pr-{number} \
  -l cnpg.io/cluster -o name | head -1) -- psql -U postgres -d app -c '\d test_records'
```

**Resolution:**
```bash
# Generate new migration locally
pnpm db:generate --name=fix_schema

# Commit and push - new migration will run on next deployment
git add drizzle/
git commit -m "fix: add missing column migration"
git push
```

### Seeding Failed

**Symptoms:**
- App logs show "Seeding failed" errors
- No initial data in database after deployment
- Seed script throws type errors

**Diagnosis:**
```bash
# Check app startup logs
kubectl logs -n k8s-ee-pr-{number} -l k8s-ee/project-id={projectId} | grep -i seed

# Verify table exists before seeding
kubectl exec -n k8s-ee-pr-{number} -it $(kubectl get pods -n k8s-ee-pr-{number} \
  -l cnpg.io/cluster -o name | head -1) -- psql -U postgres -d app -c \
  'SELECT COUNT(*) FROM test_records;'
```

**Common Causes:**

| Cause | Solution |
|-------|----------|
| Migration didn't complete | Seeding runs after migrations - check migration first |
| Schema mismatch | Seed script columns don't match schema |
| Data already exists | Seeding skips if table has data |

**Note:** Seeding is designed to be non-blocking - the app continues even if seeding fails. Check logs but this shouldn't crash your application.

## Network Policy Issues

### 502 Bad Gateway - Port Mismatch

**Symptoms:**
- App pod is running and healthy
- Health endpoint works internally (`kubectl exec ... curl localhost:8080`)
- External access returns 502 Bad Gateway
- Traefik logs show no errors

**Root Cause:**
The `allow-ingress-controller` NetworkPolicy uses the configured port from `k8s-ee.yaml`. If your app listens on a different port than configured, traffic is blocked.

**Diagnosis:**
```bash
# Check network policy port
kubectl get networkpolicy allow-ingress-controller -n {namespace} -o yaml | grep -A5 ports

# Compare with your app's actual listening port
kubectl exec -n {namespace} {pod-name} -- netstat -tlnp
```

**Resolution:**
Ensure your `k8s-ee.yaml` has the correct port configured:

```yaml
app:
  port: 8080  # Match your application's listening port
```

Then redeploy to update the NetworkPolicy.

**Common Port Configurations:**
| Stack | Default Port | k8s-ee.yaml Configuration |
|-------|--------------|---------------------------|
| Node.js/NestJS | 3000 | Default, no config needed |
| .NET/ASP.NET Core | 8080 | `app.port: 8080` |
| Go | 8080 | `app.port: 8080` |
| Java/Spring Boot | 8080 | `app.port: 8080` |
| Python/FastAPI | 8000 | `app.port: 8000` |

### Traffic Blocked

**Symptoms:**
- App running but not accessible
- Timeout when accessing preview URL
- Inter-pod communication failing

**Diagnosis:**
```bash
# List network policies
kubectl get networkpolicies -n k8s-ee-pr-{number}

# Describe policies
kubectl describe networkpolicy -n k8s-ee-pr-{number}

# Test from inside cluster
kubectl run debug --rm -it --image=busybox -n k8s-ee-pr-{number} -- \
  wget -qO- http://k8s-ee-pr-{number}-demo-app:80/api/health
```

**Common Causes:**

| Cause | Solution |
|-------|----------|
| Missing ingress rule | Check Traefik namespace selector |
| Wrong port in policy | Verify `app.port` in k8s-ee.yaml matches app |
| Egress blocked | Check egress policy for DNS |

### Ingress Not Working

**Symptoms:**
- 404 or 503 when accessing preview URL
- TLS certificate errors

**Diagnosis:**
```bash
# Check ingress resource
kubectl get ingress -n k8s-ee-pr-{number}
kubectl describe ingress -n k8s-ee-pr-{number}

# Check Traefik logs
kubectl logs -n kube-system -l app.kubernetes.io/name=traefik --tail=50

# Verify DNS resolution
nslookup k8s-ee-pr-{number}.k8s-ee.genesluna.dev
```

**Resolution:**
```bash
# Check certificate status (if using cert-manager)
kubectl get certificates -n k8s-ee-pr-{number}

# Force Traefik to reload
kubectl rollout restart deployment -n kube-system traefik
```

## Health Check Failures

### Startup Probe Fails

**Symptoms:**
- Pod killed before becoming ready
- Events show `Startup probe failed`

**Diagnosis:**
```bash
kubectl describe pod -n k8s-ee-pr-{number} <pod-name> | grep -A10 "Startup:"
```

**Resolution:**

Increase startup probe tolerance in Helm values:
```yaml
probes:
  startup:
    failureThreshold: 60  # Increase from 30
    periodSeconds: 2
```

### Liveness Probe Fails

**Symptoms:**
- Pod restarts after running for a while
- Events show `Liveness probe failed`

**Common Causes:**

| Cause | Solution |
|-------|----------|
| Resource exhaustion | Increase CPU/memory limits |
| Deadlock | Check for blocking operations |
| Slow endpoint | Increase timeout |

**Diagnosis:**
```bash
# Check resource usage
kubectl top pod -n k8s-ee-pr-{number}

# Check probe endpoint manually
kubectl exec -n k8s-ee-pr-{number} <pod-name> -- wget -qO- http://localhost:3000/api/health
```

### Readiness Probe Fails

**Symptoms:**
- Pod running but not receiving traffic
- Service endpoints empty

**Diagnosis:**
```bash
# Check endpoints
kubectl get endpoints -n k8s-ee-pr-{number}

# Check readiness status
kubectl get pods -n k8s-ee-pr-{number} -o wide
```

## Common kubectl Commands

### Debugging Reference

| Task | Command |
|------|---------|
| List all resources | `kubectl get all -n k8s-ee-pr-{N}` |
| Pod logs | `kubectl logs -n k8s-ee-pr-{N} <pod>` |
| Previous logs | `kubectl logs -n k8s-ee-pr-{N} <pod> --previous` |
| Follow logs | `kubectl logs -n k8s-ee-pr-{N} <pod> -f` |
| Describe pod | `kubectl describe pod -n k8s-ee-pr-{N} <pod>` |
| Events | `kubectl get events -n k8s-ee-pr-{N} --sort-by='.lastTimestamp'` |
| Exec into pod | `kubectl exec -it -n k8s-ee-pr-{N} <pod> -- sh` |
| Port forward | `kubectl port-forward -n k8s-ee-pr-{N} svc/<svc> 3000:80` |
| Resource usage | `kubectl top pods -n k8s-ee-pr-{N}` |

### Quick Health Check

```bash
NS=k8s-ee-pr-{number}

echo "=== Namespace ==="
kubectl get ns $NS

echo "=== Pods ==="
kubectl get pods -n $NS

echo "=== Services ==="
kubectl get svc -n $NS

echo "=== Database ==="
kubectl get clusters.postgresql.cnpg.io -n $NS

echo "=== Ingress ==="
kubectl get ingress -n $NS

echo "=== Recent Events ==="
kubectl get events -n $NS --sort-by='.lastTimestamp' | tail -10
```

## Metrics Issues

### Metrics Not Appearing in Prometheus

**Symptoms:**
- Dashboard panels show "No Data"
- Prometheus queries return empty results
- ServiceMonitor exists but metrics missing

**Diagnosis:**
```bash
# Check ServiceMonitor exists
kubectl get servicemonitor -n k8s-ee-pr-{number}

# Check Prometheus target status
kubectl port-forward -n observability svc/prometheus-kube-prometheus-prometheus 9090:9090
# Visit localhost:9090/targets and look for your namespace

# Check if app is exposing metrics
curl https://k8s-ee-pr-{number}.k8s-ee.genesluna.dev/metrics
```

**Common Causes:**

| Cause | Solution |
|-------|----------|
| ServiceMonitor missing label | Ensure `release: prometheus` label exists |
| App not exposing /metrics | Check MetricsModule is imported in app.module.ts |
| Port mismatch | ServiceMonitor port must match service port name |
| Network policy blocking | Verify observability namespace can reach app |
| metrics.enabled not set | Verify `metrics.enabled: true` in k8s-ee.yaml |
| Namespace label missing | ServiceMonitor adds namespace via relabeling (automatic in k8s-ee charts) |

### High Cardinality Metrics

**Symptoms:**
- Prometheus memory usage increasing
- Queries becoming slow
- "cardinality" warnings in Prometheus logs

**Diagnosis:**
```bash
# Check cardinality by metric
kubectl exec -n observability prometheus-prometheus-prometheus-0 -- \
  wget -qO- 'http://localhost:9090/api/v1/query?query=count by (__name__)({__name__=~".+"})' | \
  grep -o '"__name__":"[^"]*"' | sort | uniq -c | sort -rn | head -20
```

**Common Causes:**

| Cause | Solution |
|-------|----------|
| Unique IDs in route labels | Middleware normalizes paths: `/status/500` → `/status/:code` |
| Static asset paths | Static assets (`/assets/*`) are excluded from metrics |
| UUID paths | UUIDs normalized to `:uuid` placeholder |

**How Route Normalization Works:**

The metrics middleware automatically normalizes paths to prevent high cardinality:

| Original Path | Normalized Path |
|---------------|-----------------|
| `/api/simulator/status/500` | `/api/simulator/status/:code` |
| `/api/simulator/latency/slow` | `/api/simulator/latency/:preset` |
| `/api/db-test/heavy-query/medium` | `/api/db-test/heavy-query/:intensity` |
| `/user/123` | `/user/:id` |
| `/item/550e8400-e29b-...` | `/item/:uuid` |
| `/assets/index-D4IGy2yB.css` | *(excluded from metrics)* |

### Dashboard Namespace Dropdown Empty

**Symptoms:**
- Namespace dropdown shows no options
- Dashboard panels all show "No Data"

**Diagnosis:**
```bash
# Test the namespace variable query
kubectl exec -n observability prometheus-prometheus-prometheus-0 -- \
  wget -qO- 'http://localhost:9090/api/v1/query?query=kube_namespace_status_phase{namespace=~".*-pr-.*",phase="Active"}'
```

**Common Causes:**

| Cause | Solution |
|-------|----------|
| No PR environments exist | Create a PR to generate a namespace |
| Variable uses wrong metric | Use `kube_namespace_status_phase`, not `http_requests_total` |
| kube-state-metrics down | Check kube-state-metrics pod is running |

**Best Practice:** Dashboards should use `kube_namespace_status_phase` for namespace variables since it's always available from kube-state-metrics, even when no application metrics exist yet.

## Alert Demo Issues

### Alerts Not Triggering

**Symptoms:**
- Alert demo running but no alerts fire in Grafana/Alertmanager
- Dashboard shows no error rate or latency spikes

**Diagnosis:**
```bash
# Check alert demo is running
curl https://k8s-ee-pr-{number}.k8s-ee.genesluna.dev/api/simulator/alert-demo/status

# Verify metrics are being recorded (port-forward Prometheus)
kubectl port-forward -n observability svc/prometheus-kube-prometheus-prometheus 9090:9090
# Query: http_requests_total{status_code="500", namespace="k8s-ee-pr-{number}"}

# Check alert rules are loaded
# In Prometheus UI: Status > Rules
```

**How Alert Demo Works:**

The alert demo makes **actual HTTP requests** to the simulator endpoints to generate real metrics:

| Alert Type | Endpoint Called | Metric Generated |
|------------|-----------------|------------------|
| high-error-rate | `/api/simulator/status/500` | `http_requests_total{status_code="500"}` |
| high-latency | `/api/simulator/latency/slow` | `http_request_duration_seconds` (P99 > 500ms) |
| slow-database | `/api/database-test/heavy-query/medium` | `db_query_duration_seconds` (P99 > 1s) |

**Expected Timeline:**

| Phase | Duration | What Happens |
|-------|----------|--------------|
| Start | 0s | Demo begins sending requests |
| Metrics scraped | 30s | Prometheus collects first data points |
| Rate calculation | ~2m | Prometheus has enough data for rate calculation |
| Alert pending | ~2m | Alert condition becomes true, enters pending state |
| Alert fires | ~7m | After 5m in pending state, alert fires |
| Demo ends | 10m 30s | Demo stops automatically |

**Note:** Alerts require `rate(...[5m])` for rate calculation plus `for: 5m` pending duration before firing (~10 minutes total). The demo runs for 10.5 minutes to ensure alerts transition from "pending" to "firing".

**Common Causes:**

| Cause | Solution |
|-------|----------|
| PrometheusRule not applied | Apply `kubectl apply -f k8s/observability/custom-alerts.yaml` |
| Prometheus not scraping | Check ServiceMonitor and targets in Prometheus UI |
| Metrics not recorded | Verify HTTP requests are going through middleware |
| Alert rules disabled | Check PrometheusRule CRD exists |
| Network policy blocking | Verify observability namespace can reach app |

**First Troubleshooting Step - Verify PrometheusRule:**
```bash
# Check if custom alerts are applied
kubectl get prometheusrule -n observability custom-alerts

# If not found, apply them
kubectl apply -f k8s/observability/custom-alerts.yaml

# Verify all 15 alerts are loaded
kubectl get prometheusrule -n observability custom-alerts \
  -o jsonpath='{.spec.groups[0].rules[*].alert}' | tr ' ' '\n'
```

**Verify Metrics are Being Recorded:**
```bash
# Port-forward Prometheus
kubectl port-forward -n observability svc/prometheus-kube-prometheus-prometheus 9090:9090

# Example queries (in Prometheus UI at localhost:9090):
# 1. Check 500 errors are being recorded:
http_requests_total{status_code="500", namespace="k8s-ee-pr-{number}"}

# 2. Check error rate calculation:
sum(rate(http_requests_total{status_code=~"5..", namespace="k8s-ee-pr-{number}"}[5m])) / sum(rate(http_requests_total{namespace="k8s-ee-pr-{number}"}[5m])) * 100

# 3. Check P99 latency:
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket{namespace="k8s-ee-pr-{number}"}[5m]))
```

**Check Alert Status:**
```bash
# Port-forward Alertmanager
kubectl port-forward -n observability svc/prometheus-kube-prometheus-alertmanager 9093:9093
# Visit localhost:9093 to see firing and pending alerts
```

## Related Documentation

- [Developer Onboarding](../DEVELOPER-ONBOARDING.md)
- [Cluster Recovery Runbook](../runbooks/cluster-recovery.md)
- [Network Policies Runbook](../runbooks/network-policies.md)
- [Database Operators Runbook](../runbooks/database-operators.md)
- [Custom Alerts Guide](../../k8s/observability/custom-alerts-README.md)
