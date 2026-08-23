# BaseLinearDisplay fetch system

`FetchMixin` (stop tokens, staleness, `isLoading`) + `MultiRegionDisplayMixin`
(autoruns, `fetchRegions`, `loadedRegions`, overridable hooks). Status chrome is
`DisplayChrome.tsx` — `agent-docs/reference/DISPLAYCHROME.md`, adr-026.

The composition and fetch rules a display must not break are in
`agent-docs/ARCHITECTURE.md` ("What not to do"): mixin order, `afterAttach`
super-chaining, `rpcProps`/`regionHasData` in `.actions()`, the `rpcProps()`
loop trap, picking the payload out of a snapshot, unconditional trigger reads.
What follows is local.

## Attach

- **Never read `view.width` / `dynamicBlocks` synchronously in an `afterAttach`
  body** — they throw before init by design, and the session loader misreads the
  escaping error as an invalid track and drops it. Use `autorunOnReadyView`.
- **A super-captured view is called bare**, so a base must not reach siblings
  off `this`. Move the overridable view into its own later `.views()` block.

## Contract checks

`no-restricted-syntax` covers the three method-shaped hooks — declaring
`rpcProps`, `regionHasData` or `isCacheValid` inside an `.actions(…)` block is a
lint error, and `regionFetchKey` needs no rule because MST throws on a getter
declared inside `.actions()`. `assertDisplayContract` is what stayed a runtime
check: it reports a fetch foundation whose `afterAttach` ran twice on one
display, which no spelling in one file predicts. `makeRetryContractCheck` is the
same idea for retry: it reports when a `reloadCounter` bump re-runs the autorun
and the gate still declines — the dead Retry button. All three fetch installers
install it. Opt out with `fetchInert` if the display deliberately isn't fetching
— the loading scrim and the SVG export read the same hook (ADR-082). A two-stage
`reload()` says `awaitingPrerequisite` instead (HiC, whose contacts fetch
declines until the header lands; variants, until `sourcesBase` does), which
**defers** the verdict to the run after the prerequisite arrives rather than
waiving it. Reports reach the jest gate through `console.error`, so a harness
replacing it opts itself out; a test provoking a violation calls
`takeContractReports()`.

Both flags are getters on `FetchMixin` — and `fetchInert` on
`SyntenyFetchStateMixin` too, for the family that composes no mixin in common
with these — declared once per family and read off the node, not options an
installer passes in, because they describe the display rather than its autorun.

**A predicate has to be strictly narrower than the gate it explains.** One that
restates the gate's negation makes every decline a deferred one, so no run is
ever judged and the display has opted out — HiC is in that shape deliberately,
and `LinearHicDisplay/infoFetchFailure.test.ts` is what covers its retry
instead.

This family has no `prepare()` to ask, so the classification is: `needed` empty
is the decline, and reaching `FetchMixin.runFetch` is the fetch. Every
`fetchNeeded` override gets there in its synchronous prefix, which is what makes
that readable without awaiting the override. A new override that awaits first
gets a false report, not silence.

A fetch also answers the retry by itself, from `runFetch`, because a `reload()`
can reach one with no autorun run in between — canvas's clears and calls
`fetchNeeded` directly rather than waiting out the 600ms debounce, and by the
time the autorun runs the blocks are covered.

**`reloadCounter` is the whole arming mechanism, and MST replaces an action
outright.** A `reload()` override that neither bumps it nor chains to a captured
`superReload()` turns the check off for its display, silently — canvas did, for
`LinearBasicDisplay` and `LinearVariantDisplay` both.
`reloadReachesCounter.test.ts` reads every `reload()` in the tree.

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
- **`loadedRegions` is written where the payload is stored**, through
  `ctx.commitRegion(displayedRegionIndex)` — the two helpers above call it for
  you, and skip a region the worker refused for size (`isRegionRefused`). A
  display calling `fetchRegions` directly puts the call beside its own store. It
  takes an index and no span: `fetchRegions` resolves that against the regions
  it issued, so a fetch cannot claim a span it never asked for. The raw writer
  under it, `setLoadedRegion`, does take one — tests stage a loaded display with
  it, and production has no reason to. Marking a region loaded that holds
  nothing for that span is what froze canvas displays until a page reload:
  REGION_TOO_LARGE.md, and `RegionFetchContext`.
- `bufferedVisibleRegions` carries `reversed` alongside the widened bounds, and
  that is load-bearing — canvas stamps it onto `rpcDataMap`, and unit tests hand
  `setRpcData` a region by hand, so it went missing once uncaught.
- `clearAllRpcData` deliberately leaves the too-large gate and its cached
  estimate alone, so the banner doesn't flicker.
- No display calls `byteGateBlocksFetch` by hand: `fetchRegions` runs it for the
  per-region family and `runGlobalFetch` for the global one, and it is a no-op
  for a display that has not opted in.
- The foundation's own tests come in two halves, and a change usually belongs in
  one of them rather than in a plugin's suite. `planRegionFetch.test.ts` is the
  **decision** — given these inputs, fetch this region set — and needs no tree.
  `installPerRegionFetchAutoruns.test.ts` and `fetchRegions.test.ts` are the
  **wiring**, on a real display in a real view (`perRegionTestEnv.ts`), because
  which reads MobX tracks is not something a pure function can state. Three
  earlier files tested transcriptions of the autoruns instead; deleting the
  half-screen prefetch buffer from production left all of them green.
