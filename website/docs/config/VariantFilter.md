---
id: variantfilter
title: VariantFilter
description: "The tests the multi-sample variant display applies to the records it fetched, its filter: the jexl expressions every feature filter takes, and two thresholds on what the record's genotypes say about…"
sidebar_label: Display -> VariantFilter
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `variants` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/LinearMultiSampleVariantDisplay/variantFilterConfigSchema.ts).

## Example usage

```js
{
  type: 'LinearMultiSampleVariantDisplay',
  filter: { minMinorAlleleFrequency: 0.05, maxMissingness: 0.1 },
}
```

The tests the multi-sample variant display applies to the records it
fetched, its `filter`: the jexl `expressions` every feature filter takes,
and two thresholds on what the record's genotypes say about the site.

## Related links

- **Base config:** [FeatureFilter](../featurefilter)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-minminorallelefrequency">**minMinorAlleleFrequency**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | A variant draws only when its minor allele, the second most frequent of its called alleles, makes up at least this share of them. At most 0.5; 0 keeps every variant. |
| <span id="slot-maxmissingness">**maxMissingness**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | a variant draws only with at most this share of its alleles uncalled; 1 keeps every variant |
| <span class="slot-group">Inherited from [FeatureFilter](../featurefilter)</span> | <span class="slot-group-count">1 slot</span> |
| <span id="slot-expressions">**expressions**</span><br>[`expressionArray`](/docs/config_guides/slot_types#expressionarray) = <code>[]</code> | The features the display admits: a feature is drawn when every expression holds. Each entry is a `jexl:` expression over `feature`. The "Filter by..." dialog and "Edit plot..." edit this list, and "Clear all filters" returns it to what the track's config declares. |
