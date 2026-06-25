# Documentation Knowledge Base

## Purpose

This repository is a personal documentation site built with Astro Starlight. Codex should help maintain both the private working notes and the published documentation without mixing the two.

## Content Boundaries

- `raw/` is the private working area for rough notes, source material, drafts, project context, and unfinished thinking.
- `src/content/docs/` is the published Starlight documentation area.
- Do not move raw material into `src/content/docs/` unless the user explicitly asks to publish or polish it.
- Never publish secrets, tokens, private client data, credentials, personal records, or sensitive operational details.
- If a note may be sensitive, leave it in `raw/` and flag the concern.

## Published Docs Rules

- Prefer Markdown or MDX files under `src/content/docs/`.
- Every published page should include Starlight frontmatter with `title` and `description`.
- Use the existing topic directories before creating new top-level sections.
- Add links to related pages when they help navigation.
- Keep published docs concise, practical, and easy to scan.
- Store images in `src/assets/` or `public/` according to existing project conventions.

## Commands

- Use `pnpm build` to verify the site after changing published content or site configuration.
- Use `pnpm dev` when interactive visual checks are needed.
- Do not add production dependencies unless the user asks for them or the change clearly requires them.

## Review Expectations

- Before publishing from `raw/`, check for private or sensitive content.
- Keep generated edits reviewable and scoped.
- Prefer small, clearly named files over large catch-all documents.
