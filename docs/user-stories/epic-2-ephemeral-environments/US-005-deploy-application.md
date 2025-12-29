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
- **Image pinning:** Supports digest-based references for immutable deployments

### Workflow Jobs
- `build-and-push` - Builds Docker image and pushes to GHCR
- `deploy-application` - Deploys via Helm with health check and image digest

### Preview URL
- Pattern: `https://{project-id}-pr-{number}.k8s-ee.genesluna.dev`
- Example: `https://k8s-ee-pr-28.k8s-ee.genesluna.dev`
- Multi-tenant: PROJECT_ID prevents URL collisions across projects
- SSL: Let's Encrypt production certificates via Traefik DNS-01 challenge

### Security Hardening
- **Dockerfile:** Multi-stage build with production-only dependencies (no devDependencies)
- **RBAC:** Minimal permissions (no pods/exec)
- **kubectl:** SHA256 verification on download, pinned version
- **NestJS:** Graceful shutdown hooks, bootstrap error handling
- **Helmet:** CSP configured for SPA compatibility
- **TypeScript:** Strict mode enabled
- **Namespace ownership:** Verification via managed-by label + repository annotation
- **Command injection:** Prevented via env block for user-controlled inputs

### Enterprise Features
- **Multi-tenant clusters:** PROJECT_ID prefix prevents namespace collisions
- **PROJECT_ID validation:** Lowercase alphanumeric with hyphens, 1-20 chars
- **Atomic deployments:** Helm --atomic flag for automatic rollback on failure
- **Failed release cleanup:** Automatic cleanup of stuck Helm releases
- **Consistent labels:** k8s-ee/project-id, k8s-ee/pr-number on all resources
