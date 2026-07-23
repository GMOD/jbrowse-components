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

| Member                                                               | Kind       | Defined by                        | Description                                                                                                                                                                 |
| -------------------------------------------------------------------- | ---------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [type](#property-type)                                               | Properties | CircularView                      | this is a string instead of the const literal 'CircularView' to reduce some typescripting strictness, but you should pass the string 'CircularView' to the model explicitly |
| [offsetRadians](#property-offsetradians)                             | Properties | CircularView                      | similar to offsetPx in linear genome view                                                                                                                                   |
| [bpPerPx](#property-bpperpx)                                         | Properties | CircularView                      |                                                                                                                                                                             |
| [autoFit](#property-autofit)                                         | Properties | CircularView                      | whether the view keeps re-fitting to its container on resize.                                                                                                               |
| [tracks](#property-tracks)                                           | Properties | CircularView                      |                                                                                                                                                                             |
| [hideVerticalResizeHandle](#property-hideverticalresizehandle)       | Properties | CircularView                      |                                                                                                                                                                             |
| [hideTrackSelectorButton](#property-hidetrackselectorbutton)         | Properties | CircularView                      |                                                                                                                                                                             |
| [disableImportForm](#property-disableimportform)                     | Properties | CircularView                      |                                                                                                                                                                             |
| [height](#property-height)                                           | Properties | CircularView                      |                                                                                                                                                                             |
| [displayedRegions](#property-displayedregions)                       | Properties | CircularView                      |                                                                                                                                                                             |
| [minimumRadiusPx](#property-minimumradiuspx)                         | Properties | CircularView                      |                                                                                                                                                                             |
| [spacingPx](#property-spacingpx)                                     | Properties | CircularView                      |                                                                                                                                                                             |
| [paddingPx](#property-paddingpx)                                     | Properties | CircularView                      |                                                                                                                                                                             |
| [minVisibleWidth](#property-minvisiblewidth)                         | Properties | CircularView                      |                                                                                                                                                                             |
| [minimumBlockWidth](#property-minimumblockwidth)                     | Properties | CircularView                      |                                                                                                                                                                             |
| [trackSelectorType](#property-trackselectortype)                     | Properties | CircularView                      |                                                                                                                                                                             |
| [init](#property-init)                                               | Properties | CircularView                      | used for initializing the view from a session snapshot                                                                                                                      |
| [volatileWidth](#volatile-volatilewidth)                             | Volatiles  | CircularView                      |                                                                                                                                                                             |
| [volatileError](#volatile-volatileerror)                             | Volatiles  | CircularView                      |                                                                                                                                                                             |
| [panX](#volatile-panx)                                               | Volatiles  | CircularView                      |                                                                                                                                                                             |
| [panY](#volatile-pany)                                               | Volatiles  | CircularView                      |                                                                                                                                                                             |
| [width](#getter-width)                                               | Getters    | CircularView                      |                                                                                                                                                                             |
| [circumferencePx](#getter-circumferencepx)                           | Getters    | CircularView                      |                                                                                                                                                                             |
| [radiusPx](#getter-radiuspx)                                         | Getters    | CircularView                      |                                                                                                                                                                             |
| [bpPerRadian](#getter-bpperradian)                                   | Getters    | CircularView                      |                                                                                                                                                                             |
| [centerXY](#getter-centerxy)                                         | Getters    | CircularView                      |                                                                                                                                                                             |
| [totalBp](#getter-totalbp)                                           | Getters    | CircularView                      |                                                                                                                                                                             |
| [maximumRadiusPx](#getter-maximumradiuspx)                           | Getters    | CircularView                      |                                                                                                                                                                             |
| [maxBpPerPx](#getter-maxbpperpx)                                     | Getters    | CircularView                      |                                                                                                                                                                             |
| [minBpPerPx](#getter-minbpperpx)                                     | Getters    | CircularView                      |                                                                                                                                                                             |
| [atMaxBpPerPx](#getter-atmaxbpperpx)                                 | Getters    | CircularView                      |                                                                                                                                                                             |
| [atMinBpPerPx](#getter-atminbpperpx)                                 | Getters    | CircularView                      |                                                                                                                                                                             |
| [figureSize](#getter-figuresize)                                     | Getters    | CircularView                      | figure is always square, so width === height                                                                                                                                |
| [elidedRegions](#getter-elidedregions)                               | Getters    | CircularView                      | this is displayedRegions, post-processed to elide regions that are too small to see reasonably                                                                              |
| [assemblyNames](#getter-assemblynames)                               | Getters    | CircularView                      |                                                                                                                                                                             |
| [initialized](#getter-initialized)                                   | Getters    | CircularView                      |                                                                                                                                                                             |
| [assemblyErrors](#getter-assemblyerrors)                             | Getters    | CircularView                      |                                                                                                                                                                             |
| [error](#getter-error)                                               | Getters    | CircularView                      |                                                                                                                                                                             |
| [hasSomethingToShow](#getter-hassomethingtoshow)                     | Getters    | CircularView                      |                                                                                                                                                                             |
| [showLoading](#getter-showloading)                                   | Getters    | CircularView                      | Whether to show a loading indicator instead of the import form or view                                                                                                      |
| [showView](#getter-showview)                                         | Getters    | CircularView                      | Whether the view is fully initialized and ready to display                                                                                                                  |
| [showImportForm](#getter-showimportform)                             | Getters    | CircularView                      | Whether to show the import form (when not ready to display and import form is enabled, or when there's an error)                                                            |
| [staticSlices](#getter-staticslices)                                 | Getters    | CircularView                      |                                                                                                                                                                             |
| [menuItems](#method-menuitems)                                       | Methods    | CircularView                      | return the view menu items                                                                                                                                                  |
| [fitToWindow](#action-fittowindow)                                   | Actions    | CircularView                      |                                                                                                                                                                             |
| [setWidth](#action-setwidth)                                         | Actions    | CircularView                      |                                                                                                                                                                             |
| [setHeight](#action-setheight)                                       | Actions    | CircularView                      |                                                                                                                                                                             |
| [rotateClockwiseButton](#action-rotateclockwisebutton)               | Actions    | CircularView                      |                                                                                                                                                                             |
| [rotateCounterClockwiseButton](#action-rotatecounterclockwisebutton) | Actions    | CircularView                      |                                                                                                                                                                             |
| [rotate](#action-rotate)                                             | Actions    | CircularView                      |                                                                                                                                                                             |
| [resetView](#action-resetview)                                       | Actions    | CircularView                      | reset rotation, pan, and zoom back to the default fit-to-window view                                                                                                        |
| [zoomInButton](#action-zoominbutton)                                 | Actions    | CircularView                      |                                                                                                                                                                             |
| [zoomOutButton](#action-zoomoutbutton)                               | Actions    | CircularView                      |                                                                                                                                                                             |
| [setBpPerPx](#action-setbpperpx)                                     | Actions    | CircularView                      |                                                                                                                                                                             |
| [zoomToPoint](#action-zoomtopoint)                                   | Actions    | CircularView                      | zoom toward/away from a specific angle on the circle, keeping the genome position at that angle visually fixed under the cursor                                             |
| [setDisplayedRegions](#action-setdisplayedregions)                   | Actions    | CircularView                      |                                                                                                                                                                             |
| [activateTrackSelector](#action-activatetrackselector)               | Actions    | CircularView                      |                                                                                                                                                                             |
| [toggleTrack](#action-toggletrack)                                   | Actions    | CircularView                      |                                                                                                                                                                             |
| [setError](#action-seterror)                                         | Actions    | CircularView                      |                                                                                                                                                                             |
| [setInit](#action-setinit)                                           | Actions    | CircularView                      |                                                                                                                                                                             |
| [showTrack](#action-showtrack)                                       | Actions    | CircularView                      |                                                                                                                                                                             |
| [addTrackConf](#action-addtrackconf)                                 | Actions    | CircularView                      |                                                                                                                                                                             |
| [hideTrack](#action-hidetrack)                                       | Actions    | CircularView                      |                                                                                                                                                                             |
| [openExportDialog](#action-openexportdialog)                         | Actions    | CircularView                      |                                                                                                                                                                             |
| [exportSvg](#action-exportsvg)                                       | Actions    | CircularView                      | creates an svg export and save using FileSaver                                                                                                                              |
| [resizeHeight](#action-resizeheight)                                 | Actions    | CircularView                      |                                                                                                                                                                             |
| [resizeWidth](#action-resizewidth)                                   | Actions    | CircularView                      |                                                                                                                                                                             |
| [id](#property-id)                                                   | Properties | [BaseViewModel](../baseviewmodel) |                                                                                                                                                                             |
| [displayName](#property-displayname)                                 | Properties | [BaseViewModel](../baseviewmodel) | displayName is displayed in the header of the view, or assembly names being used if none is specified                                                                       |
| [minimized](#property-minimized)                                     | Properties | [BaseViewModel](../baseviewmodel) |                                                                                                                                                                             |
| [width](#volatile-width)                                             | Volatiles  | [BaseViewModel](../baseviewmodel) |                                                                                                                                                                             |
| [setDisplayName](#action-setdisplayname)                             | Actions    | [BaseViewModel](../baseviewmodel) |                                                                                                                                                                             |
| [setMinimized](#action-setminimized)                                 | Actions    | [BaseViewModel](../baseviewmodel) |                                                                                                                                                                             |

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

| Member                                                                       | Type                                                               |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| <span id="property-bpperpx">bpPerPx</span>                                   | `IOptionalIType<ISimpleType<number>, [undefined]>`                 |
| <span id="property-tracks">tracks</span>                                     | `IArrayType<IAnyType>`                                             |
| <span id="property-hideverticalresizehandle">hideVerticalResizeHandle</span> | `IOptionalIType<ISimpleType<boolean>, [undefined]>`                |
| <span id="property-hidetrackselectorbutton">hideTrackSelectorButton</span>   | `IOptionalIType<ISimpleType<boolean>, [undefined]>`                |
| <span id="property-disableimportform">disableImportForm</span>               | `IOptionalIType<ISimpleType<boolean>, [undefined]>`                |
| <span id="property-height">height</span>                                     | `IOptionalIType<ISimpleType<number>, [undefined]>`                 |
| <span id="property-displayedregions">displayedRegions</span>                 | `IOptionalIType<IType<Region[], Region[], Region[]>, [undefined]>` |
| <span id="property-minimumradiuspx">minimumRadiusPx</span>                   | `IOptionalIType<ISimpleType<number>, [undefined]>`                 |
| <span id="property-spacingpx">spacingPx</span>                               | `IOptionalIType<ISimpleType<number>, [undefined]>`                 |
| <span id="property-paddingpx">paddingPx</span>                               | `IOptionalIType<ISimpleType<number>, [undefined]>`                 |
| <span id="property-minvisiblewidth">minVisibleWidth</span>                   | `IOptionalIType<ISimpleType<number>, [undefined]>`                 |
| <span id="property-minimumblockwidth">minimumBlockWidth</span>               | `IOptionalIType<ISimpleType<number>, [undefined]>`                 |
| <span id="property-trackselectortype">trackSelectorType</span>               | `IOptionalIType<ISimpleType<string>, [undefined]>`                 |

</details>

<details>
<summary>CircularView - Volatiles</summary>

| Member                                                 | Type                  |
| ------------------------------------------------------ | --------------------- |
| <span id="volatile-volatilewidth">volatileWidth</span> | `number \| undefined` |
| <span id="volatile-volatileerror">volatileError</span> | `unknown`             |
| <span id="volatile-panx">panX</span>                   | `number`              |
| <span id="volatile-pany">panY</span>                   | `number`              |

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

| Member                                                         | Type               |
| -------------------------------------------------------------- | ------------------ |
| <span id="getter-width">width</span>                           | `number`           |
| <span id="getter-circumferencepx">circumferencePx</span>       | `number`           |
| <span id="getter-radiuspx">radiusPx</span>                     | `number`           |
| <span id="getter-bpperradian">bpPerRadian</span>               | `number`           |
| <span id="getter-centerxy">centerXY</span>                     | `[number, number]` |
| <span id="getter-totalbp">totalBp</span>                       | `number`           |
| <span id="getter-maximumradiuspx">maximumRadiusPx</span>       | `number`           |
| <span id="getter-maxbpperpx">maxBpPerPx</span>                 | `number`           |
| <span id="getter-minbpperpx">minBpPerPx</span>                 | `number`           |
| <span id="getter-atmaxbpperpx">atMaxBpPerPx</span>             | `boolean`          |
| <span id="getter-atminbpperpx">atMinBpPerPx</span>             | `boolean`          |
| <span id="getter-assemblynames">assemblyNames</span>           | `string[]`         |
| <span id="getter-initialized">initialized</span>               | `boolean`          |
| <span id="getter-assemblyerrors">assemblyErrors</span>         | `string`           |
| <span id="getter-error">error</span>                           | `unknown`          |
| <span id="getter-hassomethingtoshow">hasSomethingToShow</span> | `boolean`          |
| <span id="getter-staticslices">staticSlices</span>             | `Slice[]`          |

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

| Member                                                                             | Type                                                                     |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| <span id="action-fittowindow">fitToWindow</span>                                   | `() => void`                                                             |
| <span id="action-setwidth">setWidth</span>                                         | `(newWidth: number) => number`                                           |
| <span id="action-setheight">setHeight</span>                                       | `(newHeight: number) => number`                                          |
| <span id="action-rotateclockwisebutton">rotateClockwiseButton</span>               | `() => void`                                                             |
| <span id="action-rotatecounterclockwisebutton">rotateCounterClockwiseButton</span> | `() => void`                                                             |
| <span id="action-rotate">rotate</span>                                             | `(delta: number) => void`                                                |
| <span id="action-zoominbutton">zoomInButton</span>                                 | `() => void`                                                             |
| <span id="action-zoomoutbutton">zoomOutButton</span>                               | `() => void`                                                             |
| <span id="action-setbpperpx">setBpPerPx</span>                                     | `(newVal: number) => void`                                               |
| <span id="action-setdisplayedregions">setDisplayedRegions</span>                   | `(regions: Region[]) => void`                                            |
| <span id="action-activatetrackselector">activateTrackSelector</span>               | `() => Widget \| undefined`                                              |
| <span id="action-toggletrack">toggleTrack</span>                                   | `(trackId: string) => boolean`                                           |
| <span id="action-seterror">setError</span>                                         | `(error: unknown) => void`                                               |
| <span id="action-setinit">setInit</span>                                           | `(init?: CircularViewInit \| undefined) => void`                         |
| <span id="action-showtrack">showTrack</span>                                       | `(trackId: string, initialSnapshot?: any) => any`                        |
| <span id="action-addtrackconf">addTrackConf</span>                                 | `(configuration: Record<string, unknown>, initialSnapshot?: any) => any` |
| <span id="action-hidetrack">hideTrack</span>                                       | `(trackId: string) => boolean`                                           |
| <span id="action-openexportdialog">openExportDialog</span>                         | `() => void`                                                             |
| <span id="action-resizeheight">resizeHeight</span>                                 | `(distance: number) => number`                                           |
| <span id="action-resizewidth">resizeWidth</span>                                   | `(distance: number) => number`                                           |

</details>

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

<details>
<summary>Derived from BaseViewModel</summary>

[BaseViewModel →](../baseviewmodel)

**Properties**

#### property: displayName

displayName is displayed in the header of the view, or assembly names being used
if none is specified

```ts
// type signature
type displayName = IMaybe<ISimpleType<string>>
// code
displayName: types.maybe(types.string)
```

| Member                                         | Type                                                |
| ---------------------------------------------- | --------------------------------------------------- |
| <span id="property-id">id</span>               | `IOptionalIType<ISimpleType<string>, [undefined]>`  |
| <span id="property-minimized">minimized</span> | `IOptionalIType<ISimpleType<boolean>, [undefined]>` |

**Volatiles**

| Member                                 | Type     |
| -------------------------------------- | -------- |
| <span id="volatile-width">width</span> | `number` |

**Actions**

| Member                                                 | Type                      |
| ------------------------------------------------------ | ------------------------- |
| <span id="action-setdisplayname">setDisplayName</span> | `(name: string) => void`  |
| <span id="action-setminimized">setMinimized</span>     | `(flag: boolean) => void` |

</details>
