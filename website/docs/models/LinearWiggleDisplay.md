---
id: linearwiggledisplay
title: LinearWiggleDisplay
sidebar_label: Display -> LinearWiggleDisplay
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`wiggle` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/wiggle/src/LinearWiggleDisplay/model.ts).

## Example usage

A complete `QuantitativeTrack` config to paste into `tracks`. `height` and the
score-range and rendering options (autoscale, min/max score, renderer) are all
config slots on the track itself — see the `QuantitativeTrack` config:

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

## Members

| Member                                                     | Kind       | Description                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [type](#property-type)                                     | Properties |                                                                                                                                                                                                                                                                                                                                         |
| [configuration](#property-configuration)                   | Properties |                                                                                                                                                                                                                                                                                                                                         |
| [featureUnderMouse](#volatile-featureundermouse)           | Volatiles  |                                                                                                                                                                                                                                                                                                                                         |
| [DisplayMessageComponent](#getter-displaymessagecomponent) | Getters    |                                                                                                                                                                                                                                                                                                                                         |
| [color](#getter-color)                                     | Getters    |                                                                                                                                                                                                                                                                                                                                         |
| [useBicolor](#getter-usebicolor)                           | Getters    |                                                                                                                                                                                                                                                                                                                                         |
| [isDensityMode](#getter-isdensitymode)                     | Getters    |                                                                                                                                                                                                                                                                                                                                         |
| [ticks](#getter-ticks)                                     | Getters    |                                                                                                                                                                                                                                                                                                                                         |
| [renderState](#getter-renderstate)                         | Getters    |                                                                                                                                                                                                                                                                                                                                         |
| [rpcProps](#method-rpcprops)                               | Methods    |                                                                                                                                                                                                                                                                                                                                         |
| [gpuProps](#method-gpuprops)                               | Methods    | single-source gpuProps mapped onto the multi-source build path: - bicolor: no source color override; build emits pos+neg with their respective colors - solid: worker put all features in pos arrays (useBicolor=false); non-density modes use the user's color; density uses posColor (multi default, so leave source.color undefined) |
| [trackMenuItems](#method-trackmenuitems)                   | Methods    |                                                                                                                                                                                                                                                                                                                                         |
| [setRpcData](#action-setrpcdata)                           | Actions    |                                                                                                                                                                                                                                                                                                                                         |
| [setUseBicolor](#action-setusebicolor)                     | Actions    |                                                                                                                                                                                                                                                                                                                                         |
| [setColor](#action-setcolor)                               | Actions    |                                                                                                                                                                                                                                                                                                                                         |
| [setPosColor](#action-setposcolor)                         | Actions    |                                                                                                                                                                                                                                                                                                                                         |
| [setNegColor](#action-setnegcolor)                         | Actions    |                                                                                                                                                                                                                                                                                                                                         |
| [setFeatureUnderMouse](#action-setfeatureundermouse)       | Actions    |                                                                                                                                                                                                                                                                                                                                         |
| [selectFeature](#action-selectfeature)                     | Actions    |                                                                                                                                                                                                                                                                                                                                         |
| [fetchNeeded](#action-fetchneeded)                         | Actions    |                                                                                                                                                                                                                                                                                                                                         |
| [renderSvg](#action-rendersvg)                             | Actions    |                                                                                                                                                                                                                                                                                                                                         |
| [startRenderingBackend](#action-startrenderingbackend)     | Actions    |                                                                                                                                                                                                                                                                                                                                         |

### LinearWiggleDisplay - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/linearwiggledisplay).

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
[regionStatuses](../fetchmixin#volatile-regionstatuses)

**Getters:** [isLoading](../fetchmixin#getter-isloading)

**Methods:** [makeStatusCallback](../fetchmixin#method-makestatuscallback),
[makeRegionStatusCallback](../fetchmixin#method-makeregionstatuscallback)

**Actions:** [setError](../fetchmixin#action-seterror),
[setStatusMessage](../fetchmixin#action-setstatusmessage),
[resetStatus](../fetchmixin#action-resetstatus),
[stopActiveFetch](../fetchmixin#action-stopactivefetch),
[setRegionStatus](../fetchmixin#action-setregionstatus),
[cancelFetch](../fetchmixin#action-cancelfetch),
[cancelFetchByUser](../fetchmixin#action-cancelfetchbyuser),
[runFetch](../fetchmixin#action-runfetch)

### Available via [WiggleCommonMixin](../wigglecommonmixin)

**Volatiles:** [rpcDataMap](../wigglecommonmixin#volatile-rpcdatamap)

**Getters:**
[autoscaleSourceNames](../wigglecommonmixin#getter-autoscalesourcenames),
[visibleScoreRange](../wigglecommonmixin#getter-visiblescorerange),
[hasNoData](../wigglecommonmixin#getter-hasnodata),
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
[setMinScore](../wigglescoreconfigmixin#action-setminscore),
[setMaxScore](../wigglescoreconfigmixin#action-setmaxscore),
[setRenderingType](../wigglescoreconfigmixin#action-setrenderingtype),
[setSummaryScoreMode](../wigglescoreconfigmixin#action-setsummaryscoremode),
[setScatterPointSize](../wigglescoreconfigmixin#action-setscatterpointsize),
[setAutoscale](../wigglescoreconfigmixin#action-setautoscale),
[isCacheValid](../wigglescoreconfigmixin#action-iscachevalid)

<details>
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

<details>
<summary>LinearWiggleDisplay - Volatiles</summary>

#### volatile: featureUnderMouse

```ts
// type signature
type featureUnderMouse = WiggleFeatureUnderMouse | undefined
// code
featureUnderMouse: undefined as WiggleFeatureUnderMouse | undefined
```

</details>

<details>
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

<details>
<summary>LinearWiggleDisplay - Methods</summary>

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

</details>

<details>
<summary>LinearWiggleDisplay - Methods (other undocumented members)</summary>

#### method: rpcProps

```ts
type rpcProps = () => {
  useBicolor: boolean
  bicolorPivot: number
  resolution: number
}
```

#### method: trackMenuItems

```ts
type trackMenuItems = () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | CustomMenuItem | { ...; })[]
```

</details>

<details>
<summary>LinearWiggleDisplay - Actions</summary>

#### action: setRpcData

```ts
type setRpcData = (displayedRegionIndex: number, data: WiggleDataResult) => void
```

#### action: setUseBicolor

```ts
type setUseBicolor = (val?: boolean | undefined) => void
```

#### action: setColor

```ts
type setColor = (color?: string | undefined) => void
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
) => Promise<void> | undefined
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
