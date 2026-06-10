---
id: linearcanvasbasedisplay
title: LinearCanvasBaseDisplay
---

Note: this document is automatically generated from configuration objects in
our source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/canvas/src/LinearBasicDisplay/baseConfigSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/LinearCanvasBaseDisplay.md)

## Overview

base config for canvas-based linear feature displays (pileup-style glyphs)

### LinearCanvasBaseDisplay - Slots

#### slot: maxHeight

```js
maxHeight: {
        type: 'number',
        defaultValue: 1200,
        description: 'Maximum height of the display in pixels',
      }
```
#### slot: maxFeatureScreenDensity

```js
maxFeatureScreenDensity: {
        type: 'number',
        defaultValue: 1,
        description:
          'Maximum features per pixel before showing region too large message',
      }
```
#### slot: autoHeight

```js
autoHeight: {
        type: 'boolean',
        defaultValue: false,
        description:
          'Automatically resize the track height to fit all features',
      }
```
#### slot: showLabels

```js
showLabels: {
        type: 'stringEnum',
        model: types.enumeration('showLabels', [...SHOW_LABELS_MODES]),
        defaultValue: 'auto',
        description:
          'Show feature labels: "auto" hides labels at high feature density, "on" always shows, "off" always hides',
      }
```
#### slot: maxLabelFeatureDensity

```js
maxLabelFeatureDensity: {
        type: 'number',
        defaultValue: MAX_LABEL_FEATURE_DENSITY,
        description:
          'In "auto" showLabels mode, hide labels when visible feature density (features/pixel) exceeds this value',
      }
```
#### slot: showDescriptions

```js
showDescriptions: {
        type: 'boolean',
        defaultValue: true,
        description: 'Show feature descriptions',
      }
```
#### slot: color

```js
color: {
        type: 'color',
        description:
          'the main fill color of each feature (a CSS color, or a jexl expression for per-feature coloring)',
        defaultValue: 'goldenrod',
        contextVariable: ['feature'],
      }
```
#### slot: connectorColor

```js
connectorColor: {
        type: 'color',
        description:
          'color of the connecting/intron lines between feature segments (defaults to the theme text color)',
        defaultValue: THEME_DERIVED_COLOR,
        contextVariable: ['feature'],
      }
```
#### slot: utrColor

```js
utrColor: {
        type: 'color',
        description: 'fill color for UTRs on gene/transcript glyphs',
        defaultValue: '#357089',
        contextVariable: ['feature'],
      }
```
#### slot: outlineColor

```js
outlineColor: {
        type: 'color',
        description: 'outline color for features (empty string = no outline)',
        defaultValue: '',
      }
```
#### slot: featureHeight

```js
featureHeight: {
        type: 'number',
        description: 'height in pixels of the main body of each feature',
        defaultValue: 10,
        contextVariable: ['feature'],
      }
```
#### slot: displayMode

```js
displayMode: {
        type: 'stringEnum',
        model: types.enumeration('displayMode', [
          'normal',
          'compact',
          'superCompact',
          'reducedRepresentation',
          'collapse',
        ]),
        description: 'Alternative display modes',
        defaultValue: 'normal',
      }
```
#### slot: geneGlyphMode

```js
geneGlyphMode: {
        type: 'stringEnum',
        model: types.enumeration('geneGlyphMode', [...GENE_GLYPH_MODES]),
        description:
          'Gene glyph display mode: "auto" switches based on zoom level, "all" shows all transcripts, "longestCoding" shows only the longest coding transcript',
        defaultValue: 'auto',
      }
```
#### slot: subfeatureLabels

```js
subfeatureLabels: {
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

```js
displayDirectionalChevrons: {
        type: 'boolean',
        description:
          'Display directional chevrons on intron lines to indicate strand direction',
        defaultValue: true,
      }
```
#### slot: transcriptTypes

```js
transcriptTypes: {
        type: 'stringArray',
        defaultValue: ['mRNA', 'transcript', 'primary_transcript'],
      }
```
#### slot: containerTypes

```js
containerTypes: {
        type: 'stringArray',
        defaultValue: ['proteoform_orf'],
      }
```
#### slot: subParts

```js
subParts: {
        type: 'string',
        description: 'subparts for a glyph',
        defaultValue: 'CDS,UTR,five_prime_UTR,three_prime_UTR',
      }
```
#### slot: impliedUTRs

```js
impliedUTRs: {
        type: 'boolean',
        description: 'imply UTR from the exon and CDS differences',
        defaultValue: false,
      }
```
#### slot: labels

```js
labels: ConfigurationSchema('CanvasFeatureLabels', {
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

## Inherited config slots

Slots available on this config via its base configuration(s), shown in full so this page is self-contained.

### Inherited from [BaseLinearDisplay](../baselineardisplay)

#### slot: maxFeatureScreenDensity

```js
maxFeatureScreenDensity: {
      type: 'number',
      description:
        'maximum features per pixel that is displayed in the view, used if byte size estimates not available',
      defaultValue: 0.3,
    }
```

#### slot: fetchSizeLimit

```js
fetchSizeLimit: {
      type: 'number',
      defaultValue: 1_000_000,
      description:
        "maximum data to attempt to download for a given track, used if adapter doesn't specify one",
    }
```

#### slot: height

```js
height: {
      type: 'number',
      defaultValue: 100,
      description: 'default height for the track',
    }
```

#### slot: mouseover

```js
mouseover: {
      type: 'string',
      description: 'text to display when the cursor hovers over a feature',
      defaultValue: `jexl:mouseoverExtraInformation||get(feature,'_mouseOver')||get(feature,'name')||get(feature,'id')`,
      contextVariable: ['feature', 'mouseoverExtraInformation'],
    }
```

#### slot: jexlFilters

config jexlFilters are deferred evaluated so they are prepended with
jexl at runtime rather than being stored with jexl in the config

```js
jexlFilters: {
      type: 'stringArray',
      description:
        'default set of jexl filters to apply to a track. note: these do not use the jexl prefix because they have a deferred evaluation system',
      defaultValue: [],
    }
```

### LinearCanvasBaseDisplay - Derives from

- [BaseLinearDisplay](../baselineardisplay)

```js
baseConfiguration: baseLinearDisplayConfigSchema
```
