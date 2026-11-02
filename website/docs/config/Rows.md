---
id: rows
title: Rows
description: "The rows setting of the displays that draw one row per value of a field, with the dendrogram sidebar beside them: the field, and the arrangement a reader gives the rows."
sidebar_label: Display setting -> Rows
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/rowsConfigSchema.ts).

The `rows` setting of the displays that draw one row per value of a field,
with the dendrogram sidebar beside them: the field, and the arrangement a
reader gives the rows. A string is the field; the object adds the order,
the labels, the colors, the tree with its provenance and the kept rows,
each by value of the field, and `color`, the rows colored by an attribute.

## Example usage

```js
{ type: 'LinearWiggleDisplay', rows: 'source' }
```

```js
{ type: 'LinearMultiRowFeatureDisplay', rows: 'sample' }
```

```js
{
  type: 'LinearWiggleDisplay',
  rows: { field: 'source', sort: ['tumor', 'normal'], labels: { tumor: 'Tumor' } },
}
```

## Related links

- **Extended by:** [QuantitativeRows](../quantitativerows)
- **Extended by:** [RowsWithStep](../rowswithstep)
- **Extended by:** [SampleRows](../samplerows)
- **Base config:** [RowArrangement](../rowarrangement)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-field">**field**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>''</code> | The field whose values each take a row. Writing `rows: "source"` sets this slot. Empty is the display's default: no rows on the quantitative display, and a field picked off the data on the multi-row feature display. |
| <span id="slot-axis">**axis**</span><br>[RowAxisWithGrid](../rowaxiswithgrid) | The guide down the left of the rows, a [RowAxisWithGrid](../rowaxiswithgrid): whether the tree and the row names draw, the sidebar's width, and a line between rows. What it draws is `rows.tree` and `rows.labels`. |
| <span id="slot-colors">**colors**</span><br>[`stringMap`](/docs/config_guides/slot_types#stringmap) = <code>{}</code> | A color pinned on a row, by name, over whatever `rows.color` maps it to, as `labels` pins its text: ggplot2's `scale_*_manual(values = c(name = ...))`. The arrangement dialog's row swatches write it. A row with none takes `rows.color`, else the file's own color (MAF's `samples[].color`, a listed source's color), else the palette where the rows share one panel. |
| <span id="slot-color">**color**</span><br>[RowColor](../rowcolor) | The rows colored by an attribute: a [RowColor](../rowcolor) channel from a row field through a scale, `name` (each row) by default. Per-row colors are `rows.colors`, which win over it. |
| <span class="slot-group">Inherited from [RowArrangement](../rowarrangement)</span> | <span class="slot-group-count">4 slots</span> |
| <span id="slot-sort">**sort**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | The row order, as Vega-Lite's `sort` lists it: the rows listed lead, in this order, and none is dropped. The rest keep the order their source lists them in (a VCF's samples, a multi-BigWig's subtracks), or sort, digits by magnitude, where the rows are values found on features. A clustering run, the arrangement dialog and "Sort rows here" all write it, and a run rotates its dendrogram towards it rather than discarding it. |
| <span id="slot-labels">**labels**</span><br>[`stringMap`](/docs/config_guides/slot_types#stringmap) = <code>{}</code> | A label drawn beside a row in place of its name, by name. Whether any label draws is `rows.axis.labels`. |
| <span id="slot-tree">**tree**</span><br>[RowTree](../rowtree) | The dendrogram beside the rows, a [RowTree](../rowtree): newick, or `{ newick, provenance }` where a clustering run wrote it beside the order it produced. A reorder that moves a row drops it. Whether it draws is `rows.axis.tree`. |
| <span id="slot-kept">**kept**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | The rows shown, by name: a clade picked off the tree, or the rows one key row stands for. It narrows the rows to those it names, after `filter` where the display declares one; empty shows every row, and a list naming no current row shows none, with a notice. Keyed: a write changing `field` clears it. |
