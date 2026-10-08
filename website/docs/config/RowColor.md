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

```js
{
  type: 'LinearMultiRowFeatureDisplay',
  rowColor: { domain: ['mom'], range: ['#b2182b'], unknown: '#cccccc' },
}
```

_See the **Config slots** section below for all available configuration fields._

The `rowColor` setting of the row displays: one categorical colour channel
on the row axis. `field` names the row attribute whose values take the
colours, `name` (the row itself) by default, and `domain`/`range` pair those
values with CSS colours, so a colour a reader sets on a row in the
arrangement dialog is an entry under `name`. Each display paints it on the
channel that carries a row's identity: the quantitative display's plot, or
the tint beside its label while a score gradient paints; the multi-row
feature display's blocks; the multi-sample variant displays' label tint; the
MAF display's label tint, over the adapter's `samples[].color`; the mark
display's label tint, over a listed source's colour. Where the rows carry
attributes, a samplesTsv column or a subtrack's group, `field` may name one,
and its values each take a palette colour. Under `name` the palette deals only
where the rows share one panel, a wiggle overlay; stacked rows are named by
their labels. `unknown: ''` deals none, so only the values `domain` lists take
a colour and every other row keeps its own. A string is the field.

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-field">**field**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'name'</code> | the row attribute whose values take the colours: name, the row itself, or an attribute the rows carry, such as a column of a multi-sample variant adapter's samplesTsvLocation, e.g. population, or a subtrack's group |
| <span id="slot-domain">**domain**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | the field's values given a colour of their own, in order: under name, rows by name |
| <span id="slot-range">**range**</span><br>[`colorArray`](/docs/config_guides/slot_types#colorarray) = <code>[]</code> | the CSS colour each value in domain takes, in the same order |
| <span id="slot-unknown">**unknown**</span><br>[`maybeColor`](/docs/config_guides/slot_types#the-maybe-types) | what a value domain does not list takes: unset the next palette colour where the display deals one, a colour that colour, "" none from this setting |
