#!/usr/bin/env python3
"""
Orchestrator script to sync user stories between local docs and GitHub Issues.

Features:
- Reads user stories from docs/user-stories/
- Creates/updates GitHub issues
- Syncs status (done label <-> checkbox in docs)
- Can be run manually or via GitHub Action

Usage:
    python3 scripts/sync-stories.py [--dry-run] [--direction=both|to-github|from-github]
"""

import json
import logging
import os
import re
import subprocess
import sys
from argparse import ArgumentParser
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger(__name__)

# Configuration constants
GH_COMMAND_TIMEOUT = 60  # Timeout for GitHub CLI commands in seconds
GIT_COMMAND_TIMEOUT = 10  # Timeout for Git commands in seconds
MAX_ISSUES_FETCH = 200  # Maximum number of issues to fetch from GitHub
MAX_RETRIES = 3  # Maximum retry attempts for network operations
RETRY_BASE_DELAY = 2  # Base delay in seconds for exponential backoff

# Epic label configuration - add new epics here
EPIC_LABELS: Dict[str, str] = {
    "epic-1": "epic-1-infrastructure",
    "epic-2": "epic-2-environments",
    "epic-3": "epic-3-database",
    "epic-4": "epic-4-observability",
    "epic-5": "epic-5-runners",
    "epic-6": "epic-6-security",
}

# Allowed characters in titles (alphanumeric, spaces, common punctuation)
SAFE_TITLE_PATTERN = re.compile(r"[^\w\s\-:().,#/]")

# Pre-compiled regex patterns
CHECKBOX_PATTERN = re.compile(r"- \[(.)\]\s+(.+?)(?=\n|$)")
CHECKBOX_CHECKED_PATTERN = re.compile(r"- \[[xX]\]\s+(.+?)(?:\n|$)")
CHECKBOX_UNCHECKED_PATTERN = re.compile(r"- \[ \]\s+(.+?)(?:\n|$)")

# Rate limit patterns - these errors should be retried with backoff
RATE_LIMIT_PATTERNS = [
    "rate limit",
    "secondary rate limit",
    "api rate limit",
    "429",
]

# Non-retryable error patterns (authentication, validation, not found)
# Note: 403 is not included because rate limits also return 403
NON_RETRYABLE_ERRORS = [
    "401",  # Unauthorized
    "404",  # Not Found
    "422",  # Validation Failed
    "authentication",
    "unauthorized",
    "not found",
    "invalid",
    "permission denied",
]


@dataclass
class UserStory:
    """Represents a user story parsed from markdown."""

    id: str
    title: str
    status: str = "Draft"
    priority: str = "should"
    story_points: int = 0
    epic: str = ""
    epic_label: str = ""
    user_story: str = ""
    acceptance_criteria: List[Dict[str, Any]] = field(default_factory=list)
    tasks: List[Dict[str, Any]] = field(default_factory=list)
    dependencies: List[int] = field(default_factory=list)
    notes: str = ""
    implementation_details: str = ""
    file_path: str = ""
    issue_number: Optional[int] = None


def sanitize_text(text: str) -> str:
    """Remove potentially dangerous characters from text passed to CLI.

    Args:
        text: Text to sanitize

    Returns:
        Sanitized text with dangerous characters removed
    """
    return SAFE_TITLE_PATTERN.sub("", text)


def is_retryable_error(stderr: str) -> bool:
    """Check if an error is transient and should be retried.

    Rate limit errors are always retryable. Other errors are checked
    against the non-retryable patterns list.

    Args:
        stderr: Error output from command

    Returns:
        True if the error is transient and should be retried
    """
    stderr_lower = stderr.lower()

    # Rate limits should always be retried
    for pattern in RATE_LIMIT_PATTERNS:
        if pattern in stderr_lower:
            return True

    # Check for non-retryable errors
    for pattern in NON_RETRYABLE_ERRORS:
        if pattern.lower() in stderr_lower:
            return False

    return True


def parse_checkbox_section(content: str, section_name: str) -> List[Dict[str, Any]]:
    """Parse a markdown section containing checkbox items.

    Args:
        content: Full markdown content
        section_name: Name of the section to parse (e.g., "Acceptance Criteria")

    Returns:
        List of dicts with 'text' and 'checked' keys
    """
    items: List[Dict[str, Any]] = []
    match = re.search(
        rf"## {section_name}\s*\n\n(.*?)(?=\n##|\Z)",
        content,
        re.DOTALL
    )
    if match:
        section_content = match.group(1)
        for line in section_content.split("\n"):
            line = line.strip()
            if line.startswith("- ["):
                checked = line.startswith("- [x]") or line.startswith("- [X]")
                text = re.sub(r"^- \[.\]\s*", "", line)
                items.append({"text": text, "checked": checked})
    return items


def run_gh_command(
    args: List[str],
    capture_output: bool = True,
    retries: int = MAX_RETRIES
) -> Tuple[int, str, str]:
    """Run a GitHub CLI command with retry logic for transient failures.

    Only retries on transient errors (network issues, server errors).
    Does not retry on authentication, validation, or not-found errors.

    Args:
        args: Command arguments to pass to gh CLI
        capture_output: Whether to capture stdout/stderr
        retries: Number of retry attempts for transient failures

    Returns:
        Tuple of (return_code, stdout, stderr)
    """
    last_error = ""
    for attempt in range(retries):
        try:
            result = subprocess.run(
                ["gh"] + args,
                capture_output=capture_output,
                text=True,
                timeout=GH_COMMAND_TIMEOUT
            )
            # Success - return immediately
            if result.returncode == 0:
                return result.returncode, result.stdout, result.stderr

            # Check if error is retryable
            if not is_retryable_error(result.stderr):
                logger.debug(f"Non-retryable error: {result.stderr}")
                return result.returncode, result.stdout, result.stderr

            # Last attempt - return the error
            if attempt == retries - 1:
                return result.returncode, result.stdout, result.stderr

            # Retry on transient failure
            last_error = result.stderr
            delay = RETRY_BASE_DELAY ** attempt
            logger.warning(f"Attempt {attempt + 1} failed, retrying in {delay}s...")
            time.sleep(delay)
        except subprocess.TimeoutExpired:
            last_error = "Command timed out"
            if attempt == retries - 1:
                logger.error("GitHub CLI command timed out after all retries")
                return 1, "", last_error
            delay = RETRY_BASE_DELAY ** attempt
            logger.warning(f"Command timed out, retry {attempt + 1}/{retries} in {delay}s")
            time.sleep(delay)
        except FileNotFoundError:
            logger.error("GitHub CLI (gh) not found. Please install it.")
            return 1, "", "gh command not found"
    return 1, "", last_error


def get_repo_info() -> Tuple[str, str]:
    """Get the owner and repo name from git remote.

    Returns:
        Tuple of (owner, repo_name)

    Raises:
        ValueError: If repo info cannot be determined
    """
    try:
        result = subprocess.run(
            ["git", "remote", "get-url", "origin"],
            capture_output=True,
            text=True,
            timeout=GIT_COMMAND_TIMEOUT
        )
        url = result.stdout.strip()
        # Handle both HTTPS and SSH URLs
        match = re.search(r"github\.com[:/](.+?)/(.+?)(?:\.git)?$", url)
        if match:
            return match.group(1), match.group(2)
        raise ValueError(f"Could not parse GitHub repo from: {url}")
    except subprocess.TimeoutExpired:
        raise ValueError("Git command timed out")
    except FileNotFoundError:
        raise ValueError("Git not found")


def parse_user_story(file_path: Path) -> Optional[UserStory]:
    """Parse a user story markdown file."""
    try:
        content = file_path.read_text(encoding="utf-8")
    except (IOError, OSError, UnicodeDecodeError) as e:
        logger.error(f"Error reading {file_path}: {e}")
        return None

    # Extract story ID from filename (e.g., "US-001-provision-vps.md" -> "US-001")
    filename = file_path.stem
    match = re.match(r"(US-\d+)", filename)
    if not match:
        logger.warning(f"Filename does not match US-XXX pattern: {filename}")
        return None

    story_id = match.group(1)

    # Extract title from first heading
    title_match = re.search(r"^#\s+(.+?)(?:\s*\n|$)", content, re.MULTILINE)
    title = title_match.group(1) if title_match else filename

    # Extract status (handles multi-word like "In Progress")
    status = "Draft"
    status_match = re.search(r"\*\*Status:\*\*\s*(.+?)(?:\n|$)", content)
    if status_match:
        status = status_match.group(1).strip()

    # Extract priority
    priority = "should"
    priority_match = re.search(r"\*\*(\w+)\*\*\s*-\s*(?:Critical|Important|Nice)", content)
    if priority_match:
        priority = priority_match.group(1).lower()

    # Extract story points (anchored to prevent false matches)
    story_points = 0
    points_match = re.search(r"^\*\*Story Points:\*\*\s*(\d+)", content, re.MULTILINE)
    if points_match:
        story_points = int(points_match.group(1))

    # Extract user story section
    user_story = ""
    us_match = re.search(
        r"## User Story\s*\n\n(.*?)(?=\n##|\Z)",
        content,
        re.DOTALL
    )
    if us_match:
        user_story = us_match.group(1).strip()

    # Extract acceptance criteria and tasks using helper
    acceptance_criteria = parse_checkbox_section(content, "Acceptance Criteria")
    tasks = parse_checkbox_section(content, "Tasks")

    # Extract dependencies
    dependencies: List[int] = []
    deps_match = re.search(
        r"## Dependencies\s*\n\n(.*?)(?=\n##|\Z)",
        content,
        re.DOTALL
    )
    if deps_match:
        deps_content = deps_match.group(1)
        for dep_match in re.finditer(r"#(\d+)", deps_content):
            dependencies.append(int(dep_match.group(1)))

    # Extract notes
    notes = ""
    notes_match = re.search(
        r"## Notes\s*\n\n(.*?)(?=\n##|\Z)",
        content,
        re.DOTALL
    )
    if notes_match:
        notes = notes_match.group(1).strip()

    # Extract implementation details
    impl_details = ""
    impl_match = re.search(
        r"## Implementation Details\s*\n\n(.*?)(?=\n##|\Z)",
        content,
        re.DOTALL
    )
    if impl_match:
        impl_details = impl_match.group(1).strip()

    # Determine epic from parent folder using config dictionary
    epic = file_path.parent.name
    epic_label = ""
    for key, label in EPIC_LABELS.items():
        if key in epic:
            epic_label = label
            break

    return UserStory(
        id=story_id,
        title=title,
        status=status,
        priority=priority,
        story_points=story_points,
        epic=epic,
        epic_label=epic_label,
        user_story=user_story,
        acceptance_criteria=acceptance_criteria,
        tasks=tasks,
        dependencies=dependencies,
        notes=notes,
        implementation_details=impl_details,
        file_path=str(file_path)
    )


def validate_issue_structure(issue: dict) -> bool:
    """Validate that an issue has the expected structure.

    Args:
        issue: Issue dictionary from GitHub API

    Returns:
        True if the issue has all required fields
    """
    required_fields = ["number", "title", "labels"]
    return all(field in issue for field in required_fields)


def get_existing_issues(owner: str, repo: str) -> Dict[str, dict]:
    """Get all existing user story issues from GitHub.

    Args:
        owner: Repository owner
        repo: Repository name

    Returns:
        Dictionary mapping story IDs to issue data
    """
    returncode, stdout, stderr = run_gh_command([
        "issue", "list",
        "--repo", f"{owner}/{repo}",
        "--label", "user-story",
        "--state", "all",
        "--limit", str(MAX_ISSUES_FETCH),
        "--json", "number,title,labels,body,state"
    ])

    if returncode != 0:
        logger.error(f"Error fetching issues: {stderr}")
        return {}

    try:
        issues = json.loads(stdout)
    except json.JSONDecodeError as e:
        logger.error(f"Error parsing GitHub response: {e}")
        return {}

    # Validate response is a list
    if not isinstance(issues, list):
        logger.error("Unexpected GitHub response format: expected list")
        return {}

    # Map by story ID (e.g., "US-001")
    issue_map: Dict[str, dict] = {}
    for issue in issues:
        # Validate issue structure
        if not isinstance(issue, dict) or not validate_issue_structure(issue):
            logger.warning(f"Skipping malformed issue: {issue}")
            continue

        title = issue.get("title", "")
        match = re.match(r"(US-\d+)", title)
        if match:
            story_id = match.group(1)
            issue_map[story_id] = issue

    return issue_map


def build_issue_body(story: UserStory) -> str:
    """Build the GitHub issue body from a user story."""
    body_parts: List[str] = []

    # User story
    if story.user_story:
        body_parts.append("## User Story\n")
        body_parts.append(story.user_story)
        body_parts.append("")

    # Acceptance criteria
    if story.acceptance_criteria:
        body_parts.append("## Acceptance Criteria\n")
        for ac in story.acceptance_criteria:
            checkbox = "[x]" if ac["checked"] else "[ ]"
            body_parts.append(f"- {checkbox} {ac['text']}")
        body_parts.append("")

    # Tasks
    if story.tasks:
        body_parts.append("## Tasks\n")
        for task in story.tasks:
            checkbox = "[x]" if task["checked"] else "[ ]"
            body_parts.append(f"- {checkbox} {task['text']}")
        body_parts.append("")

    # Implementation details
    if story.implementation_details:
        body_parts.append("## Implementation Details\n")
        body_parts.append(story.implementation_details)
        body_parts.append("")

    # Dependencies
    if story.dependencies:
        body_parts.append("## Dependencies\n")
        for dep in story.dependencies:
            body_parts.append(f"- #{dep}")
        body_parts.append("")

    # Notes
    if story.notes:
        body_parts.append("## Notes\n")
        body_parts.append(story.notes)
        body_parts.append("")

    # Story points
    body_parts.append(f"**Story Points:** {story.story_points}")

    return "\n".join(body_parts)


def create_issue(
    owner: str,
    repo: str,
    story: UserStory,
    dry_run: bool = False
) -> Tuple[bool, Optional[int]]:
    """Create a new GitHub issue for a user story. Returns (success, issue_number)."""
    labels = [
        story.epic_label,
        f"priority-{story.priority}",
        "user-story"
    ]

    if story.status.lower() == "done":
        labels.append("done")

    # Filter empty labels
    labels = [label for label in labels if label]

    body = build_issue_body(story)

    # Sanitize title for safety
    safe_title = sanitize_text(story.title)

    if dry_run:
        logger.info(f"  [DRY-RUN] Would create issue: {safe_title}")
        logger.info(f"  [DRY-RUN] Labels: {', '.join(labels)}")
        return True, None

    returncode, stdout, stderr = run_gh_command([
        "issue", "create",
        "--repo", f"{owner}/{repo}",
        "--title", safe_title,
        "--body", body,
        "--label", ",".join(labels)
    ])

    if returncode != 0:
        logger.error(f"  Error creating issue: {stderr}")
        return False, None

    # Extract issue number from URL
    match = re.search(r"/issues/(\d+)", stdout)
    if match:
        issue_number = int(match.group(1))
        logger.info(f"  Created issue #{issue_number}")
        return True, issue_number

    return False, None


def update_issue(
    owner: str,
    repo: str,
    issue_number: int,
    story: UserStory,
    existing_labels: List[dict],
    dry_run: bool = False
) -> bool:
    """Update an existing GitHub issue. Returns success status."""
    body = build_issue_body(story)

    # Determine labels to add/remove
    desired_labels = {
        story.epic_label,
        f"priority-{story.priority}",
        "user-story"
    }

    if story.status.lower() == "done":
        desired_labels.add("done")

    # Remove empty labels
    desired_labels = {label for label in desired_labels if label}

    existing_label_names = {label["name"] for label in existing_labels}

    labels_to_add = desired_labels - existing_label_names
    labels_to_remove = (
        {"done"} & existing_label_names
        if story.status.lower() != "done"
        else set()
    )

    if dry_run:
        logger.info(f"  [DRY-RUN] Would update issue #{issue_number}")
        if labels_to_add:
            logger.info(f"  [DRY-RUN] Add labels: {labels_to_add}")
        if labels_to_remove:
            logger.info(f"  [DRY-RUN] Remove labels: {labels_to_remove}")
        return True

    # Build the update command with body and labels in a single API call
    cmd = [
        "issue", "edit", str(issue_number),
        "--repo", f"{owner}/{repo}",
        "--body", body
    ]

    # Add label operations to the same command
    if labels_to_add:
        cmd.extend(["--add-label", ",".join(labels_to_add)])
    if labels_to_remove:
        cmd.extend(["--remove-label", ",".join(labels_to_remove)])

    returncode, _, stderr = run_gh_command(cmd)

    if returncode != 0:
        logger.error(f"  Error updating issue #{issue_number}: {stderr}")
        return False

    logger.info(f"  Updated issue #{issue_number}")
    return True


def update_local_doc(
    story: UserStory,
    issue_data: dict,
    dry_run: bool = False
) -> bool:
    """Update local markdown file based on GitHub issue status. Returns True if changes made."""
    file_path = Path(story.file_path)

    if not file_path.exists():
        logger.warning(f"  File not found: {file_path}")
        return False

    try:
        content = file_path.read_text(encoding="utf-8")
    except (IOError, OSError, UnicodeDecodeError) as e:
        logger.error(f"  Error reading {file_path}: {e}")
        return False

    original_content = content

    # Check if issue has "done" label
    issue_labels = {label["name"] for label in issue_data.get("labels", [])}
    is_done = "done" in issue_labels

    # Update status in doc
    if is_done and "**Status:** Done" not in content:
        if "**Status:**" in content:
            content = re.sub(r"\*\*Status:\*\*\s*.+?(?=\n|$)", "**Status:** Done", content)
        else:
            # Add status after the title
            content = re.sub(
                r"(^#\s+.+?\n)",
                r"\1\n**Status:** Done\n",
                content,
                count=1,
                flags=re.MULTILINE
            )

    # Sync checkboxes from issue body if present
    issue_body = issue_data.get("body", "")

    # Extract checked items from issue (both [x] and [X])
    issue_checked = {
        match.group(1).strip()
        for match in CHECKBOX_CHECKED_PATTERN.finditer(issue_body)
    }

    # Extract unchecked items from issue
    issue_unchecked = {
        match.group(1).strip()
        for match in CHECKBOX_UNCHECKED_PATTERN.finditer(issue_body)
    }

    # Update checkboxes bidirectionally
    def update_checkbox(match: re.Match[str]) -> str:
        # match.group(1) is the checkbox state (x, X, or space) - unused
        text = match.group(2).strip()

        if text in issue_checked:
            return f"- [x] {text}"
        elif text in issue_unchecked:
            return f"- [ ] {text}"
        return match.group(0)  # Keep original if not found in issue

    content = CHECKBOX_PATTERN.sub(update_checkbox, content)

    if content != original_content:
        if dry_run:
            logger.info(f"  [DRY-RUN] Would update {file_path.name}")
            return True

        try:
            file_path.write_text(content, encoding="utf-8")
            logger.info(f"  Updated {file_path.name}")
            return True
        except (IOError, OSError) as e:
            logger.error(f"  Error writing {file_path}: {e}")
            return False

    return False


def sync_stories(
    docs_dir: Path,
    direction: str = "both",
    dry_run: bool = False
) -> bool:
    """Main sync function. Returns True if successful."""
    success = True

    try:
        owner, repo = get_repo_info()
    except ValueError as e:
        logger.error(f"Failed to get repo info: {e}")
        return False

    logger.info(f"Repository: {owner}/{repo}")
    logger.info(f"Direction: {direction}")
    logger.info(f"Dry run: {dry_run}")
    logger.info("")

    # Find all user story files
    story_files = list(docs_dir.glob("**/US-*.md"))
    logger.info(f"Found {len(story_files)} user story files")
    logger.info("")

    # Parse all stories
    stories: List[UserStory] = []
    for file_path in sorted(story_files):
        story = parse_user_story(file_path)
        if story:
            stories.append(story)

    logger.info(f"Parsed {len(stories)} valid user stories")
    logger.info("")

    if not stories:
        logger.warning("No valid user stories found to sync")
        return True  # Not an error, just nothing to do

    # Get existing issues
    existing_issues = get_existing_issues(owner, repo)
    logger.info(f"Found {len(existing_issues)} existing issues on GitHub")
    logger.info("")

    # Sync to GitHub
    if direction in ("both", "to-github"):
        logger.info("=== Syncing to GitHub ===")
        for story in stories:
            logger.info(f"\n{story.id}: {story.title}")

            if story.id in existing_issues:
                issue = existing_issues[story.id]
                if not update_issue(
                    owner, repo,
                    issue["number"],
                    story,
                    issue.get("labels", []),
                    dry_run
                ):
                    success = False
            else:
                ok, _ = create_issue(owner, repo, story, dry_run)
                if not ok:
                    success = False
        logger.info("")

    # Sync from GitHub
    if direction in ("both", "from-github"):
        logger.info("=== Syncing from GitHub ===")
        for story in stories:
            logger.info(f"\n{story.id}: {story.title}")

            if story.id in existing_issues:
                issue = existing_issues[story.id]
                update_local_doc(story, issue, dry_run)
            else:
                logger.info("  No matching issue found")
        logger.info("")

    logger.info("Sync complete!")
    return success


def validate_docs_dir(path: Path) -> Path:
    """Validate the docs directory path."""
    # Resolve to absolute path
    abs_path = path.resolve()

    # Ensure it's within the project directory (basic path traversal protection)
    script_dir = Path(__file__).parent.resolve()
    project_dir = script_dir.parent

    try:
        abs_path.relative_to(project_dir)
    except ValueError:
        raise ValueError(f"Docs directory must be within project: {project_dir}")

    if not abs_path.exists():
        raise ValueError(f"Docs directory not found: {abs_path}")

    if not abs_path.is_dir():
        raise ValueError(f"Path is not a directory: {abs_path}")

    return abs_path


def main() -> int:
    """Main entry point. Returns exit code."""
    parser = ArgumentParser(
        description="Sync user stories between local docs and GitHub Issues"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without making changes"
    )
    parser.add_argument(
        "--direction",
        choices=["both", "to-github", "from-github"],
        default="both",
        help="Sync direction (default: both)"
    )
    parser.add_argument(
        "--docs-dir",
        type=Path,
        default=Path(__file__).parent.parent / "docs" / "user-stories",
        help="Path to user stories directory"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable verbose logging"
    )

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    try:
        docs_dir = validate_docs_dir(args.docs_dir)
    except ValueError as e:
        logger.error(str(e))
        return 1

    success = sync_stories(docs_dir, args.direction, args.dry_run)
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
