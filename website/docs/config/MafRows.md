---
id: mafrows
title: MafRows
description: "The MAF display's rows: one per species (or genome) the alignment holds, and a copy row (mm10~2) where a block aligns one twice."
sidebar_label: Display setting -> MafRows
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `maf` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/maf/src/LinearMafDisplay/mafRowsConfigSchema.ts).

The MAF display's `rows`: one per species (or genome) the alignment
holds, and a copy row (`mm10~2`) where a block aligns one twice. The
object is the [RowArrangement](../rowarrangement) a reader gives the rows,
each member by row name, with the colors pinned on rows and an axis with no
`grid`, since the species rows keep a gap instead. A row is always a
species, so it takes no `field`, and writing it changes only the members
stated.

## Example usage

```js
{ type: 'LinearMafDisplay', rows: { sort: ['mm10'], axis: { tree: false } } }
```

```js
{
  type: 'LinearMafDisplay',
  rows: { sort: ['mm10'], labels: { mm10: 'Mouse' }, kept: ['mm10', 'hg38'] },
}
```

## Related links

- **Base config:** [RowArrangement](../rowarrangement)

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-axis">**axis**</span><br>[RowAxis](../rowaxis) | The guide down the left of the species rows, a [RowAxis](../rowaxis): the species tree and each species' name. |
| <span id="slot-colors">**colors**</span><br>[`stringMap`](/docs/config_guides/slot_types#stringmap) = <code>{}</code> | A color pinned on a row, by name, over whatever `rows.color` maps it to, as `labels` pins its text. The arrangement dialog's row swatches write it. A row with none takes `rows.color`, else the adapter's `samples[].color`, else the palette. A copy row takes its species'. |
| <span id="slot-color">**color**</span><br>[RowColor](../rowcolor) | The rows colored by an attribute: a [RowColor](../rowcolor) channel, `name` (each row) by default. Per-row colors are `rows.colors`, which win over it. |
| <span class="slot-group">Inherited from [RowArrangement](../rowarrangement)</span> | <span class="slot-group-count">4 slots</span> |
| <span id="slot-sort">**sort**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | The row order, as Vega-Lite's `sort` lists it: the rows listed lead, in this order, and none is dropped. The rest keep the order their source lists them in (a VCF's samples, a multi-BigWig's subtracks), or sort, digits by magnitude, where the rows are values found on features. A clustering run, the arrangement dialog and "Sort rows here" all write it, and a run rotates its dendrogram towards it rather than discarding it. |
| <span id="slot-labels">**labels**</span><br>[`stringMap`](/docs/config_guides/slot_types#stringmap) = <code>{}</code> | A label drawn beside a row in place of its name, by name. Whether any label draws is `rows.axis.labels`. |
| <span id="slot-tree">**tree**</span><br>[RowTree](../rowtree) | The dendrogram beside the rows, a [RowTree](../rowtree): newick, or `{ newick, provenance }` where a clustering run wrote it beside the order it produced. A reorder that moves a row drops it. Whether it draws is `rows.axis.tree`. |
| <span id="slot-kept">**kept**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | The rows shown, by name: a clade picked off the tree, or the rows one key row stands for. It narrows the rows to those it names, after `filter` where the display declares one; empty shows every row, and a list naming no current row shows none, with a notice. Keyed: a write changing `field` clears it. |
