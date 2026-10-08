---
id: chordvariantdisplay
title: ChordVariantDisplay
description: "Configuration slots of ChordVariantDisplay."
sidebar_label: Display -> ChordVariantDisplay
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `circular-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/circular-view/src/ChordVariantDisplay/models/configSchema.ts).

## Example usage

The circular-view display for a `VariantTrack` of structural variants;
translocations are drawn as chords across the circle. `color` is the
chord's resting color, a constant or a field of the record with a key, and
`colorHover` and `colorSelected` its hovered and selected ones:

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
      color: { field: 'svType' },
      opacity: 0.45,
      colorHover: '#555',
    },
  ],
}
```

_See the **Config slots** section below for all available configuration fields._

## Related links

- **Adapter:** [BedpeAdapter](../bedpeadapter)
- **Adapter:** [SplitVcfTabixAdapter](../splitvcftabixadapter)
- **Adapter:** [StarFusionAdapter](../starfusionadapter)
- **Adapter:** [VcfAdapter](../vcfadapter)
- **Adapter:** [VcfTabixAdapter](../vcftabixadapter)
- **State model:** [runtime API](../../models/chordvariantdisplay)

## Config slots

These slots go on a display entry: `"displays": [{ "type": "ChordVariantDisplay", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-onchordclick">**onChordClick**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | a jexl callback run when a chord is clicked, in place of opening the record's details<br>_callback args:_ `feature`, `track`, `pluginManager` |
| <span id="slot-color">**color**</span><br>[ChordColor](../chordcolor) | The line color of each resting chord: a CSS color or `jexl:` callback, or a field of the record, `svType` say, whose values each take a color with a key on the circle. |
| <span id="slot-opacity">**opacity**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | the alpha every resting chord draws at, over its color's own |
| <span id="slot-colorselected">**colorSelected**</span><br>[`color`](/docs/config_guides/slot_types#color) = <code>'black'</code> | the line color of a chord that has been selected<br>_callback args:_ `feature` |
| <span id="slot-colorhover">**colorHover**</span><br>[`color`](/docs/config_guides/slot_types#color) = <code>'#555'</code> | the line color of a chord that is being hovered over with the mouse<br>_callback args:_ `feature` |
| <span id="slot-bezierradiusratio">**bezierRadiusRatio**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0.1</code> | how far from the center a chord across the circle passes, as a fraction of the circle's radius: 0 draws it straight through the center, and a larger value keeps every chord nearer the rim. A shorter chord bows less, in proportion to its span |
