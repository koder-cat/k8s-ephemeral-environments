# Tasks for US-032: Define Configuration Schema

**Status:** Done

## Tasks

### T-032.1: Define JSON Schema ✅
- **Description:** Create JSON Schema for k8s-ee.yaml validation
- **Acceptance Criteria:**
  - Schema validates projectId format (max 20 chars, lowercase alphanumeric + hyphens)
  - Schema defines all supported fields
  - Required vs optional fields clearly defined
  - Default values specified in schema
- **Estimate:** M
- **Files:** `.github/actions/validate-config/schema.json`

### T-032.2: Define Core Fields ✅
- **Description:** Define required and core optional fields
- **Acceptance Criteria:**
  - `projectId` - required, validated format
  - `app.port` - default 3000
  - `app.healthPath` - default /health
  - `app.metricsPath` - optional, no default
- **Estimate:** S
- **Files:** `.github/actions/validate-config/schema.json`

### T-032.3: Define Image Fields ✅
- **Description:** Define image build configuration fields
- **Acceptance Criteria:**
  - `image.context` - default "."
  - `image.dockerfile` - default "Dockerfile"
  - `image.repository` - auto-generated if not set
- **Estimate:** S
- **Files:** `.github/actions/validate-config/schema.json`

### T-032.4: Define Resource Fields ✅
- **Description:** Define resource request/limit fields
- **Acceptance Criteria:**
  - `resources.requests.cpu` - default "50m"
  - `resources.requests.memory` - default "128Mi"
  - `resources.limits.cpu` - default "200m"
  - `resources.limits.memory` - default "384Mi"
  - Validation against cluster limits (max 512Mi)
- **Estimate:** S
- **Files:** `.github/actions/validate-config/schema.json`

### T-032.5: Define Database Fields ✅
- **Description:** Define database enable/configuration fields
- **Acceptance Criteria:**
  - `databases.postgresql` - boolean or object, default false
  - `databases.mongodb` - boolean or object, default false
  - `databases.redis` - boolean or object, default false
  - `databases.minio` - boolean or object, default false
  - `databases.mariadb` - boolean or object, default false
  - Extended config (version, storage, etc.) when object
- **Estimate:** M
- **Files:** `.github/actions/validate-config/schema.json`

### T-032.6: Define Environment Fields ✅
- **Description:** Define environment variable fields
- **Acceptance Criteria:**
  - `env` - object of key-value pairs
  - `envFrom` - array of secretRef/configMapRef
  - Both optional
- **Estimate:** S
- **Files:** `.github/actions/validate-config/schema.json`, `.github/actions/validate-config/action.yml`

### T-032.7: Create Config Reference Documentation ✅
- **Description:** Create comprehensive configuration reference guide
- **Acceptance Criteria:**
  - All fields documented with types, defaults, and validation rules
  - Common scenarios with examples
  - Validation error troubleshooting
- **Estimate:** M
- **Files:** `docs/guides/k8s-ee-config-reference.md`

---

## Estimate Legend
- **XS:** < 1 hour
- **S:** 1-4 hours
- **M:** 4-8 hours (1 day)
- **L:** 2-3 days
- **XL:** 4-5 days
