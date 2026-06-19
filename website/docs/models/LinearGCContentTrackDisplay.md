---
id: lineargccontenttrackdisplay
title: LinearGCContentTrackDisplay
sidebar_label: Display -> LinearGCContentTrackDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/gccontent/src/LinearGCContentDisplay/stateModel2.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearGCContentTrackDisplay.md)

## Example usage

A standalone `GCContentTrack` whose `GCContentAdapter` wraps a sequence adapter
(use this instead of the `ReferenceSequenceTrack` display when you want GC as
its own track):

```js
{
  type: 'GCContentTrack',
  trackId: 'gc',
  name: 'GC content',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'GCContentAdapter',
    sequenceAdapter: {
      type: 'IndexedFastaAdapter',
      fastaLocation: { uri: 'https://example.com/genome.fa' },
      faiLocation: { uri: 'https://example.com/genome.fa.fai' },
    },
  },
  displays: [
    {
      type: 'LinearGCContentTrackDisplay',
      displayId: 'gc-LinearGCContentTrackDisplay',
      gcMode: 'skew',
    },
  ],
}
```

## Overview

used on GCContentTrack, separately from the display type on the
ReferenceSequenceTrack

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [SharedGCContentModel](../sharedgccontentmodel)

**Properties:** windowSizeOverride, windowDeltaOverride, gcModeOverride

**Getters:** windowSize, windowDelta, gcMode, adapterConfig

**Methods:** trackMenuItems

**Actions:** setGCContentParams, setGCMode

### Available via [LinearWiggleDisplay](../linearwiggledisplay)

**Properties:** type, configuration

**Volatiles:** featureUnderMouse

**Getters:** DisplayMessageComponent, color, useBicolor, isDensityMode, ticks,
renderState

**Methods:** rpcProps, gpuProps, trackMenuItems

**Actions:** setRpcData, setUseBicolor, setPosColor, setNegColor,
setFeatureUnderMouse, selectFeature, fetchNeeded, renderSvg,
startRenderingBackend

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

**Getters:** isReady, viewportWithinLoadedData, svgReady, svgReadyExtraTerminal,
renderBlocks, displayPhase, loadingOverlayVisible

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

**Volatiles:** activeStopToken, fetchGeneration, error, statusMessage,
statusProgress, fetchCanceled, regionStatuses

**Getters:** isLoading

**Actions:** setError, setStatusMessage, setRegionStatus, cancelFetch,
cancelFetchByUser, runFetch

### Available via [WiggleCommonMixin](../wigglecommonmixin)

**Volatiles:** rpcDataMap

**Getters:** visibleScoreRange, domain

**Actions:** clearDisplaySpecificData

### Available via [WiggleScoreConfigMixin](../wigglescoreconfigmixin)

**Properties:** resolution, displayCrossHatches

**Volatiles:** loadedBpPerPx

**Getters:** scalebarOverlapLeft, posColor, negColor, bicolorPivot, scaleType,
autoscaleType, numStdDev, scatterPointSize, summaryScoreMode, renderingType,
minScore, maxScore, minScoreBound, maxScoreBound, hasResolution

**Actions:** toggleCrossHatches, setResolution, setLoadedBpPerPx, setScaleType,
setColor, setMinScore, setMaxScore, setRenderingType, setSummaryScoreMode,
setAutoscale, isCacheValid

### Available via [ConfigOverrideMixin](../configoverridemixin)

**Properties:** configOverrides

**Methods:** getOverride, getConfWithOverride

**Actions:** setOverride, clearOverride

### LinearGCContentTrackDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"LinearGCContentTrackDisplay">
// code
type: types.literal('LinearGCContentTrackDisplay')
```
