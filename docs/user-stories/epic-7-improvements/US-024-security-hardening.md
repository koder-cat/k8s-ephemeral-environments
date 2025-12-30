# US-024: Security Hardening

**Status:** Done

## User Story

**As a** platform operator,
**I want** security scanning and hardening,
**So that** vulnerabilities are detected before deployment.

## Acceptance Criteria

- [x] Container images scanned for CVEs (Trivy)
- [x] SBOM generated for supply chain transparency
- [x] All image tags pinned (no :latest)
- [x] NetworkPolicy restricts to specific ports
- [x] Security contexts on all workloads
- [x] Security model documented

## Priority

**Should** - Important but not blocking

## Story Points

5

## Dependencies

- None (standalone improvement)

## Notes

- No container image scanning currently
- No SBOM generation for supply chain security
- `bitnami/kubectl:latest` used in cleanup job (not reproducible)
- NetworkPolicy allows all ports from Traefik instead of specific app port
- MinIO and MongoDB lack explicit securityContext

## Implementation

- **CI Security:**
  - Add Trivy image scanning to `.github/workflows/pr-environment.yml`
  - Add SBOM generation with `anchore/sbom-action`

- **Image Pinning:**
  - Pin versions in `k8s/platform/cleanup-job/*.yaml`

- **NetworkPolicy:**
  - Add port restrictions to `k8s/ephemeral/network-policy-allow-ingress.yaml`

- **Security Contexts:**
  - Add runAsNonRoot, runAsUser, fsGroup to `charts/minio/` and `charts/mongodb/`

- **Documentation:**
  - Create `docs/guides/security.md` with security model
