---
name: displaychrome
description: The shared display status chrome that owns loading, error, and retry UI, plus its adoption map. Read when touching loading/error/retry UI on a display.
---

# DisplayChrome — the shared display status chrome

## TL;DR

- The single wrapper every GPU/Canvas2D-backed LGV display renders. It owns
  `useRenderingBackend` and all terminal-state UI, so a display can't paint a
  canvas while skipping a terminal state.
- It branches on one getter, `model.displayPhase`, whose precedence
  (`renderError > tooLarge > error > loading > ready`) is single-sourced in
  `computeDisplayPhase`. Never re-encode it as `&& !error && !regionTooLarge`.
- `renderError`/`tooLarge` replace the subtree (canvas unmounts,
  `backend.dispose()`); `error`/`loading` are overlays over a live canvas.
- A status set while the phase is `ready` — work with no fetch behind it, e.g.
  declarative clustering — renders as a corner `ProgressChip`
  (`DisplayBackgroundProgress`), not the scrim: the drawn content is still
  usable. Report such work through the display's own `setStatusMessage` and it
  shows up; don't add a phase for it.
- Always: a thin outer owns the chrome, a named observer body owns the canvas
  and overlays, joined by a render-prop child.
- Load-bearing: a terminal state **replaces the subtree** (that is what disposes
  the backend) and `displayPhase`'s loading term is a **thunk**. Early-`return`
  vs ternary is style only, since `'use no memo'`.
- 15 LGV displays use it. Off it by design: arc/paired-arc (main-thread SVG),
  dotplot and synteny (non-LGV, drop to `useRenderingBackend`), circular-view
  (radial, own banners).
- The three `-done` testid shapes are redundant but frozen: a contract across
  four test systems.

Related: banner content for `tooLarge` is in
[REGION_TOO_LARGE.md](REGION_TOO_LARGE.md); the rejected refactors (don't
re-litigate) are in
[ADR-026](../architecture-decision-records/adr-026-displaychrome-layering-stays.md);
the mount/dispose contract is in
[ADR-025](../architecture-decision-records/adr-025-gpu-canvas-stays-mounted-not-xor-error.md).

## What it is

`DisplayChrome`
(`plugins/linear-genome-view/src/BaseLinearDisplay/components/DisplayChrome.tsx`)
does three things:

- calls `useRenderingBackend(factory, model)`, so the backend hook lives in
  exactly one place,
- branches on `model.displayPhase`, whose precedence is computed by
  `computeDisplayPhase` (`packages/render-core/src/displayPhase.ts`),
- hands `{ canvasRef, canvas }` to the body via a render-prop child.

The lifecycle state (`canvasDrawn`, `renderError`, `currentRenderingBackend`,
`renderTick`) lives on `RenderLifecycleMixin`
(`packages/render-core/src/RenderLifecycleMixin.ts`), which every GPU display
composes. Plugins never re-declare it.

Every GPU display follows one shape:

```tsx
<DisplayChrome model={model} factory={Renderer} testid="x-display" ...divProps>
  {({ canvasRef, canvas }) => <XBody model={model} canvasRef={canvasRef} .../>}
</DisplayChrome>
```

The thin outer owns the chrome, plus any hook bound to its container ref (maf's
drag-select, alignments' mouse tracking). The named observer body owns the canvas
and overlays, so observable reads scope to the body rather than the chrome.

## Adoption map

**Direct users (12), rendering `DisplayChrome` themselves:** canvas
LinearBasicDisplay (via `FeatureComponent`), canvas LinearMultiRowFeatureDisplay,
wiggle, multi-wiggle, gwas manhattan, sequence, maf, alignments, hic, LD,
multi-sample-variant, variant-matrix.

**Reuse one of those components (3):** `LGVSyntenyDisplay` → LinearAlignmentsDisplay's
component; `LinearGCContentDisplay` → wiggle's; `LinearVariantDisplay` →
LinearBasicDisplay's (borrowed off the DisplayType registry, so no cross-plugin
component import). They get the chrome for free.

**SVG exception (2): arc / paired-arc.** These render main-thread SVG (no worker,
no GPU backend, all features in one array), so they can't wrap `DisplayChrome`,
which owns the backend hook. They share the concept without the backend:
`ArcFetchModel` exposes `displayPhase` off the same `computeDisplayPhase` (with
`renderError: undefined` — arc has no GPU error phase), and
`plugins/arc/src/shared/BaseDisplayComponent.tsx` branches on `model.displayPhase`
exactly as the chrome does, rendering the same shared banners
(`DisplayErrorBar`, `DisplayLoadingOverlay`, `TooLargeMessage`) and publishing
the same `data-display-phase` attribute. The phase lives on the model, not in the
component, for the same reason it does for a GPU display: the component then
can't disagree with it. Only the container and the readiness flag (`svgReady`,
not `canvasDrawn`) are arc-local, so precedence and visuals stay single-sourced. See `plugins/arc/CLAUDE.md`.

Arc's fetch autorun is `error`-gated, so its `reload()` clears `error` to re-fire
it. Without that override the shared error bar's retry would be dead.

**The retry affordance is a contract, and `reload()` is the display's half of
it.** `DisplayErrorBar`'s only action is `model.reload()`, so every state that
can raise the error bar must be one `reload()` actually undoes — otherwise the
button is present, looks live, and does nothing. Two shapes have failed it:

- **A gate `reload()` doesn't clear.** Arc, above: `shouldFetch` is
  `!regionTooLarge && !dataCurrent`, so the base `reload()`'s `reloadCounter`
  bump refires the autorun into a no-op until `loadedRegionSignature` is dropped
  too.
- **Work `reload()` never re-runs.** HiC's normalization/binsize header read was
  a bare `afterAttach` IIFE, so a retry cleared the error and dropped straight
  back onto the permanent scrim — the header was never re-read. It now runs from
  an autorun tracking `reloadCounter`, which is what makes the button real.
  Pinned by `LinearHicDisplay/infoFetchFailure.test.ts`.

The check when adding a display: raise each error it can produce, press retry,
and confirm the display can actually leave that state.

**Not on DisplayChrome, by design (non-LGV views).** Two distinct reasons, not to
be conflated:

- **GPU, dropping to the `useRenderingBackend` primitive directly:**
  `dotplot-view` and `linear-comparative-view` (synteny). Both are non-LGV view
  types with no `ChromeModel` contract (`displayPhase` / `regionTooLarge` /
  `height`), so the chrome doesn't fit. This is the sanctioned
  drop-to-primitive path, not partial adoption. Don't force them onto
  DisplayChrome. What they owe in exchange: because their canvas stays mounted
  through an error rather than being replaced by a banner, they must key it on the
  hook's `canvasKey` (`<canvas key={canvasKey}>`) so a re-init gets an element
  that never held a context. Neither WebGL nor Canvas2D can bind to one that did
  — see GPU_RENDERING.md "Context-loss recovery".
- **Main-thread SVG, own radial banners:** `circular-view` (ChordVariant) is not
  a GPU display at all, having no `useRenderingBackend`, `RenderLifecycleMixin`,
  or `canvasDrawn`. It renders SVG chords (`SVChordsReactComponent`) gated on
  `display.features` / `display.error` with a plain ternary, and keeps its own
  `Loading` (radial spinner) and `DisplayError` (chord-circle text) components,
  because the rectangular LGV banners (`BlockMsg`, "Force load", "Zoom in to see
  features") don't fit a radial view. Arc, by contrast, is an *LGV* SVG display,
  so it can reuse the LGV banners; circular's radial medium is why it can't.

## First-paint `-done` testid

The readiness gate is `canvasDrawn` (GPU) / `svgReady` (arc), expressed once.
DisplayChrome takes a `testid` base and appends `-done` on `canvasDrawn`, so
consumers never hand-write the ternary. Two other emitters coexist by design
(ADR-026 "distinct roles, not drift"): the generic `display-${id}-done` from the
`BaseLinearDisplay.tsx` wrapper, and the standalone `synteny_canvas_done` /
`dotplot_webgl_canvas_done` on the non-LGV views. Displays that pixel-match the
canvas give the inner `<canvas>` a static selector (`hic_canvas`, `ld_canvas`,
`variant_canvas`, `variant_matrix_canvas`) as a query target: tests wait on
`${base}-done`, then read the static selector.

### Three testid shapes coexist — and why they aren't unified

Two things vary per display: the `testid` base passed to DisplayChrome, and
whether the outer `BaseLinearDisplay.tsx` container sits above it. Five displays
render inside that second `position:relative` container, which emits
`display-${id}-done` on its own — three of them (wiggle, manhattan,
multi-wiggle) by registering `ReactComponent: BaseLinearDisplayComponent`, whose
body comes from the model's `DisplayMessageComponent` getter; the canvas family
(canvas-basic, LinearVariant) by composing that container itself
(`DisplayContainer`, the same `-done` div, exported from the same file) around the
canvas body in `LinearBasicDisplayComponent` — which is what let the canvas model
drop the getter and with it the model↔component cycle.

The canvas family shares that **one** registered component: LinearVariantDisplay
borrows it via `pluginManager.getDisplayType('LinearBasicDisplay').ReactComponent`
(the LGVSyntenyDisplay move) rather than importing a component across the plugin
boundary. Chrome only one of them has arrives through overridable hooks on the
canvas base model — `colorLegend` (variants' color key) and `geneGlyphNotice`
(the isoform-collapse chip) — each defaulting to absent, so the shared component
never reads a field the display it's rendering doesn't have. Because the state
lives on the model rather than in a per-display component, the SVG export reads
the same `colorLegend` and bakes the key in (`renderSvg.tsx`, via the shared
`SvgColorLegend`). The resulting emitters:

| Display(s) | Base → DisplayChrome | `-done` testid(s) emitted |
| --- | --- | --- |
| maf, alignments | `display-${id}` | `display-${id}-done` (chrome) |
| canvas-basic, LinearVariant | none — container only | `display-${id}-done` (container) |
| wiggle, manhattan, multi-wiggle | `<type>-display` + wrapper | **both** `display-${id}-done` (wrapper) and `<type>-display-done` (chrome) |
| every other display | `<type>-display` | `<type>-display-done` (chrome) |

LinearVariant additionally leans on the container to position its
`FloatingLegend` child.

This is genuine redundancy: a nested container duplicating DisplayChrome's own
`position:relative` and `-done`. It is deliberately not collapsed, because the
`-done` selectors are a load-bearing contract across four test systems, only one
of which (jest/jsdom) runs outside CI:

- puppeteer browser-tests wait `[data-testid^="display-${trackId}"]`
  (`browser-tests/helpers.ts`), `[data-testid^="display-"]`
  (`redraw`/`demo-inventory`/`main-thread-rpc`); these hard-require the generic
  `display-${id}` prefix for feature/canvas tracks,
- cypress (`component_tests/lgv-vite`) and website screenshot specs
  (`readySelector: '[data-testid="…-display-done"]'`) pin the static bases.

So removing the wrapper (making DisplayChrome the sole emitter) changes which
element carries `display-${id}-done`, which is unverifiable without a full
build + GPU + headless-Chrome run. Any unification pass must land on a branch
where the browser-test, website-spec, and cypress suites are green, not blind.
Sequenced plan when that's available: (a) make DisplayChrome emit the generic
`display-${id}-done` for every display; (b) migrate the static-base tests to it
or keep both during a deprecation window; (c) drop `BaseLinearDisplay.tsx` from
the GPU path, moving LinearVariant's `FloatingLegend` into its own DisplayChrome
child. Until then, treat the redundancy as frozen. (Step (c) is half-prepared:
canvas-basic and LinearVariant already compose `DisplayContainer` explicitly, so
for them it's now a matter of moving the legend and deleting one wrapper element
— no getter indirection in the way.)

## The bring-your-own seams

Two of them, and they answer different questions. Both default to *undefined*
rather than to a component set, so a display rendering outside any provider
(unit tests, SVG export, breakpoint-split-view's `overlayUtils`) keeps JBrowse's
own look — a plain default would degrade those invisibly.

| what                                  | provider                        | plain set              | rendered by             |
| ------------------------------------- | ------------------------------- | ---------------------- | ----------------------- |
| the five `displayPhase` states        | `DisplayChromeOverlayProvider`  | `plainChromeOverlays`  | `DisplayChromeBase`     |
| the bottom-right ambient controls     | `TrackControlProvider`          | `plainTrackControl`    | each display's own body |

They stay separate because `DisplayChromeBase` takes its overlay set as a *prop*
and never renders a track control; folding the two would put entries in
`DisplayChromeOverlays` that the chrome ignores.

**A third seam was considered for the tooltip and rejected.** `BaseTooltip` is
rendered by each display directly, behind neither provider, and it used to style
itself through `makeStyles(theme => …)` — so in a host that mounts no
`ThemeProvider` it drew MUI's *default* grey chip in Roboto, and the BYO smoke
census (which counts `Mui*` classnames) scored it zero. What it actually needed
was colors, and colors already have a toolkit-free home: it reads `usePalette()`
and inline styles now, and no provider was added. Reach for the palette before
reaching for a fourth context — a component that only needs colors doesn't need
a seam. `BaseTooltip.test.tsx` pins the plain rendering, because the browser
census can only see a tooltip that a headless hover happened to raise.

**Reach vs weight.** Both providers are *reach*: they redirect what stock
displays render, but `DisplayChrome`/`TrackControl` still reference MUI, so it
stays in the bundle. *Weight* is only available to code writing its own display
component — `DisplayChromeBase` + a `TrackControlComponent` of its own import no
toolkit at all. `pnpm measure-chrome-bundle` measures the first half of that and
CI re-checks it.

Every ambient corner control (`TrackHeightIndicator`, canvas's
`GeneGlyphControl` and `SoloSelectionChip`) is a thin wrapper that *describes*
itself as `TrackControlProps` — an icon **name**, never an element, because an
element would drag an icon package back into every display — and renders
`TrackControl`. Add a new corner control that way, not by importing MUI
directly; `products/jbrowse-build-your-own`'s smoke test counts rendered MUI
elements per page and a direct import shows up there as a regression.

## Load-bearing gotchas

Three things get cited here. Two are load-bearing, one is not, and conflating
them is why this section exists. All are guarded by `DisplayChrome.test.tsx` and
restated in the `DisplayChrome.tsx` comment block.

- **Tree shape (load-bearing):** a terminal state renders as the component's
  *entire* output rather than sitting beside a still-mounted canvas. That unmount
  is what fires `canvasRef(null)` → effect cleanup → `backend.dispose()` +
  `stopRenderingBackend()`, with force-load re-initializing through the callback
  ref.
- **Laziness (load-bearing):** `displayPhase`'s loading term is a thunk,
  evaluated only after the terminal flags are ruled out, so a banner state
  doesn't subscribe to the view's churning `visibleRegions`/`loadedRegions`.
- **Early `return` vs ternary (style):** once a correctness constraint, because
  react-compiler could memoize a MobX read on `model`'s stable identity. Not one
  since `DisplayChromeInner` took `'use no memo'` —
  [COMPILER_TERNARY_FINDING.md](COMPILER_TERNARY_FINDING.md).

Full "why" for the tree-shape rule: ARCHITECTURE.md §"Terminal states early-return
their own root". Don't duplicate it here.
