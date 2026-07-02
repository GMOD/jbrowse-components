---
id: dotplotview
title: DotplotView
sidebar_label: View -> DotplotView
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/dotplot-view/src/DotplotView/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/DotplotView.md)

## Example usage

Hand-authored under `defaultSession.views`. `init.views` lists the two
assemblies on the axes and `tracks` the synteny track(s) to plot (self-vs-self
is allowed):

```js
{
  type: 'DotplotView',
  init: {
    views: [{ assembly: 'hg38' }, { assembly: 'mm10' }],
    tracks: ['hg38_vs_mm10.paf'],
    colorBy: 'query',
  },
}
```

Other `init` fields: `autoDiagonalize`, `minAlignmentLength`, and a per-axis
`loc` on each `views` entry — see the `init` property below.

## Overview

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [BaseViewModel](../baseviewmodel)

**Properties:** [id](../baseviewmodel#property-id),
[displayName](../baseviewmodel#property-displayname),
[minimized](../baseviewmodel#property-minimized)

**Volatiles:** [width](../baseviewmodel#volatile-width)

**Getters:** [menuItems](../baseviewmodel#getter-menuitems)

**Actions:** [setDisplayName](../baseviewmodel#action-setdisplayname),
[setWidth](../baseviewmodel#action-setwidth),
[setMinimized](../baseviewmodel#action-setminimized)

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

<details open>
<summary>DotplotView - Properties</summary>

#### property: lodMode

Level-of-detail tier override for PIF adapters. 'auto' uses the adapter's
bpPerPx threshold; 'fine'/'coarse' force a tier. Stored view-level so all
displays render at the same tier and the menu doesn't need to fan out per
display.

```ts
// type signature
type lodMode = IOptionalIType<
  ISimpleType<'auto' | 'fine' | 'coarse'>,
  [undefined]
>
// code
lodMode: types.stripDefault(
  types.enumeration('LodMode', ['auto', 'fine', 'coarse']),
  'auto',
)
```

#### property: lockAspectRatio

When true, hview and vview are kept at the same bpPerPx so the dotplot stays
square. Wheel zoom already preserves the ratio; box-zoom and other independent
ops trigger an autorun resync.

```ts
// type signature
type lockAspectRatio = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
lockAspectRatio: types.stripDefault(types.boolean, false)
```

#### property: lineWidth

Screen-space line width (CSS pixels) applied to every dotplot display in this
view. View-level because the GPU pass renders all displays with one uniform.

```ts
// type signature
type lineWidth = IOptionalIType<ISimpleType<number>, [undefined]>
// code
lineWidth: types.stripDefault(types.number, defaultLineWidth)
```

#### property: viewTrackConfigs

this represents tracks specific to this view specifically used for read vs ref
dotplots where this track would not really apply elsewhere

```ts
// type signature
type viewTrackConfigs = IOptionalIType<IArrayType<IAnyModelType>, [undefined]>
// code
viewTrackConfigs: types.stripDefault(
  types.array(pm.pluggableConfigSchemaType('track')),
  [],
)
```

#### property: init

used for initializing the view from a session snapshot

```ts
// type signature
type init = IType<
  DotplotViewInit | undefined,
  DotplotViewInit | undefined,
  DotplotViewInit | undefined
>
// code
init: types.frozen<DotplotViewInit | undefined>()
```

#### property: highlight

translucent highlight bands drawn per-axis: vertical when the region's assembly
matches hview, horizontal when it matches vview

```ts
// type signature
type highlight = IOptionalIType<
  IArrayType<IType<HighlightType, HighlightType, HighlightType>>,
  [undefined]
>
// code
highlight: types.stripDefault(types.array(types.frozen<HighlightType>()), [])
```

#### property: highlightsVisible

controls whether view.highlight entries are rendered

```ts
// type signature
type highlightsVisible = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
highlightsVisible: types.stripDefault(types.boolean, true)
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                             | Signature                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`id`](#property-id)                               | `IOptionalIType<ISimpleType<string>, [undefined]>`                                                                                                                                                                                                                                                                                 |
| [`type`](#property-type)                           | `ISimpleType<"DotplotView">`                                                                                                                                                                                                                                                                                                       |
| [`height`](#property-height)                       | `IOptionalIType<ISimpleType<number>, [undefined]>`                                                                                                                                                                                                                                                                                 |
| [`trackSelectorType`](#property-trackselectortype) | `IOptionalIType<ISimpleType<string>, [undefined]>`                                                                                                                                                                                                                                                                                 |
| [`assemblyNames`](#property-assemblynames)         | `IOptionalIType<IArrayType<ISimpleType<string>>, [undefined]>`                                                                                                                                                                                                                                                                     |
| [`drawCigar`](#property-drawcigar)                 | `IOptionalIType<ISimpleType<boolean>, [undefined]>`                                                                                                                                                                                                                                                                                |
| [`hview`](#property-hview)                         | `IOptionalIType<IModelType<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayedRegions: IOptionalIType<IType<Region[], Region[], Region[]>, [...]>; bpPerPx: IType<...>; offsetPx: IType<...>; minimumBlockWidth: IOptionalIType<...>; }, { ...; } & ... 8 more ... & { ...; }, _NotCustomized, _NotCustomized>, ...` |
| [`vview`](#property-vview)                         | `IOptionalIType<IModelType<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayedRegions: IOptionalIType<IType<Region[], Region[], Region[]>, [...]>; bpPerPx: IType<...>; offsetPx: IType<...>; minimumBlockWidth: IOptionalIType<...>; }, { ...; } & ... 8 more ... & { ...; }, _NotCustomized, _NotCustomized>, ...` |
| [`tracks`](#property-tracks)                       | `IArrayType<IAnyType>`                                                                                                                                                                                                                                                                                                             |

</details>

<details>
<summary>DotplotView - Properties (all signatures)</summary>

#### property: id

```ts
// type signature
type id = IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: type

```ts
// type signature
type type = ISimpleType<'DotplotView'>
// code
type: types.literal('DotplotView')
```

#### property: height

```ts
// type signature
type height = IOptionalIType<ISimpleType<number>, [undefined]>
// code
height: types.stripDefault(types.number, defaultHeight)
```

#### property: trackSelectorType

```ts
// type signature
type trackSelectorType = IOptionalIType<ISimpleType<string>, [undefined]>
// code
trackSelectorType: types.stripDefault(types.string, 'hierarchical')
```

#### property: assemblyNames

```ts
// type signature
type assemblyNames = IOptionalIType<
  IArrayType<ISimpleType<string>>,
  [undefined]
>
// code
assemblyNames: types.stripDefault(types.array(types.string), [])
```

#### property: drawCigar

```ts
// type signature
type drawCigar = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
drawCigar: types.stripDefault(types.boolean, true)
```

#### property: hview

```ts
// type signature
type hview = IOptionalIType<IModelType<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayedRegions: IOptionalIType<IType<Region[], Region[], Region[]>, [...]>; bpPerPx: IType<...>; offsetPx: IType<...>; minimumBlockWidth: IOptionalIType<...>; }, { ...; } & ... 8 more ... & { ...; }, _NotCustomized, _NotCustomized>, ...
// code
hview: types.optional(DotplotHView, {})
```

#### property: vview

```ts
// type signature
type vview = IOptionalIType<IModelType<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayedRegions: IOptionalIType<IType<Region[], Region[], Region[]>, [...]>; bpPerPx: IType<...>; offsetPx: IType<...>; minimumBlockWidth: IOptionalIType<...>; }, { ...; } & ... 8 more ... & { ...; }, _NotCustomized, _NotCustomized>, ...
// code
vview: types.optional(DotplotVView, {})
```

#### property: tracks

```ts
// type signature
type tracks = IArrayType<IAnyType>
// code
tracks: types.array(pm.pluggableMstType('track', 'stateModel'))
```

</details>

<details open>
<summary>DotplotView - Volatiles</summary>

#### volatile: cursorMode

these are 'personal preferences', stored in volatile and loaded/written to
localStorage

```ts
// type signature
type cursorMode = string
// code
cursorMode: localStorageGetItem(LS_CURSOR_MODE) === 'move'
  ? 'move'
  : 'crosshair'
```

#### volatile: awaitingAutoDiagonalize

True while the init autorun is waiting for the first dotplot RPC so it can run
the DiagonalizeDotplot pass. Used to gate showLoading on so the user sees a
spinner with "Reordering chromosomes…" instead of an undiagonalized plot that
immediately re-paints.

```ts
// type signature
type awaitingAutoDiagonalize = false
// code
awaitingAutoDiagonalize: false
```

#### volatile: diagonalizeStatus

Live status from the auto-diagonalize RPC (download %, parse, algorithm phase)
shown on the reordering spinner; undefined outside that wait.

```ts
// type signature
type diagonalizeStatus = RpcStatus | undefined
// code
diagonalizeStatus: undefined as RpcStatus | undefined
```

#### volatile: diagonalizeStopToken

Stop token for the in-flight auto-diagonalize, so the spinner's Cancel can abort
it; undefined when none is running.

```ts
// type signature
type diagonalizeStopToken = StopToken | undefined
// code
diagonalizeStopToken: undefined as StopToken | undefined
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                                           | Signature                                  |
| -------------------------------------------------------------------------------- | ------------------------------------------ |
| [`volatileWidth`](#volatile-volatilewidth)                                       | `number \| undefined`                      |
| [`volatileError`](#volatile-volatileerror)                                       | `unknown`                                  |
| [`borderX`](#volatile-borderx)                                                   | `number`                                   |
| [`borderY`](#volatile-bordery)                                                   | `number`                                   |
| [`importFormSyntenyTrackSelections`](#volatile-importformsyntenytrackselections) | `IObservableArray<ImportFormSyntenyTrack>` |

</details>

<details>
<summary>DotplotView - Volatiles (all signatures)</summary>

#### volatile: volatileWidth

```ts
// type signature
type volatileWidth = number | undefined
// code
volatileWidth: undefined as number | undefined
```

#### volatile: volatileError

```ts
// type signature
type volatileError = unknown
// code
volatileError: undefined as unknown
```

#### volatile: borderX

```ts
// type signature
type borderX = number
// code
borderX: 100
```

#### volatile: borderY

```ts
// type signature
type borderY = number
// code
borderY: 100
```

#### volatile: importFormSyntenyTrackSelections

```ts
// type signature
type importFormSyntenyTrackSelections = IObservableArray<ImportFormSyntenyTrack>
// code
importFormSyntenyTrackSelections: observable.array<ImportFormSyntenyTrack>()
```

</details>

<details open>
<summary>DotplotView - Getters</summary>

#### getter: showImportForm

Whether to show the import form

```ts
type showImportForm = boolean
```

#### getter: showLoading

Whether to show a loading indicator instead of the import form or view

```ts
type showLoading = boolean
```

#### getter: loadingMessage

Label for the generic loading spinner. The auto-diagonalize wait is a separate
render branch (DiagonalizeLoadingScreen), so this only covers the plain "view
not ready" case.

```ts
type loadingMessage = 'Loading' | undefined
```

#### getter: dotplotDisplays

DotplotDisplays under each track, indexed to match `tracks`.

```ts
type dotplotDisplays = (ModelInstanceTypeProps<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; type: ISimpleType<string>; rpcDriverName: IMaybe<ISimpleType<string>>; }, { ...; }>> & ... 10 more ... & IStateTreeNode<...>)[]
```

#### getter: settled

Canvas has painted and no display is still fetching, so what's on screen is the
final settled content. Drives the `dotplot_webgl_canvas_done` test-id that
screenshot capture and the browser-test suites wait on — so it must mean "done",
not just "first paint".

```ts
type settled = boolean
```

#### getter: hasLodCapableAdapter

True if any track has an adapter that declares the 'lod' capability. Used to
gate the LOD menu — only PIF supports it.

```ts
type hasLodCapableAdapter = boolean
```

#### getter: geometryByTrackIndex

Per-display GPU geometry keyed by track index. The upload autorun diffs this
map: new entries upload, vanished entries evict.

```ts
type geometryByTrackIndex = Map<number, DotplotGeometryData>
```

#### getter: dotplotRenderState

Aggregated per-frame render state. Built by walking each display that has
uploaded geometry; returns undefined when none do, which gates the render pass.

```ts
type dotplotRenderState =
  | {
      viewBpH: number
      viewBpV: number
      bpPerPxHInv: number
      bpPerPxVInv: number
      lineWidth: number
      displayKeys: number[]
    }
  | undefined
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                   | Signature                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`width`](#getter-width)                                 | `number`                                                                                                                                                                                                                                                                                         |
| [`assemblyErrors`](#getter-assemblyerrors)               | `string`                                                                                                                                                                                                                                                                                         |
| [`assembliesInitialized`](#getter-assembliesinitialized) | `boolean`                                                                                                                                                                                                                                                                                        |
| [`initialized`](#getter-initialized)                     | `boolean`                                                                                                                                                                                                                                                                                        |
| [`hticks`](#getter-hticks)                               | `Tick[]`                                                                                                                                                                                                                                                                                         |
| [`vticks`](#getter-vticks)                               | `Tick[]`                                                                                                                                                                                                                                                                                         |
| [`hTickPositions`](#getter-htickpositions)               | `PositionedTick[]`                                                                                                                                                                                                                                                                               |
| [`vTickPositions`](#getter-vtickpositions)               | `PositionedTick[]`                                                                                                                                                                                                                                                                               |
| [`hasSomethingToShow`](#getter-hassomethingtoshow)       | `boolean`                                                                                                                                                                                                                                                                                        |
| [`viewWidth`](#getter-viewwidth)                         | `number`                                                                                                                                                                                                                                                                                         |
| [`viewHeight`](#getter-viewheight)                       | `number`                                                                                                                                                                                                                                                                                         |
| [`hblockLabelKeysToHide`](#getter-hblocklabelkeystohide) | `Set<string>`                                                                                                                                                                                                                                                                                    |
| [`vblockLabelKeysToHide`](#getter-vblocklabelkeystohide) | `Set<string>`                                                                                                                                                                                                                                                                                    |
| [`views`](#getter-views)                                 | `(ModelInstanceTypeProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayedRegions: IOptionalIType<IType<Region[], Region[], Region[]>, [...]>; bpPerPx: IType<...>; offsetPx: IType<...>; minimumBlockWidth: IOptionalIType<...>; }> & ... 10 more ... & IStateTreeNode<...>)[]` |
| [`error`](#getter-error)                                 | `unknown`                                                                                                                                                                                                                                                                                        |

</details>

<details>
<summary>DotplotView - Getters (all signatures)</summary>

#### getter: width

```ts
type width = number
```

#### getter: assemblyErrors

```ts
type assemblyErrors = string
```

#### getter: assembliesInitialized

```ts
type assembliesInitialized = boolean
```

#### getter: initialized

```ts
type initialized = boolean
```

#### getter: hticks

```ts
type hticks = Tick[]
```

#### getter: vticks

```ts
type vticks = Tick[]
```

#### getter: hTickPositions

```ts
type hTickPositions = PositionedTick[]
```

#### getter: vTickPositions

```ts
type vTickPositions = PositionedTick[]
```

#### getter: hasSomethingToShow

```ts
type hasSomethingToShow = boolean
```

#### getter: viewWidth

```ts
type viewWidth = number
```

#### getter: viewHeight

```ts
type viewHeight = number
```

#### getter: hblockLabelKeysToHide

```ts
type hblockLabelKeysToHide = Set<string>
```

#### getter: vblockLabelKeysToHide

```ts
type vblockLabelKeysToHide = Set<string>
```

#### getter: views

```ts
type views = (ModelInstanceTypeProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayedRegions: IOptionalIType<IType<Region[], Region[], Region[]>, [...]>; bpPerPx: IType<...>; offsetPx: IType<...>; minimumBlockWidth: IOptionalIType<...>; }> & ... 10 more ... & IStateTreeNode<...>)[]
```

#### getter: error

```ts
type error = unknown
```

</details>

<details open>
<summary>DotplotView - Methods</summary>

#### method: getHHighlightCoords

Map a highlight/bookmark region to {left, width} px on the horizontal axis. left
is already screen-offset. Returns undefined when the region isn't on hview's
assembly/displayed regions.

```ts
type getHHighlightCoords = (region: {
  assemblyName?: string | undefined
  refName: string
  start: number
  end: number
}) => { width: number; left: number } | undefined
```

#### method: getVHighlightCoords

Map a highlight/bookmark region to {top, height} px on the vertical axis. The
vview lays out bottom-to-top, so the band is y-flipped into screen space.
Returns undefined when the region isn't on vview.

```ts
type getVHighlightCoords = (region: {
  assemblyName?: string | undefined
  refName: string
  start: number
  end: number
}) => { top: number; height: number } | undefined
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                               | Signature                                                                                                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`renderProps`](#method-renderprops) | `() => { drawCigar: boolean; }`                                                                                                                                                |
| [`menuItems`](#method-menuitems)     | `() => ({ label: string; icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; onClick: () => void; subMenu?: undefined; } \| { ...; } \| { ...; })[]` |

</details>

<details>
<summary>DotplotView - Methods (all signatures)</summary>

#### method: renderProps

```ts
type renderProps = () => { drawCigar: boolean }
```

#### method: menuItems

```ts
type menuItems = () => ({ label: string; icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; onClick: () => void; subMenu?: undefined; } | { ...; } | { ...; })[]
```

</details>

<details open>
<summary>DotplotView - Actions</summary>

#### action: syncBpPerPx

Equalize hview/vview bpPerPx without recentering. Used by the aspect-lock
autorun to absorb divergence from box-zoom and similar operations while
preserving the user's current pan position.

```ts
type syncBpPerPx = () => void
```

#### action: clearView

returns to the import form

```ts
type clearView = () => void
```

#### action: cancelAutoDiagonalize

Abort an in-flight auto-diagonalize; the runner's finally clears the wait flag,
revealing the (undiagonalized) plot.

```ts
type cancelAutoDiagonalize = () => void
```

#### action: zoomInToMouseCoords

zooms into clicked and dragged region

```ts
type zoomInToMouseCoords = (mousedown: Coord, mouseup: Coord) => void
```

#### action: calculateBorders

Calculate borders synchronously for a given zoom level

```ts
type calculateBorders = () => { borderX: number; borderY: number }
```

#### action: onDotplotView

creates a linear synteny view from the clicked and dragged region

```ts
type onDotplotView = (mousedown: Coord, mouseup: Coord) => void
```

#### action: exportSvg

creates an svg export and save using FileSaver

```ts
type exportSvg = (opts?: ExportSvgOptions) => Promise<void>
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                             | Signature                                                           |
| ------------------------------------------------------------------ | ------------------------------------------------------------------- |
| [`setImportFormSyntenyTrack`](#action-setimportformsyntenytrack)   | `(arg: number, val: ImportFormSyntenyTrack) => void`                |
| [`startRenderingBackend`](#action-startrenderingbackend)           | `(backend: DotplotRenderingBackend) => void`                        |
| [`setCursorMode`](#action-setcursormode)                           | `(mode: CursorMode) => void`                                        |
| [`setDrawCigar`](#action-setdrawcigar)                             | `(flag: boolean) => void`                                           |
| [`setLodMode`](#action-setlodmode)                                 | `(value: "auto" \| "fine" \| "coarse") => void`                     |
| [`setLockAspectRatio`](#action-setlockaspectratio)                 | `(flag: boolean) => void`                                           |
| [`setLineWidth`](#action-setlinewidth)                             | `(value: number) => void`                                           |
| [`addToHighlights`](#action-addtohighlights)                       | `(highlight: HighlightType) => void`                                |
| [`setHighlight`](#action-sethighlight)                             | `(highlight?: HighlightType[] \| undefined) => void`                |
| [`removeHighlight`](#action-removehighlight)                       | `(highlight: HighlightType) => void`                                |
| [`setHighlightsVisible`](#action-sethighlightsvisible)             | `(arg: boolean) => void`                                            |
| [`setBorderX`](#action-setborderx)                                 | `(n: number) => void`                                               |
| [`setBorderY`](#action-setbordery)                                 | `(n: number) => void`                                               |
| [`setWidth`](#action-setwidth)                                     | `(newWidth: number) => number`                                      |
| [`setHeight`](#action-setheight)                                   | `(newHeight: number) => number`                                     |
| [`setError`](#action-seterror)                                     | `(e: unknown) => void`                                              |
| [`setInit`](#action-setinit)                                       | `(init?: DotplotViewInit \| undefined) => void`                     |
| [`setAwaitingAutoDiagonalize`](#action-setawaitingautodiagonalize) | `(arg: boolean) => void`                                            |
| [`setDiagonalizeStatus`](#action-setdiagonalizestatus)             | `(arg?: RpcStatus \| undefined) => void`                            |
| [`setDiagonalizeStopToken`](#action-setdiagonalizestoptoken)       | `(arg?: StopToken \| undefined) => void`                            |
| [`zoomOut`](#action-zoomout)                                       | `() => void`                                                        |
| [`zoomIn`](#action-zoomin)                                         | `() => void`                                                        |
| [`activateTrackSelector`](#action-activatetrackselector)           | `() => Widget`                                                      |
| [`showTrack`](#action-showtrack)                                   | `(trackId: string, initialSnapshot?: any) => any`                   |
| [`hideTrack`](#action-hidetrack)                                   | `(trackId: string) => boolean`                                      |
| [`toggleTrack`](#action-toggletrack)                               | `(trackId: string) => void`                                         |
| [`setAssemblyNames`](#action-setassemblynames)                     | `(target: string, query: string) => void`                           |
| [`getCoords`](#action-getcoords)                                   | `(mousedown: Coord, mouseup: Coord) => PxToBpResult[] \| undefined` |
| [`showAllRegions`](#action-showallregions)                         | `() => void`                                                        |
| [`initializeDisplayedRegions`](#action-initializedisplayedregions) | `() => void`                                                        |
| [`applySquare`](#action-applysquare)                               | `(ratio: number) => void`                                           |
| [`squareView`](#action-squareview)                                 | `() => void`                                                        |
| [`squareViewProportional`](#action-squareviewproportional)         | `() => void`                                                        |

</details>

<details>
<summary>DotplotView - Actions (all signatures)</summary>

#### action: setImportFormSyntenyTrack

```ts
type setImportFormSyntenyTrack = (
  arg: number,
  val: ImportFormSyntenyTrack,
) => void
```

#### action: startRenderingBackend

```ts
type startRenderingBackend = (backend: DotplotRenderingBackend) => void
```

#### action: setCursorMode

```ts
type setCursorMode = (mode: CursorMode) => void
```

#### action: setDrawCigar

```ts
type setDrawCigar = (flag: boolean) => void
```

#### action: setLodMode

```ts
type setLodMode = (value: 'auto' | 'fine' | 'coarse') => void
```

#### action: setLockAspectRatio

```ts
type setLockAspectRatio = (flag: boolean) => void
```

#### action: setLineWidth

```ts
type setLineWidth = (value: number) => void
```

#### action: addToHighlights

```ts
type addToHighlights = (highlight: HighlightType) => void
```

#### action: setHighlight

```ts
type setHighlight = (highlight?: HighlightType[] | undefined) => void
```

#### action: removeHighlight

```ts
type removeHighlight = (highlight: HighlightType) => void
```

#### action: setHighlightsVisible

```ts
type setHighlightsVisible = (arg: boolean) => void
```

#### action: setBorderX

```ts
type setBorderX = (n: number) => void
```

#### action: setBorderY

```ts
type setBorderY = (n: number) => void
```

#### action: setWidth

```ts
type setWidth = (newWidth: number) => number
```

#### action: setHeight

```ts
type setHeight = (newHeight: number) => number
```

#### action: setError

```ts
type setError = (e: unknown) => void
```

#### action: setInit

```ts
type setInit = (init?: DotplotViewInit | undefined) => void
```

#### action: setAwaitingAutoDiagonalize

```ts
type setAwaitingAutoDiagonalize = (arg: boolean) => void
```

#### action: setDiagonalizeStatus

```ts
type setDiagonalizeStatus = (arg?: RpcStatus | undefined) => void
```

#### action: setDiagonalizeStopToken

```ts
type setDiagonalizeStopToken = (arg?: StopToken | undefined) => void
```

#### action: zoomOut

```ts
type zoomOut = () => void
```

#### action: zoomIn

```ts
type zoomIn = () => void
```

#### action: activateTrackSelector

```ts
type activateTrackSelector = () => Widget
```

#### action: showTrack

```ts
type showTrack = (trackId: string, initialSnapshot?: any) => any
```

#### action: hideTrack

```ts
type hideTrack = (trackId: string) => boolean
```

#### action: toggleTrack

```ts
type toggleTrack = (trackId: string) => void
```

#### action: setAssemblyNames

```ts
type setAssemblyNames = (target: string, query: string) => void
```

#### action: getCoords

```ts
type getCoords = (
  mousedown: Coord,
  mouseup: Coord,
) => PxToBpResult[] | undefined
```

#### action: showAllRegions

```ts
type showAllRegions = () => void
```

#### action: initializeDisplayedRegions

```ts
type initializeDisplayedRegions = () => void
```

#### action: applySquare

```ts
type applySquare = (ratio: number) => void
```

#### action: squareView

```ts
type squareView = () => void
```

#### action: squareViewProportional

```ts
type squareViewProportional = () => void
```

</details>
