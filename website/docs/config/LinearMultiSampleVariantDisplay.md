---
id: linearmultisamplevariantdisplay
title: LinearMultiSampleVariantDisplay
sidebar_label: Display -> LinearMultiSampleVariantDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/LinearMultiSampleVariantDisplay/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/LinearMultiSampleVariantDisplay.md)

## Example usage

A complete `VariantTrack` config to paste into `tracks`, for a multi-sample
(cohort) VCF. `renderingMode: 'phased'` draws each sample's two haplotypes as
separate rows instead of one allele-count row per sample:

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
      displayId: 'cohort-LinearMultiSampleVariantDisplay',
      height: 400,
      renderingMode: 'phased',
    },
  ],
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

<details open>
<summary>LinearMultiSampleVariantDisplay - Slots</summary>

#### slot: defaultRendering

```js
{
  type: 'stringEnum',
  model: types.enumeration('Rendering', ['multivariant']),
  defaultValue: 'multivariant',
}
```

#### slot: height

```js
{
  type: 'number',
  defaultValue: 200,
}
```

</details>

## Inherited config slots

Slots available on this config via its base configuration(s), shown in full so
this page is self-contained.

<details open>
<summary>Inherited from SharedVariantDisplay</summary>

[SharedVariantDisplay config →](../sharedvariantdisplay)

#### slot:

```js
...sharedVariantConfigSlots
```

</details>

<details open>
<summary>Inherited from BaseLinearDisplay</summary>

[BaseLinearDisplay config →](../baselineardisplay)

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

</details>

### LinearMultiSampleVariantDisplay - Derives from

- [SharedVariantDisplay](../sharedvariantdisplay)

```js
baseConfiguration: sharedVariantConfigFactory()
```
