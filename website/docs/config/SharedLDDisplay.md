---
id: sharedlddisplay
title: SharedLDDisplay
sidebar_label: Display -> SharedLDDisplay
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `variants`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/LDDisplay/SharedLDConfigSchema.ts).

## Overview

<details open>
<summary>SharedLDDisplay - Slots</summary>

#### slot: minorAlleleFrequencyFilter

Filter variants by minor allele frequency (0-1). Variants with MAF below this
threshold will be hidden

**Type:** `number` · **Default:** `0.1` · _advanced_

#### slot: lengthCutoffFilter

Maximum length of variants to include (in bp)

**Type:** `number` · **Default:** `Number.MAX_SAFE_INTEGER` · _advanced_

#### slot: lineZoneHeight

Height of the zone for connecting lines at the top

**Type:** `number` · **Default:** `100` · _advanced_

#### slot: ldMetric

LD metric to compute: 'r2' (squared correlation) or 'dprime' (normalized D)

**Type:** `stringEnum` (one of `r2`, `dprime`) · **Default:** `'r2'`

#### slot: showLegend

Whether to show the legend

**Type:** `boolean` · **Default:** `false`

#### slot: showLDTriangle

Whether to show the LD triangle heatmap

**Type:** `boolean` · **Default:** `true`

#### slot: showRecombination

Whether to show the recombination rate track

**Type:** `boolean` · **Default:** `false`

#### slot: recombinationZoneHeight

Height of the recombination track zone at the top

**Type:** `number` · **Default:** `50` · _advanced_

#### slot: fitToHeight

When true, squash the LD triangle to fit the display height

**Type:** `boolean` · **Default:** `false` · _advanced_

#### slot: hweFilterThreshold

HWE filter p-value threshold (variants with HWE p < this are excluded). Set to 0
to disable HWE filtering

**Type:** `number` · **Default:** `0` · _advanced_

#### slot: callRateFilter

Call rate filter threshold (0-1). Variants with fewer than this proportion of
non-missing genotypes are excluded. Set to 0 to disable.

**Type:** `number` · **Default:** `0` · _advanced_

#### slot: showVerticalGuides

Whether to show vertical guides at the connected genome positions on hover

**Type:** `boolean` · **Default:** `true` · _advanced_

#### slot: showLabels

Whether to show variant labels above the tick marks

**Type:** `boolean` · **Default:** `false` · _advanced_

#### slot: tickHeight

Height of the vertical tick marks at the genomic position

**Type:** `number` · **Default:** `6` · _advanced_

#### slot: useGenomicPositions

When true, draw cells sized according to genomic distance between SNPs rather
than uniform squares

**Type:** `boolean` · **Default:** `false` · _advanced_

#### slot: signedLD

When true, show signed LD values (-1 to 1) instead of absolute values (0 to 1).
For R², this shows R (correlation) instead. For D', this preserves the sign.

**Type:** `boolean` · **Default:** `false` · _advanced_

#### slot: jexlFilters

JEXL filter expressions to apply to variants (one per line, starting with jexl:)

**Type:** `stringArray` · **Default:** `[]` · _advanced_

</details>

## Inherited config slots

Slots available on this config via its base configuration(s), shown in full so
this page is self-contained.

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

### SharedLDDisplay - Derives from

- [BaseLinearDisplay](../baselineardisplay)
