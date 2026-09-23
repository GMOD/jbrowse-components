---
id: markcolor
title: MarkColor
sidebar_label: Display -> MarkColor
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `marks` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/marks/src/LinearMarkDisplay/markColorConfigSchema.ts).

## Example usage

```js
{ shape: 'bar', encoding: { y: 'score', color: 'steelblue' } }
```

```js
{
  shape: 'point',
  encoding: { y: 'score', color: { field: 'strand', domain: ['1', '-1'] } },
}
```

```js
{
  shape: 'span',
  encoding: {
    color: {
      field: 'score',
      scale: 'log',
      domainMin: 1,
      domainMax: 1000,
      range: ['white', 'red'],
    },
  },
}
```

```js
{
  shape: 'bar',
  encoding: {
    y: 'score',
    color: {
      field: 'score',
      scale: 'linear',
      domainMin: -2,
      domainMax: 6,
      domainMid: 0,
      range: ['blue', 'white', 'red'],
    },
  },
}
```

```js
{
  shape: 'point',
  encoding: {
    y: 'score',
    color: {
      field: 'pip',
      scale: 'threshold',
      domain: [0.1, 0.5],
      range: ['#357ebd', '#eea236', '#d43f3a'],
    },
  },
}
```

_See the **Config slots** section below for all available configuration fields._

A mark's `encoding.color`: one CSS colour or `jexl:` callback for every
instance, or a field through a categorical scale (a `range` colour per
value), a `linear` or `log` scale (a ramp between `domainMin` and
`domainMax`, `domainMid` placing its middle stop where a diverging ramp
turns) or a `threshold` scale (a `range` colour per interval between the
cut points `domain` lists). A string is the constant; the object binds the
field, and a scale is what the legend describes.

## Config slots

These slots go on a display entry: `"displays": [{ "type": "MarkColor", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-value">**value**</span><br>[`color`](/docs/config_guides/slot_types#color) = <code>'#0068d1'</code> | A CSS colour, or a jexl callback over `feature` returning one, for a mark whose colour is not a scale. Writing `color: 'red'` or `color: 'jexl:…'` directly on the encoding lands here.<br>_callback args:_ `feature` |
| <span id="slot-title">**title**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | The heading of the key this scale draws, naming what the colour measures. Three states: unset, the key is titled with `field`; some text is that text; `""` is a key with no title, and the only spelling of one. `null` reads as unset, as it does in every slot. Marks sharing a key share its title too, so two marks titling one scale differently draw a key each. |
| <span id="slot-field">**field**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>''</code> | the feature field a scale reads, or a jexl expression over feature, which is slower per feature and so the opt-in |
| <span id="slot-scale">**scale**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (none, categorical, linear, log, threshold) | how field becomes a colour: categorical hands out range colours per distinct value; linear and log read the value between domainMin and domainMax into a ramp; threshold cuts the value at the domain and hands each interval a range colour; none paints value, keeping a field for a switch back; unset beside a field, it is categorical |
| <span id="slot-domain">**domain**</span><br>`stringArray` = <code>[]</code> | for a categorical scale, the values in legend order, walking the range from the first entry and continuing into the default palette past its end (a value left out derives its colour from itself and never takes a listed value's, so every region agrees); for a threshold scale, the cut points in ascending order, a value taking the range entry for the number of them it is at or past, so range has one entry more than this; a linear or log scale reads domainMin and domainMax instead |
| <span id="slot-domainmin">**domainMin**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the bottom of a linear or log scale's domain; unset follows the loaded values |
| <span id="slot-domainmax">**domainMax**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the top of a linear or log scale's domain; unset follows the loaded values |
| <span id="slot-range">**range**</span><br>[`colorArray`](/docs/config_guides/slot_types#colorarray) = <code>[]</code> | CSS colours a categorical scale hands its domain in order, a threshold scale its intervals, or a linear or log scale's ramp as evenly spaced stops; empty is the default palette, or the scheme |
| <span id="slot-scheme">**scheme**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (viridis, juicebox, fall, reds, blues) | a named ramp for a linear or log scale; range's colours, where it lists any, win over it |
| <span id="slot-reverse">**reverse**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | turns a linear or log scale's ramp round, so its last colour paints the bottom of the domain |
| <span id="slot-domainmid">**domainMid**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the value the ramp's middle stop sits at, so a diverging ramp centres somewhere other than the middle of the domain; unset, the stops are evenly spaced across it |
