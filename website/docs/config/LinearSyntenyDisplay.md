---
id: linearsyntenydisplay
title: LinearSyntenyDisplay
sidebar_label: Display -> LinearSyntenyDisplay
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `linear-comparative-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LinearSyntenyDisplay/configSchemaF.ts).

## Example usage

A `SyntenyTrack` config to paste into `tracks`. The adapter needs the query
(first) and target (second) assembly names, matched by the track's
`assemblyNames`. See the
[synteny track guide](/docs/config_guides/synteny_track) for all options:

```js
{
  type: 'SyntenyTrack',
  trackId: 'hg38_vs_mm10',
  name: 'hg38 vs mm10',
  assemblyNames: ['hg38', 'mm10'],
  adapter: {
    type: 'PAFAdapter',
    uri: 'https://example.com/hg38_vs_mm10.paf',
    queryAssembly: 'hg38',
    targetAssembly: 'mm10',
  },
}
```

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
- **State model:** [runtime API](../../models/linearsyntenydisplay)

## Config slots

These slots go on a display entry: `"displays": [{ "type": "LinearSyntenyDisplay", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-drawcurves">**drawCurves**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Draw each ribbon as a bezier curve rather than a straight chord. Defaults to off (straight chords). The row is on the VIEW's settings menu (`Curved lines`) — this display curates no track menu of its own — and the checkbox writes this slot on every level of the view, as an init spec's `drawCurves` key does for the tracks it opens |
| <span id="slot-drawlocationmarkers">**drawLocationMarkers**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Continue the query row's scalebar grid down through the ribbons: a tick at each round query coordinate, joined to the coordinate the alignment pairs it with. Defaults to off, through the same settings-menu row and init key as `drawCurves` above |
