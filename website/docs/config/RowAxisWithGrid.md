---
id: rowaxiswithgrid
title: RowAxisWithGrid
description: "A RowAxis with grid, Vega-Lite's word for the lines an axis carries across the plot: here a hairline between adjacent rows."
sidebar_label: Display setting -> RowAxisWithGrid
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/tree-sidebar/src/rowAxisWithGridConfigSchema.ts).

A [RowAxis](../rowaxis) with `grid`, Vega-Lite's word for the lines an axis
carries across the plot: here a hairline between adjacent rows.

## Example usage

```js
{ type: 'LinearWiggleDisplay', axis: { grid: true, labels: false } }
```

## Related links

- **Base config:** [RowAxis](../rowaxis)

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-grid">**grid**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Off by default: rows that differ in color already show a boundary. Drawn only once rows are at least 4px tall, below which the line is as thick as the row. |
| <span class="slot-group">Inherited from [RowAxis](../rowaxis)</span> | <span class="slot-group-count">4 slots</span> |
| <span id="slot-tree">**tree**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | draw the clustering tree in the sidebar |
| <span id="slot-branchlength">**branchLength**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | position tree nodes by branch length (dendrogram) rather than evenly by topology (cladogram) |
| <span id="slot-labels">**labels**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | The names draw over the plot, in a strip as wide as the widest name up to 120px, so on a wide view the left of every row sits under them. |
| <span id="slot-width">**width**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>80</code> | A drag on the sidebar's edge writes this, as a drag on the track's bottom edge writes `height`. |
