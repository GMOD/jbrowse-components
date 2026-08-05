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
- **Two components, split at the backend.** `DisplayChromeBase` owns only the
  hook and the `renderError` phase — the one phase whose banner needs the hook's
  `retry()`. Everything below it (container, `-done` testid,
  `data-display-phase`, the other four overlays) is `DisplayStatusChromeBase`,
  which a display with no rendering backend renders directly. That is how arc
  gets the chrome instead of a copy of it.
- The **loading term** is per-family, but customize it through the
  `loadingSuppressed` hook, never by overriding `displayPhase` — an override
  restates every term and then silently misses the next one added. Same rule the
  precedence has, one level down.
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
- 15 LGV displays use it, plus arc/paired-arc on the backend-free half. Off it by
  design: dotplot and synteny (non-LGV, drop to `useRenderingBackend`),
  circular-view (radial, own banners).
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

It is two files, split exactly where the backend stops mattering.
`DisplayChromeBase` holds the hook and the `renderError` branch;
`DisplayStatusChromeBase` holds the rest and takes `phase`/`drawn` as **props**,
so it reads no observable and needs no `observer`. The split exists because arc
needs everything except the hook — see the SVG exception below. Two phase types
carry the distinction into the type system: `DisplayPhase` for a display with a
backend, `DisplayStatusPhase` (the same union minus `renderError`) for one
without, so the status chrome can't be handed a state whose banner it has no
`retry()` to build, and a backend-less model can't claim that state.

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
component import). They get the chrome for free — but note they borrow at three
different levels, so they inherit three different testid shapes: GC content
registers wiggle's *inner* `WiggleComponent` (chrome only, so
`wiggle-display-done` and **no** `display-${id}` element — `browser-tests/suites/bigwig.ts`
waits on the former for exactly this reason), LinearVariant registers the *outer*
container component, and LGVSynteny alignments' whole component.

**SVG exception (2): arc / paired-arc.** These render main-thread SVG (no worker,
no GPU backend, all features in one array), so they can't wrap `DisplayChrome`,
which owns the backend hook. They render `DisplayStatusChrome` — the *same
component* the GPU chrome delegates to, not a parallel implementation — and
supply the two facts it can't derive for a display whose canvas it doesn't own:
`phase` (off `ArcFetchModel.displayPhase`, computed by `computeDisplayStatusPhase`)
and `drawn` (arc's `canvasDrawn` analogue). Container, `-done` testid,
`data-display-phase`, banners and progress chip all come from the shared file.
The phase lives on the model, not in the component, for the same reason it does
for a GPU display: the component then can't disagree with it. See
`plugins/arc/CLAUDE.md`.

**This was a hand-written copy until 2026-08, and it had already drifted** — arc
rendered no `BackgroundProgress` chip at all, and its loading term read a bare
`isLoading` (see below). That is the argument against "shares the concept": a
concept shared by convention decays silently, since nothing renders both
versions side by side. A display's alignment with the chrome should cost it a
prop, not a copy.

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
- **A phase that unmounts the affordance.** The loading overlay carries Retry
  after a user cancel, so a loading term written as bare `isLoading` destroys it:
  `cancelFetchByUser` drops the stop token synchronously, the phase falls to
  `ready`, and the display sits stopped and empty with nothing to click —
  nothing restarts it, the canceled state being deliberately durable. Read
  **`isLoadingOrCanceled`** (FetchMixin), which exists so no family has to
  remember the second term. Arc had this hole; pinned by
  `plugins/arc/src/shared/displayPhase.test.ts`.

The check when adding a display: raise each error it can produce, press retry,
and confirm the display can actually leave that state. Cancel is one of them.

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
`variant_canvas`, `variant_matrix_canvas`, `multirow_canvas`) as a query target:
tests wait on `${base}-done`, then read the static selector.

**`data-display-phase` is published for three of the five phases.** The two
subtree-replacing ones (`tooLarge`, `renderError`) render their banner *instead
of* the container that carries the attribute, so a `[data-display-phase]` census
(`browser-tests/suites/fetch-cancellation.ts`) counts such a display as absent,
not as terminal — correct for the "nothing is loading" waits built on it
(`waits.ts`), which is why it stays this way. Don't nest the banner to close the
gap; that would undo the unmount the whole tree-shape rule exists for.

### Three testid shapes coexist — and why they aren't unified

Two things vary per display: the `testid` base passed to DisplayChrome, and
whether a `DisplayContainer` sits above it. Five displays render inside that
second `position:relative` container, which emits `display-${id}-done` on its
own, and **all five now compose it explicitly** in the component they register:
the canvas family (canvas-basic, LinearVariant) in `LinearBasicDisplayComponent`,
and wiggle / multi-wiggle / manhattan in a container+body pair of their own
(`LinearWiggleDisplayComponent` and siblings).

Those three used to register the shared `BaseLinearDisplayComponent` and reach
their body through the model's `DisplayMessageComponent` getter, which made the
*model* hold a lazy import of a React component. Nothing in the GPU path reads
that getter any more; `BaseLinearDisplayComponent` survives as public plugin API
and as a stand-in `ReactComponent` in ~15 test harnesses that never render it.
The rewiring changed no DOM — `products/jbrowse-web/src/tests/BigWig.test.tsx`
and `Manhattan.test.tsx` pin both emitters in jsdom, which is the half of the
contract no local suite covered before.

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
| wiggle, manhattan, multi-wiggle | `<type>-display` + container | **both** `display-${id}-done` (container) and `<type>-display-done` (chrome) |
| gccontent (reuses wiggle's *body*) | `wiggle-display` | `wiggle-display-done` (chrome) — no container |
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

So removing the container (making DisplayChrome the sole emitter) changes which
element carries `display-${id}-done`, which is unverifiable without a full
build + GPU + headless-Chrome run. Any unification pass must land on a branch
where the browser-test, website-spec, and cypress suites are green, not blind.
Sequenced plan when that's available: (a) make DisplayChrome emit the generic
`display-${id}-done` for every display; (b) migrate the static-base tests to it
or keep both during a deprecation window; (c) delete the container from the GPU
path, moving LinearVariant's `FloatingLegend` into its own DisplayChrome child.
Until then, treat the redundancy as frozen.

**Step (c) is now fully prepared.** All five container-using displays compose
`DisplayContainer` explicitly in the component they register, so no getter
indirection stands in the way for any of them — what remains is moving
LinearVariant's legend and deleting one wrapper element per display. The jsdom
pins added with that prep (`BigWig.test.tsx`, `Manhattan.test.tsx`) assert both
emitters, so the first two steps are no longer entirely blind either: a local run
now catches a display that stops emitting the generic id, which is the failure
mode the freeze is guarding against.

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
CI re-checks it. The weight half is blocked on `makeStyles` importing `useTheme`
from `@mui/material/styles`
(`packages/core/src/util/tss-react/mui/mui.ts`) — see OTHER_IDEAS.md, "A
theme-free `makeStyles`", for what closing it would take.

**Counting `Mui*` classnames does not measure "no Material UI", and this is the
one thing to know before trusting a census.** `@jbrowse/core/util/tss-react`'s
`makeStyles` emits an *emotion* class (`css-5970li`) while reading the Material
UI theme, so a component can be fully MUI-styled and score zero.
`BaseTooltip` was exactly that: a grey Material chip in a font the host page
never loaded, on every page, with the guard reporting clean.

So the build-your-own smoke census
(`products/jbrowse-build-your-own/examples-site/scripts/smoke.mjs`) has two
halves, and needs both:

1. **`MUI_BUDGET`** — outermost elements carrying a `Mui*` classname.
2. **`muiThemedStyling`** — elements whose computed `font-family` starts with
   `Roboto` (MUI's default typography), excluding anything already inside a
   `Mui*` subtree, measured at rest **and** after a pointer sweep across each
   track.

The fingerprint is the font because it is the only thing that discriminates: the
JBrowse palette *deliberately* reproduces MUI's color values
(`packages/core/src/ui/palette.ts`), so `rgb(97, 97, 97)` proves nothing, while
that site's own stack starts with `-apple-system` and nothing on it loads Roboto.
Neither half is vacuous — reverting `BaseTooltip` to `makeStyles` fails 4 of 7
pages by name.

What still slips through: a themed `makeStyles` component that sets no
typography. The three in the display render path today (`BaseLinearDisplay`,
canvas's `FeatureComponent`, alignments') are all `makeStyles()({…})` with **no
theme argument** — layout only. A new one taking `theme =>` and touching only
colors would pass both halves. If that becomes real, the answer is to stop
importing MUI's `useTheme` in `makeStyles`, not a third census.

**Don't raise `MUI_BUDGET` or narrow the font census to make smoke pass**, and
don't hide the corner controls to reach zero — the track-sizing button carries
the count of features the layout dropped and the isoform notice is the only sign
transcripts are hidden, so a track that lies about its contents is worse than one
with a stray Material widget. They needed a plain rendering, which they have.

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
  ref. (`renderError` early-returns in `DisplayChromeBase`, `tooLarge` in
  `DisplayStatusChromeBase` — the split is about which one needs the hook's
  `retry()`, not about the tree shape, which is identical for both.)
- **The loading overlay is mounted unconditionally and gates on `visible`
  itself (load-bearing).** Its 250 ms anti-flash delay lives in component state
  (`useDelayedFlag` in `core/ui/LoadingOverlay`), so rewriting the chrome as
  `{phase === 'loading' ? <Loading/> : null}` — the obvious tidy-up — remounts it
  on every activation, resets the timer, and turns the delay into a no-op that
  flashes the scrim on every fast pan.
- **Laziness (load-bearing):** `displayPhase`'s loading term is a thunk,
  evaluated only after the terminal flags are ruled out, so a banner state
  doesn't subscribe to the view's churning `visibleRegions`/`loadedRegions`.
- **Early `return` vs ternary (style):** once a correctness constraint, because
  react-compiler could memoize a MobX read on `model`'s stable identity. Not one
  since `DisplayChromeInner` took `'use no memo'` —
  [COMPILER_TERNARY_FINDING.md](COMPILER_TERNARY_FINDING.md).

Full "why" for the tree-shape rule: ARCHITECTURE.md §"Terminal states early-return
their own root". Don't duplicate it here.
