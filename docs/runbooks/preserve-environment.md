# Runbook: Preserve Environment Feature

## Overview

This runbook covers operations for the preserve environment feature, which allows
developers to keep PR environments active for extended testing (up to 48 hours).

## Components

| Component | Location | Purpose |
|-----------|----------|---------|
| Preserve Workflow | `.github/workflows/preserve-environment.yml` | Handles `/preserve` command |
| Expiry CronJob | `k8s/platform/preserve-expiry/` | Checks and expires preservations |
| Alerts | `k8s/platform/alerts/preserve-alerts.yaml` | Monitoring alerts |

## Common Operations

### List Preserved Environments

```bash
kubectl get namespaces -l preserve=true
```

### Check Expiry Times

```bash
kubectl get namespaces -l preserve=true \
  -o custom-columns='NAMESPACE:.metadata.name,EXPIRES:.metadata.annotations.k8s-ee/preserve-until,PRESERVED-BY:.metadata.annotations.k8s-ee/preserved-by'
```

### Manually Preserve a Namespace

```bash
NAMESPACE="k8s-ee-pr-123"
PRESERVE_UNTIL=$(date -u -d "+48 hours" +%Y-%m-%dT%H:%M:%SZ)

kubectl label namespace "$NAMESPACE" preserve=true --overwrite
kubectl annotate namespace "$NAMESPACE" \
  "k8s-ee/preserve-until=$PRESERVE_UNTIL" \
  "k8s-ee/preserved-by=manual" \
  --overwrite
```

### Manually Remove Preservation

```bash
kubectl label namespace <namespace> preserve-
kubectl annotate namespace <namespace> k8s-ee/preserve-until-
kubectl annotate namespace <namespace> k8s-ee/preserved-by-
kubectl annotate namespace <namespace> k8s-ee/preserve-warning-sent-
```

### Run Expiry Check Manually

```bash
kubectl create job --from=cronjob/preserve-expiry manual-expiry -n platform
kubectl logs -n platform job/manual-expiry -f
```

## Alert Response

### PreserveExpiryJobFailed

**Severity:** Warning

**Symptoms:**
- Preserved environments not expiring on schedule
- No warning comments posted before expiry

**Investigation:**

1. Check recent job runs:
   ```bash
   kubectl get jobs -n platform -l app.kubernetes.io/name=preserve-expiry
   ```

2. Check job logs:
   ```bash
   kubectl logs -n platform -l app.kubernetes.io/name=preserve-expiry --tail=100
   ```

3. Check for pod issues:
   ```bash
   kubectl describe pod -n platform -l app.kubernetes.io/name=preserve-expiry
   ```

**Resolution:**

1. If GitHub token issue:
   ```bash
   kubectl get secret github-cleanup-token -n platform
   ```

2. If image pull issue:
   ```bash
   kubectl describe pod -n platform -l app.kubernetes.io/name=preserve-expiry | grep -A5 Events
   ```

3. Manually run expiry check:
   ```bash
   kubectl create job --from=cronjob/preserve-expiry fix-expiry -n platform
   ```

### PreserveExpiryJobNotRunning

**Severity:** Warning

**Symptoms:**
- CronJob hasn't run for over 2 hours

**Investigation:**

1. Check CronJob status:
   ```bash
   kubectl get cronjob preserve-expiry -n platform
   kubectl describe cronjob preserve-expiry -n platform
   ```

2. Check if CronJob is suspended:
   ```bash
   kubectl get cronjob preserve-expiry -n platform -o jsonpath='{.spec.suspend}'
   ```

**Resolution:**

1. If suspended, resume:
   ```bash
   kubectl patch cronjob preserve-expiry -n platform -p '{"spec":{"suspend":false}}'
   ```

2. Trigger manual run:
   ```bash
   kubectl create job --from=cronjob/preserve-expiry manual-run -n platform
   ```

### TooManyPreservedEnvironments

**Severity:** Warning

**Symptoms:**
- More than 3 preserved environments exist
- Quota enforcement may have failed

**Investigation:**

1. List all preserved environments:
   ```bash
   kubectl get namespaces -l preserve=true
   ```

2. Check when they expire:
   ```bash
   kubectl get namespaces -l preserve=true \
     -o jsonpath='{range .items[*]}{.metadata.name}: {.metadata.annotations.k8s-ee/preserve-until}{"\n"}{end}'
   ```

**Resolution:**

1. Wait for oldest preservations to expire, OR

2. Manually remove preservation from oldest:
   ```bash
   kubectl label namespace <oldest-namespace> preserve-
   ```

## Metrics

The preserve expiry job logs metrics at the end of each run:

- `namespaces_checked` - Number of preserved namespaces checked
- `namespaces_expired` - Number of preservations that expired
- `namespaces_warned` - Number of warning comments sent
- `comments_posted` - Total GitHub comments posted
- `errors` - Number of errors encountered

## Architecture

```
User comments "/preserve"
        ↓
preserve-environment.yml workflow
  ├── Check PR is open
  ├── Check namespace exists
  ├── Check quota (max 3)
  ├── Apply preserve=true label
  ├── Apply k8s-ee/preserve-until annotation
  └── Post confirmation comment
        ↓
preserve-expiry CronJob (hourly)
  ├── List namespaces with preserve=true
  ├── Check k8s-ee/preserve-until annotation
  ├── If < 1 hour remaining → Post warning comment
  └── If expired → Remove preserve label
        ↓
cleanup-orphaned-namespaces CronJob (every 6 hours)
  └── Deletes namespaces without preserve=true label
```

## Related Documentation

- [Cleanup Job Runbook](./cleanup-job.md)
- [Preserve Feature README](../../k8s/platform/preserve-expiry/README.md)
- [US-021 User Story](../user-stories/epic-6-security/US-021-preserve-environment.md)
