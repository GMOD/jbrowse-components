---
id: arccolor
title: ArcColor
sidebar_label: Display -> ArcColor
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `arc` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/arc/src/shared/arcColorConfigSchema.ts).

## Example usage

```js
{ type: 'LinearArcDisplay', color: "jexl:feature.strand==-1?'red':'blue'" }
```

```js
{ type: 'LinearArcDisplay', color: { field: 'strand' } }
```

```js
{
  type: 'LinearArcDisplay',
  color: {
    field: 'score',
    scale: 'threshold',
    domain: ['10', '100'],
    range: ['#c6dbef', '#6baed6', '#08519c'],
  },
}
```

_See the **Config slots** section below for all available configuration fields._

The arc display's `color`: a CSS colour or `jexl:` callback over `feature`
in `value`, or a field whose values each take a range colour, or whose
numbers each take the colour of the interval between cut points they fall
in, with a key. A string is the constant; the object binds the field.

## Config slots

These slots go on a display entry: `"displays": [{ "type": "ArcColor", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-value">**value**</span><br>[`color`](/docs/config_guides/slot_types#color) = <code>'#1976d2'</code> | A CSS colour, or a jexl callback over `feature` returning one. Writing `color: "red"` or `color: "jexl:…"` lands here.<br>_callback args:_ `feature` |
| <span id="slot-field">**field**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>''</code> | a feature field, or a jexl expression over feature, whose values each paint one range colour with a key; strand paints forward tomato and reverse cornflowerblue unless domain or range says otherwise |
| <span id="slot-scale">**scale**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) | none paints value and keeps the field for a switch back; categorical a range colour per value of field; threshold a range colour per interval between the cut points in domain; unset follows field |
| <span id="slot-domain">**domain**</span><br>`stringArray` = <code>[]</code> | the values that take the range first, in order; a value left out keeps a colour derived from itself that no listed value paints. Under threshold, the ascending cut points, a value on a cut taking the interval above it |
| <span id="slot-range">**range**</span><br>[`colorArray`](/docs/config_guides/slot_types#colorarray) = <code>[]</code> | CSS colours the domain takes, in order, continuing into the default palette past its end; under threshold one per interval, one more than the cuts |
