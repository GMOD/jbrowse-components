---
id: recordsband
title: RecordsBand
description: "The variant display's records band: the VCF's records, stacked as a feature track stacks them, so a nested SV sits under the one holding it."
sidebar_label: Display setting -> RecordsBand
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `variants` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/LinearVariantDisplay/recordsBandConfigSchema.ts).

The variant display's `records` band: the VCF's records, stacked as a
feature track stacks them, so a nested SV sits under the one holding it.

Over genotype rows the band holds every record the filter admits, added
to the track above the rows. A record is colored by its SV type, keyed, or
by `encoding.color` when that is set, and lettered on one line with its ID,
description and the share of the samples shown as rows, no-calls included,
that carry it. The band is `height` tall, which its seam drag writes; unset,
it opens at its stack up to that default and keeps the height it opened
at, so a pan never resizes the track. Records that do not fit thin their
names, then shrink, then hide behind a count beside the band. Past 0.2
records per pixel names go, past 0.1 descriptions, as on a feature track.
Hovering a record reports it and its carriers, and clicking opens its
details. At genomic positions only. On by default: a file with no record
in view when it opens spends 0 px on it.

With no genotype rows (a VCF with no samples, or `genotypes.show` off) the
band is the whole display whatever `show` says: every record, an SV in its
SV type's color and the rest in the feature track's default, lettered as a
feature track letters it (the description under the name, no carrier
share) and sized by the display's `heightMode`. Past
`maxFeatureScreenDensity` records per pixel it refuses the window with the
region-too-large banner and its Force load, as a feature track does; over
genotype rows that budget is not read. Right-clicking a record offers the
feature track's rows on it: zoom to, get sequence, copy.

The record settings are a feature track's, spelt as `LinearBasicDisplay`
spells them: `displayMode` and `mark.height` size each record, `facet`
stacks the records in labelled sections, one per value of a record field,
and `tooltip.field` names the record's line in the hover tooltip.

## Example usage

```js
{ type: 'LinearVariantDisplay', records: { show: false } }
```

```js
{
  type: 'LinearVariantDisplay',
  records: { displayMode: 'collapsed', facet: 'INFO.CLNSIG' },
}
```

## Config slots

A setting written to it names members one by one: a member left out stays as it is, and `null` resets one. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-show">**show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | draw the records themselves above the genotype rows, at their genomic positions |
| <span id="slot-height">**height**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) = <code>undefined</code> | height in pixels of the band over genotype rows, added to the track above them; the band's seam drag writes it. Unset, the band opens at its stack of records, up to 170 px, and keeps that height from then on |
| <span id="slot-displaymode">**displayMode**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (normal, compact, superCompact, collapsed) | Unset, `compact` over genotype rows, keeping the band over them tight, and `normal` with no rows, as on a feature track. |
| <span id="slot-mark">**mark**</span><br>[FeatureMark](../featuremark) | The box each record draws as, a [](/docs/config/featuremark) object: `{ height: 6 }`. |
| <span id="slot-facet">**facet**</span><br>[SectionFacet](../sectionfacet) | One labelled section of the band per value of a record field: `"INFO.CLNSIG"`, or `{ field, sort }` with the order its sections stack in. Not the display's own `facet`, which bands the sample rows. |
| <span id="slot-tooltip">**tooltip**</span><br>[RecordsTooltip sub-schema](#slot-tooltipfield) | The record's line in the hover tooltip, a [](/docs/config/featuretooltip) `field`; whether the tooltip shows is the display's `tooltip.show`. A bare string is the field. |
| <span id="slot-tooltipfield">**tooltip.field**</span><br><code>featureTooltipFieldSlot</code> | The record's line in the hover tooltip: a field, or a `jexl:` expression over `feature`. The default reads the record's name. |
| <span id="slot-labels">**labels**</span><br>[RecordsBandLabels sub-schema](#slot-labelsname) | `labels.name`, each record's ID, and `labels.description`, drawn after it on the same line, each a [](/docs/config/featurenamelabel) and [](/docs/config/featuredescriptionlabel) object. |
| <span id="slot-labelsname">**labels.name**</span><br>[FeatureNameLabel](../featurenamelabel) | Each record's ID. |
| <span id="slot-labelsdescription">**labels.description**</span><br>[FeatureDescriptionLabel](../featuredescriptionlabel) | The text after each ID. |
| <span id="slot-maxfeaturescreendensity">**maxFeatureScreenDensity**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | maximum features per pixel before showing a "too many features" message<br>_advanced_ |
