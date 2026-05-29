---
id: linearsyntenyview
title: LinearSyntenyView
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

## Docs

extends

- [LinearComparativeView](../linearcomparativeview)

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [LinearComparativeView](../linearcomparativeview)

**Properties:** id, type, trackSelectorType, showIntraviewLinks, linkViews,
interactiveOverlay, scrollZoom, levels, views, viewTrackConfigs

**Volatiles:** width, isLoading

**Getters:** initialized, refNames, assemblyNames, loadingMessage, showLoading

**Methods:** isViewCompact, headerMenuItems, showMenuItems, menuItems,
rubberBandMenuItems

**Actions:** reconcileLevels, setWidth, setIsLoading, setViews, removeView,
addView, removeLastRow, setLinkViews, setScrollZoom, activateTrackSelector,
toggleTrack, showTrack, hideTrack, squareView, clearView, toggleCompactView,
compactAllViews, expandAllViews, autoScaleLevelHeights, appendRow

### Available via [BaseViewModel](../baseviewmodel)

**Properties:** id, displayName, minimized

**Getters:** menuItems

**Actions:** setDisplayName, setWidth, setMinimized

### LinearSyntenyView - Properties

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
cigarMode: types.optional(
          types.enumeration(['off', 'matches', 'full']),
          'full',
        )
```

#### property: drawCurves

```js
// type signature
false
// code
drawCurves: false
```

#### property: drawLocationMarkers

```js
// type signature
false
// code
drawLocationMarkers: false
```

#### property: overdrawPx

pixels beyond the visible viewport edge that synteny lines are still drawn

```js
// type signature
number
// code
overdrawPx: DEFAULT_OVERDRAW_PX
```

#### property: alpha

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
alpha: types.optional(types.number, 0.2)
```

#### property: minAlignmentLength

Hide alignment blocks shorter than this many bp. Enforced per-feature by its own
span in buildSyntenyGeometry, then culled in the shader (isCulled) and pick
engine. Cuts whole-genome hairball noise.

```js
// type signature
IOptionalIType<ISimpleType<number>, [undefined]>
// code
minAlignmentLength: types.optional(types.number, 0)
```

#### property: lodMode

Level-of-detail tier selection for PIF adapters. 'auto' uses the adapter's
bpPerPx threshold; 'fine' forces the per-row CIGAR tier (t/q); 'coarse' forces
the no-CIGAR tier (T/Q) when present.

```js
// type signature
IOptionalIType<ISimpleType<"auto" | "fine" | "coarse">, [undefined]>
// code
lodMode: types.optional(
          types.enumeration('LodMode', ['auto', 'fine', 'coarse']),
          'auto',
        )
```

#### property: colorBy

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
colorBy: types.optional(types.string, 'default')
```

#### property: opacityByIdentity

Fade alignment blocks by per-feature identity (lower identity = more
transparent). Orthogonal to colorBy — surfaces identity-dropoff zones without
consuming the color channel.

```js
// type signature
IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
opacityByIdentity: types.optional(types.boolean, false)
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

### LinearSyntenyView - Volatiles

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

### LinearSyntenyView - Getters

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

Override the base loadingMessage so the spinner has a helpful label during the
autoDiagonalize wait, instead of just "Loading".

```js
// type
;'Loading' | 'Reordering chromosomes…' | undefined
```

#### getter: showImportForm

Whether to show the import form

```js
// type
boolean
```

### LinearSyntenyView - Methods

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

### LinearSyntenyView - Actions

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
