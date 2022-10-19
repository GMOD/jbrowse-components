---
id: circularview
title: CircularView
toplevel: true
---

extends `BaseViewModel`

#### property: type

```js
type: types.literal('CircularView')
```

#### property: offsetRadians

similar to offsetPx in linear genome view

```js
offsetRadians: -Math.PI / 2
```

#### property: bpPerPx

```js
bpPerPx: 2000000
```

#### property: tracks

```js
tracks: types.array(pluginManager.pluggableMstType('track', 'stateModel'))
```

#### property: hideVerticalResizeHandle

```js
hideVerticalResizeHandle: false
```

#### property: hideTrackSelectorButton

```js
hideTrackSelectorButton: false
```

#### property: lockedFitToWindow

```js
lockedFitToWindow: true
```

#### property: disableImportForm

```js
disableImportForm: false
```

#### property: height

```js
height: types.optional(
  types.refinement('trackHeight', types.number, n => n >= minHeight),
  defaultHeight,
)
```

#### property: displayedRegions

```js
displayedRegions: types.array(Region)
```

#### property: scrollX

```js
scrollX: 0
```

#### property: scrollY

```js
scrollY: 0
```

#### getter: staticSlices

```js
// Type
any[]
```

#### getter: visibleSection

```js
// Type
{
  rho: [number, number]
  theta: [number, number]
}
```

#### getter: circumferencePx

```js
// Type
number
```

#### getter: radiusPx

```js
// Type
number
```

#### getter: bpPerRadian

```js
// Type
number
```

#### getter: pxPerRadian

```js
// Type
any
```

#### getter: centerXY

```js
// Type
;[number, number]
```

#### getter: totalBp

```js
// Type
number
```

#### getter: maximumRadiusPx

```js
// Type
number
```

#### getter: maxBpPerPx

```js
// Type
number
```

#### getter: minBpPerPx

```js
// Type
number
```

#### getter: atMaxBpPerPx

```js
// Type
boolean
```

#### getter: atMinBpPerPx

```js
// Type
boolean
```

#### getter: tooSmallToLock

```js
// Type
boolean
```

#### getter: figureDimensions

```js
// Type
;[number, number]
```

#### getter: figureWidth

```js
// Type
any
```

#### getter: figureHeight

```js
// Type
any
```

#### getter: elidedRegions

this is displayedRegions, post-processed to
elide regions that are too small to see reasonably

```js
// Type
any[]
```

#### getter: assemblyNames

```js
// Type
string[]
```

#### getter: initialized

```js
// Type
any
```

#### getter: visibleStaticSlices

```js
// Type
any[]
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

#### action: resizeHeight

```js
// Type signature
resizeHeight: (distance: number) => number
```

#### action: resizeWidth

```js
// Type signature
resizeWidth: (distance: number) => number
```

#### action: rotateClockwiseButton

```js
// Type signature
rotateClockwiseButton: () => void
```

#### action: rotateCounterClockwiseButton

```js
// Type signature
rotateCounterClockwiseButton: () => void
```

#### action: rotateClockwise

```js
// Type signature
rotateClockwise: (distance?: number) => void
```

#### action: rotateCounterClockwise

```js
// Type signature
rotateCounterClockwise: (distance?: number) => void
```

#### action: zoomInButton

```js
// Type signature
zoomInButton: () => void
```

#### action: zoomOutButton

```js
// Type signature
zoomOutButton: () => void
```

#### action: setBpPerPx

```js
// Type signature
setBpPerPx: (newVal: number) => void
```

#### action: setModelViewWhenAdjust

```js
// Type signature
setModelViewWhenAdjust: (secondCondition: boolean) => void
```

#### action: closeView

```js
// Type signature
closeView: () => void
```

#### action: setDisplayedRegions

```js
// Type signature
setDisplayedRegions: (regions: SnapshotOrInstance<IModelType<{ refName: ISimpleType<string>; start: ISimpleType<number>; end: ISimpleType<number>; reversed: IOptionalIType<ISimpleType<boolean>, [...]>; } & { ...; }, { ...; }, _NotCustomized, _NotCustomized>>[]) => void
```

#### action: activateTrackSelector

```js
// Type signature
activateTrackSelector: () => Widget
```

#### action: toggleTrack

```js
// Type signature
toggleTrack: (trackId: string) => void
```

#### action: setError

```js
// Type signature
setError: (error: unknown) => void
```

#### action: showTrack

```js
// Type signature
showTrack: (trackId: string, initialSnapshot?: {}) => void
```

#### action: addTrackConf

```js
// Type signature
addTrackConf: (configuration: { [x: string]: any; } & NonEmptyObject & { setSubschema(slotName: string, data: unknown): any; } & IStateTreeNode<AnyConfigurationSchemaType>, initialSnapshot?: {}) => void
```

#### action: hideTrack

```js
// Type signature
hideTrack: (trackId: string) => number
```

#### action: toggleFitToWindowLock

```js
// Type signature
toggleFitToWindowLock: () => boolean
```

#### property: bezierRadiusRatio

```js
bezierRadiusRatio: 0.1
```

#### property: assemblyName

```js
assemblyName: types.maybe(types.string)
```

#### action: onChordClick

```js
// Type signature
onChordClick: (feature: Feature) => void
```

#### getter: blockDefinitions

```js
// Type
any
```

#### method: renderProps

```js
// Type signature
renderProps: () => any
```

#### getter: rendererType

the pluggable element type object for this diplay's
renderer

```js
// Type
RendererType
```

#### method: isCompatibleWithRenderer

```js
// Type signature
isCompatibleWithRenderer: (renderer: RendererType) => boolean
```

#### getter: selectedFeatureId

returns a string feature ID if the globally-selected object
is probably a feature

```js
// Type
string
```

#### action: renderStarted

```js
// Type signature
renderStarted: () => void
```

#### action: renderSuccess

```js
// Type signature
renderSuccess: ({ message, data, reactElement, renderingComponent, }: { message: string; data: any; reactElement: React.ReactElement; renderingComponent: React.ComponentType<any>; }) => void
```

#### action: renderError

```js
// Type signature
renderError: (error: unknown) => void
```

#### action: setRefNameMap

```js
// Type signature
setRefNameMap: (refNameMap: Record<string, string>) => void
```

#### property: type

```js
type: types.literal('LinearVariantDisplay')
```

#### property: configuration

```js
configuration: ConfigurationReference(configSchema)
```

#### action: selectFeature

```js
// Type signature
selectFeature: (feature: Feature) => Promise<void>
```

#### property: type

```js
type: types.literal('ChordVariantDisplay')
```

#### property: configuration

```js
configuration: ConfigurationReference(configSchema)
```

#### getter: rendererTypeName

```js
// Type
any
```

#### method: renderProps

```js
// Type signature
renderProps: () => Record<string, unknown>
```
