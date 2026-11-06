---
name: display-kit
description: How does display-kit attach a display — contract checks, host scalars, hit-test memoization, height and scroll hooks, the four readiness axes and the fetch runners?
kind: spec
---

# @jbrowse/display-kit

Bare paths below are relative to `packages/display-kit/`. The stacks and hook
table are in [DISPLAY_PIPELINE.md](DISPLAY_PIPELINE.md#display-stacks) and
[DISPLAY_HOOKS.md](DISPLAY_HOOKS.md); this doc is the behavior behind them.

## Attach

- **Never read `view.width` / `dynamicBlocks` synchronously in an `afterAttach`
  body.** They throw before init by design, and the session loader misreads the
  escaping error as an invalid track and drops it. Use `autorunOnReadyView`.
- **A super-captured view is called bare**, so a base must not reach siblings
  off `this`. Move the overridable view into its own later `.views()` block.

## Contract checks

`no-restricted-syntax` covers the four method-shaped hooks (`rpcProps`,
`zoomFetchArgs`, `regionHasData`, `isCacheValid` declared in `.actions()`).
Two dev-only runtime checks remain, both reporting through `console.error`:

- `assertDisplayContract` reports a fetch foundation whose `afterAttach` ran
  twice on one display, which no spelling in one file predicts.
- `makeRetryContractCheck` reports when a `reloadCounter` bump re-runs the
  autorun and the gate still declines: the dead Retry button.

Every fetch installer installs them, `installFetch` included. A **secondary**
fetch on a display whose foundation already installed them passes no `contract`
and skips both, or the double-attach report fires on the fetch that is not the
double. A harness replacing `console.error` opts itself out; a test provoking a
violation calls `takeContractReports()`.

Opting out of the retry check:

- `fetchInert` for a display that deliberately isn't fetching. The loading scrim
  and the SVG export read the same hook
  ([ADR-082](../architecture-decision-records/adr-082-one-hook-for-a-display-that-will-not-fetch.md)).
- `awaitingPrerequisite` for a two-stage `reload()` (HiC's contacts wait for the
  header, variants for `sourcesBase`). It **defers** the verdict to the run
  after the prerequisite arrives and does not waive it, so the predicate has to
  be strictly narrower than the gate it explains. One that restates the gate's
  negation makes every decline a deferred one and the display has opted out;
  HiC is in that shape deliberately, covered by
  `LinearHicDisplay/infoFetchFailure.test.ts` instead.

Both flags are getters on `FetchMixin`, declared once and read off the node
rather than passed as installer options, because they describe the display and
not its autorun. `ChordVariantDisplay` and the breakpoint split view declare
`fetchInert` too: they compose no mixin in common with these.

**A user cancel is durable, and the skeleton owns how durable.** No fetch
trigger un-cancels it: every installer reads `fetchCanceled` tracked, under
`reloadCounter` and above every gate. Both LGV families lapse it on a viewport
change (`ClearBlockingStateOnViewportChange` per-region,
`ClearCancelOnViewportChange` global); Retry lapses it everywhere. The
comparative family has the gate and not the lapse, on purpose; the reason is in
`installComparativeFetchAutorun`'s docstring.

This family has no `prepare()` to ask, so the retry classification is: `needed`
empty is the decline, and reaching `FetchMixin.runFetch` is the fetch. Every
`fetchNeeded` override gets there in its synchronous prefix; an override that
awaits first gets a false report, not silence. `runFetch` also answers the retry
by itself, because a `reload()` can reach a fetch with no autorun run in
between (the feature display's clears and calls `fetchNeeded` directly).

**`reloadCounter` is the whole arming mechanism, and MST replaces an action
outright.** A `reload()` override that neither bumps it nor chains to a captured
`superReload()` turns the check off for its display, silently.
`reloadReachesCounter.test.ts` reads every `reload()` in the tree.

**The check reads everything `untracked`.** It runs inside the fetch autorun, so
a tracked read would join the dependency set in dev and not in production,
where the check is stripped: a fetch that re-fires only in development. One test
per observable the check reads pins it, at the bottom of
`installGlobalFetchAutorun.test.ts`.

## Read a scalar off the host, never rebuild its arrays per frame

`RegionHost.visibleRegions` rebuilds a fresh array of fresh objects on every pan
and zoom frame, so **any observer that reads it re-renders on every frame of
every gesture**, whatever it then derives. A component wanting a number out of
it wants the host to publish that number.

`contentRightEdgePx` is the worked example: the right edge a right-pinned overlay
pins to, clamped to the track. The clamp is the load-bearing half. An unclamped
edge moves every frame like the array did; `Math.min(trackWidthPx, …)` makes
the value repeat whenever content overflows the track, so MobX's `===` stops the
chain at the computed. Publish it clamped or publish nothing. `regionHost.ts`
states the rule for both callers; an SVG export applies it against the export's
canvas width rather than the view's.

`products/jbrowse-web/src/tests/ZoomRenderCensus.test.tsx` is how a per-frame
re-render gets seen at all; [INTERACTION_PERF.md](INTERACTION_PERF.md) has the
rest.

Where the value has to stay an array, such as a row list rebuilt from
`rpcDataMap` on every region arrival, `stableIdentityComputed` keeps its
identity for the `!==` caches downstream (render-core's `createEncodeMemo`). The
mark display holds its `discoveredRows` through it.

## A hit test's index needs an observer, or it is not memoized

A pointer handler runs untracked, so a computed whose only readers are
`featureAt` / `getHit` **has no observer, and MobX discards an unobserved
computed's value as it hands it over**. Every rAF-coalesced mouse move then
rebuilds it: a Hilbert-sorted Flatbush, a Map over every sample, a row index
over every loaded feature. The getter reads as memoized, its doc usually says
so, and it typechecks and tests green.

The fix is an `autorunOnReadyView` reading the getters bare, named `*HitIndexes`
(`FeatureHitIndexes`, `RecordsHitIndexes`) so the set is greppable. Where the
read goes through a structural `self`, type it with the getters' real types, not
`unknown`: a rename otherwise reads `undefined`, establishes no dependency, and
leaves a keep-alive holding nothing.

**Only hold alive a getter whose dependencies exclude per-frame view geometry.**
Subscribing moves the rebuild from "the track under the cursor, while hovering"
to "every such display, on every change to its inputs". The feature display's
`flatbushIndexes` is safe because it keys off `laidOutDataMap` and the throttled
`coarseBpPerPx`. A getter that walks `visibleRegions` is not (see the previous
section): holding it buys a per-pan-frame index build on every such track in the
session. Give a getter the feature display's dependencies before giving it the
feature display's autorun.

The getter must also be **safe to evaluate before data lands**, which a
hover-only getter has never had to be. plugin-variants' `genotypeSampleIndex`
fails it and is left unheld: a keep-alive throws on suites that stub the
cell-data RPC with a catch-all `[]`, leaving `cellData` truthy with no
`sampleNames`, and the contract gate turns a reaction throw into a failed suite.
Fix the stubs first.

## Height and scroll are hooks

A display that scrolls its own canvas overrides `scrollContentHeight` and
`scrollViewportHeight`, and hands itself to `ScrollChrome` and the wheel hook;
one that grows to content overrides `growTargetHeight`. **`growTargetHeight` may
not read the reactive `height` getter**: in grow mode it _is_ `grownHeight`, a
computed cycle. Read `fitTargetHeight` / `growMaxHeight`.

## Four readiness axes — don't collapse them

- `viewportWithinLoadedData`: spatial staleness.
- `layoutReady`: does a layout exist. Default `false`, so a missing override
  drops overlays rather than pinning them.
- `dataCurrent`: the cross-cutting freshness name.
- `painted` (`RenderLifecycleMixin`): what consumers outside the display want.

The loading scrim goes through `foundationDisplayPhase`, and this family
supplies only the staleness argument: spatial coverage and `dataSuperseded`.
It is not `dataCurrent`, which the export gate takes
([why](FETCH_KEYS.md#export-gate-not-scrim)). `computeActivityPhase` reads every
other term off the model; routing it through a display-local getter means
re-remembering the cancel term, one edit from the dead-Retry bug.

## `dataSuperseded` covers what `fetchInputs` cannot state

The per-region family answers `dataCurrent` with spatial coverage and
`isCacheValid` per visible block: one staleness compare for every display, the
key a region was fetched under against the key a fetch now would use. The global
family gets it from the signature, where every fetch input is a term (the
compare inside `dataCurrent`, which is also its fetch gate); synteny and dotplot
from theirs.

`dataSuperseded` (default `false`, declared on `MultiRegionDisplayMixin` and
`KeyedFetchMixin`) is folded into `dataCurrent` and never into the fetch gate.
It is the remainder: staleness a key is structurally blind to. All three shapes
are invisible on screen, which is why they need stating.

**A fetch input written from the data it fetched.** GWAS's LD auto-index adopts
the loaded top hit as `indexSnp`, which is in `rpcProps`, so the load that
produced the value is the load the write clears. The key cannot see it coming,
so `dataCurrent` says "current" for the doomed data, `awaitSvgReady` samples
once, and the export paints the emptied map. Fill the hook with the condition
the autorun writes under, and gate it on the write, not on whether the feature
is visibly doing anything: a gate on the visible half leaves the same empty
export wherever the write happens without it.

**A dependent fetch of the display's own.** Multi-way synteny fetches lane genes
and links off the lane frames its ortholog fetch produced, so the signature is
current the moment the ortholog data commits while the lanes are still empty.
Each lane fetch stamps its key on the display (`loadedKey`), and the hook is
"specs exist and the stamp is not the current key", which a lane fetch always
clears, since one failed lane drops out of an otherwise committed map.

**A live window ahead of a throttled input.** Alignments' `perBaseBinBp` reads
`subPixelBinBp` off the 500ms-throttled `coarseBpPerPx`, and the stamp beside a
loaded region is that settled bin, so stamp and `zoomFetchArgs` agree for the
whole throttle while the wall on screen is already several octaves coarser than
its zoom. The hook is `perBaseBinBp !== livePerBaseBinBp`.

**Compare values, and never restate the zoom tier.** The foundation compares
the stamp against `zoomFetchArgs` already; a second derivation misses the field
the args gain next, latches `dataSuperseded` true, and every export of that
display waits out `awaitSvgReady`'s backstop instead of failing.

## Fetching

- **Don't hand-roll the fetch loop.** `fetchEachRegion` (default),
  `fetchAllRegions` (one RPC per genome, one result per region),
  `fetchRegionsBatched` (one RPC, one payload covering every region),
  `callEachRegion` (fan-out only, MAF's alone). The first three own the
  `ctx.isStale()` guard; forgetting it is a stale-data write. A batch-wide step
  after the regions land is `fetchEachRegion`'s `onComplete`, handed the gate
  state captured at issue; the two feature displays commit their density
  measurements from it.
- **The first refusal ends a `fetchEachRegion` batch**, because the gate is a
  display-wide max: no sibling can change a refusal and none is drawn under the
  banner. The two rules the batch owes, commit at most once and commit before
  cancelling, are `gateBatch`'s; `refuse()` and `settle()` are the whole
  surface. The reasons are at `gateBatch` and in
  [REGION_TOO_LARGE.md](REGION_TOO_LARGE.md#how-the-verdict-is-built). The other
  two runners are granular in what they asked for, so their refusal is the
  payload and the result set respectively. `fetchAllRegions` has no gated
  display; which granularity a gated one should want is the open call in
  `ideas/waiting-on-a-call/per-region-banner-for-a-mixed-region-set.md`.
- **`loadedRegions` is written where the payload is stored**, through
  `ctx.commitRegion(displayedRegionIndex)`. The runners call it and skip a region
  the worker refused for size (`isRegionRefused`). It takes an index and no span:
  `fetchRegions` resolves that against the regions it issued, so a fetch cannot
  claim a span it never asked for. The raw writer, `setLoadedRegion`, takes one;
  tests stage a loaded display with it and production has no reason to. Marking
  a region loaded that holds nothing for that span freezes feature displays
  until a page reload (`RegionFetchContext`).
- **A fetch reads the host's lists through `onTrackAssembly`**
  (`foundationView.ts`). A view can show genomes the track does not have, such
  as a two-genome circle, and keeps their blocks so the track draws blank there.
  A site that fetches from `visibleRegions`, `staticBlocks` or `dynamicBlocks`
  filters them: another genome's regions in one request throw, and one alone
  reads this track's file for the wrong genome. A cover check filters the same
  way, or the other genome is never covered and every commit refetches.
- `bufferedVisibleRegions` carries `reversed` with the widened bounds. Canvas
  stamps it onto `rpcDataMap`, and a unit test that hands `setRpcData` a region
  by hand must include it.
- `clearAllRpcData` deliberately leaves the too-large gate and its cached
  estimate alone, so the banner doesn't flicker.
- **The byte gate is one line at the call**: `gateEnabled` and
  `byteLimit: self.resolvedByteLimit()` in the fetch RPC's args
  ([REGION_TOO_LARGE.md](REGION_TOO_LARGE.md)). The three runners commit the
  measurement (`commitFetchBytes`) and skip the store and `loadedRegions` for a
  refused region; `installGlobalFetchAutorun`'s shared commit does the same.
- **A commit site reads `measuredBytes` and `measurementPartial` as a pair**,
  because a fan-out that stopped at its first refusal reports the max over
  whichever regions won the race, and `nextByteEstimate` must not read that as
  evidence about zoom. `fetchEachRegion` derives the claim from its own landed
  count; a runner handed one payload reads it off the result, which is how MAF's
  two tiers report their `refusalScope` abort.
- **Both gate axes clear on one trigger.** `RegionTooLargeMixin`'s
  `ClearGateMeasurementsOnNavOrTierSwap` drops the byte estimate and calls
  `clearGateMeasurements`, the hook `FeatureGateMixin` fills with its density
  counts. Two autoruns on two trigger lists let the density axis survive an
  adapter re-point the byte axis dropped.
- **The foundation's tests come in two halves.** `planRegionFetch.test.ts` is
  the decision (given these inputs, fetch this region set) and needs no tree.
  `installPerRegionFetchAutoruns.test.ts` and `fetchRegions.test.ts`, in
  `plugins/linear-genome-view/src/displayKitTests/`, are the wiring, on a real
  display in a real view (`perRegionTestEnv.ts`), because which reads MobX tracks
  is not something a pure function can state. The wiring file's last block pins
  the whole dependency set per state through
  `reactionDependencies(display, 'FetchVisibleRegions')`
  (`@jbrowse/render-core/namedReactions`); a new tracked or untracked read
  belongs in those lists, and a read that changes them by accident is the
  finding.
