---
name: maintain-knowledge-base
description: Review and maintain the raw workspace and published Starlight docs. Use for recurring cleanup, stale page checks, orphan notes, broken links, missing frontmatter, or knowledge-base maintenance.
---

# Maintain Knowledge Base

Use this skill to keep the documentation system coherent.

## Review Areas

- raw notes waiting in `raw/inbox/`
- project notes under `raw/projects/`
- published pages under `src/content/docs/`
- Starlight sidebar configuration in `astro.config.mjs`
- image references in `src/assets/` and `public/`

## Checks

1. Find raw notes that need filing, summarizing, archiving, or publishing.
2. Find published docs missing useful frontmatter, descriptions, or related links.
3. Check for obvious stale content, duplicate pages, and orphan topics.
4. Check internal Markdown links when practical.
5. Run `pnpm build` if published docs or site config changed.

## Rules

- Do not publish raw material automatically unless the user asked for publishing work.
- Do not delete raw notes unless the user explicitly asks.
- Prefer recommendations when cleanup could be destructive or subjective.
- Keep maintenance diffs small and reviewable.

## Output

Provide findings first, then any edits made, then verification results.
