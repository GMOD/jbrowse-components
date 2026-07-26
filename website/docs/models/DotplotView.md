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

| Member                                                                         | Kind       | Defined by                                              | Description                                                                                                                                                                                         |
| ------------------------------------------------------------------------------ | ---------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [id](#property-id)                                                             | Properties | DotplotView                                             |                                                                                                                                                                                                     |
| [type](#property-type)                                                         | Properties | DotplotView                                             |                                                                                                                                                                                                     |
| [height](#property-height)                                                     | Properties | DotplotView                                             |                                                                                                                                                                                                     |
| [trackSelectorType](#property-trackselectortype)                               | Properties | DotplotView                                             | vestigial: the hierarchical selector is the only one that exists, so this value is ignored.                                                                                                         |
| [assemblyNames](#property-assemblynames)                                       | Properties | DotplotView                                             |                                                                                                                                                                                                     |
| [drawCigar](#property-drawcigar)                                               | Properties | DotplotView                                             |                                                                                                                                                                                                     |
| [lodMode](#property-lodmode)                                                   | Properties | DotplotView                                             | Level-of-detail tier override for PIF adapters.                                                                                                                                                     |
| [lockAspectRatio](#property-lockaspectratio)                                   | Properties | DotplotView                                             | When true, hview and vview are kept at the same bpPerPx so the dotplot stays square.                                                                                                                |
| [lineWidth](#property-linewidth)                                               | Properties | DotplotView                                             | Screen-space line width (CSS pixels) applied to every dotplot display in this view.                                                                                                                 |
| [hview](#property-hview)                                                       | Properties | DotplotView                                             |                                                                                                                                                                                                     |
| [vview](#property-vview)                                                       | Properties | DotplotView                                             |                                                                                                                                                                                                     |
| [tracks](#property-tracks)                                                     | Properties | DotplotView                                             |                                                                                                                                                                                                     |
| [viewTrackConfigs](#property-viewtrackconfigs)                                 | Properties | DotplotView                                             | this represents tracks specific to this view specifically used for read vs ref dotplots where this track would not really apply elsewhere                                                           |
| [init](#property-init)                                                         | Properties | DotplotView                                             | used for initializing the view from a session snapshot                                                                                                                                              |
| [showColorLegend](#property-showcolorlegend)                                   | Properties | DotplotView                                             | Show the floating color-by legend in the top-right of the plot.                                                                                                                                     |
| [volatileWidth](#volatile-volatilewidth)                                       | Volatiles  | DotplotView                                             |                                                                                                                                                                                                     |
| [volatileError](#volatile-volatileerror)                                       | Volatiles  | DotplotView                                             |                                                                                                                                                                                                     |
| [cursorMode](#volatile-cursormode)                                             | Volatiles  | DotplotView                                             | these are 'personal preferences', stored in volatile and loaded/written to localStorage                                                                                                             |
| [importFormSyntenyTrackSelections](#volatile-importformsyntenytrackselections) | Volatiles  | DotplotView                                             |                                                                                                                                                                                                     |
| [width](#getter-width)                                                         | Getters    | DotplotView                                             |                                                                                                                                                                                                     |
| [borderX](#getter-borderx)                                                     | Getters    | DotplotView                                             | Left margin: fits the vertical (vview) axis labels.                                                                                                                                                 |
| [borderY](#getter-bordery)                                                     | Getters    | DotplotView                                             | Bottom margin: fits the horizontal (hview) axis labels.                                                                                                                                             |
| [assemblyErrors](#getter-assemblyerrors)                                       | Getters    | DotplotView                                             |                                                                                                                                                                                                     |
| [assembliesInitialized](#getter-assembliesinitialized)                         | Getters    | DotplotView                                             |                                                                                                                                                                                                     |
| [initialized](#getter-initialized)                                             | Getters    | DotplotView                                             |                                                                                                                                                                                                     |
| [hticks](#getter-hticks)                                                       | Getters    | DotplotView                                             |                                                                                                                                                                                                     |
| [vticks](#getter-vticks)                                                       | Getters    | DotplotView                                             |                                                                                                                                                                                                     |
| [hTickPositions](#getter-htickpositions)                                       | Getters    | DotplotView                                             |                                                                                                                                                                                                     |
| [vTickPositions](#getter-vtickpositions)                                       | Getters    | DotplotView                                             |                                                                                                                                                                                                     |
| [hasSomethingToShow](#getter-hassomethingtoshow)                               | Getters    | DotplotView                                             |                                                                                                                                                                                                     |
| [showImportForm](#getter-showimportform)                                       | Getters    | DotplotView                                             | Whether to show the import form                                                                                                                                                                     |
| [showLoading](#getter-showloading)                                             | Getters    | DotplotView                                             | Whether to show a loading indicator instead of the import form or view                                                                                                                              |
| [loadingMessage](#getter-loadingmessage)                                       | Getters    | DotplotView                                             | Label for the generic loading spinner.                                                                                                                                                              |
| [viewWidth](#getter-viewwidth)                                                 | Getters    | DotplotView                                             | Plot area width.                                                                                                                                                                                    |
| [viewHeight](#getter-viewheight)                                               | Getters    | DotplotView                                             | Plot area height.                                                                                                                                                                                   |
| [hblockLabelKeysToHide](#getter-hblocklabelkeystohide)                         | Getters    | DotplotView                                             |                                                                                                                                                                                                     |
| [vblockLabelKeysToHide](#getter-vblocklabelkeystohide)                         | Getters    | DotplotView                                             |                                                                                                                                                                                                     |
| [views](#getter-views)                                                         | Getters    | DotplotView                                             |                                                                                                                                                                                                     |
| [dotplotDisplays](#getter-dotplotdisplays)                                     | Getters    | DotplotView                                             | DotplotDisplays under each track, indexed to match `tracks`.                                                                                                                                        |
| [colorBy](#getter-colorby)                                                     | Getters    | DotplotView                                             | The color-by mode the whole plot renders with.                                                                                                                                                      |
| [alpha](#getter-alpha)                                                         | Getters    | DotplotView                                             | Plot-wide alpha.                                                                                                                                                                                    |
| [minAlignmentLength](#getter-minalignmentlength)                               | Getters    | DotplotView                                             | Plot-wide minimum alignment length filter, in bp.                                                                                                                                                   |
| [settled](#getter-settled)                                                     | Getters    | DotplotView                                             | Canvas has painted and no display is still fetching, so what's on screen is the final settled content.                                                                                              |
| [hasLodCapableAdapter](#getter-haslodcapableadapter)                           | Getters    | DotplotView                                             | True if any track has an adapter with tiered storage.                                                                                                                                               |
| [geometryByTrackIndex](#getter-geometrybytrackindex)                           | Getters    | DotplotView                                             | Per-display GPU geometry keyed by track index.                                                                                                                                                      |
| [dotplotRenderState](#getter-dotplotrenderstate)                               | Getters    | DotplotView                                             | Aggregated per-frame render state.                                                                                                                                                                  |
| [error](#getter-error)                                                         | Getters    | DotplotView                                             |                                                                                                                                                                                                     |
| [getCoords](#method-getcoords)                                                 | Methods    | DotplotView                                             | Both corners of a drag rect, in bp on each axis.                                                                                                                                                    |
| [getHHighlightCoords](#method-gethhighlightcoords)                             | Methods    | DotplotView                                             | Map a highlight/bookmark region to {left, width} px on the horizontal axis.                                                                                                                         |
| [getVHighlightCoords](#method-getvhighlightcoords)                             | Methods    | DotplotView                                             | Map a highlight/bookmark region to {top, height} px on the vertical axis.                                                                                                                           |
| [menuItems](#method-menuitems)                                                 | Methods    | DotplotView                                             |                                                                                                                                                                                                     |
| [setImportFormSyntenyTrack](#action-setimportformsyntenytrack)                 | Actions    | DotplotView                                             |                                                                                                                                                                                                     |
| [startRenderingBackend](#action-startrenderingbackend)                         | Actions    | DotplotView                                             |                                                                                                                                                                                                     |
| [setCursorMode](#action-setcursormode)                                         | Actions    | DotplotView                                             |                                                                                                                                                                                                     |
| [setDrawCigar](#action-setdrawcigar)                                           | Actions    | DotplotView                                             |                                                                                                                                                                                                     |
| [setLodMode](#action-setlodmode)                                               | Actions    | DotplotView                                             |                                                                                                                                                                                                     |
| [setLockAspectRatio](#action-setlockaspectratio)                               | Actions    | DotplotView                                             |                                                                                                                                                                                                     |
| [setLineWidth](#action-setlinewidth)                                           | Actions    | DotplotView                                             |                                                                                                                                                                                                     |
| [setShowColorLegend](#action-setshowcolorlegend)                               | Actions    | DotplotView                                             |                                                                                                                                                                                                     |
| [setColorBy](#action-setcolorby)                                               | Actions    | DotplotView                                             | Fan a per-display render setting out to every display, so the view-level getters above stay the single answer for the whole plot.                                                                   |
| [setAlpha](#action-setalpha)                                                   | Actions    | DotplotView                                             |                                                                                                                                                                                                     |
| [setMinAlignmentLength](#action-setminalignmentlength)                         | Actions    | DotplotView                                             |                                                                                                                                                                                                     |
| [clearView](#action-clearview)                                                 | Actions    | DotplotView                                             | returns to the import form                                                                                                                                                                          |
| [setWidth](#action-setwidth)                                                   | Actions    | DotplotView                                             |                                                                                                                                                                                                     |
| [setHeight](#action-setheight)                                                 | Actions    | DotplotView                                             |                                                                                                                                                                                                     |
| [setError](#action-seterror)                                                   | Actions    | DotplotView                                             |                                                                                                                                                                                                     |
| [setInit](#action-setinit)                                                     | Actions    | DotplotView                                             |                                                                                                                                                                                                     |
| [zoomOut](#action-zoomout)                                                     | Actions    | DotplotView                                             |                                                                                                                                                                                                     |
| [zoomIn](#action-zoomin)                                                       | Actions    | DotplotView                                             |                                                                                                                                                                                                     |
| [activateTrackSelector](#action-activatetrackselector)                         | Actions    | DotplotView                                             |                                                                                                                                                                                                     |
| [showTrack](#action-showtrack)                                                 | Actions    | DotplotView                                             |                                                                                                                                                                                                     |
| [hideTrack](#action-hidetrack)                                                 | Actions    | DotplotView                                             |                                                                                                                                                                                                     |
| [toggleTrack](#action-toggletrack)                                             | Actions    | DotplotView                                             |                                                                                                                                                                                                     |
| [setAssemblyNames](#action-setassemblynames)                                   | Actions    | DotplotView                                             |                                                                                                                                                                                                     |
| [zoomInToMouseCoords](#action-zoomintomousecoords)                             | Actions    | DotplotView                                             | zooms into clicked and dragged region                                                                                                                                                               |
| [addHighlightFromMouseCoords](#action-addhighlightfrommousecoords)             | Actions    | DotplotView                                             | highlights the clicked and dragged region: the x-span becomes a band on the horizontal axis and the y-span a band on the vertical axis, so the drag rect is their intersection                      |
| [showAllRegions](#action-showallregions)                                       | Actions    | DotplotView                                             |                                                                                                                                                                                                     |
| [initializeDisplayedRegions](#action-initializedisplayedregions)               | Actions    | DotplotView                                             |                                                                                                                                                                                                     |
| [onDotplotView](#action-ondotplotview)                                         | Actions    | DotplotView                                             | creates a linear synteny view from the clicked and dragged region                                                                                                                                   |
| [exportSvg](#action-exportsvg)                                                 | Actions    | DotplotView                                             | creates an svg export and save using FileSaver                                                                                                                                                      |
| [applySquare](#action-applysquare)                                             | Actions    | DotplotView                                             | Set both axes to the average bpPerPx (hview divided by `ratio`), re-anchoring each on the locus that was at its center.                                                                             |
| [squareView](#action-squareview)                                               | Actions    | DotplotView                                             | Equalize both axes' bpPerPx.                                                                                                                                                                        |
| [squareViewProportional](#action-squareviewproportional)                       | Actions    | DotplotView                                             |                                                                                                                                                                                                     |
| [displayName](#property-displayname)                                           | Properties | [BaseViewModel](../baseviewmodel)                       | displayName is displayed in the header of the view, or assembly names being used if none is specified                                                                                               |
| [minimized](#property-minimized)                                               | Properties | [BaseViewModel](../baseviewmodel)                       |                                                                                                                                                                                                     |
| [width](#volatile-width)                                                       | Volatiles  | [BaseViewModel](../baseviewmodel)                       |                                                                                                                                                                                                     |
| [setDisplayName](#action-setdisplayname)                                       | Actions    | [BaseViewModel](../baseviewmodel)                       |                                                                                                                                                                                                     |
| [setMinimized](#action-setminimized)                                           | Actions    | [BaseViewModel](../baseviewmodel)                       |                                                                                                                                                                                                     |
| [canvasDrawn](#volatile-canvasdrawn)                                           | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)         | flips true on first paint; read by test selectors to detect render                                                                                                                                  |
| [currentRenderingBackend](#volatile-currentrenderingbackend)                   | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)         | current backend reference, updated on context-loss recovery.                                                                                                                                        |
| [renderTick](#volatile-rendertick)                                             | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)         | counter the render autorun observes; bumped to force a re-render                                                                                                                                    |
| [autorunsInstalled](#volatile-autorunsinstalled)                               | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)         | guards attachRenderingBackend so the autorun pair spawns once per instance                                                                                                                          |
| [renderError](#volatile-rendererror)                                           | Volatiles  | [RenderLifecycleMixin](../renderlifecyclemixin)         | the render-backend (GPU/Canvas2D init or context-loss) error, or undefined.                                                                                                                         |
| [canRender](#getter-canrender)                                                 | Getters    | [RenderLifecycleMixin](../renderlifecyclemixin)         | Overridable precondition (default true): both lifecycle autoruns skip their callback entirely while this is false, so a display never has to open its own `upload`/`render` with a readiness check. |
| [markCanvasDrawn](#action-markcanvasdrawn)                                     | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)         |                                                                                                                                                                                                     |
| [resetCanvasDrawn](#action-resetcanvasdrawn)                                   | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)         |                                                                                                                                                                                                     |
| [stopRenderingBackend](#action-stoprenderingbackend)                           | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)         |                                                                                                                                                                                                     |
| [renderNow](#action-rendernow)                                                 | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)         |                                                                                                                                                                                                     |
| [setRenderError](#action-setrendererror)                                       | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)         | set/clear the render-backend error.                                                                                                                                                                 |
| [attachRenderingBackend](#action-attachrenderingbackend)                       | Actions    | [RenderLifecycleMixin](../renderlifecyclemixin)         | attach a GPU/Canvas2D backend and install the upload + render autorun pair (idempotent — re-calling only swaps the backend)                                                                         |
| [highlight](#property-highlight)                                               | Properties | [HighlightsMixin](../highlightsmixin)                   | translucent highlight bands, seeded from URL params or session JSON and added interactively via the rubber-band menu                                                                                |
| [showHighlightChips](#property-showhighlightchips)                             | Properties | [HighlightsMixin](../highlightsmixin)                   | controls whether the interactive highlight chip (link icon + context menu) is drawn on each highlight band; off by default                                                                          |
| [addToHighlights](#action-addtohighlights)                                     | Actions    | [HighlightsMixin](../highlightsmixin)                   |                                                                                                                                                                                                     |
| [setHighlight](#action-sethighlight)                                           | Actions    | [HighlightsMixin](../highlightsmixin)                   |                                                                                                                                                                                                     |
| [removeHighlight](#action-removehighlight)                                     | Actions    | [HighlightsMixin](../highlightsmixin)                   |                                                                                                                                                                                                     |
| [updateHighlight](#action-updatehighlight)                                     | Actions    | [HighlightsMixin](../highlightsmixin)                   |                                                                                                                                                                                                     |
| [setShowHighlightChips](#action-setshowhighlightchips)                         | Actions    | [HighlightsMixin](../highlightsmixin)                   |                                                                                                                                                                                                     |
| [awaitingAutoDiagonalize](#volatile-awaitingautodiagonalize)                   | Volatiles  | [DiagonalizeProgressMixin](../diagonalizeprogressmixin) | True while the init autorun is waiting on the diagonalize RPC.                                                                                                                                      |
| [autoDiagonalizeRequested](#volatile-autodiagonalizerequested)                 | Volatiles  | [DiagonalizeProgressMixin](../diagonalizeprogressmixin) | Set true as soon as an init-time autoDiagonalize is requested, before any render can paint.                                                                                                         |
| [autoDiagonalizeComplete](#volatile-autodiagonalizecomplete)                   | Volatiles  | [DiagonalizeProgressMixin](../diagonalizeprogressmixin) | Set true only after the init-time diagonalize pass RESOLVES successfully.                                                                                                                           |
| [diagonalizeStatus](#volatile-diagonalizestatus)                               | Volatiles  | [DiagonalizeProgressMixin](../diagonalizeprogressmixin) | Live status from the auto-diagonalize RPC (download %, parse, algorithm phase) shown on the reordering spinner; undefined outside that wait.                                                        |
| [diagonalizeStopToken](#volatile-diagonalizestoptoken)                         | Volatiles  | [DiagonalizeProgressMixin](../diagonalizeprogressmixin) | Stop token for the in-flight auto-diagonalize, so the spinner's Cancel can abort it; undefined when none is running.                                                                                |
| [diagonalizeSettled](#getter-diagonalizesettled)                               | Getters    | [DiagonalizeProgressMixin](../diagonalizeprogressmixin) | The diagonalize half of a view's `settled` gate: either no reorder was requested, or the one that was has completed.                                                                                |
| [setAwaitingAutoDiagonalize](#action-setawaitingautodiagonalize)               | Actions    | [DiagonalizeProgressMixin](../diagonalizeprogressmixin) |                                                                                                                                                                                                     |
| [setAutoDiagonalizeRequested](#action-setautodiagonalizerequested)             | Actions    | [DiagonalizeProgressMixin](../diagonalizeprogressmixin) |                                                                                                                                                                                                     |
| [setAutoDiagonalizeComplete](#action-setautodiagonalizecomplete)               | Actions    | [DiagonalizeProgressMixin](../diagonalizeprogressmixin) |                                                                                                                                                                                                     |
| [setDiagonalizeStatus](#action-setdiagonalizestatus)                           | Actions    | [DiagonalizeProgressMixin](../diagonalizeprogressmixin) |                                                                                                                                                                                                     |
| [setDiagonalizeStopToken](#action-setdiagonalizestoptoken)                     | Actions    | [DiagonalizeProgressMixin](../diagonalizeprogressmixin) |                                                                                                                                                                                                     |
| [cancelAutoDiagonalize](#action-cancelautodiagonalize)                         | Actions    | [DiagonalizeProgressMixin](../diagonalizeprogressmixin) | Abort an in-flight auto-diagonalize; `withDiagonalizeProgress`'s finally clears the wait flag, revealing the (undiagonalized) view.                                                                 |

<details>
<summary>DotplotView - Properties</summary>

#### property: trackSelectorType

vestigial: the hierarchical selector is the only one that exists, so this value
is ignored. Retained because saved sessions and configs persist it.

```ts
// type signature
type trackSelectorType = IOptionalIType<ISimpleType<string>, [undefined]>
// code
trackSelectorType: types.stripDefault(types.string, 'hierarchical')
```

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

| Member                                                 | Type                                                           |
| ------------------------------------------------------ | -------------------------------------------------------------- |
| <span id="property-id">id</span>                       | `IOptionalIType<ISimpleType<string>, [undefined]>`             |
| <span id="property-type">type</span>                   | `ISimpleType<"DotplotView">`                                   |
| <span id="property-height">height</span>               | `IOptionalIType<ISimpleType<number>, [undefined]>`             |
| <span id="property-assemblynames">assemblyNames</span> | `IOptionalIType<IArrayType<ISimpleType<string>>, [undefined]>` |
| <span id="property-drawcigar">drawCigar</span>         | `IOptionalIType<ISimpleType<boolean>, [undefined]>`            |
| <span id="property-hview">hview</span>                 | `IOptionalIType<IModelType<…>, [undefined]>`                   |
| <span id="property-vview">vview</span>                 | `IOptionalIType<IModelType<…>, [undefined]>`                   |
| <span id="property-tracks">tracks</span>               | `IArrayType<IAnyType>`                                         |

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

#### getter: viewWidth

Plot area width. Floored at 0: the axis borders have their own MIN_BORDER floor,
so a container narrower than that would otherwise yield a negative canvas
dimension and a negative maxBpPerPx.

```ts
type viewWidth = number
```

#### getter: viewHeight

Plot area height. Floored at 0, see viewWidth.

```ts
type viewHeight = number
```

#### getter: dotplotDisplays

DotplotDisplays under each track, indexed to match `tracks`.

```ts
type dotplotDisplays = (ModelInstanceTypeProps<_OverrideProps<Omit<…>, { ...; }>> & ... 12 more ... & IStateTreeNode<...>)[]
```

#### getter: colorBy

The color-by mode the whole plot renders with. colorBy is stored per display (it
feeds the display's own geometry rebuild), but every control writes it to all of
them at once, so the view resolves it once here instead of each consumer
re-deriving it from `dotplotDisplays[0]` with its own fallback — two of them
disagreed, one running the raw string through `coerceColorBy` and one not, so an
unrecognized value lit the legend as 'default' while the menu showed no mode
checked.

```ts
type colorBy =
  | 'default'
  | 'strand'
  | 'query'
  | 'target'
  | 'reference'
  | 'identity'
  | 'meanQueryIdentity'
  | 'mappingQuality'
```

#### getter: alpha

Plot-wide alpha. See colorBy: resolved here so the no-display case is answered
once. Matches the display schema's own default.

```ts
type alpha = number
```

#### getter: minAlignmentLength

Plot-wide minimum alignment length filter, in bp. See colorBy.

```ts
type minAlignmentLength = number
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

True if any track has an adapter with tiered storage. Used to gate the LOD menu
— only the indexed PIF adapters have tiers.

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
| <span id="getter-hblocklabelkeystohide">hblockLabelKeysToHide</span> | `Set<string>`                                                           |
| <span id="getter-vblocklabelkeystohide">vblockLabelKeysToHide</span> | `Set<string>`                                                           |
| <span id="getter-views">views</span>                                 | `(ModelInstanceTypeProps<…> & ... 10 more ... & IStateTreeNode<...>)[]` |
| <span id="getter-error">error</span>                                 | `unknown`                                                               |

</details>

<details>
<summary>DotplotView - Methods</summary>

#### method: getCoords

Both corners of a drag rect, in bp on each axis. The vertical axis lays out
bottom-up, so its pixels are flipped through viewHeight first. Undefined for a
drag too small to be a selection — the same threshold the interaction hook uses
to tell a drag from a click.

```ts
type getCoords = (
  mousedown: Coord,
  mouseup: Coord,
) =>
  | { x1: PxToBpResult; x2: PxToBpResult; y1: PxToBpResult; y2: PxToBpResult }
  | undefined
```

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

| Member                                       | Type                                                                                                                                                     |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <span id="method-menuitems">menuItems</span> | `() => (MenuDivider \| MenuSubHeader \| NormalMenuItem \| CheckboxMenuItem \| RadioMenuItem \| SubMenuItem \| CustomMenuItem \| { ...; } \| { ...; })[]` |

</details>

<details>
<summary>DotplotView - Actions</summary>

#### action: setColorBy

Fan a per-display render setting out to every display, so the view-level getters
above stay the single answer for the whole plot. The controls are view-level
(one palette menu, one settings popover) even though the state is per-display,
so every writer went through the same loop — it lives here now instead of at
each call site.

```ts
type setColorBy = (
  value:
    | 'default'
    | 'strand'
    | 'query'
    | 'target'
    | 'reference'
    | 'identity'
    | 'meanQueryIdentity'
    | 'mappingQuality',
) => void
```

#### action: clearView

returns to the import form

```ts
type clearView = () => void
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

#### action: applySquare

Set both axes to the average bpPerPx (hview divided by `ratio`), re-anchoring
each on the locus that was at its center. setBpPerPx alone would leave offsetPx
untouched while bpPerPx changed under it, scrolling the plot; the centerAt calls
are what hold it still.

```ts
type applySquare = (ratio: number) => void
```

#### action: squareView

Equalize both axes' bpPerPx. Also what the aspect-ratio lock applies to absorb
divergence from box-zoom and other per-axis operations — deliberately not
clamped to either axis's own maxBpPerPx, since a shared bpPerPx that fits the
larger genome necessarily exceeds the smaller axis's limit, and it converges in
one step where a clamped one would ping-pong between the two maxima.

```ts
type squareView = () => void
```

</details>

<details>
<summary>DotplotView - Actions (other undocumented members)</summary>

| Member                                                                         | Type                                                 |
| ------------------------------------------------------------------------------ | ---------------------------------------------------- |
| <span id="action-setimportformsyntenytrack">setImportFormSyntenyTrack</span>   | `(arg: number, val: ImportFormSyntenyTrack) => void` |
| <span id="action-startrenderingbackend">startRenderingBackend</span>           | `(backend: DotplotRenderingBackend) => void`         |
| <span id="action-setcursormode">setCursorMode</span>                           | `(mode: CursorMode) => void`                         |
| <span id="action-setdrawcigar">setDrawCigar</span>                             | `(flag: boolean) => void`                            |
| <span id="action-setlodmode">setLodMode</span>                                 | `(value: LodMode) => void`                           |
| <span id="action-setlockaspectratio">setLockAspectRatio</span>                 | `(flag: boolean) => void`                            |
| <span id="action-setlinewidth">setLineWidth</span>                             | `(value: number) => void`                            |
| <span id="action-setshowcolorlegend">setShowColorLegend</span>                 | `(arg: boolean) => void`                             |
| <span id="action-setalpha">setAlpha</span>                                     | `(value: number) => void`                            |
| <span id="action-setminalignmentlength">setMinAlignmentLength</span>           | `(value: number) => void`                            |
| <span id="action-setwidth">setWidth</span>                                     | `(newWidth: number) => number`                       |
| <span id="action-setheight">setHeight</span>                                   | `(newHeight: number) => number`                      |
| <span id="action-seterror">setError</span>                                     | `(e: unknown) => void`                               |
| <span id="action-setinit">setInit</span>                                       | `(init?: DotplotViewInit \| undefined) => void`      |
| <span id="action-zoomout">zoomOut</span>                                       | `() => void`                                         |
| <span id="action-zoomin">zoomIn</span>                                         | `() => void`                                         |
| <span id="action-activatetrackselector">activateTrackSelector</span>           | `() => Widget`                                       |
| <span id="action-showtrack">showTrack</span>                                   | `(trackId: string, initialSnapshot?: any) => any`    |
| <span id="action-hidetrack">hideTrack</span>                                   | `(trackId: string) => boolean`                       |
| <span id="action-toggletrack">toggleTrack</span>                               | `(trackId: string) => boolean`                       |
| <span id="action-setassemblynames">setAssemblyNames</span>                     | `(target: string, query: string) => void`            |
| <span id="action-showallregions">showAllRegions</span>                         | `() => void`                                         |
| <span id="action-initializedisplayedregions">initializeDisplayedRegions</span> | `() => void`                                         |
| <span id="action-squareviewproportional">squareViewProportional</span>         | `() => void`                                         |

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

**Getters**

#### getter: canRender

Overridable precondition (default true): both lifecycle autoruns skip their
callback entirely while this is false, so a display never has to open its own
`upload`/`render` with a readiness check.

The LGV mixins override it with `view.initialized`, because before the view is
measured its geometry throws by design (`view.width`, and so `visibleRegions` /
`trackWidthPx` with it) and a throw in either callback is routed to
`renderError` — surfacing "not measured yet" as the GPU render-error banner.
Because it's an observable read inside the autoruns, the pair re-fires the
moment it flips. This is the _precondition_ axis only: whether any data has
arrived stays the render callback's own gate (return `false` to skip a tick),
which is why `renderState` getters can be plain resolved values.

```ts
type canRender = boolean
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

<details>
<summary>Derived from DiagonalizeProgressMixin</summary>

[DiagonalizeProgressMixin →](../diagonalizeprogressmixin)

**Volatiles**

#### volatile: awaitingAutoDiagonalize

True while the init autorun is waiting on the diagonalize RPC. Gates the canvas
off — otherwise the user watches an undiagonalized hairball flash before the
reorder kicks in.

```ts
// type signature
type awaitingAutoDiagonalize = false
// code
awaitingAutoDiagonalize: false
```

#### volatile: autoDiagonalizeRequested

Set true as soon as an init-time autoDiagonalize is requested, before any render
can paint. Gates `diagonalizeSettled` so a capture can't commit the pre-reorder
view during the view-building await window, before `awaitingAutoDiagonalize`
flips.

```ts
// type signature
type autoDiagonalizeRequested = false
// code
autoDiagonalizeRequested: false
```

#### volatile: autoDiagonalizeComplete

Set true only after the init-time diagonalize pass RESOLVES successfully. If the
reorder is skipped or throws this stays false, so `diagonalizeSettled` never
reports done on an undiagonalized view — the capture fails loudly (times out)
instead of committing a hairball.

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

**Getters**

#### getter: diagonalizeSettled

The diagonalize half of a view's `settled` gate: either no reorder was
requested, or the one that was has completed.

```ts
type diagonalizeSettled = boolean
```

**Actions**

#### action: cancelAutoDiagonalize

Abort an in-flight auto-diagonalize; `withDiagonalizeProgress`'s finally clears
the wait flag, revealing the (undiagonalized) view.

```ts
type cancelAutoDiagonalize = () => void
```

| Member                                                                           | Type                                     |
| -------------------------------------------------------------------------------- | ---------------------------------------- |
| <span id="action-setawaitingautodiagonalize">setAwaitingAutoDiagonalize</span>   | `(arg: boolean) => void`                 |
| <span id="action-setautodiagonalizerequested">setAutoDiagonalizeRequested</span> | `(arg: boolean) => void`                 |
| <span id="action-setautodiagonalizecomplete">setAutoDiagonalizeComplete</span>   | `(arg: boolean) => void`                 |
| <span id="action-setdiagonalizestatus">setDiagonalizeStatus</span>               | `(arg?: RpcStatus \| undefined) => void` |
| <span id="action-setdiagonalizestoptoken">setDiagonalizeStopToken</span>         | `(arg?: StopToken \| undefined) => void` |

</details>
