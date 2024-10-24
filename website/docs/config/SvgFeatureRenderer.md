---
id: svgfeaturerenderer
title: SvgFeatureRenderer
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/svg/src/SvgFeatureRenderer/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/svg/src/SvgFeatureRenderer/configSchema.ts)

### SvgFeatureRenderer - Slots

#### slot: color1

```js
color1: {
      type: 'color',
      description: 'the main color of each feature',
      defaultValue: 'goldenrod',
      contextVariable: ['feature'],
    }
```

#### slot: color2

```js
color2: {
      type: 'color',
      description:
        'the secondary color of each feature, used for connecting lines, etc',
      defaultValue: '#f0f',
      contextVariable: ['feature'],
    }
```

#### slot: color3

```js
color3: {
      type: 'color',
      description:
        'the tertiary color of each feature, often used for contrasting fills, like on UTRs',
      defaultValue: '#357089',
      contextVariable: ['feature'],
    }
```

#### slot: outline

```js
outline: {
      type: 'color',
      description: 'the outline for features',
      defaultValue: '',
      contextVariable: ['feature'],
    }
```

#### slot: height

```js
height: {
      type: 'number',
      description: 'height in pixels of the main body of each feature',
      defaultValue: 10,
      contextVariable: ['feature'],
    }
```

#### slot: showLabels

```js
showLabels: {
      type: 'boolean',
      defaultValue: true,
    }
```

#### slot: showDescriptions

```js
showDescriptions: {
      type: 'boolean',
      defaultValue: true,
    }
```

#### slot: labels.name

```js
name: {
        type: 'string',
        description:
          'the primary name of the feature to show, if space is available',
        defaultValue: `jexl:get(feature,'name') || get(feature,'id')`,
        contextVariable: ['feature'],
      }
```

#### slot: labels.nameColor

```js
nameColor: {
        type: 'color',
        description: 'the color of the name label, if shown',
        defaultValue: '#f0f',
        contextVariable: ['feature'],
      }
```

#### slot: labels.description

```js
description: {
        type: 'string',
        description: 'the text description to show, if space is available',
        defaultValue: `jexl:get(feature,'note') || get(feature,'description')`,
        contextVariable: ['feature'],
      }
```

#### slot: labels.descriptionColor

```js
descriptionColor: {
        type: 'color',
        description: 'the color of the description, if shown',
        defaultValue: 'blue',
        contextVariable: ['feature'],
      }
```

#### slot: labels.fontSize

```js
fontSize: {
        type: 'number',
        description:
          'height in pixels of the text to use for names and descriptions',
        defaultValue: 12,
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
        'reducedRepresentation',
        'collapse',
      ]),
      description: 'Alternative display modes',
      defaultValue: 'normal',
    }
```

#### slot: maxFeatureGlyphExpansion

```js
maxFeatureGlyphExpansion: {
      type: 'number',
      description:
        "maximum number of pixels on each side of a feature's bounding coordinates that a glyph is allowed to use",
      defaultValue: 500,
    }
```

#### slot: maxHeight

```js
maxHeight: {
      type: 'integer',
      description: 'the maximum height to be used in a svg rendering',
      defaultValue: 1200,
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
