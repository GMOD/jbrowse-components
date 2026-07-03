---
id: linearpairedarcdisplay
title: LinearPairedArcDisplay
sidebar_label: Display -> LinearPairedArcDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/arc/src/LinearPairedArcDisplay/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/LinearPairedArcDisplay.md)

## Example usage

Selected on a `VariantTrack` of structural variants: each feature draws an arc
from its position to its mate breakend (parsed from the VCF `ALT`), connecting
the two loci even when the mate is on another chromosome / displayed region.
Short ticks mark each breakend's mate direction; clicking an arc opens the
variant details. `color` is jexl-evaluated per `(feature, alt)`:

```js
{
  type: 'VariantTrack',
  trackId: 'sv',
  name: 'Structural variants',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'VcfTabixAdapter',
    uri: 'https://example.com/sv.vcf.gz',
  },
  displays: [
    {
      type: 'LinearPairedArcDisplay',
      displayId: 'sv-LinearPairedArcDisplay',
    },
  ],
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

### LinearPairedArcDisplay - State model

This config's runtime API is documented on its
[state model page](../../models/linearpairedarcdisplay).

<details open>
<summary>LinearPairedArcDisplay - Slots</summary>

#### slot: color

the color of the arcs

**Type:** `color` · **Default:** `'jexl:defaultPairedArcColor(feature,alt)'`

```js
{
  type: 'color',
  description: 'the color of the arcs',
  defaultValue: 'jexl:defaultPairedArcColor(feature,alt)',
  contextVariable: ['feature', 'alt'],
}
```

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

**Type:** `number` · **Default:** `1`

```js
{
  type: 'number',
  description:
    'maximum features per pixel before showing a "too many features" message, used if byte size estimates are not available',
  defaultValue: 1,
  advanced: true,
}
```

#### slot: fetchSizeLimit

maximum data to attempt to download for a given track, used if adapter doesn't
specify one

**Type:** `number` · **Default:** `1_000_000`

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

default height for the track

**Type:** `number` · **Default:** `100`

```js
{
  type: 'number',
  defaultValue: 100,
  description: 'default height for the track',
}
```

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

**Type:** `stringArray`

```js
{
  type: 'stringArray',
  description:
    'default set of jexl filters to apply to a track. note: these do not use the jexl prefix because they have a deferred evaluation system',
  defaultValue: [],
}
```

</details>

### LinearPairedArcDisplay - Derives from

- [BaseLinearDisplay](../baselineardisplay)

```js
baseConfiguration: baseLinearDisplayConfigSchema
```
