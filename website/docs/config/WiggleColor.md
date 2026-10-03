---
id: wigglecolor
title: WiggleColor
sidebar_label: Display -> WiggleColor
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `wiggle` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/shared/wiggleColorConfigSchema.ts).

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
  mark: 'heatmap',
  color: { field: 'score', scale: 'linear', scheme: 'viridis' },
}
```

_See the **Config slots** section below for all available configuration fields._

The quantitative display's `color`: one CSS colour for every bar, or `score`
through a scale. Through a `threshold` scale it is the bicolor plot — a
colour each side of one cut, the `origin` where the domain names none, and a
colour per band where it names more — and through `linear` a gradient across
the y domain, through the y scale's own type, which colours each bar, point
and density cell by its score. A line still parts in the gradient's two end
colours. A subtrack's own colour is `rowColor`'s. A wiggle colours per
signal rather than per feature, so a `jexl:` callback over a feature has
nothing to read here.

## Config slots

These slots go on a display entry: `"displays": [{ "type": "WiggleColor", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-value">**value**</span><br>`maybeColor` | One CSS colour for every bar. Writing `color: "darkgreen"` lands here. Unset, the display paints the pos/neg pair about the `origin`, and several sources sharing one plot box each paint their row colour. |
| <span id="slot-field">**field**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (score) | `score`, the value each bar carries. Unset, the colour paints `value`. |
| <span id="slot-scale">**scale**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (none, linear, threshold) | how score becomes a colour: threshold paints each band between two of its cuts; linear runs range, else scheme, else viridis across the y domain through scales.y.type, with domainMid at the middle stop, colouring each bar, point and density cell by its score, and a one-colour range runs from white to that colour; a line still parts in the two end colours; none paints value, keeping the field for a switch back; unset beside the field, it is threshold |
| <span id="slot-domain">**domain**</span><br>`stringArray` = <code>[]</code> | for a threshold scale, up to eight cut points, sorted, empty meaning one at the origin |
| <span id="slot-range">**range**</span><br>[`colorArray`](/docs/config_guides/slot_types#colorarray) = <code>[]</code> | a threshold scale's colour for each band, lowest first, one more than the cuts, a missing middle band grey; a linear scale's stops, evenly spaced, one colour meaning white to it |
| <span id="slot-scheme">**scheme**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (viridis, magma, inferno, cividis, juicebox, fall, reds, blues, redblue, purpleorange) | a named ramp for a linear or log scale; range's colours, where it lists any, win over it |
| <span id="slot-reverse">**reverse**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | turns a linear or log scale's ramp round, so its last colour paints the bottom of the domain |
| <span id="slot-domainmid">**domainMid**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the value the ramp's middle stop sits at, so a diverging ramp centres somewhere other than the middle of the domain, both sides on one scale: the farther end of the domain reaches its end colour and equal distances from the middle take equal colours; unset, the stops are evenly spaced across it |
| <span id="slot-labels">**labels**</span><br>`stringArray` = <code>[]</code> | what the key names each domain value, one each in order, or under threshold each interval from the lowest; one past the list keeps its own name |
| <span id="slot-title">**title**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | key title; unset keeps the display's own heading, "" draws none |
