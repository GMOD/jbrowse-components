---
id: linearhicdisplay
title: LinearHicDisplay
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

## Docs

Hi-C display that renders contact matrix using WebGL extends

- [BaseDisplay](../basedisplay)
- [TrackHeightMixin](../trackheightmixin)
- [GlobalDataDisplayMixin](../globaldatadisplaymixin)

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

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

### Available via [RegionTooLargeMixin](../regiontoolargemixin)

**Properties:** userByteSizeLimit

**Volatiles:** regionTooLargeState, regionTooLargeReasonState,
featureDensityStats

**Getters:** regionTooLarge, regionTooLargeReason

**Methods:** regionCannotBeRenderedText, regionCannotBeRendered

**Actions:** setRegionTooLarge, setFeatureDensityStats,
setFeatureDensityStatsLimit, reload

### Available via [RenderLifecycleMixin](../gpulifecyclemixin)

**Volatiles:** canvasDrawn, currentRenderingBackend, renderTick, autorunsInstalled

**Actions:** markCanvasDrawn, resetCanvasDrawn, stopRenderingBackend, renderNow,
attachRenderingBackend

### Available via [FetchMixin](../fetchmixin)

**Volatiles:** activeStopToken, fetchGeneration, error, statusMessage

**Getters:** isLoading

**Actions:** setError, setStatusMessage, cancelFetch, runFetch

### LinearHicDisplay - Properties

#### property: resolutionBias

Signed integer offset from the zoom-derived auto-picked binsize. `0` means pure
auto. `-1` is one step finer than auto, `+1` is one step coarser, etc. Tracking
the _offset_ (not an absolute binsize) keeps the user's intent valid across zoom
levels — a saved session with bias=-1 still means "one step finer than auto"
when reopened at a different scale.

```js
// type signature
number
// code
resolutionBias: 0
```

#### property: useColorPercentile

Color saturation point: false → maxScore/20 (linear) or maxScore (log), matches
legacy behavior. true → 95th percentile of counts; lower saturation point so
off-diagonal contacts read more strongly.

```js
// type signature
false
// code
useColorPercentile: false
```

### LinearHicDisplay - Volatiles

#### volatile: rpcData

```js
// type signature
HicDataResult | null
// code
rpcData: null as HicDataResult | null
```

#### volatile: availableNormalizations

```js
// type signature
string[] | undefined
// code
availableNormalizations: undefined as string[] | undefined
```

#### volatile: availableResolutions

```js
// type signature
number[] | undefined
// code
availableResolutions: undefined as number[] | undefined
```

#### volatile: reloadCounter

Bumped by `reload()` to retrigger the fetch autorun.

```js
// type signature
number
// code
reloadCounter: 0
```

### LinearHicDisplay - Getters

#### getter: autoResolutionIdx

Index into `availableResolutions` that pure auto-mode would pick at the current
zoom — largest binsize ≤ 2\*bpPerPx, falling back to the finest binsize (idx 0)
when nothing qualifies (very zoomed in).

The factor 2 floors at ~0.5 bins/screen-pixel, which keeps bins visible without
going sub-pixel; users who want finer can step the resolution bias down.

```js
// type
number
```

#### getter: effectiveResolutionIdx

Index actually used after applying `resolutionBias`, clamped to the valid range
so a stale bias from a different zoom level can't index out of bounds.

```js
// type
number
```

#### getter: effectiveResolution

The actual binsize to fetch at, after auto-pick + bias.

```js
// type
number | undefined
```

#### getter: renderTransform

Forward transform { scale, viewOffsetX } shared by GPU render, mouse hit-test,
and SVG export. See `computeRenderTransform` for the math.

```js
// type
RenderTransform
```

### LinearHicDisplay - Methods

#### method: nextResolution

The binsize that `stepResolution(dir)` would land on, or undefined if no valid
step exists in that direction. Consumed by both the UI (button disabled state)
and `stepResolution` itself, so there's one source of truth for "what's the next
resolution".

```js
// type signature
nextResolution: (dir: 1 | -1) => number | undefined
```

#### method: hitTest

Inverse of the render transform: takes mouse coords (canvas-relative) and
returns the contact bin under the cursor, or undefined. The forward transform
lives in `renderTransform`; this is its inverse so hit-testing always matches
what was drawn.

```js
// type signature
hitTest: (mouseX: number, mouseY: number) => HicContactItem | undefined
```

#### method: renderState

Computed per-frame render state for the GPU backend. Read by the autorun
lifecycle on every change to any tracked observable.

```js
// type signature
renderState: { binWidth: number; yScalar: number; canvasWidth: number; canvasHeight: number; colorMaxScore: number; useLogScale: boolean; viewScale: number; viewOffsetX: number; } | undefined
```

#### method: svgLegendWidth

Width of the SVG legend (consumed by SVGLinearGenomeView). Returns 0 when no
legend will be drawn so the export framework can omit space.

```js
// type signature
svgLegendWidth: () => number
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => MenuItem[]
```

#### method: renderSvg

```js
// type signature
renderSvg: (opts: ExportSvgDisplayOptions) => Promise<ReactNode>
```

### LinearHicDisplay - Actions

#### action: setRpcData

```js
// type signature
setRpcData: (data: HicDataResult | null) => void
```

#### action: startRenderingBackend

Called by the React hook (`useRenderingBackend`) when the HAL resolves. Wires the
backend into the mixin-owned autorun pair via `attachRenderingBackend`.

```js
// type signature
startRenderingBackend: (backend: HicRenderingBackend) => void
```

#### action: setUseLogScale

```js
// type signature
setUseLogScale: (f: boolean) => void
```

#### action: setUseColorPercentile

```js
// type signature
setUseColorPercentile: (f: boolean) => void
```

#### action: setColorScheme

```js
// type signature
setColorScheme: (f?: "fall" | "juicebox" | "viridis" | undefined) => void
```

#### action: setActiveNormalization

```js
// type signature
setActiveNormalization: (f: string) => void
```

#### action: setAvailableNormalizations

```js
// type signature
setAvailableNormalizations: (f: string[]) => void
```

#### action: setMode

```js
// type signature
setMode: (arg: HicRenderMode) => void
```

#### action: setShowLegend

```js
// type signature
setShowLegend: (arg: boolean) => void
```

#### action: setAvailableResolutions

```js
// type signature
setAvailableResolutions: (f: number[]) => void
```

#### action: stepResolution

dir = -1 → finer (smaller binsize); dir = +1 → coarser. Re-grounds the bias
against the _current_ effective index so repeated clicks at a clamped boundary
don't accumulate stale bias the user can't see — the bias always reflects what's
actually on screen.

```js
// type signature
stepResolution: (dir: 1 | -1) => void
```

#### action: resetResolutionBias

Reset to pure auto-mode: bias 0, binsize follows zoom directly.

```js
// type signature
resetResolutionBias: () => void
```

#### action: performHicFetch

Re-fetches contact matrix for the current viewport. Both the autorun (in
`afterAttach`) and `reload()` invoke this directly.

```js
// type signature
performHicFetch: () => Promise<void>
```

#### action: reload

```js
// type signature
reload: () => void
```
