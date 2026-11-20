---
name: jb2export-modifier-tables
description: The jb2export track-modifier tables are the last big hand-maintained list in the docs. They stay per-track-type prose, guarded by a presence-only checker over the modifiers registry. Read before adding a modifier or a checker.
---

# The jb2export modifier tables

## Ruling

Keep the per-track-type prose and add a presence-only checker: every registry
key is named somewhere under `## Track modifiers`. A checker that maps `on` to
headings needs per-modifier allowances, and a checker with allowances is the
kind that gets ignored.

`products/jbrowse-img/README.md` documents the track modifiers in per-track-type
tables, and `website/scripts/generate-img-doc.ts` mirrors the whole README onto
the site — so the tables are hand-written once and published twice.

`modifiers` in `packages/launch-args/src/displaySettings.ts` is already a
registry: one entry per modifier, each carrying an `on: Category[]` list, which
is the same grouping the README's tables document per track type. That is the
coupling, and nothing enforces it.

**They were not drifted when this was written.** Every registry key appeared in
a table, and each table's grouping matched its `on` list. So this is a gate to
add before a gap opens, not a repair. Re-check before building it.

## The generator, not taken

The names and the track types are derivable; the **description and the example
are not**, so a generator means a `#modifier <example> | <description>` tag on
each entry, in the manner of `#shaderExport` (whose generator throws
on an untagged emit site, which is the property that makes the docs unable to
fall behind). The registry is `const modifiers`, not exported, so a generator
reads it syntactically or the module starts exporting it.

## Why the checker is presence-only

A presence-only checker — every registry key is named somewhere under
`## Track modifiers` — is ~30 lines and would pass today. The reverse direction
is the one that needs care: a modifier legitimately appears under **several**
headings, because what it means differs by track type. `color` is documented
three times (an alignments color scheme, a canvas glyph fill, a wiggle fill),
and that is better than one row under **All tracks**, not worse. So a checker
that maps `on` to headings needs per-modifier allowances, and a checker with
allowances is the kind that gets ignored.

One generated table with a Track types column, which is what the tag pass
would naturally produce, loses the per-category wording, which is why the
tables stay prose.
