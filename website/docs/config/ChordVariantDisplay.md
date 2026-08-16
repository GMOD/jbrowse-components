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
translocations are drawn as chords across the circle. `bezierRadiusRatio` sets
the deepest bow toward the center, which a chord straight across the circle
reaches; a shorter-range one bows in proportion to its span:

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

- **Adapter:** [SplitVcfTabixAdapter](../splitvcftabixadapter)
- **Adapter:** [VcfAdapter](../vcfadapter)
- **Adapter:** [VcfTabixAdapter](../vcftabixadapter)
- **Adapter:** [BedpeAdapter](../bedpeadapter)
- **Adapter:** [StarFusionAdapter](../starfusionadapter)
- **State model:** [runtime API](../../models/chordvariantdisplay)

## Config slots

These slots go on a display entry:
`"displays": [{ "type": "ChordVariantDisplay", ... }]`, or in the track's
[`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this
is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained
in the [config slot types reference](/docs/config_guides/slot_types). Slots a
base configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-onchordclick">**onChordClick**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | callback that should be run when a chord in the track is clicked<br>_callback args:_ `feature`, `track`, `pluginManager` |
| <span id="slot-strokecolor">**strokeColor**</span><br>[`color`](/docs/config_guides/slot_types#color) = <code>'rgba(255,133,0,0.32)'</code> | the line color of each arc<br>_callback args:_ `feature` |
| <span id="slot-strokecolorselected">**strokeColorSelected**</span><br>[`color`](/docs/config_guides/slot_types#color) = <code>'black'</code> | the line color of an arc that has been selected<br>_callback args:_ `feature` |
| <span id="slot-strokecolorhover">**strokeColorHover**</span><br>[`color`](/docs/config_guides/slot_types#color) = <code>'#555'</code> | the line color of an arc that is being hovered over with the mouse<br>_callback args:_ `feature` |
