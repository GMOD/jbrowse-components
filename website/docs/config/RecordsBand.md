---
id: recordsband
title: RecordsBand
description: "The multi-sample variant display's records band: the VCF's structural variants above the genotype rows, stacked as a LinearVariantDisplay stacks them, so a nested SV sits under the one holding it."
sidebar_label: Display setting -> RecordsBand
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `variants` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/LinearMultiSampleVariantDisplay/recordsBandConfigSchema.ts).

The multi-sample variant display's `records` band: the VCF's structural
variants above the genotype rows, stacked as a `LinearVariantDisplay`
stacks them, so a nested SV sits under the one holding it. SNVs and small
indels are left out, so a region without SVs spends no height on it. A
record is colored by its SV type, keyed, or by `encoding.color` when that
is set, and lettered with its ID and description on one line. The band grows
to its stack, up to `growMaxHeight`; past that names thin and go, then boxes
shrink. Hovering a record reports it and clicking opens its details. At
genomic positions only.

## Example usage

```js
{ type: 'LinearMultiSampleVariantDisplay', records: { show: true } }
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-show">**show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | draw the structural variants themselves above the genotype rows, at their genomic positions |
| <span id="slot-growmaxheight">**growMaxHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>170</code> | ceiling in pixels on the band, which grows to its stack of records and takes that height from the rows |
| <span id="slot-labels">**labels**</span><br>[RecordsBandLabels sub-schema](#slot-labelsname) | `labels.name`, each record's ID, and `labels.description`, drawn after it on the same line, each a [](/docs/config/featurenamelabel) and [](/docs/config/featuredescriptionlabel) object. |
| <span id="slot-labelsname">**labels.name**</span><br>[FeatureNameLabel](../featurenamelabel) | Each record's ID. |
| <span id="slot-labelsdescription">**labels.description**</span><br>[FeatureDescriptionLabel](../featuredescriptionlabel) | The text after each ID. |
