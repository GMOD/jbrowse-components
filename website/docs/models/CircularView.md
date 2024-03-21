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

#### property: bpPerPx

```js
// type signature
number
// code
bpPerPx: 200
```

#### property: disableImportForm

```js
// type signature
false
// code
disableImportForm: false
```

#### property: displayedRegions

```js
// type signature
IArrayType<IModelType<{ end: ISimpleType<number>; refName: ISimpleType<string>; reversed: IOptionalIType<ISimpleType<boolean>, [undefined]>; start: ISimpleType<...>; } & { ...; }, { ...; }, _NotCustomized, _NotCustomized>>
// code
displayedRegions: types.array(Region)
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

#### property: hideTrackSelectorButton

```js
// type signature
false
// code
hideTrackSelectorButton: false
```

#### property: hideVerticalResizeHandle

```js
// type signature
false
// code
hideVerticalResizeHandle: false
```

#### property: lockedFitToWindow

```js
// type signature
true
// code
lockedFitToWindow: true
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

#### property: offsetRadians

similar to offsetPx in linear genome view

```js
// type signature
number
// code
offsetRadians: -Math.PI / 2
```

#### property: type

```js
// type signature
ISimpleType<"CircularView">
// code
type: types.literal('CircularView')
```

#### property: minimumRadiusPx

```js
// type signature
number
// code
minimumRadiusPx: 25
```

#### property: paddingPx

```js
// type signature
number
// code
paddingPx: 80
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

#### property: spacingPx

```js
// type signature
number
// code
spacingPx: 10
```

#### property: trackSelectorType

```js
// type signature
string
// code
trackSelectorType: 'hierarchical'
```

### CircularView - Getters

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

#### getter: bpPerRadian

```js
// type
number
```

#### getter: centerXY

```js
// type
;[number, number]
```

#### getter: circumferencePx

```js
// type
number
```

#### getter: assemblyNames

```js
// type
string[]
```

#### getter: figureDimensions

```js
// type
;[number, number]
```

#### getter: maxBpPerPx

```js
// type
number
```

#### getter: elidedRegions

this is displayedRegions, post-processed to elide regions that are too small to
see reasonably

```js
// type
SliceRegion[]
```

#### getter: visibleSection

```js
// type
{
  rho: [number, number]
  theta: [number, number]
}
```

#### getter: width

```js
// type
number
```

#### getter: figureHeight

```js
// type
any
```

#### getter: maximumRadiusPx

```js
// type
number
```

#### getter: figureWidth

```js
// type
any
```

#### getter: radiusPx

```js
// type
number
```

#### getter: initialized

```js
// type
any
```

#### getter: pxPerRadian

```js
// type
any
```

#### getter: minBpPerPx

```js
// type
number
```

#### getter: totalBp

```js
// type
number
```

#### getter: tooSmallToLock

```js
// type
boolean
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

#### action: activateTrackSelector

```js
// type signature
activateTrackSelector: () => Widget
```

#### action: closeView

```js
// type signature
closeView: () => void
```

#### action: resizeHeight

```js
// type signature
resizeHeight: (distance: number) => number
```

#### action: addTrackConf

```js
// type signature
addTrackConf: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>, initialSnapshot?: {}) => void
```

#### action: resizeWidth

```js
// type signature
resizeWidth: (distance: number) => number
```

#### action: rotateClockwise

```js
// type signature
rotateClockwise: (distance?: number) => void
```

#### action: exportSvg

creates an svg export and save using FileSaver

```js
// type signature
exportSvg: (opts?: ExportSvgOptions) => Promise<void>
```

#### action: rotateClockwiseButton

```js
// type signature
rotateClockwiseButton: () => void
```

#### action: rotateCounterClockwise

```js
// type signature
rotateCounterClockwise: (distance?: number) => void
```

#### action: hideTrack

```js
// type signature
hideTrack: (trackId: string) => number
```

#### action: setHeight

```js
// type signature
setHeight: (newHeight: number) => number
```

#### action: rotateCounterClockwiseButton

```js
// type signature
rotateCounterClockwiseButton: () => void
```

#### action: setWidth

```js
// type signature
setWidth: (newWidth: number) => number
```

#### action: setBpPerPx

```js
// type signature
setBpPerPx: (newVal: number) => void
```

#### action: setDisplayedRegions

```js
// type signature
setDisplayedRegions: (regions: SnapshotOrInstance<IModelType<{ end: ISimpleType<number>; refName: ISimpleType<string>; reversed: IOptionalIType<ISimpleType<boolean>, [undefined]>; start: ISimpleType<...>; } & { ...; }, { ...; }, _NotCustomized, _NotCustomized>>[]) => void
```

#### action: setError

```js
// type signature
setError: (error: unknown) => void
```

#### action: setModelViewWhenAdjust

```js
// type signature
setModelViewWhenAdjust: (secondCondition: boolean) => void
```

#### action: showTrack

```js
// type signature
showTrack: (trackId: string, initialSnapshot?: {}) => void
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

#### action: toggleFitToWindowLock

```js
// type signature
toggleFitToWindowLock: () => boolean
```

#### action: toggleTrack

```js
// type signature
toggleTrack: (trackId: string) => boolean
```
