# BaseLinearDisplay fetch system

`FetchMixin` (stop tokens, staleness, `isLoading`) + `MultiRegionDisplayMixin`
(autoruns, `fetchRegions`, `loadedRegions`, overridable hooks). Status chrome is
`DisplayChrome.tsx` — `agent-docs/reference/DISPLAYCHROME.md`, adr-026.

The composition and fetch rules a display must not break are in
`agent-docs/ARCHITECTURE.md` ("What not to do"): mixin order, `afterAttach`
super-chaining, `rpcProps`/`isCacheValid` in `.actions()`, the `rpcProps()` loop
trap, picking the payload out of a snapshot, unconditional trigger reads. What
follows is local.

## Attach

- **Never read `view.width` / `dynamicBlocks` synchronously in an `afterAttach`
  body** — they throw before init by design, and the session loader misreads the
  escaping error as an invalid track and drops it. Use `autorunOnReadyView`.
- **A super-captured view is called bare**, so a base must not reach siblings
  off `this`. Move the overridable view into its own later `.views()` block.

## Contract checks

`assertDisplayContract` covers the two method-shaped hooks in dev.
`makeRetryContractCheck` is the same idea for retry: it reports when a
`reloadCounter` bump re-runs the autorun and the gate still declines — the dead
Retry button. Opt out with `loadingSuppressed` if the display deliberately isn't
fetching. A two-stage `reload()` says `awaitingPrerequisite` instead (HiC, whose
contacts fetch declines until the header lands), which **defers** the verdict to
the run after the prerequisite arrives rather than waiving it. Reports reach the
jest gate through `console.error`, so a harness replacing it opts itself out; a
test provoking a violation calls `takeDisplayContractReports()`.

**Everything the check reads, it reads `untracked`** — it runs inside the fetch
autorun, so a tracked read puts that observable in the autorun's dependency set
in dev and not in the production build, where the whole check is stripped. That
is a display whose fetch re-fires only in development. One test per observable
the check reads pins it, at the bottom of `installGlobalFetchAutorun.test.ts`.

## Height and scroll are hooks

A display that scrolls its own canvas overrides `scrollableHeight`; one that
grows to content overrides `growTargetHeight`. **Neither may read the reactive
`height` getter** — in grow mode it _is_ `grownHeight`, a computed cycle. Read
`fitTargetHeight` / `growMaxHeight`.

## Four readiness axes — don't collapse them

`viewportWithinLoadedData` (spatial staleness), `layoutReady` (does a layout
exist — default `false` so a missing override drops overlays rather than pinning
them), `dataCurrent` (the cross-cutting freshness name), and `painted`
(`RenderLifecycleMixin`), which is what consumers outside the display want.

The loading scrim goes through `foundationDisplayPhase`, and this family
supplies only `viewportWithinLoadedData`; `computeLoadingTerm` reads every other
term off the model. Routing it through a display-local getter means
re-remembering the cancel term — one edit from the dead-Retry bug.

## Fetching

- **Don't hand-roll the fetch loop.** `fetchEachRegion` (default),
  `fetchAllRegions` (batched), `callEachRegion` (fan-out only). The first two
  own the `ctx.isStale()` guard; forgetting it is a stale-data write.
- `bufferedVisibleRegions` carries `reversed` alongside the widened bounds, and
  that is load-bearing — canvas stamps it onto `rpcDataMap`, and unit tests hand
  `setRpcData` a region by hand, so it went missing once uncaught.
- `clearAllRpcData` deliberately leaves the too-large gate and its cached
  estimate alone, so the banner doesn't flicker.
- Displays on `GlobalFetchMixin` (LD, arc) call `byteGateBlocksFetch`
  themselves; `fetchRegions` already does.
- `fetchLifecycle.test.ts` / `fetchAutorun.test.ts` use simplified shapes —
  check the helpers before assuming a field name matches the model.
