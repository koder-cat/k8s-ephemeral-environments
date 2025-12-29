# PRD: Plataforma de Ambientes Efêmeros em Kubernetes

**Versão:** 1.0
**Data:** 28 de Dezembro de 2024
**Autor:** Time de Engenharia
**Status:** Draft

---

## 1. Resumo Executivo

Este documento descreve a implementação de uma plataforma de ambientes efêmeros por Pull Request, utilizando Kubernetes. Cada PR terá seu próprio ambiente isolado (aplicação + banco de dados + observabilidade), acessível via URL pública e destruído automaticamente ao fechar/mergear o PR.

O projeto será desenvolvido em duas fases: **Fase 1** com um protótipo em VPS (k3s) para validação do modelo operacional, seguido de **Fase 2** com migração para Amazon EKS.

---

## 2. Problema

| # | Problema | Impacto | Como Mediremos |
|---|----------|---------|----------------|
| 1 | Review demora porque não há URL pública para teste | Time-to-market elevado | % PRs com review < 4h |
| 2 | Devs sobrescrevem ambiente de staging compartilhado | Defeitos escapam para produção | Nº de hotfixes pós-release |
| 3 | Logs/métricas de PRs ficam espalhados | Debug lento e complexo | Tempo médio para localizar causa-raiz |
| 4 | Infra de teste é criada manualmente | Ambientes inconsistentes | Nº de incidentes por diferença de config |
| 5 | Revisores precisam rodar código localmente | Ciclo de feedback lento | Tempo médio de review |

---

## 3. Objetivos e Key Results (OKRs)

| Objetivo | Key Result |
|----------|------------|
| **O1.** Todo PR possui ambiente isolado | KR1.1: ≥ 95% dos PRs com URL entregue em < 10 min |
| | KR1.2: Zero namespaces órfãos após 24h |
| **O2.** Custos previsíveis | KR2.1: Gasto mensal VPS < US$ 120 |
| **O3.** Automação completa | KR3.1: Pipeline 100% automatizada (zero intervenção manual) |
| **O4.** Observabilidade centralizada | KR4.1: 100% dos pods com logs/métricas acessíveis no Grafana |

---

## 4. Usuários-Alvo

| Persona | Necessidade |
|---------|-------------|
| **Desenvolvedores** | URL de preview + logs para validar código antes do merge |
| **QAs** | Ambiente estável e isolado para testes exploratórios |
| **Tech Lead / PM** | Visão de custo, status e tempo de vida de cada ambiente |
| **SRE / DevOps** | Garantir limpeza de recursos e estabilidade do cluster |

---

## 5. Stakeholders

- **Tech Lead** — Definição arquitetural e validação técnica
- **Time de Engenharia** — Desenvolvimento e operação
- **DevOps / Plataforma** — Suporte e evolução da infraestrutura

---

## 6. Escopo

### 6.1 In Scope (Fase 1 - VPS)

- Cluster k3s single-node em VPS
- Namespace por PR com lifecycle automatizado via GitHub Actions
- Banco de dados efêmero por PR (PostgreSQL em container ou schema dedicado)
- Stack de observabilidade (Prometheus, Loki, Grafana)
- GitHub Actions runners self-hosted no cluster
- NetworkPolicies para isolamento entre PRs
- Documentação de setup e operação

### 6.2 Out of Scope (Fase 1)

- Alta disponibilidade (multi-node)
- Autoscaling de nós ou runners
- Benchmark de performance
- Disaster recovery
- Ambientes de produção
- Integração com serviços gerenciados AWS (RDS, etc.)

### 6.3 Futuro (Fase 2 - EKS)

- Migração para Amazon EKS com node groups (spot + on-demand)
- RDS/Aurora por PR via Crossplane ou AWS Controllers
- EFS com reclaimPolicy=Delete
- OPA/Gatekeeper para políticas avançadas
- Kubecost para gestão de custos
- Multi-tenancy entre sistemas

---

## 7. Arquitetura Proposta

### 7.1 Visão Geral

```
┌─────────────────────────────────────────────────────────────────┐
│                     VPS (4 vCPU, 24GB RAM, 100GB NVMe)          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                        k3s Cluster                        │  │
│  │                                                           │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │  │
│  │  │observability│  │  gh-runners │  │ app-pr-123  │       │  │
│  │  │             │  │             │  │  (efêmero)  │       │  │
│  │  │ - Prometheus│  │ - Runner x2 │  │             │       │  │
│  │  │ - Loki      │  │             │  │ - App Pod   │       │  │
│  │  │ - Grafana   │  │             │  │ - DB Pod    │       │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘       │  │
│  │                                                           │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │  │
│  │  │ app-pr-456  │  │ app-pr-789  │  │   platform  │       │  │
│  │  │  (efêmero)  │  │  (efêmero)  │  │  (sistema)  │       │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘       │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Estrutura de Namespaces

| Namespace | Propósito | Lifecycle |
|-----------|-----------|-----------|
| `kube-system` | Componentes do k3s | Permanente |
| `observability` | Prometheus, Loki, Grafana | Permanente |
| `gh-runners` | GitHub Actions self-hosted runners | Permanente |
| `platform` | Componentes base compartilhados | Permanente |
| `{project-id}-pr-{number}` | Ambiente efêmero por PR | Efêmero (PR lifecycle) |

### 7.3 Fluxo de CI/CD

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  PR Open │────▶│  GitHub  │────▶│  Create  │────▶│  Deploy  │
│          │     │  Action  │     │Namespace │     │App + DB  │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                                                         │
                                                         ▼
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ PR Close │────▶│  GitHub  │────▶│  Delete  │◀────│  URL do  │
│ or Merge │     │  Action  │     │Namespace │     │ Preview  │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
```

---

## 8. Requisitos Funcionais

### 8.1 Ambientes Efêmeros

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-01 | Criar namespace automaticamente quando PR é aberto | Must |
| RF-02 | Destruir namespace e volumes quando PR é fechado/mergeado (< 5 min) | Must |
| RF-03 | URL única por PR: `https://{project-id}-pr-{number}.preview.dominio.com` | Must |
| RF-04 | Re-deploy automático em push de novos commits | Must |
| RF-05 | Comentário automático no PR com URL de preview e status | Should |
| RF-06 | Aplicar ResourceQuota e LimitRange em namespaces de PR | Should |
| RF-07 | Permitir "pin" de ambiente via label `preserve=true` (máx 48h) | Could |

### 8.2 Banco de Dados

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-08 | Instância de banco isolada por PR | Must |
| RF-09 | Credenciais exclusivas por PR armazenadas em Secrets | Must |
| RF-10 | Destruição do banco junto com namespace | Must |

### 8.3 Observabilidade

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-11 | Logs de todos os pods coletados pelo Loki | Must |
| RF-12 | Métricas de CPU/memória/rede coletadas pelo Prometheus | Must |
| RF-13 | Dashboards pré-configurados no Grafana | Should |
| RF-14 | Alertas básicos (disco, memória, pod restarts) | Could |

### 8.4 GitHub Runners

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-15 | Runners auto-registrados no GitHub | Must |
| RF-16 | Runners com acesso ao cluster via ServiceAccount | Must |
| RF-17 | Runners com kubectl, helm, docker instalados | Must |
| RF-18 | Runners efêmeros (um por job) via ARC | Should |

---

## 9. Requisitos Não-Funcionais

### 9.1 Performance

| ID | Requisito | Meta |
|----|-----------|------|
| RNF-01 | Tempo de criação de ambiente | ≤ 10 min (p95) |
| RNF-02 | Tempo de destruição de namespace | < 5 min |
| RNF-03 | Overhead do stack de observabilidade | < 6 GB RAM |

### 9.2 Disponibilidade

| ID | Requisito | Meta |
|----|-----------|------|
| RNF-04 | Uptime do cluster (horário comercial) | ≥ 95% |
| RNF-05 | Recuperação automática após reboot da VPS | Sim |

### 9.3 Segurança

| ID | Requisito | Meta |
|----|-----------|------|
| RNF-06 | Secrets nunca em plain text nos repos | 100% |
| RNF-07 | Isolamento de rede entre PRs (NetworkPolicy) | Obrigatório |
| RNF-08 | Tokens GitHub de curta duração | Sim |
| RNF-09 | CIS Kubernetes Benchmark nível 1 | Sim |

### 9.4 Capacidade

| ID | Requisito | Meta |
|----|-----------|------|
| RNF-10 | PRs simultâneos suportados | ≥ 5 |
| RNF-11 | Retenção de logs | 7 dias |
| RNF-12 | Retenção de métricas | 7 dias |
| RNF-13 | Limites por namespace PR | CPU ≤ 1 core, RAM ≤ 2 Gi, Storage ≤ 5 Gi |

---

## 10. Stack Tecnológico

| Componente | Tecnologia | Justificativa |
|------------|------------|---------------|
| **Kubernetes** | k3s | Leve, production-ready, ideal para single-node, inclui containerd |
| **Ingress** | Traefik | Incluso no k3s, suporte nativo a Let's Encrypt |
| **CI/CD** | GitHub Actions | Já utilizado pelo time, integração nativa |
| **Logs** | Loki + Promtail | Leve, integração nativa com Grafana |
| **Métricas** | Prometheus | Padrão de mercado, amplo ecossistema |
| **Dashboards** | Grafana | Interface unificada para logs e métricas |
| **Runners** | actions-runner-controller (ARC) | Runners efêmeros e escaláveis no cluster |
| **DB Operator** | CloudNativePG | Gerencia lifecycle do PostgreSQL no cluster |
| **Secrets** | Sealed Secrets | Segurança básica, secrets criptografados no git |
| **Storage** | Local Path Provisioner | Simples, adequado para MVP usando NVMe da VPS |
| **DNS** | Wildcard | `*.preview.dominio.com` → IP da VPS |

---

## 11. Decisões de Design

| Tópico | Decisão | Racional |
|--------|---------|----------|
| **Runtime K8s** | k3s | Instala rápido, footprint pequeno, ideal para VPS |
| **DB por PR** | PostgreSQL via CloudNativePG | Isolamento completo, lifecycle automatizado |
| **Storage** | Local Path Provisioner | Evita complexidade de CSI; aceitável para MVP |
| **DNS** | Wildcard `*.preview.dominio.com` | Evita criar registro DNS por PR |
| **Secrets** | Sealed Secrets | Permite versionar secrets criptografados |
| **Manifests** | Helm charts | Templating flexível, comunidade ampla |

---

## 12. Fluxo de Usuário (Happy Path)

1. Dev cria branch `feat/nova-funcionalidade` e abre PR
2. GitHub Actions detecta evento `pull_request: opened`
3. Pipeline cria namespace `{project-id}-pr-{number}` com ResourceQuota
4. Deploy da aplicação com imagem `:<sha>` + banco de dados
5. Ingress criado; URL `{project-id}-pr-{number}.preview.dominio.com` ativa
6. Bot comenta no PR com URL de preview e link para Grafana
7. Dev/QA/Reviewer testam e dão feedback
8. Commits adicionais disparam re-deploy automático
9. PR mergeado → Actions executa cleanup do namespace
10. Dados do Loki/Prometheus mantidos por 7 dias para troubleshooting

---

## 13. Métricas e SLIs

### 13.1 Indicadores de Nível de Serviço (SLIs)

| SLI | Meta |
|-----|------|
| % de PRs com URL entregue em < 10 min | ≥ 95% |
| % de namespaces removidos em < 5 min após close | ≥ 98% |
| % de pods com métricas/logs coletados | ≥ 95% |

### 13.2 Métricas de Observabilidade

```promql
# Tempo de provisionamento
github_actions_workflow_run_duration_seconds{job="provision"}

# Uso de recursos vs alocado
kube_pod_container_resource_requests / node_allocatable

# Disponibilidade do API server
up{job="kubernetes-apiservers"}

# Uso de disco
node_filesystem_avail_bytes / node_filesystem_size_bytes
```

---

## 14. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| VPS sem recursos suficientes | Baixa | Alto | Monitorar uso; limitar PRs simultâneos; ResourceQuotas |
| Exaustão de disco (logs/imagens) | Média | Alto | Retention agressivo (3-7 dias); alertas em 80%; job limpeza de imagens |
| Namespace órfão não deletado | Média | Baixo | Job de cleanup periódico; alertas |
| Downtime da VPS | Média | Médio | Snapshot diário; runbook de recovery < 30 min |
| "Pin" esquecido esgota recursos | Baixa | Médio | Cron remove `preserve` após 48h; quota máx 3 pinados |
| Container escape | Baixa | Alto | NetworkPolicy default deny; PodSecurityStandard restricted |
| Token GitHub comprometido | Baixa | Alto | Tokens curta duração; rotação periódica |

---

## 15. Roadmap de Implementação

### Fase 1: Foundation

| Tarefa | Entrega |
|--------|---------|
| Provisionar VPS | VPS acessível via SSH |
| Instalar e configurar k3s | Cluster funcional |
| Configurar DNS wildcard | `*.preview.dominio.com` |
| Documentar acesso ao cluster | Runbook de acesso |

### Fase 2: CI/CD Pipeline

| Tarefa | Entrega |
|--------|---------|
| Workflow de PR open | Namespace criado automaticamente |
| Workflow de PR close | Namespace destruído automaticamente |
| Configurar kubeconfig no GitHub | Actions com acesso ao cluster |
| Comentário automático no PR | URL de preview no PR |

### Fase 3: Observability

| Tarefa | Entrega |
|--------|---------|
| Deploy do Prometheus | Métricas coletadas |
| Deploy do Loki + Promtail | Logs centralizados |
| Deploy do Grafana | Dashboards acessíveis |
| Criar dashboards básicos | Visão geral do cluster |
| Configurar alertas | Alertas de disco/memória |

### Fase 4: Runners & Polish

| Tarefa | Entrega |
|--------|---------|
| Deploy de GH runners no cluster | Runners operacionais |
| Configurar ResourceQuotas | Limites por namespace |
| Configurar NetworkPolicies | Isolamento entre PRs |
| Testes com PRs simultâneos | Validação de capacidade |
| Documentação final | Runbooks completos |

---

## 16. Critérios de Aceitação

O protótipo será considerado bem-sucedido quando:

- [ ] PR aberto cria ambiente automaticamente sem intervenção manual
- [ ] PR fechado/mergeado destrói ambiente em < 5 min
- [ ] ≥ 5 devs conseguem abrir PR e acessar URL sem suporte
- [ ] Tempo médio de provisionamento ≤ 10 min (p95 ≤ 15 min)
- [ ] Nenhum pod consegue pingar pod de outro namespace (teste e2e)
- [ ] Grafana exibe logs e métricas de ≥ 95% dos pods
- [ ] Disco volta ao nível pré-PR após destruição do namespace
- [ ] Custo mensal ≤ US$ 120 com operação normal
- [ ] 2 semanas de operação sem incidentes críticos

---

## 17. Decisões em Aberto

| Item | Opções | Status |
|------|--------|--------|
| Estratégia de banco | CloudNativePG vs. schema por PR em DB externo | A definir |
| Domínio para preview | Subdomínio próprio vs. nip.io | A definir |
| Política de retenção pós-PR | Destruir imediato vs. manter dados 24h | A definir |
| Grafana SSO | Basic auth vs. GitHub OAuth | A definir |

---

## 18. Referências

- [k3s Documentation](https://docs.k3s.io/)
- [GitHub Actions: Self-hosted Runners](https://docs.github.com/en/actions/hosting-your-own-runners)
- [actions-runner-controller](https://github.com/actions-runner-controller/actions-runner-controller)
- [CloudNativePG](https://cloudnative-pg.io/)
- [Loki Stack Helm Chart](https://grafana.github.io/helm-charts)
- [Kube-Prometheus-Stack](https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack)
- [CIS Kubernetes Benchmark](https://www.cisecurity.org/benchmark/kubernetes)

---

## Apêndice A: Infraestrutura Provisionada

### A.1 VPS - Detalhes

| Atributo | Valor |
|----------|-------|
| **Provedor** | Oracle Cloud Infrastructure (OCI) |
| **IP Público** | `168.138.151.63` |
| **Hostname** | `genilda` |
| **Usuário SSH** | `ubuntu` |
| **Porta SSH** | `22` |
| **OS** | Ubuntu 24.04.3 LTS (Noble Numbat) |
| **Kernel** | 6.14.0-1018-oracle |
| **Arquitetura** | ARM64 (aarch64) |

### A.2 Recursos de Hardware

| Recurso | Especificação |
|---------|---------------|
| **vCPUs** | 4 |
| **RAM** | 24 GB |
| **Disco** | 96 GB (/) |
| **Swap** | 2 GB |

### A.3 Acesso SSH

```bash
ssh ubuntu@168.138.151.63
```

### A.4 Considerações ARM64

A VPS utiliza arquitetura ARM64. Todas as imagens de container devem ser multi-arch ou ter builds específicos para `linux/arm64`:

- ✅ k3s: Suporte nativo ARM64
- ✅ Traefik: Multi-arch
- ✅ Prometheus/Grafana/Loki: Multi-arch
- ⚠️ Imagens da aplicação: Verificar/buildar para ARM64

---

## Histórico de Revisões

| Versão | Data | Autor | Alterações |
|--------|------|-------|------------|
| 1.1 | 28/12/2024 | Time de Engenharia | Adicionado Apêndice A com detalhes da VPS provisionada |
| 1.0 | 28/12/2024 | Time de Engenharia | Versão inicial (consolidação de 4 PRDs) |

---

## Aprovações

| Papel | Nome | Data | Assinatura |
|-------|------|------|------------|
| Tech Lead | | | |
| Engineering Manager | | | |
