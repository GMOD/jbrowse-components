---
id: ribboncolor
title: RibbonColor
sidebar_label: Display -> RibbonColor
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `linear-comparative-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/ribbonColorConfigSchema.ts).

## Example usage

```js
{ type: 'MultiWaySyntenyDisplay', ribbonColor: 'rgba(130,130,130,0.3)' }
```

```js
{ type: 'MultiWaySyntenyDisplay', ribbonColor: { field: 'strand' } }
```

```js
{
  type: 'MultiWaySyntenyDisplay',
  ribbonColor: { field: 'group', domain: ['core', 'shell'] },
}
```

_See the **Config slots** section below for all available configuration fields._

The multi-way synteny display's `ribbonColor` setting: one colour for every
ribbon, or a field each ribbon carries: the record's strand, a measurement
on its preset ramp (`identity`, `mapq`, `dnds`), or a column the
table declares in `attributeColumns`. A string is the constant.

## Config slots

These slots go on a display entry: `"displays": [{ "type": "RibbonColor", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-value">**value**</span><br>[`color`](/docs/config_guides/slot_types#color) = <code>'rgba(130,130,130,0.3)'</code> | The colour of every ribbon under the `none` scale, and of a pair carrying no value under a field. |
| <span id="slot-field">**field**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | what colours a ribbon: strand reads the relative strand between the two lanes the ribbon joins (the two placements' orientations multiplied out, not the drawn twist, so a flipped lane still shows its inversions); identity, mapq and dnds paint the synteny view's ramps; any other name is a column the table declares in attributeColumns, a ramp over the values seen for numbers and one colour per label for text (or the colour a color column put beside it) |
| <span id="slot-scale">**scale**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (none) | none paints value and keeps the field for a switch back; unset, a field paints |
| <span id="slot-domain">**domain**</span><br>`stringArray` = <code>[]</code> | a text column's labels that take the palette first, in order, and lead the key, the rest following sorted; a label left out keeps a colour derived from itself that no listed label paints, so every window and session agrees on it |
| <span id="slot-range">**range**</span><br>[`colorArray`](/docs/config_guides/slot_types#colorarray) = <code>[]</code> | CSS colours a text column's labels take, in domain order, continuing into the default palette past its end; with no domain, each label takes one of them by its name; on a ramp (identity, mapq, dnds or a numeric column), its stops, evenly spaced, in place of the field's own |
| <span id="slot-scheme">**scheme**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (viridis, magma, inferno, cividis, juicebox, fall, reds, blues, redblue, purpleorange) | a named ramp for a linear or log scale; range's colours, where it lists any, win over it |
| <span id="slot-reverse">**reverse**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | turns a linear or log scale's ramp round, so its last colour paints the bottom of the domain |
| <span id="slot-domainmid">**domainMid**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the value the ramp's middle stop sits at, so a diverging ramp centres somewhere other than the middle of the domain, both sides on one scale: the farther end of the domain reaches its end colour and equal distances from the middle take equal colours; unset, the stops are evenly spaced across it |
| <span id="slot-domainmin">**domainMin**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the bottom of a linear or log scale's domain; unset follows the loaded values |
| <span id="slot-domainmax">**domainMax**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) | the top of a linear or log scale's domain; unset follows the loaded values |
| <span id="slot-labels">**labels**</span><br>`stringArray` = <code>[]</code> | what the key names each domain value, one each in order, or under threshold each interval from the lowest; one past the list keeps its own name |
| <span id="slot-title">**title**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | key title; unset keeps the display's own heading, "" draws none |
