# Parameterize Cluster-Specific Values for Multi-Org Support

## Context

The platform runs on two clusters: Oracle Cloud VPS (ARM64, koder-cat) and EC2 (amd64, edgebr). The edgebr fork needs to stay in sync with upstream without merge conflicts. Currently, architecture (`arm64`), domain (`k8s-ee.genesluna.dev`), and org name (`koder-cat`) are hardcoded throughout workflows and actions. By replacing these with `${{ vars.VARIABLE_NAME || 'default' }}`, each fork only needs to set 3 repository variables.

## Variables

| Variable | Default (koder-cat) | edgebr value |
|----------|---------------------|--------------|
| `ARCHITECTURE` | `arm64` | `amd64` |
| `DOMAIN` | `k8s-ee.genesluna.dev` | `k8s-ee.edge.net.br` |
| `ORG_NAME` | `koder-cat` | `edgebr` |

## Additional Fix: Dynamic K8s API IP

The `k8s-api-ip` input in `create-namespace/action.yml` and `pr-environment-reusable.yml` was hardcoded to `10.0.0.39` (Oracle VPS node IP). This broke the EC2 cluster because:
- The MinIO operator sidecar connects to the K8s API via ClusterIP (`10.43.0.1:443`), which falls in `10.0.0.0/8` and was blocked by the egress NetworkPolicy
- The hardcoded IP didn't match the EC2 cluster

**Fix:** Removed the `k8s-api-ip` input entirely. The NetworkPolicy step now dynamically resolves both the ClusterIP and the endpoint IP:
```bash
K8S_API_CLUSTER_IP=$(kubectl get svc kubernetes -n default -o jsonpath='{.spec.clusterIP}')
K8S_API_ENDPOINT_IP=$(kubectl get endpoints kubernetes -n default -o jsonpath='{.subsets[0].addresses[0].ip}')
```
Both IPs are needed because kube-proxy DNATs the ClusterIP to the endpoint IP, and NetworkPolicy evaluates after DNAT on some CNIs. Both ports 443 and 6443 are allowed for each IP.

## Changes

### 1. `.github/workflows/pr-environment.yml` (lines 38-48)
Pass the 3 variables to the reusable workflow via `with:`:
```yaml
preview-domain: ${{ vars.DOMAIN || 'k8s-ee.genesluna.dev' }}
platforms: linux/${{ vars.ARCHITECTURE || 'arm64' }}
k8s-ee-repo: ${{ vars.ORG_NAME || 'koder-cat' }}/k8s-ephemeral-environments
architecture: ${{ vars.ARCHITECTURE || 'arm64' }}
```
- Line 9 comment mentions `koder-cat` — leave as documentation

### 2. `.github/workflows/pr-environment-reusable.yml`
- **Add new input** `architecture` (default: `arm64`, description: `Target architecture for tool downloads`) after the `platforms` input
- Keep existing defaults for `preview-domain`, `platforms`, `k8s-ee-repo` as-is (callers override)
- **Lines 355-358, 408-411, 533-536, 669-672**: All 4 `setup-tools` calls — add:
  ```yaml
  architecture: ${{ inputs.architecture }}
  ```
- **Lines 600-608, 612-619, 708-716, 719-726**: All 4 `pr-comment` calls — add:
  ```yaml
  preview-domain: ${{ inputs.preview-domain }}
  ```

### 3. `.github/workflows/preserve-environment.yml`
- **Lines 65, 67**: Hardcoded `arm64` in kubectl download URLs → use `${{ vars.ARCHITECTURE || 'arm64' }}`

### 4. `.github/actions/pr-comment/action.yml`
- Add `preview-domain` input (default: `k8s-ee.genesluna.dev`)
- Add `PREVIEW_DOMAIN: ${{ inputs.preview-domain }}` to the env block (line ~99)
- **Line 113**: Change hardcoded Grafana URL to use env var:
  ```javascript
  const grafanaUrl = process.env.GRAFANA_URL || `https://grafana.${process.env.PREVIEW_DOMAIN}/d/pr-environment-overview?var-namespace=${namespace}`;
  ```

### 5. `.github/actions/deploy-app/action.yml`
- **Line 45**: Change default `chart-repository` to use a pattern the fork can override:
  Keep default as-is (`oci://ghcr.io/koder-cat/...`) — callers pass explicitly when needed
- **Line 293**: The sed pattern for local chart rewrite hardcodes `koder-cat`:
  ```bash
  s|repository: "oci://ghcr.io/koder-cat/k8s-ephemeral-environments/charts"|repository: "file://../${chart}"|
  ```
  Change to match any org generically:
  ```bash
  s|repository: "oci://ghcr.io/[^"]*/charts"|repository: "file://../${chart}"|
  ```
  This makes the sed work regardless of which org's OCI URL is in Chart.yaml.

### 6. `.github/actions/validate-config/action.yml`
- **Line 208**: Hardcoded issue URL `https://github.com/koder-cat/k8s-ephemeral-environments/issues`
  Change to use dynamic GitHub context:
  ```bash
  echo "${{ github.server_url }}/${{ github.repository }}/issues"
  ```
  Note: In composite actions, `github.*` context is available and resolves to the calling repo.

### 7. `.github/workflows/cla.yml`
- **Lines 43, 46, 60**: Three `koder-cat` references (CLA document URL, remote-organization-name, CLA link in comment)
  Parameterize with vars:
  - Line 43: `path-to-document: 'https://github.com/${{ vars.ORG_NAME || 'koder-cat' }}/k8s-ephemeral-environments/blob/main/CLA.md'`
  - Line 46: `remote-organization-name: ${{ vars.ORG_NAME || 'koder-cat' }}`
  - Line 60: Same pattern for CLA link URL

## Summary of File Changes

| File | Change |
|------|--------|
| `.github/workflows/pr-environment.yml` | Pass `vars.DOMAIN`, `vars.ARCHITECTURE`, `vars.ORG_NAME` to reusable workflow |
| `.github/workflows/pr-environment-reusable.yml` | Add `architecture` input; pass to all 4 `setup-tools` calls; pass `preview-domain` to all 4 `pr-comment` calls |
| `.github/workflows/preserve-environment.yml` | Replace hardcoded `arm64` with `${{ vars.ARCHITECTURE || 'arm64' }}` in kubectl URLs |
| `.github/workflows/cla.yml` | Parameterize 3 `koder-cat` refs with `vars.ORG_NAME` |
| `.github/actions/pr-comment/action.yml` | Add `preview-domain` input; use it to build Grafana URL |
| `.github/actions/deploy-app/action.yml` | Make sed pattern generic (match any org in OCI URL) |
| `.github/actions/validate-config/action.yml` | Use dynamic `github.repository` for issue URL |

## Files NOT Changed (with rationale)

- `setup-tools/action.yml` — `arm64` default on line 15 is overridden by callers; `arm64|amd64` on lines 55-56 is validation regex
- `build-image/action.yml` — `linux/arm64` default on line 29 is overridden by callers; `koder-cat` on line 187 is a code comment; `amd64|arm64` on lines 124/127 is validation
- `validate-config/action.yml` — `genesluna` default on line 18 is overridden by reusable workflow (line 246); `arm64` on line 240 is runtime `runner.arch` detection, not configurable
- `deploy-app/action.yml` — `genesluna` default on line 37 is overridden by reusable workflow (line 550); OCI default on line 45 only used when `use-local-charts: false` (reusable workflow always uses `true`; direct callers must pass `chart-repository` explicitly)
- `pr-environment-reusable.yml` — defaults for `preview-domain` (line 43), `platforms` (line 68), `k8s-ee-repo` (line 73) are static fallbacks; callers override via `with:`
- `validate-config/schema.json` — `$id` is non-functional metadata
- `allowed-orgs.json` — static data file, each fork maintains its own
- `CODEOWNERS` — repo-specific, each fork maintains its own
- `charts/k8s-ee-app/Chart.yaml` — OCI references use `koder-cat` but the generic sed fix in `deploy-app` handles any org; `home`/`sources` URLs are metadata only

## Verification

1. **Grep check**: After changes, grep for hardcoded `arm64`, `genesluna`, and `koder-cat` in `.github/` — only acceptable in:
   - Default values using `|| 'default'` fallback pattern
   - `CODEOWNERS` (not parameterizable)
   - `allowed-orgs.json` (data file)
   - `schema.json` `$id` field
   - Validation regex (`arm64|amd64` pattern in setup-tools)
   - Documentation comments
2. **Upstream behavior preserved**: Without any `vars.*` set, all defaults match current behavior (arm64, genesluna domain, koder-cat org)
3. **Fork behavior**: Setting 3 repository variables (ARCHITECTURE, DOMAIN, ORG_NAME) on edgebr fork should make everything work without file changes
