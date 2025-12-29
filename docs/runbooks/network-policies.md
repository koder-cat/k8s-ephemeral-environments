# Network Policies Operations

This runbook documents the NetworkPolicy configuration for PR namespace isolation.

## Overview

PR namespaces are isolated from each other using Kubernetes NetworkPolicies. The policies follow a "default deny, selectively allow" pattern for defense in depth.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Internet                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Traefik (kube-system)                        │
│                 ┌───────────────────────────┐                   │
│                 │ app.kubernetes.io/name:   │                   │
│                 │ traefik                   │                   │
│                 └───────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
                              │ allow-ingress-controller
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PR Namespace (k8s-ee-pr-N)                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   NetworkPolicies                        │   │
│  │  ┌─────────────────┐  ┌─────────────────────────────┐   │   │
│  │  │ default-deny    │  │ allow-same-namespace        │   │   │
│  │  │ (ingress+egress)│  │ (pod-to-pod in namespace)   │   │   │
│  │  └─────────────────┘  └─────────────────────────────┘   │   │
│  │  ┌─────────────────┐  ┌─────────────────────────────┐   │   │
│  │  │ allow-ingress-  │  │ allow-observability         │   │   │
│  │  │ controller      │  │ (Prometheus scraping)       │   │   │
│  │  └─────────────────┘  └─────────────────────────────┘   │   │
│  │  ┌─────────────────────────────────────────────────────┐│   │
│  │  │ allow-egress (DNS, K8s API, same-ns, external)      ││   │
│  │  └─────────────────────────────────────────────────────┘│   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌────────────┐        ┌────────────┐                           │
│  │  App Pod   │◄──────►│  DB Pod    │  (same-namespace allowed) │
│  └────────────┘        └────────────┘                           │
└─────────────────────────────────────────────────────────────────┘
        ▲                                    │
        │ allow-observability                │ allow-egress
        │                                    ▼
┌───────────────────────┐          ┌─────────────────────────────┐
│  Prometheus           │          │  External Services          │
│  (observability ns)   │          │  - DNS (kube-system:53)     │
│                       │          │  - K8s API (10.0.0.39:6443) │
│  app.kubernetes.io/   │          │  - Internet (0.0.0.0/0)     │
│  name: prometheus     │          └─────────────────────────────┘
└───────────────────────┘
```

## Policy Files

| File | Purpose |
|------|---------|
| `k8s/ephemeral/network-policy-default-deny.yaml` | Block all ingress/egress by default |
| `k8s/ephemeral/network-policy-allow-same-namespace.yaml` | Allow pod-to-pod within namespace |
| `k8s/ephemeral/network-policy-allow-ingress.yaml` | Allow Traefik ingress traffic |
| `k8s/ephemeral/network-policy-allow-observability.yaml` | Allow Prometheus scraping |
| `k8s/ephemeral/network-policy-allow-egress.yaml` | Allow DNS, K8s API, external internet |

## Verification

### Check policies in a namespace

```bash
kubectl get networkpolicy -n k8s-ee-pr-N
```

Expected output:
```
NAME                       POD-SELECTOR   AGE
allow-egress               <none>         1m
allow-ingress-controller   <none>         1m
allow-observability        <none>         1m
allow-same-namespace       <none>         1m
default-deny               <none>         1m
```

### Check iptables rules (on VPS)

```bash
sudo iptables -L | grep -i netpol | head -20
```

### Test same-namespace connectivity

```bash
# Get pod IPs
kubectl get pods -n k8s-ee-pr-N -o wide

# Test from app pod to database pod
kubectl exec -n k8s-ee-pr-N <app-pod> -- nc -z -w 2 <db-pod-ip> 5432
```

### Test cross-namespace is blocked

```bash
# Create test pod in another namespace
kubectl run test-pod -n default --image=busybox:1.36 --command -- sleep 3600

# Try to connect from PR namespace (should fail)
kubectl exec -n k8s-ee-pr-N <pod> -- nc -z -w 2 <default-ns-pod-ip> 8080
# Expected: timeout/connection refused
```

## Network Policy Enforcement

The cluster uses **kube-router** (bundled with k3s) for NetworkPolicy enforcement.

### Known Limitations

1. **ICMP (ping) is not filtered** - Only TCP/UDP traffic is filtered by kube-router
2. **Policy changes take a few seconds** - iptables rules are synced periodically

### Verify kube-router is working

```bash
# Check iptables chains exist
sudo iptables -L KUBE-NWPLCY-DEFAULT

# Check for policy rules
sudo iptables -L | grep "kube-router netpol"
```

## Troubleshooting

### App can't reach database

1. Check both pods are in the same namespace
2. Verify allow-same-namespace policy exists:
   ```bash
   kubectl get networkpolicy allow-same-namespace -n <namespace>
   ```
3. Check pod labels match the policy selector

### Preview URL not working

1. Check allow-ingress-controller policy exists
2. Verify Traefik pod has correct label:
   ```bash
   kubectl get pods -n kube-system -l app.kubernetes.io/name=traefik
   ```

### Prometheus can't scrape metrics

1. Check allow-observability policy exists
2. Verify Prometheus pod has correct label:
   ```bash
   kubectl get pods -n observability -l app.kubernetes.io/name=prometheus
   ```

### DNS resolution failing

1. Check allow-egress policy exists
2. Verify CoreDNS is running:
   ```bash
   kubectl get pods -n kube-system -l k8s-app=kube-dns
   ```
3. Test DNS from pod:
   ```bash
   kubectl exec -n <namespace> <pod> -- nslookup kubernetes.default
   ```

### External API calls failing

1. Verify allow-egress policy includes ipBlock for 0.0.0.0/0
2. Check the target IP is not in blocked ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)

## Security Considerations

1. **Default deny** - All traffic is blocked unless explicitly allowed
2. **Namespace isolation** - PR namespaces cannot communicate with each other
3. **Prometheus access** - Limited to pods with `app.kubernetes.io/name: prometheus` label
4. **Ingress access** - Limited to pods with `app.kubernetes.io/name: traefik` label
5. **Egress control** - Blocks cluster-internal traffic except DNS, K8s API, and same-namespace
6. **K8s API access** - Limited to port 6443 on 10.0.0.39 (k3s host, required for CNPG job status)

## References

- [Kubernetes NetworkPolicy](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
- [kube-router](https://www.kube-router.io/)
- [k3s Networking](https://docs.k3s.io/networking)
