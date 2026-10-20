---
id: dotplotaxis
title: DotplotAxis
description: "The dotplot's axis: both genome axes, whose ticks grid carries across the plot and labels numbers."
sidebar_label: View -> DotplotAxis
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `dotplot-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/dotplot-view/src/DotplotView/axisConfigSchema.ts).

The dotplot's `axis`: both genome axes, whose ticks `grid` carries across
the plot and `labels` numbers.

## Example usage

```js
{ type: 'DotplotView', axis: { grid: false, labels: false } }
```

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-grid">**grid**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | carry each axis' ruler ticks across the plot |
| <span id="slot-labels">**labels**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | number the ticks along each axis; off keeps the ticks and sequence names |
