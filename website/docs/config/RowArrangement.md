---
id: rowarrangement
title: RowArrangement
sidebar_label: Display -> RowArrangement
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/rowArrangementConfigSchema.ts).

## Example usage

```js
{
  type: 'LinearMultiSampleVariantDisplay',
  rows: { domain: ['NA12878', 'NA12891'], labels: { NA12878: 'Proband' } },
}
```

_See the **Config slots** section below for all available configuration fields._

The `rows` setting of a display whose rows are its own — a sample, a
species — rather than the values of a field: the arrangement a reader gives
them, which every product writes as a session edit to this object. The
order, the labels, the tree with its provenance and the focus, each by row
name. The field-keyed displays' `Rows` object is this plus `field`.

## Related links

- **Extended by:** [Rows](../rows)

## Config slots

These slots go on a display entry: `"displays": [{ "type": "RowArrangement", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-domain">**domain**</span><br>`stringArray` = <code>[]</code> | The row order: the rows listed lead, in this order, and the rest keep the order they arrived in. A clustering run, the arrangement dialog and "Sort rows here" all write it, and a run rotates its dendrogram towards it rather than discarding it. |
| <span id="slot-labels">**labels**</span><br>`stringMap` = <code>{}</code> | A label drawn beside a row in place of its name, by name. |
| <span id="slot-tree">**tree**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | The dendrogram beside the rows, as newick. A clustering run writes it beside the order it produced, and a reorder that moves a row drops it. |
| <span id="slot-treeprovenance">**treeProvenance**</span><br>[`maybeFrozen`](/docs/config_guides/slot_types#the-maybe-types) | What `tree` was computed from, the locus and the settings; unset for a tree that arrived as data. |
| <span id="slot-kept">**kept**</span><br>`stringArray` = <code>[]</code> | The rows shown, by name: a clade picked off the tree, or the rows one key row stands for. Empty, or naming no current row, shows every row. |
