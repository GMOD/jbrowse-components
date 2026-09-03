# @jbrowse/display-kit

The display integration layer: the fetch foundations, the byte gate, the display
chrome, SVG export, and the `RegionHost` contract. No barrel; the `exports` map
is the API, pinned by `src/publicApi.test.ts`. The tests that need a real linear
genome view (`perRegionTestEnv.ts` and its six suites) live in
`plugins/linear-genome-view/src/displayKitTests/`, since this package sits below
that plugin.

`FetchMixin` (stop tokens, staleness, `isLoading`) + `MultiRegionDisplayMixin`
(autoruns, `fetchRegions`, `loadedRegions`, overridable hooks). Status chrome is
`DisplayChrome.tsx` — `agent-docs/reference/DISPLAYCHROME.md`, adr-026.

**Two LGV foundations, not three.** `GlobalFetchMixin` is the whole global
family now; `GlobalDataDisplayMixin` was deleted on 2026-08-23 and the reason it
existed — arc declining `RenderLifecycleMixin` — is in ARCHITECTURE.md's
"Display stacks". `installGlobalFetchAutorun` lives in its own file beside it.
`KeyedFetchMixin` is a layer under it, not a foundation: `FetchMixin` plus the
`currentFetchKey` / `loadedFetchKey` compare, split out on 2026-09 so the
comparative foundation (`ComparativeFetchMixin`, `@jbrowse/synteny-core`)
composes the same pair instead of restating it (ADR-105).

**The fetch sequence itself is in core**, not here: `runFetchOnce` /
`installFetch` (`@jbrowse/core/util/installFetch`) own begin → clear the error →
run → commit-if-current → `handleFetchError` → end, plus the autorun over it —
the leading edge, the unconditional `reloadCounter` read, the durable cancel
gate, the freshness gate with its reload epoch, and both contract checks.
`installGlobalFetchAutorun` is a declaration over that skeleton (its gates, its
signature as the freshness key, `FetchMixin`'s rotation lent through the
`rotation` option so `cancelFetch` reaches the fetch it installs), the same way
the comparative installer is. There is no on-demand entry beside it: the
single-shot one there used to be, for tests wanting one round trip, carried a
copy of the family's gates that drifted from the installed ones on three of four
terms, and a test that wants a fetch drives the installed autorun through the
view and waits for its RPC (`plugins/variants/src/LDDisplay/testEnv.ts`'s
`awaitFetch`). Gate behaviour is `installGlobalFetchAutorun.test.ts`'s. The
declaration takes `FetchMixin`'s begin/end/error trio from
`fetchMixinLifecycle`, which `runFetch` uses too. `FetchMixin.runFetch` is the
MST-flow wrapper the per-region family holds `runFetchOnce` through — it needs
the flow (so a fetch autorun's synchronous prefix runs untracked) because its
trigger is `planRegionFetch`'s autorun, not the skeleton's.

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
lint error, and `zoomFetchKey` needs no rule because MST throws on a getter
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
`ChordVariantDisplay` and on the breakpoint split view too, the two fetches that
compose no mixin in common with these — declared once and read off the node, not
options an installer passes in, because they describe the display rather than
its autorun.

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

## Read a scalar off the host, never rebuild its arrays per frame

`RegionHost.visibleRegions` rebuilds a fresh array of fresh objects on every pan
and zoom frame, so **any observer that reads it re-renders on every frame of
every gesture** — whatever it then derives. A component wanting a number out of
it wants the host to publish that number instead.

`contentRightEdgePx` is the worked example: the right edge a right-pinned
overlay pins to, clamped to the track. The clamp is the load-bearing half. An
unclamped edge moves every frame like the array did; `Math.min(trackWidthPx, …)`
is what makes the value repeat whenever content overflows the track — which is
most zooms — so MobX's `===` stops the chain at the computed. Publish it clamped
or publish nothing. `regionHost.ts` states the rule for both callers, because an
SVG export applies it against the export's canvas width rather than the view's.

`products/jbrowse-web/src/tests/ZoomRenderCensus.test.tsx` is how a per-frame
re-render like that gets seen at all; INTERACTION_PERF.md has the rest.

Where the value has to stay an array — a row list rebuilt from `rpcDataMap` on
every region arrival — `stableIdentityComputed` is what keeps its identity, for
the `!==` caches downstream (render-core `installUpload`'s encode cache). Both
multi-row families hold their `sourcesWithoutLayout` through it.

## A hit test's index needs an observer, or it is not memoized

A pointer handler runs untracked, so a computed whose only readers are
`featureAt` / `getHit` / `contextTargetAt` **has no observer — and MobX discards
an unobserved computed's value as it hands it over**. Every rAF-coalesced mouse
move then rebuilds it: a Hilbert-sorted Flatbush, a Map over every sample in the
callset, a row index over every loaded feature. The getter reads as memoized,
its doc usually says so, and nothing catches it — it typechecks and it tests
green. Five getters across three plugins were found doing it; two were worth
holding.

The fix is an `autorunOnReadyView` reading them bare, named `*HitIndexes`
(`CanvasHitIndexes`, `MultiRowHitIndexes`) so the set is greppable. Where the
read goes through a structural `self`, **type it with the getters' real types**,
not `unknown`: a rename otherwise reads `undefined`, establishes no dependency,
and leaves a keep-alive holding nothing.

**Only hold alive a getter whose dependencies exclude per-frame view geometry.**
This is the whole decision, and it inverts: subscribing moves the rebuild from
"the track under the cursor, while hovering" to "every such display, on every
change to its inputs". Canvas's `flatbushIndexes` is safe because it keys off
`laidOutDataMap` and the DEBOUNCED `coarseBpPerPx`. `laneFlatbushIndexes` in
plugin-variants is not, and says so at the getter: it walks `visibleRegions`
(see the section above), so holding it would have bought a per-pan-frame
Flatbush build on every variant track in the session. Give a getter canvas's
dependencies before giving it canvas's autorun.

The second precondition is that the getter is **safe to evaluate before data
lands**, which a hover-only getter has never had to be. `genotypeSampleIndex` in
plugin-variants fails it and says so at the getter: a keep-alive throws there
because suites stub the cell-data RPC with a catch-all `[]`, leaving `cellData`
truthy with no `sampleNames`, and the contract gate turns a reaction throw into
a failed suite. Fix the stubs first; the getter itself is fine.

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
supplies only the staleness argument: spatial coverage and `dataSuperseded`,
which is what puts a scrim over data a settled fetch-input change is already
drawing wrong. It is NOT `dataCurrent` — the export gate takes that one, and its
`isCacheValid` term would raise the scrim 250 ms into every zoom
(REJECTED_IDEAS.md "Folding content staleness into `displayPhase`").
`computeLoadingTerm` reads every other term off the model. Routing it through a
display-local getter means re-remembering the cancel term — one edit from the
dead-Retry bug.

## `dataSuperseded` covers what `regionFetchKey` cannot state

The per-region family answers `dataCurrent` with spatial coverage AND
`isCacheValid` per visible block, so the foundation owns one staleness compare
for every display: the key a region was fetched under against the key a fetch
now would use. The global family gets that answer from the signature, where
every fetch input is a term (the compare inside `dataCurrent`, which is also its
fetch gate); synteny and dotplot from theirs.

`dataSuperseded` (default `false`, declared on `MultiRegionDisplayMixin` and
`KeyedFetchMixin` and folded into `dataCurrent` and never into the fetch gate)
is the remainder — staleness a key is structurally blind to. Three shapes in the
tree, and all are invisible on screen, which is exactly why they need stating.

**A fetch input written from the data it fetched.** GWAS's LD auto-index is the
case: the autorun adopts the loaded top hit as `indexSnp`, which is in
`rpcProps`, so the load that produced the value is the load the write clears.
The key cannot see it coming, nothing having moved yet, so `dataCurrent` said
"current" for the doomed data, `awaitSvgReady` samples once, and the export
painted the emptied map — a Manhattan lane with the LD legend and no points,
exit 0. Fill the hook with the condition the autorun writes under, and gate it
on the WRITE, not on whether the feature is visibly doing anything:
`colorBy: 'ld'` with no `ldAdapter` draws no colours but still writes the index,
and gating on the visible half left exactly the same empty export behind.

**A dependent fetch of the display's own.** Multi-way synteny fetches lane genes
and lane links off the lane frames its ortholog fetch produced, so the signature
is current the moment the ortholog data commits while the lanes are still empty.
Each lane fetch stamps its key on the display (`loadedKey`), and the hook is
"specs exist and the stamp is not the current key" — which a lane fetch always
clears, since one failed lane drops out of an otherwise committed map.

**A live window ahead of a debounced key.** Alignments' `perBaseBinBp` reads
`subPixelBinBp` off the 500ms-debounced `coarseBpPerPx`, and the stamp beside a
loaded region IS that settled bin — so stamp and key agree by construction for
the whole debounce, while the wall on screen is already several octaves coarser
than the zoom it is drawn at. The hook is `perBaseBinBp !== livePerBaseBinBp`.

**A value compare, never a second spelling of the key.** The foundation runs the
stamp-vs-key compare already, so an override restating it buys nothing: a second
derivation of the key's vocabulary reads `"16|fine"` against a live `"16"` the
day the key grows an axis, latches `dataSuperseded` true, and every export of
that display waits out `awaitSvgReady`'s backstop instead of failing.

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
- **The first refusal ends a `fetchEachRegion` batch**, because the gate is a
  display-wide max: no sibling can change a refusal and none is drawn under the
  banner. The two rules that makes the batch owe — commit at most once, and
  commit before cancelling — are `gateBatch`'s, not a runner's to remember;
  `refuse()` and `settle()` are the whole surface. Why each rule exists, and
  what it cost to get wrong, is at `gateBatch` and in REGION_TOO_LARGE.md.
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
  refused region; `installGlobalFetchAutorun`'s shared commit does the same for
  the global family. No display issues a pre-flight estimate RPC, and there is
  no display-side commit.
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
