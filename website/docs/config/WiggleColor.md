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
  defaultRendering: 'density',
  color: { field: 'score', scale: 'linear', scheme: 'viridis' },
}
```

_See the **Config slots** section below for all available configuration fields._

The quantitative display's `color`: one CSS colour for every bar, or one of
its two fields through a scale. `score` through a `threshold` scale is the
bicolor plot — a colour each side of one cut, the `origin` where the domain
names none, and a colour per band where it names more — and through `linear`
or `log` it is the density ramp.
`source` through a `categorical` scale gives each subtrack a colour of its
own, which is what several sources sharing one plot box need to be told
apart. Any other pairing paints the misconfiguration grey. A wiggle colours
per signal rather than per feature, so a `jexl:` callback over a feature has
nothing to read here.

## Config slots

These slots go on a display entry: `"displays": [{ "type": "WiggleColor", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-value">**value**</span><br>`maybeColor` | One CSS colour for every bar. Writing `color: "darkgreen"` lands here. Unset, the display paints the picture its layout asks for: a palette entry per source where several share one plot box, and the pos/neg pair about the `origin` otherwise. |
| <span id="slot-field">**field**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (score, source) | `score`, the value each bar carries, or `source`, the subtrack it came from. Unset, the colour paints `value`. |
| <span id="slot-scale">**scale**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (none, categorical, linear, log, threshold) | how field becomes a colour: threshold paints each band between two of its cuts; linear and log run range, else scheme, else viridis across the y domain with domainMid at the middle stop, which is the density picture, and a one-colour range runs from white to that colour; categorical hands each source a colour of its own; a scale over the other field paints grey; none paints value, keeping a field for a switch back; unset beside a field, it is categorical over source and threshold over score |
| <span id="slot-domain">**domain**</span><br>`stringArray` = <code>[]</code> | for a threshold scale, up to eight cut points, sorted, empty meaning one at the origin; for a categorical scale over source, the subtracks outside a group that take the range first, in order |
| <span id="slot-range">**range**</span><br>[`colorArray`](/docs/config_guides/slot_types#colorarray) = <code>[]</code> | a threshold scale's colour for each band, lowest first, one more than the cuts, a missing middle band grey; the colours a categorical scale over source hands to the subtrack groups first and then to each subtrack, continuing into the default palette; a linear or log scale's stops, evenly spaced, one colour meaning white to it |
| <span id="slot-scheme">**scheme**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (viridis) | a named ramp for a linear or log scale; range's colours, where it lists any, win over it |
| <span id="slot-reverse">**reverse**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | turns a linear or log scale's ramp round, so its last colour paints the bottom of the domain |
| <span id="slot-domainmid">**domainMid**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the value the ramp's middle stop sits at, so a diverging ramp centres somewhere other than the middle of the domain; unset, the stops are evenly spaced across it |
