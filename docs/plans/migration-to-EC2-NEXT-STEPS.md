# Setup do Cluster EC2 - Próximos Passos

**EC2:** `ubuntu@13.58.99.235` | **Org:** edgebr | **Domínio:** `k8s-ee.edge.net.br`

Os passos 0-6 estão completos. A stack da plataforma está rodando (21 pods, 2.3 GB / 15 GB RAM).
Todos os passos restantes estão bloqueados por inputs externos do DevOps da edgebr.

---

## O que o DevOps da edgebr precisa fornecer

| # | Item | Usado no | Prioridade |
|---|------|----------|------------|
| 1 | **GitHub App** para ARC: App ID, Installation ID, chave privada (.pem) | Passo 7 | Alta |
| 2 | **DNS**: wildcard `*.k8s-ee.edge.net.br` apontando para o Elastic IP da EC2 | Passo 8 | Alta |
| 3 | **Credenciais AWS para TLS**: IAM Access Key (Route 53) + Hosted Zone ID + email ACME | Passo 8 | Alta |
| 4 | **Fork** `koder-cat/k8s-ephemeral-environments` → `edgebr/k8s-ephemeral-environments` | Passo 10 | Alta |
| 5 | **OAuth App** para Grafana: Client ID, Client Secret | Passo 9 | Média |
| 6 | **GITHUB_TOKEN**: PAT com acesso de leitura a PRs dos repos da edgebr | Passo 11 | Média |

---

## Ordem de execução (quando os inputs chegarem)

### 1. ARC Runner Scale Set (Passo 7)

**Necessita:** Credenciais do GitHub App (item 1)

Na máquina local:
```bash
# Copiar .pem para a EC2
scp /caminho/para/edgebr-private-key.pem ubuntu@13.58.99.235:/tmp/edgebr-private-key.pem
```

Na EC2:
```bash
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

# Criar secret
kubectl create secret generic github-app-secret-edgebr \
  --namespace arc-runners \
  --from-literal=github_app_id="<APP_ID>" \
  --from-literal=github_app_installation_id="<INSTALLATION_ID>" \
  --from-file=github_app_private_key=/tmp/edgebr-private-key.pem

# Deletar .pem imediatamente
rm /tmp/edgebr-private-key.pem
```

Criar `k8s/arc/values-runner-set-edgebr.yaml` localmente:
```yaml
githubConfigUrl: "https://github.com/edgebr"
githubConfigSecret: github-app-secret-edgebr
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
# Copiar e instalar
scp k8s/arc/values-runner-set-edgebr.yaml ubuntu@13.58.99.235:~/k8s/arc/

ssh ubuntu@13.58.99.235 "export KUBECONFIG=/etc/rancher/k3s/k3s.yaml && \
  helm install arc-runner-set-edgebr \
    --namespace arc-runners \
    oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set \
    -f ~/k8s/arc/values-runner-set-edgebr.yaml"
```

**Verificar:** Runners visíveis em `https://github.com/organizations/edgebr/settings/actions/runners`

---

### 2. TLS + Grafana Ingress (Passo 8)

**Necessita:** DNS configurado (item 2) + credenciais AWS para Route 53 (item 3)

Criar secret com credenciais IAM no cluster:
```bash
kubectl create secret generic route53-credentials \
  --namespace kube-system \
  --from-literal=AWS_ACCESS_KEY_ID="<ACCESS_KEY>" \
  --from-literal=AWS_SECRET_ACCESS_KEY="<SECRET_KEY>"
```

Criar `k8s/traefik/traefik-config-edgebr.yaml` adaptado de `k8s/traefik/traefik-config.yaml` com o resolver `route53`, Hosted Zone ID e email ACME da edgebr.

Criar `k8s/observability/grafana-ingress-edgebr.yaml`:
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: grafana
  namespace: observability
  labels:
    app.kubernetes.io/name: grafana
    app.kubernetes.io/component: observability
  annotations:
    traefik.ingress.kubernetes.io/router.entrypoints: websecure
    traefik.ingress.kubernetes.io/router.tls: "true"
    traefik.ingress.kubernetes.io/router.tls.certresolver: letsencrypt-prod
spec:
  ingressClassName: traefik
  tls:
    - hosts:
        - grafana.k8s-ee.edge.net.br
  rules:
    - host: grafana.k8s-ee.edge.net.br
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: prometheus-grafana
                port:
                  number: 80
```

```bash
scp k8s/traefik/traefik-config-edgebr.yaml ubuntu@13.58.99.235:~/k8s/traefik/
scp k8s/observability/grafana-ingress-edgebr.yaml ubuntu@13.58.99.235:~/k8s/observability/

ssh ubuntu@13.58.99.235 "export KUBECONFIG=/etc/rancher/k3s/k3s.yaml && \
  kubectl apply -f ~/k8s/traefik/traefik-config-edgebr.yaml && \
  kubectl apply -f ~/k8s/observability/grafana-ingress-edgebr.yaml"
```

**Verificar:** `curl -I https://grafana.k8s-ee.edge.net.br` retorna 200 com TLS válido

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

### 4. KUBECONFIG para GitHub Actions (Passo 10)

**Necessita:** Fork da edgebr criado (item 4)

Na EC2:
```bash
sudo cat /etc/rancher/k3s/k3s.yaml | sed 's/127.0.0.1/13.58.99.235/' > /tmp/kubeconfig-edgebr.yaml
cat /tmp/kubeconfig-edgebr.yaml
rm /tmp/kubeconfig-edgebr.yaml
```

Adicionar a saída como secret de repositório ou organização com o nome `KUBECONFIG` no fork da edgebr no GitHub (Settings > Secrets and variables > Actions).

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
