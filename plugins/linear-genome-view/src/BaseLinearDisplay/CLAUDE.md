# BaseLinearDisplay fetch system

`FetchMixin` (stop tokens, staleness, `isLoading`) + `MultiRegionDisplayMixin`
(autoruns, `fetchRegions`, `loadedRegions`, overridable hooks). Status chrome is
`DisplayChrome.tsx` — see `agent-docs/reference/DISPLAYCHROME.md` and adr-026,
and don't re-litigate the layering.

## Lifecycle traps

- **Never read `view.width`/`dynamicBlocks`-style getters synchronously in an
  `afterAttach` body.** Before init they throw by design, and the session loader
  misreads the escaping error as an invalid track and drops it. Use
  `autorunOnReadyView` for any view-dependent autorun.
- **A display's own `afterAttach` must not `superAfterAttach()`.** Our MST fork
  auto-chains lifecycle hooks, so calling it installs everything twice.
  `assertDisplayContract` reports it in dev. Regular actions still use
  super-capture.
- **`HeightModeMixin()` composes after `TrackHeightMixin()`**, whose `height`
  and `resizeHeight` it overrides — `types.compose` gives the later argument the
  collision. Checked at attach: both declare `supportsHeightModes` (false on the
  base, true on the mode mixin) and `HeightModeMixin`'s `afterAttach` reads it
  back, since the two `height` getters agree in fixed mode and no value can tell
  the orders apart.
- **A super-captured view is called bare**, so a base must not reach siblings
  off `this`. Move the overridable view into its own later `.views()` block,
  placed after everything it reads.

## `isCacheValid` and `rpcProps` are views, not actions

MobX runs an action inside `untracked`, so declaring either in `.actions()`
makes its reads register no dependency and the caller silently keeps a stale
answer. It regresses quietly, because each caller independently reads something
that moves in lockstep — it has bitten twice. `assertDisplayContract` checks it
in dev for every display composing the mixin, so a new fetching display needs no
per-family `getMembers` test.

Only these two method-shaped hooks are exposed; a getter can't regress this way,
which is why the byte gate's opt-in is the `measuresBytesPreFlight` getter.

`makeRetryContractCheck` is the same idea for the retry contract, and lives in
the same file: `installGlobalFetchAutorun` reports when a `reloadCounter` bump
re-runs the autorun and the display's own gate still declines, which is the dead
Retry button arc shipped. Exempt yourself with `loadingSuppressed` if the
display is deliberately not fetching — don't reach for anything else, and don't
silence `console.error` in a test harness, which is what kept every one of these
checks inaudible until 2026-08. A jest gate now fails the run on any of them
(`config/jest/displayContractGate.js`), and a harness that replaces or mocks
`console.error` takes itself back out of it. A test that provokes a violation on
purpose calls `takeDisplayContractReports()`, which both excuses the reports and
hands them over to assert on.

**A `fetchNeeded` that declines to fetch must be woken by something the autorun
already tracks.** The coverage test short-circuits, so `isCacheValid`'s
observables may register no dependency — an early return _without_ fetching
breaks the wake chain and must supply its own.

Every field `rpcProps()` **returns** becomes a cache key, and only those.

Which is why a display that builds the payload out of a whole-config snapshot
(`getConfigSnapshotWithPromotables`) must **pick the slots the worker reads**
rather than drop the ones it doesn't: the snapshot carries every slot this base
schema declares too, so a subtractive payload turns a main-thread-only slot
added _here_ into a cache key in _that_ plugin, where nobody adding it would
look. See ARCHITECTURE.md
"[Pick the payload out of the snapshot](../../../../agent-docs/ARCHITECTURE.md#pick-the-payload-out-of-the-snapshot-never-subtract-from-it)".

## Scroll and height are hooks, not per-display policy

A display that scrolls its own canvas overrides `scrollableHeight`
(`TrackHeightMixin`) and gets the clamped `setScrollTop` plus the shrink-clamp
autorun. One that grows to its content overrides `growTargetHeight`
(`HeightModeMixin`) and gets `grownHeight`, the reactive `height`,
`setHeightMode` and the grow-aware `resizeHeight`. Neither hook may read the
reactive `height` getter — in grow mode it _is_ `grownHeight`, so that's a
computed cycle; read `fitTargetHeight`/`growMaxHeight`.

Hover belongs with them: `installClearHoverOnViewportChange` tracks all three
axes content can move on (`bpPerPx`, `offsetPx`, `scrollTop`), not just zoom.

## The two readiness axes — don't collapse them

`viewportWithinLoadedData` is spatial staleness, `layoutReady` is
does-a-layout-exist. Neither is derivable from the other. `dataCurrent` is not a
third — it is this family's answer to the one freshness name cross-cutting
consumers read. Paint readiness is a fourth thing and is `painted`
(`RenderLifecycleMixin`), which is what every consumer outside the display
wants; don't reintroduce a display-local `canvasDrawn && !isLoading`.

The loading scrim reads **neither axis directly except the first**: the phase
goes through `foundationDisplayPhase`, shared with the global family, and the
only thing this family supplies is `viewportWithinLoadedData` — every other term
(`loadingSuppressed`, `isLoadingOrCanceled`, `rendersCanvas`, `canvasDrawn`) is
read straight off the model by `computeLoadingTerm`, from `FetchMixin` /
`RenderLifecycleMixin`. Routing it through a display-local readiness getter
means re-remembering the cancel term alongside it — the right answer reached the
wrong way, one edit from the dead-Retry bug DISPLAYCHROME.md describes.

`layoutReady` exists because "laid out but off-display" and "no layout exists"
are different answers only the display can tell apart. Default `false` so a
missing override drops overlays rather than pinning them.

## Fetching

- **Don't hand-roll the fetch loop.** `fetchEachRegion` is the default;
  `fetchAllRegions` batches; `callEachRegion` is the fan-out only, for a display
  that must run something else under the same stop token or decide across
  regions before committing. Forgetting a `ctx.isStale()` guard is a stale-data
  write, which is why the first two own it.
- `bufferedVisibleRegions` carries `reversed` alongside the widened bounds and
  that is load-bearing — canvas stamps it onto its `rpcDataMap` entry. It went
  missing once with nothing catching it, since every unit test hands
  `setRpcData` a region by hand.
- `clearAllRpcData` deliberately leaves the too-large gate alone (derived,
  self-releasing) and keeps the cached estimate so the banner doesn't flicker.
- Displays on `GlobalFetchMixin` (LD, arc) call `byteGateBlocksFetch`
  themselves; `fetchRegions` already does.

`fetchLifecycle.test.ts` / `fetchAutorun.test.ts` use simplified shapes — check
the test helpers before assuming a field name matches the model.
