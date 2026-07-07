---
id: linearcanvasbasedisplay
title: LinearCanvasBaseDisplay
sidebar_label: Display -> LinearCanvasBaseDisplay
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `canvas`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/canvas/src/LinearBasicDisplay/baseConfigSchema.ts).

## Overview

base config for canvas-based linear feature displays (pileup-style glyphs)

| Slot                                                           | Type                                                  | Description                                                                                                                                                                                                                                                |
| -------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [maxHeight](#slot-maxheight)                                   | `number`                                              | Maximum height of the display in pixels                                                                                                                                                                                                                    |
| [autoHeight](#slot-autoheight)                                 | `boolean`                                             | Automatically resize the track height to fit all features                                                                                                                                                                                                  |
| [showLabels](#slot-showlabels)                                 | `stringEnum`                                          | Show feature labels: "auto" hides labels at high feature density, "on" always shows, "off" always hides                                                                                                                                                    |
| [maxLabelFeatureDensity](#slot-maxlabelfeaturedensity)         | `number`                                              | In "auto" showLabels mode, hide labels when visible feature density (features/pixel) exceeds this value                                                                                                                                                    |
| [showDescriptions](#slot-showdescriptions)                     | `boolean`                                             | Show feature descriptions                                                                                                                                                                                                                                  |
| [color](#slot-color)                                           | `color`                                               | the main fill color of each feature (a CSS color, or a jexl expression for per-feature coloring)                                                                                                                                                           |
| [connectorColor](#slot-connectorcolor)                         | `color`                                               | color of the connecting/intron lines between feature segments (defaults to the theme text color)                                                                                                                                                           |
| [utrColor](#slot-utrcolor)                                     | `color`                                               | fill color for UTRs on gene/transcript glyphs                                                                                                                                                                                                              |
| [outlineColor](#slot-outlinecolor)                             | `color`                                               | outline color for features (empty string = no outline)                                                                                                                                                                                                     |
| [featureHeight](#slot-featureheight)                           | `number`                                              | height in pixels of the main body of each feature                                                                                                                                                                                                          |
| [displayMode](#slot-displaymode)                               | `stringEnum` (inherit, normal, compact, superCompact) | Feature height preset. `inherit` (the default) follows the session-wide default for this display type, falling back to `normal`; `normal`/`compact`/`superCompact` each pin an explicit height (including pinning `normal` over a compact session default) |
| [geneGlyphMode](#slot-geneglyphmode)                           | `stringEnum`                                          | Gene glyph display mode: "auto" switches based on zoom level, "all" shows all transcripts, "longestCoding" shows only the longest coding transcript                                                                                                        |
| [subfeatureLabels](#slot-subfeaturelabels)                     | `stringEnum` (none, below, overlay)                   | subfeature label display mode                                                                                                                                                                                                                              |
| [displayDirectionalChevrons](#slot-displaydirectionalchevrons) | `boolean`                                             | Display directional chevrons on intron lines to indicate strand direction                                                                                                                                                                                  |
| [transcriptTypes](#slot-transcripttypes)                       | `stringArray`                                         |                                                                                                                                                                                                                                                            |
| [containerTypes](#slot-containertypes)                         | `stringArray`                                         |                                                                                                                                                                                                                                                            |
| [subParts](#slot-subparts)                                     | `string`                                              | subparts for a glyph                                                                                                                                                                                                                                       |
| [impliedUTRs](#slot-impliedutrs)                               | `boolean`                                             | imply UTRs from exon/CDS differences on transcript glyphs that carry no explicit UTR subfeatures                                                                                                                                                           |
| [labels](#slot-labels)                                         |                                                       |                                                                                                                                                                                                                                                            |

<details>
<summary>LinearCanvasBaseDisplay - Slots</summary>

#### slot: maxHeight

Maximum height of the display in pixels

**Type:** `number` · **Default:** `1200` · _advanced_

#### slot: autoHeight

Automatically resize the track height to fit all features

**Type:** `boolean` · **Default:** `false`

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

**Type:** `number` · **Default:** `MAX_LABEL_FEATURE_DENSITY` · _advanced_

#### slot: showDescriptions

Show feature descriptions

**Type:** `boolean` · **Default:** `true`

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

**Type:** `color` · **Default:** `THEME_DERIVED_COLOR`

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

Feature height preset. `inherit` (the default) follows the session-wide default
for this display type, falling back to `normal`;
`normal`/`compact`/`superCompact` each pin an explicit height (including pinning
`normal` over a compact session default)

**Type:** `stringEnum` (one of `inherit`, `normal`, `compact`, `superCompact`) ·
**Default:** `'inherit'` · _promotable_

```js
{
  type: 'stringEnum',
  model: types.enumeration('displayMode', [
    'inherit',
    'normal',
    'compact',
    'superCompact',
  ]),
  description:
    'Feature height preset. `inherit` (the default) follows the session-wide default for this display type, falling back to `normal`; `normal`/`compact`/`superCompact` each pin an explicit height (including pinning `normal` over a compact session default)',



  defaultValue: 'inherit',
  promotedBase: 'normal',
  promotable: true,
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

**Type:** `stringEnum` (one of `none`, `below`, `overlay`) · **Default:**
`'none'`

#### slot: displayDirectionalChevrons

Display directional chevrons on intron lines to indicate strand direction

**Type:** `boolean` · **Default:** `true`

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

**Type:** `stringArray` · **Default:** `['proteoform_orf']`

#### slot: subParts

subparts for a glyph

**Type:** `string` · **Default:** `'CDS,UTR,five_prime_UTR,three_prime_UTR'`

#### slot: impliedUTRs

imply UTRs from exon/CDS differences on transcript glyphs that carry no explicit
UTR subfeatures

**Type:** `boolean` · **Default:** `true`

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

## Inherited config slots

Slots available on this config via its base configuration(s), shown in full so
this page is self-contained. A slot redeclared by a more specific config is
shown once, at its most specific definition.

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

## Related links

- **State model:** [runtime API](../../models/linearcanvasbasedisplay)
- **Base config:** [BaseLinearDisplay](../baselineardisplay)
