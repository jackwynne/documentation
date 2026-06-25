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

Actual notes under this workspace are ignored by Git by default. Keep only durable instructions and safe scaffolding tracked.

When material is ready to publish, ask Codex to use the `publish-note` skill to turn it into a reviewed Starlight page under `src/content/docs/`.
