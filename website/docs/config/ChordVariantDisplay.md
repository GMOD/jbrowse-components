---
id: chordvariantdisplay
title: ChordVariantDisplay
sidebar_label: Display -> ChordVariantDisplay
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/circular-view/src/ChordVariantDisplay/models/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/ChordVariantDisplay.md)

## Example usage

The circular-view display for a `VariantTrack` of structural variants;
translocations are drawn as chords across the circle. `bezierRadiusRatio`
controls how far the chords bow toward the center:

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
      type: 'ChordVariantDisplay',
      displayId: 'sv-ChordVariantDisplay',
      bezierRadiusRatio: 0.1,
    },
  ],
}
```

_See the **Slots** section below for all available configuration fields._

## Overview

<details open>
<summary>ChordVariantDisplay - Slots</summary>

#### slot: onChordClick

```js
{
  type: 'boolean',
  description:
    'callback that should be run when a chord in the track is clicked',
  defaultValue: false,
  contextVariable: ['feature', 'track', 'pluginManager'],
}
```

#### slot: strokeColor

```js
{
  type: 'color',
  description: 'the line color of each arc',
  defaultValue: 'rgba(255,133,0,0.32)',
  contextVariable: ['feature'],
}
```

#### slot: strokeColorSelected

```js
{
  type: 'color',
  description: 'the line color of an arc that has been selected',
  defaultValue: 'black',
  contextVariable: ['feature'],
}
```

#### slot: strokeColorHover

```js
{
  type: 'color',
  description:
    'the line color of an arc that is being hovered over with the mouse',
  defaultValue: '#555',
  contextVariable: ['feature'],
}
```

</details>
