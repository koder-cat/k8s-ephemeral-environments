# Preliminary Cloud Infrastructure Cost Analysis

**Version:** 1.0
**Date:** January 2025
**Author:** Engineering Team
**Status:** Draft - For Planning Purposes

---

## Executive Summary

This document provides a comprehensive cost analysis for scaling the k8s-ephemeral-environments platform from the current free-tier Oracle Cloud VPS to a production-grade cloud infrastructure capable of supporting **50 simultaneous PR environments at 80% utilization**.

### Key Findings

| Cloud Provider | Monthly Cost (On-Demand) | Monthly Cost (Reserved/Committed) | Cost per PR |
|----------------|--------------------------|-----------------------------------|-------------|
| **Oracle Cloud** | $577 | $304 | $6-12 |
| **GCP** | $915 | $682 | $14-18 |
| **Azure** | $1,253 | $842 | $17-25 |
| **AWS** | $1,344 | $965 | $19-27 |

**Recommendation:** Oracle Cloud remains the most cost-effective option, offering 40-60% savings compared to AWS/GCP/Azure, primarily due to free NAT Gateway, free egress (10TB/month), and competitive compute pricing.

---

## Table of Contents

1. [Current Infrastructure Analysis](#1-current-infrastructure-analysis)
2. [Resource Requirements for 50 PRs](#2-resource-requirements-for-50-prs)
3. [Multi-Architecture Considerations](#3-multi-architecture-considerations)
4. [Cloud Provider Comparison](#4-cloud-provider-comparison)
   - [AWS (EKS)](#41-aws-eks)
   - [GCP (GKE)](#42-gcp-gke)
   - [Azure (AKS)](#43-azure-aks)
   - [Oracle Cloud (OKE)](#44-oracle-cloud-oke)
5. [Hidden Costs Analysis](#5-hidden-costs-analysis)
6. [Capacity Planning](#6-capacity-planning)
7. [Recommendations](#7-recommendations)
8. [Sources](#8-sources)

---

## 1. Current Infrastructure Analysis

### 1.1 Current VPS Specifications

| Specification | Value |
|---------------|-------|
| **Provider** | Oracle Cloud Infrastructure (OCI) |
| **Instance Type** | VM.Standard.A1.Flex (ARM) |
| **vCPUs** | 4 OCPU (4 vCPU on ARM) |
| **RAM** | 24 GB |
| **Storage** | 96 GB NVMe |
| **Cost** | **$0/month** (Always Free Tier) |
| **Architecture** | ARM64 (Ampere A1) |
| **OS** | Ubuntu 24.04 LTS |

### 1.2 Current Resource Utilization

Based on actual cluster measurements (`kubectl top nodes`):

| Metric | Used | Available | Utilization |
|--------|------|-----------|-------------|
| **CPU** | 216m | 4000m | **5%** |
| **Memory** | 6.3 GB | 24 GB | **26%** |
| **Disk** | 38 GB | 96 GB | **40%** |

### 1.3 Current Workload (4 PR Environments)

| Namespace | Actual CPU | Quota Limit | Actual Memory | Quota Limit |
|-----------|------------|-------------|---------------|-------------|
| k8s-ee-pr-90 | 34m | 3565m | 394Mi | 3532Mi |
| todo-app-pr-2 | 7m | 1265m | 91Mi | 1766Mi |
| todo-app-dotnet-pr-2 | 9m | 1265m | 116Mi | 1766Mi |
| todo-app-java-pr-2 | 0m | 1840m | 0Mi | 1913Mi |
| **observability** | 195m | - | 2086Mi | - |

**Key Insight:** Applications use only **1-3% of their allocated quota** at rest. The observability stack (Prometheus, Loki, Grafana) consumes the majority of baseline resources.

### 1.4 Current VPS Capacity Limits

| Scenario | Max PRs | Limiting Factor |
|----------|---------|-----------------|
| Idle/demo apps | 20-25 | Memory |
| Light load (1-2 active builds) | 15-18 | Memory |
| Moderate load (active testing) | 10-12 | CPU |
| Heavy load (stress testing) | 6-8 | CPU |

---

## 2. Resource Requirements for 50 PRs

### 2.1 Per-PR Resource Consumption

Based on actual cluster measurements:

| State | CPU | Memory | Storage |
|-------|-----|--------|---------|
| **Idle** | 15m | 150Mi | 3Gi avg |
| **Active (moderate load)** | 500m | 800Mi | 3Gi avg |
| **Active (heavy load)** | 1000m | 1.5Gi | 5Gi avg |

### 2.2 Database Resource Requirements

Per the dynamic quota system in `k8s/ephemeral/resource-quota.yaml`:

| Database | CPU Addition | Memory Addition | Storage Addition |
|----------|--------------|-----------------|------------------|
| Base App | 300m | 512Mi | 1Gi |
| PostgreSQL | +500m | +512Mi | +2Gi |
| MongoDB | +500m | +512Mi | +2Gi |
| Redis | +200m | +128Mi | - |
| MinIO | +500m | +512Mi | +2Gi |
| MariaDB | +300m | +256Mi | +2Gi |
| **All DBs** | 2100m | 2432Mi | 9Gi |

### 2.3 Total Resource Calculation for 50 PRs at 80% Utilization

**Assumption:** 80% utilization = 40 active PRs + 10 idle PRs at any given time.

| Component | CPU | Memory |
|-----------|-----|--------|
| 40 active PRs (avg with PostgreSQL) | 40 × 500m = 20,000m | 40 × 800Mi = 32Gi |
| 10 idle PRs | 10 × 15m = 150m | 10 × 150Mi = 1.5Gi |
| Observability stack (scaled) | 1,500m | 8Gi |
| **Subtotal** | **21,650m** | **41.5Gi** |
| **+25% headroom** | **~28 cores** | **~52Gi** |

### 2.4 Storage Requirements

| Component | Storage |
|-----------|---------|
| Prometheus PVC | 10Gi |
| Loki PVC | 5Gi |
| Grafana PVC | 2Gi |
| Alertmanager PVC | 1Gi |
| 50 PRs × 3Gi average | 150Gi |
| **Total** | **~170-200Gi** |

### 2.5 Final Resource Target

| Resource | Minimum Required | Recommended (with headroom) |
|----------|------------------|----------------------------|
| **vCPUs** | 22 cores | 32 cores |
| **Memory** | 42 GB | 64-128 GB |
| **Storage** | 170 GB | 200 GB |

---

## 3. Multi-Architecture Considerations

### 3.1 ARM vs x86 Support by Cloud Provider

| Cloud | ARM Support | ARM Regions | ARM Instance Types | Maturity |
|-------|-------------|-------------|-------------------|----------|
| **AWS** | Excellent | All major | Graviton3/4 (m7g, c7g, r7g) | Production-ready |
| **Oracle** | Good | All regions | Ampere A1 Flex | Production-ready |
| **GCP** | Limited | 5 regions only | Tau T2A | Preview/Limited |
| **Azure** | Limited | 14 regions | Cobalt 100 (Dpsv6) | Recently GA |

### 3.2 GCP ARM Limitations

GCP Tau T2A instances are only available in:
- us-central1 (Iowa)
- us-east1 (South Carolina)
- us-west1 (Oregon)
- europe-west4 (Netherlands)
- asia-southeast1 (Singapore)

**Impact:** Not suitable for global deployments requiring ARM consistency.

### 3.3 Azure ARM Limitations

Azure Cobalt 100 VMs (Dpsv6/Dpdsv6) are available in 14 regions:
- Canada Central, Central US, East US, East US 2
- Germany West Central, Japan East, Mexico Central
- North Europe, Southeast Asia, Sweden Central
- Switzerland North, UAE North, West Europe, West US 2

**Impact:** Better coverage than GCP, but still limited compared to x86.

### 3.4 Recommendation

**Favor x86 for maximum compatibility.** Use ARM only when:
- Deploying to AWS (mature Graviton ecosystem)
- Deploying to Oracle Cloud (all-region Ampere A1 support)
- Cost savings are critical (ARM is 12-30% cheaper)

**Hybrid Strategy:** Build multi-arch container images, deploy x86 initially, add ARM nodes later for cost optimization.

---

## 4. Cloud Provider Comparison

### 4.1 AWS (EKS)

#### 4.1.1 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        AWS EKS                              │
│  ┌─────────────────┐  ┌─────────────────────────────────┐  │
│  │  EKS Control    │  │         VPC                      │  │
│  │  Plane ($73/mo) │  │  ┌─────────────────────────────┐ │  │
│  └─────────────────┘  │  │  Private Subnets (2 AZs)    │ │  │
│                       │  │  ┌─────────┐  ┌─────────┐   │ │  │
│  ┌─────────────────┐  │  │  │ Worker  │  │ Worker  │   │ │  │
│  │  ALB Ingress    │  │  │  │ Node 1  │  │ Node 2  │   │ │  │
│  │  ($48/mo)       │  │  │  │m6i.4xl  │  │m6i.4xl  │   │ │  │
│  └─────────────────┘  │  │  └─────────┘  └─────────┘   │ │  │
│                       │  └─────────────────────────────┘ │  │
│  ┌─────────────────┐  │  ┌─────────────────────────────┐ │  │
│  │  NAT Gateway    │  │  │  Public Subnets             │ │  │
│  │  ($66-132/mo)   │  │  │  (NAT, ALB)                 │ │  │
│  └─────────────────┘  │  └─────────────────────────────┘ │  │
│                       └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

#### 4.1.2 Instance Options

| Instance | vCPUs | Memory | Arch | On-Demand/hr | Spot/hr | Reserved (1yr) |
|----------|-------|--------|------|--------------|---------|----------------|
| m7g.4xlarge | 16 | 64 GB | ARM | $0.6528 | $0.32 | $0.432 |
| m6i.4xlarge | 16 | 64 GB | x86 | $0.768 | $0.262 | $0.508 |
| m7i.4xlarge | 16 | 64 GB | x86 | $0.806 | $0.28 | $0.533 |

#### 4.1.3 Cost Breakdown (x86 - Production Ready)

| Item | Specification | Monthly Cost |
|------|---------------|--------------|
| EKS Control Plane | 1 cluster @ $0.10/hr | $73 |
| EC2 Workers | 2× m6i.4xlarge (32 vCPU, 128GB) | $1,121 |
| NAT Gateway | 2× for HA @ $0.045/hr each | $66 |
| NAT Data Processing | ~200 GB @ $0.045/GB | $9 |
| Application Load Balancer | 1 ALB + ~5 LCU average | $48 |
| EBS Storage | 200 GB gp3 @ $0.08/GB | $16 |
| Route 53 | 1 hosted zone + queries | $2 |
| Data Transfer Out | ~100 GB @ $0.09/GB | $9 |
| **Total (On-Demand)** | | **$1,344/mo** |
| **Total (1-Year Reserved)** | | **$965/mo** |
| **Total (Spot - 70% workload)** | | **$650/mo** |

#### 4.1.4 AWS ARM Option (m7g.4xlarge)

| Item | On-Demand | Reserved (1yr) |
|------|-----------|----------------|
| EC2 Workers (ARM) | $953 | $631 |
| Other infrastructure | $223 | $223 |
| **Total** | **$1,176/mo** | **$854/mo** |

**Savings with ARM:** ~12% compared to x86

---

### 4.2 GCP (GKE)

#### 4.2.1 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        GCP GKE                              │
│  ┌─────────────────┐  ┌─────────────────────────────────┐  │
│  │  GKE Control    │  │         VPC                      │  │
│  │  Plane (FREE*)  │  │  ┌─────────────────────────────┐ │  │
│  └─────────────────┘  │  │  Private Subnets (2 Zones)  │ │  │
│  * $74.40 credit/mo   │  │  ┌─────────┐  ┌─────────┐   │ │  │
│                       │  │  │ Worker  │  │ Worker  │   │ │  │
│  ┌─────────────────┐  │  │  │ Node 1  │  │ Node 2  │   │ │  │
│  │  Cloud LB       │  │  │  │n2-std-16│  │n2-std-16│   │ │  │
│  │  ($18/mo)       │  │  │  └─────────┘  └─────────┘   │ │  │
│  └─────────────────┘  │  └─────────────────────────────┘ │  │
│                       │  ┌─────────────────────────────┐ │  │
│  ┌─────────────────┐  │  │  Cloud NAT                  │ │  │
│  │  Cloud NAT      │  │  │  ($64+/mo)                  │ │  │
│  │  ($64+/mo)      │  │  └─────────────────────────────┘ │  │
│  └─────────────────┘  └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

#### 4.2.2 Instance Options

| Instance | vCPUs | Memory | Arch | On-Demand/hr | Spot/hr | Committed (1yr) |
|----------|-------|--------|------|--------------|---------|-----------------|
| t2a-standard-16 | 16 | 64 GB | ARM | $0.616 | ~$0.25 | $0.43 |
| e2-standard-16 | 16 | 64 GB | x86 | $0.604 | $0.21 | $0.42 |
| n2-standard-16 | 16 | 64 GB | x86 | $0.778 | $0.24 | $0.54 |

#### 4.2.3 GKE Pricing Models

**Standard Mode:**
- Pay for VMs (Compute Engine instances)
- Cluster management fee: $0.10/hr ($72/mo)
- First cluster free ($74.40 monthly credit)

**Autopilot Mode:**
- Pay per pod resources
- CPU: ~$0.04/vCPU-hr
- Memory: ~$0.004/GB-hr
- No node management required

#### 4.2.4 Cost Breakdown (x86 - Standard Mode)

| Item | Specification | Monthly Cost |
|------|---------------|--------------|
| GKE Control Plane | 1 cluster (free credit covers) | $0 |
| Compute Engine | 2× n2-standard-16 (32 vCPU, 128GB) | $778 |
| Cloud NAT | 2× for HA | $64 |
| NAT Data Processing | ~200 GB @ $0.045/GB | $9 |
| Cloud Load Balancer | 5 forwarding rules @ $0.025/hr | $18 |
| Persistent Disk | 200 GB SSD @ $0.17/GB | $34 |
| Data Transfer Out | ~100 GB @ $0.12/GB | $12 |
| **Total (On-Demand)** | | **$915/mo** |
| **Total (1-Year Committed)** | | **$682/mo** |
| **Total (Spot - 70% workload)** | | **$450/mo** |

#### 4.2.5 GKE Autopilot Estimate

| Resource | Usage | Rate | Monthly Cost |
|----------|-------|------|--------------|
| CPU | ~22 vCPU average | $0.04/vCPU-hr | $642 |
| Memory | ~52 GB average | $0.004/GB-hr | $152 |
| Ephemeral Storage | 100 GB | $0.01/GB-hr | $73 |
| **Total (Autopilot)** | | | **$867/mo** |

---

### 4.3 Azure (AKS)

#### 4.3.1 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Azure AKS                            │
│  ┌─────────────────┐  ┌─────────────────────────────────┐  │
│  │  AKS Control    │  │         VNet                     │  │
│  │  Plane (FREE*)  │  │  ┌─────────────────────────────┐ │  │
│  └─────────────────┘  │  │  Private Subnets (2 AZs)    │ │  │
│  * No SLA on free tier│  │  ┌─────────┐  ┌─────────┐   │ │  │
│                       │  │  │ Worker  │  │ Worker  │   │ │  │
│  ┌─────────────────┐  │  │  │ Node 1  │  │ Node 2  │   │ │  │
│  │  Standard LB    │  │  │  │D16s_v5  │  │D16s_v5  │   │ │  │
│  │  ($18/mo)       │  │  │  └─────────┘  └─────────┘   │ │  │
│  └─────────────────┘  │  └─────────────────────────────┘ │  │
│                       │  ┌─────────────────────────────┐ │  │
│  ┌─────────────────┐  │  │  NAT Gateway               │ │  │
│  │  NAT Gateway    │  │  │  ($66+/mo)                 │ │  │
│  │  ($66+/mo)      │  │  └─────────────────────────────┘ │  │
│  └─────────────────┘  └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

#### 4.3.2 AKS Pricing Tiers

| Tier | Control Plane Cost | SLA | Max Nodes | Best For |
|------|-------------------|-----|-----------|----------|
| **Free** | $0 | None | ~10 recommended | Dev/Test |
| **Standard** | $0.10/hr (~$73/mo) | 99.9-99.95% | 5,000 | Production |
| **Premium** | $0.60/hr (~$438/mo) | 99.9-99.95% + LTS | 5,000 | Enterprise |

#### 4.3.3 Instance Options

| Instance | vCPUs | Memory | Arch | On-Demand/hr | Spot/hr | Reserved (1yr) |
|----------|-------|--------|------|--------------|---------|----------------|
| D16ps_v5 | 16 | 64 GB | ARM | ~$0.62 | ~$0.15 | ~$0.40 |
| D16s_v5 | 16 | 64 GB | x86 | $0.768 | $0.176 | ~$0.49 |
| D16as_v5 | 16 | 64 GB | x86 AMD | $0.688 | $0.158 | ~$0.44 |

#### 4.3.4 Cost Breakdown (x86 - Free Tier AKS)

| Item | Specification | Monthly Cost |
|------|---------------|--------------|
| AKS Control Plane | Free tier (no SLA) | $0 |
| Azure VMs | 2× D16s_v5 (32 vCPU, 128GB) | $1,121 |
| NAT Gateway | 2× for HA @ $0.045/hr | $66 |
| NAT Data Processing | ~200 GB @ $0.045/GB | $9 |
| Standard Load Balancer | 5 rules @ $0.025/hr | $18 |
| Managed Disk | 200 GB Premium SSD | $30 |
| Data Transfer Out | ~100 GB @ $0.087/GB | $9 |
| **Total (On-Demand, Free AKS)** | | **$1,253/mo** |
| **Total (1-Year Reserved)** | | **$842/mo** |
| **Total (Spot - 70% workload)** | | **$500/mo** |

#### 4.3.5 With AKS Standard Tier (+SLA)

| Item | Monthly Cost |
|------|--------------|
| Add AKS Standard tier | +$73 |
| **Total (On-Demand)** | **$1,326/mo** |
| **Total (Reserved)** | **$915/mo** |

---

### 4.4 Oracle Cloud (OKE)

#### 4.4.1 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Oracle Cloud OKE                        │
│  ┌─────────────────┐  ┌─────────────────────────────────┐  │
│  │  OKE Control    │  │         VCN                      │  │
│  │  Plane (FREE)   │  │  ┌─────────────────────────────┐ │  │
│  └─────────────────┘  │  │  Private Subnets            │ │  │
│                       │  │  ┌─────────┐  ┌─────────┐   │ │  │
│  ┌─────────────────┐  │  │  │ Worker  │  │ Worker  │   │ │  │
│  │  Flexible LB    │  │  │  │ Node 1  │  │ Node 2  │   │ │  │
│  │  ($10/mo)       │  │  │  │E4.Flex  │  │E4.Flex  │   │ │  │
│  └─────────────────┘  │  │  └─────────┘  └─────────┘   │ │  │
│                       │  └─────────────────────────────┘ │  │
│  ┌─────────────────┐  │  ┌─────────────────────────────┐ │  │
│  │  NAT Gateway    │  │  │  Service Gateway            │ │  │
│  │  (INCLUDED)     │  │  │  (FREE)                     │ │  │
│  └─────────────────┘  │  └─────────────────────────────┘ │  │
│                       └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

#### 4.4.2 Oracle Cloud Unique Advantages

| Feature | Oracle Cloud | Other Clouds |
|---------|--------------|--------------|
| **NAT Gateway** | Included in VCN | $66-132/mo |
| **Egress** | 10 TB/month FREE | $0.087-0.12/GB |
| **Control Plane** | FREE | $0-73/mo |
| **ARM Pricing** | $0.01/OCPU-hr | $0.04-0.065/vCPU-hr |
| **x86 Pricing** | $0.025/OCPU-hr | $0.04-0.05/vCPU-hr |

#### 4.4.3 Instance Options

| Instance | OCPUs | vCPUs Equiv | Memory | Arch | On-Demand/hr |
|----------|-------|-------------|--------|------|--------------|
| VM.Standard.A1.Flex | 16 | 16 | 64 GB | ARM | $0.16 + $0.096 = $0.256 |
| VM.Standard.E4.Flex | 16 | 32 | 64 GB | x86 | $0.40 + $0.096 = $0.496 |
| VM.Standard.E5.Flex | 16 | 32 | 64 GB | x86 | $0.48 + $0.128 = $0.608 |

**Oracle OCPU Note:** 1 OCPU = 2 vCPUs on x86, 1 OCPU = 1 vCPU on ARM

#### 4.4.4 Cost Breakdown (ARM - Ampere A1)

| Item | Specification | Monthly Cost |
|------|---------------|--------------|
| OKE Control Plane | Free | $0 |
| Compute (A1 Flex) | 32 OCPU @ $0.01/hr + 128GB @ $0.0015/GB-hr | $374 |
| NAT Gateway | Included in VCN | $0 |
| Flexible Load Balancer | 10 Mbps | $10 |
| Block Storage | 200 GB @ $0.10/GB | $20 |
| Data Transfer Out | 10 TB free/month | $0 |
| **Total (On-Demand)** | | **$404/mo** |
| **Total (Preemptible - 50% off)** | | **$217/mo** |

#### 4.4.5 Cost Breakdown (x86 - E4 Flex)

| Item | Specification | Monthly Cost |
|------|---------------|--------------|
| OKE Control Plane | Free | $0 |
| Compute (E4 Flex) | 16 OCPU @ $0.025/hr + 128GB @ $0.0015/GB-hr | $547 |
| NAT Gateway | Included in VCN | $0 |
| Flexible Load Balancer | 10 Mbps | $10 |
| Block Storage | 200 GB @ $0.10/GB | $20 |
| Data Transfer Out | 10 TB free/month | $0 |
| **Total (On-Demand)** | | **$577/mo** |
| **Total (Preemptible - 50% off)** | | **$304/mo** |

---

## 5. Hidden Costs Analysis

### 5.1 Costs Often Overlooked

| Cost Item | AWS | GCP | Azure | Oracle |
|-----------|-----|-----|-------|--------|
| **NAT Gateway (hourly)** | $66-132/mo | $64+/mo | $66/mo | **FREE** |
| **NAT Data Processing** | $0.045/GB | $0.045/GB | $0.045/GB | **FREE** |
| **Egress (internet)** | $0.09/GB | $0.12/GB | $0.087/GB | **10TB FREE** |
| **Cross-AZ Transfer** | $0.01/GB | $0.01/GB | $0.01/GB | **FREE** |
| **Control Plane** | $73/mo | $0-72/mo | $0-73/mo | **FREE** |
| **Load Balancer (idle)** | $18-48/mo | $18/mo | $18/mo | $10/mo |
| **EBS Snapshots** | $0.05/GB | $0.04/GB | $0.05/GB | $0.025/GB |

### 5.2 Monthly Hidden Cost Estimate (Production Setup)

| Item | AWS | GCP | Azure | Oracle |
|------|-----|-----|-------|--------|
| NAT Gateway | $66 | $64 | $66 | $0 |
| NAT Data (200GB) | $9 | $9 | $9 | $0 |
| Egress (100GB) | $9 | $12 | $9 | $0 |
| Control Plane | $73 | $0 | $0 | $0 |
| LB Minimum | $48 | $18 | $18 | $10 |
| **Total Hidden** | **$205** | **$103** | **$102** | **$10** |

### 5.3 Impact on Total Cost

| Cloud | Compute Cost | Hidden Costs | Total | Hidden % |
|-------|--------------|--------------|-------|----------|
| AWS | $1,121 | $223 | $1,344 | 17% |
| GCP | $778 | $137 | $915 | 15% |
| Azure | $1,121 | $132 | $1,253 | 11% |
| Oracle | $547 | $30 | $577 | 5% |

---

## 6. Capacity Planning

### 6.1 Scaling Scenarios

| PRs | Configuration | AWS | GCP | Azure | Oracle |
|-----|---------------|-----|-----|-------|--------|
| **10** | 1× medium node | $450 | $350 | $420 | $200 |
| **25** | 2× small nodes | $750 | $550 | $700 | $350 |
| **50** | 2× large nodes | $1,344 | $915 | $1,253 | $577 |
| **100** | 4× large nodes | $2,500 | $1,700 | $2,300 | $1,100 |

### 6.2 Cost per PR at Scale

| Scale | AWS | GCP | Azure | Oracle |
|-------|-----|-----|-------|--------|
| 10 PRs | $45/PR | $35/PR | $42/PR | $20/PR |
| 25 PRs | $30/PR | $22/PR | $28/PR | $14/PR |
| 50 PRs | $27/PR | $18/PR | $25/PR | $12/PR |
| 100 PRs | $25/PR | $17/PR | $23/PR | $11/PR |

### 6.3 Break-Even Analysis

| Comparison | Break-Even Point | Notes |
|------------|------------------|-------|
| Oracle Free → Oracle Paid | 15-20 PRs | When free tier capacity exceeded |
| Oracle → GCP | Never | Oracle always cheaper |
| Oracle → Azure | Never | Oracle always cheaper |
| Oracle → AWS | Never | Oracle always cheaper |
| GCP → AWS | ~30 PRs | Minor difference at scale |

---

## 7. Recommendations

### 7.1 Decision Matrix

| Factor | Weight | AWS | GCP | Azure | Oracle |
|--------|--------|-----|-----|-------|--------|
| **Cost** | 30% | 2 | 3 | 2 | 5 |
| **Multi-arch Support** | 20% | 5 | 2 | 3 | 4 |
| **Enterprise Features** | 15% | 5 | 4 | 5 | 3 |
| **Ease of Migration** | 15% | 4 | 4 | 4 | 5* |
| **Global Availability** | 10% | 5 | 5 | 5 | 4 |
| **Managed Services** | 10% | 5 | 5 | 5 | 3 |
| **Weighted Score** | 100% | 3.8 | 3.5 | 3.6 | **4.3** |

*Oracle scores highest for migration since we're already using Oracle Cloud.

### 7.2 Recommendation by Use Case

| Use Case | Recommended Cloud | Monthly Cost | Rationale |
|----------|-------------------|--------------|-----------|
| **Budget-conscious (x86)** | Oracle Cloud E4 | $304-577 | Cheapest x86 option |
| **Budget-conscious (ARM)** | Oracle Cloud A1 | $217-404 | Cheapest overall |
| **Multi-arch required** | AWS or Oracle | $854-1,176 | Best ARM support |
| **Enterprise/Compliance** | AWS or Azure | $842-965 | Best enterprise support |
| **GCP Ecosystem** | GCP | $682-915 | If using BigQuery, etc. |
| **Current setup scale** | Oracle Cloud | $304-577 | Natural progression |

### 7.3 Final Recommendation

**Primary Recommendation: Stay with Oracle Cloud**

| Reason | Details |
|--------|---------|
| **40-60% Cost Savings** | $577 vs $915-1,344/month |
| **No Migration Required** | Already running on Oracle |
| **Free Networking** | NAT Gateway + 10TB egress included |
| **Mature ARM Support** | Ampere A1 available in all regions |
| **Good x86 Options** | E4/E5 Flex for compatibility |

**Scaling Path:**

```
Current (Free)     →    Paid Tier        →    Multi-Region
4 OCPU, 24GB            16-32 OCPU             64+ OCPU
10-15 PRs               50 PRs                 100+ PRs
$0/month                $304-577/month         $1,000+/month
```

### 7.4 Alternative Recommendations

**If enterprise compliance is required:**
- AWS EKS with Reserved Instances: $965/month
- Azure AKS Standard: $915/month

**If maximum cost savings is critical:**
- Oracle Cloud with Preemptible: $217-304/month
- GCP with Spot instances: $450/month

---

## 8. Sources

### Cloud Provider Pricing Pages

- [AWS EKS Pricing](https://aws.amazon.com/eks/pricing/)
- [AWS EC2 On-Demand Pricing](https://aws.amazon.com/ec2/pricing/on-demand/)
- [GCP GKE Pricing](https://cloud.google.com/kubernetes-engine/pricing)
- [GCP Compute Engine Pricing](https://cloud.google.com/compute/all-pricing)
- [Azure AKS Pricing](https://azure.microsoft.com/en-us/pricing/details/kubernetes-service/)
- [Azure VM Pricing](https://azure.microsoft.com/en-us/pricing/details/virtual-machines/)
- [Oracle OKE Pricing](https://www.oracle.com/cloud/cloud-native/kubernetes-engine/pricing/)
- [Oracle Compute Pricing](https://www.oracle.com/cloud/compute/pricing/)
- [Oracle Ampere A1 Pricing](https://www.oracle.com/cloud/compute/arm/pricing/)

### Networking Costs

- [AWS NAT Gateway Pricing](https://aws.amazon.com/vpc/pricing/)
- [GCP Cloud NAT Pricing](https://cloud.google.com/nat/pricing)
- [Azure NAT Gateway Pricing](https://azure.microsoft.com/en-us/pricing/details/azure-nat-gateway/)
- [AWS ALB Pricing](https://aws.amazon.com/elasticloadbalancing/pricing/)
- [GCP Load Balancer Pricing](https://cloud.google.com/load-balancing/pricing)
- [Azure Load Balancer Pricing](https://azure.microsoft.com/en-us/pricing/details/load-balancer/)

### Instance Comparison Tools

- [Vantage EC2 Instance Comparison](https://instances.vantage.sh/)
- [CloudPrice GCP Comparison](https://cloudprice.net/gcp/compute)
- [CloudPrice Azure Comparison](https://cloudprice.net/)

### Analysis Guides

- [CloudZero EKS Pricing Guide](https://www.cloudzero.com/blog/eks-pricing/)
- [CloudZero GKE Pricing Guide](https://www.cloudzero.com/blog/gke-pricing/)
- [CloudChipr AKS Pricing](https://cloudchipr.com/blog/aks-pricing)
- [Oracle Kubernetes Cost Comparison](https://blogs.oracle.com/cloud-infrastructure/post/kubernetes-cloud-cost-comparison-best-value)

---

## Appendix A: Pricing Calculations

### A.1 AWS m6i.4xlarge Monthly Cost

```
Instance: m6i.4xlarge
vCPUs: 16
Memory: 64 GB
On-Demand: $0.768/hr

Monthly (730 hours):
2 instances × $0.768/hr × 730 hrs = $1,121.28
```

### A.2 Oracle E4 Flex Monthly Cost

```
Instance: VM.Standard.E4.Flex
OCPUs: 16 (= 32 vCPUs on x86)
Memory: 128 GB

OCPU Cost: 16 × $0.025/hr × 730 hrs = $292
Memory Cost: 128 × $0.0015/hr × 730 hrs = $140.16
Total Compute: $432.16

With overhead (estimate): ~$547/month
```

### A.3 Oracle A1 Flex Monthly Cost

```
Instance: VM.Standard.A1.Flex
OCPUs: 32 (= 32 vCPUs on ARM)
Memory: 128 GB

OCPU Cost: 32 × $0.01/hr × 730 hrs = $233.60
Memory Cost: 128 × $0.0015/hr × 730 hrs = $140.16
Total Compute: $373.76

With overhead: ~$404/month
```

---

## Appendix B: Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | January 2025 | Engineering Team | Initial analysis |

---

*This document is for planning purposes only. Actual costs may vary based on region, usage patterns, and pricing changes. Always verify current pricing on provider websites before making decisions.*
