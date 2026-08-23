# BaseLinearDisplay fetch system

`FetchMixin` (stop tokens, staleness, `isLoading`) + `MultiRegionDisplayMixin`
(autoruns, `fetchRegions`, `loadedRegions`, overridable hooks). Status chrome is
`DisplayChrome.tsx` — `agent-docs/reference/DISPLAYCHROME.md`, adr-026.

**Two foundations, not three.** `GlobalFetchMixin` is the whole global family
now; `GlobalDataDisplayMixin` was deleted on 2026-08-23 and the reason it
existed — arc declining `RenderLifecycleMixin` — is in ARCHITECTURE.md's
"Display stacks". `installGlobalFetchAutorun` lives in its own file beside it.

**The fetch sequence itself is in core**, not here: `runFetchOnce` /
`installFetch` (`@jbrowse/core/util/installFetch`) own begin → clear the error →
run → commit-if-current → `handleFetchError` → end, plus the autorun over it.
`FetchMixin.runFetch` is the MST-flow wrapper that adds this family's observable
bookkeeping on top, and it is the only site that holds `runFetchOnce` directly —
it needs the flow (so a fetch autorun's synchronous prefix runs untracked) and a
rotation `cancelFetch` can reach.

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
and the gate still declines — the dead Retry button. Every fetch installer
installs them, `installFetch` included — a **secondary** fetch on a display
whose foundation already installed them passes no `contract` and skips both, or
the double-attach report fires on the fetch that is not the double. Opt out with
`fetchInert` if the display deliberately isn't fetching — the loading scrim and
the SVG export read the same hook (ADR-082). A two-stage `reload()` says
`awaitingPrerequisite` instead (HiC, whose contacts fetch declines until the
header lands; variants, until `sourcesBase` does), which **defers** the verdict
to the run after the prerequisite arrives rather than waiving it. Reports reach
the jest gate through `console.error`, so a harness replacing it opts itself
out; a test provoking a violation calls `takeContractReports()`.

Both flags are getters on `FetchMixin` — and `fetchInert` on
`SyntenyFetchStateMixin`, on `ChordVariantDisplay` and on the breakpoint split
view too, for the fetches that compose no mixin in common with these — declared
once per family and read off the node, not options an installer passes in,
because they describe the display rather than its autorun.

**A user cancel is durable, and the skeleton owns how durable.** No fetch
trigger un-cancels it: every installer reads `fetchCanceled` tracked, under
`reloadCounter` and above every gate. Both LGV families lapse it on a viewport
change (`ClearBlockingStateOnViewportChange` for per-region,
`ClearCancelOnViewportChange` for global); Retry lapses it everywhere. The
comparative family has the gate and not the lapse, on purpose — see
ARCHITECTURE.md's fetch-families table.

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

## A fetch input derived from the fetched data needs `dataSuperseded`

This family answers `dataCurrent` with SPATIAL coverage, so it cannot see a
settings-driven invalidation coming. The signature-compare families
(`GlobalFetchMixin`, synteny, dotplot, arc) can: any fetch input is in the
signature, so writing one makes `dataCurrent` false in the same tick.

That gap only bites when a fetch input is written from the data it fetched.
GWAS's LD auto-index is the case in the tree: the autorun adopts the loaded top
hit as `indexSnp`, which is in `rpcProps`, so the load that produced the value
is the load the write clears. `dataCurrent` still said "current" for the doomed
data, `awaitSvgReady` samples once, and the export painted the emptied map — a
Manhattan lane with the LD legend and no points, exit 0.

So a display that derives a fetch input from its own data fills `dataSuperseded`
(default `false`) with the condition its autorun writes under. Gate it on the
WRITE, not on whether the feature is visibly doing anything: `colorBy: 'ld'`
with no `ldAdapter` draws no colours but still writes the index, and gating on
the visible half left exactly the same empty export behind.

## Fetching

- **Don't hand-roll the fetch loop, and no display does any more.**
  `fetchEachRegion` (default), `fetchAllRegions` (one RPC, one result per
  region), `fetchRegionsBatched` (one RPC, one payload covering every region),
  `callEachRegion` (fan-out only, MAF's alone). The first three own the
  `ctx.isStale()` guard; forgetting it is a stale-data write. A batch-wide step
  after the regions land is `fetchEachRegion`'s `onComplete`, handed the gate
  state captured at issue and what the two canvas displays commit their DENSITY
  measurements from — that, not a second loop, is what a hand-rolled
  `Promise.all` was buying.
- **`loadedRegions` is written where the payload is stored**, through
  `ctx.commitRegion(displayedRegionIndex)` — the helpers above call it for you,
  and skip a region the worker refused for size (`isRegionRefused`). It takes an
  index and no span: `fetchRegions` resolves that against the regions it issued,
  so a fetch cannot claim a span it never asked for. The raw writer under it,
  `setLoadedRegion`, does take one — tests stage a loaded display with it, and
  production has no reason to. Marking a region loaded that holds nothing for
  that span is what froze canvas displays until a page reload:
  REGION_TOO_LARGE.md, and `RegionFetchContext`.
- `bufferedVisibleRegions` carries `reversed` alongside the widened bounds, and
  that is load-bearing — canvas stamps it onto `rpcDataMap`, and unit tests hand
  `setRpcData` a region by hand, so it went missing once uncaught.
- `clearAllRpcData` deliberately leaves the too-large gate and its cached
  estimate alone, so the banner doesn't flicker.
- **The byte gate is one line at the call and nothing else.** A display sets
  `gateEnabled` and passes `byteLimit: self.resolvedByteLimit()` in its fetch
  RPC's args; the RPC measures the index before it downloads and answers a
  `RegionTooLargeResult` in place of its payload when the region is over.
  `fetchEachRegion` / `fetchAllRegions` / `fetchRegionsBatched` commit that
  measurement (`commitFetchBytes`) and skip the store and `loadedRegions` for a
  refused region; `runGlobalFetch` does the same for the global family. There is
  no pre-flight estimate RPC and no display-side commit.
- The foundation's own tests come in two halves, and a change usually belongs in
  one of them rather than in a plugin's suite. `planRegionFetch.test.ts` is the
  **decision** — given these inputs, fetch this region set — and needs no tree.
  `installPerRegionFetchAutoruns.test.ts` and `fetchRegions.test.ts` are the
  **wiring**, on a real display in a real view (`perRegionTestEnv.ts`), because
  which reads MobX tracks is not something a pure function can state. Three
  earlier files tested transcriptions of the autoruns instead; deleting the
  half-screen prefetch buffer from production left all of them green. The wiring
  file's last block pins the whole dependency set per state through
  `reactionDependencies(display, 'FetchVisibleRegions')`
  (`@jbrowse/render-core/namedReactions`); a new tracked or untracked read
  belongs in those lists, and a read that changes them by accident is the
  finding.
