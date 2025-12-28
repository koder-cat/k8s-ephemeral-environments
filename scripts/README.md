# Scripts

Utility scripts for managing the K8s Ephemeral Environments project.

## sync-stories.py

Orchestrator script that syncs user stories between local markdown docs and GitHub Issues.

### Features

- Parses user stories from `docs/user-stories/`
- Creates/updates GitHub issues with proper labels
- Syncs status (done label ↔ checkbox in docs)
- Bidirectional sync support

### Usage

```bash
# Sync both directions (default)
python3 scripts/sync-stories.py

# Only sync from docs to GitHub
python3 scripts/sync-stories.py --direction=to-github

# Only sync from GitHub to docs
python3 scripts/sync-stories.py --direction=from-github

# Dry run (preview changes without applying)
python3 scripts/sync-stories.py --dry-run
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--direction` | Sync direction: `both`, `to-github`, `from-github` | `both` |
| `--dry-run` | Show what would be done without making changes | `false` |
| `--docs-dir` | Path to user stories directory | `docs/user-stories` |

### Requirements

- Python 3.8+
- GitHub CLI (`gh`) installed and authenticated
- Repository must be a git repo with GitHub remote

### How It Works

1. **Parsing**: Reads markdown files matching `US-*.md` pattern
2. **Extraction**: Extracts metadata (title, status, priority, tasks, etc.)
3. **Mapping**: Maps stories to GitHub issues by story ID (e.g., US-001)
4. **Sync to GitHub**:
   - Creates new issues if story doesn't have one
   - Updates existing issues with latest content
   - Syncs labels (epic, priority, done)
5. **Sync from GitHub**:
   - Updates local docs with issue status
   - Syncs checkbox states from issue body

### GitHub Action

The script runs automatically via `.github/workflows/sync-stories.yml`:

- **On push to main**: Syncs docs → GitHub (when user stories change)
- **On issue events**: Syncs GitHub → docs (when issues are labeled/edited)
- **Manual trigger**: Run with custom options from Actions tab

### Labels Used

| Label | Purpose |
|-------|---------|
| `user-story` | Identifies user story issues |
| `epic-1-infrastructure` | Epic 1 issues |
| `epic-2-environments` | Epic 2 issues |
| `epic-3-database` | Epic 3 issues |
| `epic-4-observability` | Epic 4 issues |
| `epic-5-runners` | Epic 5 issues |
| `epic-6-security` | Epic 6 issues |
| `priority-must` | Must have (MVP) |
| `priority-should` | Should have |
| `priority-could` | Could have |
| `done` | Completed stories |
