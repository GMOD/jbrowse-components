---
id: linearalignmentsdisplay
title: LinearAlignmentsDisplay
sidebar_label: Display -> LinearAlignmentsDisplay
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`alignments` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/LinearAlignmentsDisplay/model.ts).

## Example usage

The display goes in a track's `displays` array; here are three complete
`AlignmentsTrack` configs to paste into `tracks`.

Basic BAM, opened taller:

```js
{
  type: 'AlignmentsTrack',
  trackId: 'ngs_reads',
  name: 'NGS reads',
  assemblyNames: ['hg38'],
  adapter: { type: 'BamAdapter', uri: 'https://example.com/sample.bam' },
  displays: [
    {
      type: 'LinearAlignmentsDisplay',
      displayId: 'ngs_reads-LinearAlignmentsDisplay',
      height: 250,
    },
  ],
}
```

CRAM colored by CpG methylation (modBAM MM/ML tags):

```js
{
  type: 'AlignmentsTrack',
  trackId: 'methylation',
  name: 'Methylation',
  assemblyNames: ['hg38'],
  adapter: { type: 'CramAdapter', uri: 'https://example.com/sample.cram' },
  displays: [
    {
      type: 'LinearAlignmentsDisplay',
      displayId: 'methylation-LinearAlignmentsDisplay',
      colorBy: { type: 'methylation' },
    },
  ],
}
```

Long reads with soft-clipping shown and split/mate reads connected by arcs:

```js
{
  type: 'AlignmentsTrack',
  trackId: 'long_reads',
  name: 'Long reads',
  assemblyNames: ['hg38'],
  adapter: { type: 'BamAdapter', uri: 'https://example.com/longreads.bam' },
  displays: [
    {
      type: 'LinearAlignmentsDisplay',
      displayId: 'long_reads-LinearAlignmentsDisplay',
      height: 400,
      showSoftClipping: true,
      linkedReads: 'normal',
      readConnections: 'arc',
    },
  ],
}
```

## Overview

State model factory for LinearAlignmentsDisplay

## Members

| Member                                                                         | Kind       | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [type](#property-type)                                                         | Properties |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [configuration](#property-configuration)                                       | Properties |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [featureIdUnderMouse](#volatile-featureidundermouse)                           | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [mouseoverExtraInformation](#volatile-mouseoverextrainformation)               | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [contextMenuFeature](#volatile-contextmenufeature)                             | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [contextMenuCoord](#volatile-contextmenucoord)                                 | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [contextMenuCigarHit](#volatile-contextmenucigarhit)                           | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [contextMenuIndicatorHit](#volatile-contextmenuindicatorhit)                   | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [contextMenuGenomicPos](#volatile-contextmenugenomicpos)                       | Volatiles  | Genomic column under a right-click, anchoring the read menu's "sort at the clicked position" items. Set with the block/hits as a unit.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [contextMenuBlock](#volatile-contextmenublock)                                 | Volatiles  | The block under a right-click (refName + block-level worker result + bp range). The position sort reads its refName and the indicator/coverage detail items read its rpcData to open the aggregate widget (mirrors the left-click path in useAlignmentsBase).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [rpcDataMap](#volatile-rpcdatamap)                                             | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [scrollTop](#volatile-scrolltop)                                               | Volatiles  | pileup vertical scroll offset in px. Also read by the BreakpointSplitView overlay to position its SVG curves.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [collapsedGroups](#volatile-collapsedgroups)                                   | Volatiles  | Group keys whose pileup is collapsed to just its coverage band (in-track grouping). Keyed by group key so it survives re-fetches; volatile so it resets on reload. Stale keys from a prior grouping dimension are harmless — they never match the new keys.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [groupMaxHeightOverrides](#volatile-groupmaxheightoverrides)                   | Volatiles  | Per-group pileup height override in px (in-track grouping). Keyed by group key, volatile like `collapsedGroups`; absent keys fall back to the display-wide `maxHeight`. Lets a dense section be shrunk independently. Cleared by `setGroupBy`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [fittedHeightPx](#volatile-fittedheightpx)                                     | Volatiles  | Cache of the current fitted read height in px, kept in sync by the afterAttach autorun while `fitHeightToDisplay` is on. A volatile (not a getter) because the fit height derives from late layout getters that the early `featureHeight` getter can't reference — the autorun bridges that ordering. 0 until first computed / when nothing fits.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [highlightedChainIds](#volatile-highlightedchainids)                           | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [selectedChainIds](#volatile-selectedchainids)                                 | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [colorTagMap](#volatile-colortagmap)                                           | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [visibleModifications](#volatile-visiblemodifications)                         | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [modificationsReady](#volatile-modificationsready)                             | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [overCigarItem](#volatile-overcigaritem)                                       | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [hoverCoverageBand](#volatile-hovercoverageband)                               | Volatiles  | Screen-px coverage band of the section currently under a coverage/indicator hover. Drives the tooltip's vertical hover bar so it lands on the hovered group's coverage band, not always the top one. `undefined` when not hovering coverage.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [linkedReads](#getter-linkedreads)                                             | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [pairsSessionDefault](#getter-pairssessiondefault)                             | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [showBezierConnections](#getter-showbezierconnections)                         | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [showCoverage](#getter-showcoverage)                                           | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [showPileup](#getter-showpileup)                                               | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [coverageHeight](#getter-coverageheight)                                       | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [showMismatches](#getter-showmismatches)                                       | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [showInterbaseIndicators](#getter-showinterbaseindicators)                     | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [drawSingletons](#getter-drawsingletons)                                       | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [drawProperPairs](#getter-drawproperpairs)                                     | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [flipStrandLongReadChains](#getter-flipstrandlongreadchains)                   | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [colorSupplementaryChains](#getter-colorsupplementarychains)                   | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [drawInter](#getter-drawinter)                                                 | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [drawLongRange](#getter-drawlongrange)                                         | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [arcColorByType](#getter-arccolorbytype)                                       | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [readConnections](#getter-readconnections)                                     | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [arcsSessionDefault](#getter-arcssessiondefault)                               | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [readCloudSessionDefault](#getter-readcloudsessiondefault)                     | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [readConnectionsDown](#getter-readconnectionsdown)                             | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [readConnectionsDownSessionDefault](#getter-readconnectionsdownsessiondefault) | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [showSashimiArcs](#getter-showsashimiarcs)                                     | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [sashimiArcsMode](#getter-sashimiarcsmode)                                     | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [sashimiDownSessionDefault](#getter-sashimidownsessiondefault)                 | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [sashimiAutoSessionDefault](#getter-sashimiautosessiondefault)                 | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [minSashimiScore](#getter-minsashimiscore)                                     | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [sashimiArcsHeight](#getter-sashimiarcsheight)                                 | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [readConnectionsHeight](#getter-readconnectionsheight)                         | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [showSoftClipping](#getter-showsoftclipping)                                   | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [softClippingSessionDefault](#getter-softclippingsessiondefault)               | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [isChainMode](#getter-ischainmode)                                             | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [showLinkedReadLines](#getter-showlinkedreadlines)                             | Getters    | Whether to draw the straight-line pass connecting normal read-pairs in pileup layout. Only meaningful when bezier connections are on AND we are in pileup mode — chain layout has its own connecting-line pass that already covers normal pairs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [scaleType](#getter-scaletype)                                                 | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [autoscaleType](#getter-autoscaletype)                                         | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [minScore](#getter-minscore)                                                   | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [maxScore](#getter-maxscore)                                                   | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [minScoreBound](#getter-minscorebound)                                         | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [maxScoreBound](#getter-maxscorebound)                                         | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [numStdDev](#getter-numstddev)                                                 | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [featureWidgetType](#getter-featurewidgettype)                                 | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [selectedFeatureId](#getter-selectedfeatureid)                                 | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [TooltipComponent](#getter-tooltipcomponent)                                   | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [visibleModificationTypes](#getter-visiblemodificationtypes)                   | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [colorBy](#getter-colorby)                                                     | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [filterBy](#getter-filterby)                                                   | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [isFitting](#getter-isfitting)                                                 | Getters    | True when fit-to-display mode is on AND a pitch has been computed (`fittedHeightPx > 0`, i.e. there are rows and room to fit them). The single gate both size getters read, so it's obvious they either both split the fitted pitch or both fall back to config — never a mix.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [featureHeight](#getter-featureheight)                                         | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [featureSpacing](#getter-featurespacing)                                       | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [maxHeight](#getter-maxheight)                                                 | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [showSashimiLabels](#getter-showsashimilabels)                                 | Getters    | Whether to draw the supporting-read count on each sashimi arc. Resolved through the promotable-slot tiers (getConfResolved): a track configured `true` pins labels on; otherwise it follows the session-wide default, falling back to off.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [showSashimiLabelsSessionDefault](#getter-showsashimilabelssessiondefault)     | Getters    | "make this the default for all tracks" control (pin) for sashimi arc labels                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [chainIdMap](#getter-chainidmap)                                               | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [showLowFreqMismatches](#getter-showlowfreqmismatches)                         | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [mismatchAlpha](#getter-mismatchalpha)                                         | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [mismatchAlphaSessionDefault](#getter-mismatchalphasessiondefault)             | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [showLegend](#getter-showlegend)                                               | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [sortedBy](#getter-sortedby)                                                   | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [largeFeaturesFirst](#getter-largefeaturesfirst)                               | Getters    | Lay out the widest features in the lowest pileup rows (main-thread tier-2 relayout via laidOutPileupMap). LGVSyntenyDisplay defaults it on. Ignored while an explicit `sortedBy` position sort is active.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [groupBy](#getter-groupby)                                                     | Getters    | In-track stacked grouping dimension (undefined = ungrouped). Falls back to the `groupBy` config slot, so a track can be pre-grouped declaratively. Sent to the worker via rpcProps; the worker partitions one fetch into N sections.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [prefersOffset](#getter-prefersoffset)                                         | Getters    | Offset the track label above the visualization when grouping, so the stacked group sections aren't hidden behind an overlapping label.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [coverageIsLog](#getter-coverageislog)                                         | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [coverageStats](#getter-coveragestats)                                         | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [coverageDomain](#getter-coveragedomain)                                       | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [coverageTicks](#getter-coverageticks)                                         | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [colorLegendCategories](#getter-colorlegendcategories)                         | Getters    | Read-color buckets actually present across the rendered reads, the single input that lets the legend list only relevant swatches (see legendUtils). Shares readColorCategory with the renderer so the two can't disagree. Empty while the legend is hidden so the O(reads) scan is skipped; MobX memoizes it against rpcDataMap + scheme + mode.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [colorPalette](#getter-colorpalette)                                           | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [readCloudLegendCategories](#getter-readcloudlegendcategories)                 | Getters    | Legend categories contributed by the read-cloud (samplot) endpoint squares — the arc color slots actually plotted, mapped to legend buckets. Read-fill categories miss the cloud-only buckets (split junctions especially), so these are merged into the legend. Empty unless in samplot mode with the legend shown.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [belowCoverageBandsInput](#getter-belowcoveragebandsinput)                     | Getters    | Inputs to `belowCoverageBandsGeometry` — the below-coverage band settings plus whether any sashimi junction is present. Defined here (an earlier .views block than `belowCoverageBands`) so the fit-budget `laidOutByGroup` and the `belowCoverageBands` getter share one source.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [laidOutByGroup](#getter-laidoutbygroup)                                       | Getters    | Per-group laid-out data: group key → (region index → laid-out data). Each group lays out independently (own `maxRows` cap) so a dense group can't starve the rest. When grouped, the default cap fits all sections into the viewport (`fitGroupMaxRows`) so the stack doesn't tower and need scrolling; a per-group height drag / expand still overrides it. Tag colors are baked here (not in the worker) so colorTagMap stays a main-thread tier-2 setting — see readTagColors.                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [groupLayoutContext](#getter-grouplayoutcontext)                               | Getters    | The layout mechanics (grouping, sort, soft-clip, colors) shared by the viewport fit pass and any ad-hoc layout — e.g. `fittedFeatureHeight`, which lays every group out uncapped to count rows. Kept apart from the fit policy (row caps), which varies per call.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [groupOrder](#getter-grouporder)                                               | Getters    | Group keys + labels in stacking order; a single entry (key '') when ungrouped. Derived straight from the fetched `rpcDataMap` (not from the layout pass), so group identity/order stays stable across relayouts.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [laidOutPileupMap](#getter-laidoutpileupmap)                                   | Getters    | Renderer-facing per-region layout. Stage 2 draws a single section, so this exposes the first (for ungrouped, the only) group; Stage 3 switches the renderers to loop `sections` directly.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [sourceSections](#getter-sourcesections)                                       | Getters    | Per-section renderer input, in stacking order. One entry per group (the single key '' when ungrouped). Pairs each group's laid-out region map with its key so the renderers can namespace HAL region keys per section. Parallel to `renderState.sections`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [maxY](#getter-maxy)                                                           | Getters    | Row count of the primary group across its regions. This reads only the first group (`laidOutPileupMap`), so it is meaningful only on the single-section/ungrouped path (`searchFeatureByID` and the no-data synthetic section in `sections`). Grouped layout sizes each section from its own `groupMaxY`; don't use this as a cross-group aggregate.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [pileupTruncated](#getter-pileuptruncated)                                     | Getters    | True when the ungrouped pileup hit `maxHeight` and overflow reads were collapsed — drives the "max height reached" / "show all" banner. Only the ungrouped (single-group) case: grouped sections surface their own truncation per-label (`isGroupTruncated`), where raising `maxHeight` wouldn't lift the fit-to-viewport cap anyway — expanding the group does. Suppressed in fit-to-display mode for the same reason: reads there are already clamped to a 1px floor, so "Show all" can't deliver a fit — it only deepens the 1px scroll. The overflow indicator still flags the scroll in that case.                                                                                                                                                                                                                                                                                                                                                      |
| [rawDataByGroup](#getter-rawdatabygroup)                                       | Getters    | Raw (un-laid-out) data regrouped as group key → (region idx → data), insertion-ordered so the first key is the primary group. The arc compute and the per-section sashimi overlay both read one group's raw map from here; ungrouped is the single key `''`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [arcsByGroup](#getter-arcsbygroup)                                             | Getters    | Per-group arc upload feed: group key → (region idx → `ArcsUploadData`). The heavy `computeArcsFromPileupData` pass runs once per group (arcs are pre-grouped by refName so each region lookup is O(1)); ungrouped is the single-group case. Empty map when read-connections are off, so the off-path skips the per-read region scan entirely. Source of truth for the per-section arc feed (`sourceSections`) and the shared cross-group `arcsYDomainBp`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [modificationThreshold](#getter-modificationthreshold)                         | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [colorSchemeIndex](#getter-colorschemeindex)                                   | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [showModifications](#getter-showmodifications)                                 | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [showPerBaseQuality](#getter-showperbasequality)                               | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [showPerBaseLetter](#getter-showperbaseletter)                                 | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [readIdIndexMap](#getter-readidindexmap)                                       | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [readConnectionsLineWidth](#getter-readconnectionslinewidth)                   | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [belowCoverageBands](#getter-belowcoveragebands)                               | Getters    | Geometry of the bands stacked below coverage in arcs-down mode, top to bottom: coverage → paired-end arcs → sashimi. Single source of truth so the layout height, the renderers, and the three resize handles can't drift apart. `arcsBandTop`/`sashimiBandTop` are each band's top edge; `bottom` is where the pileup begins (== coverageDisplayHeight).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [coverageDisplayHeight](#getter-coveragedisplayheight)                         | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [sections](#getter-sections)                                                   | Getters    | Single source of all vertical band geometry, one entry per stacked group. `computeStackedSections` reproduces the prior ungrouped reserved layout exactly for its single-section (N==1) case, so ungrouped is not a special branch here — it is the one-group call, with a synthetic group when no data has arrived yet (so `laidOutPileupMap`/`renderState` still see one section). The sticky-coverage-vs-scroll distinction lives downstream in `buildSectionRenders`, keyed off section count.                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [renderSections](#getter-rendersections)                                       | Getters    | Per-section data + content-space band tops for the overlay/hit-test pipeline (labels, highlights, hit-test). Pairs each section's group data map with its `pileupTop` (used as the row `topOffset`) and coverage band so a screen-y can be mapped to the right section and its group. Reads straight off `sections` (every field already lives on the `Section`); ungrouped is the single section, so the pipeline reduces to pre-grouping.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [bezierPairSections](#getter-bezierpairsections)                               | Getters    | Scroll/pan-invariant half of the bezier connection overlay: the linked pairs of each section, resolved once per relayout. The read grouping + connection resolution (`enumerateBezierPairs`) is the allocation-heavy step; memoizing it here (this getter never reads `scrollTop`) keeps a scroll frame down to the cheap per-pair screen projection in `computePileupBezierArcsFromModel`. Empty when the overlay is off.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [bezierConnectionColorTypes](#getter-bezierconnectioncolortypes)               | Getters    | Connection types (LINKED_READ_COLOR_*) actually drawn as bezier/line arcs in view, the input that lets the legend list only the connection colors present. Mirrors the overlay's skip rule (normal within-region pairs are drawn by the GPU pipeline, not as arcs) so the key matches the curves. Empty while the legend is hidden so the scan is skipped.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [sashimiSections](#getter-sashimisections)                                     | Getters    | Per-section sashimi band placement, in stacking order. Each entry pairs a group's raw data (sashimi counts live per-group) with the content-space tops of _both_ sub-bands: `coverageOverlayTop` for arcs drawn over the coverage histogram and `sashimiBandTop` for arcs in the reserved strip below it. In 'auto' both are used at once; 'up'/'down' use one. The overlay and SVG export both map over this so their geometry can't drift; ungrouped is the single-section case (sticky band below sticky coverage, raw map == the only group). Empty when sashimi is off.                                                                                                                                                                                                                                                                                                                                                                                 |
| [isGrouped](#getter-isgrouped)                                                 | Getters    | True when reads are stacked into >1 group section. Drives the scroll model: ungrouped keeps coverage sticky (only the pileup scrolls); grouped scrolls the whole coverage+pileup stack as one.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [scrollModel](#getter-scrollmodel)                                             | Getters    | The scroll-projection inputs (`sectionScreen.ts`) every overlay needs to map a content-space Y into screen space. Built once here so the label / resize-handle / coverage-axis overlays don't each re-assemble `{ isGrouped, scrollTop, canvasHeight }` inline.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [pileupViewportHeight](#getter-pileupviewportheight)                           | Getters    | Height of the scrollable viewport. Ungrouped excludes the sticky coverage band; grouped scrolls the entire display.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [pileupContentHeight](#getter-pileupcontentheight)                             | Getters    | Total scrollable content height. Grouped is the full stacked-sections height; ungrouped is the pileup band alone (coverage is sticky), which is the stacked height minus that sticky coverage band. Both read the laid-out `sections` so the scroll extent tracks the geometry actually drawn — when `showPileup` is off or the group is collapsed the section reserves no pileup rows, so this collapses to 0 and no phantom scroll region opens up below the coverage band.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [grownHeight](#getter-grownheight)                                             | Getters    | Target track height for `grow` mode: the full laid-out content height (coverage + pileup + arcs), capped at `GROW_MAX_HEIGHT` so a deep pileup doesn't grow the track to thousands of px (a taller pileup fits to the cap and scrolls the remainder). Independent of `self.height` (in grow mode reads use the configured `featureHeight`, not the fitted pitch), so the grow autorun that writes it back can't feed back on itself. `setHeight` floors it to MIN_DISPLAY_HEIGHT.                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [height](#getter-height)                                                       | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [scalebarOverlapLeft](#getter-scalebaroverlapleft)                             | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [showOutline](#getter-showoutline)                                             | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [visibleLabels](#getter-visiblelabels)                                         | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [highlightChainIds](#getter-highlightchainids)                                 | Getters    | Chain member ids to highlight, empty unless in `normal` linked-read mode. Single source for the "is this a chain highlight" decision that both `highlightBoxes` (which ids to box) and `HighlightOverlay` (how strongly to shade them) read, so the two can't drift.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [highlightBoxes](#getter-highlightboxes)                                       | Getters    | Screen boxes for the hovered read / chain, painted by the `HighlightOverlay` div. Deliberately NOT part of `renderState`: the hovered id changes on nearly every mousemove, and routing it through the canvas would repaint the whole pileup each move.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [fittedFeatureHeight](#getter-fittedfeatureheight)                             | Getters    | The read height that makes every uncollapsed group's reads fill the display without scrolling. Row count is fixed by read overlaps, so we lay the groups out uncapped (a fixed maxHeight-row cap, independent of the current featureHeight — so the fit autorun that writes featureHeight can't feed back into this) and divide the pileup space by it. Fractional (not floored): the pileup then fills the display exactly rather than leaving up to a row of slack at the bottom. Clamped up to a 1px floor — below 1px the reads can't all fit, so the stack scrolls instead. 0 when there's nothing to fit (no data / no room), signalling "leave the configured height as-is". Reads the `fitTargetHeight` slot, NOT the reactive `height` getter — the same anti-cycle rule `laidOutByGroup` follows. Fit mode only, where the two are equal, but the slot can never chain back through height->grownHeight->layout->featureHeight if this ever moves. |
| [scrollableHeight](#getter-scrollableheight)                                   | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [sortTag](#getter-sorttag)                                                     | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [renderState](#getter-renderstate)                                             | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [arcsYDomainBp](#getter-arcsydomainbp)                                         | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [insertSizeTicks](#getter-insertsizeticks)                                     | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [featureUnderMouse](#getter-featureundermouse)                                 | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [isGroupCollapsed](#method-isgroupcollapsed)                                   | Methods    | Whether a stacked group's pileup is collapsed to just its coverage.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [hasGroupHeightOverride](#method-hasgroupheightoverride)                       | Methods    | Whether a stacked group carries a custom pileup-height override — set by expanding it (show all reads) or dragging its resize handle (taller or shorter). Drives the group label's restore-to-fit affordance.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [legendItems](#method-legenditems)                                             | Methods    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [groupLaidOutMap](#method-grouplaidoutmap)                                     | Methods    | Laid-out region map for one group key, or an empty map for a key with no data. Centralizes the empty-map fallback shared by the section getters so they never have to branch on a missing group.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [isGroupTruncated](#method-isgrouptruncated)                                   | Methods    | True when the row cap clipped reads from a group's pileup and the user hasn't explicitly sized that group (a height drag/expand makes any truncation intentional, so it isn't flagged). Drives the per-group "show all" affordance on the section label.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [findFeatureInRpcData](#method-findfeatureinrpcdata)                           | Methods    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [bezierLegendItems](#method-bezierlegenditems)                                 | Methods    | Legend swatches for the linked-read connection curves, empty unless the bezier overlay is on and at least one connection is in view.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [searchFeatureByID](#method-searchfeaturebyid)                                 | Methods    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [chainIdsForRead](#method-chainidsforread)                                     | Methods    | Chain IDs sharing a QNAME with the read at `index` in `rpcData`. Empty when the read isn't part of a chain. Shared by hover-highlight and click-select so the two paths can't drift.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [getFeatureInfoById](#method-getfeatureinfobyid)                               | Methods    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [rpcProps](#method-rpcprops)                                                   | Methods    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [trackMenuItems](#method-trackmenuitems)                                       | Methods    | Track menu items                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [contextMenuItems](#method-contextmenuitems)                                   | Methods    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [clearMouseoverState](#action-clearmouseoverstate)                             | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setError](#action-seterror)                                                   | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setRegionTooLarge](#action-setregiontoolarge)                                 | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setRpcData](#action-setrpcdata)                                               | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [clearDisplaySpecificData](#action-cleardisplayspecificdata)                   | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setOverCigarItem](#action-setovercigaritem)                                   | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setScrollTop](#action-setscrolltop)                                           | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setHighlightedChainIds](#action-sethighlightedchainids)                       | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [clearHighlights](#action-clearhighlights)                                     | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [clearSelection](#action-clearselection)                                       | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setSelectedChainIds](#action-setselectedchainids)                             | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setColorScheme](#action-setcolorscheme)                                       | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [updateColorTagMap](#action-updatecolortagmap)                                 | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setFilterBy](#action-setfilterby)                                             | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setShowSoftClipping](#action-setshowsoftclipping)                             | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setMismatchAlpha](#action-setmismatchalpha)                                   | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setSortedBy](#action-setsortedby)                                             | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setSortedByAtPosition](#action-setsortedbyatposition)                         | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [clearSortedBy](#action-clearsortedby)                                         | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setLargeFeaturesFirst](#action-setlargefeaturesfirst)                         | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setGroupBy](#action-setgroupby)                                               | Actions    | Set (or remove, when undefined) the in-track stacked grouping dimension. A tier-1 refetch setting (in `rpcProps`) — the worker re-partitions the fetch into N sections. Resets the Y scroll since the stacked content height changes. Ungrouping stores an explicit `null` override (not a cleared override) so it beats a configured `groupBy` default rather than falling back to it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [toggleGroupCollapsed](#action-togglegroupcollapsed)                           | Actions    | Collapse/expand a stacked group's pileup (coverage stays visible).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [toggleGroupExpanded](#action-togglegroupexpanded)                             | Actions    | Expand a fit-to-viewport group back to the full `maxHeight` cap (show all its reads), or, if it already carries a height override (from expand or a drag), drop the override to return it to the fit budget. Expanding makes the stack overflow the viewport, which engages the pileup scroll. Pairs with `hasGroupHeightOverride`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [resizeGroupHeight](#action-resizegroupheight)                                 | Actions    | Drag a stacked group's pileup band taller/shorter by `dy` px, capping how many rows that group lays out. The continuous-accumulation policy (seed once, floor at a row, pin/skip a fully-shown group) lives in the pure `nextGroupHeightOverride`; this action just gathers the group's live state and commits the result (undefined = leave on the fit budget). Pairs with `hasGroupHeightOverride` / `toggleGroupExpanded`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [setScaleType](#action-setscaletype)                                           | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setAutoscale](#action-setautoscale)                                           | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setMinScore](#action-setminscore)                                             | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setMaxScore](#action-setmaxscore)                                             | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setFeatureHeight](#action-setfeatureheight)                                   | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setFeatureSpacing](#action-setfeaturespacing)                                 | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setMaxHeight](#action-setmaxheight)                                           | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setCompactness](#action-setcompactness)                                       | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setFitHeightToDisplay](#action-setfitheighttodisplay)                         | Actions    | Enter/leave "fit to display height" mode. Entering resets the two bits of transient state that a uniform fit contradicts — per-group height overrides (a drag opts a group out of the fit budget) and the scroll offset (a fitted stack doesn't scroll). These clears are tied to the explicit user action on purpose: a track that inherits `fit` passively from a session-wide default keeps its overrides, so setting an unrelated default can't silently wipe a group the user dragged. The afterAttach autorun then keeps `featureHeight` sized to fit as the display/data change, regardless of how fit was entered.                                                                                                                                                                                                                                                                                                                                   |
| [setHeightMode](#action-setheightmode)                                         | Actions    | Set the track-height strategy by writing the unified `heightMode` slot; the modes are mutually exclusive by construction. Entering a non-`fixed` mode (fit or grow) resets the transient state a uniform fit/grow contradicts — per-group height overrides (a drag opts a group out) and the scroll offset (neither fit nor grow scrolls) — tied to the explicit user action so a track that merely inherits the mode from a session-wide default keeps its overrides. The driving autoruns then keep `featureHeight` (fit) or `height` (grow) sized as the display/data change.                                                                                                                                                                                                                                                                                                                                                                             |
| [setFittedHeightPx](#action-setfittedheightpx)                                 | Actions    | Cache the fitted read height so the `featureHeight`/`featureSpacing` getters can resolve to it. Written only by the driving autorun.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setShowSashimiArcs](#action-setshowsashimiarcs)                               | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setReadConnections](#action-setreadconnections)                               | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setReadConnectionsDown](#action-setreadconnectionsdown)                       | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setShowCoverage](#action-setshowcoverage)                                     | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setShowPileup](#action-setshowpileup)                                         | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setCoverageHeight](#action-setcoverageheight)                                 | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setReadConnectionsHeight](#action-setreadconnectionsheight)                   | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setSashimiArcsHeight](#action-setsashimiarcsheight)                           | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setMinSashimiScore](#action-setminsashimiscore)                               | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setSashimiArcsMode](#action-setsashimiarcsmode)                               | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setShowSashimiLabels](#action-setshowsashimilabels)                           | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setReadConnectionsLineWidth](#action-setreadconnectionslinewidth)             | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setDrawInter](#action-setdrawinter)                                           | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setDrawLongRange](#action-setdrawlongrange)                                   | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setArcColorByType](#action-setarccolorbytype)                                 | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setShowMismatches](#action-setshowmismatches)                                 | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setShowLegend](#action-setshowlegend)                                         | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setDrawSingletons](#action-setdrawsingletons)                                 | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setDrawProperPairs](#action-setdrawproperpairs)                               | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setShowInterbaseIndicators](#action-setshowinterbaseindicators)               | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setFlipStrandLongReadChains](#action-setflipstrandlongreadchains)             | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setColorSupplementaryChains](#action-setcolorsupplementarychains)             | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setLinkedReads](#action-setlinkedreads)                                       | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setShowBezierConnections](#action-setshowbezierconnections)                   | Actions    | Toggle the paired-read connection overlay. A main-thread tier-2/4 setting (read in `laidOutPileupMap` + `renderState`), not in `rpcProps` — toggling it never refetches.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [updateVisibleModifications](#action-updatevisiblemodifications)               | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setModificationsReady](#action-setmodificationsready)                         | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setFeatureIdUnderMouse](#action-setfeatureidundermouse)                       | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setMouseoverExtraInformation](#action-setmouseoverextrainformation)           | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setHoverState](#action-sethoverstate)                                         | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setContextMenuFeature](#action-setcontextmenufeature)                         | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [closeContextMenu](#action-closecontextmenu)                                   | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [selectFeature](#action-selectfeature)                                         | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [startRenderingBackend](#action-startrenderingbackend)                         | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [selectFeatureById](#action-selectfeaturebyid)                                 | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [openContextMenu](#action-opencontextmenu)                                     | Actions    | Open the right-click menu over a hit. Coord, block, and the two hit kinds always travel as a unit — set atomically so a consumer can never read a block without its hit (the split-state class of bug that silently no-op'd position sorts). The read feature is reset now and, when the hit carries one, populated by an async RPC fetch — so "open the menu for this hit and its read" stays a single call and a repositioned menu can't inherit the prior read's items.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [getByteEstimateConfig](#action-getbyteestimateconfig)                         | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [fetchNeeded](#action-fetchneeded)                                             | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [renderSvg](#action-rendersvg)                                                 | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [resizeHeight](#action-resizeheight)                                           | Actions    | A manual drag-resize means the user wants a fixed height; leave grow mode first, otherwise the grow autorun snaps the height back on the next relayout and the drag appears to do nothing (mirrors canvas).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

### LinearAlignmentsDisplay - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/linearalignmentsdisplay).

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [BaseDisplay](../basedisplay)

**Properties:** [id](../basedisplay#property-id),
[type](../basedisplay#property-type),
[rpcDriverName](../basedisplay#property-rpcdrivername)

**Volatiles:** [error](../basedisplay#volatile-error),
[statusMessage](../basedisplay#volatile-statusmessage),
[statusProgress](../basedisplay#volatile-statusprogress)

**Getters:** [parentTrack](../basedisplay#getter-parenttrack),
[parentDisplay](../basedisplay#getter-parentdisplay),
[RenderingComponent](../basedisplay#getter-renderingcomponent),
[DisplayBlurb](../basedisplay#getter-displayblurb),
[adapterConfig](../basedisplay#getter-adapterconfig),
[isMinimized](../basedisplay#getter-isminimized),
[effectiveRpcDriverName](../basedisplay#getter-effectiverpcdrivername),
[DisplayMessageComponent](../basedisplay#getter-displaymessagecomponent),
[viewMenuActions](../basedisplay#getter-viewmenuactions)

**Methods:** [renderingProps](../basedisplay#method-renderingprops),
[trackMenuItems](../basedisplay#method-trackmenuitems),
[regionCannotBeRendered](../basedisplay#method-regioncannotberendered)

**Actions:** [setStatusMessage](../basedisplay#action-setstatusmessage),
[setError](../basedisplay#action-seterror),
[setRpcDriverName](../basedisplay#action-setrpcdrivername),
[reload](../basedisplay#action-reload)

### Available via [TrackHeightMixin](../trackheightmixin)

**Volatiles:** [scrollTop](../trackheightmixin#volatile-scrolltop)

**Getters:** [height](../trackheightmixin#getter-height)

**Actions:** [setScrollTop](../trackheightmixin#action-setscrolltop),
[setHeight](../trackheightmixin#action-setheight),
[resizeHeight](../trackheightmixin#action-resizeheight)

### Available via [HeightModeMixin](../heightmodemixin)

**Getters:** [heightMode](../heightmodemixin#getter-heightmode),
[fitTargetHeight](../heightmodemixin#getter-fittargetheight),
[autoHeight](../heightmodemixin#getter-autoheight),
[fitHeightToDisplay](../heightmodemixin#getter-fitheighttodisplay)

### Available via [MultiRegionDisplayMixin](../multiregiondisplaymixin)

**Volatiles:**
[loadedRegions](../multiregiondisplaymixin#volatile-loadedregions)

**Getters:** [isReady](../multiregiondisplaymixin#getter-isready),
[viewportWithinLoadedData](../multiregiondisplaymixin#getter-viewportwithinloadeddata),
[svgReady](../multiregiondisplaymixin#getter-svgready),
[svgReadyExtraTerminal](../multiregiondisplaymixin#getter-svgreadyextraterminal),
[renderBlocks](../multiregiondisplaymixin#getter-renderblocks),
[displayPhase](../multiregiondisplaymixin#getter-displayphase)

**Actions:**
[setLoadedRegion](../multiregiondisplaymixin#action-setloadedregion),
[clearDisplaySpecificData](../multiregiondisplaymixin#action-cleardisplayspecificdata),
[clearAllRpcData](../multiregiondisplaymixin#action-clearallrpcdata),
[reload](../multiregiondisplaymixin#action-reload),
[invalidateLoadedRegions](../multiregiondisplaymixin#action-invalidateloadedregions),
[fetchNeeded](../multiregiondisplaymixin#action-fetchneeded),
[isCacheValid](../multiregiondisplaymixin#action-iscachevalid),
[getByteEstimateConfig](../multiregiondisplaymixin#action-getbyteestimateconfig),
[fetchRegions](../multiregiondisplaymixin#action-fetchregions),
[afterAttach](../multiregiondisplaymixin#action-afterattach)

### Available via [RegionTooLargeMixin](../regiontoolargemixin)

**Properties:**
[userByteSizeLimit](../regiontoolargemixin#property-userbytesizelimit)

**Volatiles:**
[regionTooLargeState](../regiontoolargemixin#volatile-regiontoolargestate),
[regionTooLargeReasonState](../regiontoolargemixin#volatile-regiontoolargereasonstate),
[featureDensityStats](../regiontoolargemixin#volatile-featuredensitystats)

**Getters:** [regionTooLarge](../regiontoolargemixin#getter-regiontoolarge),
[regionTooLargeReason](../regiontoolargemixin#getter-regiontoolargereason)

**Methods:**
[regionCannotBeRenderedText](../regiontoolargemixin#method-regioncannotberenderedtext)

**Actions:**
[setRegionTooLarge](../regiontoolargemixin#action-setregiontoolarge),
[setFeatureDensityStats](../regiontoolargemixin#action-setfeaturedensitystats),
[setFeatureDensityStatsLimit](../regiontoolargemixin#action-setfeaturedensitystatslimit),
[reload](../regiontoolargemixin#action-reload),
[forceLoad](../regiontoolargemixin#action-forceload)

### Available via [RenderLifecycleMixin](../renderlifecyclemixin)

**Volatiles:** [canvasDrawn](../renderlifecyclemixin#volatile-canvasdrawn),
[currentRenderingBackend](../renderlifecyclemixin#volatile-currentrenderingbackend),
[renderTick](../renderlifecyclemixin#volatile-rendertick),
[autorunsInstalled](../renderlifecyclemixin#volatile-autorunsinstalled),
[renderError](../renderlifecyclemixin#volatile-rendererror)

**Actions:** [markCanvasDrawn](../renderlifecyclemixin#action-markcanvasdrawn),
[resetCanvasDrawn](../renderlifecyclemixin#action-resetcanvasdrawn),
[stopRenderingBackend](../renderlifecyclemixin#action-stoprenderingbackend),
[renderNow](../renderlifecyclemixin#action-rendernow),
[setRenderError](../renderlifecyclemixin#action-setrendererror),
[attachRenderingBackend](../renderlifecyclemixin#action-attachrenderingbackend)

### Available via [FetchMixin](../fetchmixin)

**Volatiles:** [activeStopToken](../fetchmixin#volatile-activestoptoken),
[fetchGeneration](../fetchmixin#volatile-fetchgeneration),
[error](../fetchmixin#volatile-error),
[statusMessage](../fetchmixin#volatile-statusmessage),
[statusProgress](../fetchmixin#volatile-statusprogress),
[fetchCanceled](../fetchmixin#volatile-fetchcanceled),
[regionStatuses](../fetchmixin#volatile-regionstatuses),
[lastStatusMs](../fetchmixin#volatile-laststatusms)

**Getters:** [isLoading](../fetchmixin#getter-isloading)

**Methods:** [makeStatusCallback](../fetchmixin#method-makestatuscallback),
[makeRegionStatusCallback](../fetchmixin#method-makeregionstatuscallback)

**Actions:** [setError](../fetchmixin#action-seterror),
[setStatusMessage](../fetchmixin#action-setstatusmessage),
[throttleStatus](../fetchmixin#action-throttlestatus),
[resetStatus](../fetchmixin#action-resetstatus),
[stopActiveFetch](../fetchmixin#action-stopactivefetch),
[setRegionStatus](../fetchmixin#action-setregionstatus),
[cancelFetch](../fetchmixin#action-cancelfetch),
[cancelFetchByUser](../fetchmixin#action-cancelfetchbyuser),
[runFetch](../fetchmixin#action-runfetch)

### Available via [PromotableDefaultsMixin](../promotabledefaultsmixin)

**Methods:**
[sessionDefaultChanges](../promotabledefaultsmixin#method-sessiondefaultchanges)

**Actions:**
[clearSessionDefaults](../promotabledefaultsmixin#action-clearsessiondefaults)

<details>
<summary>LinearAlignmentsDisplay - Properties</summary>

#### property: type

```ts
// type signature
type type = ISimpleType<'LinearAlignmentsDisplay'>
// code
type: types.literal('LinearAlignmentsDisplay')
```

#### property: configuration

```ts
// type signature
type configuration = ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

</details>

<details>
<summary>LinearAlignmentsDisplay - Volatiles</summary>

#### volatile: contextMenuGenomicPos

Genomic column under a right-click, anchoring the read menu's "sort at the
clicked position" items. Set with the block/hits as a unit.

```ts
// type signature
type contextMenuGenomicPos = number | undefined
// code
contextMenuGenomicPos: undefined as number | undefined
```

#### volatile: contextMenuBlock

The block under a right-click (refName + block-level worker result + bp range).
The position sort reads its refName and the indicator/coverage detail items read
its rpcData to open the aggregate widget (mirrors the left-click path in
useAlignmentsBase).

```ts
// type signature
type contextMenuBlock = ResolvedBlock | undefined
// code
contextMenuBlock: undefined as ResolvedBlock | undefined
```

#### volatile: scrollTop

pileup vertical scroll offset in px. Also read by the BreakpointSplitView
overlay to position its SVG curves.

```ts
// type signature
type scrollTop = number
// code
scrollTop: 0
```

#### volatile: collapsedGroups

Group keys whose pileup is collapsed to just its coverage band (in-track
grouping). Keyed by group key so it survives re-fetches; volatile so it resets
on reload. Stale keys from a prior grouping dimension are harmless — they never
match the new keys.

```ts
// type signature
type collapsedGroups = ObservableSet<string>
// code
collapsedGroups: observable.set<string>()
```

#### volatile: groupMaxHeightOverrides

Per-group pileup height override in px (in-track grouping). Keyed by group key,
volatile like `collapsedGroups`; absent keys fall back to the display-wide
`maxHeight`. Lets a dense section be shrunk independently. Cleared by
`setGroupBy`.

```ts
// type signature
type groupMaxHeightOverrides = ObservableMap<string, number>
// code
groupMaxHeightOverrides: observable.map<string, number>()
```

#### volatile: fittedHeightPx

Cache of the current fitted read height in px, kept in sync by the afterAttach
autorun while `fitHeightToDisplay` is on. A volatile (not a getter) because the
fit height derives from late layout getters that the early `featureHeight`
getter can't reference — the autorun bridges that ordering. 0 until first
computed / when nothing fits.

```ts
// type signature
type fittedHeightPx = number
// code
fittedHeightPx: 0
```

#### volatile: hoverCoverageBand

Screen-px coverage band of the section currently under a coverage/indicator
hover. Drives the tooltip's vertical hover bar so it lands on the hovered
group's coverage band, not always the top one. `undefined` when not hovering
coverage.

```ts
// type signature
type hoverCoverageBand =
  { topOffset: number; coverageHeight: number } | undefined
// code
hoverCoverageBand: undefined as
  { topOffset: number; coverageHeight: number } | undefined
```

</details>

<details>
<summary>LinearAlignmentsDisplay - Volatiles (other undocumented members)</summary>

#### volatile: featureIdUnderMouse

```ts
// type signature
type featureIdUnderMouse = string | undefined
// code
featureIdUnderMouse: undefined as undefined | string
```

#### volatile: mouseoverExtraInformation

```ts
// type signature
type mouseoverExtraInformation = TooltipPayload | undefined
// code
mouseoverExtraInformation: undefined as TooltipPayload | undefined
```

#### volatile: contextMenuFeature

```ts
// type signature
type contextMenuFeature = Feature | undefined
// code
contextMenuFeature: undefined as Feature | undefined
```

#### volatile: contextMenuCoord

```ts
// type signature
type contextMenuCoord = [number, number] | undefined
// code
contextMenuCoord: undefined as [number, number] | undefined
```

#### volatile: contextMenuCigarHit

```ts
// type signature
type contextMenuCigarHit = CigarHitResult | undefined
// code
contextMenuCigarHit: undefined as CigarHitResult | undefined
```

#### volatile: contextMenuIndicatorHit

```ts
// type signature
type contextMenuIndicatorHit = IndicatorHitResult | undefined
// code
contextMenuIndicatorHit: undefined as IndicatorHitResult | undefined
```

#### volatile: rpcDataMap

```ts
// type signature
type rpcDataMap = ObservableMap<number, GroupedAlignmentsResult>
// code
rpcDataMap: observable.map<number, GroupedAlignmentsResult>(undefined, {
  deep: false,
})
```

#### volatile: highlightedChainIds

```ts
// type signature
type highlightedChainIds = string[]
// code
highlightedChainIds: [] as string[]
```

#### volatile: selectedChainIds

```ts
// type signature
type selectedChainIds = string[]
// code
selectedChainIds: [] as string[]
```

#### volatile: colorTagMap

```ts
// type signature
type colorTagMap = Record<string, string>
// code
colorTagMap
```

#### volatile: visibleModifications

```ts
// type signature
type visibleModifications = ObservableMap<string, ModificationTypeWithColor>
// code
visibleModifications: observable.map<string, ModificationTypeWithColor>({})
```

#### volatile: modificationsReady

```ts
// type signature
type modificationsReady = false
// code
modificationsReady: false
```

#### volatile: overCigarItem

```ts
// type signature
type overCigarItem = false
// code
overCigarItem: false
```

</details>

<details>
<summary>LinearAlignmentsDisplay - Getters</summary>

#### getter: showLinkedReadLines

Whether to draw the straight-line pass connecting normal read-pairs in pileup
layout. Only meaningful when bezier connections are on AND we are in pileup mode
— chain layout has its own connecting-line pass that already covers normal
pairs.

```ts
type showLinkedReadLines = boolean
```

#### getter: isFitting

True when fit-to-display mode is on AND a pitch has been computed
(`fittedHeightPx > 0`, i.e. there are rows and room to fit them). The single
gate both size getters read, so it's obvious they either both split the fitted
pitch or both fall back to config — never a mix.

```ts
type isFitting = boolean
```

#### getter: showSashimiLabels

Whether to draw the supporting-read count on each sashimi arc. Resolved through
the promotable-slot tiers (getConfResolved): a track configured `true` pins
labels on; otherwise it follows the session-wide default, falling back to off.

```ts
type showSashimiLabels = boolean
```

#### getter: showSashimiLabelsSessionDefault

"make this the default for all tracks" control (pin) for sashimi arc labels

```ts
type showSashimiLabelsSessionDefault = SessionDefaultControl
```

#### getter: largeFeaturesFirst

Lay out the widest features in the lowest pileup rows (main-thread tier-2
relayout via laidOutPileupMap). LGVSyntenyDisplay defaults it on. Ignored while
an explicit `sortedBy` position sort is active.

```ts
type largeFeaturesFirst = boolean
```

#### getter: groupBy

In-track stacked grouping dimension (undefined = ungrouped). Falls back to the
`groupBy` config slot, so a track can be pre-grouped declaratively. Sent to the
worker via rpcProps; the worker partitions one fetch into N sections.

```ts
type groupBy = GroupBy | undefined
```

#### getter: prefersOffset

Offset the track label above the visualization when grouping, so the stacked
group sections aren't hidden behind an overlapping label.

```ts
type prefersOffset = boolean
```

#### getter: colorLegendCategories

Read-color buckets actually present across the rendered reads, the single input
that lets the legend list only relevant swatches (see legendUtils). Shares
readColorCategory with the renderer so the two can't disagree. Empty while the
legend is hidden so the O(reads) scan is skipped; MobX memoizes it against
rpcDataMap + scheme + mode.

```ts
type colorLegendCategories = Set<ReadColorCategory>
```

#### getter: readCloudLegendCategories

Legend categories contributed by the read-cloud (samplot) endpoint squares — the
arc color slots actually plotted, mapped to legend buckets. Read-fill categories
miss the cloud-only buckets (split junctions especially), so these are merged
into the legend. Empty unless in samplot mode with the legend shown.

```ts
type readCloudLegendCategories = Set<ReadColorCategory>
```

#### getter: belowCoverageBandsInput

Inputs to `belowCoverageBandsGeometry` — the below-coverage band settings plus
whether any sashimi junction is present. Defined here (an earlier .views block
than `belowCoverageBands`) so the fit-budget `laidOutByGroup` and the
`belowCoverageBands` getter share one source.

```ts
type belowCoverageBandsInput = {
  showCoverage: boolean
  coverageHeight: number
  readConnections: ReadConnectionsMode
  readConnectionsDown: boolean
  readConnectionsHeight: number
  showSashimiArcs: boolean
  sashimiArcsMode: SashimiArcsMode
  sashimiArcsHeight: number
  hasSashimiArcs: boolean
}
```

#### getter: laidOutByGroup

Per-group laid-out data: group key → (region index → laid-out data). Each group
lays out independently (own `maxRows` cap) so a dense group can't starve the
rest. When grouped, the default cap fits all sections into the viewport
(`fitGroupMaxRows`) so the stack doesn't tower and need scrolling; a per-group
height drag / expand still overrides it. Tag colors are baked here (not in the
worker) so colorTagMap stays a main-thread tier-2 setting — see readTagColors.

```ts
type laidOutByGroup = LaidOutByGroup
```

#### getter: groupLayoutContext

The layout mechanics (grouping, sort, soft-clip, colors) shared by the viewport
fit pass and any ad-hoc layout — e.g. `fittedFeatureHeight`, which lays every
group out uncapped to count rows. Kept apart from the fit policy (row caps),
which varies per call.

```ts
type groupLayoutContext = { order: GroupId[]; rawByGroup: Map<string, Map<number, PileupDataResult>>; isChainMode: boolean; sortedBy: SortedBy | undefined; ... 5 more ...; colorTagMap: Record<...>; }
```

#### getter: groupOrder

Group keys + labels in stacking order; a single entry (key '') when ungrouped.
Derived straight from the fetched `rpcDataMap` (not from the layout pass), so
group identity/order stays stable across relayouts.

```ts
type groupOrder = GroupId[]
```

#### getter: laidOutPileupMap

Renderer-facing per-region layout. Stage 2 draws a single section, so this
exposes the first (for ungrouped, the only) group; Stage 3 switches the
renderers to loop `sections` directly.

```ts
type laidOutPileupMap = Map<number, PileupDataResult>
```

#### getter: sourceSections

Per-section renderer input, in stacking order. One entry per group (the single
key '' when ungrouped). Pairs each group's laid-out region map with its key so
the renderers can namespace HAL region keys per section. Parallel to
`renderState.sections`.

```ts
type sourceSections = {
  groupKey: string
  laidOutPileupMap: Map<number, PileupDataResult>
  arcsRpcDataMap: Map<number, ArcsUploadData>
}[]
```

#### getter: maxY

Row count of the primary group across its regions. This reads only the first
group (`laidOutPileupMap`), so it is meaningful only on the
single-section/ungrouped path (`searchFeatureByID` and the no-data synthetic
section in `sections`). Grouped layout sizes each section from its own
`groupMaxY`; don't use this as a cross-group aggregate.

```ts
type maxY = number
```

#### getter: pileupTruncated

True when the ungrouped pileup hit `maxHeight` and overflow reads were collapsed
— drives the "max height reached" / "show all" banner. Only the ungrouped
(single-group) case: grouped sections surface their own truncation per-label
(`isGroupTruncated`), where raising `maxHeight` wouldn't lift the
fit-to-viewport cap anyway — expanding the group does. Suppressed in
fit-to-display mode for the same reason: reads there are already clamped to a
1px floor, so "Show all" can't deliver a fit — it only deepens the 1px scroll.
The overflow indicator still flags the scroll in that case.

```ts
type pileupTruncated = boolean
```

#### getter: rawDataByGroup

Raw (un-laid-out) data regrouped as group key → (region idx → data),
insertion-ordered so the first key is the primary group. The arc compute and the
per-section sashimi overlay both read one group's raw map from here; ungrouped
is the single key `''`.

```ts
type rawDataByGroup = Map<string, Map<number, PileupDataResult>>
```

#### getter: arcsByGroup

Per-group arc upload feed: group key → (region idx → `ArcsUploadData`). The
heavy `computeArcsFromPileupData` pass runs once per group (arcs are pre-grouped
by refName so each region lookup is O(1)); ungrouped is the single-group case.
Empty map when read-connections are off, so the off-path skips the per-read
region scan entirely. Source of truth for the per-section arc feed
(`sourceSections`) and the shared cross-group `arcsYDomainBp`.

```ts
type arcsByGroup = Map<string, Map<number, ArcsUploadData>>
```

#### getter: belowCoverageBands

Geometry of the bands stacked below coverage in arcs-down mode, top to bottom:
coverage → paired-end arcs → sashimi. Single source of truth so the layout
height, the renderers, and the three resize handles can't drift apart.
`arcsBandTop`/`sashimiBandTop` are each band's top edge; `bottom` is where the
pileup begins (== coverageDisplayHeight).

```ts
type belowCoverageBands = {
  hasArcsBand: boolean
  hasSashimiBand: boolean
  arcsBandTop: number
  sashimiBandTop: number
  bottom: number
}
```

#### getter: sections

Single source of all vertical band geometry, one entry per stacked group.
`computeStackedSections` reproduces the prior ungrouped reserved layout exactly
for its single-section (N==1) case, so ungrouped is not a special branch here —
it is the one-group call, with a synthetic group when no data has arrived yet
(so `laidOutPileupMap`/`renderState` still see one section). The
sticky-coverage-vs-scroll distinction lives downstream in `buildSectionRenders`,
keyed off section count.

```ts
type sections = SectionsLayout
```

#### getter: renderSections

Per-section data + content-space band tops for the overlay/hit-test pipeline
(labels, highlights, hit-test). Pairs each section's group data map with its
`pileupTop` (used as the row `topOffset`) and coverage band so a screen-y can be
mapped to the right section and its group. Reads straight off `sections` (every
field already lives on the `Section`); ungrouped is the single section, so the
pipeline reduces to pre-grouping.

```ts
type renderSections = {
  groupKey: string
  label: string
  laidOutPileupMap: Map<number, PileupDataResult>
  topOffset: number
  coverageTop: number
  coverageHeight: number
  sashimiBandTop: number
  pileupHeight: number
}[]
```

#### getter: bezierPairSections

Scroll/pan-invariant half of the bezier connection overlay: the linked pairs of
each section, resolved once per relayout. The read grouping + connection
resolution (`enumerateBezierPairs`) is the allocation-heavy step; memoizing it
here (this getter never reads `scrollTop`) keeps a scroll frame down to the
cheap per-pair screen projection in `computePileupBezierArcsFromModel`. Empty
when the overlay is off.

```ts
type bezierPairSections = {
  topOffset: number
  pileupHeight: number
  pairs: LinkedPair[]
}[]
```

#### getter: bezierConnectionColorTypes

Connection types (LINKED_READ_COLOR_*) actually drawn as bezier/line arcs in
view, the input that lets the legend list only the connection colors present.
Mirrors the overlay's skip rule (normal within-region pairs are drawn by the GPU
pipeline, not as arcs) so the key matches the curves. Empty while the legend is
hidden so the scan is skipped.

```ts
type bezierConnectionColorTypes = Set<number>
```

#### getter: sashimiSections

Per-section sashimi band placement, in stacking order. Each entry pairs a
group's raw data (sashimi counts live per-group) with the content-space tops of
_both_ sub-bands: `coverageOverlayTop` for arcs drawn over the coverage
histogram and `sashimiBandTop` for arcs in the reserved strip below it. In
'auto' both are used at once; 'up'/'down' use one. The overlay and SVG export
both map over this so their geometry can't drift; ungrouped is the
single-section case (sticky band below sticky coverage, raw map == the only
group). Empty when sashimi is off.

```ts
type sashimiSections = {
  groupKey: string
  rpcDataMap: Map<number, PileupDataResult>
  coverageOverlayTop: number
  sashimiBandTop: number
}[]
```

#### getter: isGrouped

True when reads are stacked into >1 group section. Drives the scroll model:
ungrouped keeps coverage sticky (only the pileup scrolls); grouped scrolls the
whole coverage+pileup stack as one.

```ts
type isGrouped = boolean
```

#### getter: scrollModel

The scroll-projection inputs (`sectionScreen.ts`) every overlay needs to map a
content-space Y into screen space. Built once here so the label / resize-handle
/ coverage-axis overlays don't each re-assemble
`{ isGrouped, scrollTop, canvasHeight }` inline.

```ts
type scrollModel = ScrollModel
```

#### getter: pileupViewportHeight

Height of the scrollable viewport. Ungrouped excludes the sticky coverage band;
grouped scrolls the entire display.

```ts
type pileupViewportHeight = number
```

#### getter: pileupContentHeight

Total scrollable content height. Grouped is the full stacked-sections height;
ungrouped is the pileup band alone (coverage is sticky), which is the stacked
height minus that sticky coverage band. Both read the laid-out `sections` so the
scroll extent tracks the geometry actually drawn — when `showPileup` is off or
the group is collapsed the section reserves no pileup rows, so this collapses to
0 and no phantom scroll region opens up below the coverage band.

```ts
type pileupContentHeight = number
```

#### getter: grownHeight

Target track height for `grow` mode: the full laid-out content height
(coverage + pileup + arcs), capped at `GROW_MAX_HEIGHT` so a deep pileup doesn't
grow the track to thousands of px (a taller pileup fits to the cap and scrolls
the remainder). Independent of `self.height` (in grow mode reads use the
configured `featureHeight`, not the fitted pitch), so the grow autorun that
writes it back can't feed back on itself. `setHeight` floors it to
MIN_DISPLAY_HEIGHT.

```ts
type grownHeight = number
```

#### getter: highlightChainIds

Chain member ids to highlight, empty unless in `normal` linked-read mode. Single
source for the "is this a chain highlight" decision that both `highlightBoxes`
(which ids to box) and `HighlightOverlay` (how strongly to shade them) read, so
the two can't drift.

```ts
type highlightChainIds = string[]
```

#### getter: highlightBoxes

Screen boxes for the hovered read / chain, painted by the `HighlightOverlay`
div. Deliberately NOT part of `renderState`: the hovered id changes on nearly
every mousemove, and routing it through the canvas would repaint the whole
pileup each move.

```ts
type highlightBoxes = HighlightBox[]
```

#### getter: fittedFeatureHeight

The read height that makes every uncollapsed group's reads fill the display
without scrolling. Row count is fixed by read overlaps, so we lay the groups out
uncapped (a fixed maxHeight-row cap, independent of the current featureHeight —
so the fit autorun that writes featureHeight can't feed back into this) and
divide the pileup space by it.

Fractional (not floored): the pileup then fills the display exactly rather than
leaving up to a row of slack at the bottom. Clamped up to a 1px floor — below
1px the reads can't all fit, so the stack scrolls instead. 0 when there's
nothing to fit (no data / no room), signalling "leave the configured height
as-is".

Reads the `fitTargetHeight` slot, NOT the reactive `height` getter — the same
anti-cycle rule `laidOutByGroup` follows. Fit mode only, where the two are
equal, but the slot can never chain back through
height->grownHeight->layout->featureHeight if this ever moves.

```ts
type fittedFeatureHeight = number
```

</details>

<details>
<summary>LinearAlignmentsDisplay - Getters (other undocumented members)</summary>

#### getter: linkedReads

```ts
type linkedReads = LinkedReadsMode
```

#### getter: pairsSessionDefault

```ts
type pairsSessionDefault = SessionDefaultControl
```

#### getter: showBezierConnections

```ts
type showBezierConnections = boolean
```

#### getter: showCoverage

```ts
type showCoverage = boolean
```

#### getter: showPileup

```ts
type showPileup = boolean
```

#### getter: coverageHeight

```ts
type coverageHeight = number
```

#### getter: showMismatches

```ts
type showMismatches = boolean
```

#### getter: showInterbaseIndicators

```ts
type showInterbaseIndicators = boolean
```

#### getter: drawSingletons

```ts
type drawSingletons = boolean
```

#### getter: drawProperPairs

```ts
type drawProperPairs = boolean
```

#### getter: flipStrandLongReadChains

```ts
type flipStrandLongReadChains = boolean
```

#### getter: colorSupplementaryChains

```ts
type colorSupplementaryChains = boolean
```

#### getter: drawInter

```ts
type drawInter = boolean
```

#### getter: drawLongRange

```ts
type drawLongRange = boolean
```

#### getter: arcColorByType

```ts
type arcColorByType = ArcColorByType
```

#### getter: readConnections

```ts
type readConnections = ReadConnectionsMode
```

#### getter: arcsSessionDefault

```ts
type arcsSessionDefault = SessionDefaultControl
```

#### getter: readCloudSessionDefault

```ts
type readCloudSessionDefault = SessionDefaultControl
```

#### getter: readConnectionsDown

```ts
type readConnectionsDown = boolean
```

#### getter: readConnectionsDownSessionDefault

```ts
type readConnectionsDownSessionDefault = SessionDefaultControl
```

#### getter: showSashimiArcs

```ts
type showSashimiArcs = boolean
```

#### getter: sashimiArcsMode

```ts
type sashimiArcsMode = SashimiArcsMode
```

#### getter: sashimiDownSessionDefault

```ts
type sashimiDownSessionDefault = SessionDefaultControl
```

#### getter: sashimiAutoSessionDefault

```ts
type sashimiAutoSessionDefault = SessionDefaultControl
```

#### getter: minSashimiScore

```ts
type minSashimiScore = number
```

#### getter: sashimiArcsHeight

```ts
type sashimiArcsHeight = number
```

#### getter: readConnectionsHeight

```ts
type readConnectionsHeight = number
```

#### getter: showSoftClipping

```ts
type showSoftClipping = boolean
```

#### getter: softClippingSessionDefault

```ts
type softClippingSessionDefault = SessionDefaultControl
```

#### getter: isChainMode

```ts
type isChainMode = boolean
```

#### getter: scaleType

```ts
type scaleType = any
```

#### getter: autoscaleType

```ts
type autoscaleType = any
```

#### getter: minScore

```ts
type minScore = any
```

#### getter: maxScore

```ts
type maxScore = any
```

#### getter: minScoreBound

```ts
type minScoreBound = any
```

#### getter: maxScoreBound

```ts
type maxScoreBound = any
```

#### getter: numStdDev

```ts
type numStdDev = any
```

#### getter: featureWidgetType

```ts
type featureWidgetType = { type: string; id: string }
```

#### getter: selectedFeatureId

```ts
type selectedFeatureId = string | undefined
```

#### getter: TooltipComponent

```ts
type TooltipComponent = LazyExoticComponent<
  ({
    model,
    clientMouseCoord,
    offsetMouseCoord,
  }: {
    model: {
      mouseoverExtraInformation: TooltipPayload | undefined
      hoverCoverageBand:
        { topOffset: number; coverageHeight: number } | undefined
    }
    offsetMouseCoord?: Coord | undefined
    clientMouseCoord: Coord
  }) => Element | null
>
```

#### getter: visibleModificationTypes

```ts
type visibleModificationTypes = string[]
```

#### getter: colorBy

```ts
type colorBy = ColorBy
```

#### getter: filterBy

```ts
type filterBy = FilterBy
```

#### getter: featureHeight

```ts
type featureHeight = number
```

#### getter: featureSpacing

```ts
type featureSpacing = number
```

#### getter: maxHeight

```ts
type maxHeight = any
```

#### getter: chainIdMap

```ts
type chainIdMap = Map<string, string[]>
```

#### getter: showLowFreqMismatches

```ts
type showLowFreqMismatches = boolean
```

#### getter: mismatchAlpha

```ts
type mismatchAlpha = boolean
```

#### getter: mismatchAlphaSessionDefault

```ts
type mismatchAlphaSessionDefault = SessionDefaultControl
```

#### getter: showLegend

```ts
type showLegend = boolean
```

#### getter: sortedBy

```ts
type sortedBy = SortedBy | undefined
```

#### getter: coverageIsLog

```ts
type coverageIsLog = boolean
```

#### getter: coverageStats

```ts
type coverageStats = ScoreStats | undefined
```

#### getter: coverageDomain

```ts
type coverageDomain = [number, number] | undefined
```

#### getter: coverageTicks

```ts
type coverageTicks = YScaleTicks | undefined
```

#### getter: colorPalette

```ts
type colorPalette = ColorPalette
```

#### getter: modificationThreshold

```ts
type modificationThreshold = number
```

#### getter: colorSchemeIndex

```ts
type colorSchemeIndex = number
```

#### getter: showModifications

```ts
type showModifications = boolean
```

#### getter: showPerBaseQuality

```ts
type showPerBaseQuality = boolean
```

#### getter: showPerBaseLetter

```ts
type showPerBaseLetter = boolean
```

#### getter: readIdIndexMap

```ts
type readIdIndexMap = Map<
  string,
  { displayedRegionIndex: number; groupKey: string; idx: number }
>
```

#### getter: readConnectionsLineWidth

```ts
type readConnectionsLineWidth = any
```

#### getter: coverageDisplayHeight

```ts
type coverageDisplayHeight = number
```

#### getter: height

```ts
type height = number
```

#### getter: scalebarOverlapLeft

```ts
type scalebarOverlapLeft = number
```

#### getter: showOutline

```ts
type showOutline = any
```

#### getter: visibleLabels

```ts
type visibleLabels = VisibleLabel[]
```

#### getter: scrollableHeight

```ts
type scrollableHeight = number
```

#### getter: sortTag

```ts
type sortTag = string | undefined
```

#### getter: renderState

```ts
type renderState = { scrollTop: number; colorScheme: number; featureHeight: number; featureSpacing: number; showCoverage: boolean; coverageHeight: number; coverageYOffset: number; coverageMaxDepth: number | undefined; ... 26 more ...; arcsYDomainBp: number | undefined; }
```

#### getter: arcsYDomainBp

```ts
type arcsYDomainBp = number | undefined
```

#### getter: insertSizeTicks

```ts
type insertSizeTicks = YScaleTicks | undefined
```

#### getter: featureUnderMouse

```ts
type featureUnderMouse = SimpleFeature | undefined
```

</details>

<details>
<summary>LinearAlignmentsDisplay - Methods</summary>

#### method: isGroupCollapsed

Whether a stacked group's pileup is collapsed to just its coverage.

```ts
type isGroupCollapsed = (key: string) => boolean
```

#### method: hasGroupHeightOverride

Whether a stacked group carries a custom pileup-height override — set by
expanding it (show all reads) or dragging its resize handle (taller or shorter).
Drives the group label's restore-to-fit affordance.

```ts
type hasGroupHeightOverride = (key: string) => boolean
```

#### method: groupLaidOutMap

Laid-out region map for one group key, or an empty map for a key with no data.
Centralizes the empty-map fallback shared by the section getters so they never
have to branch on a missing group.

```ts
type groupLaidOutMap = (key: string) => Map<number, PileupDataResult>
```

#### method: isGroupTruncated

True when the row cap clipped reads from a group's pileup and the user hasn't
explicitly sized that group (a height drag/expand makes any truncation
intentional, so it isn't flagged). Drives the per-group "show all" affordance on
the section label.

```ts
type isGroupTruncated = (key: string) => boolean
```

#### method: bezierLegendItems

Legend swatches for the linked-read connection curves, empty unless the bezier
overlay is on and at least one connection is in view.

```ts
type bezierLegendItems = () => LegendItem[]
```

#### method: chainIdsForRead

Chain IDs sharing a QNAME with the read at `index` in `rpcData`. Empty when the
read isn't part of a chain. Shared by hover-highlight and click-select so the
two paths can't drift.

```ts
type chainIdsForRead = (rpcData: PileupDataResult, index: number) => string[]
```

#### method: trackMenuItems

Track menu items

```ts
type trackMenuItems = () => (MenuItem | { label: string; type: "subMenu"; icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; subMenu: MenuItem[]; } | { ...; } | { ...; } | { ...; })[]
```

</details>

<details>
<summary>LinearAlignmentsDisplay - Methods (other undocumented members)</summary>

#### method: legendItems

```ts
type legendItems = () => LegendItem[]
```

#### method: findFeatureInRpcData

```ts
type findFeatureInRpcData = (featureId: string) =>
  | {
      displayedRegionIndex: number
      idx: number
      rpcData: PileupDataResult
      start: number
      end: number
    }
  | undefined
```

#### method: searchFeatureByID

```ts
type searchFeatureByID = (
  featureId: string,
) => [number, number, number, number] | undefined
```

#### method: getFeatureInfoById

```ts
type getFeatureInfoById = (featureId: string) =>
  | {
      id: string
      name: string
      start: number
      end: number
      flags: number
      mapq: number
      strand: number
      refName: string
    }
  | undefined
```

#### method: rpcProps

```ts
type rpcProps = () => {
  filterBy: FilterBy
  colorBy: ColorBy
  sortTag: string | undefined
  groupBy: GroupBy | undefined
  showSoftClipping: boolean
  showCoverage: boolean
  drawSingletons: boolean
  drawProperPairs: boolean
  linkedReads: LinkedReadsMode
}
```

#### method: contextMenuItems

```ts
type contextMenuItems = () => MenuItem[]
```

</details>

<details>
<summary>LinearAlignmentsDisplay - Actions</summary>

#### action: setGroupBy

Set (or remove, when undefined) the in-track stacked grouping dimension. A
tier-1 refetch setting (in `rpcProps`) — the worker re-partitions the fetch into
N sections. Resets the Y scroll since the stacked content height changes.
Ungrouping stores an explicit `null` override (not a cleared override) so it
beats a configured `groupBy` default rather than falling back to it.

```ts
type setGroupBy = (groupBy?: GroupBy | undefined) => void
```

#### action: toggleGroupCollapsed

Collapse/expand a stacked group's pileup (coverage stays visible).

```ts
type toggleGroupCollapsed = (key: string) => void
```

#### action: toggleGroupExpanded

Expand a fit-to-viewport group back to the full `maxHeight` cap (show all its
reads), or, if it already carries a height override (from expand or a drag),
drop the override to return it to the fit budget. Expanding makes the stack
overflow the viewport, which engages the pileup scroll. Pairs with
`hasGroupHeightOverride`.

```ts
type toggleGroupExpanded = (key: string) => void
```

#### action: resizeGroupHeight

Drag a stacked group's pileup band taller/shorter by `dy` px, capping how many
rows that group lays out. The continuous-accumulation policy (seed once, floor
at a row, pin/skip a fully-shown group) lives in the pure
`nextGroupHeightOverride`; this action just gathers the group's live state and
commits the result (undefined = leave on the fit budget). Pairs with
`hasGroupHeightOverride` / `toggleGroupExpanded`.

```ts
type resizeGroupHeight = (key: string, dy: number) => void
```

#### action: setFitHeightToDisplay

Enter/leave "fit to display height" mode. Entering resets the two bits of
transient state that a uniform fit contradicts — per-group height overrides (a
drag opts a group out of the fit budget) and the scroll offset (a fitted stack
doesn't scroll). These clears are tied to the explicit user action on purpose: a
track that inherits `fit` passively from a session-wide default keeps its
overrides, so setting an unrelated default can't silently wipe a group the user
dragged. The afterAttach autorun then keeps `featureHeight` sized to fit as the
display/data change, regardless of how fit was entered.

```ts
type setFitHeightToDisplay = (fit: boolean) => void
```

#### action: setHeightMode

Set the track-height strategy by writing the unified `heightMode` slot; the
modes are mutually exclusive by construction. Entering a non-`fixed` mode (fit
or grow) resets the transient state a uniform fit/grow contradicts — per-group
height overrides (a drag opts a group out) and the scroll offset (neither fit
nor grow scrolls) — tied to the explicit user action so a track that merely
inherits the mode from a session-wide default keeps its overrides. The driving
autoruns then keep `featureHeight` (fit) or `height` (grow) sized as the
display/data change.

```ts
type setHeightMode = (mode: HeightMode) => void
```

#### action: setFittedHeightPx

Cache the fitted read height so the `featureHeight`/`featureSpacing` getters can
resolve to it. Written only by the driving autorun.

```ts
type setFittedHeightPx = (px: number) => void
```

#### action: setShowBezierConnections

Toggle the paired-read connection overlay. A main-thread tier-2/4 setting (read
in `laidOutPileupMap` + `renderState`), not in `rpcProps` — toggling it never
refetches.

```ts
type setShowBezierConnections = (flag: boolean) => void
```

#### action: openContextMenu

Open the right-click menu over a hit. Coord, block, and the two hit kinds always
travel as a unit — set atomically so a consumer can never read a block without
its hit (the split-state class of bug that silently no-op'd position sorts). The
read feature is reset now and, when the hit carries one, populated by an async
RPC fetch — so "open the menu for this hit and its read" stays a single call and
a repositioned menu can't inherit the prior read's items.

```ts
type openContextMenu = (args: {
  coord: [number, number]
  block?: ResolvedBlock | undefined
  genomicPos?: number | undefined
  cigarHit?: CigarHitResult | undefined
  indicatorHit?: IndicatorHitResult | undefined
  featureId?: string | undefined
}) => void
```

#### action: resizeHeight

A manual drag-resize means the user wants a fixed height; leave grow mode first,
otherwise the grow autorun snaps the height back on the next relayout and the
drag appears to do nothing (mirrors canvas).

```ts
type resizeHeight = (distance: number) => number
```

</details>

<details>
<summary>LinearAlignmentsDisplay - Actions (other undocumented members)</summary>

#### action: clearMouseoverState

```ts
type clearMouseoverState = () => void
```

#### action: setError

```ts
type setError = (error?: unknown) => void
```

#### action: setRegionTooLarge

```ts
type setRegionTooLarge = (val: boolean, reason?: string | undefined) => void
```

#### action: setRpcData

```ts
type setRpcData = (
  displayedRegionIndex: number,
  data: GroupedAlignmentsResult | null,
) => void
```

#### action: clearDisplaySpecificData

```ts
type clearDisplaySpecificData = () => void
```

#### action: setOverCigarItem

```ts
type setOverCigarItem = (flag: boolean) => void
```

#### action: setScrollTop

```ts
type setScrollTop = (scrollTop: number) => void
```

#### action: setHighlightedChainIds

```ts
type setHighlightedChainIds = (ids: string[]) => void
```

#### action: clearHighlights

```ts
type clearHighlights = () => void
```

#### action: clearSelection

```ts
type clearSelection = () => void
```

#### action: setSelectedChainIds

```ts
type setSelectedChainIds = (ids: string[]) => void
```

#### action: setColorScheme

```ts
type setColorScheme = (colorBy: ColorBy) => void
```

#### action: updateColorTagMap

```ts
type updateColorTagMap = (uniqueTag: string[]) => void
```

#### action: setFilterBy

```ts
type setFilterBy = (filterBy: FilterBy) => void
```

#### action: setShowSoftClipping

```ts
type setShowSoftClipping = (value: boolean) => void
```

#### action: setMismatchAlpha

```ts
type setMismatchAlpha = (value: boolean) => void
```

#### action: setSortedBy

```ts
type setSortedBy = (type: string, tag?: string | undefined) => void
```

#### action: setSortedByAtPosition

```ts
type setSortedByAtPosition = (arg: {
  type: string
  pos: number
  refName: string
  tag?: string | undefined
}) => void
```

#### action: clearSortedBy

```ts
type clearSortedBy = () => void
```

#### action: setLargeFeaturesFirst

```ts
type setLargeFeaturesFirst = (flag: boolean) => void
```

#### action: setScaleType

```ts
type setScaleType = (val: string) => void
```

#### action: setAutoscale

```ts
type setAutoscale = (val?: string | undefined) => void
```

#### action: setMinScore

```ts
type setMinScore = (val?: number | undefined) => void
```

#### action: setMaxScore

```ts
type setMaxScore = (val?: number | undefined) => void
```

#### action: setFeatureHeight

```ts
type setFeatureHeight = (height?: number | undefined) => void
```

#### action: setFeatureSpacing

```ts
type setFeatureSpacing = (spacing?: number | undefined) => void
```

#### action: setMaxHeight

```ts
type setMaxHeight = (height?: number | undefined) => void
```

#### action: setCompactness

```ts
type setCompactness = (level: 'normal' | 'compact' | 'super-compact') => void
```

#### action: setShowSashimiArcs

```ts
type setShowSashimiArcs = (show: boolean) => void
```

#### action: setReadConnections

```ts
type setReadConnections = (mode: ReadConnectionsMode) => void
```

#### action: setReadConnectionsDown

```ts
type setReadConnectionsDown = (down: boolean) => void
```

#### action: setShowCoverage

```ts
type setShowCoverage = (show: boolean) => void
```

#### action: setShowPileup

```ts
type setShowPileup = (show: boolean) => void
```

#### action: setCoverageHeight

```ts
type setCoverageHeight = (height: number) => void
```

#### action: setReadConnectionsHeight

```ts
type setReadConnectionsHeight = (height: number) => void
```

#### action: setSashimiArcsHeight

```ts
type setSashimiArcsHeight = (height: number) => void
```

#### action: setMinSashimiScore

```ts
type setMinSashimiScore = (score: number) => void
```

#### action: setSashimiArcsMode

```ts
type setSashimiArcsMode = (mode: SashimiArcsMode) => void
```

#### action: setShowSashimiLabels

```ts
type setShowSashimiLabels = (show: boolean) => void
```

#### action: setReadConnectionsLineWidth

```ts
type setReadConnectionsLineWidth = (width: number) => void
```

#### action: setDrawInter

```ts
type setDrawInter = (draw: boolean) => void
```

#### action: setDrawLongRange

```ts
type setDrawLongRange = (draw: boolean) => void
```

#### action: setArcColorByType

```ts
type setArcColorByType = (type: ArcColorByType) => void
```

#### action: setShowMismatches

```ts
type setShowMismatches = (show: boolean) => void
```

#### action: setShowLegend

```ts
type setShowLegend = (show: boolean | undefined) => void
```

#### action: setDrawSingletons

```ts
type setDrawSingletons = (flag: boolean) => void
```

#### action: setDrawProperPairs

```ts
type setDrawProperPairs = (flag: boolean) => void
```

#### action: setShowInterbaseIndicators

```ts
type setShowInterbaseIndicators = (show: boolean) => void
```

#### action: setFlipStrandLongReadChains

```ts
type setFlipStrandLongReadChains = (flag: boolean) => void
```

#### action: setColorSupplementaryChains

```ts
type setColorSupplementaryChains = (flag: boolean) => void
```

#### action: setLinkedReads

```ts
type setLinkedReads = (mode: LinkedReadsMode) => void
```

#### action: updateVisibleModifications

```ts
type updateVisibleModifications = (uniqueModifications: string[]) => void
```

#### action: setModificationsReady

```ts
type setModificationsReady = (flag: boolean) => void
```

#### action: setFeatureIdUnderMouse

```ts
type setFeatureIdUnderMouse = (feature?: string | undefined) => void
```

#### action: setMouseoverExtraInformation

```ts
type setMouseoverExtraInformation = (extra?: TooltipPayload | undefined) => void
```

#### action: setHoverState

```ts
type setHoverState = (state: {
  overCigarItem: boolean
  featureIdUnderMouse: string | undefined
  mouseoverExtraInformation: TooltipPayload | undefined
  hoverCoverageBand?: { topOffset: number; coverageHeight: number } | undefined
}) => void
```

#### action: setContextMenuFeature

```ts
type setContextMenuFeature = (feature?: Feature | undefined) => void
```

#### action: closeContextMenu

```ts
type closeContextMenu = () => void
```

#### action: selectFeature

```ts
type selectFeature = (feature: Feature) => void
```

#### action: startRenderingBackend

```ts
type startRenderingBackend = (backend: AlignmentsRenderingBackend) => void
```

#### action: selectFeatureById

```ts
type selectFeatureById = (featureId: string) => Promise<void>
```

#### action: getByteEstimateConfig

```ts
type getByteEstimateConfig = () => {
  adapterConfig: any
  fetchSizeLimit: any
  userByteSizeLimit: number | undefined
  visibleBp: number
}
```

#### action: fetchNeeded

```ts
type fetchNeeded = (
  needed: { region: Region; displayedRegionIndex: number }[],
) => Promise<void>
```

#### action: renderSvg

```ts
type renderSvg = (opts?: ExportSvgDisplayOptions | undefined) => Promise<ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<...> | AwaitedReactNode>
```

</details>
