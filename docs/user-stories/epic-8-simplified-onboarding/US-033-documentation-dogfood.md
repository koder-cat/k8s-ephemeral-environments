# US-033: Update Documentation and Dogfood

**Status:** Draft

## User Story

**As a** platform user,
**I want** clear documentation and a working example,
**So that** I can quickly onboard my repository.

## Acceptance Criteria

- [ ] `k8s-ee.yaml` added to this repository (dogfooding)
- [ ] PR environment workflow updated to use reusable workflow
- [ ] `docs/guides/onboarding-new-repo.md` simplified to new process
- [x] `docs/guides/k8s-ee-config-reference.md` created with full schema docs (completed in US-032)
- [x] Example configurations for common scenarios documented (completed in US-032)
- [ ] Migration guide for existing users (if applicable)
- [ ] README updated with new onboarding instructions

## Priority

**Should** - Important for adoption

## Story Points

5

## Dependencies

- US-028: Publish Helm Charts to OCI Registry
- US-029: Create Generic Application Chart
- US-030: Create Reusable Composite Actions
- US-031: Create Reusable Workflow
- US-032: Define Configuration Schema

## Notes

- **This is the capstone story for Epic 8** - it integrates and validates all other stories
- Dogfooding validates the entire system works end-to-end
- Documentation should emphasize simplicity (config + workflow + Dockerfile)
- Include troubleshooting section for common issues
- Keep demo-app as reference implementation

## Implementation

_To be documented upon completion._
