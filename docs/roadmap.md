# K8s Ephemeral Environments Roadmap

**The future of preview environments: Open-source core with optional enterprise capabilities.**

![Roadmap Overview](../assets/images/roadmap-overview.png)

---

## Executive Summary

This roadmap outlines the evolution of K8s Ephemeral Environments from a single-VPS platform to a scalable, multi-cloud solution with enterprise-grade features. We're pursuing a **hybrid model**:

- **Core (AGPL-3.0)** — Full-featured platform, self-hosted, community-driven
- **Enterprise (Commercial)** — SSO, compliance, multi-tenant EaaS platform

> **Vision:** Make ephemeral PR environments accessible to every development team, from startups self-hosting on a single VPS to enterprises running thousands of environments across multiple clouds.

---

## Current State

**Phases 1-2: COMPLETE**

- **Epic 1** — Infrastructure ✓
- **Epic 2** — PR Environment Lifecycle ✓
- **Epic 3** — Database per PR ✓
- **Epic 4** — Observability ✓
- **Epic 5** — GitHub Runners ✓
- **Epic 6** — Security ✓
- **Epic 7** — Platform Improvements ✓
- **Epic 8** — Simplified Onboarding ✓

**Summary:**
- Epics Completed: **8**
- User Stories: **34**
- Story Points: **186**
- Status: **Production-ready on ARM64 VPS**

---

## Phase 2.5: Core Evolution

![Phase 2.5: Core Evolution](../assets/images/phase-2-5.png)

> **License:** AGPL-3.0 (Open Source)
>
> **Goal:** Enhance developer experience, expand CI/CD provider support, and add advanced database capabilities.

### Epic 9 — Developer Experience

*Directory:* `epic-9-developer-experience/`

- **US-035: CLI Tool** *(Should, 8 pts)*
  - `k8s-ee` command-line tool for local environment management

- **US-036: Auto-Hibernation** *(Must, 13 pts)*
  - Scale environments to zero after configurable inactivity period

- **US-037: Status Webhooks** *(Should, 5 pts)*
  - Real-time environment status via webhooks and notifications

- **US-056: DORA Metrics Data Collection** *(Should, 8 pts)*
  - Record deployment events to Prometheus for per-repo DORA metrics

**Key Outcome:** Developers can manage environments locally, reduce costs through automatic hibernation, and track delivery performance with DORA metrics.

---

### Epic 10 — Multi-Provider Support

*Directory:* `epic-10-multi-provider/`

- **US-038: GitLab CI/CD** *(Should, 8 pts)*
  - Native integration with GitLab CI/CD pipelines

- **US-039: Bitbucket Pipelines** *(Should, 8 pts)*
  - Native integration with Bitbucket Pipelines

- **US-040: Generic Webhooks** *(Could, 5 pts)*
  - Trigger environments from any CI system via webhooks

**Key Outcome:** Teams using GitLab or Bitbucket can adopt the platform without switching to GitHub.

---

### Epic 11 — Advanced Database Features

*Directory:* `epic-11-database-features/`

- **US-041: Database Seeding** *(Should, 5 pts)*
  - Seed databases from templates during environment creation

- **US-042: Point-in-Time Snapshots** *(Could, 8 pts)*
  - Create and restore database snapshots for debugging

- **US-043: Data Anonymization** *(Could, 13 pts)*
  - Pipeline to anonymize production data for safe testing

**Key Outcome:** Teams can test with realistic data while maintaining security and compliance.

---

## Phase 3: Cloud Scale

![Phase 3: Cloud Scale](../assets/images/phase-3.png)

> **License:** AGPL-3.0 (Open Source)
>
> **Goal:** Migrate from single-VPS to Amazon EKS for improved scalability, reliability, and cost optimization.

### Epic 12 — Amazon EKS Migration

*Directory:* `epic-12-eks-migration/`

- **US-044: EKS Provisioning** *(Must, 13 pts)*
  - Terraform modules for EKS cluster deployment

- **US-045: Spot Instances** *(Should, 8 pts)*
  - Use EC2 Spot instances for 40-60% cost reduction

- **US-046: Multi-Cluster** *(Could, 13 pts)*
  - Support multiple clusters for regional deployment

- **US-047: Crossplane Integration** *(Should, 8 pts)*
  - Provision RDS, S3, and other AWS resources per environment

- **US-057: Flux CD for Infrastructure GitOps** *(Should, 13 pts)*
  - Manage permanent infrastructure via GitOps with drift detection and multi-cluster support

> **ARM64 Compatibility:** EKS supports ARM64 via Graviton instances. All features must maintain multi-architecture support.

**Key Outcome:** Platform scales to handle enterprise workloads with production-grade reliability.

---

## Phase 4: Enterprise & EaaS

![Phase 4: Enterprise & EaaS](../assets/images/phase-4.png)

> **License:** Commercial (Contact for licensing)
>
> **Goal:** Provide enterprise security features and a fully-managed Environment-as-a-Service platform.

### Epic 13 — Enterprise Security & Compliance

*Directory:* `epic-13-enterprise-security/`

- **US-048: SSO/SAML** *(Must, 8 pts)*
  - Single sign-on with SAML 2.0 and OIDC providers

- **US-049: Audit Logging** *(Must, 5 pts)*
  - Comprehensive audit trail for compliance requirements

- **US-050: SOC2 Compliance** *(Should, 13 pts)*
  - Controls and documentation for SOC2 certification

- **US-051: Advanced RBAC** *(Should, 8 pts)*
  - Team hierarchies, custom roles, fine-grained permissions

**Key Outcome:** Enterprise teams can adopt the platform while meeting security and compliance requirements.

---

### Epic 14 — Environment-as-a-Service Platform

*Directory:* `epic-14-eaas-platform/`

- **US-052: Control Plane API** *(Must, 21 pts)*
  - Multi-tenant API for managing organizations and environments

- **US-053: Web Dashboard** *(Must, 21 pts)*
  - Self-service UI for environment management and monitoring
  - Includes DORA metrics display per repository

- **US-054: Usage Metering** *(Must, 13 pts)*
  - Track CPU, memory, and storage for billing integration

- **US-055: SLA Monitoring** *(Should, 8 pts)*
  - Automated SLA tracking and incident management

**Key Outcome:** Organizations can use ephemeral environments without managing infrastructure.

---

## Dependencies

**Hard Prerequisites (blocking):**
- Epic 13 → Epic 14 *(SSO/RBAC required before multi-tenant platform)*

**Recommended Order (not blocking):**
- Phase 2.5 (Epics 9-11) → Phase 3 (Epic 12) *(stabilize core before migration)*
- Epics 9, 10, 11 can be developed **in parallel**

**Flow:**
```
Phase 2.5 (parallel) ──→ Phase 3 ──→ Phase 4
    Epic 9  ─┐                         Epic 13
    Epic 10 ─┼──→ Epic 12 ──────────→    ↓
    Epic 11 ─┘                         Epic 14
```

---

## Success Metrics

**Phase 2.5 — Core Evolution**
- Auto-hibernation adoption: **60% of idle environments**
- Multi-provider coverage: **GitLab + Bitbucket working**

**Phase 3 — Cloud Scale**
- EKS deployment success rate: **≥95%**
- Cost reduction (spot instances): **40-60% savings**
- Migration downtime per environment: **<15 minutes**
- Migration completeness: **100% (zero on VPS)**
- Infrastructure drift incidents: **Zero (GitOps enforced)**

**Phase 4 — Enterprise & EaaS**
- Enterprise customers onboarded: **First 3 paid customers**
- Platform SLA compliance: **99.5% uptime**

---

## Licensing Model

**AGPL-3.0 (Free, Open Source)**
- Scope: Epics 1-12
- Features:
  - Full platform
  - All databases
  - Observability
  - Auto-hibernation
  - Multi-provider
  - EKS migration
  - Infrastructure GitOps
- Hosting: Self-hosted
- Support: Community

**Commercial License**
- Scope: Epics 13-14
- Features:
  - SSO/SAML
  - Audit logging
  - SOC2 compliance
  - Advanced RBAC
  - Multi-tenant API
  - Web dashboard
  - Usage metering
  - SLA guarantees
- Hosting: Managed or self-hosted
- Support: Priority

---

## Summary Statistics

**Future Development**

*Phase 2.5 — Core Evolution*
- Epics: 3 | Stories: 10 | Points: 81
- Must: 1 | Should: 7 | Could: 2

*Phase 3 — Cloud Scale*
- Epics: 1 | Stories: 5 | Points: 55
- Must: 1 | Should: 3 | Could: 1

*Phase 4 — Enterprise & EaaS*
- Epics: 2 | Stories: 8 | Points: 97
- Must: 5 | Should: 3 | Could: 0

**Totals**
- Future: **6 epics, 23 stories, 233 points**
- Overall: **14 epics, 57 stories, 419 points**

---

## Contributing

We welcome contributions to the open-source core (Phases 2.5 and 3). See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

For enterprise features or partnership inquiries, contact: **genes@genesluna.dev**

---

<div align="center">

*This roadmap is a living document and will be updated as priorities evolve.*

**Last Updated:** January 2025

</div>
