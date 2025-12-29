# US-005: Deploy Application to PR Environment

**Status:** Done

## User Story

**As a** developer,
**I want** my application deployed automatically to the PR namespace,
**So that** I can test my changes in a running environment.

## Acceptance Criteria

- [x] Application image built with commit SHA tag
- [x] Application deployed to PR namespace
- [x] ConfigMaps and Secrets created for the environment
- [x] Service created to expose the application
- [x] Health checks pass before marking deploy complete
- [x] Total deploy time < 10 minutes (including build)

## Priority

**Must** - Critical for MVP

## Story Points

8

## Dependencies

- US-004: Create Namespace on PR Open
- US-009: Create Isolated Database per PR

## Notes

- Use Helm chart or Kustomize for deployment
- Consider using GitHub Container Registry for images
- Deployment should be idempotent for re-deploys on new commits

## Implementation Details

### Demo Application
- **Location:** `demo-app/`
- **Stack:** NestJS (API) + Vite/React (frontend) monorepo with pnpm workspaces
- **Endpoints:**
  - `GET /api/health` - Health check
  - `GET /api/info` - PR environment info
  - `GET /` - React SPA

### Helm Chart
- **Location:** `charts/demo-app/`
- **Templates:** deployment, service, configmap, ingress, NOTES.txt
- **Security:** non-root user, read-only filesystem, dropped capabilities

### Workflow Jobs
- `build-and-push` - Builds Docker image and pushes to GHCR
- `deploy-application` - Deploys via Helm with health check

### Preview URL
- Pattern: `https://pr-{number}.k8s-ee.genesluna.dev`
- SSL: Let's Encrypt production certificates via Traefik DNS-01 challenge
