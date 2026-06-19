---
id: sharedlddisplay
title: SharedLDDisplay
sidebar_label: Display -> SharedLDDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/LDDisplay/SharedLDConfigSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/SharedLDDisplay.md)

## Overview

### SharedLDDisplay - Slots

#### slot: minorAlleleFrequencyFilter

Filter variants by minor allele frequency (0-1). Variants with MAF below this
threshold will be hidden

```js
{
  type: 'number',
  defaultValue: 0.1,
  advanced: true,
}
```

#### slot: lengthCutoffFilter

Maximum length of variants to include (in bp)

```js
{
  type: 'number',
  defaultValue: Number.MAX_SAFE_INTEGER,
  advanced: true,
}
```

#### slot: lineZoneHeight

Height of the zone for connecting lines at the top

```js
{
  type: 'number',
  defaultValue: 100,
  advanced: true,
}
```

#### slot: ldMetric

LD metric to compute: 'r2' (squared correlation) or 'dprime' (normalized D)

```js
{
  type: 'stringEnum',
  model: types.enumeration('LDMetric', ['r2', 'dprime']),
  defaultValue: 'r2',
}
```

#### slot: showLegend

Whether to show the legend

```js
{
  type: 'boolean',
  defaultValue: false,
}
```

#### slot: showLDTriangle

Whether to show the LD triangle heatmap

```js
{
  type: 'boolean',
  defaultValue: true,
}
```

#### slot: showRecombination

Whether to show the recombination rate track

```js
{
  type: 'boolean',
  defaultValue: false,
}
```

#### slot: recombinationZoneHeight

Height of the recombination track zone at the top

```js
{
  type: 'number',
  defaultValue: 50,
  advanced: true,
}
```

#### slot: fitToHeight

When true, squash the LD triangle to fit the display height

```js
{
  type: 'boolean',
  defaultValue: false,
  advanced: true,
}
```

#### slot: hweFilterThreshold

HWE filter p-value threshold (variants with HWE p < this are excluded). Set to 0
to disable HWE filtering

```js
{
  type: 'number',
  defaultValue: 0,
  advanced: true,
}
```

#### slot: callRateFilter

Call rate filter threshold (0-1). Variants with fewer than this proportion of
non-missing genotypes are excluded. Set to 0 to disable.

```js
{
  type: 'number',
  defaultValue: 0,
  advanced: true,
}
```

#### slot: showVerticalGuides

Whether to show vertical guides at the connected genome positions on hover

```js
{
  type: 'boolean',
  defaultValue: true,
  advanced: true,
}
```

#### slot: showLabels

Whether to show variant labels above the tick marks

```js
{
  type: 'boolean',
  defaultValue: false,
  advanced: true,
}
```

#### slot: tickHeight

Height of the vertical tick marks at the genomic position

```js
{
  type: 'number',
  defaultValue: 6,
  advanced: true,
}
```

#### slot: useGenomicPositions

When true, draw cells sized according to genomic distance between SNPs rather
than uniform squares

```js
{
  type: 'boolean',
  defaultValue: false,
  advanced: true,
}
```

#### slot: signedLD

When true, show signed LD values (-1 to 1) instead of absolute values (0 to 1).
For R², this shows R (correlation) instead. For D', this preserves the sign.

```js
{
  type: 'boolean',
  defaultValue: false,
  advanced: true,
}
```

#### slot: jexlFilters

JEXL filter expressions to apply to variants (one per line, starting with jexl:)

```js
{
  type: 'stringArray',
  defaultValue: [],
  advanced: true,
}
```

## Inherited config slots

Slots available on this config via its base configuration(s), shown in full so
this page is self-contained.

### Inherited from [BaseLinearDisplay](../baselineardisplay)

#### slot: maxFeatureScreenDensity

```js
{
  type: 'number',
  description:
    'maximum features per pixel that is displayed in the view, used if byte size estimates not available',
  defaultValue: 0.3,
  advanced: true,
}
```

#### slot: fetchSizeLimit

```js
{
  type: 'number',
  defaultValue: 1_000_000,
  description:
    "maximum data to attempt to download for a given track, used if adapter doesn't specify one",
  advanced: true,
}
```

#### slot: height

```js
{
  type: 'number',
  defaultValue: 100,
  description: 'default height for the track',
}
```

#### slot: mouseover

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

```js
{
  type: 'stringArray',
  description:
    'default set of jexl filters to apply to a track. note: these do not use the jexl prefix because they have a deferred evaluation system',
  defaultValue: [],
}
```

### SharedLDDisplay - Derives from

- [BaseLinearDisplay](../baselineardisplay)

```js
baseConfiguration: baseLinearDisplayConfigSchema
```
