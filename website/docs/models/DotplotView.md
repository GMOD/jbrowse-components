---
id: dotplotview
title: DotplotView
sidebar_label: View -> DotplotView
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Provided by the
`dotplot-view` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/dotplot-view/src/DotplotView/model.ts).

## Example usage

Hand-authored under `defaultSession.views`. `init.views` lists the two
assemblies on the axes and `tracks` the synteny track(s) to plot (self-vs-self
is allowed):

```js
{
  type: 'DotplotView',
  init: {
    views: [{ assembly: 'hg38' }, { assembly: 'mm10' }],
    tracks: ['hg38_vs_mm10.paf'],
    colorBy: 'query',
  },
}
```

Other `init` fields: `autoDiagonalize`, `minAlignmentLength`, and a per-axis
`loc` on each `views` entry — see the `init` property below.

## Overview

## Members

| Member                                                                         | Kind       | Description                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [id](#property-id)                                                             | Properties |                                                                                                                                                                                                                                                                           |
| [type](#property-type)                                                         | Properties |                                                                                                                                                                                                                                                                           |
| [height](#property-height)                                                     | Properties |                                                                                                                                                                                                                                                                           |
| [trackSelectorType](#property-trackselectortype)                               | Properties |                                                                                                                                                                                                                                                                           |
| [assemblyNames](#property-assemblynames)                                       | Properties |                                                                                                                                                                                                                                                                           |
| [drawCigar](#property-drawcigar)                                               | Properties |                                                                                                                                                                                                                                                                           |
| [lodMode](#property-lodmode)                                                   | Properties | Level-of-detail tier override for PIF adapters. 'auto' uses the adapter's bpPerPx threshold; 'fine'/'coarse' force a tier. Stored view-level so all displays render at the same tier and the menu doesn't need to fan out per display.                                    |
| [lockAspectRatio](#property-lockaspectratio)                                   | Properties | When true, hview and vview are kept at the same bpPerPx so the dotplot stays square. Wheel zoom already preserves the ratio; box-zoom and other independent ops trigger an autorun resync.                                                                                |
| [lineWidth](#property-linewidth)                                               | Properties | Screen-space line width (CSS pixels) applied to every dotplot display in this view. View-level because the GPU pass renders all displays with one uniform.                                                                                                                |
| [hview](#property-hview)                                                       | Properties |                                                                                                                                                                                                                                                                           |
| [vview](#property-vview)                                                       | Properties |                                                                                                                                                                                                                                                                           |
| [tracks](#property-tracks)                                                     | Properties |                                                                                                                                                                                                                                                                           |
| [viewTrackConfigs](#property-viewtrackconfigs)                                 | Properties | this represents tracks specific to this view specifically used for read vs ref dotplots where this track would not really apply elsewhere                                                                                                                                 |
| [init](#property-init)                                                         | Properties | used for initializing the view from a session snapshot                                                                                                                                                                                                                    |
| [highlight](#property-highlight)                                               | Properties | translucent highlight bands drawn per-axis: vertical when the region's assembly matches hview, horizontal when it matches vview                                                                                                                                           |
| [highlightsVisible](#property-highlightsvisible)                               | Properties | controls whether view.highlight entries are rendered                                                                                                                                                                                                                      |
| [showHighlightChips](#property-showhighlightchips)                             | Properties | controls whether the interactive highlight chip (link icon + context menu) is drawn on each highlight band; off by default                                                                                                                                                |
| [showColorLegend](#property-showcolorlegend)                                   | Properties | Show the floating color-by legend in the top-right of the plot. Dismissible via the legend's close button; re-enable from the color-by (palette) menu.                                                                                                                    |
| [volatileWidth](#volatile-volatilewidth)                                       | Volatiles  |                                                                                                                                                                                                                                                                           |
| [volatileError](#volatile-volatileerror)                                       | Volatiles  |                                                                                                                                                                                                                                                                           |
| [cursorMode](#volatile-cursormode)                                             | Volatiles  | these are 'personal preferences', stored in volatile and loaded/written to localStorage                                                                                                                                                                                   |
| [importFormSyntenyTrackSelections](#volatile-importformsyntenytrackselections) | Volatiles  |                                                                                                                                                                                                                                                                           |
| [awaitingAutoDiagonalize](#volatile-awaitingautodiagonalize)                   | Volatiles  | True while the init autorun is waiting for the first dotplot RPC so it can run the DiagonalizeDotplot pass. Used to gate showLoading on so the user sees a spinner with "Reordering chromosomes…" instead of an undiagonalized plot that immediately re-paints.           |
| [diagonalizeStatus](#volatile-diagonalizestatus)                               | Volatiles  | Live status from the auto-diagonalize RPC (download %, parse, algorithm phase) shown on the reordering spinner; undefined outside that wait.                                                                                                                              |
| [diagonalizeStopToken](#volatile-diagonalizestoptoken)                         | Volatiles  | Stop token for the in-flight auto-diagonalize, so the spinner's Cancel can abort it; undefined when none is running.                                                                                                                                                      |
| [autoDiagonalizeRequested](#volatile-autodiagonalizerequested)                 | Volatiles  | Set true as soon as an init-time autoDiagonalize is requested, before any render can paint. Gates `settled` (and thus the `dotplot_webgl_canvas_done` test-id) so a screenshot / browser-test can't capture the pre-reorder plot.                                         |
| [autoDiagonalizeComplete](#volatile-autodiagonalizecomplete)                   | Volatiles  | Set true only after the init-time DiagonalizeDotplot pass RESOLVES successfully. If the reorder is skipped or throws, this stays false so `settled` never reports done on an undiagonalized plot — the capture fails loudly (times out) instead of committing a hairball. |
| [width](#getter-width)                                                         | Getters    |                                                                                                                                                                                                                                                                           |
| [borderX](#getter-borderx)                                                     | Getters    | Left margin: fits the vertical (vview) axis labels. Derived purely from that axis's regions + zoom — never from viewWidth — so it can't feed back through viewWidth = width - borderX into a render loop.                                                                 |
| [borderY](#getter-bordery)                                                     | Getters    | Bottom margin: fits the horizontal (hview) axis labels. See borderX.                                                                                                                                                                                                      |
| [assemblyErrors](#getter-assemblyerrors)                                       | Getters    |                                                                                                                                                                                                                                                                           |
| [assembliesInitialized](#getter-assembliesinitialized)                         | Getters    |                                                                                                                                                                                                                                                                           |
| [initialized](#getter-initialized)                                             | Getters    |                                                                                                                                                                                                                                                                           |
| [hticks](#getter-hticks)                                                       | Getters    |                                                                                                                                                                                                                                                                           |
| [vticks](#getter-vticks)                                                       | Getters    |                                                                                                                                                                                                                                                                           |
| [hTickPositions](#getter-htickpositions)                                       | Getters    |                                                                                                                                                                                                                                                                           |
| [vTickPositions](#getter-vtickpositions)                                       | Getters    |                                                                                                                                                                                                                                                                           |
| [hasSomethingToShow](#getter-hassomethingtoshow)                               | Getters    |                                                                                                                                                                                                                                                                           |
| [showImportForm](#getter-showimportform)                                       | Getters    | Whether to show the import form                                                                                                                                                                                                                                           |
| [showLoading](#getter-showloading)                                             | Getters    | Whether to show a loading indicator instead of the import form or view                                                                                                                                                                                                    |
| [loadingMessage](#getter-loadingmessage)                                       | Getters    | Label for the generic loading spinner. The auto-diagonalize wait is a separate render branch (DiagonalizeLoadingScreen), so this only covers the plain "view not ready" case.                                                                                             |
| [viewWidth](#getter-viewwidth)                                                 | Getters    |                                                                                                                                                                                                                                                                           |
| [viewHeight](#getter-viewheight)                                               | Getters    |                                                                                                                                                                                                                                                                           |
| [hblockLabelKeysToHide](#getter-hblocklabelkeystohide)                         | Getters    |                                                                                                                                                                                                                                                                           |
| [vblockLabelKeysToHide](#getter-vblocklabelkeystohide)                         | Getters    |                                                                                                                                                                                                                                                                           |
| [views](#getter-views)                                                         | Getters    |                                                                                                                                                                                                                                                                           |
| [dotplotDisplays](#getter-dotplotdisplays)                                     | Getters    | DotplotDisplays under each track, indexed to match `tracks`.                                                                                                                                                                                                              |
| [settled](#getter-settled)                                                     | Getters    | Canvas has painted and no display is still fetching, so what's on screen is the final settled content. Drives the `dotplot_webgl_canvas_done` test-id that screenshot capture and the browser-test suites wait on — so it must mean "done", not just "first paint".       |
| [hasLodCapableAdapter](#getter-haslodcapableadapter)                           | Getters    | True if any track has an adapter that declares the 'lod' capability. Used to gate the LOD menu — only PIF supports it.                                                                                                                                                    |
| [geometryByTrackIndex](#getter-geometrybytrackindex)                           | Getters    | Per-display GPU geometry keyed by track index. The upload autorun diffs this map: new entries upload, vanished entries evict.                                                                                                                                             |
| [dotplotRenderState](#getter-dotplotrenderstate)                               | Getters    | Aggregated per-frame render state. Built by walking each display that has uploaded geometry; returns undefined when none do, which gates the render pass.                                                                                                                 |
| [error](#getter-error)                                                         | Getters    |                                                                                                                                                                                                                                                                           |
| [getHHighlightCoords](#method-gethhighlightcoords)                             | Methods    | Map a highlight/bookmark region to {left, width} px on the horizontal axis. left is already screen-offset. Returns undefined when the region isn't on hview's assembly/displayed regions.                                                                                 |
| [getVHighlightCoords](#method-getvhighlightcoords)                             | Methods    | Map a highlight/bookmark region to {top, height} px on the vertical axis. The vview lays out bottom-to-top, so the band is y-flipped into screen space. Returns undefined when the region isn't on vview.                                                                 |
| [menuItems](#method-menuitems)                                                 | Methods    |                                                                                                                                                                                                                                                                           |
| [setImportFormSyntenyTrack](#action-setimportformsyntenytrack)                 | Actions    |                                                                                                                                                                                                                                                                           |
| [startRenderingBackend](#action-startrenderingbackend)                         | Actions    |                                                                                                                                                                                                                                                                           |
| [setCursorMode](#action-setcursormode)                                         | Actions    |                                                                                                                                                                                                                                                                           |
| [setDrawCigar](#action-setdrawcigar)                                           | Actions    |                                                                                                                                                                                                                                                                           |
| [setLodMode](#action-setlodmode)                                               | Actions    |                                                                                                                                                                                                                                                                           |
| [setLockAspectRatio](#action-setlockaspectratio)                               | Actions    |                                                                                                                                                                                                                                                                           |
| [syncBpPerPx](#action-syncbpperpx)                                             | Actions    | Equalize hview/vview bpPerPx without recentering. Used by the aspect-lock autorun to absorb divergence from box-zoom and similar operations while preserving the user's current pan position.                                                                             |
| [setLineWidth](#action-setlinewidth)                                           | Actions    |                                                                                                                                                                                                                                                                           |
| [addToHighlights](#action-addtohighlights)                                     | Actions    |                                                                                                                                                                                                                                                                           |
| [setHighlight](#action-sethighlight)                                           | Actions    |                                                                                                                                                                                                                                                                           |
| [removeHighlight](#action-removehighlight)                                     | Actions    |                                                                                                                                                                                                                                                                           |
| [setHighlightsVisible](#action-sethighlightsvisible)                           | Actions    |                                                                                                                                                                                                                                                                           |
| [setShowHighlightChips](#action-setshowhighlightchips)                         | Actions    |                                                                                                                                                                                                                                                                           |
| [setShowColorLegend](#action-setshowcolorlegend)                               | Actions    |                                                                                                                                                                                                                                                                           |
| [clearView](#action-clearview)                                                 | Actions    | returns to the import form                                                                                                                                                                                                                                                |
| [setWidth](#action-setwidth)                                                   | Actions    |                                                                                                                                                                                                                                                                           |
| [setHeight](#action-setheight)                                                 | Actions    |                                                                                                                                                                                                                                                                           |
| [setError](#action-seterror)                                                   | Actions    |                                                                                                                                                                                                                                                                           |
| [setInit](#action-setinit)                                                     | Actions    |                                                                                                                                                                                                                                                                           |
| [setAwaitingAutoDiagonalize](#action-setawaitingautodiagonalize)               | Actions    |                                                                                                                                                                                                                                                                           |
| [setAutoDiagonalizeRequested](#action-setautodiagonalizerequested)             | Actions    |                                                                                                                                                                                                                                                                           |
| [setAutoDiagonalizeComplete](#action-setautodiagonalizecomplete)               | Actions    |                                                                                                                                                                                                                                                                           |
| [setDiagonalizeStatus](#action-setdiagonalizestatus)                           | Actions    |                                                                                                                                                                                                                                                                           |
| [setDiagonalizeStopToken](#action-setdiagonalizestoptoken)                     | Actions    |                                                                                                                                                                                                                                                                           |
| [cancelAutoDiagonalize](#action-cancelautodiagonalize)                         | Actions    | Abort an in-flight auto-diagonalize; the runner's finally clears the wait flag, revealing the (undiagonalized) plot.                                                                                                                                                      |
| [zoomOut](#action-zoomout)                                                     | Actions    |                                                                                                                                                                                                                                                                           |
| [zoomIn](#action-zoomin)                                                       | Actions    |                                                                                                                                                                                                                                                                           |
| [activateTrackSelector](#action-activatetrackselector)                         | Actions    |                                                                                                                                                                                                                                                                           |
| [showTrack](#action-showtrack)                                                 | Actions    |                                                                                                                                                                                                                                                                           |
| [hideTrack](#action-hidetrack)                                                 | Actions    |                                                                                                                                                                                                                                                                           |
| [toggleTrack](#action-toggletrack)                                             | Actions    |                                                                                                                                                                                                                                                                           |
| [setAssemblyNames](#action-setassemblynames)                                   | Actions    |                                                                                                                                                                                                                                                                           |
| [getCoords](#action-getcoords)                                                 | Actions    |                                                                                                                                                                                                                                                                           |
| [zoomInToMouseCoords](#action-zoomintomousecoords)                             | Actions    | zooms into clicked and dragged region                                                                                                                                                                                                                                     |
| [showAllRegions](#action-showallregions)                                       | Actions    |                                                                                                                                                                                                                                                                           |
| [initializeDisplayedRegions](#action-initializedisplayedregions)               | Actions    |                                                                                                                                                                                                                                                                           |
| [onDotplotView](#action-ondotplotview)                                         | Actions    | creates a linear synteny view from the clicked and dragged region                                                                                                                                                                                                         |
| [exportSvg](#action-exportsvg)                                                 | Actions    | creates an svg export and save using FileSaver                                                                                                                                                                                                                            |
| [applySquare](#action-applysquare)                                             | Actions    |                                                                                                                                                                                                                                                                           |
| [squareView](#action-squareview)                                               | Actions    |                                                                                                                                                                                                                                                                           |
| [squareViewProportional](#action-squareviewproportional)                       | Actions    |                                                                                                                                                                                                                                                                           |

## Inherited members

Available on this model via composition. Follow each link for full signatures
and docs.

### Available via [BaseViewModel](../baseviewmodel)

**Properties:** [id](../baseviewmodel#property-id),
[displayName](../baseviewmodel#property-displayname),
[minimized](../baseviewmodel#property-minimized)

**Volatiles:** [width](../baseviewmodel#volatile-width)

**Methods:** [menuItems](../baseviewmodel#method-menuitems)

**Actions:** [setDisplayName](../baseviewmodel#action-setdisplayname),
[setWidth](../baseviewmodel#action-setwidth),
[setMinimized](../baseviewmodel#action-setminimized)

### Available via [RenderLifecycleMixin](../renderlifecyclemixin)

**Volatiles:** [canvasDrawn](../renderlifecyclemixin#volatile-canvasdrawn),
[currentRenderingBackend](../renderlifecyclemixin#volatile-currentrenderingbackend),
[renderTick](../renderlifecyclemixin#volatile-rendertick),
[autorunsInstalled](../renderlifecyclemixin#volatile-autorunsinstalled),
[renderError](../renderlifecyclemixin#volatile-rendererror)

**Actions:** [markCanvasDrawn](../renderlifecyclemixin#action-markcanvasdrawn),
[resetCanvasDrawn](../renderlifecyclemixin#action-resetcanvasdrawn),
[stopRenderingBackend](../renderlifecyclemixin#action-stoprenderingbackend),
[renderNow](../renderlifecyclemixin#action-rendernow),
[setRenderError](../renderlifecyclemixin#action-setrendererror),
[attachRenderingBackend](../renderlifecyclemixin#action-attachrenderingbackend)

<details>
<summary>DotplotView - Properties</summary>

#### property: lodMode

Level-of-detail tier override for PIF adapters. 'auto' uses the adapter's
bpPerPx threshold; 'fine'/'coarse' force a tier. Stored view-level so all
displays render at the same tier and the menu doesn't need to fan out per
display.

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

#### property: lockAspectRatio

When true, hview and vview are kept at the same bpPerPx so the dotplot stays
square. Wheel zoom already preserves the ratio; box-zoom and other independent
ops trigger an autorun resync.

```ts
// type signature
type lockAspectRatio = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
lockAspectRatio: types.stripDefault(types.boolean, false)
```

#### property: lineWidth

Screen-space line width (CSS pixels) applied to every dotplot display in this
view. View-level because the GPU pass renders all displays with one uniform.

```ts
// type signature
type lineWidth = IOptionalIType<ISimpleType<number>, [undefined]>
// code
lineWidth: types.stripDefault(types.number, defaultLineWidth)
```

#### property: viewTrackConfigs

this represents tracks specific to this view specifically used for read vs ref
dotplots where this track would not really apply elsewhere

```ts
// type signature
type viewTrackConfigs = IOptionalIType<IArrayType<IAnyModelType>, [undefined]>
// code
viewTrackConfigs: types.stripDefault(
  types.array(pm.pluggableConfigSchemaType('track')),
  [],
)
```

#### property: init

used for initializing the view from a session snapshot

```ts
// type signature
type init = IType<
  DotplotViewInit | undefined,
  DotplotViewInit | undefined,
  DotplotViewInit | undefined
>
// code
init: types.frozen<DotplotViewInit | undefined>()
```

#### property: highlight

translucent highlight bands drawn per-axis: vertical when the region's assembly
matches hview, horizontal when it matches vview

```ts
// type signature
type highlight = IOptionalIType<
  IArrayType<IType<HighlightType, HighlightType, HighlightType>>,
  [undefined]
>
// code
highlight: types.stripDefault(types.array(types.frozen<HighlightType>()), [])
```

#### property: highlightsVisible

controls whether view.highlight entries are rendered

```ts
// type signature
type highlightsVisible = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
highlightsVisible: types.stripDefault(types.boolean, true)
```

#### property: showHighlightChips

controls whether the interactive highlight chip (link icon + context menu) is
drawn on each highlight band; off by default

```ts
// type signature
type showHighlightChips = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showHighlightChips: types.stripDefault(types.boolean, false)
```

#### property: showColorLegend

Show the floating color-by legend in the top-right of the plot. Dismissible via
the legend's close button; re-enable from the color-by (palette) menu.

```ts
// type signature
type showColorLegend = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
showColorLegend: types.stripDefault(types.boolean, false)
```

</details>

<details>
<summary>DotplotView - Properties (other undocumented members)</summary>

#### property: id

```ts
// type signature
type id = IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: type

```ts
// type signature
type type = ISimpleType<'DotplotView'>
// code
type: types.literal('DotplotView')
```

#### property: height

```ts
// type signature
type height = IOptionalIType<ISimpleType<number>, [undefined]>
// code
height: types.stripDefault(types.number, defaultHeight)
```

#### property: trackSelectorType

```ts
// type signature
type trackSelectorType = IOptionalIType<ISimpleType<string>, [undefined]>
// code
trackSelectorType: types.stripDefault(types.string, 'hierarchical')
```

#### property: assemblyNames

```ts
// type signature
type assemblyNames = IOptionalIType<
  IArrayType<ISimpleType<string>>,
  [undefined]
>
// code
assemblyNames: types.stripDefault(types.array(types.string), [])
```

#### property: drawCigar

```ts
// type signature
type drawCigar = IOptionalIType<ISimpleType<boolean>, [undefined]>
// code
drawCigar: types.stripDefault(types.boolean, true)
```

#### property: hview

```ts
// type signature
type hview = IOptionalIType<IModelType<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayedRegions: IOptionalIType<IType<Region[], Region[], Region[]>, [...]>; bpPerPx: IType<...>; offsetPx: IType<...>; minimumBlockWidth: IOptionalIType<...>; }, { ...; } & ... 8 more ... & { ...; }, _NotCustomized, _NotCustomized>, ...
// code
hview: types.optional(DotplotHView, {})
```

#### property: vview

```ts
// type signature
type vview = IOptionalIType<IModelType<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayedRegions: IOptionalIType<IType<Region[], Region[], Region[]>, [...]>; bpPerPx: IType<...>; offsetPx: IType<...>; minimumBlockWidth: IOptionalIType<...>; }, { ...; } & ... 8 more ... & { ...; }, _NotCustomized, _NotCustomized>, ...
// code
vview: types.optional(DotplotVView, {})
```

#### property: tracks

```ts
// type signature
type tracks = IArrayType<IAnyType>
// code
tracks: types.array(pm.pluggableMstType('track', 'stateModel'))
```

</details>

<details>
<summary>DotplotView - Volatiles</summary>

#### volatile: cursorMode

these are 'personal preferences', stored in volatile and loaded/written to
localStorage

```ts
// type signature
type cursorMode = string
// code
cursorMode: localStorageGetItem(LS_CURSOR_MODE) === 'move'
  ? 'move'
  : 'crosshair'
```

#### volatile: awaitingAutoDiagonalize

True while the init autorun is waiting for the first dotplot RPC so it can run
the DiagonalizeDotplot pass. Used to gate showLoading on so the user sees a
spinner with "Reordering chromosomes…" instead of an undiagonalized plot that
immediately re-paints.

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

#### volatile: autoDiagonalizeRequested

Set true as soon as an init-time autoDiagonalize is requested, before any render
can paint. Gates `settled` (and thus the `dotplot_webgl_canvas_done` test-id) so
a screenshot / browser-test can't capture the pre-reorder plot.

```ts
// type signature
type autoDiagonalizeRequested = false
// code
autoDiagonalizeRequested: false
```

#### volatile: autoDiagonalizeComplete

Set true only after the init-time DiagonalizeDotplot pass RESOLVES successfully.
If the reorder is skipped or throws, this stays false so `settled` never reports
done on an undiagonalized plot — the capture fails loudly (times out) instead of
committing a hairball.

```ts
// type signature
type autoDiagonalizeComplete = false
// code
autoDiagonalizeComplete: false
```

</details>

<details>
<summary>DotplotView - Volatiles (other undocumented members)</summary>

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

#### volatile: importFormSyntenyTrackSelections

```ts
// type signature
type importFormSyntenyTrackSelections = IObservableArray<ImportFormSyntenyTrack>
// code
importFormSyntenyTrackSelections: observable.array<ImportFormSyntenyTrack>()
```

</details>

<details>
<summary>DotplotView - Getters</summary>

#### getter: borderX

Left margin: fits the vertical (vview) axis labels. Derived purely from that
axis's regions + zoom — never from viewWidth — so it can't feed back through
viewWidth = width - borderX into a render loop.

```ts
type borderX = number
```

#### getter: borderY

Bottom margin: fits the horizontal (hview) axis labels. See borderX.

```ts
type borderY = number
```

#### getter: showImportForm

Whether to show the import form

```ts
type showImportForm = boolean
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

#### getter: dotplotDisplays

DotplotDisplays under each track, indexed to match `tracks`.

```ts
type dotplotDisplays = (ModelInstanceTypeProps<_OverrideProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; type: ISimpleType<string>; rpcDriverName: IMaybe<ISimpleType<string>>; }, { ...; }>> & ... 10 more ... & IStateTreeNode<...>)[]
```

#### getter: settled

Canvas has painted and no display is still fetching, so what's on screen is the
final settled content. Drives the `dotplot_webgl_canvas_done` test-id that
screenshot capture and the browser-test suites wait on — so it must mean "done",
not just "first paint".

```ts
type settled = boolean
```

#### getter: hasLodCapableAdapter

True if any track has an adapter that declares the 'lod' capability. Used to
gate the LOD menu — only PIF supports it.

```ts
type hasLodCapableAdapter = boolean
```

#### getter: geometryByTrackIndex

Per-display GPU geometry keyed by track index. The upload autorun diffs this
map: new entries upload, vanished entries evict.

```ts
type geometryByTrackIndex = Map<number, DotplotGeometryData>
```

#### getter: dotplotRenderState

Aggregated per-frame render state. Built by walking each display that has
uploaded geometry; returns undefined when none do, which gates the render pass.

```ts
type dotplotRenderState =
  | {
      viewBpH: number
      viewBpV: number
      bpPerPxHInv: number
      bpPerPxVInv: number
      lineWidth: number
      displayKeys: number[]
    }
  | undefined
```

</details>

<details>
<summary>DotplotView - Getters (other undocumented members)</summary>

#### getter: width

```ts
type width = number
```

#### getter: assemblyErrors

```ts
type assemblyErrors = string
```

#### getter: assembliesInitialized

```ts
type assembliesInitialized = boolean
```

#### getter: initialized

```ts
type initialized = boolean
```

#### getter: hticks

```ts
type hticks = Tick[]
```

#### getter: vticks

```ts
type vticks = Tick[]
```

#### getter: hTickPositions

```ts
type hTickPositions = PositionedTick[]
```

#### getter: vTickPositions

```ts
type vTickPositions = PositionedTick[]
```

#### getter: hasSomethingToShow

```ts
type hasSomethingToShow = boolean
```

#### getter: viewWidth

```ts
type viewWidth = number
```

#### getter: viewHeight

```ts
type viewHeight = number
```

#### getter: hblockLabelKeysToHide

```ts
type hblockLabelKeysToHide = Set<string>
```

#### getter: vblockLabelKeysToHide

```ts
type vblockLabelKeysToHide = Set<string>
```

#### getter: views

```ts
type views = (ModelInstanceTypeProps<{ id: IOptionalIType<ISimpleType<string>, [undefined]>; displayedRegions: IOptionalIType<IType<Region[], Region[], Region[]>, [...]>; bpPerPx: IType<...>; offsetPx: IType<...>; minimumBlockWidth: IOptionalIType<...>; }> & ... 10 more ... & IStateTreeNode<...>)[]
```

#### getter: error

```ts
type error = unknown
```

</details>

<details>
<summary>DotplotView - Methods</summary>

#### method: getHHighlightCoords

Map a highlight/bookmark region to {left, width} px on the horizontal axis. left
is already screen-offset. Returns undefined when the region isn't on hview's
assembly/displayed regions.

```ts
type getHHighlightCoords = (region: {
  assemblyName?: string | undefined
  refName: string
  start: number
  end: number
}) => { width: number; left: number } | undefined
```

#### method: getVHighlightCoords

Map a highlight/bookmark region to {top, height} px on the vertical axis. The
vview lays out bottom-to-top, so the band is y-flipped into screen space.
Returns undefined when the region isn't on vview.

```ts
type getVHighlightCoords = (region: {
  assemblyName?: string | undefined
  refName: string
  start: number
  end: number
}) => { top: number; height: number } | undefined
```

</details>

<details>
<summary>DotplotView - Methods (other undocumented members)</summary>

#### method: menuItems

```ts
type menuItems = () => ({ label: string; icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; onClick: () => void; subMenu?: undefined; } | { ...; } | { ...; })[]
```

</details>

<details>
<summary>DotplotView - Actions</summary>

#### action: syncBpPerPx

Equalize hview/vview bpPerPx without recentering. Used by the aspect-lock
autorun to absorb divergence from box-zoom and similar operations while
preserving the user's current pan position.

```ts
type syncBpPerPx = () => void
```

#### action: clearView

returns to the import form

```ts
type clearView = () => void
```

#### action: cancelAutoDiagonalize

Abort an in-flight auto-diagonalize; the runner's finally clears the wait flag,
revealing the (undiagonalized) plot.

```ts
type cancelAutoDiagonalize = () => void
```

#### action: zoomInToMouseCoords

zooms into clicked and dragged region

```ts
type zoomInToMouseCoords = (mousedown: Coord, mouseup: Coord) => void
```

#### action: onDotplotView

creates a linear synteny view from the clicked and dragged region

```ts
type onDotplotView = (mousedown: Coord, mouseup: Coord) => void
```

#### action: exportSvg

creates an svg export and save using FileSaver

```ts
type exportSvg = (opts?: ExportSvgOptions) => Promise<void>
```

</details>

<details>
<summary>DotplotView - Actions (other undocumented members)</summary>

#### action: setImportFormSyntenyTrack

```ts
type setImportFormSyntenyTrack = (
  arg: number,
  val: ImportFormSyntenyTrack,
) => void
```

#### action: startRenderingBackend

```ts
type startRenderingBackend = (backend: DotplotRenderingBackend) => void
```

#### action: setCursorMode

```ts
type setCursorMode = (mode: CursorMode) => void
```

#### action: setDrawCigar

```ts
type setDrawCigar = (flag: boolean) => void
```

#### action: setLodMode

```ts
type setLodMode = (value: 'auto' | 'fine' | 'coarse') => void
```

#### action: setLockAspectRatio

```ts
type setLockAspectRatio = (flag: boolean) => void
```

#### action: setLineWidth

```ts
type setLineWidth = (value: number) => void
```

#### action: addToHighlights

```ts
type addToHighlights = (highlight: HighlightType) => void
```

#### action: setHighlight

```ts
type setHighlight = (highlight?: HighlightType[] | undefined) => void
```

#### action: removeHighlight

```ts
type removeHighlight = (highlight: HighlightType) => void
```

#### action: setHighlightsVisible

```ts
type setHighlightsVisible = (arg: boolean) => void
```

#### action: setShowHighlightChips

```ts
type setShowHighlightChips = (arg: boolean) => void
```

#### action: setShowColorLegend

```ts
type setShowColorLegend = (arg: boolean) => void
```

#### action: setWidth

```ts
type setWidth = (newWidth: number) => number
```

#### action: setHeight

```ts
type setHeight = (newHeight: number) => number
```

#### action: setError

```ts
type setError = (e: unknown) => void
```

#### action: setInit

```ts
type setInit = (init?: DotplotViewInit | undefined) => void
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

#### action: zoomOut

```ts
type zoomOut = () => void
```

#### action: zoomIn

```ts
type zoomIn = () => void
```

#### action: activateTrackSelector

```ts
type activateTrackSelector = () => Widget
```

#### action: showTrack

```ts
type showTrack = (trackId: string, initialSnapshot?: any) => any
```

#### action: hideTrack

```ts
type hideTrack = (trackId: string) => boolean
```

#### action: toggleTrack

```ts
type toggleTrack = (trackId: string) => boolean
```

#### action: setAssemblyNames

```ts
type setAssemblyNames = (target: string, query: string) => void
```

#### action: getCoords

```ts
type getCoords = (
  mousedown: Coord,
  mouseup: Coord,
) => PxToBpResult[] | undefined
```

#### action: showAllRegions

```ts
type showAllRegions = () => void
```

#### action: initializeDisplayedRegions

```ts
type initializeDisplayedRegions = () => void
```

#### action: applySquare

```ts
type applySquare = (ratio: number) => void
```

#### action: squareView

```ts
type squareView = () => void
```

#### action: squareViewProportional

```ts
type squareViewProportional = () => void
```

</details>
