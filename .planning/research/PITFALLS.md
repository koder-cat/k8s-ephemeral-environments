# Domain Pitfalls: k8s-ephemeral-environments Migration

**Domain:** Kubernetes ephemeral environments platform migration (ARM64 to x86, GHCR to ECR, multi-container, Samba AD)
**Researched:** 2026-01-25
**Timeline constraint:** 4 days

---

## Priority Legend

| Priority | Impact | Timeline Risk |
|----------|--------|---------------|
| P0 - CRITICAL | Blocks deployment entirely | Must address Day 1 |
| P1 - HIGH | Causes major rework | Must address Day 1-2 |
| P2 - MEDIUM | Causes delays | Address Day 2-3 |
| P3 - LOW | Annoyance, fixable | Address Day 3-4 or post-pilot |

---

## Critical Pitfalls (P0)

### Pitfall 1: Image Architecture Mismatch Causing Silent Failures

**What goes wrong:** Pods scheduled to x86 nodes pull ARM64 images (or vice versa) and fail with cryptic "exec format error" at container startup. No warning during pull - failure only at exec time.

**Why it happens:**
- Current Helm charts and deployment templates have no `nodeSelector` or `nodeAffinity` for architecture
- Multi-arch images with manifest lists mask the problem until runtime
- GitHub Actions runners might be building for wrong architecture

**Warning signs:**
- Container status shows `CrashLoopBackOff` immediately after creation
- Container logs show: `standard_init_linux.go:228: exec user process caused: exec format error`
- `kubectl describe pod` shows no pull errors, only runtime failures

**Consequences:**
- Complete deployment failure
- All PR environments broken
- 300+ devs blocked from using the platform

**Prevention strategy (Day 1):**
1. Add explicit `nodeSelector` to ALL deployment templates:
   ```yaml
   nodeSelector:
     kubernetes.io/arch: amd64
   ```
2. Update GitHub Actions workflow to build ONLY `linux/amd64` images:
   ```yaml
   - name: Build and push
     uses: docker/build-push-action@v5
     with:
       platforms: linux/amd64  # NOT linux/arm64
   ```
3. Verify ALL init container images support amd64 (postgres:16-alpine, mongo:7-jammy, redis:7-alpine, mariadb:11, curlimages/curl)

**Quick fix if it happens:**
```bash
# Check image architecture
docker manifest inspect <image>:<tag> | jq '.manifests[].platform'

# Force rebuild for correct architecture
docker buildx build --platform linux/amd64 --push -t <ecr-repo>:latest .
```

**Phase:** Infrastructure Setup (Day 1)

**Confidence:** HIGH - Verified via [Kubernetes documentation](https://kubernetes.io/docs/concepts/workloads/pods/sidecar-containers/) and [GKE migration guide](https://cloud.google.com/kubernetes-engine/docs/tutorials/migrate-x86-to-multi-arch-arm)

---

### Pitfall 2: Samba AD Requires Privileged Container Breaking PodSecurityStandard

**What goes wrong:** Samba AD Domain Controller fails to start or cannot manage ACLs because it requires `CAP_SYS_ADMIN` capability, which conflicts with the project's "restricted" PodSecurityStandard baseline.

**Why it happens:**
- Samba uses `security.NTACL` xattr namespace for Windows ACLs
- Linux requires `CAP_SYS_ADMIN` to write to `security.*` xattr namespace
- Current k3s setup uses restricted PSS which blocks privileged containers

**Warning signs:**
- Samba container logs show: "Unable to set NTACL" or "Permission denied" errors
- Pod fails admission with policy violation
- Windows clients can connect but file permissions don't work correctly

**Consequences:**
- Samba AD completely non-functional
- Cannot test Windows authentication flows
- Major client requirement unmet

**Prevention strategy (Day 1):**
1. Create dedicated namespace for Samba with relaxed PSS:
   ```yaml
   apiVersion: v1
   kind: Namespace
   metadata:
     name: samba-system
     labels:
       pod-security.kubernetes.io/enforce: privileged
       pod-security.kubernetes.io/audit: privileged
       pod-security.kubernetes.io/warn: privileged
   ```
2. Use explicit securityContext in Samba deployment:
   ```yaml
   securityContext:
     capabilities:
       add:
         - SYS_ADMIN
   ```
3. Document the security trade-off in architecture decision record

**Quick fix if it happens:**
```bash
# Temporarily allow privileged pods in namespace
kubectl label namespace samba-system pod-security.kubernetes.io/enforce=privileged --overwrite
```

**Phase:** Samba AD Setup (Day 2)

**Confidence:** HIGH - Verified via [samba-in-kubernetes project](https://github.com/samba-in-kubernetes/samba-container) and [Samba mailing list](https://lists.samba.org/archive/samba-technical/2022-January/137072.html)

---

### Pitfall 3: ECR Authentication Token Expiry Breaking CI/CD

**What goes wrong:** GitHub Actions workflow fails mid-deployment because ECR authentication token (12-hour validity) expired or OIDC trust relationship misconfigured.

**Why it happens:**
- ECR tokens are short-lived (12 hours) unlike GHCR PATs
- OIDC federation requires precise audience/subject claims
- Role trust policy must match exact repository path

**Warning signs:**
- Error: "not authorized to perform: ecr:GetAuthorizationToken"
- Error: "denied: Your authorization token has expired"
- OIDC errors about audience mismatch

**Consequences:**
- All PR environment deployments fail
- No new images can be pushed
- Existing environments continue working but cannot be updated

**Prevention strategy (Day 1):**
1. Use official AWS ECR login action with OIDC:
   ```yaml
   - name: Configure AWS credentials
     uses: aws-actions/configure-aws-credentials@v4
     with:
       role-to-assume: arn:aws:iam::${{ secrets.AWS_ACCOUNT_ID }}:role/github-actions-ecr
       aws-region: us-east-1  # ECR Public requires us-east-1

   - name: Login to ECR
     uses: aws-actions/amazon-ecr-login@v2
   ```
2. Create IAM role with correct trust policy (note the `sts.amazonaws.com` audience):
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Principal": {"Federated": "arn:aws:iam::ACCOUNT:oidc-provider/token.actions.githubusercontent.com"},
       "Action": "sts:AssumeRoleWithWebIdentity",
       "Condition": {
         "StringEquals": {
           "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
         },
         "StringLike": {
           "token.actions.githubusercontent.com:sub": "repo:ORG/REPO:*"
         }
       }
     }]
   }
   ```
3. Test OIDC authentication BEFORE migration:
   ```bash
   # Dry run in workflow
   aws sts get-caller-identity
   ```

**Quick fix if it happens:**
```bash
# Check if role assumption works
aws sts assume-role-with-web-identity \
  --role-arn arn:aws:iam::ACCOUNT:role/github-actions-ecr \
  --role-session-name test \
  --web-identity-token $GITHUB_TOKEN

# If fails, check CloudTrail for denied requests
```

**Phase:** ECR Migration (Day 1)

**Confidence:** HIGH - Verified via [AWS ECR login action](https://github.com/aws-actions/amazon-ecr-login) and [AWS documentation](https://docs.aws.amazon.com/AmazonECR/latest/userguide/docker-push-ecr-image.html)

---

## High-Priority Pitfalls (P1)

### Pitfall 4: Samba AD Static IP Requirement Breaking Kubernetes Networking Model

**What goes wrong:** Samba AD domain controller gets different IP on pod restart, breaking all domain-joined clients and causing DNS pollution with stale records.

**Why it happens:**
- Samba adds DNS A records for itself on every startup
- If IP changes, old records persist alongside new ones
- Windows clients cache DNS and fail to reconnect
- Kubernetes Service ClusterIP is not enough - Samba needs pod IP to be static

**Warning signs:**
- Windows clients show "The trust relationship between this workstation and the primary domain failed"
- `nslookup` for DC returns multiple IP addresses
- Samba logs show repeated DNS registration

**Consequences:**
- Domain joined clients lose access
- Manual DNS cleanup required after every restart
- Cannot safely restart Samba pod

**Prevention strategy (Day 1-2):**
1. Use StatefulSet with stable network identity:
   ```yaml
   apiVersion: apps/v1
   kind: StatefulSet
   metadata:
     name: samba-dc
   spec:
     serviceName: samba-dc
     replicas: 1
     # Pod gets stable DNS: samba-dc-0.samba-dc.namespace.svc.cluster.local
   ```
2. For external client access, consider Multus CNI for static IP (if time permits):
   ```yaml
   # Alternative: Use LoadBalancer with static IP
   apiVersion: v1
   kind: Service
   metadata:
     name: samba-dc-lb
     annotations:
       service.beta.kubernetes.io/aws-load-balancer-type: "nlb"
       service.beta.kubernetes.io/aws-load-balancer-eip-allocations: "eipalloc-xxx"
   ```
3. For pilot (4 days), consider running Samba outside K8s on a dedicated EC2 instance with static IP

**Quick fix if it happens:**
```bash
# Clean up stale DNS records
samba-tool dns delete <dc> <domain> <dc-name> A <old-ip> -Uadministrator

# Force re-registration
samba-tool dns add <dc> <domain> <dc-name> A <correct-ip> -Uadministrator
```

**Phase:** Samba AD Setup (Day 2)

**Confidence:** HIGH - Verified via [opensourcery-uk/samba-ad-dc](https://github.com/opensourcery-uk/samba-ad-dc) and [Helge Klein's guide](https://helgeklein.com/blog/samba-active-directory-in-a-docker-container-installation-guide/)

---

### Pitfall 5: Multi-Container Pod Resource Starvation

**What goes wrong:** Sidecar containers (logging, auth proxy, etc.) consume all allocated CPU/memory, throttling or OOM-killing the main application container.

**Why it happens:**
- Resources are set per-container, but quota is per-pod
- Sidecars often have no limits set
- CPU throttling is silent - app just gets slow
- Memory is non-compressible - OOM kills are abrupt

**Warning signs:**
- Application responds slowly but no errors in logs
- `kubectl top pod` shows sidecar using more than expected
- OOMKilled events in `kubectl describe pod`
- CPU throttling metrics high: `container_cpu_cfs_throttled_periods_total`

**Consequences:**
- Unpredictable application performance
- Difficult to diagnose ("works sometimes")
- Resource quota exceeded errors

**Prevention strategy (Day 2-3):**
1. Set explicit limits on ALL containers including sidecars:
   ```yaml
   containers:
   - name: app
     resources:
       requests:
         cpu: 200m
         memory: 256Mi
       limits:
         cpu: 500m
         memory: 512Mi
   - name: sidecar
     resources:
       requests:
         cpu: 50m
         memory: 64Mi
       limits:
         cpu: 100m
         memory: 128Mi
   ```
2. For Kubernetes 1.33+, consider pod-level resources (if available):
   ```yaml
   # Pod-level resources (K8s 1.33+ beta)
   spec:
     resources:
       limits:
         cpu: "1"
         memory: 1Gi
   ```
3. Set memory limit = request (avoid OOM thrashing):
   ```yaml
   resources:
     requests:
       memory: 256Mi
     limits:
       memory: 256Mi  # Same as request
   ```

**Quick fix if it happens:**
```bash
# Identify resource hog
kubectl top pod <pod> --containers

# Patch limits
kubectl patch deployment <name> --type=json -p='[{"op":"replace","path":"/spec/template/spec/containers/1/resources/limits/memory","value":"64Mi"}]'
```

**Phase:** Multi-Container Migration (Day 2-3)

**Confidence:** HIGH - Verified via [Kubernetes documentation](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/) and [Kubernetes blog on pod-level resources](https://kubernetes.io/blog/2025/09/22/kubernetes-v1-34-pod-level-resources/)

---

### Pitfall 6: Helm Chart nodeSelector/nodeAffinity Inconsistency

**What goes wrong:** Main application container scheduled on x86, but dependent database/service containers scheduled on ARM64 nodes (or no nodes at all).

**Why it happens:**
- Helm charts often pass nodeSelector only to main deployment
- Subcharts (PostgreSQL, MongoDB) have their own templates without nodeSelector
- Global values not propagated to all templates

**Warning signs:**
- Some pods in Running state, others in Pending
- `kubectl describe pod` shows "no nodes available to schedule"
- Database pods on wrong architecture, app can't connect

**Consequences:**
- Partial deployment - app can't reach database
- Debugging nightmare ("it worked on my cluster")

**Prevention strategy (Day 1-2):**
1. Audit ALL chart templates for nodeSelector handling:
   ```bash
   # Find templates missing nodeSelector
   grep -rL "nodeSelector" charts/*/templates/*.yaml
   ```
2. Add global nodeSelector to values.yaml and propagate:
   ```yaml
   # values.yaml
   global:
     nodeSelector:
       kubernetes.io/arch: amd64

   # In templates:
   nodeSelector:
     {{- toYaml .Values.global.nodeSelector | nindent 8 }}
   ```
3. Verify subchart support for nodeSelector before using:
   ```bash
   helm show values bitnami/postgresql | grep -A5 nodeSelector
   ```

**Quick fix if it happens:**
```bash
# Force all pods to x86 nodes via taint
kubectl taint nodes <arm64-node> arch=arm64:NoSchedule

# Untaint x86 nodes
kubectl taint nodes <x86-node> arch-
```

**Phase:** Helm Chart Migration (Day 1-2)

**Confidence:** HIGH - Verified via multiple GitHub issues including [seaweedfs/seaweedfs#7215](https://github.com/seaweedfs/seaweedfs/issues/7215) and [kubernetes/dashboard#3137](https://github.com/kubernetes/dashboard/issues/3137)

---

## Medium-Priority Pitfalls (P2)

### Pitfall 7: QEMU Emulation Slowing CI/CD Builds to Unusable Levels

**What goes wrong:** Building x86 images on ARM64 GitHub runners (or vice versa) via QEMU emulation takes 10-30x longer, causing deployment timeouts.

**Why it happens:**
- Docker buildx defaults to QEMU for cross-platform builds
- QEMU translates CPU instructions at runtime
- Compilation, compression operations are CPU-intensive

**Warning signs:**
- Build step takes >15 minutes (normally 2-3 minutes)
- Runner timeout errors
- High CPU usage during build

**Consequences:**
- Deployment SLA (10 minutes) impossible to meet
- Developer frustration
- CI/CD queue backup

**Prevention strategy (Day 1):**
1. Use native architecture runners ONLY:
   ```yaml
   jobs:
     build:
       runs-on: ubuntu-latest  # x86 hosted runner
       # NOT self-hosted ARM64 runner
   ```
2. If using self-hosted runners, ensure they're x86:
   ```yaml
   runs-on: [self-hosted, linux, X64]
   ```
3. Never use `--platform linux/amd64` on ARM64 builder and vice versa

**Quick fix if it happens:**
```bash
# Check runner architecture
uname -m  # Should show x86_64 for amd64

# If on wrong arch, use remote builder
docker buildx create --name remote-builder --driver remote tcp://<x86-host>:2375
```

**Phase:** CI/CD Migration (Day 1)

**Confidence:** HIGH - Verified via [Docker buildx documentation](https://docs.docker.com/build/building/multi-platform/) and [Blacksmith blog](https://www.blacksmith.sh/blog/building-multi-platform-docker-images-for-arm64-in-github-actions)

---

### Pitfall 8: ECR v2 mask-password Breaking Multi-Job Workflows

**What goes wrong:** Upgraded to aws-actions/amazon-ecr-login@v2, and now image push works but downstream jobs can't pull the image.

**Why it happens:**
- v2 defaults `mask-password: true` (v1 was false)
- Masked values cannot be passed between jobs
- Docker credentials become unavailable in subsequent steps/jobs

**Warning signs:**
- Build job succeeds, deploy job fails
- "unauthorized: authentication required" in deploy step
- Works when all steps in single job

**Consequences:**
- Reusable workflow architecture breaks
- Must refactor CI/CD

**Prevention strategy (Day 1):**
1. Explicitly set mask-password when credentials needed across jobs:
   ```yaml
   - name: Login to ECR
     uses: aws-actions/amazon-ecr-login@v2
     with:
       mask-password: 'false'  # Only if passing to other jobs
   ```
2. Or restructure workflow to keep pull in same job as login
3. For reusable workflows, re-authenticate in each job

**Quick fix if it happens:**
```yaml
# Add explicit login step to deploy job
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: ${{ secrets.ECR_ROLE_ARN }}
    aws-region: us-east-1
- name: Login to ECR
  uses: aws-actions/amazon-ecr-login@v2
```

**Phase:** ECR Migration (Day 1)

**Confidence:** HIGH - Verified via [amazon-ecr-login action readme](https://github.com/aws-actions/amazon-ecr-login)

---

### Pitfall 9: Samba Container DNS Not Integrated with Kubernetes CoreDNS

**What goes wrong:** Pods in cluster cannot resolve Samba domain names; Windows clients outside cluster cannot resolve Kubernetes services.

**Why it happens:**
- Samba runs its own internal DNS for AD
- Kubernetes uses CoreDNS
- Neither knows about the other without explicit configuration

**Warning signs:**
- `nslookup domain.local` fails from app pods
- Windows clients can reach Samba by IP but not by name
- "DNS name does not exist" errors

**Consequences:**
- Domain authentication fails
- Kerberos ticket requests fail (require DNS)

**Prevention strategy (Day 2):**
1. Configure CoreDNS to forward AD domain queries to Samba:
   ```yaml
   # CoreDNS ConfigMap
   data:
     Corefile: |
       .:53 {
         # ... existing config ...
       }
       samdom.example.com:53 {
         errors
         cache 30
         forward . <samba-service-ip>
       }
   ```
2. Configure Samba to forward non-AD queries to CoreDNS:
   ```
   # smb.conf
   dns forwarder = <coredns-service-ip>
   ```

**Quick fix if it happens:**
```bash
# Test DNS resolution
kubectl run -it --rm dns-test --image=busybox -- nslookup dc.samdom.example.com

# Add manual entry if needed
kubectl edit configmap coredns -n kube-system
```

**Phase:** Samba AD Setup (Day 2)

**Confidence:** MEDIUM - Based on [opensourcery-uk/samba-ad-dc](https://github.com/opensourcery-uk/samba-ad-dc) documentation

---

### Pitfall 10: Init Container Images Not Available for Target Architecture

**What goes wrong:** Main app image is x86, but init containers (wait-for-postgres, etc.) pull ARM64 versions and fail.

**Why it happens:**
- Current deployment.yaml uses generic image tags like `postgres:16-alpine`
- These are multi-arch but may not have x86 variant
- Or manifest list resolves to wrong architecture on pull

**Warning signs:**
- Init containers fail with "exec format error"
- `kubectl describe pod` shows init container CrashLoopBackOff
- Main container never starts (blocked by init)

**Consequences:**
- No pods ever reach Running state
- All deployments fail

**Prevention strategy (Day 1-2):**
1. Verify ALL init container images support amd64:
   ```bash
   for img in postgres:16-alpine mongo:7-jammy redis:7-alpine mariadb:11 curlimages/curl:8.5.0; do
     docker manifest inspect $img | jq '.manifests[] | select(.platform.architecture=="amd64")'
   done
   ```
2. Pin to specific digests that are verified amd64:
   ```yaml
   image: postgres:16-alpine@sha256:abc123...  # Verified amd64 digest
   ```
3. Add nodeSelector to init containers (they inherit from pod spec)

**Quick fix if it happens:**
```bash
# Find amd64 specific digest
docker manifest inspect postgres:16-alpine | jq '.manifests[] | select(.platform.architecture=="amd64") | .digest'

# Update deployment with specific digest
```

**Phase:** Helm Chart Migration (Day 1-2)

**Confidence:** HIGH - Verified via [multi-arch image documentation](https://www.docker.com/blog/multi-arch-images/)

---

## Low-Priority Pitfalls (P3)

### Pitfall 11: ECR Repository Not Pre-Created Causing Push Failures

**What goes wrong:** First image push to ECR fails because repository doesn't exist (unlike GHCR which auto-creates).

**Why it happens:**
- ECR requires explicit repository creation
- GHCR auto-creates repositories on push
- Teams familiar with GHCR assume same behavior

**Warning signs:**
- "repository does not exist" error on first push
- Works after manual creation

**Consequences:**
- Minor delay on first deployment
- Easy to fix once identified

**Prevention strategy (Day 1):**
1. Pre-create ECR repositories via Terraform:
   ```hcl
   resource "aws_ecr_repository" "app" {
     name                 = "k8s-ee/demo-app"
     image_tag_mutability = "MUTABLE"
     image_scanning_configuration {
       scan_on_push = true
     }
   }
   ```
2. Or create in workflow before push:
   ```yaml
   - name: Create ECR repository if not exists
     run: |
       aws ecr describe-repositories --repository-names $REPO_NAME 2>/dev/null || \
       aws ecr create-repository --repository-name $REPO_NAME
   ```

**Quick fix if it happens:**
```bash
aws ecr create-repository --repository-name k8s-ee/demo-app
```

**Phase:** ECR Migration (Day 1)

**Confidence:** HIGH - Verified via [AWS ECR documentation](https://docs.aws.amazon.com/AmazonECR/latest/userguide/docker-push-ecr-image.html)

---

### Pitfall 12: Sidecar Container Delaying Pod Shutdown

**What goes wrong:** Pod termination takes much longer than expected because sidecar container doesn't respond to SIGTERM.

**Why it happens:**
- Sidecars terminate only when pod terminates
- If sidecar ignores SIGTERM, it waits for terminationGracePeriod
- Kubernetes 1.33+ native sidecars handle this better, but adoption may lag

**Warning signs:**
- `kubectl delete pod` hangs
- Namespace deletion blocked by terminating pods
- terminationGracePeriod timeout reached

**Consequences:**
- Slow deployments (old pods won't die)
- Namespace cleanup jobs timeout

**Prevention strategy (Day 2-3):**
1. Ensure sidecars handle SIGTERM properly
2. Set reasonable terminationGracePeriod:
   ```yaml
   spec:
     terminationGracePeriodSeconds: 30
   ```
3. For Kubernetes 1.33+, use native sidecars:
   ```yaml
   initContainers:
   - name: sidecar
     restartPolicy: Always  # Makes it a native sidecar
   ```

**Quick fix if it happens:**
```bash
# Force delete stuck pod
kubectl delete pod <name> --grace-period=0 --force
```

**Phase:** Multi-Container Migration (Day 3-4)

**Confidence:** MEDIUM - Based on [Kubernetes sidecar documentation](https://kubernetes.io/docs/concepts/workloads/pods/sidecar-containers/)

---

### Pitfall 13: ECR Image Tag Overwrite Causing Production Issues

**What goes wrong:** Mutable tags allow overwriting `latest` or version tags, leading to confusion about what's actually deployed.

**Why it happens:**
- ECR defaults to mutable tags
- Teams push same tag with different content
- No audit trail of what changed

**Warning signs:**
- "I didn't change anything but it's different"
- Image digest doesn't match expected
- Rollback doesn't restore expected behavior

**Consequences:**
- Confusion during debugging
- Potential security issues (tag hijacking)

**Prevention strategy (Day 3-4):**
1. Enable tag immutability for production repositories:
   ```bash
   aws ecr put-image-tag-mutability \
     --repository-name k8s-ee/demo-app \
     --image-tag-mutability IMMUTABLE
   ```
2. Use SHA-based tags for deployments:
   ```yaml
   image: $ECR_REPO:sha-${{ github.sha }}
   ```

**Quick fix if it happens:**
```bash
# Check what's actually in the tag
aws ecr describe-images --repository-name k8s-ee/demo-app --image-ids imageTag=latest
```

**Phase:** Post-pilot hardening

**Confidence:** MEDIUM - Based on [ECR best practices blog](https://medium.com/@gupta.shraman/from-code-to-container-end-to-end-image-management-with-aws-ecr-part-1-infrastructure-8926cd8373c2)

---

## Phase-Specific Warnings Summary

| Phase | Day | Pitfalls to Address | Time Budget |
|-------|-----|---------------------|-------------|
| Infrastructure Setup | 1 | P0-1 (Image Arch), P0-3 (ECR Auth), P2-7 (QEMU), P1-6 (Helm nodeSelector) | 4-6 hours |
| ECR Migration | 1 | P0-3 (ECR Auth), P2-8 (mask-password), P3-11 (Repo creation) | 2-3 hours |
| Helm Chart Migration | 1-2 | P0-1 (Image Arch), P1-6 (nodeSelector), P2-10 (Init containers) | 4-6 hours |
| Samba AD Setup | 2 | P0-2 (Privileged), P1-4 (Static IP), P2-9 (DNS) | 6-8 hours |
| Multi-Container Migration | 2-3 | P1-5 (Resource starvation), P3-12 (Sidecar shutdown) | 3-4 hours |
| Post-Pilot Hardening | 4+ | P3-13 (Tag immutability) | 1-2 hours |

---

## Pre-Flight Checklist

Before starting migration, verify:

- [ ] AWS account with OIDC identity provider configured for GitHub Actions
- [ ] ECR repositories created (or IAM permissions to create)
- [ ] IAM role with ecr:* permissions and correct trust policy
- [ ] x86 runners available (GitHub hosted or self-hosted)
- [ ] All base images verified for amd64 support
- [ ] Samba namespace PSS exception documented and approved
- [ ] DNS integration plan for Samba <-> CoreDNS

---

## Sources

**Architecture Migration:**
- [GKE x86 to multi-arch migration guide](https://cloud.google.com/kubernetes-engine/docs/tutorials/migrate-x86-to-multi-arch-arm)
- [Multi-arch Kubernetes clusters guide](https://cablespaghetti.dev/2021/02/20/managing-multi-arch-kubernetes-clusters/)
- [Kubernetes taints and tolerations](https://blog.differentpla.net/blog/2025/04/30/k8s-taints-tolerations/)

**ECR/GHCR Migration:**
- [AWS ECR login GitHub Action](https://github.com/aws-actions/amazon-ecr-login)
- [GitHub OIDC with AWS guide](https://medium.com/@eelzinaty/how-to-securly-access-aws-ecr-from-github-actions-using-github-oidc-964975d0e3ad)
- [ghcr2ecr tool](https://github.com/skwashd/ghcr2ecr)

**Multi-Container Pods:**
- [Kubernetes sidecar containers](https://kubernetes.io/docs/concepts/workloads/pods/sidecar-containers/)
- [Kubernetes pod-level resources](https://kubernetes.io/blog/2025/09/22/kubernetes-v1-34-pod-level-resources/)
- [Multi-container pods overview](https://kubernetes.io/blog/2025/04/22/multi-container-pods-overview/)

**Samba AD:**
- [samba-in-kubernetes/samba-container](https://github.com/samba-in-kubernetes/samba-container)
- [opensourcery-uk/samba-ad-dc](https://github.com/opensourcery-uk/samba-ad-dc)
- [Samba AD in Docker installation guide](https://helgeklein.com/blog/samba-active-directory-in-a-docker-container-installation-guide/)
- [Samba mailing list status update](https://lists.samba.org/archive/samba-technical/2022-January/137072.html)

**Docker Build:**
- [Docker multi-platform builds](https://docs.docker.com/build/building/multi-platform/)
- [Building multi-arch images for ARM64](https://www.blacksmith.sh/blog/building-multi-platform-docker-images-for-arm64-in-github-actions)

---

*Research completed: 2026-01-25*
*Confidence: HIGH for critical pitfalls, MEDIUM for Samba-specific edge cases*
