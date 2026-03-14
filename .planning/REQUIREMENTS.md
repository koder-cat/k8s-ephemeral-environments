# Requirements: Edge/UFAL Pilot Migration

**Defined:** 2026-01-25
**Core Value:** Enable htm-gestor-documentos team to get fully functional PR preview environments on AWS infrastructure

## Milestone 1: Platform Migration (Days 1-4)

Platform adaptation for x86/AWS/ECR and infrastructure deployment.

### Platform Fixes

- [x] **PLAT-01**: NetworkPolicy port configurable via k8s-ee.yaml (not hardcoded to 3000) _(`app-port` input parameterized in create-namespace action and NetworkPolicy template)_
- [ ] **PLAT-02**: Ingress controller selector parameterized (not hardcoded Traefik labels) _(partial: `ingressClassName` parameterized, but Traefik annotations in values.yaml and pod selectors in NetworkPolicy still hardcoded)_
- [x] **PLAT-03**: Kubernetes API IP configurable per deployment (not hardcoded 10.0.0.39) _(dynamically resolved via `kubectl get svc/endpoints kubernetes`, fixed 2026-03-14)_

### x86 Architecture Support

- [x] **X86-01**: Build pipeline supports `linux/amd64` architecture _(configurable via `platforms` workflow input; upstream defaults to arm64 for Oracle VPS, forks override via repo variable `ARCHITECTURE=amd64`)_
- [~] **X86-02**: ~~All Helm chart templates include `nodeSelector: kubernetes.io/arch: amd64`~~ _(not needed: EC2 cluster is single-architecture x86_64, no mixed-arch scheduling risk)_
- [x] **X86-03**: Tool binaries (kubectl, helm) support amd64 _(configurable via `architecture` workflow input; upstream defaults to arm64, forks override via repo variable `ARCHITECTURE=amd64`)_

### ECR Registry Integration (registry-agnostic approach)

- [ ] **ECR-01**: `build-image` action supports both GHCR and ECR, selected by `REGISTRY` repo variable (default: `ghcr`)
- [ ] **ECR-02**: ~~OIDC configured~~ → Use existing org secrets (`ECR_AWS_ACCESS_KEY_ID`/`ECR_AWS_SECRET_ACCESS_KEY`) for ECR authentication
- [ ] **ECR-03**: `deploy-app` action creates `imagePullSecret` for ECR when `REGISTRY=ecr`

### Infrastructure Setup

- [x] **INFRA-01**: Edge organization added to allowed-orgs.json _(on edgebr fork; upstream has genesluna + koder-cat only)_
- [x] **INFRA-02**: GitHub App created and installed on Edge organization _(App ID: 2999114, Installation ID: 113788735)_
- [x] **INFRA-03**: DNS wildcard configured _(domain changed: `*.k8s-ee.edge.net.br` → EC2 Elastic IP)_
- [x] **INFRA-04**: TLS certificate provisioned _(Let's Encrypt via Route 53 DNS challenge, not ACM)_
- [x] **INFRA-05**: k3s installed on AWS EC2 instance (x86) _(v1.34.4+k3s1, Ubuntu 24.04, 4 vCPU / 15 GB RAM)_
- [x] **INFRA-06**: Operators deployed _(CloudNativePG, MongoDB Community Operator, MinIO Operator)_
- [x] **INFRA-07**: Observability stack deployed _(Prometheus, Loki, Promtail, Grafana with GitHub OAuth)_

## Milestone 2: Pilot Project Enablement (Days 5-8)

Multi-container support, Samba AD, and htm-gestor-documentos integration.

### Multi-Container Support

- [ ] **MULTI-01**: k8s-ee-app chart supports multiple containers per pod (sidecars array)
- [ ] **MULTI-02**: k8s-ee.yaml schema extended for containers configuration
- [ ] **MULTI-03**: Shared volumes (emptyDir) supported between containers
- [ ] **MULTI-04**: Per-container image, port, resources, and environment variables
- [ ] **MULTI-05**: Resource quota calculation updated for multiple containers

### Samba AD Chart

- [ ] **AD-01**: Samba AD Helm chart created (StatefulSet pattern for stable identity)
- [ ] **AD-02**: Samba AD integrates with k8s-ee.yaml configuration (databases.samba-ad)
- [ ] **AD-03**: LDAP credentials stored in Kubernetes Secret (auto-generated)
- [ ] **AD-04**: Namespace security policy configured for privileged container
- [ ] **AD-05**: DNS integration documented (CoreDNS forwarding if needed)

### Pilot Project Integration

- [ ] **PILOT-01**: htm-gestor-documentos k8s-ee.yaml created (frontend + backend + AD)
- [ ] **PILOT-02**: PR workflow configured in htm-gestor-documentos repo
- [ ] **PILOT-03**: End-to-end PR lifecycle validated (open → deploy → test → close → cleanup)
- [ ] **PILOT-04**: Documentation provided to Edge team

## Out of Scope

| Feature | Reason |
|---------|--------|
| EKS migration | Deferred to post-pilot if successful |
| MariaDB fixes | Client uses PostgreSQL only |
| MongoDB, Redis | Not needed for htm-gestor-documentos |
| Auto-hibernation | Phase 2.5 roadmap item |
| Multi-provider (GitLab, Bitbucket) | Phase 2.5 roadmap item |
| High availability | Single VPS acceptable for pilot |
| ARM64 support on new cluster | Client uses x86 only |
| Build matrix (multiple Dockerfiles) | Deferred to post-MVP |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLAT-01 | Phase 1 | **Done** |
| PLAT-02 | Phase 1 | Partial (ingressClassName ok, Traefik annotations/selectors hardcoded) |
| PLAT-03 | Phase 1 | **Done** (2026-03-14) |
| X86-01 | Phase 1 | **Done** (configurable via input/repo variable) |
| X86-02 | Phase 1 | **N/A** (single-arch cluster, not needed) |
| X86-03 | Phase 1 | **Done** (configurable via input/repo variable) |
| ECR-01 | Phase 2 | Pending |
| ECR-02 | Phase 2 | Pending |
| ECR-03 | Phase 2 | Pending |
| INFRA-01 | Phase 3 | **Done** (2026-03-05) |
| INFRA-02 | Phase 3 | **Done** (2026-03-05) |
| INFRA-03 | Phase 3 | **Done** (2026-03-12) |
| INFRA-04 | Phase 3 | **Done** (2026-03-12) |
| INFRA-05 | Phase 3 | **Done** (2026-03-05) |
| INFRA-06 | Phase 3 | **Done** (2026-03-05) |
| INFRA-07 | Phase 3 | **Done** (2026-03-05) |
| MULTI-01 | Phase 4 | Pending |
| MULTI-02 | Phase 4 | Pending |
| MULTI-03 | Phase 4 | Pending |
| MULTI-04 | Phase 4 | Pending |
| MULTI-05 | Phase 4 | Pending |
| AD-01 | Phase 5 | Pending |
| AD-02 | Phase 5 | Pending |
| AD-03 | Phase 5 | Pending |
| AD-04 | Phase 5 | Pending |
| AD-05 | Phase 5 | Pending |
| PILOT-01 | Phase 6 | Pending |
| PILOT-02 | Phase 6 | Pending |
| PILOT-03 | Phase 6 | Pending |
| PILOT-04 | Phase 6 | Pending |

**Coverage:**
- Milestone 1 requirements: 16 total (Phases 1-3)
- Milestone 2 requirements: 14 total (Phases 4-6)
- Total: 30 requirements
- Mapped to phases: 30
- Unmapped: 0

---
*Requirements defined: 2026-01-25*
*Last updated: 2026-03-14 — Phase 1 nearly complete (only PLAT-02 partial), Phase 3 done*
