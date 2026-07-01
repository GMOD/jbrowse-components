---
id: sharedldmodel
title: SharedLDModel
sidebar_label: Display -> SharedLDModel
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/variants/src/LDDisplay/shared.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/SharedLDModel.md)

## Overview

Shared state model for LD displays

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

**Volatiles:** [scrollTop](../trackheightmixin#volatile-scrolltop)

**Getters:** [height](../trackheightmixin#getter-height)

**Actions:** [setScrollTop](../trackheightmixin#action-setscrolltop),
[setHeight](../trackheightmixin#action-setheight),
[resizeHeight](../trackheightmixin#action-resizeheight)

### Available via [GlobalDataDisplayMixin](../globaldatadisplaymixin)

**Volatiles:** [reloadCounter](../globaldatadisplaymixin#volatile-reloadcounter)

**Getters:** [displayPhase](../globaldatadisplaymixin#getter-displayphase),
[dataLoaded](../globaldatadisplaymixin#getter-dataloaded),
[svgReadyExtraTerminal](../globaldatadisplaymixin#getter-svgreadyextraterminal),
[svgReady](../globaldatadisplaymixin#getter-svgready)

**Actions:** [reload](../globaldatadisplaymixin#action-reload)

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
[setRegionStatus](../fetchmixin#action-setregionstatus),
[cancelFetch](../fetchmixin#action-cancelfetch),
[cancelFetchByUser](../fetchmixin#action-cancelfetchbyuser),
[runFetch](../fetchmixin#action-runfetch)

### Available via [StaleViewportRescaleMixin](../staleviewportrescalemixin)

**Volatiles:**
[lastDrawnOffsetPx](../staleviewportrescalemixin#volatile-lastdrawnoffsetpx),
[lastDrawnBpPerPx](../staleviewportrescalemixin#volatile-lastdrawnbpperpx)

**Actions:**
[setLastDrawnViewport](../staleviewportrescalemixin#action-setlastdrawnviewport)

<details open>
<summary>SharedLDModel - Properties</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                     | Signature                   |
| ------------------------------------------ | --------------------------- |
| [`configuration`](#property-configuration) | `ITypeUnion<any, any, any>` |

</details>

<details>
<summary>SharedLDModel - Properties (all signatures)</summary>

#### property: configuration

```ts
// type signature
type configuration = ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

</details>

<details open>
<summary>SharedLDModel - Volatiles</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                         | Signature              |
| ------------------------------ | ---------------------- |
| [`rpcData`](#volatile-rpcdata) | `LDDataResult \| null` |

</details>

<details>
<summary>SharedLDModel - Volatiles (all signatures)</summary>

#### volatile: rpcData

```ts
// type signature
type rpcData = LDDataResult | null
// code
rpcData: null as LDDataResult | null
```

</details>

<details open>
<summary>SharedLDModel - Getters</summary>

#### getter: snps

Returns true if this display uses pre-computed LD data (PLINK, ldmat) rather
than computing LD from VCF genotypes

```ts
type snps = LDSnp[]
```

#### getter: effectiveLineZoneHeight

Pixel height of the SVG zone above the canvas (variant labels + lines, or
recombination scale). The hit-test subtracts this from mouseY before reversing
the render transform.

```ts
type effectiveLineZoneHeight = any
```

#### getter: ldCanvasHeight

Effective height for the LD canvas (total height minus the zone the
recombination overlay / variant lines occupy above the matrix).

```ts
type ldCanvasHeight = number
```

#### getter: yScalar

Per-frame yScalar squash factor. When fitToHeight is on, squashes the natural
(canvasWidth/2) triangle into ldCanvasHeight. Lives on the main thread so resize
doesn't trigger a worker re-fetch.

```ts
type yScalar = number
```

#### getter: renderTransform

Forward transform { scale, viewOffsetX } shared by GPU render, mouse hit-test,
and the matrix→genomic-position SVG lines. See `computeRenderTransform` for the
math.

```ts
type renderTransform = RenderTransform
```

#### getter: renderState

Per-frame render state for the GPU backend. Read by the upload/render autorun —
every change to any tracked observable (view.bpPerPx, view.offsetPx,
model.fitToHeight, rpcData contents, …) re-fires it.

```ts
type renderState =
  | {
      yScalar: number
      canvasWidth: number
      canvasHeight: number
      signedLD: boolean
      viewScale: number
      viewOffsetX: number
      uniformW: number
    }
  | undefined
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                             | Signature                                                                      |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| [`prefersOffset`](#getter-prefersoffset)                           | `boolean`                                                                      |
| [`minorAlleleFrequencyFilter`](#getter-minorallelefrequencyfilter) | `any`                                                                          |
| [`lengthCutoffFilter`](#getter-lengthcutofffilter)                 | `any`                                                                          |
| [`lineZoneHeight`](#getter-linezoneheight)                         | `any`                                                                          |
| [`ldMetric`](#getter-ldmetric)                                     | `any`                                                                          |
| [`showLegend`](#getter-showlegend)                                 | `any`                                                                          |
| [`showLDTriangle`](#getter-showldtriangle)                         | `any`                                                                          |
| [`showRecombination`](#getter-showrecombination)                   | `any`                                                                          |
| [`recombinationZoneHeight`](#getter-recombinationzoneheight)       | `any`                                                                          |
| [`fitToHeight`](#getter-fittoheight)                               | `any`                                                                          |
| [`hweFilterThreshold`](#getter-hwefilterthreshold)                 | `any`                                                                          |
| [`callRateFilter`](#getter-callratefilter)                         | `any`                                                                          |
| [`showVerticalGuides`](#getter-showverticalguides)                 | `any`                                                                          |
| [`showLabels`](#getter-showlabels)                                 | `any`                                                                          |
| [`tickHeight`](#getter-tickheight)                                 | `any`                                                                          |
| [`useGenomicPositions`](#getter-usegenomicpositions)               | `any`                                                                          |
| [`signedLD`](#getter-signedld)                                     | `any`                                                                          |
| [`jexlFilters`](#getter-jexlfilters)                               | `string[]`                                                                     |
| [`cellWidth`](#getter-cellwidth)                                   | `number`                                                                       |
| [`filterStats`](#getter-filterstats)                               | `FilterStats \| undefined`                                                     |
| [`recombination`](#getter-recombination)                           | `{ values: Float32Array<ArrayBufferLike>; positions: number[]; } \| undefined` |
| [`isPrecomputedLD`](#getter-isprecomputedld)                       | `boolean`                                                                      |

</details>

<details>
<summary>SharedLDModel - Getters (all signatures)</summary>

#### getter: prefersOffset

```ts
type prefersOffset = boolean
```

#### getter: minorAlleleFrequencyFilter

```ts
type minorAlleleFrequencyFilter = any
```

#### getter: lengthCutoffFilter

```ts
type lengthCutoffFilter = any
```

#### getter: lineZoneHeight

```ts
type lineZoneHeight = any
```

#### getter: ldMetric

```ts
type ldMetric = any
```

#### getter: showLegend

```ts
type showLegend = any
```

#### getter: showLDTriangle

```ts
type showLDTriangle = any
```

#### getter: showRecombination

```ts
type showRecombination = any
```

#### getter: recombinationZoneHeight

```ts
type recombinationZoneHeight = any
```

#### getter: fitToHeight

```ts
type fitToHeight = any
```

#### getter: hweFilterThreshold

```ts
type hweFilterThreshold = any
```

#### getter: callRateFilter

```ts
type callRateFilter = any
```

#### getter: showVerticalGuides

```ts
type showVerticalGuides = any
```

#### getter: showLabels

```ts
type showLabels = any
```

#### getter: tickHeight

```ts
type tickHeight = any
```

#### getter: useGenomicPositions

```ts
type useGenomicPositions = any
```

#### getter: signedLD

```ts
type signedLD = any
```

#### getter: jexlFilters

```ts
type jexlFilters = string[]
```

#### getter: cellWidth

```ts
type cellWidth = number
```

#### getter: filterStats

```ts
type filterStats = FilterStats | undefined
```

#### getter: recombination

```ts
type recombination =
  { values: Float32Array<ArrayBufferLike>; positions: number[] } | undefined
```

#### getter: isPrecomputedLD

```ts
type isPrecomputedLD = boolean
```

</details>

<details open>
<summary>SharedLDModel - Methods</summary>

#### method: hitTest

Inverse of `renderTransform` for the LD matrix: takes mouse coords
(canvas-relative) and returns the LD cell under the cursor, or undefined.
Mirrors plugins/hic's `hitTest` so both contact maps keep the forward and
inverse transforms paired on the model.

```ts
type hitTest = (mouseX: number, mouseY: number) => LDFlatbushItem | undefined
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                       | Signature                                                                                                                                                                                          |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`rpcProps`](#method-rpcprops)               | `() => { ldMetric: any; minorAlleleFrequencyFilter: any; lengthCutoffFilter: any; hweFilterThreshold: any; callRateFilter: any; jexlFilters: string[]; signedLD: any; useGenomicPositions: any; }` |
| [`filterMenuItems`](#method-filtermenuitems) | `() => { label: string; onClick: () => void; }[]`                                                                                                                                                  |
| [`legendItems`](#method-legenditems)         | `() => LegendItem[]`                                                                                                                                                                               |
| [`svgLegendWidth`](#method-svglegendwidth)   | `() => number`                                                                                                                                                                                     |
| [`trackMenuItems`](#method-trackmenuitems)   | `() => (MenuDivider \| MenuSubHeader \| NormalMenuItem \| CheckboxMenuItem \| RadioMenuItem \| SubMenuItem \| { ...; } \| { ...; } \| { ...; })[]`                                                 |
| [`renderSvg`](#method-rendersvg)             | `(opts: ExportSvgDisplayOptions) => Promise<ReactNode>`                                                                                                                                            |

</details>

<details>
<summary>SharedLDModel - Methods (all signatures)</summary>

#### method: rpcProps

```ts
type rpcProps = () => {
  ldMetric: any
  minorAlleleFrequencyFilter: any
  lengthCutoffFilter: any
  hweFilterThreshold: any
  callRateFilter: any
  jexlFilters: string[]
  signedLD: any
  useGenomicPositions: any
}
```

#### method: filterMenuItems

```ts
type filterMenuItems = () => { label: string; onClick: () => void }[]
```

#### method: legendItems

```ts
type legendItems = () => LegendItem[]
```

#### method: svgLegendWidth

```ts
type svgLegendWidth = () => number
```

#### method: trackMenuItems

```ts
type trackMenuItems = () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | { ...; } | { ...; } | { ...; })[]
```

#### method: renderSvg

```ts
type renderSvg = (opts: ExportSvgDisplayOptions) => Promise<ReactNode>
```

</details>

<details open>
<summary>SharedLDModel - Actions</summary>

#### action: startRenderingBackend

Starts the upload/render autorun. Data + color ramp both derive from the same
rpcData object, so a single identity-diffed slot handles both uploads.

```ts
type startRenderingBackend = (backend: LDRenderingBackend) => void
```

#### action: performLDFetch

Re-fetches LD matrix for the current viewport. Both the autorun (in
`afterAttach`) and `reload()` invoke this directly.

```ts
type performLDFetch = () => Promise<void>
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                             | Signature                                  |
| ------------------------------------------------------------------ | ------------------------------------------ |
| [`setRpcData`](#action-setrpcdata)                                 | `(data: LDDataResult \| null) => void`     |
| [`setLineZoneHeight`](#action-setlinezoneheight)                   | `(n: number) => void`                      |
| [`setMafFilter`](#action-setmaffilter)                             | `(arg: number) => void`                    |
| [`setLengthCutoffFilter`](#action-setlengthcutofffilter)           | `(arg: number) => void`                    |
| [`setLDMetric`](#action-setldmetric)                               | `(metric: LDMetric) => void`               |
| [`setShowLegend`](#action-setshowlegend)                           | `(show: boolean) => void`                  |
| [`setShowLDTriangle`](#action-setshowldtriangle)                   | `(show: boolean) => void`                  |
| [`setShowRecombination`](#action-setshowrecombination)             | `(show: boolean) => void`                  |
| [`setRecombinationZoneHeight`](#action-setrecombinationzoneheight) | `(n: number) => void`                      |
| [`setFitToHeight`](#action-setfittoheight)                         | `(value: boolean) => void`                 |
| [`setHweFilter`](#action-sethwefilter)                             | `(threshold: number) => void`              |
| [`setCallRateFilter`](#action-setcallratefilter)                   | `(threshold: number) => void`              |
| [`setShowVerticalGuides`](#action-setshowverticalguides)           | `(show: boolean) => void`                  |
| [`setShowLabels`](#action-setshowlabels)                           | `(show: boolean) => void`                  |
| [`setTickHeight`](#action-settickheight)                           | `(height: number) => void`                 |
| [`setUseGenomicPositions`](#action-setusegenomicpositions)         | `(value: boolean) => void`                 |
| [`setSignedLD`](#action-setsignedld)                               | `(value: boolean) => void`                 |
| [`setJexlFilters`](#action-setjexlfilters)                         | `(filters: string[] \| undefined) => void` |

</details>

<details>
<summary>SharedLDModel - Actions (all signatures)</summary>

#### action: setRpcData

```ts
type setRpcData = (data: LDDataResult | null) => void
```

#### action: setLineZoneHeight

```ts
type setLineZoneHeight = (n: number) => void
```

#### action: setMafFilter

```ts
type setMafFilter = (arg: number) => void
```

#### action: setLengthCutoffFilter

```ts
type setLengthCutoffFilter = (arg: number) => void
```

#### action: setLDMetric

```ts
type setLDMetric = (metric: LDMetric) => void
```

#### action: setShowLegend

```ts
type setShowLegend = (show: boolean) => void
```

#### action: setShowLDTriangle

```ts
type setShowLDTriangle = (show: boolean) => void
```

#### action: setShowRecombination

```ts
type setShowRecombination = (show: boolean) => void
```

#### action: setRecombinationZoneHeight

```ts
type setRecombinationZoneHeight = (n: number) => void
```

#### action: setFitToHeight

```ts
type setFitToHeight = (value: boolean) => void
```

#### action: setHweFilter

```ts
type setHweFilter = (threshold: number) => void
```

#### action: setCallRateFilter

```ts
type setCallRateFilter = (threshold: number) => void
```

#### action: setShowVerticalGuides

```ts
type setShowVerticalGuides = (show: boolean) => void
```

#### action: setShowLabels

```ts
type setShowLabels = (show: boolean) => void
```

#### action: setTickHeight

```ts
type setTickHeight = (height: number) => void
```

#### action: setUseGenomicPositions

```ts
type setUseGenomicPositions = (value: boolean) => void
```

#### action: setSignedLD

```ts
type setSignedLD = (value: boolean) => void
```

#### action: setJexlFilters

```ts
type setJexlFilters = (filters: string[] | undefined) => void
```

</details>
