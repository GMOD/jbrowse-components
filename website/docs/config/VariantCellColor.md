---
id: variantcellcolor
title: VariantCellColor
sidebar_label: Display -> VariantCellColor
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `variants` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/shared/cellColorConfigSchema.ts).

## Example usage

```js
{ type: 'LinearMultiSampleVariantDisplay', color: { field: 'impact' } }
```

```js
{
  type: 'LinearMultiSampleVariantDisplay',
  color: {
    field: 'INFO.AF',
    scale: 'threshold',
    domain: ['0.001', '0.01', '0.05'],
    range: ['#b2182b', '#ef8a62', '#67a9cf', '#2166ac'],
  },
}
```

_See the **Config slots** section below for all available configuration fields._

The multi-sample variant displays' `color` setting: the hue of every
alt-carrying genotype cell, which `shadeByDosage` then lightens for a
heterozygote. Unset, the cells paint the genotype colours. A CSS colour or
`jexl:` callback in `value` paints every alt cell of a variant; a `field`
gives each of its values a colour with a key. Three fields are presets:
`impact`, the most severe SnpEff/VEP consequence tier; `svType`, the
structural-variant class; `phaseSet`, the FORMAT PS block, in phased mode.
Any other field is read off the record — `INFO.CLNSIG`, `QUAL`, or a
`jexl:` expression — and a numeric one cut into intervals by a `threshold`
scale. A string is the constant.

## Config slots

These slots go on a display entry: `"displays": [{ "type": "VariantCellColor", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-value">**value**</span><br>`maybeColor` | A CSS colour, or a jexl callback over `feature` returning one, for every alt cell of the variant. Unset, the cells paint the genotype colours.<br>_callback args:_ `feature` |
| <span id="slot-field">**field**</span><br>[`featureField`](/docs/config_guides/slot_types#featurefield) = <code>''</code> | impact, the most severe SnpEff/VEP consequence tier; svType, the structural-variant class; phaseSet, the FORMAT PS block in phased mode; or any record field, INFO.CLNSIG say, or a jexl expression over feature, whose values each paint one range colour with a key. A record with no value keeps the default alt colour |
| <span id="slot-scale">**scale**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) | none paints value and keeps the field for a switch back; categorical a range colour per value of field; threshold a range colour per interval between the cut points in domain; unset follows field |
| <span id="slot-domain">**domain**</span><br>`stringArray` = <code>[]</code> | the values that take the range first, in order; under threshold, the ascending cut points, a value on a cut taking the interval above it |
| <span id="slot-range">**range**</span><br>[`colorArray`](/docs/config_guides/slot_types#colorarray) = <code>[]</code> | CSS colours the domain takes, in order, continuing into the default palette past its end; under threshold one per interval, one more than the cuts |
