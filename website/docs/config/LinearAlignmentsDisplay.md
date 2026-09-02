---
id: linearalignmentsdisplay
title: LinearAlignmentsDisplay
sidebar_label: Display -> LinearAlignmentsDisplay
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `alignments` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/configSchema.ts).

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
displayId: '...', colorBy: ... }]`. See
[configuring displays](/docs/config_guides/tracks#configuring-displays):

```js
{
  type: 'AlignmentsTrack',
  trackId: 'methylation',
  name: 'Methylation',
  assemblyNames: ['hg38'],
  adapter: { type: 'CramAdapter', uri: 'https://example.com/sample.cram' },
  displayDefaults: {
    colorBy: { type: 'modifications', modifications: { fillUnmarked: true } },
  },
}
```

Long reads — taller track, soft-clipping shown, split/chimeric reads
connected by arcs:

```js
{
  type: 'AlignmentsTrack',
  trackId: 'long_reads',
  name: 'Long reads',
  assemblyNames: ['hg38'],
  adapter: { type: 'BamAdapter', uri: 'https://example.com/longreads.bam' },
  displayDefaults: {
    height: 400,
    showSoftClipping: true,
    linkedReads: 'normal',
    readConnections: 'arc',
  },
}
```

_See the **Config slots** section below for all available configuration fields._

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
| <span id="slot-featureheight">**featureHeight**</span><br>[`maybeNumber`](/docs/config_guides/slot_types#the-maybe-types) = <code>7</code> _promotable_ | Height of each feature (read) in pixels. Unset (the default) follows the session-wide default for this display type, falling back to 7; an explicit number customizes the track (including customizing 7 back over a compact session default) |
| <span id="slot-readconnectionslinewidth">**readConnectionsLineWidth**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | Line width for read-connection arcs/lines in pixels |
| <span id="slot-showsashimilabels">**showSashimiLabels**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) = <code>false</code> _promotable_ | Draw the supporting-read count on each sashimi arc |
| <span id="slot-hidenoncanonicaljunctions">**hideNonCanonicalJunctions**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) = <code>false</code> _promotable_ | Hide sashimi arcs whose splice-site motif is none of GT-AG, GC-AG or AT-AC. Read off the reference under each junction, so it needs a sequence adapter; a junction whose motif could not be read stays |
| <span id="slot-maxheight">**maxHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>6000</code> | Maximum pixel height of the pileup layout; reads beyond this are not stacked (coverage still reflects true depth)<br>_advanced_ |
| <span id="slot-height">**height**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>250</code> | Starting height in pixels for the coverage band and pileup together; heightMode decides what a pileup deeper than this does |
| <span id="slot-colorby">**colorBy**</span><br>[`maybeFrozen`](/docs/config_guides/slot_types#the-maybe-types) = <code>{ type: 'normal' }</code> _promotable_ | Color scheme for reads<br>_advanced_ |
| <span id="slot-filterby">**filterBy**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>defaultFilterFlags</code> | Every read filter, in one object: the flag masks, a read name, tag filters, and the four read categories.<br><br>default filter flags is exclude 1540 read unmapped (0x4) read fails platform/vendor quality checks (0x200) read is PCR or optical duplicate (0x400)<br><br>A read category takes `"only"` or `"exclude"`, and is absent when it isn't filtering — `{ "properPairs": "exclude", "split": "only" }` for the split reads of discordant pairs. `spliced`, `properPairs`, `singletons` and `split`; see the `FilterBy` type.<br>_advanced_ |
| <span id="slot-groupby">**groupBy**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>null</code> | In-track stacked grouping, e.g. `{ type: "strand" }` to pre-group reads by strand (null = ungrouped)<br>_advanced_ |
| <span id="slot-collapsegrouprows">**collapseGroupRows**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Only consulted while `groupBy` is in effect. Collapsing trades the per-group stack for one lane per group, with overlap depth carried by the tint shading instead of by row count — the compact reading for a track with many groups (an all-vs-all synteny track's mate genomes). A group expanded from its label chip opts back out and draws a true stack. |
| <span id="slot-autoscale">**autoscale**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (local, localsd) = <code>'local'</code> | Coverage autoscale type |
| <span id="slot-minscore">**minScore**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>Number.MIN_VALUE</code> | Minimum coverage depth bound<br>_advanced_ |
| <span id="slot-maxscore">**maxScore**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>Number.MAX_VALUE</code> | Maximum coverage depth bound<br>_advanced_ |
| <span id="slot-scaletype">**scaleType**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (linear, log, symlog) = <code>'linear'</code> | Coverage scale type. "log" floors the domain at a depth of 1, which draws a single-read position at the same height as no coverage at all; "symlog" is log-like higher up and linear through zero, so low depths stay separable |
| <span id="slot-symlogconstant">**symlogConstant**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | Width of symlog's linear region around zero, in depth units. The default 1 makes symlog exactly log(depth+1), which is the transform read depth wants: the knee sits at one read, the smallest depth there is. 0 means "derive from the domain" (a thousandth of the visible max) — right for a wiggle track, whose units are its own, and wrong here, since it puts the knee a tenth of a read below zero and draws a single stray read a third of the way up a depth-100 band<br>_advanced_ |
| <span id="slot-numstddev">**numStdDev**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>3</code> | Number of standard deviations for localsd autoscale<br>_advanced_ |
| <span id="slot-mismatchalpha">**mismatchAlpha**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) = <code>false</code> _promotable_ | Fade mismatch bases by their per-base Phred quality. Unset (the default) follows the session-wide default for this display type, falling back to off; an explicit true/false customizes the track (either direction, including customizing off over an on session default) |
| <span id="slot-showlowfreqmismatches">**showLowFreqMismatches**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Draw sub-pixel mismatches, insertions and clip bars in the pileup at full opacity instead of fading the ones below the depth-dependent frequency threshold. Read through the `filterMismatchesByFrequency` getter, which is this in the polarity the renderers and hit-test take. Does not affect the coverage band (see runCoveragePipeline)<br>_advanced_ |
| <span id="slot-showlegend">**showLegend**</span><br>[`maybeBoolean`](/docs/config_guides/slot_types#the-maybe-types) = <code>false</code> _promotable_ | Show the color-scheme legend overlay. Unset (the default) follows the session-wide default for this display type, falling back to off; an explicit true/false customizes the track (either direction, including customizing off over an on session default) |
| <span id="slot-sortedby">**sortedBy**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>null</code> | Sort reads at a genomic position, e.g. by base, strand, or a tag (null = unsorted)<br>_advanced_ |
| <span id="slot-largefeaturesfirst">**largeFeaturesFirst**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Lay out the widest features in the lowest pileup rows instead of by genomic start, so large alignments cluster at the top rather than interleaving with small ones. Off by default; LGVSyntenyDisplay turns it on. Ignored while an explicit `sortedBy` position sort is active. |
| <span id="slot-splicedreadsfirst">**splicedReadsFirst**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | The other layout-order flag, for RNA-seq: reads whose CIGAR carries a skip take the lowest rows. Ignored while a `sortedBy` position sort is active; wins over `largeFeaturesFirst` if both are set. |
| <span id="slot-showoutline">**showOutline**</span><br>[`frozen`](/docs/config_guides/slot_types#frozen) = <code>null</code> | null = auto: outline is drawn only in chain/linked-read modes. Set true/false to force it on or off regardless of mode.<br>_advanced_ |
| <span id="slot-linkedreads">**linkedReads**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (off, normal) = <code>'off'</code> _promotable_ | View as pairs / link supplementary alignments: put a read, its mate and its split segments on one row |
| <span id="slot-showbezierconnections">**showBezierConnections**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Draw paired-read connection curves over the pileup |
| <span id="slot-showcoverage">**showCoverage**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Draw the coverage histogram band |
| <span id="slot-showpileup">**showPileup**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Draw the stacked-read pileup band |
| <span id="slot-coverageheight">**coverageHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>45</code> | Height of the coverage band in pixels |
| <span id="slot-coveragesnpminfrequency">**coverageSnpMinFrequency**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | Hide a coverage-band allele segment whose share of that position's depth is below this fraction, so the band stops painting a sliver for every sequencing error at high depth. 0 (the default) colors every mismatch. Distinct from `showLowFreqMismatches`, which turns OFF the pileup's fade of sub-pixel marks against a depth-dependent threshold; this is a flat allele-fraction floor on the band, and the grey depth bar still shows through where a segment is hidden<br>_advanced_ |
| <span id="slot-showmismatches">**showMismatches**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Draw how reads differ from the reference: per-base mismatches, insertion markers and deletion bars. Not the intron centerlines — a spliced read is drawn as separate exon blocks, so the line joining them says they are one read rather than several, and it draws either way (PILEUP_LAYERS) |
| <span id="slot-showinterbaseindicators">**showInterbaseIndicators**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | Draw interbase insertion/clip count bars and indicator triangles |
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
| <span id="slot-heightmode">**heightMode**</span><br>[`maybeStringEnum`](/docs/config_guides/slot_types#the-maybe-types) (fixed, grow, fit) = <code>'fixed'</code> _promotable_ | Track-sizing strategy — how the track responds when there are more reads than fit (shared vocabulary with the canvas feature display, exposed in the "Track sizing" menu). Unset (the default) follows the session-wide default for this display type, falling back to `fixed`; `fixed` keeps `featureHeight` and scrolls; `grow` expands the track to show every read at the configured height; `fit` squeezes reads so every uncollapsed group fills the display without scrolling. Orthogonal to the per-read size set by `featureHeight` |
| <span id="slot-growmaxheight">**growMaxHeight**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>800</code> | Ceiling in pixels for the "autogrow track height" sizing mode; a pileup deeper than this grows to the ceiling and scrolls the rest. Does not apply to the fixed or fit modes, and does not limit how much is laid out (see maxHeight)<br>_advanced_ |
| <span id="slot-densitytier">**densityTier**</span><br>[`stringEnum`](/docs/config_guides/slot_types#stringenum) (auto, features, density) = <code>'auto'</code> | when to draw the features-per-bin density band in place of features: "auto" swaps to it where the region is too large to fetch, "features" never does and keeps the banner, "density" always does. Needs a density source on the adapter (its densityAdapter slot)<br>_advanced_ |
| <span id="slot-densitytierbpperpx">**densityTierBpPerPx**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>0</code> | in "auto" mode, also draw the density band from this many bp per pixel outward, before the region is too large to fetch; 0 leaves the swap to the fetch-size gate alone<br>_advanced_ |
| <span class="slot-group">Inherited from [BaseLinearDisplay](../baselineardisplay)</span> | <span class="slot-group-count">5 slots</span> |
| <span id="slot-maxfeaturescreendensity">**maxFeatureScreenDensity**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1</code> | maximum features per pixel before showing a "too many features" message<br>_advanced_ |
| <span id="slot-mouseover">**mouseover**</span><br>[`string`](/docs/config_guides/slot_types#string) = <span class="cell-more"><button type="button" class="cell-more-trigger"><code>'jexl:get(feature,'_mouseOver')&#124;&#124;get(feature,'name')&#124;&#124;get(featu…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>'jexl:get(feature,'_mouseOver')&#124;&#124;get(feature,'name')&#124;&#124;get(feature,'function')&#124;&#124;get(feature,'id')'</code></pre></dialog></span> | text to display when the cursor hovers over a feature<br>_callback args:_ `feature` |
| <span id="slot-jexlfilters">**jexlFilters**</span><br>`stringArray` = <code>[]</code> | config jexlFilters are deferred evaluated so they are prepended with jexl at runtime rather than being stored with jexl in the config |
| <span id="slot-fetchsizelimit">**fetchSizeLimit**</span><br>[`number`](/docs/config_guides/slot_types#number) = <code>1_000_000</code> | maximum data to attempt to download for a given track, used if adapter doesn't specify one<br>_advanced_ |
| <span id="slot-forceload">**forceLoad**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | Declarative equivalent of the "Force load" button on the "too much data" banner: when true the display always renders, however large the region or dense the features. Off by default (the gate guards against huge downloads). Set it on a view no one can interact with — an embedded / notebook view, or a screenshot — where the region is known and you want it drawn without a click.<br>_advanced_ |
