---
id: circularview
title: CircularView
toplevel: true
---

extends `BaseViewModel`

### Properties

#### properties: type

```js
// type signature
ISimpleType<"CircularView">
// code
type: types.literal('CircularView')
```

#### properties: offsetRadians

similar to offsetPx in linear genome view

```js
// type signature
number
// code
offsetRadians: -Math.PI / 2
```

#### properties: bpPerPx

```js
// type signature
number
// code
bpPerPx: 2000000
```

#### properties: tracks

```js
// type signature
IArrayType<IAnyType>
// code
tracks: types.array(
          pluginManager.pluggableMstType('track', 'stateModel'),
        )
```

#### properties: hideVerticalResizeHandle

```js
// type signature
false
// code
hideVerticalResizeHandle: false
```

#### properties: hideTrackSelectorButton

```js
// type signature
false
// code
hideTrackSelectorButton: false
```

#### properties: lockedFitToWindow

```js
// type signature
true
// code
lockedFitToWindow: true
```

#### properties: disableImportForm

```js
// type signature
false
// code
disableImportForm: false
```

#### properties: height

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
height: types.optional(
          types.refinement('trackHeight', types.number, n => n >= minHeight),
          defaultHeight,
        )
```

#### properties: displayedRegions

```js
// type signature
IArrayType<IModelType<{ refName: ISimpleType<string>; start: ISimpleType<number>; end: ISimpleType<number>; reversed: IOptionalIType<ISimpleType<boolean>, [...]>; } & { ...; }, { ...; }, _NotCustomized, _NotCustomized>>
// code
displayedRegions: types.array(Region)
```

#### properties: scrollX

```js
// type signature
number
// code
scrollX: 0
```

#### properties: scrollY

```js
// type signature
number
// code
scrollY: 0
```

### Getters

#### getter: staticSlices

```js
// type
any[]
```

#### getter: visibleSection

```js
// type
{
  rho: [number, number]
  theta: [number, number]
}
```

#### getter: circumferencePx

```js
// type
number
```

#### getter: radiusPx

```js
// type
number
```

#### getter: bpPerRadian

```js
// type
number
```

#### getter: pxPerRadian

```js
// type
any
```

#### getter: centerXY

```js
// type
;[number, number]
```

#### getter: totalBp

```js
// type
number
```

#### getter: maximumRadiusPx

```js
// type
number
```

#### getter: maxBpPerPx

```js
// type
number
```

#### getter: minBpPerPx

```js
// type
number
```

#### getter: atMaxBpPerPx

```js
// type
boolean
```

#### getter: atMinBpPerPx

```js
// type
boolean
```

#### getter: tooSmallToLock

```js
// type
boolean
```

#### getter: figureDimensions

```js
// type
;[number, number]
```

#### getter: figureWidth

```js
// type
any
```

#### getter: figureHeight

```js
// type
any
```

#### getter: elidedRegions

this is displayedRegions, post-processed to
elide regions that are too small to see reasonably

```js
// type
any[]
```

#### getter: assemblyNames

```js
// type
string[]
```

#### getter: initialized

```js
// type
any
```

#### getter: visibleStaticSlices

```js
// type
any[]
```

### Actions

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

#### action: resizeHeight

```js
// type signature
resizeHeight: (distance: number) => number
```

#### action: resizeWidth

```js
// type signature
resizeWidth: (distance: number) => number
```

#### action: rotateClockwiseButton

```js
// type signature
rotateClockwiseButton: () => void
```

#### action: rotateCounterClockwiseButton

```js
// type signature
rotateCounterClockwiseButton: () => void
```

#### action: rotateClockwise

```js
// type signature
rotateClockwise: (distance?: number) => void
```

#### action: rotateCounterClockwise

```js
// type signature
rotateCounterClockwise: (distance?: number) => void
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

#### action: setBpPerPx

```js
// type signature
setBpPerPx: (newVal: number) => void
```

#### action: setModelViewWhenAdjust

```js
// type signature
setModelViewWhenAdjust: (secondCondition: boolean) => void
```

#### action: closeView

```js
// type signature
closeView: () => void
```

#### action: setDisplayedRegions

```js
// type signature
setDisplayedRegions: (regions: SnapshotOrInstance<IModelType<{ refName: ISimpleType<string>; start: ISimpleType<number>; end: ISimpleType<number>; reversed: IOptionalIType<ISimpleType<boolean>, [...]>; } & { ...; }, { ...; }, _NotCustomized, _NotCustomized>>[]) => void
```

#### action: activateTrackSelector

```js
// type signature
activateTrackSelector: () => Widget
```

#### action: toggleTrack

```js
// type signature
toggleTrack: (trackId: string) => void
```

#### action: setError

```js
// type signature
setError: (error: unknown) => void
```

#### action: showTrack

```js
// type signature
showTrack: (trackId: string, initialSnapshot?: {}) => void
```

#### action: addTrackConf

```js
// type signature
addTrackConf: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>, initialSnapshot?: {}) => void
```

#### action: hideTrack

```js
// type signature
hideTrack: (trackId: string) => number
```

#### action: toggleFitToWindowLock

```js
// type signature
toggleFitToWindowLock: () => boolean
```
