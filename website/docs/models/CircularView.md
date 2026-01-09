---
id: circularview
title: CircularView
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/circular-view/src/CircularView/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/CircularView.md)

## Docs

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
offsetRadians: defaultOffsetRadians
```

#### property: bpPerPx

```js
// type signature
number
// code
bpPerPx: defaultBpPerPx
```

#### property: tracks

```js
// type signature
IArrayType<any>
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
height: types.optional(types.number, defaultHeight)
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
minimumRadiusPx: defaultMinimumRadiusPx
```

#### property: spacingPx

```js
// type signature
number
// code
spacingPx: defaultSpacingPx
```

#### property: paddingPx

```js
// type signature
number
// code
paddingPx: defaultPaddingPx
```

#### property: lockedPaddingPx

```js
// type signature
number
// code
lockedPaddingPx: defaultLockedPaddingPx
```

#### property: minVisibleWidth

```js
// type signature
number
// code
minVisibleWidth: defaultMinVisibleWidth
```

#### property: minimumBlockWidth

```js
// type signature
number
// code
minimumBlockWidth: defaultMinimumBlockWidth
```

#### property: trackSelectorType

```js
// type signature
string
// code
trackSelectorType: 'hierarchical'
```

#### property: init

used for initializing the view from a session snapshot

```js
// type signature
IType<CircularViewInit, CircularViewInit, CircularViewInit>
// code
init: types.frozen<CircularViewInit | undefined>()
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
any
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

#### getter: assemblyErrors

```js
// type
any
```

#### getter: error

```js
// type
unknown
```

#### getter: loadingMessage

```js
// type
string
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
any
```

#### getter: showView

Whether the view is fully initialized and ready to display

```js
// type
any
```

#### getter: showImportForm

Whether to show the import form (when not ready to display and import form is
enabled, or when there's an error)

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
setDisplayedRegions: (regions: Region[]) => void
```

#### action: activateTrackSelector

```js
// type signature
activateTrackSelector: () => any
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

#### action: setInit

```js
// type signature
setInit: (init?: CircularViewInit) => void
```

#### action: showTrack

```js
// type signature
showTrack: (trackId: string, initialSnapshot?: {}) => void
```

#### action: addTrackConf

```js
// type signature
addTrackConf: (configuration: AnyConfigurationModel, initialSnapshot?: {}) => void
```

#### action: hideTrack

```js
// type signature
hideTrack: (trackId: string) => void
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
