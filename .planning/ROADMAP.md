# Roadmap: Edge/UFAL Pilot Migration

## Overview

This roadmap transforms the k8s-ephemeral-environments platform from ARM64 (Oracle Cloud) to x86 (AWS) for Edge/UFAL's pilot deployment. Starting with platform fixes and architecture migration, then ECR integration and infrastructure setup, followed by multi-container support, Samba AD chart development, and finally pilot project integration. The goal is a fully functional preview environment for htm-gestor-documentos (frontend + backend + Samba AD + PostgreSQL + MinIO) operational in 8 days.

## Milestones

- [ ] **Milestone 1: Platform Migration** - Phases 1-3 (Days 1-4)
- [ ] **Milestone 2: Pilot Project Enablement** - Phases 4-6 (Days 5-8)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

### Milestone 1: Platform Migration (Days 1-4)

- [~] **Phase 1: Platform Fixes & x86 Support** - Foundation fixes and architecture migration _(5/6 done; only PLAT-02 partial)_
- [x] **Phase 2: ECR Registry Integration** - Registry-agnostic build/deploy (GHCR + ECR)
- [x] **Phase 3: Infrastructure Setup** - Edge cluster deployment and configuration _(completed 2026-03-14)_

### Milestone 2: Pilot Project Enablement (Days 5-8)

- [ ] **Phase 4: Multi-Container Support** - Multi-container pod deployment capability
- [ ] **Phase 5: Samba AD Chart** - Active Directory authentication service
- [ ] **Phase 6: Pilot Project Integration** - htm-gestor-documentos deployment validation

## Phase Details

### Phase 1: Platform Fixes & x86 Support (~Done)
**Goal**: Platform is architecture-agnostic with configurable networking, enabling deployment on x86 infrastructure
**Depends on**: Nothing (first phase)
**Requirements**: PLAT-01, PLAT-02, PLAT-03, X86-01, X86-02, X86-03
**Success Criteria** (what must be TRUE):
  1. ✅ NetworkPolicy port is configurable via k8s-ee.yaml (`app-port` input parameterized)
  2. ⚠️ Ingress controller selector works with non-Traefik controllers — partial: `ingressClassName` parameterized, but Traefik-specific annotations in `values.yaml` and pod selectors in NetworkPolicy are still hardcoded. **Acceptable for pilot** (EC2 cluster uses Traefik).
  3. ✅ Build pipeline supports linux/amd64 images (configurable via `platforms` input + `ARCHITECTURE` repo variable)
  4. ✅ Helm charts deploy on x86 nodes (X86-02 nodeSelector not needed — single-arch cluster)

Plans:
- [x] 01-01: Platform configuration fixes (PLAT-01 done, PLAT-02 partial, PLAT-03 done)
- [x] 01-02: x86 architecture support (X86-01 done via input, X86-02 N/A, X86-03 done via input)

### Phase 2: ECR Registry Integration
**Goal**: `build-image` and `deploy-app` actions support ECR as an alternative to GHCR, selected by repo variable
**Depends on**: Phase 1 (x86 images must be buildable)
**Requirements**: ECR-01, ECR-02, ECR-03
**Design**: Registry-agnostic — same code supports both GHCR and ECR. Selected via `REGISTRY` repo variable (default: `ghcr`). Fully compatible with upstream, no sync conflicts. Same pattern as `ARCHITECTURE`/`DOMAIN`/`ORG_NAME`.

**Updated approach**: Use existing org secrets (`ECR_AWS_ACCESS_KEY_ID`/`ECR_AWS_SECRET_ACCESS_KEY`) instead of OIDC. Simpler, already configured on fork.

**Success Criteria** (what must be TRUE):
  1. ✅ `build-image` action pushes to ECR when `registry-type=ecr` (conditional login via `aws ecr get-login-password`)
  2. ✅ `build-image` action still pushes to GHCR when `registry-type=ghcr` (default, no behavior change)
  3. ✅ `deploy-app` action creates `imagePullSecret` for ECR when needed
  4. Fork repo variables: `REGISTRY=ecr`, `ECR_REGION=<region>` — set via workflow inputs in calling repo
  5. ECR repository auto-created by `build-image` action on first push

**Fork repo variables** (in addition to existing ARCHITECTURE/DOMAIN/ORG_NAME):

| Variable | Default (upstream) | Fork value |
|----------|-------------------|------------|
| `REGISTRY` | `ghcr` | `ecr` |
| `ECR_REGION` | _(unused)_ | e.g., `us-east-2` |

Plans:
- [x] 02-01: Registry-agnostic build-image + deploy-app (ECR-01, ECR-02, ECR-03)

### Phase 3: Infrastructure Setup ✅
**Goal**: Edge organization infrastructure is operational with all platform components
**Depends on**: Phase 2 (ECR needed for custom image deployments)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-07
**Success Criteria** (what must be TRUE):
  1. ✅ k3s cluster is running on AWS EC2 with kubectl access (v1.34.4+k3s1, `ubuntu@13.58.99.235`)
  2. ✅ Edge organization can trigger PR environment workflows (ARC runner registered, KUBECONFIG secret set)
  3. ✅ Preview URLs resolve at `*.k8s-ee.edge.net.br` with valid TLS (Let's Encrypt via Route 53 DNS challenge)
  4. ✅ Observability stack (Prometheus, Loki, Grafana) is accessible (`https://grafana.k8s-ee.edge.net.br` with GitHub OAuth)
**Completed**: 2026-03-14 (see `docs/plans/migration-to-EC2-PROGRESS.md` for full step-by-step log)

**Note**: Domain changed from original plan (`*.preview.edge.ufal.br` → `*.k8s-ee.edge.net.br`). TLS uses Let's Encrypt instead of ACM. INFRA-01 (allowlist) is configured on the `edgebr` fork, not on upstream.

Plans:
- [x] 03-01: Edge organization setup (INFRA-01, INFRA-02, INFRA-03, INFRA-04)
- [x] 03-02: Cluster deployment (INFRA-05, INFRA-06, INFRA-07)

### Phase 4: Multi-Container Support
**Goal**: k8s-ee-app chart supports multiple containers per pod for complex applications
**Depends on**: Phase 1 (chart modifications require platform baseline)
**Requirements**: MULTI-01, MULTI-02, MULTI-03, MULTI-04, MULTI-05
**Success Criteria** (what must be TRUE):
  1. k8s-ee.yaml can define multiple containers (main + sidecars)
  2. Containers share localhost networking within the pod
  3. Shared volumes (emptyDir) work between containers
  4. Resource quota calculation accounts for all containers in pod
**Plans**: TBD

Plans:
- [ ] 04-01: Multi-container chart extension (MULTI-01, MULTI-02, MULTI-03, MULTI-04, MULTI-05)

### Phase 5: Samba AD Chart
**Goal**: Samba Active Directory runs in Kubernetes for LDAP authentication testing
**Depends on**: Phase 3 (infrastructure must be operational), Phase 4 (may run as sidecar)
**Requirements**: AD-01, AD-02, AD-03, AD-04, AD-05
**Success Criteria** (what must be TRUE):
  1. Samba AD starts successfully with stable network identity (StatefulSet)
  2. LDAP bind works from application container using generated credentials
  3. Privileged container security exception is properly scoped to namespace
  4. DNS resolution documented (CoreDNS forwarding if required)
**Plans**: TBD

Plans:
- [ ] 05-01: Samba AD Helm chart development (AD-01, AD-02, AD-03, AD-04, AD-05)

### Phase 6: Pilot Project Integration
**Goal**: htm-gestor-documentos team can open a PR and get a working preview environment
**Depends on**: Phase 3 (infrastructure), Phase 4 (multi-container), Phase 5 (Samba AD)
**Requirements**: PILOT-01, PILOT-02, PILOT-03, PILOT-04
**Success Criteria** (what must be TRUE):
  1. PR opened in htm-gestor-documentos creates namespace with all components
  2. Frontend, backend, Samba AD, PostgreSQL, and MinIO all start successfully
  3. PR closed/merged triggers namespace cleanup
  4. Edge team has documentation to operate and troubleshoot environments
**Plans**: TBD

Plans:
- [ ] 06-01: Pilot project configuration and validation (PILOT-01, PILOT-02, PILOT-03, PILOT-04)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Platform Fixes & x86 Support | M1 | 2/2 | **~Done** (PLAT-02 partial, acceptable for pilot) | 2026-03-14 |
| 2. ECR Registry Integration | M1 | 1/1 | **Done** | 2026-03-14 |
| 3. Infrastructure Setup | M1 | 2/2 | **Done** | 2026-03-14 |
| 4. Multi-Container Support | M2 | 0/1 | Not started | - |
| 5. Samba AD Chart | M2 | 0/1 | Not started | - |
| 6. Pilot Project Integration | M2 | 0/1 | Not started | - |

---
*Roadmap created: 2026-01-25*
*Last updated: 2026-03-14 — Phase 2 completed (ECR registry integration), Phase 3 completed (EC2 cluster fully operational)*
*Coverage: 30/30 requirements mapped*
