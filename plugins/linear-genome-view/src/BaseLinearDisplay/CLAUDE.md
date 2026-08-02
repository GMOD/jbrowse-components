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
  auto-chains lifecycle hooks, so calling it installs everything twice. Regular
  actions still use super-capture.
- **A super-captured view is called bare**, so a base must not reach siblings
  off `this`. Move the overridable view into its own later `.views()` block,
  placed after everything it reads.

## `isCacheValid` and `rpcProps` are views, not actions

MobX runs an action inside `untracked`, so declaring either in `.actions()`
makes its reads register no dependency and the caller silently keeps a stale
answer. It regresses quietly, because each caller independently reads something
that moves in lockstep — it has bitten twice. Pinned by a
`getMembers(display).actions` assertion per display family; add the same lines
for a new fetching display.

Only these two method-shaped hooks are exposed; a getter can't regress this way,
which is why the byte gate's opt-in is the `byteGateEnabled` getter.

**A `fetchNeeded` that declines to fetch must be woken by something the autorun
already tracks.** The coverage test short-circuits, so `isCacheValid`'s
observables may register no dependency — an early return _without_ fetching
breaks the wake chain and must supply its own.

Every field `rpcProps()` **returns** becomes a cache key, and only those.

## The three readiness axes — don't collapse them

`isReady` is render-lifecycle, `viewportWithinLoadedData` is spatial staleness,
`layoutReady` is does-a-layout-exist. A consumer can't derive the third from the
other two. `dataCurrent` is not a fourth — it is this family's answer to the one
freshness name cross-cutting consumers read.

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
