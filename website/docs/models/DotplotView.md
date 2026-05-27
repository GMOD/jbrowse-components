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

## Docs

extends

- [BaseViewModel](../baseviewmodel)

### DotplotView - Properties

#### propertie: id

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### propertie: type

```js
// type signature
ISimpleType<"DotplotView">
// code
type: types.literal('DotplotView')
```

#### propertie: height

```js
// type signature
number
// code
height: defaultHeight
```

#### propertie: borderSize

```js
// type signature
number
// code
borderSize: defaultBorderSize
```

#### propertie: tickSize

```js
// type signature
number
// code
tickSize: defaultTickSize
```

#### propertie: vtextRotation

```js
// type signature
number
// code
vtextRotation: 0
```

#### propertie: htextRotation

```js
// type signature
number
// code
htextRotation: defaultHtextRotation
```

#### propertie: fontSize

```js
// type signature
number
// code
fontSize: defaultFontSize
```

#### propertie: trackSelectorType

```js
// type signature
string
// code
trackSelectorType: 'hierarchical'
```

#### propertie: assemblyNames

```js
// type signature
IArrayType<ISimpleType<string>>
// code
assemblyNames: types.array(types.string)
```

#### propertie: drawCigar

```js
// type signature
true
// code
drawCigar: true
```

#### propertie: lockAspectRatio

When true, hview and vview are kept at the same bpPerPx so the dotplot stays
square. Wheel zoom already preserves the ratio; box-zoom and other independent
ops trigger an autorun resync.

```js
// type signature
false
// code
lockAspectRatio: false
```

#### propertie: lineWidth

Screen-space line width (CSS pixels) applied to every dotplot display in this
view. View-level because the GPU pass renders all displays with one uniform.

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
lineWidth: types.optional(types.number, defaultLineWidth)
```

#### propertie: hview

```js
// type signature
IOptionalIType<IModelType<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayedRegions: IOptionalIType<IType<Region[], Region[], Region[]>, [...]>; bpPerPx: IType<...>; offsetPx: IType<...>; interRegionPaddingWidth: IOptionalIType<...>; minimumBlockWidth: IOptionalIType<...>; }, { ...; } & ... 8 more ......
// code
hview: types.optional(DotplotHView, {})
```

#### propertie: vview

```js
// type signature
IOptionalIType<IModelType<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayedRegions: IOptionalIType<IType<Region[], Region[], Region[]>, [...]>; bpPerPx: IType<...>; offsetPx: IType<...>; interRegionPaddingWidth: IOptionalIType<...>; minimumBlockWidth: IOptionalIType<...>; }, { ...; } & ... 8 more ......
// code
vview: types.optional(DotplotVView, {})
```

#### propertie: tracks

```js
// type signature
IArrayType<IAnyType>
// code
tracks: types.array(pm.pluggableMstType('track', 'stateModel'))
```

#### propertie: viewTrackConfigs

this represents tracks specific to this view specifically used for read vs ref
dotplots where this track would not really apply elsewhere

```js
// type signature
IArrayType<IAnyModelType>
// code
viewTrackConfigs: types.array(pm.pluggableConfigSchemaType('track'))
```

#### propertie: init

used for initializing the view from a session snapshot

```js
// type signature
IType<DotplotViewInit | undefined, DotplotViewInit | undefined, DotplotViewInit | undefined>
// code
init: types.frozen<DotplotViewInit | undefined>()
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
'Loading' | undefined
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

#### getter: views

```js
// type
({ id: string; displayedRegions: Region[] & IStateTreeNode<IOptionalIType<IType<Region[], Region[], Region[]>, [undefined]>>; bpPerPx: number; offsetPx: number; interRegionPaddingWidth: number; minimumBlockWidth: number; } & ... 11 more ... & IStateTreeNode<...>)[]
```

#### getter: dotplotDisplays

DotplotDisplays under each track, indexed to match `tracks`.

```js
// type
({ id: string; type: "DotplotDisplay"; rpcDriverName: string | undefined; configuration: any; colorBy: string; alpha: number; minAlignmentLength: number; } & NonEmptyObject & ... 9 more ... & IStateTreeNode<...>)[]
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
renderProps: () => any
```

#### method: menuItems

```js
// type signature
menuItems: () => ({ label: string; icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; onClick: () => void; } | { label: string; onClick: () => void; icon: (props: SvgIconProps) => Element; })[]
```

### DotplotView - Actions

#### action: importFormRemoveRow

```js
// type signature
importFormRemoveRow: (idx: number) => void
```

#### action: clearImportFormSyntenyTracks

```js
// type signature
clearImportFormSyntenyTracks: () => void
```

#### action: setImportFormSyntenyTrack

```js
// type signature
setImportFormSyntenyTrack: (arg: number, val: ImportFormSyntenyTrack) => void
```

#### action: setCursorMode

```js
// type signature
setCursorMode: (str: string) => void
```

#### action: setDrawCigar

```js
// type signature
setDrawCigar: (flag: boolean) => void
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
showTrack: (trackId: string, initialSnapshot?: {}) => any
```

#### action: hideTrack

```js
// type signature
hideTrack: (trackId: string) => 1 | 0
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
setViews: (arr: ModelCreationType<ExtractCFromProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayedRegions: IOptionalIType<IType<Region[], Region[], Region[]>, [...]>; bpPerPx: IType<...>; offsetPx: IType<...>; interRegionPaddingWidth: IOptionalIType<...>; minimumBlockWidth: IOptionalIType<...>; }>>[]) => void
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
