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

| Member                                                                         | Kind       | Defined by                                      | Description                                                                                                                                                                    |
| ------------------------------------------------------------------------------ | ---------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [id](#property-id)                                                             | Properties | DotplotView                                     |                                                                                                                                                                                |
| [type](#property-type)                                                         | Properties | DotplotView                                     |                                                                                                                                                                                |
| [height](#property-height)                                                     | Properties | DotplotView                                     |                                                                                                                                                                                |
| [trackSelectorType](#property-trackselectortype)                               | Properties | DotplotView                                     |                                                                                                                                                                                |
| [assemblyNames](#property-assemblynames)                                       | Properties | DotplotView                                     |                                                                                                                                                                                |
| [drawCigar](#property-drawcigar)                                               | Properties | DotplotView                                     |                                                                                                                                                                                |
| [lodMode](#property-lodmode)                                                   | Properties | DotplotView                                     | Level-of-detail tier override for PIF adapters.                                                                                                                                |
| [lockAspectRatio](#property-lockaspectratio)                                   | Properties | DotplotView                                     | When true, hview and vview are kept at the same bpPerPx so the dotplot stays square.                                                                                           |
| [lineWidth](#property-linewidth)                                               | Properties | DotplotView                                     | Screen-space line width (CSS pixels) applied to every dotplot display in this view.                                                                                            |
| [hview](#property-hview)                                                       | Properties | DotplotView                                     |                                                                                                                                                                                |
| [vview](#property-vview)                                                       | Properties | DotplotView                                     |                                                                                                                                                                                |
| [tracks](#property-tracks)                                                     | Properties | DotplotView                                     |                                                                                                                                                                                |
| [viewTrackConfigs](#property-viewtrackconfigs)                                 | Properties | DotplotView                                     | this represents tracks specific to this view specifically used for read vs ref dotplots where this track would not really apply elsewhere                                      |
| [init](#property-init)                                                         | Properties | DotplotView                                     | used for initializing the view from a session snapshot                                                                                                                         |
| [showColorLegend](#property-showcolorlegend)                                   | Properties | DotplotView                                     | Show the floating color-by legend in the top-right of the plot.                                                                                                                |
| [volatileWidth](#volatile-volatilewidth)                                       | Volatiles  | DotplotView                                     |                                                                                                                                                                                |
| [volatileError](#volatile-volatileerror)                                       | Volatiles  | DotplotView                                     |                                                                                                                                                                                |
| [cursorMode](#volatile-cursormode)                                             | Volatiles  | DotplotView                                     | these are 'personal preferences', stored in volatile and loaded/written to localStorage                                                                                        |
| [importFormSyntenyTrackSelections](#volatile-importformsyntenytrackselections) | Volatiles  | DotplotView                                     |                                                                                                                                                                                |
| [awaitingAutoDiagonalize](#volatile-awaitingautodiagonalize)                   | Volatiles  | DotplotView                                     | True while the init autorun is waiting for the first dotplot RPC so it can run the DiagonalizeDotplot pass.                                                                    |
| [diagonalizeStatus](#volatile-diagonalizestatus)                               | Volatiles  | DotplotView                                     | Live status from the auto-diagonalize RPC (download %, parse, algorithm phase) shown on the reordering spinner; undefined outside that wait.                                   |
| [diagonalizeStopToken](#volatile-diagonalizestoptoken)                         | Volatiles  | DotplotView                                     | Stop token for the in-flight auto-diagonalize, so the spinner's Cancel can abort it; undefined when none is running.                                                           |
| [autoDiagonalizeRequested](#volatile-autodiagonalizerequested)                 | Volatiles  | DotplotView                                     | Set true as soon as an init-time autoDiagonalize is requested, before any render can paint.                                                                                    |
| [autoDiagonalizeComplete](#volatile-autodiagonalizecomplete)                   | Volatiles  | DotplotView                                     | Set true only after the init-time DiagonalizeDotplot pass RESOLVES successfully.                                                                                               |
| [width](#getter-width)                                                         | Getters    | DotplotView                                     |                                                                                                                                                                                |
| [borderX](#getter-borderx)                                                     | Getters    | DotplotView                                     | Left margin: fits the vertical (vview) axis labels.                                                                                                                            |
| [borderY](#getter-bordery)                                                     | Getters    | DotplotView                                     | Bottom margin: fits the horizontal (hview) axis labels.                                                                                                                        |
| [assemblyErrors](#getter-assemblyerrors)                                       | Getters    | DotplotView                                     |                                                                                                                                                                                |
| [assembliesInitialized](#getter-assembliesinitialized)                         | Getters    | DotplotView                                     |                                                                                                                                                                                |
| [initialized](#getter-initialized)                                             | Getters    | DotplotView                                     |                                                                                                                                                                                |
| [hticks](#getter-hticks)                                                       | Getters    | DotplotView                                     |                                                                                                                                                                                |
| [vticks](#getter-vticks)                                                       | Getters    | DotplotView                                     |                                                                                                                                                                                |
| [hTickPositions](#getter-htickpositions)                                       | Getters    | DotplotView                                     |                                                                                                                                                                                |
| [vTickPositions](#getter-vtickpositions)                                       | Getters    | DotplotView                                     |                                                                                                                                                                                |
| [hasSomethingToShow](#getter-hassomethingtoshow)                               | Getters    | DotplotView                                     |                                                                                                                                                                                |
| [showImportForm](#getter-showimportform)                                       | Getters    | DotplotView                                     | Whether to show the import form                                                                                                                                                |
| [showLoading](#getter-showloading)                                             | Getters    | DotplotView                                     | Whether to show a loading indicator instead of the import form or view                                                                                                         |
| [loadingMessage](#getter-loadingmessage)                                       | Getters    | DotplotView                                     | Label for the generic loading spinner.                                                                                                                                         |
| [viewWidth](#getter-viewwidth)                                                 | Getters    | DotplotView                                     |                                                                                                                                                                                |
| [viewHeight](#getter-viewheight)                                               | Getters    | DotplotView                                     |                                                                                                                                                                                |
| [hblockLabelKeysToHide](#getter-hblocklabelkeystohide)                         | Getters    | DotplotView                                     |                                                                                                                                                                                |
| [vblockLabelKeysToHide](#getter-vblocklabelkeystohide)                         | Getters    | DotplotView                                     |                                                                                                                                                                                |
| [views](#getter-views)                                                         | Getters    | DotplotView                                     |                                                                                                                                                                                |
| [dotplotDisplays](#getter-dotplotdisplays)                                     | Getters    | DotplotView                                     | DotplotDisplays under each track, indexed to match `tracks`.                                                                                                                   |
| [settled](#getter-settled)                                                     | Getters    | DotplotView                                     | Canvas has painted and no display is still fetching, so what's on screen is the final settled content.                                                                         |
| [hasLodCapableAdapter](#getter-haslodcapableadapter)                           | Getters    | DotplotView                                     | True if any track has an adapter that declares the 'lod' capability.                                                                                                           |
| [geometryByTrackIndex](#getter-geometrybytrackindex)                           | Getters    | DotplotView                                     | Per-display GPU geometry keyed by track index.                                                                                                                                 |
| [dotplotRenderState](#getter-dotplotrenderstate)                               | Getters    | DotplotView                                     | Aggregated per-frame render state.                                                                                                                                             |
| [error](#getter-error)                                                         | Getters    | DotplotView                                     |                                                                                                                                                                                |
| [getHHighlightCoords](#method-gethhighlightcoords)                             | Methods    | DotplotView                                     | Map a highlight/bookmark region to {left, width} px on the horizontal axis.                                                                                                    |
| [getVHighlightCoords](#method-getvhighlightcoords)                             | Methods    | DotplotView                                     | Map a highlight/bookmark region to {top, height} px on the vertical axis.                                                                                                      |
| [menuItems](#method-menuitems)                                                 | Methods    | DotplotView                                     |                                                                                                                                                                                |
| [setImportFormSyntenyTrack](#action-setimportformsyntenytrack)                 | Actions    | DotplotView                                     |                                                                                                                                                                                |
| [startRenderingBackend](#action-startrenderingbackend)                         | Actions    | DotplotView                                     |                                                                                                                                                                                |
| [setCursorMode](#action-setcursormode)                                         | Actions    | DotplotView                                     |                                                                                                                                                                                |
| [setDrawCigar](#action-setdrawcigar)                                           | Actions    | DotplotView                                     |                                                                                                                                                                                |
| [setLodMode](#action-setlodmode)                                               | Actions    | DotplotView                                     |                                                                                                                                                                                |
| [setLockAspectRatio](#action-setlockaspectratio)                               | Actions    | DotplotView                                     |                                                                                                                                                                                |
| [syncBpPerPx](#action-syncbpperpx)                                             | Actions    | DotplotView                                     | Equalize hview/vview bpPerPx without recentering.                                                                                                                              |
| [setLineWidth](#action-setlinewidth)                                           | Actions    | DotplotView                                     |                                                                                                                                                                                |
| [setShowColorLegend](#action-setshowcolorlegend)                               | Actions    | DotplotView                                     |                                                                                                                                                                                |
| [clearView](#action-clearview)                                                 | Actions    | DotplotView                                     | returns to the import form                                                                                                                                                     |
| [setWidth](#action-setwidth)                                                   | Actions    | DotplotView                                     |                                                                                                                                                                                |
| [setHeight](#action-setheight)                                                 | Actions    | DotplotView                                     |                                                                                                                                                                                |
| [setError](#action-seterror)                                                   | Actions    | DotplotView                                     |                                                                                                                                                                                |
| [setInit](#action-setinit)                                                     | Actions    | DotplotView                                     |                                                                                                                                                                                |
| [setAwaitingAutoDiagonalize](#action-setawaitingautodiagonalize)               | Actions    | DotplotView                                     |                                                                                                                                                                                |
| [setAutoDiagonalizeRequested](#action-setautodiagonalizerequested)             | Actions    | DotplotView                                     |                                                                                                                                                                                |
| [setAutoDiagonalizeComplete](#action-setautodiagonalizecomplete)               | Actions    | DotplotView                                     |                                                                                                                                                                                |
| [setDiagonalizeStatus](#action-setdiagonalizestatus)                           | Actions    | DotplotView                                     |                                                                                                                                                                                |
| [setDiagonalizeStopToken](#action-setdiagonalizestoptoken)                     | Actions    | DotplotView                                     |                                                                                                                                                                                |
| [cancelAutoDiagonalize](#action-cancelautodiagonalize)                         | Actions    | DotplotView                                     | Abort an in-flight auto-diagonalize; the runner's finally clears the wait flag, revealing the (undiagonalized) plot.                                                           |
| [zoomOut](#action-zoomout)                                                     | Actions    | DotplotView                                     |                                                                                                                                                                                |
| [zoomIn](#action-zoomin)                                                       | Actions    | DotplotView                                     |                                                                                                                                                                                |
| [activateTrackSelector](#action-activatetrackselector)                         | Actions    | DotplotView                                     |                                                                                                                                                                                |
| [showTrack](#action-showtrack)                                                 | Actions    | DotplotView                                     |                                                                                                                                                                                |
| [hideTrack](#action-hidetrack)                                                 | Actions    | DotplotView                                     |                                                                                                                                                                                |
| [toggleTrack](#action-toggletrack)                                             | Actions    | DotplotView                                     |                                                                                                                                                                                |
| [setAssemblyNames](#action-setassemblynames)                                   | Actions    | DotplotView                                     |                                                                                                                                                                                |
| [getCoords](#action-getcoords)                                                 | Actions    | DotplotView                                     |                                                                                                                                                                                |
| [zoomInToMouseCoords](#action-zoomintomousecoords)                             | Actions    | DotplotView                                     | zooms into clicked and dragged region                                                                                                                                          |
| [addHighlightFromMouseCoords](#action-addhighlightfrommousecoords)             | Actions    | DotplotView                                     | highlights the clicked and dragged region: the x-span becomes a band on the horizontal axis and the y-span a band on the vertical axis, so the drag rect is their intersection |
| [showAllRegions](#action-showallregions)                                       | Actions    | DotplotView                                     |                                                                                                                                                                                |
| [initializeDisplayedRegions](#action-initializedisplayedregions)               | Actions    | DotplotView                                     |                                                                                                                                                                                |
| [onDotplotView](#action-ondotplotview)                                         | Actions    | DotplotView                                     | creates a linear synteny view from the clicked and dragged region                                                                                                              |
| [exportSvg](#action-exportsvg)                                                 | Actions    | DotplotView                                     | creates an svg export and save using FileSaver                                                                                                                                 |
| [applySquare](#action-applysquare)                                             | Actions    | DotplotView                                     |                                                                                                                                                                                |
| [squareView](#action-squareview)                                               | Actions    | DotplotView                                     |                                                                                                                                                                                |
| [squareViewProportional](#action-squareviewproportional)                       | Actions    | DotplotView                                     |                                                                                                                                                                                |
| [displayName](#property-displayname)                                           | Properties | [BaseViewModel](../baseviewmodel)               | displayName is displayed in the header of the view, or assembly names being used if none is specified                                                                          |
| [minimized](#property-minimized)                                               | Properties | [BaseViewModel](../baseviewmodel)               |                                                                                                                                                                                |
| [width](#volatile-width)                                                       | Volatiles  | [BaseViewModel](../baseviewmodel)               |                                                                                                                                                                                |
| [setDisplayName](#action-setdisplayname)                                       | Actions    | [BaseViewModel](../baseviewmodel)               |                                                                                                                                                                                |
| [setMinimized](#action-setminimized)                                           | Actions    | [BaseViewModel](../baseviewmodel)               |                                                                                                                                                                                |
| [canvasDrawn](#volatile-canvasdrawn)                                           | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin) | flips true on first paint; read by test selectors to detect render                                                                                                             |
| [currentRenderingBackend](#volatile-currentrenderingbackend)                   | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin) | current backend reference, updated on context-loss recovery.                                                                                                                   |
| [renderTick](#volatile-rendertick)                                             | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin) | counter the render autorun observes; bumped to force a re-render                                                                                                               |
| [autorunsInstalled](#volatile-autorunsinstalled)                               | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin) | guards attachRenderingBackend so the autorun pair spawns once per instance                                                                                                     |
| [renderError](#volatile-rendererror)                                           | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin) | the render-backend (GPU/Canvas2D init or context-loss) error, or undefined.                                                                                                    |
| [markCanvasDrawn](#action-markcanvasdrawn)                                     | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin) |                                                                                                                                                                                |
| [resetCanvasDrawn](#action-resetcanvasdrawn)                                   | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin) |                                                                                                                                                                                |
| [stopRenderingBackend](#action-stoprenderingbackend)                           | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin) |                                                                                                                                                                                |
| [renderNow](#action-rendernow)                                                 | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin) |                                                                                                                                                                                |
| [setRenderError](#action-setrendererror)                                       | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin) | set/clear the render-backend error.                                                                                                                                            |
| [attachRenderingBackend](#action-attachrenderingbackend)                       | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin) | attach a GPU/Canvas2D backend and install the upload + render autorun pair (idempotent — re-calling only swaps the backend)                                                    |
| [highlight](#property-highlight)                                               | Properties | [HighlightsMixin](../highlightsmixin)           | translucent highlight bands, seeded from URL params or session JSON and added interactively via the rubber-band menu                                                           |
| [showHighlightChips](#property-showhighlightchips)                             | Properties | [HighlightsMixin](../highlightsmixin)           | controls whether the interactive highlight chip (link icon + context menu) is drawn on each highlight band; off by default                                                     |
| [addToHighlights](#action-addtohighlights)                                     | Actions    | [HighlightsMixin](../highlightsmixin)           |                                                                                                                                                                                |
| [setHighlight](#action-sethighlight)                                           | Actions    | [HighlightsMixin](../highlightsmixin)           |                                                                                                                                                                                |
| [removeHighlight](#action-removehighlight)                                     | Actions    | [HighlightsMixin](../highlightsmixin)           |                                                                                                                                                                                |
| [updateHighlight](#action-updatehighlight)                                     | Actions    | [HighlightsMixin](../highlightsmixin)           |                                                                                                                                                                                |
| [setShowHighlightChips](#action-setshowhighlightchips)                         | Actions    | [HighlightsMixin](../highlightsmixin)           |                                                                                                                                                                                |

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

| Member                                                         | Type                                                           |
| -------------------------------------------------------------- | -------------------------------------------------------------- |
| <span id="property-id">id</span>                               | `IOptionalIType<ISimpleType<string>, [undefined]>`             |
| <span id="property-type">type</span>                           | `ISimpleType<"DotplotView">`                                   |
| <span id="property-height">height</span>                       | `IOptionalIType<ISimpleType<number>, [undefined]>`             |
| <span id="property-trackselectortype">trackSelectorType</span> | `IOptionalIType<ISimpleType<string>, [undefined]>`             |
| <span id="property-assemblynames">assemblyNames</span>         | `IOptionalIType<IArrayType<ISimpleType<string>>, [undefined]>` |
| <span id="property-drawcigar">drawCigar</span>                 | `IOptionalIType<ISimpleType<boolean>, [undefined]>`            |
| <span id="property-hview">hview</span>                         | `IOptionalIType<IModelType<…>, [undefined]>`                   |
| <span id="property-vview">vview</span>                         | `IOptionalIType<IModelType<…>, [undefined]>`                   |
| <span id="property-tracks">tracks</span>                       | `IArrayType<IAnyType>`                                         |

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

| Member                                                                                       | Type                                       |
| -------------------------------------------------------------------------------------------- | ------------------------------------------ |
| <span id="volatile-volatilewidth">volatileWidth</span>                                       | `number \| undefined`                      |
| <span id="volatile-volatileerror">volatileError</span>                                       | `unknown`                                  |
| <span id="volatile-importformsyntenytrackselections">importFormSyntenyTrackSelections</span> | `IObservableArray<ImportFormSyntenyTrack>` |

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
type dotplotDisplays = (ModelInstanceTypeProps<_OverrideProps<…>> & ... 10 more ... & IStateTreeNode<...>)[]
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

| Member                                                               | Type                                                                    |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| <span id="getter-width">width</span>                                 | `number`                                                                |
| <span id="getter-assemblyerrors">assemblyErrors</span>               | `string`                                                                |
| <span id="getter-assembliesinitialized">assembliesInitialized</span> | `boolean`                                                               |
| <span id="getter-initialized">initialized</span>                     | `boolean`                                                               |
| <span id="getter-hticks">hticks</span>                               | `Tick[]`                                                                |
| <span id="getter-vticks">vticks</span>                               | `Tick[]`                                                                |
| <span id="getter-htickpositions">hTickPositions</span>               | `PositionedTick[]`                                                      |
| <span id="getter-vtickpositions">vTickPositions</span>               | `PositionedTick[]`                                                      |
| <span id="getter-hassomethingtoshow">hasSomethingToShow</span>       | `boolean`                                                               |
| <span id="getter-viewwidth">viewWidth</span>                         | `number`                                                                |
| <span id="getter-viewheight">viewHeight</span>                       | `number`                                                                |
| <span id="getter-hblocklabelkeystohide">hblockLabelKeysToHide</span> | `Set<string>`                                                           |
| <span id="getter-vblocklabelkeystohide">vblockLabelKeysToHide</span> | `Set<string>`                                                           |
| <span id="getter-views">views</span>                                 | `(ModelInstanceTypeProps<…> & ... 10 more ... & IStateTreeNode<...>)[]` |
| <span id="getter-error">error</span>                                 | `unknown`                                                               |

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

| Member                                       | Type                                                                                                                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| <span id="method-menuitems">menuItems</span> | `() => ({ label: string; icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> & { muiName: string; }; onClick: () => void; subMenu?: undefined; } \| { ...; } \| { ...; })[]` |

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

#### action: addHighlightFromMouseCoords

highlights the clicked and dragged region: the x-span becomes a band on the
horizontal axis and the y-span a band on the vertical axis, so the drag rect is
their intersection

```ts
type addHighlightFromMouseCoords = (mousedown: Coord, mouseup: Coord) => void
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

| Member                                                                           | Type                                                                                                                             |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| <span id="action-setimportformsyntenytrack">setImportFormSyntenyTrack</span>     | `(arg: number, val: ImportFormSyntenyTrack) => void`                                                                             |
| <span id="action-startrenderingbackend">startRenderingBackend</span>             | `(backend: DotplotRenderingBackend) => void`                                                                                     |
| <span id="action-setcursormode">setCursorMode</span>                             | `(mode: CursorMode) => void`                                                                                                     |
| <span id="action-setdrawcigar">setDrawCigar</span>                               | `(flag: boolean) => void`                                                                                                        |
| <span id="action-setlodmode">setLodMode</span>                                   | `(value: "auto" \| "fine" \| "coarse") => void`                                                                                  |
| <span id="action-setlockaspectratio">setLockAspectRatio</span>                   | `(flag: boolean) => void`                                                                                                        |
| <span id="action-setlinewidth">setLineWidth</span>                               | `(value: number) => void`                                                                                                        |
| <span id="action-setshowcolorlegend">setShowColorLegend</span>                   | `(arg: boolean) => void`                                                                                                         |
| <span id="action-setwidth">setWidth</span>                                       | `(newWidth: number) => number`                                                                                                   |
| <span id="action-setheight">setHeight</span>                                     | `(newHeight: number) => number`                                                                                                  |
| <span id="action-seterror">setError</span>                                       | `(e: unknown) => void`                                                                                                           |
| <span id="action-setinit">setInit</span>                                         | `(init?: DotplotViewInit \| undefined) => void`                                                                                  |
| <span id="action-setawaitingautodiagonalize">setAwaitingAutoDiagonalize</span>   | `(arg: boolean) => void`                                                                                                         |
| <span id="action-setautodiagonalizerequested">setAutoDiagonalizeRequested</span> | `(arg: boolean) => void`                                                                                                         |
| <span id="action-setautodiagonalizecomplete">setAutoDiagonalizeComplete</span>   | `(arg: boolean) => void`                                                                                                         |
| <span id="action-setdiagonalizestatus">setDiagonalizeStatus</span>               | `(arg?: RpcStatus \| undefined) => void`                                                                                         |
| <span id="action-setdiagonalizestoptoken">setDiagonalizeStopToken</span>         | `(arg?: StopToken \| undefined) => void`                                                                                         |
| <span id="action-zoomout">zoomOut</span>                                         | `() => void`                                                                                                                     |
| <span id="action-zoomin">zoomIn</span>                                           | `() => void`                                                                                                                     |
| <span id="action-activatetrackselector">activateTrackSelector</span>             | `() => Widget`                                                                                                                   |
| <span id="action-showtrack">showTrack</span>                                     | `(trackId: string, initialSnapshot?: any) => any`                                                                                |
| <span id="action-hidetrack">hideTrack</span>                                     | `(trackId: string) => boolean`                                                                                                   |
| <span id="action-toggletrack">toggleTrack</span>                                 | `(trackId: string) => boolean`                                                                                                   |
| <span id="action-setassemblynames">setAssemblyNames</span>                       | `(target: string, query: string) => void`                                                                                        |
| <span id="action-getcoords">getCoords</span>                                     | `(mousedown: Coord, mouseup: Coord) => { x1: PxToBpResult; x2: PxToBpResult; y1: PxToBpResult; y2: PxToBpResult; } \| undefined` |
| <span id="action-showallregions">showAllRegions</span>                           | `() => void`                                                                                                                     |
| <span id="action-initializedisplayedregions">initializeDisplayedRegions</span>   | `() => void`                                                                                                                     |
| <span id="action-applysquare">applySquare</span>                                 | `(ratio: number) => void`                                                                                                        |
| <span id="action-squareview">squareView</span>                                   | `() => void`                                                                                                                     |
| <span id="action-squareviewproportional">squareViewProportional</span>           | `() => void`                                                                                                                     |

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

<details>
<summary>Derived from RenderLifecycleMixin</summary>

[RenderLifecycleMixin →](../renderlifecyclemixin)

**Volatiles**

#### volatile: canvasDrawn

flips true on first paint; read by test selectors to detect render

```ts
// type signature
type canvasDrawn = false
// code
canvasDrawn: false
```

#### volatile: currentRenderingBackend

current backend reference, updated on context-loss recovery. Typed `unknown`
(not generic `B`) on purpose: this mixin is composed by every display via a
non-generic factory, so the per-display backend type `B` isn't known here — it's
supplied at `attachRenderingBackend<B>` and narrowed with `as B` inside the
autoruns. Don't "fix" the cast.

```ts
// type signature
type currentRenderingBackend = undefined
// code
currentRenderingBackend: undefined
```

#### volatile: renderTick

counter the render autorun observes; bumped to force a re-render

```ts
// type signature
type renderTick = number
// code
renderTick: 0
```

#### volatile: autorunsInstalled

guards attachRenderingBackend so the autorun pair spawns once per instance

```ts
// type signature
type autorunsInstalled = false
// code
autorunsInstalled: false
```

#### volatile: renderError

the render-backend (GPU/Canvas2D init or context-loss) error, or undefined.
Single source of truth for the render-error terminal state:
`useRenderingBackend` writes it from the canvas-init mechanism so the model —
not React-local hook state — owns every terminal state. Read by `displayPhase`
(whose `renderError` term outranks `loading`, suppressing the scrim) and by
`DisplayChrome` (shows the retry overlay).

```ts
// type signature
type renderError = undefined
// code
renderError: undefined
```

**Actions**

#### action: setRenderError

set/clear the render-backend error. Called by `useRenderingBackend`: with the
error when the canvas factory rejects (or context-loss re-init fails), and with
`undefined` on successful (re)init and on retry.

```ts
type setRenderError = (error: unknown) => void
```

#### action: attachRenderingBackend

attach a GPU/Canvas2D backend and install the upload + render autorun pair
(idempotent — re-calling only swaps the backend)

```ts
type attachRenderingBackend = <B>(
  backend: B,
  cbs: RenderingBackendCallbacks<B>,
) => void
```

| Member                                                             | Type         |
| ------------------------------------------------------------------ | ------------ |
| <span id="action-markcanvasdrawn">markCanvasDrawn</span>           | `() => void` |
| <span id="action-resetcanvasdrawn">resetCanvasDrawn</span>         | `() => void` |
| <span id="action-stoprenderingbackend">stopRenderingBackend</span> | `() => void` |
| <span id="action-rendernow">renderNow</span>                       | `() => void` |

</details>

<details>
<summary>Derived from HighlightsMixin</summary>

[HighlightsMixin →](../highlightsmixin)

**Properties**

#### property: highlight

translucent highlight bands, seeded from URL params or session JSON and added
interactively via the rubber-band menu

```ts
// type signature
type highlight = IOptionalIType<
  IArrayType<IType<HighlightType, HighlightType, HighlightType>>,
  [undefined]
>
// code
highlight: types.stripDefault(types.array(types.frozen<HighlightType>()), [])
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

**Actions**

| Member                                                               | Type                                                            |
| -------------------------------------------------------------------- | --------------------------------------------------------------- |
| <span id="action-addtohighlights">addToHighlights</span>             | `(highlight: HighlightType) => void`                            |
| <span id="action-sethighlight">setHighlight</span>                   | `(highlight?: HighlightType[] \| undefined) => void`            |
| <span id="action-removehighlight">removeHighlight</span>             | `(highlight: HighlightType) => void`                            |
| <span id="action-updatehighlight">updateHighlight</span>             | `(old: HighlightType, updates: Partial<HighlightType>) => void` |
| <span id="action-setshowhighlightchips">setShowHighlightChips</span> | `(arg: boolean) => void`                                        |

</details>
