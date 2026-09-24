---
id: rowcolor
title: RowColor
sidebar_label: Display -> RowColor
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/display-kit/src/rowColorConfigSchema.ts).

## Example usage

```js
{
  type: 'LinearWiggleDisplay',
  rowColor: { domain: ['tumor', 'normal'], range: ['#b2182b', '#2166ac'] },
}
```

```js
{ type: 'LinearMultiSampleVariantDisplay', rowColor: 'population' }
```

_See the **Config slots** section below for all available configuration fields._

The `rowColor` setting of the row displays: one categorical colour channel
on the row axis. `field` names the row attribute whose values take the
colours, `name` (the row itself) by default, and `domain`/`range` pair those
values with CSS colours, so a colour a reader sets on a row in the
arrangement dialog is an entry under `name`. Each display paints it on the
channel that carries a row's identity: the quantitative display's plot, or
the tint beside its label while a score gradient paints; the multi-row
feature display's blocks; the multi-sample variant displays' label tint,
where `field` may also name a samplesTsv column whose values each take a
palette colour; the MAF display's label tint, over the adapter's
`samples[].color`. A string is the field.

## Config slots

These slots go on a display entry: `"displays": [{ "type": "RowColor", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-field">**field**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'name'</code> | the row attribute whose values take the colours: name, the row itself, or on the multi-sample variant displays a column of the adapter's samplesTsvLocation, e.g. population |
| <span id="slot-scale">**scale**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (none, categorical) | none paints nothing from this setting and keeps the field for a switch back; categorical a colour per value of field; unset follows field |
| <span id="slot-domain">**domain**</span><br>`stringArray` = <code>[]</code> | the field's values given a colour of their own, in order: under name, rows by name |
| <span id="slot-range">**range**</span><br>[`colorArray`](/docs/config_guides/slot_types#colorarray) = <code>[]</code> | the CSS colour each value in domain takes, in the same order |
