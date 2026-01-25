# Technology Stack

**Project:** k8s-ephemeral-environments x86 + ECR + Samba AD extension
**Researched:** 2026-01-25
**Overall Confidence:** MEDIUM

---

## Executive Summary

This research covers the technology stack for extending the k8s-ephemeral-environments platform with:
1. x86 support alongside existing ARM64
2. AWS ECR integration via OIDC (replacing/augmenting GHCR)
3. Samba Active Directory chart for LDAP authentication per PR environment
4. Multi-container pod support (frontend + backend + AD)

The findings reveal that while ECR OIDC and multi-arch builds have mature, well-documented solutions, Samba AD in Kubernetes remains challenging with no production-grade Helm chart available. A custom chart will likely be required.

---

## Recommended Stack

### 1. Multi-Architecture Docker Builds

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| docker/setup-qemu-action | v3.2.0 | QEMU emulation for cross-platform builds | HIGH |
| docker/setup-buildx-action | v3.12.0 | BuildKit with multi-platform support | HIGH |
| docker/build-push-action | v6.18.0 | Build and push multi-arch images | HIGH |
| Native ARM64 runner | ubuntu-24.04-arm | Avoid QEMU for ARM64 builds (10x faster) | HIGH |

**Recommendation:** Use a **matrix strategy with native runners** for both architectures.

```yaml
jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: linux/amd64
            runner: ubuntu-latest
          - platform: linux/arm64
            runner: ubuntu-24.04-arm
    runs-on: ${{ matrix.runner }}
```

**Why this approach:**
- QEMU emulation is 10x slower than native builds (verified benchmarks: 10m20s vs 2m45s)
- GitHub now offers free native ARM64 runners (`ubuntu-24.04-arm`) for public repos
- Eliminates emulation overhead and potential compatibility issues
- Build jobs run in parallel, reducing total pipeline time

**Alternative considered:** Single-runner QEMU emulation
- Simpler workflow configuration
- **Why not:** Unacceptable 10x performance penalty for ARM64 builds

**Sources:**
- [Docker Multi-Platform Builds](https://docs.docker.com/build/building/multi-platform/) - HIGH confidence
- [GitHub Actions Linux ARM64 Runners](https://www.infoq.com/news/2025/02/github-actions-linux-arm64/) - HIGH confidence
- [Docker Multi-Platform GitHub Actions](https://docs.docker.com/build/ci/github-actions/multi-platform/) - HIGH confidence

---

### 2. GitHub Actions OIDC to AWS ECR

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| aws-actions/configure-aws-credentials | v5.1.1 | OIDC authentication with AWS | HIGH |
| aws-actions/amazon-ecr-login | v2.0.1 | ECR registry login | HIGH |
| IAM OIDC Identity Provider | N/A | Trust GitHub's OIDC provider | HIGH |

**IAM Configuration Required:**

1. **Create OIDC Identity Provider in AWS IAM:**
   - Provider URL: `https://token.actions.githubusercontent.com`
   - Audience: `sts.amazonaws.com`

2. **Create IAM Role with Trust Policy:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:ORG/REPO:*"
        }
      }
    }
  ]
}
```

3. **IAM Policy for ECR:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:DescribeRepositories",
        "ecr:CreateRepository"
      ],
      "Resource": "arn:aws:ecr:REGION:ACCOUNT_ID:repository/*"
    }
  ]
}
```

**Workflow Integration:**

```yaml
permissions:
  id-token: write  # Required for OIDC token request
  contents: read

steps:
  - name: Configure AWS credentials
    uses: aws-actions/configure-aws-credentials@v5.1.1
    with:
      role-to-assume: arn:aws:iam::ACCOUNT_ID:role/github-actions-ecr
      aws-region: us-east-1

  - name: Login to Amazon ECR
    id: login-ecr
    uses: aws-actions/amazon-ecr-login@v2.0.1

  - name: Build and push
    uses: docker/build-push-action@v6.18.0
    with:
      push: true
      tags: ${{ steps.login-ecr.outputs.registry }}/myapp:${{ github.sha }}
```

**Security Best Practices:**
- Use `StringLike` with specific repo patterns in trust policy
- Add environment protection rules for production deployments
- Scope IAM permissions to specific ECR repositories
- Monitor role assumption via CloudTrail

**Alternative considered:** Long-lived IAM access keys stored as GitHub secrets
- **Why not:** Security risk - OIDC provides short-lived credentials with no stored secrets

**Sources:**
- [GitHub OIDC in AWS](https://docs.github.com/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services) - HIGH confidence
- [aws-actions/configure-aws-credentials](https://github.com/aws-actions/configure-aws-credentials) - HIGH confidence
- [aws-actions/amazon-ecr-login](https://github.com/aws-actions/amazon-ecr-login) - HIGH confidence

---

### 3. Samba Active Directory for Kubernetes

| Technology | Image | Version | Architecture | Confidence |
|------------|-------|---------|--------------|------------|
| **Recommended:** Custom chart with nowsci/samba-domain | nowsci/samba-domain | v05 (May 2023) | amd64 only | MEDIUM |
| Alternative: samba-in-kubernetes/samba-ad-server | quay.io/samba.org/samba-ad-server | latest | Unknown | LOW |
| Alternative: instantlinux/samba-dc | instantlinux/samba-dc | latest | Multi-arch | LOW |

**Critical Finding:** No production-grade Helm chart exists for Samba AD DC in Kubernetes.

**Available Options Analysis:**

#### Option 1: nowsci/samba-domain (RECOMMENDED for x86)

**Pros:**
- Well-documented and actively maintained
- Works with standard Windows management tools
- Internal DNS and Kerberos built-in
- Has both `Dockerfile` and `arm.Dockerfile` in source

**Cons:**
- Pre-built images are **amd64 only** on Docker Hub
- ARM64 requires local build from source
- Last release: May 2023 (v05)
- No Helm chart provided

**Required Work:**
- Create custom Helm chart
- Build multi-arch image for ARM64 support
- Handle static IP requirements (see pitfalls)

#### Option 2: samba-in-kubernetes/samba-ad-server

**Pros:**
- Official Samba project container
- Designed for Kubernetes
- Used by samba-operator project

**Cons:**
- Requires privileged execution
- Architecture support unclear from docs
- Primarily for testing/debugging

#### Option 3: Custom Build

**Recommendation:** Build a custom Helm chart using `nowsci/samba-domain` as the base image.

**Helm Chart Structure:**

```
charts/samba-ad/
  Chart.yaml
  values.yaml
  templates/
    statefulset.yaml    # StatefulSet (not Deployment - needs stable identity)
    service.yaml        # ClusterIP for DNS (10.96.53.53 or similar)
    configmap.yaml      # Samba configuration
    secret.yaml         # Admin password, join credentials
    pvc.yaml            # Persistent storage for /var/lib/samba
```

**Key Configuration Environment Variables:**

| Variable | Description | Example |
|----------|-------------|---------|
| `DOMAIN` | Short domain name | `MYDOM` |
| `REALM` | Full realm name | `MYDOM.LOCAL` |
| `ADMIN_PASS` | Administrator password | (from Secret) |
| `DNS_FORWARDER` | External DNS server | `8.8.8.8` |
| `BIND_NETWORK_INTERFACES` | Network binding | `false` for Windows clients |

**Required Volumes:**

```yaml
volumes:
  - name: samba-config
    persistentVolumeClaim:
      claimName: samba-config-pvc
  - name: samba-data
    persistentVolumeClaim:
      claimName: samba-data-pvc
volumeMounts:
  - name: samba-config
    mountPath: /etc/samba
  - name: samba-data
    mountPath: /var/lib/samba
```

**Kubernetes Networking Challenges:**

Samba AD DC has specific networking requirements that make Kubernetes deployment complex:

1. **Static IP Requirement:** Samba updates DNS entries on startup. IP changes cause DNS resolution failures.
   - Solution: Use a dedicated ClusterIP Service with a stable IP

2. **DNS Integration:** Applications must use Samba's internal DNS for domain resolution.
   - Solution: Configure pods to use Samba service IP as DNS server

3. **Ephemeral Suitability:** For PR environments, these challenges are manageable because:
   - Each PR gets its own AD domain (no persistence across PRs)
   - Domain is only used within the namespace
   - Short-lived environments don't need complex AD features

**Sources:**
- [Fmstrat/samba-domain](https://github.com/Fmstrat/samba-domain) - MEDIUM confidence
- [samba-in-kubernetes/samba-container](https://github.com/samba-in-kubernetes/samba-container) - LOW confidence
- [opensourcery-uk/samba-ad-dc](https://github.com/opensourcery-uk/samba-ad-dc) - LOW confidence (baremetal focus)

---

### 4. Multi-Container Pod Support

The existing k8s-ee platform already supports multiple containers per environment through separate deployments. For true sidecar patterns or init containers:

| Pattern | Use Case | Implementation |
|---------|----------|----------------|
| Separate Deployments | Frontend + Backend + AD | Current approach - works well |
| Sidecar Containers | Logging, proxies | Add to main Deployment spec |
| Init Containers | DB migrations, config | Add to Deployment spec |

**k8s-ee.yaml Schema Extension:**

```yaml
# Proposed extension for multi-container support
app:
  port: 3000
  healthPath: /api/health

  # New: additional containers in the same pod
  sidecars:
    - name: nginx-proxy
      image: nginx:1.25
      port: 80

  # New: init containers
  initContainers:
    - name: migrations
      image: ${APP_IMAGE}  # Same image as main app
      command: ["npm", "run", "migrate"]
```

**Current Architecture:**
- Main app: Single Deployment
- Databases: Separate StatefulSets (PostgreSQL, MongoDB, etc.)
- Proposed Samba AD: Separate StatefulSet

**Recommendation:** Keep Samba AD as a separate StatefulSet, not a sidecar, because:
- AD requires stable DNS identity
- AD may need different resource limits
- AD lifecycle is independent of app restarts

---

## Registry Strategy: GHCR vs ECR

| Registry | Use Case | Authentication | Multi-Arch |
|----------|----------|----------------|------------|
| GHCR | Public repos, ARM64 VPS | GITHUB_TOKEN | Yes |
| ECR | AWS deployments, x86 EC2 | OIDC | Yes |

**Dual-Registry Approach:**

For maximum flexibility, push to both registries:

```yaml
steps:
  - name: Login to GHCR
    uses: docker/login-action@v3.3.0
    with:
      registry: ghcr.io
      username: ${{ github.actor }}
      password: ${{ secrets.GITHUB_TOKEN }}

  - name: Login to ECR
    uses: aws-actions/amazon-ecr-login@v2.0.1

  - name: Build and push to both
    uses: docker/build-push-action@v6.18.0
    with:
      platforms: linux/amd64,linux/arm64
      push: true
      tags: |
        ghcr.io/${{ github.repository }}:${{ github.sha }}
        ${{ steps.login-ecr.outputs.registry }}/myapp:${{ github.sha }}
```

---

## Summary: Recommended Stack

| Component | Technology | Version | Notes |
|-----------|------------|---------|-------|
| Multi-arch builds | docker/build-push-action | v6.18.0 | With matrix strategy |
| ARM64 builds | ubuntu-24.04-arm runner | N/A | Native, not emulated |
| QEMU (fallback) | docker/setup-qemu-action | v3.2.0 | Only if native unavailable |
| AWS auth | aws-actions/configure-aws-credentials | v5.1.1 | OIDC, no stored secrets |
| ECR login | aws-actions/amazon-ecr-login | v2.0.1 | Works with OIDC |
| Samba AD base | nowsci/samba-domain | v05 | Requires custom chart |
| Samba AD image | Custom multi-arch | TBD | Build from Fmstrat/samba-domain |

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Multi-arch builds | HIGH | Official Docker documentation, verified patterns |
| OIDC to ECR | HIGH | Official AWS documentation, mature tooling |
| Samba AD | MEDIUM | No production Helm chart, requires custom development |
| Multi-container | HIGH | Standard Kubernetes patterns |

---

## Action Items for Implementation

1. **Phase 1: Multi-arch builds**
   - Update `build-image` action to support matrix strategy
   - Add `platforms` input with default `linux/arm64,linux/amd64`
   - Test with native ARM64 runners

2. **Phase 2: ECR integration**
   - Create IAM OIDC provider in AWS
   - Create IAM role with ECR permissions
   - Add `registry` input to reusable workflow
   - Support both GHCR and ECR

3. **Phase 3: Samba AD chart**
   - Create `charts/samba-ad/` Helm chart
   - Build multi-arch image from Fmstrat/samba-domain
   - Test LDAP authentication from app container
   - Document DNS configuration requirements

4. **Phase 4: k8s-ee.yaml schema update**
   - Add `samba` configuration section
   - Add `sidecars` and `initContainers` support
   - Update JSON schema and validation

---

## Sources

### Multi-Architecture Builds
- [Docker Multi-Platform Builds](https://docs.docker.com/build/building/multi-platform/) - HIGH
- [Docker Multi-Platform GitHub Actions](https://docs.docker.com/build/ci/github-actions/multi-platform/) - HIGH
- [GitHub ARM64 Runners Announcement](https://www.infoq.com/news/2025/02/github-actions-linux-arm64/) - HIGH
- [Blacksmith ARM64 Builds](https://www.blacksmith.sh/blog/building-multi-platform-docker-images-for-arm64-in-github-actions) - MEDIUM

### AWS ECR OIDC
- [GitHub OIDC in AWS](https://docs.github.com/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services) - HIGH
- [aws-actions/configure-aws-credentials](https://github.com/aws-actions/configure-aws-credentials) - HIGH
- [aws-actions/amazon-ecr-login](https://github.com/aws-actions/amazon-ecr-login) - HIGH
- [AWS Blog: IAM Roles for GitHub Actions](https://aws.amazon.com/blogs/security/use-iam-roles-to-connect-github-actions-to-actions-in-aws/) - HIGH

### Samba AD
- [Fmstrat/samba-domain](https://github.com/Fmstrat/samba-domain) - MEDIUM
- [nowsci/samba-domain Docker Hub](https://hub.docker.com/r/nowsci/samba-domain/) - MEDIUM
- [samba-in-kubernetes/samba-container](https://github.com/samba-in-kubernetes/samba-container) - LOW
- [opensourcery-uk/samba-ad-dc](https://github.com/opensourcery-uk/samba-ad-dc) - LOW
- [Samba AD Docker Installation Guide](https://helgeklein.com/blog/samba-active-directory-in-a-docker-container-installation-guide/) - MEDIUM
