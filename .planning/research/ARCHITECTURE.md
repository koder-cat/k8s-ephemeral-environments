# Architecture Patterns

**Domain:** k8s-ee Platform Extension (ECR, Multi-container, Samba AD)
**Researched:** 2026-01-25
**Confidence:** HIGH (based on existing codebase analysis)

## Executive Summary

The k8s-ee platform has a well-structured, modular architecture that supports extension through three clearly defined integration points:

1. **Build Action** (`build-image/action.yml`) - Container registry abstraction
2. **k8s-ee-app Helm Chart** - Pod specification and database subcharts
3. **Configuration Schema** (`schema.json`) and Validation Action

Each extension (ECR, multi-container, Samba AD) maps cleanly to specific components with minimal cross-cutting concerns.

## Current Architecture Overview

```
                                    WORKFLOW LAYER
+------------------------------------------------------------------------------+
|  pr-environment-reusable.yml                                                  |
|  +----------+  +------------+  +----------------+  +-----------+             |
|  | validate |->| create-ns  |  | build-image    |->| deploy-app|             |
|  | config   |  | (parallel) |  | (parallel)     |  |           |             |
|  +----------+  +------------+  +----------------+  +-----------+             |
+------------------------------------------------------------------------------+
        |                                |                    |
        v                                v                    v
+---------------+              +------------------+   +------------------+
| schema.json   |              | GHCR Push        |   | k8s-ee-app Chart |
| k8s-ee.yaml   |              | (Docker Actions) |   | + Subcharts      |
+---------------+              +------------------+   +------------------+
                                                              |
                            +---------------+---------------+-+---------------+
                            |               |               |                 |
                            v               v               v                 v
                      +-----------+  +-----------+  +-----------+      +-----------+
                      | postgresql|  | mongodb   |  | redis     | ...  | mariadb   |
                      | (CNPG)    |  | (Operator)|  | (Deploy)  |      | (Deploy)  |
                      +-----------+  +-----------+  +-----------+      +-----------+
```

## Component Boundaries

| Component | Responsibility | Touches | Integration Points |
|-----------|---------------|---------|-------------------|
| `validate-config/action.yml` | Parse k8s-ee.yaml, validate schema, extract outputs | Schema, config parsing | Outputs consumed by all downstream jobs |
| `build-image/action.yml` | Build container, push to registry, security scan | Docker, registry auth | Registry abstraction point for ECR |
| `create-namespace/action.yml` | Create namespace, quotas, network policies | kubectl, quota calculation | Add samba-ad quota contribution |
| `deploy-app/action.yml` | Helm install with values from config | helm, charts | Chart source selection |
| `k8s-ee-app` chart | Deployment, Service, Ingress, init containers | Templates, subcharts | Multi-container extension point |
| Database subcharts | Database-specific resources (Cluster, Deployment) | CRDs, operators | New chart pattern for samba-ad |
| `schema.json` | Configuration validation | JSON Schema | Extend for new features |

## Extension 1: ECR Registry Support

### Integration Point: build-image Action

**Current State:**
```yaml
# build-image/action.yml - Lines 22-26
inputs:
  registry:
    description: 'Container registry'
    default: 'ghcr.io'
  github-token:
    description: 'GitHub token for registry authentication'
```

**Required Changes:**

1. **New inputs for ECR authentication:**
```yaml
inputs:
  registry-type:
    description: 'Registry type: ghcr or ecr'
    default: 'ghcr'
  aws-region:
    description: 'AWS region for ECR (required if registry-type=ecr)'
    required: false
  aws-role-arn:
    description: 'AWS IAM role ARN for OIDC authentication'
    required: false
```

2. **Conditional authentication flow:**
```
if registry-type == 'ecr':
    - aws-actions/configure-aws-credentials@v4 (OIDC)
    - aws-actions/amazon-ecr-login@v2
else:
    - docker/login-action (existing GHCR flow)
```

**Files to Modify:**
| File | Change |
|------|--------|
| `.github/actions/build-image/action.yml` | Add registry-type conditional, ECR auth steps |
| `.github/actions/validate-config/schema.json` | Add `image.registry` object with type enum |
| `.github/actions/validate-config/action.yml` | Extract registry config to outputs |
| `.github/workflows/pr-environment-reusable.yml` | Pass registry config to build-image |
| `docs/guides/k8s-ee-config-reference.md` | Document ECR configuration |

**New Files:**
| File | Purpose |
|------|---------|
| (none - all modifications to existing) | |

**Architecture Pattern:** Registry abstraction via conditional steps. No structural changes to workflow DAG.

### AWS OIDC Authentication Flow

**Confidence:** HIGH (verified via [AWS Prescriptive Guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/build-and-push-docker-images-to-amazon-ecr-using-github-actions-and-terraform.html) and [aws-actions/amazon-ecr-login](https://github.com/aws-actions/amazon-ecr-login))

Required IAM permissions for ECR push:
- `ecr:BatchGetImage`
- `ecr:BatchCheckLayerAvailability`
- `ecr:CompleteLayerUpload`
- `ecr:GetDownloadUrlForLayer`
- `ecr:InitiateLayerUpload`
- `ecr:PutImage`
- `ecr:UploadLayerPart`

The OIDC trust relationship eliminates long-lived credentials - tokens are generated per-workflow-run.

---

## Extension 2: Multi-Container Pod Support

### Integration Point: k8s-ee-app Chart

**Current State:**
```yaml
# charts/k8s-ee-app/templates/deployment.yaml - Lines 212-284
containers:
  - name: app
    image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
    # Single container configuration
```

**Required Changes:**

1. **Values schema extension:**
```yaml
# values.yaml additions
containers:
  # Primary container (backwards compatible - maps to existing image.*)
  primary:
    name: app
    # Inherits from image.repository, image.tag, app.port, etc.

  # Additional sidecar containers
  sidecars: []
  # - name: sidecar-name
  #   image: image:tag
  #   ports: [...]
  #   env: [...]
  #   resources: {...}
```

2. **Deployment template extension:**
```yaml
containers:
  - name: {{ .Values.containers.primary.name | default "app" }}
    # ... existing app container config ...
  {{- range .Values.containers.sidecars }}
  - name: {{ .name }}
    image: {{ .image }}
    {{- with .ports }}
    ports:
      {{- toYaml . | nindent 8 }}
    {{- end }}
    # ... additional sidecar config ...
  {{- end }}
```

**Files to Modify:**
| File | Change |
|------|--------|
| `charts/k8s-ee-app/values.yaml` | Add `containers` section with sidecars array |
| `charts/k8s-ee-app/templates/deployment.yaml` | Loop over sidecars, handle port allocation |
| `charts/k8s-ee-app/Chart.yaml` | Bump version |
| `.github/actions/validate-config/schema.json` | Add `containers.sidecars` array schema |
| `.github/actions/validate-config/action.yml` | Extract sidecar config to outputs |
| `.github/actions/deploy-app/action.yml` | Pass sidecar config via `--set-json` |

**Architecture Pattern:** Sidecar containers share network namespace with primary container. They communicate via localhost. The existing init container pattern (wait-for-database) demonstrates the multi-container approach already in use.

### Multi-Container Considerations

**Confidence:** HIGH (verified via [Kubernetes documentation](https://kubernetes.io/docs/concepts/workloads/pods/sidecar-containers/))

Key constraints:
1. **Port conflicts:** Sidecars must not use same port as primary app
2. **Resource aggregation:** Total pod resources = sum of all containers
3. **Lifecycle:** Sidecars start/stop with pod (Kubernetes v1.33+ has stable sidecar support)
4. **Health checks:** Only primary container health affects readiness by default

The existing deployment.yaml already handles multiple containers (init containers). Extension follows same pattern.

---

## Extension 3: Samba AD Chart

### Integration Point: New Helm Subchart

**Current Pattern (reference: mariadb chart):**
```
charts/mariadb/
  Chart.yaml          # name: k8s-ee-mariadb
  values.yaml         # defaults
  templates/
    _helpers.tpl      # name, fullname, labels, serviceName, envVars
    deployment.yaml   # Deployment + Service + Secret
```

**New Chart Structure:**
```
charts/samba-ad/
  Chart.yaml          # name: k8s-ee-samba-ad
  values.yaml         # domain, realm, admin password, storage
  templates/
    _helpers.tpl      # Standard helpers + envVars for AD connection
    deployment.yaml   # Deployment (privileged for AD)
    service.yaml      # LDAP (389), LDAPS (636), Kerberos (88), DNS (53)
    secret.yaml       # Admin credentials
    configmap.yaml    # smb.conf, krb5.conf
```

**Files to Modify:**
| File | Change |
|------|--------|
| `charts/k8s-ee-app/Chart.yaml` | Add samba-ad dependency |
| `charts/k8s-ee-app/values.yaml` | Add `samba-ad.enabled: false` |
| `charts/k8s-ee-app/templates/deployment.yaml` | Add samba-ad init container, envVars |
| `.github/actions/validate-config/schema.json` | Add `databases.samba-ad` schema |
| `.github/actions/validate-config/action.yml` | Extract samba-ad config |
| `.github/actions/create-namespace/action.yml` | Add samba-ad quota contribution |
| `.github/actions/deploy-app/action.yml` | Pass samba-ad config |
| `.github/workflows/pr-environment-reusable.yml` | Add samba-ad-enabled output |
| `docs/guides/k8s-ee-config-reference.md` | Document samba-ad configuration |

**New Files:**
| File | Purpose |
|------|---------|
| `charts/samba-ad/Chart.yaml` | Chart metadata |
| `charts/samba-ad/values.yaml` | Default configuration |
| `charts/samba-ad/templates/_helpers.tpl` | Name helpers, envVars template |
| `charts/samba-ad/templates/deployment.yaml` | Samba AD deployment |
| `charts/samba-ad/templates/service.yaml` | LDAP/Kerberos services |
| `charts/samba-ad/templates/secret.yaml` | Admin credentials |
| `charts/samba-ad/templates/configmap.yaml` | Configuration files |

### Samba AD Kubernetes Considerations

**Confidence:** MEDIUM (multiple community implementations exist, but no official Helm chart)

Sources reviewed:
- [samba-in-kubernetes/samba-container](https://github.com/samba-in-kubernetes/samba-container)
- [instantlinux/samba-dc](https://hub.docker.com/r/instantlinux/samba-dc)
- [Helg Klein's guide](https://helgeklein.com/blog/samba-active-directory-in-a-docker-container-installation-guide/)

Key challenges:
1. **Privileged mode:** Samba AD typically needs `--privileged` or specific capabilities
2. **DNS:** AD requires functioning DNS; may need custom CoreDNS configuration
3. **Persistence:** Domain database must persist; needs PVC
4. **ARM64 compatibility:** Must verify image availability for ARM64

Recommended base image: `instantlinux/samba-dc` (has ARM64 support, actively maintained)

### Resource Quota Contribution

Based on existing patterns in `create-namespace/action.yml`:

```bash
# Estimated Samba AD requirements
CPU_REQUESTS=$((CPU_REQUESTS + 200))   # 200m request
CPU_LIMITS=$((CPU_LIMITS + 500))       # 500m limit
MEM_REQUESTS=$((MEM_REQUESTS + 256))   # 256Mi request
MEM_LIMITS=$((MEM_LIMITS + 512))       # 512Mi limit
STORAGE=$((STORAGE + 2))               # 2Gi for domain database
PVCS=$((PVCS + 1))
PODS=$((PODS + 1))
SERVICES=$((SERVICES + 1))
```

---

## Extension 4: x86 Build Target

### Integration Point: build-image Action

**Current State:**
```yaml
# build-image/action.yml - Lines 27-29
inputs:
  platforms:
    default: 'linux/arm64'
```

**Required Changes:**

1. **Make platform configurable in k8s-ee.yaml:**
```yaml
image:
  platforms: linux/amd64  # or linux/arm64 (default), or linux/arm64,linux/amd64
```

2. **Propagate through workflow:**
- `schema.json`: Add `image.platforms` property
- `validate-config/action.yml`: Extract platforms to output
- `build-image/action.yml`: Use input platform (already parameterized)
- `pr-environment-reusable.yml`: Pass platform from config

**Files to Modify:**
| File | Change |
|------|--------|
| `.github/actions/validate-config/schema.json` | Add `image.platforms` |
| `.github/actions/validate-config/action.yml` | Extract platforms output |
| `.github/workflows/pr-environment-reusable.yml` | Pass platforms to build-image |

**Architecture Pattern:** The build-image action already accepts `platforms` input; only configuration propagation needed.

---

## Data Flow Summary

### Current Flow
```
k8s-ee.yaml
    |
    v
validate-config -----> project-id, namespace, databases.*, app.port, etc.
    |
    +---> create-namespace (uses database flags for quota)
    |
    +---> build-image (uses image.context, image.dockerfile)
    |
    +---> deploy-app (uses all outputs + image tag from build)
```

### Extended Flow
```
k8s-ee.yaml (extended)
    |
    v
validate-config -----> + image.registry.type, image.registry.awsRegion
    |                  + image.platforms
    |                  + containers.sidecars[]
    |                  + databases.samba-ad
    |
    +---> create-namespace (+ samba-ad quota)
    |
    +---> build-image (+ ECR auth, + platform)
    |
    +---> deploy-app (+ sidecar config, + samba-ad config)
```

---

## Dependency Graph (Implementation Order)

```
                    [1. x86 Platform Support]
                            |
                            v
[2. ECR Registry Support] --+-- [3. Samba AD Chart]
            |                           |
            +-------+-------+-----------+
                    |
                    v
            [4. Multi-Container Support]
```

**Rationale:**
1. **x86 first:** Smallest change, unblocks projects that need x86 immediately
2. **ECR second:** Independent of chart changes, enables AWS-native deployments
3. **Samba AD third:** New chart, follows existing patterns, may need x86 for compatibility
4. **Multi-container last:** Most complex, touches deployment template significantly

---

## Scalability Considerations

| Concern | Current Approach | Extension Impact |
|---------|------------------|------------------|
| Build time | Single platform ARM64 | Multi-platform builds ~2x time |
| Registry auth | GHCR token from GITHUB_TOKEN | ECR adds OIDC setup step (~5s) |
| Quota calculation | Per-database static values | Add samba-ad contribution |
| Chart dependencies | OCI pull from GHCR | No change (same pattern) |
| Init container wait | Per-database init container | Add samba-ad wait container |

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Breaking Backwards Compatibility
**What:** Changing existing config field semantics
**Why bad:** Existing k8s-ee.yaml files would break
**Instead:** Add new fields with defaults that preserve existing behavior

### Anti-Pattern 2: Monolithic Conditional Logic
**What:** Giant if/else blocks for registry type in action
**Why bad:** Hard to test, extend, maintain
**Instead:** Use composite action pattern or separate steps with `if:` conditions

### Anti-Pattern 3: Hardcoded Sidecar Assumptions
**What:** Assuming specific sidecar types (e.g., only Envoy proxy)
**Why bad:** Limits flexibility
**Instead:** Generic sidecar array that accepts any container spec

### Anti-Pattern 4: Skipping Quota Updates
**What:** Adding samba-ad chart without updating quota calculation
**Why bad:** Quota exceeded errors at runtime
**Instead:** Always update create-namespace quota logic with new services

---

## Testing Strategy

| Component | Test Type | Tool |
|-----------|-----------|------|
| Schema changes | Unit test | ajv-cli with test fixtures |
| Build action | Integration test | Workflow with matrix: [ghcr, ecr] |
| Samba AD chart | Helm lint + template | helm lint, helm template |
| Multi-container | E2E | Deploy with sidecar, verify both containers |
| Quota calculation | Unit test | Bash script test cases |

---

## Sources

### Official Documentation
- [AWS ECR GitHub Actions](https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/build-and-push-docker-images-to-amazon-ecr-using-github-actions-and-terraform.html) - HIGH confidence
- [aws-actions/amazon-ecr-login](https://github.com/aws-actions/amazon-ecr-login) - HIGH confidence
- [Kubernetes Sidecar Containers](https://kubernetes.io/docs/concepts/workloads/pods/sidecar-containers/) - HIGH confidence
- [Kubernetes Multi-Container Pods](https://kubernetes.io/blog/2025/04/22/multi-container-pods-overview/) - HIGH confidence

### Community Resources
- [samba-in-kubernetes/samba-container](https://github.com/samba-in-kubernetes/samba-container) - MEDIUM confidence
- [instantlinux/samba-dc](https://hub.docker.com/r/instantlinux/samba-dc) - MEDIUM confidence
- [Helg Klein's Samba AD Guide](https://helgeklein.com/blog/samba-active-directory-in-a-docker-container-installation-guide/) - MEDIUM confidence

### Codebase Analysis
- Existing chart patterns from postgresql, mariadb, redis, minio charts - HIGH confidence
- Workflow structure from pr-environment-reusable.yml - HIGH confidence
- Action interfaces from build-image, deploy-app, create-namespace - HIGH confidence
