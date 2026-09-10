---
id: chordsyntenydisplay
title: ChordSyntenyDisplay
sidebar_label: Display -> ChordSyntenyDisplay
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `circular-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/circular-view/src/ChordSyntenyDisplay/models/configSchema.ts).

## Example usage

The circular-view display for a `SyntenyTrack`: each alignment is a ribbon
between the span it covers on one side and the span its mate covers on the
other. The three color slots are its resting, hovered and selected fills,
and each takes a `jexl:` expression over the `feature` — the default colors
by strand, and anything on the record can drive it instead:

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
      color: "jexl:get(feature,'score')>1000?'rgba(0,0,0,0.4)':'rgba(0,0,0,0.1)'",
    },
  ],
}
```

How deep a ribbon bows toward the center is `bezierRadiusRatio`, a display
state-model property rather than a config slot — a saved session carries it,
a track config drops it.

_See the **Config slots** section below for all available configuration fields._

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

These slots go on a display entry: `"displays": [{ "type": "ChordSyntenyDisplay", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-color">**color**</span><br>[`color`](/docs/config_guides/slot_types#color) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>'jexl:get(feature,'strand')==-1?'rgba(0,0,255,0.25)':'rgba(255,…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>'jexl:get(feature,'strand')==-1?'rgba(0,0,255,0.25)':'rgba(255,0,0,0.25)''</code></pre></dialog></span> | the fill color of each ribbon<br>_callback args:_ `feature` |
| <span id="slot-colorselected">**colorSelected**</span><br>[`color`](/docs/config_guides/slot_types#color) = <code>'rgba(0,0,0,0.6)'</code> | the fill color of a ribbon that has been selected<br>_callback args:_ `feature` |
| <span id="slot-colorhover">**colorHover**</span><br>[`color`](/docs/config_guides/slot_types#color) = <code>'rgba(85,85,85,0.6)'</code> | the fill color of a ribbon that is being hovered over with the mouse<br>_callback args:_ `feature` |
