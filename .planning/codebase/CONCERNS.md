# Codebase Concerns

**Analysis Date:** 2026-01-25

## Tech Debt

**Initialization Race Conditions:**
- Issue: Applications can start before databases finish initialization, causing "migration failed" errors despite proper probes
- Files: `.github/workflows/pr-environment-reusable.yml`, `docs/guides/troubleshooting.md` (documented)
- Impact: ~1% of deployments fail on first attempt and require manual pod restart to succeed
- Fix approach: Requires apps to implement application-level retry logic with exponential backoff in `onModuleInit()`. Defense-in-depth approach: both init containers (native tools like `pg_isready`) AND app-level retry needed. Currently documented but not enforced.

**Python Script Error Handling Gaps:**
- Issue: `scripts/cleanup-orphaned-namespaces.py` and `scripts/preserve-expiry.py` have incomplete error recovery for partial failures
- Files: `scripts/cleanup-orphaned-namespaces.py` (lines 343-348), `scripts/preserve-expiry.py` (lines 308-310)
- Impact: If some namespaces fail deletion but others succeed, exit code reports failure but cleanup is partial. No retry mechanism for failed individual namespaces.
- Fix approach: Implement per-namespace retry logic and report summary statistics separately from exit code (e.g., log failure but exit 0 if majority succeeded)

**Helm Chart Metadata Lookup Complexity:**
- Issue: Multiple charts use Helm `lookup()` function to preserve existing Secret values across upgrades
- Files: `charts/mariadb/templates/secret.yaml`, `charts/minio/templates/tenant.yaml`, `charts/redis/templates/secret.yaml`
- Impact: Lookup can fail silently if the Secret doesn't exist yet or if templating permissions are insufficient. No fallback error messages. Secrets could be lost or regenerated unexpectedly on re-deploy.
- Fix approach: Add explicit error handling and logging to helm templates, verify pre-deploy that secrets exist before upgrade

**User Story Sync Script Rate Limiting:**
- Issue: `scripts/sync-stories.py` has retry logic but no exponential backoff cap
- Files: `scripts/sync-stories.py` (lines 211-215)
- Impact: Retry delays grow exponentially (2^n seconds) without maximum, can exceed job timeout. Line 214: `delay = RETRY_BASE_DELAY ** attempt` with no cap.
- Fix approach: Add `MAX_DELAY` constant (e.g., 60s) and cap exponential backoff: `delay = min(RETRY_BASE_DELAY ** attempt, MAX_DELAY)`

## Known Bugs

**MariaDB EmptyDir Data Loss:**
- Symptoms: MariaDB pod restarts lose all data; database becomes unavailable
- Files: `charts/mariadb/templates/deployment.yaml` (line 70, uses `emptyDir: {}`)
- Trigger: Pod eviction, node restart, or deployment rolling update
- Workaround: None. Use PostgreSQL or MongoDB if data persistence required.
- Root cause: MariaDB chart uses emptyDir for all volumes (data, logs, tmp). emptyDir is deleted when pod terminates. MariaDB chart lacks persistent storage configuration.

**NetworkPolicy Port Mismatch:**
- Symptoms: Ingress traffic fails despite NetworkPolicy creation; app returns connection refused or 502
- Files: `k8s/ephemeral/network-policy-allow-ingress.yaml` (line 26), `.github/actions/create-namespace/action.yml` (line 192: `app-port` parameter)
- Trigger: Occurs when `k8s-ee.yaml` specifies different `app.port` than default 3000
- Workaround: Use default port 3000 in application config
- Root cause: NetworkPolicy is created with hardcoded port from action input, but if action input not provided or validation fails, port may not match actual container port

**Preserve Label Removal Race Condition:**
- Symptoms: Preserved namespace expires but namespace not deleted; cleanup job skips it
- Files: `scripts/preserve-expiry.py` (lines 160-172), `scripts/cleanup-orphaned-namespaces.py` (line 246-248)
- Trigger: Preserve label removal fails in preserve-expiry job but cleanup job runs before retry
- Workaround: Manually delete namespace: `kubectl delete ns <namespace>`
- Root cause: If preserve label removal fails (line 167 returns False), script continues. Next cleanup run won't see preserve=true but will check namespace age. If namespace is still young, it gets skipped.

## Security Considerations

**GitHub Token Exposure in Logs:**
- Risk: GITHUB_TOKEN passed to subprocess.run() in Python scripts could appear in error logs
- Files: `scripts/cleanup-orphaned-namespaces.py` (lines 117-153), `scripts/preserve-expiry.py` (lines 130-157)
- Current mitigation: Headers dict includes token, not used in command line args. However, if GitHub API request fails, error output could contain partial token in response headers.
- Recommendations: Redact token from all subprocess output before logging. Use dedicated service account tokens instead of GITHUB_TOKEN for GitHub API calls.

**NetworkPolicy Incomplete Egress Control:**
- Risk: PR namespaces can reach cluster API and observability systems but no egress filtering to external networks
- Files: `k8s/ephemeral/network-policy-allow-egress.yaml` (lines 10-27)
- Current mitigation: NetworkPolicy allows egress to k8s API (10.0.0.39) and port 443 (HTTPS) to all destinations
- Recommendations: Restrict external egress to specific CIDR blocks (e.g., only GitHub, npm registry, etc.). Implement egress logging via Calico/Cilium.

**Secrets stored in Kubernetes native Secrets (not encrypted at rest):**
- Risk: Database passwords and MinIO credentials stored in plaintext in etcd
- Files: `charts/mariadb/templates/secret.yaml`, `charts/minio/templates/tenant.yaml`, `charts/redis/templates/secret.yaml`
- Current mitigation: Sealed Secrets mentioned in docs but not deployed by default in charts
- Recommendations: Enforce Sealed Secrets encryption on all Secrets by default in deployment actions. Implement RBAC to prevent `kubectl get secrets` access.

**Organization Allowlist Configuration Path:**
- Risk: `.github/config/allowed-orgs.json` must exist but no validation or fallback
- Files: `.github/workflows/pr-environment-reusable.yml` (references action that validates org)
- Current mitigation: Action validates against allowlist but missing file causes deployment to fail
- Recommendations: Document required config file in README. Add fallback to deny-all if file missing. Validate config in CI.

## Performance Bottlenecks

**Namespace Deletion Timeout Cascade:**
- Problem: Namespace deletion waits 4 minutes with `--wait=true`, then falls back to force deletion
- Files: `scripts/cleanup-orphaned-namespaces.py` (lines 210-228)
- Cause: Finalizers on PVCs can cause hangs. Cleanup script patches finalizers but timing is fragile.
- Improvement path: Implement background cleanup job to remove finalizers on orphaned resources every hour. Reduce initial delete timeout to 1m, more aggressive force cleanup.

**GitHub API Rate Limiting Blocking Cleanup:**
- Problem: If cleanup job hits GitHub API rate limit, all namespace processing stops (not retried)
- Files: `scripts/cleanup-orphaned-namespaces.py` (lines 143-148)
- Cause: GitHub API calls happen per-namespace in serial. 100+ namespaces could exceed secondary rate limit.
- Improvement path: Cache PR status for 10 minutes locally. Implement dedicated GitHub App token with higher rate limits (vs user GITHUB_TOKEN). Batch API calls.

**Sync Stories Script Linear GitHub API Calls:**
- Problem: `scripts/sync-stories.py` creates/updates one GitHub issue per story without batching
- Files: `scripts/sync-stories.py` (lines ~400-600, reading from codebase)
- Cause: GitHub API doesn't support batch mutations. Each story requires separate API call.
- Improvement path: Implement GraphQL batch mutations instead of REST API. Cache issue numbers locally to reduce lookups.

**PostgreSQL Startup Probe Inefficiency:**
- Problem: PostgreSQL pod uses native healthcheck but startup probe waits up to 30 attempts * 10s = 5 minutes
- Files: `charts/postgresql/values.yaml` (lines 52-58)
- Cause: Conservative startup threshold for large databases. Ephemeral databases should start faster.
- Improvement path: Reduce `failureThreshold` to 15 (2.5 minutes) for single-instance ephemeral DBs. Implement smarter initialization detection.

## Fragile Areas

**MariaDB Deployment - No PVC, Data Loss on Restart:**
- Files: `charts/mariadb/templates/deployment.yaml` (entire file)
- Why fragile: Uses only emptyDir volumes. Any pod restart loses data. No recovery mechanism. Chart doesn't support PVC configuration.
- Safe modification: Before modifying, switch from MariaDB to PostgreSQL (which has PVC support in k8s-ee). If MariaDB required, add PersistentVolumeClaim template and mount to /var/lib/mysql.
- Test coverage: Gaps - no tests for data persistence across pod restarts.

**GitHub Actions Workflow Concurrency Control:**
- Files: `.github/workflows/pr-environment-reusable.yml` (lines 62-64, `cancel-in-progress: false`)
- Why fragile: `cancel-in-progress: false` means rapid pushes to same PR queue up sequentially. If 10 pushes happen in 2 minutes, workflow runs 10 times serially (40+ minutes total). Can exhaust runner capacity.
- Safe modification: Change to `cancel-in-progress: true` but test carefully - will cancel in-progress deployments on new push.
- Test coverage: Gaps - no tests for concurrent PR updates or runner queue saturation.

**Preserve Environment Cleanup Orchestration:**
- Files: `scripts/preserve-expiry.py`, `scripts/cleanup-orphaned-namespaces.py` (two separate CronJobs, no coordination)
- Why fragile: Race condition if preserve-expiry removes label but cleanup-orphaned-namespaces already checked that namespace. Namespace won't be checked again for 6 hours (default cleanup job interval).
- Safe modification: Add annotation `k8s-ee/cleanup-triggered-at` when preserve is removed. Cleanup job respects this timestamp. Add dedicated quick-cleanup job 5 minutes after preserve removal.
- Test coverage: Gaps - no integration tests for preserve->cleanup lifecycle.

**Network Policy Hardcoded Traefik Selector:**
- Files: `k8s/ephemeral/network-policy-allow-ingress.yaml` (lines 18-23: hardcoded traefik pod selector)
- Why fragile: If ingress controller is upgraded or name changes, NetworkPolicy selector won't match. Ingress fails silently.
- Safe modification: Accept ingress-controller namespace and app labels as parameters to namespace creation action. Validate selector matches at least 1 pod.
- Test coverage: Gaps - no tests for ingress connectivity.

## Scaling Limits

**Single VPS Node Capacity:**
- Current capacity: 4 vCPU, 24GB RAM, 100GB NVMe
- Limit: Approximately 5-8 concurrent PR environments (each with 2-3 pods + database). Platform namespace uses ~2GB.
- Scaling path: Phase 2/3 migration to EKS with auto-scaling node groups. Current setup hits limits at ~15 concurrent PRs (based on resource requests in charts).

**Cleanup Job Sequential Processing:**
- Current capacity: Cleanup runs every 6 hours, processes namespaces serially
- Limit: If 50+ orphaned namespaces exist, cleanup job could exceed timeout or delete stalls (finalizer hangs)
- Scaling path: Implement parallel cleanup with worker queue. Use CronJob with parallelism field (when available in k8s version). Add background finalizer-removal daemon.

**etcd Database Size:**
- Current capacity: k3s uses embedded SQLite, grows unbounded with namespace create/delete cycles
- Limit: After 1000+ PR cycles, etcd database can become 10GB+, slowing API queries
- Scaling path: Phase 2 migration to EKS (managed etcd). Interim: implement namespace snapshot rotation to compact database.

**GitHub API Quota:**
- Current capacity: GITHUB_TOKEN has 5000 requests/hour (user token) or 15000 (app token)
- Limit: With 20+ concurrent PRs, each making ~3 API calls per deployment, quota exhausted in 30 min during peak
- Scaling path: Replace GITHUB_TOKEN with dedicated GitHub App token. Batch API calls. Implement local caching.

## Dependencies at Risk

**CloudNativePG Operator:**
- Risk: PostgreSQL chart depends on cnpg.io Custom Resource Definitions. If operator is uninstalled, PostgreSQL clusters become orphaned.
- Impact: PostgreSQL databases become inaccessible; namespaces can't be destroyed (stuck on operator resources).
- Migration plan: Monitor operator version, pin to tested versions in helm chart. Implement CRD backup/restore. Phase 2: switch to RDS via AWS Controllers for Kubernetes.

**Actions Runner Controller (ARC):**
- Risk: GitHub ARC operator required for in-cluster CI/CD runners. If operator fails, new PRs have no runners.
- Impact: PR environment deployments fail because no runner available. Existing runners continue until they crash.
- Migration plan: Add backup runner pool (e.g., GitHub-hosted runners) for critical deployments. Implement operator pod PodDisruptionBudget and high availability.

**MinIO Operator:**
- Risk: MinIO chart depends on minio-operator. If operator uninstalled or crashes, MinIO tenants become inaccessible.
- Impact: Applications using S3-compatible storage lose access.
- Migration plan: Phase 2: switch to S3 or EFS. Interim: implement operator backup, monitor operator pod health.

## Missing Critical Features

**Backup and Restore:**
- Problem: No database snapshots or environment snapshots. Lost PR environments cannot be recovered.
- Blocks: Debugging production issues using PR environment copy, disaster recovery.
- Priority: Medium - Low risk because environments are ephemeral by design, but high convenience for debugging.

**Cost Attribution and Reporting:**
- Problem: No per-PR or per-organization cost visibility. Cannot answer "which PR costs the most?"
- Blocks: Cost control, budget planning, chargeback models.
- Priority: Low - Phase 2 objective, not critical for Phase 1.

**Automated Scaling and Load Balancing:**
- Problem: Single VPS cannot scale. No multi-node cluster. No runner autoscaling.
- Blocks: Handling 20+ concurrent PRs, high-availability deployments.
- Priority: High - Phase 2/3 objective, blocks scaling to large teams.

## Test Coverage Gaps

**Namespace Initialization Sequence:**
- What's not tested: Order of NetworkPolicy, ResourceQuota, LimitRange application. Does deployment succeed if policies applied after pods created?
- Files: `.github/actions/create-namespace/` (entire action), `k8s/ephemeral/` (all policies)
- Risk: Race conditions during namespace setup could allow pods to violate policies or consume unlimited resources.
- Priority: High - core to environment isolation.

**Database Credential Rotation:**
- What's not tested: Updating database credentials after environment creation. Do existing connections fail? Can new connections use new creds?
- Files: `charts/mariadb/`, `charts/postgresql/`, `charts/mongodb/`
- Risk: Credential management failures could lock applications out of databases.
- Priority: Medium - Low - not currently a feature, but might be needed for troubleshooting.

**Preserve Environment Expiry Workflow:**
- What's not tested: Full lifecycle of preserve label → warning comment → expiry → cleanup. Tests missing for PR comment parsing, GitHub API calls, label removal failures.
- Files: `scripts/preserve-expiry.py`, `.github/workflows/preserve-environment.yml`
- Risk: Preserve feature silently fails, environment deleted unexpectedly despite preserve command.
- Priority: High - affects developer workflow.

**NetworkPolicy Enforcement:**
- What's not tested: Actual traffic blocking between namespaces, egress restrictions, DNS poisoning prevention.
- Files: `k8s/ephemeral/network-policy-*.yaml`
- Risk: NetworkPolicies might not actually block traffic due to CNI plugin misconfiguration or incorrect selectors.
- Priority: Medium - affects security guarantees.

**Cleanup Job Orphaned Resource Handling:**
- What's not tested: Finalizer cleanup, PVC hanging, Helm release cleanup. Does cleanup succeed if custom resources exist?
- Files: `scripts/cleanup-orphaned-namespaces.py` (lines 198-227)
- Risk: Orphaned namespaces accumulate if finalizers aren't removed properly.
- Priority: High - affects cluster stability.

**Concurrent PR Updates (Force Cancellation):**
- What's not tested: Two rapid pushes to same PR. Does first deployment get cancelled? Are resources cleaned up properly?
- Files: `.github/workflows/pr-environment.yml` (concurrency settings)
- Risk: Ghost pods or resources if cancellation doesn't cleanup properly.
- Priority: Medium - happens during rapid development iterations.

---

*Concerns audit: 2026-01-25*
