---
id: rowcolor
title: RowColor
description: "The rowColor setting of the row displays: one ordinal color channel on the row axis. field names the row attribute whose values take the colors, name (the row itself) by default, and scale.domain and…"
sidebar_label: Display setting -> RowColor
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/rowColorConfigSchema.ts).

The `rowColor` setting of the row displays: one ordinal color channel on
the row axis. `field` names the row attribute whose values take the
colors, `name` (the row itself) by default, and `scale.domain` and
`scale.range` pair those values with CSS colors, so a color a reader sets on a row in the
arrangement dialog is an entry under `name`. Each display paints it on the
element that identifies a row: the quantitative display's plot, or
the tint beside its label while a score gradient paints; the multi-row
feature display's blocks; the variant display's label tint; the
MAF display's label tint, over the adapter's `samples[].color`; the mark
display's label tint, over a listed source's color. Where the rows have
attributes (a samplesTsv column or a subtrack's group), `field` may name one,
and its values each take a palette color. Under `name` the palette deals only
where the rows share one panel, a wiggle overlay; stacked rows are identified by
their labels. `scale.unknown: ''` deals none, so only the values
`scale.domain` lists take a color and every other row keeps the color it
already has. A string is the field.

A channel of its own beside `rows`, not `rows.color`: it has its own
`field`, palette and key, so a write of `rows` replaces the arrangement
and leaves the colors. A pick of another rows field in a menu or the Edit
plot form drops the `name` pairs, which name the old field's rows. Nor is it `encoding.color`, which on wiggle and the
mark display paints by value.

## Example usage

```js
{
  type: 'LinearWiggleDisplay',
  rowColor: {
    scale: { domain: ['tumor', 'normal'], range: ['#b2182b', '#2166ac'] },
  },
}
```

```js
{ type: 'LinearVariantDisplay', rowColor: 'population' }
```

```js
{
  type: 'LinearMultiRowFeatureDisplay',
  rowColor: {
    scale: { domain: ['mom'], range: ['#b2182b'], unknown: '#cccccc' },
  },
}
```

## Config slots

A setting written to it replaces it whole: a member left out returns to its default. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-field">**field**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'name'</code> | The row attribute whose values take the colors. Under `name` with no `scale`, stacked rows keep only a file's own colors, since the palette deals only where the rows share one panel; list the rows in `scale.domain` to color them. |
| <span id="slot-scale">**scale**</span><br>[RowColorScale sub-schema](#slot-scaledomain) | Which color each value of the field takes. |
| <span id="slot-scaledomain">**scale.domain**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | the field's values that get a color, in order: under name, rows by name |
| <span id="slot-scalerange">**scale.range**</span><br>[`colorArray`](/docs/config_guides/slot_types#colorarray) = <code>[]</code> | the CSS color each value in domain takes, in the same order |
| <span id="slot-scaleunknown">**scale.unknown**</span><br>[`maybeColor`](/docs/config_guides/slot_types#the-maybe-types) | color for a value missing from domain. Unset: the next palette color where the display deals one, and the levels a preset field names, such as strand's, keep their own colors. A color: that color. "": no color dealt, so a feature paints the no-value grey, a variant cell the alt hue, and a row keeps the color it already has |
