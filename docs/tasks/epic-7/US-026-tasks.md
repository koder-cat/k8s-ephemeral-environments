# Tasks for US-026: Observability Enhancements

**Status:** Done

## Tasks

### ✅ T-026.1: Add Prometheus Metrics to Demo App
- **Description:** Export application metrics in Prometheus format
- **Acceptance Criteria:**
  - `prom-client` added to NestJS API
  - HTTP request duration metrics
  - HTTP request count by status code
  - Database connection pool metrics
  - `/metrics` endpoint exposed
- **Estimate:** M
- **Files:**
  - `demo-app/apps/api/package.json`
  - `demo-app/apps/api/src/main.ts`
  - `demo-app/apps/api/src/metrics/metrics.module.ts`
  - `demo-app/apps/api/src/metrics/metrics.service.ts`
  - `demo-app/apps/api/src/metrics/metrics.service.spec.ts`
  - `demo-app/apps/api/src/metrics/metrics.controller.ts`
  - `demo-app/apps/api/src/middleware/metrics.middleware.ts`
  - `demo-app/apps/api/src/middleware/metrics.middleware.spec.ts`

### ✅ T-026.2: Add Structured Logging (Pino)
- **Description:** Replace console.log with structured JSON logging
- **Acceptance Criteria:**
  - Pino logger integrated with NestJS
  - JSON log format in production
  - Pretty print in development
  - Log levels configurable via env
- **Estimate:** M
- **Files:**
  - `demo-app/apps/api/package.json`
  - `demo-app/apps/api/src/main.ts`
  - `demo-app/apps/api/src/app.module.ts`
  - `demo-app/apps/api/src/database.service.ts`

### ✅ T-026.3: Create ServiceMonitor
- **Description:** Auto-scrape app metrics with Prometheus Operator
- **Acceptance Criteria:**
  - ServiceMonitor CRD created
  - Targets demo-app pods automatically
  - Namespace selector works for ephemeral envs
  - Metrics visible in Prometheus
- **Estimate:** S
- **Files:**
  - `charts/demo-app/templates/servicemonitor.yaml`
  - `charts/demo-app/values.yaml`
  - `charts/demo-app/README.md` (metrics section added)
  - `k8s/arc/runner-rbac.yaml` (ServiceMonitor permissions added)

### ✅ T-026.4: Create Grafana Dashboards
- **Description:** Pre-built dashboards for PR environment monitoring
- **Acceptance Criteria:**
  - PR Environment Overview dashboard
  - Application Metrics dashboard
  - Dashboards auto-provisioned via ConfigMap
  - Namespace variable for filtering
- **Estimate:** L
- **Files:**
  - `k8s/observability/dashboards/pr-environment-overview.json`
  - `k8s/observability/dashboards/application-metrics.json`
  - `k8s/observability/dashboards/configmap.yaml`
  - `k8s/observability/dashboards/README.md`

### ✅ T-026.5: Add Missing Alerts
- **Description:** Expand PrometheusRule with additional alerts
- **Acceptance Criteria:**
  - Database connectivity alerts
  - Namespace quota approaching limits (80%)
  - API latency SLO alerts (p99 > 500ms)
  - Prometheus scrape failures
  - Loki ingestion errors
  - 8-10 new alerts total
- **Estimate:** M
- **Files:** `k8s/observability/custom-alerts.yaml`

### ✅ T-026.6: Add Correlation IDs
- **Description:** Request tracing via correlation ID header
- **Acceptance Criteria:**
  - Correlation ID middleware in NestJS
  - ID generated if not present in request
  - ID propagated to all log messages
  - ID returned in response header
- **Estimate:** S
- **Files:**
  - `demo-app/apps/api/src/middleware/correlation-id.middleware.ts`
  - `demo-app/apps/api/src/middleware/correlation-id.middleware.spec.ts`
  - `demo-app/apps/api/src/app.module.ts`

---

## Estimate Legend
- **XS:** < 1 hour
- **S:** 1-4 hours
- **M:** 4-8 hours (1 day)
- **L:** 2-3 days
- **XL:** 4-5 days
