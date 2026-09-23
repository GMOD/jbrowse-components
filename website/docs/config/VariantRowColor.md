---
id: variantrowcolor
title: VariantRowColor
sidebar_label: Display -> VariantRowColor
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `variants` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/shared/variantRowColorConfigSchema.ts).

## Example usage

```js
{ type: 'LinearMultiSampleVariantDisplay', rowColor: 'population' }
```

```js
{
  type: 'LinearMultiSampleVariantDisplay',
  rowColor: { domain: ['NA12878', 'NA12891'], range: ['#b2182b', '#2166ac'] },
}
```

_See the **Config slots** section below for all available configuration fields._

The multi-sample variant displays' `rowColor`: the tint beside each row's
label. `field` names a sample-metadata attribute (a column of the adapter's
samplesTsvLocation, e.g. `population`) whose values each take a palette
colour; `domain`/`range` pair row names with the colour a reader set in the
arrangement dialog. While `field` names an attribute the samples carry, its
palette tints every row, ahead of those pairs and of a samplesTsv `color`
column; with none, a row's pair wins, then its samplesTsv colour. A string
is the field.

## Config slots

These slots go on a display entry: `"displays": [{ "type": "VariantRowColor", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-field">**field**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | The sample-metadata attribute whose values each take a palette colour. Writing `rowColor: "population"` lands here; empty tints no row by attribute. |
| <span id="slot-domain">**domain**</span><br>`stringArray` = <code>[]</code> | the rows given a colour of their own, by name |
| <span id="slot-range">**range**</span><br>[`colorArray`](/docs/config_guides/slot_types#colorarray) = <code>[]</code> | the CSS colour each row in domain takes, in the same order |
