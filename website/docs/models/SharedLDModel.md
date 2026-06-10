---
id: sharedldmodel
title: SharedLDModel
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

Shared state model for LD displays extends

- [BaseDisplay](../basedisplay)
- [TrackHeightMixin](../trackheightmixin)
- [GlobalDataDisplayMixin](../globaldatadisplaymixin)
- [StaleViewportRescaleMixin](../staleviewportrescalemixin)
- [ConfigOverrideMixin](../configoverridemixin)

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

**Properties:** heightOverride

**Volatiles:** scrollTop

**Actions:** setScrollTop, setHeight, resizeHeight

### Available via [GlobalDataDisplayMixin](../globaldatadisplaymixin)

**Getters:** loadingOverlayVisible

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

**Volatiles:** activeStopToken, fetchGeneration, error, statusMessage

**Getters:** isLoading

**Actions:** setError, setStatusMessage, cancelFetch, runFetch

### Available via [StaleViewportRescaleMixin](../staleviewportrescalemixin)

**Volatiles:** lastDrawnOffsetPx, lastDrawnBpPerPx

**Actions:** setLastDrawnViewport

### Available via [ConfigOverrideMixin](../configoverridemixin)

**Methods:** getOverride, getConfWithOverride

**Actions:** setOverride, clearOverride

### SharedLDModel - Volatiles

#### volatile: rpcData

```js
// type signature
LDDataResult | null
// code
rpcData: null as LDDataResult | null
```

#### volatile: reloadCounter

Bumped by `reload()` to retrigger the fetch autorun.

```js
// type signature
number
// code
reloadCounter: 0
```

### SharedLDModel - Getters

#### getter: prefersOffset

```js
// type
boolean
```

#### getter: snps

Returns true if this display uses pre-computed LD data (PLINK, ldmat) rather
than computing LD from VCF genotypes

```js
// type
LDSnp[]
```

#### getter: effectiveLineZoneHeight

Pixel height of the SVG zone above the canvas (variant labels + lines, or
recombination scale). The hit-test subtracts this from mouseY before reversing
the render transform.

```js
// type
number
```

#### getter: ldCanvasHeight

Effective height for the LD canvas (total height minus the zone the
recombination overlay / variant lines occupy above the matrix).

```js
// type
number
```

#### getter: yScalar

Per-frame yScalar squash factor. When fitToHeight is on, squashes the natural
(canvasWidth/2) triangle into ldCanvasHeight. Lives on the main thread so resize
doesn't trigger a worker re-fetch.

```js
// type
number
```

#### getter: renderTransform

Forward transform { scale, viewOffsetX } shared by GPU render, mouse hit-test,
and the matrix→genomic-position SVG lines. See `computeRenderTransform` for the
math.

```js
// type
RenderTransform
```

#### getter: renderState

Per-frame render state for the GPU backend. Read by the upload/render autorun —
every change to any tracked observable (view.bpPerPx, view.offsetPx,
model.fitToHeight, rpcData contents, …) re-fires it.

```js
// type
{ yScalar: number; canvasWidth: number; canvasHeight: number; signedLD: boolean; viewScale: number; viewOffsetX: number; uniformW: number; } | undefined
```

### SharedLDModel - Methods

#### method: hitTest

Inverse of `renderTransform` for the LD matrix: takes mouse coords
(canvas-relative) and returns the LD cell under the cursor, or undefined.
Mirrors plugins/hic's `hitTest` so both contact maps keep the forward and
inverse transforms paired on the model.

```js
// type signature
hitTest: (mouseX: number, mouseY: number) => LDFlatbushItem | undefined
```

#### method: filterMenuItems

```js
// type signature
filterMenuItems: () => { label: string; onClick: () => void; }[]
```

#### method: legendItems

```js
// type signature
legendItems: () => LegendItem[]
```

#### method: svgLegendWidth

```js
// type signature
svgLegendWidth: () => number
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | { ...; } | { ...; })[]
```

#### method: renderSvg

```js
// type signature
renderSvg: (opts: ExportSvgDisplayOptions) => Promise<ReactNode>
```

### SharedLDModel - Actions

#### action: startRenderingBackend

Starts the upload/render autorun. Data + color ramp both derive from the same
rpcData object, so a single identity-diffed slot handles both uploads.

```js
// type signature
startRenderingBackend: (backend: LDRenderingBackend) => void
```

#### action: performLDFetch

Re-fetches LD matrix for the current viewport. Both the autorun (in
`afterAttach`) and `reload()` invoke this directly.

```js
// type signature
performLDFetch: () => Promise<void>
```

#### action: reload

```js
// type signature
reload: () => void
```
