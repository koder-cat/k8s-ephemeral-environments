# Itens pendentes para o DevOps da edgebr

O cluster EC2 (`ubuntu@13.58.99.235`) já está com a infraestrutura base instalada e rodando.
TLS e Grafana Ingress já estão configurados (`https://grafana.k8s-ee.edge.net.br`).
Para finalizar a configuração, precisamos dos itens abaixo.

---

## Prioridade alta

### ~~1. GitHub App para ARC (self-hosted runners)~~ ✅ Recebido e configurado

---

### ~~2. DNS wildcard~~ ✅ Recebido e configurado

### ~~3. Credenciais AWS para TLS~~ ✅ Recebido e configurado

---

### ~~4. Fork do repositório~~ ✅ Recebido e configurado

Fork criado e secret `KUBECONFIG` configurado.

---

## Prioridade média

### 5. OAuth App para Grafana

Criar um OAuth App no GitHub para autenticação no Grafana.

**Configuração do OAuth App:**
- Application name: `k8s-ee Grafana` (ou similar)
- Homepage URL: `https://grafana.k8s-ee.edge.net.br`
- Authorization callback URL: `https://grafana.k8s-ee.edge.net.br/login/github`

**Onde criar:** https://github.com/organizations/edgebr/settings/applications

**O que entregar:**
- Client ID
- Client Secret

---

### 6. Token de acesso para limpeza automática

Criar um Personal Access Token (PAT) ou fine-grained token com acesso de leitura ao status de PRs nos repositórios da edgebr.

**Permissões necessárias:**
- `repo` (classic PAT) ou `Pull requests: Read-only` (fine-grained token)

Esse token é usado por um CronJob que limpa automaticamente ambientes de PRs fechados/mergeados.

**O que entregar:**
- Token gerado

---

## Resumo

| # | Item | O que entregar | Status |
|---|------|----------------|--------|
| 1 | ~~GitHub App (ARC)~~ | ~~App ID, Installation ID, `.pem`~~ | ✅ |
| 2 | ~~DNS wildcard~~ | ~~`*.k8s-ee.edge.net.br` → Elastic IP~~ | ✅ |
| 3 | ~~Credenciais AWS (TLS)~~ | ~~IAM Access Key + Hosted Zone ID + email ACME~~ | ✅ |
| 4 | ~~Fork do repositório~~ | ~~`edgebr/k8s-ephemeral-environments`~~ | ✅ |
| 5 | OAuth App (Grafana) | Client ID, Client Secret | Pendente |
| 6 | Token de limpeza | PAT com leitura de PRs | Pendente |
