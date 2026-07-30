---
id: lgvsyntenydisplay
title: LGVSyntenyDisplay
sidebar_label: Display -> LGVSyntenyDisplay
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the
`linear-comparative-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LGVSyntenyDisplay/configSchemaF.ts).

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

_See the **Config slots** section below for all available configuration fields._

## Related links

- **Adapter:** [AllVsAllIndexedPAFAdapter](../allvsallindexedpafadapter)
- **Adapter:** [AllVsAllPAFAdapter](../allvsallpafadapter)
- **Adapter:** [BlastTabularAdapter](../blasttabularadapter)
- **Adapter:** [ChainAdapter](../chainadapter)
- **Adapter:** [DeltaAdapter](../deltaadapter)
- **Adapter:** [MCScanAnchorsAdapter](../mcscananchorsadapter)
- **Adapter:** [MCScanBlocksAdapter](../mcscanblocksadapter)
- **Adapter:** [MCScanSimpleAnchorsAdapter](../mcscansimpleanchorsadapter)
- **Adapter:** [MashMapAdapter](../mashmapadapter)
- **Adapter:** [PAFAdapter](../pafadapter)
- **Adapter:** [PairwiseIndexedPAFAdapter](../pairwiseindexedpafadapter)
- **State model:** [runtime API](../../models/lgvsyntenydisplay)
- **Base config:** [LinearAlignmentsDisplay](../linearalignmentsdisplay)

## Config slots

These slots go on a display entry:
`"displays": [{ "type": "LGVSyntenyDisplay", ... }]`, or in the track's
[`displayDefaults`](/docs/config_guides/tracks#configuring-displays) when this
is its default display. Slot types (`fileLocation`, `frozen`, ...) are explained
in the [config slot types reference](/docs/config_guides/slot_types). Slots a
base configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description | From |
| --- | --- | --- |
| <span id="slot-mouseover">**mouseover**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'jexl:lgvSyntenyTooltip(feature)'</code> | Tooltip shown on hovering a synteny feature; the default jexl expression renders both mates' names and locations.<br>_callback args:_ `feature` |  |
| <span id="slot-colorby">**colorBy**</span><br>`maybeFrozen` = <code>{ type: 'strand' }</code> _promotable_ | Synteny reads are strand-colored by default (vs the base alignments display's `normal`); overrides the inherited `colorBy` slot's default.<br>_advanced_ |  |
| <span id="slot-showcoverage">**showCoverage**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Synteny reads hide the coverage histogram by default; overrides the inherited base alignments display's `showCoverage` default of `true`. |  |
| <span id="slot-collapsegrouprows">**collapseGroupRows**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | One lane per group by default: an all-vs-all track grouped by mate assembly draws each mate genome as a single band, with repeat depth shown as darker shading rather than as extra rows. Overrides the base alignments display's `collapseGroupRows` default of `false`, where a group is a read category and the stack itself is the information. |  |
| <span id="slot-hideselfalignments">**hideSelfAlignments**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Hide the lane an all-vs-all track draws for the view's own assembly. That lane holds no self-alignment line — aligners skip each sequence's own diagonal — so it carries only the assembly's internal paralogy, and readers consistently read it as missing data. Only meaningful when grouping by mate assembly. |  |
| <span id="slot-largefeaturesfirst">**largeFeaturesFirst**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Synteny lays large alignments out first so big syntenic blocks cluster at the top instead of interleaving with small ones; overrides the base alignments display's `largeFeaturesFirst` default of `false`. |  |
| <span id="slot-featureheight">**featureHeight**</span><br>`maybeNumber` = <code>7</code> _promotable_ | Height of each feature (read) in pixels. Unset (the default) follows the session-wide default for this display type, falling back to 7; an explicit number customizes the track (including customizing 7 back over a compact session default) | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |
| <span id="slot-heightmode">**heightMode**</span><br>`maybeStringEnum` (fixed, grow, fit) = <code>'fixed'</code> _promotable_ | Track-sizing strategy — how the track responds when there are more reads than fit (shared vocabulary with the canvas feature display, exposed in the "Track sizing" menu). Unset (the default) follows the session-wide default for this display type, falling back to `fixed`; `fixed` keeps `featureHeight` and scrolls; `grow` expands the track to show every read at the configured height; `fit` squeezes reads so every uncollapsed group fills the display without scrolling. Orthogonal to the per-read size set by `featureHeight` | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |
| <span id="slot-readconnectionslinewidth">**readConnectionsLineWidth**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | Line width for read-connection arcs/lines in pixels | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |
| <span id="slot-showsashimilabels">**showSashimiLabels**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#maybeboolean) = <code>false</code> _promotable_ | Draw the supporting-read count on each sashimi arc | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |
| <span id="slot-maxheight">**maxHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>6000</code> | Maximum pixel height of the pileup layout; reads beyond this are not stacked (coverage still reflects true depth)<br>_advanced_ | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |
| <span id="slot-growmaxheight">**growMaxHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>800</code> | Ceiling in pixels for the "autogrow track height" sizing mode; a pileup deeper than this grows to the ceiling and scrolls the rest. Does not apply to the fixed or fit modes, and does not limit how much is laid out (see maxHeight)<br>_advanced_ | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>250</code> | Starting height in pixels for the coverage band and pileup together; heightMode decides what a pileup deeper than this does | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |
| <span id="slot-filterby">**filterBy**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>defaultFilterFlags</code> | default filter flags is exclude 1540 read unmapped (0x4) read fails platform/vendor quality checks (0x200) read is PCR or optical duplicate (0x400)<br>_advanced_ | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |
| <span id="slot-groupby">**groupBy**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>null</code> | In-track stacked grouping, e.g. `{ type: "strand" }` to pre-group reads by strand (null = ungrouped)<br>_advanced_ | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |
| <span id="slot-autoscale">**autoscale**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (local, localsd) = <code>'local'</code> | Coverage autoscale type | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |
| <span id="slot-minscore">**minScore**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>Number.MIN_VALUE</code> | Minimum coverage depth bound<br>_advanced_ | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |
| <span id="slot-maxscore">**maxScore**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>Number.MAX_VALUE</code> | Maximum coverage depth bound<br>_advanced_ | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |
| <span id="slot-scaletype">**scaleType**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (linear, log) = <code>'linear'</code> | Coverage scale type (linear or log) | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |
| <span id="slot-numstddev">**numStdDev**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>3</code> | Number of standard deviations for localsd autoscale<br>_advanced_ | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |
| <span id="slot-mismatchalpha">**mismatchAlpha**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#maybeboolean) = <code>false</code> _promotable_ | Fade mismatch bases by their per-base Phred quality. Unset (the default) follows the session-wide default for this display type, falling back to off; an explicit true/false customizes the track (either direction, including customizing off over an on session default) | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |
| <span id="slot-showlowfreqmismatches">**showLowFreqMismatches**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Draw sub-pixel mismatches, insertions and clip bars in the pileup at full opacity instead of fading the ones below the depth-dependent frequency threshold. Read through the `filterMismatchesByFrequency` getter, which is this in the polarity the renderers and hit-test take. Does not affect the coverage band (see runCoveragePipeline)<br>_advanced_ | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |
| <span id="slot-showlegend">**showLegend**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Show the color-scheme legend overlay | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |
| <span id="slot-sortedby">**sortedBy**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>null</code> | Sort reads at a genomic position, e.g. by base, strand, or a tag (null = unsorted)<br>_advanced_ | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |
| <span id="slot-showoutline">**showOutline**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>null</code> | null = auto: outline is drawn only in chain/linked-read modes. Set true/false to force it on or off regardless of mode.<br>_advanced_ | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |
| <span id="slot-linkedreads">**linkedReads**</span><br>`maybeStringEnum` (off, normal) = <code>'off'</code> _promotable_ | Linked-read (barcode-chain) layout mode | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |
| <span id="slot-showbezierconnections">**showBezierConnections**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Draw paired-read connection curves over the pileup | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |
| <span id="slot-showpileup">**showPileup**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Draw the stacked-read pileup band | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |
| <span id="slot-coverageheight">**coverageHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>45</code> | Height of the coverage band in pixels | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |
| <span id="slot-showmismatches">**showMismatches**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Draw per-base mismatches on reads | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |
| <span id="slot-showinterbaseindicators">**showInterbaseIndicators**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Draw interbase insertion/clip count bars and indicator triangles | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |
| <span id="slot-drawsingletons">**drawSingletons**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Draw reads whose mate is unmapped | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |
| <span id="slot-drawproperpairs">**drawProperPairs**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Draw properly-paired reads | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |
| <span id="slot-showonlysplitalignments">**showOnlySplitAlignments**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Only draw reads that are part of a split/chimeric alignment (have a supplementary segment, SAM flag 0x800) | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |
| <span id="slot-flipstrandlongreadchains">**flipStrandLongReadChains**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Flip strand coloring for reverse long-read chains | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |
| <span id="slot-colorsupplementarychains">**colorSupplementaryChains**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Paint paired supplementary chains a flat supplementary color | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |
| <span id="slot-drawinter">**drawInter**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Draw inter-chromosomal read-connection arcs | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |
| <span id="slot-drawlongrange">**drawLongRange**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Draw long-range read-connection arcs | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |
| <span id="slot-arccolorbytype">**arcColorByType**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (insertSizeAndOrientation, insertSize, orientation) = <code>'insertSizeAndOrientation'</code> | How to color read-connection arcs | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |
| <span id="slot-readconnections">**readConnections**</span><br>`maybeStringEnum` (off, arc, cloud) = <code>'off'</code> _promotable_ | Read-connection rendering mode (mate pairs + split reads) | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |
| <span id="slot-readconnectionsdown">**readConnectionsDown**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#maybeboolean) = <code>true</code> _promotable_ | Draw read connections below the coverage band. Unset (the default) follows the session-wide default for this display type, falling back to on; an explicit true/false customizes the track (either direction, including drawing above the coverage band over an on session default) | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |
| <span id="slot-showsashimiarcs">**showSashimiArcs**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Draw sashimi (splice-junction) arcs | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |
| <span id="slot-sashimiarcsmode">**sashimiArcsMode**</span><br>`maybeStringEnum` (up, down, auto) = <code>'up'</code> _promotable_ | Sashimi junction-arc placement | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |
| <span id="slot-minsashimiscore">**minSashimiScore**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>2</code> | Hide sashimi arcs with fewer than this many supporting reads | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |
| <span id="slot-sashimiarcsheight">**sashimiArcsHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>40</code> | Height of the sashimi-arc band in pixels | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |
| <span id="slot-readconnectionsheight">**readConnectionsHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>25</code> | Height of the read-connection band in pixels | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |
| <span id="slot-showsoftclipping">**showSoftClipping**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#maybeboolean) = <code>false</code> _promotable_ | Draw soft-clipped read portions. Unset (the default) follows the session-wide default for this display type, falling back to off; an explicit true/false customizes the track (either direction, including customizing off over an on session default) | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |
| <span id="slot-maxfeaturescreendensity">**maxFeatureScreenDensity**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | maximum features per pixel before showing a "too many features" message, used if byte size estimates are not available<br>_advanced_ | [BaseLinearDisplay](../baselineardisplay) |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1_000_000</code> | maximum data to attempt to download for a given track, used if adapter doesn't specify one<br>_advanced_ | [BaseLinearDisplay](../baselineardisplay) |
| <span id="slot-forceload">**forceLoad**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Declarative equivalent of the "Force load" button on the "too much data" banner: when true the display always renders, however large the region or dense the features. Off by default (the gate guards against huge downloads). Set it on a view no one can interact with — an embedded / notebook view, or a screenshot — where the region is known and you want it drawn without a click.<br>_advanced_ | [BaseLinearDisplay](../baselineardisplay) |
| <span id="slot-jexlfilters">**jexlFilters**</span><br>`stringArray` = <code>[`get(feature,'gbkey')!='Src'`]</code> | config jexlFilters are deferred evaluated so they are prepended with jexl at runtime rather than being stored with jexl in the config | [BaseLinearDisplay](../baselineardisplay) |
