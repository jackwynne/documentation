# iPhone Share Shortcut for Raw Captures

This setup lets you capture an article, URL, or selected text from the iPhone share sheet into GitHub issues labeled `raw-inbox`. Codex can then import those issues into `raw/inbox`.

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
GITHUB_TOKEN=your_token pnpm raw:import-github --ensure-labels
```

This creates:

- `raw-inbox`
- `raw-imported`

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

## Import Captures

Preview:

```bash
GITHUB_TOKEN=your_token pnpm raw:import-github --dry-run
```

Import:

```bash
GITHUB_TOKEN=your_token pnpm raw:import-github --mark-imported
```

Imported notes are written to `raw/inbox` and ignored by Git by default.

## Optional Codex Automation

After the Shortcut is working and a GitHub token is available to Codex automations, create a local workspace automation for this repository.

Suggested schedule:

- Hourly, or daily if you only want batch imports.

Suggested prompt:

```text
Use the import-github-inbox skill to import GitHub issues labeled raw-inbox into raw/inbox for this repository.

First check whether GITHUB_TOKEN or GH_TOKEN is available. If no token is available, report that setup is missing and do not make changes.

If a token is available, run:

pnpm raw:import-github --mark-imported

Report imported files, skipped issues, and any GitHub issue updates. Do not publish imported captures into src/content/docs unless explicitly requested.
```
