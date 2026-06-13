---
id: lgvsyntenydisplay
title: LGVSyntenyDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LGVSyntenyDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LGVSyntenyDisplay.md)

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

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [LinearAlignmentsDisplay](../linearalignmentsdisplay)

**Properties:** type, configuration, linkedReads, showBezierConnections,
showCoverage, coverageHeight, showMismatches, showInterbaseIndicators,
drawSingletons, drawProperPairs, flipStrandLongReadChains, drawInter,
drawLongRange, arcColorByType, readConnections, readConnectionsDown,
showSashimiArcs, minSashimiScore, sashimiArcsHeight, readConnectionsHeight,
showSoftClipping

**Volatiles:** featureIdUnderMouse, mouseoverExtraInformation,
contextMenuFeature, contextMenuCoord, contextMenuCigarHit,
contextMenuIndicatorHit, contextMenuRefName, rpcDataMap, scrollTop,
collapsedGroups, groupMaxHeightOverrides, highlightedChainIds, selectedChainIds,
colorTagMap, visibleModifications, modificationsReady, overCigarItem,
hoverCoverageBand, colorPalette

**Getters:** isChainMode, showLinkedReadLines, scaleType, autoscaleType,
minScore, maxScore, minScoreBound, maxScoreBound, numStdDev, featureWidgetType,
selectedFeatureId, TooltipComponent, visibleModificationTypes, colorBy,
filterBy, featureHeight, featureSpacing, maxHeight, chainIdMap, mismatchAlpha,
showLowFreqMismatches, showLegend, sortedBy, groupBy, coverageIsLog,
coverageStats, coverageDomain, coverageTicks, colorLegendCategories,
laidOutByGroup, groupOrder, laidOutPileupMap, sourceSections, maxY,
pileupTruncated, rawDataByGroup, arcsByGroup, modificationThreshold,
colorSchemeIndex, showModifications, showPerBaseQuality, showPerBaseLetter,
totalPileupHeight, readIdIndexMap, readConnectionsLineWidth, hasSashimiArcs,
belowCoverageBands, coverageDisplayHeight, sections, renderSections,
sashimiSections, isGrouped, pileupViewportHeight, pileupContentHeight,
scalebarOverlapLeft, showOutline, visibleLabels, highlightBoxes,
scrollableHeight, sortTag, renderState, arcsYDomainBp, insertSizeTicks,
featureUnderMouse

**Methods:** isGroupCollapsed, legendItems, groupLaidOutMap,
findFeatureInRpcData, searchFeatureByID, getFeatureInfoById, rpcProps,
trackMenuItems, contextMenuItems

**Actions:** clearMouseoverState, setError, setRegionTooLarge, setRpcData,
clearDisplaySpecificData, setOverCigarItem, setColorPalette, setScrollTop,
setHighlightedChainIds, clearHighlights, clearSelection, setSelectedChainIds,
setColorScheme, updateColorTagMap, setFilterBy, setShowOutline,
toggleSoftClipping, toggleMismatchAlpha, toggleShowLowFreqMismatches,
setSortedBy, setSortedByAtPosition, clearSortedBy, setGroupBy,
toggleGroupCollapsed, resizeGroupHeight, setScaleType, setAutoscale,
setMinScore, setMaxScore, setFeatureHeight, setFeatureSpacing, setMaxHeight,
setCompactness, setShowSashimiArcs, toggleSashimiArcs, setReadConnections,
setReadConnectionsDown, setShowCoverage, setCoverageHeight,
setReadConnectionsHeight, setSashimiArcsHeight, setMinSashimiScore,
setReadConnectionsLineWidth, setDrawInter, setDrawLongRange, setColorByType,
setShowMismatches, setShowLegend, setDrawSingletons, setDrawProperPairs,
setShowInterbaseIndicators, setFlipStrandLongReadChains, setLinkedReads,
setShowBezierConnections, updateVisibleModifications, setModificationsReady,
setFeatureIdUnderMouse, setMouseoverExtraInformation, setHoverState,
setContextMenuFeature, setContextMenuCoord, setContextMenuCigarHit,
setContextMenuIndicatorHit, clearContextMenu, setContextMenuRefName,
selectFeature, startRenderingBackend, selectFeatureById,
setContextMenuFeatureById, getByteEstimateConfig, fetchNeeded, renderSvg

### Available via [BaseDisplay](../basedisplay)

**Properties:** id, type, rpcDriverName

**Volatiles:** error, statusMessage

**Getters:** parentTrack, parentDisplay, RenderingComponent, DisplayBlurb,
adapterConfig, isMinimized, effectiveRpcDriverName, effectiveTrackConfig,
DisplayMessageComponent, viewMenuActions

**Methods:** renderProps, renderingProps, trackMenuItems, regionCannotBeRendered

**Actions:** setStatusMessage, setError, setRpcDriverName, reload

### Available via [TrackHeightMixin](../trackheightmixin)

**Properties:** heightOverride

**Volatiles:** scrollTop

**Getters:** height

**Actions:** setScrollTop, setHeight, resizeHeight

### Available via [MultiRegionDisplayMixin](../multiregiondisplaymixin)

**Volatiles:** loadedRegions

**Getters:** isReady, viewportWithinLoadedData, renderBlocks, displayPhase,
loadingOverlayVisible

**Actions:** setLoadedRegion, clearDisplaySpecificData, clearAllRpcData, reload,
invalidateLoadedRegions, fetchNeeded, isCacheValid, getByteEstimateConfig,
fetchRegions, afterAttach

### Available via [RegionTooLargeMixin](../regiontoolargemixin)

**Properties:** userByteSizeLimit

**Volatiles:** regionTooLargeState, regionTooLargeReasonState,
featureDensityStats

**Getters:** regionTooLarge, regionTooLargeReason

**Methods:** regionCannotBeRenderedText

**Actions:** setRegionTooLarge, setFeatureDensityStats,
setFeatureDensityStatsLimit, reload, forceLoad

### Available via [RenderLifecycleMixin](../renderlifecyclemixin)

**Volatiles:** canvasDrawn, currentRenderingBackend, renderTick,
autorunsInstalled, renderError

**Actions:** markCanvasDrawn, resetCanvasDrawn, stopRenderingBackend, renderNow,
setRenderError, attachRenderingBackend

### Available via [FetchMixin](../fetchmixin)

**Volatiles:** activeStopToken, fetchGeneration, error, statusMessage

**Getters:** isLoading

**Actions:** setError, setStatusMessage, cancelFetch, runFetch

### Available via [ConfigOverrideMixin](../configoverridemixin)

**Properties:** configOverrides

**Methods:** getOverride, getConfWithOverride

**Actions:** setOverride, clearOverride

### LGVSyntenyDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"LGVSyntenyDisplay">
// code
type: types.literal('LGVSyntenyDisplay')
```

#### property: configuration

```js
// type signature
ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(schema)
```

### LGVSyntenyDisplay - Getters

#### getter: featureWidgetType

```js
// type
{
  type: string
  id: string
}
```

### LGVSyntenyDisplay - Methods

#### method: contextMenuItems

```js
// type signature
contextMenuItems: () => ({ label: string; icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; onClick: () => void; } | { label: string; onClick: () => void; icon?: undefined; })[]
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => ({ label: string; type: "subMenu"; icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; subMenu: MenuItem[]; } | { ...; } | { ...; })[]
```

### LGVSyntenyDisplay - Actions

#### action: selectFeature

```js
// type signature
selectFeature: (feature: Feature) => void
```
