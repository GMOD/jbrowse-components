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
chrome rules every plot in. The wiggle display's also names the `field` it
plots ([YFieldChannel](../yfieldchannel)).

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

A titled Manhattan axis with a labelled genome-wide threshold over a plain
suggestive one:

```js
{
  type: 'LinearManhattanDisplay',
  encoding: {
    y: {
      axis: { title: '-log10 p' },
      rules: [{ value: 7.3, color: 'red', label: 'p = 5e-8' }, 5],
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

## Related links

- **Extended by:** [YFieldChannel](../yfieldchannel)

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-rulesvalue">**rules.value**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | The rule's position on the axis, in the units the axis plots: a `-log10(p)` over a Manhattan plot, a depth over coverage. |
| <span id="slot-rulescolor">**rules.color**</span><br>[`maybeColor`](/docs/config_guides/slot_types#the-maybe-types) | The line's color, and its label's. Unset draws every rule in the one color the chrome rules plots in, so a threshold that means something particular — genome-wide significance, a diploid depth — is one an author paints, on the plot where it means it. |
| <span id="slot-ruleslabel">**rules.label**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | Free text drawn at the rule's right-hand end. JBrowse assigns it no meaning: "2 copies" over a coverage plot is a claim only the author can make, since no ploidy can be assumed. |
| <span id="slot-scale">**scale**</span><br>[YScale](../yscale) | `type`, `domainMin`, `domainMax`, `zero`, `fenceQuantile`, `constant` and `group`. |
| <span id="slot-axis">**axis**</span><br>[YAxis](../yaxis) | `title` and `grid`. |
| <span id="slot-rules">**rules**</span><br>[list of ValueScaleRule entries](#slot-rulesvalue) | Horizontal reference lines, each `{ value, color, label }` or a bare number. An autoscaled end widens to keep every rule on the axis; a pinned end that excludes one drops it. |
