---
name: displaychrome
description: The shared display status chrome that owns loading, error, and retry UI, plus its adoption map. Read when touching loading/error/retry UI on a display.
kind: spec
---

# DisplayChrome — the shared display status chrome

The wrapper every GPU/Canvas2D-backed LGV display renders
(`packages/display-kit/src/DisplayChrome.tsx`). It owns `useRenderingBackend` and
all terminal-state UI, so a display cannot paint a canvas while skipping a
terminal state. It branches on one getter, `model.displayPhase`, whose precedence
(`renderError > tooLarge > error > canceled > loading > ready`) lives only in
`computeDisplayPhase` (`packages/render-core/src/displayPhase.ts`). Never
re-encode it as `&& !error && !regionTooLarge`.

Related: [REGION_TOO_LARGE.md](REGION_TOO_LARGE.md) (banner content),
[SHARED_CANVAS_VIEWS.md](SHARED_CANVAS_VIEWS.md) (the two comparative views off
this chrome),
[ADR-026](../architecture-decision-records/adr-026-displaychrome-layering-stays.md)
(rejected refactors),
[ADR-025](../architecture-decision-records/adr-025-gpu-canvas-stays-mounted-not-xor-error.md)
(mount/dispose contract).

## Shape

`DisplayChrome` calls `useRenderingBackend(factory, model)`, branches on
`displayPhase`, binds the pointer handlers, and hands
`{ canvasRef, canvas, mouseTracker }` to the body through a render-prop child:

```tsx
<DisplayChrome model={model} factory={Renderer} testid="x-display" ...divProps>
  {({ canvasRef, canvas }) => <XBody model={model} canvasRef={canvasRef} .../>}
</DisplayChrome>
```

The split is where the backend stops mattering. `DisplayChromeBase` holds the
hook and the `renderError` branch. `DisplayStatusChromeBase` holds the rest and
takes `phase`/`drawn` as props, so it reads no observable. `DisplayPhase` types a
display with a backend; `DisplayStatusPhase` (minus `renderError`) types one
without, so the status chrome cannot be handed a state it has no `retry()` for.

`RenderLifecycleMixin` (`packages/render-core`) holds the lifecycle state
(`canvasDrawn`, `renderError`, `currentRenderingBackend`, `renderTick`). Plugins
never re-declare it.

- **Replace vs overlay.** `renderError` and `tooLarge` replace the subtree
  (canvas unmounts, `backend.dispose()`); `error`, `canceled` and `loading` are
  overlays over a live canvas.
- **Only `loading` means work is outstanding.** Every other phase counts as
  finished for `AppReadyMarker`, `jb.waitReady` and the capture waits.
  `canceled` is its own phase because a `loading` that kept the overlay mounted
  held every readiness reader until Retry. The overlay publishes
  `loading-overlay-canceled` in that state.
- **The three overlay states portal as a group**, in `DisplayStatusChromeBase`,
  into the TrackContainer's overlay layer; otherwise the inter-region masks stripe
  them and no z-index inside the `contain: strict` sandbox wins
  ([ADR-058](../architecture-decision-records/adr-058-track-paint-containment-stays.md)).
  That layer is `pointer-events: none`, so an interactive overlay sets `auto` on
  its own box (contract in `chromeOverlays.ts`).
- **The activity phase is single-sourced** in `computeActivityPhase`, mapped by
  `foundationDisplayPhase` (backend-less: `foundationDisplayStatusPhase`). A
  foundation supplies one argument, its staleness predicate. Customize through the
  hooks `fetchInert`, `rendersCanvas` and `awaitingDependentData`, never by
  overriding `displayPhase`: an override restates every term and misses the next
  one added. `displayPhaseNotOverridden.test.ts` fails a plugin getter that wraps
  the LGV mapping. A new term adds a hook beside those three.
- **The bottom-right corner has one owner, the chrome.** It anchors one flex
  column and publishes it as `BottomRightCornerContext`; the `ProgressChip` is
  the first member and the display's `BottomRightIndicators` row portals in as
  the second. `BackgroundProgress` is the one overlay state that does not own its
  box (`packages/display-ui/src/bottomRightCorner.ts`).
- **Status while `ready`** (work with no fetch behind it, e.g. declarative
  clustering) renders as the corner chip, not the scrim. Report it through the
  display's `setStatusMessage`; add no phase.

### The render prop is the chrome's render

An observable read written inline in the render-prop child is tracked by
`DisplayChromeBase`, not the display's component, because `children({…})` runs
while the chrome builds its tree. A read there re-renders the whole chrome
(`useRenderingBackend` re-run, status container rebuilt, overlay portal
re-created). Reads in the outer component are as bad, since they rebuild the
`DisplayChrome` element on every change (wiggle's `visibleRegions` and the variant
matrix's `offsetPx` re-rendered the chrome every pan frame). Put only components
in the render prop. Check: it holds nothing but JSX elements and the destructured
handle.

## The pointer position is published, never held

The chrome binds `onMouseMove`/`onMouseLeave` and exposes `mouseTracker`.
Holding the position at chrome level would re-render the whole chrome per pixel
of cursor movement.

- **Read it in the body** with `useMouseState(mouseTracker)`, in the smallest
  component that draws the cursor-following thing (display-ui's `PointerLayer`).
  Pass the tracker down, never the position. No display keeps a pointer position
  in React state; only a drag's anchors may (maf's rubberband corners).
- **A display that hit-tests as the cursor moves passes `onPointerPosition`.**
  The name avoids `onPointerMove`, which collides with React's DOM handler on the
  spread div props and silently widens the callback's type.
- **Caller `onMouseMove`/`onMouseLeave` are composed, not replaced.**
- **Measurement is off `event.currentTarget`** (the chrome container), so no ref
  can drift from the handler's element.
- **The position travels as `MouseState`**, not a `[0, 0]` tuple, because the
  sentinel reads as "pointer at the origin". A tooltip renders nothing without
  one. `BaseTooltip` owns the gap to the cursor
  ([ADR-028](../architecture-decision-records/adr-028-tooltip-clientpoint-vs-pointer-tracking.md#amendment-2026-08-06-clientpoint-is-the-pointer-not-the-pointer-plus-a-gap)).
- **The loading scrim is pointer-transparent; the two families answer hover
  differently on purpose.** A per-region display keeps hit-testing its loaded
  blocks during a fetch. A global display replaces its whole frame, so it answers
  no hit while `isLoadingOrCanceled`. A new global display owes that term.
- **A terminal phase unmounts the container, which fires no `mouseleave`.** The
  chrome drops the measurement itself on `tooLarge`/`renderError`; otherwise the
  body's first render after Force load or Retry draws a crosshair at the stale
  position. An overlay phase keeps the position. Pinned in `DisplayChrome.test.tsx`.
- **A portaled overlay bubbles React events to the container** from outside its
  box. `useMouseTracking` treats that as a leave.

### Coalescing

`onPointerPosition` is one call per frame. A display binding its own handlers
(pileup, canvas feature display) routes hover through `useCoalescedPointer`.

- Coalescing is safe only because no gesture decides from hover; click and
  right-click re-hit-test from their own event.
- `cancel` on `mouseleave`, before the clear, so a queued frame cannot re-light
  what the leave cleared. `cancel` on unmount is the hook's.
- Guard the write too: an observable array is a fresh identity per write, so the
  setter compares (`sameStrings`).

`eventPoint(event)` gives the point in the bound element's space; read it during
the handler, since React clears `currentTarget` on return. `getRelativeX` takes an
element argument for rubberband drags that cross the document. A borderless leaf
canvas may use native `offsetX`/`offsetY`; that stops holding once anything draws
inside the element.

### Right-click

A contextmenu handler resolves a target first and calls `preventDefault` only if
one came back, so gutters and overlays fall through to the browser menu.
`openContextMenuFromEvent` (beside `DisplayContextMenu`) does the shared part;
each display resolves its own anchor. Canvas base and pileup keep their own
handlers (borderless canvas, queued hover frame).

What stays highlighted while the menu is up is a per-display answer. A mixin over
it is blocked by
[ADR-041](../architecture-decision-records/adr-041-no-mixin-composed-into-basedisplay.md);
each display states its answer beside its state.

## Adoption map

<!-- BEGIN GENERATED DISPLAY_CHROME_ADOPTION -->

_Generated by `pnpm autogen` — edit the source, not this block._

14 display types are registered for `LinearGenomeView`: 14 on `DisplayChrome`. On export, all 14 reach `SvgChrome`.

| Display type | Chrome | Component | SVG chrome | renderSvg |
| --- | --- | --- | --- | --- |
| LDTrackDisplay | `DisplayChrome` | `plugins/variants/src/LDDisplay/components/LDDisplayComponent.tsx` | `SvgChrome` | `plugins/variants/src/LDDisplay/renderSvg.tsx` |
| LGVSyntenyDisplay | `DisplayChrome` | borrows LinearAlignmentsDisplay | `SvgChrome` | inherits `plugins/alignments/src/LinearAlignmentsDisplay/renderSvg.tsx` |
| LinearAlignmentsDisplay | `DisplayChrome` | `plugins/alignments/src/LinearAlignmentsDisplay/components/AlignmentsDisplayComponent.tsx` | `SvgChrome` | `plugins/alignments/src/LinearAlignmentsDisplay/renderSvg.tsx` |
| LinearBasicDisplay | `DisplayChrome` | `plugins/canvas/src/LinearBasicDisplay/components/FeatureComponent.tsx` | `SvgChrome` | `plugins/canvas/src/LinearBasicDisplay/renderSvg.tsx` |
| LinearHicDisplay | `DisplayChrome` | `plugins/hic/src/LinearHicDisplay/components/ReactComponent.tsx` | `SvgChrome` | `plugins/hic/src/LinearHicDisplay/renderSvg.tsx` |
| LinearMafDisplay | `DisplayChrome` | `plugins/maf/src/LinearMafDisplay/components/LinearMafDisplayComponent.tsx` | `SvgChrome` | `plugins/maf/src/LinearMafDisplay/renderSvg.tsx` |
| LinearManhattanDisplay | `DisplayChrome` | borrows `LinearMarkDisplayReactComponent` | `SvgChrome` | inherits `plugins/marks/src/LinearMarkDisplay/renderSvg.tsx` |
| LinearMarkDisplay | `DisplayChrome` | `plugins/marks/src/LinearMarkDisplay/components/LinearMarkDisplayComponent.tsx` | `SvgChrome` | `plugins/marks/src/LinearMarkDisplay/renderSvg.tsx` |
| LinearMultiRowFeatureDisplay | `DisplayChrome` | `plugins/canvas/src/LinearMultiRowFeatureDisplay/components/LinearMultiRowFeatureDisplayComponent.tsx` | `SvgChrome` | `plugins/canvas/src/LinearMultiRowFeatureDisplay/renderSvg.tsx` |
| LinearMultiSampleVariantDisplay | `DisplayChrome` | `plugins/variants/src/LinearMultiSampleVariantDisplay/components/VariantDisplayComponent.tsx` | `SvgChrome` | `plugins/variants/src/LinearMultiSampleVariantDisplay/renderSvg.tsx` |
| LinearReferenceSequenceDisplay | `DisplayChrome` | `plugins/sequence/src/LinearReferenceSequenceDisplay/components/SequenceDisplayComponent.tsx` | `SvgChrome` | `plugins/sequence/src/LinearReferenceSequenceDisplay/renderSvg.tsx` |
| LinearVariantDisplay | `DisplayChrome` | borrows LinearBasicDisplay | `SvgChrome` | inherits `plugins/canvas/src/LinearBasicDisplay/renderSvg.tsx` |
| LinearWiggleDisplay | `DisplayChrome` | `plugins/wiggle/src/LinearWiggleDisplay/components/WiggleComponent.tsx` | `SvgChrome` | `plugins/wiggle/src/LinearWiggleDisplay/renderSvg.tsx` |
| MultiWaySyntenyDisplay | `DisplayChrome` | `plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/components/ReactComponent.tsx` | `SvgChrome` | `plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/renderSvg.tsx` |
<!-- END GENERATED DISPLAY_CHROME_ADOPTION -->

`website/scripts/generate-display-chrome-adoption.ts` builds the table from the
`new DisplayType({...})` registrations and fails on one it cannot resolve. It
lists LGV display types only; non-LGV views are below.

- **A borrowed row** registers another display's component. Two borrow off the
  DisplayType registry (`LGVSyntenyDisplay`, `LinearVariantDisplay`); GC content
  imports the wiggle component. Two rows naming one component share a
  `data-testid` base and differ by `data-display-id`.
- **The last two columns** resolve from the `stateModel`: the `renderSvg` action,
  its module, and whether that reaches `SvgChrome`. A `—` there is a regression.
  An `inherits` row composes another display's model.
- **The export chrome is narrower on purpose**: one terminal (`regionTooLarge`).
  A failed fetch makes `throwOnExportErrors` fail rather than draw
  (`packages/core/src/svg/SvgExport.tsx`).
- **Export tolerates absence.** `renderSvg` is optional (`SvgExportTrack`); a
  display without one is dropped and the user is told.
- **A display with no backend** renders `DisplayStatusChrome` (the same component
  the GPU chrome delegates to), supplying `phase` and `drawn` from its model, with
  `foundationDisplayStatusPhase`. No display ships on it now; ADR-163 deleted the
  arc plugin, its last user.

## The retry contract

`DisplayErrorBar`'s only action is `model.reload()`, so every state that can raise
the error bar must be one `reload()` undoes. `FetchMixin.reload` does the three
writes every retry owes (clear the error, clear the durable cancel, bump
`reloadCounter`); each foundation chains it and adds its own invalidation.
Three shapes have failed it:

- **A gate `reload()` does not clear.** A fetch that declines while data is
  current needs the loaded signature dropped too (`GlobalFetchMixin.reload()`).
  Gates on committed state are declared as `installFetch`'s `fetchKey`. The check
  below cannot see a secondary fetch, which passes no `contract` (one ledger per
  node); multi-way synteny's dependent fetches shipped a dead Retry there.
- **Work `reload()` never re-runs.** HiC's header read was a bare `afterAttach`
  IIFE; it runs from an autorun tracking `reloadCounter` now
  (`LinearHicDisplay/infoFetchFailure.test.ts`).
- **A phase that unmounts the affordance.** `cancelFetchByUser` aborts
  synchronously, so a phase reading bare `isLoading` falls to `ready` and the
  overlay carrying Retry unmounts. `computeActivityPhase` reads `fetchCanceled`
  and answers `canceled`. The comparative family draws its overlay off
  `ComparativeFetchMixin.loading` (`!fetchLanded`).

When adding a display, raise each error it can produce, press retry, and confirm
it leaves that state. Cancel counts.

**`makeRetryContractCheck`** (`assertDisplayContract.ts`) catches the first shape.
It runs inside every fetch installer (`installGlobalFetchAutorun`,
`installComparativeFetchAutorun`, `MultiRegionDisplayMixin`, `installFetch`): a
run after a `reloadCounter` bump that declines to fetch reports through
`console.error`. It is dev-only and reads `untracked`. A display deliberately not
fetching exempts itself with `fetchInert`.

- **The bump arms the check, so a `reload()` override that neither bumps nor
  chains disables it silently.** `LinearBasicDisplay` shipped that way.
  `reloadReachesCounter.test.ts` requires every `reload()` in `plugins/` and
  `packages/` to bump, chain, or be an empty placeholder.
- **`awaitingPrerequisite`** (on `FetchMixin`) marks a two-stage `reload()`: the
  decline leaves the bump outstanding, so the run after the prerequisite lands is
  the one judged. HiC's predicate equals its gate, so its retry is pinned by its
  own test instead. Variants' predicate (`!sourcesBase`) is genuinely narrower.
  A display whose predicate restates the gate has opted out and must name the
  covering test.
- **Classification differs per family.** The global family reads what `prepare()`
  returned; the comparative family treats `prepare()` returning `undefined` as the
  decline. The per-region family watches `FetchMixin.runFetch`, where every fetch
  starts, because its gate is block coverage. A `fetchNeeded` that awaits before
  fetching gets a false report, not silence. A fourth outcome, `deferred`,
  covers the in-flight skip.
- **`runFetch` tells the ledger**, not just the autorun: canvas `reload()` calls
  `fetchNeeded` itself without waiting out the 600ms debounce.
- **The comparative gate cannot say which decline it meant.** `prepare()` returns
  `undefined` for both "nothing to fetch" and "not ready" (dotplot's
  `!view.initialized`). The latter must not become `fetchInert`. Nothing triggers
  it today because Retry lives only on an error banner.
- **Shared names.** `FetchMixin.awaitingPrerequisite`,
  `FetchMixin.settingsFetchInputs` (ADR-132) and
  `RegionTooLargeMixin.gateSkipsMeasuredViewport` each replaced two spellings of
  one value, so a guard has one copy.
- The ledger is tested apart in `retryContractLedger.test.ts`; which early return
  emits which outcome is tested against real autoruns in
  `installGlobalFetchAutorun.test.ts` and `LinearManhattanDisplay/retryContract.test.ts`.
  A test proving a deferral must bump once: after two bumps a deferral and an
  exemption look identical.

A report needs a listener. Never reinstate a blanket `console.error = jest.fn()`
in a test env; capture and assert as `assertDisplayContract.test.ts` does.
`createDisplayTestEnvironment` silences only `console.warn`.

**Non-LGV views owe the same contract by hand.** `ErrorBanner`'s `onReset` is
optional and draws no button without it. Wire `retry()` from
`useRenderingBackend` for the backend and `reload()` on `FetchMixin` for the
fetch. `installComparativeFetchAutorun` reads `reloadCounter` unconditionally,
before its gate, so a gated state cannot swallow the retry
(`installComparativeFetchAutorun.test.ts`).

**No display bypasses the chrome.** `LinearGenomeView` renders
`ViewLoadingScreen` for the whole of `showLoading`, so a display needs no
`!view.initialized` early return. Watch for destructuring a throwing getter
beside the flag that gates it (`const { initialized, width } = view` evaluates
`width` first).

## Not on DisplayChrome, by design (non-LGV views)

The generated table scans LGV registrations only.
[SHARED_CANVAS_VIEWS.md](SHARED_CANVAS_VIEWS.md) owns the two comparative views;
here is what they owe the chrome's contracts.

- **GPU, dropping to `useRenderingBackend` directly: `dotplot-view` and
  `linear-comparative-view` (synteny).** They have no `ChromeModel` contract
  (`displayPhase` / `regionTooLarge` / `height`), so the chrome does not fit; this
  is the sanctioned drop-to-primitive path. Their canvas stays mounted through an
  error, so both render **`RenderCanvas`** (`@jbrowse/render-core/RenderCanvas`),
  which owns `key={canvasKey}`: every re-init needs an element that never held a
  context, since a canvas's context kind is permanent (GPU_RENDERING.md
  "Context-loss recovery"). `retry()` bumps `canvasKey`; wire it to
  `ErrorBanner`'s `onReset`.
- **Main-thread SVG with radial banners: `circular-view`.** It has no
  `useRenderingBackend`, `RenderLifecycleMixin` or `canvasDrawn`. `Chords`
  switches on the model's own `displayPhase` (`computeDisplayStatusPhase`),
  carried as `data-display-phase`. It draws on `ready`, not `features`, because
  `sliceIndex` falls back to untranslated refNames while the refName map is in
  flight, flashing a chordless circle. Its banner carries a `Retry` tspan
  (`chord_retry`) calling `reload()`, which bumps the `reloadCounter` the autorun
  reads above every gate
  ([FETCH_SKELETON.md](FETCH_SKELETON.md#the-global-fetch-trigger-list-must-be-read-unconditionally)).

## One element per display: testid, id, phase, drawn

Every LGV display emits one chrome element with four orthogonal attributes:

| attribute | value | answers |
| --- | --- | --- |
| `data-testid` | the display type's base name, never mutated | which KIND of display |
| `data-display-id` | `configuration.displayId` | WHICH display |
| `data-display-drawn` | `true` / `false` | has it painted (FIRST paint) |
| `data-display-phase` | `ready` / `loading` / `error` / `canceled` | is it FINISHED (all but `loading`) |

[ADR-065](../architecture-decision-records/adr-065-display-readiness-selectors.md)
deleted the mutating `-done` suffix. "This display type, painted" is a
conjunction written once: `displayPainted(base)` from `@jbrowse/capture` for a
selector string, `findDisplayPainted` for jest and puppeteer waits, which also say
which half failed. `DisplayChrome` takes a required `testid`, published unchanged.
Displays that pixel-match their canvas also give the inner `<canvas>` a static
selector (`hic_canvas`, `ld_canvas`, …) as a query target.

- **`tooLarge` and `renderError` publish from `ReplacedDisplay`**, a
  `display: contents` div with only `data-display-id` and `data-display-phase`:
  no testid (no body on screen) and no `data-display-drawn` (so neither reads as
  pending). `@jbrowse/capture` warns on the first and fails on the second. Never
  nest the banner in the container; that undoes the unmount.
- **The readiness gate is `painted`, not `canvasDrawn`.** `painted`
  (`RenderLifecycleMixin`) is `canvasDrawn || !rendersCanvas || paintInert`. A
  display showing a static placeholder never calls `canvasRef`
  (`!rendersCanvas`); a paint that is never coming (fetch failed before first
  paint, standing cancel, empty viewport) is `paintInert`, filled by
  `foundationPaintInert`. With either missing, `PENDING_DISPLAYS`
  (`[data-display-drawn="false"]`) burns every capture wait's full timeout, and the
  wait swallows its own failure. A display with no `RenderLifecycleMixin` declares
  its own `painted` on the model.
- **Non-LGV views publish `data-display-drawn` through `RenderCanvas`**, a required
  prop there: a list enumerating views forgets one, a required prop cannot. They
  keep standalone `synteny_canvas` / `dotplot_webgl_canvas` ids.
- **Co-location is pinned in jest** by `BigWig.test.tsx` and `Manhattan.test.tsx`
  (`jbrowse-web` suites, remote CI only): testid, `data-display-id`,
  `data-display-drawn` and `data-display-phase` must land on one element. Nothing
  else that would notice runs without a GPU.
- **The canvas family shares one registered component.** `LinearVariantDisplay`
  borrows `LinearBasicDisplay`'s via
  `pluginManager.getDisplayType('LinearBasicDisplay').ReactComponent`. Chrome only
  one has arrives through overridable base-model hooks (`colorLegend`,
  `geneGlyphNotice`), default absent; SVG export reads the same `colorLegend`.
- **Changing a readiness selector: ask which test system depends on which shape.**
  Website specs and cypress use the static bases, puppeteer uses `display-${id}`,
  only jest asserts co-location. Checking first turned a change that looked like it
  touched every suite into one that left ~50 selectors alone.

## The bring-your-own seams

Everything lives in `@jbrowse/display-ui`, which declares no `@mui/*` dependency;
that edge is the guarantee. `@jbrowse/plugin-linear-genome-view` holds the
Material bindings and re-exports the package. Both seams default to `undefined`,
not a component set, so a display outside any provider (unit tests, SVG export,
`overlayUtils`) keeps JBrowse's own look.

| what | provider | plain set | rendered by |
| --- | --- | --- | --- |
| the `displayPhase` states | `DisplayChromeOverlayProvider` | `plainChromeOverlays` | `DisplayChromeBase` |
| the bottom-right ambient controls | `TrackControlProvider` | `plainTrackControl` | each display's own body |

- **An embedder mounts `DisplayUIProvider`**, the pair, both props defaulting to
  the plain sets. `overlays` is a partial set merged over the plain one, so it
  survives a sixth state. `DisplayUIProvider.test.tsx` pins mounting and not
  mounting.
- **Overlay sets are written against exported types** (`DisplayErrorBarModel`,
  `DisplayLoadingOverlayModel`, `DisplayBackgroundProgressModel`,
  `TooLargeMessageModel` from the LGV barrel); an `observer()` component gets no
  contextual props type.
- **`useTrackControlMenu` is the corner control's behaviour as prop getters**
  (dismissal, focus, top layer, anchoring), so a host's own control inherits
  behaviour without inheriting styling. Every ambient corner control describes
  itself as `TrackControlProps` with an icon name, never an element, and renders
  `TrackControl`.
- **The view's own states are not a seam.** `loading`, `error` and `ready`
  (`!showLoading && !error`) are plain getters. An embedder writing
  `view.ready ? tracks : null` turns a 404 on a sequence file into a silent empty
  box. Read `error` before `loading`. See build-your-own's "Loading and error
  states" page.
- **`session.snackbarMessages` is the quietest channel.** `showTrack` on an
  unresolvable id, `addSessionTrackConf` on an invalid config and a failed
  `init.loc` report there and throw nothing. Embedded products mount
  `ui/Snackbar`; a host drawing its own chrome is on its own.
- **Colors are not a seam.** A display reads `usePalette()`. `SessionPaletteProvider`
  (`@jbrowse/core/ui/PaletteContext`) writes the config `theme` slot, which feeds
  both the React palette and the theme shipped to the worker that bakes feature
  labels; `PaletteProvider` alone leaves baked labels in the old mode.
- **`TrackOverlaySlot` (LGV barrel) is the host's half of the overlay portal.**
  Floating chrome (`ChromeLegend`, `HicOverlayPanel`, maf row labels) escapes the
  `contain: strict` sandbox through `TrackOverlayPortal` into a node from
  `TrackOverlayContext`; with none supplied it renders inline and sits under
  whatever the host paints. `zIndex` is required with no default, since it answers
  "above what?". `TrackOverlaySlot.test.tsx` pins it.
- **Gestures are exported, not a seam:** `@jbrowse/core/util/usePanZoom`
  (`useWheelZoom`), `useWidthSetter` (`@jbrowse/core/util/hooks`) and
  `useResizeDrag` (pointer capture, one commit per frame, delta from the last
  commit so a clamped drag banks no debt, `data-gesture-owner` so a resize does
  not also pan). When every example page writes the same thing, export it.
- **A third seam for the tooltip was rejected.** `BaseTooltip` and
  `FloatingLegend` render behind neither provider; the fix was colors from
  `usePalette()` and plain elements, with no new context. Reach for the palette
  before a fourth context. Ask of any new component "does a stock display import
  it directly". `FloatingLegend` lives in display-ui; the LGV barrel re-exports it
  because removal from a plugin barrel fails quietly.

**Traps in measuring "no Material UI".**

- **A module-graph claim needs a module-graph check.** `DisplayUIProvider` once
  reached 45 `@mui/*` modules while every census passed: the `createContext` calls
  shared a module with the Material default they override, and a `@jbrowse/core/ui`
  barrel import pulled `FileSelector` and more. `packages/display-ui/src/muiFree.test.ts`
  walks the value-import graph across workspace packages.
- **Counting `Mui*` classnames misses themed emotion classes.** The
  build-your-own smoke census
  (`products/jbrowse-build-your-own/examples-site/scripts/smoke.mjs`) pairs
  `MUI_BUDGET` with `muiThemedStyling`, which fingerprints computed `font-family`
  starting `Roboto` (the JBrowse palette deliberately reproduces MUI's colors, so
  colors prove nothing). A themed `makeStyles` that sets no typography still slips
  through; the answer is dropping MUI's `useTheme` from `makeStyles`, not a third
  census.
- **Don't raise `MUI_BUDGET`, narrow the font census, or hide corner controls to
  pass.** The track-height button and isoform notice are the only signs of hidden
  content.
- **Reach vs weight.** The providers redirect what stock displays render but MUI
  stays bundled. Only code writing its own display (`DisplayChromeBase` plus its
  own track control) drops it. `pnpm measure-chrome-bundle` measures three entry
  points, gated by `scripts/chromeBundleSizes.json`; quote the third
  (`DisplayUIProvider`) from that file, never from prose. What still holds Material
  in the eager set: [EAGER_BUNDLE.md](EAGER_BUNDLE.md).

## Load-bearing gotchas

Guarded by `DisplayChrome.test.tsx`.

- **Tree shape.** A terminal state is the component's entire output, not a banner
  beside a mounted canvas.
- **The loading overlay mounts unconditionally and gates on `visible` itself.**
  Its 250ms anti-flash delay lives in component state (`useDelayedFlag`,
  `core/ui/LoadingOverlay`); `{phase === 'loading' ? <Loading/> : null}` remounts
  it each activation and flashes the scrim on every fast pan.
- **`immediate` must never feed the delay.** It is `!drawn`, which flips during a
  load (region 1 drawn, 2..n in flight); the delay keys on `isVisible` alone, or
  the scrim blinks out mid-load. Pin it through the chrome ("the loading scrim
  spans one continuous load"), since `rerender`ing `LoadingOverlay` directly
  remounts it and makes the assertion vacuous.
- **Laziness.** The activity term of `displayPhase` is a thunk, evaluated after
  the terminal flags, so a banner does not subscribe to churning
  `visibleRegions`/`loadedRegions`.

## Terminal states early-return their own root

`renderError` returns early in `DisplayChromeBase`, `tooLarge` in
`DisplayStatusChromeBase` (the split is which banner needs the hook's `retry()`).
The banner replaces the display subtree rather than sitting beside the canvas. The
caller's `className`/`ref`/mouse handlers are absent in those states.

- **Clean GPU dispose/re-init.** The unmount fires `canvasRef(null)`, effect
  cleanup, `backend.dispose()` and `stopRenderingBackend()`; force-load re-inits
  through the callback ref.
- **The chrome drops the pointer measurement itself** with `handleMouseLeave()` on
  the transition (see the pointer section).
- **React Compiler opt-out.** `DisplayChromeBaseInner` carries `'use no memo'`, so
  the compiler cannot memoize a MobX read on `model`'s stable identity. Early
  `return` versus ternary is style now; replacing the subtree is what matters
  ([COMPILER_TERNARY_FINDING.md](COMPILER_TERNARY_FINDING.md)).
