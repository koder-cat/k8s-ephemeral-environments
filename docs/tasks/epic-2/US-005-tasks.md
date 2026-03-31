# Tasks for US-005: Deploy Application to PR Environment

## Tasks

### T-005.1: Create Docker Build Step
- **Description:** Add workflow step to build and push Docker image
- **Acceptance Criteria:**
  - Dockerfile exists or is created
  - Image built with tag: `<registry>/<app>:pr-<number>`
  - Image pushed to container registry (GHCR or DockerHub)
  - Build uses caching for speed
- **Estimate:** M

### T-005.2: Create Helm Chart for Application
- **Description:** Create Helm chart with templated values
- **Acceptance Criteria:**
  - Chart with Deployment, Service, ConfigMap templates
  - Values file with overridable parameters
  - Environment-specific values (PR number, image tag)
- **Estimate:** M

### T-005.3: Create Application ConfigMap Template
- **Description:** Define ConfigMaps for application configuration
- **Acceptance Criteria:**
  - ConfigMap with environment variables
  - Database connection string templated
  - App-specific configuration included
- **Estimate:** S

### T-005.4: Create Application Secrets
- **Description:** Set up secrets for sensitive configuration
- **Acceptance Criteria:**
  - Database credentials as Secret
  - API keys/tokens as Secrets (if needed)
  - Secrets referenced in Deployment
- **Estimate:** S

### T-005.5: Implement Helm Deploy Step
- **Description:** Add workflow step to deploy via Helm
- **Acceptance Criteria:**
  - `helm upgrade --install` command
  - Values passed for PR-specific config
  - Wait for rollout completion
  - Timeout configured
- **Estimate:** M

### T-005.6: Add Health Check Verification
- **Description:** Verify application is healthy after deploy
- **Acceptance Criteria:**
  - Wait for pods to be Ready
  - Optional: HTTP health check on endpoint
  - Fail workflow if health check fails
- **Estimate:** S

### T-005.7: Test Full Deploy Pipeline
- **Description:** End-to-end test of build and deploy
- **Acceptance Criteria:**
  - Open PR with code change
  - Image built and pushed
  - Application deployed and running
  - Total time < 10 minutes
- **Estimate:** M

---

## Estimate Legend
- **XS:** < 1 hour
- **S:** 1-4 hours
- **M:** 4-8 hours (1 day)
- **L:** 2-3 days
- **XL:** 4-5 days
