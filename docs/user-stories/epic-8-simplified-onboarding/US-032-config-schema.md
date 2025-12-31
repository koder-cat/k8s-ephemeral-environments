# US-032: Define Configuration Schema

**Status:** Done

## User Story

**As a** platform user,
**I want** a simple configuration file with sensible defaults,
**So that** I can get started with minimal configuration.

## Acceptance Criteria

- [ ] JSON Schema defined for k8s-ee.yaml validation
- [ ] `projectId` required (max 20 chars, lowercase alphanumeric + hyphens)
- [ ] `app.port` has default (3000)
- [x] `app.healthPath` has default (/health)
- [ ] `image.context` and `image.dockerfile` have defaults
- [ ] `resources` have sensible defaults within cluster limits
- [ ] `databases` all default to false (opt-in)
- [ ] Validation errors provide clear, actionable messages
- [ ] Schema documented in config reference guide

## Priority

**Must** - Required for simplified onboarding

## Story Points

5

## Dependencies

- None (can be done in parallel)

## Notes

- Minimal required config: just `projectId`
- Extended config for power users (custom resources, env vars, etc.)
- Schema validation runs early in workflow to fail fast
- Config reference guide with examples for common scenarios

## Implementation

### Schema Location
`.github/actions/validate-config/schema.json`

### Key Features
- **projectId validation**: Pattern `^[a-z0-9]([a-z0-9-]{0,18}[a-z0-9])?$`, max 20 chars
- **Sensible defaults**: All optional fields have production-ready defaults
- **Database toggles**: Boolean or object form for postgresql, mongodb, redis, minio, mariadb
- **envFrom support**: Reference secrets and configmaps for environment variables
- **Resource limits**: Defaults fit within cluster LimitRange (max 512Mi memory)

### Documentation
- [Configuration Reference](../../guides/k8s-ee-config-reference.md) - Complete schema documentation
- [Onboarding Guide](../../guides/onboarding-new-repo.md) - Quick start examples
