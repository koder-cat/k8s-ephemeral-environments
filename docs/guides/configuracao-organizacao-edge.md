# Guia de Configuração para Organização Externa

Guia completo para integrar uma organização GitHub externa à plataforma **k8s-ephemeral-environments**, com cluster dedicado na infraestrutura do cliente.

## Sumário

1. [Introdução](#1-introdução)
2. [Visão Geral da Arquitetura](#2-visão-geral-da-arquitetura)
3. [Parte 1: Provisionamento (DevOps da organização)](#3-parte-1-provisionamento-devops-da-organização)
4. [Parte 2: Setup do Cluster (genesluna)](#4-parte-2-setup-do-cluster-genesluna)
5. [Parte 3: Fork do Repositório](#5-parte-3-fork-do-repositório)
6. [Parte 4: Configuração por Repositório (Desenvolvedores)](#6-parte-4-configuração-por-repositório-desenvolvedores)
7. [Teste e Validação](#7-teste-e-validação)
8. [Funcionalidades Extras](#8-funcionalidades-extras)
9. [Troubleshooting](#9-troubleshooting)
10. [Checklist Resumo](#10-checklist-resumo)

---

## 1. Introdução

### O que é k8s-ephemeral-environments

Plataforma que cria **ambientes Kubernetes efêmeros** para cada Pull Request. O fluxo funciona assim:

1. Um PR é aberto no repositório
2. A organização é validada contra a allowlist
3. Um GitHub Actions workflow cria um namespace isolado no cluster
4. A imagem da aplicação é construída e publicada no GHCR
5. A aplicação é implantada com bancos de dados configurados
6. Um comentário é postado no PR com a URL de preview
7. Push no PR → re-deploy automático
8. PR fechado/mergeado → ambiente destruído automaticamente

### Modelo: Cluster na Infraestrutura do Cliente

Diferente de um modelo compartilhado, cada organização opera com **infraestrutura própria e código próprio**:

| Item | Descrição |
|------|-----------|
| **Cluster** | EC2 na conta AWS da organização (x86) |
| **Código-fonte** | Fork de `koder-cat/k8s-ephemeral-environments` na org |
| **Domínio** | `*.k8s-ee.edge.net.br` (controlado pela organização) |
| **Imagens** | Privadas no GHCR (autenticação via `imagePullSecrets`) |
| **Credenciais** | Tudo criado internamente — nenhuma credencial compartilhada com terceiros |

### Vantagens deste modelo

- **Nenhuma alteração de segurança na organização** — não é necessário tornar pacotes públicos, permitir repos públicos no runner group, nem permitir reusable workflows externos
- **Nenhuma credencial compartilhada com terceiros** — GitHub App e OAuth App são criados pela própria organização e instalados internamente
- **Repositórios privados suportados** — imagePullSecrets autenticam o pull de imagens privadas
- **Fork = independência** — o código é da organização; updates do upstream são opcionais e sem conflitos

### Pré-requisitos técnicos (código)

O fork precisa de três features que estarão implementadas antes do piloto:

| Feature | Descrição |
|---------|-----------|
| **`k8s-ee-repo` input** | O reusable workflow aceita o repositório como parâmetro (hoje hardcoded) |
| **`imagePullSecrets`** | O deploy cria automaticamente um secret para pull de imagens privadas |
| **`platforms` input** | O reusable workflow aceita a plataforma de build como parâmetro (hoje hardcoded `linux/arm64`) |

Esses pré-requisitos serão implementados no repositório upstream antes do início do piloto.

---

## 2. Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                    GitHub (Organização: edgebr)                   │
│                                                                  │
│  ┌──────────┐    ┌──────────────────────────────────────┐        │
│  │  PR      │───▶│  GitHub Actions Workflow              │        │
│  │  aberto  │    │  (.github/workflows/pr-environment.yml)│       │
│  └──────────┘    └──────────────┬───────────────────────┘        │
│                                 │                                │
│                                 │ chama reusable workflow        │
│                                 ▼                                │
│               ┌─────────────────────────────────────┐            │
│               │ edgebr/k8s-ephemeral-environments    │            │
│               │ pr-environment-reusable.yml (fork)   │            │
│               └──────────────┬──────────────────────┘            │
│                              │                                   │
└──────────────────────────────┼───────────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
┌─────────────────┐  ┌─────────────┐  ┌──────────────────┐
│  ubuntu-latest   │  │ ARC Runners  │  │   ubuntu-latest  │
│  (GitHub-hosted) │  │ (in-cluster) │  │  (GitHub-hosted)  │
│                  │  │              │  │                   │
│ • Validate config│  │ • Create NS  │  │ • PR Comment      │
│ • Build image    │  │ • Deploy app │  │                   │
│ • Trivy scan     │  │ • Destroy NS │  │                   │
│ • SBOM           │  │              │  │                   │
└─────────────────┘  └──────┬───────┘  └──────────────────┘
                            │
                            ▼
              ┌──────────────────────────┐
              │   Cluster k3s (EC2)      │
              │   Infra da organização   │
              │                          │
              │  Namespace: {id}-pr-{n}  │
              │  ┌────────┐ ┌─────────┐  │
              │  │  App   │ │   DB    │  │
              │  └────┬───┘ └─────────┘  │
              │       │                  │
              │  Traefik Ingress         │
              └───────┼──────────────────┘
                      │
                      ▼
          https://{id}-pr-{n}.k8s-ee.edge.net.br
```

### Pontos-chave

- **Tudo roda na infra da organização** — EC2, cluster, DNS, TLS
- **Fork é o source of truth** — workflows e actions vêm do repositório da organização
- **Runners da organização** — GitHub App criado internamente, runners conectam ao cluster da org
- **Imagens privadas** — GHCR privado + `imagePullSecrets` para autenticação

---

## 3. Parte 1: Provisionamento (DevOps da organização)

**Esta seção é executada pelo DevOps da organização.** Nenhuma alteração de segurança a nível de organização é necessária.

### 3.1 Criar instância EC2

Provisione uma instância EC2 na conta AWS da organização:

| Requisito | Valor |
|-----------|-------|
| **Arquitetura** | x86_64 (AMD64) |
| **OS** | Ubuntu 24.04 LTS |
| **CPU** | Mínimo 4 vCPUs (recomendado 8) |
| **Memória** | Mínimo 16 GB (recomendado 32 GB) |
| **Disco** | Mínimo 100 GB SSD |
| **Rede** | IP público fixo (Elastic IP) |
| **Security Group** | Portas 22 (SSH), 80 (HTTP), 443 (HTTPS), 6443 (K8s API) |

### 3.2 Dar acesso SSH ao genesluna

Adicione a chave pública SSH do genesluna ao `~/.ssh/authorized_keys` da instância:

```bash
# Na instância EC2
echo "ssh-ed25519 AAAA... genesluna" >> ~/.ssh/authorized_keys
```

> **Nota:** O acesso SSH é necessário apenas durante o setup inicial do cluster. Pode ser revogado após a conclusão da Parte 2.

### 3.3 Criar GitHub App para ARC Runners

O ARC (Actions Runner Controller) precisa de um GitHub App para autenticar os runners com a organização. Este app é criado pela própria organização — nenhuma credencial sai da organização.

**1. Criar o App**

Acesse `https://github.com/organizations/{org}/settings/apps/new` e configure:

| Campo | Valor |
|-------|-------|
| **Name** | `k8s-ee-arc-runner-{org}` (deve ser globalmente único no GitHub) |
| **Homepage URL** | `https://github.com/{org}` |
| **Webhook** | Desmarque "Active" (não necessário para ARC) |
| **Where can this GitHub App be installed?** | Selecione "Only on this account" |

**2. Configurar permissões**

Em **Repository Permissions:**

| Permissão | Acesso |
|-----------|--------|
| Actions | Read-only |
| Administration | Read and write |
| Metadata | Read-only |

**3. Finalizar criação**

1. Clique **Create GitHub App**
2. Anote o **App ID** (exibido no topo da página de configurações do app)

**4. Gerar chave privada**

1. Role até **"Private keys"**
2. Clique **Generate a private key**
3. Salve o arquivo `.pem` baixado em local seguro

**5. Instalar o App na organização**

1. No menu lateral esquerdo, clique em **"Install App"**
2. Selecione a organização
3. Escolha **"All repositories"** (recomendado) ou selecione repositórios específicos
4. Clique **Install**

**6. Anotar o Installation ID**

Após a instalação, a URL será:
```
https://github.com/organizations/{org}/settings/installations/{INSTALLATION_ID}
```
Anote o `{INSTALLATION_ID}` da URL.

**7. Compartilhar credenciais com o genesluna**

Envie de forma **segura**:
- App ID
- Installation ID
- Arquivo `.pem` (chave privada)

> **Segurança:** Use transferência de arquivo criptografada (GPG, age) ou um cofre de senha compartilhado. **Nunca** envie o `.pem` por email, Slack DM ou commit no repositório. Note que estas credenciais são para o ARC runner controller — elas permitem registrar runners, não acessar código.

### 3.4 Criar GitHub OAuth App para Grafana

O Grafana usa OAuth do GitHub para autenticação. Isso requer um **OAuth App** (não confundir com GitHub App).

1. Acesse `https://github.com/organizations/{org}/settings/applications`
2. Clique **New OAuth App** (aba "OAuth apps", não "GitHub Apps")
3. Configure:

| Campo | Valor |
|-------|-------|
| **Application name** | `k8s-ee-grafana-{org}` |
| **Homepage URL** | `https://grafana.k8s-ee.edge.net.br` |
| **Authorization callback URL** | `https://grafana.k8s-ee.edge.net.br/login/github` |

4. Clique **Register application**
5. Anote o **Client ID**
6. Clique **Generate a new client secret** e anote o **Client Secret**

**Compartilhar com genesluna:**
- Client ID
- Client Secret

> **Nota:** Muito mais simples que o GitHub App — são apenas duas strings, sem arquivo `.pem`.

### 3.5 Configurar DNS

Crie registros DNS **wildcard** apontando para o IP público (Elastic IP) da instância EC2:

```
*.k8s-ee.edge.net.br    A    {IP-PÚBLICO-EC2}
```

Isso cobre:
- Preview URLs: `{projectId}-pr-{number}.k8s-ee.edge.net.br`
- Grafana: `grafana.k8s-ee.edge.net.br`

### 3.6 O que NÃO precisa ser feito

Diferente do modelo compartilhado, **nenhuma configuração de segurança da organização é necessária**:

| Configuração | Necessário? | Motivo |
|--------------|-------------|--------|
| Permitir reusable workflows externos | **Não** | O fork está na própria organização |
| Tornar pacotes GHCR públicos | **Não** | `imagePullSecrets` autentica o pull |
| Permitir repos públicos no runner group | **Não** | Repositórios podem ser privados |
| Compartilhar `.pem` com terceiros | **Não** | GitHub App é criado e instalado internamente |

---

## 4. Parte 2: Setup do Cluster (genesluna)

O que o genesluna faz após receber acesso SSH e credenciais.

### 4.1 Instalar k3s

```bash
curl -sfL https://get.k3s.io | sh -s - \
  --disable=servicelb \
  --write-kubeconfig-mode=644
```

### 4.2 ARC Controller + Runner Scale Set

**1. Instalar ARC controller:**

```bash
helm install arc \
  --namespace arc-systems --create-namespace \
  oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set-controller
```

**2. Criar secret com credenciais do GitHub App:**

```bash
kubectl create secret generic github-app-secret-{org} \
  --namespace arc-runners --create-namespace \
  --from-literal=github_app_id="APP_ID" \
  --from-literal=github_app_installation_id="INSTALLATION_ID" \
  --from-file=github_app_private_key="path/to/{org}-private-key.pem"
```

**3. Deletar o arquivo `.pem` do servidor:**

```bash
rm path/to/{org}-private-key.pem
```

**4. Implantar o runner scale set:**

Criar `k8s/arc/values-runner-set-{org}.yaml`:

```yaml
githubConfigUrl: "https://github.com/{org}"
githubConfigSecret: github-app-secret-{org}
runnerScaleSetName: "arc-runner-set"
minRunners: 0
maxRunners: 3
template:
  spec:
    serviceAccountName: arc-runner-sa
controllerServiceAccount:
  namespace: arc-systems
  name: arc-controller
```

```bash
helm install arc-runner-set-{org} \
  --namespace arc-runners \
  oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set \
  -f k8s/arc/values-runner-set-{org}.yaml
```

**5. Aplicar RBAC para runners:**

```bash
kubectl apply -f k8s/arc/runner-rbac.yaml
kubectl apply -f k8s/arc/controller-rbac.yaml
```

### 4.3 Observabilidade (Prometheus + Grafana + Loki)

**1. Criar secret do Grafana OAuth:**

```bash
kubectl create secret generic grafana-oauth-secrets \
  --namespace observability --create-namespace \
  --from-literal=GF_AUTH_GITHUB_CLIENT_ID="CLIENT_ID_DO_OAUTH_APP" \
  --from-literal=GF_AUTH_GITHUB_CLIENT_SECRET="CLIENT_SECRET_DO_OAUTH_APP"
```

**2. Configurar valores do Grafana:**

No `values.yaml` do kube-prometheus-stack, ajustar:

```yaml
grafana:
  envFromSecret: "grafana-oauth-secrets"

  grafana.ini:
    server:
      root_url: https://grafana.k8s-ee.edge.net.br

    auth.github:
      enabled: true
      allow_sign_up: true
      scopes: user:email,read:org
      auth_url: https://github.com/login/oauth/authorize
      token_url: https://github.com/login/oauth/access_token
      api_url: https://api.github.com/user
      allowed_organizations: {org}
      skip_org_role_sync: true
```

**3. Instalar stack de observabilidade:**

- kube-prometheus-stack (Prometheus + Grafana)
- Loki + Promtail (logs)
- Dashboards para namespaces efêmeros

### 4.4 DNS + TLS

Configurar wildcard certificate via Let's Encrypt (Traefik + cert-manager ou Traefik ACME):

```
*.k8s-ee.edge.net.br → TLS wildcard certificate
```

### 4.5 Operadores de Banco de Dados

Instalar os operadores necessários:

| Operador | Componente |
|----------|------------|
| CloudNativePG | PostgreSQL |
| MongoDB Community Operator | MongoDB |
| Redis via Helm | Redis |
| MinIO Operator | MinIO (S3-compatible) |
| MariaDB via Helm | MariaDB |

### 4.6 Verificar Setup

```bash
# Verificar nodes
kubectl get nodes

# Verificar pods dos runners
kubectl get pods -n arc-runners

# Verificar observabilidade
kubectl get pods -n observability

# Verificar operadores
kubectl get pods -n kube-system

# Runners visíveis no GitHub
# Acesse: https://github.com/organizations/{org}/settings/actions/runners
```

---

## 5. Parte 3: Fork do Repositório

### 5.1 Criar o Fork

1. Acesse `https://github.com/koder-cat/k8s-ephemeral-environments`
2. Clique **Fork** → selecione a organização (`edgebr`)
3. Resultado: `edgebr/k8s-ephemeral-environments`

### 5.2 Configurar o Fork

O fork precisa de **3 alterações mínimas** (um default por feature):

**1. Alterar o default do `k8s-ee-repo`:**

No arquivo `.github/workflows/pr-environment-reusable.yml`, altere o default do input `k8s-ee-repo`:

```yaml
inputs:
  k8s-ee-repo:
    description: 'Repository containing k8s-ee actions and charts (change this default in forks)'
    required: false
    type: string
    default: 'edgebr/k8s-ephemeral-environments'  # ← alterado de koder-cat/...
```

**2. Alterar o default da plataforma de build:**

No mesmo arquivo, altere o default do input `platforms`:

```yaml
inputs:
  platforms:
    description: 'Target platform for container image build (must match cluster architecture)'
    required: false
    type: string
    default: 'linux/amd64'  # ← alterado de linux/arm64
```

**3. Atualizar a allowlist de organizações:**

Edite `.github/config/allowed-orgs.json`:

```json
{
  "$schema": "./allowed-orgs.schema.json",
  "mode": "allowlist",
  "description": "Organizations and users allowed to use k8s-ephemeral-environments",
  "organizations": [
    "edgebr"
  ],
  "repositories": []
}
```

### 5.3 Sincronizar com Upstream

Para receber atualizações do repositório original sem conflitos:

```bash
# Adicionar upstream (uma vez)
git remote add upstream https://github.com/koder-cat/k8s-ephemeral-environments.git

# Buscar atualizações
git fetch upstream

# Merge do upstream na branch main
git checkout main
git merge upstream/main
```

Como as alterações do fork são apenas em **valores default** (não em lógica), conflitos de merge são raros. Se acontecerem, basta re-aplicar os defaults do fork.

---

## 6. Parte 4: Configuração por Repositório (Desenvolvedores)

O que cada repositório da organização precisa para usar a plataforma.

### 6.1 Criar k8s-ee.yaml

Crie o arquivo `k8s-ee.yaml` na raiz do repositório.

#### Configuração mínima

```yaml
# k8s-ee.yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/edgebr/k8s-ephemeral-environments/main/.github/actions/validate-config/schema.json
projectId: edge-myapp
```

#### Configuração completa

```yaml
# k8s-ee.yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/edgebr/k8s-ephemeral-environments/main/.github/actions/validate-config/schema.json
projectId: edge-myapp

app:
  port: 3000
  healthPath: /health
  metricsPath: /metrics

image:
  context: .
  dockerfile: Dockerfile

env:
  NODE_ENV: production
  LOG_LEVEL: info

databases:
  postgresql: true
  mongodb: false
  redis: false
  minio: false
  mariadb: false

metrics:
  enabled: false
```

#### Regras do projectId

| Regra | Valor |
|-------|-------|
| **Formato** | Alfanumérico minúsculo + hifens |
| **Tamanho** | 1 a 20 caracteres |
| **Pattern** | `^[a-z0-9]([a-z0-9-]{0,18}[a-z0-9])?$` |

> **Aviso de unicidade:** Namespaces são nomeados `{projectId}-pr-{number}`. Se dois repositórios usarem o mesmo `projectId` e o mesmo número de PR, haverá **colisão de namespace**. **Recomendação:** prefixe com uma abreviação da organização (ex: `edge-myapp` em vez de `myapp`).

#### Bancos de dados disponíveis

| Banco | Chave | Variável de ambiente injetada |
|-------|-------|-------------------------------|
| PostgreSQL | `databases.postgresql: true` | `DATABASE_URL` |
| MongoDB | `databases.mongodb: true` | `MONGODB_URL` |
| Redis | `databases.redis: true` | `REDIS_URL` |
| MinIO (S3) | `databases.minio: true` | `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` |
| MariaDB | `databases.mariadb: true` | `MARIADB_URL` |

Referência completa: [k8s-ee-config-reference.md](./k8s-ee-config-reference.md)

### 6.2 Criar Workflow File

Crie `.github/workflows/pr-environment.yml`:

```yaml
name: PR Environment

on:
  pull_request:
    types: [opened, reopened, synchronize, closed]

concurrency:
  group: pr-env-${{ github.event.pull_request.number }}
  cancel-in-progress: false

permissions:
  contents: read
  packages: write
  pull-requests: write
  security-events: write

jobs:
  pr-environment:
    uses: edgebr/k8s-ephemeral-environments/.github/workflows/pr-environment-reusable.yml@main
    with:
      pr-number: ${{ github.event.pull_request.number }}
      pr-action: ${{ github.event.action }}
      head-sha: ${{ github.event.pull_request.head.sha }}
      head-ref: ${{ github.head_ref }}
      repository: ${{ github.repository }}
      preview-domain: 'k8s-ee.edge.net.br'
    secrets: inherit
```

**Observações:**
- O reusable workflow aponta para `edgebr/k8s-ephemeral-environments` (o fork), não para `koder-cat`
- **Nenhum secret ou PAT adicional** é necessário — `secrets: inherit` passa o `GITHUB_TOKEN` automático
- O `preview-domain` deve ser o domínio configurado no DNS da organização
- O bloco `permissions` é **obrigatório** — muitas organizações configuram permissões de token restritas por padrão

**Inputs opcionais:**

| Input | Default | Descrição |
|-------|---------|-----------|
| `config-path` | `k8s-ee.yaml` | Caminho para o arquivo de configuração |
| `preview-domain` | `k8s-ee.edge.net.br` | Domínio base para URLs de preview |
| `kubectl-version` | `v1.31.0` | Versão do kubectl |
| `helm-version` | `v3.16.0` | Versão do Helm |
| `chart-version` | `1.0.0` | Versão do chart k8s-ee-app |

### 6.3 Dockerfile

O repositório deve ter um Dockerfile na raiz (ou no caminho configurado em `k8s-ee.yaml`).

Como o cluster roda em **x86 (AMD64)**, não há preocupações especiais com arquitetura — imagens padrão funcionam sem modificação.

#### Dicas por stack

| Stack | Notas |
|-------|-------|
| **Node.js** | `FROM node:22` funciona diretamente |
| **Python** | `python:3.12-slim` recomendado |
| **Go** | Build padrão (GOARCH=amd64 é default) |
| **.NET** | .NET 8+ funciona diretamente |
| **Java** | Imagens oficiais funcionam diretamente |

### 6.4 Health Endpoint

A aplicação deve responder **HTTP 200** no endpoint de health (padrão: `/health`).

Esse endpoint é usado para:
- **Startup probe** — verificar se a aplicação iniciou
- **Liveness probe** — verificar se a aplicação está respondendo
- **Readiness probe** — verificar se a aplicação está pronta para receber tráfego

O caminho pode ser customizado via `app.healthPath` no `k8s-ee.yaml`:

```yaml
app:
  healthPath: /api/health
```

---

## 7. Teste e Validação

### Passo a passo para validar a integração

**1. Abra um PR de teste**

Crie um PR com alteração simples (ex: atualizar README) no repositório configurado.

**2. Acompanhe o workflow**

Vá em **Actions** no repositório e observe os jobs:

| Job | Runner | O que faz |
|-----|--------|-----------|
| Validate Config | `ubuntu-latest` | Valida `k8s-ee.yaml` e organização na allowlist |
| Build Image | `ubuntu-latest` | Constrói imagem x86, publica no GHCR |
| Create Namespace | `arc-runner-set` | Cria namespace no cluster |
| Deploy App | `arc-runner-set` | Faz deploy via Helm (cria imagePullSecret automaticamente) |
| PR Comment | `ubuntu-latest` | Posta URL de preview no PR |

**3. Verifique o comentário no PR**

O bot postará um comentário com:
- URL de preview (ex: `https://edge-myapp-pr-1.k8s-ee.edge.net.br`)
- Nome do namespace
- SHA do commit

**4. Acesse a URL de preview**

Abra a URL no navegador e verifique que a aplicação está funcionando.

**5. Feche o PR**

Verifique que o namespace é destruído automaticamente:

```bash
kubectl get ns | grep edge-myapp
# Não deve retornar resultados
```

---

## 8. Funcionalidades Extras

### 8.1 Observabilidade (Grafana)

A instância Grafana da organização (não a do genesluna) está disponível em:

**URL:** `https://grafana.k8s-ee.edge.net.br`

Login via GitHub OAuth — apenas membros da organização podem acessar.

#### Consulta de logs (LogQL)

```
{namespace="edge-myapp-pr-42"}
```

Para filtrar por container:
```
{namespace="edge-myapp-pr-42", container="app"}
```

#### Resultados de segurança

Scans do Trivy (vulnerabilidades) e SBOM (lista de dependências) são enviados para a aba **Security** do repositório no GitHub.

### 8.2 Bootstrap SQL para Banco de Dados

O PostgreSQL (via CloudNativePG) suporta SQL de inicialização. Configure no `k8s-ee.yaml`:

```yaml
databases:
  postgresql:
    enabled: true
    bootstrapSql: |
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      INSERT INTO users (email, name) VALUES
        ('admin@example.com', 'Admin User')
      ON CONFLICT (email) DO NOTHING;
```

O SQL é executado automaticamente quando o banco de dados é criado.

### 8.3 Comando `/preserve`

> **Não disponível** na versão atual.

Ambientes são automaticamente destruídos quando PRs são fechados/mergeados. Essa funcionalidade pode ser disponibilizada em uma versão futura.

---

## 9. Troubleshooting

### Erro de validação de configuração

| Erro | Causa | Solução |
|------|-------|---------|
| `projectId` inválido | Formato incorreto | Use apenas `a-z`, `0-9`, `-`, máximo 20 caracteres |
| Schema validation failed | Campo incorreto no `k8s-ee.yaml` | Adicione o comentário `# yaml-language-server: $schema=...` para validação no IDE |

### Erro de pull de imagem (ImagePullBackOff)

**Sintoma:** Job de deploy falha com `ImagePullBackOff` ou `ErrImagePull`.

**Verificações:**

1. **imagePullSecret existe?**
   ```bash
   kubectl get secret ghcr-pull-secret -n {namespace}
   ```
2. **Secret tem credenciais válidas?**
   ```bash
   kubectl get secret ghcr-pull-secret -n {namespace} -o jsonpath='{.data.\.dockerconfigjson}' | base64 -d
   ```
3. **Token do workflow tem permissão `packages: read`?** — Verifique o bloco `permissions` no workflow

### Runner não aceita jobs

**Sintoma:** Workflow fica em "Queued" indefinidamente.

| Verificação | Comando / Ação |
|-------------|----------------|
| GitHub App tem permissões corretas | Verifique Actions (Read) e Administration (Read/Write) |
| Logs do listener | `kubectl logs -n arc-systems -l app.kubernetes.io/name=arc-runner-set-{org}` |
| Pods dos runners | `kubectl get pods -n arc-runners` |
| Runner visível no GitHub | `https://github.com/organizations/{org}/settings/actions/runners` |

### Erro de conexão com banco de dados

**Sintoma:** Aplicação não conecta ao banco.

| Verificação | Detalhe |
|-------------|---------|
| **Tempo de inicialização** | Bancos levam 30-60 segundos para ficarem prontos |
| **Variável de ambiente** | Verifique se a app lê `DATABASE_URL` corretamente |
| **Formato** | `postgresql://user:password@host:5432/dbname` |
| **Logs do banco** | `kubectl logs -n {namespace} -l app=postgresql` |

### Erro "Organization not authorized"

**Sintoma:** Job `Validate Config` falha com erro de organização não autorizada.

**Solução:** Verifique que a organização está na allowlist em `.github/config/allowed-orgs.json` no fork.

### Erro de build de imagem

**Sintoma:** Job `Build Image` falha.

| Verificação | Detalhe |
|-------------|---------|
| Dockerfile existe | Verifique o caminho configurado em `k8s-ee.yaml` |
| Build funciona localmente | `docker build .` |
| Permissão `packages: write` | Verifique o bloco `permissions` no workflow |

---

## 10. Checklist Resumo

### DevOps da organização

| # | Passo | Verificação |
|---|-------|-------------|
| 1 | Criar instância EC2 (x86, Ubuntu 24.04) | SSH funciona |
| 2 | Dar acesso SSH ao genesluna | `ssh ubuntu@{IP}` funciona |
| 3 | Criar GitHub App para ARC | App ID + Installation ID anotados |
| 4 | Criar OAuth App para Grafana | Client ID + Client Secret anotados |
| 5 | Compartilhar credenciais com genesluna | Transferência segura confirmada |
| 6 | Configurar DNS wildcard | `dig *.k8s-ee.edge.net.br → {IP-EC2}` |

### genesluna (setup do cluster)

| # | Passo | Verificação |
|---|-------|-------------|
| 7 | Instalar k3s | `kubectl get nodes` |
| 8 | Instalar ARC controller | `kubectl get pods -n arc-systems` |
| 9 | Criar secret + runner scale set | `kubectl get pods -n arc-runners` |
| 10 | Instalar observabilidade (Grafana + Prometheus + Loki) | `https://grafana.k8s-ee.edge.net.br` acessível |
| 11 | Configurar TLS wildcard | `https://*.k8s-ee.edge.net.br` com certificado válido |
| 12 | Instalar operadores de banco | CloudNativePG, MongoDB, Redis, MinIO, MariaDB |
| 13 | Aplicar RBAC | `kubectl get clusterrole arc-runner-role` |

### Fork do repositório

| # | Passo | Verificação |
|---|-------|-------------|
| 14 | Fork de `koder-cat/k8s-ephemeral-environments` | `edgebr/k8s-ephemeral-environments` existe |
| 15 | Alterar default de `k8s-ee-repo` | `edgebr/k8s-ephemeral-environments` |
| 16 | Alterar default de `platforms` | `linux/amd64` |
| 17 | Atualizar `allowed-orgs.json` | Contém `edgebr` |

### Desenvolvedor (por repositório)

| # | Passo | Verificação |
|---|-------|-------------|
| 18 | Criar `k8s-ee.yaml` com projectId único | Schema valida sem erros |
| 19 | Criar workflow file apontando para o fork | Arquivo existe em `.github/workflows/` |
| 20 | Dockerfile funciona | `docker build .` |
| 21 | Health endpoint responde 200 | `curl localhost:{port}/health` |
| 22 | PR de teste aberto e ambiente criado | URL de preview acessível |
