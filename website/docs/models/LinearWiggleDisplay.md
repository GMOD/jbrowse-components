---
id: linearwiggledisplay
title: LinearWiggleDisplay
sidebar_label: Display -> LinearWiggleDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/LinearWiggleDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearWiggleDisplay.md)

## Example usage

A complete `QuantitativeTrack` config to paste into `tracks`. `height` is the
common display-level override; score-range and rendering options (autoscale,
min/max score, renderer) are config slots on the track itself — see the
`QuantitativeTrack` config:

```js
{
  type: 'QuantitativeTrack',
  trackId: 'coverage',
  name: 'Coverage',
  assemblyNames: ['hg38'],
  adapter: { type: 'BigWigAdapter', uri: 'https://example.com/coverage.bw' },
  displays: [
    {
      type: 'LinearWiggleDisplay',
      displayId: 'coverage-LinearWiggleDisplay',
      height: 100,
    },
  ],
}
```

## Overview

State model factory for the single-source wiggle display.

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

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
<summary>LinearWiggleDisplay - Properties</summary>

#### property: type

```ts
// type signature
type type = ISimpleType<'LinearWiggleDisplay'>
// code
type: types.literal('LinearWiggleDisplay')
```

#### property: configuration

```ts
// type signature
type configuration = ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

</details>

<details open>
<summary>LinearWiggleDisplay - Volatiles</summary>

#### volatile: featureUnderMouse

```ts
// type signature
type featureUnderMouse = WiggleFeatureUnderMouse | undefined
// code
featureUnderMouse: undefined as WiggleFeatureUnderMouse | undefined
```

</details>

<details open>
<summary>LinearWiggleDisplay - Getters</summary>

#### getter: DisplayMessageComponent

```ts
type DisplayMessageComponent = LazyExoticComponent<
  ({ model }: { model: WiggleDisplayModel }) => Element
>
```

#### getter: color

```ts
type color = string
```

#### getter: useBicolor

```ts
type useBicolor = boolean
```

#### getter: isDensityMode

```ts
type isDensityMode = boolean
```

#### getter: ticks

```ts
type ticks = YScaleTicks | undefined
```

#### getter: renderState

```ts
type renderState = WiggleGPURenderState | undefined
```

</details>

<details open>
<summary>LinearWiggleDisplay - Methods</summary>

#### method: rpcProps

```ts
type rpcProps = () => {
  useBicolor: boolean
  bicolorPivot: number
  resolution: number
}
```

#### method: gpuProps

single-source gpuProps mapped onto the multi-source build path:

- bicolor: no source color override; build emits pos+neg with their respective
  colors
- solid: worker put all features in pos arrays (useBicolor=false); non-density
  modes use the user's color; density uses posColor (multi default, so leave
  source.color undefined)

```ts
type gpuProps = () => {
  sources: { name: string; color: string | undefined }[]
  posColor: string
  negColor: string
  summaryScoreMode: string
  isDensityMode: boolean
  renderingType: string
}
```

#### method: trackMenuItems

```ts
type trackMenuItems = () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | { ...; })[]
```

</details>

<details open>
<summary>LinearWiggleDisplay - Actions</summary>

#### action: setRpcData

```ts
type setRpcData = (displayedRegionIndex: number, data: WiggleDataResult) => void
```

#### action: setUseBicolor

```ts
type setUseBicolor = (val?: boolean | undefined) => void
```

#### action: setPosColor

```ts
type setPosColor = (color?: string | undefined) => void
```

#### action: setNegColor

```ts
type setNegColor = (color?: string | undefined) => void
```

#### action: setFeatureUnderMouse

```ts
type setFeatureUnderMouse = (feat?: WiggleFeatureUnderMouse | undefined) => void
```

#### action: selectFeature

```ts
type selectFeature = (feat: WiggleFeatureUnderMouse) => void
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

#### action: startRenderingBackend

```ts
type startRenderingBackend = (backend: WiggleRenderingBackend) => void
```

</details>
