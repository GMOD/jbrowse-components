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

## Docs

displays location of "synteny" feature in a plain LGV, allowing linking out to
external synteny views

extends

- [LinearAlignmentsDisplay](../linearalignmentsdisplay)

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [LinearAlignmentsDisplay](../linearalignmentsdisplay)

**Properties:** type, configuration, linkedReads, showCoverage, coverageHeight,
showMismatches, showInterbaseIndicators, showYScalebar, drawSingletons,
drawProperPairs, flipStrandLongReadChains, drawInter, drawLongRange,
arcColorByType, readConnections, readConnectionsDown, sashimiArcs,
sashimiArcsHeight, readConnectionsHeight, showSoftClipping

**Volatiles:** featureIdUnderMouse, mouseoverExtraInformation,
contextMenuFeature, contextMenuCoord, contextMenuCigarHit,
contextMenuIndicatorHit, contextMenuRefName, rpcDataMap, currentRangeY,
highlightedChainIds, selectedChainIds, colorTagMap, visibleModifications,
simplexModifications, modificationsReady, overCigarItem, colorPalette

**Getters:** isChainMode, scaleType, autoscaleType, minScore, maxScore,
minScoreConfig, maxScoreConfig, numStdDev, featureWidgetType, selectedFeatureId,
DisplayMessageComponent, TooltipComponent, visibleModificationTypes, colorBy,
filterBy, featureHeightSetting, featureSpacing, maxHeight, chainIdMap,
mismatchAlpha, showLegend, sortedBy, coverageIsLog, coverageStats,
coverageDomain, coverageTicks, legendItems, laidOutPileupMap, maxY,
arcsComputed, arcsRpcDataMap, modificationThreshold, colorSchemeIndex,
showModifications, showPerBaseQuality, totalPileupHeight, readIdIndexMap,
readConnectionsLineWidth, scrollTop, coverageDisplayHeight,
pileupViewportHeight, scalebarOverlapLeft, showOutlineSetting, visibleLabels,
scrollableHeight, sortTag, renderState, arcsYDomainBp, insertSizeTicks,
featureUnderMouse

**Methods:** findFeatureInRpcData, searchFeatureByID, getFeatureInfoById,
rpcProps, trackMenuItems, contextMenuItems

**Actions:** clearMouseoverState, setError, setRegionTooLarge, setRpcData,
clearDisplaySpecificData, setOverCigarItem, setColorPalette, setScrollTop,
setCurrentRangeY, setHighlightedChainIds, clearHighlights, clearSelection,
setSelectedChainIds, setColorScheme, updateColorTagMap, setFilterBy,
setShowOutline, toggleSoftClipping, toggleMismatchAlpha, setSortedBy,
setSortedByAtPosition, clearSortedBy, setMaxHeight, setScaleType, setAutoscale,
setMinScore, setMaxScore, setFeatureHeight, setFeatureSpacing, setCompactness,
setSashimiArcs, setReadConnections, setReadConnectionsDown, setShowCoverage,
setCoverageHeight, setReadConnectionsHeight, setSashimiArcsHeight,
setReadConnectionsLineWidth, setDrawInter, setDrawLongRange, setColorByType,
setShowMismatches, setShowYScalebar, setShowLegend, setDrawSingletons,
setDrawProperPairs, setShowInterbaseIndicators, setFlipStrandLongReadChains,
setLinkedReads, updateVisibleModifications, setSimplexModifications,
setModificationsReady, setFeatureIdUnderMouse, setMouseoverExtraInformation,
setHoverState, setContextMenuFeature, setContextMenuCoord,
setContextMenuCigarHit, setContextMenuIndicatorHit, clearContextMenu,
setContextMenuRefName, selectFeature, startRenderingBackend, selectFeatureById,
setContextMenuFeatureById, getByteEstimateConfig, fetchNeeded, renderSvg

### Available via [BaseDisplay](../basedisplay)

**Properties:** id, type, rpcDriverName

**Getters:** parentTrack, parentDisplay, RenderingComponent, DisplayBlurb,
adapterConfig, isMinimized, effectiveRpcDriverName, effectiveTrackConfig,
rendererType, DisplayMessageComponent, viewMenuActions

**Methods:** renderProps, renderingProps, trackMenuItems, regionCannotBeRendered

**Actions:** setStatusMessage, setError, setRpcDriverName, reload

### Available via [TrackHeightMixin](../trackheightmixin)

**Properties:** heightPreConfig

**Volatiles:** scrollTop

**Actions:** setScrollTop, setHeight, resizeHeight

### Available via [MultiRegionDisplayMixin](../multiregiondisplaymixin)

**Volatiles:** loadedRegions

**Getters:** isReady, renderBlocks

**Actions:** setLoadedRegion, clearDisplaySpecificData, clearAllRpcData, reload,
invalidateLoadedRegions, fetchNeeded, isCacheValid, getByteEstimateConfig,
fetchRegions, afterAttach

### Available via [RegionTooLargeMixin](../regiontoolargemixin)

**Properties:** userByteSizeLimit

**Volatiles:** regionTooLargeState, regionTooLargeReasonState,
featureDensityStats

**Getters:** regionTooLarge, regionTooLargeReason

**Methods:** regionCannotBeRenderedText, regionCannotBeRendered

**Actions:** setRegionTooLarge, setFeatureDensityStats,
setFeatureDensityStatsLimit, reload

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

### LGVSyntenyDisplay - Methods

#### method: contextMenuItems

```js
// type signature
contextMenuItems: () => ({ label: string; icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; onClick: () => void; } | { label: string; onClick: () => void; icon?: undefined; })[]
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => ({ label: string; type: "subMenu"; subMenu: ({ label: "Normal" | "Compact" | "Super-compact"; type: "radio"; checked: boolean; onClick: () => void; } | { label: string; onClick: () => void; })[]; } | { ...; } | { ...; })[]
```

### LGVSyntenyDisplay - Actions

#### action: selectFeature

```js
// type signature
selectFeature: (feature: Feature) => void
```
