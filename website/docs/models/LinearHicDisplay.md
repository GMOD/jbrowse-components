---
id: linearhicdisplay
title: LinearHicDisplay
sidebar_label: Display -> LinearHicDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/hic/src/LinearHicDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearHicDisplay.md)

## Example usage

A complete `HicTrack` config to paste into `tracks`. `resolutionBias` nudges the
auto-picked binsize (negative = finer, positive = coarser):

```js
{
  type: 'HicTrack',
  trackId: 'hic',
  name: 'Hi-C',
  assemblyNames: ['hg38'],
  adapter: { type: 'HicAdapter', uri: 'https://example.com/contacts.hic' },
  displays: [
    {
      type: 'LinearHicDisplay',
      displayId: 'hic-LinearHicDisplay',
      useLogScale: true,
      resolutionBias: 1,
    },
  ],
}
```

## Overview

Hi-C display that renders contact matrix using WebGL

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

### Available via [ConfigOverrideMixin](../configoverridemixin)

**Properties:**
[configOverrides](../configoverridemixin#property-configoverrides)

**Methods:** [getOverride](../configoverridemixin#method-getoverride),
[getConfWithOverride](../configoverridemixin#method-getconfwithoverride)

**Actions:** [setOverride](../configoverridemixin#action-setoverride),
[clearOverride](../configoverridemixin#action-clearoverride)

<details open>
<summary>LinearHicDisplay - Properties</summary>

#### property: type

```ts
// type signature
type type = ISimpleType<'LinearHicDisplay'>
// code
type: types.literal('LinearHicDisplay')
```

#### property: configuration

```ts
// type signature
type configuration = ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

#### property: resolutionBias

Signed integer offset from the zoom-derived auto-picked binsize. `0` means pure
auto. `-1` is one step finer than auto, `+1` is one step coarser, etc. Tracking
the _offset_ (not an absolute binsize) keeps the user's intent valid across zoom
levels — a saved session with bias=-1 still means "one step finer than auto"
when reopened at a different scale.

```ts
// type signature
type resolutionBias = IOptionalIType<ISimpleType<number>, [undefined]>
// code
resolutionBias: types.stripDefault(types.number, 0)
```

#### property: useLogScale

Map contact counts to color on a log2 scale instead of linear.

```ts
// type signature
type useLogScale = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
useLogScale: types.stripDefault(types.boolean, false)
```

#### property: useColorPercentile

Color saturation point: false → maxScore/20 (linear) or maxScore (log), matches
legacy behavior. true → 95th percentile of counts; lower saturation point so
off-diagonal contacts read more strongly.

```ts
// type signature
type useColorPercentile = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
useColorPercentile: types.stripDefault(types.boolean, false)
```

#### property: showResolutionControls

Whether the on-canvas resolution stepper overlay is shown. Toggled from the
track menu's `Show...` submenu; the stepper itself lives only on the canvas to
keep the menu uncluttered.

```ts
// type signature
type showResolutionControls = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showResolutionControls: types.stripDefault(types.boolean, true)
```

#### property: activeNormalization

Active matrix normalization scheme (e.g. KR, SCALE, VC, NONE), reconciled
against what the `.hic` file actually provides.

```ts
// type signature
type activeNormalization = IOptionalIType<ISimpleType<string>, [undefined]>
// code
activeNormalization: types.stripDefault(types.string, 'KR')
```

#### property: fitToHeight

Squash the triangle vertically to fit the chosen display height instead of
drawing square bins at natural proportions.

```ts
// type signature
type fitToHeight = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
fitToHeight: types.stripDefault(types.boolean, false)
```

</details>

<details open>
<summary>LinearHicDisplay - Volatiles</summary>

#### volatile: rpcData

```ts
// type signature
type rpcData = HicDataResult | null
// code
rpcData: null as HicDataResult | null
```

#### volatile: availableNormalizations

```ts
// type signature
type availableNormalizations = string[] | undefined
// code
availableNormalizations: undefined as string[] | undefined
```

#### volatile: availableResolutions

```ts
// type signature
type availableResolutions = number[] | undefined
// code
availableResolutions: undefined as number[] | undefined
```

</details>

<details open>
<summary>LinearHicDisplay - Getters</summary>

#### getter: dataLoaded

GlobalDataDisplayMixin hook: the contact matrix has been fetched once `rpcData`
is set (the fetch commits it even for an empty viewport), so `svgReady` waits
for the debounced `afterAttach` fetch instead of exporting an empty matrix.

```ts
type dataLoaded = boolean
```

#### getter: colorScheme

```ts
type colorScheme = 'fall' | 'juicebox' | 'viridis' | undefined
```

#### getter: showLegend

```ts
type showLegend = boolean | undefined
```

#### getter: colorMaxScore

```ts
type colorMaxScore = number
```

#### getter: autoResolutionIdx

Index into `availableResolutions` that pure auto-mode would pick at the current
zoom — largest binsize ≤ 2\*bpPerPx, falling back to the finest binsize (idx 0)
when nothing qualifies (very zoomed in).

The factor 2 floors at ~0.5 bins/screen-pixel, which keeps bins visible without
going sub-pixel; users who want finer can step the resolution bias down.

```ts
type autoResolutionIdx = number
```

#### getter: yScalar

```ts
type yScalar = number
```

#### getter: effectiveResolutionIdx

Index actually used after applying `resolutionBias`, clamped to the valid range
so a stale bias from a different zoom level can't index out of bounds.

```ts
type effectiveResolutionIdx = number
```

#### getter: effectiveResolution

The actual binsize to fetch at, after auto-pick + bias.

```ts
type effectiveResolution = number | undefined
```

#### getter: renderTransform

Forward transform { scale, viewOffsetX } shared by GPU render, mouse hit-test,
and SVG export. See `computeRenderTransform` for the math.

```ts
type renderTransform = RenderTransform
```

</details>

<details open>
<summary>LinearHicDisplay - Methods</summary>

#### method: rpcProps

```ts
type rpcProps = () => { normalization: string }
```

#### method: nextResolution

The binsize that `stepResolution(dir)` would land on, or undefined if no valid
step exists in that direction. Consumed by both the UI (button disabled state)
and `stepResolution` itself, so there's one source of truth for "what's the next
resolution".

```ts
type nextResolution = (dir: 1 | -1) => number | undefined
```

#### method: hitTest

Inverse of the render transform: takes mouse coords (canvas-relative) and
returns the contact bin under the cursor, or undefined. The forward transform
lives in `renderTransform`; this is its inverse so hit-testing always matches
what was drawn.

```ts
type hitTest = (mouseX: number, mouseY: number) => HicContactItem | undefined
```

#### method: renderState

Computed per-frame render state for the GPU backend. Read by the autorun
lifecycle on every change to any tracked observable.

```ts
type renderState =
  | {
      binWidth: number
      yScalar: number
      canvasWidth: number
      canvasHeight: number
      colorMaxScore: number
      useLogScale: boolean
      viewScale: number
      viewOffsetX: number
    }
  | undefined
```

#### method: svgLegendWidth

Width of the SVG legend (consumed by SVGLinearGenomeView). Returns 0 when no
legend will be drawn so the export framework can omit space.

```ts
type svgLegendWidth = () => number
```

#### method: trackMenuItems

```ts
type trackMenuItems = () => MenuItem[]
```

#### method: renderSvg

```ts
type renderSvg = (opts: ExportSvgDisplayOptions) => Promise<ReactNode>
```

</details>

<details open>
<summary>LinearHicDisplay - Actions</summary>

#### action: setRpcData

```ts
type setRpcData = (data: HicDataResult | null) => void
```

#### action: startRenderingBackend

Called by the React hook (`useRenderingBackend`) when the HAL resolves. Wires
the backend into the mixin-owned autorun pair via `attachRenderingBackend`.

```ts
type startRenderingBackend = (backend: HicRenderingBackend) => void
```

#### action: setUseLogScale

```ts
type setUseLogScale = (f: boolean) => void
```

#### action: setUseColorPercentile

```ts
type setUseColorPercentile = (f: boolean) => void
```

#### action: setShowResolutionControls

```ts
type setShowResolutionControls = (f: boolean) => void
```

#### action: setColorScheme

```ts
type setColorScheme = (f?: 'fall' | 'juicebox' | 'viridis' | undefined) => void
```

#### action: setActiveNormalization

```ts
type setActiveNormalization = (f: string) => void
```

#### action: setAvailableNormalizations

Reconcile `activeNormalization` against what the file actually offers. The model
seeds `activeNormalization='KR'` before `CoreGetInfo` resolves, but not every
`.hic` carries KR — when it doesn't, fall back to the next-best available scheme
so the UI selection matches what's rendered (hic-straw silently uses NONE for an
absent norm otherwise).

```ts
type setAvailableNormalizations = (f: string[]) => void
```

#### action: setFitToHeight

```ts
type setFitToHeight = (arg: boolean) => void
```

#### action: setShowLegend

```ts
type setShowLegend = (arg: boolean) => void
```

#### action: setAvailableResolutions

```ts
type setAvailableResolutions = (f: number[]) => void
```

#### action: stepResolution

dir = -1 → finer (smaller binsize); dir = +1 → coarser. Re-grounds the bias
against the _current_ effective index so repeated clicks at a clamped boundary
don't accumulate stale bias the user can't see — the bias always reflects what's
actually on screen.

```ts
type stepResolution = (dir: 1 | -1) => void
```

#### action: resetResolutionBias

Reset to pure auto-mode: bias 0, binsize follows zoom directly.

```ts
type resetResolutionBias = () => void
```

#### action: performHicFetch

Re-fetches contact matrix for the current viewport. Both the autorun (in
`afterAttach`) and `reload()` invoke this directly.

```ts
type performHicFetch = () => Promise<void>
```

</details>
