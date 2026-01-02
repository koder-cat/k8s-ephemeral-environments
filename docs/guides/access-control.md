# Access Control

This guide explains the organization allowlist feature that controls which repositories can create ephemeral PR environments.

## Overview

k8s-ephemeral-environments uses an organization allowlist to control which repositories can create ephemeral PR environments. This prevents unauthorized use of cluster resources and enables multi-tenant security.

## How It Works

1. When a PR is opened, the reusable workflow validates the calling repository
2. The owner is extracted from the repository name (`owner/repo` → `owner`)
3. The owner is checked against the allowlist (case-insensitive)
4. If not allowed, the workflow fails immediately with a clear error message

```
Repository: koder-cat/myapp
            └── Owner: koder-cat (organization)
                       └── Checked against allowlist

Repository: genesluna/demo-app
            └── Owner: genesluna (user)
                       └── Checked against allowlist
```

**Note:** Both GitHub organizations and individual users can be added to the allowlist.
The `organizations` field name is historical - it works for both types.

## Configuration

The allowlist is defined in `.github/config/allowed-orgs.json`:

```json
{
  "$schema": "./allowed-orgs.schema.json",
  "mode": "allowlist",
  "description": "Organizations and users allowed to use k8s-ephemeral-environments",
  "organizations": [
    "genesluna",
    "koder-cat"
  ],
  "repositories": []
}
```

### Configuration Fields

| Field | Required | Description |
|-------|----------|-------------|
| `mode` | Yes | Access control mode (see below) |
| `description` | No | Human-readable description |
| `organizations` | Yes | Array of allowed organization/user names |
| `repositories` | No | Specific repositories to allow (overrides org-level) |

### Access Control Modes

| Mode | Behavior |
|------|----------|
| `allowlist` | Only listed organizations can use the platform (recommended) |
| `denylist` | All organizations except listed ones can use the platform |
| `disabled` | No access control (allows all - not recommended for production) |

> **Security Warning:** `denylist` mode allows all organizations except those explicitly listed.
> This is generally less secure than `allowlist` mode because unknown organizations are
> allowed by default. Only use `denylist` mode in controlled environments where you
> trust most users by default.

### Repository Overrides

You can allow specific repositories from non-allowed organizations:

```json
{
  "mode": "allowlist",
  "organizations": ["genesluna"],
  "repositories": ["external-org/special-repo"]
}
```

This allows `external-org/special-repo` even though `external-org` is not in the organizations list.

> **Note:** In `denylist` mode, entries in the `repositories` array are additional blocks (not exceptions).
> Repository overrides as exceptions only work in `allowlist` mode.

## Behavior Summary

| Scenario | Result |
|----------|--------|
| Org in allowlist | Allowed |
| Org not in allowlist | Blocked with error |
| Specific repo in repositories list | Allowed (overrides org-level) |
| Empty organizations + mode=allowlist | Blocks all (fail-safe) |
| mode=disabled | Allows all |
| Config file missing | Allows all with warning (backwards compatibility) |

## Error Message

When access is denied, the workflow fails with a clear message:

```
============================================================
ERROR: Organization 'unauthorized-org' is not authorized
============================================================

Repository 'unauthorized-org/some-repo' attempted to use k8s-ephemeral-environments
but the organization is not in the allowed list.

To request access, please open an issue at:
https://github.com/koder-cat/k8s-ephemeral-environments/issues
```

## Requesting Access

To add your organization to the allowlist:

1. Open an issue at [k8s-ephemeral-environments](https://github.com/koder-cat/k8s-ephemeral-environments/issues)
2. Provide your organization name
3. Briefly describe your use case
4. A maintainer will review and merge the addition

## For Platform Administrators

### Adding an Organization

1. Edit `.github/config/allowed-orgs.json`
2. Add the organization name to the `organizations` array
3. Commit and push to main
4. The change takes effect immediately for new workflow runs

```json
{
  "organizations": [
    "genesluna",
    "koder-cat",
    "new-org"  // Add new organization here
  ]
}
```

### Audit Trail

All changes to the allowlist are tracked via git history:

```bash
# View allowlist history
git log --oneline .github/config/allowed-orgs.json

# See who added which org
git blame .github/config/allowed-orgs.json
```

## Security Considerations

1. **Public visibility**: The allowlist file is public - anyone can see which orgs are allowed
2. **Git audit trail**: Changes require merge to main, providing full audit history
3. **Case-insensitive**: Matching is case-insensitive to prevent bypass via case manipulation
4. **Fail-safe default**: Empty allowlist denies all access

## ARC Runner Access

The organization allowlist controls which repos can **request** environments, while ARC runners control which repos can **execute** cluster operations.

**Current setup:**
- Allowlist: `genesluna`, `koder-cat`
- ARC runners: Org-level for `koder-cat` (see `k8s/arc/README.md`)

For a repo to use the platform, it must:
1. Be in an allowed organization (or explicitly listed in `repositories`)
2. Have the GitHub App installed (for ARC runner access)

## Related Documentation

- [Onboarding New Repository](./onboarding-new-repo.md) - How to set up a new repo
- [Troubleshooting](./troubleshooting.md) - Debugging common issues
- [Security Guide](./security.md) - Overall security architecture
- [ARC Setup](../../k8s/arc/README.md) - Self-hosted runner configuration
