---
id: dotplotview
title: DotplotView
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
  },
}
```

## Overview

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [BaseViewModel](../baseviewmodel)

**Properties:** id, displayName, minimized

**Volatiles:** width

**Getters:** menuItems

**Actions:** setDisplayName, setWidth, setMinimized

### Available via [RenderLifecycleMixin](../renderlifecyclemixin)

**Volatiles:** canvasDrawn, currentRenderingBackend, renderTick,
autorunsInstalled, renderError

**Actions:** markCanvasDrawn, resetCanvasDrawn, stopRenderingBackend, renderNow,
setRenderError, attachRenderingBackend

### DotplotView - Properties

#### property: id

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: type

```js
// type signature
ISimpleType<"DotplotView">
// code
type: types.literal('DotplotView')
```

#### property: height

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
height: types.stripDefault(types.number, defaultHeight)
```

#### property: borderSize

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
borderSize: types.stripDefault(types.number, defaultBorderSize)
```

#### property: tickSize

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
tickSize: types.stripDefault(types.number, defaultTickSize)
```

#### property: vtextRotation

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
vtextRotation: types.stripDefault(types.number, 0)
```

#### property: htextRotation

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
htextRotation: types.stripDefault(types.number, defaultHtextRotation)
```

#### property: fontSize

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
fontSize: types.stripDefault(types.number, defaultFontSize)
```

#### property: trackSelectorType

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
trackSelectorType: types.stripDefault(types.string, 'hierarchical')
```

#### property: assemblyNames

```js
// type signature
IOptionalIType<IArrayType<ISimpleType<string>>, [undefined]>
// code
assemblyNames: types.stripDefault(types.array(types.string), [])
```

#### property: drawCigar

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
drawCigar: types.stripDefault(types.boolean, true)
```

#### property: lodMode

Level-of-detail tier override for PIF adapters. 'auto' uses the adapter's
bpPerPx threshold; 'fine'/'coarse' force a tier. Stored view-level so all
displays render at the same tier and the menu doesn't need to fan out per
display.

```js
// type signature
IOptionalIType<ISimpleType<"auto" | "fine" | "coarse">, [undefined]>
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

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
lockAspectRatio: types.stripDefault(types.boolean, false)
```

#### property: lineWidth

Screen-space line width (CSS pixels) applied to every dotplot display in this
view. View-level because the GPU pass renders all displays with one uniform.

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
lineWidth: types.stripDefault(types.number, defaultLineWidth)
```

#### property: hview

```js
// type signature
IOptionalIType<IModelType<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayedRegions: IOptionalIType<IType<Region[], Region[], Region[]>, [...]>; bpPerPx: IType<...>; offsetPx: IType<...>; minimumBlockWidth: IOptionalIType<...>; }, { ...; } & ... 8 more ... & { ...; }, _NotCustomized, _NotCustomized>, ...
// code
hview: types.optional(DotplotHView, {})
```

#### property: vview

```js
// type signature
IOptionalIType<IModelType<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayedRegions: IOptionalIType<IType<Region[], Region[], Region[]>, [...]>; bpPerPx: IType<...>; offsetPx: IType<...>; minimumBlockWidth: IOptionalIType<...>; }, { ...; } & ... 8 more ... & { ...; }, _NotCustomized, _NotCustomized>, ...
// code
vview: types.optional(DotplotVView, {})
```

#### property: tracks

```js
// type signature
IArrayType<IAnyType>
// code
tracks: types.array(pm.pluggableMstType('track', 'stateModel'))
```

#### property: viewTrackConfigs

this represents tracks specific to this view specifically used for read vs ref
dotplots where this track would not really apply elsewhere

```js
// type signature
IOptionalIType<IArrayType<IAnyModelType>, [undefined]>
// code
viewTrackConfigs: types.stripDefault(
            types.array(pm.pluggableConfigSchemaType('track')),
            [],
          )
```

#### property: init

used for initializing the view from a session snapshot

```js
// type signature
IType<DotplotViewInit | undefined, DotplotViewInit | undefined, DotplotViewInit | undefined>
// code
init: types.frozen<DotplotViewInit | undefined>()
```

#### property: highlight

translucent highlight bands drawn per-axis: vertical when the region's assembly
matches hview, horizontal when it matches vview

```js
// type signature
IOptionalIType<IArrayType<IType<HighlightType, HighlightType, HighlightType>>, [undefined]>
// code
highlight: types.stripDefault(
            types.array(types.frozen<HighlightType>()),
            [],
          )
```

#### property: highlightsVisible

controls whether view.highlight entries are rendered

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
highlightsVisible: types.stripDefault(types.boolean, true)
```

### DotplotView - Volatiles

#### volatile: volatileWidth

```js
// type signature
number | undefined
// code
volatileWidth: undefined as number | undefined
```

#### volatile: volatileError

```js
// type signature
unknown
// code
volatileError: undefined as unknown
```

#### volatile: cursorMode

these are 'personal preferences', stored in volatile and loaded/written to
localStorage

```js
// type signature
string
// code
cursorMode: localStorageGetItem(LS_CURSOR_MODE) === 'move'
  ? 'move'
  : 'crosshair'
```

#### volatile: borderX

```js
// type signature
number
// code
borderX: 100
```

#### volatile: borderY

```js
// type signature
number
// code
borderY: 100
```

#### volatile: importFormSyntenyTrackSelections

```js
// type signature
IObservableArray<ImportFormSyntenyTrack>
// code
importFormSyntenyTrackSelections:
          observable.array<ImportFormSyntenyTrack>()
```

#### volatile: awaitingAutoDiagonalize

True while the init autorun is waiting for the first dotplot RPC so it can run
the DiagonalizeDotplot pass. Used to gate showLoading on so the user sees a
spinner with "Reordering chromosomes…" instead of an undiagonalized plot that
immediately re-paints.

```js
// type signature
false
// code
awaitingAutoDiagonalize: false
```

### DotplotView - Getters

#### getter: width

```js
// type
number
```

#### getter: assemblyErrors

```js
// type
string
```

#### getter: assembliesInitialized

```js
// type
boolean
```

#### getter: initialized

```js
// type
boolean
```

#### getter: hticks

```js
// type
{
  type: string
  base: number
  index: number
  refName: string
}
;[]
```

#### getter: vticks

```js
// type
{
  type: string
  base: number
  index: number
  refName: string
}
;[]
```

#### getter: hTickPositions

```js
// type
PositionedTick[]
```

#### getter: vTickPositions

```js
// type
PositionedTick[]
```

#### getter: hasSomethingToShow

```js
// type
boolean
```

#### getter: showLoading

Whether to show a loading indicator instead of the import form or view

```js
// type
boolean
```

#### getter: showImportForm

Whether to show the import form

```js
// type
boolean
```

#### getter: loadingMessage

```js
// type
;'Loading' | 'Reordering chromosomes…' | undefined
```

#### getter: viewWidth

```js
// type
number
```

#### getter: viewHeight

```js
// type
number
```

#### getter: hblockLabelKeysToHide

```js
// type
Set<string>
```

#### getter: vblockLabelKeysToHide

```js
// type
Set<string>
```

#### getter: views

```js
// type
(ModelInstanceTypeProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayedRegions: IOptionalIType<IType<Region[], Region[], Region[]>, [...]>; bpPerPx: IType<...>; offsetPx: IType<...>; minimumBlockWidth: IOptionalIType<...>; }> & ... 10 more ... & IStateTreeNode<...>)[]
```

#### getter: dotplotDisplays

DotplotDisplays under each track, indexed to match `tracks`.

```js
// type
(ModelInstanceTypeProps<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; type: ISimpleType<string>; rpcDriverName: IMaybe<ISimpleType<string>>; }, { ...; }>> & ... 10 more ... & IStateTreeNode<...>)[]
```

#### getter: hasLodCapableAdapter

True if any track has an adapter that declares the 'lod' capability. Used to
gate the LOD menu — only PIF supports it.

```js
// type
boolean
```

#### getter: geometryByTrackIndex

Per-display GPU geometry keyed by track index. The upload autorun diffs this
map: new entries upload, vanished entries evict.

```js
// type
Map<number, DotplotGeometryData>
```

#### getter: dotplotRenderState

Aggregated per-frame render state. Built by walking each display that has
uploaded geometry; returns undefined when none do, which gates the render pass.

```js
// type
{ viewBpH: number; viewBpV: number; bpPerPxHInv: number; bpPerPxVInv: number; lineWidth: number; displayKeys: number[]; } | undefined
```

#### getter: error

```js
// type
unknown
```

### DotplotView - Methods

#### method: renderProps

```js
// type signature
renderProps: () => {
  drawCigar: boolean
  highResolutionScaling: any
}
```

#### method: getHHighlightCoords

Map a highlight/bookmark region to {left, width} px on the horizontal axis. left
is already screen-offset. Returns undefined when the region isn't on hview's
assembly/displayed regions.

```js
// type signature
getHHighlightCoords: (region: { assemblyName?: string | undefined; refName: string; start: number; end: number; }) => { width: number; left: number; } | undefined
```

#### method: getVHighlightCoords

Map a highlight/bookmark region to {top, height} px on the vertical axis. The
vview lays out bottom-to-top, so the band is y-flipped into screen space.
Returns undefined when the region isn't on vview.

```js
// type signature
getVHighlightCoords: (region: { assemblyName?: string | undefined; refName: string; start: number; end: number; }) => { top: number; height: number; } | undefined
```

#### method: menuItems

```js
// type signature
menuItems: () => ({ label: string; icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; onClick: () => void; subMenu?: undefined; } | { ...; } | { ...; })[]
```

### DotplotView - Actions

#### action: setImportFormSyntenyTrack

```js
// type signature
setImportFormSyntenyTrack: (arg: number, val: ImportFormSyntenyTrack) => void
```

#### action: startRenderingBackend

```js
// type signature
startRenderingBackend: (backend: DotplotRenderingBackend) => void
```

#### action: setCursorMode

```js
// type signature
setCursorMode: (mode: CursorMode) => void
```

#### action: setDrawCigar

```js
// type signature
setDrawCigar: (flag: boolean) => void
```

#### action: setLodMode

```js
// type signature
setLodMode: (value: "auto" | "fine" | "coarse") => void
```

#### action: setLockAspectRatio

```js
// type signature
setLockAspectRatio: (flag: boolean) => void
```

#### action: syncBpPerPx

Equalize hview/vview bpPerPx without recentering. Used by the aspect-lock
autorun to absorb divergence from box-zoom and similar operations while
preserving the user's current pan position.

```js
// type signature
syncBpPerPx: () => void
```

#### action: setLineWidth

```js
// type signature
setLineWidth: (value: number) => void
```

#### action: addToHighlights

```js
// type signature
addToHighlights: (highlight: HighlightType) => void
```

#### action: setHighlight

```js
// type signature
setHighlight: (highlight?: HighlightType[] | undefined) => void
```

#### action: removeHighlight

```js
// type signature
removeHighlight: (highlight: HighlightType) => void
```

#### action: setHighlightsVisible

```js
// type signature
setHighlightsVisible: (arg: boolean) => void
```

#### action: clearView

returns to the import form

```js
// type signature
clearView: () => void
```

#### action: setBorderX

```js
// type signature
setBorderX: (n: number) => void
```

#### action: setBorderY

```js
// type signature
setBorderY: (n: number) => void
```

#### action: setWidth

```js
// type signature
setWidth: (newWidth: number) => number
```

#### action: setHeight

```js
// type signature
setHeight: (newHeight: number) => number
```

#### action: setError

```js
// type signature
setError: (e: unknown) => void
```

#### action: setInit

```js
// type signature
setInit: (init?: DotplotViewInit | undefined) => void
```

#### action: setAwaitingAutoDiagonalize

```js
// type signature
setAwaitingAutoDiagonalize: (arg: boolean) => void
```

#### action: zoomOut

```js
// type signature
zoomOut: () => void
```

#### action: zoomIn

```js
// type signature
zoomIn: () => void
```

#### action: activateTrackSelector

```js
// type signature
activateTrackSelector: () => Widget
```

#### action: showTrack

```js
// type signature
showTrack: (trackId: string, initialSnapshot?: any) => any
```

#### action: hideTrack

```js
// type signature
hideTrack: (trackId: string) => boolean
```

#### action: toggleTrack

```js
// type signature
toggleTrack: (trackId: string) => void
```

#### action: setAssemblyNames

```js
// type signature
setAssemblyNames: (target: string, query: string) => void
```

#### action: setViews

```js
// type signature
setViews: (arr: ModelCreationType<ExtractCFromProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayedRegions: IOptionalIType<IType<Region[], Region[], Region[]>, [...]>; bpPerPx: IType<...>; offsetPx: IType<...>; minimumBlockWidth: IOptionalIType<...>; }>>[]) => void
```

#### action: getCoords

```js
// type signature
getCoords: (mousedown: Coord, mouseup: Coord) => { coord: number; index: number; refName: string; oob: boolean; assemblyName: string; offset: number; start: number; end: number; reversed?: boolean | undefined; }[] | undefined
```

#### action: zoomInToMouseCoords

zooms into clicked and dragged region

```js
// type signature
zoomInToMouseCoords: (mousedown: Coord, mouseup: Coord) => void
```

#### action: calculateBorders

Calculate borders synchronously for a given zoom level

```js
// type signature
calculateBorders: () => {
  borderX: number
  borderY: number
}
```

#### action: showAllRegions

```js
// type signature
showAllRegions: () => void
```

#### action: initializeDisplayedRegions

```js
// type signature
initializeDisplayedRegions: () => void
```

#### action: onDotplotView

creates a linear synteny view from the clicked and dragged region

```js
// type signature
onDotplotView: (mousedown: Coord, mouseup: Coord) => void
```

#### action: exportSvg

creates an svg export and save using FileSaver

```js
// type signature
exportSvg: (opts?: ExportSvgOptions) => Promise<void>
```

#### action: applySquare

```js
// type signature
applySquare: (ratio: number) => void
```

#### action: squareView

```js
// type signature
squareView: () => void
```

#### action: squareViewProportional

```js
// type signature
squareViewProportional: () => void
```
