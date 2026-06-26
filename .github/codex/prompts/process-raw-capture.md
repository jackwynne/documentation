# Process Raw Capture

@codex Process this pull request as a raw capture for the Documentation Starlight site.

## Inputs

- Read the raw capture file under `raw/inbox/`.
- Read the linked source when a public source URL is available.
- Use `docs/capture-taxonomy.md` for topic classification.
- If the pull request mentions an existing capture folder, update that folder instead of creating a duplicate page.

## Output

Create or update exactly one capture folder:

```text
src/content/docs/captures/<capture-slug>/
```

Use `index.md` by default. Use `index.mdx` only when MDX is useful for the summary.

Images are allowed only when they are relevant to the summary and stored inside the same capture folder, preferably:

```text
src/content/docs/captures/<capture-slug>/images/<image-name>.<ext>
```

Fenced code blocks are allowed when they help summarize technical content.

## Required Frontmatter

The generated page must include:

```yaml
---
title: "Short useful title"
description: "One-sentence summary of the capture."
source_url: "https://example.com/source"
source_type: "article"
captured_at: "2026-06-26T00:00:00.000Z"
topics:
  - "codex"
tags:
  - "raw-capture"
raw_issue: "https://github.com/owner/repo/issues/123"
publish_status: "published-summary"
---
```

Use `source_type: "text"` when there is no usable public URL.

## Writing Rules

- Summarize in original words.
- Do not copy long article text or paste the source body into the page.
- Include why the capture is useful.
- Keep the page concise, practical, and easy to scan.
- Link to the source URL when it is public and relevant.
- Classify with one or more topics from `docs/capture-taxonomy.md`.
- Use direct quotations sparingly and only when short.

## Safety Rules

Do not publish a Starlight page when the capture appears private, sensitive, paywalled, credential-like, or personally identifying.

When the capture is unsafe to publish:

- Leave the raw file in `raw/inbox/`.
- Do not create or update `src/content/docs/captures/`.
- Comment on the pull request explaining that the capture needs manual review.
- Add or request the `raw-sensitive` label.
- Remove or request removal of the `raw-automerge` label.

## Verification

Run:

```bash
pnpm build
```

Keep changes scoped to:

- `raw/inbox/*.md`
- `src/content/docs/captures/<capture-slug>/**`
