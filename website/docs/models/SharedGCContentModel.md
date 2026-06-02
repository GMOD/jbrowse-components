---
id: sharedgccontentmodel
title: SharedGCContentModel
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gccontent/src/LinearGCContentDisplay/shared.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/SharedGCContentModel.md)

## Docs

extends

- [LinearWiggleDisplay](../linearwiggledisplay)

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [LinearWiggleDisplay](../linearwiggledisplay)

**Properties:** type, configuration

**Volatiles:** featureUnderMouse

**Getters:** DisplayMessageComponent, color, isDensityMode,
effectiveBicolorPivot, ticks, renderState

**Methods:** rpcProps, gpuProps, trackMenuItems

**Actions:** setRpcData, setPosColor, setNegColor, setFeatureUnderMouse,
fetchNeeded, renderSvg, startRenderingBackend

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

**Getters:** isReady, viewportWithinLoadedData, renderBlocks,
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

### Available via [WiggleCommonMixin](../wigglecommonmixin)

**Volatiles:** rpcDataMap

**Getters:** visibleScoreRange, domain

**Actions:** clearDisplaySpecificData

### Available via [WiggleScoreConfigMixin](../wigglescoreconfigmixin)

**Properties:** resolution, displayCrossHatches

**Volatiles:** loadedBpPerPx

**Getters:** scalebarOverlapLeft, posColor, negColor, bicolorPivot, scaleType,
autoscaleType, numStdDev, summaryScoreMode, renderingType, minScore, maxScore,
minScoreConfig, maxScoreConfig, hasResolution

**Actions:** toggleCrossHatches, setResolution, setLoadedBpPerPx, setScaleType,
setColor, setMinScore, setMaxScore, setRenderingType, setSummaryScoreMode,
setAutoscale, isCacheValid

### Available via [ConfigOverrideMixin](../configoverridemixin)

**Properties:** configOverrides

**Methods:** getOverride, getConfWithOverride

**Actions:** setOverride, clearOverride

### SharedGCContentModel - Properties

#### property: windowSize

```js
// type signature
IMaybe<ISimpleType<number>>
// code
windowSize: types.maybe(types.number)
```

#### property: windowDelta

```js
// type signature
IMaybe<ISimpleType<number>>
// code
windowDelta: types.maybe(types.number)
```

#### property: gcMode

```js
// type signature
IMaybe<ISimpleType<"content" | "skew">>
// code
gcMode: types.maybe(types.enumeration('gcMode', ['content', 'skew']))
```

### SharedGCContentModel - Getters

#### getter: adapterConfig

retrieves the sequence adapter from parent track, and puts it as a subadapter on
a GCContentAdapter

```js
// type
{
  type: string
  sequenceAdapter: any
  windowSize: any
  windowDelta: any
  gcMode: any
}
```
