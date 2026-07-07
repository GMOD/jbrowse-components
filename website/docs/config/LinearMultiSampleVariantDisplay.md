---
id: linearmultisamplevariantdisplay
title: LinearMultiSampleVariantDisplay
sidebar_label: Display -> LinearMultiSampleVariantDisplay
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `variants`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/LinearMultiSampleVariantDisplay/configSchema.ts).

## Example usage

Minimal `VariantTrack` config selecting this display type. The `displays` array
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
      type: 'LinearMultiSampleVariantDisplay',
    },
  ],
}
```

Preloading sample metadata: point the adapter's `samplesTsvLocation` at a TSV
whose first column is the sample name and whose other columns are per-sample
attributes (e.g. `population`), then `colorBy` one of those attributes to color
the sidebar rows on load. `showReferenceAlleles: false` paints the background
solid grey and draws only ALT alleles on top, which makes overlapping structural
variants easier to see. This is the 1000 Genomes "colored by population" demo
config:

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
      type: 'LinearMultiSampleVariantDisplay',
      height: 800,
      colorBy: 'population',
      showReferenceAlleles: false,
    },
  ],
}
```

Taller track, phased haplotype rows, with pre-declared sample colors and groups.
`layout` seeds the initial sample order, color, and group labels (used for
sidebar coloring) inline instead of from a `samplesTsvLocation`:

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
      type: 'LinearMultiSampleVariantDisplay',
      height: 400,
      renderingMode: 'phased',
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

| Slot                   | Type     | Description |
| ---------------------- | -------- | ----------- |
| [height](#slot-height) | `number` |             |

<details>
<summary>LinearMultiSampleVariantDisplay - Slots</summary>

#### slot: height

**Type:** `number` · **Default:** `200`

</details>

## Inherited config slots

Slots available on this config via its base configuration(s), shown in full so
this page is self-contained. A slot redeclared by a more specific config is
shown once, at its most specific definition.

<details>
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

#### slot: maxMissingnessFilter

Hide variants whose fraction of no-call (missing) genotypes is above this
threshold; 1 keeps every variant

**Type:** `number` · **Default:** `1` · _advanced_

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

<details>
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

## Related links

- **Adapter:** [BedpeAdapter](../bedpeadapter)
- **Adapter:** [StarFusionAdapter](../starfusionadapter)
- **Adapter:** [SplitVcfTabixAdapter](../splitvcftabixadapter)
- **Adapter:** [VcfAdapter](../vcfadapter)
- **Adapter:** [VcfTabixAdapter](../vcftabixadapter)
- **State model:** [runtime API](../../models/linearmultisamplevariantdisplay)
- **Base config:** [SharedVariantDisplay](../sharedvariantdisplay)
