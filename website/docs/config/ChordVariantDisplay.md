---
id: chordvariantdisplay
title: ChordVariantDisplay
description: "Draws the structural variants of a VariantTrack in a CircularView, each translocation as a chord across the circle."
sidebar_label: Display -> ChordVariantDisplay
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `circular-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/circular-view/src/ChordVariantDisplay/models/configSchema.ts).

Draws the structural variants of a `VariantTrack` in a `CircularView`, each
translocation as a chord across the circle.

## Example usage

The circular-view display for a `VariantTrack` of structural variants;
translocations are drawn as chords across the circle. `encoding.color` is
the chord's resting color, a constant or a field of the record with a key; a
hovered chord darkens it and a selected one takes the theme's highlight:

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
      encoding: { color: 'svType', opacity: 0.45 },
    },
  ],
}
```

## Related links

- **Adapter:** [BedpeAdapter](../bedpeadapter)
- **Adapter:** [SplitVcfTabixAdapter](../splitvcftabixadapter)
- **Adapter:** [StarFusionAdapter](../starfusionadapter)
- **Adapter:** [VcfAdapter](../vcfadapter)
- **Adapter:** [VcfTabixAdapter](../vcftabixadapter)
- **State model:** [runtime API](../../models/chordvariantdisplay)

## Color channels

<!-- prettier-ignore -->
| Setting | Page | `scale.type` | Preset fields |
| --- | --- | --- | --- |
| `encoding.color` | [](/docs/config/chordcolor#preset-fields) | ordinal, threshold | `strand`, `svType`, `impact` |

## Config slots

Display slots go on a display entry: `"displays": [{ "type": "ChordVariantDisplay", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-mark">**mark**</span><br>[ChordMark](../chordmark) | How far each chord curves toward the center, a [](/docs/config/chordmark) object |
| <span id="slot-onchordclick">**onChordClick**</span><br>[`maybeString`](/docs/config_guides/slot_types#the-maybe-types) | a jexl callback run when a chord is clicked, in place of opening the record's details; unset opens the details<br>_callback args:_ `feature`, `track` |
| <span id="slot-encoding">**encoding**</span><br>[ChordEncoding](../chordencoding) | The channels each resting chord paints through: `encoding.color`, its line color, and `encoding.opacity`, its alpha. |

## Retired keys

An older config may still write these. Each loads without an error, and `jbrowse validate` reports it as stale.

<!-- prettier-ignore -->
| Key | On load |
| --- | --- |
| `strokeColor` | moved into a current slot |
| `strokeColorSelected` | ignored |
| `strokeColorHover` | ignored |
| `colorSelected` | ignored |
| `colorHover` | ignored |
| `renderer` | moved into a current slot |
