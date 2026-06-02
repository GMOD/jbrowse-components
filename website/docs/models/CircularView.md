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

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [BaseViewModel](../baseviewmodel)

**Properties:** id, displayName, minimized

**Getters:** menuItems

**Actions:** setDisplayName, setWidth, setMinimized

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
IType<CircularViewInit | undefined, CircularViewInit | undefined, CircularViewInit | undefined>
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

#### getter: figureSize

figure is always square, so width === height

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

#### getter: assemblyNames

```js
// type
string[]
```

#### getter: initialized

```js
// type
boolean
```

#### getter: assemblyErrors

```js
// type
string
```

#### getter: error

```js
// type
unknown
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

#### getter: showView

Whether the view is fully initialized and ready to display

```js
// type
boolean
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
Slice[]
```

### CircularView - Methods

#### method: menuItems

return the view menu items

```js
// type signature
menuItems: () => MenuItem[]
```

### CircularView - Actions

#### action: fitToWindow

```js
// type signature
fitToWindow: () => void
```

#### action: setHeight

```js
// type signature
setHeight: (newHeight: number) => number
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

#### action: rotate

```js
// type signature
rotate: (delta: number) => void
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

#### action: zoomToPoint

zoom toward/away from a specific angle on the circle, keeping the genome
position at that angle visually fixed under the cursor

```js
// type signature
zoomToPoint: (newBpPerPx: number, cursorAngle: number) => void
```

#### action: setDisplayedRegions

```js
// type signature
setDisplayedRegions: (regions: Region[]) => void
```

#### action: activateTrackSelector

```js
// type signature
activateTrackSelector: () => Widget | undefined
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
setInit: (init?: CircularViewInit | undefined) => void
```

#### action: showTrack

```js
// type signature
showTrack: (trackId: string, initialSnapshot?: any) => void
```

#### action: addTrackConf

```js
// type signature
addTrackConf: (configuration: Record<string, unknown>, initialSnapshot?: any) => void
```

#### action: hideTrack

```js
// type signature
hideTrack: (trackId: string) => void
```

#### action: openExportDialog

```js
// type signature
openExportDialog: () => void
```

#### action: exportSvg

creates an svg export and save using FileSaver

```js
// type signature
exportSvg: (opts?: ExportSvgOptions) => Promise<void>
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
