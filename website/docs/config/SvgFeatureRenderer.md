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
      contextVariable: ['feature'],
      defaultValue: 'goldenrod',
      description: 'the main color of each feature',
      type: 'color',
    }
```

#### slot: color2

```js
color2: {
      contextVariable: ['feature'],
      defaultValue: '#f0f',
      description:
        'the secondary color of each feature, used for connecting lines, etc',
      type: 'color',
    }
```

#### slot: color3

```js
color3: {
      contextVariable: ['feature'],
      defaultValue: '#357089',
      description:
        'the tertiary color of each feature, often used for contrasting fills, like on UTRs',
      type: 'color',
    }
```

#### slot: displayMode

```js
displayMode: {
      defaultValue: 'normal',
      description: 'Alternative display modes',
      model: types.enumeration('displayMode', [
        'normal',
        'compact',
        'reducedRepresentation',
        'collapse',
      ]),
      type: 'stringEnum',
    }
```

#### slot: height

```js
height: {
      contextVariable: ['feature'],
      defaultValue: 10,
      description: 'height in pixels of the main body of each feature',
      type: 'number',
    }
```

#### slot: impliedUTRs

```js
impliedUTRs: {
      defaultValue: false,
      description: 'imply UTR from the exon and CDS differences',
      type: 'boolean',
    }
```

#### slot: labels.description

```js
description: {
        contextVariable: ['feature'],
        defaultValue: `jexl:get(feature,'note') || get(feature,'description')`,
        description: 'the text description to show, if space is available',
        type: 'string',
      }
```

#### slot: labels.descriptionColor

```js
descriptionColor: {
        contextVariable: ['feature'],
        defaultValue: 'blue',
        description: 'the color of the description, if shown',
        type: 'color',
      }
```

#### slot: labels.fontSize

```js
fontSize: {
        contextVariable: ['feature'],
        defaultValue: 12,
        description:
          'height in pixels of the text to use for names and descriptions',
        type: 'number',
      }
```

#### slot: labels.name

```js
name: {
        contextVariable: ['feature'],
        defaultValue: `jexl:get(feature,'name') || get(feature,'id')`,
        description:
          'the primary name of the feature to show, if space is available',
        type: 'string',
      }
```

#### slot: labels.nameColor

```js
nameColor: {
        contextVariable: ['feature'],
        defaultValue: '#f0f',
        description: 'the color of the name label, if shown',
        type: 'color',
      }
```

#### slot: maxFeatureGlyphExpansion

```js
maxFeatureGlyphExpansion: {
      defaultValue: 500,
      description:
        "maximum number of pixels on each side of a feature's bounding coordinates that a glyph is allowed to use",
      type: 'number',
    }
```

#### slot: maxHeight

```js
maxHeight: {
      defaultValue: 1200,
      description: 'the maximum height to be used in a svg rendering',
      type: 'integer',
    }
```

#### slot: outline

```js
outline: {
      contextVariable: ['feature'],
      defaultValue: '',
      description: 'the outline for features',
      type: 'color',
    }
```

#### slot: showDescriptions

```js
showDescriptions: {
      defaultValue: true,
      type: 'boolean',
    }
```

#### slot: showLabels

```js
showLabels: {
      defaultValue: true,
      type: 'boolean',
    }
```

#### slot: subParts

```js
subParts: {
      defaultValue: 'CDS,UTR,five_prime_UTR,three_prime_UTR',
      description: 'subparts for a glyph',
      type: 'string',
    }
```
