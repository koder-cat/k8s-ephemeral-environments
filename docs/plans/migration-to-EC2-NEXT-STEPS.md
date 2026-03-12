# Setup do Cluster EC2 - Próximos Passos

**EC2:** `ubuntu@13.58.99.235` | **Org:** edgebr | **Domínio:** `k8s-ee.edge.net.br`

Os passos 0-8 e 10 estão completos. ARC runners registrados. TLS + Grafana Ingress live em `https://grafana.k8s-ee.edge.net.br`. KUBECONFIG configurado no fork.
Os passos restantes (9, 11) estão bloqueados por inputs externos do DevOps da edgebr.
Além disso, os workflows do fork precisam ser adaptados para arquitetura `amd64` (EC2) em vez de `arm64` (VPS original).

---

## O que o DevOps da edgebr precisa fornecer

| # | Item | Usado no | Status |
|---|------|----------|--------|
| 1 | ~~**GitHub App** para ARC: App ID, Installation ID, chave privada (.pem)~~ | ~~Passo 7~~ | ✅ Recebido |
| 2 | ~~**DNS**: wildcard `*.k8s-ee.edge.net.br`~~ | ~~Passo 8~~ | ✅ Recebido |
| 3 | ~~**Credenciais AWS para TLS**: IAM Access Key + Hosted Zone ID + email ACME~~ | ~~Passo 8~~ | ✅ Recebido |
| 4 | ~~**Fork** `koder-cat/k8s-ephemeral-environments` → `edgebr/k8s-ephemeral-environments`~~ | ~~Passo 10~~ | ✅ Recebido |
| 5 | **OAuth App** para Grafana: Client ID, Client Secret | Passo 9 | Pendente |
| 6 | **GITHUB_TOKEN**: PAT com acesso de leitura a PRs dos repos da edgebr | Passo 11 | Pendente |

---

## Ordem de execução (quando os inputs chegarem)

### 1. ~~ARC Runner Scale Set (Passo 7)~~ ✅ Concluído em 2026-03-12

Arquivo criado: `k8s/arc/values-runner-set-edgebr.yaml`
Secret criado: `github-app-secret-edgebr` em `arc-runners`
Helm release: `arc-runner-set-edgebr` (gha-runner-scale-set 0.13.1)
Verificado: Listener pod rodando, runner scale set registrado no GitHub

---

### 2. ~~TLS + Grafana Ingress (Passo 8)~~ ✅ Concluído em 2026-03-12

Arquivos criados: `k8s/traefik/traefik-config-edgebr.yaml`, `k8s/observability/grafana-ingress-edgebr.yaml`
Secret criado: `route53-credentials` em `kube-system`
Verificado: `curl -I https://grafana.k8s-ee.edge.net.br` → HTTP/2 302 com TLS válido

---

### 3. Grafana OAuth (Passo 9)

**Necessita:** Credenciais do OAuth App (item 5) + Passo 8 completo

Na EC2:
```bash
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

kubectl create secret generic grafana-oauth-secrets \
  --namespace observability \
  --from-literal=GF_AUTH_GITHUB_CLIENT_ID="<CLIENT_ID>" \
  --from-literal=GF_AUTH_GITHUB_CLIENT_SECRET="<CLIENT_SECRET>"
```

Criar `k8s/observability/kube-prometheus-stack/values-edgebr-with-oauth.yaml` localmente:
```yaml
# Overlay para o cluster edgebr - com OAuth habilitado
grafana:
  envFromSecret: "grafana-oauth-secrets"

  grafana.ini:
    server:
      root_url: https://grafana.k8s-ee.edge.net.br
    auth.github:
      allowed_organizations: edgebr
```

```bash
scp k8s/observability/kube-prometheus-stack/values-edgebr-with-oauth.yaml \
  ubuntu@13.58.99.235:~/k8s/observability/kube-prometheus-stack/

ssh ubuntu@13.58.99.235 "export KUBECONFIG=/etc/rancher/k3s/k3s.yaml && \
  helm upgrade prometheus prometheus-community/kube-prometheus-stack \
    -n observability \
    -f ~/k8s/observability/kube-prometheus-stack/values.yaml \
    -f ~/k8s/observability/kube-prometheus-stack/values-edgebr-with-oauth.yaml"
```

**Verificar:** Login via GitHub OAuth funciona em `https://grafana.k8s-ee.edge.net.br`

---

### 4. ~~KUBECONFIG para GitHub Actions (Passo 10)~~ ✅ Concluído em 2026-03-12

Secret `KUBECONFIG` configurado no `edgebr/k8s-ephemeral-environments` via `gh secret set`.
Usa IP interno (`192.168.23.55`) — runners ARC rodam dentro do cluster e não alcançam o IP público na porta 6443.
Teste verificado: runner ARC subiu, kubectl conectou, listou nodes e namespaces.

**Pendente:** Adaptar workflows do fork para arquitetura `amd64` (`.github/actions/setup-tools` default é `arm64`).

---

### 5. Cleanup CronJob (Passo 11)

**Necessita:** GITHUB_TOKEN (item 6)

Na EC2:
```bash
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

kubectl create secret generic github-cleanup-token \
  --namespace platform \
  --from-literal=GITHUB_TOKEN="<TOKEN>"

kubectl apply -f ~/k8s/platform/cleanup-job/cleanup-configmap.yaml
kubectl apply -f ~/k8s/platform/cleanup-job/cleanup-cronjob.yaml
```

**Verificar:** `kubectl get cronjobs -n platform` mostra tanto `cleanup` quanto `preserve-expiry`

---

## Verificação final (após todos os passos)

```bash
# Todos os pods saudáveis
kubectl get pods -A | grep -v Running | grep -v Completed

# TLS funcionando
curl -I https://grafana.k8s-ee.edge.net.br

# Teste ponta a ponta
# Abrir um PR de teste em um repo da edgebr → verificar criação de namespace, deploy e URL de preview
```
