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

_See the **Config slots** section below for all available configuration fields._

## Related links

- **Adapter:** [BedpeAdapter](../bedpeadapter)
- **Adapter:** [StarFusionAdapter](../starfusionadapter)
- **Adapter:** [SplitVcfTabixAdapter](../splitvcftabixadapter)
- **Adapter:** [VcfAdapter](../vcfadapter)
- **Adapter:** [VcfTabixAdapter](../vcftabixadapter)
- **State model:** [runtime API](../../models/chordvariantdisplay)

## Config slots

Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types).

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

**Type:** [`boolean`](/docs/config_guides/slot_types#boolean) · **Default:**
`false` · **Callback args:** `feature`, `track`, `pluginManager`

#### slot: strokeColor

the line color of each arc

**Type:** [`color`](/docs/config_guides/slot_types#color) · **Default:**
`'rgba(255,133,0,0.32)'` · **Callback args:** `feature`

#### slot: strokeColorSelected

the line color of an arc that has been selected

**Type:** [`color`](/docs/config_guides/slot_types#color) · **Default:**
`'black'` · **Callback args:** `feature`

#### slot: strokeColorHover

the line color of an arc that is being hovered over with the mouse

**Type:** [`color`](/docs/config_guides/slot_types#color) · **Default:**
`'#555'` · **Callback args:** `feature`

</details>
