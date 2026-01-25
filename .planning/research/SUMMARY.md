# Project Research Summary

**Project:** k8s-ephemeral-environments Platform Extension
**Domain:** Kubernetes ephemeral environments with x86 migration, ECR integration, multi-container support, and Samba AD
**Researched:** 2026-01-25
**Confidence:** MEDIUM-HIGH

## Executive Summary

This research covers extending the k8s-ephemeral-environments platform to support four major capabilities: x86/amd64 architecture alongside the current ARM64, AWS ECR registry integration via OIDC (replacing/augmenting GHCR), multi-container pod support for complex applications, and Samba Active Directory integration for Windows authentication testing.

The platform's existing modular architecture provides clear extension points through the build-image action (for registry abstraction), k8s-ee-app Helm chart (for pod specifications), and configuration schema (for new features). The recommended approach leverages native runners for multi-arch builds (10x faster than QEMU emulation), OIDC for secure ECR authentication, and a custom Helm chart for Samba AD since no production-grade solution exists.

Critical risks center on architecture mismatches causing silent failures, Samba AD requiring privileged containers, and ECR authentication complexity. These are mitigated by explicit nodeSelector enforcement, namespace-level security policy exceptions, and comprehensive OIDC setup with proper IAM trust policies. Timeline constraint of 4 days requires ruthless prioritization: infrastructure and ECR migration on Day 1, Samba AD on Day 2, multi-container support on Day 3-4.

## Key Findings

### Recommended Stack

The platform extension builds on well-established technologies with mature tooling, except for Samba AD which requires custom development. Multi-arch builds, OIDC authentication, and multi-container patterns are production-proven with official support.

**Core technologies:**
- **docker/build-push-action v6.18.0** + **native ARM64 runners**: Multi-arch builds without QEMU penalty (10x performance improvement)
- **aws-actions/configure-aws-credentials v5.1.1**: OIDC authentication to AWS, eliminating long-lived credentials
- **aws-actions/amazon-ecr-login v2.0.1**: ECR registry authentication with short-lived tokens
- **nowsci/samba-domain v05**: Base image for Samba AD (requires custom multi-arch build and Helm chart)
- **Kubernetes native sidecar support (v1.29+)**: Proper lifecycle management for multi-container pods

**Critical stack decision:**
Use **matrix strategy with native runners** for both x86 and ARM64 builds instead of QEMU emulation. GitHub now offers free native ARM64 runners (ubuntu-24.04-arm) for public repos, and emulation benchmarks show 10x slowdown (10m20s vs 2m45s).

**Samba AD caveat:**
No production-grade Helm chart exists. Available options (nowsci/samba-domain, instantlinux/samba-dc) require custom chart development. Pre-built images are amd64 only; ARM64 support requires building from source.

### Expected Features

Multi-container support follows established Kubernetes patterns with mature implementations in production Helm charts (Airflow, Vault). Configuration schema extension must maintain backward compatibility while enabling new use cases.

**Must have (table stakes):**
- Multiple main containers in same pod with shared network namespace
- Per-container image/port/resource specifications
- Shared volumes (emptyDir) for inter-container communication
- localhost communication between containers (automatic via shared network)
- Backward compatibility with existing single-container configurations
- Per-container health checks and environment variables

**Should have (competitive):**
- Native sidecar containers (Kubernetes 1.29+ with restartPolicy: Always)
- Automatic ingress routing (path-based routing to different containers)
- Init containers for dependency waiting and migrations
- Resource quota calculation across all containers

**Defer (v2+):**
- Build matrix support (multiple Dockerfiles from k8s-ee.yaml) — requires GitHub Actions changes
- Per-container metrics endpoints (ServiceMonitor complexity)
- Automatic service mesh injection (over-engineering for ephemeral environments)
- Container-level replica scaling (not possible; containers scale together in pod)

### Architecture Approach

The platform's modular design with clear component boundaries allows surgical extensions without architectural rework. Each capability maps to specific integration points with minimal cross-cutting concerns.

**Major components:**

1. **build-image action (.github/actions/build-image/action.yml)** — Container registry abstraction point
   - Current: GHCR with GITHUB_TOKEN
   - Extension: Conditional ECR authentication via OIDC, multi-platform support via platforms input
   - Changes: Add registry-type conditional, AWS authentication steps

2. **k8s-ee-app Helm chart (charts/k8s-ee-app)** — Pod specification and deployment management
   - Current: Single container deployment with database subcharts
   - Extension: containers.sidecars array in values.yaml, loop in deployment.yaml template
   - Pattern: Follows existing multi-container approach (init containers already used for wait-for-database)

3. **Samba AD subchart (new: charts/samba-ad)** — Windows authentication service
   - Pattern: Mirrors existing database subcharts (postgresql, mariadb, mongodb, redis)
   - Structure: StatefulSet (needs stable identity), Service (LDAP/Kerberos ports), Secret (credentials), ConfigMap (smb.conf)
   - Special requirements: Privileged container, static IP, DNS integration with CoreDNS

4. **Configuration schema (.github/actions/validate-config/schema.json)** — Feature flags and validation
   - Extensions: image.registry object, image.platforms, containers.sidecars[], databases.samba-ad
   - Validation flow: schema.json → validate-config outputs → consumed by create-namespace, build-image, deploy-app

**Data flow extension:**
```
k8s-ee.yaml (extended with new fields)
    ↓
validate-config (extract: registry config, platforms, sidecars, samba-ad)
    ↓
    ├─→ create-namespace (add samba-ad quota contribution)
    ├─→ build-image (conditional ECR auth, platform selection)
    └─→ deploy-app (pass sidecar config, samba-ad config to Helm)
```

### Critical Pitfalls

These pitfalls have been prioritized based on timeline risk and impact. All P0/P1 pitfalls must be addressed during Days 1-2 to avoid project failure.

1. **Image architecture mismatch causing silent failures (P0)** — Pods pull wrong architecture images and fail with "exec format error" at runtime. Prevention: Add explicit `nodeSelector: kubernetes.io/arch: amd64` to ALL templates, verify all init container images support amd64, build only linux/amd64 platform.

2. **Samba AD requires privileged container breaking PodSecurityStandard (P0)** — Samba needs CAP_SYS_ADMIN for NTACL xattrs, conflicts with restricted PSS. Prevention: Create dedicated namespace with `pod-security.kubernetes.io/enforce: privileged` label, document security trade-off.

3. **ECR authentication token expiry breaking CI/CD (P0)** — OIDC federation misconfiguration or token expiry causes push/pull failures. Prevention: Use aws-actions/configure-aws-credentials@v5.1.1 with correct IAM trust policy (audience: sts.amazonaws.com, subject: repo:ORG/REPO:*), test role assumption before migration.

4. **Samba AD static IP requirement breaking pod restarts (P1)** — Samba registers DNS on startup; IP change causes stale DNS records and domain join failures. Prevention: Use StatefulSet with stable network identity, consider LoadBalancer with static IP for external access.

5. **Multi-container resource starvation (P1)** — Sidecars consume all allocated resources, throttling or OOM-killing main container. Prevention: Set explicit limits on ALL containers including sidecars, use memory limit = request to avoid OOM thrashing.

6. **Helm chart nodeSelector inconsistency (P1)** — Main app scheduled on x86 but database subcharts on ARM64 nodes. Prevention: Add global.nodeSelector to values.yaml and propagate to all templates, audit all chart templates for nodeSelector handling.

7. **QEMU emulation slowing builds 10-30x (P2)** — Cross-platform builds via emulation cause deployment timeouts. Prevention: Use native architecture runners only (ubuntu-latest for x86, ubuntu-24.04-arm for ARM64), never use --platform mismatch.

## Implications for Roadmap

Based on research, the extension requires 4 phases ordered by dependencies and risk mitigation. Timeline constraint (4 days) is aggressive but achievable with parallel work and deferred complexity.

### Phase 1: Infrastructure and x86 Migration
**Rationale:** Smallest change, highest impact, unblocks all other work. Must establish architecture baseline before building on it.

**Delivers:**
- x86/amd64 platform support alongside existing ARM64
- Updated build-image action with platform configuration
- nodeSelector enforcement across all Helm charts
- Verified multi-arch base images

**Addresses:**
- P0-1: Image architecture mismatch (explicit nodeSelector)
- P2-7: QEMU performance (native runners)
- P1-6: Helm chart inconsistency (global nodeSelector)

**Implementation (Day 1, 4-6 hours):**
- Update schema.json with image.platforms property
- Modify build-image action to accept platform input
- Audit all chart templates, add nodeSelector: kubernetes.io/arch
- Verify init container images support amd64
- Test deployment on x86 environment

**Research flag:** NO — Standard Kubernetes patterns, well-documented

### Phase 2: ECR Registry Integration
**Rationale:** Independent of chart changes, enables AWS-native deployments, critical for client requirement. Must complete before Samba AD (which uses custom image in ECR).

**Delivers:**
- AWS OIDC authentication in GitHub Actions
- ECR registry support in build-image action
- Dual-registry capability (GHCR + ECR)
- IAM role and policy configuration

**Addresses:**
- P0-3: ECR authentication (OIDC setup, role trust policy)
- P2-8: mask-password v2 issue (explicit configuration)
- P3-11: Repository pre-creation (Terraform or workflow step)

**Implementation (Day 1, 2-3 hours):**
- Create IAM OIDC provider for GitHub Actions
- Create IAM role with ECR permissions and trust policy
- Add registry-type input to build-image action
- Implement conditional authentication (if ecr: aws-actions, else: docker/login)
- Update schema.json with image.registry configuration
- Document ECR setup in k8s-ee-config-reference.md

**Research flag:** NO — Official AWS documentation, mature actions

### Phase 3: Samba AD Chart
**Rationale:** Most complex, requires custom development, needs x86 support from Phase 1 and ECR from Phase 2. High client value but acceptable to defer if timeline pressure.

**Delivers:**
- Custom Helm chart for Samba AD (charts/samba-ad/)
- Multi-arch Samba image (amd64 + arm64)
- StatefulSet with stable network identity
- DNS integration with CoreDNS
- Namespace security policy exception

**Addresses:**
- P0-2: Privileged container (dedicated namespace with relaxed PSS)
- P1-4: Static IP requirement (StatefulSet pattern)
- P2-9: DNS integration (CoreDNS forwarding configuration)

**Implementation (Day 2, 6-8 hours):**
- Build multi-arch image from Fmstrat/samba-domain source
- Create charts/samba-ad/ with StatefulSet, Service, Secret, ConfigMap
- Add samba-ad dependency to k8s-ee-app Chart.yaml
- Extend schema.json with databases.samba-ad
- Update create-namespace quota calculation (add Samba contribution)
- Configure CoreDNS to forward AD domain queries
- Document security exception in architecture decision record

**Research flag:** YES — No production Helm chart exists, needs custom development and testing

**Fallback plan (if blocked):** Run Samba on dedicated EC2 instance outside Kubernetes with static IP. Reduces Kubernetes complexity but loses ephemeral benefits.

### Phase 4: Multi-Container Support
**Rationale:** Builds on all previous phases, touches deployment template significantly, most user-facing feature. Can be iterative (MVP then enhancements).

**Delivers:**
- containers.sidecars array in k8s-ee-app values.yaml
- Per-container configuration (image, port, resources, env, volumes)
- Shared volume support (emptyDir)
- Backward compatibility with single-container configs
- Updated resource quota calculation

**Addresses:**
- P1-5: Resource starvation (explicit limits per container)
- P3-12: Sidecar shutdown delay (terminationGracePeriod, native sidecars if K8s 1.33+)

**Implementation (Day 3-4, 3-4 hours):**
- Add containers section to values.yaml with sidecars array
- Extend deployment.yaml template with range loop over sidecars
- Update schema.json with containers.sidecars schema
- Modify deploy-app action to pass sidecar config via --set-json
- Extend quota calculation to sum container resources
- Update k8s-ee-config-reference.md with examples

**Research flag:** NO — Standard Kubernetes pattern, follows existing init container approach

**MVP scope:**
- Explicit container list (no extraContainers for now)
- Per-container image/port/resources
- Shared emptyDir volumes
- Optional health probes

**Defer to post-MVP:**
- Path-based ingress routing (requires Service changes)
- Native sidecar support (K8s 1.29+ only)
- Build matrix for multiple Dockerfiles
- Per-container metrics (ServiceMonitor complexity)

### Phase Ordering Rationale

**Dependency chain:**
1. x86 platform support must come first (Samba images may be amd64-only, build infrastructure needs baseline)
2. ECR enables custom image hosting (Samba multi-arch image needs registry)
3. Samba AD requires x86 + ECR + security exceptions (most complex, highest risk)
4. Multi-container leverages all previous work (Samba as sidecar use case)

**Risk mitigation:**
- Tackle P0 pitfalls (architecture mismatch, ECR auth, privileged container) in Days 1-2
- Address P1 pitfalls (static IP, resource starvation) before they compound
- P2/P3 pitfalls handled incrementally or deferred

**Parallel work opportunities:**
- Day 1: Infrastructure (solo) + ECR (solo) can run sequentially
- Day 2: Samba chart development while testing ECR integration
- Day 3-4: Multi-container work can overlap with Samba validation

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 3 (Samba AD):** No production Helm chart exists, requires custom development. Need to validate DNS integration approach, test LDAP authentication flow, verify ARM64 build process. Estimate 2-4 hours additional research during implementation.

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (x86 Migration):** Well-documented Kubernetes patterns, official Docker buildx documentation
- **Phase 2 (ECR Integration):** Official AWS actions, mature OIDC implementation
- **Phase 4 (Multi-Container):** Standard Kubernetes feature, existing init container pattern in codebase

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Multi-arch builds, OIDC, multi-container all have official documentation and mature tooling |
| Features | HIGH | Kubernetes multi-container patterns verified with official docs, production Helm charts (Airflow, Vault) |
| Architecture | HIGH | Existing codebase analysis shows clear extension points, minimal refactoring needed |
| Pitfalls | MEDIUM-HIGH | Critical pitfalls verified via official docs; Samba-specific issues based on community implementations |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

Research identified areas requiring validation during implementation:

- **Samba AD DNS integration:** CoreDNS forwarding configuration tested in baremetal deployments but not verified in k3s environment. Need to validate during Phase 3 with actual pod-to-Samba LDAP connection tests.

- **ARM64 availability for Samba base image:** nowsci/samba-domain has arm.Dockerfile in source but no pre-built ARM64 image on Docker Hub. Need to verify build process and test on ARM64 nodes during Phase 3.

- **Native sidecar support availability:** Kubernetes v1.29+ feature (restartPolicy: Always in initContainers) needs version check on target cluster. If unavailable, fall back to standard sidecar pattern. Verify during Phase 4.

- **IAM OIDC trust policy edge cases:** Workflow may run from pull_request vs push events with different subject claims. Test both scenarios during Phase 2 ECR integration to ensure token.actions.githubusercontent.com:sub pattern matches correctly.

- **Resource quota calculation with multiple containers:** Need to validate that sum of container limits doesn't exceed VPS capacity. Current ARM64 VPS has finite resources; x86 migration resource envelope TBD. Calculate totals during Phase 4 with realistic container specs.

## Sources

### Primary (HIGH confidence)
- [Docker Multi-Platform Builds](https://docs.docker.com/build/building/multi-platform/) — Build strategies, QEMU vs native
- [GitHub OIDC in AWS](https://docs.github.com/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services) — Trust policy configuration
- [aws-actions/configure-aws-credentials](https://github.com/aws-actions/configure-aws-credentials) — OIDC authentication
- [aws-actions/amazon-ecr-login](https://github.com/aws-actions/amazon-ecr-login) — ECR authentication, mask-password behavior
- [Kubernetes Sidecar Containers](https://kubernetes.io/docs/concepts/workloads/pods/sidecar-containers/) — Native sidecar pattern (v1.29+)
- [Kubernetes Multi-Container Pods](https://kubernetes.io/docs/concepts/workloads/pods/) — Pod networking, shared volumes
- [Helm Flow Control](https://helm.sh/docs/chart_template_guide/control_structures/) — Template range loops
- Existing codebase (.github/actions, charts/) — Integration points, patterns

### Secondary (MEDIUM confidence)
- [Fmstrat/samba-domain](https://github.com/Fmstrat/samba-domain) — Samba AD base image, ARM64 Dockerfile
- [nowsci/samba-domain Docker Hub](https://hub.docker.com/r/nowsci/samba-domain/) — Pre-built images (amd64 only)
- [samba-in-kubernetes/samba-container](https://github.com/samba-in-kubernetes/samba-container) — Privileged container requirements
- [Airflow Helm Chart extraContainers](https://airflow.apache.org/docs/helm-chart/stable/using-additional-containers.html) — Multi-container pattern
- [HashiCorp Vault Helm Configuration](https://developer.hashicorp.com/vault/docs/deploy/kubernetes/helm/configuration) — Sidecar configuration
- [GKE x86 to multi-arch migration guide](https://cloud.google.com/kubernetes-engine/docs/tutorials/migrate-x86-to-multi-arch-arm) — Architecture migration pitfalls
- [GitHub ARM64 Runners Announcement](https://www.infoq.com/news/2025/02/github-actions-linux-arm64/) — Native runner availability

### Tertiary (LOW confidence - needs validation)
- [opensourcery-uk/samba-ad-dc](https://github.com/opensourcery-uk/samba-ad-dc) — Baremetal Samba deployment (not Kubernetes)
- [Helge Klein's Samba AD Guide](https://helgeklein.com/blog/samba-active-directory-in-a-docker-container-installation-guide/) — Docker Samba setup
- [Blacksmith ARM64 Builds](https://www.blacksmith.sh/blog/building-multi-platform-docker-images-for-arm64-in-github-actions) — Build performance benchmarks

---
*Research completed: 2026-01-25*
*Ready for roadmap: yes*
