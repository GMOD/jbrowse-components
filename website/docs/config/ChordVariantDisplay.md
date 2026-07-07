---
id: chordvariantdisplay
title: ChordVariantDisplay
sidebar_label: Display -> ChordVariantDisplay
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the `circular-view`
plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/circular-view/src/ChordVariantDisplay/models/configSchema.ts).

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

| Slot                                             | Type      | Description                                                        |
| ------------------------------------------------ | --------- | ------------------------------------------------------------------ |
| [onChordClick](#slot-onchordclick)               | `boolean` | callback that should be run when a chord in the track is clicked   |
| [strokeColor](#slot-strokecolor)                 | `color`   | the line color of each arc                                         |
| [strokeColorSelected](#slot-strokecolorselected) | `color`   | the line color of an arc that has been selected                    |
| [strokeColorHover](#slot-strokecolorhover)       | `color`   | the line color of an arc that is being hovered over with the mouse |

<details>
<summary>ChordVariantDisplay - Slots</summary>

#### slot: onChordClick

callback that should be run when a chord in the track is clicked

**Type:** `boolean` · **Default:** `false`

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

the line color of each arc

**Type:** `color` · **Default:** `'rgba(255,133,0,0.32)'`

```js
{
  type: 'color',
  description: 'the line color of each arc',
  defaultValue: 'rgba(255,133,0,0.32)',
  contextVariable: ['feature'],
}
```

#### slot: strokeColorSelected

the line color of an arc that has been selected

**Type:** `color` · **Default:** `'black'`

```js
{
  type: 'color',
  description: 'the line color of an arc that has been selected',
  defaultValue: 'black',
  contextVariable: ['feature'],
}
```

#### slot: strokeColorHover

the line color of an arc that is being hovered over with the mouse

**Type:** `color` · **Default:** `'#555'`

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

## Related links

- **Adapter:** [BedpeAdapter](../bedpeadapter)
- **Adapter:** [StarFusionAdapter](../starfusionadapter)
- **Adapter:** [SplitVcfTabixAdapter](../splitvcftabixadapter)
- **Adapter:** [VcfAdapter](../vcfadapter)
- **Adapter:** [VcfTabixAdapter](../vcftabixadapter)
- **State model:** [runtime API](../../models/chordvariantdisplay)
