# k8s-ee Configuration Reference

Complete reference for the `k8s-ee.yaml` configuration file used by ephemeral PR environments.

## Quick Start

Minimal configuration requires only `projectId`:

```yaml
# k8s-ee.yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/koder-cat/k8s-ephemeral-environments/main/.github/actions/validate-config/schema.json
projectId: myapp
```

> **Tip:** Add the schema comment for IDE autocompletion and validation.

This creates PR environments at `myapp-pr-{number}.k8s-ee.genesluna.dev` with sensible defaults.

## Full Configuration Example

```yaml
# k8s-ee.yaml - Full example with all options
projectId: myapp

app:
  port: 3000
  healthPath: /health
  metricsPath: /metrics

image:
  context: .
  dockerfile: Dockerfile
  repository: ghcr.io/myorg/myapp  # Optional, auto-generated if not set

resources:
  requests:
    cpu: 50m
    memory: 128Mi
  limits:
    cpu: 200m
    memory: 384Mi

env:
  NODE_ENV: production
  LOG_LEVEL: info

envFrom:
  - secretRef:
      name: my-secret
  - configMapRef:
      name: my-config

databases:
  postgresql: true
  mongodb: false
  redis: false
  minio: false
  mariadb: false

ingress:
  enabled: true
  annotations:
    custom.annotation/key: value

metrics:
  enabled: false
  interval: 30s
```

## Field Reference

### projectId (required)

Unique identifier for this project in multi-tenant clusters.

| Property | Value |
|----------|-------|
| Type | string |
| Required | Yes |
| Min Length | 1 |
| Max Length | 20 |
| Pattern | `^[a-z0-9]([a-z0-9-]{0,18}[a-z0-9])?$` |

**Validation Rules:**
- Must be lowercase alphanumeric with hyphens
- Must start and end with alphanumeric character
- Maximum 20 characters (leaves room for `-pr-{number}` suffix)

**Examples:**
```yaml
projectId: myapp           # Valid
projectId: my-cool-app     # Valid
projectId: my-app-123      # Valid
projectId: MyApp           # Invalid: uppercase
projectId: my_app          # Invalid: underscore
projectId: -myapp          # Invalid: starts with hyphen
projectId: this-is-a-very-long-project-name  # Invalid: too long
```

---

### app

Application settings for the deployed container.

#### app.port

| Property | Value |
|----------|-------|
| Type | integer |
| Default | 3000 |
| Minimum | 1 |
| Maximum | 65535 |

Container port the application listens on. The platform automatically configures:
- **Deployment:** Sets the container port
- **NetworkPolicy:** Allows ingress traffic on this port from Traefik

**Common Configurations:**
```yaml
app:
  port: 3000  # Node.js, Express, NestJS (default)
  port: 8080  # .NET, Go, Java Spring Boot
  port: 8000  # Python FastAPI, Django
```

#### app.healthPath

| Property | Value |
|----------|-------|
| Type | string |
| Default | "/health" |
| Pattern | `^/.*` |

Health check endpoint path used for liveness and readiness probes.

```yaml
app:
  healthPath: /api/health
```

#### app.metricsPath

| Property | Value |
|----------|-------|
| Type | string |
| Default | (none) |
| Pattern | `^/.*` |

Metrics endpoint path for Prometheus scraping. Only needed if `metrics.enabled: true`.

```yaml
app:
  metricsPath: /metrics
```

---

### image

Docker image build configuration.

#### image.context

| Property | Value |
|----------|-------|
| Type | string |
| Default | "." |

Docker build context path relative to repository root.

```yaml
image:
  context: ./backend
```

#### image.dockerfile

| Property | Value |
|----------|-------|
| Type | string |
| Default | "Dockerfile" |

Path to Dockerfile relative to the build context.

```yaml
image:
  dockerfile: Dockerfile.prod
```

#### image.repository

| Property | Value |
|----------|-------|
| Type | string |
| Default | (auto-generated) |

Custom image repository URL. If not set, auto-generated as `ghcr.io/{owner}/{repo}`.

```yaml
image:
  repository: ghcr.io/myorg/custom-image
```

---

### resources

Container resource requests and limits. Must fit within cluster LimitRange (max 512Mi memory per container).

#### resources.requests.cpu

| Property | Value |
|----------|-------|
| Type | string |
| Default | "50m" |
| Pattern | `^[0-9]+(m\|[0-9]*)?$` |

CPU request in millicores (e.g., `50m`, `100m`, `0.5`).

#### resources.requests.memory

| Property | Value |
|----------|-------|
| Type | string |
| Default | "128Mi" |
| Pattern | `^[0-9]+(Mi\|Gi)$` |

Memory request (e.g., `128Mi`, `256Mi`, `1Gi`).

#### resources.limits.cpu

| Property | Value |
|----------|-------|
| Type | string |
| Default | "200m" |
| Pattern | `^[0-9]+(m\|[0-9]*)?$` |

CPU limit in millicores.

#### resources.limits.memory

| Property | Value |
|----------|-------|
| Type | string |
| Default | "384Mi" |
| Pattern | `^[0-9]+(Mi\|Gi)$` |

Memory limit. Maximum allowed: 512Mi (cluster LimitRange).

```yaml
resources:
  requests:
    cpu: 100m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 512Mi
```

---

### env

Environment variables as key-value pairs.

| Property | Value |
|----------|-------|
| Type | object |
| Default | {} |
| Key Pattern | `^[A-Za-z_][A-Za-z0-9_]*$` |

```yaml
env:
  NODE_ENV: production
  LOG_LEVEL: info
  API_URL: https://api.example.com
```

---

### envFrom

Environment variables from Kubernetes secrets or configmaps.

| Property | Value |
|----------|-------|
| Type | array |
| Default | [] |

Each item must have exactly one of `secretRef` or `configMapRef` (not both).

```yaml
envFrom:
  - secretRef:
      name: database-credentials
  - configMapRef:
      name: app-config
```

---

### databases

Database configuration. All databases are disabled by default (opt-in).

When enabled, databases are automatically deployed to your PR environment and connection details are injected as environment variables (e.g., `DATABASE_URL` for PostgreSQL).

Each database can be configured as:
- **Boolean:** `true` to enable with defaults, `false` to disable
- **Object:** Enable with custom configuration

#### databases.postgresql

| Property | Value |
|----------|-------|
| Type | boolean \| object |
| Default | false |

PostgreSQL database using CloudNativePG operator.

```yaml
# Simple enable
databases:
  postgresql: true

# With custom configuration
databases:
  postgresql:
    enabled: true
    version: "16"
    storage: 2Gi

# With bootstrap SQL (for table creation)
databases:
  postgresql:
    enabled: true
    bootstrap:
      postInitApplicationSQL:
        - |
          CREATE TABLE users (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255)
          );
          GRANT ALL PRIVILEGES ON users TO app;
          GRANT USAGE, SELECT ON SEQUENCE users_id_seq TO app;
```

Object properties:
- `enabled`: boolean (default: true)
- `version`: string (default: "16")
- `storage`: string (default: "1Gi", pattern: `^[0-9]+(Mi|Gi|Ti)$`)
- `bootstrap.postInitApplicationSQL`: array of SQL strings to run after database creation
- `bootstrap.initSQL`: array of SQL strings to run on postgres database (for extensions)

**Important:** Bootstrap SQL runs as `postgres` superuser, but your app connects as `app` user. You must include `GRANT` statements for table access. Use `$func$` instead of `$$` for function delimiters.

**Note:** For production applications with evolving schemas, use [Drizzle ORM migrations](./database-migrations.md) instead of bootstrap SQL. Migrations provide versioning, are reversible, and work with existing data.

#### databases.mongodb

| Property | Value |
|----------|-------|
| Type | boolean \| object |
| Default | false |

MongoDB database using MongoDB Community Operator.

```yaml
databases:
  mongodb:
    enabled: true
    storage: 2Gi
```

Object properties:
- `enabled`: boolean (default: true)
- `version`: string
- `storage`: string (default: "1Gi", pattern: `^[0-9]+(Mi|Gi|Ti)$`)

#### databases.redis

| Property | Value |
|----------|-------|
| Type | boolean \| object |
| Default | false |

Redis cache using simple deployment.

```yaml
databases:
  redis: true
```

Object properties:
- `enabled`: boolean (default: true)

#### databases.minio

| Property | Value |
|----------|-------|
| Type | boolean \| object |
| Default | false |

MinIO object storage using MinIO Operator.

```yaml
databases:
  minio:
    enabled: true
    storage: 5Gi
```

Object properties:
- `enabled`: boolean (default: true)
- `storage`: string (default: "1Gi", pattern: `^[0-9]+(Mi|Gi|Ti)$`)

#### databases.mariadb

| Property | Value |
|----------|-------|
| Type | boolean \| object |
| Default | false |

MariaDB database using simple deployment.

```yaml
databases:
  mariadb:
    enabled: true
    version: "11.4"
    storage: 2Gi
```

Object properties:
- `enabled`: boolean (default: true)
- `version`: string (default: "11.4")
- `storage`: string (default: "1Gi", pattern: `^[0-9]+(Mi|Gi|Ti)$`)

#### Resource Requirements by Database

The platform **automatically calculates** ResourceQuota based on enabled databases. Each PR namespace receives a quota sized for its specific configuration.

| Service | CPU Limit | Memory Limit | Storage |
|---------|-----------|--------------|---------|
| Application (base) | 300m | 512Mi | 1Gi |
| PostgreSQL | +500m | +512Mi | +2Gi |
| MongoDB | +500m | +512Mi | +2Gi |
| Redis | +200m | +128Mi | - |
| MinIO | +500m | +512Mi | +2Gi |
| MariaDB | +300m | +256Mi | +2Gi |

**Example Calculated Quotas:**

| Configuration | CPU Limit | Memory Limit | Storage |
|---------------|-----------|--------------|---------|
| App only | 300m | 512Mi | 1Gi |
| App + PostgreSQL | 800m | 1Gi | 3Gi |
| App + PostgreSQL + Redis | 1000m | 1.1Gi | 3Gi |
| App + PostgreSQL + MongoDB | 1300m | 1.5Gi | 5Gi |
| All databases enabled | 2100m | 2.4Gi | 9Gi |

The quota is calculated at namespace creation time based on the `databases` section in your `k8s-ee.yaml`. No manual intervention is required.

> **Note:** Quotas are calculated once at namespace creation. If you add databases to an existing PR environment, close and reopen the PR to recalculate quotas, or manually patch the ResourceQuota.

> **Note:** These are approximate values. Actual consumption varies based on workload and operator versions.

---

### ingress

Ingress configuration for external access.

#### ingress.enabled

| Property | Value |
|----------|-------|
| Type | boolean |
| Default | true |

Enable/disable ingress creation.

#### ingress.annotations

| Property | Value |
|----------|-------|
| Type | object |
| Default | {} |

Additional annotations for the ingress resource.

```yaml
ingress:
  enabled: true
  annotations:
    nginx.ingress.kubernetes.io/proxy-body-size: 10m
    traefik.ingress.kubernetes.io/rate-limit: "100"
```

---

### metrics

Prometheus metrics configuration.

#### metrics.enabled

| Property | Value |
|----------|-------|
| Type | boolean |
| Default | false |

Enable ServiceMonitor for Prometheus scraping.

#### metrics.interval

| Property | Value |
|----------|-------|
| Type | string |
| Default | "30s" |
| Pattern | `^[0-9]+(s\|m\|h)$` |

Scrape interval (e.g., `15s`, `1m`, `5m`).

```yaml
metrics:
  enabled: true
  interval: 15s
```

#### Automatic Namespace Labeling

When metrics are enabled, the ServiceMonitor automatically adds a `namespace` label to all scraped metrics using Prometheus relabeling. This enables Grafana dashboards to filter metrics by namespace without requiring your application to add this label.

Your application metrics will include `namespace="myapp-pr-42"` automatically, matching the PR environment namespace.

---

## Common Scenarios

### Node.js API with PostgreSQL

```yaml
projectId: my-api

app:
  port: 3000
  healthPath: /health

env:
  NODE_ENV: production

databases:
  postgresql: true
```

### Python Flask with Redis Cache

```yaml
projectId: flask-app

app:
  port: 5000
  healthPath: /healthz

resources:
  requests:
    memory: 256Mi
  limits:
    memory: 512Mi

databases:
  redis: true
```

### Full-Stack with Multiple Databases

```yaml
projectId: fullstack

app:
  port: 8080
  healthPath: /api/health
  metricsPath: /metrics

databases:
  postgresql: true
  redis: true
  minio:
    enabled: true
    storage: 2Gi

metrics:
  enabled: true
  interval: 30s
```

### Monorepo Backend Service

```yaml
projectId: backend-svc

image:
  context: ./services/backend
  dockerfile: Dockerfile

app:
  port: 4000
  healthPath: /ready

envFrom:
  - secretRef:
      name: shared-secrets
```

---

## Validation Errors

The schema validation provides clear error messages:

| Error | Cause | Fix |
|-------|-------|-----|
| `projectId must match pattern` | Invalid characters or format | Use lowercase alphanumeric + hyphens only |
| `projectId must be <= 20 characters` | ID too long | Shorten the project ID |
| `app.port must be >= 1` | Invalid port number | Use port between 1-65535 |
| `resources.limits.memory must match pattern` | Invalid memory format | Use format like `256Mi` or `1Gi` |
| `databases.*.storage must match pattern` | Invalid storage format | Use format like `1Gi`, `500Mi`, or `2Ti` |
| `env property name is invalid` | Invalid env var name | Use pattern `[A-Za-z_][A-Za-z0-9_]*` |
| `envFrom item must have secretRef or configMapRef` | Empty envFrom entry | Specify either `secretRef` or `configMapRef` |

---

## Computed Values

These values are automatically computed and added to the configuration:

| Field | Formula | Example |
|-------|---------|---------|
| `_computed.namespace` | `{projectId}-pr-{prNumber}` | `myapp-pr-42` |
| `_computed.previewUrl` | `https://{namespace}.{domain}` | `https://myapp-pr-42.k8s-ee.genesluna.dev` |
| `_computed.prNumber` | From workflow input | `42` |

---

## See Also

- [Onboarding New Repository](./onboarding-new-repo.md) - Getting started guide
- [Database Setup](./database-setup.md) - Database configuration details
- [Troubleshooting](./troubleshooting.md) - Common issues and solutions
