---
id: sharedgccontentmodel
title: SharedGCContentModel
sidebar_label: Display -> SharedGCContentModel
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

## Overview

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [LinearWiggleDisplay](../linearwiggledisplay)

**Properties:** [type](../linearwiggledisplay#property-type),
[configuration](../linearwiggledisplay#property-configuration)

**Volatiles:**
[featureUnderMouse](../linearwiggledisplay#volatile-featureundermouse)

**Getters:**
[DisplayMessageComponent](../linearwiggledisplay#getter-displaymessagecomponent),
[color](../linearwiggledisplay#getter-color),
[useBicolor](../linearwiggledisplay#getter-usebicolor),
[isDensityMode](../linearwiggledisplay#getter-isdensitymode),
[ticks](../linearwiggledisplay#getter-ticks),
[renderState](../linearwiggledisplay#getter-renderstate)

**Methods:** [rpcProps](../linearwiggledisplay#method-rpcprops),
[gpuProps](../linearwiggledisplay#method-gpuprops),
[trackMenuItems](../linearwiggledisplay#method-trackmenuitems)

**Actions:** [setRpcData](../linearwiggledisplay#action-setrpcdata),
[setUseBicolor](../linearwiggledisplay#action-setusebicolor),
[setPosColor](../linearwiggledisplay#action-setposcolor),
[setNegColor](../linearwiggledisplay#action-setnegcolor),
[setFeatureUnderMouse](../linearwiggledisplay#action-setfeatureundermouse),
[selectFeature](../linearwiggledisplay#action-selectfeature),
[fetchNeeded](../linearwiggledisplay#action-fetchneeded),
[renderSvg](../linearwiggledisplay#action-rendersvg),
[startRenderingBackend](../linearwiggledisplay#action-startrenderingbackend)

### Available via [BaseDisplay](../basedisplay)

**Properties:** [id](../basedisplay#property-id),
[type](../basedisplay#property-type),
[rpcDriverName](../basedisplay#property-rpcdrivername)

**Volatiles:** [error](../basedisplay#volatile-error),
[statusMessage](../basedisplay#volatile-statusmessage)

**Getters:** [parentTrack](../basedisplay#getter-parenttrack),
[parentDisplay](../basedisplay#getter-parentdisplay),
[RenderingComponent](../basedisplay#getter-renderingcomponent),
[DisplayBlurb](../basedisplay#getter-displayblurb),
[adapterConfig](../basedisplay#getter-adapterconfig),
[isMinimized](../basedisplay#getter-isminimized),
[effectiveRpcDriverName](../basedisplay#getter-effectiverpcdrivername),
[effectiveTrackConfig](../basedisplay#getter-effectivetrackconfig),
[DisplayMessageComponent](../basedisplay#getter-displaymessagecomponent),
[viewMenuActions](../basedisplay#getter-viewmenuactions)

**Methods:** [renderProps](../basedisplay#method-renderprops),
[renderingProps](../basedisplay#method-renderingprops),
[trackMenuItems](../basedisplay#method-trackmenuitems),
[regionCannotBeRendered](../basedisplay#method-regioncannotberendered)

**Actions:** [setStatusMessage](../basedisplay#action-setstatusmessage),
[setError](../basedisplay#action-seterror),
[setRpcDriverName](../basedisplay#action-setrpcdrivername),
[reload](../basedisplay#action-reload)

### Available via [TrackHeightMixin](../trackheightmixin)

**Properties:** [heightOverride](../trackheightmixin#property-heightoverride)

**Volatiles:** [scrollTop](../trackheightmixin#volatile-scrolltop)

**Getters:** [height](../trackheightmixin#getter-height)

**Actions:** [setScrollTop](../trackheightmixin#action-setscrolltop),
[setHeight](../trackheightmixin#action-setheight),
[resizeHeight](../trackheightmixin#action-resizeheight)

### Available via [MultiRegionDisplayMixin](../multiregiondisplaymixin)

**Volatiles:**
[loadedRegions](../multiregiondisplaymixin#volatile-loadedregions)

**Getters:** [isReady](../multiregiondisplaymixin#getter-isready),
[viewportWithinLoadedData](../multiregiondisplaymixin#getter-viewportwithinloadeddata),
[svgReady](../multiregiondisplaymixin#getter-svgready),
[svgReadyExtraTerminal](../multiregiondisplaymixin#getter-svgreadyextraterminal),
[renderBlocks](../multiregiondisplaymixin#getter-renderblocks),
[displayPhase](../multiregiondisplaymixin#getter-displayphase),
[loadingOverlayVisible](../multiregiondisplaymixin#getter-loadingoverlayvisible)

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
[regionStatuses](../fetchmixin#volatile-regionstatuses)

**Getters:** [isLoading](../fetchmixin#getter-isloading)

**Actions:** [setError](../fetchmixin#action-seterror),
[setStatusMessage](../fetchmixin#action-setstatusmessage),
[resetStatus](../fetchmixin#action-resetstatus),
[setRegionStatus](../fetchmixin#action-setregionstatus),
[cancelFetch](../fetchmixin#action-cancelfetch),
[cancelFetchByUser](../fetchmixin#action-cancelfetchbyuser),
[runFetch](../fetchmixin#action-runfetch)

### Available via [WiggleCommonMixin](../wigglecommonmixin)

**Volatiles:** [rpcDataMap](../wigglecommonmixin#volatile-rpcdatamap)

**Getters:** [visibleScoreRange](../wigglecommonmixin#getter-visiblescorerange),
[domain](../wigglecommonmixin#getter-domain)

**Actions:**
[clearDisplaySpecificData](../wigglecommonmixin#action-cleardisplayspecificdata)

### Available via [WiggleScoreConfigMixin](../wigglescoreconfigmixin)

**Properties:** [resolution](../wigglescoreconfigmixin#property-resolution),
[displayCrossHatches](../wigglescoreconfigmixin#property-displaycrosshatches)

**Volatiles:** [loadedBpPerPx](../wigglescoreconfigmixin#volatile-loadedbpperpx)

**Getters:**
[scalebarOverlapLeft](../wigglescoreconfigmixin#getter-scalebaroverlapleft),
[posColor](../wigglescoreconfigmixin#getter-poscolor),
[negColor](../wigglescoreconfigmixin#getter-negcolor),
[bicolorPivot](../wigglescoreconfigmixin#getter-bicolorpivot),
[scaleType](../wigglescoreconfigmixin#getter-scaletype),
[autoscaleType](../wigglescoreconfigmixin#getter-autoscaletype),
[numStdDev](../wigglescoreconfigmixin#getter-numstddev),
[scatterPointSize](../wigglescoreconfigmixin#getter-scatterpointsize),
[summaryScoreMode](../wigglescoreconfigmixin#getter-summaryscoremode),
[renderingType](../wigglescoreconfigmixin#getter-renderingtype),
[minScore](../wigglescoreconfigmixin#getter-minscore),
[maxScore](../wigglescoreconfigmixin#getter-maxscore),
[minScoreBound](../wigglescoreconfigmixin#getter-minscorebound),
[maxScoreBound](../wigglescoreconfigmixin#getter-maxscorebound),
[hasResolution](../wigglescoreconfigmixin#getter-hasresolution)

**Actions:**
[toggleCrossHatches](../wigglescoreconfigmixin#action-togglecrosshatches),
[setResolution](../wigglescoreconfigmixin#action-setresolution),
[setLoadedBpPerPx](../wigglescoreconfigmixin#action-setloadedbpperpx),
[setScaleType](../wigglescoreconfigmixin#action-setscaletype),
[setColor](../wigglescoreconfigmixin#action-setcolor),
[setMinScore](../wigglescoreconfigmixin#action-setminscore),
[setMaxScore](../wigglescoreconfigmixin#action-setmaxscore),
[setRenderingType](../wigglescoreconfigmixin#action-setrenderingtype),
[setSummaryScoreMode](../wigglescoreconfigmixin#action-setsummaryscoremode),
[setAutoscale](../wigglescoreconfigmixin#action-setautoscale),
[isCacheValid](../wigglescoreconfigmixin#action-iscachevalid)

### Available via [ConfigOverrideMixin](../configoverridemixin)

**Properties:**
[configOverrides](../configoverridemixin#property-configoverrides)

**Methods:** [getOverride](../configoverridemixin#method-getoverride),
[getConfWithOverride](../configoverridemixin#method-getconfwithoverride)

**Actions:** [setOverride](../configoverridemixin#action-setoverride),
[clearOverride](../configoverridemixin#action-clearoverride)

<details open>
<summary>SharedGCContentModel - Properties</summary>

#### property: windowSizeOverride

explicit override; the `windowSize` getter resolves it over the config
`windowSize` slot

```ts
// type signature
type windowSizeOverride = IMaybe<ISimpleType<number>>
// code
windowSizeOverride: types.maybe(types.number)
```

#### property: windowDeltaOverride

explicit override; resolved by the `windowDelta` getter

```ts
// type signature
type windowDeltaOverride = IMaybe<ISimpleType<number>>
// code
windowDeltaOverride: types.maybe(types.number)
```

#### property: gcModeOverride

explicit override; resolved by the `gcMode` getter

```ts
// type signature
type gcModeOverride = IMaybe<ISimpleType<'content' | 'skew'>>
// code
gcModeOverride: types.maybe(types.enumeration('gcMode', ['content', 'skew']))
```

</details>

<details open>
<summary>SharedGCContentModel - Getters</summary>

#### getter: windowSize

```ts
type windowSize = any
```

#### getter: windowDelta

```ts
type windowDelta = any
```

#### getter: gcMode

```ts
type gcMode = any
```

#### getter: adapterConfig

retrieves the sequence adapter from parent track, and puts it as a subadapter on
a GCContentAdapter

```ts
type adapterConfig = {
  type: string
  sequenceAdapter: any
  windowSize: any
  windowDelta: any
  gcMode: any
}
```

</details>

<details open>
<summary>SharedGCContentModel - Methods</summary>

#### method: trackMenuItems

```ts
type trackMenuItems = () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | { ...; })[]
```

</details>

<details open>
<summary>SharedGCContentModel - Actions</summary>

#### action: setGCContentParams

```ts
type setGCContentParams = ({
  windowSize,
  windowDelta,
}: {
  windowSize: number
  windowDelta: number
}) => void
```

#### action: setGCMode

```ts
type setGCMode = (mode: 'content' | 'skew') => void
```

</details>
