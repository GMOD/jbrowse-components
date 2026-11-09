---
id: rowarrangement
title: RowArrangement
description: "The rows setting of a display whose rows are not the values of a field: the MAF display's species rows."
sidebar_label: Display setting -> RowArrangement
---

Auto-generated from the config schema in the source. See the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/rowArrangementConfigSchema.ts).

The `rows` setting of a display whose rows are not the values of a field:
the MAF display's species rows. It holds the arrangement a reader gives the
rows, which every product writes as a session edit to this object: the
order, the labels, the pinned colors, the tree and the focus, each by row
name; beside them `color`, the rows colored by an attribute, and `axis`,
the guide that draws the tree and the names. Writing it changes only the
members stated. [Rows](../rows) is this plus the `field` whose values each
take a row.

## Example usage

```js
{
  type: 'LinearMafDisplay',
  rows: { sort: ['mm10', 'hg38'], labels: { mm10: 'Mouse' }, axis: { tree: false } },
}
```

## Related links

- **Extended by:** [Rows](../rows)

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-sort">**sort**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) of strings or numbers = <code>[]</code> | The row order, as Vega-Lite's `sort` lists it: the rows listed lead, in this order, and none is dropped. The rest keep the order their source lists them in (a VCF's samples, a multi-BigWig's subtracks), or sort, digits by magnitude, where the rows are values found on features. A clustering run, the arrangement dialog and "Sort rows here" all write it, and a run rotates its dendrogram towards it rather than discarding it. |
| <span id="slot-labels">**labels**</span><br>[`stringMap`](/docs/config_guides/slot_types#stringmap) = <code>{}</code> | A label drawn beside a row in place of its name, by name. Whether any label draws is `rows.axis.labels`. |
| <span id="slot-tree">**tree**</span><br>[RowTree](../rowtree) | The dendrogram beside the rows, a [RowTree](../rowtree): newick, or `{ newick, provenance }` where a clustering run wrote it beside the order it produced. A reorder that moves a row drops it. Whether it draws is `rows.axis.tree`. The rows follow the tree's leaves, then `rows.sort` for any rows the tree lacks; a supplied tree rotates towards `rows.sort`, so a `sort` also decides which way each clade faces. |
| <span id="slot-colors">**colors**</span><br>[`stringMap`](/docs/config_guides/slot_types#stringmap) = <code>{}</code> | A color pinned on a row, by name, over whatever `rows.color` maps it to, as `labels` pins its text: ggplot2's `scale_*_manual(values = c(name = ...))`. The arrangement dialog's row swatches write it. A row with none takes `rows.color`, else the file's own color (MAF's `samples[].color`, a listed source's color), else the palette where the rows share one panel. |
| <span id="slot-color">**color**</span><br>[RowColor](../rowcolor) | The rows colored by an attribute: a [RowColor](../rowcolor) channel from a row field through a scale, `name` (each row) by default. Per-row colors are `rows.colors`, which win over it. |
| <span id="slot-annotations">**annotations**</span><br>[RowColor](../rowcolor) | Extra color columns beside the row labels, one per row attribute, as ggtree's `gheatmap` and ComplexHeatmap's row annotation draw them: a list of [RowColor](../rowcolor) channels, each a field or `{ field, scale: { domain, range, unknown } }`, drawn in the order listed after the row's own color. Categorical only: each value of the field takes a color the way `rows.color` deals one, a row with no value leaves a gap, a field no row carries draws nothing, and each column gets a key. It reorders no row, so under one tree several attributes read against the same clusters. Like `color` it names no row: "Reset row order" and a write changing `field` keep it. |
| <span id="slot-axis">**axis**</span><br>[RowAxis](../rowaxis) | The guide down the left of the rows, a [RowAxis](../rowaxis): whether the tree and the row names draw, and the sidebar's width. What it draws is `rows.tree` and `rows.labels`. |
| <span id="slot-kept">**kept**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) of strings or numbers = <code>[]</code> | The rows shown, by name: a clade picked off the tree, or the rows one key row stands for. It narrows the rows to those it names, after `filter` where the display declares one; empty shows every row, and a list naming no current row shows none, with a notice. Keyed: a write changing `field` clears it. |
