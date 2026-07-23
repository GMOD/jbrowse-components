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
      colorBy: { type: 'modifications', modifications: { fillUnmarked: true } },
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

| Member                                                                                 | Kind       | Defined by                                            | Description                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [type](#property-type)                                                                 | Properties | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [configuration](#property-configuration)                                               | Properties | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [featureIdUnderMouse](#volatile-featureidundermouse)                                   | Volatiles  | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [mouseoverExtraInformation](#volatile-mouseoverextrainformation)                       | Volatiles  | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [contextMenuFeature](#volatile-contextmenufeature)                                     | Volatiles  | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [contextMenuCoord](#volatile-contextmenucoord)                                         | Volatiles  | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [contextMenuCigarHit](#volatile-contextmenucigarhit)                                   | Volatiles  | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [contextMenuIndicatorHit](#volatile-contextmenuindicatorhit)                           | Volatiles  | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [contextMenuModHit](#volatile-contextmenumodhit)                                       | Volatiles  | LinearAlignmentsDisplay                               | Per-read base modification under a right-click, so "Open modification details" is reachable from the menu (not just left-click).                                                                                                                                                                                                |
| [contextMenuGenomicPos](#volatile-contextmenugenomicpos)                               | Volatiles  | LinearAlignmentsDisplay                               | Genomic column under a right-click, anchoring the read menu's "sort at the clicked position" items.                                                                                                                                                                                                                             |
| [contextMenuBlock](#volatile-contextmenublock)                                         | Volatiles  | LinearAlignmentsDisplay                               | The block under a right-click (refName + block-level worker result + bp range).                                                                                                                                                                                                                                                 |
| [rpcDataMap](#volatile-rpcdatamap)                                                     | Volatiles  | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [scrollTop](#volatile-scrolltop)                                                       | Volatiles  | LinearAlignmentsDisplay                               | pileup vertical scroll offset in px.                                                                                                                                                                                                                                                                                            |
| [collapsedGroups](#volatile-collapsedgroups)                                           | Volatiles  | LinearAlignmentsDisplay                               | Group keys whose pileup is collapsed to just its coverage band (in-track grouping).                                                                                                                                                                                                                                             |
| [groupMaxHeightOverrides](#volatile-groupmaxheightoverrides)                           | Volatiles  | LinearAlignmentsDisplay                               | Per-group pileup height override in px (in-track grouping).                                                                                                                                                                                                                                                                     |
| [fittedHeightPx](#volatile-fittedheightpx)                                             | Volatiles  | LinearAlignmentsDisplay                               | Cache of the current fitted read height in px, kept in sync by the afterAttach autorun while `fitHeightToDisplay` is on.                                                                                                                                                                                                        |
| [highlightedChainIds](#volatile-highlightedchainids)                                   | Volatiles  | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [selectedChainIds](#volatile-selectedchainids)                                         | Volatiles  | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [colorTagMap](#volatile-colortagmap)                                                   | Volatiles  | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [detectedModifications](#volatile-detectedmodifications)                               | Volatiles  | LinearAlignmentsDisplay                               | Modification type code -> painted color, for every type seen in the fetched reads.                                                                                                                                                                                                                                              |
| [modificationsReady](#volatile-modificationsready)                                     | Volatiles  | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [overCigarItem](#volatile-overcigaritem)                                               | Volatiles  | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [hoverCoverageBand](#volatile-hovercoverageband)                                       | Volatiles  | LinearAlignmentsDisplay                               | Screen-px coverage band of the section currently under a coverage/indicator hover.                                                                                                                                                                                                                                              |
| [linkedReads](#getter-linkedreads)                                                     | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [pairsDisplayTypeDefault](#getter-pairsdisplaytypedefault)                             | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [showBezierConnections](#getter-showbezierconnections)                                 | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [showCoverage](#getter-showcoverage)                                                   | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [showPileup](#getter-showpileup)                                                       | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [coverageHeight](#getter-coverageheight)                                               | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [showMismatches](#getter-showmismatches)                                               | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [showInterbaseIndicators](#getter-showinterbaseindicators)                             | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [drawSingletons](#getter-drawsingletons)                                               | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [drawProperPairs](#getter-drawproperpairs)                                             | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [showOnlySplitAlignments](#getter-showonlysplitalignments)                             | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [flipStrandLongReadChains](#getter-flipstrandlongreadchains)                           | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [colorSupplementaryChains](#getter-colorsupplementarychains)                           | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [drawInter](#getter-drawinter)                                                         | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [drawLongRange](#getter-drawlongrange)                                                 | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [arcColorByType](#getter-arccolorbytype)                                               | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [readConnections](#getter-readconnections)                                             | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [arcsDisplayTypeDefault](#getter-arcsdisplaytypedefault)                               | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [readCloudDisplayTypeDefault](#getter-readclouddisplaytypedefault)                     | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [readConnectionsDown](#getter-readconnectionsdown)                                     | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [readConnectionsDownDisplayTypeDefault](#getter-readconnectionsdowndisplaytypedefault) | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [showSashimiArcs](#getter-showsashimiarcs)                                             | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [sashimiArcsMode](#getter-sashimiarcsmode)                                             | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [sashimiDownDisplayTypeDefault](#getter-sashimidowndisplaytypedefault)                 | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [sashimiAutoDisplayTypeDefault](#getter-sashimiautodisplaytypedefault)                 | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [minSashimiScore](#getter-minsashimiscore)                                             | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [sashimiArcsHeight](#getter-sashimiarcsheight)                                         | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [readConnectionsHeight](#getter-readconnectionsheight)                                 | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [showSoftClipping](#getter-showsoftclipping)                                           | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [softClippingDisplayTypeDefault](#getter-softclippingdisplaytypedefault)               | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [isChainMode](#getter-ischainmode)                                                     | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [showLinkedReadLines](#getter-showlinkedreadlines)                                     | Getters    | LinearAlignmentsDisplay                               | Whether to draw the straight-line pass connecting normal read-pairs in pileup layout.                                                                                                                                                                                                                                           |
| [scaleType](#getter-scaletype)                                                         | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [autoscaleType](#getter-autoscaletype)                                                 | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [minScore](#getter-minscore)                                                           | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [maxScore](#getter-maxscore)                                                           | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [minScoreBound](#getter-minscorebound)                                                 | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [maxScoreBound](#getter-maxscorebound)                                                 | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [numStdDev](#getter-numstddev)                                                         | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [featureWidgetType](#getter-featurewidgettype)                                         | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [selectedFeatureId](#getter-selectedfeatureid)                                         | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [TooltipComponent](#getter-tooltipcomponent)                                           | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [detectedModificationTypes](#getter-detectedmodificationtypes)                         | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [colorBy](#getter-colorby)                                                             | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [filterBy](#getter-filterby)                                                           | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [isFitting](#getter-isfitting)                                                         | Getters    | LinearAlignmentsDisplay                               | True when fit-to-display mode is on AND a pitch has been computed (`fittedHeightPx > 0`, i.e. there are rows and room to fit them).                                                                                                                                                                                             |
| [featureHeight](#getter-featureheight)                                                 | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [featureSpacing](#getter-featurespacing)                                               | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [rowHeight](#getter-rowheight)                                                         | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [configuredFeatureHeight](#getter-configuredfeatureheight)                             | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [maxHeight](#getter-maxheight)                                                         | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [showSashimiLabels](#getter-showsashimilabels)                                         | Getters    | LinearAlignmentsDisplay                               | Whether to draw the supporting-read count on each sashimi arc.                                                                                                                                                                                                                                                                  |
| [showSashimiLabelsDisplayTypeDefault](#getter-showsashimilabelsdisplaytypedefault)     | Getters    | LinearAlignmentsDisplay                               | "make the current sashimi-label state the default for all tracks" control (pin): symmetric, so it promotes whichever value the track currently shows.                                                                                                                                                                           |
| [chainIdMap](#getter-chainidmap)                                                       | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [showLowFreqMismatches](#getter-showlowfreqmismatches)                                 | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [filterMismatchesByFrequency](#getter-filtermismatchesbyfrequency)                     | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [mismatchAlpha](#getter-mismatchalpha)                                                 | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [mismatchAlphaDisplayTypeDefault](#getter-mismatchalphadisplaytypedefault)             | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [showLegend](#getter-showlegend)                                                       | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [sortedBy](#getter-sortedby)                                                           | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [largeFeaturesFirst](#getter-largefeaturesfirst)                                       | Getters    | LinearAlignmentsDisplay                               | Lay out the widest features in the lowest pileup rows (main-thread tier-2 relayout via laidOutPileupMap).                                                                                                                                                                                                                       |
| [groupBy](#getter-groupby)                                                             | Getters    | LinearAlignmentsDisplay                               | In-track stacked grouping dimension (undefined = ungrouped).                                                                                                                                                                                                                                                                    |
| [prefersOffset](#getter-prefersoffset)                                                 | Getters    | LinearAlignmentsDisplay                               | Offset the track label above the visualization when grouping, so the stacked group sections aren't hidden behind an overlapping label.                                                                                                                                                                                          |
| [coverageIsLog](#getter-coverageislog)                                                 | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [coverageStats](#getter-coveragestats)                                                 | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [coverageDomain](#getter-coveragedomain)                                               | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [coverageTicks](#getter-coverageticks)                                                 | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [colorLegendCategories](#getter-colorlegendcategories)                                 | Getters    | LinearAlignmentsDisplay                               | Read-color buckets actually present across the rendered reads, the single input that lets the legend list only relevant swatches (see legendUtils).                                                                                                                                                                             |
| [colorPalette](#getter-colorpalette)                                                   | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [readCloudLegendCategories](#getter-readcloudlegendcategories)                         | Getters    | LinearAlignmentsDisplay                               | Legend categories contributed by the read-cloud endpoint squares — the arc color slots actually plotted, mapped to legend buckets.                                                                                                                                                                                              |
| [belowCoverageBandsInput](#getter-belowcoveragebandsinput)                             | Getters    | LinearAlignmentsDisplay                               | Inputs to `belowCoverageBandsGeometry` — the below-coverage band settings plus whether any sashimi junction is present.                                                                                                                                                                                                         |
| [laidOutByGroup](#getter-laidoutbygroup)                                               | Getters    | LinearAlignmentsDisplay                               | Per-group laid-out data: group key → (region index → laid-out data).                                                                                                                                                                                                                                                            |
| [groupLayoutContext](#getter-grouplayoutcontext)                                       | Getters    | LinearAlignmentsDisplay                               | The layout mechanics (grouping, sort, soft-clip, colors) shared by the viewport fit pass and any ad-hoc layout — e.g. `fittedFeatureHeight`, which lays every group out uncapped to count rows.                                                                                                                                 |
| [groupOrder](#getter-grouporder)                                                       | Getters    | LinearAlignmentsDisplay                               | Group keys + labels in stacking order; a single entry (key '') when ungrouped.                                                                                                                                                                                                                                                  |
| [laidOutPileupMap](#getter-laidoutpileupmap)                                           | Getters    | LinearAlignmentsDisplay                               | Renderer-facing per-region layout.                                                                                                                                                                                                                                                                                              |
| [sourceSections](#getter-sourcesections)                                               | Getters    | LinearAlignmentsDisplay                               | Per-section renderer input, in stacking order.                                                                                                                                                                                                                                                                                  |
| [maxY](#getter-maxy)                                                                   | Getters    | LinearAlignmentsDisplay                               | Row count of the primary group across its regions.                                                                                                                                                                                                                                                                              |
| [pileupTruncated](#getter-pileuptruncated)                                             | Getters    | LinearAlignmentsDisplay                               | True when the ungrouped pileup hit `maxHeight` and overflow reads were collapsed — drives the "max height reached" / "show all" banner.                                                                                                                                                                                         |
| [rawDataByGroup](#getter-rawdatabygroup)                                               | Getters    | LinearAlignmentsDisplay                               | Raw (un-laid-out) data regrouped as group key → (region idx → data), insertion-ordered so the first key is the primary group.                                                                                                                                                                                                   |
| [arcsByGroup](#getter-arcsbygroup)                                                     | Getters    | LinearAlignmentsDisplay                               | Per-group arc upload feed: group key → (region idx → `ArcsUploadData`).                                                                                                                                                                                                                                                         |
| [modificationThreshold](#getter-modificationthreshold)                                 | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [colorSchemeIndex](#getter-colorschemeindex)                                           | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [showModifications](#getter-showmodifications)                                         | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [showPerBaseQuality](#getter-showperbasequality)                                       | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [showPerBaseLetter](#getter-showperbaseletter)                                         | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [readIdIndexMap](#getter-readidindexmap)                                               | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [layoutReady](#getter-layoutready)                                                     | Getters    | LinearAlignmentsDisplay                               | Whether `searchFeatureByID` has a pileup to search.                                                                                                                                                                                                                                                                             |
| [readConnectionsLineWidth](#getter-readconnectionslinewidth)                           | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [belowCoverageBands](#getter-belowcoveragebands)                                       | Getters    | LinearAlignmentsDisplay                               | Geometry of the bands stacked below coverage in arcs-down mode, top to bottom: coverage → paired-end arcs → sashimi.                                                                                                                                                                                                            |
| [coverageDisplayHeight](#getter-coveragedisplayheight)                                 | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [sections](#getter-sections)                                                           | Getters    | LinearAlignmentsDisplay                               | Single source of all vertical band geometry, one entry per stacked group.                                                                                                                                                                                                                                                       |
| [renderSections](#getter-rendersections)                                               | Getters    | LinearAlignmentsDisplay                               | Per-section data + content-space band tops for the overlay/hit-test pipeline (labels, highlights, hit-test).                                                                                                                                                                                                                    |
| [bezierPairSections](#getter-bezierpairsections)                                       | Getters    | LinearAlignmentsDisplay                               | Scroll/pan-invariant half of the bezier connection overlay: the linked pairs of each section, resolved once per relayout.                                                                                                                                                                                                       |
| [bezierConnectionColorTypes](#getter-bezierconnectioncolortypes)                       | Getters    | LinearAlignmentsDisplay                               | Connection types (LINKED_READ_COLOR_*) actually drawn as bezier/line arcs in view, the input that lets the legend list only the connection colors present.                                                                                                                                                                      |
| [sashimiArcSections](#getter-sashimiarcsections)                                       | Getters    | LinearAlignmentsDisplay                               | Per-section sashimi arcs, in stacking order: each group's junction geometry (sashimi counts live per-group) already split into the two sub-bands, paired with their content-space tops — `coverageOverlayTop` for `up` arcs drawn over the coverage histogram, `sashimiBandTop` for `down` arcs in the reserved strip below it. |
| [isGrouped](#getter-isgrouped)                                                         | Getters    | LinearAlignmentsDisplay                               | True when reads are stacked into >1 group section.                                                                                                                                                                                                                                                                              |
| [scrollModel](#getter-scrollmodel)                                                     | Getters    | LinearAlignmentsDisplay                               | The scroll-projection inputs (`sectionScreen.ts`) every overlay needs to map a content-space Y into screen space.                                                                                                                                                                                                               |
| [pileupViewportHeight](#getter-pileupviewportheight)                                   | Getters    | LinearAlignmentsDisplay                               | Height of the scrollable viewport.                                                                                                                                                                                                                                                                                              |
| [pileupContentHeight](#getter-pileupcontentheight)                                     | Getters    | LinearAlignmentsDisplay                               | Total scrollable content height.                                                                                                                                                                                                                                                                                                |
| [grownHeight](#getter-grownheight)                                                     | Getters    | LinearAlignmentsDisplay                               | Target track height for `grow` mode: the full laid-out content height (coverage + pileup + arcs), capped at `GROW_MAX_HEIGHT` so a deep pileup doesn't grow the track to thousands of px (a taller pileup fits to the cap and scrolls the remainder).                                                                           |
| [height](#getter-height)                                                               | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [scalebarOverlapLeft](#getter-scalebaroverlapleft)                                     | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [showOutline](#getter-showoutline)                                                     | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [visibleLabels](#getter-visiblelabels)                                                 | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [highlightChainIds](#getter-highlightchainids)                                         | Getters    | LinearAlignmentsDisplay                               | Chain member ids to highlight, empty unless in `normal` linked-read mode.                                                                                                                                                                                                                                                       |
| [highlightBoxes](#getter-highlightboxes)                                               | Getters    | LinearAlignmentsDisplay                               | Screen boxes for the hovered read / chain, painted by the `HighlightOverlay` div.                                                                                                                                                                                                                                               |
| [fittedFeatureHeight](#getter-fittedfeatureheight)                                     | Getters    | LinearAlignmentsDisplay                               | The read height that makes every uncollapsed group's reads fill the display without scrolling.                                                                                                                                                                                                                                  |
| [scrollableHeight](#getter-scrollableheight)                                           | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [sortTag](#getter-sorttag)                                                             | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [renderState](#getter-renderstate)                                                     | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [arcsYDomainBp](#getter-arcsydomainbp)                                                 | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [insertSizeTicks](#getter-insertsizeticks)                                             | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [featureUnderMouse](#getter-featureundermouse)                                         | Getters    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [isGroupCollapsed](#method-isgroupcollapsed)                                           | Methods    | LinearAlignmentsDisplay                               | Whether a stacked group's pileup is collapsed to just its coverage.                                                                                                                                                                                                                                                             |
| [hasGroupHeightOverride](#method-hasgroupheightoverride)                               | Methods    | LinearAlignmentsDisplay                               | Whether a stacked group carries a custom pileup-height override — set by expanding it (show all reads) or dragging its resize handle (taller or shorter).                                                                                                                                                                       |
| [legendItems](#method-legenditems)                                                     | Methods    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [groupLaidOutMap](#method-grouplaidoutmap)                                             | Methods    | LinearAlignmentsDisplay                               | Laid-out region map for one group key, or an empty map for a key with no data.                                                                                                                                                                                                                                                  |
| [isGroupTruncated](#method-isgrouptruncated)                                           | Methods    | LinearAlignmentsDisplay                               | True when the row cap clipped reads from a group's pileup and the user hasn't explicitly sized that group (a height drag/expand makes any truncation intentional, so it isn't flagged).                                                                                                                                         |
| [findFeatureInRpcData](#method-findfeatureinrpcdata)                                   | Methods    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [bezierLegendItems](#method-bezierlegenditems)                                         | Methods    | LinearAlignmentsDisplay                               | Legend swatches for the linked-read connection curves, empty unless the bezier overlay is on and at least one connection is in view.                                                                                                                                                                                            |
| [searchFeatureByID](#method-searchfeaturebyid)                                         | Methods    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [chainIdsForRead](#method-chainidsforread)                                             | Methods    | LinearAlignmentsDisplay                               | Chain IDs sharing a QNAME with the read at `index` in `rpcData`.                                                                                                                                                                                                                                                                |
| [getFeatureInfoById](#method-getfeatureinfobyid)                                       | Methods    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [rpcProps](#method-rpcprops)                                                           | Methods    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [trackMenuItems](#method-trackmenuitems)                                               | Methods    | LinearAlignmentsDisplay                               | Track menu items                                                                                                                                                                                                                                                                                                                |
| [contextMenuItems](#method-contextmenuitems)                                           | Methods    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [clearMouseoverState](#action-clearmouseoverstate)                                     | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setError](#action-seterror)                                                           | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [onRegionTooLarge](#action-onregiontoolarge)                                           | Actions    | LinearAlignmentsDisplay                               | Clear the hover/tooltip when the region goes too large (the banner replaces the pileup).                                                                                                                                                                                                                                        |
| [setRpcData](#action-setrpcdata)                                                       | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [clearDisplaySpecificData](#action-cleardisplayspecificdata)                           | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setOverCigarItem](#action-setovercigaritem)                                           | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setScrollTop](#action-setscrolltop)                                                   | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setHighlightedChainIds](#action-sethighlightedchainids)                               | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [clearHighlights](#action-clearhighlights)                                             | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [clearSelection](#action-clearselection)                                               | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setSelectedChainIds](#action-setselectedchainids)                                     | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setColorScheme](#action-setcolorscheme)                                               | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [updateColorTagMap](#action-updatecolortagmap)                                         | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setFilterBy](#action-setfilterby)                                                     | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setShowSoftClipping](#action-setshowsoftclipping)                                     | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setMismatchAlpha](#action-setmismatchalpha)                                           | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setSortedBy](#action-setsortedby)                                                     | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setSortedByAtPosition](#action-setsortedbyatposition)                                 | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [clearSortedBy](#action-clearsortedby)                                                 | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setLargeFeaturesFirst](#action-setlargefeaturesfirst)                                 | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setGroupBy](#action-setgroupby)                                                       | Actions    | LinearAlignmentsDisplay                               | Set (or remove, when undefined) the in-track stacked grouping dimension.                                                                                                                                                                                                                                                        |
| [toggleGroupCollapsed](#action-togglegroupcollapsed)                                   | Actions    | LinearAlignmentsDisplay                               | Collapse/expand a stacked group's pileup (coverage stays visible).                                                                                                                                                                                                                                                              |
| [toggleGroupExpanded](#action-togglegroupexpanded)                                     | Actions    | LinearAlignmentsDisplay                               | Expand a fit-to-viewport group back to the full `maxHeight` cap (show all its reads), or, if it already carries a height override (from expand or a drag), drop the override to return it to the fit budget.                                                                                                                    |
| [resizeGroupHeight](#action-resizegroupheight)                                         | Actions    | LinearAlignmentsDisplay                               | Drag a stacked group's pileup band taller/shorter by `dy` px, capping how many rows that group lays out.                                                                                                                                                                                                                        |
| [setScaleType](#action-setscaletype)                                                   | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setAutoscale](#action-setautoscale)                                                   | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setMinScore](#action-setminscore)                                                     | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setMaxScore](#action-setmaxscore)                                                     | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setFeatureHeight](#action-setfeatureheight)                                           | Actions    | LinearAlignmentsDisplay                               | Set the per-read pixel size.                                                                                                                                                                                                                                                                                                    |
| [setMaxHeight](#action-setmaxheight)                                                   | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setHeightMode](#action-setheightmode)                                                 | Actions    | LinearAlignmentsDisplay                               | Set the track-height strategy by writing the unified `heightMode` slot; the modes are mutually exclusive by construction.                                                                                                                                                                                                       |
| [setFittedHeightPx](#action-setfittedheightpx)                                         | Actions    | LinearAlignmentsDisplay                               | Cache the fitted read height so the `featureHeight`/`featureSpacing` getters can split it into a body + derived gap.                                                                                                                                                                                                            |
| [setShowSashimiArcs](#action-setshowsashimiarcs)                                       | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setReadConnections](#action-setreadconnections)                                       | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setReadConnectionsDown](#action-setreadconnectionsdown)                               | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setShowCoverage](#action-setshowcoverage)                                             | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setShowPileup](#action-setshowpileup)                                                 | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setCoverageHeight](#action-setcoverageheight)                                         | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setReadConnectionsHeight](#action-setreadconnectionsheight)                           | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setSashimiArcsHeight](#action-setsashimiarcsheight)                                   | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setMinSashimiScore](#action-setminsashimiscore)                                       | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setSashimiArcsMode](#action-setsashimiarcsmode)                                       | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setShowSashimiLabels](#action-setshowsashimilabels)                                   | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setReadConnectionsLineWidth](#action-setreadconnectionslinewidth)                     | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setDrawInter](#action-setdrawinter)                                                   | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setDrawLongRange](#action-setdrawlongrange)                                           | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setArcColorByType](#action-setarccolorbytype)                                         | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setShowMismatches](#action-setshowmismatches)                                         | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setShowLegend](#action-setshowlegend)                                                 | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setDrawSingletons](#action-setdrawsingletons)                                         | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setDrawProperPairs](#action-setdrawproperpairs)                                       | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setShowOnlySplitAlignments](#action-setshowonlysplitalignments)                       | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setShowInterbaseIndicators](#action-setshowinterbaseindicators)                       | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setFlipStrandLongReadChains](#action-setflipstrandlongreadchains)                     | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setColorSupplementaryChains](#action-setcolorsupplementarychains)                     | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setLinkedReads](#action-setlinkedreads)                                               | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setShowBezierConnections](#action-setshowbezierconnections)                           | Actions    | LinearAlignmentsDisplay                               | Toggle the paired-read connection overlay.                                                                                                                                                                                                                                                                                      |
| [updateVisibleModifications](#action-updatevisiblemodifications)                       | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setModificationsReady](#action-setmodificationsready)                                 | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setFeatureIdUnderMouse](#action-setfeatureidundermouse)                               | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setMouseoverExtraInformation](#action-setmouseoverextrainformation)                   | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setHoverState](#action-sethoverstate)                                                 | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [setContextMenuFeature](#action-setcontextmenufeature)                                 | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [closeContextMenu](#action-closecontextmenu)                                           | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [selectFeature](#action-selectfeature)                                                 | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [startRenderingBackend](#action-startrenderingbackend)                                 | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [selectFeatureById](#action-selectfeaturebyid)                                         | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [openContextMenu](#action-opencontextmenu)                                             | Actions    | LinearAlignmentsDisplay                               | Open the right-click menu over a hit.                                                                                                                                                                                                                                                                                           |
| [getByteEstimateConfig](#action-getbyteestimateconfig)                                 | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [fetchNeeded](#action-fetchneeded)                                                     | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [renderSvg](#action-rendersvg)                                                         | Actions    | LinearAlignmentsDisplay                               |                                                                                                                                                                                                                                                                                                                                 |
| [resizeHeight](#action-resizeheight)                                                   | Actions    | LinearAlignmentsDisplay                               | A manual drag-resize means the user wants a fixed height; leave grow mode first, otherwise the grow autorun snaps the height back on the next relayout and the drag appears to do nothing (mirrors canvas).                                                                                                                     |
| [id](#property-id)                                                                     | Properties | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                 |
| [rpcDriverName](#property-rpcdrivername)                                               | Properties | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                 |
| [ignorePromotedDefaults](#property-ignorepromoteddefaults)                             | Properties | [BaseDisplay](../basedisplay)                         | true for a display that arrived inside a session received from someone else (a share link, an encoded/json session, a `spec-` URL).                                                                                                                                                                                             |
| [error](#volatile-error)                                                               | Volatiles  | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                 |
| [statusMessage](#volatile-statusmessage)                                               | Volatiles  | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                 |
| [statusProgress](#volatile-statusprogress)                                             | Volatiles  | [BaseDisplay](../basedisplay)                         | determinate progress fraction [0,1] for the current status, or undefined when the in-flight phase is indeterminate.                                                                                                                                                                                                             |
| [parentTrack](#getter-parenttrack)                                                     | Getters    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                 |
| [parentDisplay](#getter-parentdisplay)                                                 | Getters    | [BaseDisplay](../basedisplay)                         | Returns the parent display if this display is nested within another display (e.g., PileupDisplay inside LinearAlignmentsDisplay)                                                                                                                                                                                                |
| [RenderingComponent](#getter-renderingcomponent)                                       | Getters    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                 |
| [DisplayBlurb](#getter-displayblurb)                                                   | Getters    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                 |
| [adapterConfig](#getter-adapterconfig)                                                 | Getters    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                 |
| [isMinimized](#getter-isminimized)                                                     | Getters    | [BaseDisplay](../basedisplay)                         | Returns true if the parent track is minimized.                                                                                                                                                                                                                                                                                  |
| [effectiveRpcDriverName](#getter-effectiverpcdrivername)                               | Getters    | [BaseDisplay](../basedisplay)                         | Returns the effective RPC driver name with hierarchical fallback: 1.                                                                                                                                                                                                                                                            |
| [DisplayMessageComponent](#getter-displaymessagecomponent)                             | Getters    | [BaseDisplay](../basedisplay)                         | if a display-level message should be displayed instead, make this return a react component                                                                                                                                                                                                                                      |
| [renderingProps](#method-renderingprops)                                               | Methods    | [BaseDisplay](../basedisplay)                         | props passed to the renderer's React "Rendering" component.                                                                                                                                                                                                                                                                     |
| [regionCannotBeRendered](#method-regioncannotberendered)                               | Methods    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                 |
| [setIgnorePromotedDefaults](#action-setignorepromoteddefaults)                         | Actions    | [BaseDisplay](../basedisplay)                         | see the `ignorePromotedDefaults` property                                                                                                                                                                                                                                                                                       |
| [setStatusMessage](#action-setstatusmessage)                                           | Actions    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                 |
| [setRpcDriverName](#action-setrpcdrivername)                                           | Actions    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                 |
| [reload](#action-reload)                                                               | Actions    | [BaseDisplay](../basedisplay)                         | base display reload does nothing, see specialized displays for details                                                                                                                                                                                                                                                          |
| [setHeight](#action-setheight)                                                         | Actions    | [TrackHeightMixin](../trackheightmixin)               |                                                                                                                                                                                                                                                                                                                                 |
| [heightMode](#getter-heightmode)                                                       | Getters    | [HeightModeMixin](../heightmodemixin)                 | The resolved track-height strategy (`fixed`/`grow`/`fit`).                                                                                                                                                                                                                                                                      |
| [fitTargetHeight](#getter-fittargetheight)                                             | Getters    | [HeightModeMixin](../heightmodemixin)                 | The drag-resizable track height as stored in the config slot — the fit target the fit/grow layout scales or packs content into.                                                                                                                                                                                                 |
| [autoHeight](#getter-autoheight)                                                       | Getters    | [HeightModeMixin](../heightmodemixin)                 | `grow` mode as a boolean, derived from the unified `heightMode` slot.                                                                                                                                                                                                                                                           |
| [fitHeightToDisplay](#getter-fitheighttodisplay)                                       | Getters    | [HeightModeMixin](../heightmodemixin)                 | `fit` mode as a boolean, derived from the unified `heightMode` slot.                                                                                                                                                                                                                                                            |
| [loadedRegions](#volatile-loadedregions)                                               | Volatiles  | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | regions whose data has been fetched and committed, keyed by displayedRegionIndex; populated only after the fetch work callback returns                                                                                                                                                                                          |
| [isReady](#getter-isready)                                                             | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | true once the canvas has painted and no fetch is in flight                                                                                                                                                                                                                                                                      |
| [viewportWithinLoadedData](#getter-viewportwithinloadeddata)                           | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | true when every visible block lies within an already-fetched region — i.e. the viewport shows data we actually loaded, not the stale fringe left after a zoom-out/pan.                                                                                                                                                          |
| [svgReady](#getter-svgready)                                                           | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | true once an off-screen (SVG) export can safely read this display's data: every visible region has loaded, or the fetch reached a terminal error / too-large state.                                                                                                                                                             |
| [svgReadyExtraTerminal](#getter-svgreadyextraterminal)                                 | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Overridable hook (default false): a subclass returns true to mark an extra terminal state where off-screen export can proceed with no loaded data.                                                                                                                                                                              |
| [renderBlocks](#getter-renderblocks)                                                   | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Shared cached view for every LGV-based GPU display.                                                                                                                                                                                                                                                                             |
| [displayPhase](#getter-displayphase)                                                   | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | The display's mutually-exclusive visual state, precedence single-sourced in `computeDisplayPhase`.                                                                                                                                                                                                                              |
| [rpcPropsCacheKey](#getter-rpcpropscachekey)                                           | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | The RPC cache key: the subclass's `rpcProps()` payload serialized to a string, so this getter's value is a primitive and MobX invalidates its observers only when the payload actually changed.                                                                                                                                 |
| [derivedRegionTooLargeEnabled](#getter-derivedregiontoolargeenabled)                   | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Derived opt-in for the region-too-large gate: a display that declares a pre-flight byte estimate (`getByteEstimateConfig`) gates on it — the two are one decision, so they can't desync (this replaces the old dev-time "config set but gate off" console.error).                                                               |
| [setLoadedRegion](#action-setloadedregion)                                             | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Action wrapper so callers after async boundaries stay in MST strict mode.                                                                                                                                                                                                                                                       |
| [clearAllRpcData](#action-clearallrpcdata)                                             | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | full reset: cancels fetch, clears error, loadedRegions, display-specific data, and the canvas-drawn flag.                                                                                                                                                                                                                       |
| [invalidateLoadedRegions](#action-invalidateloadedregions)                             | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | lighter reset: cancels fetch and clears loadedRegions, leaving error and regionTooLarge intact                                                                                                                                                                                                                                  |
| [isCacheValid](#action-iscachevalid)                                                   | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Overridable hook: return `false` to force re-fetch at the current zoom (wiggle uses this for zoom-level changes).                                                                                                                                                                                                               |
| [fetchRegions](#action-fetchregions)                                                   | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Run a per-region fetch with byte-estimate gating.                                                                                                                                                                                                                                                                               |
| [afterAttach](#action-afterattach)                                                     | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | installs the five fetch-lifecycle autoruns (DisplayedRegionsChange, FetchVisibleRegions, SettingsInvalidate, ClearBlockingStateOnViewportChange, ClearHoverOnRegionTooLarge)                                                                                                                                                    |
| [userByteLimit](#volatile-userbytelimit)                                               | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin)         | user-confirmed byte limit after a force-load, disabling the gate.                                                                                                                                                                                                                                                               |
| [byteEstimate](#volatile-byteestimate)                                                 | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin)         | Last byte estimate reported for this display, with the adapter's own `fetchSizeLimit` and `alwaysRender` flag.                                                                                                                                                                                                                  |
| [measuredSpanBp](#volatile-measuredspanbp)                                             | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin)         | The span the current `byteEstimate` was measured over, so the derived gate can rescale it to the span on screen now.                                                                                                                                                                                                            |
| [configuredFetchSizeLimit](#getter-configuredfetchsizelimit)                           | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | The composing display's configured `fetchSizeLimit`, read straight from its config.                                                                                                                                                                                                                                             |
| [densityTooLargeForDerivedGate](#getter-densitytoolargeforderivedgate)                 | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | Extra (non-byte) too-large axis folded into the derived verdict — canvas overrides it with its feature-density gate.                                                                                                                                                                                                            |
| [configForceLoad](#getter-configforceload)                                             | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | Declarative force-load: when true the display always renders regardless of region size / feature density (the config-driven equivalent of the force-load button).                                                                                                                                                               |
| [estimatedBytesForVisibleSpan](#getter-estimatedbytesforvisiblespan)                   | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | How many bytes we estimate a fetch of the span on screen right now would pull, obtained by rescaling the stored estimate from the span it was measured over (`measuredSpanBp`).                                                                                                                                                 |
| [tooLargeStatus](#getter-toolargestatus)                                               | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | Shared derived verdict + reason (AUTO_FORCE_LOAD_BP floor, then bytes-over-limit, then the density axis), fed the scaled estimate so the byte gate self-releases on zoom-in.                                                                                                                                                    |
| [regionTooLarge](#getter-regiontoolarge)                                               | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | The verdict the whole mixin exists to produce: true when the estimated download for the span on screen exceeds the resolved byte budget, or when the display's own density axis trips.                                                                                                                                          |
| [regionTooLargeReason](#getter-regiontoolargereason)                                   | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         | Which axis tripped, as banner text: the estimated download size, or "Too many features".                                                                                                                                                                                                                                        |
| [regionCannotBeRenderedText](#method-regioncannotberenderedtext)                       | Methods    | [RegionTooLargeMixin](../regiontoolargemixin)         | Plaintext reason (for SVG export); the on-screen too-large UI is rendered by the display chrome via `TooLargeMessage`, not the model.                                                                                                                                                                                           |
| [setByteEstimate](#action-setbyteestimate)                                             | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)         | Commits the byte estimate and records the span it covers (`measuredSpanBp`) so the derived gate can rescale it to the span on screen.                                                                                                                                                                                           |
| [raiseForceLoadLimits](#action-raiseforceloadlimits)                                   | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)         | force-load: raise the byte limit past the current request so the gate releases.                                                                                                                                                                                                                                                 |
| [forceLoad](#action-forceload)                                                         | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)         | Raises the byte limit past the current estimate and triggers a reload.                                                                                                                                                                                                                                                          |
| [canvasDrawn](#volatile-canvasdrawn)                                                   | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)       | flips true on first paint; read by test selectors to detect render                                                                                                                                                                                                                                                              |
| [currentRenderingBackend](#volatile-currentrenderingbackend)                           | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)       | current backend reference, updated on context-loss recovery.                                                                                                                                                                                                                                                                    |
| [renderTick](#volatile-rendertick)                                                     | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)       | counter the render autorun observes; bumped to force a re-render                                                                                                                                                                                                                                                                |
| [autorunsInstalled](#volatile-autorunsinstalled)                                       | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)       | guards attachRenderingBackend so the autorun pair spawns once per instance                                                                                                                                                                                                                                                      |
| [renderError](#volatile-rendererror)                                                   | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)       | the render-backend (GPU/Canvas2D init or context-loss) error, or undefined.                                                                                                                                                                                                                                                     |
| [markCanvasDrawn](#action-markcanvasdrawn)                                             | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       |                                                                                                                                                                                                                                                                                                                                 |
| [resetCanvasDrawn](#action-resetcanvasdrawn)                                           | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       |                                                                                                                                                                                                                                                                                                                                 |
| [stopRenderingBackend](#action-stoprenderingbackend)                                   | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       |                                                                                                                                                                                                                                                                                                                                 |
| [renderNow](#action-rendernow)                                                         | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       |                                                                                                                                                                                                                                                                                                                                 |
| [setRenderError](#action-setrendererror)                                               | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       | set/clear the render-backend error.                                                                                                                                                                                                                                                                                             |
| [attachRenderingBackend](#action-attachrenderingbackend)                               | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       | attach a GPU/Canvas2D backend and install the upload + render autorun pair (idempotent — re-calling only swaps the backend)                                                                                                                                                                                                     |
| [activeStopToken](#volatile-activestoptoken)                                           | Volatiles  | [FetchMixin](../fetchmixin)                           | stop token of the in-flight fetch, or undefined when idle                                                                                                                                                                                                                                                                       |
| [fetchGeneration](#volatile-fetchgeneration)                                           | Volatiles  | [FetchMixin](../fetchmixin)                           | bumps at every fetch end; autoruns read it to re-evaluate, and it doubles as the staleness epoch inside runFetch                                                                                                                                                                                                                |
| [fetchCanceled](#volatile-fetchcanceled)                                               | Volatiles  | [FetchMixin](../fetchmixin)                           | true after the user explicitly cancels a load (the loading overlay's cancel button → `cancelFetchByUser`).                                                                                                                                                                                                                      |
| [regionStatuses](#volatile-regionstatuses)                                             | Volatiles  | [FetchMixin](../fetchmixin)                           | latest status of each concurrent in-flight operation, keyed by an arbitrary id (the canvas display uses displayedRegionIndex).                                                                                                                                                                                                  |
| [lastStatusMs](#volatile-laststatusms)                                                 | Volatiles  | [FetchMixin](../fetchmixin)                           | Date.now() of the last applied status write; the status callbacks gate on it to throttle a high-frequency progress stream.                                                                                                                                                                                                      |
| [isLoading](#getter-isloading)                                                         | Getters    | [FetchMixin](../fetchmixin)                           | true while a fetch is active                                                                                                                                                                                                                                                                                                    |
| [makeStatusCallback](#method-makestatuscallback)                                       | Methods    | [FetchMixin](../fetchmixin)                           | An RPC `statusCallback` bound to this display: forwards progress to the shared `statusMessage`, guarded by `isAlive` so a callback that fires after the node is torn down (RPCs resolve their status stream asynchronously) is a safe no-op.                                                                                    |
| [makeRegionStatusCallback](#method-makeregionstatuscallback)                           | Methods    | [FetchMixin](../fetchmixin)                           | Per-region variant of `makeStatusCallback`: routes progress through `setRegionStatus(key, …)` so N concurrent per-region fetches aggregate into one status bar instead of clobbering each other.                                                                                                                                |
| [throttleStatus](#action-throttlestatus)                                               | Actions    | [FetchMixin](../fetchmixin)                           | Run `apply` only if at least `STATUS_THROTTLE_MS` has passed since the last status write.                                                                                                                                                                                                                                       |
| [resetStatus](#action-resetstatus)                                                     | Actions    | [FetchMixin](../fetchmixin)                           | Drop the active stop token and clear all status bookkeeping.                                                                                                                                                                                                                                                                    |
| [stopActiveFetch](#action-stopactivefetch)                                             | Actions    | [FetchMixin](../fetchmixin)                           | Abort the in-flight fetch (if any) and clear its status.                                                                                                                                                                                                                                                                        |
| [setRegionStatus](#action-setregionstatus)                                             | Actions    | [FetchMixin](../fetchmixin)                           | Record one concurrent operation's latest status (keyed) and recompute the shared statusMessage/statusProgress as the aggregate across all in-flight keys.                                                                                                                                                                       |
| [cancelFetch](#action-cancelfetch)                                                     | Actions    | [FetchMixin](../fetchmixin)                           | cancel any in-flight fetch and bump fetchGeneration (always bumps, so callers can retrigger fetch autoruns even when nothing was in flight).                                                                                                                                                                                    |
| [cancelFetchByUser](#action-cancelfetchbyuser)                                         | Actions    | [FetchMixin](../fetchmixin)                           | User-initiated cancel from the loading overlay.                                                                                                                                                                                                                                                                                 |
| [beforeDestroy](#action-beforedestroy)                                                 | Actions    | [FetchMixin](../fetchmixin)                           | Release an in-flight fetch's stop token on teardown.                                                                                                                                                                                                                                                                            |
| [runFetch](#action-runfetch)                                                           | Actions    | [FetchMixin](../fetchmixin)                           | Run a cancel-safe fetch (cancels any prior).                                                                                                                                                                                                                                                                                    |
| [displayTypeDefaultChanges](#method-displaytypedefaultchanges)                         | Methods    | [PromotableDefaultsMixin](../promotabledefaultsmixin) | Effective config differences a track following the default inherits from session-wide defaults (distinct from per-track config edits / trackConfigDeltas).                                                                                                                                                                      |
| [clearDisplayTypeDefaults](#action-cleardisplaytypedefaults)                           | Actions    | [PromotableDefaultsMixin](../promotabledefaultsmixin) | Clear the session-wide defaults reported by `displayTypeDefaultChanges` so this display (and its siblings of the same type) revert to their config values.                                                                                                                                                                      |

### LinearAlignmentsDisplay - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/linearalignmentsdisplay).

<details>
<summary>LinearAlignmentsDisplay - Properties</summary>

| Member                                                 | Type                                                  |
| ------------------------------------------------------ | ----------------------------------------------------- |
| <span id="property-type">type</span>                   | `ISimpleType<"LinearAlignmentsDisplay">`              |
| <span id="property-configuration">configuration</span> | `IConfigurationReference<ConfigurationSchemaType<…>>` |

</details>

<details>
<summary>LinearAlignmentsDisplay - Volatiles</summary>

#### volatile: contextMenuModHit

Per-read base modification under a right-click, so "Open modification details"
is reachable from the menu (not just left-click). Set with the block/hits as a
unit.

```ts
// type signature
type contextMenuModHit = ModificationHitResult | undefined
// code
contextMenuModHit: undefined as ModificationHitResult | undefined
```

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

#### volatile: detectedModifications

Modification type code -> painted color, for every type seen in the fetched
reads. This is what the data CONTAINS; what is actually drawn is filtered
separately by isModificationTypeVisible, so don't rename this back to "visible".

```ts
// type signature
type detectedModifications = ObservableMap<string, string>
// code
detectedModifications: observable.map<string, string>({})
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

| Member                                                                         | Type                                             |
| ------------------------------------------------------------------------------ | ------------------------------------------------ |
| <span id="volatile-featureidundermouse">featureIdUnderMouse</span>             | `string \| undefined`                            |
| <span id="volatile-mouseoverextrainformation">mouseoverExtraInformation</span> | `TooltipPayload \| undefined`                    |
| <span id="volatile-contextmenufeature">contextMenuFeature</span>               | `Feature \| undefined`                           |
| <span id="volatile-contextmenucoord">contextMenuCoord</span>                   | `[number, number] \| undefined`                  |
| <span id="volatile-contextmenucigarhit">contextMenuCigarHit</span>             | `CigarHitResult \| undefined`                    |
| <span id="volatile-contextmenuindicatorhit">contextMenuIndicatorHit</span>     | `IndicatorHitResult \| undefined`                |
| <span id="volatile-rpcdatamap">rpcDataMap</span>                               | `ObservableMap<number, GroupedAlignmentsResult>` |
| <span id="volatile-highlightedchainids">highlightedChainIds</span>             | `string[]`                                       |
| <span id="volatile-selectedchainids">selectedChainIds</span>                   | `string[]`                                       |
| <span id="volatile-colortagmap">colorTagMap</span>                             | `Record<string, string>`                         |
| <span id="volatile-modificationsready">modificationsReady</span>               | `false`                                          |
| <span id="volatile-overcigaritem">overCigarItem</span>                         | `false`                                          |

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
the promotable-slot tiers (getConf): an explicit track value pins labels on or
off; otherwise it follows the session-wide default, falling back to off. A
`maybeBoolean` slot, so (like mismatchAlpha) a session default of "on" can be
customized back off on a single track.

```ts
type showSashimiLabels = boolean
```

#### getter: showSashimiLabelsDisplayTypeDefault

"make the current sashimi-label state the default for all tracks" control (pin):
symmetric, so it promotes whichever value the track currently shows.

```ts
type showSashimiLabelsDisplayTypeDefault = DisplayTypeDefaultControl
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

Legend categories contributed by the read-cloud endpoint squares — the arc color
slots actually plotted, mapped to legend buckets. Read-fill categories miss the
cloud-only buckets (split junctions especially), so these are merged into the
legend. Empty unless in read-cloud mode with the legend shown.

```ts
type readCloudLegendCategories = Set<ReadColorCategory>
```

#### getter: belowCoverageBandsInput

Inputs to `belowCoverageBandsGeometry` — the below-coverage band settings plus
whether any sashimi junction is present. Defined here (an earlier .views block
than `belowCoverageBands`) so the fit-budget `laidOutByGroup` and the
`belowCoverageBands` getter share one source.

```ts
type belowCoverageBandsInput = {…}
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

#### getter: layoutReady

Whether `searchFeatureByID` has a pileup to search. Same name and meaning as the
canvas display's; see MultiRegionDisplayMixin.

```ts
type layoutReady = boolean
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
type renderSections = { groupKey: string; label: string; laidOutPileupMap: Map<…>; topOffset: number; coverageTop: number; coverageHeight: number; sashimiBandTop: number; pileupHeight: number; }[]
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

#### getter: sashimiArcSections

Per-section sashimi arcs, in stacking order: each group's junction geometry
(sashimi counts live per-group) already split into the two sub-bands, paired
with their content-space tops — `coverageOverlayTop` for `up` arcs drawn over
the coverage histogram, `sashimiBandTop` for `down` arcs in the reserved strip
below it. In 'auto' both are populated; 'up'/'down' leave the other empty. The
overlay and SVG export both map over this, so it is the single source for
sashimi geometry and neither path can drift; ungrouped is the single-section
case (sticky band below sticky coverage). Empty when sashimi is off.

A computed on purpose (tier 3 — mirrors `bezierPairSections`): the arc math
depends on the view's pan/zoom but NOT on scrollTop, so MobX replays the cache
while the user scrolls a grouped track. Computing it in the overlay's render
instead re-ran the O(n^2) 'auto' side assignment for every section on every
scroll frame.

```ts
type sashimiArcSections = {
  groupKey: string
  up: SashimiArc[]
  down: SashimiArc[]
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

Also clamped down to the NORMAL read pitch — not the currently configured height
— because fit OVERRIDES the compactness preset: a handful of reads in a tall
display would otherwise stretch to fill it, e.g. one read blown up to 100px.
Capping at the configured height would instead let a Compact/Super-compact
selection clamp the fit expansion (compact overriding fit), so a fit under
Compact could never grow past 3px. Fit should only ever squeeze reads smaller
than normal, never grow them past it; once there's more room than reads need,
the extra space is left blank (`laidOutByGroup` already scrolls/pads for the
shortfall).

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

| Member                                                                                               | Type                                                                            |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| <span id="getter-linkedreads">linkedReads</span>                                                     | `LinkedReadsMode`                                                               |
| <span id="getter-pairsdisplaytypedefault">pairsDisplayTypeDefault</span>                             | `DisplayTypeDefaultControl`                                                     |
| <span id="getter-showbezierconnections">showBezierConnections</span>                                 | `boolean`                                                                       |
| <span id="getter-showcoverage">showCoverage</span>                                                   | `boolean`                                                                       |
| <span id="getter-showpileup">showPileup</span>                                                       | `boolean`                                                                       |
| <span id="getter-coverageheight">coverageHeight</span>                                               | `number`                                                                        |
| <span id="getter-showmismatches">showMismatches</span>                                               | `boolean`                                                                       |
| <span id="getter-showinterbaseindicators">showInterbaseIndicators</span>                             | `boolean`                                                                       |
| <span id="getter-drawsingletons">drawSingletons</span>                                               | `boolean`                                                                       |
| <span id="getter-drawproperpairs">drawProperPairs</span>                                             | `boolean`                                                                       |
| <span id="getter-showonlysplitalignments">showOnlySplitAlignments</span>                             | `boolean`                                                                       |
| <span id="getter-flipstrandlongreadchains">flipStrandLongReadChains</span>                           | `boolean`                                                                       |
| <span id="getter-colorsupplementarychains">colorSupplementaryChains</span>                           | `boolean`                                                                       |
| <span id="getter-drawinter">drawInter</span>                                                         | `boolean`                                                                       |
| <span id="getter-drawlongrange">drawLongRange</span>                                                 | `boolean`                                                                       |
| <span id="getter-arccolorbytype">arcColorByType</span>                                               | `ArcColorByType`                                                                |
| <span id="getter-readconnections">readConnections</span>                                             | `ReadConnectionsMode`                                                           |
| <span id="getter-arcsdisplaytypedefault">arcsDisplayTypeDefault</span>                               | `DisplayTypeDefaultControl`                                                     |
| <span id="getter-readclouddisplaytypedefault">readCloudDisplayTypeDefault</span>                     | `DisplayTypeDefaultControl`                                                     |
| <span id="getter-readconnectionsdown">readConnectionsDown</span>                                     | `boolean`                                                                       |
| <span id="getter-readconnectionsdowndisplaytypedefault">readConnectionsDownDisplayTypeDefault</span> | `DisplayTypeDefaultControl`                                                     |
| <span id="getter-showsashimiarcs">showSashimiArcs</span>                                             | `boolean`                                                                       |
| <span id="getter-sashimiarcsmode">sashimiArcsMode</span>                                             | `SashimiArcsMode`                                                               |
| <span id="getter-sashimidowndisplaytypedefault">sashimiDownDisplayTypeDefault</span>                 | `DisplayTypeDefaultControl`                                                     |
| <span id="getter-sashimiautodisplaytypedefault">sashimiAutoDisplayTypeDefault</span>                 | `DisplayTypeDefaultControl`                                                     |
| <span id="getter-minsashimiscore">minSashimiScore</span>                                             | `number`                                                                        |
| <span id="getter-sashimiarcsheight">sashimiArcsHeight</span>                                         | `number`                                                                        |
| <span id="getter-readconnectionsheight">readConnectionsHeight</span>                                 | `number`                                                                        |
| <span id="getter-showsoftclipping">showSoftClipping</span>                                           | `boolean`                                                                       |
| <span id="getter-softclippingdisplaytypedefault">softClippingDisplayTypeDefault</span>               | `DisplayTypeDefaultControl`                                                     |
| <span id="getter-ischainmode">isChainMode</span>                                                     | `boolean`                                                                       |
| <span id="getter-scaletype">scaleType</span>                                                         | `"linear" \| "log"`                                                             |
| <span id="getter-autoscaletype">autoscaleType</span>                                                 | `"local" \| "localsd"`                                                          |
| <span id="getter-minscore">minScore</span>                                                           | `number`                                                                        |
| <span id="getter-maxscore">maxScore</span>                                                           | `number`                                                                        |
| <span id="getter-minscorebound">minScoreBound</span>                                                 | `number \| undefined`                                                           |
| <span id="getter-maxscorebound">maxScoreBound</span>                                                 | `number \| undefined`                                                           |
| <span id="getter-numstddev">numStdDev</span>                                                         | `number`                                                                        |
| <span id="getter-featurewidgettype">featureWidgetType</span>                                         | `{ type: string; id: string; }`                                                 |
| <span id="getter-selectedfeatureid">selectedFeatureId</span>                                         | `string \| undefined`                                                           |
| <span id="getter-tooltipcomponent">TooltipComponent</span>                                           | `LazyExoticComponent<…>`                                                        |
| <span id="getter-detectedmodificationtypes">detectedModificationTypes</span>                         | `string[]`                                                                      |
| <span id="getter-colorby">colorBy</span>                                                             | `ColorBy`                                                                       |
| <span id="getter-filterby">filterBy</span>                                                           | `FilterBy`                                                                      |
| <span id="getter-featureheight">featureHeight</span>                                                 | `number`                                                                        |
| <span id="getter-featurespacing">featureSpacing</span>                                               | `number`                                                                        |
| <span id="getter-rowheight">rowHeight</span>                                                         | `number`                                                                        |
| <span id="getter-configuredfeatureheight">configuredFeatureHeight</span>                             | `number`                                                                        |
| <span id="getter-maxheight">maxHeight</span>                                                         | `number`                                                                        |
| <span id="getter-chainidmap">chainIdMap</span>                                                       | `Map<string, string[]>`                                                         |
| <span id="getter-showlowfreqmismatches">showLowFreqMismatches</span>                                 | `boolean`                                                                       |
| <span id="getter-filtermismatchesbyfrequency">filterMismatchesByFrequency</span>                     | `boolean`                                                                       |
| <span id="getter-mismatchalpha">mismatchAlpha</span>                                                 | `boolean`                                                                       |
| <span id="getter-mismatchalphadisplaytypedefault">mismatchAlphaDisplayTypeDefault</span>             | `DisplayTypeDefaultControl`                                                     |
| <span id="getter-showlegend">showLegend</span>                                                       | `boolean`                                                                       |
| <span id="getter-sortedby">sortedBy</span>                                                           | `SortedBy \| undefined`                                                         |
| <span id="getter-coverageislog">coverageIsLog</span>                                                 | `boolean`                                                                       |
| <span id="getter-coveragestats">coverageStats</span>                                                 | `ScoreStats \| undefined`                                                       |
| <span id="getter-coveragedomain">coverageDomain</span>                                               | `[number, number] \| undefined`                                                 |
| <span id="getter-coverageticks">coverageTicks</span>                                                 | `YScaleTicks \| undefined`                                                      |
| <span id="getter-colorpalette">colorPalette</span>                                                   | `ColorPalette`                                                                  |
| <span id="getter-modificationthreshold">modificationThreshold</span>                                 | `number`                                                                        |
| <span id="getter-colorschemeindex">colorSchemeIndex</span>                                           | `number`                                                                        |
| <span id="getter-showmodifications">showModifications</span>                                         | `boolean`                                                                       |
| <span id="getter-showperbasequality">showPerBaseQuality</span>                                       | `boolean`                                                                       |
| <span id="getter-showperbaseletter">showPerBaseLetter</span>                                         | `boolean`                                                                       |
| <span id="getter-readidindexmap">readIdIndexMap</span>                                               | `Map<string, { displayedRegionIndex: number; groupKey: string; idx: number; }>` |
| <span id="getter-readconnectionslinewidth">readConnectionsLineWidth</span>                           | `number`                                                                        |
| <span id="getter-coveragedisplayheight">coverageDisplayHeight</span>                                 | `number`                                                                        |
| <span id="getter-height">height</span>                                                               | `number`                                                                        |
| <span id="getter-scalebaroverlapleft">scalebarOverlapLeft</span>                                     | `number`                                                                        |
| <span id="getter-showoutline">showOutline</span>                                                     | `any`                                                                           |
| <span id="getter-visiblelabels">visibleLabels</span>                                                 | `VisibleLabel[]`                                                                |
| <span id="getter-scrollableheight">scrollableHeight</span>                                           | `number`                                                                        |
| <span id="getter-sorttag">sortTag</span>                                                             | `string \| undefined`                                                           |
| <span id="getter-renderstate">renderState</span>                                                     | `{…}`                                                                           |
| <span id="getter-arcsydomainbp">arcsYDomainBp</span>                                                 | `number \| undefined`                                                           |
| <span id="getter-insertsizeticks">insertSizeTicks</span>                                             | `YScaleTicks \| undefined`                                                      |
| <span id="getter-featureundermouse">featureUnderMouse</span>                                         | `SimpleFeature \| undefined`                                                    |

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
type trackMenuItems = () => (MenuItem | { label: string; type: "subMenu"; icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; subMenu: MenuItem[]; } | { ...; } | { ...; })[]
```

</details>

<details>
<summary>LinearAlignmentsDisplay - Methods (other undocumented members)</summary>

| Member                                                             | Type                                                                                                                                                          |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <span id="method-legenditems">legendItems</span>                   | `() => LegendItem[]`                                                                                                                                          |
| <span id="method-findfeatureinrpcdata">findFeatureInRpcData</span> | `(featureId: string) => { displayedRegionIndex: number; idx: number; rpcData: PileupDataResult; start: number; end: number; } \| undefined`                   |
| <span id="method-searchfeaturebyid">searchFeatureByID</span>       | `(featureId: string) => [number, number, number, number] \| undefined`                                                                                        |
| <span id="method-getfeatureinfobyid">getFeatureInfoById</span>     | `(featureId: string) => { id: string; name: string; start: number; end: number; flags: number; mapq: number; strand: number; refName: string; } \| undefined` |
| <span id="method-rpcprops">rpcProps</span>                         | `() => {…}`                                                                                                                                                   |
| <span id="method-contextmenuitems">contextMenuItems</span>         | `() => MenuItem[]`                                                                                                                                            |

</details>

<details>
<summary>LinearAlignmentsDisplay - Actions</summary>

#### action: onRegionTooLarge

Clear the hover/tooltip when the region goes too large (the banner replaces the
pileup). Called by MultiRegionDisplayMixin's `ClearHoverOnRegionTooLarge`
autorun, so it fires on the derived gate's `regionTooLarge` transition without
an imperative setter.

```ts
type onRegionTooLarge = () => void
```

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

#### action: setFeatureHeight

Set the per-read pixel size. The track-sizing mode is a mostly independent axis
(changed via setHeightMode): grow keeps growing at the new size. Fit is the
exception — it derives the size, so a chosen size would be dormant; picking one
drops back to fixed so the pick takes effect.

```ts
type setFeatureHeight = (height?: number | undefined) => void
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
split it into a body + derived gap. Written only by the driving autorun.

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
type openContextMenu = (args: {…}) => void
```

#### action: resizeHeight

A manual drag-resize means the user wants a fixed height; leave grow mode first,
otherwise the grow autorun snaps the height back on the next relayout and the
drag appears to do nothing (mirrors canvas). Read the displayed (grown) height
before flipping and write `grown + distance` directly — the grow-exit bake skips
when the slot is written during the exit, so this delta isn't clobbered.

```ts
type resizeHeight = (distance: number) => number
```

</details>

<details>
<summary>LinearAlignmentsDisplay - Actions (other undocumented members)</summary>

| Member                                                                             | Type                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <span id="action-clearmouseoverstate">clearMouseoverState</span>                   | `() => void`                                                                                                                                                                           |
| <span id="action-seterror">setError</span>                                         | `(error?: unknown) => void`                                                                                                                                                            |
| <span id="action-setrpcdata">setRpcData</span>                                     | `(displayedRegionIndex: number, data: GroupedAlignmentsResult \| null) => void`                                                                                                        |
| <span id="action-cleardisplayspecificdata">clearDisplaySpecificData</span>         | `() => void`                                                                                                                                                                           |
| <span id="action-setovercigaritem">setOverCigarItem</span>                         | `(flag: boolean) => void`                                                                                                                                                              |
| <span id="action-setscrolltop">setScrollTop</span>                                 | `(scrollTop: number) => void`                                                                                                                                                          |
| <span id="action-sethighlightedchainids">setHighlightedChainIds</span>             | `(ids: string[]) => void`                                                                                                                                                              |
| <span id="action-clearhighlights">clearHighlights</span>                           | `() => void`                                                                                                                                                                           |
| <span id="action-clearselection">clearSelection</span>                             | `() => void`                                                                                                                                                                           |
| <span id="action-setselectedchainids">setSelectedChainIds</span>                   | `(ids: string[]) => void`                                                                                                                                                              |
| <span id="action-setcolorscheme">setColorScheme</span>                             | `(colorBy: ColorBy) => void`                                                                                                                                                           |
| <span id="action-updatecolortagmap">updateColorTagMap</span>                       | `(uniqueTag: string[]) => void`                                                                                                                                                        |
| <span id="action-setfilterby">setFilterBy</span>                                   | `(filterBy: FilterBy) => void`                                                                                                                                                         |
| <span id="action-setshowsoftclipping">setShowSoftClipping</span>                   | `(value: boolean) => void`                                                                                                                                                             |
| <span id="action-setmismatchalpha">setMismatchAlpha</span>                         | `(value: boolean) => void`                                                                                                                                                             |
| <span id="action-setsortedby">setSortedBy</span>                                   | `(type: string, tag?: string \| undefined) => void`                                                                                                                                    |
| <span id="action-setsortedbyatposition">setSortedByAtPosition</span>               | `(arg: { type: string; pos: number; refName: string; tag?: string \| undefined; }) => void`                                                                                            |
| <span id="action-clearsortedby">clearSortedBy</span>                               | `() => void`                                                                                                                                                                           |
| <span id="action-setlargefeaturesfirst">setLargeFeaturesFirst</span>               | `(flag: boolean) => void`                                                                                                                                                              |
| <span id="action-setscaletype">setScaleType</span>                                 | `(val: string) => void`                                                                                                                                                                |
| <span id="action-setautoscale">setAutoscale</span>                                 | `(val?: string \| undefined) => void`                                                                                                                                                  |
| <span id="action-setminscore">setMinScore</span>                                   | `(val?: number \| undefined) => void`                                                                                                                                                  |
| <span id="action-setmaxscore">setMaxScore</span>                                   | `(val?: number \| undefined) => void`                                                                                                                                                  |
| <span id="action-setmaxheight">setMaxHeight</span>                                 | `(height?: number \| undefined) => void`                                                                                                                                               |
| <span id="action-setshowsashimiarcs">setShowSashimiArcs</span>                     | `(show: boolean) => void`                                                                                                                                                              |
| <span id="action-setreadconnections">setReadConnections</span>                     | `(mode: ReadConnectionsMode) => void`                                                                                                                                                  |
| <span id="action-setreadconnectionsdown">setReadConnectionsDown</span>             | `(down: boolean) => void`                                                                                                                                                              |
| <span id="action-setshowcoverage">setShowCoverage</span>                           | `(show: boolean) => void`                                                                                                                                                              |
| <span id="action-setshowpileup">setShowPileup</span>                               | `(show: boolean) => void`                                                                                                                                                              |
| <span id="action-setcoverageheight">setCoverageHeight</span>                       | `(height: number) => void`                                                                                                                                                             |
| <span id="action-setreadconnectionsheight">setReadConnectionsHeight</span>         | `(height: number) => void`                                                                                                                                                             |
| <span id="action-setsashimiarcsheight">setSashimiArcsHeight</span>                 | `(height: number) => void`                                                                                                                                                             |
| <span id="action-setminsashimiscore">setMinSashimiScore</span>                     | `(score: number) => void`                                                                                                                                                              |
| <span id="action-setsashimiarcsmode">setSashimiArcsMode</span>                     | `(mode: SashimiArcsMode) => void`                                                                                                                                                      |
| <span id="action-setshowsashimilabels">setShowSashimiLabels</span>                 | `(show: boolean) => void`                                                                                                                                                              |
| <span id="action-setreadconnectionslinewidth">setReadConnectionsLineWidth</span>   | `(width: number) => void`                                                                                                                                                              |
| <span id="action-setdrawinter">setDrawInter</span>                                 | `(draw: boolean) => void`                                                                                                                                                              |
| <span id="action-setdrawlongrange">setDrawLongRange</span>                         | `(draw: boolean) => void`                                                                                                                                                              |
| <span id="action-setarccolorbytype">setArcColorByType</span>                       | `(type: ArcColorByType) => void`                                                                                                                                                       |
| <span id="action-setshowmismatches">setShowMismatches</span>                       | `(show: boolean) => void`                                                                                                                                                              |
| <span id="action-setshowlegend">setShowLegend</span>                               | `(show: boolean \| undefined) => void`                                                                                                                                                 |
| <span id="action-setdrawsingletons">setDrawSingletons</span>                       | `(flag: boolean) => void`                                                                                                                                                              |
| <span id="action-setdrawproperpairs">setDrawProperPairs</span>                     | `(flag: boolean) => void`                                                                                                                                                              |
| <span id="action-setshowonlysplitalignments">setShowOnlySplitAlignments</span>     | `(flag: boolean) => void`                                                                                                                                                              |
| <span id="action-setshowinterbaseindicators">setShowInterbaseIndicators</span>     | `(show: boolean) => void`                                                                                                                                                              |
| <span id="action-setflipstrandlongreadchains">setFlipStrandLongReadChains</span>   | `(flag: boolean) => void`                                                                                                                                                              |
| <span id="action-setcolorsupplementarychains">setColorSupplementaryChains</span>   | `(flag: boolean) => void`                                                                                                                                                              |
| <span id="action-setlinkedreads">setLinkedReads</span>                             | `(mode: LinkedReadsMode) => void`                                                                                                                                                      |
| <span id="action-updatevisiblemodifications">updateVisibleModifications</span>     | `(uniqueModifications: string[]) => void`                                                                                                                                              |
| <span id="action-setmodificationsready">setModificationsReady</span>               | `(flag: boolean) => void`                                                                                                                                                              |
| <span id="action-setfeatureidundermouse">setFeatureIdUnderMouse</span>             | `(feature?: string \| undefined) => void`                                                                                                                                              |
| <span id="action-setmouseoverextrainformation">setMouseoverExtraInformation</span> | `(extra?: TooltipPayload \| undefined) => void`                                                                                                                                        |
| <span id="action-sethoverstate">setHoverState</span>                               | `(state: { overCigarItem: boolean; featureIdUnderMouse: string \| undefined; mouseoverExtraInformation: TooltipPayload \| undefined; hoverCoverageBand?: {…} \| undefined; }) => void` |
| <span id="action-setcontextmenufeature">setContextMenuFeature</span>               | `(feature?: Feature \| undefined) => void`                                                                                                                                             |
| <span id="action-closecontextmenu">closeContextMenu</span>                         | `() => void`                                                                                                                                                                           |
| <span id="action-selectfeature">selectFeature</span>                               | `(feature: Feature) => void`                                                                                                                                                           |
| <span id="action-startrenderingbackend">startRenderingBackend</span>               | `(backend: AlignmentsRenderingBackend) => void`                                                                                                                                        |
| <span id="action-selectfeaturebyid">selectFeatureById</span>                       | `(featureId: string) => Promise<void>`                                                                                                                                                 |
| <span id="action-getbyteestimateconfig">getByteEstimateConfig</span>               | `() => { adapterConfig: any; visibleBp: number; }`                                                                                                                                     |
| <span id="action-fetchneeded">fetchNeeded</span>                                   | `(needed: { region: Region; displayedRegionIndex: number; }[]) => Promise<void>`                                                                                                       |
| <span id="action-rendersvg">renderSvg</span>                                       | `(opts?: ExportSvgDisplayOptions \| undefined) => Promise<ReactElement<unknown, string \| JSXElementConstructor<any>> \| Iterable<...> \| AwaitedReactNode>`                           |

</details>

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

<details>
<summary>Derived from BaseDisplay</summary>

[BaseDisplay →](../basedisplay)

**Properties**

#### property: ignorePromotedDefaults

true for a display that arrived inside a session received from someone else (a
share link, an encoded/json session, a `spec-` URL). Such a display resolves its
`promotable` config slots from its own config only, never from this browser's
promoted display-type defaults (see `configuration/promotableDefaults.ts`) — the
received session is a record of what the sender saw, and a local preference
silently repainting it would make it a lie. A track opened _afterwards_ in that
same session is a fresh track of this user's, so it never gets the flag and
picks up their defaults normally. Cleared by `resetSlotsToInherit` when the user
deliberately makes the display follow a default.

```ts
// type signature
type ignorePromotedDefaults = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
ignorePromotedDefaults: types.stripDefault(types.boolean, false)
```

| Member                                                 | Type                                               |
| ------------------------------------------------------ | -------------------------------------------------- |
| <span id="property-id">id</span>                       | `IOptionalIType<ISimpleType<string>, [undefined]>` |
| <span id="property-rpcdrivername">rpcDriverName</span> | `IMaybe<ISimpleType<string>>`                      |

**Volatiles**

#### volatile: statusProgress

determinate progress fraction [0,1] for the current status, or undefined when
the in-flight phase is indeterminate. Set alongside `statusMessage` by
`setStatusMessage`; a display that never shows a bar simply leaves it undefined.

```ts
// type signature
type statusProgress = number | undefined
// code
statusProgress: undefined as number | undefined
```

| Member                                                 | Type                  |
| ------------------------------------------------------ | --------------------- |
| <span id="volatile-error">error</span>                 | `unknown`             |
| <span id="volatile-statusmessage">statusMessage</span> | `string \| undefined` |

**Getters**

#### getter: parentDisplay

Returns the parent display if this display is nested within another display
(e.g., PileupDisplay inside LinearAlignmentsDisplay)

```ts
type parentDisplay =
  | { type?: string | undefined; effectiveRpcDriverName?: string | undefined }
  | undefined
```

#### getter: isMinimized

Returns true if the parent track is minimized. Used to skip expensive operations
like autoruns when track is not visible.

```ts
type isMinimized = boolean
```

#### getter: effectiveRpcDriverName

Returns the effective RPC driver name with hierarchical fallback:

1. This display's explicit rpcDriverName
2. Parent display's effectiveRpcDriverName (for nested displays)
3. Track config's rpcDriverName

```ts
type effectiveRpcDriverName = any
```

#### getter: DisplayMessageComponent

if a display-level message should be displayed instead, make this return a react
component

```ts
type DisplayMessageComponent = FC<any> | undefined
```

| Member                                                         | Type                                                                                            |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| <span id="getter-parenttrack">parentTrack</span>               | `AbstractTrackModel`                                                                            |
| <span id="getter-renderingcomponent">RenderingComponent</span> | `FC<…>`                                                                                         |
| <span id="getter-displayblurb">DisplayBlurb</span>             | `FC<{ model: ModelInstanceTypeProps<…> & { ...; } & { ...; } & IStateTreeNode<...>; }> \| null` |
| <span id="getter-adapterconfig">adapterConfig</span>           | `any`                                                                                           |

**Methods**

#### method: renderingProps

props passed to the renderer's React "Rendering" component. these are
client-side only and never sent to the worker. includes displayModel and
callbacks

```ts
type renderingProps = () => { displayModel: ModelInstanceTypeProps<…> & { ...; } & { ...; } & { ...; } & IStateTreeNode<...>; }
```

| Member                                                                 | Type         |
| ---------------------------------------------------------------------- | ------------ |
| <span id="method-regioncannotberendered">regionCannotBeRendered</span> | `() => null` |

**Actions**

#### action: setIgnorePromotedDefaults

see the `ignorePromotedDefaults` property

```ts
type setIgnorePromotedDefaults = (flag: boolean) => void
```

#### action: reload

base display reload does nothing, see specialized displays for details

```ts
type reload = () => void
```

| Member                                                     | Type                                        |
| ---------------------------------------------------------- | ------------------------------------------- |
| <span id="action-setstatusmessage">setStatusMessage</span> | `(status?: RpcStatus \| undefined) => void` |
| <span id="action-setrpcdrivername">setRpcDriverName</span> | `(rpcDriverName: string) => void`           |

</details>

<details>
<summary>Derived from TrackHeightMixin</summary>

[TrackHeightMixin →](../trackheightmixin)

**Actions**

| Member                                       | Type                                |
| -------------------------------------------- | ----------------------------------- |
| <span id="action-setheight">setHeight</span> | `(displayHeight: number) => number` |

</details>

<details>
<summary>Derived from HeightModeMixin</summary>

[HeightModeMixin →](../heightmodemixin)

**Getters**

#### getter: heightMode

The resolved track-height strategy (`fixed`/`grow`/`fit`). Promotable sentinel
slot: getConf walks the customized-track -> session-default -> `fixed` cascade
and never returns the `inherit` sentinel.

```ts
type heightMode = HeightMode
```

#### getter: fitTargetHeight

The drag-resizable track height as stored in the config slot — the fit target
the fit/grow layout scales or packs content into. Read there instead of the
reactive `height` getter to break the grow-mode cycle
(`height`->grownHeight->layout->height). Equals `height` in fixed/fit.

```ts
type fitTargetHeight = number
```

#### getter: autoHeight

`grow` mode as a boolean, derived from the unified `heightMode` slot.

```ts
type autoHeight = boolean
```

#### getter: fitHeightToDisplay

`fit` mode as a boolean, derived from the unified `heightMode` slot.

```ts
type fitHeightToDisplay = boolean
```

</details>

<details>
<summary>Derived from MultiRegionDisplayMixin</summary>

[MultiRegionDisplayMixin →](../multiregiondisplaymixin)

**Volatiles**

#### volatile: loadedRegions

regions whose data has been fetched and committed, keyed by
displayedRegionIndex; populated only after the fetch work callback returns

```ts
// type signature
type loadedRegions = ObservableMap<number, Region>
// code
loadedRegions: observable.map<number, Region>()
```

**Getters**

#### getter: isReady

true once the canvas has painted and no fetch is in flight

```ts
type isReady = boolean
```

#### getter: viewportWithinLoadedData

true when every visible block lies within an already-fetched region — i.e. the
viewport shows data we actually loaded, not the stale fringe left after a
zoom-out/pan. Drives the loading overlay through the pre-refetch debounce.
Spatial only; see CLAUDE.md for why this is exact and for the
resolution-staleness gap.

```ts
type viewportWithinLoadedData = boolean
```

#### getter: svgReady

true once an off-screen (SVG) export can safely read this display's data: every
visible region has loaded, or the fetch reached a terminal error / too-large
state. Off-screen renderers gate on it via `awaitSvgReady(model)` instead of
inlining the condition. Regions stream in one at a time, so gating on
`viewportWithinLoadedData` (not the first datum) is what keeps
multi-region/whole-genome exports complete; `loadedRegions.size` guards the
vacuously-true empty-viewport case.

```ts
type svgReady = boolean
```

#### getter: svgReadyExtraTerminal

Overridable hook (default false): a subclass returns true to mark an extra
terminal state where off-screen export can proceed with no loaded data. Sequence
sets it when zoomed past base resolution — it renders a static "zoom in" message
and fetches nothing, so `svgReady` would otherwise never resolve.

```ts
type svgReadyExtraTerminal = boolean
```

#### getter: renderBlocks

Shared cached view for every LGV-based GPU display. A single displayedRegion may
produce multiple render blocks (shared GPU buffer, different scissor clips on
screen). Plugins that want to suppress rendering in certain states (e.g. no
domain yet) can override this getter to return [] — the autorun lifecycle will
then issue an empty-blocks render that clears the canvas.

```ts
type renderBlocks = RenderBlock[]
```

#### getter: displayPhase

The display's mutually-exclusive visual state, precedence single-sourced in
`computeDisplayPhase`. Here `loading` means data isn't ready yet, or stale data
(viewport past loaded) is still on screen through the pre-refetch debounce.

```ts
type displayPhase = DisplayPhase
```

#### getter: rpcPropsCacheKey

The RPC cache key: the subclass's `rpcProps()` payload serialized to a string,
so this getter's value is a primitive and MobX invalidates its observers only
when the payload actually changed. Building the payload touches far more
observables than it returns — canvas builds it from a whole config snapshot
(`resolvePromotableConfigSnapshot`), which reads every slot on the display
config — so an observer of the raw call would refetch on purely main-thread
settings (showLabels, heightMode, a compact/normal displayMode flip) that the
payload deliberately excludes. A fresh object would also never compare equal.
`''` for a display with no `rpcProps` (the SettingsInvalidate autorun isn't
installed there).

```ts
type rpcPropsCacheKey = string
```

#### getter: derivedRegionTooLargeEnabled

Derived opt-in for the region-too-large gate: a display that declares a
pre-flight byte estimate (`getByteEstimateConfig`) gates on it — the two are one
decision, so they can't desync (this replaces the old dev-time "config set but
gate off" console.error). Displays that capture the estimate through a custom
fetch (LD, arc) or fold the byte check into their feature RPC (canvas) leave
`getByteEstimateConfig` null and flip this true themselves.

Guarded on `view.initialized`: `getByteEstimateConfig` reads `visibleBp` (which
throws pre-init), and this getter is read from menu code before first paint.
Pre-init the banner never shows anyway, so `false` is right.

```ts
type derivedRegionTooLargeEnabled = boolean
```

**Actions**

#### action: setLoadedRegion

Action wrapper so callers after async boundaries stay in MST strict mode.

```ts
type setLoadedRegion = (displayedRegionIndex: number, region: Region) => void
```

#### action: clearAllRpcData

full reset: cancels fetch, clears error, loadedRegions, display-specific data,
and the canvas-drawn flag. The too-large gate is derived (a pure function of the
cached estimate × viewport), so it needs no explicit clear here — it
self-releases when the viewport changes.

```ts
type clearAllRpcData = () => void
```

#### action: invalidateLoadedRegions

lighter reset: cancels fetch and clears loadedRegions, leaving error and
regionTooLarge intact

```ts
type invalidateLoadedRegions = () => void
```

#### action: isCacheValid

Overridable hook: return `false` to force re-fetch at the current zoom (wiggle
uses this for zoom-level changes).

```ts
type isCacheValid = (_displayedRegionIndex: number) => boolean
```

#### action: fetchRegions

Run a per-region fetch with byte-estimate gating. Marks regions as loaded only
AFTER the work callback has populated display-specific data (rpcDataMap,
cellData, etc) so the GPU upload autorun sees committed data when it observes
loadedRegions.

```ts
type fetchRegions = (
  needed: { region: Region; displayedRegionIndex: number }[],
  work: (ctx: FetchContext) => Promise<void>,
) => Promise<void>
```

#### action: afterAttach

installs the five fetch-lifecycle autoruns (DisplayedRegionsChange,
FetchVisibleRegions, SettingsInvalidate, ClearBlockingStateOnViewportChange,
ClearHoverOnRegionTooLarge)

```ts
type afterAttach = () => void
```

</details>

<details>
<summary>Derived from RegionTooLargeMixin</summary>

[RegionTooLargeMixin →](../regiontoolargemixin)

**Volatiles**

#### volatile: userByteLimit

user-confirmed byte limit after a force-load, disabling the gate. Volatile, not
persisted: the interactive force-load button is a transient "show me this now"
action and must not leak a raised gate into a saved or shared session. The
declarative, session-scoped escape hatch is instead the `forceLoad` config slot
(set per-session via a session spec, or baked into a track config for
embedded/notebook views).

```ts
// type signature
type userByteLimit = number | undefined
// code
userByteLimit: undefined as number | undefined
```

#### volatile: byteEstimate

Last byte estimate reported for this display, with the adapter's own
`fetchSizeLimit` and `alwaysRender` flag. Its `bytes` covers `measuredSpanBp`,
not the span on screen now. Survives `clearAllRpcData` so an ordinary viewport
change doesn't flicker the banner; only chromosome navigation drops it.

```ts
// type signature
type byteEstimate = RegionByteEstimate | undefined
// code
byteEstimate: undefined as RegionByteEstimate | undefined
```

#### volatile: measuredSpanBp

The span the current `byteEstimate` was measured over, so the derived gate can
rescale it to the span on screen now. Written by `setByteEstimate`; ignored
unless `derivedRegionTooLargeEnabled`.

```ts
// type signature
type measuredSpanBp = number | undefined
// code
measuredSpanBp: undefined as number | undefined
```

**Getters**

#### getter: configuredFetchSizeLimit

The composing display's configured `fetchSizeLimit`, read straight from its
config. Only evaluated when the derived gate is enabled (guarded by
`derivedRegionTooLargeEnabled`), and every derived display extends
`baseLinearDisplayConfigSchema`, which owns the slot — so the read is always
valid where it fires. A display with a bespoke source can still override it.

```ts
type configuredFetchSizeLimit = number
```

#### getter: densityTooLargeForDerivedGate

Extra (non-byte) too-large axis folded into the derived verdict — canvas
overrides it with its feature-density gate. Byte-only derived displays leave it
false.

```ts
type densityTooLargeForDerivedGate = boolean
```

#### getter: configForceLoad

Declarative force-load: when true the display always renders regardless of
region size / feature density (the config-driven equivalent of the force-load
button). Read straight from the `forceLoad` config slot on
`baseLinearDisplayConfigSchema` (same guard/ownership as
`configuredFetchSizeLimit`), so every opt-in display honors it without
per-display wiring.

```ts
type configForceLoad = boolean
```

#### getter: estimatedBytesForVisibleSpan

How many bytes we estimate a fetch of the span on screen right now would pull,
obtained by rescaling the stored estimate from the span it was measured over
(`measuredSpanBp`). Rescaling is what makes the derived verdict a pure function
of the current view and lets it self-release on zoom-in — without it a large
zoomed-out estimate stays above the limit forever and gates refetch. Only
meaningful when `derivedRegionTooLargeEnabled`.

```ts
type estimatedBytesForVisibleSpan = number | undefined
```

#### getter: tooLargeStatus

Shared derived verdict + reason (AUTO_FORCE_LOAD_BP floor, then
bytes-over-limit, then the density axis), fed the scaled estimate so the byte
gate self-releases on zoom-in. Same helper as every other gating path so the
banner text can't drift.

```ts
type tooLargeStatus = RegionTooLargeStatus
```

#### getter: regionTooLarge

The verdict the whole mixin exists to produce: true when the estimated download
for the span on screen exceeds the resolved byte budget, or when the display's
own density axis trips. Derived, so it releases itself on zoom-in. Always false
for a display that hasn't opted in via `derivedRegionTooLargeEnabled`. The fetch
autoruns hold off while it is true, and `DisplayChrome` renders the banner from
it.

```ts
type regionTooLarge = boolean
```

#### getter: regionTooLargeReason

Which axis tripped, as banner text: the estimated download size, or "Too many
features". Empty string when the region isn't too large.

```ts
type regionTooLargeReason = string
```

**Methods**

#### method: regionCannotBeRenderedText

Plaintext reason (for SVG export); the on-screen too-large UI is rendered by the
display chrome via `TooLargeMessage`, not the model.

```ts
type regionCannotBeRenderedText = () => '' | 'Force load to see features'
```

**Actions**

#### action: setByteEstimate

Commits the byte estimate and records the span it covers (`measuredSpanBp`) so
the derived gate can rescale it to the span on screen. Harmless for non-gated
displays (they ignore it).

```ts
type setByteEstimate = (estimate?: RegionByteEstimate | undefined) => void
```

#### action: raiseForceLoadLimits

force-load: raise the byte limit past the current request so the gate releases.
Prefers the estimate for the span on screen now, so it clears even if the view
zoomed out since the measurement; a display with the derived gate off has no
such estimate and falls back to the measured-span number. Canvas (which also has
a density force-load) overrides this entirely.

```ts
type raiseForceLoadLimits = (estimate?: RegionByteEstimate | undefined) => void
```

#### action: forceLoad

Raises the byte limit past the current estimate and triggers a reload. The
display chrome calls this via TooLargeMessage's force-load button; concrete
display models override reload() to do the actual refetch.

```ts
type forceLoad = () => void
```

</details>

<details>
<summary>Derived from RenderLifecycleMixin</summary>

[RenderLifecycleMixin →](../renderlifecyclemixin)

**Volatiles**

#### volatile: canvasDrawn

flips true on first paint; read by test selectors to detect render

```ts
// type signature
type canvasDrawn = false
// code
canvasDrawn: false
```

#### volatile: currentRenderingBackend

current backend reference, updated on context-loss recovery. Typed `unknown`
(not generic `B`) on purpose: this mixin is composed by every display via a
non-generic factory, so the per-display backend type `B` isn't known here — it's
supplied at `attachRenderingBackend<B>` and narrowed with `as B` inside the
autoruns. Don't "fix" the cast.

```ts
// type signature
type currentRenderingBackend = undefined
// code
currentRenderingBackend: undefined
```

#### volatile: renderTick

counter the render autorun observes; bumped to force a re-render

```ts
// type signature
type renderTick = number
// code
renderTick: 0
```

#### volatile: autorunsInstalled

guards attachRenderingBackend so the autorun pair spawns once per instance

```ts
// type signature
type autorunsInstalled = false
// code
autorunsInstalled: false
```

#### volatile: renderError

the render-backend (GPU/Canvas2D init or context-loss) error, or undefined.
Single source of truth for the render-error terminal state:
`useRenderingBackend` writes it from the canvas-init mechanism so the model —
not React-local hook state — owns every terminal state. Read by `displayPhase`
(whose `renderError` term outranks `loading`, suppressing the scrim) and by
`DisplayChrome` (shows the retry overlay).

```ts
// type signature
type renderError = undefined
// code
renderError: undefined
```

**Actions**

#### action: setRenderError

set/clear the render-backend error. Called by `useRenderingBackend`: with the
error when the canvas factory rejects (or context-loss re-init fails), and with
`undefined` on successful (re)init and on retry.

```ts
type setRenderError = (error: unknown) => void
```

#### action: attachRenderingBackend

attach a GPU/Canvas2D backend and install the upload + render autorun pair
(idempotent — re-calling only swaps the backend)

```ts
type attachRenderingBackend = <B>(
  backend: B,
  cbs: RenderingBackendCallbacks<B>,
) => void
```

| Member                                                             | Type         |
| ------------------------------------------------------------------ | ------------ |
| <span id="action-markcanvasdrawn">markCanvasDrawn</span>           | `() => void` |
| <span id="action-resetcanvasdrawn">resetCanvasDrawn</span>         | `() => void` |
| <span id="action-stoprenderingbackend">stopRenderingBackend</span> | `() => void` |
| <span id="action-rendernow">renderNow</span>                       | `() => void` |

</details>

<details>
<summary>Derived from FetchMixin</summary>

[FetchMixin →](../fetchmixin)

**Volatiles**

#### volatile: activeStopToken

stop token of the in-flight fetch, or undefined when idle

```ts
// type signature
type activeStopToken = StopToken | undefined
// code
activeStopToken: undefined as StopToken | undefined
```

#### volatile: fetchGeneration

bumps at every fetch end; autoruns read it to re-evaluate, and it doubles as the
staleness epoch inside runFetch

```ts
// type signature
type fetchGeneration = number
// code
fetchGeneration: 0
```

#### volatile: fetchCanceled

true after the user explicitly cancels a load (the loading overlay's cancel
button → `cancelFetchByUser`). A durable, blocking state — unlike `cancelFetch`,
it does not retrigger the fetch autoruns — so the load stays stopped until the
user retries (`reload`) or the viewport changes. Any new fetch clears it
(`runFetch` resets it at the start).

```ts
// type signature
type fetchCanceled = false
// code
fetchCanceled: false
```

#### volatile: regionStatuses

latest status of each concurrent in-flight operation, keyed by an arbitrary id
(the canvas display uses displayedRegionIndex). Plain bookkeeping — not read
reactively; setRegionStatus derives the observable statusMessage/statusProgress
from it on every update so N parallel region fetches aggregate into one bar
instead of clobbering.

```ts
// type signature
type regionStatuses = Map<number, RpcStatus>
// code
regionStatuses: new Map<number, RpcStatus>()
```

#### volatile: lastStatusMs

Date.now() of the last applied status write; the status callbacks gate on it to
throttle a high-frequency progress stream.

```ts
// type signature
type lastStatusMs = number
// code
lastStatusMs: 0
```

**Getters**

#### getter: isLoading

true while a fetch is active

```ts
type isLoading = boolean
```

**Methods**

#### method: makeStatusCallback

An RPC `statusCallback` bound to this display: forwards progress to the shared
`statusMessage`, guarded by `isAlive` so a callback that fires after the node is
torn down (RPCs resolve their status stream asynchronously) is a safe no-op.
Pass directly as the `statusCallback` RPC arg instead of re-inlining the guard
at every call site.

```ts
type makeStatusCallback = () => (status: RpcStatus) => void
```

#### method: makeRegionStatusCallback

Per-region variant of `makeStatusCallback`: routes progress through
`setRegionStatus(key, …)` so N concurrent per-region fetches aggregate into one
status bar instead of clobbering each other. Same `isAlive` guard.

```ts
type makeRegionStatusCallback = (key: number) => (status: RpcStatus) => void
```

**Actions**

#### action: throttleStatus

Run `apply` only if at least `STATUS_THROTTLE_MS` has passed since the last
status write. A leading-edge throttle: sparse updates pass straight through,
dense progress bursts are thinned so the loading overlay stops re-rendering
faster than the view animates. The final status doesn't need a trailing flush —
fetch completion clears it via `resetStatus`.

```ts
type throttleStatus = (apply: () => void) => void
```

#### action: resetStatus

Drop the active stop token and clear all status bookkeeping. Shared by both
cancel paths and runFetch's cleanup.

```ts
type resetStatus = () => void
```

#### action: stopActiveFetch

Abort the in-flight fetch (if any) and clear its status. The shared preamble of
both cancel paths; the difference between them is only what they do to
`fetchCanceled` / `fetchGeneration` afterward.

```ts
type stopActiveFetch = () => void
```

#### action: setRegionStatus

Record one concurrent operation's latest status (keyed) and recompute the shared
statusMessage/statusProgress as the aggregate across all in-flight keys. Pass
undefined to drop a key. Used by displays that fan a single fetch out into
parallel per-region RPCs.

```ts
type setRegionStatus = (key: number, status?: RpcStatus | undefined) => void
```

#### action: cancelFetch

cancel any in-flight fetch and bump fetchGeneration (always bumps, so callers
can retrigger fetch autoruns even when nothing was in flight). This is the
_internal_ reset used by clearAllRpcData/invalidateLoadedRegions — it clears any
user-cancel flag so the retrigger actually re-fetches.

```ts
type cancelFetch = () => void
```

#### action: cancelFetchByUser

User-initiated cancel from the loading overlay. Stops the in-flight fetch and
lands in a durable `fetchCanceled` state. Unlike `cancelFetch`, it does NOT bump
fetchGeneration — so the fetch autoruns don't immediately restart the load. The
user retries via `reload` (the overlay's retry button), or it clears on the next
viewport change.

```ts
type cancelFetchByUser = () => void
```

#### action: beforeDestroy

Release an in-flight fetch's stop token on teardown. Without this, a display
destroyed mid-fetch (track/view closed while loading) never revokes its token —
a blob-URL leak on the non-SAB fallback path — and never signals the worker to
abort the now-useless work. MST auto-chains lifecycle hooks, so a composing
display can still define its own beforeDestroy.

```ts
type beforeDestroy = () => void
```

#### action: runFetch

Run a cancel-safe fetch (cancels any prior). The work callback gets a
FetchContext with a stopToken to forward to the RPC and an isStale() check to
short-circuit commits once the user has moved on. Abort errors are swallowed;
others are stored in `error` if not stale.

```ts
type runFetch = (work: (ctx: FetchContext) => Promise<void>) => Promise<void>
```

</details>

<details>
<summary>Derived from PromotableDefaultsMixin</summary>

[PromotableDefaultsMixin →](../promotabledefaultsmixin)

**Methods**

#### method: displayTypeDefaultChanges

Effective config differences a track following the default inherits from
session-wide defaults (distinct from per-track config edits /
trackConfigDeltas). Drives the "affected by a session default" badge.

```ts
type displayTypeDefaultChanges = () => TrackConfigChange[]
```

**Actions**

#### action: clearDisplayTypeDefaults

Clear the session-wide defaults reported by `displayTypeDefaultChanges` so this
display (and its siblings of the same type) revert to their config values. Backs
the "clear default" action on the selector badge.

```ts
type clearDisplayTypeDefaults = () => void
```

</details>
