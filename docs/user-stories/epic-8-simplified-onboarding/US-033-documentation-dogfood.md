# US-033: Update Documentation and Dogfood

**Status:** Done

## User Story

**As a** platform user,
**I want** clear documentation and a working example,
**So that** I can quickly onboard my repository.

## Acceptance Criteria

- [x] `k8s-ee.yaml` added to this repository (dogfooding)
- [x] PR environment workflow updated to use reusable workflow
- [x] `docs/guides/onboarding-new-repo.md` simplified to new process
- [x] `docs/guides/k8s-ee-config-reference.md` created with full schema docs (completed in US-032)
- [x] Example configurations for common scenarios documented (completed in US-032)
- [x] Migration guide for existing users (if applicable)
- [x] README updated with new onboarding instructions

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

### Files Created/Modified

1. **`k8s-ee.yaml`** - Configuration file for this repository (dogfooding)
   - projectId: k8s-ee
   - PostgreSQL enabled
   - Health endpoint: /api/health
   - Metrics endpoint: /metrics
   - Image context: ./demo-app

2. **`.github/workflows/pr-environment.yml`** - Replaced 875-line workflow with 30-line thin caller
   - Uses local `./.github/workflows/pr-environment-reusable.yml`
   - Demonstrates how external repos should integrate

3. **`docs/guides/onboarding-new-repo.md`** - Simplified from 565 lines to 160 lines
   - 3-step quick start (config + workflow + Dockerfile)
   - Requirements table
   - Optional inputs section
   - Troubleshooting section

4. **`docs/guides/migration-guide.md`** - New migration guide for existing users
   - Before/after comparison
   - Step-by-step migration instructions
   - Value mapping reference
   - Cleanup instructions

5. **`README.md`** - Updated with Quick Start section
   - 3-step onboarding at the top
   - Links to documentation
   - Updated project status (Epic 8 complete)
