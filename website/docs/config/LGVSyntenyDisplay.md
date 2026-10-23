---
id: lgvsyntenydisplay
title: LGVSyntenyDisplay
description: "Draws a SyntenyTrack's alignments in a linear genome view, stacked and colored the way an alignments display draws reads."
sidebar_label: Display -> LGVSyntenyDisplay
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `linear-comparative-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LGVSyntenyDisplay/configSchemaF.ts).

Draws a `SyntenyTrack`'s alignments in a linear genome view, stacked and
colored the way an alignments display draws reads. It has the alignments
display's bands and settings but the sashimi band, the `junction` filter
fields, `pileup.bases` and `modifications`: a synteny block has no introns,
basecaller tags or qualities.

## Example usage

Shows a `SyntenyTrack`'s alignments in a plain linear view (rather than the
two-row synteny view). Same track config as a synteny track — just pick this
display type:

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
  displays: [
    {
      type: 'LGVSyntenyDisplay',
      displayId: 'hg38_vs_mm10-LGVSyntenyDisplay',
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
- **State model:** [runtime API](../../models/lgvsyntenydisplay)
- **Base config:** [BaseLinearAlignmentsDisplay](../baselinearalignmentsdisplay)

## Config slots

Display slots go on a display entry: `"displays": [{ "type": "LGVSyntenyDisplay", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-data">**data**</span><br>[SyntenyData](../syntenydata) | What the fetch reads, a [](/docs/config/syntenydata) object: `resolution` picks a tiered file's stored tier. |
| <span id="slot-encoding">**encoding**</span><br>[LGVSyntenyEncoding](../lgvsyntenyencoding) | The alignments displays' `encoding` with `color` painting `strand` while it names neither a field nor a constant, where the base display paints the plain fill. |
| <span id="slot-coverage">**coverage**</span><br>[LGVSyntenyCoverage](../lgvsyntenycoverage) | The alignments displays' `coverage` band with `show` defaulting to off: a synteny track hides the coverage histogram unless asked. |
| <span id="slot-collapsesections">**collapseSections**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | One row per facet section by default: an all-vs-all track faceted by mate assembly draws each mate genome as a single band, with repeat depth shown as darker shading rather than as extra rows. Overrides the base alignments display's `collapseSections` default of `false`, where a section is a read category and the stack itself is the information. |
| <span id="slot-sort">**sort**</span><br>[LGVSyntenySort](../lgvsyntenysort) | The row order, with `length` the default so big syntenic blocks cluster at the top; a string is the `field`. |
| <span class="slot-group">Inherited from [BaseLinearAlignmentsDisplay](../baselinearalignmentsdisplay)</span> | <span class="slot-group-count">9 slots</span> |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>250</code> | Starting height in pixels for the bands together; heightMode decides what a pileup deeper than this does |
| <span id="slot-unit">**unit**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (read, chain) = <code>'read'</code> | The unit one row draws: a read, or a chain of a read, its mate and its split segments (the "View as pairs" menu row) |
| <span id="slot-filter">**filter**</span><br>[FieldPredicate](../fieldpredicate) | The alignments drawn, a list of [](/docs/config/fieldpredicate) entries every one of which must hold. The read fields run before every band, so coverage counts only the reads they pass: `flags.UNMAP` and the other samtools flag names, `mapq` (MAPQ 255, none reported, passes a floor), `name`, `tags.HP` and any other tag, and the read categories `spliced`, `svSignal`, `alone` and `split`. `junction.reads`, `junction.canonical` (a split junction reads no motif and counts as canonical, so `equal: false` hides it), `junction.class` (`splice` for an N gap, or a split read's `deletion`, `duplication` or `inversion`) and `junction.source` (`gap` or `split`) test the sashimi junctions, and `connection.interchrom`, `connection.offscreen` and `breakpoint.reads` the connections the arcs, the read cloud and the connectors draw.<br><br>A written list merges with the defaults by field: unmapped, QC-failed and duplicate reads out (`flags.UNMAP`, `flags.QCFAIL` and `flags.DUP` `equal: false`), and `junction.reads` and `breakpoint.reads` at least 2. An entry replaces its own field's defaults, and an entry naming a field with no test, such as `{ field: "flags.DUP" }`, only removes them. |
| <span id="slot-facet">**facet**</span><br>[SectionFacet](../sectionfacet) | In-track stacked grouping, one labelled section per value: a read dimension (`strand`, `firstOfPairStrand`, `pairOrientation`, `pairing`, `split`, `spliced`, `svSignal`, `mapq`, `mateRefName`, `mateAssembly`), a tag (`tags.HP`), or any other field. `{ field: "tags.HP", sort: ["2", "1"] }` stacks the listed values first. |
| <span id="slot-legend">**legend**</span><br>[HiddenLegend](../hiddenlegend) | The display's key: `show`, off by default. |
| <span id="slot-pileup">**pileup**</span><br>[Pileup](../pileup) | The stacked reads: `show`, `mark.height` (default 7), `maxLayoutHeight`, and the parts drawn on each read. |
| <span id="slot-readconnections">**readConnections**</span><br>[ReadConnections](../readconnections) | The connections between mates and split segments: `show` (default off), `mark` (`link`, the arcs, or `rule`, the read cloud), `height`, `placement`, `encoding` (`color` and `strokeWidth`) and `ordinaryPairs`; the `connection` and `breakpoint` filter fields filter the connections drawn. |
| <span id="slot-heightmode">**heightMode**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (fixed, grow, fit) = <code>'fixed'</code> | Track-sizing strategy — how the track responds when there are more reads than fit (the menu sets `fit` from "Read height → Fit to track height" and `grow` from "Advanced → Autogrow track height"). `fixed` (the default) keeps `pileup.mark.height` and scrolls; `grow` expands the track to show every read at that height; `fit` squeezes reads so every uncollapsed section fills the display without scrolling |
| <span id="slot-growmaxheight">**growMaxHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>800</code> | Ceiling in pixels for the "autogrow track height" sizing mode; a pileup deeper than this grows to the ceiling and scrolls the rest. Does not apply to the fixed or fit modes, and does not limit how much is laid out (see pileup.maxLayoutHeight)<br>_advanced_ |
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
| `jexlFilters` | ignored |
| `colorBy` | moved into a current slot |
| `pileupDisplay` | moved into a current slot |
| `snpCoverageDisplay` | moved into a current slot |
| `defaultRendering` | ignored |
| `colorScheme` | ignored |
| `scales` | moved into a current slot |
| `scaleType` | moved into a current slot |
| `autoscale` | moved into a current slot |
| `minScore` | moved into a current slot |
| `maxScore` | moved into a current slot |
| `numStdDev` | ignored |
| `inverted` | ignored |
| `multiTicks` | ignored |
| `jitter` | ignored |
| `lineWidth` | moved into a current slot |
| `featureHeight` | moved into a current slot |
| `maxHeight` | moved into a current slot |
| `hideSmallIndels` | ignored |
| `hideMismatches` | moved into a current slot |
| `mismatchAlpha` | moved into a current slot |
| `hideLargeIndels` | ignored |
| `minSubfeatureWidth` | ignored |
| `flipStrandLongReadChains` | ignored |
| `renderers` | moved into a current slot |
