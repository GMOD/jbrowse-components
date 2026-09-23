---
id: rows
title: Rows
sidebar_label: Display -> Rows
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/rowsConfigSchema.ts).

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
  rows: { field: 'source', domain: ['tumor', 'normal'], labels: { tumor: 'Tumor' } },
}
```

_See the **Config slots** section below for all available configuration fields._

The `rows` setting of the displays that draw one row per value of a field,
with the dendrogram sidebar beside them: the field, and the arrangement a
reader gives the rows. A string is the field; the object adds the order,
the labels, the tree with its provenance and the focus, each by value.

## Related links

- **Base config:** [RowArrangement](../rowarrangement)

## Config slots

These slots go on a display entry: `"displays": [{ "type": "Rows", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-field">**field**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>''</code> | The field each value of which takes a row of its own. Writing `rows: "source"` lands here. Empty is the display's default: no rows on the quantitative display, and a field picked off the data on the multi-row feature display. |
| <span class="slot-group">Inherited from [RowArrangement](../rowarrangement)</span> | <span class="slot-group-count">5 slots</span> |
| <span id="slot-domain">**domain**</span><br>`stringArray` = <code>[]</code> | The row order: the rows listed lead, in this order, and the rest keep the order they arrived in. A clustering run, the arrangement dialog and "Sort rows here" all write it, and a run rotates its dendrogram towards it rather than discarding it. |
| <span id="slot-labels">**labels**</span><br>`stringMap` = <code>{}</code> | A label drawn beside a row in place of its name, by name. |
| <span id="slot-tree">**tree**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | The dendrogram beside the rows, as newick. A clustering run writes it beside the order it produced, and a reorder that moves a row drops it. |
| <span id="slot-treeprovenance">**treeProvenance**</span><br>[`maybeFrozen`](/docs/config_guides/slot_types#the-maybe-types) | What `tree` was computed from, the locus and the settings; unset for a tree that arrived as data. |
| <span id="slot-kept">**kept**</span><br>`stringArray` = <code>[]</code> | The rows shown, by name: a clade picked off the tree, or the rows one key row stands for. Empty, or naming no current row, shows every row. |
