# Documentation Site Raw Workspace

## Role

This folder holds private working material for the Astro Starlight documentation site.

## Workflow

- Put unprocessed notes in `inputs/`.
- Use `process/` for outlines, summaries, and transformed drafts.
- Use `outputs/` for publish-ready drafts before they are moved to `src/content/docs/`.
- Use `feedback/` for review notes, stale-doc observations, and follow-up ideas.

## Publishing Gate

Before moving anything from this folder into `src/content/docs/`, check that:

- the content is safe to publish
- the target section is clear
- the page has `title` and `description` frontmatter
- related docs are linked where useful
- `pnpm build` passes after the publish edit
