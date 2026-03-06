# Itens pendentes para o DevOps da edgebr

O cluster EC2 (`ubuntu@13.58.99.235`) já está com a infraestrutura base instalada e rodando.
Para finalizar a configuração, precisamos dos itens abaixo.

---

## Prioridade alta

### 1. GitHub App para ARC (self-hosted runners)

Criar um GitHub App na organização edgebr para o Actions Runner Controller.

**Permissões necessárias do App:**
- Repository permissions: `Actions: Read-only`, `Metadata: Read-only`
- Organization permissions: `Self-hosted runners: Read and write`

**O que entregar:**
- App ID
- Installation ID
- Arquivo de chave privada (`.pem`)

**Referência:** https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners-with-actions-runner-controller/authenticating-to-the-github-api#authenticating-arc-with-a-github-app

---

### 2. DNS wildcard

Configurar registro DNS wildcard apontando para o Elastic IP da EC2.

| Tipo | Nome | Valor |
|------|------|-------|
| A | `*.k8s-ee.edge.net.br` | Elastic IP da instância EC2 |

Isso permite que cada PR gere uma URL de preview automaticamente (ex: `projeto-pr-42.k8s-ee.edge.net.br`).

---

### 3. Credenciais AWS para TLS (certificados HTTPS)

A emissão automática de certificados wildcard Let's Encrypt será feita via DNS challenge no Route 53.

**Credenciais IAM necessárias** (policy mínima):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "route53:GetChange",
      "Resource": "arn:aws:route53:::change/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "route53:ChangeResourceRecordSets",
        "route53:ListResourceRecordSets"
      ],
      "Resource": "arn:aws:route53:::hostedzone/<HOSTED_ZONE_ID>"
    },
    {
      "Effect": "Allow",
      "Action": "route53:ListHostedZonesByName",
      "Resource": "*"
    }
  ]
}
```

**O que entregar:**
- Access Key ID e Secret Access Key do usuário IAM com a policy acima
- Hosted Zone ID da zona `edge.net.br` (ou `k8s-ee.edge.net.br`)
- Email para registro ACME (ex: `devops@edge.net.br`)

---

### 4. Fork do repositório

Fazer fork de `koder-cat/k8s-ephemeral-environments` para `edgebr/k8s-ephemeral-environments`.

Após o fork, será necessário adicionar um secret `KUBECONFIG` no repositório (Settings > Secrets and variables > Actions). O conteúdo do secret será fornecido por nós.

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

| # | Item | O que entregar | Prioridade |
|---|------|----------------|------------|
| 1 | GitHub App (ARC) | App ID, Installation ID, `.pem` | Alta |
| 2 | DNS wildcard | `*.k8s-ee.edge.net.br` → Elastic IP | Alta |
| 3 | Credenciais AWS (TLS) | IAM Access Key + Hosted Zone ID + email ACME | Alta |
| 4 | Fork do repositório | `edgebr/k8s-ephemeral-environments` | Alta |
| 5 | OAuth App (Grafana) | Client ID, Client Secret | Média |
| 6 | Token de limpeza | PAT com leitura de PRs | Média |
