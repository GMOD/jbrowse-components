---
id: linearreferencesequencedisplay
title: LinearReferenceSequenceDisplay
sidebar_label: Display -> LinearReferenceSequenceDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/sequence/src/LinearReferenceSequenceDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearReferenceSequenceDisplay.md)

## Example usage

A complete `ReferenceSequenceTrack` config to paste into `tracks` (an assembly's
`sequence` track takes the same shape). `showForward`, `showReverse`, and
`showTranslation` toggle the strand/translation rows:

```js
{
  type: 'ReferenceSequenceTrack',
  trackId: 'refseq',
  name: 'Reference sequence',
  assemblyNames: ['hg38'],
  adapter: {
    type: 'IndexedFastaAdapter',
    uri: 'https://example.com/genome.fa',
  },
  displays: [
    {
      type: 'LinearReferenceSequenceDisplay',
      displayId: 'refseq-LinearReferenceSequenceDisplay',
      showTranslation: false,
    },
  ],
}
```

## Overview

base model `BaseDisplay` + `TrackHeightMixin` + `MultiRegionDisplayMixin`

### LinearReferenceSequenceDisplay - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/linearreferencesequencedisplay).

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

<details open>
<summary>LinearReferenceSequenceDisplay - Properties</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                     | Signature                                       |
| ------------------------------------------ | ----------------------------------------------- |
| [`type`](#property-type)                   | `ISimpleType<"LinearReferenceSequenceDisplay">` |
| [`configuration`](#property-configuration) | `ITypeUnion<any, any, any>`                     |

</details>

<details>
<summary>LinearReferenceSequenceDisplay - Properties (all signatures)</summary>

#### property: type

```ts
// type signature
type type = ISimpleType<'LinearReferenceSequenceDisplay'>
// code
type: types.literal('LinearReferenceSequenceDisplay')
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
<summary>LinearReferenceSequenceDisplay - Volatiles</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                   | Signature                                   |
| ---------------------------------------- | ------------------------------------------- |
| [`sequenceData`](#volatile-sequencedata) | `ObservableMap<number, SequenceRegionData>` |

</details>

<details>
<summary>LinearReferenceSequenceDisplay - Volatiles (all signatures)</summary>

#### volatile: sequenceData

```ts
// type signature
type sequenceData = ObservableMap<number, SequenceRegionData>
// code
sequenceData: observable.map<number, SequenceRegionData>()
```

</details>

<details open>
<summary>LinearReferenceSequenceDisplay - Getters</summary>

#### getter: colorState

Theme-derived palette + text colors, derived from the session theme so they're
always available — including headless SVG export and RPC, where no component
mounts to seed them.

```ts
type colorState = { palette: ColorPalette; textColors: TextColors }
```

#### getter: isDna

true for DNA tracks; reverse-complement and translation rows are gated on this
since they are biologically meaningful only for DNA.

```ts
type isDna = boolean
```

#### getter: effectiveShowReverse

reverse-complement row is meaningful only for DNA

```ts
type effectiveShowReverse = boolean
```

#### getter: effectiveShowTranslation

translation rows are meaningful only for DNA

```ts
type effectiveShowTranslation = boolean
```

#### getter: zoomedOut

the view is too zoomed out to show individual bases

```ts
type zoomedOut = boolean
```

#### getter: svgReadyExtraTerminal

zoomedOut is a terminal renderable state (static "zoom in" message, no fetch),
so it makes `svgReady` resolve even though no data loads. See
MultiRegionDisplayMixin.svgReadyExtraTerminal.

```ts
type svgReadyExtraTerminal = boolean
```

#### getter: computedHeight

collapses to 50px when zoomed out (no sequence visible) or before the view
initializes; otherwise sized to fit the visible rows.

```ts
type computedHeight = number
```

#### getter: height

override TrackHeightMixin height: use manual resize if set, otherwise the
zoom-aware computed height.

```ts
type height = number
```

#### getter: renderState

everything the Canvas2D backend needs to paint a frame

```ts
type renderState = DrawSequenceState
```

#### getter: displayPhase

Same precedence as MultiRegionDisplayMixin plus a zoom gate: when zoomed past
base resolution the body shows a "zoom in" message, so suppress the loading
phase (fall through to `ready`) and let that message show. The chrome's
loading-overlay visibility derives from this overridden getter.

```ts
type displayPhase = DisplayPhase
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                       | Signature |
| -------------------------------------------- | --------- |
| [`showForward`](#getter-showforward)         | `boolean` |
| [`showReverse`](#getter-showreverse)         | `boolean` |
| [`showTranslation`](#getter-showtranslation) | `boolean` |
| [`sequenceType`](#getter-sequencetype)       | `any`     |
| [`numRows`](#getter-numrows)                 | `number`  |
| [`sequenceHeight`](#getter-sequenceheight)   | `number`  |
| [`rowHeight`](#getter-rowheight)             | `number`  |

</details>

<details>
<summary>LinearReferenceSequenceDisplay - Getters (all signatures)</summary>

#### getter: showForward

```ts
type showForward = boolean
```

#### getter: showReverse

```ts
type showReverse = boolean
```

#### getter: showTranslation

```ts
type showTranslation = boolean
```

#### getter: sequenceType

```ts
type sequenceType = any
```

#### getter: numRows

```ts
type numRows = number
```

#### getter: sequenceHeight

```ts
type sequenceHeight = number
```

#### getter: rowHeight

```ts
type rowHeight = number
```

</details>

<details open>
<summary>LinearReferenceSequenceDisplay - Methods</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                     | Signature                                                                                                                                                             |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`renderSvg`](#method-rendersvg)           | `(opts?: ExportSvgDisplayOptions \| undefined) => Promise<Element>`                                                                                                   |
| [`trackMenuItems`](#method-trackmenuitems) | `() => ({ label: string; type: string; checked: boolean; onClick: () => void; } \| { label: string; onClick: () => void; type?: undefined; checked?: undefined; })[]` |

</details>

<details>
<summary>LinearReferenceSequenceDisplay - Methods (all signatures)</summary>

#### method: renderSvg

```ts
type renderSvg = (
  opts?: ExportSvgDisplayOptions | undefined,
) => Promise<Element>
```

#### method: trackMenuItems

```ts
type trackMenuItems = () => (
  | { label: string; type: string; checked: boolean; onClick: () => void }
  | {
      label: string
      onClick: () => void
      type?: undefined
      checked?: undefined
    }
)[]
```

</details>

<details open>
<summary>LinearReferenceSequenceDisplay - Actions</summary>

#### action: addGCContentTrack

spins up a standalone GCContentTrack session track that wraps this track's
sequence adapter (requires the gccontent plugin)

```ts
type addGCContentTrack = () => void
```

#### action: startRenderingBackend

Called by `useRenderingBackend` (via DisplayChrome) once the canvas backend is
created. Streams each fetched region into the backend and draws every frame from
`renderState`.

```ts
type startRenderingBackend = (backend: Canvas2DSequenceRenderer) => void
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                         | Signature                                                                        |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [`setSequenceRegion`](#action-setsequenceregion)               | `(idx: number, data: SequenceRegionData) => void`                                |
| [`clearDisplaySpecificData`](#action-cleardisplayspecificdata) | `() => void`                                                                     |
| [`toggleShowForward`](#action-toggleshowforward)               | `() => void`                                                                     |
| [`toggleShowReverse`](#action-toggleshowreverse)               | `() => void`                                                                     |
| [`toggleShowTranslation`](#action-toggleshowtranslation)       | `() => void`                                                                     |
| [`fetchNeeded`](#action-fetchneeded)                           | `(needed: { region: Region; displayedRegionIndex: number; }[]) => Promise<void>` |

</details>

<details>
<summary>LinearReferenceSequenceDisplay - Actions (all signatures)</summary>

#### action: setSequenceRegion

```ts
type setSequenceRegion = (idx: number, data: SequenceRegionData) => void
```

#### action: clearDisplaySpecificData

```ts
type clearDisplaySpecificData = () => void
```

#### action: toggleShowForward

```ts
type toggleShowForward = () => void
```

#### action: toggleShowReverse

```ts
type toggleShowReverse = () => void
```

#### action: toggleShowTranslation

```ts
type toggleShowTranslation = () => void
```

#### action: fetchNeeded

```ts
type fetchNeeded = (
  needed: { region: Region; displayedRegionIndex: number }[],
) => Promise<void>
```

</details>
