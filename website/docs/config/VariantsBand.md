---
id: variantsband
title: VariantsBand
description: "The multi-sample variant display's variants setting: a LinearVariantDisplay-style band above the genotype rows, one mark per record at its genomic span, colored by whatever \"Color by → Cells\" is set…"
sidebar_label: Display -> VariantsBand
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `variants` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/LinearMultiSampleVariantDisplay/variantsBandConfigSchema.ts).

The multi-sample variant display's `variants` setting: a
`LinearVariantDisplay`-style band above the genotype rows, one mark per
record at its genomic span, colored by whatever "Color by → Cells" is set
to. Overlapping records stack while the band has room and share a row once
it has not; hovering a mark reports the record, clicking opens its details,
and right-clicking opens the menu a genotype cell does. At genomic positions
only.

## Example usage

```js
{ type: 'LinearMultiSampleVariantDisplay', variants: { show: true } }
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-show">**show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | draw the variants themselves above the genotype rows, at their genomic positions |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>40</code> | height of the band in pixels, taken from the rows |
| <span id="slot-labels">**labels**</span><br>[VariantsBandLabels sub-schema](#slot-labelsname) | Letter the marks as a `LinearVariantDisplay` letters the same record: `labels.name`, each record's ID, and `labels.description`, each a [](/docs/config/featurenamelabel) and [](/docs/config/featuredescriptionlabel) object. The band's fit ladder decides what it has room for: descriptions drop first, then IDs thin, then drop. |
| <span id="slot-labelsname">**labels.name**</span><br>[FeatureNameLabel](../featurenamelabel) | Each record's ID. |
| <span id="slot-labelsdescription">**labels.description**</span><br>[FeatureDescriptionLabel](../featuredescriptionlabel) | The line under each ID. |
