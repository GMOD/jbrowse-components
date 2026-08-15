# BaseLinearDisplay fetch system

`FetchMixin` (stop tokens, staleness, `isLoading`) + `MultiRegionDisplayMixin`
(autoruns, `fetchRegions`, `loadedRegions`, overridable hooks). Status chrome is
`DisplayChrome.tsx` — see `agent-docs/reference/DISPLAYCHROME.md` and adr-026.

## Lifecycle traps

- **Never read `view.width`/`dynamicBlocks`-style getters synchronously in an
  `afterAttach` body.** Before init they throw by design, and the session loader
  misreads the escaping error as an invalid track and drops it. Use
  `autorunOnReadyView`.
- **A display's own `afterAttach` must not `superAfterAttach()`.** Our MST fork
  auto-chains lifecycle hooks. Regular actions still use super-capture.
- **`HeightModeMixin()` composes after `TrackHeightMixin()`**, whose `height`
  and `resizeHeight` it overrides. Checked at attach via `supportsHeightModes`,
  since the two `height` getters agree in fixed mode and no value can tell the
  orders apart.
- **A super-captured view is called bare**, so a base must not reach siblings
  off `this`. Move the overridable view into its own later `.views()` block.

## `isCacheValid` and `rpcProps` are views, not actions

MobX runs an action inside `untracked`, so declaring either in `.actions()`
makes its reads register no dependency and the caller silently keeps a stale
answer. It has bitten twice. `assertDisplayContract` checks it in dev for every
display composing the mixin.

Only these two method-shaped hooks are exposed; a getter can't regress this way,
which is why the byte gate's opt-in is the `measuresBytesPreFlight` getter.

`makeRetryContractCheck` is the same idea for the retry contract: it reports
when a `reloadCounter` bump re-runs the autorun and the display's gate still
declines — the dead Retry button arc. Exempt yourself with `loadingSuppressed`
if the display is deliberately not fetching. These reports reach a jest gate
through `console.error`, so a harness that replaces it takes itself out of the
gate; a test that provokes a violation on purpose calls
`takeDisplayContractReports()`.

**A `fetchNeeded` that declines to fetch must be woken by something the autorun
already tracks.** The coverage test short-circuits, so `isCacheValid`'s
observables may register no dependency.

Every field `rpcProps()` **returns** becomes a cache key, and only those. So a
display building the payload from a whole-config snapshot must **pick the slots
the worker reads** rather than drop the ones it doesn't — the snapshot carries
every slot this base schema declares, so a subtractive payload turns a
main-thread-only slot added _here_ into a cache key in _that_ plugin. See
ARCHITECTURE.md
"[Pick the payload out of the snapshot](../../../../agent-docs/ARCHITECTURE.md#pick-the-payload-out-of-the-snapshot-never-subtract-from-it)".

## Scroll and height are hooks, not per-display policy

A display that scrolls its own canvas overrides `scrollableHeight`; one that
grows to its content overrides `growTargetHeight`. Neither hook may read the
reactive `height` getter — in grow mode it _is_ `grownHeight`, so that's a
computed cycle; read `fitTargetHeight`/`growMaxHeight`.

Hover belongs with them: `installClearHoverOnViewportChange` tracks all three
axes content can move on (`bpPerPx`, `offsetPx`, `scrollTop`), not just zoom.

## The two readiness axes — don't collapse them

`viewportWithinLoadedData` is spatial staleness, `layoutReady` is
does-a-layout-exist; neither is derivable from the other. `dataCurrent` is this
family's answer to the one freshness name cross-cutting consumers read. Paint
readiness is a fourth thing and is `painted` (`RenderLifecycleMixin`), which is
what every consumer outside the display wants, in place of a display-local
`canvasDrawn && !isLoading`.

The loading scrim goes through `foundationDisplayPhase`, and the only thing this
family supplies is `viewportWithinLoadedData`; every other term is read straight
off the model by `computeLoadingTerm`. Routing it through a display-local
readiness getter means re-remembering the cancel term alongside it — one edit
from the dead-Retry bug.

`layoutReady` exists because "laid out but off-display" and "no layout exists"
are different answers only the display can tell apart. Default `false` so a
missing override drops overlays rather than pinning them.

## Fetching

- **Don't hand-roll the fetch loop.** `fetchEachRegion` is the default;
  `fetchAllRegions` batches; `callEachRegion` is the fan-out only, for a display
  that must run something else under the same stop token. Forgetting a
  `ctx.isStale()` guard is a stale-data write, which is why the first two own
  it.
- `bufferedVisibleRegions` carries `reversed` alongside the widened bounds and
  that is load-bearing — canvas stamps it onto its `rpcDataMap` entry, and every
  unit test hands `setRpcData` a region by hand, so it went missing once
  uncaught.
- `clearAllRpcData` deliberately leaves the too-large gate alone and keeps the
  cached estimate so the banner doesn't flicker.
- Displays on `GlobalFetchMixin` (LD, arc) call `byteGateBlocksFetch`
  themselves; `fetchRegions` already does.

`fetchLifecycle.test.ts` / `fetchAutorun.test.ts` use simplified shapes — check
the test helpers before assuming a field name matches the model.
