# PRD: Kubernetes Ephemeral Environments Platform

**Version:** 1.0
**Date:** December 28, 2024
**Author:** Engineering Team
**Status:** Draft

---

## 1. Executive Summary

This document describes the implementation of a platform for ephemeral environments per Pull Request using Kubernetes. Each PR will have its own isolated environment (application + database + observability), accessible via public URL and automatically destroyed when the PR is closed/merged.

The project will be developed in two phases: **Phase 1** with a prototype on VPS (k3s) for operational model validation, followed by **Phase 2** with migration to Amazon EKS.

---

## 2. Problem

| # | Problem | Impact | How We'll Measure |
|---|---------|--------|-------------------|
| 1 | Review is slow because there's no public URL for testing | Elevated time-to-market | % of PRs with review < 4h |
| 2 | Devs overwrite shared staging environment | Defects escape to production | # of post-release hotfixes |
| 3 | PR logs/metrics are scattered | Slow and complex debugging | Average time to locate root cause |
| 4 | Test infrastructure is created manually | Inconsistent environments | # of incidents due to config differences |
| 5 | Reviewers need to run code locally | Slow feedback cycle | Average review time |

---

## 3. Objectives and Key Results (OKRs)

| Objective | Key Result |
|-----------|------------|
| **O1.** Every PR has an isolated environment | KR1.1: ≥ 95% of PRs with URL delivered in < 10 min |
| | KR1.2: Zero orphaned namespaces after 24h |
| **O2.** Predictable costs | KR2.1: Monthly VPS spending < US$ 120 |
| **O3.** Complete automation | KR3.1: 100% automated pipeline (zero manual intervention) |
| **O4.** Centralized observability | KR4.1: 100% of pods with logs/metrics accessible in Grafana |

---

## 4. Target Users

| Persona | Need |
|---------|------|
| **Developers** | Preview URL + logs to validate code before merge |
| **QAs** | Stable and isolated environment for exploratory testing |
| **Tech Lead / PM** | Visibility into cost, status, and lifetime of each environment |
| **SRE / DevOps** | Ensure resource cleanup and cluster stability |

---

## 5. Stakeholders

- **Tech Lead** — Architectural definition and technical validation
- **Engineering Team** — Development and operation
- **DevOps / Platform** — Infrastructure support and evolution

---

## 6. Scope

### 6.1 In Scope (Phase 1 - VPS)

- Single-node k3s cluster on VPS
- Namespace per PR with automated lifecycle via GitHub Actions
- Ephemeral database per PR (PostgreSQL in container or dedicated schema)
- Observability stack (Prometheus, Loki, Grafana)
- Self-hosted GitHub Actions runners in the cluster
- NetworkPolicies for isolation between PRs
- Setup and operation documentation

### 6.2 Out of Scope (Phase 1)

- High availability (multi-node)
- Node or runner autoscaling
- Performance benchmarking
- Disaster recovery
- Production environments
- Integration with AWS managed services (RDS, etc.)

### 6.3 Future (Phase 2 - EKS)

- Migration to Amazon EKS with node groups (spot + on-demand)
- RDS/Aurora per PR via Crossplane or AWS Controllers
- EFS with reclaimPolicy=Delete
- OPA/Gatekeeper for advanced policies
- Kubecost for cost management
- Multi-tenancy between systems

---

## 7. Proposed Architecture

### 7.1 Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     VPS (4 vCPU, 24GB RAM, 100GB NVMe)          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                        k3s Cluster                        │  │
│  │                                                           │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │  │
│  │  │observability│  │ arc-runners │  │ app-pr-123  │       │  │
│  │  │             │  │             │  │ (ephemeral) │       │  │
│  │  │ - Prometheus│  │ - Runner x2 │  │             │       │  │
│  │  │ - Loki      │  │             │  │ - App Pod   │       │  │
│  │  │ - Grafana   │  │             │  │ - DB Pod    │       │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘       │  │
│  │                                                           │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │  │
│  │  │ app-pr-456  │  │ app-pr-789  │  │   platform  │       │  │
│  │  │ (ephemeral) │  │ (ephemeral) │  │  (system)   │       │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘       │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Namespace Structure

| Namespace | Purpose | Lifecycle |
|-----------|---------|-----------|
| `kube-system` | k3s components | Permanent |
| `observability` | Prometheus, Loki, Grafana | Permanent |
| `arc-systems` | ARC controller (manages runner lifecycle) | Permanent |
| `arc-runners` | GitHub Actions self-hosted runner pods | Permanent |
| `platform` | Shared base components | Permanent |
| `{project-id}-pr-{number}` | Ephemeral environment per PR | Ephemeral (PR lifecycle) |

### 7.3 CI/CD Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  PR Open │────▶│  GitHub  │────▶│  Create  │────▶│  Deploy  │
│          │     │  Action  │     │Namespace │     │App + DB  │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                                                         │
                                                         ▼
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ PR Close │────▶│  GitHub  │────▶│  Delete  │◀────│  Preview │
│ or Merge │     │  Action  │     │Namespace │     │   URL    │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
```

---

## 8. Functional Requirements

### 8.1 Ephemeral Environments

| ID | Requirement | Priority |
|----|-------------|----------|
| RF-01 | Automatically create namespace when PR is opened | Must |
| RF-02 | Destroy namespace and volumes when PR is closed/merged (< 5 min) | Must |
| RF-03 | Unique URL per PR: `https://{project-id}-pr-{number}.preview.domain.com` | Must |
| RF-04 | Automatic re-deploy on new commit push | Must |
| RF-05 | Automatic comment on PR with preview URL and status | Should |
| RF-06 | Apply ResourceQuota and LimitRange to PR namespaces | Should |
| RF-07 | Allow environment "pin" via `preserve=true` label (max 48h) | Could |

### 8.2 Database

| ID | Requirement | Priority |
|----|-------------|----------|
| RF-08 | Isolated database instance per PR | Must |
| RF-09 | Exclusive credentials per PR stored in Secrets | Must |
| RF-10 | Database destruction along with namespace | Must |

### 8.3 Observability

| ID | Requirement | Priority |
|----|-------------|----------|
| RF-11 | Logs from all pods collected by Loki | Must |
| RF-12 | CPU/memory/network metrics collected by Prometheus | Must |
| RF-13 | Pre-configured dashboards in Grafana | Should |
| RF-14 | Basic alerts (disk, memory, pod restarts) | Could |

### 8.4 GitHub Runners

| ID | Requirement | Priority |
|----|-------------|----------|
| RF-15 | Auto-registered runners on GitHub | Must |
| RF-16 | Runners with cluster access via ServiceAccount | Must |
| RF-17 | Runners with kubectl, helm, docker installed | Must |
| RF-18 | Ephemeral runners (one per job) via ARC | Should |

---

## 9. Non-Functional Requirements

### 9.1 Performance

| ID | Requirement | Target |
|----|-------------|--------|
| RNF-01 | Environment creation time | ≤ 10 min (p95) |
| RNF-02 | Namespace destruction time | < 5 min |
| RNF-03 | Observability stack overhead | < 6 GB RAM |

### 9.2 Availability

| ID | Requirement | Target |
|----|-------------|--------|
| RNF-04 | Cluster uptime (business hours) | ≥ 95% |
| RNF-05 | Automatic recovery after VPS reboot | Yes |

### 9.3 Security

| ID | Requirement | Target |
|----|-------------|--------|
| RNF-06 | Secrets never in plain text in repos | 100% |
| RNF-07 | Network isolation between PRs (NetworkPolicy) | Required |
| RNF-08 | Short-lived GitHub tokens | Yes |
| RNF-09 | CIS Kubernetes Benchmark level 1 | Yes |

### 9.4 Capacity

| ID | Requirement | Target |
|----|-------------|--------|
| RNF-10 | Simultaneous PRs supported | ≥ 5 |
| RNF-11 | Log retention | 7 days |
| RNF-12 | Metric retention | 7 days |
| RNF-13 | Limits per PR namespace | Dynamic based on enabled databases (base: 300m CPU, 512Mi RAM; scales up with each database) |

---

## 10. Technology Stack

| Component | Technology | Justification |
|-----------|------------|---------------|
| **Kubernetes** | k3s | Lightweight, production-ready, ideal for single-node, includes containerd |
| **Ingress** | Traefik | Included in k3s, native Let's Encrypt support |
| **CI/CD** | GitHub Actions | Already used by the team, native integration |
| **Logs** | Loki + Promtail | Lightweight, native Grafana integration |
| **Metrics** | Prometheus | Industry standard, broad ecosystem |
| **Dashboards** | Grafana | Unified interface for logs and metrics |
| **Runners** | actions-runner-controller (ARC) | Ephemeral and scalable runners in the cluster |
| **DB Operator** | CloudNativePG | Manages PostgreSQL lifecycle in the cluster |
| **MariaDB** | mariadb:11 | Simple deployment for MySQL-compatible databases |
| **Secrets** | Sealed Secrets | Basic security, encrypted secrets in git |
| **Storage** | Local Path Provisioner | Simple, adequate for MVP using VPS NVMe |
| **DNS** | Wildcard | `*.preview.domain.com` → VPS IP |

---

## 11. Design Decisions

| Topic | Decision | Rationale |
|-------|----------|-----------|
| **K8s Runtime** | k3s | Fast install, small footprint, ideal for VPS |
| **DB per PR** | PostgreSQL via CloudNativePG | Complete isolation, automated lifecycle |
| **Storage** | Local Path Provisioner | Avoids CSI complexity; acceptable for MVP |
| **DNS** | Wildcard `*.preview.domain.com` | Avoids creating DNS record per PR |
| **Secrets** | Sealed Secrets | Allows versioning encrypted secrets |
| **Manifests** | Helm charts | Flexible templating, large community |

---

## 12. User Flow (Happy Path)

1. Dev creates branch `feat/new-feature` and opens PR
2. GitHub Actions detects `pull_request: opened` event
3. Pipeline creates namespace `{project-id}-pr-{number}` with ResourceQuota
4. Deploys application with image `:<sha>` + database
5. Ingress created; URL `{project-id}-pr-{number}.preview.domain.com` active
6. Bot comments on PR with preview URL and Grafana link
7. Dev/QA/Reviewer test and give feedback
8. Additional commits trigger automatic re-deploy
9. PR merged → Actions executes namespace cleanup
10. Loki/Prometheus data retained for 7 days for troubleshooting

---

## 13. Metrics and SLIs

### 13.1 Service Level Indicators (SLIs)

| SLI | Target |
|-----|--------|
| % of PRs with URL delivered in < 10 min | ≥ 95% |
| % of namespaces removed in < 5 min after close | ≥ 98% |
| % of pods with metrics/logs collected | ≥ 95% |

### 13.2 Observability Metrics

```promql
# Provisioning time
github_actions_workflow_run_duration_seconds{job="provision"}

# Resource usage vs allocated
kube_pod_container_resource_requests / node_allocatable

# API server availability
up{job="kubernetes-apiservers"}

# Disk usage
node_filesystem_avail_bytes / node_filesystem_size_bytes
```

---

## 14. Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| VPS without sufficient resources | Low | High | Monitor usage; limit simultaneous PRs; ResourceQuotas |
| Disk exhaustion (logs/images) | Medium | High | Aggressive retention (3-7 days); alerts at 80%; image cleanup job |
| Orphaned namespace not deleted | Medium | Low | Periodic cleanup job; alerts |
| VPS downtime | Medium | Medium | Daily snapshot; recovery runbook < 30 min |
| Forgotten "pin" exhausts resources | Low | Medium | Cron removes `preserve` after 48h; max quota of 3 pinned |
| Container escape | Low | High | Default deny NetworkPolicy; restricted PodSecurityStandard |
| Compromised GitHub token | Low | High | Short-lived tokens; periodic rotation |

---

## 15. Implementation Roadmap

### Phase 1: Foundation

| Task | Deliverable |
|------|-------------|
| Provision VPS | VPS accessible via SSH |
| Install and configure k3s | Functional cluster |
| Configure wildcard DNS | `*.preview.domain.com` |
| Document cluster access | Access runbook |

### Phase 2: CI/CD Pipeline

| Task | Deliverable |
|------|-------------|
| PR open workflow | Namespace automatically created |
| PR close workflow | Namespace automatically destroyed |
| Configure kubeconfig on GitHub | Actions with cluster access |
| Automatic PR comment | Preview URL on PR |

### Phase 3: Observability

| Task | Deliverable |
|------|-------------|
| Deploy Prometheus | Metrics collected |
| Deploy Loki + Promtail | Centralized logs |
| Deploy Grafana | Dashboards accessible |
| Create basic dashboards | Cluster overview |
| Configure alerts | Disk/memory alerts |

### Phase 4: Runners & Polish

| Task | Deliverable |
|------|-------------|
| Deploy GH runners in cluster | Operational runners |
| Configure ResourceQuotas | Limits per namespace |
| Configure NetworkPolicies | Isolation between PRs |
| Test with simultaneous PRs | Capacity validation |
| Final documentation | Complete runbooks |

### Phase 5: Simplified Onboarding (Epic 8)

| Task | Deliverable | Status |
|------|-------------|--------|
| Publish Helm charts to OCI registry | 5 charts (postgresql, mongodb, redis, minio, mariadb) at ghcr.io | ✅ Done |
| Create generic application chart | k8s-ee-app chart with OCI dependencies | ✅ Done |
| Create reusable composite actions | 7 modular actions (validate, setup, build, deploy, etc.) | ✅ Done |
| Create reusable workflow | `pr-environment-reusable.yml` callable from client repos | ✅ Done |
| Define configuration schema | JSON schema for k8s-ee.yaml validation | ✅ Done |
| Update documentation & dogfood | Simplified onboarding guide, this repo uses own system | ✅ Done |

---

## 16. Acceptance Criteria

The prototype will be considered successful when:

- [ ] Opened PR creates environment automatically without manual intervention
- [ ] Closed/merged PR destroys environment in < 5 min
- [ ] ≥ 5 devs can open PR and access URL without support
- [ ] Average provisioning time ≤ 10 min (p95 ≤ 15 min)
- [ ] No pod can ping pod from another namespace (e2e test)
- [ ] Grafana displays logs and metrics from ≥ 95% of pods
- [ ] Disk returns to pre-PR level after namespace destruction
- [ ] Monthly cost ≤ US$ 120 with normal operation
- [ ] 2 weeks of operation without critical incidents

---

## 17. Open Decisions

| Item | Options | Status |
|------|---------|--------|
| Database strategy | CloudNativePG vs. schema per PR in external DB | To be defined |
| Preview domain | Own subdomain vs. nip.io | To be defined |
| Post-PR retention policy | Destroy immediately vs. keep data 24h | To be defined |
| Grafana SSO | Basic auth vs. GitHub OAuth | To be defined |

---

## 18. References

- [k3s Documentation](https://docs.k3s.io/)
- [GitHub Actions: Self-hosted Runners](https://docs.github.com/en/actions/hosting-your-own-runners)
- [actions-runner-controller](https://github.com/actions-runner-controller/actions-runner-controller)
- [CloudNativePG](https://cloudnative-pg.io/)
- [Loki Stack Helm Chart](https://grafana.github.io/helm-charts)
- [Kube-Prometheus-Stack](https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack)
- [CIS Kubernetes Benchmark](https://www.cisecurity.org/benchmark/kubernetes)

---

## Appendix A: Provisioned Infrastructure

### A.1 VPS - Details

| Attribute | Value |
|-----------|-------|
| **Provider** | Oracle Cloud Infrastructure (OCI) |
| **Public IP** | `168.138.151.63` |
| **Hostname** | `genilda` |
| **SSH User** | `ubuntu` |
| **SSH Port** | `22` |
| **OS** | Ubuntu 24.04.3 LTS (Noble Numbat) |
| **Kernel** | 6.14.0-1018-oracle |
| **Architecture** | ARM64 (aarch64) |

### A.2 Hardware Resources

| Resource | Specification |
|----------|---------------|
| **vCPUs** | 4 |
| **RAM** | 24 GB |
| **Disk** | 96 GB (/) |
| **Swap** | 2 GB |

### A.3 SSH Access

```bash
ssh ubuntu@168.138.151.63
```

### A.4 ARM64 Considerations

The VPS uses ARM64 architecture. All container images must be multi-arch or have specific builds for `linux/arm64`:

- ✅ k3s: Native ARM64 support
- ✅ Traefik: Multi-arch
- ✅ Prometheus/Grafana/Loki: Multi-arch
- ⚠️ Application images: Verify/build for ARM64

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.1 | 12/28/2024 | Engineering Team | Added Appendix A with provisioned VPS details |
| 1.0 | 12/28/2024 | Engineering Team | Initial version (consolidation of 4 PRDs) |

---

## Approvals

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Tech Lead | | | |
| Engineering Manager | | | |
