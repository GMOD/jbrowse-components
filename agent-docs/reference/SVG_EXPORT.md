---
name: svg-export
description: What shape must a display's renderSvg take, and what must be terminal for the export to finish? Covers the svgReady gate, paintLayer dispatch, clip ids and serialization.
kind: spec
---

# SVG export pipeline

SVG export and on-screen rendering share the same pure Canvas2D draw functions.
**The GPU shader path is an accelerator; the Canvas2D draw function is the
source of truth, and SVG export runs it.** See
[GPU_BACKENDS.md](GPU_BACKENDS.md#keeping-the-two-backends-in-parity). The
summary is [DISPLAY_PIPELINE.md](DISPLAY_PIPELINE.md#svg-export).

## The renderSvg.tsx shape (every LGV display)

`renderSvg` is optional. A display without one drops from the export like a
minimized track, and `notifySkippedSvgTracks` names it. It is one call,
`renderDisplaySvg(model, opts, XxxSvgBody)`.

- The body is a **component**, not a callback returning JSX: `SvgChrome` renders
  its terminal box instead of its children, so the body never runs in a terminal
  state and never re-detects one from empty data.
- `overlays` is false under `plotOnly` (the circular view's ring export), so a
  body drops labels, trees, arcs and other overlays the screen draws over it.
- Never re-inline `when(() => ...)` or mount `SvgChrome` by hand. Duck-typed model
  interfaces `extends SvgExportable`, so a missing field fails the build.
- Render empty naturally. Never gate a body on data size: it wrongly drops a
  legitimate empty render.
- A body draws no key. The exporting view sets each display's `SvgLegend` in a
  gutter right of the plot, which `renderViewTracks` sizes from the keys that
  exist, so a figure with no key has no empty strip. A view's own key (the
  synteny view's, the breakpoint split view's connection key) goes in the same
  gutter beside the first row, and the view's page subject (`legendWidth`)
  carries its width into a page export's chrome. The circular view's key sits
  in a gutter right of its square circle. `settledPageLayout` measures each
  key at the height it is drawn, and solves the page again once the tracks
  have reloaded at the plot width, laying out once more where the chrome
  moved: the root scales whatever document results to the page width, so a
  wrong chrome rescales every text size.

**A track exports at its box height**, empty band included: the figure is what
the screen shows, and a reader who wants it tight sets the height. A synteny
row draws no scalebar, since its ruler already scales a whole chromosome; a
breakpoint split row is a kilobase window and draws one.

**The export canvas width is `view.width`**, not `renderState.canvasWidth`
(`view.trackWidthPx`, 2px narrower); reusing the on-screen width clips the last
column. A model that lays its cells out at its own width takes the width as a
parameter, and the export asks for its cells at `view.width` (the multi-way
display's `figureAt`). A body paints a mark list through `MarkSvgLayer`
(display-kit), which replaces the state's canvas box with the layer's own
`width` and `height`; its `paint` callback draws the overlays the screen stacks
over its canvas, with the same framed state.

**Colors come from `usePalette()`**, never `getPaletteHost` or the session: the
export dialog picks a theme the session need not be showing. A model input built
from the theme gets a twin taking the palette (`colorPaletteIn`,
`rowsEncodePropsIn`), and the body calls that; patching a palette into the
getter's output re-copies model logic into the export. Several inputs off one
palette share one twin: the alignments display's `themedIn(theme)` returns its
palette, read-connection and junction feeds and the sections joining them, each
member memoized on its own; `themed` returns the same for the session theme.

The exported key draws `legendSpecIn(palette)`, so a display whose key takes
colors from the theme overrides `LegendMixin`'s `colorScalesIn` (alignments,
MAF); the default is `colorScales`. A ring's exports run `plotOnly`, so the
circular view's own key (`CircularView.legendSpecIn`) reads each ring's
`legendSpecIn` instead. A ring settled too large has no strip to warp, so it
leaves with its band, axis and key row and `notifySkippedSvgTracks` names it:
the export lays out only the rings it draws and starts the chords inside them
(`ExportChordRadiusContext`), where the screen keeps the band for its status
line. Where the screen scaled its rings to fit, closing a band widens the rest
past the strips they were laid out at. jb2export prints these "Not included in
the SVG" notices on stderr. A ring whose on-screen paint failed still exports
through its Canvas2D path.

**Text inherits the export's font.** The dialog puts `font-family` on the root,
so a `<text>` that writes the theme's family overrides it; measure in
`opts.fontFamily` and leave the attribute off. Text stays vector under
`rasterizeLayers`: a body paints its labels and letters in a `PaintLayer` of
their own without `opts`, over the layer that gets them (the feature labels,
the variant records band's labels, the pileup's mismatch letters and indel
counts, the reference sequence's letters). A view whose layout is sized off
its text lays out in that family for the export's length: the dotplot sets
`axisFontFamily` so its axis borders, and the plot inside them, follow it. A
label that would cross its axis's far edge is dropped, not clipped.

**A live figure (`useViewSvgFigure`) freezes against one snapshot.** An export
draws plain components that read the model once, never an on-screen observer:
an observer follows the view, so a pan slides its labels across layers drawn
before it. The `observer` lint rule names its exemptions.

**A figure carries the pinned highlight only, never a hover or a selection**:
both say where the reader's pointer was. The one pick that does export is the
SV inspector's row: `ShapePaths` dims every chord outside `dimmedFeatureIds`,
since choosing a row is how a reader asks for a figure of one variant. A body that hands live render params to
a painter zeroes them (`hoveredFeatureId`, `clickedFeatureId` in the synteny and
multi-way exports), and the chord export draws every shape resting.

**A figure says what its box leaves out.** A pileup deeper than its track ends
on its last whole row over a caption line counting the rows above and below
and saying whether the layout's ceiling left reads unstacked
(`svgPileupCut`, `exportPileupCut.ts`); a track too short for a whole row over
that line exports uncut, and the breakpoint split view ends its read curves at
the cut (`overlayLevel`). A row display showing fewer rows than it has appends
"· showing N of M rows" to its exported label (`svgTrackLabelNote`), standing
in for the chip the export drops with the controls. Hi-C and LD keys are off
on screen and on in an export until `legend.show` is set
(`FigureLegend`, `showLegendInExport`).

## The `svgReady` gate

Every GPU display exposes `svgReady`, and the off-screen renderer awaits only
that. An inlined `data != null || error || regionTooLarge` resolves on the first
datum (partial multi-region export) and stays true through an in-place refetch
(stale pan/zoom export).

`svgReady` excludes `canvasDrawn`: an off-screen export runs on a display whose
canvas may never have painted (headless jbrowse-img), so gating on the paint flag
hangs forever.

#### Who calls `isDataCurrent`

<!-- BEGIN GENERATED FRESHNESS_SIGNATURE_CENSUS -->

_Generated by `pnpm autogen` — edit the source, not this block._

15 calls across 5 packages compare the signature held data was loaded for against the one live state calls for. A display foundation's `dataCurrent` is one such call; the others judge an adapter cache, a prerequisite fetch or a byte gate the same way.

<!-- prettier-ignore -->
| Caller | Loaded signature | Live signature |
| --- | --- | --- |
| `packages/core/src/util/adapterMetadata.ts` | `cached.adapterConfig` | `adapterConfig` |
| `packages/core/src/util/installFetch.ts` | `heldKey()` | `fetchKey(args)` |
| `packages/core/src/util/installPrerequisiteFetch.ts` | `read.adapterConfig` | `host.adapterConfig` |
| `packages/core/src/util/installPrerequisiteFetch.ts` | `adapterConfig` | `self.adapterConfig` |
| `packages/display-kit/src/CoarseTierMixin.ts` | `held.key` | `read.key` |
| `packages/display-kit/src/installGlobalFetchAutorun.ts` | `self.loadedFetchKey` | `issue.signature` |
| `packages/display-kit/src/KeyedFetchMixin.ts` | `self.loadedFetchKey` | `self.currentFetchKey` |
| `packages/display-kit/src/MultiRegionDisplayMixin.ts` | `self.loadedRegions.get(displayedRegionIndex)?.fetchInputs` | `self.fetchInputs` |
| `packages/display-kit/src/MultiRegionDisplayMixin.ts` | `loaded.fetchInputs.settings` | `settings` |
| `packages/display-kit/src/RegionTooLargeMixin.ts` | `self.gateMeasuredViewportKey` | `self.gateViewport?.key` |
| `packages/display-kit/src/regionTooLargeUtils.ts` | `tierKey` | `currentTierKey` |
| `plugins/breakpoint-split-view/src/BreakpointSplitView/model.ts` | `self.overlayLoadedKey` | `this.overlayFetchKey` |
| `plugins/features/src/shared/FeatureGateMixin.ts` | `tierKey` | `host(self).byteGateAdapterConfig` |
| `plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/afterAttach.ts` | `self.loadedFetchKey` | `self.currentFetchKey` |
| `plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/model.ts` | `self.loadedFetchKey` | `self.currentFetchKey` |

<!-- END GENERATED FRESHNESS_SIGNATURE_CENSUS -->

### The view-level wait: `awaitViewInitialized`

Every view's `renderToSvg` opens with `awaitViewInitialized(model)`
(`@jbrowse/core/svg/svgReady`). A bare `when(() => model.initialized)` hangs
silently when an assembly fails to load, and `initialized` can go true
mid-launch while tracks still attach. Every view's `error` must therefore be
**resolved** (assembly and sub-view errors folded in), not the raw
`volatileError`. A view whose `hasSomethingToShow` is false, its import form,
fails there at once: the synteny and dotplot views are never `initialized` on
theirs.

A fetch the view owns rather than a display (the breakpoint split view's
variant-call overlay) gets its own readiness getter, `computeSvgReady` over its
error and the key it last committed (`overlaySvgReady`), and `renderToSvg`
awaits it through `awaitSvgReady` after the rows render, so a failed overlay
fetch fails the export the way a failed track does. Its page subject hands the
same wait to the page solve as `settled`, since the key lists calls only once
the overlay has committed.

### Every resting state that never fetches must be terminal

`dataCurrent` says whether held data is current, not whether data will ever
arrive. A display that can sit with its fetch trigger false (a user toggle, an
unmet prerequisite, a standing cancel, a static "zoom in" mode) must reach
`svgReady` through `error`, `regionTooLarge`, `fetchCanceled` or `fetchInert`.
`awaitSvgReady`'s only bound is the half-hour `SVG_READY_TIMEOUT_MS`, so one such
track hangs the whole view's export with the dialog spinner up. The loading
overlay is terminal on the same set, and `fetchInert` is one `FetchMixin` hook
(default `false`, the strict answer) because a cross-display reader such as
`displaysSettled` can only read a name the mixin declares
([ADR-082](../architecture-decision-records/adr-082-one-hook-for-a-display-that-will-not-fetch.md)).
Read the display's fetch gate, enumerate every way its prerequisite fails (not
just the throw), and ask what leaves it declining forever:

- **A failed prerequisite fetch** (HiC's `CoreGetInfo`): terminal failures go in
  `setError`, not `notifyError`; retriable ones run from an autorun on
  `reloadCounter`. Cover an empty binsize list too.
- **The containing view is empty** (chord display's `extraTerminal`).

## Cancelling an export

`ViewExportSvgOptions.signal` cancels an export: the dialog's Cancel aborts it,
and so does the session thumbnail's timeout. The linear genome, synteny and
breakpoint views export one at a time through `exportLaidOut` (`pageLayout.ts`),
so a stuck export would hold up every later one. There an abort rejects at once,
puts the on-screen width back and frees the queue, and an export aborted while
queued never starts. `exportViewSvg` checks the signal again before it saves,
which is the only stop the dotplot and circular views have.

The signal stops above `renderToSvg`. A render already running finishes
detached and its result is dropped, so `awaitSvgReady` and the displays never
see the signal.

## PaintLayer: raster-vs-vector dispatch

- **A scale that rounds to zero must not go in the ctx matrix.** `serializeSvg`
  rounds every `transform` to 2 decimals, so a `ctx.scale` below 0.005 exports
  blank (Hi-C's `1 / bpPerPx` at megabase windows). Multiply a uniform scale onto
  the coordinates. Suspect this first for an export blank only in wide views.
- **No hand-rolled JSX-SVG for anything draw-shaped** in `renderSvg.tsx`; it
  cannot rasterize and drifts from on-screen output. Exceptions: trivial chrome
  (`SvgClipRect`); Bezier-arc overlays sharing a `computeXxxArcs` with the screen
  ("interactive" is not a reason; ADR-163 ended the arc plugin's). A control
  and a caption cannot share a component (`LaneHeaders` / `SvgLaneHeaders`).

## Clip-path ids must be model-scoped

Every `id` on a `<clipPath>`/`<use>` is scoped by the owning view or display
model's `.id`. SVG ids are document-global and `url(#x)` resolves to the first
match, so the second clipped group renders unclipped, which surfaces only when
two panels share a document. `exportAndVerifySvg` asserts no duplicate ids.
Prefer `SvgClipRect`.

## Serialization: `serializeSvg`

- **XML entities only.** U+00A0 becomes `&#160;`; `&nbsp;` breaks the `.svg`, the
  PNG path and `rsvg-convert`.

Every export tree mounts `SvgThemeProviders`, or a `usePalette` body draws in the
default light theme.
