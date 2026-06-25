---
name: capture-note
description: Capture rough notes, pasted material, or source text into the raw workspace for later review. Use when the user wants to save, file, summarize, or ingest unpolished knowledge without publishing it.
---

# Capture Note

Use this skill to turn rough input into a safe working note under `raw/`.

## Steps

1. Identify the likely topic, source, and sensitivity of the material.
2. If the material contains secrets, credentials, private client data, personal records, or sensitive operational details, keep it in `raw/` and call out the risk.
3. Choose the narrowest suitable location:
   - `raw/inbox/` for uncategorized material.
   - `raw/projects/documentation-site/inputs/` for documentation-site work.
   - `raw/sources/` for source material that should be retained separately.
4. Create a Markdown note with:
   - a clear title
   - source or origin, when known
   - date captured
   - short summary
   - key points
   - candidate links or related docs
   - publishing recommendation
5. Do not edit `src/content/docs/` unless the user explicitly asks to publish.

## Output

Report the saved file path and the recommended next action.
