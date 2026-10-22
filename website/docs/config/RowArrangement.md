---
id: rowarrangement
title: RowArrangement
description: "The rows setting of a display whose rows are samples or species rather than the values of a field."
sidebar_label: Display -> RowArrangement
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/rowArrangementConfigSchema.ts).

The `rows` setting of a display whose rows are samples or species rather
than the values of a field. It holds the arrangement a reader gives the
rows, which every product writes as a session edit to this object: the
order, the labels, the tree with its provenance and the focus, each by row
name. The field-keyed displays' `Rows` object is this plus `field`.

## Example usage

```js
{
  type: 'LinearMultiSampleVariantDisplay',
  rows: { sort: ['NA12878', 'NA12891'], labels: { NA12878: 'Proband' } },
}
```

## Related links

- **Extended by:** [Rows](../rows)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-sort">**sort**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | The row order, as Vega-Lite's `sort` lists it: the rows listed lead, in this order, and none is dropped. The rest keep the order their source lists them in (a VCF's samples, a multi-BigWig's subtracks), or sort, digits by magnitude, where the rows are values found on features. A clustering run, the arrangement dialog and "Sort rows here" all write it, and a run rotates its dendrogram towards it rather than discarding it. |
| <span id="slot-labels">**labels**</span><br>[`stringMap`](/docs/config_guides/slot_types#stringmap) = <code>{}</code> | A label drawn beside a row in place of its name, by name. |
| <span id="slot-tree">**tree**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | The dendrogram beside the rows, as newick. A clustering run writes it beside the order it produced, and a reorder that moves a row drops it. |
| <span id="slot-treeprovenance">**treeProvenance**</span><br>[`maybeFrozen`](/docs/config_guides/slot_types#the-maybe-types) | The locus and settings `tree` was computed from; unset for a tree that arrived as data. |
| <span id="slot-kept">**kept**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | The rows shown, by name: a clade picked off the tree, or the rows one key row stands for. Empty shows every row, and so does naming no current row where the track lists its rows. |
