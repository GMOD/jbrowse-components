---
id: rowcolor
title: RowColor
description: "rows.color, the row displays' rows colored by an attribute: one ordinal color channel on the row axis. field names the row attribute whose values take the colors, a samplesTsv column or a subtrack's…"
sidebar_label: Display setting -> RowColor
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/rowColorConfigSchema.ts).

`rows.color`, the row displays' rows colored by an attribute: one ordinal
color channel on the row axis. `field` names the row attribute whose values
take the colors, a samplesTsv column or a subtrack's group, and
`scale.domain` and `scale.range` pair its values with CSS colors, the rest
each taking a palette color. Under `name`, the default, each row is its
own value: the palette (`scale.range`, then the row palette) deals one
color per row, and only where the rows share one panel, a wiggle overlay,
since stacked rows are identified by their labels; `scale.unknown` is the
color every row takes instead, `''` for none. A color pinned on one row is
`rows.colors`, which wins over this, so under `name` this takes no
`scale.domain`. A string is the field.

Each display paints a row's color on the element that identifies a row: the
quantitative display's plot, or the tint beside its label while a score
gradient paints; the multi-row feature display's blocks; the variant
display's label tint; the MAF display's label tint, over the adapter's
`samples[].color`; the mark display's label tint, over a listed source's
color. Not `encoding.color`, which on wiggle and the mark display paints by
value.

## Example usage

```js
{ type: 'LinearVariantDisplay', rows: { color: 'population' } }
```

```js
{
  type: 'LinearVariantDisplay',
  rows: {
    color: {
      field: 'population',
      scale: { domain: ['EUR', 'AFR'], range: ['#1f77b4', '#ff7f0e'] },
    },
  },
}
```

```js
{
  type: 'LinearMultiRowFeatureDisplay',
  rows: { color: { scale: { unknown: '' } }, colors: { mom: '#b2182b' } },
}
```

## Config slots

A setting written to it replaces it whole: a member left out returns to its default. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-field">**field**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'name'</code> | The row attribute whose values take the colors, or `name`, each row its own value. Under `name` with no `scale.unknown`, stacked rows keep only a file's own colors and the colors `rows.colors` pins, since the palette deals only where the rows share one panel. |
| <span id="slot-scale">**scale**</span><br>[RowColorScale sub-schema](#slot-scaledomain) | Which color each value of the field takes. Under `name` it takes no `domain`: a row's own color is `rows.colors`. |
| <span id="slot-scaledomain">**scale.domain**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | the field's values that get a color, in order; none under name, where a row's own color is rows.colors |
| <span id="slot-scalerange">**scale.range**</span><br>[`colorArray`](/docs/config_guides/slot_types#colorarray) = <code>[]</code> | the CSS color each value in domain takes, in the same order; past them, the palette the other values deal from |
| <span id="slot-scaleunknown">**scale.unknown**</span><br>[`maybeColor`](/docs/config_guides/slot_types#the-maybe-types) | color for a value missing from domain. Unset: the next palette color where the display deals one, and the levels a preset field names, such as strand's, keep their own colors. A color: that color. "": no color dealt, so a feature paints the no-value grey, a variant cell the alt hue, and a row keeps the color it already has |
