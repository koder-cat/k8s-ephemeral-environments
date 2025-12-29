# US-019: Configure Network Policies

**Status:** Done

## User Story

**As an** SRE/DevOps engineer,
**I want** network isolation between PR namespaces,
**So that** pods from different PRs cannot communicate with each other.

## Acceptance Criteria

- [x] Default deny policy for ingress traffic between PR namespaces
- [x] Allow traffic within same namespace
- [x] Allow traffic from ingress controller
- [x] Allow traffic to observability stack
- [x] Allow egress to external services (DNS, internet)

## Priority

**Should** - Important but not blocking

## Story Points

5

## Dependencies

- US-004: Create Namespace on PR Open

## Implementation

Five NetworkPolicy templates created in `k8s/ephemeral/`:

| Policy | Purpose |
|--------|---------|
| `network-policy-default-deny.yaml` | Block all ingress/egress by default |
| `network-policy-allow-same-namespace.yaml` | Allow pod-to-pod within namespace |
| `network-policy-allow-ingress.yaml` | Allow Traefik ingress traffic |
| `network-policy-allow-observability.yaml` | Allow Prometheus scraping |
| `network-policy-allow-egress.yaml` | Allow DNS, K8s API, external internet |

See `docs/runbooks/network-policies.md` for operations documentation.

## Notes

- k3s uses kube-router for NetworkPolicy enforcement
- ICMP (ping) is not filtered by kube-router - only TCP/UDP
- K8s API access uses host IP (10.0.0.39:6443) due to DNAT evaluation order
- Tested: cross-namespace TCP blocked, same-namespace allowed, ingress/egress working
