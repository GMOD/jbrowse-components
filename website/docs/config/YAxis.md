---
id: yaxis
title: YAxis
description: "A YChannel's axis, the guide it draws: whether it draws at all, its title and grid."
sidebar_label: Display setting -> YAxis
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/yAxisConfigSchema.ts).

A [YChannel](../ychannel)'s `axis`, the guide it draws: whether it draws
at all, its `title` and `grid`.

## Example usage

```js
{
  type: 'LinearAlignmentsDisplay',
  coverage: { encoding: { y: { axis: { title: 'depth', grid: true } } } },
}
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-show">**show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Draw the axis, Vega-Lite's `axis: null` when off: its ticks and labels, the `[min, max]` caption a short band takes instead, its title and its grid. The scale's `rules` still draw. |
| <span id="slot-title">**title**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | The caption beside the axis, drawn once however many bands the scale rules. Unset, `""` or `null` draws none. |
| <span id="slot-grid">**grid**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Rule the plot across at every tick, Vega-Lite's `axis.grid`. The axis panel's "Grid lines" toggles it. |
