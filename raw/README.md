# Raw Workspace

`raw/` is the private working area for rough material that should not be treated as published documentation.

Use it for:

- inbox notes and pasted source material
- project context
- drafts
- working summaries
- feedback and observations
- source references that need review before publishing

Recommended local structure:

```text
raw/
  inbox/
  projects/
    documentation-site/
      inputs/
      process/
      outputs/
      feedback/
  sources/
  archive/
```

Actual notes under this workspace are ignored by Git by default. Keep only durable instructions and safe scaffolding tracked from local work.

The GitHub Actions raw-inbox workflow intentionally force-adds files under `raw/inbox` on short-lived capture branches. It opens one pull request per public capture, asks Codex to generate a Starlight summary, and lets the validation workflow decide whether the PR is safe to merge.

When material is ready to publish, ask Codex to use the `publish-note` skill to turn it into a reviewed Starlight page under `src/content/docs/`.
