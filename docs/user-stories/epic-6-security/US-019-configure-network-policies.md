# US-019: Configure Network Policies

**Status:** Done

## User Story

**As an** SRE/DevOps engineer,
**I want** network isolation between PR namespaces,
**So that** pods from different PRs cannot communicate with each other.

## Acceptance Criteria

- [ ] Default deny policy for ingress traffic between PR namespaces
- [ ] Allow traffic within same namespace
- [ ] Allow traffic from ingress controller
- [ ] Allow traffic to observability stack
- [ ] Allow egress to external services (DNS, internet)

## Priority

**Should** - Important but not blocking

## Story Points

5

## Dependencies

- US-004: Create Namespace on PR Open

## Notes

- k3s uses Flannel by default, which supports NetworkPolicies
- Test thoroughly to avoid breaking legitimate traffic
- Consider using Calico if more features needed
