---
id: linearhicdisplay
title: LinearHicDisplay
sidebar_label: Display -> LinearHicDisplay
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`hic` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/hic/src/LinearHicDisplay/model.ts).

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

## Members

| Member                                                           | Kind       | Description                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [type](#property-type)                                           | Properties |                                                                                                                                                                                                                                                                                                                                                                                                          |
| [configuration](#property-configuration)                         | Properties |                                                                                                                                                                                                                                                                                                                                                                                                          |
| [rpcData](#volatile-rpcdata)                                     | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                          |
| [availableNormalizations](#volatile-availablenormalizations)     | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                          |
| [availableResolutions](#volatile-availableresolutions)           | Volatiles  |                                                                                                                                                                                                                                                                                                                                                                                                          |
| [resolutionBias](#getter-resolutionbias)                         | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                          |
| [useLogScale](#getter-uselogscale)                               | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                          |
| [useColorPercentile](#getter-usecolorpercentile)                 | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                          |
| [showResolutionControls](#getter-showresolutioncontrols)         | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                          |
| [selectedNormalization](#getter-selectednormalization)           | Getters    | The user's persisted normalization choice. May name a scheme the current `.hic` file doesn't actually offer — `activeNormalization` resolves that.                                                                                                                                                                                                                                                       |
| [activeNormalization](#getter-activenormalization)               | Getters    | The normalization actually used, resolved against what the file offers (`availableNormalizations`). Falls back to the next-best available scheme when the selection is absent (hic-straw silently uses NONE otherwise). A pure getter, so opening a file that lacks the selected scheme never writes a config delta / marks the track edited — only an explicit user pick (setActiveNormalization) does. |
| [fitToHeight](#getter-fittoheight)                               | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                          |
| [dataLoaded](#getter-dataloaded)                                 | Getters    | GlobalDataDisplayMixin hook: the contact matrix has been fetched once `rpcData` is set (the fetch commits it even for an empty viewport), so `svgReady` waits for the debounced `afterAttach` fetch instead of exporting an empty matrix.                                                                                                                                                                |
| [colorScheme](#getter-colorscheme)                               | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                          |
| [showLegend](#getter-showlegend)                                 | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                          |
| [colorMaxScore](#getter-colormaxscore)                           | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                          |
| [autoResolutionIdx](#getter-autoresolutionidx)                   | Getters    | Index into `availableResolutions` that pure auto-mode would pick at the current zoom — largest binsize ≤ 2*bpPerPx, falling back to the finest binsize (idx 0) when nothing qualifies (very zoomed in). The factor 2 floors at ~0.5 bins/screen-pixel, which keeps bins visible without going sub-pixel; users who want finer can step the resolution bias down.                                         |
| [yScalar](#getter-yscalar)                                       | Getters    |                                                                                                                                                                                                                                                                                                                                                                                                          |
| [effectiveResolutionIdx](#getter-effectiveresolutionidx)         | Getters    | Index actually used after applying `resolutionBias`, clamped to the valid range so a stale bias from a different zoom level can't index out of bounds.                                                                                                                                                                                                                                                   |
| [effectiveResolution](#getter-effectiveresolution)               | Getters    | The actual binsize to fetch at, after auto-pick + bias.                                                                                                                                                                                                                                                                                                                                                  |
| [renderTransform](#getter-rendertransform)                       | Getters    | Forward transform { scale, viewOffsetX } shared by GPU render, mouse hit-test, and SVG export. See `computeRenderTransform` for the math.                                                                                                                                                                                                                                                                |
| [rpcProps](#method-rpcprops)                                     | Methods    |                                                                                                                                                                                                                                                                                                                                                                                                          |
| [nextResolution](#method-nextresolution)                         | Methods    | The binsize that `stepResolution(dir)` would land on, or undefined if no valid step exists in that direction. Consumed by both the UI (button disabled state) and `stepResolution` itself, so there's one source of truth for "what's the next resolution".                                                                                                                                              |
| [hitTest](#method-hittest)                                       | Methods    | Inverse of the render transform: takes mouse coords (canvas-relative) and returns the contact bin under the cursor, or undefined. The forward transform lives in `renderTransform`; this is its inverse so hit-testing always matches what was drawn.                                                                                                                                                    |
| [renderState](#method-renderstate)                               | Methods    | Computed per-frame render state for the GPU backend. Read by the autorun lifecycle on every change to any tracked observable.                                                                                                                                                                                                                                                                            |
| [svgLegendWidth](#method-svglegendwidth)                         | Methods    | Width of the SVG legend (consumed by SVGLinearGenomeView). Returns 0 when no legend will be drawn so the export framework can omit space.                                                                                                                                                                                                                                                                |
| [trackMenuItems](#method-trackmenuitems)                         | Methods    |                                                                                                                                                                                                                                                                                                                                                                                                          |
| [renderSvg](#method-rendersvg)                                   | Methods    |                                                                                                                                                                                                                                                                                                                                                                                                          |
| [setRpcData](#action-setrpcdata)                                 | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                          |
| [startRenderingBackend](#action-startrenderingbackend)           | Actions    | Called by the React hook (`useRenderingBackend`) when the HAL resolves. Wires the backend into the mixin-owned autorun pair via `attachRenderingBackend`.                                                                                                                                                                                                                                                |
| [setUseLogScale](#action-setuselogscale)                         | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                          |
| [setUseColorPercentile](#action-setusecolorpercentile)           | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                          |
| [setShowResolutionControls](#action-setshowresolutioncontrols)   | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                          |
| [setColorScheme](#action-setcolorscheme)                         | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                          |
| [setActiveNormalization](#action-setactivenormalization)         | Actions    | Persist the user's explicit normalization pick. Resolution against what the file offers happens in the `activeNormalization` getter, so this only fires on a real user choice.                                                                                                                                                                                                                           |
| [setAvailableNormalizations](#action-setavailablenormalizations) | Actions    | Record what the `.hic` file offers. Resolution lives in the `activeNormalization` getter (which falls back off this list when the user's `selectedNormalization` isn't available), so this doesn't write the selection — opening a file that lacks the selected scheme never marks the track edited.                                                                                                     |
| [setFitToHeight](#action-setfittoheight)                         | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                          |
| [setShowLegend](#action-setshowlegend)                           | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                          |
| [setAvailableResolutions](#action-setavailableresolutions)       | Actions    |                                                                                                                                                                                                                                                                                                                                                                                                          |
| [stepResolution](#action-stepresolution)                         | Actions    | dir = -1 → finer (smaller binsize); dir = +1 → coarser. Re-grounds the bias against the _current_ effective index so repeated clicks at a clamped boundary don't accumulate stale bias the user can't see — the bias always reflects what's actually on screen.                                                                                                                                          |
| [resetResolutionBias](#action-resetresolutionbias)               | Actions    | Reset to pure auto-mode: bias 0, binsize follows zoom directly.                                                                                                                                                                                                                                                                                                                                          |
| [performHicFetch](#action-performhicfetch)                       | Actions    | Re-fetches contact matrix for the current viewport. Driven by the `afterAttach` autorun, which also re-fires on `reload()` (it tracks `reloadCounter`).                                                                                                                                                                                                                                                  |

### LinearHicDisplay - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/linearhicdisplay).

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
[stopActiveFetch](../fetchmixin#action-stopactivefetch),
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

<details>
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

</details>

<details>
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

<details>
<summary>LinearHicDisplay - Getters</summary>

#### getter: selectedNormalization

The user's persisted normalization choice. May name a scheme the current `.hic`
file doesn't actually offer — `activeNormalization` resolves that.

```ts
type selectedNormalization = string
```

#### getter: activeNormalization

The normalization actually used, resolved against what the file offers
(`availableNormalizations`). Falls back to the next-best available scheme when
the selection is absent (hic-straw silently uses NONE otherwise). A pure getter,
so opening a file that lacks the selected scheme never writes a config delta /
marks the track edited — only an explicit user pick (setActiveNormalization)
does.

```ts
type activeNormalization = string
```

#### getter: dataLoaded

GlobalDataDisplayMixin hook: the contact matrix has been fetched once `rpcData`
is set (the fetch commits it even for an empty viewport), so `svgReady` waits
for the debounced `afterAttach` fetch instead of exporting an empty matrix.

```ts
type dataLoaded = boolean
```

#### getter: autoResolutionIdx

Index into `availableResolutions` that pure auto-mode would pick at the current
zoom — largest binsize ≤ 2*bpPerPx, falling back to the finest binsize (idx 0)
when nothing qualifies (very zoomed in).

The factor 2 floors at ~0.5 bins/screen-pixel, which keeps bins visible without
going sub-pixel; users who want finer can step the resolution bias down.

```ts
type autoResolutionIdx = number
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

<details>
<summary>LinearHicDisplay - Getters (other undocumented members)</summary>

#### getter: resolutionBias

```ts
type resolutionBias = number
```

#### getter: useLogScale

```ts
type useLogScale = boolean
```

#### getter: useColorPercentile

```ts
type useColorPercentile = boolean
```

#### getter: showResolutionControls

```ts
type showResolutionControls = boolean
```

#### getter: fitToHeight

```ts
type fitToHeight = boolean
```

#### getter: colorScheme

```ts
type colorScheme = 'fall' | 'juicebox' | 'viridis'
```

#### getter: showLegend

```ts
type showLegend = boolean
```

#### getter: colorMaxScore

```ts
type colorMaxScore = number
```

#### getter: yScalar

```ts
type yScalar = number
```

</details>

<details>
<summary>LinearHicDisplay - Methods</summary>

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

</details>

<details>
<summary>LinearHicDisplay - Methods (other undocumented members)</summary>

#### method: rpcProps

```ts
type rpcProps = () => { normalization: string }
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

<details>
<summary>LinearHicDisplay - Actions</summary>

#### action: startRenderingBackend

Called by the React hook (`useRenderingBackend`) when the HAL resolves. Wires
the backend into the mixin-owned autorun pair via `attachRenderingBackend`.

```ts
type startRenderingBackend = (backend: HicRenderingBackend) => void
```

#### action: setActiveNormalization

Persist the user's explicit normalization pick. Resolution against what the file
offers happens in the `activeNormalization` getter, so this only fires on a real
user choice.

```ts
type setActiveNormalization = (f: string) => void
```

#### action: setAvailableNormalizations

Record what the `.hic` file offers. Resolution lives in the
`activeNormalization` getter (which falls back off this list when the user's
`selectedNormalization` isn't available), so this doesn't write the selection —
opening a file that lacks the selected scheme never marks the track edited.

```ts
type setAvailableNormalizations = (f: string[]) => void
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

Re-fetches contact matrix for the current viewport. Driven by the `afterAttach`
autorun, which also re-fires on `reload()` (it tracks `reloadCounter`).

```ts
type performHicFetch = () => Promise<void>
```

</details>

<details>
<summary>LinearHicDisplay - Actions (other undocumented members)</summary>

#### action: setRpcData

```ts
type setRpcData = (data: HicDataResult | null) => void
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

</details>
