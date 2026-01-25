# Edge/UFAL Pilot Migration

## What This Is

Platform adaptation and deployment of k8s-ephemeral-environments for Edge/UFAL, a large software house with 300+ developers. Starting with a pilot project (htm-gestor-documentos) with 8 developers and 2 QAs. Migrating from ARM64 (Oracle Cloud VPS) to x86 (AWS EC2 VPS), with ECR integration and multi-container support.

## Core Value

Enable the htm-gestor-documentos team to open a PR and get a fully functional preview environment (frontend + backend + Samba AD + PostgreSQL + MinIO) with a public URL in under 10 minutes.

## Requirements

### Validated

<!-- Existing platform capabilities that work and will be reused -->

- ✓ PR environment lifecycle (create on open, destroy on close) — existing
- ✓ PostgreSQL per PR via CloudNativePG — existing
- ✓ MinIO per PR for object storage — existing
- ✓ NetworkPolicy isolation between namespaces — existing
- ✓ ResourceQuota and LimitRange per namespace — existing
- ✓ Observability stack (Prometheus, Loki, Grafana) — existing
- ✓ GitHub Actions reusable workflow — existing
- ✓ PR comment with preview URL — existing
- ✓ Preserve environment command (/preserve) — existing
- ✓ Cleanup job for orphaned namespaces — existing
- ✓ Organization allowlist access control — existing

### Active

<!-- Current scope for this pilot -->

- [ ] **PLAT-01**: NetworkPolicy port configurable (not hardcoded to 3000)
- [ ] **PLAT-02**: Ingress controller selector parameterized (not hardcoded Traefik)
- [ ] **PLAT-03**: Kubernetes API IP configurable per deployment
- [ ] **X86-01**: Build pipeline targets `linux/amd64` architecture
- [ ] **X86-02**: All base images verified for x86 compatibility
- [ ] **X86-03**: Tool binaries (kubectl, helm) default to amd64
- [ ] **MULTI-01**: k8s-ee-app chart supports multiple containers per pod
- [ ] **MULTI-02**: k8s-ee.yaml schema extended for container array
- [ ] **MULTI-03**: Frontend and backend containers share pod networking
- [ ] **AD-01**: Samba AD Helm chart created
- [ ] **AD-02**: Samba AD integrates with k8s-ee.yaml configuration
- [ ] **AD-03**: LDAP credentials stored in Kubernetes Secret
- [ ] **ECR-01**: build-image action supports AWS ECR push
- [ ] **ECR-02**: OIDC configured for GitHub Actions → AWS authentication
- [ ] **ECR-03**: Workflow handles ECR registry login and push
- [ ] **EDGE-01**: Edge organization added to allowed-orgs.json
- [ ] **EDGE-02**: GitHub App created and installed on Edge org
- [ ] **EDGE-03**: DNS wildcard configured for preview.edge.ufal.br
- [ ] **EDGE-04**: ACM certificate provisioned for *.preview.edge.ufal.br
- [ ] **EDGE-05**: k3s installed on AWS EC2 (x86)
- [ ] **EDGE-06**: Operators deployed (CloudNativePG, MinIO)
- [ ] **EDGE-07**: Observability stack deployed
- [ ] **EDGE-08**: htm-gestor-documentos configured with k8s-ee.yaml
- [ ] **EDGE-09**: End-to-end PR lifecycle validated

### Out of Scope

<!-- Explicit boundaries -->

- EKS migration — deferred to post-pilot if successful
- MariaDB support fixes — client uses PostgreSQL only
- MongoDB chart — not needed for this project
- Redis chart — not needed for this project
- Auto-hibernation (US-036) — Phase 2.5 roadmap item
- Multi-provider support (GitLab, Bitbucket) — Phase 2.5 roadmap item
- High availability — single VPS acceptable for pilot
- Cost attribution — future feature

## Context

### Client Details

| Attribute | Value |
|-----------|-------|
| **Organization** | Edge/UFAL |
| **GitHub Org** | Edge |
| **Total Developers** | 300+ |
| **Pilot Team** | 8 developers + 2 QAs |
| **Pilot Project** | htm-gestor-documentos |
| **Preview Domain** | preview.edge.ufal.br |
| **Registry** | AWS ECR (existing) |
| **Infrastructure** | AWS (client's existing account) |

### Pilot Project (htm-gestor-documentos)

| Aspect | Details |
|--------|---------|
| **Type** | Document management system for industry |
| **Structure** | Monorepo (Yarn workspaces) |
| **Frontend** | Vue 3 + Vite → Nginx container |
| **Backend** | Node.js 22 + Express 5 (Vertical Slice Architecture) |
| **Database** | PostgreSQL 17 with Prisma ORM |
| **Storage** | MinIO for documents |
| **Auth** | Samba AD (LDAP) |
| **Deployment** | Multi-container pod (frontend + backend + AD) |

### Platform Concerns to Address

| Issue | Priority | Resolution |
|-------|----------|------------|
| NetworkPolicy port hardcoded to 3000 | Blocker | Make configurable |
| Traefik selector hardcoded | Blocker | Parameterize |
| k8s API IP hardcoded (10.0.0.39) | Blocker | Make configurable |
| Database init race condition (~1% failures) | Risk | Document retry requirement |
| GitHub token exposure in error logs | Risk | Add log redaction |
| Preserve/cleanup race condition | Risk | Manual workaround exists |

### Existing Migration Plan

Detailed migration plan exists at `docs/edge-migration-plan.md` with:
- Cost analysis (VPS ~R$ 1,212/month vs EKS ~R$ 2,200+/month)
- OIDC setup for GitHub Actions → ECR
- Day-by-day timeline breakdown
- IAM permissions requirements
- Validation checklist

## Constraints

- **Timeline**: 4 days maximum — pilot must be operational
- **Architecture**: x86 (linux/amd64) — client's AWS infrastructure
- **Registry**: AWS ECR — client's existing container registry
- **Provisioning split**: Client DevOps provisions EC2, we do everything else
- **VPS approach**: k3s on EC2 first, EKS migration only if pilot succeeds
- **No EKS complexity**: Avoid managed Kubernetes costs/complexity for pilot validation

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| VPS (k3s) over EKS for pilot | Faster setup (1-2 days vs 5), lower cost (~R$ 1,212 vs R$ 2,200+), proven architecture | — Pending |
| ECR over GHCR | Client already uses ECR, lower latency, no imagePullSecrets needed | — Pending |
| Multi-container pod (not separate deployments) | Matches client's existing deployment pattern, simpler networking | — Pending |
| PostgreSQL only (no MariaDB) | Client doesn't need MariaDB, avoids data loss bug | — Pending |
| Skip Phase 2.5 features | Pilot needs existing functionality, not new features | — Pending |

---
*Last updated: 2026-01-25 after initialization*
