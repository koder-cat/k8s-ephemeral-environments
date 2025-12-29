# US-007: Comment on PR with Preview URL

**Status:** Done

## User Story

**As a** developer,
**I want** the preview URL automatically posted as a comment on my PR,
**So that** I can easily find and share the link with reviewers.

## Acceptance Criteria

- [x] Bot comments on PR after successful deployment
- [x] Comment includes preview URL (clickable)
- [ ] Comment includes Grafana dashboard link (if available)
- [x] Comment updated on re-deploy (not duplicated)
- [x] Comment indicates deployment status (success/failure)

## Priority

**Should** - Important but not blocking

## Story Points

3

## Dependencies

- US-006: Create Unique Preview URL

## Notes

- Use GitHub Actions `github-script` or dedicated action
- Consider using a sticky comment that updates vs. new comments
- Include deployment timestamp in comment
