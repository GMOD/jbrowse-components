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

#### property: assemblyNames

```js
// type signature
IArrayType<ISimpleType<string>>
// code
assemblyNames: types.array(types.string)
```

#### property: borderSize

```js
// type signature
number
// code
borderSize: 20
```

#### property: drawCigar

```js
// type signature
true
// code
drawCigar: true
```

#### property: fontSize

```js
// type signature
number
// code
fontSize: 15
```

#### property: height

```js
// type signature
number
// code
height: 600
```

#### property: htextRotation

```js
// type signature
number
// code
htextRotation: -90
```

#### property: hview

```js
// type signature
IOptionalIType<IModelType<{ bpPerPx: IType<number, number, number>; displayedRegions: IArrayType<IModelType<{ end: ISimpleType<number>; refName: ISimpleType<string>; reversed: IOptionalIType<ISimpleType<boolean>, [...]>; start: ISimpleType<...>; } & { ...; }, { ...; }, _NotCustomized, _NotCustomized>>; id: IOptional...
// code
hview: types.optional(DotplotHView, {})
```

#### property: id

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: tickSize

```js
// type signature
number
// code
tickSize: 5
```

#### property: trackSelectorType

```js
// type signature
string
// code
trackSelectorType: 'hierarchical'
```

#### property: tracks

```js
// type signature
IArrayType<IModelType<{ configuration: AnyConfigurationSchemaType; displays: IArrayType<IAnyType>; id: IOptionalIType<ISimpleType<string>, [...]>; minimized: IType<...>; type: ISimpleType<...>; }, { ...; } & ... 1 more ... & { ...; }, _NotCustomized, _NotCustomized>>
// code
tracks: types.array(
          pm.pluggableMstType('track', 'stateModel') as BaseTrackStateModel,
        )
```

#### property: type

```js
// type signature
ISimpleType<"DotplotView">
// code
type: types.literal('DotplotView')
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

#### property: vtextRotation

```js
// type signature
number
// code
vtextRotation: 0
```

#### property: vview

```js
// type signature
IOptionalIType<IModelType<{ bpPerPx: IType<number, number, number>; displayedRegions: IArrayType<IModelType<{ end: ISimpleType<number>; refName: ISimpleType<string>; reversed: IOptionalIType<ISimpleType<boolean>, [...]>; start: ISimpleType<...>; } & { ...; }, { ...; }, _NotCustomized, _NotCustomized>>; id: IOptional...
// code
vview: types.optional(DotplotVView, {})
```

### DotplotView - Getters

#### getter: width

```js
// type
number
```

#### getter: assembliesInitialized

```js
// type
boolean
```

#### getter: assemblyErrors

```js
// type
string
```

#### getter: hticks

```js
// type
any[]
```

#### getter: initialized

```js
// type
boolean
```

#### getter: loading

```js
// type
boolean
```

#### getter: viewHeight

```js
// type
number
```

#### getter: viewWidth

```js
// type
number
```

#### getter: views

```js
// type
({ bpPerPx: number; displayedRegions: IMSTArray<IModelType<{ end: ISimpleType<number>; refName: ISimpleType<string>; reversed: IOptionalIType<ISimpleType<boolean>, [...]>; start: ISimpleType<...>; } & { ...; }, { ...; }, _NotCustomized, _NotCustomized>> & IStateTreeNode<...>; id: string; interRegionPaddingWidth: num...
```

#### getter: vticks

```js
// type
any[]
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
menuItems: () => ({ icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; label: string; onClick: () => void; } | { label: string; onClick: () => void; icon?: undefined; } | { ...; })[]
```

### DotplotView - Actions

#### action: activateTrackSelector

```js
// type signature
activateTrackSelector: () => Widget
```

#### action: clearView

returns to the import form

```js
// type signature
clearView: () => void
```

#### action: closeView

removes the view itself from the state tree entirely by calling the parent
removeView

```js
// type signature
closeView: () => void
```

#### action: getCoords

```js
// type signature
getCoords: (mousedown: Coord, mouseup: Coord) => { coord: number; index: number; refName: string; oob: boolean; assemblyName: string; offset: number; start: number; end: number; reversed: boolean; }[]
```

#### action: hideTrack

```js
// type signature
hideTrack: (trackId: string) => number
```

#### action: setBorderX

```js
// type signature
setBorderX: (n: number) => void
```

#### action: setAssemblyNames

```js
// type signature
setAssemblyNames: (target: string, query: string) => void
```

#### action: setBorderY

```js
// type signature
setBorderY: (n: number) => void
```

#### action: setCursorMode

```js
// type signature
setCursorMode: (str: string) => void
```

#### action: onDotplotView

creates a linear synteny view from the clicked and dragged region

```js
// type signature
onDotplotView: (mousedown: Coord, mouseup: Coord) => void
```

#### action: setShowPanButtons

```js
// type signature
setShowPanButtons: (flag: boolean) => void
```

#### action: setDrawCigar

```js
// type signature
setDrawCigar: (flag: boolean) => void
```

#### action: setWheelMode

```js
// type signature
setWheelMode: (str: string) => void
```

#### action: setError

```js
// type signature
setError: (e: unknown) => void
```

#### action: setHeight

```js
// type signature
setHeight: (newHeight: number) => number
```

#### action: setViews

```js
// type signature
setViews: (arr: ModelCreationType<ExtractCFromProps<{ bpPerPx: IType<number, number, number>; displayedRegions: IArrayType<IModelType<{ end: ISimpleType<number>; refName: ISimpleType<string>; reversed: IOptionalIType<ISimpleType<...>, [...]>; start: ISimpleType<...>; } & { ...; }, { ...; }, _NotCustomized, _NotCustomized>>; i...
```

#### action: setWidth

```js
// type signature
setWidth: (newWidth: number) => number
```

#### action: showAllRegions

```js
// type signature
showAllRegions: () => void
```

#### action: showTrack

```js
// type signature
showTrack: (trackId: string, initialSnapshot?: {}) => void
```

#### action: toggleTrack

```js
// type signature
toggleTrack: (trackId: string) => boolean
```

#### action: zoomIn

zooms into clicked and dragged region

```js
// type signature
zoomIn: (mousedown: Coord, mouseup: Coord) => void
```

#### action: zoomInButton

```js
// type signature
zoomInButton: () => void
```

#### action: zoomOutButton

```js
// type signature
zoomOutButton: () => void
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
