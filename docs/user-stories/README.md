# User Stories Overview

This document provides an index of all user stories derived from the PRD.

## Summary

| Metric | Count |
|--------|-------|
| Total Epics | 6 |
| Total User Stories | 21 |
| **Completed** | **21** ✅ |
| Must Have | 12 |
| Should Have | 7 |
| Could Have | 2 |

**Phase 1 Status:** Complete - All 21 user stories implemented and deployed.

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

---

## Story Status Legend

- `Draft` - Story defined but not refined
- `Ready` - Story refined and ready for development
- `In Progress` - Currently being worked on
- `Done` - Completed and validated

## Prioritization (MoSCoW)

- **Must** - Critical for MVP (12 stories, 57 points)
- **Should** - Important but not blocking (7 stories, 31 points)
- **Could** - Nice to have (2 stories, 8 points)
- **Won't** - Out of scope for Phase 1

## Story Points Summary

| Priority | Stories | Total Points |
|----------|---------|--------------|
| Must | 12 | 57 |
| Should | 7 | 31 |
| Could | 2 | 8 |
| **Total** | **21** | **96** |
