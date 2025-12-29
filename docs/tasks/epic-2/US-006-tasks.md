# Tasks for US-006: Create Unique Preview URL

## Tasks

### T-006.1: Create Ingress Manifest Template
- **Description:** Create Kubernetes Ingress for PR environment
- **Acceptance Criteria:**
  - Ingress manifest with templated host: `{project-id}-pr-{number}.preview.domain.com`
  - Routes to application Service
  - TLS configuration included
- **Estimate:** S

### T-006.2: Configure TLS for Ingress
- **Description:** Set up TLS certificate provisioning
- **Acceptance Criteria:**
  - cert-manager annotation or Traefik TLS config
  - Certificate requested automatically
  - HTTPS working on preview URL
- **Estimate:** M

### T-006.3: Add Ingress to Helm Chart
- **Description:** Include Ingress in application Helm chart
- **Acceptance Criteria:**
  - Ingress template in Helm chart
  - Host templated from values
  - TLS secret referenced
- **Estimate:** S

### T-006.4: Verify Public Accessibility
- **Description:** Test URL is accessible from internet
- **Acceptance Criteria:**
  - URL resolves to VPS IP
  - HTTPS connection successful
  - Application responds correctly
  - No firewall blocking
- **Estimate:** S

### T-006.5: Test Multiple Concurrent PRs
- **Description:** Verify multiple PR URLs work simultaneously
- **Acceptance Criteria:**
  - Open 2+ PRs
  - Each has unique URL
  - URLs don't conflict
  - Both accessible simultaneously
- **Estimate:** S

---

## Estimate Legend
- **XS:** < 1 hour
- **S:** 1-4 hours
- **M:** 4-8 hours (1 day)
- **L:** 2-3 days
- **XL:** 4-5 days
