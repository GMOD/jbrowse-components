---
id: dotplotview
title: DotplotView
toplevel: true
---

#### property: id

```js
id: ElementId
```

#### property: type

```js
type: types.literal('DotplotView')
```

#### property: height

```js
height: 600
```

#### property: borderSize

```js
borderSize: 20
```

#### property: tickSize

```js
tickSize: 5
```

#### property: vtextRotation

```js
vtextRotation: 0
```

#### property: htextRotation

```js
htextRotation: -90
```

#### property: fontSize

```js
fontSize: 15
```

#### property: trackSelectorType

```js
trackSelectorType: 'hierarchical'
```

#### property: assemblyNames

```js
assemblyNames: types.array(types.string)
```

#### property: drawCigar

```js
drawCigar: true
```

#### property: hview

```js
hview: types.optional(DotplotHView, {})
```

#### property: vview

```js
vview: types.optional(DotplotVView, {})
```

#### property: cursorMode

```js
cursorMode: 'crosshair'
```

#### property: tracks

```js
tracks: types.array(
          pm.pluggableMstType('track', 'stateModel') as BaseTrackStateModel,
        )
```

#### property: viewTrackConfigs

this represents tracks specific to this view specifically used
for read vs ref dotplots where this track would not really apply
elsewhere

```js
viewTrackConfigs: types.array(pm.pluggableConfigSchemaType('track'))
```

#### getter: width

```js
// Type
number
```

#### getter: assemblyErrors

```js
// Type
string
```

#### getter: assembliesInitialized

```js
// Type
boolean
```

#### getter: initialized

```js
// Type
boolean
```

#### getter: hticks

```js
// Type
any[]
```

#### getter: vticks

```js
// Type
any[]
```

#### getter: loading

```js
// Type
boolean
```

#### getter: viewWidth

```js
// Type
number
```

#### getter: viewHeight

```js
// Type
number
```

#### getter: views

```js
// Type
(({ id: string; displayedRegions: IMSTArray<IModelType<{ refName: ISimpleType<string>; start: ISimpleType<number>; end: ISimpleType<number>; reversed: IOptionalIType<...>; } & { ...; }, { ...; }, _NotCustomized, _NotCustomized>> & IStateTreeNode<...>; bpPerPx: number; offsetPx: number; interRegionPaddingWidth: numbe...
```

#### method: renderProps

```js
// Type signature
renderProps: () => any
```

#### action: setCursorMode

```js
// Type signature
setCursorMode: (str: string) => void
```

#### action: setDrawCigar

```js
// Type signature
setDrawCigar: (flag: boolean) => void
```

#### action: clearView

returns to the import form

```js
// Type signature
clearView: () => void
```

#### action: setBorderX

```js
// Type signature
setBorderX: (n: number) => void
```

#### action: setBorderY

```js
// Type signature
setBorderY: (n: number) => void
```

#### action: setWidth

```js
// Type signature
setWidth: (newWidth: number) => number
```

#### action: setHeight

```js
// Type signature
setHeight: (newHeight: number) => number
```

#### action: setError

```js
// Type signature
setError: (e: unknown) => void
```

#### action: closeView

removes the view itself from the state tree entirely by calling the parent removeView

```js
// Type signature
closeView: () => void
```

#### action: zoomOutButton

```js
// Type signature
zoomOutButton: () => void
```

#### action: zoomInButton

```js
// Type signature
zoomInButton: () => void
```

#### action: activateTrackSelector

```js
// Type signature
activateTrackSelector: () => any
```

#### action: showTrack

```js
// Type signature
showTrack: (trackId: string, initialSnapshot?: {}) => void
```

#### action: hideTrack

```js
// Type signature
hideTrack: (trackId: string) => number
```

#### action: toggleTrack

```js
// Type signature
toggleTrack: (trackId: string) => void
```

#### action: setAssemblyNames

```js
// Type signature
setAssemblyNames: (target: string, query: string) => void
```

#### action: setViews

```js
// Type signature
setViews: (arr: ModelCreationType<ExtractCFromProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayedRegions: IArrayType<IModelType<{ refName: ISimpleType<string>; start: ISimpleType<number>; end: ISimpleType<...>; reversed: IOptionalIType<...>; } & { ...; }, { ...; }, _NotCustomized, _NotCustomized>>; bpPerPx...
```

#### action: getCoords

```js
// Type signature
getCoords: (mousedown: Coord, mouseup: Coord) => { coord: number; index: number; refName: string; oob: boolean; assemblyName: string; offset: number; start: number; end: number; reversed: boolean; }[]
```

#### action: zoomIn

zooms into clicked and dragged region

```js
// Type signature
zoomIn: (mousedown: Coord, mouseup: Coord) => void
```

#### action: onDotplotView

creates a linear synteny view from the clicked and dragged region

```js
// Type signature
onDotplotView: (mousedown: Coord, mouseup: Coord) => void
```

#### action: squareView

```js
// Type signature
squareView: () => void
```

#### action: squareViewProportional

```js
// Type signature
squareViewProportional: () => void
```

#### method: menuItems

```js
// Type signature
menuItems: () => ({ label: string; onClick: () => void; icon?: undefined; } | { label: string; onClick: () => any; icon: any; })[]
```

#### getter: error

```js
// Type
unknown
```
