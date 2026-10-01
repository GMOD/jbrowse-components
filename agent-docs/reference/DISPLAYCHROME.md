---
name: displaychrome
description: How does the shared display chrome own loading, error and retry UI, and what must a new display or embedder honor? Read when touching status UI, readiness attributes or the retry path of a display.
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

Related: [REGION_TOO_LARGE.md](REGION_TOO_LARGE.md),
[SHARED_CANVAS_VIEWS.md](SHARED_CANVAS_VIEWS.md),
[ADR-026](../architecture-decision-records/adr-026-displaychrome-layering-stays.md)
(rejected refactors),
[ADR-025](../architecture-decision-records/adr-025-gpu-canvas-stays-mounted-not-xor-error.md)
(mount/dispose contract).

## Shape

`DisplayChromeBase` holds the `useRenderingBackend` hook and the `renderError`
branch; `DisplayStatusChromeBase` holds the rest and takes `phase`/`drawn` as
props, so it reads no observable. `DisplayStatusPhase` (minus `renderError`)
types a display without a backend, so the status chrome cannot be handed a state
it has no `retry()` for. `RenderLifecycleMixin` (`packages/render-core`) holds
the lifecycle state; plugins never re-declare it.

- **Replace vs overlay.** `renderError` and `tooLarge` replace the subtree
  (canvas unmounts, `backend.dispose()`); `error`, `canceled` and `loading` are
  overlays over a live canvas.
- **Only `loading` means work is outstanding.** Every other phase counts as
  finished for `AppReadyMarker`, `jb.waitReady` and the capture waits.
  `canceled` is its own phase because a `loading` that kept the overlay mounted
  held every readiness reader until Retry.
- **The three overlay states portal as a group** into the TrackContainer's
  overlay layer; otherwise the inter-region masks stripe them and no z-index
  inside the `contain: strict` sandbox wins
  ([ADR-058](../architecture-decision-records/adr-058-track-paint-containment-stays.md)).
  That layer is `pointer-events: none`, so an interactive overlay sets `auto` on
  its own box (`chromeOverlays.ts`).
- **The activity phase is single-sourced** in `computeActivityPhase`, mapped by
  `foundationDisplayPhase` (backend-less: `foundationDisplayStatusPhase`).
  Customize through the hooks `fetchInert`, `rendersCanvas` and
  `awaitingDependentData`, never by overriding `displayPhase`: an override
  restates every term and misses the next one added.
  `displayPhaseNotOverridden.test.ts` fails a plugin getter that wraps the LGV
  mapping.
- **The bottom-right corner has one owner, the chrome**
  (`BottomRightCornerContext`, `packages/display-ui/src/bottomRightCorner.ts`).
- **Status while `ready`** (work with no fetch behind it) renders as the corner
  chip through the display's `setStatusMessage`; add no phase.

### The render prop is the chrome's render

An observable read written inline in the render-prop child is tracked by
`DisplayChromeBase`, not the display's component, because `children({…})` runs
while the chrome builds its tree. A read there re-renders the whole chrome.
Reads in the outer component are as bad, since they rebuild the `DisplayChrome`
element on every change (wiggle's `visibleRegions` and the variant matrix's
`offsetPx` re-rendered the chrome every pan frame). Put only components in the
render prop: it holds nothing but JSX elements and the destructured handle.

## The pointer position is published, never held

Holding the position at chrome level would re-render the whole chrome per pixel
of cursor movement. The chrome exposes `mouseTracker`.

- **Read it in the body** with `useMouseState(mouseTracker)`, in the smallest
  component that draws the cursor-following thing (display-ui's `PointerLayer`).
  Pass the tracker down, never the position. Only a drag's anchors may live in
  React state (maf's rubberband corners).
- **A display that hit-tests as the cursor moves passes `onPointerPosition`.**
  The name avoids `onPointerMove`, which collides with React's DOM handler on the
  spread div props and silently widens the callback's type.
- **The position travels as `MouseState`**, not a `[0, 0]` tuple, because the
  sentinel reads as "pointer at the origin".
  `BaseTooltip` owns the gap to the cursor
  ([ADR-028](../architecture-decision-records/adr-028-tooltip-clientpoint-vs-pointer-tracking.md#amendment-2026-08-06-clientpoint-is-the-pointer-not-the-pointer-plus-a-gap)).
- **The two families answer hover during a load differently on purpose.** A
  per-region display keeps hit-testing its loaded blocks; a global display
  replaces its whole frame and answers no hit while `isLoadingOrCanceled`. A new
  global display owes that term.
- **A terminal phase unmounts the container, which fires no `mouseleave`.** The
  chrome drops the measurement itself on `tooLarge`/`renderError`; otherwise the
  first render after Force load or Retry draws a crosshair at the stale position
  (`DisplayChrome.test.tsx`).
- **A portaled overlay bubbles React events to the container** from outside its
  box; `useMouseTracking` treats that as a leave.
- **Coalescing:** a display binding its own handlers routes hover through
  `useCoalescedPointer`, safe only because no gesture decides from hover. `cancel`
  on `mouseleave` before the clear, so a queued frame cannot re-light what the
  leave cleared, and guard the write (`sameStrings`), since an observable array
  is a fresh identity per write.
- **`eventPoint(event)` must be read during the handler**, since React clears
  `currentTarget` on return. A borderless leaf canvas may use native
  `offsetX`/`offsetY`; that stops holding once anything draws inside the element.

### Right-click

A contextmenu handler resolves a target first and calls `preventDefault` only if
one came back, so gutters and overlays fall through to the browser menu.
`openContextMenuFromEvent` does the shared part; each display resolves its own
anchor and states what stays highlighted beside its state (a mixin is blocked by
[ADR-041](../architecture-decision-records/adr-041-no-mixin-composed-into-basedisplay.md)).

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
`new DisplayType({...})` registrations and lists LGV display types only.

- **A borrowed row** registers another display's component; two rows naming one
  component share a `data-testid` base and differ by `data-display-id`.
- **A `—` in the last two columns is a regression.** The export chrome is
  narrower on purpose (one terminal, `regionTooLarge`); a failed fetch makes
  `throwOnExportErrors` fail rather than draw (`packages/core/src/svg/SvgExport.tsx`).
  `renderSvg` is optional (`SvgExportTrack`): a display without one is dropped
  and the user is told.
- **A display with no backend** renders `DisplayStatusChrome` with
  `foundationDisplayStatusPhase`. No display ships on it now.

## The retry contract

`DisplayErrorBar`'s only action is `model.reload()`, so every state that can raise
the error bar must be one `reload()` undoes. `FetchMixin.reload` does the three
writes every retry owes (clear the error, clear the durable cancel, bump
`reloadCounter`); each foundation chains it and adds its own invalidation.
Three shapes have failed it:

- **A gate `reload()` does not clear.** A fetch that declines while data is
  current needs the loaded signature dropped too (`GlobalFetchMixin.reload()`).
  Gates on committed state are declared as `installFetch`'s `fetchKey`. A
  secondary fetch passes no `contract` (one ledger per node), so the check below
  cannot see it; multi-way synteny's dependent fetches shipped a dead Retry there.
- **Work `reload()` never re-runs.** HiC's header read now runs from an autorun
  tracking `reloadCounter` (`LinearHicDisplay/infoFetchFailure.test.ts`).
- **A phase that unmounts the affordance.** `cancelFetchByUser` aborts
  synchronously, so a phase reading bare `isLoading` falls to `ready` and the
  overlay carrying Retry unmounts; `computeActivityPhase` reads `fetchCanceled`.

When adding a display, raise each error it can produce, press retry, and confirm
it leaves that state. Cancel counts.

**`makeRetryContractCheck`** (`assertDisplayContract.ts`) catches the first shape.
It runs inside every fetch installer: a run after a `reloadCounter` bump that
declines to fetch reports through `console.error`. It is dev-only. A display
deliberately not fetching exempts itself with `fetchInert`.

- **The bump arms the check, so a `reload()` override that neither bumps nor
  chains disables it silently.** `reloadReachesCounter.test.ts` requires every
  `reload()` in `plugins/` and `packages/` to bump, chain, or be an empty
  placeholder.
- **`awaitingPrerequisite`** (on `FetchMixin`) marks a two-stage `reload()`: the
  decline leaves the bump outstanding, so the run after the prerequisite lands is
  the one judged. A display whose predicate restates the gate has opted out and
  must name the covering test.
- **Classification differs per family.** The global family reads what `prepare()`
  returned; the comparative family treats `undefined` as the decline; the
  per-region family watches `FetchMixin.runFetch`, because its gate is block
  coverage. A `fetchNeeded` that awaits before fetching gets a false report.
- **The comparative gate cannot say which decline it meant.** `prepare()` returns
  `undefined` for both "nothing to fetch" and "not ready" (dotplot's
  `!view.initialized`); the latter must not become `fetchInert`.
- **A test proving a deferral must bump once**: after two bumps a deferral and an
  exemption look identical.

A report needs a listener. Never reinstate a blanket `console.error = jest.fn()`
in a test env; `createDisplayTestEnvironment` silences only `console.warn`.

**Non-LGV views owe the same contract by hand.** `ErrorBanner`'s `onReset` is
optional and draws no button without it. Wire `retry()` from
`useRenderingBackend` for the backend and `reload()` on `FetchMixin` for the
fetch.

**No display bypasses the chrome.** `LinearGenomeView` renders `ViewLoadingScreen`
for the whole of `showLoading`, so a display needs no `!view.initialized` early
return. Watch for destructuring a throwing getter beside the flag that gates it
(`const { initialized, width } = view` evaluates `width` first).

## Not on DisplayChrome, by design (non-LGV views)

[SHARED_CANVAS_VIEWS.md](SHARED_CANVAS_VIEWS.md) owns the two comparative views;
here is what they owe the chrome's contracts.

- **`dotplot-view` and `linear-comparative-view` (synteny) drop to
  `useRenderingBackend` directly.** They have no `ChromeModel` contract
  (`displayPhase` / `regionTooLarge` / `height`). Their canvas stays mounted
  through an error, so both render **`RenderCanvas`**
  (`@jbrowse/render-core/RenderCanvas`), which owns `key={canvasKey}`: a canvas's
  context kind is permanent, so every re-init needs an element that never held a
  context (GPU_DISPLAY_LIFECYCLE.md "Context-loss recovery"). `retry()` bumps
  `canvasKey`; wire it to `ErrorBanner`'s `onReset`.
- **`circular-view` is main-thread SVG.** `Chords` switches on the model's own
  `displayPhase` (`computeDisplayStatusPhase`) and draws on `ready`, not
  `features`, because `sliceIndex` falls back to untranslated refNames while the
  refName map is in flight, flashing a chordless circle. Its `Retry` tspan calls
  `reload()`, which bumps the `reloadCounter` the autorun reads above every gate
  ([FETCH_KEYS.md](FETCH_KEYS.md#the-global-fetch-trigger-list-must-be-read-unconditionally)).

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
selector string, `findDisplayPainted` for jest and puppeteer waits.

- **`tooLarge` and `renderError` publish from `ReplacedDisplay`**, a
  `display: contents` div with only `data-display-id` and `data-display-phase`:
  no testid (no body on screen) and no `data-display-drawn` (so neither reads as
  pending). Never nest the banner in the container; that undoes the unmount.
- **The readiness gate is `painted`, not `canvasDrawn`.** `painted`
  (`RenderLifecycleMixin`) is `canvasDrawn || !rendersCanvas || paintInert`. With
  either escape missing, `PENDING_DISPLAYS` (`[data-display-drawn="false"]`)
  burns every capture wait's full timeout, and the wait swallows its own failure.
  A display with no `RenderLifecycleMixin` declares its own `painted`.
- **Non-LGV views publish `data-display-drawn` through `RenderCanvas`**, a required
  prop there: a list enumerating views forgets one, a required prop cannot.
- **Co-location is pinned in jest** by `BigWig.test.tsx` and `Manhattan.test.tsx`
  (`jbrowse-web` suites, remote CI only); nothing else runs without a GPU.
- **Changing a readiness selector: ask which test system depends on which shape.**
  Website specs and cypress use the static bases, puppeteer uses `display-${id}`,
  only jest asserts co-location.

## The bring-your-own seams

Everything lives in `@jbrowse/display-ui`, which declares no `@mui/*` dependency;
that edge is the guarantee. `@jbrowse/plugin-linear-genome-view` holds the
Material bindings and re-exports the package. Both seams default to `undefined`,
so a display outside any provider (unit tests, SVG export) keeps JBrowse's own
look.

| what | provider | plain set | rendered by |
| --- | --- | --- | --- |
| the `displayPhase` states | `DisplayChromeOverlayProvider` | `plainChromeOverlays` | `DisplayChromeBase` |
| the bottom-right ambient controls | `TrackControlProvider` | `plainTrackControl` | each display's own body |

- **An embedder mounts `DisplayUIProvider`**, the pair. `overlays` is a partial
  set merged over the plain one, so it survives a new state.
- **Overlay sets are written against exported types** (`DisplayErrorBarModel`,
  `DisplayLoadingOverlayModel`, ...); an `observer()` component gets no
  contextual props type.
- **The view's own states are not a seam.** `loading`, `error` and `ready` are
  plain getters. An embedder writing `view.ready ? tracks : null` turns a 404 on a
  sequence file into a silent empty box. Read `error` before `loading`.
- **`session.snackbarMessages` is the quietest channel.** `showTrack` on an
  unresolvable id, `addSessionTrackConf` on an invalid config and a failed
  `init.loc` report there and throw nothing.
- **Colors are not a seam.** A display reads `usePalette()`. `SessionPaletteProvider`
  (`@jbrowse/core/ui/PaletteContext`) feeds both the React palette and the theme
  shipped to the worker that bakes feature labels; `PaletteProvider` alone leaves
  baked labels in the old mode.
- **`TrackOverlaySlot` (LGV barrel) is the host's half of the overlay portal.**
  Without one, floating chrome (`ChromeLegend`, `HicOverlayPanel`) renders inline
  and sits under whatever the host paints. `zIndex` is required with no default.
- **A third seam for the tooltip was rejected.** `BaseTooltip` and `FloatingLegend`
  use `usePalette()` and plain elements. Reach for the palette before a fourth
  context; ask of any new component "does a stock display import it directly".

**Traps in measuring "no Material UI".**

- **A module-graph claim needs a module-graph check.** `DisplayUIProvider` once
  reached 45 `@mui/*` modules while every census passed;
  `packages/display-ui/src/muiFree.test.ts` walks the value-import graph.
- **Counting `Mui*` classnames misses themed emotion classes.** The
  build-your-own smoke census pairs `MUI_BUDGET` with `muiThemedStyling`
  (computed `font-family` starting `Roboto`).
- **Don't raise `MUI_BUDGET`, narrow the font census, or hide corner controls to
  pass.**
- **Reach vs weight.** The providers redirect what stock displays render but MUI
  stays bundled. `pnpm measure-chrome-bundle` gates three entry points in
  `scripts/chromeBundleSizes.json`; quote it, never prose
  ([EAGER_BUNDLE.md](EAGER_BUNDLE.md)).

## Load-bearing gotchas

Guarded by `DisplayChrome.test.tsx`.

- **The loading overlay mounts unconditionally and gates on `visible` itself.**
  Its 250ms anti-flash delay lives in component state (`useDelayedFlag`);
  `{phase === 'loading' ? <Loading/> : null}` remounts it each activation and
  flashes the scrim on every fast pan.
- **`immediate` must never feed the delay.** It is `!drawn`, which flips during a
  load; the delay keys on `isVisible` alone, or the scrim blinks out mid-load.
  Pin it through the chrome, since `rerender`ing `LoadingOverlay` directly
  remounts it and makes the assertion vacuous.
- **The activity term of `displayPhase` is a thunk**, evaluated after the terminal
  flags, so a banner does not subscribe to churning `visibleRegions`/`loadedRegions`.

## Terminal states early-return their own root

`renderError` returns early in `DisplayChromeBase`, `tooLarge` in
`DisplayStatusChromeBase` (the split is which banner needs the hook's `retry()`).
The caller's `className`/`ref`/mouse handlers are absent in those states. The
unmount fires `canvasRef(null)`, `backend.dispose()` and
`stopRenderingBackend()`; force-load re-inits through the callback ref.
`DisplayChromeBaseInner` carries `'use no memo'`, so the compiler cannot memoize
a MobX read on `model`'s stable identity
([COMPILER_TERNARY_FINDING.md](COMPILER_TERNARY_FINDING.md)).
