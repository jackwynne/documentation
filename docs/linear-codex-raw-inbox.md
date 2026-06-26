# Linear + Codex Raw Inbox

This optional legacy setup lets GitHub Actions mirror `raw-inbox` GitHub issues into Linear and mention `@Codex` in a Linear comment.

The preferred workflow is now the GitHub PR + `@codex` path documented in `docs/iphone-github-raw-shortcut.md`. Keep this Linear path only as a fallback or reference.

## How It Works

```text
iPhone Shortcut
  -> GitHub issue labeled raw-inbox
  -> GitHub Action
  -> Linear issue
  -> Linear comment mentioning @Codex
  -> Codex cloud task through the Linear integration
```

The current preferred GitHub Action does not send captures to Linear. It creates a capture branch and pull request, then comments `@codex` on that pull request.

## Required External Setup

1. Create or open a Linear workspace.
2. Create a Linear team for this workflow, for example `RAW`.
3. In ChatGPT/Codex settings, set up Codex cloud for this GitHub repository.
4. Install and connect Codex for Linear.
5. Confirm that mentioning `@Codex` in a Linear issue comment starts a Codex task.

## GitHub Secrets

Add these repository secrets in GitHub:

```text
LINEAR_API_KEY
LINEAR_TEAM_ID
```

`LINEAR_TEAM_ID` is preferred. If you do not want to find the UUID, use:

```text
LINEAR_TEAM_KEY
```

For example, if your Linear team key is `RAW`, set:

```text
LINEAR_TEAM_KEY=RAW
```

The workflow accepts either `LINEAR_TEAM_ID` or `LINEAR_TEAM_KEY`.

## Optional GitHub Variable

You can customize the Codex prompt by adding a repository variable:

```text
LINEAR_CODEX_PROMPT
```

Default prompt:

```text
@Codex Process this raw capture in jackwynne/Documentation. Summarize it, classify it, and suggest whether it should become a Starlight docs page. If you make repository changes, keep them scoped to raw/inbox or docs content. Source GitHub issue: [issue URL]
```

## Local Test

List current `raw-inbox` issues and send unsent ones to Linear:

```bash
LINEAR_API_KEY=... LINEAR_TEAM_KEY=RAW pnpm raw:send-linear
```

Then import captures locally with the legacy importer:

```bash
pnpm raw:import-github --mark-imported
```

## Duplicate Protection

The Linear sender adds a GitHub issue comment containing:

```text
<!-- linear-codex-task -->
```

If that marker already exists, the issue is not sent to Linear again.

It also adds the GitHub label:

```text
linear-sent
```

## Limits

- GitHub Actions uses the Linear API only to create the Linear issue/comment.
- Codex work happens only if the Linear `@Codex` integration is installed and the mention is recognized.
- If the Linear integration does not trigger from API-created comments, the fallback is to open the Linear issue and manually comment `@Codex`.
