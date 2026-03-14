# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-25)

**Core value:** Enable htm-gestor-documentos team to get fully functional PR preview environments (frontend + backend + Samba AD + PostgreSQL + MinIO) on AWS infrastructure in under 10 minutes
**Current focus:** Phase 4 - Multi-Container Support

## Current Position

Phase: 4 of 6 (Multi-Container Support)
Plan: 0 of 1 in current phase
Status: Ready to plan (Phases 1-3 done, Phase 2 done)
Last activity: 2026-03-14 - Phase 2 completed (ECR registry integration)

Progress: [======----] 60% (Phases 1-3 done, Phase 2 done, Phases 4-6 remaining)

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- VPS (k3s) over EKS for pilot: Faster setup, lower cost, proven architecture
- ECR over GHCR: **Decided ECR, implemented** — repo is private (must stay private), GHCR not viable. Registry-agnostic approach: same code supports both, selected by `registry-type` workflow input. No sync conflicts with upstream.
- Multi-container pod (not separate deployments): Matches client's existing pattern — **decision still open** (combined image also viable)
- PostgreSQL only (no MariaDB): Client doesn't need MariaDB
- Domain changed: `*.k8s-ee.edge.net.br` (was `*.preview.edge.ufal.br`)
- TLS via Let's Encrypt + Route 53 DNS challenge (was ACM)

### Open Decisions (as of 2026-03-14)

1. **Authentication:** Real Samba AD (Phase 4+5 required) vs mock auth (works now)
2. **Container strategy:** Combined single image vs multi-container pod (Phase 4 required)
3. ~~**Image registry:**~~ **Decided and implemented: ECR** — repo must stay private, registry-agnostic approach (no fork divergence)

### Pending Todos

None yet.

### Blockers/Concerns

**From Research:**
- Samba AD requires privileged container (P0 risk) - needs namespace security exception
- ~~ECR OIDC trust policy must handle both pull_request and push events~~ — **resolved**: using static IAM credentials (org secrets), not OIDC
- ~~ARM64 availability for Samba base image uncertain~~ — **resolved**: EC2 cluster is x86_64, Samba AD runs natively

## Session Continuity

Last session: 2026-03-14
Stopped at: Phase 2 complete (ECR registry integration); 2 open decisions remain (auth strategy, container strategy); ready to plan Phase 4
Resume file: None
