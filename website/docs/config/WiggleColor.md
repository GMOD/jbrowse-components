---
id: wigglecolor
title: WiggleColor
description: "The quantitative display's encoding.color: one CSS color for every mark, or the plotted score through a scale."
sidebar_label: Display -> WiggleColor
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `wiggle` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/shared/wiggleColorConfigSchema.ts).

The quantitative display's `encoding.color`: one CSS color for every mark,
or the plotted score through a scale. The channel names no field, since a
quantitative display colors only the value it plots: `score` stands for
it, whatever field `y` names.

- `threshold` paints a solid color each side of one cut, the `origin`
  where `scale.domain` names none, and a color per band where it names
  more, on every mark
- `linear` paints a gradient across the y domain, through the y scale's
  own type: each bar, point and density cell by its score, and a line by
  the score along it
- unset `scale.type`, a two-color `scale.range` (red and blue unset) is the
  pair about the `origin`: bars, points and lines solid either side of it,
  and a heatmap (`mark: 'rect'`) fading to each from white at it, a ramp
  whose middle stop `scale.domainMid` moves

A subtrack's own color is `rowColor`'s. A wiggle colors per signal rather
than per feature, so a `jexl:` callback over a feature has nothing to read
here.

## Example usage

```js
{ type: 'LinearWiggleDisplay', encoding: { color: { value: 'darkgreen' } } }
```

```js
{
  type: 'LinearWiggleDisplay',
  encoding: {
    color: {
      scale: { type: 'threshold', domain: [2], range: ['#2166ac', '#b2182b'] },
    },
  },
}
```

```js
{
  type: 'LinearWiggleDisplay',
  mark: 'rect',
  encoding: { color: { scale: { type: 'linear', scheme: 'viridis' } } },
}
```

A copy-number heatmap, white at two copies, blue losses and red gains:

```js
{
  type: 'LinearWiggleDisplay',
  mark: 'rect',
  origin: 2,
  encoding: { color: { scale: { range: ['#2166ac', '#b2182b'] } } },
}
```

## Config slots

A setting written to it replaces it whole, since its members are alternatives: a member left out returns to its default. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-value">**value**</span><br>[`maybeColor`](/docs/config_guides/slot_types#the-maybe-types) | One CSS color for every mark, a density cell included, so a heatmap under one is a flat strip. Unset, the display paints the pair about the `origin`, and several sources sharing one plot box each paint their row color. |
| <span id="slot-scale">**scale**</span><br>[WiggleColorScale sub-schema](#slot-scaletype) | The scale from the score to a color. `threshold` paints each band between two of its cuts, solid, on every mark; `linear` runs `range`, else `scheme`, else viridis across the y domain through `encoding.y.scale.type`, with `domainMid` at the middle stop, coloring each bar, point and density cell by its score; a one-color `range` paints flat, so one color is `value`. With `type` unset, `range` is the pair about the `origin`: a threshold on bars, points and lines, and on a heatmap a ramp through white at the origin. |
| <span id="slot-legend">**legend**</span><br>[WiggleColorLegend sub-schema](#slot-legendtitle) | The key this channel draws. |
| <span id="slot-scaletype">**scale.type**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (linear, threshold) | threshold bands score at the domain cuts, solid on every mark, linear ramps it across the y domain; unset, range is the pair about the origin, solid on bars, points and lines and fading from white there on a heatmap |
| <span id="slot-scaledomain">**scale.domain**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | for a threshold scale, up to eight cut points, sorted, empty meaning one at the origin |
| <span id="slot-scalerange">**scale.range**</span><br>[`colorArray`](/docs/config_guides/slot_types#colorarray) = <code>[]</code> | a threshold scale's color for each band, lowest first, one more than the cuts, a missing middle band grey; a linear scale's stops, evenly spaced, one color painting flat |
| <span id="slot-scalescheme">**scale.scheme**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (viridis, magma, inferno, cividis, juicebox, fall, reds, blues, redblue, purpleorange, redgreyblue, redyellowblue) | a named ramp: a linear, log or symlog scale runs along it, and a threshold that writes cuts takes one color per interval from end to end, and an ordinal scale that lists a domain one per value; range's colors, where it lists any, win over it |
| <span id="slot-scalereverse">**scale.reverse**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) | turns the ramp round, so its last color paints the bottom of a ramp's domain or a threshold's lowest interval; unset follows the field's preset, else runs as written |
| <span id="slot-scaledomainmid">**scale.domainMid**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the value the ramp's middle stop sits at, so a diverging ramp centres somewhere other than the middle of the domain, both sides on one scale: the farther end of the domain reaches its end color and equal distances from the middle take equal colors; unset, the stops are evenly spaced across it |
| <span id="slot-scalenames">**scale.names**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | key name for each domain value, one each in order, or under threshold for each interval from the lowest; a value past the end of the list shows its own |
| <span id="slot-legendtitle">**legend.title**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | key title; unset keeps the display's own heading, "" draws none |
