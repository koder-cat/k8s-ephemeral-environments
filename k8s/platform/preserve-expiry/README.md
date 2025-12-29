# Preserve Environment Feature

This feature allows developers to preserve PR environments for extended testing
(up to 48 hours) by commenting `/preserve` on their PR.

## Overview

| Setting | Value |
|---------|-------|
| Preserve Duration | 48 hours |
| Max Preserved Environments | 3 |
| Expiry Check Schedule | Every hour (at :30) |
| Warning Before Expiry | 1 hour |

## How It Works

1. Developer comments `/preserve` on a PR
2. GitHub Actions workflow adds `preserve=true` label to namespace
3. Workflow adds `k8s-ee/preserve-until` annotation with expiry timestamp
4. When PR is closed, cleanup job skips namespace (preserve label present)
5. Hourly expiry job checks for expired preservations
6. When expired, label is removed and cleanup job deletes namespace

## Usage

### Preserve an Environment

Comment on your PR:

```
/preserve
```

You'll receive a confirmation comment with the expiry time.

### Extend Preservation

To extend an already-preserved environment, comment `/preserve` again.
This resets the 48-hour timer.

### Limitations

- Maximum 3 preserved environments at a time (cluster-wide)
- Maximum preservation time: 48 hours
- Cannot preserve environments for closed PRs

## Installation

### Prerequisites

1. Platform namespace exists (`kubectl apply -f k8s/platform/namespace.yaml`)
2. GitHub token secret exists (`github-cleanup-token`)
3. Cleanup job RBAC exists (`cleanup-job-sa` ServiceAccount)

### Deploy the Expiry Job

```bash
kubectl apply -f k8s/platform/preserve-expiry/preserve-expiry-configmap.yaml
kubectl apply -f k8s/platform/preserve-expiry/preserve-expiry-cronjob.yaml
```

### Deploy Alerting Rules (if Prometheus is installed)

```bash
kubectl apply -f k8s/platform/alerts/preserve-alerts.yaml
```

**Note:** If you change `MAX_PRESERVED_ENVIRONMENTS` in the workflow, you must also update
the threshold in `k8s/platform/alerts/preserve-alerts.yaml` (TooManyPreservedEnvironments alert).

## Manual Operations

### Check Preserved Environments

```bash
kubectl get namespaces -l preserve=true
```

### Check Expiry Times

```bash
kubectl get namespaces -l preserve=true \
  -o jsonpath='{range .items[*]}{.metadata.name}: {.metadata.annotations.k8s-ee/preserve-until}{"\n"}{end}'
```

### Manually Remove Preserve

```bash
kubectl label namespace <namespace> preserve-
```

### Run Expiry Job Manually

```bash
kubectl create job --from=cronjob/preserve-expiry manual-expiry -n platform
```

## Troubleshooting

### Preserve Command Not Working

1. Check if workflow is enabled:
   ```bash
   gh workflow list
   ```

2. Check workflow run status:
   ```bash
   gh run list --workflow=preserve-environment.yml
   ```

3. Verify namespace exists:
   ```bash
   kubectl get namespace <project-id>-pr-<number>
   ```

### Quota Exceeded

Check current preserved environments:

```bash
kubectl get namespaces -l preserve=true --no-headers | wc -l
```

Wait for an existing preserved environment to expire or manually release one:

```bash
kubectl label namespace <namespace> preserve-
```

### Expiry Job Not Running

Check CronJob status:

```bash
kubectl get cronjob preserve-expiry -n platform
kubectl describe cronjob preserve-expiry -n platform
```

Check recent job runs:

```bash
kubectl get jobs -n platform -l app.kubernetes.io/name=preserve-expiry
```

## Related Documentation

- [Cleanup Job](../cleanup-job/README.md) - Handles namespace deletion
- [US-021 User Story](../../../docs/user-stories/epic-6-security/US-021-preserve-environment.md)
- [Operational Runbook](../../../docs/runbooks/preserve-environment.md)
