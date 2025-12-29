# Tasks for US-009: Create Isolated Database per PR

## Overview

This story implements a database-agnostic platform supporting PostgreSQL, MongoDB, MySQL, Redis, and MinIO through Kubernetes operators and reusable library Helm charts.

## Tasks

### T-009.1: Install CloudNativePG Operator
- **Description:** Install CloudNativePG operator for PostgreSQL support
- **Acceptance Criteria:**
  - Operator deployed to `cnpg-system` namespace
  - ARM64 compatible images used
  - Operator watching all namespaces for Cluster CRDs
  - Installation documented in `k8s/operators/cloudnative-pg/`
- **Estimate:** S

### T-009.2: Install MongoDB Community Operator
- **Description:** Install MongoDB Community Operator for MongoDB support
- **Acceptance Criteria:**
  - Operator deployed to `mongodb-system` namespace
  - ARM64 compatible images used
  - Operator watching all namespaces for MongoDBCommunity CRDs
  - Installation documented in `k8s/operators/mongodb-community/`
- **Estimate:** S

### T-009.3: Install MinIO Operator
- **Description:** Install MinIO Operator for S3-compatible object storage
- **Acceptance Criteria:**
  - Operator deployed to `minio-operator` namespace
  - ARM64 compatible images used
  - Operator watching all namespaces for Tenant CRDs
  - Installation documented in `k8s/operators/minio/`
- **Estimate:** S

### T-009.4: Create PostgreSQL Library Chart
- **Description:** Create reusable Helm sub-chart for PostgreSQL
- **Acceptance Criteria:**
  - Chart at `charts/postgresql/`
  - Creates CloudNativePG Cluster resource
  - Configurable storage size (default: 1Gi emptyDir)
  - Resource limits appropriate for ephemeral environments
  - Exports `postgresql.envVars` template for credential injection
  - Values documented with examples
- **Estimate:** M

### T-009.5: Create MongoDB Library Chart
- **Description:** Create reusable Helm sub-chart for MongoDB
- **Acceptance Criteria:**
  - Chart at `charts/mongodb/`
  - Creates MongoDBCommunity resource
  - Single-member replica set for ephemeral use
  - Resource limits appropriate for ephemeral environments
  - Exports `mongodb.envVars` template for credential injection
  - Values documented with examples
- **Estimate:** M

### T-009.6: Create MinIO Library Chart
- **Description:** Create reusable Helm sub-chart for MinIO
- **Acceptance Criteria:**
  - Chart at `charts/minio/`
  - Creates MinIO Tenant resource (single-node mode)
  - Resource limits appropriate for ephemeral environments
  - Exports `minio.envVars` template for credential injection
  - Values documented with examples
- **Estimate:** M

### T-009.7: Create Redis Library Chart
- **Description:** Create reusable Helm sub-chart for Redis
- **Acceptance Criteria:**
  - Chart at `charts/redis/`
  - Simple Redis deployment (no operator needed for ephemeral)
  - Resource limits appropriate for ephemeral environments
  - Exports `redis.envVars` template for credential injection
  - Values documented with examples
- **Estimate:** S

### T-009.8: Update Demo-App to Use PostgreSQL Library Chart
- **Description:** Integrate PostgreSQL library chart into demo-app
- **Acceptance Criteria:**
  - `charts/demo-app/Chart.yaml` declares postgresql dependency
  - `charts/demo-app/values.yaml` has `postgresql.enabled: true`
  - Demo-app deployment uses `postgresql.envVars` template
  - Demo-app code reads `DATABASE_URL` environment variable
  - Health check verifies database connectivity
- **Estimate:** M

### T-009.9: Test Database Isolation
- **Description:** Verify databases are isolated between PRs
- **Acceptance Criteria:**
  - Open 2 test PRs simultaneously
  - Each has separate database instance
  - Data in one doesn't appear in other
  - Namespace deletion cascades to database resources
- **Estimate:** S

### T-009.10: Document Project Onboarding
- **Description:** Create documentation for project teams
- **Acceptance Criteria:**
  - Guide at `docs/guides/database-setup.md`
  - Covers enabling each database type
  - Includes example configurations
  - Documents environment variables
  - Troubleshooting section
- **Estimate:** S

---

## Estimate Legend
- **XS:** < 1 hour
- **S:** 1-4 hours
- **M:** 4-8 hours (1 day)
- **L:** 2-3 days
- **XL:** 4-5 days

## Implementation Order

Recommended sequence:
1. T-009.1 (CloudNativePG) - Required for PostgreSQL
2. T-009.4 (PostgreSQL chart) - Most common database
3. T-009.8 (Demo-app integration) - Validate the pattern
4. T-009.2, T-009.3 (MongoDB, MinIO operators) - Parallel
5. T-009.5, T-009.6, T-009.7 (Other charts) - Can be parallel
6. T-009.9 (Testing)
7. T-009.10 (Documentation)
