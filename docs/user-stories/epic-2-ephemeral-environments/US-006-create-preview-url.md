# US-006: Create Unique Preview URL

## User Story

**As a** developer,
**I want** my PR environment accessible via a unique URL,
**So that** reviewers and QAs can access and test my changes.

## Acceptance Criteria

- [ ] Ingress created with URL pattern: `https://{project-id}-pr-{number}.preview.domain.com`
- [ ] TLS certificate provisioned (via cert-manager or Traefik)
- [ ] URL accessible from public internet
- [ ] URL returns application response (not 404/502)

## Priority

**Must** - Critical for MVP

## Story Points

5

## Dependencies

- US-003: Configure Wildcard DNS
- US-005: Deploy Application to PR Environment

## Notes

- Relies on wildcard DNS being configured
- TLS can be Let's Encrypt via cert-manager or Traefik's built-in ACME
