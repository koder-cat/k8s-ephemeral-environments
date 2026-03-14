# Pilot Project Integration - Progress Tracker

**Project:** htm-gestor-documentos | **Branch:** `feat/k8s-ee-integration` (from `gd-sprint-17`)
**Cluster:** `ubuntu@13.58.99.235` | **Domain:** `*.k8s-ee.edge.net.br` | **Registry:** ECR (us-east-2)

## Completed Steps

- [x] **Step 1:** Create branch (`feat/k8s-ee-integration` from `gd-sprint-17`) ✓
- [x] **Step 2:** AUTH_BYPASS_LDAP — bypass logic + 9 unit tests (added NODE_ENV production guard) ✓
- [x] **Step 3:** Express static file serving — SPA fallback middleware + 11 unit tests ✓
- [x] **Step 4:** Dockerfile.k8s-ee + entrypoint + .dockerignore update ✓
- [x] **Steps 5-7:** k8s-ee.yaml + workflow ✓

## In Progress

_(none)_

## Pending (no external blockers)

_(none — all steps complete)_

## Commits

| # | Message | Status |
|---|---------|--------|
| 1 | `feat(auth): add AUTH_BYPASS_LDAP for ephemeral environments` | ✅ Done (00e16287e) |
| 2 | `feat(backend): add static file serving for combined image mode` | ✅ Done (60c21ca65) |
| 3 | `feat(docker): add Dockerfile.k8s-ee and entrypoint` | ✅ Done (e1bfcc95b) |
| 4 | `feat: add k8s-ee platform configuration and workflow` | ✅ Done (ee5dc3d48) |
| 5 | `fix(config): use NODE_ENV=staging to avoid AUTH_BYPASS_LDAP conflict` | ✅ Done (43a5d6770) |

## Verification Checklist

### Local (before pushing)

- [ ] Unit tests pass: `yarn test --testPathPattern "auth-ldap|spa-fallback"` (17 new tests)
- [ ] Full test suite passes: `yarn test` (no regressions)
- [ ] Docker build succeeds: `docker build -f Dockerfile.k8s-ee -t htm-gestor-docs:local .`
- [ ] Image architecture: amd64
- [ ] Static files present: `/app/public/index.html`
- [ ] Entrypoint present: `/entrypoint.sh`

### End-to-end (after pushing)

- [ ] PR opened against `gd-sprint-17`
- [ ] `/deploy-preview` comment triggers workflow
- [ ] Preview URL resolves: `https://htm-gestor-docs-pr-{N}.k8s-ee.edge.net.br`
- [ ] Login works: `admin` / `Senh@Valida123`
- [ ] Frontend loads (Vue SPA)
- [ ] API responds (`/api/`)
- [ ] PR close triggers namespace cleanup

## External Dependencies

- [x] EC2 cluster running with k3s (v1.34.4+k3s1)
- [x] ARC runner registered with GitHub
- [x] KUBECONFIG secret set on edgebr org
- [x] DNS wildcard `*.k8s-ee.edge.net.br` → EC2 Elastic IP
- [x] ECR credentials (org secrets: `ECR_AWS_ACCESS_KEY_ID`, `ECR_AWS_SECRET_ACCESS_KEY`)
- [x] TLS via Let's Encrypt + Route 53

## Log

| Date | Action | Result |
|------|--------|--------|
| 2026-03-14 | Plan created | `docs/plans/migration-htm-pilot.md` — 7 steps, 4 commits, 17 unit tests |
