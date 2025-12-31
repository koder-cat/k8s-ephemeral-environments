# Troubleshooting Guide

This guide helps diagnose and resolve common issues with PR environments.

## Table of Contents

- [Quick Diagnosis](#quick-diagnosis)
- [PR Namespace Issues](#pr-namespace-issues)
- [Deployment Failures](#deployment-failures)
- [Database Issues](#database-issues)
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
| kubectl auth failed | Verify KUBECONFIG secret in GitHub |
| Previous run conflict | Delete stale namespace manually |

**Resolution:**
```bash
# Check runner status
kubectl get pods -n arc-runners

# Re-run failed workflow
gh run rerun <run-id>

# Manual namespace cleanup if stuck
kubectl delete ns k8s-ee-pr-{number} --force --grace-period=0
```

### ResourceQuota Exceeded

**Symptoms:**
- Namespace created but pods pending
- Events show quota exceeded errors

**Diagnosis:**
```bash
kubectl describe resourcequota -n k8s-ee-pr-{number}
kubectl get events -n k8s-ee-pr-{number} --sort-by='.lastTimestamp'
```

**Resolution:**
```bash
# Check resource usage
kubectl top pods -n k8s-ee-pr-{number}

# Clean up old PR namespaces
kubectl get ns -l k8s-ee/pr-number --sort-by='.metadata.creationTimestamp'
kubectl delete ns k8s-ee-pr-{old-number}
```

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

**Diagnosis:**
```bash
kubectl describe pod -n k8s-ee-pr-{number} <pod-name> | grep -A5 Events
```

**Common Causes:**

| Cause | Solution |
|-------|----------|
| Image doesn't exist | Check GHCR for the tag |
| Auth failed | Verify imagePullSecrets |
| Wrong tag | Check commit SHA matches |

**Resolution:**
```bash
# Verify image exists
docker pull ghcr.io/genesluna/k8s-ephemeral-environments/demo-app:pr-{number}

# Check image pull secret
kubectl get secret -n k8s-ee-pr-{number}
```

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

**Resolution:**
```bash
# Check database cluster status
kubectl get clusters.postgresql.cnpg.io -n k8s-ee-pr-{number}

# Test connectivity from debug pod
kubectl run debug --rm -it --image=busybox -n k8s-ee-pr-{number} -- \
  nc -zv k8s-ee-pr-{number}-postgresql-rw 5432
```

## Database Issues

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
# Delete the PostgreSQL cluster (data will be lost!)
kubectl delete cluster -n k8s-ee-pr-{number} -l app.kubernetes.io/instance

# Trigger redeploy via GitHub Actions
# (push new commit or re-run workflow)

# OR manually apply SQL to existing database
kubectl exec -n k8s-ee-pr-{number} -it $(kubectl get pods -n k8s-ee-pr-{number} \
  -l cnpg.io/cluster -o name | head -1) -- psql -U postgres -d app -f /path/to/sql
```

**Note:** For PR environments, simply closing and reopening the PR will recreate the namespace with fresh bootstrap SQL.

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

## Network Policy Issues

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
| Wrong port in policy | Verify port 3000 allowed |
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
