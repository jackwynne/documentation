# Raw Inbox Codex Automerge Implementation Plan

Status date: 2026-06-26

## Goal

Build a laptop-off capture workflow where an iPhone share creates a GitHub issue,
Codex cloud summarizes and categorizes the capture using the ChatGPT/Codex
subscription, and safe generated Starlight summary pages merge automatically.

Target workflow:

```text
iPhone Share Sheet
  -> GitHub issue labeled raw-inbox
  -> GitHub Action creates a branch and pull request
  -> GitHub Action comments @codex on the pull request
  -> Codex cloud writes a Starlight summary page
  -> GitHub Action validates the Codex diff
  -> GitHub Action auto-merges safe PRs
  -> Starlight site search indexes the merged page
```

## Auto-Merge Decision

Auto-merge should be supported, but not immediately when the PR is opened.

The PR should auto-merge only after Codex has pushed the summary page and a
separate validation workflow confirms that:

- only approved content paths changed
- the published page is Markdown, not MDX
- the page has required Starlight frontmatter
- the page is a summary, not a copied article body
- the content does not look private, sensitive, or paywalled
- `pnpm build` passes

If any gate fails, the workflow should label the PR `raw-needs-review` and leave
it open.

Relevant platform behavior:

- Codex cloud can work on connected GitHub repositories in the background:
  <https://developers.openai.com/codex/cloud>
- Codex can be triggered from pull request comments with `@codex`:
  <https://developers.openai.com/codex/integrations/github>
- GitHub supports repository auto-merge when requirements are met:
  <https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-auto-merge-for-pull-requests-in-your-repository>
- `gh pr merge --auto` can enable automatic merge after requirements are met:
  <https://cli.github.com/manual/gh_pr_merge>

## Current Completion Status

| Status | Item | Evidence |
| --- | --- | --- |
| Done | iPhone Shortcut can create GitHub issues labeled `raw-inbox`. | `docs/iphone-github-raw-shortcut.md`, `shortcuts/Send to Raw.shortcut` |
| Done | Import script can convert `raw-inbox` issues to Markdown files. | `scripts/import-github-raw-inbox.mjs` |
| Done | Existing GitHub Action runs on issue events, schedule, and manual dispatch. | `.github/workflows/raw-inbox-import.yml` |
| Done | Existing Action can commit imported raw captures. | `.github/workflows/raw-inbox-import.yml` |
| Done | Optional Linear handoff exists. | `scripts/send-raw-inbox-to-linear.mjs`, `docs/linear-codex-raw-inbox.md` |
| Not done | Replace Linear handoff with GitHub PR + `@codex` handoff. | Planned here |
| Not done | Create one branch and PR per capture. | Planned here |
| Not done | Add a Codex prompt file/template for capture processing. | Planned here |
| Not done | Add capture taxonomy for stable categorization. | Planned here |
| Not done | Add generated `Captures` section to Starlight sidebar. | Planned here |
| Not done | Add content validation gate for Codex-generated pages. | Planned here |
| Not done | Add guarded auto-merge workflow. | Planned here |
| Not done | Add duplicate detection by canonical URL. | Planned here |
| Not done | Add sensitive-content fallback path. | Planned here |

## Recommended File Changes

### 1. Add Capture Taxonomy

Create `docs/capture-taxonomy.md` or `raw/capture-taxonomy.md`.

Recommended initial categories:

- `ai-coding`
- `documentation`
- `github`
- `codex`
- `cloud-compute`
- `vercel`
- `cloudflare`
- `azure`
- `fabric`
- `power-bi`
- `windows`
- `devops`
- `reference`
- `research`
- `personal-workflow`

Status: Not done.

### 2. Add a Codex Prompt Template

Create `.github/codex/prompts/process-raw-capture.md`.

Required prompt behavior:

- read the raw capture file and linked source when available
- create one concise Markdown summary under `src/content/docs/captures/`
- use only Markdown, not MDX
- include frontmatter with `title`, `description`, `source_url`,
  `source_type`, `captured_at`, `topics`, `tags`, `raw_issue`, and
  `publish_status`
- summarize the source in original words
- avoid copying long article text
- include why the capture is useful
- classify using the capture taxonomy
- if the capture appears sensitive, private, paywalled, credential-like, or
  personally identifying, do not publish a Starlight page
- run `pnpm build`

Status: Not done.

### 3. Replace the Existing Issue Import Workflow

Replace `.github/workflows/raw-inbox-import.yml` with a workflow that creates a
branch and PR instead of committing raw captures directly to `main`.

Recommended behavior:

1. Trigger on `issues` events for `opened`, `edited`, `labeled`, and `reopened`.
2. Continue only when the issue has `raw-inbox`.
3. Ensure labels exist:
   - `raw-inbox`
   - `raw-pr-created`
   - `raw-codex-pending`
   - `raw-needs-review`
   - `raw-processed`
   - `raw-sensitive`
4. Create branch `capture/issue-<number>-<slug>`.
5. Write the raw issue body to `raw/inbox/<date>-github-<number>-<slug>.md`.
6. Commit and push the branch.
7. Open a PR against `main`.
8. Label the PR `raw-capture`, `raw-codex-pending`, and `raw-automerge`.
9. Comment on the PR with the Codex prompt and `@codex`.
10. Add `raw-pr-created` to the issue and remove `raw-inbox`.

Status: Not done.

### 4. Add a PR Creation Script

Create `scripts/create-raw-capture-pr.mjs`.

Responsibilities:

- fetch open `raw-inbox` issues
- skip issues that already have `raw-pr-created`
- extract title, URL, shared content, and source type
- normalize a slug
- check duplicates by scanning existing capture frontmatter for `source_url`
- create the raw Markdown file
- create/push a branch
- create the PR through GitHub CLI or GitHub REST
- post the `@codex` comment
- mutate labels only after PR creation succeeds

Status: Not done.

### 5. Add Starlight Captures Section

Update `astro.config.mjs` sidebar with a generated captures section:

```js
{
  label: "Captures",
  items: [
    {
      autogenerate: {
        directory: "captures",
      },
    },
  ],
}
```

This makes merged summaries easy to browse as well as searchable.

Status: Not done.

### 6. Add Content Validation Script

Create `scripts/validate-capture-pr.mjs`.

Validation requirements:

- changed files are limited to:
  - `raw/inbox/*.md`
  - `src/content/docs/captures/*.md`
- no `.mdx` files in captures
- at least one `src/content/docs/captures/*.md` file exists
- every capture page has required frontmatter:
  - `title`
  - `description`
  - `source_url`
  - `source_type`
  - `captured_at`
  - `topics`
  - `tags`
  - `raw_issue`
  - `publish_status`
- `publish_status` must be `published-summary`
- block raw HTML tags likely to execute or embed active content:
  - `<script`
  - `<iframe`
  - `<object`
  - `<embed`
  - `onerror=`
  - `onclick=`
- block obvious secrets:
  - `BEGIN PRIVATE KEY`
  - `api_key`
  - `access_token`
  - `password:`
  - `Authorization: Bearer`
- block copied article dumps by enforcing a reasonable maximum page length
- fail if the page contains a large exact copy of the raw issue body

Status: Not done.

### 7. Add Guarded Auto-Merge Workflow

Create `.github/workflows/raw-capture-automerge.yml`.

Recommended triggers:

```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened, labeled, unlabeled]
```

Recommended jobs:

1. `validate`
   - permissions: `contents: read`, `pull-requests: read`
   - run `scripts/validate-capture-pr.mjs`
   - run `pnpm build`

2. `automerge`
   - needs: `validate`
   - runs only when validation passed
   - runs only when PR has `raw-capture` and `raw-automerge`
   - permissions: `contents: write`, `pull-requests: write`
   - merge with:

```bash
gh pr merge "$PR_NUMBER" --squash --delete-branch --match-head-commit "$HEAD_SHA"
```

Use `--auto` instead if branch protection requires checks and the merge should
wait for GitHub requirements:

```bash
gh pr merge "$PR_NUMBER" --squash --auto --delete-branch --match-head-commit "$HEAD_SHA"
```

Status: Not done.

### 8. Add Failure Routing

When validation fails:

- add `raw-needs-review`
- remove `raw-automerge`
- comment with the failed validation reason
- leave the PR open

When Codex decides not to publish because the capture is sensitive:

- add `raw-sensitive`
- remove `raw-automerge`
- leave the raw file in `raw/inbox`
- leave a PR comment explaining why no public page was created

Status: Not done.

### 9. Update iPhone Workflow Documentation

Update `docs/iphone-github-raw-shortcut.md` so it no longer says raw captures
are committed directly to `main`.

New documented behavior should say:

- the Shortcut creates a GitHub issue
- GitHub Actions creates a PR
- Codex processes the PR
- safe summary PRs auto-merge
- unsafe or ambiguous PRs stay open for review

Status: Not done.

### 10. Remove or De-emphasize Linear

Keep the Linear docs/script for reference, but mark the GitHub PR + `@codex`
path as the preferred workflow.

Status: Not done.

## Suggested Implementation Order

1. Add taxonomy and Codex prompt template.
2. Add `scripts/create-raw-capture-pr.mjs`.
3. Replace the current raw inbox import workflow with PR creation.
4. Add `scripts/validate-capture-pr.mjs`.
5. Add auto-merge workflow.
6. Add Captures sidebar entry.
7. Update docs.
8. Test with one harmless public article.
9. Enable auto-merge only after the first end-to-end test passes.

## Test Plan

### Local Tests

- Run the PR creation script in dry-run mode against a fixture issue payload.
- Run the validation script against:
  - a valid summary PR fixture
  - a PR that changes `.github/workflows`
  - a PR with an `.mdx` capture
  - a PR with copied raw article body
  - a PR with obvious secret-like text
- Run `pnpm build`.

### GitHub Tests

1. Share a known public documentation page from the iPhone.
2. Confirm a GitHub issue is created with `raw-inbox`.
3. Confirm a branch and PR are created.
4. Confirm the PR receives a `@codex` comment.
5. Confirm Codex writes a summary page under `src/content/docs/captures/`.
6. Confirm validation passes.
7. Confirm the PR auto-merges.
8. Confirm the deployed Starlight search can find the summary.

### Negative Tests

- Share text containing `Authorization: Bearer example`.
- Share private-looking notes without a public URL.
- Share a long article body.
- Share the same URL twice.

Expected result: these should not auto-merge.

## Open Questions

- Should capture summaries go only under `src/content/docs/captures/`, or should
  Codex place them into existing topic directories when obvious?
- Should duplicate captures update the existing page, or should they be skipped?
- Should the raw `raw/inbox` files remain in git history, or should the PR contain
  only the published summary page after Codex processes the capture?
- Should `raw-automerge` be default for all public URL captures, or only for
  allowlisted domains?

## Recommended Default Answers

- Start with `src/content/docs/captures/` only. Move mature notes later.
- Skip exact duplicate URLs.
- Keep raw files in PRs initially for traceability, but do not include full copied
  source bodies when the Shortcut only has a URL.
- Default to auto-merge for public URL captures, but fail closed on any sensitive
  signal.
