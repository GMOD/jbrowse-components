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
[setRegionStatus](../fetchmixin#action-setregionstatus),
[cancelFetch](../fetchmixin#action-cancelfetch),
[cancelFetchByUser](../fetchmixin#action-cancelfetchbyuser),
[runFetch](../fetchmixin#action-runfetch)

<details open>
<summary style="cursor: pointer; font-size: 1.25em; font-weight: bold">LinearReferenceSequenceDisplay - Properties</summary>

#### property: type

```js
// type signature
ISimpleType<"LinearReferenceSequenceDisplay">
// code
type: types.literal('LinearReferenceSequenceDisplay')
```

#### property: configuration

```js
// type signature
ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

#### property: showForward

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showForward: types.stripDefault(types.boolean, true)
```

#### property: showReverse

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showReverse: types.stripDefault(types.boolean, true)
```

#### property: showTranslation

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showTranslation: types.stripDefault(types.boolean, true)
```

</details>

<details open>
<summary style="cursor: pointer; font-size: 1.25em; font-weight: bold">LinearReferenceSequenceDisplay - Volatiles</summary>

#### volatile: sequenceData

```js
// type signature
ObservableMap<number, SequenceRegionData>
// code
sequenceData: observable.map<number, SequenceRegionData>()
```

</details>

<details open>
<summary style="cursor: pointer; font-size: 1.25em; font-weight: bold">LinearReferenceSequenceDisplay - Getters</summary>

#### getter: sequenceType

```js
// type
any
```

#### getter: colorState

Theme-derived palette + text colors, derived from the session theme so they're
always available — including headless SVG export and RPC, where no component
mounts to seed them.

```js
// type
{
  palette: ColorPalette
  textColors: TextColors
}
```

#### getter: isDna

true for DNA tracks; reverse-complement and translation rows are gated on this
since they are biologically meaningful only for DNA.

```js
// type
boolean
```

#### getter: effectiveShowReverse

reverse-complement row is meaningful only for DNA

```js
// type
boolean
```

#### getter: effectiveShowTranslation

translation rows are meaningful only for DNA

```js
// type
boolean
```

#### getter: zoomedOut

the view is too zoomed out to show individual bases

```js
// type
boolean
```

#### getter: svgReadyExtraTerminal

zoomedOut is a terminal renderable state (static "zoom in" message, no fetch),
so it makes `svgReady` resolve even though no data loads. See
MultiRegionDisplayMixin.svgReadyExtraTerminal.

```js
// type
boolean
```

#### getter: numRows

```js
// type
number
```

#### getter: sequenceHeight

```js
// type
number
```

#### getter: computedHeight

collapses to 50px when zoomed out (no sequence visible) or before the view
initializes; otherwise sized to fit the visible rows.

```js
// type
number
```

#### getter: height

override TrackHeightMixin height: use manual resize if set, otherwise the
zoom-aware computed height.

```js
// type
number
```

#### getter: rowHeight

```js
// type
number
```

#### getter: renderState

everything the Canvas2D backend needs to paint a frame

```js
// type
DrawSequenceState
```

#### getter: displayPhase

Same precedence as MultiRegionDisplayMixin plus a zoom gate: when zoomed past
base resolution the body shows a "zoom in" message, so suppress the loading
phase (fall through to `ready`) and let that message show. The inherited
`loadingOverlayVisible` reads this overridden getter.

```js
// type
DisplayPhase
```

</details>

<details open>
<summary style="cursor: pointer; font-size: 1.25em; font-weight: bold">LinearReferenceSequenceDisplay - Methods</summary>

#### method: renderSvg

```js
// type signature
renderSvg: (opts?: ExportSvgDisplayOptions | undefined) => Promise<Element | null>
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => { label: string; type: string; checked: boolean; onClick: () => void; }[]
```

</details>

<details open>
<summary style="cursor: pointer; font-size: 1.25em; font-weight: bold">LinearReferenceSequenceDisplay - Actions</summary>

#### action: setSequenceRegion

```js
// type signature
setSequenceRegion: (idx: number, data: SequenceRegionData) => void
```

#### action: clearDisplaySpecificData

```js
// type signature
clearDisplaySpecificData: () => void
```

#### action: toggleShowForward

```js
// type signature
toggleShowForward: () => void
```

#### action: toggleShowReverse

```js
// type signature
toggleShowReverse: () => void
```

#### action: toggleShowTranslation

```js
// type signature
toggleShowTranslation: () => void
```

#### action: startRenderingBackend

Called by `useRenderingBackend` (via DisplayChrome) once the canvas backend is
created. Streams each fetched region into the backend and draws every frame from
`renderState`.

```js
// type signature
startRenderingBackend: (backend: Canvas2DSequenceRenderer) => void
```

#### action: fetchNeeded

```js
// type signature
fetchNeeded: (needed: { region: Region; displayedRegionIndex: number; }[]) => Promise<void>
```

</details>
