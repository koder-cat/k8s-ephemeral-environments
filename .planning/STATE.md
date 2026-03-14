# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-25)

**Core value:** Enable htm-gestor-documentos team to get fully functional PR preview environments (frontend + backend + Samba AD + PostgreSQL + MinIO) on AWS infrastructure in under 10 minutes
**Current focus:** Phase 1 - Platform Fixes & x86 Support

## Current Position

Phase: 2 of 6 (ECR Registry Integration)
Plan: 0 of 1 in current phase
Status: Ready to plan (ECR decided, registry-agnostic approach)
Last activity: 2026-03-14 - Phases 1 and 3 completed; integration doc updated

Progress: [=====-----] 50% (Phases 1 + 3 done, Phase 2 decision pending, Phases 4-6 remaining)

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
- ECR over GHCR: **Decided ECR** — repo is private (must stay private), GHCR not viable. Registry-agnostic approach: same code supports both, selected by `REGISTRY` repo variable. No sync conflicts with upstream.
- Multi-container pod (not separate deployments): Matches client's existing pattern — **decision still open** (combined image also viable)
- PostgreSQL only (no MariaDB): Client doesn't need MariaDB
- Domain changed: `*.k8s-ee.edge.net.br` (was `*.preview.edge.ufal.br`)
- TLS via Let's Encrypt + Route 53 DNS challenge (was ACM)

### Open Decisions (as of 2026-03-14)

1. **Authentication:** Real Samba AD (Phase 4+5 required) vs mock auth (works now)
2. **Container strategy:** Combined single image vs multi-container pod (Phase 4 required)
3. ~~**Image registry:**~~ **Decided: ECR** — repo must stay private, registry-agnostic approach (no fork divergence)

### Pending Todos

None yet.

### Blockers/Concerns

**From Research:**
- Samba AD requires privileged container (P0 risk) - needs namespace security exception
- ECR OIDC trust policy must handle both pull_request and push events
- ~~ARM64 availability for Samba base image uncertain~~ — **resolved**: EC2 cluster is x86_64, Samba AD runs natively

## Session Continuity

Last session: 2026-03-14
Stopped at: Phase 3 complete; integration doc updated; 3 open decisions documented; ready to plan Phase 1
Resume file: None
