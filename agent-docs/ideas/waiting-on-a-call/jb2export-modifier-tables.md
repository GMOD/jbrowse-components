---
name: jb2export-modifier-tables
description: The jb2export track-modifier tables are the last big hand-maintained surface list in the docs, and the registry behind them already knows the names and the track types. What it does not know is the description, so generating them is a 32-entry tagging pass first. Read before adding a modifier, or before writing a checker for these tables.
---

# The jb2export modifier tables

`products/jbrowse-img/README.md` documents 32 track modifiers across four
tables, and `website/scripts/generate-img-doc.ts` mirrors the whole README onto
the site — so the tables are hand-written once and published twice.

`modifiers` in `products/jbrowse-img/src/applyTrackOpts.ts` is already a
registry: one entry per modifier, each carrying an `on: Category[]` list, and
its own comment says the `on` lists "are the same grouping the README documents
per track type". That is the coupling, written down and enforced by nothing.

**They are not drifted today.** Every registry key appears in a table, and each
table's grouping matches its `on` list. So this is a gate to add before a gap
opens, not a repair — which is why it is parked rather than in TODO.md.

## What it would take

The names and the track types are derivable; the **description and the example
are not**, so a generator means a `#modifier <example> | <description>` tag on
each of the 32 entries, in the manner of `#shaderExport` (whose generator throws
on an untagged emit site, which is the property that makes the docs unable to
fall behind). The registry is `const modifiers`, not exported, so a generator
reads it syntactically or the module starts exporting it.

## Why the cheap version is not obviously right

A presence-only checker — every registry key is named somewhere under
`## Track modifiers` — is ~30 lines and would pass today. The reverse direction
is the one that needs care: a modifier legitimately appears under **several**
headings, because what it means differs by track type. `color` is documented
three times (an alignments color scheme, a canvas glyph fill, a wiggle fill),
and that is better than one row under **All tracks**, not worse. So a checker
that maps `on` to headings needs per-modifier allowances, and a checker with
allowances is the kind that gets ignored.

The decision to make first is whether the tables should stay per-track-type
prose — in which case the checker is presence-only and the `on` list is not the
thing being checked — or become one generated table with a Track types column,
which is what the tag pass would naturally produce and which loses the
per-category wording.
