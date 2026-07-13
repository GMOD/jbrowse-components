---
id: lgvsyntenydisplay
title: LGVSyntenyDisplay
sidebar_label: Display -> LGVSyntenyDisplay
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`linear-comparative-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LGVSyntenyDisplay/model.ts).

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

## Overview

displays location of "synteny" feature in a plain LGV, allowing linking out to
external synteny views

## Members

| Member                                                                                 | Kind       | Defined by                                            | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [type](#property-type)                                                                 | Properties | LGVSyntenyDisplay                                     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [configuration](#property-configuration)                                               | Properties | LGVSyntenyDisplay                                     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [featureWidgetType](#getter-featurewidgettype)                                         | Getters    | LGVSyntenyDisplay                                     | synteny features open the SyntenyFeatureWidget; the inherited `selectFeature` action reads this getter, so no override is needed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [contextMenuItems](#method-contextmenuitems)                                           | Methods    | LGVSyntenyDisplay                                     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [trackMenuItems](#method-trackmenuitems)                                               | Methods    | LGVSyntenyDisplay                                     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [featureIdUnderMouse](#volatile-featureidundermouse)                                   | Volatiles  | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [mouseoverExtraInformation](#volatile-mouseoverextrainformation)                       | Volatiles  | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [contextMenuFeature](#volatile-contextmenufeature)                                     | Volatiles  | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [contextMenuCoord](#volatile-contextmenucoord)                                         | Volatiles  | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [contextMenuCigarHit](#volatile-contextmenucigarhit)                                   | Volatiles  | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [contextMenuIndicatorHit](#volatile-contextmenuindicatorhit)                           | Volatiles  | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [contextMenuGenomicPos](#volatile-contextmenugenomicpos)                               | Volatiles  | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | Genomic column under a right-click, anchoring the read menu's "sort at the clicked position" items. Set with the block/hits as a unit.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [contextMenuBlock](#volatile-contextmenublock)                                         | Volatiles  | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | The block under a right-click (refName + block-level worker result + bp range). The position sort reads its refName and the indicator/coverage detail items read its rpcData to open the aggregate widget (mirrors the left-click path in useAlignmentsBase).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [rpcDataMap](#volatile-rpcdatamap)                                                     | Volatiles  | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [scrollTop](#volatile-scrolltop)                                                       | Volatiles  | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | pileup vertical scroll offset in px. Also read by the BreakpointSplitView overlay to position its SVG curves.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [collapsedGroups](#volatile-collapsedgroups)                                           | Volatiles  | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | Group keys whose pileup is collapsed to just its coverage band (in-track grouping). Keyed by group key so it survives re-fetches; volatile so it resets on reload. Stale keys from a prior grouping dimension are harmless — they never match the new keys.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [groupMaxHeightOverrides](#volatile-groupmaxheightoverrides)                           | Volatiles  | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | Per-group pileup height override in px (in-track grouping). Keyed by group key, volatile like `collapsedGroups`; absent keys fall back to the display-wide `maxHeight`. Lets a dense section be shrunk independently. Cleared by `setGroupBy`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [fittedHeightPx](#volatile-fittedheightpx)                                             | Volatiles  | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | Cache of the current fitted read height in px, kept in sync by the afterAttach autorun while `fitHeightToDisplay` is on. A volatile (not a getter) because the fit height derives from late layout getters that the early `featureHeight` getter can't reference — the autorun bridges that ordering. 0 until first computed / when nothing fits.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [highlightedChainIds](#volatile-highlightedchainids)                                   | Volatiles  | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [selectedChainIds](#volatile-selectedchainids)                                         | Volatiles  | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [colorTagMap](#volatile-colortagmap)                                                   | Volatiles  | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [visibleModifications](#volatile-visiblemodifications)                                 | Volatiles  | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [modificationsReady](#volatile-modificationsready)                                     | Volatiles  | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [overCigarItem](#volatile-overcigaritem)                                               | Volatiles  | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [hoverCoverageBand](#volatile-hovercoverageband)                                       | Volatiles  | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | Screen-px coverage band of the section currently under a coverage/indicator hover. Drives the tooltip's vertical hover bar so it lands on the hovered group's coverage band, not always the top one. `undefined` when not hovering coverage.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [linkedReads](#getter-linkedreads)                                                     | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [pairsDisplayTypeDefault](#getter-pairsdisplaytypedefault)                             | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [showBezierConnections](#getter-showbezierconnections)                                 | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [showCoverage](#getter-showcoverage)                                                   | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [showPileup](#getter-showpileup)                                                       | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [coverageHeight](#getter-coverageheight)                                               | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [showMismatches](#getter-showmismatches)                                               | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [showInterbaseIndicators](#getter-showinterbaseindicators)                             | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [drawSingletons](#getter-drawsingletons)                                               | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [drawProperPairs](#getter-drawproperpairs)                                             | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [flipStrandLongReadChains](#getter-flipstrandlongreadchains)                           | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [colorSupplementaryChains](#getter-colorsupplementarychains)                           | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [drawInter](#getter-drawinter)                                                         | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [drawLongRange](#getter-drawlongrange)                                                 | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [arcColorByType](#getter-arccolorbytype)                                               | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [readConnections](#getter-readconnections)                                             | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [arcsDisplayTypeDefault](#getter-arcsdisplaytypedefault)                               | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [readCloudDisplayTypeDefault](#getter-readclouddisplaytypedefault)                     | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [readConnectionsDown](#getter-readconnectionsdown)                                     | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [readConnectionsDownDisplayTypeDefault](#getter-readconnectionsdowndisplaytypedefault) | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [showSashimiArcs](#getter-showsashimiarcs)                                             | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [sashimiArcsMode](#getter-sashimiarcsmode)                                             | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [sashimiDownDisplayTypeDefault](#getter-sashimidowndisplaytypedefault)                 | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [sashimiAutoDisplayTypeDefault](#getter-sashimiautodisplaytypedefault)                 | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [minSashimiScore](#getter-minsashimiscore)                                             | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [sashimiArcsHeight](#getter-sashimiarcsheight)                                         | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [readConnectionsHeight](#getter-readconnectionsheight)                                 | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [showSoftClipping](#getter-showsoftclipping)                                           | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [softClippingDisplayTypeDefault](#getter-softclippingdisplaytypedefault)               | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [isChainMode](#getter-ischainmode)                                                     | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [showLinkedReadLines](#getter-showlinkedreadlines)                                     | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | Whether to draw the straight-line pass connecting normal read-pairs in pileup layout. Only meaningful when bezier connections are on AND we are in pileup mode — chain layout has its own connecting-line pass that already covers normal pairs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [scaleType](#getter-scaletype)                                                         | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [autoscaleType](#getter-autoscaletype)                                                 | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [minScore](#getter-minscore)                                                           | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [maxScore](#getter-maxscore)                                                           | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [minScoreBound](#getter-minscorebound)                                                 | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [maxScoreBound](#getter-maxscorebound)                                                 | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [numStdDev](#getter-numstddev)                                                         | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [selectedFeatureId](#getter-selectedfeatureid)                                         | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [TooltipComponent](#getter-tooltipcomponent)                                           | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [visibleModificationTypes](#getter-visiblemodificationtypes)                           | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [colorBy](#getter-colorby)                                                             | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [filterBy](#getter-filterby)                                                           | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [isFitting](#getter-isfitting)                                                         | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | True when fit-to-display mode is on AND a pitch has been computed (`fittedHeightPx > 0`, i.e. there are rows and room to fit them). The single gate both size getters read, so it's obvious they either both split the fitted pitch or both fall back to config — never a mix.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [featureHeight](#getter-featureheight)                                                 | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [featureSpacing](#getter-featurespacing)                                               | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [configuredFeatureHeight](#getter-configuredfeatureheight)                             | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [configuredFeatureSpacing](#getter-configuredfeaturespacing)                           | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [maxHeight](#getter-maxheight)                                                         | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [showSashimiLabels](#getter-showsashimilabels)                                         | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | Whether to draw the supporting-read count on each sashimi arc. Resolved through the promotable-slot tiers (getConfResolved): a track configured `true` pins labels on; otherwise it follows the session-wide default, falling back to off.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [showSashimiLabelsDisplayTypeDefault](#getter-showsashimilabelsdisplaytypedefault)     | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | "make this the default for all tracks" control (pin) for sashimi arc labels                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [chainIdMap](#getter-chainidmap)                                                       | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [showLowFreqMismatches](#getter-showlowfreqmismatches)                                 | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [mismatchAlpha](#getter-mismatchalpha)                                                 | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [mismatchAlphaDisplayTypeDefault](#getter-mismatchalphadisplaytypedefault)             | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [showLegend](#getter-showlegend)                                                       | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [sortedBy](#getter-sortedby)                                                           | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [largeFeaturesFirst](#getter-largefeaturesfirst)                                       | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | Lay out the widest features in the lowest pileup rows (main-thread tier-2 relayout via laidOutPileupMap). LGVSyntenyDisplay defaults it on. Ignored while an explicit `sortedBy` position sort is active.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [groupBy](#getter-groupby)                                                             | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | In-track stacked grouping dimension (undefined = ungrouped). Falls back to the `groupBy` config slot, so a track can be pre-grouped declaratively. Sent to the worker via rpcProps; the worker partitions one fetch into N sections.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [prefersOffset](#getter-prefersoffset)                                                 | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | Offset the track label above the visualization when grouping, so the stacked group sections aren't hidden behind an overlapping label.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [coverageIsLog](#getter-coverageislog)                                                 | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [coverageStats](#getter-coveragestats)                                                 | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [coverageDomain](#getter-coveragedomain)                                               | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [coverageTicks](#getter-coverageticks)                                                 | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [colorLegendCategories](#getter-colorlegendcategories)                                 | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | Read-color buckets actually present across the rendered reads, the single input that lets the legend list only relevant swatches (see legendUtils). Shares readColorCategory with the renderer so the two can't disagree. Empty while the legend is hidden so the O(reads) scan is skipped; MobX memoizes it against rpcDataMap + scheme + mode.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [colorPalette](#getter-colorpalette)                                                   | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [readCloudLegendCategories](#getter-readcloudlegendcategories)                         | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | Legend categories contributed by the read-cloud (samplot) endpoint squares — the arc color slots actually plotted, mapped to legend buckets. Read-fill categories miss the cloud-only buckets (split junctions especially), so these are merged into the legend. Empty unless in samplot mode with the legend shown.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [belowCoverageBandsInput](#getter-belowcoveragebandsinput)                             | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | Inputs to `belowCoverageBandsGeometry` — the below-coverage band settings plus whether any sashimi junction is present. Defined here (an earlier .views block than `belowCoverageBands`) so the fit-budget `laidOutByGroup` and the `belowCoverageBands` getter share one source.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [laidOutByGroup](#getter-laidoutbygroup)                                               | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | Per-group laid-out data: group key → (region index → laid-out data). Each group lays out independently (own `maxRows` cap) so a dense group can't starve the rest. When grouped, the default cap fits all sections into the viewport (`fitGroupMaxRows`) so the stack doesn't tower and need scrolling; a per-group height drag / expand still overrides it. Tag colors are baked here (not in the worker) so colorTagMap stays a main-thread tier-2 setting — see readTagColors.                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [groupLayoutContext](#getter-grouplayoutcontext)                                       | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | The layout mechanics (grouping, sort, soft-clip, colors) shared by the viewport fit pass and any ad-hoc layout — e.g. `fittedFeatureHeight`, which lays every group out uncapped to count rows. Kept apart from the fit policy (row caps), which varies per call.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [groupOrder](#getter-grouporder)                                                       | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | Group keys + labels in stacking order; a single entry (key '') when ungrouped. Derived straight from the fetched `rpcDataMap` (not from the layout pass), so group identity/order stays stable across relayouts.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [laidOutPileupMap](#getter-laidoutpileupmap)                                           | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | Renderer-facing per-region layout. Stage 2 draws a single section, so this exposes the first (for ungrouped, the only) group; Stage 3 switches the renderers to loop `sections` directly.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [sourceSections](#getter-sourcesections)                                               | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | Per-section renderer input, in stacking order. One entry per group (the single key '' when ungrouped). Pairs each group's laid-out region map with its key so the renderers can namespace HAL region keys per section. Parallel to `renderState.sections`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [maxY](#getter-maxy)                                                                   | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | Row count of the primary group across its regions. This reads only the first group (`laidOutPileupMap`), so it is meaningful only on the single-section/ungrouped path (`searchFeatureByID` and the no-data synthetic section in `sections`). Grouped layout sizes each section from its own `groupMaxY`; don't use this as a cross-group aggregate.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [pileupTruncated](#getter-pileuptruncated)                                             | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | True when the ungrouped pileup hit `maxHeight` and overflow reads were collapsed — drives the "max height reached" / "show all" banner. Only the ungrouped (single-group) case: grouped sections surface their own truncation per-label (`isGroupTruncated`), where raising `maxHeight` wouldn't lift the fit-to-viewport cap anyway — expanding the group does. Suppressed in fit-to-display mode for the same reason: reads there are already clamped to a 1px floor, so "Show all" can't deliver a fit — it only deepens the 1px scroll. The overflow indicator still flags the scroll in that case.                                                                                                                                                                                                                                                                                                                                                      |
| [rawDataByGroup](#getter-rawdatabygroup)                                               | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | Raw (un-laid-out) data regrouped as group key → (region idx → data), insertion-ordered so the first key is the primary group. The arc compute and the per-section sashimi overlay both read one group's raw map from here; ungrouped is the single key `''`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [arcsByGroup](#getter-arcsbygroup)                                                     | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | Per-group arc upload feed: group key → (region idx → `ArcsUploadData`). The heavy `computeArcsFromPileupData` pass runs once per group (arcs are pre-grouped by refName so each region lookup is O(1)); ungrouped is the single-group case. Empty map when read-connections are off, so the off-path skips the per-read region scan entirely. Source of truth for the per-section arc feed (`sourceSections`) and the shared cross-group `arcsYDomainBp`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [modificationThreshold](#getter-modificationthreshold)                                 | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [colorSchemeIndex](#getter-colorschemeindex)                                           | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [showModifications](#getter-showmodifications)                                         | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [showPerBaseQuality](#getter-showperbasequality)                                       | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [showPerBaseLetter](#getter-showperbaseletter)                                         | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [readIdIndexMap](#getter-readidindexmap)                                               | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [readConnectionsLineWidth](#getter-readconnectionslinewidth)                           | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [belowCoverageBands](#getter-belowcoveragebands)                                       | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | Geometry of the bands stacked below coverage in arcs-down mode, top to bottom: coverage → paired-end arcs → sashimi. Single source of truth so the layout height, the renderers, and the three resize handles can't drift apart. `arcsBandTop`/`sashimiBandTop` are each band's top edge; `bottom` is where the pileup begins (== coverageDisplayHeight).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [coverageDisplayHeight](#getter-coveragedisplayheight)                                 | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [sections](#getter-sections)                                                           | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | Single source of all vertical band geometry, one entry per stacked group. `computeStackedSections` reproduces the prior ungrouped reserved layout exactly for its single-section (N==1) case, so ungrouped is not a special branch here — it is the one-group call, with a synthetic group when no data has arrived yet (so `laidOutPileupMap`/`renderState` still see one section). The sticky-coverage-vs-scroll distinction lives downstream in `buildSectionRenders`, keyed off section count.                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [renderSections](#getter-rendersections)                                               | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | Per-section data + content-space band tops for the overlay/hit-test pipeline (labels, highlights, hit-test). Pairs each section's group data map with its `pileupTop` (used as the row `topOffset`) and coverage band so a screen-y can be mapped to the right section and its group. Reads straight off `sections` (every field already lives on the `Section`); ungrouped is the single section, so the pipeline reduces to pre-grouping.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [bezierPairSections](#getter-bezierpairsections)                                       | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | Scroll/pan-invariant half of the bezier connection overlay: the linked pairs of each section, resolved once per relayout. The read grouping + connection resolution (`enumerateBezierPairs`) is the allocation-heavy step; memoizing it here (this getter never reads `scrollTop`) keeps a scroll frame down to the cheap per-pair screen projection in `computePileupBezierArcsFromModel`. Empty when the overlay is off.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [bezierConnectionColorTypes](#getter-bezierconnectioncolortypes)                       | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | Connection types (LINKED_READ_COLOR_*) actually drawn as bezier/line arcs in view, the input that lets the legend list only the connection colors present. Mirrors the overlay's skip rule (normal within-region pairs are drawn by the GPU pipeline, not as arcs) so the key matches the curves. Empty while the legend is hidden so the scan is skipped.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [sashimiSections](#getter-sashimisections)                                             | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | Per-section sashimi band placement, in stacking order. Each entry pairs a group's raw data (sashimi counts live per-group) with the content-space tops of _both_ sub-bands: `coverageOverlayTop` for arcs drawn over the coverage histogram and `sashimiBandTop` for arcs in the reserved strip below it. In 'auto' both are used at once; 'up'/'down' use one. The overlay and SVG export both map over this so their geometry can't drift; ungrouped is the single-section case (sticky band below sticky coverage, raw map == the only group). Empty when sashimi is off.                                                                                                                                                                                                                                                                                                                                                                                 |
| [isGrouped](#getter-isgrouped)                                                         | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | True when reads are stacked into >1 group section. Drives the scroll model: ungrouped keeps coverage sticky (only the pileup scrolls); grouped scrolls the whole coverage+pileup stack as one.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [scrollModel](#getter-scrollmodel)                                                     | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | The scroll-projection inputs (`sectionScreen.ts`) every overlay needs to map a content-space Y into screen space. Built once here so the label / resize-handle / coverage-axis overlays don't each re-assemble `{ isGrouped, scrollTop, canvasHeight }` inline.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [pileupViewportHeight](#getter-pileupviewportheight)                                   | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | Height of the scrollable viewport. Ungrouped excludes the sticky coverage band; grouped scrolls the entire display.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [pileupContentHeight](#getter-pileupcontentheight)                                     | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | Total scrollable content height. Grouped is the full stacked-sections height; ungrouped is the pileup band alone (coverage is sticky), which is the stacked height minus that sticky coverage band. Both read the laid-out `sections` so the scroll extent tracks the geometry actually drawn — when `showPileup` is off or the group is collapsed the section reserves no pileup rows, so this collapses to 0 and no phantom scroll region opens up below the coverage band.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [grownHeight](#getter-grownheight)                                                     | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | Target track height for `grow` mode: the full laid-out content height (coverage + pileup + arcs), capped at `GROW_MAX_HEIGHT` so a deep pileup doesn't grow the track to thousands of px (a taller pileup fits to the cap and scrolls the remainder). Independent of `self.height` (in grow mode reads use the configured `featureHeight`, not the fitted pitch), so the grow autorun that writes it back can't feed back on itself. `setHeight` floors it to MIN_DISPLAY_HEIGHT.                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [height](#getter-height)                                                               | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [scalebarOverlapLeft](#getter-scalebaroverlapleft)                                     | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [showOutline](#getter-showoutline)                                                     | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [visibleLabels](#getter-visiblelabels)                                                 | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [highlightChainIds](#getter-highlightchainids)                                         | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | Chain member ids to highlight, empty unless in `normal` linked-read mode. Single source for the "is this a chain highlight" decision that both `highlightBoxes` (which ids to box) and `HighlightOverlay` (how strongly to shade them) read, so the two can't drift.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [highlightBoxes](#getter-highlightboxes)                                               | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | Screen boxes for the hovered read / chain, painted by the `HighlightOverlay` div. Deliberately NOT part of `renderState`: the hovered id changes on nearly every mousemove, and routing it through the canvas would repaint the whole pileup each move.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [fittedFeatureHeight](#getter-fittedfeatureheight)                                     | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | The read height that makes every uncollapsed group's reads fill the display without scrolling. Row count is fixed by read overlaps, so we lay the groups out uncapped (a fixed maxHeight-row cap, independent of the current featureHeight — so the fit autorun that writes featureHeight can't feed back into this) and divide the pileup space by it. Fractional (not floored): the pileup then fills the display exactly rather than leaving up to a row of slack at the bottom. Clamped up to a 1px floor — below 1px the reads can't all fit, so the stack scrolls instead. 0 when there's nothing to fit (no data / no room), signalling "leave the configured height as-is". Reads the `fitTargetHeight` slot, NOT the reactive `height` getter — the same anti-cycle rule `laidOutByGroup` follows. Fit mode only, where the two are equal, but the slot can never chain back through height->grownHeight->layout->featureHeight if this ever moves. |
| [scrollableHeight](#getter-scrollableheight)                                           | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [sortTag](#getter-sorttag)                                                             | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [renderState](#getter-renderstate)                                                     | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [arcsYDomainBp](#getter-arcsydomainbp)                                                 | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [insertSizeTicks](#getter-insertsizeticks)                                             | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [featureUnderMouse](#getter-featureundermouse)                                         | Getters    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [isGroupCollapsed](#method-isgroupcollapsed)                                           | Methods    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | Whether a stacked group's pileup is collapsed to just its coverage.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [hasGroupHeightOverride](#method-hasgroupheightoverride)                               | Methods    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | Whether a stacked group carries a custom pileup-height override — set by expanding it (show all reads) or dragging its resize handle (taller or shorter). Drives the group label's restore-to-fit affordance.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [legendItems](#method-legenditems)                                                     | Methods    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [groupLaidOutMap](#method-grouplaidoutmap)                                             | Methods    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | Laid-out region map for one group key, or an empty map for a key with no data. Centralizes the empty-map fallback shared by the section getters so they never have to branch on a missing group.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [isGroupTruncated](#method-isgrouptruncated)                                           | Methods    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | True when the row cap clipped reads from a group's pileup and the user hasn't explicitly sized that group (a height drag/expand makes any truncation intentional, so it isn't flagged). Drives the per-group "show all" affordance on the section label.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [findFeatureInRpcData](#method-findfeatureinrpcdata)                                   | Methods    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [bezierLegendItems](#method-bezierlegenditems)                                         | Methods    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | Legend swatches for the linked-read connection curves, empty unless the bezier overlay is on and at least one connection is in view.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [searchFeatureByID](#method-searchfeaturebyid)                                         | Methods    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [chainIdsForRead](#method-chainidsforread)                                             | Methods    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | Chain IDs sharing a QNAME with the read at `index` in `rpcData`. Empty when the read isn't part of a chain. Shared by hover-highlight and click-select so the two paths can't drift.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [getFeatureInfoById](#method-getfeatureinfobyid)                                       | Methods    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [rpcProps](#method-rpcprops)                                                           | Methods    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [clearMouseoverState](#action-clearmouseoverstate)                                     | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setError](#action-seterror)                                                           | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setRegionTooLarge](#action-setregiontoolarge)                                         | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setRpcData](#action-setrpcdata)                                                       | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [clearDisplaySpecificData](#action-cleardisplayspecificdata)                           | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setOverCigarItem](#action-setovercigaritem)                                           | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setScrollTop](#action-setscrolltop)                                                   | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setHighlightedChainIds](#action-sethighlightedchainids)                               | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [clearHighlights](#action-clearhighlights)                                             | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [clearSelection](#action-clearselection)                                               | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setSelectedChainIds](#action-setselectedchainids)                                     | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setColorScheme](#action-setcolorscheme)                                               | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [updateColorTagMap](#action-updatecolortagmap)                                         | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setFilterBy](#action-setfilterby)                                                     | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setShowSoftClipping](#action-setshowsoftclipping)                                     | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setMismatchAlpha](#action-setmismatchalpha)                                           | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setSortedBy](#action-setsortedby)                                                     | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setSortedByAtPosition](#action-setsortedbyatposition)                                 | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [clearSortedBy](#action-clearsortedby)                                                 | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setLargeFeaturesFirst](#action-setlargefeaturesfirst)                                 | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setGroupBy](#action-setgroupby)                                                       | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | Set (or remove, when undefined) the in-track stacked grouping dimension. A tier-1 refetch setting (in `rpcProps`) — the worker re-partitions the fetch into N sections. Resets the Y scroll since the stacked content height changes. Ungrouping stores an explicit `null` override (not a cleared override) so it beats a configured `groupBy` default rather than falling back to it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [toggleGroupCollapsed](#action-togglegroupcollapsed)                                   | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | Collapse/expand a stacked group's pileup (coverage stays visible).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [toggleGroupExpanded](#action-togglegroupexpanded)                                     | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | Expand a fit-to-viewport group back to the full `maxHeight` cap (show all its reads), or, if it already carries a height override (from expand or a drag), drop the override to return it to the fit budget. Expanding makes the stack overflow the viewport, which engages the pileup scroll. Pairs with `hasGroupHeightOverride`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [resizeGroupHeight](#action-resizegroupheight)                                         | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | Drag a stacked group's pileup band taller/shorter by `dy` px, capping how many rows that group lays out. The continuous-accumulation policy (seed once, floor at a row, pin/skip a fully-shown group) lives in the pure `nextGroupHeightOverride`; this action just gathers the group's live state and commits the result (undefined = leave on the fit budget). Pairs with `hasGroupHeightOverride` / `toggleGroupExpanded`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| [setScaleType](#action-setscaletype)                                                   | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setAutoscale](#action-setautoscale)                                                   | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setMinScore](#action-setminscore)                                                     | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setMaxScore](#action-setmaxscore)                                                     | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setFeatureHeight](#action-setfeatureheight)                                           | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setFeatureSpacing](#action-setfeaturespacing)                                         | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setMaxHeight](#action-setmaxheight)                                                   | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setHeightMode](#action-setheightmode)                                                 | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | Set the track-height strategy by writing the unified `heightMode` slot; the modes are mutually exclusive by construction. Entering a non-`fixed` mode (fit or grow) resets the transient state a uniform fit/grow contradicts — per-group height overrides (a drag opts a group out) and the scroll offset (neither fit nor grow scrolls) — tied to the explicit user action so a track that merely inherits the mode from a session-wide default keeps its overrides. The driving autoruns then keep `featureHeight` (fit) or `height` (grow) sized as the display/data change.                                                                                                                                                                                                                                                                                                                                                                             |
| [setFittedHeightPx](#action-setfittedheightpx)                                         | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | Cache the fitted read height so the `featureHeight`/`featureSpacing` getters can resolve to it. Written only by the driving autorun.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [setShowSashimiArcs](#action-setshowsashimiarcs)                                       | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setReadConnections](#action-setreadconnections)                                       | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setReadConnectionsDown](#action-setreadconnectionsdown)                               | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setShowCoverage](#action-setshowcoverage)                                             | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setShowPileup](#action-setshowpileup)                                                 | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setCoverageHeight](#action-setcoverageheight)                                         | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setReadConnectionsHeight](#action-setreadconnectionsheight)                           | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setSashimiArcsHeight](#action-setsashimiarcsheight)                                   | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setMinSashimiScore](#action-setminsashimiscore)                                       | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setSashimiArcsMode](#action-setsashimiarcsmode)                                       | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setShowSashimiLabels](#action-setshowsashimilabels)                                   | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setReadConnectionsLineWidth](#action-setreadconnectionslinewidth)                     | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setDrawInter](#action-setdrawinter)                                                   | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setDrawLongRange](#action-setdrawlongrange)                                           | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setArcColorByType](#action-setarccolorbytype)                                         | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setShowMismatches](#action-setshowmismatches)                                         | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setShowLegend](#action-setshowlegend)                                                 | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setDrawSingletons](#action-setdrawsingletons)                                         | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setDrawProperPairs](#action-setdrawproperpairs)                                       | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setShowInterbaseIndicators](#action-setshowinterbaseindicators)                       | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setFlipStrandLongReadChains](#action-setflipstrandlongreadchains)                     | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setColorSupplementaryChains](#action-setcolorsupplementarychains)                     | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setLinkedReads](#action-setlinkedreads)                                               | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setShowBezierConnections](#action-setshowbezierconnections)                           | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | Toggle the paired-read connection overlay. A main-thread tier-2/4 setting (read in `laidOutPileupMap` + `renderState`), not in `rpcProps` — toggling it never refetches.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [updateVisibleModifications](#action-updatevisiblemodifications)                       | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setModificationsReady](#action-setmodificationsready)                                 | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setFeatureIdUnderMouse](#action-setfeatureidundermouse)                               | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setMouseoverExtraInformation](#action-setmouseoverextrainformation)                   | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setHoverState](#action-sethoverstate)                                                 | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setContextMenuFeature](#action-setcontextmenufeature)                                 | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [closeContextMenu](#action-closecontextmenu)                                           | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [selectFeature](#action-selectfeature)                                                 | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [startRenderingBackend](#action-startrenderingbackend)                                 | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [selectFeatureById](#action-selectfeaturebyid)                                         | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [openContextMenu](#action-opencontextmenu)                                             | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | Open the right-click menu over a hit. Coord, block, and the two hit kinds always travel as a unit — set atomically so a consumer can never read a block without its hit (the split-state class of bug that silently no-op'd position sorts). The read feature is reset now and, when the hit carries one, populated by an async RPC fetch — so "open the menu for this hit and its read" stays a single call and a repositioned menu can't inherit the prior read's items.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [getByteEstimateConfig](#action-getbyteestimateconfig)                                 | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [fetchNeeded](#action-fetchneeded)                                                     | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [renderSvg](#action-rendersvg)                                                         | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [resizeHeight](#action-resizeheight)                                                   | Actions    | [LinearAlignmentsDisplay](../linearalignmentsdisplay) | A manual drag-resize means the user wants a fixed height; leave grow mode first, otherwise the grow autorun snaps the height back on the next relayout and the drag appears to do nothing (mirrors canvas).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [id](#property-id)                                                                     | Properties | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [rpcDriverName](#property-rpcdrivername)                                               | Properties | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [error](#volatile-error)                                                               | Volatiles  | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [statusMessage](#volatile-statusmessage)                                               | Volatiles  | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [statusProgress](#volatile-statusprogress)                                             | Volatiles  | [BaseDisplay](../basedisplay)                         | determinate progress fraction [0,1] for the current status, or undefined when the in-flight phase is indeterminate. Set alongside `statusMessage` by `setStatusMessage`; a display that never shows a bar simply leaves it undefined.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [parentTrack](#getter-parenttrack)                                                     | Getters    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [parentDisplay](#getter-parentdisplay)                                                 | Getters    | [BaseDisplay](../basedisplay)                         | Returns the parent display if this display is nested within another display (e.g., PileupDisplay inside LinearAlignmentsDisplay)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [RenderingComponent](#getter-renderingcomponent)                                       | Getters    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [DisplayBlurb](#getter-displayblurb)                                                   | Getters    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [adapterConfig](#getter-adapterconfig)                                                 | Getters    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [isMinimized](#getter-isminimized)                                                     | Getters    | [BaseDisplay](../basedisplay)                         | Returns true if the parent track is minimized. Used to skip expensive operations like autoruns when track is not visible.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [effectiveRpcDriverName](#getter-effectiverpcdrivername)                               | Getters    | [BaseDisplay](../basedisplay)                         | Returns the effective RPC driver name with hierarchical fallback: 1. This display's explicit rpcDriverName 2. Parent display's effectiveRpcDriverName (for nested displays) 3. Track config's rpcDriverName                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [DisplayMessageComponent](#getter-displaymessagecomponent)                             | Getters    | [BaseDisplay](../basedisplay)                         | if a display-level message should be displayed instead, make this return a react component                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [renderingProps](#method-renderingprops)                                               | Methods    | [BaseDisplay](../basedisplay)                         | props passed to the renderer's React "Rendering" component. these are client-side only and never sent to the worker. includes displayModel and callbacks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [regionCannotBeRendered](#method-regioncannotberendered)                               | Methods    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setStatusMessage](#action-setstatusmessage)                                           | Actions    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setRpcDriverName](#action-setrpcdrivername)                                           | Actions    | [BaseDisplay](../basedisplay)                         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [reload](#action-reload)                                                               | Actions    | [BaseDisplay](../basedisplay)                         | base display reload does nothing, see specialized displays for details                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [setHeight](#action-setheight)                                                         | Actions    | [TrackHeightMixin](../trackheightmixin)               |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [heightMode](#getter-heightmode)                                                       | Getters    | [HeightModeMixin](../heightmodemixin)                 | The resolved track-height strategy (`fixed`/`grow`/`fit`). Promotable sentinel slot: getConfResolved walks the customized-track -> session-default -> `fixed` cascade and never returns the `inherit` sentinel.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [fitTargetHeight](#getter-fittargetheight)                                             | Getters    | [HeightModeMixin](../heightmodemixin)                 | The drag-resizable track height as stored in the config slot — the fit target the fit/grow layout scales or packs content into. Read there instead of the reactive `height` getter to break the grow-mode cycle (`height`->grownHeight->layout->height). Equals `height` in fixed/fit.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [autoHeight](#getter-autoheight)                                                       | Getters    | [HeightModeMixin](../heightmodemixin)                 | `grow` mode as a boolean, derived from the unified `heightMode` slot.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [fitHeightToDisplay](#getter-fitheighttodisplay)                                       | Getters    | [HeightModeMixin](../heightmodemixin)                 | `fit` mode as a boolean, derived from the unified `heightMode` slot.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [loadedRegions](#volatile-loadedregions)                                               | Volatiles  | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | regions whose data has been fetched and committed, keyed by displayedRegionIndex; populated only after the fetch work callback returns                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [isReady](#getter-isready)                                                             | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | true once the canvas has painted and no fetch is in flight                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [viewportWithinLoadedData](#getter-viewportwithinloadeddata)                           | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | true when every visible block lies within an already-fetched region — i.e. the viewport shows data we actually loaded, not the stale fringe left after a zoom-out/pan. Drives the loading overlay through the pre-refetch debounce. Spatial only; see CLAUDE.md for why this is exact and for the resolution-staleness gap.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [svgReady](#getter-svgready)                                                           | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | true once an off-screen (SVG) export can safely read this display's data: every visible region has loaded, or the fetch reached a terminal error / too-large state. Off-screen renderers gate on it via `awaitSvgReady(model)` instead of inlining the condition. Regions stream in one at a time, so gating on `viewportWithinLoadedData` (not the first datum) is what keeps multi-region/whole-genome exports complete; `loadedRegions.size` guards the vacuously-true empty-viewport case.                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [svgReadyExtraTerminal](#getter-svgreadyextraterminal)                                 | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Overridable hook (default false): a subclass returns true to mark an extra terminal state where off-screen export can proceed with no loaded data. Sequence sets it when zoomed past base resolution — it renders a static "zoom in" message and fetches nothing, so `svgReady` would otherwise never resolve.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [renderBlocks](#getter-renderblocks)                                                   | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Shared cached view for every LGV-based GPU display. A single displayedRegion may produce multiple render blocks (shared GPU buffer, different scissor clips on screen). Plugins that want to suppress rendering in certain states (e.g. no domain yet) can override this getter to return [] — the autorun lifecycle will then issue an empty-blocks render that clears the canvas.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [displayPhase](#getter-displayphase)                                                   | Getters    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | The display's mutually-exclusive visual state, precedence single-sourced in `computeDisplayPhase`. Here `loading` means data isn't ready yet, or stale data (viewport past loaded) is still on screen through the pre-refetch debounce.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| [setLoadedRegion](#action-setloadedregion)                                             | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Action wrapper so callers after async boundaries stay in MST strict mode.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [clearAllRpcData](#action-clearallrpcdata)                                             | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | full reset: cancels fetch, clears error, regionTooLarge, loadedRegions, display-specific data, and the canvas-drawn flag                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [invalidateLoadedRegions](#action-invalidateloadedregions)                             | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | lighter reset: cancels fetch and clears loadedRegions, leaving error and regionTooLarge intact                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [isCacheValid](#action-iscachevalid)                                                   | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Overridable hook: return `false` to force re-fetch at the current zoom (wiggle uses this for zoom-level changes).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| [fetchRegions](#action-fetchregions)                                                   | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | Run a per-region fetch with byte-estimate gating. Marks regions as loaded only AFTER the work callback has populated display-specific data (rpcDataMap, cellData, etc) so the GPU upload autorun sees committed data when it observes loadedRegions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| [afterAttach](#action-afterattach)                                                     | Actions    | [MultiRegionDisplayMixin](../multiregiondisplaymixin) | installs the four fetch-lifecycle autoruns (DisplayedRegionsChange, FetchVisibleRegions, SettingsInvalidate, ClearBlockingStateOnViewportChange)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [userByteSizeLimit](#property-userbytesizelimit)                                       | Properties | [RegionTooLargeMixin](../regiontoolargemixin)         | user-confirmed byte limit after a force-load, disabling the gate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [regionTooLargeState](#volatile-regiontoolargestate)                                   | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin)         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [regionTooLargeReasonState](#volatile-regiontoolargereasonstate)                       | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin)         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [featureDensityStats](#volatile-featuredensitystats)                                   | Volatiles  | [RegionTooLargeMixin](../regiontoolargemixin)         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [regionTooLarge](#getter-regiontoolarge)                                               | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [regionTooLargeReason](#getter-regiontoolargereason)                                   | Getters    | [RegionTooLargeMixin](../regiontoolargemixin)         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [regionCannotBeRenderedText](#method-regioncannotberenderedtext)                       | Methods    | [RegionTooLargeMixin](../regiontoolargemixin)         | Plaintext reason (for SVG export); the on-screen too-large UI is rendered by the display chrome via `TooLargeMessage`, not the model.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [setFeatureDensityStats](#action-setfeaturedensitystats)                               | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setFeatureDensityStatsLimit](#action-setfeaturedensitystatslimit)                     | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)         | force-load: raise the byte limit past the current request and clear the too-large banner                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [forceLoad](#action-forceload)                                                         | Actions    | [RegionTooLargeMixin](../regiontoolargemixin)         | Raises the byte limit past the current density stats and triggers a reload. The display chrome calls this via TooLargeMessage's force-load button; concrete display models override reload() to do the actual refetch.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [canvasDrawn](#volatile-canvasdrawn)                                                   | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)       | flips true on first paint; read by test selectors to detect render                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [currentRenderingBackend](#volatile-currentrenderingbackend)                           | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)       | current backend reference, updated on context-loss recovery. Typed `unknown` (not generic `B`) on purpose: this mixin is composed by every display via a non-generic factory, so the per-display backend type `B` isn't known here — it's supplied at `attachRenderingBackend<B>` and narrowed with `as B` inside the autoruns. Don't "fix" the cast.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [renderTick](#volatile-rendertick)                                                     | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)       | counter the render autorun observes; bumped to force a re-render                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [autorunsInstalled](#volatile-autorunsinstalled)                                       | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)       | guards attachRenderingBackend so the autorun pair spawns once per instance                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [renderError](#volatile-rendererror)                                                   | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)       | the render-backend (GPU/Canvas2D init or context-loss) error, or undefined. Single source of truth for the render-error terminal state: `useRenderingBackend` writes it from the canvas-init mechanism so the model — not React-local hook state — owns every terminal state. Read by `displayPhase` (whose `renderError` term outranks `loading`, suppressing the scrim) and by `DisplayChrome` (shows the retry overlay).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [markCanvasDrawn](#action-markcanvasdrawn)                                             | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [resetCanvasDrawn](#action-resetcanvasdrawn)                                           | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [stopRenderingBackend](#action-stoprenderingbackend)                                   | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [renderNow](#action-rendernow)                                                         | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setRenderError](#action-setrendererror)                                               | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       | set/clear the render-backend error. Called by `useRenderingBackend`: with the error when the canvas factory rejects (or context-loss re-init fails), and with `undefined` on successful (re)init and on retry.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [attachRenderingBackend](#action-attachrenderingbackend)                               | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)       | attach a GPU/Canvas2D backend and install the upload + render autorun pair (idempotent — re-calling only swaps the backend)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [activeStopToken](#volatile-activestoptoken)                                           | Volatiles  | [FetchMixin](../fetchmixin)                           | stop token of the in-flight fetch, or undefined when idle                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [fetchGeneration](#volatile-fetchgeneration)                                           | Volatiles  | [FetchMixin](../fetchmixin)                           | bumps at every fetch end; autoruns read it to re-evaluate, and it doubles as the staleness epoch inside runFetch                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [fetchCanceled](#volatile-fetchcanceled)                                               | Volatiles  | [FetchMixin](../fetchmixin)                           | true after the user explicitly cancels a load (the loading overlay's cancel button → `cancelFetchByUser`). A durable, blocking state — unlike `cancelFetch`, it does not retrigger the fetch autoruns — so the load stays stopped until the user retries (`reload`) or the viewport changes. Any new fetch clears it (`runFetch` resets it at the start).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| [regionStatuses](#volatile-regionstatuses)                                             | Volatiles  | [FetchMixin](../fetchmixin)                           | latest status of each concurrent in-flight operation, keyed by an arbitrary id (the canvas display uses displayedRegionIndex). Plain bookkeeping — not read reactively; setRegionStatus derives the observable statusMessage/statusProgress from it on every update so N parallel region fetches aggregate into one bar instead of clobbering.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| [lastStatusMs](#volatile-laststatusms)                                                 | Volatiles  | [FetchMixin](../fetchmixin)                           | Date.now() of the last applied status write; the status callbacks gate on it to throttle a high-frequency progress stream.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| [isLoading](#getter-isloading)                                                         | Getters    | [FetchMixin](../fetchmixin)                           | true while a fetch is active                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [makeStatusCallback](#method-makestatuscallback)                                       | Methods    | [FetchMixin](../fetchmixin)                           | An RPC `statusCallback` bound to this display: forwards progress to the shared `statusMessage`, guarded by `isAlive` so a callback that fires after the node is torn down (RPCs resolve their status stream asynchronously) is a safe no-op. Pass directly as the `statusCallback` RPC arg instead of re-inlining the guard at every call site.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [makeRegionStatusCallback](#method-makeregionstatuscallback)                           | Methods    | [FetchMixin](../fetchmixin)                           | Per-region variant of `makeStatusCallback`: routes progress through `setRegionStatus(key, …)` so N concurrent per-region fetches aggregate into one status bar instead of clobbering each other. Same `isAlive` guard.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| [throttleStatus](#action-throttlestatus)                                               | Actions    | [FetchMixin](../fetchmixin)                           | Run `apply` only if at least `STATUS_THROTTLE_MS` has passed since the last status write. A leading-edge throttle: sparse updates pass straight through, dense progress bursts are thinned so the loading overlay stops re-rendering faster than the view animates. The final status doesn't need a trailing flush — fetch completion clears it via `resetStatus`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [resetStatus](#action-resetstatus)                                                     | Actions    | [FetchMixin](../fetchmixin)                           | Drop the active stop token and clear all status bookkeeping. Shared by both cancel paths and runFetch's cleanup.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [stopActiveFetch](#action-stopactivefetch)                                             | Actions    | [FetchMixin](../fetchmixin)                           | Abort the in-flight fetch (if any) and clear its status. The shared preamble of both cancel paths; the difference between them is only what they do to `fetchCanceled` / `fetchGeneration` afterward.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| [setRegionStatus](#action-setregionstatus)                                             | Actions    | [FetchMixin](../fetchmixin)                           | Record one concurrent operation's latest status (keyed) and recompute the shared statusMessage/statusProgress as the aggregate across all in-flight keys. Pass undefined to drop a key. Used by displays that fan a single fetch out into parallel per-region RPCs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| [cancelFetch](#action-cancelfetch)                                                     | Actions    | [FetchMixin](../fetchmixin)                           | cancel any in-flight fetch and bump fetchGeneration (always bumps, so callers can retrigger fetch autoruns even when nothing was in flight). This is the _internal_ reset used by clearAllRpcData/invalidateLoadedRegions — it clears any user-cancel flag so the retrigger actually re-fetches.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [cancelFetchByUser](#action-cancelfetchbyuser)                                         | Actions    | [FetchMixin](../fetchmixin)                           | User-initiated cancel from the loading overlay. Stops the in-flight fetch and lands in a durable `fetchCanceled` state. Unlike `cancelFetch`, it does NOT bump fetchGeneration — so the fetch autoruns don't immediately restart the load. The user retries via `reload` (the overlay's retry button), or it clears on the next viewport change.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| [runFetch](#action-runfetch)                                                           | Actions    | [FetchMixin](../fetchmixin)                           | Run a cancel-safe fetch (cancels any prior). The work callback gets a FetchContext with a stopToken to forward to the RPC and an isStale() check to short-circuit commits once the user has moved on. Abort errors are swallowed; others are stored in `error` if not stale.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [displayTypeDefaultChanges](#method-displaytypedefaultchanges)                         | Methods    | [PromotableDefaultsMixin](../promotabledefaultsmixin) | Effective config differences a track following the default inherits from session-wide defaults (distinct from per-track config edits / trackConfigDeltas). Drives the "affected by a session default" badge.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| [clearDisplayTypeDefaults](#action-cleardisplaytypedefaults)                           | Actions    | [PromotableDefaultsMixin](../promotabledefaultsmixin) | Clear the session-wide defaults reported by `displayTypeDefaultChanges` so this display (and its siblings of the same type) revert to their config values. Backs the "clear default" action on the selector badge.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

### LGVSyntenyDisplay - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/lgvsyntenydisplay).

<details>
<summary>LGVSyntenyDisplay - Properties</summary>

#### property: type

```ts
// type signature
type type = ISimpleType<'LGVSyntenyDisplay'>
// code
type: types.literal('LGVSyntenyDisplay')
```

#### property: configuration

```ts
// type signature
type configuration = ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(schema)
```

</details>

<details>
<summary>LGVSyntenyDisplay - Getters</summary>

#### getter: featureWidgetType

synteny features open the SyntenyFeatureWidget; the inherited `selectFeature`
action reads this getter, so no override is needed.

```ts
type featureWidgetType = { type: string; id: string }
```

</details>

<details>
<summary>LGVSyntenyDisplay - Methods</summary>

#### method: contextMenuItems

```ts
type contextMenuItems = () => (
  | {
      label: string
      icon: OverridableComponent<SvgIconTypeMap<{}, 'svg'>> & {
        muiName: string
      }
      onClick: () => void
    }
  | { label: string; onClick: () => void; icon?: undefined }
)[]
```

#### method: trackMenuItems

```ts
type trackMenuItems = () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | CustomMenuItem | { ...; } | { ...; } | { ...; })[]
```

</details>

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

<details>
<summary>Derived from LinearAlignmentsDisplay</summary>

[LinearAlignmentsDisplay →](../linearalignmentsdisplay)

**Volatiles**

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

#### volatile: rpcDataMap

```ts
// type signature
type rpcDataMap = ObservableMap<number, GroupedAlignmentsResult>
// code
rpcDataMap: observable.map<number, GroupedAlignmentsResult>(undefined, {
  deep: false,
})
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

**Getters**

#### getter: linkedReads

```ts
type linkedReads = LinkedReadsMode
```

#### getter: pairsDisplayTypeDefault

```ts
type pairsDisplayTypeDefault = DisplayTypeDefaultControl
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

#### getter: arcsDisplayTypeDefault

```ts
type arcsDisplayTypeDefault = DisplayTypeDefaultControl
```

#### getter: readCloudDisplayTypeDefault

```ts
type readCloudDisplayTypeDefault = DisplayTypeDefaultControl
```

#### getter: readConnectionsDown

```ts
type readConnectionsDown = boolean
```

#### getter: readConnectionsDownDisplayTypeDefault

```ts
type readConnectionsDownDisplayTypeDefault = DisplayTypeDefaultControl
```

#### getter: showSashimiArcs

```ts
type showSashimiArcs = boolean
```

#### getter: sashimiArcsMode

```ts
type sashimiArcsMode = SashimiArcsMode
```

#### getter: sashimiDownDisplayTypeDefault

```ts
type sashimiDownDisplayTypeDefault = DisplayTypeDefaultControl
```

#### getter: sashimiAutoDisplayTypeDefault

```ts
type sashimiAutoDisplayTypeDefault = DisplayTypeDefaultControl
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

#### getter: softClippingDisplayTypeDefault

```ts
type softClippingDisplayTypeDefault = DisplayTypeDefaultControl
```

#### getter: isChainMode

```ts
type isChainMode = boolean
```

#### getter: showLinkedReadLines

Whether to draw the straight-line pass connecting normal read-pairs in pileup
layout. Only meaningful when bezier connections are on AND we are in pileup mode
— chain layout has its own connecting-line pass that already covers normal
pairs.

```ts
type showLinkedReadLines = boolean
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

#### getter: isFitting

True when fit-to-display mode is on AND a pitch has been computed
(`fittedHeightPx > 0`, i.e. there are rows and room to fit them). The single
gate both size getters read, so it's obvious they either both split the fitted
pitch or both fall back to config — never a mix.

```ts
type isFitting = boolean
```

#### getter: featureHeight

```ts
type featureHeight = number
```

#### getter: featureSpacing

```ts
type featureSpacing = number
```

#### getter: configuredFeatureHeight

```ts
type configuredFeatureHeight = number
```

#### getter: configuredFeatureSpacing

```ts
type configuredFeatureSpacing = number
```

#### getter: maxHeight

```ts
type maxHeight = any
```

#### getter: showSashimiLabels

Whether to draw the supporting-read count on each sashimi arc. Resolved through
the promotable-slot tiers (getConfResolved): a track configured `true` pins
labels on; otherwise it follows the session-wide default, falling back to off.

```ts
type showSashimiLabels = boolean
```

#### getter: showSashimiLabelsDisplayTypeDefault

"make this the default for all tracks" control (pin) for sashimi arc labels

```ts
type showSashimiLabelsDisplayTypeDefault = DisplayTypeDefaultControl
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

#### getter: mismatchAlphaDisplayTypeDefault

```ts
type mismatchAlphaDisplayTypeDefault = DisplayTypeDefaultControl
```

#### getter: showLegend

```ts
type showLegend = boolean
```

#### getter: sortedBy

```ts
type sortedBy = SortedBy | undefined
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

#### getter: colorLegendCategories

Read-color buckets actually present across the rendered reads, the single input
that lets the legend list only relevant swatches (see legendUtils). Shares
readColorCategory with the renderer so the two can't disagree. Empty while the
legend is hidden so the O(reads) scan is skipped; MobX memoizes it against
rpcDataMap + scheme + mode.

```ts
type colorLegendCategories = Set<ReadColorCategory>
```

#### getter: colorPalette

```ts
type colorPalette = ColorPalette
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

#### getter: coverageDisplayHeight

```ts
type coverageDisplayHeight = number
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

**Methods**

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

#### method: legendItems

```ts
type legendItems = () => LegendItem[]
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

#### method: bezierLegendItems

Legend swatches for the linked-read connection curves, empty unless the bezier
overlay is on and at least one connection is in view.

```ts
type bezierLegendItems = () => LegendItem[]
```

#### method: searchFeatureByID

```ts
type searchFeatureByID = (
  featureId: string,
) => [number, number, number, number] | undefined
```

#### method: chainIdsForRead

Chain IDs sharing a QNAME with the read at `index` in `rpcData`. Empty when the
read isn't part of a chain. Shared by hover-highlight and click-select so the
two paths can't drift.

```ts
type chainIdsForRead = (rpcData: PileupDataResult, index: number) => string[]
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

**Actions**

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

#### action: setShowBezierConnections

Toggle the paired-read connection overlay. A main-thread tier-2/4 setting (read
in `laidOutPileupMap` + `renderState`), not in `rpcProps` — toggling it never
refetches.

```ts
type setShowBezierConnections = (flag: boolean) => void
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

#### action: resizeHeight

A manual drag-resize means the user wants a fixed height; leave grow mode first,
otherwise the grow autorun snaps the height back on the next relayout and the
drag appears to do nothing (mirrors canvas).

```ts
type resizeHeight = (distance: number) => number
```

</details>

<details>
<summary>Derived from BaseDisplay</summary>

[BaseDisplay →](../basedisplay)

**Properties**

#### property: id

```ts
// type signature
type id = IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: rpcDriverName

```ts
// type signature
type rpcDriverName = IMaybe<ISimpleType<string>>
// code
rpcDriverName: types.maybe(types.string)
```

**Volatiles**

#### volatile: error

```ts
// type signature
type error = unknown
// code
error: undefined as unknown
```

#### volatile: statusMessage

```ts
// type signature
type statusMessage = string | undefined
// code
statusMessage: undefined as string | undefined
```

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

**Getters**

#### getter: parentTrack

```ts
type parentTrack = AbstractTrackModel
```

#### getter: parentDisplay

Returns the parent display if this display is nested within another display
(e.g., PileupDisplay inside LinearAlignmentsDisplay)

```ts
type parentDisplay =
  | { type?: string | undefined; effectiveRpcDriverName?: string | undefined }
  | undefined
```

#### getter: RenderingComponent

```ts
type RenderingComponent = FC<{ model: ModelInstanceTypeProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; type: ISimpleType<string>; rpcDriverName: IMaybe<ISimpleType<string>>; }> & { ...; } & { ...; } & IStateTreeNode<...>; onHorizontalScroll?: ((distance: number) => void) | undefined; blockState?: Record<...> | undefined; }>
```

#### getter: DisplayBlurb

```ts
type DisplayBlurb = FC<{ model: ModelInstanceTypeProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; type: ISimpleType<string>; rpcDriverName: IMaybe<ISimpleType<string>>; }> & { ...; } & { ...; } & IStateTreeNode<...>; }> | null
```

#### getter: adapterConfig

```ts
type adapterConfig = any
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

**Methods**

#### method: renderingProps

props passed to the renderer's React "Rendering" component. these are
client-side only and never sent to the worker. includes displayModel and
callbacks

```ts
type renderingProps = () => { displayModel: ModelInstanceTypeProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; type: ISimpleType<string>; rpcDriverName: IMaybe<ISimpleType<string>>; }> & { ...; } & { ...; } & { ...; } & IStateTreeNode<...>; }
```

#### method: regionCannotBeRendered

```ts
type regionCannotBeRendered = () => null
```

**Actions**

#### action: setStatusMessage

```ts
type setStatusMessage = (status?: RpcStatus | undefined) => void
```

#### action: setRpcDriverName

```ts
type setRpcDriverName = (rpcDriverName: string) => void
```

#### action: reload

base display reload does nothing, see specialized displays for details

```ts
type reload = () => void
```

</details>

<details>
<summary>Derived from TrackHeightMixin</summary>

[TrackHeightMixin →](../trackheightmixin)

**Actions**

#### action: setHeight

```ts
type setHeight = (displayHeight: number) => number
```

</details>

<details>
<summary>Derived from HeightModeMixin</summary>

[HeightModeMixin →](../heightmodemixin)

**Getters**

#### getter: heightMode

The resolved track-height strategy (`fixed`/`grow`/`fit`). Promotable sentinel
slot: getConfResolved walks the customized-track -> session-default -> `fixed`
cascade and never returns the `inherit` sentinel.

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

**Actions**

#### action: setLoadedRegion

Action wrapper so callers after async boundaries stay in MST strict mode.

```ts
type setLoadedRegion = (displayedRegionIndex: number, region: Region) => void
```

#### action: clearAllRpcData

full reset: cancels fetch, clears error, regionTooLarge, loadedRegions,
display-specific data, and the canvas-drawn flag

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

installs the four fetch-lifecycle autoruns (DisplayedRegionsChange,
FetchVisibleRegions, SettingsInvalidate, ClearBlockingStateOnViewportChange)

```ts
type afterAttach = () => void
```

</details>

<details>
<summary>Derived from RegionTooLargeMixin</summary>

[RegionTooLargeMixin →](../regiontoolargemixin)

**Properties**

#### property: userByteSizeLimit

user-confirmed byte limit after a force-load, disabling the gate

```ts
// type signature
type userByteSizeLimit = IMaybe<ISimpleType<number>>
// code
userByteSizeLimit: types.maybe(types.number)
```

**Volatiles**

#### volatile: regionTooLargeState

```ts
// type signature
type regionTooLargeState = false
// code
regionTooLargeState: false
```

#### volatile: regionTooLargeReasonState

```ts
// type signature
type regionTooLargeReasonState = string
// code
regionTooLargeReasonState: ''
```

#### volatile: featureDensityStats

```ts
// type signature
type featureDensityStats = FeatureDensityStats | undefined
// code
featureDensityStats: undefined as FeatureDensityStats | undefined
```

**Getters**

#### getter: regionTooLarge

```ts
type regionTooLarge = boolean
```

#### getter: regionTooLargeReason

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

#### action: setFeatureDensityStats

```ts
type setFeatureDensityStats = (stats?: FeatureDensityStats | undefined) => void
```

#### action: setFeatureDensityStatsLimit

force-load: raise the byte limit past the current request and clear the
too-large banner

```ts
type setFeatureDensityStatsLimit = (
  stats?: FeatureDensityStats | undefined,
) => void
```

#### action: forceLoad

Raises the byte limit past the current density stats and triggers a reload. The
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

#### action: markCanvasDrawn

```ts
type markCanvasDrawn = () => void
```

#### action: resetCanvasDrawn

```ts
type resetCanvasDrawn = () => void
```

#### action: stopRenderingBackend

```ts
type stopRenderingBackend = () => void
```

#### action: renderNow

```ts
type renderNow = () => void
```

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
