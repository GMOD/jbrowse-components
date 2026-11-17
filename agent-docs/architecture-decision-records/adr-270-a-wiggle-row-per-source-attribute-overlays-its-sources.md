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
- **A field change keeps the arrangement.** Under every field the keyed
  members name subtracks, or values their subtracks carry, so the quantitative
  `rows` declares `valuesChange: false` on ADR-257's keyed writes: switching
  Multi-row, Rows by group and back keeps `sort`, `labels`, `colors`, `tree`
  and `kept`, through a model write, a settings bag, a share-link delta and
  the CLI. Other row displays still drop them.
- **Row order follows `rows.sort` by value or by member.** A grouped row
  ranks at its earliest `rows.sort` entry, its value or a member's name, then
  by arrival, so the dialog's source reorder and "Sort rows by score here"
  move rows through their sources, and an author's `sort: ["K562"]` orders
  rows directly. `rows.labels` relabels a row by value.
- **A grouped row is a shared box.** `sharesPanel` holds, so each source keeps
  its own color (dealt by name where it has none) and the key names the
  sources, one entry per role. The hit test reports every source in the row under the pointer,
  as an overlay does. A row's label bar shows only where `rows.color` names
  a field, whose key says what it means, and takes its sources' row color
  where they share one; a palette dealt by name colors the sources, not the
  row.
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
  under a grouping field; `rows` (`index`, `name`, `label`) names each drawn
  row and `rowsField` the field laying them out, so a host such as ggjbrowse
  counts and labels rows from `rows` rather than `sources`.
- The color key names each subtrack role once (`roleKeyScale`): a subtrack's
  label with its row's value taken off its start or end, the subtracks sharing
  a role and a color merged, so a 41-cell-line haplotype set keys Hap1 and
  Hap2. Where a role comes out empty or takes two colors, or an entry names no
  subtrack (a `rows.color` field), the key lists every subtrack as before. A
  merged entry stands for subtracks in several rows, so that key focuses
  nothing on a click.
- `rows.annotations` draws no columns under a grouping field, a shared box
  (`rowAnnotationDeals`), since a row's subtracks may carry several values.

## Rejected alternatives

- **The groups as the mixin's rows.** Rows would carry no single color or
  label of their own, and the palette, the dialog, the focus and the key all
  key on sources; every stage would need a second kind of row.
- **Clustering grouped rows on the mean of their sources.** It needs a second
  score matrix and a tree whose leaves are values, for a layout whose rows
  are usually few and named.
- **`facet: 'group'`, bands of source rows.** Bands stack rows; the Fiber-seq
  picture overlays them.
