---
id: lanerows
title: LaneRows
description: "The multi-way synteny display's rows: one lane per assembly below the anchor, so assembly is the one field, and the object is the arrangement a reader gives the lanes, written whole as every…"
sidebar_label: Display setting -> LaneRows
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `linear-comparative-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/laneRowsConfigSchema.ts).

The multi-way synteny display's `rows`: one lane per assembly below the
anchor, so `assembly` is the one field, and the object is the arrangement a
reader gives the lanes, written whole as every display's `rows` is. `sort`
lists the lanes that stack first, in order, the rest following densest-first
so a ribbon chain through adjacent lanes is cut as late as possible; `kept`
names the lanes drawn, empty drawing the track's lanes or every lane.
Haplotype lanes read off a graph follow by structure instead, below any
lanes `sort` pins, so lanes whose deletions and insertions against the
anchor match sit together, in an order worked out once per window.

## Example usage

```js
{
  type: 'MultiWaySyntenyDisplay',
  rows: { sort: ['GCF_000346465.2', 'poplar'], kept: ['GCF_000346465.2', 'poplar', 'citrus'] },
}
```

## Related links

- **Base config:** [Rows](../rows)

## Config slots

A setting written to it replaces it whole: a member left out returns to its default. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-field">**field**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (assembly) = <code>'assembly'</code> | `assembly`, the one field a lane can be. |
| <span class="slot-group">Inherited from [RowArrangement](../rowarrangement)</span> | <span class="slot-group-count">5 slots</span> |
| <span id="slot-sort">**sort**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | The row order, as Vega-Lite's `sort` lists it: the rows listed lead, in this order, and none is dropped. The rest keep the order their source lists them in (a VCF's samples, a multi-BigWig's subtracks), or sort, digits by magnitude, where the rows are values found on features. A clustering run, the arrangement dialog and "Sort rows here" all write it, and a run rotates its dendrogram towards it rather than discarding it. |
| <span id="slot-labels">**labels**</span><br>[`stringMap`](/docs/config_guides/slot_types#stringmap) = <code>{}</code> | A label drawn beside a row in place of its name, by name. |
| <span id="slot-tree">**tree**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | The dendrogram beside the rows, as newick. A clustering run writes it beside the order it produced, and a reorder that moves a row drops it. |
| <span id="slot-treeprovenance">**treeProvenance**</span><br>[`maybeFrozen`](/docs/config_guides/slot_types#the-maybe-types) | The locus and settings `tree` was computed from; unset for a tree that arrived as data. A clustering run writes it with `tree`; a config copies the two together or leaves both out. |
| <span id="slot-kept">**kept**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | The rows shown, by name: a clade picked off the tree, or the rows one key row stands for. Empty shows every row, and so does naming no current row where the track lists its rows. |
