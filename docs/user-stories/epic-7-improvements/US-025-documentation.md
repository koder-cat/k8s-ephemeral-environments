# US-025: Developer Documentation

**Status:** Done

## User Story

**As a** new team member,
**I want** comprehensive documentation,
**So that** I can onboard quickly and troubleshoot independently.

## Acceptance Criteria

- [x] Developer onboarding guide created
- [x] Demo-app documentation complete
- [x] Troubleshooting guide with decision tree
- [x] CONTRIBUTING.md with PR process
- [x] Cluster recovery runbook created
- [x] Helm chart documentation added

## Priority

**Should** - Important but not blocking

## Story Points

5

## Dependencies

- None (standalone improvement)

## Notes

- No single "Getting Started" document for new developers
- Demo-app has no README files
- No troubleshooting decision tree
- No CONTRIBUTING.md with PR process
- `docs/runbooks/cluster-recovery.md` referenced but not created

## Implementation

- **Developer Onboarding:**
  - Create `docs/DEVELOPER-ONBOARDING.md`
  - Cover: first-time setup, kubeconfig, Grafana access
  - Include common tasks workflow

- **Demo App Docs:**
  - Create `demo-app/README.md` - Overview, local setup
  - Create `demo-app/apps/api/README.md` - API docs, env vars
  - Create `demo-app/apps/web/README.md` - Frontend structure

- **Troubleshooting:**
  - Create `docs/guides/troubleshooting.md`
  - Include decision tree for common issues

- **Contribution Guide:**
  - Create `CONTRIBUTING.md` at project root
  - Cover: PR process, code style, sync scripts

- **Runbooks:**
  - Create `docs/runbooks/cluster-recovery.md`
  - Cover: VPS recovery, k3s reinstallation

- **Helm Chart Docs:**
  - Create `charts/demo-app/README.md`
