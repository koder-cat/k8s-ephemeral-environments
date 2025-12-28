# US-003: Configure Wildcard DNS

**Status:** Done

## User Story

**As an** SRE/DevOps engineer,
**I want** wildcard DNS configured for the preview domain,
**So that** PR environments are automatically accessible via unique URLs.

## Acceptance Criteria

- [x] Wildcard A record created: `*.k8s-ee.genesluna.dev` → `168.138.151.63`
- [x] DNS propagation verified
- [x] Test subdomain resolves correctly (e.g., test.k8s-ee.genesluna.dev)
- [x] TLS certificate strategy defined (Traefik ACME with DNS-01 via Cloudflare)

## Priority

**Must** - Critical for MVP

## Story Points

2

## Dependencies

- US-001: Provision VPS Server
- US-002: Install k3s (for Traefik)

## Implementation Details

### DNS Configuration

| Record | Type | Value | Proxy |
|--------|------|-------|-------|
| `*.k8s-ee` | A | `168.138.151.63` | OFF |
| `k8s-ee` | A | `168.138.151.63` | OFF |

**DNS Provider:** Cloudflare

### TLS Configuration

- **Strategy:** Traefik built-in ACME with DNS-01 challenge
- **Provider:** Cloudflare (API token stored in `cloudflare-api-token` secret)
- **Issuers:**
  - `letsencrypt-staging` - For testing (avoids rate limits)
  - `letsencrypt-prod` - For production certificates

### Files Created

| File | Purpose |
|------|---------|
| `k8s/traefik/traefik-config.yaml` | HelmChartConfig for Traefik ACME |

### Usage

To enable TLS on an IngressRoute, add:

```yaml
spec:
  tls:
    certResolver: letsencrypt-prod
    domains:
      - main: "*.k8s-ee.genesluna.dev"
```

## Notes

- Cloudflare proxy must be OFF for DNS-01 challenges to work
- Wildcard certificate covers all PR subdomains automatically
- Certificates are stored in Traefik's persistent volume at `/data/acme.json`
