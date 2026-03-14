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

### ~~5. OAuth App para Grafana~~ ✅ Recebido e configurado

---

### ~~6. Token de acesso para limpeza automática~~ ✅ Recebido e configurado

---

---

## Itens para o piloto (htm-gestor-documentos)

### ~~7. Configuração de pacotes da organização~~ — Não necessário

~~Habilitar a opção que permite membros tornarem pacotes de containers públicos.~~

Não é mais necessário — imagens serão publicadas no ECR, não no GHCR.

---

### 8. Configuração do grupo de runners

Verificar que repositórios privados podem usar os self-hosted runners.

**Onde:** `https://github.com/organizations/edgebr/settings/actions/runner-groups`
**O que verificar:** O grupo "Default" permite que `edgebr/htm-gestor-documentos` (privado) use os runners ARC.

---

### ~~9. Repositório ECR para o piloto~~ — Não necessário

~~Criar repositório ECR para as imagens do piloto.~~

Não é mais necessário — o workflow cria o repositório ECR automaticamente no primeiro push.

---

### 10. Acesso dos secrets ECR ao repositório do fork

Os org secrets `ECR_AWS_ACCESS_KEY_ID` e `ECR_AWS_SECRET_ACCESS_KEY` precisam estar acessíveis ao repositório `edgebr/k8s-ephemeral-environments`.

**Onde:** `https://github.com/organizations/edgebr/settings/secrets/actions`
**O que fazer:** Clicar em cada secret (`ECR_AWS_ACCESS_KEY_ID` e `ECR_AWS_SECRET_ACCESS_KEY`) e verificar a seção "Repository access". Se estiver como "Selected repositories", adicionar `edgebr/k8s-ephemeral-environments` à lista.
**Por quê:** Ao rodar o workflow de PR environment no fork, o erro retornado é "The security token included in the request is invalid", o que indica que os secrets não estão acessíveis a este repositório. Os mesmos secrets funcionam em outros projetos da organização.

---

## Resumo

| # | Item | O que entregar | Status |
|---|------|----------------|--------|
| 1 | ~~GitHub App (ARC)~~ | ~~App ID, Installation ID, `.pem`~~ | ✅ |
| 2 | ~~DNS wildcard~~ | ~~`*.k8s-ee.edge.net.br` → Elastic IP~~ | ✅ |
| 3 | ~~Credenciais AWS (TLS)~~ | ~~IAM Access Key + Hosted Zone ID + email ACME~~ | ✅ |
| 4 | ~~Fork do repositório~~ | ~~`edgebr/k8s-ephemeral-environments`~~ | ✅ |
| 5 | ~~OAuth App (Grafana)~~ | ~~Client ID, Client Secret~~ | ✅ |
| 6 | ~~Token de limpeza~~ | ~~PAT com leitura de PRs~~ | ✅ |
| 7 | ~~Pacotes da organização~~ | ~~Não necessário (usando ECR)~~ | ✅ N/A |
| 8 | Grupo de runners | Verificar que repos privados podem usar runners | ❓ Verificar |
| 9 | ~~Repositório ECR~~ | ~~Não necessário (criado automaticamente)~~ | ✅ N/A |
| 10 | Secrets ECR no fork | Dar acesso ao `edgebr/k8s-ephemeral-environments` | ❓ Pendente |
