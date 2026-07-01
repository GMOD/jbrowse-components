---
id: circularview
title: CircularView
sidebar_label: View -> CircularView
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

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [BaseViewModel](../baseviewmodel)

**Properties:** [id](../baseviewmodel#property-id),
[displayName](../baseviewmodel#property-displayname),
[minimized](../baseviewmodel#property-minimized)

**Volatiles:** [width](../baseviewmodel#volatile-width)

**Getters:** [menuItems](../baseviewmodel#getter-menuitems)

**Actions:** [setDisplayName](../baseviewmodel#action-setdisplayname),
[setWidth](../baseviewmodel#action-setwidth),
[setMinimized](../baseviewmodel#action-setminimized)

<details open>
<summary>CircularView - Properties</summary>

#### property: offsetRadians

similar to offsetPx in linear genome view

```ts
// type signature
type offsetRadians = IOptionalIType<ISimpleType<number>, [undefined]>
// code
offsetRadians: types.stripDefault(types.number, defaultOffsetRadians)
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

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                           | Signature                                                          |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| [`type`](#property-type)                                         | `ISimpleType<"CircularView">`                                      |
| [`bpPerPx`](#property-bpperpx)                                   | `IOptionalIType<ISimpleType<number>, [undefined]>`                 |
| [`tracks`](#property-tracks)                                     | `IArrayType<IAnyType>`                                             |
| [`hideVerticalResizeHandle`](#property-hideverticalresizehandle) | `IOptionalIType<ISimpleType<boolean>, [undefined]>`                |
| [`hideTrackSelectorButton`](#property-hidetrackselectorbutton)   | `IOptionalIType<ISimpleType<boolean>, [undefined]>`                |
| [`disableImportForm`](#property-disableimportform)               | `IOptionalIType<ISimpleType<boolean>, [undefined]>`                |
| [`height`](#property-height)                                     | `IOptionalIType<ISimpleType<number>, [undefined]>`                 |
| [`displayedRegions`](#property-displayedregions)                 | `IOptionalIType<IType<Region[], Region[], Region[]>, [undefined]>` |
| [`minimumRadiusPx`](#property-minimumradiuspx)                   | `IOptionalIType<ISimpleType<number>, [undefined]>`                 |
| [`spacingPx`](#property-spacingpx)                               | `IOptionalIType<ISimpleType<number>, [undefined]>`                 |
| [`paddingPx`](#property-paddingpx)                               | `IOptionalIType<ISimpleType<number>, [undefined]>`                 |
| [`minVisibleWidth`](#property-minvisiblewidth)                   | `IOptionalIType<ISimpleType<number>, [undefined]>`                 |
| [`minimumBlockWidth`](#property-minimumblockwidth)               | `IOptionalIType<ISimpleType<number>, [undefined]>`                 |
| [`trackSelectorType`](#property-trackselectortype)               | `IOptionalIType<ISimpleType<string>, [undefined]>`                 |

</details>

<details>
<summary>CircularView - Properties (all signatures)</summary>

#### property: type

```ts
// type signature
type type = ISimpleType<'CircularView'>
// code
type: types.literal('CircularView')
```

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

<details open>
<summary>CircularView - Volatiles</summary>

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                     | Signature             |
| ------------------------------------------ | --------------------- |
| [`volatileWidth`](#volatile-volatilewidth) | `number \| undefined` |
| [`volatileError`](#volatile-volatileerror) | `unknown`             |
| [`panX`](#volatile-panx)                   | `number`              |
| [`panY`](#volatile-pany)                   | `number`              |

</details>

<details>
<summary>CircularView - Volatiles (all signatures)</summary>

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

<details open>
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

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                             | Signature                                             |
| -------------------------------------------------- | ----------------------------------------------------- |
| [`width`](#getter-width)                           | `number`                                              |
| [`visibleSection`](#getter-visiblesection)         | `{ rho: [number, number]; theta: [number, number]; }` |
| [`circumferencePx`](#getter-circumferencepx)       | `number`                                              |
| [`radiusPx`](#getter-radiuspx)                     | `number`                                              |
| [`bpPerRadian`](#getter-bpperradian)               | `number`                                              |
| [`centerXY`](#getter-centerxy)                     | `[number, number]`                                    |
| [`totalBp`](#getter-totalbp)                       | `number`                                              |
| [`maximumRadiusPx`](#getter-maximumradiuspx)       | `number`                                              |
| [`maxBpPerPx`](#getter-maxbpperpx)                 | `number`                                              |
| [`minBpPerPx`](#getter-minbpperpx)                 | `number`                                              |
| [`atMaxBpPerPx`](#getter-atmaxbpperpx)             | `boolean`                                             |
| [`atMinBpPerPx`](#getter-atminbpperpx)             | `boolean`                                             |
| [`assemblyNames`](#getter-assemblynames)           | `string[]`                                            |
| [`initialized`](#getter-initialized)               | `boolean`                                             |
| [`assemblyErrors`](#getter-assemblyerrors)         | `string`                                              |
| [`error`](#getter-error)                           | `unknown`                                             |
| [`hasSomethingToShow`](#getter-hassomethingtoshow) | `boolean`                                             |
| [`staticSlices`](#getter-staticslices)             | `Slice[]`                                             |

</details>

<details>
<summary>CircularView - Getters (all signatures)</summary>

#### getter: width

```ts
type width = number
```

#### getter: visibleSection

```ts
type visibleSection = { rho: [number, number]; theta: [number, number] }
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

<details open>
<summary>CircularView - Methods</summary>

#### method: menuItems

return the view menu items

```ts
type menuItems = () => MenuItem[]
```

</details>

<details open>
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

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                                 | Signature                                                                |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [`fitToWindow`](#action-fittowindow)                                   | `() => void`                                                             |
| [`setWidth`](#action-setwidth)                                         | `(newWidth: number) => number`                                           |
| [`setHeight`](#action-setheight)                                       | `(newHeight: number) => number`                                          |
| [`rotateClockwiseButton`](#action-rotateclockwisebutton)               | `() => void`                                                             |
| [`rotateCounterClockwiseButton`](#action-rotatecounterclockwisebutton) | `() => void`                                                             |
| [`rotate`](#action-rotate)                                             | `(delta: number) => void`                                                |
| [`zoomInButton`](#action-zoominbutton)                                 | `() => void`                                                             |
| [`zoomOutButton`](#action-zoomoutbutton)                               | `() => void`                                                             |
| [`setBpPerPx`](#action-setbpperpx)                                     | `(newVal: number) => void`                                               |
| [`setDisplayedRegions`](#action-setdisplayedregions)                   | `(regions: Region[]) => void`                                            |
| [`activateTrackSelector`](#action-activatetrackselector)               | `() => Widget \| undefined`                                              |
| [`toggleTrack`](#action-toggletrack)                                   | `(trackId: string) => boolean`                                           |
| [`setError`](#action-seterror)                                         | `(error: unknown) => void`                                               |
| [`setInit`](#action-setinit)                                           | `(init?: CircularViewInit \| undefined) => void`                         |
| [`showTrack`](#action-showtrack)                                       | `(trackId: string, initialSnapshot?: any) => any`                        |
| [`addTrackConf`](#action-addtrackconf)                                 | `(configuration: Record<string, unknown>, initialSnapshot?: any) => any` |
| [`hideTrack`](#action-hidetrack)                                       | `(trackId: string) => boolean`                                           |
| [`openExportDialog`](#action-openexportdialog)                         | `() => void`                                                             |
| [`resizeHeight`](#action-resizeheight)                                 | `(distance: number) => number`                                           |
| [`resizeWidth`](#action-resizewidth)                                   | `(distance: number) => number`                                           |

</details>

<details>
<summary>CircularView - Actions (all signatures)</summary>

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
