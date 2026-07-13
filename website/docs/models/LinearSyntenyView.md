---
id: linearsyntenyview
title: LinearSyntenyView
sidebar_label: View -> LinearSyntenyView
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`linear-comparative-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/linear-comparative-view/src/LinearSyntenyView/model.ts).

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

## Members

| Member                                                                         | Kind       | Defined by                                        | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------ | ---------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [type](#property-type)                                                         | Properties | LinearSyntenyView                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [cigarMode](#property-cigarmode)                                               | Properties | LinearSyntenyView                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [drawCurves](#property-drawcurves)                                             | Properties | LinearSyntenyView                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [drawLocationMarkers](#property-drawlocationmarkers)                           | Properties | LinearSyntenyView                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [overdrawPx](#property-overdrawpx)                                             | Properties | LinearSyntenyView                                 | pixels beyond the visible viewport edge that synteny lines are still drawn                                                                                                                                                                                                                                                                                                                                                                                                   |
| [alpha](#property-alpha)                                                       | Properties | LinearSyntenyView                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [minAlignmentLength](#property-minalignmentlength)                             | Properties | LinearSyntenyView                                 | Hide alignment blocks shorter than this many bp. Enforced per-feature by its own span in buildSyntenyGeometry, then culled in the shader (isCulled) and pick engine. Cuts whole-genome hairball noise.                                                                                                                                                                                                                                                                       |
| [lodMode](#property-lodmode)                                                   | Properties | LinearSyntenyView                                 | Level-of-detail tier selection for PIF adapters. 'auto' uses the adapter's bpPerPx threshold; 'fine' forces the per-row CIGAR tier (t/q); 'coarse' forces the no-CIGAR tier (T/Q) when present.                                                                                                                                                                                                                                                                              |
| [colorBy](#property-colorby)                                                   | Properties | LinearSyntenyView                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [showColorLegend](#property-showcolorlegend)                                   | Properties | LinearSyntenyView                                 | Show the floating color-by legend in the top-right of the synteny canvas. Dismissible via the legend's close button; re-enable from the color-by (palette) menu.                                                                                                                                                                                                                                                                                                             |
| [opacityByIdentity](#property-opacitybyidentity)                               | Properties | LinearSyntenyView                                 | Fade alignment blocks by per-feature identity (lower identity = more transparent). Orthogonal to colorBy — surfaces identity-dropoff zones without consuming the color channel.                                                                                                                                                                                                                                                                                              |
| [fadeThinAlignments](#property-fadethinalignments)                             | Properties | LinearSyntenyView                                 | Fade a sub-pixel-thin ribbon's opacity by its on-screen width (see WIDTH_FADE_FLOOR in syntenyTypes.slang), so an unfiltered whole-genome view doesn't read as a hard full-opacity hairball. Off restores full per-ribbon alpha regardless of width — needed for genuinely sparse comparisons (e.g. distant-species synteny) where every real alignment is sub-pixel at whole-genome zoom and the fade would wash the view out instead of decluttering it.                   |
| [init](#property-init)                                                         | Properties | LinearSyntenyView                                 | used for initializing the view from a session snapshot. tracks is 2D — outer index is the level (the gap between views[i] and views[i+1]), so a 3-way view has two entries. example: `json { views: [ { loc: "chr1:1-100", assembly: "hg38", tracks: ["genes"] }, { loc: "chr1:1-100", assembly: "mm39" }, { loc: "chr1:1-100", assembly: "rn7" } ], tracks: [["hg38_vs_mm39_synteny"], ["mm39_vs_rn7_synteny"]] } `                                                         |
| [importFormSyntenyTrackSelections](#volatile-importformsyntenytrackselections) | Volatiles  | LinearSyntenyView                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [awaitingAutoDiagonalize](#volatile-awaitingautodiagonalize)                   | Volatiles  | LinearSyntenyView                                 | True while the init autorun is waiting for the first synteny RPC so it can diagonalize. Used to gate the canvas off — otherwise the user watches an undiagonalized hairball flash before the reorder kicks in.                                                                                                                                                                                                                                                               |
| [autoDiagonalizeRequested](#volatile-autodiagonalizerequested)                 | Volatiles  | LinearSyntenyView                                 | Set true as soon as an init-time autoDiagonalize is requested, before any render can paint. Gates `settled` (and thus the `synteny_canvas_done` test-id) so a screenshot / browser-test can't capture the pre-reorder hairball during the view-building await window, before `awaitingAutoDiagonalize` flips.                                                                                                                                                                |
| [autoDiagonalizeComplete](#volatile-autodiagonalizecomplete)                   | Volatiles  | LinearSyntenyView                                 | Set true only after the init-time DiagonalizeSynteny pass RESOLVES successfully. If the reorder is skipped or throws, this stays false so `settled` never reports done on an undiagonalized view — the capture fails loudly (times out) instead of committing a hairball.                                                                                                                                                                                                    |
| [diagonalizeStatus](#volatile-diagonalizestatus)                               | Volatiles  | LinearSyntenyView                                 | Live status from the auto-diagonalize RPC (download %, parse, algorithm phase) shown on the reordering spinner; undefined outside that wait.                                                                                                                                                                                                                                                                                                                                 |
| [diagonalizeStopToken](#volatile-diagonalizestoptoken)                         | Volatiles  | LinearSyntenyView                                 | Stop token for the in-flight auto-diagonalize, so the spinner's Cancel can abort it; undefined when none is running.                                                                                                                                                                                                                                                                                                                                                         |
| [hasSomethingToShow](#getter-hassomethingtoshow)                               | Getters    | LinearSyntenyView                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [drawCIGAR](#getter-drawcigar)                                                 | Getters    | LinearSyntenyView                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [drawCIGARMatchesOnly](#getter-drawcigarmatchesonly)                           | Getters    | LinearSyntenyView                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [hasLodCapableAdapter](#getter-haslodcapableadapter)                           | Getters    | LinearSyntenyView                                 | True if any track on any level has an adapter that declares the 'lod' capability. Used to gate the LOD menu — adapters without tiered storage (e.g. PAFAdapter, BlastTabularAdapter) have nothing to switch between.                                                                                                                                                                                                                                                         |
| [hasCigarData](#getter-hascigardata)                                           | Getters    | LinearSyntenyView                                 | True if any currently-loaded synteny display has at least one feature with a CIGAR. Used to gate CIGAR-related menu items — coarse-tier PIF files and CIGAR-less PAFs have nothing to show. Returns true while no data has loaded yet so the menu doesn't flicker between renders.                                                                                                                                                                                           |
| [presentCigarKinds](#getter-presentcigarkinds)                                 | Getters    | LinearSyntenyView                                 | Union across every loaded synteny display of which CIGAR indel ops are actually drawn on screen. The floating legend lists an indel chip only when a visible-width op of that kind is painted somewhere in the view.                                                                                                                                                                                                                                                         |
| [anchorAssemblyName](#getter-anchorassemblyname)                               | Getters    | LinearSyntenyView                                 | The "anchor" assembly for colorBy:'reference': the assembly bordering the most synteny levels. In a stacked ref-vs-A / ref-vs-B layout each interior assembly touches two levels and the ends touch one, so the max-adjacency assembly is the shared reference. Ties resolve to the topmost. Every level then colors by this assembly's chromosome names, so a region keeps its color as it's traced across levels.                                                          |
| [showLoading](#getter-showloading)                                             | Getters    | LinearSyntenyView                                 | Whether to show a loading indicator instead of the import form or view                                                                                                                                                                                                                                                                                                                                                                                                       |
| [loadingMessage](#getter-loadingmessage)                                       | Getters    | LinearSyntenyView                                 | Label for the generic loading spinner. The auto-diagonalize wait is a separate render branch (DiagonalizeLoadingScreen), so this only covers the plain "view not ready" case.                                                                                                                                                                                                                                                                                                |
| [showImportForm](#getter-showimportform)                                       | Getters    | LinearSyntenyView                                 | Whether to show the import form                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [showMenuItems](#method-showmenuitems)                                         | Methods    | LinearSyntenyView                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [headerMenuItems](#method-headermenuitems)                                     | Methods    | LinearSyntenyView                                 | includes a subset of view menu options because the full list is a little overwhelming                                                                                                                                                                                                                                                                                                                                                                                        |
| [menuItems](#method-menuitems)                                                 | Methods    | LinearSyntenyView                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [importFormRemoveRow](#action-importformremoverow)                             | Actions    | LinearSyntenyView                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [clearImportFormSyntenyTracks](#action-clearimportformsyntenytracks)           | Actions    | LinearSyntenyView                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setImportFormSyntenyTrack](#action-setimportformsyntenytrack)                 | Actions    | LinearSyntenyView                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setDrawCurves](#action-setdrawcurves)                                         | Actions    | LinearSyntenyView                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setCigarMode](#action-setcigarmode)                                           | Actions    | LinearSyntenyView                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setDrawLocationMarkers](#action-setdrawlocationmarkers)                       | Actions    | LinearSyntenyView                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setOverdrawPx](#action-setoverdrawpx)                                         | Actions    | LinearSyntenyView                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setAlpha](#action-setalpha)                                                   | Actions    | LinearSyntenyView                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setMinAlignmentLength](#action-setminalignmentlength)                         | Actions    | LinearSyntenyView                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setLodMode](#action-setlodmode)                                               | Actions    | LinearSyntenyView                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setColorBy](#action-setcolorby)                                               | Actions    | LinearSyntenyView                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setShowColorLegend](#action-setshowcolorlegend)                               | Actions    | LinearSyntenyView                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setOpacityByIdentity](#action-setopacitybyidentity)                           | Actions    | LinearSyntenyView                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setFadeThinAlignments](#action-setfadethinalignments)                         | Actions    | LinearSyntenyView                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [showAllRegions](#action-showallregions)                                       | Actions    | LinearSyntenyView                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setInit](#action-setinit)                                                     | Actions    | LinearSyntenyView                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setAwaitingAutoDiagonalize](#action-setawaitingautodiagonalize)               | Actions    | LinearSyntenyView                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setAutoDiagonalizeRequested](#action-setautodiagonalizerequested)             | Actions    | LinearSyntenyView                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setAutoDiagonalizeComplete](#action-setautodiagonalizecomplete)               | Actions    | LinearSyntenyView                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setDiagonalizeStatus](#action-setdiagonalizestatus)                           | Actions    | LinearSyntenyView                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setDiagonalizeStopToken](#action-setdiagonalizestoptoken)                     | Actions    | LinearSyntenyView                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [cancelAutoDiagonalize](#action-cancelautodiagonalize)                         | Actions    | LinearSyntenyView                                 | Abort an in-flight auto-diagonalize; the runner's finally clears the wait flag, revealing the (undiagonalized) view.                                                                                                                                                                                                                                                                                                                                                         |
| [exportSvg](#action-exportsvg)                                                 | Actions    | LinearSyntenyView                                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [id](#property-id)                                                             | Properties | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [trackSelectorType](#property-trackselectortype)                               | Properties | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [showIntraviewLinks](#property-showintraviewlinks)                             | Properties | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [linkViews](#property-linkviews)                                               | Properties | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [levels](#property-levels)                                                     | Properties | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [views](#property-views)                                                       | Properties | [LinearComparativeView](../linearcomparativeview) | N genome rows, with N-1 synteny `levels` between adjacent pairs. The views/levels invariant is maintained by reconcileLevels().                                                                                                                                                                                                                                                                                                                                              |
| [viewTrackConfigs](#property-viewtrackconfigs)                                 | Properties | [LinearComparativeView](../linearcomparativeview) | this represents tracks specific to this view specifically used for read vs ref dotplots where this track would not really apply elsewhere                                                                                                                                                                                                                                                                                                                                    |
| [width](#volatile-width)                                                       | Volatiles  | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [scrollZoom](#getter-scrollzoom)                                               | Getters    | [LinearComparativeView](../linearcomparativeview) | scroll-to-zoom is a global, personal preference resolved from the session; toggling it in any view applies everywhere                                                                                                                                                                                                                                                                                                                                                        |
| [initialized](#getter-initialized)                                             | Getters    | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [assemblyNames](#getter-assemblynames)                                         | Getters    | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [isViewCompact](#method-isviewcompact)                                         | Methods    | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [rubberBandMenuItems](#method-rubberbandmenuitems)                             | Methods    | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [reconcileLevels](#action-reconcilelevels)                                     | Actions    | [LinearComparativeView](../linearcomparativeview) | Reconcile the levels array to the views array: exactly one synteny level per gap between adjacent views (N views -> N-1 levels). Grows or shrinks from the end, preserving existing levels and their tracks. The single source of truth for the views/levels invariant.                                                                                                                                                                                                      |
| [setWidth](#action-setwidth)                                                   | Actions    | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setViews](#action-setviews)                                                   | Actions    | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [addView](#action-addview)                                                     | Actions    | [LinearComparativeView](../linearcomparativeview) | Push a new genome row. The new trailing level starts with no synteny tracks.                                                                                                                                                                                                                                                                                                                                                                                                 |
| [removeLastRow](#action-removelastrow)                                         | Actions    | [LinearComparativeView](../linearcomparativeview) | Drop the bottom genome row and its synteny level. Only terminal removal is supported: a level's `level` index addresses views[level]/[level+1], so removing a middle row would require reindexing every level below it. Growth and shrinkage both happen at the end of the chain.                                                                                                                                                                                            |
| [setLinkViews](#action-setlinkviews)                                           | Actions    | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setScrollZoom](#action-setscrollzoom)                                         | Actions    | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [activateTrackSelector](#action-activatetrackselector)                         | Actions    | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [toggleTrack](#action-toggletrack)                                             | Actions    | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [showTrack](#action-showtrack)                                                 | Actions    | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [hideTrack](#action-hidetrack)                                                 | Actions    | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [squareView](#action-squareview)                                               | Actions    | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [clearView](#action-clearview)                                                 | Actions    | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [toggleCompactView](#action-togglecompactview)                                 | Actions    | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [compactAllViews](#action-compactallviews)                                     | Actions    | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [expandAllViews](#action-expandallviews)                                       | Actions    | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [autoScaleLevelHeights](#action-autoscalelevelheights)                         | Actions    | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [appendRow](#action-appendrow)                                                 | Actions    | [LinearComparativeView](../linearcomparativeview) | Append an assembly to the bottom of the stack and optionally show a synteny track on the new level connecting it to the previous bottom row. A synteny dataset is an edge between two adjacent assemblies, so rows are only ever added at the chain's end. The new row is created with a LinearGenomeView `init` — its own afterAttach autorun loads the assembly regions and navigates (whole genome, or `loc` when given), so we don't reimplement that imperatively here. |
| [displayName](#property-displayname)                                           | Properties | [BaseViewModel](../baseviewmodel)                 | displayName is displayed in the header of the view, or assembly names being used if none is specified                                                                                                                                                                                                                                                                                                                                                                        |
| [minimized](#property-minimized)                                               | Properties | [BaseViewModel](../baseviewmodel)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setDisplayName](#action-setdisplayname)                                       | Actions    | [BaseViewModel](../baseviewmodel)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| [setMinimized](#action-setminimized)                                           | Actions    | [BaseViewModel](../baseviewmodel)                 |                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

<details>
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

#### property: showColorLegend

Show the floating color-by legend in the top-right of the synteny canvas.
Dismissible via the legend's close button; re-enable from the color-by (palette)
menu.

```ts
// type signature
type showColorLegend = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showColorLegend: types.stripDefault(types.boolean, false)
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

</details>

<details>
<summary>LinearSyntenyView - Properties (other undocumented members)</summary>

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

<details>
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

#### volatile: autoDiagonalizeRequested

Set true as soon as an init-time autoDiagonalize is requested, before any render
can paint. Gates `settled` (and thus the `synteny_canvas_done` test-id) so a
screenshot / browser-test can't capture the pre-reorder hairball during the
view-building await window, before `awaitingAutoDiagonalize` flips.

```ts
// type signature
type autoDiagonalizeRequested = false
// code
autoDiagonalizeRequested: false
```

#### volatile: autoDiagonalizeComplete

Set true only after the init-time DiagonalizeSynteny pass RESOLVES successfully.
If the reorder is skipped or throws, this stays false so `settled` never reports
done on an undiagonalized view — the capture fails loudly (times out) instead of
committing a hairball.

```ts
// type signature
type autoDiagonalizeComplete = false
// code
autoDiagonalizeComplete: false
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

</details>

<details>
<summary>LinearSyntenyView - Volatiles (other undocumented members)</summary>

#### volatile: importFormSyntenyTrackSelections

```ts
// type signature
type importFormSyntenyTrackSelections = IObservableArray<ImportFormSyntenyTrack>
// code
importFormSyntenyTrackSelections: observable.array<ImportFormSyntenyTrack>()
```

</details>

<details>
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

#### getter: presentCigarKinds

Union across every loaded synteny display of which CIGAR indel ops are actually
drawn on screen. The floating legend lists an indel chip only when a
visible-width op of that kind is painted somewhere in the view.

```ts
type presentCigarKinds = number
```

#### getter: anchorAssemblyName

The "anchor" assembly for colorBy:'reference': the assembly bordering the most
synteny levels. In a stacked ref-vs-A / ref-vs-B layout each interior assembly
touches two levels and the ends touch one, so the max-adjacency assembly is the
shared reference. Ties resolve to the topmost. Every level then colors by this
assembly's chromosome names, so a region keeps its color as it's traced across
levels.

```ts
type anchorAssemblyName = string | undefined
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

</details>

<details>
<summary>LinearSyntenyView - Getters (other undocumented members)</summary>

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

<details>
<summary>LinearSyntenyView - Methods</summary>

#### method: headerMenuItems

includes a subset of view menu options because the full list is a little
overwhelming

```ts
type headerMenuItems = () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | ... 5 more ... | { ...; })[]
```

</details>

<details>
<summary>LinearSyntenyView - Methods (other undocumented members)</summary>

#### method: showMenuItems

```ts
type showMenuItems = () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | CustomMenuItem | { ...; })[]
```

#### method: menuItems

```ts
type menuItems = () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | CustomMenuItem | { ...; })[]
```

</details>

<details>
<summary>LinearSyntenyView - Actions</summary>

#### action: cancelAutoDiagonalize

Abort an in-flight auto-diagonalize; the runner's finally clears the wait flag,
revealing the (undiagonalized) view.

```ts
type cancelAutoDiagonalize = () => void
```

</details>

<details>
<summary>LinearSyntenyView - Actions (other undocumented members)</summary>

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
type setCigarMode = (arg: 'off' | 'full' | 'matches') => void
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

#### action: setShowColorLegend

```ts
type setShowColorLegend = (arg: boolean) => void
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

#### action: setAutoDiagonalizeRequested

```ts
type setAutoDiagonalizeRequested = (arg: boolean) => void
```

#### action: setAutoDiagonalizeComplete

```ts
type setAutoDiagonalizeComplete = (arg: boolean) => void
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

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

<details>
<summary>Derived from LinearComparativeView</summary>

[LinearComparativeView →](../linearcomparativeview)

**Properties**

#### property: id

```ts
// type signature
type id = IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: trackSelectorType

```ts
// type signature
type trackSelectorType = IOptionalIType<ISimpleType<string>, [undefined]>
// code
trackSelectorType: types.stripDefault(types.string, 'hierarchical')
```

#### property: showIntraviewLinks

```ts
// type signature
type showIntraviewLinks = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showIntraviewLinks: types.stripDefault(types.boolean, true)
```

#### property: linkViews

```ts
// type signature
type linkViews = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
linkViews: types.stripDefault(types.boolean, false)
```

#### property: levels

```ts
// type signature
type levels = IArrayType<IAnyModelType>
// code
levels: types.array(LinearSyntenyViewHelper)
```

#### property: views

N genome rows, with N-1 synteny `levels` between adjacent pairs. The
views/levels invariant is maintained by reconcileLevels().

```ts
// type signature
type views = IArrayType<IModelType<_OverrideProps<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IOptionalIType<ISimpleType<boolean>, [...]>; }, { ...; }>, { ...; }>, { ...; } & ... 18 more ... & { ...; }, _NotCustomized, { ...; }>>
// code
views: types.array(
          pluginManager.getViewType('LinearGenomeView')
            .stateModel as LinearGenomeViewStateModel,
        )
```

#### property: viewTrackConfigs

this represents tracks specific to this view specifically used for read vs ref
dotplots where this track would not really apply elsewhere

```ts
// type signature
type viewTrackConfigs = IOptionalIType<IArrayType<IAnyModelType>, [undefined]>
// code
viewTrackConfigs: types.stripDefault(
  types.array(pluginManager.pluggableConfigSchemaType('track')),
  [],
)
```

**Volatiles**

#### volatile: width

```ts
// type signature
type width = number | undefined
// code
width: undefined as number | undefined
```

**Getters**

#### getter: scrollZoom

scroll-to-zoom is a global, personal preference resolved from the session;
toggling it in any view applies everywhere

```ts
type scrollZoom = boolean
```

#### getter: initialized

```ts
type initialized = boolean
```

#### getter: assemblyNames

```ts
type assemblyNames = string[]
```

**Methods**

#### method: isViewCompact

```ts
type isViewCompact = (idx: number) => boolean
```

#### method: rubberBandMenuItems

```ts
type rubberBandMenuItems = () => { label: string; onClick: () => void }[]
```

**Actions**

#### action: reconcileLevels

Reconcile the levels array to the views array: exactly one synteny level per gap
between adjacent views (N views -> N-1 levels). Grows or shrinks from the end,
preserving existing levels and their tracks. The single source of truth for the
views/levels invariant.

```ts
type reconcileLevels = () => void
```

#### action: setWidth

```ts
type setWidth = (newWidth: number) => void
```

#### action: setViews

```ts
type setViews = (views: ModelCreationType<ExtractCFromProps<_OverrideProps<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IOptionalIType<...>; }, { ...; }>, { ...; }>>>[]) => void
```

#### action: addView

Push a new genome row. The new trailing level starts with no synteny tracks.

```ts
type addView = (view: ModelCreationType<ExtractCFromProps<_OverrideProps<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayName: IMaybe<ISimpleType<string>>; minimized: IOptionalIType<...>; }, { ...; }>, { ...; }>>>) => void
```

#### action: removeLastRow

Drop the bottom genome row and its synteny level. Only terminal removal is
supported: a level's `level` index addresses views[level]/[level+1], so removing
a middle row would require reindexing every level below it. Growth and shrinkage
both happen at the end of the chain.

```ts
type removeLastRow = () => void
```

#### action: setLinkViews

```ts
type setLinkViews = (arg: boolean) => void
```

#### action: setScrollZoom

```ts
type setScrollZoom = (arg: boolean) => void
```

#### action: activateTrackSelector

```ts
type activateTrackSelector = (level: number) => Widget
```

#### action: toggleTrack

```ts
type toggleTrack = (trackId: string, level?: any) => any
```

#### action: showTrack

```ts
type showTrack = (trackId: string, level?: any, initialSnapshot?: any) => void
```

#### action: hideTrack

```ts
type hideTrack = (trackId: string, level?: any) => void
```

#### action: squareView

```ts
type squareView = () => void
```

#### action: clearView

```ts
type clearView = () => void
```

#### action: toggleCompactView

```ts
type toggleCompactView = (idx: number) => void
```

#### action: compactAllViews

```ts
type compactAllViews = () => void
```

#### action: expandAllViews

```ts
type expandAllViews = () => void
```

#### action: autoScaleLevelHeights

```ts
type autoScaleLevelHeights = () => void
```

#### action: appendRow

Append an assembly to the bottom of the stack and optionally show a synteny
track on the new level connecting it to the previous bottom row. A synteny
dataset is an edge between two adjacent assemblies, so rows are only ever added
at the chain's end.

The new row is created with a LinearGenomeView `init` — its own afterAttach
autorun loads the assembly regions and navigates (whole genome, or `loc` when
given), so we don't reimplement that imperatively here.

```ts
type appendRow = ({
  assembly,
  loc,
  syntenyTrackId,
}: {
  assembly: string
  loc?: string | undefined
  syntenyTrackId?: string | undefined
}) => void
```

</details>

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

#### property: minimized

```ts
// type signature
type minimized = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
minimized: types.stripDefault(types.boolean, false)
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
