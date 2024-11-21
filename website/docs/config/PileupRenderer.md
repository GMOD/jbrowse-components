---
id: pileuprenderer
title: PileupRenderer
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/alignments/src/PileupRenderer/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/PileupRenderer/configSchema.ts)

### PileupRenderer - Slots

#### slot: color

default magenta here is used to detect the user has not customized this

```js
color: {
      type: 'color',
      description: 'the color of each feature in a pileup alignment',
      defaultValue: '#f0f',
      contextVariable: ['feature'],
    }
```

#### slot: orientationType

```js
orientationType: {
      type: 'stringEnum',
      model: types.enumeration('orientationType', ['fr', 'rf', 'ff']),
      defaultValue: 'fr',
      description:
        'read sequencer orientation. fr is normal "reads pointing at each other ---> <--- while some other sequencers can use other options',
    }
```

#### slot: displayMode

```js
displayMode: {
      type: 'stringEnum',
      model: types.enumeration('displayMode', [
        'normal',
        'compact',
        'collapse',
      ]),
      description: 'Alternative display modes',
      defaultValue: 'normal',
    }
```

#### slot: minSubfeatureWidth

```js
minSubfeatureWidth: {
      type: 'number',
      description:
        'the minimum width in px for a pileup mismatch feature. use for increasing/decreasing mismatch marker widths when zoomed out, e.g. 0 or 1',
      defaultValue: 1,
    }
```

#### slot: maxHeight

```js
maxHeight: {
      type: 'integer',
      description: 'the maximum height to be used in a pileup rendering',
      defaultValue: 1200,
    }
```

#### slot: maxClippingSize

```js
maxClippingSize: {
      type: 'integer',
      description: 'the max clip size to be used in a pileup rendering',
      defaultValue: 10000,
    }
```

#### slot: height

```js
height: {
      type: 'number',
      description: 'the height of each feature in a pileup alignment',
      defaultValue: 7,
      contextVariable: ['feature'],
    }
```

#### slot: noSpacing

```js
noSpacing: {
      type: 'boolean',
      description: 'remove spacing between features',
      defaultValue: false,
    }
```

#### slot: largeInsertionIndicatorScale

```js
largeInsertionIndicatorScale: {
      type: 'number',
      description:
        'scale at which to draw the large insertion indicators (bp/pixel)',
      defaultValue: 10,
    }
```

#### slot: mismatchAlpha

```js
mismatchAlpha: {
      type: 'boolean',
      defaultValue: false,
      description: 'Fade low quality mismatches',
    }
```
