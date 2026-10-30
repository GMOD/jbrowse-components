---
id: rowaxis
title: RowAxis
description: "The axis beside rows: the guide down the left of a row display, which draws the clustering tree and the row names. rows holds what the axis draws (rows.tree, rows.labels), and axis whether and how it…"
sidebar_label: Display setting -> RowAxis
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/tree-sidebar/src/rowAxisConfigSchema.ts).

The `axis` beside `rows`: the guide down the left of a row display, which
draws the clustering tree and the row names. `rows` holds what the axis
draws (`rows.tree`, `rows.labels`), and `axis` whether and how it draws
them. A display's value axis, where it has one, is `encoding.y.axis`. The
wiggle, multi-sample variant and mark displays add `grid`
([RowAxisWithGrid](../rowaxiswithgrid)).

## Example usage

```js
{ type: 'LinearMafDisplay', axis: { tree: false, width: 120 } }
```

## Related links

- **Extended by:** [RowAxisWithGrid](../rowaxiswithgrid)

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-tree">**tree**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | draw the clustering tree in the sidebar |
| <span id="slot-branchlength">**branchLength**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | position tree nodes by branch length (dendrogram) rather than evenly by topology (cladogram) |
| <span id="slot-labels">**labels**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | The names draw over the plot, in a strip as wide as the widest name up to 120px, so on a wide view the left of every row sits under them. |
| <span id="slot-width">**width**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>80</code> | A drag on the sidebar's edge writes this, as a drag on the track's bottom edge writes `height`. |
