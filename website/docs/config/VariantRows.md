---
id: variantrows
title: VariantRows
description: "The variant display's rows: one per sample, or per haplotype in phased mode, with the RowsWithStep arrangement, axis and row height."
sidebar_label: Display setting -> VariantRows
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `variants` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/LinearVariantDisplay/variantRowsConfigSchema.ts).

The variant display's `rows`: one per sample, or per haplotype in phased
mode, with the [RowsWithStep](../rowswithstep) arrangement, axis and row
height.

## Example usage

```js
{ type: 'LinearVariantDisplay', rows: { sort: ['HG002'], step: 10 } }
```

## Related links

- **Base config:** [RowsWithStep](../rowswithstep)

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. One that changes `field` first clears `sort`, `labels`, `tree`, `treeProvenance`, `kept`, which name the old values, except those it states. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-field">**field**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (sample) = <code>'sample'</code> | `sample`, the one field a row of this display can be: a sample, or a haplotype of one in phased mode. |
| <span class="slot-group">Inherited from [RowsWithStep](../rowswithstep)</span> | <span class="slot-group-count">1 slot</span> |
| <span id="slot-step">**step**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>'fit'</code> | Row height in px: the px from one row's top to the next, the rows that do not fit scrolling; or `"fit"`, the default, dividing the track's `height` between the rows, as `heightMode: "fit"` does on a feature track. The track never grows to hold its rows. Vega-Lite's word for a band's size, as in `height: { step }`. |
| <span class="slot-group">Inherited from [Rows](../rows)</span> | <span class="slot-group-count">1 slot</span> |
| <span id="slot-axis">**axis**</span><br>[RowAxisWithGrid](../rowaxiswithgrid) | The guide down the left of the rows, a [RowAxisWithGrid](../rowaxiswithgrid): whether the tree and the row names draw, the sidebar's width, and a line between rows. What it draws is `rows.tree` and `rows.labels`. |
| <span class="slot-group">Inherited from [RowArrangement](../rowarrangement)</span> | <span class="slot-group-count">5 slots</span> |
| <span id="slot-sort">**sort**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | The row order, as Vega-Lite's `sort` lists it: the rows listed lead, in this order, and none is dropped. The rest keep the order their source lists them in (a VCF's samples, a multi-BigWig's subtracks), or sort, digits by magnitude, where the rows are values found on features. A clustering run, the arrangement dialog and "Sort rows here" all write it, and a run rotates its dendrogram towards it rather than discarding it. |
| <span id="slot-labels">**labels**</span><br>[`stringMap`](/docs/config_guides/slot_types#stringmap) = <code>{}</code> | A label drawn beside a row in place of its name, by name. Whether any label draws is `rows.axis.labels`. |
| <span id="slot-tree">**tree**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | The dendrogram beside the rows, as newick. A clustering run writes it beside the order it produced, and a reorder that moves a row drops it. Whether it draws is `rows.axis.tree`. |
| <span id="slot-treeprovenance">**treeProvenance**</span><br>[`maybeFrozen`](/docs/config_guides/slot_types#the-maybe-types) | The locus and settings `tree` was computed from; unset for a tree that arrived as data. A clustering run writes it with `tree`; a config copies the two together or leaves both out. |
| <span id="slot-kept">**kept**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | The rows shown, by name: a clade picked off the tree, or the rows one key row stands for. Empty shows every row, and so does naming no current row where the track lists its rows. |
