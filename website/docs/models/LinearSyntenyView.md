---
id: linearsyntenyview
title: LinearSyntenyView
sidebar_label: View -> LinearSyntenyView
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LinearSyntenyView/model.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/LinearSyntenyView.md)

## Example usage

Hand-authored under `defaultSession.views`. `init.views` declares the two member
assemblies (stacked as linear views) and `tracks` the synteny feature track
connecting them with a ribbon:

```js
{
  type: 'LinearSyntenyView',
  init: {
    views: [{ assembly: 'hg38' }, { assembly: 'mm10' }],
    tracks: ['hg38_vs_mm10.paf'],
    drawCurves: true,
  },
}
```

Other `init` fields: `colorBy`, `levelHeights`, `alpha`, `minAlignmentLength`,
`autoDiagonalize` — see the `init` property below.

## Overview

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [LinearComparativeView](../linearcomparativeview)

**Properties:** [id](../linearcomparativeview#property-id),
[type](../linearcomparativeview#property-type),
[trackSelectorType](../linearcomparativeview#property-trackselectortype),
[showIntraviewLinks](../linearcomparativeview#property-showintraviewlinks),
[linkViews](../linearcomparativeview#property-linkviews),
[interactiveOverlay](../linearcomparativeview#property-interactiveoverlay),
[levels](../linearcomparativeview#property-levels),
[views](../linearcomparativeview#property-views),
[viewTrackConfigs](../linearcomparativeview#property-viewtrackconfigs)

**Volatiles:** [width](../linearcomparativeview#volatile-width)

**Getters:** [scrollZoom](../linearcomparativeview#getter-scrollzoom),
[initialized](../linearcomparativeview#getter-initialized),
[refNames](../linearcomparativeview#getter-refnames),
[assemblyNames](../linearcomparativeview#getter-assemblynames)

**Methods:** [isViewCompact](../linearcomparativeview#method-isviewcompact),
[headerMenuItems](../linearcomparativeview#method-headermenuitems),
[showMenuItems](../linearcomparativeview#method-showmenuitems),
[menuItems](../linearcomparativeview#method-menuitems),
[rubberBandMenuItems](../linearcomparativeview#method-rubberbandmenuitems)

**Actions:** [reconcileLevels](../linearcomparativeview#action-reconcilelevels),
[setWidth](../linearcomparativeview#action-setwidth),
[setViews](../linearcomparativeview#action-setviews),
[addView](../linearcomparativeview#action-addview),
[removeLastRow](../linearcomparativeview#action-removelastrow),
[setLinkViews](../linearcomparativeview#action-setlinkviews),
[setScrollZoom](../linearcomparativeview#action-setscrollzoom),
[activateTrackSelector](../linearcomparativeview#action-activatetrackselector),
[toggleTrack](../linearcomparativeview#action-toggletrack),
[showTrack](../linearcomparativeview#action-showtrack),
[hideTrack](../linearcomparativeview#action-hidetrack),
[squareView](../linearcomparativeview#action-squareview),
[clearView](../linearcomparativeview#action-clearview),
[toggleCompactView](../linearcomparativeview#action-togglecompactview),
[compactAllViews](../linearcomparativeview#action-compactallviews),
[expandAllViews](../linearcomparativeview#action-expandallviews),
[autoScaleLevelHeights](../linearcomparativeview#action-autoscalelevelheights),
[appendRow](../linearcomparativeview#action-appendrow)

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
<summary>LinearSyntenyView - Properties</summary>

#### property: overdrawPx

pixels beyond the visible viewport edge that synteny lines are still drawn

```ts
// type signature
type overdrawPx = IOptionalIType<ISimpleType<number>, [undefined]>
// code
overdrawPx: types.stripDefault(types.number, DEFAULT_OVERDRAW_PX)
```

#### property: minAlignmentLength

Hide alignment blocks shorter than this many bp. Enforced per-feature by its own
span in buildSyntenyGeometry, then culled in the shader (isCulled) and pick
engine. Cuts whole-genome hairball noise.

```ts
// type signature
type minAlignmentLength = IOptionalIType<ISimpleType<number>, [undefined]>
// code
minAlignmentLength: types.stripDefault(types.number, 0)
```

#### property: lodMode

Level-of-detail tier selection for PIF adapters. 'auto' uses the adapter's
bpPerPx threshold; 'fine' forces the per-row CIGAR tier (t/q); 'coarse' forces
the no-CIGAR tier (T/Q) when present.

```ts
// type signature
type lodMode = IOptionalIType<
  ISimpleType<'auto' | 'fine' | 'coarse'>,
  [undefined]
>
// code
lodMode: types.stripDefault(
  types.enumeration('LodMode', ['auto', 'fine', 'coarse']),
  'auto',
)
```

#### property: opacityByIdentity

Fade alignment blocks by per-feature identity (lower identity = more
transparent). Orthogonal to colorBy — surfaces identity-dropoff zones without
consuming the color channel.

```ts
// type signature
type opacityByIdentity = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
opacityByIdentity: types.stripDefault(types.boolean, false)
```

#### property: fadeThinAlignments

Fade a sub-pixel-thin ribbon's opacity by its on-screen width (see
WIDTH_FADE_FLOOR in syntenyTypes.slang), so an unfiltered whole-genome view
doesn't read as a hard full-opacity hairball. Off restores full per-ribbon alpha
regardless of width — needed for genuinely sparse comparisons (e.g.
distant-species synteny) where every real alignment is sub-pixel at whole-genome
zoom and the fade would wash the view out instead of decluttering it.

```ts
// type signature
type fadeThinAlignments = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
fadeThinAlignments: types.stripDefault(types.boolean, true)
```

#### property: init

used for initializing the view from a session snapshot. tracks is 2D — outer
index is the level (the gap between views[i] and views[i+1]), so a 3-way view
has two entries. example:

```json
{
  "views": [
    { "loc": "chr1:1-100", "assembly": "hg38", "tracks": ["genes"] },
    { "loc": "chr1:1-100", "assembly": "mm39" },
    { "loc": "chr1:1-100", "assembly": "rn7" }
  ],
  "tracks": [["hg38_vs_mm39_synteny"], ["mm39_vs_rn7_synteny"]]
}
```

```ts
// type signature
type init = IType<
  LinearSyntenyViewInit | undefined,
  LinearSyntenyViewInit | undefined,
  LinearSyntenyViewInit | undefined
>
// code
init: types.frozen<LinearSyntenyViewInit | undefined>()
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                 | Signature                                           |
| ------------------------------------------------------ | --------------------------------------------------- |
| [`type`](#property-type)                               | `ISimpleType<"LinearSyntenyView">`                  |
| [`cigarMode`](#property-cigarmode)                     | `IOptionalIType<ISimpleType<string>, [undefined]>`  |
| [`drawCurves`](#property-drawcurves)                   | `IOptionalIType<ISimpleType<boolean>, [undefined]>` |
| [`drawLocationMarkers`](#property-drawlocationmarkers) | `IOptionalIType<ISimpleType<boolean>, [undefined]>` |
| [`alpha`](#property-alpha)                             | `IOptionalIType<ISimpleType<number>, [undefined]>`  |
| [`colorBy`](#property-colorby)                         | `IOptionalIType<ISimpleType<string>, [undefined]>`  |

</details>

<details>
<summary>LinearSyntenyView - Properties (all signatures)</summary>

#### property: type

```ts
// type signature
type type = ISimpleType<'LinearSyntenyView'>
// code
type: types.literal('LinearSyntenyView')
```

#### property: cigarMode

```ts
// type signature
type cigarMode = IOptionalIType<ISimpleType<string>, [undefined]>
// code
cigarMode: types.stripDefault(
  types.enumeration(['off', 'matches', 'full']),
  'full',
)
```

#### property: drawCurves

```ts
// type signature
type drawCurves = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
drawCurves: types.stripDefault(types.boolean, false)
```

#### property: drawLocationMarkers

```ts
// type signature
type drawLocationMarkers = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
drawLocationMarkers: types.stripDefault(types.boolean, false)
```

#### property: alpha

```ts
// type signature
type alpha = IOptionalIType<ISimpleType<number>, [undefined]>
// code
alpha: types.stripDefault(types.number, 0.2)
```

#### property: colorBy

```ts
// type signature
type colorBy = IOptionalIType<ISimpleType<string>, [undefined]>
// code
colorBy: types.stripDefault(types.string, 'default')
```

</details>

<details open>
<summary>LinearSyntenyView - Volatiles</summary>

#### volatile: awaitingAutoDiagonalize

True while the init autorun is waiting for the first synteny RPC so it can
diagonalize. Used to gate the canvas off — otherwise the user watches an
undiagonalized hairball flash before the reorder kicks in.

```ts
// type signature
type awaitingAutoDiagonalize = false
// code
awaitingAutoDiagonalize: false
```

#### volatile: diagonalizeStatus

Live status from the auto-diagonalize RPC (download %, parse, algorithm phase)
shown on the reordering spinner; undefined outside that wait.

```ts
// type signature
type diagonalizeStatus = RpcStatus | undefined
// code
diagonalizeStatus: undefined as RpcStatus | undefined
```

#### volatile: diagonalizeStopToken

Stop token for the in-flight auto-diagonalize, so the spinner's Cancel can abort
it; undefined when none is running.

```ts
// type signature
type diagonalizeStopToken = StopToken | undefined
// code
diagonalizeStopToken: undefined as StopToken | undefined
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                                           | Signature                                  |
| -------------------------------------------------------------------------------- | ------------------------------------------ |
| [`importFormSyntenyTrackSelections`](#volatile-importformsyntenytrackselections) | `IObservableArray<ImportFormSyntenyTrack>` |

</details>

<details>
<summary>LinearSyntenyView - Volatiles (all signatures)</summary>

#### volatile: importFormSyntenyTrackSelections

```ts
// type signature
type importFormSyntenyTrackSelections = IObservableArray<ImportFormSyntenyTrack>
// code
importFormSyntenyTrackSelections: observable.array<ImportFormSyntenyTrack>()
```

</details>

<details open>
<summary>LinearSyntenyView - Getters</summary>

#### getter: hasLodCapableAdapter

True if any track on any level has an adapter that declares the 'lod'
capability. Used to gate the LOD menu — adapters without tiered storage (e.g.
PAFAdapter, BlastTabularAdapter) have nothing to switch between.

```ts
type hasLodCapableAdapter = boolean
```

#### getter: hasCigarData

True if any currently-loaded synteny display has at least one feature with a
CIGAR. Used to gate CIGAR-related menu items — coarse-tier PIF files and
CIGAR-less PAFs have nothing to show. Returns true while no data has loaded yet
so the menu doesn't flicker between renders.

```ts
type hasCigarData = boolean
```

#### getter: showLoading

Whether to show a loading indicator instead of the import form or view

```ts
type showLoading = boolean
```

#### getter: loadingMessage

Label for the generic loading spinner. The auto-diagonalize wait is a separate
render branch (DiagonalizeLoadingScreen), so this only covers the plain "view
not ready" case.

```ts
type loadingMessage = 'Loading' | undefined
```

#### getter: showImportForm

Whether to show the import form

```ts
type showImportForm = boolean
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                 | Signature |
| ------------------------------------------------------ | --------- |
| [`hasSomethingToShow`](#getter-hassomethingtoshow)     | `boolean` |
| [`drawCIGAR`](#getter-drawcigar)                       | `boolean` |
| [`drawCIGARMatchesOnly`](#getter-drawcigarmatchesonly) | `boolean` |

</details>

<details>
<summary>LinearSyntenyView - Getters (all signatures)</summary>

#### getter: hasSomethingToShow

```ts
type hasSomethingToShow = boolean
```

#### getter: drawCIGAR

```ts
type drawCIGAR = boolean
```

#### getter: drawCIGARMatchesOnly

```ts
type drawCIGARMatchesOnly = boolean
```

</details>

<details open>
<summary>LinearSyntenyView - Methods</summary>

#### method: headerMenuItems

includes a subset of view menu options because the full list is a little
overwhelming

```ts
type headerMenuItems = () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | ... 4 more ... | { ...; })[]
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                   | Signature                                                                                                                  |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| [`showMenuItems`](#method-showmenuitems) | `() => (MenuDivider \| MenuSubHeader \| NormalMenuItem \| CheckboxMenuItem \| RadioMenuItem \| SubMenuItem \| { ...; })[]` |
| [`menuItems`](#method-menuitems)         | `() => (MenuDivider \| MenuSubHeader \| NormalMenuItem \| CheckboxMenuItem \| RadioMenuItem \| SubMenuItem \| { ...; })[]` |

</details>

<details>
<summary>LinearSyntenyView - Methods (all signatures)</summary>

#### method: showMenuItems

```ts
type showMenuItems = () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | { ...; })[]
```

#### method: menuItems

```ts
type menuItems = () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | { ...; })[]
```

</details>

<details open>
<summary>LinearSyntenyView - Actions</summary>

#### action: cancelAutoDiagonalize

Abort an in-flight auto-diagonalize; the runner's finally clears the wait flag,
revealing the (undiagonalized) view.

```ts
type cancelAutoDiagonalize = () => void
```

**Other members** (undocumented — signatures only, expand below for full
detail):

| Member                                                                 | Signature                                             |
| ---------------------------------------------------------------------- | ----------------------------------------------------- |
| [`importFormRemoveRow`](#action-importformremoverow)                   | `(idx: number) => void`                               |
| [`clearImportFormSyntenyTracks`](#action-clearimportformsyntenytracks) | `() => void`                                          |
| [`setImportFormSyntenyTrack`](#action-setimportformsyntenytrack)       | `(arg: number, val: ImportFormSyntenyTrack) => void`  |
| [`setDrawCurves`](#action-setdrawcurves)                               | `(arg: boolean) => void`                              |
| [`setCigarMode`](#action-setcigarmode)                                 | `(arg: "off" \| "matches" \| "full") => void`         |
| [`setDrawLocationMarkers`](#action-setdrawlocationmarkers)             | `(arg: boolean) => void`                              |
| [`setOverdrawPx`](#action-setoverdrawpx)                               | `(arg: number) => void`                               |
| [`setAlpha`](#action-setalpha)                                         | `(arg: number) => void`                               |
| [`setMinAlignmentLength`](#action-setminalignmentlength)               | `(arg: number) => void`                               |
| [`setLodMode`](#action-setlodmode)                                     | `(arg: "auto" \| "fine" \| "coarse") => void`         |
| [`setColorBy`](#action-setcolorby)                                     | `(arg: SyntenyColorBy) => void`                       |
| [`setOpacityByIdentity`](#action-setopacitybyidentity)                 | `(arg: boolean) => void`                              |
| [`setFadeThinAlignments`](#action-setfadethinalignments)               | `(arg: boolean) => void`                              |
| [`showAllRegions`](#action-showallregions)                             | `() => void`                                          |
| [`setInit`](#action-setinit)                                           | `(init?: LinearSyntenyViewInit \| undefined) => void` |
| [`setAwaitingAutoDiagonalize`](#action-setawaitingautodiagonalize)     | `(arg: boolean) => void`                              |
| [`setDiagonalizeStatus`](#action-setdiagonalizestatus)                 | `(arg?: RpcStatus \| undefined) => void`              |
| [`setDiagonalizeStopToken`](#action-setdiagonalizestoptoken)           | `(arg?: StopToken \| undefined) => void`              |
| [`exportSvg`](#action-exportsvg)                                       | `(opts: ExportSvgOptions) => Promise<void>`           |

</details>

<details>
<summary>LinearSyntenyView - Actions (all signatures)</summary>

#### action: importFormRemoveRow

```ts
type importFormRemoveRow = (idx: number) => void
```

#### action: clearImportFormSyntenyTracks

```ts
type clearImportFormSyntenyTracks = () => void
```

#### action: setImportFormSyntenyTrack

```ts
type setImportFormSyntenyTrack = (
  arg: number,
  val: ImportFormSyntenyTrack,
) => void
```

#### action: setDrawCurves

```ts
type setDrawCurves = (arg: boolean) => void
```

#### action: setCigarMode

```ts
type setCigarMode = (arg: 'off' | 'matches' | 'full') => void
```

#### action: setDrawLocationMarkers

```ts
type setDrawLocationMarkers = (arg: boolean) => void
```

#### action: setOverdrawPx

```ts
type setOverdrawPx = (arg: number) => void
```

#### action: setAlpha

```ts
type setAlpha = (arg: number) => void
```

#### action: setMinAlignmentLength

```ts
type setMinAlignmentLength = (arg: number) => void
```

#### action: setLodMode

```ts
type setLodMode = (arg: 'auto' | 'fine' | 'coarse') => void
```

#### action: setColorBy

```ts
type setColorBy = (arg: SyntenyColorBy) => void
```

#### action: setOpacityByIdentity

```ts
type setOpacityByIdentity = (arg: boolean) => void
```

#### action: setFadeThinAlignments

```ts
type setFadeThinAlignments = (arg: boolean) => void
```

#### action: showAllRegions

```ts
type showAllRegions = () => void
```

#### action: setInit

```ts
type setInit = (init?: LinearSyntenyViewInit | undefined) => void
```

#### action: setAwaitingAutoDiagonalize

```ts
type setAwaitingAutoDiagonalize = (arg: boolean) => void
```

#### action: setDiagonalizeStatus

```ts
type setDiagonalizeStatus = (arg?: RpcStatus | undefined) => void
```

#### action: setDiagonalizeStopToken

```ts
type setDiagonalizeStopToken = (arg?: StopToken | undefined) => void
```

#### action: exportSvg

```ts
type exportSvg = (opts: ExportSvgOptions) => Promise<void>
```

</details>
