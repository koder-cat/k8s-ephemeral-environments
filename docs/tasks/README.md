# Tasks Overview

This document provides an index of all tasks organized by epic and user story.

## Task Count Summary

| Epic | Stories | Tasks |
|------|---------|-------|
| Epic 1: Infrastructure Foundation | 3 | 17 |
| Epic 2: Ephemeral Environment Lifecycle | 5 | 28 |
| Epic 3: Database per PR | 2 | 10 |
| Epic 4: Observability | 4 | 22 |
| Epic 5: GitHub Runners | 3 | 17 |
| Epic 6: Resource Management & Security | 4 | 23 |
| Epic 7: Platform Improvements | 6 | 36 |
| Epic 8: Simplified Onboarding | 6 | 41 |
| **Total** | **33** | **194** |

---

## Epic 1: Infrastructure Foundation

| Story | Task File | Tasks |
|-------|-----------|-------|
| US-001: Provision VPS | [US-001-tasks.md](./epic-1/US-001-tasks.md) | 5 |
| US-002: Install k3s | [US-002-tasks.md](./epic-1/US-002-tasks.md) | 7 |
| US-003: Configure DNS | [US-003-tasks.md](./epic-1/US-003-tasks.md) | 5 |

## Epic 2: Ephemeral Environment Lifecycle

| Story | Task File | Tasks |
|-------|-----------|-------|
| US-004: Create Namespace | [US-004-tasks.md](./epic-2/US-004-tasks.md) | 6 |
| US-005: Deploy Application | [US-005-tasks.md](./epic-2/US-005-tasks.md) | 7 |
| US-006: Create Preview URL | [US-006-tasks.md](./epic-2/US-006-tasks.md) | 5 |
| US-007: Comment PR | [US-007-tasks.md](./epic-2/US-007-tasks.md) | 4 |
| US-008: Destroy on Close | [US-008-tasks.md](./epic-2/US-008-tasks.md) | 6 |

## Epic 3: Database per PR

| Story | Task File | Tasks |
|-------|-----------|-------|
| US-009: Create Database | [US-009-tasks.md](./epic-3/US-009-tasks.md) | 6 |
| US-010: Database Credentials | [US-010-tasks.md](./epic-3/US-010-tasks.md) | 4 |

## Epic 4: Observability

| Story | Task File | Tasks |
|-------|-----------|-------|
| US-011: Deploy Prometheus | [US-011-tasks.md](./epic-4/US-011-tasks.md) | 6 |
| US-012: Deploy Loki | [US-012-tasks.md](./epic-4/US-012-tasks.md) | 5 |
| US-013: Deploy Grafana | [US-013-tasks.md](./epic-4/US-013-tasks.md) | 6 |
| US-014: Configure Alerts | [US-014-tasks.md](./epic-4/US-014-tasks.md) | 5 |

## Epic 5: GitHub Runners

| Story | Task File | Tasks |
|-------|-----------|-------|
| US-015: Deploy ARC | [US-015-tasks.md](./epic-5/US-015-tasks.md) | 5 |
| US-016: Configure Runners | [US-016-tasks.md](./epic-5/US-016-tasks.md) | 6 |
| US-017: GitHub Access | [US-017-tasks.md](./epic-5/US-017-tasks.md) | 6 |

## Epic 6: Resource Management & Security

| Story | Task File | Tasks |
|-------|-----------|-------|
| US-018: Resource Quotas | [US-018-tasks.md](./epic-6/US-018-tasks.md) | 5 |
| US-019: Network Policies | [US-019-tasks.md](./epic-6/US-019-tasks.md) | 7 |
| US-020: Cleanup Job | [US-020-tasks.md](./epic-6/US-020-tasks.md) | 6 |
| US-021: Preserve Feature | [US-021-tasks.md](./epic-6/US-021-tasks.md) | 6 |

## Epic 7: Platform Improvements

| Story | Task File | Tasks |
|-------|-----------|-------|
| US-022: CI/CD Performance | [US-022-tasks.md](./epic-7/US-022-tasks.md) | 6 |
| US-023: Testing Framework | [US-023-tasks.md](./epic-7/US-023-tasks.md) | 6 |
| US-024: Security Hardening | [US-024-tasks.md](./epic-7/US-024-tasks.md) | 6 |
| US-025: Documentation | [US-025-tasks.md](./epic-7/US-025-tasks.md) | 6 |
| US-026: Observability Enhancements | [US-026-tasks.md](./epic-7/US-026-tasks.md) | 6 |
| US-027: K8s Best Practices | [US-027-tasks.md](./epic-7/US-027-tasks.md) | 6 |

## Epic 8: Simplified Onboarding

| Story | Task File | Tasks |
|-------|-----------|-------|
| US-028: Publish Helm Charts | [US-028-tasks.md](./epic-8/US-028-tasks.md) | 8 |
| US-029: Generic App Chart | [US-029-tasks.md](./epic-8/US-029-tasks.md) | TBD |
| US-030: Composite Actions | [US-030-tasks.md](./epic-8/US-030-tasks.md) | TBD |
| US-031: Reusable Workflow | [US-031-tasks.md](./epic-8/US-031-tasks.md) | TBD |
| US-032: Config Schema | [US-032-tasks.md](./epic-8/US-032-tasks.md) | TBD |
| US-033: Documentation & Dogfood | [US-033-tasks.md](./epic-8/US-033-tasks.md) | TBD |

---

## Estimate Legend

- **XS:** < 1 hour
- **S:** 1-4 hours
- **M:** 4-8 hours (1 day)
- **L:** 2-3 days
- **XL:** 4-5 days

## Task Status

- `Draft` - Story defined but not yet refined
- `To Do` - Not started
- `In Progress` - Currently being worked on
- `Done` - Completed
- `Blocked` - Waiting on dependency
