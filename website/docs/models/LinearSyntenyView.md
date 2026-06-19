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

<details>
<summary>LinearSyntenyView - Properties</summary>

#### property: type

```js
// type signature
ISimpleType<"LinearSyntenyView">
// code
type: types.literal('LinearSyntenyView')
```

#### property: cigarMode

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
cigarMode: types.stripDefault(
          types.enumeration(['off', 'matches', 'full']),
          'full',
        )
```

#### property: drawCurves

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
drawCurves: types.stripDefault(types.boolean, false)
```

#### property: drawLocationMarkers

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
drawLocationMarkers: types.stripDefault(types.boolean, false)
```

#### property: overdrawPx

pixels beyond the visible viewport edge that synteny lines are still drawn

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
overdrawPx: types.stripDefault(types.number, DEFAULT_OVERDRAW_PX)
```

#### property: alpha

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
alpha: types.stripDefault(types.number, 0.2)
```

#### property: minAlignmentLength

Hide alignment blocks shorter than this many bp. Enforced per-feature by its own
span in buildSyntenyGeometry, then culled in the shader (isCulled) and pick
engine. Cuts whole-genome hairball noise.

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
minAlignmentLength: types.stripDefault(types.number, 0)
```

#### property: lodMode

Level-of-detail tier selection for PIF adapters. 'auto' uses the adapter's
bpPerPx threshold; 'fine' forces the per-row CIGAR tier (t/q); 'coarse' forces
the no-CIGAR tier (T/Q) when present.

```js
// type signature
IOptionalIType<ISimpleType<"auto" | "fine" | "coarse">, [undefined]>
// code
lodMode: types.stripDefault(
          types.enumeration('LodMode', ['auto', 'fine', 'coarse']),
          'auto',
        )
```

#### property: colorBy

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
colorBy: types.stripDefault(types.string, 'default')
```

#### property: opacityByIdentity

Fade alignment blocks by per-feature identity (lower identity = more
transparent). Orthogonal to colorBy — surfaces identity-dropoff zones without
consuming the color channel.

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
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

```js
// type signature
IType<LinearSyntenyViewInit | undefined, LinearSyntenyViewInit | undefined, LinearSyntenyViewInit | undefined>
// code
init: types.frozen<LinearSyntenyViewInit | undefined>()
```

</details>

<details>
<summary>LinearSyntenyView - Volatiles</summary>

#### volatile: importFormSyntenyTrackSelections

```js
// type signature
IObservableArray<ImportFormSyntenyTrack>
// code
importFormSyntenyTrackSelections:
        observable.array<ImportFormSyntenyTrack>()
```

#### volatile: awaitingAutoDiagonalize

True while the init autorun is waiting for the first synteny RPC so it can
diagonalize. Used to gate the canvas off — otherwise the user watches an
undiagonalized hairball flash before the reorder kicks in.

```js
// type signature
false
// code
awaitingAutoDiagonalize: false
```

</details>

<details>
<summary>LinearSyntenyView - Getters</summary>

#### getter: hasSomethingToShow

```js
// type
boolean
```

#### getter: drawCIGAR

```js
// type
boolean
```

#### getter: drawCIGARMatchesOnly

```js
// type
boolean
```

#### getter: hasLodCapableAdapter

True if any track on any level has an adapter that declares the 'lod'
capability. Used to gate the LOD menu — adapters without tiered storage (e.g.
PAFAdapter, BlastTabularAdapter) have nothing to switch between.

```js
// type
boolean
```

#### getter: hasCigarData

True if any currently-loaded synteny display has at least one feature with a
CIGAR. Used to gate CIGAR-related menu items — coarse-tier PIF files and
CIGAR-less PAFs have nothing to show. Returns true while no data has loaded yet
so the menu doesn't flicker between renders.

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

#### getter: loadingMessage

Label for the loading spinner: a helpful message during the autoDiagonalize
wait, otherwise just "Loading".

```js
// type
;'Loading' | 'Reordering chromosomes' | undefined
```

#### getter: showImportForm

Whether to show the import form

```js
// type
boolean
```

</details>

<details>
<summary>LinearSyntenyView - Methods</summary>

#### method: showMenuItems

```js
// type signature
showMenuItems: () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | { ...; })[]
```

#### method: headerMenuItems

includes a subset of view menu options because the full list is a little
overwhelming

```js
// type signature
headerMenuItems: () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | ... 4 more ... | { ...; })[]
```

#### method: menuItems

```js
// type signature
menuItems: () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | { ...; })[]
```

</details>

<details>
<summary>LinearSyntenyView - Actions</summary>

#### action: importFormRemoveRow

```js
// type signature
importFormRemoveRow: (idx: number) => void
```

#### action: clearImportFormSyntenyTracks

```js
// type signature
clearImportFormSyntenyTracks: () => void
```

#### action: setImportFormSyntenyTrack

```js
// type signature
setImportFormSyntenyTrack: (arg: number, val: ImportFormSyntenyTrack) => void
```

#### action: setDrawCurves

```js
// type signature
setDrawCurves: (arg: boolean) => void
```

#### action: setCigarMode

```js
// type signature
setCigarMode: (arg: "off" | "matches" | "full") => void
```

#### action: setDrawLocationMarkers

```js
// type signature
setDrawLocationMarkers: (arg: boolean) => void
```

#### action: setOverdrawPx

```js
// type signature
setOverdrawPx: (arg: number) => void
```

#### action: setAlpha

```js
// type signature
setAlpha: (arg: number) => void
```

#### action: setMinAlignmentLength

```js
// type signature
setMinAlignmentLength: (arg: number) => void
```

#### action: setLodMode

```js
// type signature
setLodMode: (arg: "auto" | "fine" | "coarse") => void
```

#### action: setColorBy

```js
// type signature
setColorBy: (arg: SyntenyColorBy) => void
```

#### action: setOpacityByIdentity

```js
// type signature
setOpacityByIdentity: (arg: boolean) => void
```

#### action: showAllRegions

```js
// type signature
showAllRegions: () => void
```

#### action: setInit

```js
// type signature
setInit: (init?: LinearSyntenyViewInit | undefined) => void
```

#### action: setAwaitingAutoDiagonalize

```js
// type signature
setAwaitingAutoDiagonalize: (arg: boolean) => void
```

#### action: exportSvg

```js
// type signature
exportSvg: (opts: ExportSvgOptions) => Promise<void>
```

</details>
