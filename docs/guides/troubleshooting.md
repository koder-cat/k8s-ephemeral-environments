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
| Runner unavailable | Check `gh-runners` namespace for healthy runners |
| kubectl auth failed | Verify KUBECONFIG secret in GitHub |
| Previous run conflict | Delete stale namespace manually |

**Resolution:**
```bash
# Check runner status
kubectl get pods -n gh-runners

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

## Related Documentation

- [Developer Onboarding](../DEVELOPER-ONBOARDING.md)
- [Cluster Recovery Runbook](../runbooks/cluster-recovery.md)
- [Network Policies Runbook](../runbooks/network-policies.md)
- [Database Operators Runbook](../runbooks/database-operators.md)
