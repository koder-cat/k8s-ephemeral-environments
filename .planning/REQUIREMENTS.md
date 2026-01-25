# Requirements: Edge/UFAL Pilot Migration

**Defined:** 2026-01-25
**Core Value:** Enable htm-gestor-documentos team to get fully functional PR preview environments on AWS infrastructure

## Milestone 1: Platform Migration (Days 1-4)

Platform adaptation for x86/AWS/ECR and infrastructure deployment.

### Platform Fixes

- [ ] **PLAT-01**: NetworkPolicy port configurable via k8s-ee.yaml (not hardcoded to 3000)
- [ ] **PLAT-02**: Ingress controller selector parameterized (not hardcoded Traefik labels)
- [ ] **PLAT-03**: Kubernetes API IP configurable per deployment (not hardcoded 10.0.0.39)

### x86 Architecture Support

- [ ] **X86-01**: Build pipeline targets `linux/amd64` architecture by default
- [ ] **X86-02**: All Helm chart templates include `nodeSelector: kubernetes.io/arch: amd64`
- [ ] **X86-03**: Tool binaries (kubectl, helm) in setup-tools action default to amd64

### ECR Registry Integration

- [ ] **ECR-01**: build-image action supports AWS ECR push (conditional authentication)
- [ ] **ECR-02**: OIDC configured for GitHub Actions → AWS authentication (IAM role + trust policy)
- [ ] **ECR-03**: Workflow handles ECR registry type with proper login and push commands

### Infrastructure Setup

- [ ] **INFRA-01**: Edge organization added to allowed-orgs.json
- [ ] **INFRA-02**: GitHub App created and installed on Edge organization
- [ ] **INFRA-03**: DNS wildcard configured for preview.edge.ufal.br
- [ ] **INFRA-04**: ACM certificate provisioned for *.preview.edge.ufal.br
- [ ] **INFRA-05**: k3s installed on AWS EC2 instance (x86)
- [ ] **INFRA-06**: Operators deployed (CloudNativePG, MinIO Operator)
- [ ] **INFRA-07**: Observability stack deployed (Prometheus, Loki, Grafana)

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
| PLAT-01 | Phase 1 | Pending |
| PLAT-02 | Phase 1 | Pending |
| PLAT-03 | Phase 1 | Pending |
| X86-01 | Phase 1 | Pending |
| X86-02 | Phase 1 | Pending |
| X86-03 | Phase 1 | Pending |
| ECR-01 | Phase 2 | Pending |
| ECR-02 | Phase 2 | Pending |
| ECR-03 | Phase 2 | Pending |
| INFRA-01 | Phase 3 | Pending |
| INFRA-02 | Phase 3 | Pending |
| INFRA-03 | Phase 3 | Pending |
| INFRA-04 | Phase 3 | Pending |
| INFRA-05 | Phase 3 | Pending |
| INFRA-06 | Phase 3 | Pending |
| INFRA-07 | Phase 3 | Pending |
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
- Milestone 1 requirements: 16 total
- Milestone 2 requirements: 14 total
- Total: 30 requirements
- Mapped to phases: 30
- Unmapped: 0 ✓

---
*Requirements defined: 2026-01-25*
*Last updated: 2026-01-25 after initial definition*
