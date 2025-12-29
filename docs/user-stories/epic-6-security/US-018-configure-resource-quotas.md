# US-018: Configure Resource Quotas

**Status:** Done

## User Story

**As an** SRE/DevOps engineer,
**I want** resource quotas configured for PR namespaces,
**So that** one PR cannot consume all cluster resources.

## Acceptance Criteria

- [ ] ResourceQuota template created for PR namespaces
- [ ] CPU limit per namespace: 1 core
- [ ] Memory limit per namespace: 2Gi
- [ ] Storage limit per namespace: 5Gi
- [ ] Pod count limit per namespace: 10
- [ ] Quotas enforced on pod creation

## Priority

**Should** - Important but not blocking

## Story Points

3

## Dependencies

- US-004: Create Namespace on PR Open

## Notes

- Quotas should be balanced to allow normal operation
- Consider LimitRange for default container limits
- Monitor quota usage to adjust if needed
