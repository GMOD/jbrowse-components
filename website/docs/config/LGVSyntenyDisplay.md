---
id: lgvsyntenydisplay
title: LGVSyntenyDisplay
description: "Draws a SyntenyTrack's alignments in a linear genome view, stacked and colored the way an alignments display draws reads."
sidebar_label: Display -> LGVSyntenyDisplay
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `linear-comparative-view` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LGVSyntenyDisplay/configSchemaF.ts).

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

Draws a `SyntenyTrack`'s alignments in a linear genome view, stacked and
colored the way an alignments display draws reads.

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
- **Base config:** [LinearAlignmentsDisplay](../linearalignmentsdisplay)

## Config slots

These slots go on a display entry: `"displays": [{ "type": "LGVSyntenyDisplay", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-color">**color**</span><br>[LGVSyntenyColor](../lgvsyntenycolor) | The alignments displays' `color` object with `field` defaulting to `strand`, where the base display paints the plain fill. |
| <span id="slot-coverage">**coverage**</span><br>[LGVSyntenyCoverage](../lgvsyntenycoverage) | The alignments displays' `coverage` band with `show` defaulting to off: a synteny track hides the coverage histogram unless asked. |
| <span id="slot-collapsesections">**collapseSections**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | One row per facet section by default: an all-vs-all track faceted by mate assembly draws each mate genome as a single band, with repeat depth shown as darker shading rather than as extra rows. Overrides the base alignments display's `collapseSections` default of `false`, where a section is a read category and the stack itself is the information. |
| <span id="slot-hideselfalignments">**hideSelfAlignments**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Hide the lane an all-vs-all track draws for the view's own assembly. That lane holds no self-alignment line — aligners skip each sequence's own diagonal — so it carries only the assembly's internal paralogy, and readers consistently read it as missing data. Only meaningful when grouping by mate assembly. |
| <span id="slot-sort">**sort**</span><br>[LGVSyntenySort](../lgvsyntenysort) | The row order, with `length` the default so big syntenic blocks cluster at the top; a string is the `type`. |
| <span id="slot-lodmode">**lodMode**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (auto, fine, coarse) = <code>'auto'</code> | stored tier of a tiered file to fetch: 'auto' switches on the adapter's bpPerPx threshold, 'fine' pins the per-row CIGAR tier, and 'coarse' the tier whose CIGAR is folded to its large indels |
| <span class="slot-group">Inherited from [LinearAlignmentsDisplay](../linearalignmentsdisplay)</span> | <span class="slot-group-count">13 slots</span> |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>250</code> | Starting height in pixels for the bands together; heightMode decides what a pileup deeper than this does |
| <span id="slot-unit">**unit**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (read, chain) = <code>'read'</code> | The unit one row draws: a read, or a chain of a read, its mate and its split segments (the "View as pairs" menu row) |
| <span id="slot-filter">**filter**</span><br>[ReadFilter](../readfilter) | Every read filter, in one object: the flag masks, a read name, tag filters, and the four read categories. It runs before every band, so coverage counts only the reads it passes.<br><br>default filter flags is exclude 1540 read unmapped (0x4) read fails platform/vendor quality checks (0x200) read is PCR or optical duplicate (0x400)<br><br>A read category takes `"only"` or `"exclude"`, and is absent when it isn't filtering — `{ "svSignal": "only" }` for the split reads, the SV-size indels and the discordant pairs. `svSignal`, `singletons`, `split` and `spliced`. |
| <span id="slot-facet">**facet**</span><br>[SectionFacet](../sectionfacet) | In-track stacked grouping, one labelled section per value: a read dimension (`strand`, `firstOfPairStrand`, `pairOrientation`, `pairing`, `split`, `spliced`, `svSignal`, `mapq`, `mateRefName`, `mateAssembly`), a tag (`tags.HP`), or any other field. `{ field: "tags.HP", domain: ["2", "1"] }` stacks the listed values first. |
| <span id="slot-basecolor">**baseColor**</span><br>[AlignmentsBaseColor](../alignmentsbasecolor) | The per-base layer drawn over the reads, whatever fills them: `{ field: "modifications" }`, `"bisulfite"`, `"baseQuality"` or `"base"`. |
| <span id="slot-modifications">**modifications**</span><br>[AlignmentsModifications](../alignmentsmodifications) | Settings for the `modifications` and `bisulfite` color fields: `threshold` (percent, default 10), `unmodified`, `cytosineContext` and `shownModifications`. |
| <span id="slot-scales">**scales**</span><br>[ValueScale](../valuescale) | The coverage band's value scale — the one thing on this display drawn against an axis, the pileup having no value and the arcs their own `arcBandYScale`. `symlogConstant` starts at 1 rather than the wiggle family's 0, which makes symlog exactly `log(depth+1)`: the knee sits at one read, the smallest depth there is. `domainQuantile` stays at 1, the deepest base in view; the Coverage axis panel's Clip extreme outliers writes 0.99, which stops the axis at twice the 99th percentile of the covered bins' peaks, and misses a collapsed-repeat pile-up once it covers more than 1% of the view. |
| <span id="slot-showlegend">**showLegend**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Show the color-scheme legend overlay. Defaults to off |
| <span id="slot-pileup">**pileup**</span><br>[Pileup](../pileup) | The stacked reads: `show`, `readHeight` (default 7), `maxLayoutHeight`, and the parts drawn on each read. |
| <span id="slot-sashimi">**sashimi**</span><br>[Sashimi](../sashimi) | The splice-junction arcs, drawn in the coverage band: `show`, `height`, `placement`, `showCounts` and `filter`. |
| <span id="slot-readconnections">**readConnections**</span><br>[ReadConnections](../readconnections) | The connections between mates and split segments: `show` (default off), `mark` (`arc` or `cloud`), `height`, `placement`, `lineWidth`, `color`, `showOrdinaryPairs` and `filter`. |
| <span id="slot-heightmode">**heightMode**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (fixed, grow, fit) = <code>'fixed'</code> | Track-sizing strategy — how the track responds when there are more reads than fit (shared vocabulary with the canvas feature display, exposed in the "Track sizing" menu). `fixed` (the default) keeps `pileup.readHeight` and scrolls; `grow` expands the track to show every read at that height; `fit` squeezes reads so every uncollapsed section fills the display without scrolling |
| <span id="slot-growmaxheight">**growMaxHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>800</code> | Ceiling in pixels for the "autogrow track height" sizing mode; a pileup deeper than this grows to the ceiling and scrolls the rest. Does not apply to the fixed or fit modes, and does not limit how much is laid out (see pileup.maxLayoutHeight)<br>_advanced_ |
| <span class="slot-group">Inherited from [BaseLinearDisplay](../baselineardisplay)</span> | <span class="slot-group-count">2 slots</span> |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1_000_000</code> | maximum data to attempt to download for a given track, used if adapter doesn't specify one<br>_advanced_ |
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
| `drawInter` | moved into a current slot |
| `drawLongRange` | moved into a current slot |
| `filterBy` | moved into a current slot |
| `pileupDisplay` | moved into a current slot |
| `snpCoverageDisplay` | moved into a current slot |
| `defaultRendering` | ignored |
| `colorScheme` | ignored |
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
