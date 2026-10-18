---
id: linearalignmentsdisplay
title: LinearAlignmentsDisplay
description: "Draws the reads of an AlignmentsTrack as a stack of bands: the coverage histogram with the sashimi arcs over it, the read connections, and the pileup."
sidebar_label: Display -> LinearAlignmentsDisplay
---

Auto-generated from the config schema in the source — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/configSchema.ts).

## Example usage

Minimal BAM track — no display override needed for defaults. See the
[alignments track guide](/docs/config_guides/alignments_track) for all
adapter and display options:

```js
{
  type: 'AlignmentsTrack',
  trackId: 'ngs_reads',
  name: 'NGS reads',
  assemblyNames: ['hg38'],
  adapter: { type: 'BamAdapter', uri: 'https://example.com/sample.bam' },
}
```

CRAM colored by CpG methylation (modBAM MM/ML tags). The `displayDefaults`
object shorthand applies settings without spelling out the display `type` or
`displayId` — equivalent to `displays: [{ type: 'LinearAlignmentsDisplay',
displayId: '...', color: ... }]`. See
[configuring displays](/docs/config_guides/tracks#configuring-displays):

```js
{
  type: 'AlignmentsTrack',
  trackId: 'methylation',
  name: 'Methylation',
  assemblyNames: ['hg38'],
  adapter: { type: 'CramAdapter', uri: 'https://example.com/sample.cram' },
  displayDefaults: {
    baseColor: { field: 'modifications' },
    modifications: { unmodified: 'all' },
  },
}
```

Long reads — taller track, soft-clipping shown, split/chimeric reads
connected by arcs, each segment colored by its strand against its
molecule's:

```js
{
  type: 'AlignmentsTrack',
  trackId: 'long_reads',
  name: 'Long reads',
  assemblyNames: ['hg38'],
  adapter: { type: 'BamAdapter', uri: 'https://example.com/longreads.bam' },
  displayDefaults: {
    height: 400,
    unit: 'chain',
    color: { field: 'pairOrientation' },
    pileup: { showSoftClipping: true },
    readConnections: { show: true },
  },
}
```

RNA-seq — sashimi arcs placed to avoid crossings, labelled with their read
counts, dropping junctions under five reads and the non-canonical ones:

```js
{
  type: 'AlignmentsTrack',
  trackId: 'rnaseq',
  name: 'RNA-seq',
  assemblyNames: ['hg38'],
  adapter: { type: 'BamAdapter', uri: 'https://example.com/rnaseq.bam' },
  displayDefaults: {
    coverage: { height: 80 },
    sashimi: { placement: 'auto', showCounts: true },
    filter: { junctions: { minReads: 5, nonCanonical: 'exclude' } },
  },
}
```

Draws the reads of an `AlignmentsTrack` as a stack of bands: the coverage
histogram with the sashimi arcs over it, the read connections, and the
pileup. Each band is one object, `coverage`, `sashimi`, `readConnections`
and `pileup`, holding whether it draws and its height; the settings every
band shares sit beside them: `filter`, which holds the read, junction and
connection tests, `unit`, `facet`, `sort` and `color`.

## Related links

- **Adapter:** [BamAdapter](../bamadapter)
- **Adapter:** [CramAdapter](../cramadapter)
- **Adapter:** [HtsgetBamAdapter](../htsgetbamadapter)
- **Adapter:** [SamAdapter](../samadapter)
- **Extended by:** [LGVSyntenyDisplay](../lgvsyntenydisplay)
- **State model:** [runtime API](../../models/linearalignmentsdisplay)
- **Base config:** [BaseLinearDisplay](../baselineardisplay)

## Config slots

These slots go on a display entry: `"displays": [{ "type": "LinearAlignmentsDisplay", ... }]`, or in the track's [`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>250</code> | Starting height in pixels for the bands together; heightMode decides what a pileup deeper than this does |
| <span id="slot-unit">**unit**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (read, chain) = <code>'read'</code> | The unit one row draws: a read, or a chain of a read, its mate and its split segments (the "View as pairs" menu row) |
| <span id="slot-filter">**filter**</span><br>[AlignmentsFilter](../alignmentsfilter) | Every test the display applies, read by every part that draws the data a test names, and every test must hold. The read members (the flag masks, `minMapq`, `readName`, `tags` and the read categories `spliced`, `svSignal`, `singletons` and `split`, each `"only"`, `"exclude"` or unset) run before every band, so coverage counts only the reads they pass; by default `flagExclude` drops unmapped, QC-failed and duplicate reads (1540). `junctions` tests the splice junctions the sashimi arcs and their counts draw, and `connections` the connections the arcs, the read cloud and the connectors over the pileup draw. |
| <span id="slot-facet">**facet**</span><br>[SectionFacet](../sectionfacet) | In-track stacked grouping, one labelled section per value: a read dimension (`strand`, `firstOfPairStrand`, `pairOrientation`, `pairing`, `split`, `spliced`, `svSignal`, `mapq`, `mateRefName`, `mateAssembly`), a tag (`tags.HP`), or any other field. `{ field: "tags.HP", domain: ["2", "1"] }` stacks the listed values first. |
| <span id="slot-collapsesections">**collapseSections**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Only consulted while `facet` is in effect. Collapsing trades each section's stack for one row, with overlap depth carried by the tint shading instead of by row count — the compact reading for a track with many sections (an all-vs-all synteny track's mate genomes). A section expanded from its label chip opts back out and draws a true stack. |
| <span id="slot-sort">**sort**</span><br>[AlignmentsSort](../alignmentssort) | The pileup's row order: a whole-window order (`position`, `length`, `spliced`, `split`) or a column sort at one base (`{ type: "strand", pos, refName }`). |
| <span id="slot-color">**color**</span><br>[AlignmentsColor](../alignmentscolor) | The read fill: `"steelblue"` paints every read, `{ field: "strand" }` a read dimension's own vocabulary and `{ field: "tags.HP" }` a SAM tag. |
| <span id="slot-basecolor">**baseColor**</span><br>[AlignmentsBaseColor](../alignmentsbasecolor) | The per-base layer drawn over the reads, whatever fills them: `{ field: "modifications" }`, `"bisulfite"`, `"baseQuality"` or `"base"`. |
| <span id="slot-modifications">**modifications**</span><br>[AlignmentsModifications](../alignmentsmodifications) | Settings for the `modifications` and `bisulfite` color fields: `threshold` (percent, default 10), `unmodified`, `cytosineContext` and `shownModifications`. |
| <span id="slot-scales">**scales**</span><br>[ValueScale](../valuescale) | The coverage band's value scale — the one thing on this display drawn against an axis, the pileup having no value and the arcs their own `arcBandYScale`. `symlogConstant` starts at 1 rather than the wiggle family's 0, which makes symlog exactly `log(depth+1)`: the knee sits at one read, the smallest depth there is. `domainQuantile` stays at 1, the deepest base in view; the Coverage axis panel's Clip extreme outliers writes 0.99, which stops the axis at twice the 99th percentile of the covered bins' peaks, and misses a collapsed-repeat pile-up once it covers more than 1% of the view. |
| <span id="slot-showlegend">**showLegend**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Show the color-scheme legend overlay. Defaults to off |
| <span id="slot-coverage">**coverage**</span><br>[CoverageBand](../coverageband) | The coverage histogram band: `show`, `height` (default 45), `showInterbaseIndicators` and `minAlleleFraction`, a flat floor on each allele segment's share of its position's depth, distinct from `pileup.fadeLowFrequency`. |
| <span id="slot-pileup">**pileup**</span><br>[Pileup](../pileup) | The stacked reads: `show`, `readHeight` (default 7), `maxLayoutHeight`, and the parts drawn on each read. |
| <span id="slot-sashimi">**sashimi**</span><br>[Sashimi](../sashimi) | The splice-junction arcs, drawn in the coverage band: `show`, `height`, `placement` and `showCounts`; `filter.junctions` says which junctions draw. |
| <span id="slot-readconnections">**readConnections**</span><br>[ReadConnections](../readconnections) | The connections between mates and split segments: `show` (default off), `mark` (`arc` or `cloud`), `height`, `placement`, `lineWidth`, `color` and `showOrdinaryPairs`; `filter.connections` says which connections draw. |
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
