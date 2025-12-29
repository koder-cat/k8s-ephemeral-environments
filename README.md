# K8s Ephemeral Environments

A platform that automatically creates temporary preview environments for every Pull Request.

## What is this?

When a developer opens a Pull Request, this platform automatically spins up a complete, isolated environment with the application and its database. The environment gets a unique URL that anyone on the team can access to test and review the changes. When the PR is closed or merged, the environment is automatically destroyed.

## The Problem

Traditional development workflows have friction points that slow down teams:

- **Reviewers can't easily test changes** - Without a live URL, reviewers must pull the code and run it locally just to see what changed
- **Shared staging environments create conflicts** - When multiple developers deploy to the same staging server, they overwrite each other's work
- **Debugging is painful** - Logs and metrics are scattered across different places, making it hard to find issues
- **Manual environment setup** - Creating test environments by hand is slow and leads to inconsistencies

## Our Solution

Every Pull Request gets its own isolated environment:

- **Instant preview URLs** - Open a PR and get a working URL in minutes, not hours
- **Complete isolation** - Each PR has its own application instance and database, no conflicts
- **Automatic lifecycle** - Environments are created and destroyed automatically, no manual work
- **Centralized observability** - All logs and metrics in one place with pre-built dashboards

## Benefits

| For | Benefit |
|-----|---------|
| **Developers** | Test your changes in a real environment before merge |
| **Reviewers** | Click a link to see changes live, no local setup needed |
| **QA Team** | Dedicated environment for each feature to test |
| **Team Leads** | Visibility into all active environments and their status |

## Goals

- Preview URL available within 10 minutes of opening a PR
- Environment cleaned up within 5 minutes of closing a PR
- Support at least 5 simultaneous PR environments
- Keep infrastructure costs under $120/month
- Zero manual intervention required

## Project Status

**Phase 1:** ✅ Complete - Platform fully operational on a single VPS server.

All 21 user stories implemented across 6 epics:
- Infrastructure (k3s, DNS, TLS)
- PR Environment Lifecycle (create, deploy, comment, destroy)
- Database per PR (PostgreSQL, MongoDB, MinIO, Redis)
- Observability (Prometheus, Loki, Grafana, alerts)
- GitHub Runners (ARC self-hosted runners)
- Security (quotas, network policies, cleanup job, preserve feature)

**Phase 2 (Future):** Migrating to AWS for better scalability and integration with managed services.

## Documentation

- [Product Requirements Document](docs/PRD.md) - Detailed technical specifications
- [User Stories](docs/user-stories/README.md) - Feature breakdown and progress
- [VPS Access](docs/runbooks/vps-access.md) - Server connection details

## How It Works

```
Developer opens PR
        ↓
GitHub Actions triggered
        ↓
New environment created (app + database)
        ↓
Preview URL posted as PR comment
        ↓
Team reviews and tests
        ↓
PR merged or closed
        ↓
Environment automatically destroyed
```
