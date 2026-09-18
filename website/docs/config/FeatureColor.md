---
id: featurecolor
title: FeatureColor
sidebar_label: Display -> FeatureColor
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/colorConfigSchema.ts).

## Example usage

```js
{ type: 'LinearBasicDisplay', color: 'goldenrod' }
```

```js
{
  type: 'LinearBasicDisplay',
  color: { field: 'gene_biotype', palette: ['#1f77b4', '#ff7f0e'] },
}
```

_See the **Config slots** section below for all available configuration fields._

The canvas feature displays' `color` setting: a CSS colour or `jexl:`
callback in `value`, or a field whose values each take a palette colour,
with a key. A string is the constant; the object binds the field, and
`scale: "none"` beside a field paints the constant while keeping the field
for the way back.

## Config slots

These slots go on a display entry: `"displays": [{ "type": "FeatureColor", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-value">**value**</span><br>`maybeColor` | A CSS colour, or a jexl callback over `feature` returning one. Writing `color: "red"` or `color: "jexl:…"` lands here. Unset, a feature's own BED itemRgb paints it if it has one, else goldenrod.<br>_callback args:_ `feature` |
| <span id="slot-field">**field**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | a feature field, or a jexl expression over feature, whose values each paint one palette colour with a key; a transcript and its parts paint the transcript's value, or its gene's where the transcript has none; strand paints forward tomato and reverse cornflowerblue unless domain or palette says otherwise |
| <span id="slot-scale">**scale**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (none, categorical) | none paints value and keeps the field for a switch back; categorical a palette colour per value of field; unset follows field |
| <span id="slot-domain">**domain**</span><br>`stringArray` = <code>[]</code> | the values that take the palette first, in order; a value left out keeps a colour derived from itself that no listed value paints, so every region agrees on it |
| <span id="slot-palette">**palette**</span><br>`stringArray` = <code>[]</code> | CSS colors the domain values take, in order, continuing into the default palette past its end |
