# Cleanup Job Runbook

This runbook covers operational procedures for the orphaned namespace cleanup job.

## Overview

The cleanup job runs every 6 hours to identify and remove orphaned PR namespaces.
It serves as a safety net when the webhook-based cleanup (triggered on PR close) fails.

## Alert Response Procedures

### CleanupJobFailed

**Severity:** Warning

**Description:** The cleanup CronJob has failed.

**Investigation Steps:**

1. Check job logs:
   ```bash
   kubectl logs -n platform -l app.kubernetes.io/name=cleanup-job --tail=200
   ```

2. Check pod status:
   ```bash
   kubectl get pods -n platform -l app.kubernetes.io/name=cleanup-job
   kubectl describe pod -n platform -l app.kubernetes.io/name=cleanup-job
   ```

3. Common causes:
   - GitHub API rate limiting (check for 403 errors in logs)
   - Invalid or expired GitHub token
   - Network connectivity issues
   - RBAC permission issues

**Resolution:**

- If rate limited: Wait for rate limit reset (usually 1 hour)
- If token expired: Rotate the GitHub token secret
- If RBAC issue: Verify ClusterRoleBinding exists

### CleanupJobConsecutiveFailures

**Severity:** Critical

**Description:** The cleanup job has failed 2+ times in 24 hours.

**Investigation Steps:**

1. Review all recent job failures:
   ```bash
   kubectl get jobs -n platform -l app.kubernetes.io/name=cleanup-job --sort-by=.metadata.creationTimestamp
   ```

2. Check for persistent issues:
   ```bash
   for job in $(kubectl get jobs -n platform -l app.kubernetes.io/name=cleanup-job -o name | tail -3); do
     echo "=== $job ==="
     kubectl logs -n platform $job --tail=50
   done
   ```

**Resolution:**

- Address root cause from logs
- If unclear, run manual cleanup with `DRY_RUN=true` to diagnose
- Escalate if issue persists after manual intervention

### CleanupJobNotRunning

**Severity:** Warning

**Description:** The CronJob hasn't run in 8+ hours (should run every 6 hours).

**Investigation Steps:**

1. Check CronJob status:
   ```bash
   kubectl get cronjob cleanup-orphaned-namespaces -n platform -o yaml
   ```

2. Check for suspended CronJob:
   ```bash
   kubectl get cronjob cleanup-orphaned-namespaces -n platform -o jsonpath='{.spec.suspend}'
   ```

3. Check Kubernetes scheduler:
   ```bash
   kubectl get events -n platform --field-selector reason=FailedCreate
   ```

**Resolution:**

- If suspended: `kubectl patch cronjob cleanup-orphaned-namespaces -n platform -p '{"spec":{"suspend":false}}'`
- If missing: Re-apply the CronJob manifest
- Trigger manual run: `kubectl create job --from=cronjob/cleanup-orphaned-namespaces manual-run -n platform`

### TooManyEphemeralNamespaces

**Severity:** Warning

**Description:** More than 10 ephemeral namespaces exist.

**Investigation Steps:**

1. List all ephemeral namespaces:
   ```bash
   kubectl get namespaces -l k8s-ee/type=ephemeral -o custom-columns=NAME:.metadata.name,AGE:.metadata.creationTimestamp,PR:.metadata.labels.k8s-ee/pr-number
   ```

2. Check for preserved namespaces:
   ```bash
   kubectl get namespaces -l k8s-ee/type=ephemeral,preserve=true
   ```

3. Check corresponding PR status:
   ```bash
   # For each namespace, verify PR is still open
   gh pr view <PR_NUMBER> --json state
   ```

**Resolution:**

- If PRs are closed: Run manual cleanup job
- If cleanup job is failing: Investigate job failures
- If preserved namespaces: Verify preservation is intentional

### OldEphemeralNamespace

**Severity:** Warning

**Description:** A namespace is older than 72 hours.

**Investigation Steps:**

1. Check namespace details:
   ```bash
   kubectl get namespace <NAME> -o yaml
   ```

2. Check if preserved:
   ```bash
   kubectl get namespace <NAME> -o jsonpath='{.metadata.labels.preserve}'
   ```

3. Check PR status:
   ```bash
   gh pr view <PR_NUMBER> --json state,title
   ```

**Resolution:**

- If PR is closed and not preserved: Run manual cleanup
- If PR is open: This is expected for long-running PRs
- If preserved: Verify preservation is still needed

## Manual Operations

### Run Cleanup Manually

```bash
kubectl create job --from=cronjob/cleanup-orphaned-namespaces manual-cleanup-$(date +%s) -n platform
```

### Run Cleanup in Dry-Run Mode

```bash
kubectl create job manual-dry-run -n platform --from=cronjob/cleanup-orphaned-namespaces --dry-run=client -o yaml | \
  sed 's/DRY_RUN/DRY_RUN_OVERRIDE/;s/value: "false"/value: "true"/' | \
  kubectl apply -f -
```

### Force Delete a Specific Namespace

Only use this if automated cleanup is failing:

```bash
NAMESPACE="k8s-ee-pr-123"

# Remove PVC finalizers
kubectl get pvc -n $NAMESPACE -o name | xargs -r kubectl patch -n $NAMESPACE -p '{"metadata":{"finalizers":null}}' --type=merge

# Delete namespace
kubectl delete namespace $NAMESPACE --wait=true --timeout=5m

# Force delete if stuck
kubectl patch namespace $NAMESPACE -p '{"metadata":{"finalizers":null}}' --type=merge
kubectl delete namespace $NAMESPACE --force --grace-period=0
```

### Rotate GitHub Token

The cleanup job uses a fine-grained GitHub Personal Access Token to query PR status
for the `koder-cat` organization repositories.

**Step 1: Create/Regenerate Token**

1. Go to: https://github.com/settings/personal-access-tokens/new
2. **Token name:** `k8s-ee-cleanup`
3. **Expiration:** 365 days or less (org policy requires ≤366 days)
4. **Resource owner:** Select `koder-cat` (the organization)
5. **Repository access:** "Only select repositories" → `k8s-ephemeral-environments`
   - Or "All repositories" if cleanup needs to check PRs across multiple repos
6. **Permissions → Repository permissions:**
   - **Pull requests:** Read-only
7. Click "Generate token" and copy it (starts with `github_pat_`)

**Step 2: Validate Token Locally**

```bash
# Test the token before updating the secret
curl -s -H "Authorization: Bearer YOUR_NEW_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/koder-cat/k8s-ephemeral-environments/pulls?state=all&per_page=1" \
  | jq '.[0].state // .message'
# Expected: "open" or "closed" (not "Bad credentials" or "Not Found")
```

**Step 3: Update Secret on VPS**

```bash
ssh ubuntu@168.138.151.63

# Secure method: avoid token in shell history
read -s -p "Enter new token: " TOKEN && echo

# Update the secret
sudo kubectl create secret generic github-cleanup-token \
  --namespace platform \
  --from-literal=GITHUB_TOKEN="$TOKEN" \
  --dry-run=client -o yaml | sudo kubectl apply -f -

# Clear the variable
unset TOKEN
```

**Step 4: Verify Update**

```bash
# Verify token format
sudo kubectl get secret github-cleanup-token -n platform \
  -o jsonpath='{.data.GITHUB_TOKEN}' | base64 -d | head -c 15
# Expected: github_pat_...

# Run test job
sudo kubectl create job --from=cronjob/cleanup-orphaned-namespaces test-cleanup -n platform
sudo kubectl wait --for=condition=complete job/test-cleanup -n platform --timeout=120s
sudo kubectl logs -n platform -l job-name=test-cleanup | grep -E "GitHub API errors|401|403"
# Expected: "GitHub API errors: 0" and no auth errors

# Clean up
sudo kubectl delete job test-cleanup -n platform
```

### Preserve a Namespace

To prevent a namespace from being cleaned up:

```bash
kubectl label namespace k8s-ee-pr-123 preserve=true
```

To remove preservation:

```bash
kubectl label namespace k8s-ee-pr-123 preserve-
```

## Metrics

The cleanup job logs metrics to stdout. Key metrics to monitor:

| Metric | Description |
|--------|-------------|
| `namespaces_checked` | Total ephemeral namespaces found |
| `namespaces_orphaned` | Namespaces identified as orphaned |
| `namespaces_deleted` | Successfully deleted namespaces |
| `namespaces_failed` | Failed deletion attempts |
| `github_api_errors` | GitHub API call failures |

## Escalation

If cleanup issues persist after following this runbook:

1. Check cluster health (nodes, control plane)
2. Verify GitHub API status (https://www.githubstatus.com/)
3. Review recent changes to RBAC or network policies
4. Escalate to platform team with:
   - Job logs from last 24 hours
   - List of stuck namespaces
   - Cluster events related to cleanup job
