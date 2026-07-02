---
id: linearvariantdisplay
title: LinearVariantDisplay
sidebar_label: Display -> LinearVariantDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/LinearVariantDisplay/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/LinearVariantDisplay.md)

## Example usage

Minimal `VariantTrack` config. See the
[variant track guide](/docs/config_guides/variant_track) for all options:

```js
{
  type: 'VariantTrack',
  trackId: 'variants',
  name: 'Variants',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'VcfTabixAdapter',
    uri: 'https://example.com/variants.vcf.gz',
  },
}
```

Taller track. The `displayDefaults` object shorthand is equivalent to
`displays: [{ type: 'LinearVariantDisplay', displayId: '...', ... }]` — see
[configuring displays](/docs/config_guides/tracks#configuring-displays):

```js
{
  type: 'VariantTrack',
  trackId: 'variants',
  name: 'Variants',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'VcfTabixAdapter',
    uri: 'https://example.com/variants.vcf.gz',
  },
  displayDefaults: { height: 200 },
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

Extends LinearCanvasBaseDisplay for GPU-accelerated variant rendering.

### LinearVariantDisplay - State model

This config's runtime API is documented on its
[state model page](../../models/linearvariantdisplay).

## Inherited config slots

Slots available on this config via its base configuration(s), shown in full so
this page is self-contained.

<details open>
<summary>Inherited from LinearCanvasBaseDisplay</summary>

[LinearCanvasBaseDisplay config →](../linearcanvasbasedisplay)

#### slot: maxHeight

Maximum height of the display in pixels

**Type:** `number` · **Default:** `1200`

```js
{
  type: 'number',
  defaultValue: 1200,
  description: 'Maximum height of the display in pixels',
  advanced: true,
}
```

#### slot: autoHeight

Automatically resize the track height to fit all features

**Type:** `boolean` · **Default:** `false`

```js
{
  type: 'boolean',
  defaultValue: false,
  description:
    'Automatically resize the track height to fit all features',
}
```

#### slot: showLabels

Show feature labels: "auto" hides labels at high feature density, "on" always
shows, "off" always hides

**Type:** `stringEnum` · **Default:** `'auto'`

```js
{
  type: 'stringEnum',
  model: types.enumeration('showLabels', [...SHOW_LABELS_MODES]),
  defaultValue: 'auto',
  description:
    'Show feature labels: "auto" hides labels at high feature density, "on" always shows, "off" always hides',
}
```

#### slot: maxLabelFeatureDensity

In "auto" showLabels mode, hide labels when visible feature density
(features/pixel) exceeds this value

**Type:** `number`

```js
{
  type: 'number',
  defaultValue: MAX_LABEL_FEATURE_DENSITY,
  description:
    'In "auto" showLabels mode, hide labels when visible feature density (features/pixel) exceeds this value',
  advanced: true,
}
```

#### slot: showDescriptions

Show feature descriptions

**Type:** `boolean` · **Default:** `true`

```js
{
  type: 'boolean',
  defaultValue: true,
  description: 'Show feature descriptions',
}
```

#### slot: color

the main fill color of each feature (a CSS color, or a jexl expression for
per-feature coloring)

**Type:** `color` · **Default:** `'goldenrod'`

```js
{
  type: 'color',
  description:
    'the main fill color of each feature (a CSS color, or a jexl expression for per-feature coloring)',
  defaultValue: 'goldenrod',
  contextVariable: ['feature'],
}
```

#### slot: connectorColor

color of the connecting/intron lines between feature segments (defaults to the
theme text color)

**Type:** `color`

```js
{
  type: 'color',
  description:
    'color of the connecting/intron lines between feature segments (defaults to the theme text color)',
  defaultValue: THEME_DERIVED_COLOR,
  contextVariable: ['feature'],
}
```

#### slot: utrColor

fill color for UTRs on gene/transcript glyphs

**Type:** `color` · **Default:** `'#357089'`

```js
{
  type: 'color',
  description: 'fill color for UTRs on gene/transcript glyphs',
  defaultValue: '#357089',
  contextVariable: ['feature'],
}
```

#### slot: outlineColor

outline color for features (empty string = no outline)

**Type:** `color` · **Default:** `''`

```js
{
  type: 'color',
  description: 'outline color for features (empty string = no outline)',
  defaultValue: '',
}
```

#### slot: featureHeight

height in pixels of the main body of each feature

**Type:** `number` · **Default:** `10`

```js
{
  type: 'number',
  description: 'height in pixels of the main body of each feature',
  defaultValue: 10,
  contextVariable: ['feature'],
}
```

#### slot: displayMode

Feature height preset. 'default' inherits the session-wide default for this
display type (falling back to normal); normal/compact/superCompact pin an
explicit height

**Type:** `stringEnum` · **Default:** `'default'`

```js
{
  type: 'stringEnum',
  model: types.enumeration('displayMode', [
    'default',
    'normal',
    'compact',
    'superCompact',
  ]),
  description:
    "Feature height preset. 'default' inherits the session-wide default for this display type (falling back to normal); normal/compact/superCompact pin an explicit height",
  defaultValue: 'default',
}
```

#### slot: geneGlyphMode

Gene glyph display mode: "auto" switches based on zoom level, "all" shows all
transcripts, "longestCoding" shows only the longest coding transcript

**Type:** `stringEnum` · **Default:** `'auto'`

```js
{
  type: 'stringEnum',
  model: types.enumeration('geneGlyphMode', [...GENE_GLYPH_MODES]),
  description:
    'Gene glyph display mode: "auto" switches based on zoom level, "all" shows all transcripts, "longestCoding" shows only the longest coding transcript',
  defaultValue: 'auto',
}
```

#### slot: subfeatureLabels

subfeature label display mode

**Type:** `stringEnum` · **Default:** `'none'`

```js
{
  type: 'stringEnum',
  model: types.enumeration('subfeatureLabels', [
    'none',
    'below',
    'overlay',
  ]),
  description: 'subfeature label display mode',
  defaultValue: 'none',
}
```

#### slot: displayDirectionalChevrons

Display directional chevrons on intron lines to indicate strand direction

**Type:** `boolean` · **Default:** `true`

```js
{
  type: 'boolean',
  description:
    'Display directional chevrons on intron lines to indicate strand direction',
  defaultValue: true,
}
```

#### slot: transcriptTypes

**Type:** `stringArray`

```js
{
  type: 'stringArray',



  defaultValue: [
    'mRNA',
    'transcript',
    'primary_transcript',
    'V_gene_segment',
    'C_gene_segment',
    'D_gene_segment',
    'J_gene_segment',
  ],
}
```

#### slot: containerTypes

**Type:** `stringArray`

```js
{
  type: 'stringArray',
  defaultValue: ['proteoform_orf'],
}
```

#### slot: subParts

subparts for a glyph

**Type:** `string` · **Default:** `'CDS,UTR,five_prime_UTR,three_prime_UTR'`

```js
{
  type: 'string',
  description: 'subparts for a glyph',
  defaultValue: 'CDS,UTR,five_prime_UTR,three_prime_UTR',
}
```

#### slot: impliedUTRs

imply UTR from the exon and CDS differences

**Type:** `boolean` · **Default:** `false`

```js
{
  type: 'boolean',
  description: 'imply UTR from the exon and CDS differences',
  defaultValue: false,
}
```

#### slot: labels

```js
ConfigurationSchema('CanvasFeatureLabels', {
  name: {
    type: 'string',
    description: 'the primary name of the feature to show',
    defaultValue: `jexl:get(feature,'name') || get(feature,'id')`,
    contextVariable: ['feature'],
  },
  description: {
    type: 'string',
    description: 'the text description to show',
    defaultValue: `jexl:get(feature,'note') || get(feature,'description')`,
    contextVariable: ['feature'],
  },
})
```

</details>

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

### LinearVariantDisplay - Derives from

- [LinearCanvasBaseDisplay](../linearcanvasbasedisplay)

```js
baseConfiguration: linearCanvasBaseDisplayConfigSchemaFactory(pluginManager)
```
