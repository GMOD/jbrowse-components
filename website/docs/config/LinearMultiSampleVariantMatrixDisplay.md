---
id: linearmultisamplevariantmatrixdisplay
title: LinearMultiSampleVariantMatrixDisplay
sidebar_label: Display -> LinearMultiSampleVariantMatrixDisplay
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `variants`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/LinearMultiSampleVariantMatrixDisplay/configSchema.ts).

## Example usage

Minimal `VariantTrack` config selecting the matrix display. The `displays` array
form is required here (rather than the object shorthand) because this is a
non-default display type — see
[configuring displays](/docs/config_guides/tracks#configuring-displays):

```js
{
  type: 'VariantTrack',
  trackId: 'cohort',
  name: 'Cohort variants',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'VcfTabixAdapter',
    uri: 'https://example.com/cohort.vcf.gz',
  },
  displays: [
    {
      type: 'LinearMultiSampleVariantMatrixDisplay',
    },
  ],
}
```

Preloading sample metadata: point the adapter's `samplesTsvLocation` at a TSV
whose first column is the sample name and whose other columns are per-sample
attributes (e.g. `population`), then `colorBy` one of those attributes to color
the matrix rows on load (same metadata mechanism as the regular
`LinearMultiSampleVariantDisplay`):

```js
{
  type: 'VariantTrack',
  trackId: 'cohort',
  name: 'Cohort variants',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'VcfTabixAdapter',
    uri: 'https://example.com/cohort.vcf.gz',
    samplesTsvLocation: { uri: 'https://example.com/samples.tsv' },
  },
  displays: [
    {
      type: 'LinearMultiSampleVariantMatrixDisplay',
      height: 400,
      colorBy: 'population',
    },
  ],
}
```

Taller matrix filtering rare variants (MAF < 5 %), with pre-declared sample
colors and groups. `layout` seeds the initial row order, color, and group labels
inline instead of from a `samplesTsvLocation`:

```js
{
  type: 'VariantTrack',
  trackId: 'cohort',
  name: 'Cohort variants',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'VcfTabixAdapter',
    uri: 'https://example.com/cohort.vcf.gz',
  },
  displays: [
    {
      type: 'LinearMultiSampleVariantMatrixDisplay',
      height: 400,
      minorAlleleFrequencyFilter: 0.05,
      layout: [
        { name: 'HG001', color: '#e41a1c', group: 'case' },
        { name: 'HG002', color: '#377eb8', group: 'control' },
        { name: 'HG003', color: '#4daf4a', group: 'control' },
      ],
    },
  ],
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

### LinearMultiSampleVariantMatrixDisplay - Compatible adapters

Data adapters that can supply the [VariantTrack](../varianttrack):

- [BedpeAdapter](../bedpeadapter)
- [StarFusionAdapter](../starfusionadapter)
- [SplitVcfTabixAdapter](../splitvcftabixadapter)
- [VcfAdapter](../vcfadapter)
- [VcfTabixAdapter](../vcftabixadapter)

### LinearMultiSampleVariantMatrixDisplay - State model

This config's runtime API is documented on its
[state model page](../../models/linearmultisamplevariantmatrixdisplay).

<details open>
<summary>LinearMultiSampleVariantMatrixDisplay - Slots</summary>

#### slot: height

**Type:** `number` · **Default:** `250`

</details>

## Inherited config slots

Slots available on this config via its base configuration(s), shown in full so
this page is self-contained.

<details open>
<summary>Inherited from SharedVariantDisplay</summary>

[SharedVariantDisplay config →](../sharedvariantdisplay)

#### slot: showReferenceAlleles

Starting value for drawing reference alleles. When false, the row background is
filled solid grey and only ALT alleles are painted on top (makes overlapping
variants easier to see); when true, reference alleles are drawn normally. Seeds
referenceDrawingMode the first time a config is loaded.

**Type:** `boolean` · **Default:** `false`

#### slot: showSidebarLabels

Show the per-sample row labels in the sidebar

**Type:** `boolean` · **Default:** `true`

#### slot: showTree

Show the sample clustering tree in the sidebar

**Type:** `boolean` · **Default:** `true`

#### slot: showBranchLength

Draw the clustering tree with branch lengths

**Type:** `boolean` · **Default:** `false`

#### slot: renderingMode

'alleleCount' draws one row per sample colored by allele dosage; 'phased' draws
one row per haplotype

**Type:** `stringEnum` (one of `alleleCount`, `phased`) · **Default:**
`'alleleCount'`

#### slot: featureColor

Optional per-feature color for the genotype cells: a jexl expression (or plain
CSS color) evaluated once per variant in the worker, painting every alt-carrying
cell with that color while ref/no-call cells keep their normal coloring so "who
carries it" still reads. Empty means the default genotype-based coloring (allele
dosage / phasing). The "Color cells by" menu offers presets like consequence
impact (`jexl:impactColor(feature)`), but any feature jexl works, same as the
standard `color` slot.

**Type:** `string` · **Default:** `''`

#### slot: minorAlleleFrequencyFilter

Hide variants whose minor allele frequency is below this threshold

**Type:** `number` · **Default:** `0` · _advanced_

#### slot: colorBy

Name of a sample-metadata attribute (a column in the adapter's
samplesTsvLocation, e.g. 'population') to color the sidebar rows by; empty means
no grouping

**Type:** `string` · **Default:** `''`

#### slot: referenceDrawingMode

A 'draw'/'skip' toggle for reference alleles, settable independent of
showReferenceAlleles (the admin-config-only starting default). No fallback
derivation at read time — preProcessSnapshot below seeds this from
showReferenceAlleles once, the first time a config lacking it is hydrated, so
from then on this slot alone is the single source of truth.

**Type:** `stringEnum` (one of `draw`, `skip`) · **Default:** `'skip'`

</details>

<details open>
<summary>Inherited from BaseLinearDisplay</summary>

[BaseLinearDisplay config →](../baselineardisplay)

#### slot: maxFeatureScreenDensity

maximum features per pixel before showing a "too many features" message, used if
byte size estimates are not available

**Type:** `number` · **Default:** `1` · _advanced_

#### slot: fetchSizeLimit

maximum data to attempt to download for a given track, used if adapter doesn't
specify one

**Type:** `number` · **Default:** `1_000_000` · _advanced_

#### slot: height

default height for the track

**Type:** `number` · **Default:** `100`

#### slot: mouseover

text to display when the cursor hovers over a feature

**Type:** `string` · **Default:**
`'jexl:mouseoverExtraInformation||get(feature,'_mouseOver')||get(feature,'name')||get(feature,'id')'`

```js
{
  type: 'string',
  description: 'text to display when the cursor hovers over a feature',
  defaultValue: `jexl:mouseoverExtraInformation||get(feature,'_mouseOver')||get(feature,'name')||get(feature,'id')`,
  contextVariable: ['feature', 'mouseoverExtraInformation'],
}
```

#### slot: jexlFilters

config jexlFilters are deferred evaluated so they are prepended with jexl at
runtime rather than being stored with jexl in the config

**Type:** `stringArray` · **Default:** `[]`

</details>

### LinearMultiSampleVariantMatrixDisplay - Derives from

- [SharedVariantDisplay](../sharedvariantdisplay)
