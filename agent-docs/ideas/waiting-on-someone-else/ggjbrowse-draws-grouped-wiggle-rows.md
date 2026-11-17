---
name: ggjbrowse-draws-grouped-wiggle-rows
description:
  ggjbrowse counts a wiggle's rows by its sources, so a track grouped by
  `rows.field` (ADR-270, hg38's Fiber-seq haplotype tracks) draws a row per
  source instead of a row per group. Read before touching `R/wiggle.R`'s row
  layout.
---

# ggjbrowse draws grouped wiggle rows

`rows: { field: 'group' }` (ADR-270) puts each value of a source attribute on
one row and overlays the sources that share it. The browser reads it from
v5.0.0-beta.22, and jb2hubs' hg38 config ships three Fiber-seq tracks that use
it. The wiggle tables export (`plugins/wiggle/src/tables.ts`) already says which
rows are drawn: `rows` (`index`, `name`, `label`) and `rowsField`.

`~/src/ggjbrowse/R/wiggle.R` still assumes a row per source. The change:

- Count rows with `nrow(x$rows)` instead of `nrow(x$sources)` in `in_rows`,
  `in_each_row`, `clip_strips` and the plot's `n`.
- Label rows from `x$rows$label`.
- Treat `marks$row` as an index into `x$rows`.
- Draw the tree only when `rowsField == "source"`.

Check it on one of hg38's grouped Fiber-seq tracks
(`hg38-fiberSeqCompendium-hap`), whose 41 rows each overlay two haplotypes.
