---
id: dotplotview
title: DotplotView
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[plugins/dotplot-view/src/DotplotView/model.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/dotplot-view/src/DotplotView/model.ts)

extends

- [BaseViewModel](../baseviewmodel)

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
number
// code
height: 600
```

#### property: borderSize

```js
// type signature
number
// code
borderSize: 20
```

#### property: tickSize

```js
// type signature
number
// code
tickSize: 5
```

#### property: vtextRotation

```js
// type signature
number
// code
vtextRotation: 0
```

#### property: htextRotation

```js
// type signature
number
// code
htextRotation: -90
```

#### property: fontSize

```js
// type signature
number
// code
fontSize: 15
```

#### property: trackSelectorType

```js
// type signature
string
// code
trackSelectorType: 'hierarchical'
```

#### property: assemblyNames

```js
// type signature
IArrayType<ISimpleType<string>>
// code
assemblyNames: types.array(types.string)
```

#### property: drawCigar

```js
// type signature
true
// code
drawCigar: true
```

#### property: hview

```js
// type signature
IOptionalIType<IModelType<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayedRegions: IOptionalIType<IType<Region[], Region[], Region[]>, [...]>; bpPerPx: IType<...>; offsetPx: IType<...>; interRegionPaddingWidth: IOptionalIType<...>; minimumBlockWidth: IOptionalIType<...>; }, { ...; } & ... 8 more ......
// code
hview: types.optional(DotplotHView, {})
```

#### property: vview

```js
// type signature
IOptionalIType<IModelType<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayedRegions: IOptionalIType<IType<Region[], Region[], Region[]>, [...]>; bpPerPx: IType<...>; offsetPx: IType<...>; interRegionPaddingWidth: IOptionalIType<...>; minimumBlockWidth: IOptionalIType<...>; }, { ...; } & ... 8 more ......
// code
vview: types.optional(DotplotVView, {})
```

#### property: tracks

```js
// type signature
IArrayType<IModelType<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; type: ISimpleType<string>; configuration: AnyConfigurationSchemaType; minimized: IType<...>; displays: IArrayType<...>; }, { ...; } & ... 1 more ... & { ...; }, _NotCustomized, _NotCustomized>>
// code
tracks: types.array(
          pm.pluggableMstType('track', 'stateModel') as BaseTrackStateModel,
        )
```

#### property: viewTrackConfigs

this represents tracks specific to this view specifically used for read vs ref
dotplots where this track would not really apply elsewhere

```js
// type signature
IArrayType<IAnyModelType>
// code
viewTrackConfigs: types.array(pm.pluggableConfigSchemaType('track'))
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
any[]
```

#### getter: vticks

```js
// type
any[]
```

#### getter: loading

```js
// type
boolean
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
menuItems: () => ({ label: string; onClick: () => void; icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; } | { label: string; onClick: () => void; icon?: undefined; } | { ...; })[]
```

### DotplotView - Actions

#### action: setShowPanButtons

```js
// type signature
setShowPanButtons: (flag: boolean) => void
```

#### action: setWheelMode

```js
// type signature
setWheelMode: (str: string) => void
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
showTrack: (trackId: string, initialSnapshot?: {}) => void
```

#### action: hideTrack

```js
// type signature
hideTrack: (trackId: string) => number
```

#### action: toggleTrack

```js
// type signature
toggleTrack: (trackId: string) => boolean
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
getCoords: (mousedown: Coord, mouseup: Coord) => { coord: number; index: number; refName: string; oob: boolean; assemblyName: string; offset: number; start: number; end: number; reversed?: boolean; }[]
```

#### action: zoomInToMouseCoords

zooms into clicked and dragged region

```js
// type signature
zoomInToMouseCoords: (mousedown: Coord, mouseup: Coord) => void
```

#### action: showAllRegions

```js
// type signature
showAllRegions: () => void
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
