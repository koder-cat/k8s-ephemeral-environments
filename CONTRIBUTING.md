# Contributing to k8s-ephemeral-environments

Thank you for your interest in contributing! This guide will help you get started.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [Code Style](#code-style)
- [User Story Sync](#user-story-sync)
- [Testing](#testing)
- [Documentation](#documentation)

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 9+
- Docker
- kubectl
- Helm 3.16+
- Git

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/k8s-ephemeral-environments.git
   cd k8s-ephemeral-environments
   ```
3. Install dependencies:
   ```bash
   cd demo-app
   pnpm install
   ```

## Development Workflow

### Branch Naming

Use descriptive branch names following these patterns:

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feat/us-XXX-description` | `feat/us-025-documentation` |
| Bug fix | `fix/issue-description` | `fix/database-connection-timeout` |
| Hotfix | `hotfix/critical-issue` | `hotfix/security-vulnerability` |

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation only
- `refactor` - Code change that neither fixes a bug nor adds a feature
- `test` - Adding or updating tests
- `chore` - Maintenance tasks

**Examples:**
```bash
feat(api): add health check endpoint
fix(web): resolve loading state race condition
docs(readme): update installation instructions
```

## Pull Request Process

1. **Create a feature branch** from `main`
2. **Make your changes** with clear, atomic commits
3. **Run tests locally** before pushing:
   ```bash
   cd demo-app
   pnpm test
   pnpm lint
   ```
4. **Push your branch** and create a Pull Request
5. **Wait for CI** - A preview environment will be created automatically
6. **Address review feedback** - Make requested changes
7. **Merge** - Once approved and CI passes

### PR Preview Environments

When you open a PR, the CI/CD pipeline automatically:
- Creates a dedicated Kubernetes namespace
- Deploys your changes with a PostgreSQL database
- Provides a preview URL: `k8s-ee-pr-{number}.k8s-ee.genesluna.dev`

Use the preview environment to verify your changes work correctly.

## Code Style

### TypeScript

- Strict mode enabled
- ESLint configured for both API and Web
- Run linting: `pnpm lint`

### Formatting

- 2-space indentation
- Single quotes for strings
- Trailing commas in multi-line structures
- No semicolons (API) / Semicolons optional (Web)

### File Organization

- Group related functionality in modules
- Keep files focused and single-purpose
- Use barrel exports (`index.ts`) for public APIs

## User Story Sync

User stories in `docs/user-stories/` are synchronized with GitHub Issues.

### Sync Script Usage

```bash
# Sync both directions (default)
python3 scripts/sync-stories.py

# Sync from docs to GitHub Issues
python3 scripts/sync-stories.py --direction=to-github

# Sync from GitHub Issues to docs
python3 scripts/sync-stories.py --direction=from-github

# Preview changes without applying
python3 scripts/sync-stories.py --dry-run
```

### Status Format

When updating story status, use this format in markdown files:

```markdown
# US-XXX: Story Title

**Status:** Done
```

Valid statuses: `Draft`, `To Do`, `In Progress`, `Done`, `Blocked`

## Testing

### Requirements

- Minimum 50% code coverage for both API and Web
- All tests must pass before merging

### Running Tests

```bash
cd demo-app

# Run all tests
pnpm test

# Run with coverage
pnpm test:cov

# Watch mode during development
pnpm test:watch

# Run specific app tests
pnpm --filter @demo-app/api test
pnpm --filter @demo-app/web test
```

### Writing Tests

- Place test files next to the code they test: `*.spec.ts` or `*.test.ts`
- Use descriptive test names that explain the expected behavior
- Mock external dependencies appropriately

## Documentation

### When to Update Docs

Update documentation when you:
- Add new features or APIs
- Change configuration options
- Modify deployment procedures
- Fix bugs that affect user workflows

### Documentation Locations

| Content | Location |
|---------|----------|
| User stories | `docs/user-stories/` |
| Task breakdowns | `docs/tasks/` |
| Runbooks | `docs/runbooks/` |
| Guides | `docs/guides/` |
| Demo app | `demo-app/README.md` |
| Helm charts | `charts/*/README.md` |

### Documentation Style

- Use clear, concise language
- Include code examples where helpful
- Keep procedures step-by-step
- Add troubleshooting sections for complex features

## Questions?

- Check existing [Issues](https://github.com/genesluna/k8s-ephemeral-environments/issues)
- Read the [Developer Onboarding Guide](docs/DEVELOPER-ONBOARDING.md)
- Review the [Troubleshooting Guide](docs/guides/troubleshooting.md)
