---
id: circularview
title: CircularView
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[plugins/circular-view/src/CircularView/models/model.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/circular-view/src/CircularView/models/model.ts)

extends

- [BaseViewModel](../baseviewmodel)

### CircularView - Properties

#### property: type

```js
// type signature
ISimpleType<"CircularView">
// code
type: types.literal('CircularView')
```

#### property: offsetRadians

similar to offsetPx in linear genome view

```js
// type signature
number
// code
offsetRadians: -Math.PI / 2
```

#### property: bpPerPx

```js
// type signature
number
// code
bpPerPx: 200
```

#### property: tracks

```js
// type signature
IArrayType<IAnyType>
// code
tracks: types.array(
          pluginManager.pluggableMstType('track', 'stateModel'),
        )
```

#### property: hideVerticalResizeHandle

```js
// type signature
false
// code
hideVerticalResizeHandle: false
```

#### property: hideTrackSelectorButton

```js
// type signature
false
// code
hideTrackSelectorButton: false
```

#### property: lockedFitToWindow

```js
// type signature
true
// code
lockedFitToWindow: true
```

#### property: disableImportForm

```js
// type signature
false
// code
disableImportForm: false
```

#### property: height

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
height: types.optional(
          types.refinement('trackHeight', types.number, n => n >= minHeight),
          defaultHeight,
        )
```

#### property: displayedRegions

```js
// type signature
IArrayType<IModelType<{ refName: ISimpleType<string>; start: ISimpleType<number>; end: ISimpleType<number>; reversed: IOptionalIType<ISimpleType<boolean>, [...]>; } & { ...; }, { ...; }, _NotCustomized, _NotCustomized>>
// code
displayedRegions: types.array(Region)
```

#### property: scrollX

```js
// type signature
number
// code
scrollX: 0
```

#### property: scrollY

```js
// type signature
number
// code
scrollY: 0
```

#### property: minimumRadiusPx

```js
// type signature
number
// code
minimumRadiusPx: 25
```

#### property: spacingPx

```js
// type signature
number
// code
spacingPx: 10
```

#### property: paddingPx

```js
// type signature
number
// code
paddingPx: 80
```

#### property: lockedPaddingPx

```js
// type signature
number
// code
lockedPaddingPx: 100
```

#### property: minVisibleWidth

```js
// type signature
number
// code
minVisibleWidth: 6
```

#### property: minimumBlockWidth

```js
// type signature
number
// code
minimumBlockWidth: 20
```

#### property: trackSelectorType

```js
// type signature
string
// code
trackSelectorType: 'hierarchical'
```

### CircularView - Getters

#### getter: width

```js
// type
number
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

this is displayedRegions, post-processed to elide regions that are too small to
see reasonably

```js
// type
SliceRegion[]
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

#### getter: staticSlices

```js
// type
any[]
```

#### getter: visibleStaticSlices

```js
// type
any[]
```

### CircularView - Methods

#### method: menuItems

return the view menu items

```js
// type signature
menuItems: () => MenuItem[]
```

### CircularView - Actions

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
toggleTrack: (trackId: string) => boolean
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
addTrackConf: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: Record<string, unknown>): Record<string, unknown> | ({ [x: string]: any; } & NonEmptyObject & ... & IStateTreeNode<...>); } & IStateTreeNode<...>, initialSnapshot?: {}) => void
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

#### action: exportSvg

creates an svg export and save using FileSaver

```js
// type signature
exportSvg: (opts?: ExportSvgOptions) => Promise<void>
```
