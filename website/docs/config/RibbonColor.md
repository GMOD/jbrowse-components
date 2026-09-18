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
{ type: 'MultiWaySyntenyDisplay', ribbonColor: { scale: 'strand' } }
```

```js
{
  type: 'MultiWaySyntenyDisplay',
  ribbonColor: { field: 'group', domain: ['core', 'shell'] },
}
```

_See the **Config slots** section below for all available configuration fields._

The multi-way synteny display's `ribbonColor` setting: one colour for every
ribbon, a scheme the synteny view also paints, or a column the table
declares in `attributeColumns`. A string is the constant.

## Config slots

These slots go on a display entry: `"displays": [{ "type": "RibbonColor", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-value">**value**</span><br>[`color`](/docs/config_guides/slot_types#color) = <code>'rgba(130,130,130,0.3)'</code> | The colour of every ribbon under the `none` scale, and of a pair carrying no value under the others. Writing `ribbonColor: "grey"` lands here. Every scale keeps its opacity. |
| <span id="slot-field">**field**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | A column the table declares in `attributeColumns`: a ramp over the values seen for numbers, one colour per label for text (or the colour a `color` column put beside it). |
| <span id="slot-scale">**scale**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (none, categorical, strand, identity, mappingQuality, dnds) = <code>'none'</code> | What colours a ribbon. `none` paints `value`; `categorical` reads `field`, and is what a `field` with no scale reads through; `strand` reads the record's strand — the two placements' orientations against the anchor multiplied out — and not the drawn twist, so a lane drawn flipped still shows its inversions; `identity`, `mappingQuality` and `dnds` paint the synteny view's ramps. |
| <span id="slot-domain">**domain**</span><br>`stringArray` = <code>[]</code> | The order a text column's labels take: the labels listed here first, the rest sorted. A label's colour is its position, so this moves the key and the ribbons together. Left empty the labels stay in the order the fetches first met them. |
