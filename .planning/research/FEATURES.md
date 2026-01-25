# Feature Landscape: Multi-Container Support for k8s-ee-app

**Domain:** Kubernetes Helm Chart Multi-Container Extension
**Researched:** 2026-01-25
**Confidence:** HIGH (verified with official Kubernetes documentation)

## Executive Summary

This research documents the features and patterns required to extend the k8s-ee-app Helm chart from single-container to multi-container support. The target use case is deploying frontend (nginx) + backend (node) + samba-ad containers in the same pod, while maintaining backward compatibility with existing single-container configurations.

The Kubernetes ecosystem has mature, well-documented patterns for multi-container pods. Native sidecar support (stable since Kubernetes v1.33) and established Helm patterns like `extraContainers` provide clear implementation paths.

---

## Table Stakes

Features users expect when multi-container support is advertised.

| Feature | Why Expected | Complexity | Confidence |
|---------|--------------|------------|------------|
| Multiple main containers in same pod | Core requirement - containers share network/storage | Medium | HIGH |
| Per-container image specification | Each container needs its own image/tag/digest | Low | HIGH |
| Per-container resource limits | Containers have different resource profiles | Low | HIGH |
| Per-container port configuration | Frontend on 80, backend on 3000, etc. | Low | HIGH |
| Shared volumes between containers | File-based communication between containers | Low | HIGH |
| localhost communication | Containers talk via localhost:port | None (automatic) | HIGH |
| Init containers support | Database migrations, config generation | Medium | HIGH |
| Backward compatibility | Single-container configs must still work | Medium | HIGH |
| Per-container health checks | Different endpoints for each container | Medium | HIGH |
| Per-container environment variables | Container-specific env vars | Low | HIGH |

---

## Differentiators

Features that would set k8s-ee apart from basic multi-container Helm charts.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Native sidecar containers | Proper lifecycle management (K8s 1.29+) | Medium | Uses `restartPolicy: Always` in initContainers |
| Automatic ingress routing | Route paths to different containers | Medium | `/api/*` -> backend, `/*` -> frontend |
| Container dependency ordering | Start backend before frontend | Low | Init container pattern |
| Shared config injection | Common env vars across all containers | Low | Quality-of-life for users |
| Per-container metrics endpoints | Scrape multiple metrics paths | Medium | ServiceMonitor per container |
| Resource quota calculation | Auto-calculate quota for N containers | Medium | Extend existing quota logic |
| Build matrix support | Build multiple Dockerfiles from k8s-ee.yaml | High | GitHub Actions enhancement |

---

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Separate pods for tightly-coupled services | Defeats purpose; adds network latency, scheduling complexity | Use multi-container pod for tightly-coupled services |
| Unbounded container arrays | Complex to validate, easy to misconfigure | Support explicit containers (main, sidecars) with defined roles |
| Automatic service mesh injection | Over-engineering for PR environments | Keep it simple; use localhost communication |
| Container-level replica scaling | Containers in a pod scale together; this isn't possible | Use separate Deployments if independent scaling needed |
| Complex inter-pod networking | Ephemeral environments don't need service discovery | Rely on localhost within pod |

---

## Kubernetes Multi-Container Patterns

### Pattern 1: Multiple Main Containers

**What:** Multiple application containers sharing network namespace
**When:** Frontend + backend that must be co-located
**Kubernetes API:**

```yaml
spec:
  containers:
    - name: frontend
      image: nginx:1.25
      ports:
        - containerPort: 80
    - name: backend
      image: node:20
      ports:
        - containerPort: 3000
```

**Key Points:**
- Containers share IP address; communicate via `localhost`
- Must coordinate port usage (no conflicts)
- All containers start/stop together
- Scheduling as single unit

**Source:** [Kubernetes Pods Documentation](https://kubernetes.io/docs/concepts/workloads/pods/)

### Pattern 2: Native Sidecar Containers (Kubernetes 1.29+)

**What:** Init containers with `restartPolicy: Always` that run alongside main containers
**When:** Logging agents, proxies, monitoring sidecars
**Kubernetes API:**

```yaml
spec:
  initContainers:
    - name: log-shipper
      image: fluent-bit:latest
      restartPolicy: Always  # Makes it a sidecar
      volumeMounts:
        - name: logs
          mountPath: /var/log/app
  containers:
    - name: app
      image: myapp:v1
      volumeMounts:
        - name: logs
          mountPath: /var/log/app
```

**Key Points:**
- Starts before main containers, runs entire pod lifetime
- Proper termination: shuts down after main containers exit
- Supports health probes (liveness, readiness, startup)
- Better resource calculation (included in pod totals)

**Source:** [Kubernetes Sidecar Containers](https://kubernetes.io/docs/concepts/workloads/pods/sidecar-containers/)

### Pattern 3: Init Containers

**What:** Containers that run to completion before main containers start
**When:** Database migrations, config generation, waiting for dependencies
**Kubernetes API:**

```yaml
spec:
  initContainers:
    - name: wait-for-db
      image: busybox
      command: ['sh', '-c', 'until nc -z db 5432; do sleep 1; done']
    - name: run-migrations
      image: myapp:v1
      command: ['npm', 'run', 'migrate']
  containers:
    - name: app
      image: myapp:v1
```

**Key Points:**
- Run sequentially, each must complete successfully
- Share volumes with main containers
- Already implemented in k8s-ee-app for database readiness

**Source:** [Kubernetes Init Containers](https://kubernetes.io/docs/concepts/workloads/pods/init-containers/)

### Pattern 4: Shared Volume Communication

**What:** Containers exchange data via shared filesystem
**When:** Log shipping, static file generation, config sharing
**Kubernetes API:**

```yaml
spec:
  volumes:
    - name: shared-data
      emptyDir: {}
  containers:
    - name: producer
      volumeMounts:
        - name: shared-data
          mountPath: /data/output
    - name: consumer
      volumeMounts:
        - name: shared-data
          mountPath: /data/input
```

**Key Points:**
- `emptyDir` is ephemeral (lost on pod deletion)
- Different mount paths allowed per container
- Useful for nginx serving static files from backend

**Source:** [Kubernetes Shared Volumes](https://kubernetes.io/docs/tasks/access-application-cluster/communicate-containers-same-pod-shared-volume/)

---

## Helm Chart Patterns for Multi-Container

### Pattern 1: Explicit Container List (Recommended)

**What:** Define containers as array in values.yaml
**When:** Known container types, need validation
**values.yaml:**

```yaml
containers:
  - name: frontend
    image:
      repository: ghcr.io/org/frontend
      tag: "1.0.0"
    port: 80
    healthPath: /health
    resources:
      requests:
        cpu: 50m
        memory: 128Mi
      limits:
        cpu: 200m
        memory: 256Mi

  - name: backend
    image:
      repository: ghcr.io/org/backend
      tag: "1.0.0"
    port: 3000
    healthPath: /api/health
    resources:
      requests:
        cpu: 100m
        memory: 256Mi
      limits:
        cpu: 500m
        memory: 512Mi
```

**deployment.yaml template:**

```yaml
spec:
  containers:
  {{- range .Values.containers }}
    - name: {{ .name }}
      image: "{{ .image.repository }}:{{ .image.tag }}"
      ports:
        - containerPort: {{ .port }}
      resources:
        {{- toYaml .resources | nindent 8 }}
      livenessProbe:
        httpGet:
          path: {{ .healthPath }}
          port: {{ .port }}
  {{- end }}
```

**Source:** [Helm Flow Control](https://helm.sh/docs/chart_template_guide/control_structures/)

### Pattern 2: extraContainers Extension (Industry Standard)

**What:** Allow users to add arbitrary sidecars
**When:** Extensibility without chart changes
**values.yaml:**

```yaml
# Main app container (always present)
app:
  port: 3000
  healthPath: /health

# Optional additional containers
extraContainers: []
# Example:
# extraContainers:
#   - name: nginx-sidecar
#     image: nginx:1.25
#     ports:
#       - containerPort: 80

extraInitContainers: []
```

**deployment.yaml template:**

```yaml
spec:
  {{- with .Values.extraInitContainers }}
  initContainers:
    {{- toYaml . | nindent 4 }}
  {{- end }}
  containers:
    - name: app
      image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
      # ... main app config
    {{- with .Values.extraContainers }}
    {{- toYaml . | nindent 4 }}
    {{- end }}
```

**Source:** [Airflow Helm Chart extraContainers](https://airflow.apache.org/docs/helm-chart/stable/using-additional-containers.html), [HashiCorp Vault extraContainers](https://developer.hashicorp.com/vault/docs/deploy/kubernetes/helm/configuration)

### Pattern 3: Named Container Slots (Hybrid Approach)

**What:** Pre-defined slots for common patterns
**When:** Opinionated chart with common use cases
**values.yaml:**

```yaml
# Primary application (backward compatible - single container)
app:
  enabled: true
  port: 3000
  # ... existing config

# Optional frontend container
frontend:
  enabled: false
  image:
    repository: ""
    tag: ""
  port: 80

# Optional sidecar for logging/metrics
sidecar:
  enabled: false
  image: fluent-bit:latest
```

**Advantage:** Stronger validation, better defaults, clearer intent.

---

## k8s-ee.yaml Configuration Schema

### Recommended: Backward-Compatible Extension

Single-container (current, still works):

```yaml
projectId: myapp
app:
  port: 3000
  healthPath: /health
image:
  context: .
  dockerfile: Dockerfile
```

Multi-container (new capability):

```yaml
projectId: myapp

# Primary container (backward compatible)
app:
  port: 3000
  healthPath: /health

image:
  context: .
  dockerfile: Dockerfile

# New: Additional containers
containers:
  - name: frontend
    image:
      context: ./frontend
      dockerfile: Dockerfile
      # OR pre-built:
      # repository: nginx
      # tag: "1.25"
    port: 80
    healthPath: /
    resources:
      requests:
        cpu: 50m
        memory: 64Mi
      limits:
        cpu: 100m
        memory: 128Mi
    env:
      BACKEND_URL: "http://localhost:3000"

  - name: samba-ad
    image:
      repository: ghcr.io/org/samba-ad
      tag: latest
    port: 445
    # No healthPath = no probes
    resources:
      requests:
        cpu: 100m
        memory: 256Mi
      limits:
        cpu: 500m
        memory: 512Mi
```

### Schema Extension (JSON Schema)

```json
{
  "containers": {
    "type": "array",
    "description": "Additional containers to run alongside the main app",
    "items": {
      "type": "object",
      "required": ["name"],
      "properties": {
        "name": {
          "type": "string",
          "pattern": "^[a-z0-9]([a-z0-9-]*[a-z0-9])?$",
          "description": "Container name (DNS subdomain)"
        },
        "image": {
          "type": "object",
          "description": "Image configuration",
          "properties": {
            "context": { "type": "string" },
            "dockerfile": { "type": "string" },
            "repository": { "type": "string" },
            "tag": { "type": "string" }
          }
        },
        "port": {
          "type": "integer",
          "minimum": 1,
          "maximum": 65535
        },
        "healthPath": {
          "type": "string",
          "pattern": "^/.*"
        },
        "resources": {
          "$ref": "#/definitions/resources"
        },
        "env": {
          "type": "object",
          "additionalProperties": { "type": "string" }
        },
        "volumeMounts": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["name", "mountPath"],
            "properties": {
              "name": { "type": "string" },
              "mountPath": { "type": "string" }
            }
          }
        }
      }
    }
  },
  "volumes": {
    "type": "array",
    "description": "Shared volumes between containers",
    "items": {
      "type": "object",
      "required": ["name"],
      "properties": {
        "name": { "type": "string" },
        "emptyDir": { "type": "object" }
      }
    }
  }
}
```

---

## Ingress Routing Patterns

### Single Ingress with Path-Based Routing

```yaml
# For multi-container with frontend + backend
ingress:
  enabled: true
  routes:
    - path: /api
      container: backend  # Routes to backend container's port
    - path: /
      container: frontend  # Routes to frontend container's port
```

**Implementation in Helm:**

```yaml
spec:
  rules:
    - host: {{ .hostname }}
      http:
        paths:
        {{- range .Values.ingress.routes }}
          - path: {{ .path }}
            pathType: Prefix
            backend:
              service:
                name: {{ $.fullname }}
                port:
                  name: {{ .container }}
        {{- end }}
```

### Service with Multiple Ports

```yaml
apiVersion: v1
kind: Service
metadata:
  name: myapp
spec:
  ports:
    - name: frontend
      port: 80
      targetPort: 80
    - name: backend
      port: 3000
      targetPort: 3000
```

---

## Feature Dependencies

```
Backward Compatibility
         |
         v
Multiple Containers in values.yaml
         |
    +----+----+
    |         |
    v         v
Per-Container    Shared Volumes
Resources/Probes      |
    |                 v
    +----+----+  Volume Mounts
         |
         v
   Ingress Routing
         |
         v
   Build Matrix (GitHub Actions)
```

---

## MVP Recommendation

For initial multi-container support, prioritize:

1. **Backward compatibility** - Single-container configs unchanged
2. **containers[] array** - Simple array of additional containers
3. **Per-container image/port/resources** - Basic container configuration
4. **Shared volumes** - emptyDir volumes for container communication
5. **Health probes per container** - Optional healthPath per container

Defer to post-MVP:

- **Path-based ingress routing** - Requires Service changes, more complex
- **Native sidecar support** - K8s 1.29+ only; init containers work for now
- **Build matrix** - Requires GitHub Actions changes beyond Helm
- **Per-container metrics** - ServiceMonitor complexity

---

## Resource Quota Implications

With multiple containers, quota calculation becomes:

```
Total CPU = sum(container.resources.limits.cpu)
Total Memory = sum(container.resources.limits.memory)
```

**Example:**
- frontend: 100m CPU, 128Mi memory
- backend: 200m CPU, 384Mi memory
- samba-ad: 500m CPU, 512Mi memory
- **Total:** 800m CPU, 1Gi memory

The existing quota calculation logic in k8s-ee needs extension to sum across all containers.

---

## Sources

### Official Documentation (HIGH Confidence)
- [Kubernetes Pods](https://kubernetes.io/docs/concepts/workloads/pods/) - Multi-container fundamentals
- [Kubernetes Sidecar Containers](https://kubernetes.io/docs/concepts/workloads/pods/sidecar-containers/) - Native sidecar (v1.29+)
- [Kubernetes Shared Volumes](https://kubernetes.io/docs/tasks/access-application-cluster/communicate-containers-same-pod-shared-volume/) - Inter-container communication
- [Helm Flow Control](https://helm.sh/docs/chart_template_guide/control_structures/) - Range iteration
- [Helm Pod Best Practices](https://helm.sh/docs/chart_best_practices/pods/) - Image handling

### Industry Examples (MEDIUM Confidence)
- [Airflow Helm Chart extraContainers](https://airflow.apache.org/docs/helm-chart/stable/using-additional-containers.html)
- [HashiCorp Vault Helm Configuration](https://developer.hashicorp.com/vault/docs/deploy/kubernetes/helm/configuration)
- [Kubernetes Sidecar Best Practices - Spacelift](https://spacelift.io/blog/kubernetes-sidecar-container)
- [Kubernetes Sidecar Pattern - Plural](https://www.plural.sh/blog/kubernetes-sidecar-guide/)

### Community Patterns (LOW Confidence - verify before use)
- [Helm Loops - Medium](https://mustafaak4096.medium.com/loops-in-helm-charts-259e1b9e8422)
- [Multi-Container Helm Example - GitHub](https://github.com/thisisdavidbell/node-docker-kubernetes/blob/master/helm-chart-multi-container/templates/helm-template-multi-container-deployment.yaml)
