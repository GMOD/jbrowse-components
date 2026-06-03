---
id: linearwiggledisplay
title: LinearWiggleDisplay
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

## Docs

State model factory for the single-source wiggle display.

extends

- [BaseDisplay](../basedisplay)
- [TrackHeightMixin](../trackheightmixin)
- [MultiRegionDisplayMixin](../multiregiondisplaymixin)
- [WiggleCommonMixin](../wigglecommonmixin)

## Example usage

A snapshot of this model goes in a track's `displaySnapshot`. `height` is the
most common override; score-range and rendering options (autoscale, min/max
score, renderer) are config slots on the track — see the properties and the
`QuantitativeTrack` config for the rest:

```js
{
  trackId: 'my-bigwig-track',
  displaySnapshot: {
    type: 'LinearWiggleDisplay',
    height: 100,
  },
}
```

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

### Available via [MultiRegionDisplayMixin](../multiregiondisplaymixin)

**Volatiles:** loadedRegions

**Getters:** isReady, viewportWithinLoadedData, renderBlocks,
loadingOverlayVisible

**Actions:** setLoadedRegion, clearDisplaySpecificData, clearAllRpcData, reload,
invalidateLoadedRegions, fetchNeeded, isCacheValid, getByteEstimateConfig,
fetchRegions, afterAttach

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

### Available via [WiggleCommonMixin](../wigglecommonmixin)

**Volatiles:** rpcDataMap

**Getters:** visibleScoreRange, domain

**Actions:** clearDisplaySpecificData

### Available via [WiggleScoreConfigMixin](../wigglescoreconfigmixin)

**Properties:** resolution, displayCrossHatches

**Volatiles:** loadedBpPerPx

**Getters:** scalebarOverlapLeft, posColor, negColor, bicolorPivot, scaleType,
autoscaleType, numStdDev, summaryScoreMode, renderingType, minScore, maxScore,
minScoreConfig, maxScoreConfig, hasResolution

**Actions:** toggleCrossHatches, setResolution, setLoadedBpPerPx, setScaleType,
setColor, setMinScore, setMaxScore, setRenderingType, setSummaryScoreMode,
setAutoscale, isCacheValid

### Available via [ConfigOverrideMixin](../configoverridemixin)

**Properties:** configOverrides

**Methods:** getOverride, getConfWithOverride

**Actions:** setOverride, clearOverride

### LinearWiggleDisplay - Properties

#### property: type

```js
// type signature
ISimpleType<"LinearWiggleDisplay">
// code
type: types.literal('LinearWiggleDisplay')
```

#### property: configuration

```js
// type signature
ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

### LinearWiggleDisplay - Volatiles

#### volatile: featureUnderMouse

```js
// type signature
WiggleFeatureUnderMouse | undefined
// code
featureUnderMouse: undefined as WiggleFeatureUnderMouse | undefined
```

### LinearWiggleDisplay - Getters

#### getter: DisplayMessageComponent

```js
// type
LazyExoticComponent<({ model, }: { model: WiggleDisplayModel; }) => Element>
```

#### getter: color

```js
// type
string
```

#### getter: isDensityMode

```js
// type
boolean
```

#### getter: effectiveBicolorPivot

Sent to the worker as `bicolorPivot`. When the user picked a custom color we set
the pivot to -Infinity so `score >= pivot` is always true and every feature
lands in the worker's pos arrays — the display then paints that single bucket
with the user's chosen color. Default (`#f0f`) color keeps the configured pivot
for the standard pos/neg split.

```js
// type
number
```

#### getter: ticks

```js
// type
YScaleTicks | undefined
```

#### getter: renderState

```js
// type
WiggleGPURenderState | undefined
```

### LinearWiggleDisplay - Methods

#### method: rpcProps

```js
// type signature
rpcProps: () => {
  bicolorPivot: number
  resolution: number
}
```

#### method: gpuProps

single-source gpuProps mapped onto the multi-source build path:

- useBicolor (default color): no source override, multi build emits pos+neg
  arrays with their respective colors
- !useBicolor (custom solid color): worker put all features in pos arrays
  (effectiveBicolorPivot=-Infinity); whiskers and non-density modes want the
  user's solid color, density wants posColor (which is the multi build default
  already, so leave undefined)

```js
// type signature
gpuProps: () => {
  sources: {
    name: string
    color: string | undefined
  }
  ;[]
  posColor: string
  negColor: string
  summaryScoreMode: string
  isDensityMode: boolean
  renderingType: string
}
```

#### method: trackMenuItems

```js
// type signature
trackMenuItems: () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | { ...; })[]
```

### LinearWiggleDisplay - Actions

#### action: setRpcData

```js
// type signature
setRpcData: (displayedRegionIndex: number, data: WiggleDataResult) => void
```

#### action: setPosColor

```js
// type signature
setPosColor: (color?: string | undefined) => void
```

#### action: setNegColor

```js
// type signature
setNegColor: (color?: string | undefined) => void
```

#### action: setFeatureUnderMouse

```js
// type signature
setFeatureUnderMouse: (feat?: WiggleFeatureUnderMouse | undefined) => void
```

#### action: fetchNeeded

```js
// type signature
fetchNeeded: (needed: { region: Region; displayedRegionIndex: number; }[]) => Promise<void>
```

#### action: renderSvg

```js
// type signature
renderSvg: (opts?: ExportSvgDisplayOptions | undefined) => Promise<ReactElement<unknown, string | JSXElementConstructor<any>> | Iterable<...> | AwaitedReactNode>
```

#### action: startRenderingBackend

```js
// type signature
startRenderingBackend: (backend: WiggleRenderingBackend) => void
```
