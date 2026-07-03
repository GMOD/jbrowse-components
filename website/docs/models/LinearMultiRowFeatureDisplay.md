---
id: linearmultirowfeaturedisplay
title: LinearMultiRowFeatureDisplay
sidebar_label: Display -> LinearMultiRowFeatureDisplay
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/canvas/src/LinearMultiRowFeatureDisplay/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearMultiRowFeatureDisplay.md)

## Overview

Multi-row interval painter (chromosome / ancestry painting). Partitions a single
feature track into stacked rows by a feature attribute and paints each feature
as a colored block on its row. GPU-rendered (WebGL/Canvas2D fallback) via the
shared per-region lifecycle. Rows are a `sources` chain (discovered →
layout-reconciled → subtree-filtered) and the left sidebar (labels +
dendrogram + reorder) is the shared `TreeSidebarMixin`.

### LinearMultiRowFeatureDisplay - Configuration

The configuration slots for this model are documented on its
[config schema page](../../config/linearmultirowfeaturedisplay).

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

### Available via [TreeSidebarMixin](../treesidebarmixin)

**Properties:** [layout](../treesidebarmixin#property-layout),
[clusterTree](../treesidebarmixin#property-clustertree),
[treeAreaWidth](../treesidebarmixin#property-treeareawidth),
[subtreeFilter](../treesidebarmixin#property-subtreefilter)

**Volatiles:** [hoveredTreeNode](../treesidebarmixin#volatile-hoveredtreenode),
[treeCanvas](../treesidebarmixin#volatile-treecanvas),
[mouseoverCanvas](../treesidebarmixin#volatile-mouseovercanvas)

**Getters:** [parsedTree](../treesidebarmixin#getter-parsedtree),
[root](../treesidebarmixin#getter-root),
[treeHasBranchLengths](../treesidebarmixin#getter-treehasbranchlengths)

**Methods:** [willClearTree](../treesidebarmixin#method-willcleartree)

**Actions:** [setLayout](../treesidebarmixin#action-setlayout),
[clearLayout](../treesidebarmixin#action-clearlayout),
[setClusterTree](../treesidebarmixin#action-setclustertree),
[setLayoutAndClusterTree](../treesidebarmixin#action-setlayoutandclustertree),
[setTreeAreaWidth](../treesidebarmixin#action-settreeareawidth),
[setSubtreeFilter](../treesidebarmixin#action-setsubtreefilter),
[setHoveredTreeNode](../treesidebarmixin#action-sethoveredtreenode),
[setTreeCanvasRef](../treesidebarmixin#action-settreecanvasref),
[setMouseoverCanvasRef](../treesidebarmixin#action-setmouseovercanvasref)

<details open>
<summary>LinearMultiRowFeatureDisplay - Properties</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                     | Signature                                     |
| ------------------------------------------ | --------------------------------------------- |
| [`type`](#property-type)                   | `ISimpleType<"LinearMultiRowFeatureDisplay">` |
| [`configuration`](#property-configuration) | `ITypeUnion<any, any, any>`                   |

</details>

<details>
<summary>LinearMultiRowFeatureDisplay - Properties (all signatures)</summary>

#### property: type

```ts
// type signature
type type = ISimpleType<'LinearMultiRowFeatureDisplay'>
// code
type: types.literal('LinearMultiRowFeatureDisplay')
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
<summary>LinearMultiRowFeatureDisplay - Volatiles</summary>

#### volatile: hoveredFeature

The feature under the mouse (+ client coords for tooltip placement), or
undefined when not hovering a block.

```ts
// type signature
type hoveredFeature = HoveredFeature | undefined
// code
hoveredFeature: undefined as HoveredFeature | undefined
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                     | Signature                                          |
| ------------------------------------------ | -------------------------------------------------- |
| [`rpcDataMap`](#volatile-rpcdatamap)       | `ObservableMap<number, MultiRowGetFeaturesResult>` |
| [`prefersOffset`](#volatile-prefersoffset) | `true`                                             |

</details>

<details>
<summary>LinearMultiRowFeatureDisplay - Volatiles (all signatures)</summary>

#### volatile: rpcDataMap

```ts
// type signature
type rpcDataMap = ObservableMap<number, MultiRowGetFeaturesResult>
// code
rpcDataMap: observable.map<number, MultiRowRegionData>()
```

#### volatile: prefersOffset

```ts
// type signature
type prefersOffset = true
// code
prefersOffset: true
```

</details>

<details open>
<summary>LinearMultiRowFeatureDisplay - Getters</summary>

#### getter: conf

config typed off the concrete schema (ConfigurationReference erases it to any);
direct reads route through here to stay typed

```ts
type conf = ModelInstanceTypeProps<Record<string, any>> & { setSubschema(slotName: string, data: Record<string, unknown>): any; setSlot(slotName: string, value: unknown): void; } & IStateTreeNode<...>
```

#### getter: rowOrder

Optional explicit row order from config; values listed here are placed first,
remaining discovered values follow in sorted order.

```ts
type rowOrder = string[]
```

#### getter: colorConfig

Raw `color` slot (a CSS color or `jexl:` string), forwarded to the worker which
resolves it per feature.

```ts
type colorConfig = string
```

#### getter: sampleColorMap

Map of partition value → color, forwarded to the worker which applies it over
the per-feature `color`.

```ts
type sampleColorMap = Record<string, string>
```

#### getter: sourcesWithoutLayout

Rows discovered in the loaded data: the distinct partition values across all
loaded regions, ordered by the config `rowOrder` then sorted. The pre-layout,
pre-filter input to the arrangement dialog and to clustering.

```ts
type sourcesWithoutLayout = MultiRowSource[]
```

#### getter: editableSources

Discovered rows with the user's arrangement (reorder/relabel) applied — what the
arrangement dialog edits. Not subtree-filtered.

```ts
type editableSources = MultiRowSource[]
```

#### getter: sources

The display rows: `editableSources` narrowed by the active subtree filter.
Render order, label order, and `rowIndexByValue` all key off this, so
reordering/filtering flows through to the painting.

```ts
type sources = MultiRowSource[]
```

#### getter: rowColorsByIndex

Per-row color (ABGR) by display row — the single per-row resolver (dialog
color > config `sampleColorMap` > palette-when-default). Applied at render time
over the worker-baked per-feature `color` slot, so any color change repaints
without a refetch.

```ts
type rowColorsByIndex = (number | undefined)[]
```

#### getter: nrow

Number of displayed rows (at least 1, so the auto-fit division is safe and the
canvas mounts before data arrives).

```ts
type nrow = number
```

#### getter: fitTargetHeight

The track height that auto-fit mode divides among rows: the `height` config slot
(its default, or a drag-resized value written to it).

```ts
type fitTargetHeight = number
```

#### getter: rowHeightSetting

Resolved fixed row-height setting: `0` is auto-fit, any positive value is a
pinned px height. Drag-resize / fit-toggle write it via `setSlot`.

```ts
type rowHeightSetting = number
```

#### getter: rowHeight

Resolved per-row height. `rowHeightSetting === 0` auto-fits: the display height
split evenly across rows so all rows stay visible as the row count grows. Any
positive value is a pinned px height. Every consumer reads this, never
`rowHeightSetting`.

```ts
type rowHeight = number
```

#### getter: height

Override BaseLinearDisplay.height so the track container matches the rendering
canvas (numRows × rowHeight). In auto-fit mode this resolves to
`fitTargetHeight`; in fixed mode it grows with the row count.

```ts
type height = number
```

#### getter: hierarchy

Positioned dendrogram (when a cluster tree exists and rows are loaded). Leaves
spaced over `height`, branches over `treeAreaWidth`.

```ts
type hierarchy = PositionedHierarchyNode<NewickNode> | undefined
```

#### getter: sidebarOffset

Pixel width reserved on the left for the tree (0 when no tree shows).

```ts
type sidebarOffset = number
```

#### getter: renderState

Render state passed to the GPU/Canvas2D backend each frame.

```ts
type renderState = MultiRowRenderState | undefined
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                         | Signature                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| [`showTree`](#getter-showtree)                 | `boolean`                                                          |
| [`showBranchLength`](#getter-showbranchlength) | `boolean`                                                          |
| [`partitionField`](#getter-partitionfield)     | `string`                                                           |
| [`rowProportion`](#getter-rowproportion)       | `number`                                                           |
| [`rowIndexByValue`](#getter-rowindexbyvalue)   | `Map<string, number>`                                              |
| [`spatialIndex`](#getter-spatialindex)         | `{ index: Flatbush; nodes: ClusterHierarchyNode[]; } \| undefined` |

</details>

<details>
<summary>LinearMultiRowFeatureDisplay - Getters (all signatures)</summary>

#### getter: showTree

```ts
type showTree = boolean
```

#### getter: showBranchLength

```ts
type showBranchLength = boolean
```

#### getter: partitionField

```ts
type partitionField = string
```

#### getter: rowProportion

```ts
type rowProportion = number
```

#### getter: rowIndexByValue

```ts
type rowIndexByValue = Map<string, number>
```

#### getter: spatialIndex

```ts
type spatialIndex =
  { index: Flatbush; nodes: ClusterHierarchyNode[] } | undefined
```

</details>

<details open>
<summary>LinearMultiRowFeatureDisplay - Methods</summary>

#### method: rpcProps

Fetch-input cache keys (tier-1, via SettingsInvalidate → refetch). Color is
resolved in the worker, so the raw color slot is a key.

```ts
type rpcProps = () => { partitionField: string; colorConfig: string }
```

#### method: featureAt

Hit-test the feature under a canvas-relative pixel: row from
`mouseY / rowHeight`, genomic bp from the view, then the first feature on that
row whose `[start,end)` covers the bp. Returns undefined over the sidebar,
off-row, out-of-bounds, or over a gap.

```ts
type featureAt = (mouseX: number, mouseY: number) => MultiRowHit | undefined
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                     | Signature          |
| ------------------------------------------ | ------------------ |
| [`trackMenuItems`](#method-trackmenuitems) | `() => MenuItem[]` |

</details>

<details>
<summary>LinearMultiRowFeatureDisplay - Methods (all signatures)</summary>

#### method: trackMenuItems

```ts
type trackMenuItems = () => MenuItem[]
```

</details>

<details open>
<summary>LinearMultiRowFeatureDisplay - Actions</summary>

#### action: selectFeatureById

Re-fetch the full clicked feature by id and open it in the feature details
widget. The painting ships only the slim render arrays, so the complete feature
is fetched on demand (GetCanvasFeatureDetails).

```ts
type selectFeatureById = (
  featureId: string,
  displayedRegionIndex: number,
) => void
```

#### action: setHeight

Set the track height. In auto-fit mode the rows restretch to it; in fixed mode
it's distributed across the current rows as a pinned row height.

```ts
type setHeight = (newHeight: number) => number
```

#### action: resizeHeight

Drag-resize. Defers to `setHeight`, which restretches rows in auto-fit mode and
re-pins the row height in fixed mode.

```ts
type resizeHeight = (distance: number) => number
```

#### action: setFitToHeight

Switch to auto-fit: seed the `height` config slot from the current content
height (so toggling on doesn't jump), then `rowHeight = 0` makes `rowHeight`
derive from it.

```ts
type setFitToHeight = () => void
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                         | Signature                                                                        |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [`setRowHeight`](#action-setrowheight)                         | `(n: number) => void`                                                            |
| [`setShowTree`](#action-setshowtree)                           | `(f: boolean) => void`                                                           |
| [`setShowBranchLength`](#action-setshowbranchlength)           | `(f: boolean) => void`                                                           |
| [`setHoveredFeature`](#action-sethoveredfeature)               | `(arg?: HoveredFeature \| undefined) => void`                                    |
| [`setRpcData`](#action-setrpcdata)                             | `(regionIndex: number, data: MultiRowGetFeaturesResult) => void`                 |
| [`clearDisplaySpecificData`](#action-cleardisplayspecificdata) | `() => void`                                                                     |
| [`startRenderingBackend`](#action-startrenderingbackend)       | `(backend: MultiRowRenderingBackend) => void`                                    |
| [`fetchNeeded`](#action-fetchneeded)                           | `(needed: { region: Region; displayedRegionIndex: number; }[]) => Promise<void>` |
| [`renderSvg`](#action-rendersvg)                               | `(opts: ExportSvgDisplayOptions) => Promise<ReactNode>`                          |

</details>

<details>
<summary>LinearMultiRowFeatureDisplay - Actions (all signatures)</summary>

#### action: setRowHeight

```ts
type setRowHeight = (n: number) => void
```

#### action: setShowTree

```ts
type setShowTree = (f: boolean) => void
```

#### action: setShowBranchLength

```ts
type setShowBranchLength = (f: boolean) => void
```

#### action: setHoveredFeature

```ts
type setHoveredFeature = (arg?: HoveredFeature | undefined) => void
```

#### action: setRpcData

```ts
type setRpcData = (regionIndex: number, data: MultiRowGetFeaturesResult) => void
```

#### action: clearDisplaySpecificData

```ts
type clearDisplaySpecificData = () => void
```

#### action: startRenderingBackend

```ts
type startRenderingBackend = (backend: MultiRowRenderingBackend) => void
```

#### action: fetchNeeded

```ts
type fetchNeeded = (
  needed: { region: Region; displayedRegionIndex: number }[],
) => Promise<void>
```

#### action: renderSvg

```ts
type renderSvg = (opts: ExportSvgDisplayOptions) => Promise<ReactNode>
```

</details>
