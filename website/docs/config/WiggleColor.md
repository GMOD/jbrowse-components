---
id: wigglecolor
title: WiggleColor
description: "The quantitative display's color: one CSS color for every bar, or score through a scale. Through a threshold scale it is the bicolor plot — a color each side of one cut, the origin where the…"
sidebar_label: Display -> WiggleColor
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `wiggle` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/shared/wiggleColorConfigSchema.ts).

## Example usage

```js
{ type: 'LinearWiggleDisplay', color: 'darkgreen' }
```

```js
{
  type: 'LinearWiggleDisplay',
  color: { field: 'score', scale: 'threshold', domain: [2], range: ['#2166ac', '#b2182b'] },
}
```

```js
{
  type: 'LinearWiggleDisplay',
  mark: 'span',
  color: { field: 'score', scale: 'linear', scheme: 'viridis' },
}
```

_See the **Config slots** section below for all available configuration fields._

The quantitative display's `color`: one CSS color for every bar, or `score`
through a scale. Through a `threshold` scale it is the bicolor plot — a
color each side of one cut, the `origin` where the domain names none, and a
color per band where it names more — and through `linear` a gradient across
the y domain, through the y scale's own type, which colors each bar, point
and density cell by its score. A line still parts in the gradient's two end
colors. A subtrack's own color is `rowColor`'s. A wiggle colors per
signal rather than per feature, so a `jexl:` callback over a feature has
nothing to read here.

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-value">**value**</span><br>[`maybeColor`](/docs/config_guides/slot_types#the-maybe-types) | One CSS color for every bar. Writing `color: "darkgreen"` lands here. Unset, the display paints the pos/neg pair about the `origin`, and several sources sharing one plot box each paint their row color. |
| <span id="slot-field">**field**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (score) | `score`, the value each bar carries. Unset, the color paints `value`. |
| <span id="slot-scale">**scale**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (none, linear, threshold) | How `score` becomes a color. `threshold` paints each band between two of its cuts, and on a density plot (`mark: 'span'`) fades from white at the lowest cut to the first `range` color below it and the last above it; `linear` runs `range`, else `scheme`, else viridis across the y domain through `scales.y.type`, with `domainMid` at the middle stop, coloring each bar, point and density cell by its score, and a one-color `range` runs from white to that color; a line still parts in the two end colors. `none` paints `value`, keeping the field for a switch back. Unset beside the field, it is `threshold`. |
| <span id="slot-domain">**domain**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | for a threshold scale, up to eight cut points, sorted, empty meaning one at the origin |
| <span id="slot-range">**range**</span><br>[`colorArray`](/docs/config_guides/slot_types#colorarray) = <code>[]</code> | a threshold scale's color for each band, lowest first, one more than the cuts, a missing middle band grey; a linear scale's stops, evenly spaced, one color meaning white to it |
| <span id="slot-scheme">**scheme**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (viridis, magma, inferno, cividis, juicebox, fall, reds, blues, redblue, purpleorange, redgreyblue) | a named ramp: a linear or log scale runs along it, and a threshold that writes cuts takes one color per interval from end to end; range's colors, where it lists any, win over it |
| <span id="slot-reverse">**reverse**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | turns the ramp round, so its last color paints the bottom of a linear or log domain or a threshold's lowest interval |
| <span id="slot-domainmid">**domainMid**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the value the ramp's middle stop sits at, so a diverging ramp centres somewhere other than the middle of the domain, both sides on one scale: the farther end of the domain reaches its end color and equal distances from the middle take equal colors; unset, the stops are evenly spaced across it |
| <span id="slot-labels">**labels**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | what the key names each domain value, one each in order, or under threshold each interval from the lowest; one past the list keeps its own name |
| <span id="slot-title">**title**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | key title; unset keeps the display's own heading, "" draws none |
