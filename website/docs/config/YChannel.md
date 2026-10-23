---
id: ychannel
title: YChannel
description: "A value axis written as Vega-Lite's encoding.y: its scale, the axis guide it draws, and rules, reference lines at chosen values across every band the scale rules."
sidebar_label: Display -> YChannel
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/yChannelConfigSchema.ts).

A value axis written as Vega-Lite's `encoding.y`: its `scale`, the `axis`
guide it draws, and `rules`, reference lines at chosen values across every
band the scale rules. A rule naming no `color` draws in the one color the
chrome rules every plot in.

## Example usage

A log depth axis floored at 1, with a labelled line at 30x:

```js
{
  type: 'LinearAlignmentsDisplay',
  coverage: {
    encoding: {
      y: {
        scale: { type: 'log', domainMin: 1 },
        rules: [{ value: 30, label: '30x' }],
      },
    },
  },
}
```

Three samples' coverage on one axis that still follows the data:

```js
{
  type: 'LinearAlignmentsDisplay',
  coverage: { encoding: { y: { scale: { group: 'depth' } } } },
}
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-scale">**scale**</span><br>[YScale](../yscale) | `type`, `domainMin`, `domainMax`, `zero`, `fenceQuantile`, `constant` and `group`. |
| <span id="slot-axis">**axis**</span><br>[YAxis](../yaxis) | `title` and `grid`. |
| <span id="slot-rules">**rules**</span><br><code>types.array(valueScaleRuleSchema())</code> | Horizontal reference lines, each `{ value, color, label }` or a bare number. An autoscaled end widens to keep every rule on the axis; a pinned end that excludes one drops it. |
