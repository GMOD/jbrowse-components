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

| Member                                                                         | Kind       | Defined by                                        | Description                                                                                                                                                                                             |
| ------------------------------------------------------------------------------ | ---------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [type](#property-type)                                                         | Properties | LinearSyntenyView                                 |                                                                                                                                                                                                         |
| [cigarMode](#property-cigarmode)                                               | Properties | LinearSyntenyView                                 |                                                                                                                                                                                                         |
| [drawCurves](#property-drawcurves)                                             | Properties | LinearSyntenyView                                 |                                                                                                                                                                                                         |
| [drawLocationMarkers](#property-drawlocationmarkers)                           | Properties | LinearSyntenyView                                 |                                                                                                                                                                                                         |
| [overdrawPx](#property-overdrawpx)                                             | Properties | LinearSyntenyView                                 | pixels beyond the visible viewport edge that synteny lines are still drawn                                                                                                                              |
| [alpha](#property-alpha)                                                       | Properties | LinearSyntenyView                                 |                                                                                                                                                                                                         |
| [minAlignmentLength](#property-minalignmentlength)                             | Properties | LinearSyntenyView                                 | Hide alignment blocks shorter than this many bp.                                                                                                                                                        |
| [lodMode](#property-lodmode)                                                   | Properties | LinearSyntenyView                                 | Level-of-detail tier selection for PIF adapters.                                                                                                                                                        |
| [colorBy](#property-colorby)                                                   | Properties | LinearSyntenyView                                 |                                                                                                                                                                                                         |
| [showColorLegend](#property-showcolorlegend)                                   | Properties | LinearSyntenyView                                 | Show the floating color-by legend in the top-right of the synteny canvas.                                                                                                                               |
| [opacityByIdentity](#property-opacitybyidentity)                               | Properties | LinearSyntenyView                                 | Fade alignment blocks by per-feature identity (lower identity = more transparent).                                                                                                                      |
| [fadeThinAlignmentsMode](#property-fadethinalignmentsmode)                     | Properties | LinearSyntenyView                                 | Whether to fade a sub-pixel-thin ribbon's opacity by its on-screen width (see WIDTH_FADE_FLOOR in syntenyTypes.slang), so an unfiltered whole-genome view doesn't read as a hard full-opacity hairball. |
| [init](#property-init)                                                         | Properties | LinearSyntenyView                                 | used for initializing the view from a session snapshot.                                                                                                                                                 |
| [importFormSyntenyTrackSelections](#volatile-importformsyntenytrackselections) | Volatiles  | LinearSyntenyView                                 |                                                                                                                                                                                                         |
| [awaitingAutoDiagonalize](#volatile-awaitingautodiagonalize)                   | Volatiles  | LinearSyntenyView                                 | True while the init autorun is waiting for the first synteny RPC so it can diagonalize.                                                                                                                 |
| [autoDiagonalizeRequested](#volatile-autodiagonalizerequested)                 | Volatiles  | LinearSyntenyView                                 | Set true as soon as an init-time autoDiagonalize is requested, before any render can paint.                                                                                                             |
| [autoDiagonalizeComplete](#volatile-autodiagonalizecomplete)                   | Volatiles  | LinearSyntenyView                                 | Set true only after the init-time DiagonalizeSynteny pass RESOLVES successfully.                                                                                                                        |
| [diagonalizeStatus](#volatile-diagonalizestatus)                               | Volatiles  | LinearSyntenyView                                 | Live status from the auto-diagonalize RPC (download %, parse, algorithm phase) shown on the reordering spinner; undefined outside that wait.                                                            |
| [diagonalizeStopToken](#volatile-diagonalizestoptoken)                         | Volatiles  | LinearSyntenyView                                 | Stop token for the in-flight auto-diagonalize, so the spinner's Cancel can abort it; undefined when none is running.                                                                                    |
| [hasSomethingToShow](#getter-hassomethingtoshow)                               | Getters    | LinearSyntenyView                                 |                                                                                                                                                                                                         |
| [showAssemblyNameInSubviewScalebar](#getter-showassemblynameinsubviewscalebar) | Getters    | LinearSyntenyView                                 | Opt each sub-view's scalebar into prefixing its refName labels with the assembly name (e.g. "hg38:chr1"), so stacked genome rows of different assemblies stay distinguishable.                          |
| [drawCIGAR](#getter-drawcigar)                                                 | Getters    | LinearSyntenyView                                 |                                                                                                                                                                                                         |
| [drawCIGARMatchesOnly](#getter-drawcigarmatchesonly)                           | Getters    | LinearSyntenyView                                 |                                                                                                                                                                                                         |
| [hasLodCapableAdapter](#getter-haslodcapableadapter)                           | Getters    | LinearSyntenyView                                 | True if any track on any level has an adapter that declares the 'lod' capability.                                                                                                                       |
| [hasCigarData](#getter-hascigardata)                                           | Getters    | LinearSyntenyView                                 | True if any currently-loaded synteny display has at least one feature with a CIGAR.                                                                                                                     |
| [presentCigarKinds](#getter-presentcigarkinds)                                 | Getters    | LinearSyntenyView                                 | Union across every loaded synteny display of which CIGAR indel ops are actually drawn on screen.                                                                                                        |
| [fadeThinAlignments](#getter-fadethinalignments)                               | Getters    | LinearSyntenyView                                 | Resolved fade-thin flag that renderParams reads.                                                                                                                                                        |
| [anchorAssemblyName](#getter-anchorassemblyname)                               | Getters    | LinearSyntenyView                                 | The "anchor" assembly for colorBy:'reference': the assembly bordering the most synteny levels.                                                                                                          |
| [showLoading](#getter-showloading)                                             | Getters    | LinearSyntenyView                                 | Whether to show a loading indicator instead of the import form or view                                                                                                                                  |
| [loadingMessage](#getter-loadingmessage)                                       | Getters    | LinearSyntenyView                                 | Label for the generic loading spinner.                                                                                                                                                                  |
| [showImportForm](#getter-showimportform)                                       | Getters    | LinearSyntenyView                                 | Whether to show the import form                                                                                                                                                                         |
| [showMenuItems](#method-showmenuitems)                                         | Methods    | LinearSyntenyView                                 |                                                                                                                                                                                                         |
| [headerMenuItems](#method-headermenuitems)                                     | Methods    | LinearSyntenyView                                 | includes a subset of view menu options because the full list is a little overwhelming                                                                                                                   |
| [menuItems](#method-menuitems)                                                 | Methods    | LinearSyntenyView                                 |                                                                                                                                                                                                         |
| [importFormRemoveRow](#action-importformremoverow)                             | Actions    | LinearSyntenyView                                 | Remove the pair-selection at the given index — the pair that vanishes when an assembly row is removed.                                                                                                  |
| [clearImportFormSyntenyTracks](#action-clearimportformsyntenytracks)           | Actions    | LinearSyntenyView                                 |                                                                                                                                                                                                         |
| [setImportFormSyntenyTrack](#action-setimportformsyntenytrack)                 | Actions    | LinearSyntenyView                                 |                                                                                                                                                                                                         |
| [setDrawCurves](#action-setdrawcurves)                                         | Actions    | LinearSyntenyView                                 |                                                                                                                                                                                                         |
| [setCigarMode](#action-setcigarmode)                                           | Actions    | LinearSyntenyView                                 |                                                                                                                                                                                                         |
| [setDrawLocationMarkers](#action-setdrawlocationmarkers)                       | Actions    | LinearSyntenyView                                 |                                                                                                                                                                                                         |
| [setOverdrawPx](#action-setoverdrawpx)                                         | Actions    | LinearSyntenyView                                 |                                                                                                                                                                                                         |
| [setAlpha](#action-setalpha)                                                   | Actions    | LinearSyntenyView                                 |                                                                                                                                                                                                         |
| [setMinAlignmentLength](#action-setminalignmentlength)                         | Actions    | LinearSyntenyView                                 |                                                                                                                                                                                                         |
| [setLodMode](#action-setlodmode)                                               | Actions    | LinearSyntenyView                                 |                                                                                                                                                                                                         |
| [setColorBy](#action-setcolorby)                                               | Actions    | LinearSyntenyView                                 |                                                                                                                                                                                                         |
| [setShowColorLegend](#action-setshowcolorlegend)                               | Actions    | LinearSyntenyView                                 |                                                                                                                                                                                                         |
| [setOpacityByIdentity](#action-setopacitybyidentity)                           | Actions    | LinearSyntenyView                                 |                                                                                                                                                                                                         |
| [setFadeThinAlignmentsMode](#action-setfadethinalignmentsmode)                 | Actions    | LinearSyntenyView                                 |                                                                                                                                                                                                         |
| [showAllRegions](#action-showallregions)                                       | Actions    | LinearSyntenyView                                 |                                                                                                                                                                                                         |
| [setInit](#action-setinit)                                                     | Actions    | LinearSyntenyView                                 |                                                                                                                                                                                                         |
| [setAwaitingAutoDiagonalize](#action-setawaitingautodiagonalize)               | Actions    | LinearSyntenyView                                 |                                                                                                                                                                                                         |
| [setAutoDiagonalizeRequested](#action-setautodiagonalizerequested)             | Actions    | LinearSyntenyView                                 |                                                                                                                                                                                                         |
| [setAutoDiagonalizeComplete](#action-setautodiagonalizecomplete)               | Actions    | LinearSyntenyView                                 |                                                                                                                                                                                                         |
| [setDiagonalizeStatus](#action-setdiagonalizestatus)                           | Actions    | LinearSyntenyView                                 |                                                                                                                                                                                                         |
| [setDiagonalizeStopToken](#action-setdiagonalizestoptoken)                     | Actions    | LinearSyntenyView                                 |                                                                                                                                                                                                         |
| [cancelAutoDiagonalize](#action-cancelautodiagonalize)                         | Actions    | LinearSyntenyView                                 | Abort an in-flight auto-diagonalize; the runner's finally clears the wait flag, revealing the (undiagonalized) view.                                                                                    |
| [exportSvg](#action-exportsvg)                                                 | Actions    | LinearSyntenyView                                 |                                                                                                                                                                                                         |
| [id](#property-id)                                                             | Properties | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                         |
| [trackSelectorType](#property-trackselectortype)                               | Properties | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                         |
| [showIntraviewLinks](#property-showintraviewlinks)                             | Properties | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                         |
| [linkViews](#property-linkviews)                                               | Properties | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                         |
| [levels](#property-levels)                                                     | Properties | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                         |
| [views](#property-views)                                                       | Properties | [LinearComparativeView](../linearcomparativeview) | N genome rows, with N-1 synteny `levels` between adjacent pairs.                                                                                                                                        |
| [viewTrackConfigs](#property-viewtrackconfigs)                                 | Properties | [LinearComparativeView](../linearcomparativeview) | this represents tracks specific to this view specifically used for read vs ref dotplots where this track would not really apply elsewhere                                                               |
| [width](#volatile-width)                                                       | Volatiles  | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                         |
| [scrollZoom](#getter-scrollzoom)                                               | Getters    | [LinearComparativeView](../linearcomparativeview) | scroll-to-zoom is a global, personal preference resolved from the session; toggling it in any view applies everywhere                                                                                   |
| [initialized](#getter-initialized)                                             | Getters    | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                         |
| [assemblyNames](#getter-assemblynames)                                         | Getters    | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                         |
| [isViewCompact](#method-isviewcompact)                                         | Methods    | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                         |
| [rubberBandMenuItems](#method-rubberbandmenuitems)                             | Methods    | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                         |
| [reconcileLevels](#action-reconcilelevels)                                     | Actions    | [LinearComparativeView](../linearcomparativeview) | Reconcile the levels array to the views array: exactly one synteny level per gap between adjacent views (N views -> N-1 levels).                                                                        |
| [setWidth](#action-setwidth)                                                   | Actions    | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                         |
| [setViews](#action-setviews)                                                   | Actions    | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                         |
| [addView](#action-addview)                                                     | Actions    | [LinearComparativeView](../linearcomparativeview) | Push a new genome row.                                                                                                                                                                                  |
| [removeLastRow](#action-removelastrow)                                         | Actions    | [LinearComparativeView](../linearcomparativeview) | Drop the bottom genome row and its synteny level.                                                                                                                                                       |
| [setLinkViews](#action-setlinkviews)                                           | Actions    | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                         |
| [setScrollZoom](#action-setscrollzoom)                                         | Actions    | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                         |
| [activateTrackSelector](#action-activatetrackselector)                         | Actions    | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                         |
| [toggleTrack](#action-toggletrack)                                             | Actions    | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                         |
| [showTrack](#action-showtrack)                                                 | Actions    | [LinearComparativeView](../linearcomparativeview) | No-op for a level that doesn't exist, matching hideTrack/toggleTrack.                                                                                                                                   |
| [hideTrack](#action-hidetrack)                                                 | Actions    | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                         |
| [squareView](#action-squareview)                                               | Actions    | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                         |
| [clearView](#action-clearview)                                                 | Actions    | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                         |
| [toggleCompactView](#action-togglecompactview)                                 | Actions    | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                         |
| [compactAllViews](#action-compactallviews)                                     | Actions    | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                         |
| [expandAllViews](#action-expandallviews)                                       | Actions    | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                         |
| [autoScaleLevelHeights](#action-autoscalelevelheights)                         | Actions    | [LinearComparativeView](../linearcomparativeview) |                                                                                                                                                                                                         |
| [appendRow](#action-appendrow)                                                 | Actions    | [LinearComparativeView](../linearcomparativeview) | Append an assembly to the bottom of the stack and optionally show a synteny track on the new level connecting it to the previous bottom row.                                                            |
| [displayName](#property-displayname)                                           | Properties | [BaseViewModel](../baseviewmodel)                 | displayName is displayed in the header of the view, or assembly names being used if none is specified                                                                                                   |
| [minimized](#property-minimized)                                               | Properties | [BaseViewModel](../baseviewmodel)                 |                                                                                                                                                                                                         |
| [setDisplayName](#action-setdisplayname)                                       | Actions    | [BaseViewModel](../baseviewmodel)                 |                                                                                                                                                                                                         |
| [setMinimized](#action-setminimized)                                           | Actions    | [BaseViewModel](../baseviewmodel)                 |                                                                                                                                                                                                         |

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

#### property: fadeThinAlignmentsMode

Whether to fade a sub-pixel-thin ribbon's opacity by its on-screen width (see
WIDTH_FADE_FLOOR in syntenyTypes.slang), so an unfiltered whole-genome view
doesn't read as a hard full-opacity hairball. 'auto' enables the fade once a
display is dominated by sub-pixel ribbons (see
LinearSyntenyDisplay.autoFadeThinAlignments); a genuinely sparse comparison
(only a handful of ribbons) keeps full alpha so the fade doesn't wash it out.
'on'/'off' pin it. Resolved by the `fadeThinAlignments` getter.

```ts
// type signature
type fadeThinAlignmentsMode = IOptionalIType<
  ISimpleType<'auto' | 'off' | 'on'>,
  [undefined]
>
// code
fadeThinAlignmentsMode: types.stripDefault(
  types.enumeration('FadeThinMode', ['auto', 'on', 'off']),
  'auto',
)
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

| Member                                                             | Type                                                |
| ------------------------------------------------------------------ | --------------------------------------------------- |
| <span id="property-type">type</span>                               | `ISimpleType<"LinearSyntenyView">`                  |
| <span id="property-cigarmode">cigarMode</span>                     | `IOptionalIType<ISimpleType<string>, [undefined]>`  |
| <span id="property-drawcurves">drawCurves</span>                   | `IOptionalIType<ISimpleType<boolean>, [undefined]>` |
| <span id="property-drawlocationmarkers">drawLocationMarkers</span> | `IOptionalIType<ISimpleType<boolean>, [undefined]>` |
| <span id="property-alpha">alpha</span>                             | `IOptionalIType<ISimpleType<number>, [undefined]>`  |
| <span id="property-colorby">colorBy</span>                         | `IOptionalIType<ISimpleType<string>, [undefined]>`  |

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

| Member                                                                                       | Type                                       |
| -------------------------------------------------------------------------------------------- | ------------------------------------------ |
| <span id="volatile-importformsyntenytrackselections">importFormSyntenyTrackSelections</span> | `IObservableArray<ImportFormSyntenyTrack>` |

</details>

<details>
<summary>LinearSyntenyView - Getters</summary>

#### getter: showAssemblyNameInSubviewScalebar

Opt each sub-view's scalebar into prefixing its refName labels with the assembly
name (e.g. "hg38:chr1"), so stacked genome rows of different assemblies stay
distinguishable. Read duck-typed by the child LinearGenomeView
(scalebarDisplayPrefix) to avoid an upward plugin dependency.

```ts
type showAssemblyNameInSubviewScalebar = boolean
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
CIGAR-less PAFs have nothing to show. Optimistic while no display has finished a
fetch yet, so the menu is there from the first render rather than popping in
once data lands (the common case: most synteny files carry CIGARs). A view with
no synteny tracks at all has nothing to gate, so it reports false.

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

#### getter: fadeThinAlignments

Resolved fade-thin flag that renderParams reads. In 'auto' mode the fade turns
on once any loaded synteny display is dominated by sub-pixel ribbons
(`autoFadeThinAlignments` — a thin hairball that benefits from decluttering); a
sparse view keeps its few ribbons at full alpha. 'on'/'off' pin it.

```ts
type fadeThinAlignments = boolean
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

| Member                                                             | Type      |
| ------------------------------------------------------------------ | --------- |
| <span id="getter-hassomethingtoshow">hasSomethingToShow</span>     | `boolean` |
| <span id="getter-drawcigar">drawCIGAR</span>                       | `boolean` |
| <span id="getter-drawcigarmatchesonly">drawCIGARMatchesOnly</span> | `boolean` |

</details>

<details>
<summary>LinearSyntenyView - Methods</summary>

#### method: headerMenuItems

includes a subset of view menu options because the full list is a little
overwhelming

```ts
type headerMenuItems = () => (MenuDivider | MenuSubHeader | NormalMenuItem | CheckboxMenuItem | RadioMenuItem | SubMenuItem | ... 4 more ... | { ...; })[]
```

</details>

<details>
<summary>LinearSyntenyView - Methods (other undocumented members)</summary>

| Member                                               | Type                                                                                                                                         |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| <span id="method-showmenuitems">showMenuItems</span> | `() => (MenuDivider \| MenuSubHeader \| NormalMenuItem \| CheckboxMenuItem \| RadioMenuItem \| SubMenuItem \| CustomMenuItem \| { ...; })[]` |
| <span id="method-menuitems">menuItems</span>         | `() => (MenuDivider \| MenuSubHeader \| NormalMenuItem \| CheckboxMenuItem \| RadioMenuItem \| SubMenuItem \| CustomMenuItem \| { ...; })[]` |

</details>

<details>
<summary>LinearSyntenyView - Actions</summary>

#### action: importFormRemoveRow

Remove the pair-selection at the given index — the pair that vanishes when an
assembly row is removed. The caller computes which pair index that is, since the
row-to-pair mapping lives with the React-side assembly list.

```ts
type importFormRemoveRow = (pairIdx: number) => void
```

#### action: cancelAutoDiagonalize

Abort an in-flight auto-diagonalize; the runner's finally clears the wait flag,
revealing the (undiagonalized) view.

```ts
type cancelAutoDiagonalize = () => void
```

</details>

<details>
<summary>LinearSyntenyView - Actions (other undocumented members)</summary>

| Member                                                                             | Type                                                                                                                                  |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| <span id="action-clearimportformsyntenytracks">clearImportFormSyntenyTracks</span> | `() => void`                                                                                                                          |
| <span id="action-setimportformsyntenytrack">setImportFormSyntenyTrack</span>       | `(arg: number, val: ImportFormSyntenyTrack) => void`                                                                                  |
| <span id="action-setdrawcurves">setDrawCurves</span>                               | `(arg: boolean) => void`                                                                                                              |
| <span id="action-setcigarmode">setCigarMode</span>                                 | `(arg: "off" \| "full" \| "matches") => void`                                                                                         |
| <span id="action-setdrawlocationmarkers">setDrawLocationMarkers</span>             | `(arg: boolean) => void`                                                                                                              |
| <span id="action-setoverdrawpx">setOverdrawPx</span>                               | `(arg: number) => void`                                                                                                               |
| <span id="action-setalpha">setAlpha</span>                                         | `(arg: number) => void`                                                                                                               |
| <span id="action-setminalignmentlength">setMinAlignmentLength</span>               | `(arg: number) => void`                                                                                                               |
| <span id="action-setlodmode">setLodMode</span>                                     | `(arg: "auto" \| "fine" \| "coarse") => void`                                                                                         |
| <span id="action-setcolorby">setColorBy</span>                                     | `(arg: "default" \| "strand" \| "query" \| "target" \| "reference" \| "identity" \| "meanQueryIdentity" \| "mappingQuality") => void` |
| <span id="action-setshowcolorlegend">setShowColorLegend</span>                     | `(arg: boolean) => void`                                                                                                              |
| <span id="action-setopacitybyidentity">setOpacityByIdentity</span>                 | `(arg: boolean) => void`                                                                                                              |
| <span id="action-setfadethinalignmentsmode">setFadeThinAlignmentsMode</span>       | `(arg: "auto" \| "off" \| "on") => void`                                                                                              |
| <span id="action-showallregions">showAllRegions</span>                             | `() => void`                                                                                                                          |
| <span id="action-setinit">setInit</span>                                           | `(init?: LinearSyntenyViewInit \| undefined) => void`                                                                                 |
| <span id="action-setawaitingautodiagonalize">setAwaitingAutoDiagonalize</span>     | `(arg: boolean) => void`                                                                                                              |
| <span id="action-setautodiagonalizerequested">setAutoDiagonalizeRequested</span>   | `(arg: boolean) => void`                                                                                                              |
| <span id="action-setautodiagonalizecomplete">setAutoDiagonalizeComplete</span>     | `(arg: boolean) => void`                                                                                                              |
| <span id="action-setdiagonalizestatus">setDiagonalizeStatus</span>                 | `(arg?: RpcStatus \| undefined) => void`                                                                                              |
| <span id="action-setdiagonalizestoptoken">setDiagonalizeStopToken</span>           | `(arg?: StopToken \| undefined) => void`                                                                                              |
| <span id="action-exportsvg">exportSvg</span>                                       | `(opts: ExportSvgOptions) => Promise<void>`                                                                                           |

</details>

## Inherited members

Members available on this model via composition, shown in full so this page is
self-contained. A member redeclared by a more specific model is shown once, at
its most-specific definition.

<details>
<summary>Derived from LinearComparativeView</summary>

[LinearComparativeView →](../linearcomparativeview)

**Properties**

#### property: views

N genome rows, with N-1 synteny `levels` between adjacent pairs. The
views/levels invariant is maintained by reconcileLevels().

```ts
// type signature
type views = IArrayType<IModelType<_OverrideProps<_OverrideProps<…>, { ...; }>, { ...; } & ... 19 more ... & { ...; }, _NotCustomized, { ...; }>>
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

| Member                                                           | Type                                                |
| ---------------------------------------------------------------- | --------------------------------------------------- |
| <span id="property-id">id</span>                                 | `IOptionalIType<ISimpleType<string>, [undefined]>`  |
| <span id="property-trackselectortype">trackSelectorType</span>   | `IOptionalIType<ISimpleType<string>, [undefined]>`  |
| <span id="property-showintraviewlinks">showIntraviewLinks</span> | `IOptionalIType<ISimpleType<boolean>, [undefined]>` |
| <span id="property-linkviews">linkViews</span>                   | `IOptionalIType<ISimpleType<boolean>, [undefined]>` |
| <span id="property-levels">levels</span>                         | `IArrayType<IAnyModelType>`                         |

**Volatiles**

| Member                                 | Type                  |
| -------------------------------------- | --------------------- |
| <span id="volatile-width">width</span> | `number \| undefined` |

**Getters**

#### getter: scrollZoom

scroll-to-zoom is a global, personal preference resolved from the session;
toggling it in any view applies everywhere

```ts
type scrollZoom = boolean
```

| Member                                               | Type       |
| ---------------------------------------------------- | ---------- |
| <span id="getter-initialized">initialized</span>     | `boolean`  |
| <span id="getter-assemblynames">assemblyNames</span> | `string[]` |

**Methods**

| Member                                                           | Type                                              |
| ---------------------------------------------------------------- | ------------------------------------------------- |
| <span id="method-isviewcompact">isViewCompact</span>             | `(idx: number) => boolean`                        |
| <span id="method-rubberbandmenuitems">rubberBandMenuItems</span> | `() => { label: string; onClick: () => void; }[]` |

**Actions**

#### action: reconcileLevels

Reconcile the levels array to the views array: exactly one synteny level per gap
between adjacent views (N views -> N-1 levels). Grows or shrinks from the end,
preserving existing levels and their tracks. The single source of truth for the
views/levels invariant.

```ts
type reconcileLevels = () => void
```

#### action: addView

Push a new genome row. The new trailing level starts with no synteny tracks.

```ts
type addView = (view: ModelCreationType<ExtractCFromProps<_OverrideProps<_OverrideProps<…>, { ...; }>>>) => void
```

#### action: removeLastRow

Drop the bottom genome row and its synteny level. Only terminal removal is
supported: a level's `level` index addresses views[level]/[level+1], so removing
a middle row would require reindexing every level below it. Growth and shrinkage
both happen at the end of the chain.

```ts
type removeLastRow = () => void
```

#### action: showTrack

No-op for a level that doesn't exist, matching hideTrack/toggleTrack.
reconcileLevels already materializes exactly one level per adjacent view pair,
so a missing level means the caller named a gap that has no views (e.g. an
`init.tracks` with more levels than `init.views` has gaps); creating one here
would append a level whose views[level+1] is absent, which renders nothing and
silently breaks the views/levels invariant.

```ts
type showTrack = (trackId: string, level?: any, initialSnapshot?: any) => void
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

| Member                                                               | Type                                                                                                   |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| <span id="action-setwidth">setWidth</span>                           | `(newWidth: number) => void`                                                                           |
| <span id="action-setviews">setViews</span>                           | `(views: ModelCreationType<ExtractCFromProps<_OverrideProps<_OverrideProps<…>, { ...; }>>>[]) => void` |
| <span id="action-setlinkviews">setLinkViews</span>                   | `(arg: boolean) => void`                                                                               |
| <span id="action-setscrollzoom">setScrollZoom</span>                 | `(arg: boolean) => void`                                                                               |
| <span id="action-activatetrackselector">activateTrackSelector</span> | `(level: number) => Widget`                                                                            |
| <span id="action-toggletrack">toggleTrack</span>                     | `(trackId: string, level?: any) => any`                                                                |
| <span id="action-hidetrack">hideTrack</span>                         | `(trackId: string, level?: any) => void`                                                               |
| <span id="action-squareview">squareView</span>                       | `() => void`                                                                                           |
| <span id="action-clearview">clearView</span>                         | `() => void`                                                                                           |
| <span id="action-togglecompactview">toggleCompactView</span>         | `(idx: number) => void`                                                                                |
| <span id="action-compactallviews">compactAllViews</span>             | `() => void`                                                                                           |
| <span id="action-expandallviews">expandAllViews</span>               | `() => void`                                                                                           |
| <span id="action-autoscalelevelheights">autoScaleLevelHeights</span> | `() => void`                                                                                           |

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

| Member                                         | Type                                                |
| ---------------------------------------------- | --------------------------------------------------- |
| <span id="property-minimized">minimized</span> | `IOptionalIType<ISimpleType<boolean>, [undefined]>` |

**Actions**

| Member                                                 | Type                      |
| ------------------------------------------------------ | ------------------------- |
| <span id="action-setdisplayname">setDisplayName</span> | `(name: string) => void`  |
| <span id="action-setminimized">setMinimized</span>     | `(flag: boolean) => void` |

</details>
