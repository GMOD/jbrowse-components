---
id: chordsyntenydisplay
title: ChordSyntenyDisplay
description: "Draws a SyntenyTrack in a CircularView, with a ribbon joining the two spans of each alignment."
sidebar_label: Display -> ChordSyntenyDisplay
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `circular-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/circular-view/src/ChordSyntenyDisplay/models/configSchema.ts).

## Example usage

The circular-view display for a `SyntenyTrack`: each alignment is a ribbon
between the span it covers on one side and the span its mate covers on the
other. The circular view's `color`, `alpha` and `minAlignmentLength` set the ribbon colors, as in
the linear synteny view; these slots are the hovered and selected fills:

```js
{
  type: 'SyntenyTrack',
  trackId: 'volvox_self',
  name: 'Volvox self-alignment',
  assemblyNames: ['volvox', 'volvox'],
  adapter: {
    type: 'PAFAdapter',
    uri: 'https://example.com/volvox_self.paf',
    queryAssembly: 'volvox',
    targetAssembly: 'volvox',
  },
  displays: [
    {
      type: 'ChordSyntenyDisplay',
      displayId: 'volvox_self-ChordSyntenyDisplay',
      colorHover: 'rgba(0,0,0,0.5)',
    },
  ],
}
```

Draws a `SyntenyTrack` in a `CircularView`, with a ribbon joining the two
spans of each alignment.

## Related links

- **Adapter:** [BlastTabularAdapter](../blasttabularadapter)
- **Adapter:** [ChainAdapter](../chainadapter)
- **Adapter:** [DeltaAdapter](../deltaadapter)
- **Adapter:** [MashMapAdapter](../mashmapadapter)
- **Adapter:** [MCScanAnchorsAdapter](../mcscananchorsadapter)
- **Adapter:** [MCScanBlocksAdapter](../mcscanblocksadapter)
- **Adapter:** [MCScanSimpleAnchorsAdapter](../mcscansimpleanchorsadapter)
- **Adapter:** [MultiGenomeIndexedPAFAdapter](../multigenomeindexedpafadapter)
- **Adapter:** [MultiGenomePAFAdapter](../multigenomepafadapter)
- **Adapter:** [MultiPairwiseSyntenyAdapter](../multipairwisesyntenyadapter)
- **Adapter:** [PAFAdapter](../pafadapter)
- **Adapter:** [PairwiseIndexedPAFAdapter](../pairwiseindexedpafadapter)
- **State model:** [runtime API](../../models/chordsyntenydisplay)

## Config slots

Display slots go on a display entry: `"displays": [{ "type": "ChordSyntenyDisplay", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-colorselected">**colorSelected**</span><br>[`color`](/docs/config_guides/slot_types#color) = <code>'rgba(0,0,0,0.6)'</code> | the fill color of a ribbon that has been selected<br>_callback args:_ `feature` |
| <span id="slot-colorhover">**colorHover**</span><br>[`color`](/docs/config_guides/slot_types#color) = <code>'rgba(85,85,85,0.6)'</code> | the fill color of a ribbon that is being hovered over with the mouse<br>_callback args:_ `feature` |
| <span id="slot-bezierradiusratio">**bezierRadiusRatio**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0.1</code> | a chord's distance from the center at its closest, as a fraction of the circle's radius: 0 draws it straight through the center, and a larger value keeps every chord nearer the rim. A shorter chord bows less, in proportion to its span |
