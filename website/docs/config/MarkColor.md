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
    color: { field: 'score', scale: 'log', domain: [1, 1000], ramp: ['white', 'red'] },
  },
}
```

_See the **Config slots** section below for all available configuration fields._

A mark's `encoding.color`: one CSS colour or `jexl:` callback for every
instance, or a field through a categorical scale (a palette colour per
value) or a `linear` or `log` scale (a ramp over `domain`). A string is the
constant; the object binds the field, and a scale is what the legend
describes.

## Config slots

These slots go on a display entry: `"displays": [{ "type": "MarkColor", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-value">**value**</span><br>[`color`](/docs/config_guides/slot_types#color) = <code>'#0068d1'</code> | A CSS colour, or a jexl callback over `feature` returning one, for a mark whose colour is not a scale. Writing `color: 'red'` or `color: 'jexl:…'` directly on the encoding lands here.<br>_callback args:_ `feature` |
| <span id="slot-field">**field**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | the feature field a scale reads, or a jexl callback over feature, which is slower per feature and so the opt-in |
| <span id="slot-scale">**scale**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (none, categorical, linear, log) | how field becomes a colour: categorical hands out palette entries per distinct value; linear and log read the value through domain into ramp; none paints value, keeping a field for a switch back; unset beside a field, it is linear with a ramp and categorical without |
| <span id="slot-domain">**domain**</span><br>`stringArray` = <code>[]</code> | for a categorical scale, the values in legend order, walking the palette from the first entry and continuing into the default palette past its end (a value left out derives its colour from itself and never takes a listed value's, so every region agrees); for a linear or log scale, the [min, max] the ramp spans, empty using each region's own extremes |
| <span id="slot-palette">**palette**</span><br>`stringArray` = <code>[]</code> | CSS colors the domain values take, in order, continuing into the default palette past its end |
| <span id="slot-ramp">**ramp**</span><br>`stringArray` = <code>[]</code> | viridis, or two or more CSS colour stops; empty is viridis |
