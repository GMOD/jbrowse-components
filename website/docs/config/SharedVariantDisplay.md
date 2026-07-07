---
id: sharedvariantdisplay
title: SharedVariantDisplay
sidebar_label: Display -> SharedVariantDisplay
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `variants`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/shared/SharedVariantConfigSchema.ts).

## Overview

<details open>
<summary>SharedVariantDisplay - Slots</summary>

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

## Inherited config slots

Slots available on this config via its base configuration(s), shown in full so
this page is self-contained. A slot redeclared by a more specific config is
shown once, at its most specific definition.

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

### SharedVariantDisplay - Derives from

- [BaseLinearDisplay](../baselineardisplay)
