# EC2 Cluster Setup - Progress Tracker

**EC2:** `ubuntu@13.58.99.235` | **Org:** edgebr | **Arch:** x86_64

## Completed Steps

- [x] **Step 0:** Copy k8s/ files to EC2
- [x] **Step 1:** Install k3s (v1.34.4+k3s1)
- [x] **Step 2:** Core infrastructure (PriorityClasses, platform NS)
- [x] **Step 3:** Database operators (CNPG, MongoDB, MinIO)
- [x] **Step 4:** Observability (Loki, Promtail, Prometheus, Grafana without OAuth)
- [x] **Step 5:** ARC controller + RBAC
- [x] **Step 6:** Platform jobs (RBAC + preserve-expiry)
- [x] **Step 7:** ARC runner scale set (registered with GitHub, listener running)
- [x] **Step 8:** TLS + Grafana ingress (Route 53 DNS challenge, Let's Encrypt cert issued)

- [x] **Step 10:** KUBECONFIG GitHub secret (set via `gh secret set`, uses internal IP `192.168.23.55`)

## Blocked Steps

- [ ] **Step 9:** Grafana OAuth — _blocked on OAuth App credentials_
- [ ] **Step 11:** Cleanup CronJob — _blocked on GITHUB_TOKEN_

## Pending (no external blockers)

- [ ] **Fork adaptation:** Change `setup-tools` default architecture from `arm64` to `amd64` in edgebr fork workflows

## External Dependencies

- [x] EC2 resize to >= 16 GB RAM (4 vCPU / 15 GB confirmed)
- [x] GitHub App for ARC (App ID: 2999114, Installation ID: 113788735, .pem)
- [ ] OAuth App for Grafana (Client ID, Client Secret)
- [x] DNS wildcard `*.k8s-ee.edge.net.br` → EC2 Elastic IP
- [x] AWS IAM credentials for Route 53 (Access Key + Hosted Zone ID + email ACME)
- [x] Fork `koder-cat/k8s-ephemeral-environments` → `edgebr/k8s-ephemeral-environments`
- [ ] GITHUB_TOKEN for cleanup job (PAT with PR read access)

## Installed Versions

| Component | Version |
|-----------|---------|
| k3s | v1.34.4+k3s1 |
| Helm | v3.20.0 |
| CloudNativePG | latest (chart) |
| MongoDB Community Operator | latest (chart) |
| MinIO Operator | latest (chart) |
| Loki | 6.53.0 (chart) / 3.6.5 (app) |
| Promtail | 6.17.1 (chart) / 3.5.1 (app) |
| kube-prometheus-stack | latest (chart) |
| ARC controller | 0.13.1 (chart) |
| ARC runner scale set | 0.13.1 (chart) |
| Traefik | 3.6.7 (app) / 38.0.201 (chart) |

## Resource Usage (post-install)

- **RAM:** 2.3 GB used / 15 GB total (14%)
- **Pods:** 21 running across 7 namespaces

## Log

| Date | Action | Result |
|------|--------|--------|
| 2026-03-05 | Verified EC2 connectivity and specs | Ubuntu 24.04, x86_64, 4 vCPU, 15 GB RAM, 96 GB disk |
| 2026-03-05 | Created setup plan | `docs/plans/migration-to-EC2.md` |
| 2026-03-05 | Executed Steps 0-6 | All platform components installed and running |
| 2026-03-12 | Executed Step 8 (TLS + Grafana Ingress) | Route 53 DNS challenge, Let's Encrypt cert issued, Grafana live at `https://grafana.k8s-ee.edge.net.br` |
| 2026-03-12 | Executed Step 7 (ARC Runner Scale Set) | Registered with GitHub, listener pod running. Note: required App permission approval on installation side. |
| 2026-03-12 | Executed Step 10 (KUBECONFIG secret) | Set on `edgebr/k8s-ephemeral-environments` using internal IP. Test PR verified ARC runner + kubectl connectivity. |
