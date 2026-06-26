---
name: publish-note
description: Convert a reviewed raw note or draft into a published Astro Starlight documentation page. Use when the user asks to publish, polish, convert, or promote content from raw into the docs site.
---

# Publish Note

Use this skill to move suitable material from `raw/` into `src/content/docs/`.

## Safety Gate

Before publishing, inspect the source material for:

- secrets, API keys, tokens, or credentials
- private client or personal data
- sensitive internal details
- material that should remain a draft

If any concern is present, stop and explain what needs review.

## Steps

1. Read the source note and nearby context.
2. Choose the target directory under `src/content/docs/`, preferring existing sections.
3. Create or update a Markdown/MDX page with Starlight frontmatter:
   - `title`
   - `description`
   - `lang: en` when consistent with nearby docs
4. Rewrite rough notes into practical documentation.
5. Add links to related existing docs where useful.
6. Add or reference images only when they improve the published page.
7. Run `pnpm build` after changing published content.

## Output

Report the published file path, any source material left in `raw/`, and the build result.
