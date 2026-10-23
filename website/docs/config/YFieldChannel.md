---
id: yfieldchannel
title: YFieldChannel
description: "A YChannel that also names the field it plots, the wiggle display's encoding.y. A bare string is the field."
sidebar_label: Display -> YFieldChannel
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/wiggle-core/src/yFieldChannelConfigSchema.ts).

A [YChannel](../ychannel) that also names the field it plots, the wiggle
display's `encoding.y`. A bare string is the `field`.

## Example usage

The bins' maxima on a log axis:

```js
{
  type: 'LinearWiggleDisplay',
  encoding: { y: { field: 'maxScore', scale: { type: 'log' } } },
}
```

The whole visible range, spikes included, rather than the fence the wiggle
display starts on:

```js
{
  type: 'LinearWiggleDisplay',
  encoding: { y: { scale: { fenceQuantile: 1 } } },
}
```

## Related links

- **Base config:** [YChannel](../ychannel)

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-field">**field**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>'score'</code> | the feature field plotted on the value axis, as a mark's encoding.y names one. `score`, `minScore` and `maxScore` are a zoom bin's stored mean, minimum and maximum, which every quantitative source serves, a raw record answering its score for all three. Any other name, a dotted path or a `jexl:` expression reads a raw column the adapter left alone (a BED extra column, a GFF attribute) and draws no min-max extent. A feature with no finite value in the field plots at 0 |
| <span class="slot-group">Inherited from [YChannel](../ychannel)</span> | <span class="slot-group-count">6 slots</span> |
| <span id="slot-rulesvalue">**rules.value**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | The rule's position on the axis, in the units the axis plots: a `-log10(p)` over a Manhattan plot, a depth over coverage. |
| <span id="slot-rulescolor">**rules.color**</span><br>[`maybeColor`](/docs/config_guides/slot_types#the-maybe-types) | The line's color, and its label's. Unset draws every rule in the one color the chrome rules plots in, so a threshold that means something particular — genome-wide significance, a diploid depth — is one an author paints, on the plot where it means it. |
| <span id="slot-ruleslabel">**rules.label**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | Free text drawn at the rule's right-hand end. JBrowse assigns it no meaning: "2 copies" over a coverage plot is a claim only the author can make, since no ploidy can be assumed. |
| <span id="slot-scale">**scale**</span><br>[YScale](../yscale) | `type`, `domainMin`, `domainMax`, `zero`, `fenceQuantile`, `constant` and `group`. |
| <span id="slot-axis">**axis**</span><br>[YAxis](../yaxis) | `title` and `grid`. |
| <span id="slot-rules">**rules**</span><br>[list of ValueScaleRule entries](#slot-rulesvalue) | Horizontal reference lines, each `{ value, color, label }` or a bare number. An autoscaled end widens to keep every rule on the axis; a pinned end that excludes one drops it. |
