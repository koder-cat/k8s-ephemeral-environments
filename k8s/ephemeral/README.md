# Ephemeral PR Environment Templates

This directory contains Kubernetes manifests applied to each ephemeral PR namespace.

## Files

| File | Purpose |
|------|---------|
| `namespace-template.yaml` | Namespace with labels and annotations |
| `resource-quota.yaml` | Resource limits per namespace (US-018) |
| `limit-range.yaml` | Default container limits |
| `network-policy-*.yaml` | Network isolation policies (US-019) |

## Resource Quotas (US-018)

Applied limits per PR namespace:
- CPU: 1 core (500m requests)
- Memory: 2Gi (1Gi requests)
- Storage: 5Gi
- Pods: 10
- PVCs: 3

## Network Policies (US-019)

Defense-in-depth approach with 5 policies:

1. **default-deny** - Block all ingress/egress by default
2. **allow-same-namespace** - Allow pod-to-pod within namespace
3. **allow-ingress-controller** - Allow Traefik to route traffic
4. **allow-observability** - Allow Prometheus scraping
5. **allow-egress** - Allow DNS, same-namespace, and external internet

See [Network Policies Runbook](../docs/runbooks/network-policies.md) for details.

## Usage

These templates are applied automatically by the PR environment workflow:

```yaml
# In .github/workflows/pr-environment.yml
- name: Create namespace
  run: envsubst < k8s/ephemeral/namespace-template.yaml | kubectl apply -f -

- name: Apply ResourceQuota
  run: envsubst < k8s/ephemeral/resource-quota.yaml | kubectl apply -f -

- name: Apply LimitRange
  run: envsubst < k8s/ephemeral/limit-range.yaml | kubectl apply -f -

- name: Apply NetworkPolicies
  run: |
    for policy in k8s/ephemeral/network-policy-*.yaml; do
      envsubst < "$policy" | kubectl apply -f -
    done
```

## Template Variables

All templates use `envsubst` with these variables:
- `${PROJECT_ID}` - Project identifier (e.g., "k8s-ee")
- `${PR_NUMBER}` - Pull request number
- `${BRANCH_NAME}` - Sanitized branch name
- `${COMMIT_SHA}` - Full commit SHA
- `${CREATED_AT}` - ISO 8601 timestamp
