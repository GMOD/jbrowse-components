---
id: circularview
title: CircularView
sidebar_label: View -> CircularView
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`circular-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/circular-view/src/CircularView/model.ts).

## Example usage

Hand-authored under `defaultSession.views`. The `init` shorthand takes a single
`assembly` and the structural-variant `tracks` to draw as arcs:

```js
{
  type: 'CircularView',
  init: {
    assembly: 'hg38',
    tracks: ['my-sv-vcf'],
  },
}
```

## Overview

## Members

| Member                                                               | Kind       | Defined by                        | Description                                                                                                                                                                                          |
| -------------------------------------------------------------------- | ---------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [type](#property-type)                                               | Properties | CircularView                      | this is a string instead of the const literal 'CircularView' to reduce some typescripting strictness, but you should pass the string 'CircularView' to the model explicitly                          |
| [offsetRadians](#property-offsetradians)                             | Properties | CircularView                      | similar to offsetPx in linear genome view                                                                                                                                                            |
| [bpPerPx](#property-bpperpx)                                         | Properties | CircularView                      |                                                                                                                                                                                                      |
| [autoFit](#property-autofit)                                         | Properties | CircularView                      | whether the view keeps re-fitting to its container on resize. Cleared once the user manually zooms/pans so their view (persisted via bpPerPx/offsetRadians) is preserved across resizes and reloads. |
| [tracks](#property-tracks)                                           | Properties | CircularView                      |                                                                                                                                                                                                      |
| [hideVerticalResizeHandle](#property-hideverticalresizehandle)       | Properties | CircularView                      |                                                                                                                                                                                                      |
| [hideTrackSelectorButton](#property-hidetrackselectorbutton)         | Properties | CircularView                      |                                                                                                                                                                                                      |
| [disableImportForm](#property-disableimportform)                     | Properties | CircularView                      |                                                                                                                                                                                                      |
| [height](#property-height)                                           | Properties | CircularView                      |                                                                                                                                                                                                      |
| [displayedRegions](#property-displayedregions)                       | Properties | CircularView                      |                                                                                                                                                                                                      |
| [minimumRadiusPx](#property-minimumradiuspx)                         | Properties | CircularView                      |                                                                                                                                                                                                      |
| [spacingPx](#property-spacingpx)                                     | Properties | CircularView                      |                                                                                                                                                                                                      |
| [paddingPx](#property-paddingpx)                                     | Properties | CircularView                      |                                                                                                                                                                                                      |
| [minVisibleWidth](#property-minvisiblewidth)                         | Properties | CircularView                      |                                                                                                                                                                                                      |
| [minimumBlockWidth](#property-minimumblockwidth)                     | Properties | CircularView                      |                                                                                                                                                                                                      |
| [trackSelectorType](#property-trackselectortype)                     | Properties | CircularView                      |                                                                                                                                                                                                      |
| [init](#property-init)                                               | Properties | CircularView                      | used for initializing the view from a session snapshot                                                                                                                                               |
| [volatileWidth](#volatile-volatilewidth)                             | Volatiles  | CircularView                      |                                                                                                                                                                                                      |
| [volatileError](#volatile-volatileerror)                             | Volatiles  | CircularView                      |                                                                                                                                                                                                      |
| [panX](#volatile-panx)                                               | Volatiles  | CircularView                      |                                                                                                                                                                                                      |
| [panY](#volatile-pany)                                               | Volatiles  | CircularView                      |                                                                                                                                                                                                      |
| [width](#getter-width)                                               | Getters    | CircularView                      |                                                                                                                                                                                                      |
| [circumferencePx](#getter-circumferencepx)                           | Getters    | CircularView                      |                                                                                                                                                                                                      |
| [radiusPx](#getter-radiuspx)                                         | Getters    | CircularView                      |                                                                                                                                                                                                      |
| [bpPerRadian](#getter-bpperradian)                                   | Getters    | CircularView                      |                                                                                                                                                                                                      |
| [centerXY](#getter-centerxy)                                         | Getters    | CircularView                      |                                                                                                                                                                                                      |
| [totalBp](#getter-totalbp)                                           | Getters    | CircularView                      |                                                                                                                                                                                                      |
| [maximumRadiusPx](#getter-maximumradiuspx)                           | Getters    | CircularView                      |                                                                                                                                                                                                      |
| [maxBpPerPx](#getter-maxbpperpx)                                     | Getters    | CircularView                      |                                                                                                                                                                                                      |
| [minBpPerPx](#getter-minbpperpx)                                     | Getters    | CircularView                      |                                                                                                                                                                                                      |
| [atMaxBpPerPx](#getter-atmaxbpperpx)                                 | Getters    | CircularView                      |                                                                                                                                                                                                      |
| [atMinBpPerPx](#getter-atminbpperpx)                                 | Getters    | CircularView                      |                                                                                                                                                                                                      |
| [figureSize](#getter-figuresize)                                     | Getters    | CircularView                      | figure is always square, so width === height                                                                                                                                                         |
| [elidedRegions](#getter-elidedregions)                               | Getters    | CircularView                      | this is displayedRegions, post-processed to elide regions that are too small to see reasonably                                                                                                       |
| [assemblyNames](#getter-assemblynames)                               | Getters    | CircularView                      |                                                                                                                                                                                                      |
| [initialized](#getter-initialized)                                   | Getters    | CircularView                      |                                                                                                                                                                                                      |
| [assemblyErrors](#getter-assemblyerrors)                             | Getters    | CircularView                      |                                                                                                                                                                                                      |
| [error](#getter-error)                                               | Getters    | CircularView                      |                                                                                                                                                                                                      |
| [hasSomethingToShow](#getter-hassomethingtoshow)                     | Getters    | CircularView                      |                                                                                                                                                                                                      |
| [showLoading](#getter-showloading)                                   | Getters    | CircularView                      | Whether to show a loading indicator instead of the import form or view                                                                                                                               |
| [showView](#getter-showview)                                         | Getters    | CircularView                      | Whether the view is fully initialized and ready to display                                                                                                                                           |
| [showImportForm](#getter-showimportform)                             | Getters    | CircularView                      | Whether to show the import form (when not ready to display and import form is enabled, or when there's an error)                                                                                     |
| [staticSlices](#getter-staticslices)                                 | Getters    | CircularView                      |                                                                                                                                                                                                      |
| [menuItems](#method-menuitems)                                       | Methods    | CircularView                      | return the view menu items                                                                                                                                                                           |
| [fitToWindow](#action-fittowindow)                                   | Actions    | CircularView                      |                                                                                                                                                                                                      |
| [setWidth](#action-setwidth)                                         | Actions    | CircularView                      |                                                                                                                                                                                                      |
| [setHeight](#action-setheight)                                       | Actions    | CircularView                      |                                                                                                                                                                                                      |
| [rotateClockwiseButton](#action-rotateclockwisebutton)               | Actions    | CircularView                      |                                                                                                                                                                                                      |
| [rotateCounterClockwiseButton](#action-rotatecounterclockwisebutton) | Actions    | CircularView                      |                                                                                                                                                                                                      |
| [rotate](#action-rotate)                                             | Actions    | CircularView                      |                                                                                                                                                                                                      |
| [resetView](#action-resetview)                                       | Actions    | CircularView                      | reset rotation, pan, and zoom back to the default fit-to-window view                                                                                                                                 |
| [zoomInButton](#action-zoominbutton)                                 | Actions    | CircularView                      |                                                                                                                                                                                                      |
| [zoomOutButton](#action-zoomoutbutton)                               | Actions    | CircularView                      |                                                                                                                                                                                                      |
| [setBpPerPx](#action-setbpperpx)                                     | Actions    | CircularView                      |                                                                                                                                                                                                      |
| [zoomToPoint](#action-zoomtopoint)                                   | Actions    | CircularView                      | zoom toward/away from a specific angle on the circle, keeping the genome position at that angle visually fixed under the cursor                                                                      |
| [setDisplayedRegions](#action-setdisplayedregions)                   | Actions    | CircularView                      |                                                                                                                                                                                                      |
| [activateTrackSelector](#action-activatetrackselector)               | Actions    | CircularView                      |                                                                                                                                                                                                      |
| [toggleTrack](#action-toggletrack)                                   | Actions    | CircularView                      |                                                                                                                                                                                                      |
| [setError](#action-seterror)                                         | Actions    | CircularView                      |                                                                                                                                                                                                      |
| [setInit](#action-setinit)                                           | Actions    | CircularView                      |                                                                                                                                                                                                      |
| [showTrack](#action-showtrack)                                       | Actions    | CircularView                      |                                                                                                                                                                                                      |
| [addTrackConf](#action-addtrackconf)                                 | Actions    | CircularView                      |                                                                                                                                                                                                      |
| [hideTrack](#action-hidetrack)                                       | Actions    | CircularView                      |                                                                                                                                                                                                      |
| [openExportDialog](#action-openexportdialog)                         | Actions    | CircularView                      |                                                                                                                                                                                                      |
| [exportSvg](#action-exportsvg)                                       | Actions    | CircularView                      | creates an svg export and save using FileSaver                                                                                                                                                       |
| [resizeHeight](#action-resizeheight)                                 | Actions    | CircularView                      |                                                                                                                                                                                                      |
| [resizeWidth](#action-resizewidth)                                   | Actions    | CircularView                      |                                                                                                                                                                                                      |
| [id](#property-id)                                                   | Properties | [BaseViewModel](../baseviewmodel) |                                                                                                                                                                                                      |
| [displayName](#property-displayname)                                 | Properties | [BaseViewModel](../baseviewmodel) | displayName is displayed in the header of the view, or assembly names being used if none is specified                                                                                                |
| [minimized](#property-minimized)                                     | Properties | [BaseViewModel](../baseviewmodel) |                                                                                                                                                                                                      |
| [width](#volatile-width)                                             | Volatiles  | [BaseViewModel](../baseviewmodel) |                                                                                                                                                                                                      |
| [setDisplayName](#action-setdisplayname)                             | Actions    | [BaseViewModel](../baseviewmodel) |                                                                                                                                                                                                      |
| [setMinimized](#action-setminimized)                                 | Actions    | [BaseViewModel](../baseviewmodel) |                                                                                                                                                                                                      |

<details>
<summary>CircularView - Properties</summary>

#### property: type

this is a string instead of the const literal 'CircularView' to reduce some
typescripting strictness, but you should pass the string 'CircularView' to the
model explicitly

```ts
// type signature
type type = string
// code
type: types.literal('CircularView') as unknown as string
```

#### property: offsetRadians

similar to offsetPx in linear genome view

```ts
// type signature
type offsetRadians = IOptionalIType<ISimpleType<number>, [undefined]>
// code
offsetRadians: types.stripDefault(types.number, defaultOffsetRadians)
```

#### property: autoFit

whether the view keeps re-fitting to its container on resize. Cleared once the
user manually zooms/pans so their view (persisted via bpPerPx/offsetRadians) is
preserved across resizes and reloads.

```ts
// type signature
type autoFit = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
autoFit: types.stripDefault(types.boolean, true)
```

#### property: init

used for initializing the view from a session snapshot

```ts
// type signature
type init = IType<
  CircularViewInit | undefined,
  CircularViewInit | undefined,
  CircularViewInit | undefined
>
// code
init: types.frozen<CircularViewInit | undefined>()
```

</details>

<details>
<summary>CircularView - Properties (other undocumented members)</summary>

#### property: bpPerPx

```ts
// type signature
type bpPerPx = IOptionalIType<ISimpleType<number>, [undefined]>
// code
bpPerPx: types.stripDefault(types.number, defaultBpPerPx)
```

#### property: tracks

```ts
// type signature
type tracks = IArrayType<IAnyType>
// code
tracks: types.array(pluginManager.pluggableMstType('track', 'stateModel'))
```

#### property: hideVerticalResizeHandle

```ts
// type signature
type hideVerticalResizeHandle = IOptionalIType<
  ISimpleType<boolean>,
  [undefined]
>
// code
hideVerticalResizeHandle: types.stripDefault(types.boolean, false)
```

#### property: hideTrackSelectorButton

```ts
// type signature
type hideTrackSelectorButton = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
hideTrackSelectorButton: types.stripDefault(types.boolean, false)
```

#### property: disableImportForm

```ts
// type signature
type disableImportForm = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
disableImportForm: types.stripDefault(types.boolean, false)
```

#### property: height

```ts
// type signature
type height = IOptionalIType<ISimpleType<number>, [undefined]>
// code
height: types.stripDefault(types.number, defaultHeight)
```

#### property: displayedRegions

```ts
// type signature
type displayedRegions = IOptionalIType<
  IType<Region[], Region[], Region[]>,
  [undefined]
>
// code
displayedRegions: types.stripDefault(types.frozen<Region[]>(), [])
```

#### property: minimumRadiusPx

```ts
// type signature
type minimumRadiusPx = IOptionalIType<ISimpleType<number>, [undefined]>
// code
minimumRadiusPx: types.stripDefault(types.number, defaultMinimumRadiusPx)
```

#### property: spacingPx

```ts
// type signature
type spacingPx = IOptionalIType<ISimpleType<number>, [undefined]>
// code
spacingPx: types.stripDefault(types.number, defaultSpacingPx)
```

#### property: paddingPx

```ts
// type signature
type paddingPx = IOptionalIType<ISimpleType<number>, [undefined]>
// code
paddingPx: types.stripDefault(types.number, defaultPaddingPx)
```

#### property: minVisibleWidth

```ts
// type signature
type minVisibleWidth = IOptionalIType<ISimpleType<number>, [undefined]>
// code
minVisibleWidth: types.stripDefault(types.number, defaultMinVisibleWidth)
```

#### property: minimumBlockWidth

```ts
// type signature
type minimumBlockWidth = IOptionalIType<ISimpleType<number>, [undefined]>
// code
minimumBlockWidth: types.stripDefault(types.number, defaultMinimumBlockWidth)
```

#### property: trackSelectorType

```ts
// type signature
type trackSelectorType = IOptionalIType<ISimpleType<string>, [undefined]>
// code
trackSelectorType: types.stripDefault(types.string, 'hierarchical')
```

</details>

<details>
<summary>CircularView - Volatiles</summary>

#### volatile: volatileWidth

```ts
// type signature
type volatileWidth = number | undefined
// code
volatileWidth: undefined as number | undefined
```

#### volatile: volatileError

```ts
// type signature
type volatileError = unknown
// code
volatileError: undefined as unknown
```

#### volatile: panX

```ts
// type signature
type panX = number
// code
panX: 0
```

#### volatile: panY

```ts
// type signature
type panY = number
// code
panY: 0
```

</details>

<details>
<summary>CircularView - Getters</summary>

#### getter: figureSize

figure is always square, so width === height

```ts
type figureSize = number
```

#### getter: elidedRegions

this is displayedRegions, post-processed to elide regions that are too small to
see reasonably

```ts
type elidedRegions = SliceRegion[]
```

#### getter: showLoading

Whether to show a loading indicator instead of the import form or view

```ts
type showLoading = boolean
```

#### getter: showView

Whether the view is fully initialized and ready to display

```ts
type showView = boolean
```

#### getter: showImportForm

Whether to show the import form (when not ready to display and import form is
enabled, or when there's an error)

```ts
type showImportForm = boolean
```

</details>

<details>
<summary>CircularView - Getters (other undocumented members)</summary>

#### getter: width

```ts
type width = number
```

#### getter: circumferencePx

```ts
type circumferencePx = number
```

#### getter: radiusPx

```ts
type radiusPx = number
```

#### getter: bpPerRadian

```ts
type bpPerRadian = number
```

#### getter: centerXY

```ts
type centerXY = [number, number]
```

#### getter: totalBp

```ts
type totalBp = number
```

#### getter: maximumRadiusPx

```ts
type maximumRadiusPx = number
```

#### getter: maxBpPerPx

```ts
type maxBpPerPx = number
```

#### getter: minBpPerPx

```ts
type minBpPerPx = number
```

#### getter: atMaxBpPerPx

```ts
type atMaxBpPerPx = boolean
```

#### getter: atMinBpPerPx

```ts
type atMinBpPerPx = boolean
```

#### getter: assemblyNames

```ts
type assemblyNames = string[]
```

#### getter: initialized

```ts
type initialized = boolean
```

#### getter: assemblyErrors

```ts
type assemblyErrors = string
```

#### getter: error

```ts
type error = unknown
```

#### getter: hasSomethingToShow

```ts
type hasSomethingToShow = boolean
```

#### getter: staticSlices

```ts
type staticSlices = Slice[]
```

</details>

<details>
<summary>CircularView - Methods</summary>

#### method: menuItems

return the view menu items

```ts
type menuItems = () => MenuItem[]
```

</details>

<details>
<summary>CircularView - Actions</summary>

#### action: resetView

reset rotation, pan, and zoom back to the default fit-to-window view

```ts
type resetView = () => void
```

#### action: zoomToPoint

zoom toward/away from a specific angle on the circle, keeping the genome
position at that angle visually fixed under the cursor

```ts
type zoomToPoint = (newBpPerPx: number, cursorAngle: number) => void
```

#### action: exportSvg

creates an svg export and save using FileSaver

```ts
type exportSvg = (opts?: ExportSvgOptions) => Promise<void>
```

</details>

<details>
<summary>CircularView - Actions (other undocumented members)</summary>

#### action: fitToWindow

```ts
type fitToWindow = () => void
```

#### action: setWidth

```ts
type setWidth = (newWidth: number) => number
```

#### action: setHeight

```ts
type setHeight = (newHeight: number) => number
```

#### action: rotateClockwiseButton

```ts
type rotateClockwiseButton = () => void
```

#### action: rotateCounterClockwiseButton

```ts
type rotateCounterClockwiseButton = () => void
```

#### action: rotate

```ts
type rotate = (delta: number) => void
```

#### action: zoomInButton

```ts
type zoomInButton = () => void
```

#### action: zoomOutButton

```ts
type zoomOutButton = () => void
```

#### action: setBpPerPx

```ts
type setBpPerPx = (newVal: number) => void
```

#### action: setDisplayedRegions

```ts
type setDisplayedRegions = (regions: Region[]) => void
```

#### action: activateTrackSelector

```ts
type activateTrackSelector = () => Widget | undefined
```

#### action: toggleTrack

```ts
type toggleTrack = (trackId: string) => boolean
```

#### action: setError

```ts
type setError = (error: unknown) => void
```

#### action: setInit

```ts
type setInit = (init?: CircularViewInit | undefined) => void
```

#### action: showTrack

```ts
type showTrack = (trackId: string, initialSnapshot?: any) => any
```

#### action: addTrackConf

```ts
type addTrackConf = (
  configuration: Record<string, unknown>,
  initialSnapshot?: any,
) => any
```

#### action: hideTrack

```ts
type hideTrack = (trackId: string) => boolean
```

#### action: openExportDialog

```ts
type openExportDialog = () => void
```

#### action: resizeHeight

```ts
type resizeHeight = (distance: number) => number
```

#### action: resizeWidth

```ts
type resizeWidth = (distance: number) => number
```

</details>

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

<details>
<summary>Derived from BaseViewModel</summary>

[BaseViewModel →](../baseviewmodel)

**Properties**

#### property: id

```ts
// type signature
type id = IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: displayName

displayName is displayed in the header of the view, or assembly names being used
if none is specified

```ts
// type signature
type displayName = IMaybe<ISimpleType<string>>
// code
displayName: types.maybe(types.string)
```

#### property: minimized

```ts
// type signature
type minimized = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
minimized: types.stripDefault(types.boolean, false)
```

**Volatiles**

#### volatile: width

```ts
// type signature
type width = number
// code
width: 800
```

**Actions**

#### action: setDisplayName

```ts
type setDisplayName = (name: string) => void
```

#### action: setMinimized

```ts
type setMinimized = (flag: boolean) => void
```

</details>
