---
status: Accepted
summary: "A quantitative display's `rows.field` names any source attribute: `source` is a row per subtrack, `''` one box, and another field such as `group` a row per value with its subtracks overlaid in their own colors. The tree-sidebar rows stay the subtracks and the wiggle groups them; clustering needs a row per subtrack"
---

# ADR-270: A wiggle row per source attribute overlays its sources

## Status

Accepted (2026-11-16). Amends
[ADR-157](adr-157-a-row-displays-arrangement-is-the-rows-config-object.md),
whose `rows.field` admitted `source` alone.

## Context

The hg38 Fiber-seq Compendium has 41 cell lines, each with a haplotype pair
and a set of four nested CpG-difference thresholds, which UCSC draws overlaid
per cell line. JBrowse could draw a row per subtrack or every subtrack in one
box. A row per cell line with its subtracks overlaid was missing. jb2hubs
writes the subadapters with `group: "<cell line>"`, which already reaches the
display as an attribute on each source row.

## Decision

- **`rows.field` is a string.** `source` is a row per subtrack, `''` one plot
  box, and any other value names a source attribute (a subadapter's `group`, a
  samples table column): one row per value, the sources sharing a value
  overlaid in that row. Reading one attribute costs what reading `group`
  alone would, so the field is not an enum of the three.
- **The tree-sidebar rows stay the sources.** `wiggleRows` groups the
  mixin's `drawnRows` into the rows drawn, and every reader that counts or
  names rows reads it (`numRows`, `effectiveRowHeight`, `labelledRows`, each
  `markSources` entry's `row`). The arrangement, palette, focus, dialog and
  color key keep working on sources unchanged.
- **Row order follows `rows.sort` by value or by member.** A grouped row
  ranks at its earliest `rows.sort` entry, its value or a member's name, then
  by arrival, so the dialog's source reorder and "Sort rows by score here"
  move rows through their sources, and an author's `sort: ["K562"]` orders
  rows directly. `rows.labels` relabels a row by value.
- **A grouped row is a shared box.** `sharesPanel` holds, so each source keeps
  its own color (dealt by name where it has none) and the key names the
  sources. The hit test reports every source in the row under the pointer,
  as an overlay does. A row's label bar takes its sources' row color only
  where they share one.
- **Clustering and the tree need a row per source.** A dendrogram's leaves are
  sources, and grouped rows have no leaf each, so `drawsTree` and the
  Clustering menu hold only under `source`.
- **The Plot type menu offers the grouping field as a layout**, `Rows by
  <field>`, beside `Multi-row` and `Overlapping`, so picking a plot under
  `Multi-row` is a visible change, never a silent loss of the grouping. Sources
  carrying a `group` offer `Rows by group` from the other two layouts.

## Consequences

- `jbrowse validate` and the JSON schema accept any string for the
  quantitative display's `rows.field`; a field no subtrack carries draws every
  subtrack in one row, and the display's notices name it.
- The tables export's `marks.row` is the row a mark is drawn in, a value's row
  under a grouping field.
- The color key lists every subtrack, so a 41-cell-line pair set keys 82
  entries, two colors repeated; the key's "Show N more" toggle shortens it.

## Rejected alternatives

- **The groups as the mixin's rows.** Rows would carry no single color or
  label of their own, and the palette, the dialog, the focus and the key all
  key on sources; every stage would need a second kind of row.
- **Clustering grouped rows on the mean of their sources.** It needs a second
  score matrix and a tree whose leaves are values, for a layout whose rows
  are usually few and named.
- **`facet: 'group'`, bands of source rows.** Bands stack rows; the Fiber-seq
  picture overlays them.
