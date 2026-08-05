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
- The **loading term** is single-sourced too, in `computeLoadingTerm`: both
  foundations evaluate the same expression and each constants out the one axis it
  doesn't have (per-region the staleness term, global the `loadingSuppressed`
  hook). Customize it through `loadingSuppressed` / `rendersCanvas`, never by
  overriding `displayPhase` — an override restates every term and then silently
  misses the next one added. Same rule the precedence has, one level down.
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
- **One element per display**, carrying `data-testid` (`<base>` → `<base>-done`),
  `data-display-id`, `data-display-phase` and `data-display-drawn`. `testid` is
  required, no display bypasses the chrome, and the two non-LGV views publish
  `data-display-drawn` too (via `RenderCanvas`), so one selector answers "has
  everything painted?" for the whole app. The three coexisting testid shapes, `DisplayContainer`,
  `BaseLinearDisplayComponent` and the model's `DisplayMessageComponent` getter
  are all gone.

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
component import). They get the chrome for free, and since the wrapper layer was
deleted they now borrow the *same* level in every case — the component the
display type registers. GC content and wiggle register the identical
`WiggleComponent`; LinearVariant and canvas-basic the identical
`FeatureComponent`; LGVSynteny alignments' whole component. Each pair therefore
shares a `data-testid` base and is told apart by `data-display-id`.

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
  `plugins/arc/src/shared/displayPhase.test.ts`. The per-region family had the
  *shape* of it until 2026-08 — its term was `!isReady` (over a bare `isLoading`)
  plus a separately-remembered `fetchCanceled`, i.e. the right answer reached the
  wrong way — which is why the cancel term now lives inside `computeLoadingTerm`
  rather than in either family's getter. Pinned on a real per-region display by
  `plugins/canvas/src/LinearBasicDisplay/displayPhaseWiring.test.ts`.

The check when adding a display: raise each error it can produce, press retry,
and confirm the display can actually leave that state. Cancel is one of them.

**The non-LGV views owe the same contract by hand, and were not paying it.**
They render their own banner, and `ErrorBanner`'s `onReset` is optional and
silently draws no button without it — so until 2026-08 a dotplot GPU error, a
dotplot fetch error and a synteny fetch error each rendered a banner whose only
remedy was reloading the tab. Both halves are wired now: `retry()` from
`useRenderingBackend` for the backend, and `reload()` on `SyntenyFetchStateMixin`
for the fetch. `reload()` had to be built, and the shape is the same trap the LGV
family hit — clearing the error is not enough, because after a failure every
fetch input is unchanged, so `prepare()` recomputes the same key and nothing
refires the autorun. It bumps a `reloadCounter` that
`installComparativeFetchAutorun` reads **unconditionally, before its gate**, so
one read serves both displays and a gated state can't swallow the retry. Pinned
by `installComparativeFetchAutorun.test.ts`; the refire assertion was confirmed
to fail with that read removed.

**No display bypasses the chrome any more.** `AlignmentsDisplayComponent` used
to early-return its own "Initializing" overlay while `!view.initialized`, and an
earlier revision of this file called that load-bearing. It wasn't, on either
count: nothing in that subtree throws before the view is measured
(`visibleLabels`, `highlightBoxes` and `sashimiArcSections` each open with
`view.initialized` and return `[]`; `PileupBezierOverlay` gates itself), and
`displayPhase` resolves to `loading` rather than throwing because
`viewportWithinLoadedData` is false while `!initialized`. The branch was also
unreachable — `LinearGenomeView` renders `ViewLoadingScreen` for the whole of
`showLoading`, which includes `!initialized`, so no display mounts before its
view is measured, and every host reaches an LGV through that component. Deleted
2026-08-05; alignments now publishes `data-display-phase` for every frame like
everything else.

What is worth carrying forward is the bug the audit found. `PileupBezierOverlay`
had a guard that didn't guard — `const { initialized, width } = view` evaluates
`width` *before* the `!initialized` check, so it threw on exactly the run it was
written for, latent only because the branch never ran. That is the shape to watch
for anywhere a throwing getter is destructured next to the flag that gates it.

**Not on DisplayChrome, by design (non-LGV views).** Two distinct reasons, not to
be conflated:

- **GPU, dropping to the `useRenderingBackend` primitive directly:**
  `dotplot-view` and `linear-comparative-view` (synteny). Both are non-LGV view
  types with no `ChromeModel` contract (`displayPhase` / `regionTooLarge` /
  `height`), so the chrome doesn't fit. This is the sanctioned
  drop-to-primitive path, not partial adoption. Don't force them onto
  DisplayChrome. What they owe in exchange: because their canvas stays mounted
  through an error rather than being replaced by a banner, they must key it at
  the mount site. (Every re-init needs an element that never held a context —
  a canvas's context kind is permanent — but `DisplayChromeBase` now keys its
  render-prop body on `canvasKey` for the displays *on* the chrome, so this is
  the only family that still carries the rule itself. See GPU_RENDERING.md
  "Context-loss recovery" for why the old "DisplayChrome gets it free" reasoning
  covered only one of the four re-init paths.) Both render
  **`RenderCanvas`** (`@jbrowse/render-core/RenderCanvas`), which owns that
  `key={canvasKey}` so it can't be forgotten; it was a hand-written key plus a
  copied comment in each until 2026-08, with "any new consumer must too" as the
  only thing enforcing it.

  **They owe the retry, too, and dotplot wasn't paying it.** The retry contract
  above is a `DisplayChrome` guarantee; a consumer rendering its own banner has
  to wire `useRenderingBackend`'s `retry()` to it by hand. `ErrorBanner`'s
  `onReset` is optional and silently renders no button without it, which is what
  dotplot did until 2026-08 — and dotplot is precisely where it matters, since
  the canvas is never unmounted to force a re-init and auto-recovery quits after
  two attempts on a context loss, so the display was stranded until a page
  reload. `retry()` bumps `canvasKey`, which `RenderCanvas` turns into the fresh
  element. Checked on both: synteny's `LevelSyntenyCanvas` passes it (for the
  GPU half of its combined banner), dotplot now does.
- **Main-thread SVG, own radial banners:** `circular-view` (ChordVariant) is not
  a GPU display at all, having no `useRenderingBackend`, `RenderLifecycleMixin`,
  or `canvasDrawn`. It renders SVG chords (`Chords`, in
  `plugins/circular-view/src/chords/`) with a plain ternary over
  `display.error` → `display.ready` → loading. **`ready`, not `features`**:
  `blocksForRefs` falls back to untranslated refNames while the refName map is
  in flight, so drawing as soon as the features land flashes a chordless circle
  whenever the adapter's names differ from the assembly's (`1` vs `chr1`). It
  keeps its own
  `Loading` (radial spinner) and `DisplayError` (chord-circle text) components,
  because the rectangular LGV banners (`BlockMsg`, "Force load", "Zoom in to see
  features") don't fit a radial view. Arc, by contrast, is an *LGV* SVG display,
  so it can reuse the LGV banners; circular's radial medium is why it can't.

## One element per display: testid, id, phase, drawn

Every LGV display emits **one** chrome element, and it carries four attributes:

| attribute | value | stable? |
| --- | --- | --- |
| `data-testid` | `<base>` → `<base>-done` on first paint | mutates |
| `data-display-id` | the display's `configuration.displayId` | stable |
| `data-display-phase` | `ready` / `loading` / `error` | tracks the model |
| `data-display-drawn` | `true` / `false` | tracks first paint |

The readiness gate is `canvasDrawn` (GPU) / `svgReady` (arc), expressed once.
`DisplayChrome` takes a **required** `testid` base and appends `-done`, so no
consumer hand-writes the ternary. Displays that pixel-match the canvas also give
the inner `<canvas>` a static selector (`hic_canvas`, `ld_canvas`,
`variant_canvas`, `variant_matrix_canvas`, `multirow_canvas`) as a query target:
tests wait on `${base}-done`, then read the static selector. The non-LGV views
keep their own standalone `synteny_canvas_done` / `dotplot_webgl_canvas_done`,
since they have no chrome at all — but they do publish `data-display-drawn`,
through `RenderCanvas`, which is what lets "has everything painted?" be one
selector across every view. It is a **required** prop there for the reason the
old arrangement failed: `PENDING_DISPLAYS` named `synteny_canvas` explicitly and
simply forgot dotplot, so an unpainted dotplot counted as finished and a capture
could land on it blank. A list that enumerates views forgets one; a required prop
cannot.

**Why two id attributes and not one.** `data-testid` is the *base* — shared by
every instance of a display type, and it mutates on first paint. Neither
property suits "which track is this", so targeting one track's display had its
own attribute-shaped hole, previously filled by a second wrapper element
emitting `display-${displayId}` as *its* testid. `data-display-id` fills it on
the same element. Likewise `data-display-drawn` exists so paint state can be
read without decoding a suffix: "has everything painted?" is
`[data-display-drawn="false"]` — one selector.

**This replaced three coexisting testid shapes, and the cost was never just the
extra `<div>`.** Two things used to vary per display: the `testid` base passed to
DisplayChrome, and whether a `DisplayContainer` sat above it emitting
`display-${id}-done` on its own. The knock-on effects were all in the test
infrastructure, which had to accept every shape:

- `PENDING_DISPLAYS` (`browser-test-utils/waits.ts`) was a three-way union —
  `display-…` not ending in `-done`, plus anything ending in `-display`, plus
  synteny — because paint state was encoded by a mutating id whose base could
  take either shape. It is now two selectors, one of which is only synteny.
- `displayReady()` (`website/scripts/screenshot-spec-helpers.ts`) had to emit
  **two** selectors joined by a comma, because alignments put its `-done` testid
  on an inner div while `data-display-phase` stayed on the chrome, so the two
  could only be related with `:has()`. Each form matched nothing in the other's
  case and the symptom was a capture that timed out rather than an authoring
  error. It is now one selector.

**What was deleted with it.** `DisplayContainer` and `BaseLinearDisplayComponent`
are gone, and with them `BaseDisplayModel`'s `DisplayMessageComponent` getter —
`BaseLinearDisplay.tsx` was its last reader, so the model no longer has any view
of its own UI. Four registered components (`LinearBasicDisplayComponent`,
`LinearWiggleDisplayComponent`, `MultiLinearWiggleDisplayComponent`,
`ManhattanReactComponent`) existed *only* to wrap a body in that container; each
became a pass-through and was deleted, with the display type now registering the
body directly. Wiggle and GC-content consequently register the identical
component, which is what the container arrangement was working around.

Two follow-through details worth knowing, because neither is visible in a diff:

- The container contributed `whiteSpace: nowrap` / `textAlign: left` by
  inheritance to everything under it. Those are re-stated on the chrome of each
  display the container no longer wraps, deliberately verbatim, so no label
  overlay changes how it wraps. They were **not** pushed onto `DisplayChrome` for everyone: seven
  displays never had them, and `white-space: nowrap` on a display root would
  stop long error-banner text from wrapping.
- The canvas family's `FloatingLegend` moved inside `DisplayChrome`'s child.
  The chrome is `position: relative` exactly as the container was, so its
  geometry is unchanged.

**`data-display-phase` is published for three of the five phases.** The two
subtree-replacing ones (`tooLarge`, `renderError`) render their banner *instead
of* the container that carries the attribute, so a `[data-display-phase]` census
(`browser-tests/suites/fetch-cancellation.ts`) counts such a display as absent,
not as terminal — correct for the "nothing is loading" waits built on it
(`waits.ts`), which is why it stays this way. Don't nest the banner to close the
gap; that would undo the unmount the whole tree-shape rule exists for.

### Why the canvas family shares one registered component

`LinearVariantDisplay` borrows the canvas body via
`pluginManager.getDisplayType('LinearBasicDisplay').ReactComponent` (the
LGVSyntenyDisplay move) rather than importing a component across the plugin
boundary. Chrome only one of them has arrives through overridable hooks on the
canvas base model — `colorLegend` (variants' color key) and `geneGlyphNotice`
(the isoform-collapse chip) — each defaulting to absent, so the shared component
never reads a field the display it's rendering doesn't have. Because the state
lives on the model rather than in a per-display component, the SVG export reads
the same `colorLegend` and bakes the key in (`renderSvg.tsx`, via the shared
`SvgColorLegend`).

That sharing is also why the two emit the same `data-testid` base
(`feature-display`): they are one component. `data-display-id` is what tells two
instances — or two display types sharing a body — apart.

### How the unification was verified

The freeze on this was real: the `-done` selectors are a contract across four
test systems, only one of which (jest/jsdom) runs outside CI. What made it
tractable was checking *which* system depends on *which* shape, rather than
assuming all of them depend on all of it:

- **website screenshot specs and cypress only ever used the static bases**
  (`pileup-display-done`, `wiggle-display-done`, …), never the generic
  `display-${id}`. Keeping `data-testid` exactly as it was means ~50 spec
  selectors, the cypress spec and the plugin-vite smoke test needed **no edit at
  all**. The one spec-side change was `displayReady()` getting simpler.
- **only puppeteer's browser-tests used the generic id** — seven selectors, all
  migrated to `data-display-id`, which is a better hook anyway (it doesn't
  mutate, and `[data-display-id]` beats `[data-testid^="display-"]` for "any
  display").
- **jest/jsdom** pins the co-location directly now: `BigWig.test.tsx` and
  `Manhattan.test.tsx` assert that the testid, `data-display-id` and
  `data-display-drawn` are on **one** element. That is the assertion that would
  have caught this refactor going wrong, and it runs locally.

The browser suite was run locally against a real build before and after
(`pnpm test:browser --swiftshader --filter=…`), which is what the old plan
called for and could not previously assume.

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
stays in the bundle. What the *host* pays either way — and the three pins that
were making it pay much more than the chrome — is
[EAGER_BUNDLE.md](EAGER_BUNDLE.md). *Weight* is only available to code writing its own display
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
