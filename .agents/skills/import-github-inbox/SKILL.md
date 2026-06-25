---
name: import-github-inbox
description: Import iPhone or web captures from GitHub issues labeled raw-inbox into raw/inbox. Use when the user asks to sync, import, process, or review GitHub issue captures for the raw workspace.
---

# Import GitHub Inbox

Use this skill to import GitHub issues labeled `raw-inbox` into local Markdown notes under `raw/inbox`.

## Requirements

- GitHub auth must be available through `GITHUB_TOKEN`, `GH_TOKEN`, or the active GitHub CLI login.
- The auth token should have Issues read/write access for this repository.
- The iPhone Shortcut should create issues labeled `raw-inbox`.

## Commands

Preview without writing:

```bash
pnpm raw:import-github --dry-run
```

Create labels if needed:

```bash
pnpm raw:import-github --ensure-labels --dry-run
pnpm raw:import-github --ensure-labels
```

Import captures:

```bash
pnpm raw:import-github
```

Import captures and mark imported issues:

```bash
pnpm raw:import-github --mark-imported
```

Import captures and close imported issues:

```bash
pnpm raw:import-github --close
```

## Workflow

1. Confirm whether the user wants a dry run, import only, relabel, or close.
2. Run the narrowest command that matches the request.
3. Review created Markdown files under `raw/inbox`.
4. Do not publish imported captures unless the user explicitly asks.

## Output

Report imported files, skipped issues, GitHub issue mutations, and any errors.
