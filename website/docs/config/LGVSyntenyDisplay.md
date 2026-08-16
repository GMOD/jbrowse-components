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
| Slot | Description |
| --- | --- |
| <span id="slot-mouseover">**mouseover**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'jexl:lgvSyntenyTooltip(feature)'</code> | Tooltip shown on hovering a synteny feature; the default jexl expression renders both mates' names and locations.<br>_callback args:_ `feature` |
| <span id="slot-colorby">**colorBy**</span><br>[`maybeFrozen`](/docs/config_guides/slot_types#the-maybe-types) = <code>{ type: 'strand' }</code> _promotable_ | Synteny reads are strand-colored by default (vs the base alignments display's `normal`); overrides the inherited `colorBy` slot's default.<br>_advanced_ |
| <span id="slot-showcoverage">**showCoverage**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Synteny reads hide the coverage histogram by default; overrides the inherited base alignments display's `showCoverage` default of `true`. |
| <span id="slot-collapsegrouprows">**collapseGroupRows**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | One lane per group by default: an all-vs-all track grouped by mate assembly draws each mate genome as a single band, with repeat depth shown as darker shading rather than as extra rows. Overrides the base alignments display's `collapseGroupRows` default of `false`, where a group is a read category and the stack itself is the information. |
| <span id="slot-hideselfalignments">**hideSelfAlignments**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Hide the lane an all-vs-all track draws for the view's own assembly. That lane holds no self-alignment line — aligners skip each sequence's own diagonal — so it carries only the assembly's internal paralogy, and readers consistently read it as missing data. Only meaningful when grouping by mate assembly. |
| <span id="slot-largefeaturesfirst">**largeFeaturesFirst**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Synteny lays large alignments out first so big syntenic blocks cluster at the top instead of interleaving with small ones; overrides the base alignments display's `largeFeaturesFirst` default of `false`. |
| <span class="slot-group">Inherited from [LinearAlignmentsDisplay](../linearalignmentsdisplay)</span> | <span class="slot-group-count">43 slots</span> |
| <span id="slot-featureheight">**featureHeight**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) = <code>7</code> _promotable_ | Height of each feature (read) in pixels. Unset (the default) follows the session-wide default for this display type, falling back to 7; an explicit number customizes the track (including customizing 7 back over a compact session default) |
| <span id="slot-heightmode">**heightMode**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (fixed, grow, fit) = <code>'fixed'</code> _promotable_ | Track-sizing strategy — how the track responds when there are more reads than fit (shared vocabulary with the canvas feature display, exposed in the "Track sizing" menu). Unset (the default) follows the session-wide default for this display type, falling back to `fixed`; `fixed` keeps `featureHeight` and scrolls; `grow` expands the track to show every read at the configured height; `fit` squeezes reads so every uncollapsed group fills the display without scrolling. Orthogonal to the per-read size set by `featureHeight` |
| <span id="slot-readconnectionslinewidth">**readConnectionsLineWidth**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | Line width for read-connection arcs/lines in pixels |
| <span id="slot-showsashimilabels">**showSashimiLabels**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) = <code>false</code> _promotable_ | Draw the supporting-read count on each sashimi arc |
| <span id="slot-maxheight">**maxHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>6000</code> | Maximum pixel height of the pileup layout; reads beyond this are not stacked (coverage still reflects true depth)<br>_advanced_ |
| <span id="slot-growmaxheight">**growMaxHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>800</code> | Ceiling in pixels for the "autogrow track height" sizing mode; a pileup deeper than this grows to the ceiling and scrolls the rest. Does not apply to the fixed or fit modes, and does not limit how much is laid out (see maxHeight)<br>_advanced_ |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>250</code> | Starting height in pixels for the coverage band and pileup together; heightMode decides what a pileup deeper than this does |
| <span id="slot-filterby">**filterBy**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>defaultFilterFlags</code> | default filter flags is exclude 1540 read unmapped (0x4) read fails platform/vendor quality checks (0x200) read is PCR or optical duplicate (0x400)<br>_advanced_ |
| <span id="slot-groupby">**groupBy**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>null</code> | In-track stacked grouping, e.g. `{ type: "strand" }` to pre-group reads by strand (null = ungrouped)<br>_advanced_ |
| <span id="slot-autoscale">**autoscale**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (local, localsd) = <code>'local'</code> | Coverage autoscale type |
| <span id="slot-minscore">**minScore**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>Number.MIN_VALUE</code> | Minimum coverage depth bound<br>_advanced_ |
| <span id="slot-maxscore">**maxScore**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>Number.MAX_VALUE</code> | Maximum coverage depth bound<br>_advanced_ |
| <span id="slot-scaletype">**scaleType**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (linear, log) = <code>'linear'</code> | Coverage scale type (linear or log) |
| <span id="slot-numstddev">**numStdDev**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>3</code> | Number of standard deviations for localsd autoscale<br>_advanced_ |
| <span id="slot-mismatchalpha">**mismatchAlpha**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) = <code>false</code> _promotable_ | Fade mismatch bases by their per-base Phred quality. Unset (the default) follows the session-wide default for this display type, falling back to off; an explicit true/false customizes the track (either direction, including customizing off over an on session default) |
| <span id="slot-showlowfreqmismatches">**showLowFreqMismatches**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Draw sub-pixel mismatches, insertions and clip bars in the pileup at full opacity instead of fading the ones below the depth-dependent frequency threshold. Read through the `filterMismatchesByFrequency` getter, which is this in the polarity the renderers and hit-test take. Does not affect the coverage band (see runCoveragePipeline)<br>_advanced_ |
| <span id="slot-showlegend">**showLegend**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) = <code>false</code> _promotable_ | Show the color-scheme legend overlay. Unset (the default) follows the session-wide default for this display type, falling back to off; an explicit true/false customizes the track (either direction, including customizing off over an on session default) |
| <span id="slot-sortedby">**sortedBy**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>null</code> | Sort reads at a genomic position, e.g. by base, strand, or a tag (null = unsorted)<br>_advanced_ |
| <span id="slot-showoutline">**showOutline**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>null</code> | null = auto: outline is drawn only in chain/linked-read modes. Set true/false to force it on or off regardless of mode.<br>_advanced_ |
| <span id="slot-linkedreads">**linkedReads**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (off, normal) = <code>'off'</code> _promotable_ | View as pairs / link supplementary alignments: put a read, its mate and its split segments on one row |
| <span id="slot-showbezierconnections">**showBezierConnections**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Draw paired-read connection curves over the pileup |
| <span id="slot-showpileup">**showPileup**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Draw the stacked-read pileup band |
| <span id="slot-coverageheight">**coverageHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>45</code> | Height of the coverage band in pixels |
| <span id="slot-showmismatches">**showMismatches**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Draw how reads differ from the reference: per-base mismatches, insertion markers and deletion bars. Not the intron centerlines — a spliced read is drawn as separate exon blocks, so the line joining them says they are one read rather than several, and it draws either way (PILEUP_LAYERS) |
| <span id="slot-showinterbaseindicators">**showInterbaseIndicators**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Draw interbase insertion/clip count bars and indicator triangles |
| <span id="slot-drawsingletons">**drawSingletons**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Draw reads whose mate and split/supplementary segments are all absent from the view (samtools "singletons") |
| <span id="slot-drawproperpairs">**drawProperPairs**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Draw properly-paired reads |
| <span id="slot-showonlysplitalignments">**showOnlySplitAlignments**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Only draw reads that are part of a split/chimeric alignment (have a supplementary segment, SAM flag 0x800) |
| <span id="slot-flipstrandlongreadchains">**flipStrandLongReadChains**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Color split segments relative to the predominant orientation of the reads on screen, rather than by their own mapping strand |
| <span id="slot-colorsupplementarychains">**colorSupplementaryChains**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Paint every chain carrying a supplementary segment a flat supplementary color, paired or not |
| <span id="slot-drawinter">**drawInter**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Draw inter-chromosomal read-connection arcs |
| <span id="slot-drawproperpairarcs">**drawProperPairArcs**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Draw arcs for ordinary concordant pairs. Uncheck to leave only the arcs that carry a category (abnormal insert size or orientation, split junctions), which on deep coverage is the difference between a readable band and a solid mass |
| <span id="slot-mininterchromsupport">**minInterchromSupport**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>2</code> | Hide inter-chromosomal connections supported by fewer than this many reads clustered at the same breakpoint |
| <span id="slot-drawlongrange">**drawLongRange**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Draw long-range read-connection arcs |
| <span id="slot-arccolorbytype">**arcColorByType**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (insertSizeAndOrientation, insertSize, orientation) = <code>'insertSizeAndOrientation'</code> | How to color read-connection arcs |
| <span id="slot-readconnections">**readConnections**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (off, arc, cloud) = <code>'off'</code> _promotable_ | Read-connection rendering mode (mate pairs + split reads) |
| <span id="slot-readconnectionsdown">**readConnectionsDown**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) = <code>true</code> _promotable_ | Draw read connections below the coverage band. Unset (the default) follows the session-wide default for this display type, falling back to on; an explicit true/false customizes the track (either direction, including drawing above the coverage band over an on session default) |
| <span id="slot-showsashimiarcs">**showSashimiArcs**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) = <code>true</code> _promotable_ | Draw sashimi (splice-junction) arcs |
| <span id="slot-sashimiarcsmode">**sashimiArcsMode**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (up, down, auto) = <code>'up'</code> _promotable_ | Sashimi junction-arc placement |
| <span id="slot-minsashimiscore">**minSashimiScore**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>2</code> | Hide sashimi arcs with fewer than this many supporting reads |
| <span id="slot-sashimiarcsheight">**sashimiArcsHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>40</code> | Height of the sashimi-arc band in pixels |
| <span id="slot-readconnectionsheight">**readConnectionsHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>35</code> | Height of the read-connection band in pixels |
| <span id="slot-showsoftclipping">**showSoftClipping**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) = <code>false</code> _promotable_ | Draw soft-clipped read portions. Unset (the default) follows the session-wide default for this display type, falling back to off; an explicit true/false customizes the track (either direction, including customizing off over an on session default) |
| <span class="slot-group">Inherited from [BaseLinearDisplay](../baselineardisplay)</span> | <span class="slot-group-count">4 slots</span> |
| <span id="slot-maxfeaturescreendensity">**maxFeatureScreenDensity**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | maximum features per pixel before showing a "too many features" message<br>_advanced_ |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1_000_000</code> | maximum data to attempt to download for a given track, used if adapter doesn't specify one<br>_advanced_ |
| <span id="slot-forceload">**forceLoad**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Declarative equivalent of the "Force load" button on the "too much data" banner: when true the display always renders, however large the region or dense the features. Off by default (the gate guards against huge downloads). Set it on a view no one can interact with — an embedded / notebook view, or a screenshot — where the region is known and you want it drawn without a click.<br>_advanced_ |
| <span id="slot-jexlfilters">**jexlFilters**</span><br>`stringArray` = <code>[]</code> | config jexlFilters are deferred evaluated so they are prepended with jexl at runtime rather than being stored with jexl in the config |
