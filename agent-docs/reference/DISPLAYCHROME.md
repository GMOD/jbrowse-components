---
name: displaychrome
description: The shared display status chrome that owns loading, error, and retry UI, plus its adoption map. Read when touching loading/error/retry UI on a display.
---

# DisplayChrome — the shared display status chrome

The single wrapper every GPU/Canvas2D-backed LGV display renders. It owns
`useRenderingBackend` and all terminal-state UI, so a display cannot paint a
canvas while skipping a terminal state, and it branches on one getter —
`model.displayPhase`, whose precedence (`renderError > tooLarge > error >
loading > ready`) is single-sourced in `computeDisplayPhase`. Never re-encode
that as `&& !error && !regionTooLarge`.

Related: banner content for `tooLarge` is in
[REGION_TOO_LARGE.md](REGION_TOO_LARGE.md); the two comparative views that sit
off this chrome are [SHARED_CANVAS_VIEWS.md](SHARED_CANVAS_VIEWS.md); the
rejected refactors (don't re-litigate) are in
[ADR-026](../architecture-decision-records/adr-026-displaychrome-layering-stays.md);
the mount/dispose contract is in
[ADR-025](../architecture-decision-records/adr-025-gpu-canvas-stays-mounted-not-xor-error.md).

## What it is

`DisplayChrome`
(`packages/display-kit/src/DisplayChrome.tsx`)
does four things:

- calls `useRenderingBackend(factory, model)`, so the backend hook lives in
  exactly one place,
- branches on `model.displayPhase`, whose precedence is computed by
  `computeDisplayPhase` (`packages/render-core/src/displayPhase.ts`),
- binds the pointer handlers, since it owns the element a position is measured
  against,
- hands `{ canvasRef, canvas, mouseTracker }` to the body via a render-prop
  child.

It is two files, split exactly where the backend stops mattering.
`DisplayChromeBase` holds the hook and the `renderError` branch;
`DisplayStatusChromeBase` holds the rest and takes `phase`/`drawn` as **props**,
so it reads no observable and needs no `observer`. The split exists because arc
needs everything except the hook — see the on-screen exception below. Two phase
types carry the distinction into the type system: `DisplayPhase` for a display
with a backend, `DisplayStatusPhase` (the same union minus `renderError`) for one
without, so the status chrome can't be handed a state whose banner it has no
`retry()` to build, and a backend-less model can't claim that state.

The lifecycle state (`canvasDrawn`, `renderError`, `currentRenderingBackend`,
`renderTick`) lives on `RenderLifecycleMixin`
(`packages/render-core/src/RenderLifecycleMixin.ts`), which every GPU display
composes. Plugins never re-declare it.

The five phases split two ways. `renderError`/`tooLarge` **replace the subtree**
(canvas unmounts, `backend.dispose()`); `error`/`loading` are overlays over a
live canvas.

**The three overlay states portal as a group**, in `DisplayStatusChromeBase`,
into the TrackContainer's overlay layer — otherwise the LGV's inter-region masks
stripe the loading chip and the error banner at multi-region scale, and no
z-index inside the display's `contain: strict` sandbox can win against them
([ADR-058](../architecture-decision-records/adr-058-track-paint-containment-stays.md)).
One portal at that level rather than one per overlay, because it is the level
both the MUI set and `plainChromeOverlays` pass through. That layer is
`pointer-events: none`, so an interactive overlay sets `pointer-events: auto` on
its own box — part of the overlay-set contract in `chromeOverlays.ts`.

**The loading term is single-sourced in `computeLoadingTerm`, and so is the
mapping onto it**, in `foundationDisplayPhase` — the twin of `foundationSvgReady`.
Both foundations call it and supply exactly one argument, their staleness
predicate: per-region its spatial one, global `() => true`. Arc goes
through `foundationDisplayStatusPhase`, the same mapping returning the narrower
phase and supplying the two canvas terms it has no canvas for. Customize it
through the hooks — `fetchInert`, `rendersCanvas`, `awaitingDependentData` (a
load beyond the primary fetch has not first landed; multi-way synteny's lanes) —
**never by overriding `displayPhase`**: an override restates every term and
then silently misses the next one added. Same rule the precedence has, one
level down. `displayPhaseNotOverridden.test.ts` fails a plugin getter that
calls the LGV mapping and post-processes it, which is the shape multi-way
synteny shipped in before the third hook existed; a display with a new term
adds a hook beside those three.

**The bottom-right corner has one owner, and it is the chrome.** The background
`ProgressChip` and the display's own control row (`BottomRightIndicators`) both
want the corner and neither can see the other — one is rendered by the overlay
set, the other by the display several components down, and both used to pin
themselves to `bottom: 2; right: 2` of the same per-track overlay layer. The
chrome anchors a single flex column there and publishes it through
`BottomRightCornerContext`; the chip is its first member and the row portals in
as its second. So `BackgroundProgress` is the one overlay state that does **not**
own its box (see `packages/display-ui/src/bottomRightCorner.ts`, which sits with
the contract rather than with this chrome precisely because it is the half of
that contract the prop types cannot carry).

A status set while the phase is `ready` — work with no fetch behind it, e.g.
declarative clustering — renders as that corner chip rather than the scrim,
because the drawn content is still usable. Report such work through the
display's own `setStatusMessage` and it shows up; don't add a phase for it.

Every GPU display follows one shape:

```tsx
<DisplayChrome model={model} factory={Renderer} testid="x-display" ...divProps>
  {({ canvasRef, canvas }) => <XBody model={model} canvasRef={canvasRef} .../>}
</DisplayChrome>
```

The thin outer owns the chrome, plus any hook that needs a ref to its container
(maf's drag-select, the only one left). The named observer body owns the canvas
and overlays, so observable reads scope to the body rather than the chrome.

### The render prop is the chrome's render, not the body's

**An observable read written inline in the render-prop child is tracked by
`DisplayChromeBase`, not by the display's own component.** `children({…})` is
called while `DisplayChromeBaseInner` builds its element tree, so MobX attributes
everything it touches to that observer. Only reads inside a *component* the
child returns land where the shape above implies.

The render prop looks like it is already the body. It is one level too high, and
the cost is the whole chrome re-rendering — `useRenderingBackend` re-run, the
status container rebuilt with a fresh inline `style`, the overlay portal
re-created.

Two things follow, and each has cost something:

- **Reads in the outer component are just as bad**, because they rebuild the
  `DisplayChrome` element (a new `children` closure and usually a fresh `style`
  object, which is what `observer`'s memo compares). Wiggle read
  `view.visibleRegions` this way and the variant matrix read `view.offsetPx`;
  both rebuild every pan frame, so a drag re-rendered the chrome for its whole
  duration.
- **Put components in the render prop, nothing else.** Alignments had five
  inline reads there — never per-frame, so never hot, but the same shape. They
  are `AlignmentsCornerControls` and the shared `DisplayContextMenu` now.

The quick check when adding a display: if the render prop contains anything but
JSX elements and the destructured handle, the chrome is tracking it.

## The pointer position is published, never held

The chrome binds `onMouseMove`/`onMouseLeave` itself and puts `mouseTracker` in
the handle. Holding the position at chrome level instead costs a whole display's
chrome re-rendering because the cursor moved a pixel: `useRenderingBackend`
re-runs, the status container gets a fresh inline `style`, every overlay
re-renders, and only then the body that wanted the coordinate. Owning the
measurement makes the rule structural — there is no position at that level to
hold. It survived as a copied comment in eight of the nine displays that used to
call `useMouseTracking`, one of which had already dropped `onMouseLeave`.

- **Read it in the body**, with `useMouseState(mouseTracker)`, in the smallest
  component that draws the cursor-following thing. That is what display-ui's
  `PointerLayer` is for — it takes the tracker and renders its child from the
  position; passing the tracker down is free, passing the position down is the
  bug.
- **No display holds a pointer position in React state.** The two that did were
  canvas (a `clientXY` `useState`) and maf (`useDragSelection`'s `mouse`, which
  lived in the component rendering the chrome, so a hover re-ran
  `useRenderingBackend`). A drag is the one thing that legitimately needs pointer
  state, and only its anchors do: maf keeps the rubberband's two corners, written
  while a button is held, and takes the hover position off the tracker.
- **A display that hit-tests as the cursor moves passes `onPointerPosition`**,
  so its hit comes off the same single measurement as its guides. Named for the
  measured position, not `onPointerMove`, which collides with React's DOM
  handler on the spread div props and silently widens the callback's parameter
  type.
- **Caller `onMouseMove`/`onMouseLeave` are composed, not replaced.** Overriding
  a caller's handler would surface only as maf's drag quietly not dragging.
- **The measurement is off `event.currentTarget`**, which is the chrome
  container — so there is no ref to pass, no way to bind the handlers and the
  measured box to different elements, and a caller's own `ref` needs no merging.
  `wiggleMouseHandlers`' click path resolves its hit the same way, from the
  click rather than from a hover a previous frame recorded (the viewport moves
  under a stationary cursor).
- **The position travels as the `MouseState` itself**, not as `[number, number]`
  tuples with a `[0, 0]` sentinel for "no pointer" — that sentinel reads as
  "pointer at the origin", so every consumer needed a second guard to make it
  safe, and the two had to agree. A tooltip takes `mouseState` and renders
  nothing without one. `BaseTooltip` owns the gap to the cursor
  ([ADR-028](../architecture-decision-records/adr-028-tooltip-clientpoint-vs-pointer-tracking.md#amendment-2026-08-06-clientpoint-is-the-pointer-not-the-pointer-plus-a-gap));
  callers pass the true client point.
- **The loading scrim is pointer-transparent, so hovering under it is the
  display's call, and the two families answer it differently on purpose.** A
  per-region display keeps hit-testing its loaded blocks through a fetch, since
  the blocks under the cursor are not the ones being fetched. A global display
  replaces its whole frame, so every one of them answers no hit while
  `isLoadingOrCanceled` — a tooltip over cells the scrim says are being replaced,
  or that a standing cancel says are not there, describes nothing on screen.
  HiC and LD had the gate and arc and multi-way synteny did not, which is the
  drift this line exists to stop; a fifth global display owes the same term.
- **A terminal phase removes the container, and that is not a `mouseleave`.**
  The event cannot fire on an element unmounted under the cursor, so the chrome
  drops the measurement itself when `tooLarge`/`renderError` replace the subtree.
  Without it the tracker keeps publishing the pre-banner position — invisible
  while the banner is up, then read by the body on its **first** render after
  Force load / Retry, where a pointer layer with no second gate draws a crosshair
  at it immediately. Pinned by `DisplayChrome.test.tsx`, "the pointer measurement
  drops when the container is replaced", whose third case is the negative
  control: an *overlay* phase keeps the position, since the container is still
  there and the cursor really is on it.
- **A portaled overlay still bubbles its React events to the container** even
  though its DOM node is not a descendant, so the position would be measured
  against a box the pointer is not in. `useMouseTracking` treats that as a leave
  — the guides should drop rather than freeze. HiC guarded this by hand for its
  resolution dropdown; it is a hazard for every display with a portaled overlay,
  so the guard is universal.

### Coalescing, and the two cancels

`onPointerPosition` is already one call per frame — `useMouseTracking` coalesces
before it publishes. A display binding its **own** handlers instead owes the same
discipline itself, and `useCoalescedPointer` is it: a hit test on a raw
`mousemove` runs several times per frame on positions nobody sees, which on the
pileup measured 3.3ms of listener time an event.

Two displays bind their own, for reasons that are not going away. The pileup
reads `offsetX`/`offsetY` off a borderless leaf canvas; the canvas feature
display shares one hit test between hover, click and right-click and has label
overlays with hover semantics of their own. Both route the hover half through
the hook.

- **Coalescing is safe only because nothing decides anything from a hover.**
  Click and right-click re-hit-test from their own event. A gesture that read the
  stored hover instead would see a coalesced frame as a lost one.
- **`cancel` on `mouseleave`, before the clear.** A frame queued just before the
  pointer leaves lands after it has gone and re-lights what the leave cleared.
- **`cancel` on unmount** — a display is detached from the MST tree before React
  unmounts it, so a frame in between writes onto a dead node. The hook does this
  one; the leave is the caller's.
- **Guard the write as well as the frame.** A frame is still a write, and an
  observable array is a fresh identity every time however little changed, so the
  setter compares (`sameStrings`). Primitives need nothing — MobX drops those.

### Where a handler's coordinates come from

`eventPoint(event)` — the point in the coordinate space of the element the
handler is bound to, off `currentTarget`, so there is no ref to thread and the
measured box cannot drift from the element that received the event. Read it
during the handler; React clears `currentTarget` on return, so a deferred read
measures `null`.

Two neighbours are deliberately not this. `getRelativeX` measures against an
element passed in, because a rubberband drag tracks the pointer across the
document and projects through the box it started in. And a canvas that is a
borderless leaf element takes `offsetX`/`offsetY` off the native event, which is
already this and costs no layout read — a fact about that canvas, not a style to
copy, since it stops holding the moment anything is drawn inside the element.

### Right-click: `preventDefault` only when a menu opens

Every display's contextmenu handler resolves a target from the event first and
suppresses the browser menu only if one came back, so a right-click on a gutter,
on an overlay that owns its own menu, or on nothing falls through instead of
being a dead zone. On a canvas, suppressing it and showing nothing costs the
reader "Save image as…".

The handler's shared half is `openContextMenuFromEvent` (beside
`DisplayContextMenu`): open at the anchor, close again and let the browser menu
through if the items come back empty, otherwise `preventDefault` and clear the
hover. Five components wrote that sequence by hand and had drifted on the hover
clear and on the empty-menu case; what stays per display is resolving the
anchor. `ContextMenu` renders nothing for an empty item list, so an anchor with
no items is invisible either way — but that is one layer too late to decide the
`preventDefault`, which is why the opener asks the items before it suppresses.
The canvas base and the pileup keep their own handlers: both hit-test on a
borderless canvas and cancel a queued hover frame on the way.

**What stays highlighted while the menu is up is a per-display answer**, and the
four displays give three different ones — the canvas base makes its hover setters
inert while `contextMenuInfo` is set, multi-row derives the box from
`contextMenuInfo.hit`, the pileup clears then re-pins `featureIdUnderMouse`.
A mixin over that is the obvious factoring and is blocked:
[ADR-041](../architecture-decision-records/adr-041-no-mixin-composed-into-basedisplay.md)
— these are the deepest model chains in the repo, and a compose layer on them
drops later mixins' members out of the inferred type, far from the edit. So the
rule lives here and each display states its own answer beside its state.

## Adoption map

<!-- BEGIN GENERATED DISPLAY_CHROME_ADOPTION -->

_Generated by `pnpm autogen` — edit the source, not this block._

20 display types are registered for `LinearGenomeView`: 18 on `DisplayChrome`, 2 on `DisplayStatusChrome`. On export, all 20 reach `SvgChrome`.

| Display type | Chrome | Component | SVG chrome | renderSvg |
| --- | --- | --- | --- | --- |
| LDDisplay | `DisplayChrome` | `plugins/variants/src/LDDisplay/components/LDDisplayComponent.tsx` | `SvgChrome` | `plugins/variants/src/LDDisplay/renderSvg.tsx` |
| LDTrackDisplay | `DisplayChrome` | `plugins/variants/src/LDDisplay/components/LDDisplayComponent.tsx` | `SvgChrome` | `plugins/variants/src/LDDisplay/renderSvg.tsx` |
| LGVSyntenyDisplay | `DisplayChrome` | borrows LinearAlignmentsDisplay | `SvgChrome` | inherits `plugins/alignments/src/LinearAlignmentsDisplay/renderSvg.tsx` |
| LinearAlignmentsDisplay | `DisplayChrome` | `plugins/alignments/src/LinearAlignmentsDisplay/components/AlignmentsDisplayComponent.tsx` | `SvgChrome` | `plugins/alignments/src/LinearAlignmentsDisplay/renderSvg.tsx` |
| LinearArcDisplay | `DisplayStatusChrome` | `plugins/arc/src/LinearArcDisplay/components/ReactComponent.tsx` | `SvgChrome` | `plugins/arc/src/shared/renderArcSvg.tsx` |
| LinearBasicDisplay | `DisplayChrome` | `plugins/canvas/src/LinearBasicDisplay/components/FeatureComponent.tsx` | `SvgChrome` | `plugins/canvas/src/LinearBasicDisplay/renderSvg.tsx` |
| LinearGCContentDisplay | `DisplayChrome` | borrows `LinearWiggleDisplayReactComponent` | `SvgChrome` | inherits `plugins/wiggle/src/LinearWiggleDisplay/renderSvg.tsx` |
| LinearGCContentTrackDisplay | `DisplayChrome` | borrows `LinearWiggleDisplayReactComponent` | `SvgChrome` | inherits `plugins/wiggle/src/LinearWiggleDisplay/renderSvg.tsx` |
| LinearHicDisplay | `DisplayChrome` | `plugins/hic/src/LinearHicDisplay/components/ReactComponent.tsx` | `SvgChrome` | `plugins/hic/src/LinearHicDisplay/renderSvg.tsx` |
| LinearMafDisplay | `DisplayChrome` | `plugins/maf/src/LinearMafDisplay/components/LinearMafDisplayComponent.tsx` | `SvgChrome` | `plugins/maf/src/LinearMafDisplay/renderSvg.tsx` |
| LinearManhattanDisplay | `DisplayChrome` | `plugins/gwas/src/LinearManhattanDisplay/components/LinearManhattanDisplayComponent.tsx` | `SvgChrome` | `plugins/gwas/src/LinearManhattanDisplay/renderSvg.tsx` |
| LinearMultiRowFeatureDisplay | `DisplayChrome` | `plugins/canvas/src/LinearMultiRowFeatureDisplay/components/LinearMultiRowFeatureDisplayComponent.tsx` | `SvgChrome` | `plugins/canvas/src/LinearMultiRowFeatureDisplay/renderSvg.tsx` |
| LinearMultiSampleVariantDisplay | `DisplayChrome` | `plugins/variants/src/LinearMultiSampleVariantDisplay/components/VariantDisplayComponent.tsx` | `SvgChrome` | `plugins/variants/src/LinearMultiSampleVariantDisplay/renderSvg.tsx` |
| LinearMultiSampleVariantMatrixDisplay | `DisplayChrome` | `plugins/variants/src/LinearMultiSampleVariantMatrixDisplay/components/VariantMatrixDisplayComponent.tsx` | `SvgChrome` | `plugins/variants/src/LinearMultiSampleVariantMatrixDisplay/renderSvg.tsx` |
| LinearPairedArcDisplay | `DisplayStatusChrome` | `plugins/arc/src/LinearPairedArcDisplay/components/ReactComponent.tsx` | `SvgChrome` | `plugins/arc/src/shared/renderArcSvg.tsx` |
| LinearReferenceSequenceDisplay | `DisplayChrome` | `plugins/sequence/src/LinearReferenceSequenceDisplay/components/SequenceDisplayComponent.tsx` | `SvgChrome` | `plugins/sequence/src/LinearReferenceSequenceDisplay/renderSvg.tsx` |
| LinearVariantDisplay | `DisplayChrome` | borrows LinearBasicDisplay | `SvgChrome` | inherits `plugins/canvas/src/LinearBasicDisplay/renderSvg.tsx` |
| LinearWiggleDisplay | `DisplayChrome` | `plugins/wiggle/src/LinearWiggleDisplay/components/WiggleComponent.tsx` | `SvgChrome` | `plugins/wiggle/src/LinearWiggleDisplay/renderSvg.tsx` |
| MultiLinearWiggleDisplay | `DisplayChrome` | `plugins/wiggle/src/MultiLinearWiggleDisplay/components/MultiWiggleComponent.tsx` | `SvgChrome` | `plugins/wiggle/src/MultiLinearWiggleDisplay/renderSvg.tsx` |
| MultiWaySyntenyDisplay | `DisplayChrome` | `plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/components/ReactComponent.tsx` | `SvgChrome` | `plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/renderSvg.tsx` |
<!-- END GENERATED DISPLAY_CHROME_ADOPTION -->

Generated by `website/scripts/generate-display-chrome-adoption.ts` from the
`new DisplayType({...})` registrations, so the list and its counts cannot drift
from the code — and a registration it cannot resolve fails the run rather than
quietly dropping a row. Non-LGV views are absent by design; see § "Not on
DisplayChrome, by design", whose reasons are prose a scan cannot produce.

**A borrowed row means the display type registers another display's component**,
so it gets the chrome for free. Since the wrapper layer was deleted they borrow
the *same* level in every case — the component the display type registers. Two
borrow off the DisplayType registry, which needs no cross-plugin import
(`LGVSyntenyDisplay` → alignments', `LinearVariantDisplay` → canvas-basic's);
GC content's two import instead, because wiggle already exports the component
for them.

**Wherever two rows name one component, the two display types render the same
element**, so they share a `data-testid` base and are told apart only by
`data-display-id`. Three pairs: the two GC content displays, the two arc
displays, and `LDDisplay`/`LDTrackDisplay` — the same display against a
VariantTrack's own genotypes and against an LDTrack's precomputed file. The
hand-written version of this section missed the LD pair, which is why the table
is generated now.

**The last two columns are the same question asked of the export**, resolved
from the registration's `stateModel` rather than its `ReactComponent`: the model
chain's `renderSvg` action, the module it hands the export to, and whether that
module reaches `SvgChrome`. `renderDisplaySvg` is followed rather than trusted
by name, so a row claiming a display is on the export chrome is derived at every
hop.

**`SvgChrome` is the only value that column can hold**, which is why it reads as
a yes/no where the on-screen one names a component. The export chrome is
deliberately narrower — one terminal (`regionTooLarge`) against the on-screen
five — and the asymmetry is argued in `packages/core/src/svg/SvgExport.tsx`
rather than being decay: an over-budget region is a state the user navigated to
on purpose and a figure saying so is the honest export of it, while a fetch that
failed is the export being unable to answer, which `throwOnExportErrors` reports
by failing rather than by drawing.

**The export side tolerates absence; the on-screen side does not.** `renderSvg`
is optional (`SvgExportTrack`), and a display without one is dropped from the
export the way a minimized track is, with the user notified which tracks were
left out — so a third-party display that never wrote one costs itself a place in
figures instead of breaking export for every track in the session. Every in-tree
LGV display still has one, which is what makes a `—` in the last column above a
regression rather than a choice.

**An `inherits` row means the display composes another display's model** and
gets that model's `renderSvg`, the export-side twin of a borrowed component. The
two coincide where you would expect: `LGVSyntenyDisplay` borrows the alignments
component and inherits the alignments export; `LinearVariantDisplay` and the two
GC content displays likewise. A display splitting its own model across
`model.ts` and `baseModel.ts` is not a borrow and is not marked as one.

**The export column exists because that side had the same drift axis and no
guard.** A hand audit came back clean once; a hand audit that has to be repeated
is what a generator is for, so it is recomputed on every `pnpm autogen`.

**On-screen exception: arc / paired-arc.** These paint the *live view* onto a
plain main-thread Canvas2D of their own (no worker, no GPU backend, all features
in one array) — nothing to do with the export columns above, where both are on
`SvgChrome` like every other row. Having no backend, they can't wrap `DisplayChrome`, which owns the
backend hook. They render `DisplayStatusChrome` — the *same component* the GPU
chrome delegates to, not a parallel implementation — and supply the two facts it
can't derive for a display whose canvas it doesn't own: `phase` (off
`ArcFetchModel.displayPhase`) and `drawn` (`ArcFetchModel.painted`, its
`canvasDrawn` analogue). Container, the four `data-*` attributes, banners and
progress chip all come from the shared file. The phase lives on the model, not
in the component, for the same reason it does for a GPU display: the component
then can't disagree with it. See `plugins/arc/CLAUDE.md`.

**This was a hand-written copy, and it had already drifted** — arc rendered no
`BackgroundProgress` chip at all, and its loading term read a bare `isLoading`.
A concept shared by convention decays silently, since nothing renders both
versions side by side. Alignment with the chrome should cost a display a prop,
not a copy.

Arc's fetch autorun declines while its data is current, so `reload()` must drop
the loaded signature as well as clearing `error` — done for the whole global
family by `GlobalFetchMixin.reload()`, which owns the signature. Without that
pairing the shared error bar's retry would be dead.

## The retry contract

**The retry affordance is a contract, and `reload()` is the display's half of
it.** `DisplayErrorBar`'s only action is `model.reload()`, so every state that
can raise the error bar must be one `reload()` actually undoes — otherwise the
button is present, looks live, and does nothing. The three writes every retry
owes — clear the error, clear the durable cancel, bump `reloadCounter` — are
`FetchMixin.reload`, which both foundations chain and add their own invalidation
to (the loaded signature, the full per-region reset). Two shapes have failed it:

- **A gate `reload()` doesn't clear.** Arc, above: the fetch declines while
  `dataCurrent`, so a bare `reloadCounter` bump refires the autorun into a no-op
  unless the loaded signature is dropped too — which is why
  `GlobalFetchMixin.reload()` does both in one action rather than each display
  overriding it. The shared skeleton makes the same pairing for everything else:
  a gate on committed state is declared as `installFetch`'s `fetchKey`, and a
  run whose reload counter has advanced since the last issued fetch ignores it.
  **That is the one shape this check cannot report**, because a secondary fetch
  installs no check at all — it passes no `contract`, since the ledger is one per
  node and a second `lastCounter` would demand a fetch from the same bump. The
  multi-way display's two dependent fetches shipped a dead Retry there, unseen by
  everything, which is why the gate moved into the skeleton rather than a better
  check being written.
- **Work `reload()` never re-runs.** HiC's normalization/binsize header read was
  a bare `afterAttach` IIFE, so a retry cleared the error and dropped straight
  back onto the permanent scrim — the header was never re-read. It now runs from
  an autorun tracking `reloadCounter`, which is what makes the button real.
  Pinned by `LinearHicDisplay/infoFetchFailure.test.ts`.
- **A phase that unmounts the affordance.** The loading overlay carries Retry
  after a user cancel, so a loading term written as bare `isLoading` destroys it:
  `cancelFetchByUser` drops the stop token synchronously, the phase falls to
  `ready`, and the display sits stopped and empty with nothing to click, the
  canceled state being deliberately durable. Read **`isLoadingOrCanceled`**
  (FetchMixin), which exists so no family has to remember the second term. Both
  families had a version of this hole; the cancel term lives inside
  `computeLoadingTerm` now rather than in either family's getter. Pinned by
  `plugins/arc/src/shared/displayPhase.test.ts` and
  `plugins/canvas/src/LinearBasicDisplay/displayPhaseWiring.test.ts`. The
  comparative family reaches the same place by a different route and is worth
  knowing about before "fixing" it: its `loading` is `!ready && !error`, with no
  `fetching` term (deliberately — that would blink the overlay off during the
  pre-refetch debounce gap), so the scrim carrying Retry survives a cancel
  because no data arrived. Add a `fetching` term there and the affordance goes
  with it.

The check when adding a display: raise each error it can produce, press retry,
and confirm the display can leave that state. Cancel is one of them.

**The first of those three shapes reports itself.** `makeRetryContractCheck`
(`assertDisplayContract.ts`) runs inside every fetch installer —
`installGlobalFetchAutorun`, `installComparativeFetchAutorun`,
`MultiRegionDisplayMixin`'s `afterAttach` and the shared `installFetch` — so
every fetching display gets it with no per-display test: a run that follows a
`reloadCounter` bump and declines to fetch *is* the dead button, and it says so
through the same `console.error` channel as the rest of the contract checks,
naming the fix. Dev-only, and everything it reads is `untracked` — a tracked read
would put an observable in the fetch autorun's dependency set in development and
not in production. The one legitimate decline, a display deliberately not
fetching at all (LD with the triangle off), exempts itself with
`fetchInert`.

**The bump is what arms it, so a `reload()` override is how the whole check gets
turned off.** MST replaces an action outright, so an override that neither bumps
`reloadCounter` nor chains to the one it replaced leaves the counter frozen, and a
frozen counter reads as a display that never retries — silence, not a report.
Canvas's `LinearBasicDisplay` shipped in that shape and took `LinearVariantDisplay`
with it, both of them among the most-used displays in the product, while
`MultiRegionDisplayMixin.reload`'s docstring described the failure mode and named
the other override as the only one. `reloadReachesCounter.test.ts` now reads every
`reload()` in `plugins/` and `packages/` and requires each to bump, chain, or be
an empty placeholder; nothing else in the tree makes a claim that an empty body
could contradict.

**A two-stage `reload()` says `awaitingPrerequisite`, and that is a deferral
rather than a second exemption.** The declared decline leaves the `reloadCounter`
bump outstanding instead of consuming it, so the run after the prerequisite lands
is the one judged and a display cannot spend its retry on a decline it called
preliminary. Read that mechanism in `makeRetryContractCheck`, and note what it
costs at the one call site: HiC's predicate is `!hasResolutions` and its gate is
`effectiveResolution !== undefined`, which is the same condition — `availableResolutions`
is what both read — so every HiC decline defers and the report is unreachable for
that display. There is nothing narrower to say — the gate and the
prerequisite are one condition there — so HiC's retry is pinned by
`LinearHicDisplay/infoFetchFailure.test.ts` and not by this check. A display
whose predicate is strictly narrower than the decline its own gate can produce
keeps the coverage; one that restates the gate has opted out, and should say
which test covers it instead.

**The two families classify a run differently, and only that part is per
family.** The global one reads what `prepare()` returned — the shared skeleton
classifies a run by whether its `prepare` answered args — so the classification
is a return value rather than a second call to the gate. The per-region one has no
such answer: its gate is block coverage — a `reload()`
that invalidates nothing leaves `needed` empty — plus a `fetchNeeded` override
that can decline inside an async body whose return value says nothing. So the
foundation watches the fetch instead: `FetchMixin.runFetch` is where every fetch
in every family starts, and all nine `fetchNeeded` overrides reach it in their
synchronous prefix. An override that awaited before fetching would get a false
report rather than silence, which is the right way round. It also has a fourth
outcome, `deferred`, for the in-flight skip — `reload()` signals the running
fetch's stop token but `activeStopToken` clears in `runFetch`'s finally, so the
next run can still see `isLoading`, and consuming there would answer the retry
with a run that predates it.

**A fetch answers the retry wherever `reload()` reached it from**, which is why
`runFetch` tells the ledger and not just the autorun. Canvas's `reload()` clears
and calls `fetchNeeded` itself rather than waiting out `FetchVisibleRegions`' 600ms
debounce — Retry and Force load are clicks — so no autorun run separates the bump
from the fetch, and by the time one arrives the blocks are covered and it reads as
a decline. Judging only from the autorun reports a dead button on the display with
the liveliest one, which is what four canvas tests do the moment that credit is
removed.

Sequence and variants are the two per-region displays whose `fetchNeeded`
declines. Sequence needed nothing: `zoomedOut` implies `placeholderMessage`
implies `!rendersCanvas`, which is already its `fetchInert`. Variants
declares `awaitingPrerequisite` (`!sourcesBase`), HiC's two-stage shape in this
family, and unlike HiC's it is genuinely narrower: `FetchVisibleRegions` declines
whenever every visible block is covered, and that decline is judged as soon as
`sourcesBase` is in hand. What does *not* establish the width is `fetchNeeded`'s
own empty-region return — the autorun calls it only with a non-empty `needed`,
which means the view has visible regions, so that branch is unreachable from
there.

**Both flags live on `FetchMixin`**, the one mixin both LGV foundations
compose, and the check reads them off the node. That is the same argument the
`fetchInert` docstring makes about its own home, and `awaitingPrerequisite`
briefly ignored it: it shipped as an `installGlobalFetchAutorun` option on one
side and a `MultiRegionDisplayMixin` getter on the other, which is one concept in
two spellings and a third surface on the check's own signature. The three fetch
phases stay options because they really are what the autorun runs; these two
describe the display.

Two neighbours were converged on the same rule at the same time, because the
families had drifted into saying one thing two ways:

| concept | was | is |
| --- | --- | --- |
| "a prerequisite has not landed" | option one side, getter the other | `FetchMixin.awaitingPrerequisite` |
| "the RPC cache key" | `rpcPropsCacheKey` getter one side, a local `computed` over the same `serializeRpcProps` the other | `FetchMixin.rpcPropsCacheKey` |
| "the byte gate skips this run" | `regionTooLarge && !gateMeasurementStale`, written out in both autoruns under near-identical paragraphs | `RegionTooLargeMixin.gateSkipsMeasuredViewport` |

None of the three changed behavior — each was already the same value computed
twice. What they change is that a guard now has one copy, which is the copy an
escape clause would have to be added to in the open.

The ledger itself — bump, outcome, verdict — is tested apart from either
foundation in `core/pluggableElementTypes/models/retryContractLedger.test.ts`,
because it is a state machine with
no MobX in it; which early return emits which outcome is tested against real
autoruns in `installGlobalFetchAutorun.test.ts` and
`gwas/LinearManhattanDisplay/retryContract.test.ts`. **Anything proving a
deferral bumps the counter once**: under two bumps a deferral and an exemption
behave identically, because the second bump is its own unanswered retry.

The other two stay manual. **Work `reload()` never re-runs** can't be seen from
here, because the autorun does reach a fetch.

**A display rendering its own banner** (dotplot, synteny) is covered too.
`installComparativeFetchAutorun` installs the check, classifying off the same
gate the other two do — `prepare()` returning `undefined` is the decline — and
exempting on the same `fetchInert`, which is one name across every fetch in the
tree rather than this one's private spelling. Its own test provokes the dead button
and asserts the report.

What that gate still cannot say is *which* decline it meant: `prepare()`
returning `undefined` covers both "nothing to fetch" and "not ready yet", and
dotplot's bails on `!view.initialized`. That transient must not become
`fetchInert` — a display about to fetch should still show its overlay — so it
would report if a `reload()` were outstanding across it. Nothing gets one there
today, since the only Retry lives on an error banner and an error needs a fetch
that ran; a `prepare()` that says which of the two it meant is what would close
it properly.

A report is only useful if something can hear it. Nine `testEnv.ts` harnesses
used to set `console.error = jest.fn()` as copied boilerplate, muting every
contract check in exactly the suites that build real displays; none does now.
Don't reinstate a blanket silencer;
capture and assert on the channel, the way `assertDisplayContract.test.ts` does.
`createDisplayTestEnvironment` now silences `console.warn` and only
`console.warn`, in one place, which is what stops the boilerplate from coming
back.

**The non-LGV views owe the same contract by hand, and were not paying it.**
They render their own banner, and `ErrorBanner`'s `onReset` is optional and
silently draws no button without it, so a dotplot GPU error, a dotplot fetch
error and a synteny fetch error each rendered a banner whose only remedy was
reloading the tab. Both halves are wired now: `retry()` from
`useRenderingBackend` for the backend, `reload()` on `SyntenyFetchStateMixin` for
the fetch. `reload()` hit the same trap the LGV family did — clearing the error
is not enough, because after a failure every fetch input is unchanged, so
`prepare()` recomputes the same key and nothing refires. It bumps a
`reloadCounter` that `installComparativeFetchAutorun` reads **unconditionally,
before its gate**, so one read serves both displays and a gated state can't
swallow the retry. Pinned by `installComparativeFetchAutorun.test.ts`, confirmed
to fail with that read removed.

**No display bypasses the chrome.** `AlignmentsDisplayComponent` used to
early-return its own "Initializing" overlay while `!view.initialized`, and an
earlier revision of this file called that load-bearing. It was neither: nothing
in that subtree throws before the view is measured, and the branch was
unreachable, since `LinearGenomeView` renders `ViewLoadingScreen` for the whole
of `showLoading` and every host reaches an LGV through it.

The bug that audit found is the part to carry forward. `PileupBezierOverlay` had
a guard that didn't guard — `const { initialized, width } = view` evaluates
`width` *before* the `!initialized` check, so it threw on exactly the run it was
written for, latent only because the branch never ran. Watch for that shape
wherever a throwing getter is destructured next to the flag that gates it.

## Not on DisplayChrome, by design (non-LGV views)

These are the rows the generated table above does not have, and cannot: it scans
display types registered for `LinearGenomeView`, and these are not.
[SHARED_CANVAS_VIEWS.md](SHARED_CANVAS_VIEWS.md) is the subject doc for the two
comparative ones; what follows is only what they owe the chrome's contracts. Two
distinct reasons, not to be conflated:

- **GPU, dropping to the `useRenderingBackend` primitive directly:**
  `dotplot-view` and `linear-comparative-view` (synteny). Both are non-LGV view
  types with no `ChromeModel` contract (`displayPhase` / `regionTooLarge` /
  `height`), so the chrome doesn't fit. This is the sanctioned
  drop-to-primitive path, not partial adoption. Don't force them onto
  DisplayChrome. What they owe in exchange: because their canvas stays mounted
  through an error rather than being replaced by a banner, they must key it at
  the mount site. Every re-init needs an element that never held a context — a
  canvas's context kind is permanent — and `DisplayChromeBase` keys its
  render-prop body on `canvasKey` for the displays *on* the chrome, so this is
  the only family carrying the rule itself. Both render **`RenderCanvas`**
  (`@jbrowse/render-core/RenderCanvas`), which owns that `key={canvasKey}` so it
  can't be forgotten. See GPU_RENDERING.md "Context-loss recovery" for why the
  old "DisplayChrome gets it free" reasoning covered only one of the four
  re-init paths.

  **They owe the retry too, and dotplot wasn't paying it.** A consumer rendering
  its own banner has to wire `useRenderingBackend`'s `retry()` by hand, and
  `ErrorBanner`'s `onReset` is optional and silently renders no button without
  it. Dotplot is where that matters most: its canvas is never unmounted to force
  a re-init and auto-recovery quits after two attempts on a context loss, so the
  display was stranded until a page reload. `retry()` bumps `canvasKey`, which
  `RenderCanvas` turns into the fresh element. Both pay it now.
- **Main-thread SVG, own radial banners:** `circular-view` (ChordVariant) is not
  a GPU display at all, having no `useRenderingBackend`, `RenderLifecycleMixin`
  or `canvasDrawn`. It renders SVG chords (`Chords`, in
  `plugins/circular-view/src/chords/`) switched on the model's own
  `displayPhase` — `computeDisplayStatusPhase` over `error` and `!ready`, the
  ranking every other display publishes, carried as `data-display-phase` on the
  chord group so the census sees it. **`ready`, not `features`**: `blocksForRefs` falls
  back to untranslated refNames while the refName map is in flight, so drawing as
  soon as the features land flashes a chordless circle whenever the adapter's
  names differ from the assembly's (`1` vs `chr1`). It keeps its own `Loading`
  and `DisplayError` components, because the rectangular LGV banners don't fit a
  radial view. Arc is an *LGV* SVG display and so can reuse them; circular's
  medium is why it can't.

  **It owes the retry too, and pays it in its own medium.** Nothing here is a
  rendering backend, so there is no `retry()` to wire; what its error circle was
  missing was a way back at all — after a fetch failure every input of the chord
  fetch autorun is unchanged, so the display sat on the error for good. The
  banner carries a `Retry` tspan (`chord_retry`) calling the display's own
  `reload()`, which bumps the `reloadCounter` the autorun reads above every
  gate. Same rule as the LGV families' — ARCHITECTURE.md "[the trigger
  list](../ARCHITECTURE.md#the-global-fetch-trigger-list-must-be-read-unconditionally)".

## One element per display: testid, id, phase, drawn

Every LGV display emits **one** chrome element, and it carries four attributes:

| attribute | value | answers |
| --- | --- | --- |
| `data-testid` | the display type's base name, never mutated | which KIND of display |
| `data-display-id` | the display's `configuration.displayId` | WHICH display |
| `data-display-drawn` | `true` / `false` | has it painted (FIRST paint) |
| `data-display-phase` | `ready` / `loading` / `error` | is it FINISHED |

All four are stable in meaning and orthogonal — one question each. `data-testid`
used to gain a `-done` suffix on first paint, which made it the only mutating
testid in the tree and meant readiness had two spellings (`-done` here, `_done`
on the chrome-less synteny/dotplot canvases). [ADR-065](../architecture-decision-records/adr-065-display-readiness-selectors.md)
deleted the suffix: a mutating id cannot be a handle, and a suffix could carry
only one of the four answers above.

**"This display type, painted" is therefore a conjunction**, and it is written
once rather than at each call site — `displayPainted(base)` from
`@jbrowse/capture` (re-exported by `@jbrowse/browser-test-utils`) for a selector
string, `findDisplayPainted` for the jest and puppeteer waits. Those helpers can
also say *which half* failed, which the suffix never could: a
`findByTestId('pileup-display-done')` timeout was equally consistent with "no
pileup display mounted" and "it mounted and never painted".

All four ride the **container**, which the two subtree-replacing phases don't
render — so in `tooLarge`/`renderError` a display publishes none of them, not
even `data-display-id`. That is deliberate (see `data-display-phase` below), and
it is why the two helpers that wait on
`[data-display-id="…"][data-display-drawn="true"]` can never match a too-large
display.

**The readiness gate is `painted`, not `canvasDrawn`, and that distinction cost
two silent timeouts.** `painted` (`RenderLifecycleMixin`) is `canvasDrawn ||
!rendersCanvas || paintInert`, and each term past the first is a state where the
raw flag can never flip:

- **`!rendersCanvas`** — a display deliberately showing a static placeholder
  never calls `canvasRef`, so no backend is built. Both such displays — sequence
  past base resolution, LD with the triangle off — had wired the *scrim* and the
  *export* by hand, through two hooks that have since become one (`fetchInert`),
  and missed the third reader, the one outside the display.
- **`paintInert`** — a fetch that failed before first paint. The error bar is an
  *overlay*, so the canvas stays mounted, nothing draws into it, and the flag
  stays false for the rest of the session. Both families fill the hook with
  `!!error`. Arc was immune only by accident: its `painted` is
  `features !== undefined || !!error`, a hand-written expression that carried
  the term the shared getter never got.

Either way the failure is the same and it is invisible: `PENDING_DISPLAYS`
selects `[data-display-drawn="false"]`, so a zoomed-out reference sequence track
— or one broken track URL — made every `waitForDisplaysDone` on the page burn
its full timeout, and that wait swallows its own. Same shape as `fetchInert` on
the comparative side, same fix: one name the display publishes and every
consumer reads. Arc, with no `RenderLifecycleMixin`, declares its own `painted`
on `ArcFetchModel` for the same reason its `displayPhase` lives there — a
component-side derivation is free to disagree with the model.

`DisplayChrome` takes a **required** `testid`, which it publishes unchanged.
Displays that pixel-match the canvas also give the inner `<canvas>` a static
selector (`hic_canvas`, `ld_canvas`, `variant_canvas`, `variant_matrix_canvas`,
`multirow_canvas`) as a query target: tests wait with `findDisplayPainted(base)`,
then read the static selector. The non-LGV views keep their own standalone
`synteny_canvas` / `dotplot_webgl_canvas` ids, since they have no chrome at all
— but they do publish `data-display-drawn`,
through `RenderCanvas`, which is what lets "has everything painted?" be one
selector across every view. It is a **required** prop there for the reason the
old arrangement failed: `PENDING_DISPLAYS` named `synteny_canvas` explicitly and
simply forgot dotplot, so an unpainted dotplot counted as finished and a capture
could land on it blank. A list that enumerates views forgets one; a required prop
cannot.

**Why two id attributes and not one.** `data-testid` is the *base*, shared by
every instance of a display type, so "which track is this" had its own
attribute-shaped hole — previously filled by a second wrapper element emitting
`display-${displayId}` as *its* testid. `data-display-id` fills it on the same
element, and `data-display-drawn` lets paint state be read without decoding a
suffix.

**This replaced three coexisting testid shapes, and the cost was never just the
extra `<div>`.** Two things used to vary per display: the `testid` base, and
whether a `DisplayContainer` sat above it emitting `display-${id}-done` of its
own. The knock-on effects were all in test infrastructure that had to accept
every shape:

- `PENDING_DISPLAYS` (`products/jbrowse-capture/src/waits.ts`) was a three-way
  union, because paint state was encoded by a mutating id whose base could take
  either shape. It is **one** selector now, `[data-display-drawn="false"]`; the
  synteny special case went with it once `RenderCanvas` made the attribute
  required of the two non-LGV views.
- `displayReady()` (`website/scripts/screenshot-spec-helpers.ts`) had to emit
  **two** selectors joined by a comma, because alignments put its `-done` testid
  on an inner div while `data-display-phase` stayed on the chrome, so the two
  could only be related with `:has()`. Each form matched nothing in the other's
  case, and the symptom was a capture that timed out rather than an authoring
  error.

**The co-location is pinned in jest, which is the only one of those systems that
runs outside CI.** `BigWig.test.tsx` and `Manhattan.test.tsx` assert that the
testid, `data-display-id`, `data-display-drawn` and `data-display-phase` land on
**one** element. Collapsing a wrapper is invisible to jest without that
assertion, and every system that would notice needs a GPU and a headless Chrome
— so this is the guard that would catch the next such refactor going wrong, and
it runs locally.

**What was deleted with it.** `DisplayContainer` and `BaseLinearDisplayComponent`
are gone, and with them `BaseDisplayModel`'s `DisplayMessageComponent` getter, so
the model no longer has any view of its own UI. Four registered components
existed *only* to wrap a body in that container; each became a pass-through and
was deleted, with the display type registering the body directly. Wiggle and
GC-content consequently register the identical component, which is what the
container arrangement was working around.

Two follow-through details, neither visible in a diff:

- The container contributed `whiteSpace: nowrap` / `textAlign: left` by
  inheritance. Those are re-stated verbatim on the chrome of each display it no
  longer wraps, so no label overlay changes how it wraps. They were **not**
  pushed onto `DisplayChrome` for everyone: seven displays never had them, and
  `white-space: nowrap` on a display root would stop long error-banner text from
  wrapping.
- The canvas family's `FloatingLegend` moved inside `DisplayChrome`'s child. The
  chrome is `position: relative` exactly as the container was, so the geometry is
  unchanged.

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

### Changing a readiness selector: ask which system depends on which shape

Both passes over these attributes — the one that added them and ADR-065's
removal of the `-done` suffix — were tractable for the same reason, and it is
the part worth reusing. The selectors were a contract across four test systems,
and **none of them depended on all of it**: the website specs and cypress only
ever used the static bases (`pileup-display`, `wiggle-display`), only puppeteer's
browser-tests used the generic `display-${id}`, and only jest asserts the
co-location. Checking that first is what turned a change that looked like it
touched every suite into one that left ~50 spec selectors untouched.

Assuming instead that all four depend on all of it prices the change as a freeze
across systems that mostly need a GPU to run, which is how a selector shape stays
wrong.

## The bring-your-own seams

**All of it lives in `@jbrowse/display-ui`, a package with no `@mui/*`
dependency**, and that dependency edge is the guarantee — see "the seam used to
import what it replaces" below for what happened while the guarantee was a
convention. This plugin holds the Material bindings and depends on that package;
nothing runs the other way. The LGV barrel re-exports the lot, so a consumer can
name either.

Two seams, and they answer different questions. Both default to *undefined*
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

**An embedder mounts one thing, though.** The split is real for the
implementation and not for a host: nobody wants stock Material scrims with plain
corner buttons, and every consumer mounts the two together with the same two
plain sets. `DisplayUIProvider` is the pair, both props defaulting to the plain
sets, so the common case is `<DisplayUIProvider>{tracks}</DisplayUIProvider>` —
no arguments, one import. Supplying either brings your own.

**`overlays` is a partial set**, merged over the plain one, because a host
replacing one state was writing the other four by hand — every example of it
spread `plainChromeOverlays` in to say so. It also survives a *sixth* state: a
whole set goes stale on upgrade (a compile error if they typecheck, a missing
component if they ship JS), a partial one picks up the new plain default.

### The seam used to import what it replaces

`DisplayUIProvider` reached **45 `@mui/*` modules**, and every check in the repo
said it was clean, because every check counted rendered `Mui*` elements. Two
edges did it, both one hop:

- the two `createContext` calls lived in `DisplayChrome.tsx` and
  `TrackControl.tsx` — the modules that *bind the Material sets*. An override
  channel sharing a module with the default it overrides drags that default into
  every consumer;
- `DisplayBackgroundProgress` named the `@jbrowse/core/ui` **barrel** for one
  chip, which lands `FileSelector`, `FatalErrorDialog`, the cascading-menu stack
  and `PluginManager` in whatever chunk reaches it.

Measured on the build-your-own site, the page called "Removing Material UI"
carried **34 first-party eager modules importing `@mui/material` against 16** on
the page that deliberately leaves Material chrome on screen, and downloaded 53 KB
gzip more. Zero Material elements rendered, so the census was right and useless.

Three things now hold the line, in order of strength: the package declares no
`@mui/*` dependency at all; `packages/display-ui/src/muiFree.test.ts` walks the
value-import graph across workspace packages and fails with the trail; and the
census still counts what renders. The last one cannot see this class of bug —
**a claim about a module graph needs a check on the module graph.**

### The behaviour under the plain control is separately reusable

`useTrackControlMenu` is the corner control's menu as prop getters — dismissal
(Escape, outside pointerdown, ancestor scroll), focus, the top layer, and
anchoring bottom-to-top/right-to-right so the menu clears a `contain: strict`
box and the window edge. `plainTrackControl` is the markup left over it.

That split exists because a host writing their own control was inheriting a
styling decision to get behaviour they could not otherwise have: each of those
dismissal rules is a bug when missed and none shows up in a screenshot. Prop
getters over a component is the headless-library shape, and it is what the
repo's own `usePanZoom` / `useResizeDrag` already do for gestures.

Defaulting *that component's props* is not the ambient default the contexts
avoid, which is what makes it safe: the contexts still resolve to `undefined`, so
nothing reaches a plain set without someone having mounted the component on
purpose. `DisplayUIProvider.test.tsx` pins both halves — that mounting it
supplies both seams, and that *not* mounting it still yields Material — because a
half-wired provider reads as a styling bug rather than a missing one.

**The view's own status states are not a seam either, and a host that only
knows about these two draws none of them.** Everything above is a *display*
failing — a fetch, a render — over a view that is up. The view has its own three
outcomes, and they are plain getters rather than components: `loadingMessage` /
`loadingProgress` while the assembly loads, `error` when it could not, and
`ready` (`!showLoading && !error`) for the rest. JBrowse's own
`LinearGenomeView` branches on them and renders `ViewLoadingScreen` or the
import form; an embedder mounting `RenderingComponent` directly writes
`view.ready ? tracks : null`, which is the shape everyone reaches for and which
turns a 404 on a sequence file into an empty box that never fills — no throw and
no console error, because the failure is a state on the model. `error` has to be
read *before* `loadingMessage`, which goes `undefined` when the load stops
however it stopped. `products/jbrowse-build-your-own`'s "Loading and error
states" page is the worked version, with a radio that breaks the assembly on
purpose; every other page there carries the short form.

`session.snackbarMessages` is the third channel and the quietest, not being on
the view at all: `showTrack` with an unresolvable id returns `undefined` and
reports the reason there, as do `addSessionTrackConf` on an invalid config and a
failed `init.loc`. Nothing throws, so a surface that does not read the array
shows a ticked checkbox and a track that never arrives.

`app-core`'s `App` was the only thing in the repo rendering it, so both embedded
React products dropped every message. Both mount `ui/Snackbar` now — its module
scope is two `lazy()` calls, so it costs their eager bundles nothing — pinned in
each product's own test through a call that really fails rather than a pushed
message, since the regression is the path going quiet, not the array. **A host
drawing its own chrome is still on its own**, by construction.

**Colors are not a seam and are not in it.** A display reads `usePalette()` for
its own content colors, which is a palette of strings rather than a toolkit, so
it arrives through a palette provider whatever the two seams are set to — a
feature track needs it even with plain chrome. `SessionPaletteProvider`
(`@jbrowse/core/ui/PaletteContext`) is how a host follows its own dark mode:
it writes the config `theme` slot, which is what *both* halves of the rendering
derive from — the palette React draws with, and the theme shipped to the worker
that bakes feature labels into the image. It is a component rather than the
documented `useSessionPalette` + `PaletteProvider` pair because the pair has a
half that can be left out with nothing to show for it: `PaletteProvider` is the
discoverable name, colors React alone, and leaves those baked labels in the old
mode.

**A set is written against exported types, not inferred ones.** The four model
shapes the overlays are handed (`DisplayErrorBarModel`,
`DisplayLoadingOverlayModel`, `DisplayBackgroundProgressModel`,
`TooLargeMessageModel`) are exported from the LGV barrel for that. Naming them
structurally in `DisplayChromeOverlays` is not enough: a component wrapped in
`observer()` gets no contextual type for its props, so without the export the
only way to write a replacement is to redeclare the shape and drift from it.
The build-your-own site's overlays page now writes a set this way, in the page's
own source — until 2026-08 that page (then called "Bring your own overlays",
now "Removing Material UI") only ever swapped in JBrowse's *other* set.

**The overlay node is published too, and is the host's half of the portal.**
Floating chrome a display draws — `FloatingLegend` (canvas, alignments,
variants, multi-wiggle), `HicOverlayPanel`, maf's row labels — escapes its
`contain: strict` sandbox through `TrackOverlayPortal`, into a node the *host*
supplies via `TrackOverlayContext`. An embedder mounting `RenderingComponent`
directly supplied none, so the context was null, the portal fell back to
rendering inline, and inline is under whatever the host paints over its column;
`products/jbrowse-build-your-own` draws `paddingSpans` at `zIndex: 2` on five
pages, which is exactly that. Nothing throws, and it only shows at a zoom where
the masks are wide.

`TrackOverlaySlot` (LGV barrel) is the node, the context and the paint order in
one place, and `TrackContainer` mounts it too — one implementation rather than
JBrowse's and a copy. **`zIndex` is required with no default**, because it
answers "above what?", which is a fact about the caller's layout: the container
passes 100 (above `PaddingBlocks`, below `TrackLabel` at 200), the BYO site's
`track-settings` page passes 3 because its seams are at 2. A default would be
right once and silently wrong everywhere else, and silence is the whole failure
mode here. `TrackOverlaySlot.test.tsx` pins the escape, the pointer-events, the
gesture marker and the inline fallback; the BYO smoke check drives a real
legend over real seams and asserts it left the sandbox.

**Gestures are published too, and are not a seam.** An embedder drawing their
own chrome still has to get a wheel and a drag into `zoomTo`/`horizontalScroll`,
and that has no interesting variants — so it is
`@jbrowse/core/util/usePanZoom` (`useWheelZoom` for the wheel half, which
`LinearGenomeViewContainer` itself renders), plus `useWidthSetter`
(`@jbrowse/core/util/hooks`) for the width every view needs before it draws.
Eight example pages each carried a hand-rolled copy of the first, all of them
missing the rAF batching and the zoom rate limit; treat "the examples all write
X" as a missing export rather than a duplication problem.

`@jbrowse/core/util/useResizeDrag` is the third, and the one where the split
between gesture and styling is sharpest. Per-track vertical resize is a divider
in the *host's* track row, so the bar has to be theirs, but the gesture behind it
is pointer capture, one commit per animation frame, and a delta measured from the
last commit rather than from the press — which is what keeps a drag that runs
into `resizeHeight`'s clamp from banking a debt the pointer pays back on the way
out. The hook returns props to spread onto any element, `data-gesture-owner`
among them, so a resize drag doesn't also pan the view. `ui/ResizeHandle` is that
hook plus JBrowse's own 4px bar, and the build-your-own site's
"Rulers and labels" page is the same hook under a divider of its own.

**A third seam was considered for the tooltip and rejected.** `BaseTooltip` is
rendered by each display directly, behind neither provider, and it used to style
itself through `makeStyles(theme => …)` — so in a host mounting no
`ThemeProvider` it drew MUI's *default* grey chip in Roboto while the BYO smoke
census scored it zero. What it needed was colors, and colors already have a
toolkit-free home: it reads `usePalette()` and inline styles now, with no new
provider. Reach for the palette before reaching for a fourth context.
`BaseTooltip.test.tsx` pins the plain rendering, because the browser census can
only see a tooltip a headless hover happened to raise.

**`FloatingLegend` was the same shape, found the same way.** Canvas, alignments,
variants and multi-wiggle all render it directly, behind neither provider, and it
drew two MUI `IconButton`s and a `Link component="button"`. Its `makeStyles` was
already the theme-free one, so the *styling* half had been fixed and the
components had not — and the census scored it zero for a third reason: it counts
only what is on screen, and a legend appears only once something sets a `colorBy`
that produces one, which no page there does. When adding a component, the
question is not "does it look like chrome" but "does a stock display import it
directly".

Same resolution: plain `<button>`s from the existing theme-free `makeStyles`, `×`
for the glyph — which is what `SvgColorLegend` already draws, so the exported
legend and the on-screen one now agree — and no new seam.
`FloatingLegend.test.tsx` pins it with the census itself (`[class*="Mui"]` must
be empty with all three controls rendered), for the reason `BaseTooltip` is
pinned in jest: a browser check that never runs is not a check. 7 Material
elements before, 0 after.

**It lives in `@jbrowse/display-ui` now**, which is what "does a stock display
import it directly" implies once you follow it: six plugins render this legend,
it reaches no toolkit, and it is chrome by this package's own definition — a
thing a display draws that is not its data. The whole-package import test walks
it as a result, rather than `muiFree.test.ts` naming it by a relative path into
another package. `@jbrowse/plugin-linear-genome-view` re-exports it under the
same name, since that is what all six import and a removal from a plugin barrel
fails quietly.

**Reach vs weight.** Both providers are *reach*: they redirect what stock
displays render, but `DisplayChrome`/`TrackControl` still reference MUI, so it
stays in the bundle. *Weight* is only available to code writing its own display
component — `DisplayChromeBase` plus a `TrackControlComponent` of its own import
no toolkit at all. `pnpm measure-chrome-bundle` measures three entry points and
CI re-checks them: the Material chrome, the base-plus-plain pairing, and
`DisplayUIProvider` itself. **Quote the third when describing what mounting
the seam costs**, and quote it from `scripts/chromeBundleSizes.json` rather than
from prose — that file is what CI gates, so a number written anywhere else is
one the next commit can falsify. The build-your-own landing page quoted the
second for a year while every page on it took the first, which reads as a saving
where the page in fact pays the seam on top of the Material chrome it is not
removing.

**That third entry point is the provider, not `export *` over the package**, and
the difference is not pedantry: while it was the barrel, moving `FloatingLegend`
into the package nearly doubled it — the legend reaches `makeStyles` and so
drags emotion in, though nothing an embedder mounts renders it. A figure that
moves when the package gains a component the seam's consumers never touch is
measuring the directory. `makeStyles` no longer stands in the way of the
second, handing a component JBrowse's own plain-data theme
(`ui/styleTheme.ts`), but that alone did not get MUI out of a host's first
paint; [EAGER_BUNDLE.md](EAGER_BUNDLE.md)
§"What still holds Material UI in the eager set" is the measured list of what
does.

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

Four things get cited here; three are load-bearing and one is not, and conflating
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
- **`immediate` bypasses that delay; it must never be an input to it
  (load-bearing).** The chrome passes `immediate={!painted}`, and that flips
  *during* a load: first paint lands while the phase is still `loading` (region 1
  drawn, regions 2..n in flight). `useDelayedFlag(isVisible && !immediate, …)`
  made the flip start a fresh 250 ms window from zero, so the scrim blinked out
  in the middle of one continuous load. The delay keys on `isVisible` alone —
  same input the cancel-button delay beside it always used. Pinned by
  `DisplayChrome.test.tsx`, "the loading scrim spans one continuous load", and it
  has to be pinned *there*: `rerender`ing `LoadingOverlay` directly remounts it,
  which resets the state under test and makes the assertion vacuous.
- **Laziness (load-bearing):** `displayPhase`'s loading term is a thunk,
  evaluated only after the terminal flags are ruled out, so a banner state
  doesn't subscribe to the view's churning `visibleRegions`/`loadedRegions`.
- **Early `return` vs ternary (style):** once a correctness constraint, because
  react-compiler could memoize a MobX read on `model`'s stable identity. Not one
  since `DisplayChromeBaseInner` took `'use no memo'` —
  [COMPILER_TERNARY_FINDING.md](COMPILER_TERNARY_FINDING.md).

Full "why" for the tree-shape rule: ARCHITECTURE.md §"Terminal states early-return
their own root". Don't duplicate it here.
