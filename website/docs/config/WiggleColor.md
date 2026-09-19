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
  color: { field: 'score', scale: 'threshold', domain: [2], palette: ['#2166ac', '#b2182b'] },
}
```

```js
{
  type: 'LinearWiggleDisplay',
  defaultRendering: 'density',
  color: { field: 'score', scale: 'linear', ramp: ['viridis'] },
}
```

_See the **Config slots** section below for all available configuration fields._

The quantitative display's `color`: one CSS colour for every bar, or a
field through a scale. `score` through a `threshold` scale is the bicolor
plot — one cut point, one colour each side, the `origin` where the domain
names none — and through `linear` or `log` it is the density ramp.
`source` through a `categorical` scale gives each subtrack a palette entry,
which is what several sources sharing one plot box need to be told apart.
A wiggle colours per signal rather than per feature, so a `jexl:` callback
over a feature has nothing to read here.

## Config slots

These slots go on a display entry: `"displays": [{ "type": "WiggleColor", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-value">**value**</span><br>`maybeColor` | One CSS colour for every bar. Writing `color: "darkgreen"` lands here. Unset, the display paints the picture its layout asks for: a palette entry per source where several share one plot box, and the pos/neg pair about the `origin` otherwise. |
| <span id="slot-field">**field**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | score, the value each bar carries, or source, the subtrack it came from |
| <span id="slot-scale">**scale**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (none, categorical, linear, log, threshold) | how field becomes a colour: threshold cuts score at the domain and paints each side; linear and log fade from the colour at the cut out to the ends of the y domain, which is the density picture; categorical hands each source a palette entry; none paints value, keeping a field for a switch back; unset beside a field, it is linear with a ramp, categorical over source and threshold over score |
| <span id="slot-domain">**domain**</span><br>`stringArray` = <code>[]</code> | for a threshold scale, the one cut point the two sides part at, empty meaning the origin; for a categorical scale over source, the sources that take the palette first, in order |
| <span id="slot-palette">**palette**</span><br>`stringArray` = <code>[]</code> | CSS colors the domain takes, in order, continuing into the default palette past its end |
| <span id="slot-ramp">**ramp**</span><br>`stringArray` = <code>[]</code> | viridis, or two or more CSS colour stops; empty is viridis |
| <span id="slot-domainmid">**domainMid**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the value the ramp's middle stop sits at, so a diverging ramp centres somewhere other than the middle of the domain; unset, the stops are evenly spaced across it |
