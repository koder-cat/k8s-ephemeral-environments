# User Stories Overview

This document provides an index of all user stories derived from the PRD.

## Summary

| Metric | Count |
|--------|-------|
| Total Epics | 8 |
| Total User Stories | 33 |
| **Completed** | **28** ✅ |
| Must Have | 18 |
| Should Have | 12 |
| Could Have | 3 |

**Phase 1 Status:** Complete - All 21 user stories implemented and deployed.

**Phase 1.5 Status:** Complete - All 6 user stories in Epic 7 implemented and deployed.

**Phase 2 Status:** In Progress - Epic 8: Simplified Onboarding (6 stories).

**Phase 3 Status:** Future - EKS Migration (as defined in PRD).

---

## Epics

### [Epic 1: Infrastructure Foundation](./epic-1-infrastructure/) ✅

| Story | Title | Priority | Points | Status |
|-------|-------|----------|--------|--------|
| [US-001](./epic-1-infrastructure/US-001-provision-vps.md) | Provision VPS Server | Must | 3 | ✅ Done |
| [US-002](./epic-1-infrastructure/US-002-install-k3s.md) | Install and Configure k3s Cluster | Must | 5 | ✅ Done |
| [US-003](./epic-1-infrastructure/US-003-configure-dns.md) | Configure Wildcard DNS | Must | 2 | ✅ Done |

### [Epic 2: Ephemeral Environment Lifecycle](./epic-2-ephemeral-environments/) ✅

| Story | Title | Priority | Points | Status |
|-------|-------|----------|--------|--------|
| [US-004](./epic-2-ephemeral-environments/US-004-create-namespace-on-pr-open.md) | Create Namespace on PR Open | Must | 5 | ✅ Done |
| [US-005](./epic-2-ephemeral-environments/US-005-deploy-application.md) | Deploy Application to PR Environment | Must | 8 | ✅ Done |
| [US-006](./epic-2-ephemeral-environments/US-006-create-preview-url.md) | Create Unique Preview URL | Must | 5 | ✅ Done |
| [US-007](./epic-2-ephemeral-environments/US-007-comment-pr-with-url.md) | Comment on PR with Preview URL | Should | 3 | ✅ Done |
| [US-008](./epic-2-ephemeral-environments/US-008-destroy-on-pr-close.md) | Destroy Environment on PR Close/Merge | Must | 5 | ✅ Done |

### [Epic 3: Database per PR](./epic-3-database/) ✅

| Story | Title | Priority | Points | Status |
|-------|-------|----------|--------|--------|
| [US-009](./epic-3-database/US-009-create-database-per-pr.md) | Create Isolated Database per PR | Must | 8 | ✅ Done |
| [US-010](./epic-3-database/US-010-database-credentials.md) | Secure Database Credentials Management | Must | 3 | ✅ Done |

### [Epic 4: Observability](./epic-4-observability/) ✅

| Story | Title | Priority | Points | Status |
|-------|-------|----------|--------|--------|
| [US-011](./epic-4-observability/US-011-deploy-prometheus.md) | Deploy Prometheus for Metrics Collection | Must | 5 | ✅ Done |
| [US-012](./epic-4-observability/US-012-deploy-loki.md) | Deploy Loki for Log Aggregation | Must | 5 | ✅ Done |
| [US-013](./epic-4-observability/US-013-deploy-grafana.md) | Deploy Grafana Dashboards | Should | 5 | ✅ Done |
| [US-014](./epic-4-observability/US-014-configure-alerts.md) | Configure Basic Alerts | Could | 3 | ✅ Done |

### [Epic 5: GitHub Runners](./epic-5-github-runners/) ✅

| Story | Title | Priority | Points | Status |
|-------|-------|----------|--------|--------|
| [US-015](./epic-5-github-runners/US-015-deploy-arc.md) | Deploy Actions Runner Controller (ARC) | Should | 5 | ✅ Done |
| [US-016](./epic-5-github-runners/US-016-configure-runner-deployment.md) | Configure Runner Deployment | Should | 5 | ✅ Done |
| [US-017](./epic-5-github-runners/US-017-configure-github-access.md) | Configure GitHub Actions Access to Cluster | Must | 3 | ✅ Done |

### [Epic 6: Resource Management & Security](./epic-6-security/) ✅

| Story | Title | Priority | Points | Status |
|-------|-------|----------|--------|--------|
| [US-018](./epic-6-security/US-018-configure-resource-quotas.md) | Configure Resource Quotas | Should | 3 | ✅ Done |
| [US-019](./epic-6-security/US-019-configure-network-policies.md) | Configure Network Policies | Should | 5 | ✅ Done |
| [US-020](./epic-6-security/US-020-cleanup-job.md) | Implement Cleanup Job for Orphaned Resources | Should | 5 | ✅ Done |
| [US-021](./epic-6-security/US-021-preserve-environment.md) | Preserve Environment Feature | Could | 5 | ✅ Done |

### [Epic 7: Platform Improvements](./epic-7-improvements/) ✅

| Story | Title | Priority | Points | Status |
|-------|-------|----------|--------|--------|
| [US-022](./epic-7-improvements/US-022-ci-cd-performance.md) | CI/CD Pipeline Performance | Should | 5 | ✅ Done |
| [US-023](./epic-7-improvements/US-023-testing-framework.md) | Testing Framework Setup | Must | 8 | ✅ Done |
| [US-024](./epic-7-improvements/US-024-security-hardening.md) | Security Hardening | Should | 5 | ✅ Done |
| [US-025](./epic-7-improvements/US-025-documentation.md) | Developer Documentation | Should | 5 | ✅ Done |
| [US-026](./epic-7-improvements/US-026-observability-enhancements.md) | Observability Enhancements | Should | 8 | ✅ Done |
| [US-027](./epic-7-improvements/US-027-kubernetes-best-practices.md) | Kubernetes Best Practices | Could | 5 | ✅ Done |

### [Epic 8: Simplified Onboarding](./epic-8-simplified-onboarding/)

| Story | Title | Priority | Points | Status |
|-------|-------|----------|--------|--------|
| [US-028](./epic-8-simplified-onboarding/US-028-publish-helm-charts.md) | Publish Helm Charts to OCI Registry | Must | 5 | ✅ Done |
| [US-029](./epic-8-simplified-onboarding/US-029-generic-app-chart.md) | Create Generic Application Chart | Must | 8 | Draft |
| [US-030](./epic-8-simplified-onboarding/US-030-composite-actions.md) | Create Reusable Composite Actions | Must | 13 | Draft |
| [US-031](./epic-8-simplified-onboarding/US-031-reusable-workflow.md) | Create Reusable Workflow | Must | 8 | Draft |
| [US-032](./epic-8-simplified-onboarding/US-032-config-schema.md) | Define Configuration Schema | Must | 5 | Draft |
| [US-033](./epic-8-simplified-onboarding/US-033-documentation-dogfood.md) | Update Documentation & Dogfood | Should | 5 | Draft |

---

## Story Status Legend

- `Draft` - Story defined but not refined
- `Ready` - Story refined and ready for development
- `In Progress` - Currently being worked on
- `Done` - Completed and validated

## Prioritization (MoSCoW)

- **Must** - Critical for MVP (18 stories, 104 points)
- **Should** - Important but not blocking (12 stories, 59 points)
- **Could** - Nice to have (3 stories, 13 points)
- **Won't** - Out of scope for Phase 1

## Story Points Summary

| Priority | Stories | Total Points |
|----------|---------|--------------|
| Must | 18 | 104 |
| Should | 12 | 59 |
| Could | 3 | 13 |
| **Total** | **33** | **176** |
