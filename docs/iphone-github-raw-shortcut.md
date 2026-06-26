# iPhone Share Shortcut for Raw Captures

This setup lets you capture an article, URL, or selected text from the iPhone share sheet into GitHub issues labeled `raw-inbox`. GitHub Actions then opens a pull request, asks Codex to summarize the capture, and auto-merges only PRs that pass the raw capture validation gates.

## Importable Apple Shortcut

An importable Shortcut artifact is available at:

```text
shortcuts/Send to Raw.shortcut
```

Supporting files:

- `shortcuts/Send to Raw.plist`: editable XML source
- `shortcuts/Send to Raw.unsigned.shortcut`: unsigned binary plist

After importing `Send to Raw.shortcut`, open the Shortcut and replace:

```text
Bearer PASTE_FINE_GRAINED_GITHUB_TOKEN_HERE
```

with:

```text
Bearer your_github_token
```

The generated Shortcut is configured for the share sheet and posts a GitHub issue to `jackwynne/Documentation` with the label `raw-inbox`.

## GitHub Token

Create a fine-grained GitHub token for `jackwynne/Documentation` with:

- Repository access: only this repository
- Permissions: Issues read/write

Store the token only inside the iOS Shortcut. Do not commit it to this repository.

## Repo Setup

From this repository on your Mac:

```bash
pnpm raw:create-pr --ensure-labels --dry-run
```

The GitHub Actions workflow creates these labels when it runs:

- `raw-inbox`
- `raw-pr-created`
- `raw-codex-pending`
- `raw-needs-review`
- `raw-processed`
- `raw-sensitive`
- `raw-capture`
- `raw-automerge`

## Working Shortcut

Create a new iOS Shortcut called `Send to Raw`.

Shortcut settings:

- Enable `Show in Share Sheet`
- Accept: Text, URLs, Safari web pages, and rich text
- If there is no input: Continue

Actions:

1. `Get Details of Safari Web Page`
   - Detail: `Name`
   - Input: `Shortcut Input`
   - Use this output as `Name`
2. `Current Date`
   - Use this output as `Current Date`
3. `Get URLs from Input`
   - Input: `Shortcut Input`
   - Use this output as `URLs`
4. `Text`
   - Use this body:

```text
Title: [Name]

Captured: [Current Date]

URL: [URLs]

Shared content:
[Shortcut Input]
```

5. `Get Contents of URL`
   - URL: `https://api.github.com/repos/jackwynne/Documentation/issues`
   - Method: `POST`
   - Headers:
     - `Accept`: `application/vnd.github+json`
     - `Authorization`: `Bearer YOUR_GITHUB_TOKEN`
     - `X-GitHub-Api-Version`: `2022-11-28`
   - Request Body: JSON
     - `title`: `Raw: [Name]`
     - `body`: the `Text` value from step 4
     - `labels`: array with one text item, `raw-inbox`

6. Optional: `Show Notification`
   - Message: `Created a GitHub raw-inbox issue.`

Important details:

- The request body key must be exactly `title`, not `tite`.
- The `Authorization` value must include `Bearer`, one space, then the full token.
- The `labels` value should be an array, not plain text.

The expected GitHub issue shape is:

```text
Title: Raw: [shared page or post name]

Body:
Title: [shared page or post name]

Captured: [date and time]

URL: [shared URL]

Shared content:
[original share-sheet input]
```

## Preview Capture PR Creation

Preview:

```bash
pnpm raw:create-pr --dry-run
```

Create pull requests for open `raw-inbox` issues:

```bash
pnpm raw:create-pr --ensure-labels
```

The script creates one branch and pull request per capture. Raw notes are written to `raw/inbox` on those capture branches and are ignored by Git locally by default.

## Always-On GitHub Automation

This repository includes a GitHub Actions workflow at `.github/workflows/raw-inbox-import.yml`.

It runs on GitHub when an issue is opened, edited, labeled, or reopened. It also runs hourly and can be started manually from the Actions tab. It works even when your laptop is off.

For open issues labeled `raw-inbox`, it:

- ensures the raw capture workflow labels exist
- creates a branch named `capture/issue-<number>-<slug>`
- writes the issue to `raw/inbox` on that branch
- opens a pull request against `main`
- labels the pull request `raw-capture`, `raw-codex-pending`, and `raw-automerge`
- comments on the pull request with the Codex raw-capture prompt and `@codex`
- adds `raw-pr-created` to the issue and removes `raw-inbox`

The Codex prompt asks Codex to create or update one generated summary folder under `src/content/docs/captures/<capture-slug>/`. Safe summary PRs are validated by `.github/workflows/raw-capture-automerge.yml`, built with `pnpm build`, and merged automatically. Unsafe or ambiguous PRs are labeled `raw-needs-review` and left open.

This workflow intentionally publishes imported captures and summaries in Git after validation. Use it only for material that is safe to make public. The older Linear/Codex setup is still documented as an optional reference path in `docs/linear-codex-raw-inbox.md`.

## Optional Codex App Automation

Codex app automations are local project automations. They require your Codex host machine to be awake, online, and able to access this project.

After the Shortcut is working and GitHub auth is available to Codex app automations, create a local workspace automation for this repository.

Suggested schedule:

- Hourly, or daily if you only want batch imports.

Suggested prompt:

```text
Create raw capture pull requests for GitHub issues labeled raw-inbox in this repository.

First check whether GitHub auth is available through GITHUB_TOKEN, GH_TOKEN, or the active GitHub CLI login. If no auth is available, report that setup is missing and do not make changes.

If a token is available, run:

pnpm raw:create-pr --ensure-labels

Report created PRs, skipped issues, and any GitHub issue updates. Do not publish imported captures into src/content/docs directly; let the PR workflow and validation gates handle generated summaries.
```
