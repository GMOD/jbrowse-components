---
id: multiwaysyntenydisplay
title: MultiWaySyntenyDisplay
description: "Draws a multi-genome SyntenyTrack in a linear genome view as one lane per assembly, with ribbons joining each gene's placements in adjacent lanes."
sidebar_label: Display -> MultiWaySyntenyDisplay
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `linear-comparative-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/configSchema.ts).

Draws a multi-genome `SyntenyTrack` in a linear genome view as one lane per
assembly, with ribbons joining each gene's placements in adjacent lanes.

## Example usage

A multi-genome `SyntenyTrack` listing this display first opens as lanes in
a linear genome view, each lane in its own genome's coordinates, with
ribbons connecting each gene's placements between adjacent lanes. The track
below reads an ortholog table;
[three or more genomes](/docs/config_guides/synteny_track#three-or-more-genomes)
configures alignment files too:

```js
{
  type: 'SyntenyTrack',
  trackId: 'grape_peach_cacao',
  name: 'grape/peach/cacao orthologs',
  assemblyNames: ['grape', 'peach', 'cacao'],
  adapter: {
    type: 'MCScanBlocksAdapter',
    uri: 'grape.blocks',
    blockAssemblies: ['grape', 'peach', 'cacao'],
    bedLocations: [
      { uri: 'grape.bed' },
      { uri: 'peach.bed' },
      { uri: 'cacao.bed' },
    ],
  },
  displays: [
    {
      type: 'MultiWaySyntenyDisplay',
      displayId: 'grape_peach_cacao-MultiWaySyntenyDisplay',
    },
  ],
}
```

The same display with a curated lane order, genes colored by ortholog
cluster, and ribbons colored by percent identity:

```js
{
  type: 'SyntenyTrack',
  trackId: 'primate_synteny',
  name: 'Primate synteny',
  assemblyNames: ['hg38', 'panTro6', 'gorGor6', 'ponAbe3'],
  adapter: {
    type: 'MCScanBlocksAdapter',
    uri: 'hg38.blocks',
    blockAssemblies: ['hg38', 'panTro6', 'gorGor6', 'ponAbe3'],
    bedLocations: [
      { uri: 'hg38.bed' },
      { uri: 'panTro6.bed' },
      { uri: 'gorGor6.bed' },
      { uri: 'ponAbe3.bed' },
    ],
  },
  displays: [
    {
      type: 'MultiWaySyntenyDisplay',
      displayId: 'primate_synteny-MultiWaySyntenyDisplay',
      rows: { sort: ['panTro6', 'gorGor6', 'ponAbe3'] },
      encoding: { color: 'cluster' },
      ribbons: { encoding: { color: 'identity' } },
    },
  ],
}
```

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
- **State model:** [runtime API](../../models/multiwaysyntenydisplay)
- **Base config:** [BaseLinearDisplay](../baselineardisplay)

## Color channels

<!-- prettier-ignore -->
| Setting | Page | `scale.type` | Preset fields |
| --- | --- | --- | --- |
| `encoding.color` | [](/docs/config/multiwaygenecolor#preset-fields) | ordinal, threshold, linear, log | `strand`, `svType`, `impact`, `score` |
| `ribbons.encoding.color` | [](/docs/config/ribboncolor#preset-fields) | linear, threshold, ordinal | `mapq`, `identity`, `dnds`, `syntenicDepth` |
| `laneLayers.marks.encoding.color` | [](/docs/config/markcolor#preset-fields) | ordinal, linear, log, symlog, threshold, identity | `strand`, `svType`, `impact`, `score` |

## Config slots

Display slots go on a display entry: `"displays": [{ "type": "MultiWaySyntenyDisplay", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-encoding">**encoding**</span><br>[MultiWayGeneEncoding](../multiwaygeneencoding) | The channels the gene glyphs paint through: `encoding.color`, their fill. |
| <span id="slot-utrs">**utrs**</span><br>[FeatureUtrs](../featureutrs) | The gene glyphs' UTR boxes, a [](/docs/config/featureutrs) object, as on the canvas gene track. Unset, a UTR takes its gene's fill, and the contrasting UTR blue where nothing sets one. |
| <span id="slot-data">**data**</span><br>[SyntenyData](../syntenydata) | What the fetch reads, a [](/docs/config/syntenydata) object: `resolution` picks a tiered file's stored tier. |
| <span id="slot-rows">**rows**</span><br>[LaneRows](../lanerows) | The lane order and the lanes drawn, which the Lanes menu, a header drag and the lane picker write. |
| <span id="slot-ribbons">**ribbons**</span><br>[MultiWayRibbons](../multiwayribbons) | The bands joining each gene's placements in adjacent lanes: `ribbons.encoding.color` paints them and `ribbons.mark.interpolate` curves their sides. |
| <span id="slot-lanegenetracks">**laneGeneTracks**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | the trackId of the gene track each lane draws, one per genome, or an entry spelling `{assembly}`, such as `{assembly}-ncbiRefSeq`, naming in each lane the track whose id has that lane's genome, or any of its aliases, written there. Plain ids outrank `{assembly}` entries, and an earlier entry outranks a later one. A lane whose genome no entry names draws the session's best-ranked annotation track for it, which on a config holding several gene sets per genome is whichever is declared first, and never a BED track that sets `disableGeneHeuristic` |
| <span id="slot-legend">**legend**</span><br>[Legend](../legend) | The color key: the anchor lane's drawn gene colors, and what `ribbons.encoding.color` paints — the strand colors, the identity ramp, or a column's labels. Derived from what is on screen, so an `encoding.color` resolving to one color and a ribbon scale painting nothing key nothing. |
| <span id="slot-axis">**axis**</span><br>[MultiWayLaneAxis sub-schema](#slot-axisshow) | Each lane's coordinate ticks, at one interval shared by every lane: equal spacing between two lanes means equal bp-per-pixel, and a lane whose ticks crowd together is zoomed out. |
| <span id="slot-axisshow">**axis.show**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | draw each lane's coordinate ticks; with this off, the header's span and multiple are the only scale shown |
| <span id="slot-labels">**labels**</span><br>[MultiWayLabels sub-schema](#slot-labelsname) | The names the display prints: each gene's, in a row under the genes, and each lane's genome. |
| <span id="slot-labelsname">**labels.name**</span><br>[FeatureNameLabel](../featurenamelabel) | Each gene's name, a [](/docs/config/featurenamelabel) object, dropped where its neighbours leave it no room. |
| <span id="slot-labelslanes">**labels.lanes**</span><br>[MultiWayLaneLabels sub-schema](#slot-labelslanesplacement) | Each lane's genome name. |
| <span id="slot-labelslanesplacement">**labels.lanes.placement**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (above, overlay) = <code>'above'</code> | `above` prints each genome's name and span on a line over its genes; `overlay` prints the name alone over the left end of its gene row, which fits 12 px more per lane |
| <span id="slot-lanelayers">**laneLayers**</span><br>[MultiWayLaneLayer](../multiwaylanelayer) | Rows of data every lane draws above its genes, each from that genome's own track: a GC or conservation bigWig per genome as bars, say |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>240</code> | default height for the track |
| <span class="slot-group">Inherited from [BaseLinearDisplay](../baselineardisplay)</span> | <span class="slot-group-count">2 slots</span> |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1000000</code> | bytes a region may fetch before the display asks first; an adapter that sets its own limit overrides this<br>_advanced_ |
| <span id="slot-forceload">**forceLoad**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Declarative equivalent of the "Force load" button on the "too much data" banner: when true the display always renders, however large the region or dense the features. Off by default (the gate guards against huge downloads). Set it on a view no one can interact with — an embedded / notebook view, or a screenshot — where the region is known and you want it drawn without a click.<br>_advanced_ |

## Retired keys

An older config may still write these. Each loads without an error, and `jbrowse validate` reports it as stale.

<!-- prettier-ignore -->
| Key | On load |
| --- | --- |
| `maxFeatureScreenDensity` | ignored |
| `maxDisplayedBpPerPx` | ignored |
| `mouseover` | ignored |
| `jexlFilters` | moved into a current slot |
