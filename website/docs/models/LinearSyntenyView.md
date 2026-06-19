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
  },
}
```

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
[scrollZoom](../linearcomparativeview#property-scrollzoom),
[levels](../linearcomparativeview#property-levels),
[views](../linearcomparativeview#property-views),
[viewTrackConfigs](../linearcomparativeview#property-viewtrackconfigs)

**Volatiles:** [width](../linearcomparativeview#volatile-width)

**Getters:** [initialized](../linearcomparativeview#getter-initialized),
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
[removeView](../linearcomparativeview#action-removeview),
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

#### property: overdrawPx

pixels beyond the visible viewport edge that synteny lines are still drawn

```ts
// type signature
type overdrawPx = IOptionalIType<ISimpleType<number>, [undefined]>
// code
overdrawPx: types.stripDefault(types.number, DEFAULT_OVERDRAW_PX)
```

#### property: alpha

```ts
// type signature
type alpha = IOptionalIType<ISimpleType<number>, [undefined]>
// code
alpha: types.stripDefault(types.number, 0.2)
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

#### property: colorBy

```ts
// type signature
type colorBy = IOptionalIType<ISimpleType<string>, [undefined]>
// code
colorBy: types.stripDefault(types.string, 'default')
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

</details>

<details open>
<summary>LinearSyntenyView - Volatiles</summary>

#### volatile: importFormSyntenyTrackSelections

```ts
// type signature
type importFormSyntenyTrackSelections = IObservableArray<ImportFormSyntenyTrack>
// code
importFormSyntenyTrackSelections: observable.array<ImportFormSyntenyTrack>()
```

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

</details>

<details open>
<summary>LinearSyntenyView - Getters</summary>

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

Label for the loading spinner: a helpful message during the autoDiagonalize
wait, otherwise just "Loading".

```ts
type loadingMessage = 'Loading' | 'Reordering chromosomes' | undefined
```

#### getter: showImportForm

Whether to show the import form

```ts
type showImportForm = boolean
```

</details>

<details open>
<summary>LinearSyntenyView - Methods</summary>

#### method: showMenuItems

```ts
type showMenuItems = () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | { ...; })[]
```

#### method: headerMenuItems

includes a subset of view menu options because the full list is a little
overwhelming

```ts
type headerMenuItems = () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | ... 4 more ... | { ...; })[]
```

#### method: menuItems

```ts
type menuItems = () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | { ...; })[]
```

</details>

<details open>
<summary>LinearSyntenyView - Actions</summary>

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

#### action: exportSvg

```ts
type exportSvg = (opts: ExportSvgOptions) => Promise<void>
```

</details>
