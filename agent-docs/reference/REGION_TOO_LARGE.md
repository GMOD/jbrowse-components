---
name: region-too-large
description: The byte/density gate that raises the "region too large" banner and holds off the fetch — the derived getter, the shared verdict primitives, and the one measurement path every gated feature RPC runs as its first await. Read when touching fetch gating or the too-large banner.
---

# The region-too-large gate

You load `chr1:1-1,000,000`. Before fetching, we ask the adapter roughly how many
bytes that region would download. Over the limit → skip the fetch, show the
"region too large" banner. Under → fetch normally. For tabix the estimate is just
an index lookup (a byte range in the file), so it is free.

There is a second gate on the same banner: canvas also blocks regions with too
many *features* to draw, even when the byte count is fine. Same machinery,
different axis (`densityTooLarge`).

**The naming law, since the gate has a lot of members:** a `byte`/`density`
prefix means the term is genuinely about that axis, and nothing else carries one.
So the shared question — "may the gate act at all right now?" — is `gateActive`,
the exemption is `gateExempt`, and a per-axis question is `gateActive` plus that
axis's own terms.

| Code | Path |
| --- | --- |
| `RegionTooLargeMixin` (derived gate, byte axis, worker byte budget) | `plugins/linear-genome-view/src/shared/RegionTooLargeMixin.ts` |
| Shared verdict primitives | `plugins/linear-genome-view/src/shared/regionTooLargeUtils.ts` |
| Budget vocabulary, and the in-fetch measurement every gated RPC runs | `packages/core/src/rpc/byteBudget.ts` |
| Adapter estimate | `BaseFeatureDataAdapter.getRegionByteSize` |
| The byte-commit the fan-out helpers make | `commitFetchBytes`, `RegionTooLargeMixin.ts` |
| `CanvasFeatureGateMixin` (density axis) | `plugins/canvas/src/shared/CanvasFeatureGateMixin.ts` |
| MAF's private bound on the `mafFrames` overlay | `framesReadOverBudget`, `plugins/maf/src/LinearMafDisplay/fetchMafData.ts` |
| The save dialog's own size check, not the gate | `CoreGetRegionByteEstimate` + `fetchTrackData.ts` + `BaseTrackModel.exportByteLimit` |

Tests: `regionTooLargeUtils.test.ts` for the shared primitives, a
`derivedRegionTooLarge.test.ts` per gated display, the three fan-out helpers'
own files (`fetchEachRegion.test.ts`, `fetchAllRegions.test.ts`,
`fetchRegionsBatched.test.ts`) for the commit and the refusal skip, and a "the
gate opt-in survives the display composition order" pin in
`plugins/canvas/src/LinearBasicDisplay/fetchAutorun.test.ts` and
`plugins/canvas/src/LinearMultiRowFeatureDisplay/derivedRegionTooLarge.test.ts`.

**How many states this actually has**, since the member list above reads as a
lot of them: `gateTruthTable.test.ts` crosses every leaf against boundary values
for span, adapter limit and bytes — 67,200 rows — and its golden file records
what they collapse to.

    67,200 rows  →  73 internal  →  32 observable  →  7 banner-facing

The 73 is the count with every intermediate getter named, which is what makes
the golden a tripwire. What a *consumer* can tell apart is 32, and 25 of those
are the worker budget's five values riding along. **The gate has 7 outward
states**: not gated; gated on bytes, times whether zoom can release it, times
whether a re-measure is still owed; and gated on density, times that last one —
density always releases on zoom, by construction. Read that list at the top of
the golden file before concluding that a new term is needed; most questions
about the gate are questions about which of the 7 a display is in.

Everything here is plugin-internal but four types: the mixin, the floor and the
verdict helpers are not exported from `@jbrowse/plugin-linear-genome-view`, and
[ADR-045](../architecture-decision-records/adr-045-region-too-large-gate-stays-in-lgv-plugin.md)
is why they live in a plugin rather than a foundation package. The exceptions are
`GateViewport` and `GateFetchState`, which the duck-typed fetch contracts have
to name — a fan-out helper snapshots `gateFetchState()` when it issues a fetch
and hands it back to `commitFetchBytes` — plus `ByteEstimate` and
`RegionTooLargeStatus`, exported only so the entry index's `.d.ts` can
serialize. The budget vocabulary is the one piece
that is deliberately *not* plugin-internal (§ A budget has a scope): three
callers in three packages make the same comparison, and only `packages/core` is
reachable from all of them.

The measurement takes a stop token, and it earns it. `getRegionByteSize` bottoms
out in an index lookup (`bytesForRegions`), which is a set of range reads over
the network for BAM/CRAM/tabix and runs on the critical path of the fetch whose
first await it is — so a superseded viewport must stop measuring a file it will
not download. `measureRegionBytes` takes the fetch's own stop token and status
callback (the RPC driver hands them to every executor) and wraps the read in
`updateStatus('Checking region size', …)`, so the phase is a cancellation
boundary as well as the label the user sees first when a track opens wide.

**`CoreGetRegionByteEstimate` still exists and is not the gate.** It is easy to
miss when changing either: "Save track data" runs the same index lookup in
`packages/core/.../fetchTrackData.ts`, against `BaseTrackModel.exportByteLimit`.
It pulls the region a blocked display just refused, so it needs a bound of its
own — deliberately more generous, since a save is a confirmation rather than a
refusal and the user asked for those bytes by name. Only the *default* differs:
both budgets prefer the adapter's declared `fetchSizeLimit` through the one
shared `adapterByteLimit` in `byteBudget.ts`, so "a non-positive declared limit
means no opinion" has a single spelling. `resolveByteLimit` itself lives in
`@jbrowse/plugin-linear-genome-view` and is out of `packages/core`'s reach
([ADR-045](../architecture-decision-records/adr-045-region-too-large-gate-stays-in-lgv-plugin.md)).

For the wider picture and the five fetch autoruns that consult the verdict, see
[ARCHITECTURE.md § Data fetching pipeline](../ARCHITECTURE.md#data-fetching-pipeline).
`DisplayChrome` turns this one signal into the banner UI; see
[DISPLAYCHROME.md](DISPLAYCHROME.md).

## How the verdict is built

Four steps and a note, all on `RegionTooLargeMixin`:

- **The measurement is inside the fetch, and the display's whole part in it is
  two lines**: override `gateEnabled` to true, and pass
  `byteLimit: self.resolvedByteLimit()` in the fetch RPC's args. The RPC runs
  `measureRegionBytes` (or `measureRegionsBytes`, for one that serves a whole
  region set) as its first await and answers a `RegionTooLargeResult` in place
  of its payload when the region is over — carrying `bytes` either way, so the
  banner has a number on the success path too.

  **Committing it is the fetch runners', not the display's.** `fetchEachRegion`,
  `fetchAllRegions` and `fetchRegionsBatched` capture `gateFetchState()` before
  they issue anything and call `commitFetchBytes(perRegionBytes, issued)` when
  the results land; `runGlobalFetch` does the same for the global family. They
  also skip `onResult` and `ctx.commitRegion` for a refused region, so what the
  display stores and what `loadedRegions` claims cannot come apart. A display
  that never passes a `byteLimit` measures nothing and commits nothing, which is
  what lets the runners call this unconditionally.
- `gateViewport` is **what a measurement is about**: the span on screen plus a
  key identifying that stretch of genome. It is the mixin's **only** view read
  (`adapterFetchSizeLimit` reaches the containing track, and that is the only
  other reach), and is `undefined` until `view.initialized` — `visibleBp` reads
  `view.width`, which throws before the view is measured, and a bare getter must
  never throw. Readers take `gateViewport?.spanBp`, so that guard exists once.

  Capture it **before** the round trip. A zoom mid-fetch would otherwise label
  the number with a viewport it never covered, and both readers of that label
  then answer wrongly: `gateMeasurementStale` thinks the new viewport was
  measured, `zoomIneffective` reads the zoom as having bought nothing.
  The fan-out helpers read it above the await, so no display has to remember.
- `setByteEstimate({ bytes, viewport })` and `setGateMeasuredViewport(viewport)`
  are the two commits, and they are deliberately separate. The first stores the
  bytes and the span, through `nextByteEstimate`, which is also where
  `zoomIneffective` is decided from the previous measurement — and it is called
  only when there are bytes, since `bytes` is a `number` and a fetch that
  measured none stores nothing. The second records only "we asked about this
  viewport", which a fetch can honestly report while measuring *no* bytes,
  because a dense region short-circuits on its feature count and an unmeasurable
  byte result must not overwrite a good estimate. Folding them would make a
  density-blocked display refetch forever.

  `commitFetchBytes` reduces a batch to one `commitByteMeasurement` — the
  per-region **max**, because the budget is what one region may cost — and both
  of them, `clearByteEstimate` and `setForceLoadTrack` are one-line
  delegations to **`nextGateState(prev, event)`** (`regionTooLargeUtils.ts`),
  which is where the whole commit protocol lives. The point of it being pure is
  the tests: `gateTruthTable.test.ts` is a cross-product of *states* and cannot
  see an order, while every rule in the protocol is about one — which of two
  measurements wins, what a clear leaves behind, what an approval outlives.
  `nextGateState.test.ts` walks seeded event sequences against those rules
  restated, and all five of its seeds independently rediscover the tier-key bug
  when the guard is removed.
- `gateActive` answers "may the gate act right now?" — the opt-in, no exemption,
  a measured view — and `densityGateActive` is that plus the density axis's own
  two terms (`densityGateEnabled`, `aboveForceLoadFloor`). The byte axis reads
  `gateActive` directly, having nothing to add. `tooLargeStatus` passes
  `undefined` / `false` for whichever is off, so each axis's terms are stated
  once — including the byte *budget*, which must go through the same flag because
  a display that never gates has no containing track to read
  `adapterFetchSizeLimit` off.
- The verdict is read immediately after the commit, which works because the
  estimate was just taken at the current viewport.

The estimate deliberately survives `clearAllRpcData()`, so an ordinary viewport
change doesn't flicker the banner. **Two things drop it, and they are one rule on
two axes**: the estimate describes a particular fetch, and each of them changes
which fetch that is.

- **Chromosome navigation**, since `displayedRegionIndex` values are reused
  across chromosomes and a stale estimate would gate the new region against the
  previous chromosome's numbers. That drop is `clearByteEstimate()`, fired from
  `MultiRegionDisplayMixin`'s `DisplayedRegionsChange` autorun — every display in
  that family gets it without wiring anything. LD and arc run on
  `GlobalFetchMixin` instead and call it from their own
  `onDisplayedRegionsChange`.
- **A tier swap** — `byteGateAdapterConfig` changing under a display that reads a
  different file at different zooms. `RegionTooLargeMixin`'s own `afterAttach`
  installs `ClearByteEstimateOnTierSwap`, an autorun over `byteGateAdapterKey`
  (the config, stringified), so overriding `byteGateAdapterPath` stays the
  whole opt-in and no display has to remember a second wire — the same call
  `CanvasFeatureGateMixin` makes for its own stale-stat cleanup. Guarded on
  `gateEnabled`, so a display that never gates still never evaluates the adapter
  getters below the opt-in.

  Skipping it shows the wrong number, and MAF is the worked example. It gates at
  every zoom, so it captures a 470-way *detail* estimate inside a gene-sized
  window; zoom out past 20kb and `showSummary` flips to the cheap tier while that
  number — megabytes — banners a summary read that would have measured ~60 kB.
  Only that direction is unsafe: a stale *summary* estimate under-reports, so the
  fetch proceeds and re-measures on its way to the download. The clear
  is keyed on the tier, never on the zoom, or a single-file track would re-derive
  its banner on every pass across the floor. All three pinned in
  `plugins/maf/src/LinearMafDisplay/derivedRegionTooLarge.test.ts`.

`clearByteEstimate()` deliberately does **not** touch `forceLoadTrack`: that flag
is a track-wide approval, so expiring it here would reinstate exactly the
per-locus re-prompting it exists to avoid. See § Force-load.

**The banner also drops a stored hover, and that is the hover installer's job
rather than the gate's.** `installClearHoverOnViewportChange` reads
`regionTooLarge` alongside its three viewport axes; see ARCHITECTURE.md §"A
stored hover". An out-of-tree display still overriding the hook this replaced is
reported through `REMOVED_ACTION_HOOKS`, beside `RENAMED_HOOKS`.

**The `AUTO_FORCE_LOAD_BP` comparison lives in `aboveForceLoadFloor`, and only
there** — three readers wanting three different things, listed under § Shared
primitives. `evaluateRegionTooLarge` only compares bytes against limit, then
density, and knows none of it.

**Neither axis reads the live viewport for its *value*.** The byte axis compares
a measurement, refreshed once per settled viewport on whatever debounce the
display's fetch autorun carries — 600 ms for the whole `MultiRegionDisplayMixin`
family, 500 ms on LD and 1000 ms on arc; the density axis reads the 500
ms-debounced `coarseBpPerPx`, sharing the layout packing cadence. Read live
`visibleBp` and rescale instead and the banner releases the instant you cross a
threshold — against a number the index does not charge.

**Neither worker budget may be an RPC cache key.** Both `resolvedByteLimit()` and
canvas's `maxFeatureDensity` are resolved values that go undefined the moment
their axis stops gating, and both swing at 20 kb — `densityGateActive` folds in
`AUTO_FORCE_LOAD_BP`, `resolvedByteLimit()` applies
`SUB_FLOOR_BYTE_BUDGET_FACTOR` — as well as on force-load. So canvas passes them
as call-site arguments to `RenderFeatureData` / `MultiRowGetFeatures`, and they
are deliberately **not** in `rpcProps()`. In the payload, zooming across the
floor is a full `SettingsInvalidate` → `clearAllRpcData()` → refetch, blanking
the display at exactly the zoom people settle a gene at, for data identical on
both sides of it — which `maxFeatureDensity` shipped once.

**The raw slots the budgets resolve from are not cache keys either — settled
2026-08-21.** `LinearBasicDisplay` used to send them as a `gateSlots` field so a
budget edit stayed a refetch, while the multi-row display carried none, and
which was right stayed open on the worry that a track would strand at a budget
the user just raised. It does not strand: `FetchVisibleRegions` tracks
`regionTooLarge`, a refused region was never marked loaded, and the budgets
resolve through tracked `getConf` reads — so raising one releases the verdict
and refetches the blocked region with the new budget at the call site, while
lowering one re-banners from the stored measurements with no RPC at all. The
only behavior `gateSlots` added was a full refetch of regions already loaded
and in budget — the same redundant-and-worse case as the resolved values —
so the field is gone and the multi-row arrangement is the rule. Pinned by
"gate budgets are not RPC cache keys" (both the stable key and the
release-through-the-verdict) in `LinearBasicDisplay/fetchAutorun.test.ts`.

Losing a budget swing as an invalidation trigger loses no protection. A region
the worker rejected stores nothing, so nothing marks it loaded and it refetches
once the gate releases. Zooming back *out* re-gates from the live main-thread
verdict, since `densityStatsPerRegion` is committed on every successful fetch
regardless of budget and the byte estimate survives a no-budget one. The worker
re-gates whenever a fetch actually happens, which is when a download would occur.
Pinned by "gate budgets are not RPC cache keys" in
`LinearBasicDisplay/fetchAutorun.test.ts`.

That "nothing marks it loaded" is a property of where the mark is written, and it
was not true until 2026-08-20. `fetchRegions` used to mark every region it had
*asked* for once the work callback returned, while the display stored from what
came *back* — two writers, one fact, and they disagree exactly when a fetch
stores less than it asked for. A refused region then claimed the whole span:
`isBlockCovered` read the viewport as covered against data nobody received, the
plan answered `covered` on every later run, and — the ordinary fetch being the
only re-measure there is — nothing refetched **or** re-measured. Invisible on a
region fetched for the first time, because the data map really was empty;
permanent on one the reader already had data for, which is every region they
zoomed out from. On the byte axis it left a banner no zoom could release; on the
density axis, which falls with `bpPerPx`, the banner came down and the display
painted the previous, narrower payload across the whole viewport with nothing on
screen to say so. The mark is now written by whoever writes the data, through
`ctx.commitRegion` — see `RegionFetchContext` — and `covered` no longer outranks
a re-measure the banner is waiting on (`gateBlocked` in `planRegionFetch`).
`LinearBasicDisplay/loadedRegionCoverage.test.ts` carries both, as two scenarios
and as a seeded random walk over zoom and pan.

`commitRegion` takes an index and no span, deliberately: `fetchRegions` resolves
it against the `needed` list it issued, so a display can say that a region landed
and cannot say what it landed over. The direction that froze a track is not
expressible. What is left is forgetting the call, which spins rather than
freezing — a dev-only check reports three consecutive fetches that store nothing
while nothing is gating them. The global family reaches the same invariant from
the other side, since `GlobalFetchPhases.commit` runs only when `run` produced a
result.

## The sub-floor budget tier

Below `AUTO_FORCE_LOAD_BP` the byte budget is multiplied by
`SUB_FLOOR_BYTE_BUDGET_FACTOR` (2). The gate keeps asking down there — this is a
tier, not an off-switch — but it asks against a larger number, because at gene
scale the user navigated to this locus deliberately and a banner is a worse
answer than a few seconds of download.

**Why not turn the gate off below the floor.** Index estimates are monotone
non-decreasing in span, so a region over budget below the floor was over budget
at 20 kb too. Turning the gate off down there makes it *bypassable*: the banner
says "zoom in to see features", and zooming in hands over the very bytes it just
refused — or, arriving by locus search rather than by zooming, shows no banner at
all. A tier keeps the gate reachable at every zoom, so a mitochondrial or
amplicon pileup at tens of MB inside a gene-sized window still asks.

**Why a tier is warranted at all**, given that "a small span is a small fetch" is
false: below the floor the estimate stops moving, so the user cannot act on the
banner's own advice. A BAI's linear index resolves 16 kb bins:

<!-- BEGIN GENERATED MEASUREMENT subfloor-index-bin-bytes -->

| file                      | 1kb–10kb (flat) | 20kb   |
| ------------------------- | --------------- | ------ |
| volvox-ultradeep (~2000x) | **7442k**       | 14468k |
| volvox-sorted             | 257k            | 317k   |
| volvox long reads         | 102k            | 102k   |

<!-- END GENERATED MEASUREMENT subfloor-index-bin-bytes -->

So the sub-floor budget is "what one index bin costs", and 2x is what the deepest
file here needs to clear it — 7.44 Mb against BAM's 5 Mb becomes 7.44 against 10.
A policy dial, not a derived constant: raise it if real tracks keep bannering at
a locus, lower it if a tab hangs. It multiplies the resolved budget rather than
replacing it, so an adapter declaring its own `fetchSizeLimit` keeps its
relationship to the display default at both tiers.

The span tier is not a per-region force-load ceiling wearing a hat; none of the
four questions that ruled that out reaches a static span tier
([ADR-074](../architecture-decision-records/adr-074-force-load-is-one-boolean-per-track.md)).

## Measurement follows the viewport

The verdict is the last measurement, so the whole design question is *when does a
new one get taken*. Two states, and the answer in both is "the fetch takes it":

- **Not gated** — every fetch measures before it downloads: `measureRegionBytes`
  is the first await of every gated feature RPC.
- **Gated** — the fetch autoruns run that same fetch **once per settled
  viewport**, and it stops at whichever gate rejected it, because that is what a
  fetch does when the answer is over budget.

  What a blocked track costs per settled pan or zoom: on the **byte** axis, one
  index read and no features. On canvas's **density** axis, the
  pre-fetch probe `samplePreFetchDensity` — a 1kb sample window, doubling until
  it has seen 70 features — then the short-circuit. A region dense enough to be
  density-blocked satisfies that on the first window, so it is bounded but not
  free.

**A fetch the gate sat out is not a measurement, and neither path stamps one.**
`gateMeasurementStale` compares a stamp against `gateViewport.key`, and the stamp
means "the gate asked the adapter about this viewport". A force-loaded fetch
carries no budget on either axis, so the worker measured against nothing and
`gateFetchState()` records `gated: false`, which is what stops the commit
stamping the viewport. The density *stats* are still committed on a force-loaded
fetch, which is what lets zooming back out re-gate from the live main-thread
verdict.

**Both halves of that read the fetch's own state, not the live one.**
`commitFetchBytes` (and `commitGateMeasurements` on the density side) takes a
`GateFetchState` — `{ viewport, gated, tierKey }` — captured where the fetch was
issued, because a result is judged by the state that produced it and none of its
fields can be recovered afterwards. `gated` in particular
is not a live `gateActive` read at commit time: that is a different question
whenever force-load moves during the round trip, and it answers wrongly in both
directions.

`gateFetchState()` on `RegionTooLargeMixin` is the capture, and calling it *is*
the snapshot — a method rather than a getter for that reason. The fan-out
helpers are the only production callers, so no display has to remember where the
capture goes. Spell it there and nowhere else, tests included: a copy is one
more place to forget that `gated` means "at issue", and a test copy that
re-derives the rule cannot fail when the production rule changes.

The gated half is one condition — `gateSkipsMeasuredViewport`, the mixin's own
consolidation of `regionTooLarge && !gateMeasurementStale` — read by both fetch
skeletons (`planRegionFetch` for the per-region family,
`installGlobalFetchAutorun` for the global one).

Both halves are load-bearing. Skipping unconditionally freezes the estimate at
the viewport it was captured over, which forces a *derived* second byte number to
release the banner, and that number has to be a lie (HISTORICAL.md § "The byte
estimate was a rate"). Not skipping at all spins: a too-large region stores
nothing, stays in `needed`, and the `fetchGeneration` bump after each attempt
re-fires the autorun.

`gateMeasurementStale` compares `gateMeasuredViewportKey` against
`gateViewport.key`. **Any** gated fetch stamps it, on either axis — keying the
stamp on `byteEstimate` instead makes a density-blocked display refetch forever,
for the reason the two separate commits carry (§ How the verdict is built).

**No measurement-only RPC path exists, and that is deliberate.** A
`remeasureByteEstimate()` the blocked autorun calls instead of fetching would
give every display a second RPC racing its feature fetch — the two-call
coordination this codebase avoids — to take a measurement its own fetch already
takes. It also spreads staleness over two mechanisms. There *was* such a path:
a `CoreGetRegionByteEstimate` round trip five displays ran ahead of their fetch,
which resolved the adapter, asked the index, returned, and left the feature RPC
to resolve the same adapter again. It is gone.

**"Zoom in to see features" is measured too — and only on the byte axis.**
`zoomCanReleaseGate` first asks `tooLargeStatus.axis` which axis tripped. Screen
density is features ÷ pixels, so it falls with `bpPerPx` by construction and zoom
always releases it; only bytes can be un-escapable. That branch is load-bearing:
the worker returns `bytes` alongside a density rejection, so a density-blocked
display keeps updating its estimate, and a dense VCF — small on disk, flat across
zooms, the case the density axis exists for — sets `zoomIneffective` while the
byte axis gates nothing.

On the byte axis it reads `ByteEstimate.zoomIneffective`, which `nextByteEstimate`
sets when a measurement at a materially smaller span (≤ ½) comes back materially
unchanged (> 90% of the previous bytes), and clears the moment one does fall. It
has to be evidence rather than a threshold, because whether zooming shrinks a
file's fetch is a property of that file's blocks: `volvox.maf.bed.gz` quotes an
identical 306,719 bytes from 25kb to 100kb, while a whole-genome VCF's successive
halvings buy 47%, 34%, 26%, 17%, 12%, 4%, 2%, 0%. Predicting it up front means
sampling the index at a ladder of sub-spans — 18x the one call on a whole-genome
region set (2.4s against 133ms, 22 chromosomes), to answer a question only a
blocked track asks.

## Opt-in hooks

Most displays override none of these.

**`gateEnabled`** defaults to false, meaning no measurement and no gating.
Where it is false (wiggle, Manhattan, sequence, synteny) `regionTooLarge` is a
literal false, the LGV-only getters below it are never evaluated, and a non-LGV
consumer of the mixin never reads `view.visibleBp`. It is a plain boolean
**getter**, so that it is read tracked — a method returning the viewport from an
`.actions` block reads untracked, which is how MultiSampleVariant's gate
silently went dead.

It was the OR of two opt-ins — `measuresBytesPreFlight` and
`measuresBytesInFetch` — because there were two measurement paths, and the OR
existed so a *contributed* opt-in (`CanvasFeatureGateMixin`'s) could not race
the base on compose order. With one path there is one opt-in and every override
is a direct one, so the OR, the pair of names, and the `no-restricted-syntax`
rule that forbade a second `get gateEnabled()` are all gone.

**What survives is the compose-order hazard**, since `types.compose` resolves a
member collision to the LATER argument: a mixin *contributing* this — only
`CanvasFeatureGateMixin` does — composed before the mixin that declares it hands
the opt-in back to the default, with no banner, no error and nothing the type
system objects to. `no-restricted-syntax` fails that order and says why. Out of
tree it does not, which is what `RENAMED_HOOKS` below is for.

**Renaming a gate hook is itself a hazard**, and `RegionTooLargeMixin`'s
`afterAttach` carries a dev-time check for it (`RENAMED_HOOKS`, plus
`REMOVED_VIEW_HOOKS` / `REMOVED_ACTION_HOOKS` for the ones with no new name —
`measuresBytesPreFlight` and `byteGateBlocksFetch` are both there). An
out-of-tree display overriding a dead name lands on a getter nothing reads: the
gate stays off and the display downloads whatever it is pointed at with no
banner and no error — the same silent-disable the compose-order lint rule exists
to prevent. Add to those maps before renaming another one. **This
one stays a runtime check on purpose**: the population it exists for is
out-of-tree displays, which never run our lint, and in tree there is nothing for
a selector to find, since a rename that left an old name behind would have been
the rename's own diff.

**`configuredFetchSizeLimit`** and **`configForceLoad`** read the
`fetchSizeLimit` and `forceLoad` slots from `baseLinearDisplayConfigSchema`,
which every gated display extends. Plain slot reads, not part of the
overridable hook surface — nothing has ever overridden them, and a display
whose budget genuinely comes from somewhere else should surface that need
before this line grows an "overridable" back.

**`densityTooLarge`** supplies a second gating axis, false in the base mixin.
Canvas overrides it with its feature-density gate; byte-only displays leave it.

**`byteGateAdapterPath`** is where on the track config the measured adapter
sits, and **a tiered display overrides this one hook**.
`adapterFetchSizeLimit` reads `[...byteGateAdapterPath, 'fetchSizeLimit']` off
the containing track — `['adapter']` in the base mixin,
`['adapter','summaryAdapter']` in MAF while `showSummary` — so a swapped-in
sub-adapter is sized against its own declared limit rather than the parent
adapter's. A path rather than the node or the resolved number, because the
snapshot `byteGateAdapterConfig` hands back cannot answer it: slots sitting at
their schema default are absent from a snapshot, so a sub-adapter's limit is
unreadable there in any config that does not restate the number.

**`byteGateAdapterConfig`** is which adapter the gate is *about*, and it is
the config at that path — `getConf(track, byteGateAdapterPath)`. So the
measurement and the budget describe one file by construction rather than by two
overrides agreeing, and MAF's swap is a single getter. Overriding the path is
the whole opt-in: the cached estimate is dropped when this getter's value
changes, so a measurement can't outlive the tier it measured (§ How the verdict
is built).

The config hook stays overridable for the case a path cannot express — a
display whose adapter config is *synthesized* rather than read. Both GC-content
displays wrap the track's sequence adapter and fold `windowSize` / `gcMode` in,
so no path on the track config names what they fetch; neither gates today, and
one that opted in would override the config and leave the path alone.

Inert in the tree: the four adapters declaring `fetchSizeLimit` are
Bam/Cram/VcfTabix/SplitVcfTabix, and MAF's summary tier is a BedTabix or a
BigBed. A static check cannot close it either — which adapter type sits behind
an override is a config-time fact — so what pins it is
`derivedRegionTooLarge.test.ts`'s "reads the budget off the tier it measured",
against a `summaryAdapter` carrying a limit no in-tree config writes.

That getter lets a tiered display keep `gateEnabled` on for **both** tiers, and
each tier's RPC measures the file IT reads: the MAF alignment index on the
detail path, the `summaryAdapter` sub-adapter on the summary one. Spelling the
swap as `gateEnabled = !showSummary` instead —
exempting the summary tier for being the cheap one — reads as obviously safe and
is not. MAF's summary tier is cheap *per base*, since it carries no sequence, but
a `BigBedAdapter` read is still a whole-feature download and `showSummary` is on
from 20kb to the whole genome, so the one path escaping the gate is also the one
that can pull unbounded per-species records with no size quoted and no way to
decline. **Exempting a tier assumes it is bounded; measuring it doesn't have to**
— a genuinely small summary read sits orders of magnitude under `fetchSizeLimit`
and never banners.

**Nothing turns `gateEnabled` off once on, and there is no reason to.** A
non-feature adapter is not a special case: it has no `getRegionByteSize` to
call, so the executor measures nothing — "unmeasurable", the same answer a
BigWig gives — and an undefined `estimatedFetchBytes` already keeps the byte
axis out of the verdict. LD is the worked example: `RenderLDData` measures the
genotype feature adapter it is about to read and skips the pre-computed
`PlinkLD*` adapters entirely, which serve no features at all. Under the
pre-flight that case cost a round trip returning `undefined` by construction;
folded into the fetch it costs nothing.

The general rule: **a display-side flag that exists to describe an *adapter* will
be wrong for the next adapter that display is pointed at.**

## Every gated fetch measures before it downloads

There is one measurement path, and it is inside the feature RPC. Seven
executors run it — canvas's two, the alignments pileup, arc's `ArcGetFeatures`,
MAF's detail and summary tiers, `MultiSampleVariantGetCellData` and
`RenderLDData` — and every one of them takes `byteLimit` from
`resolvedByteLimit()`, calls the adapter's `getRegionByteSize` as its first
await (an index-only estimate that downloads no features, `undefined` by default
on `BaseFeatureDataAdapter` and overridden by the tabix adapters), and returns
`{ regionTooLarge, bytes }` in place of its payload when the region is over.
The shared implementation is `measureRegionBytes` in
`packages/core/src/rpc/byteBudget.ts` — beside `overByteBudget` and the refusal
marker, because a second copy is a second answer to the same question.
`measureRegionsBytes` is the same thing for an RPC handed a whole region set:
it measures each region separately and judges the largest, since the budget is
per-region.

That makes the byte gate symmetric with the density gate, which already
short-circuits inside the RPC and returns `{ regionTooLarge, featureCount }`.
The payoff shows on a whole-genome fan-out: one cheap index read per chromosome
instead of downloading every chromosome's features — and one round trip instead
of two, since the adapter is already resolved and the density sample can run on
it between the byte stage and the download.

**A refusal refuses what the fetch is granular in.** On the per-region helpers a
refused region is skipped and its neighbours still draw; on the batched one —
variants' monolithic `cellData`, MAF's per-batch sample union, LD's triangle,
arc's block set — a refusal refuses the whole payload, because that is what the
worker answers with. So a multi-region view with one over-budget region draws
the small ones and banners under alignments and canvas, and banners as a whole
under MAF, variants, LD and arc. That is a visible change for alignments, which
used to refuse the set on its largest region.

**The span is a label, not a denominator.** `commitFetchBytes` stores the
per-region *max* bytes labelled with the *total* `visibleBp`, and dividing one by
the other releases a region the worker still refuses: zooming into one chromosome
shrinks the total span far faster than that chromosome's own bytes. So a
shrinking region set leaves the verdict alone and the next measurement decides it
on what is on screen. Pinned by "does not release on a shrinking region set until
a re-measure says so" in
`LinearMultiRowFeatureDisplay/derivedRegionTooLarge.test.ts`.

**A smaller version of the same seam, inert for a different reason.** The
per-region family fetches `needed` — only the regions the loaded data doesn't
already cover — while the commit labels the result with the whole
`gateViewport.spanBp`. Nothing divides one by the other, so the banner quotes
what the adapter said about the regions actually being fetched. The one reader
spanning two measurements is `zoomIneffective`, which compares bytes taken over
region sets that may differ — so a zoom-in whose covered set *grows* can read as
"the bytes didn't fall", costing one measurement pair's zoom advice. It
self-corrects on the next, and threading a per-region anchor through would burden
the single-region case that is nearly every case.

## A budget has a scope

Its vocabulary is `packages/core/src/rpc/byteBudget.ts` — the scope type, the
per-region reduction (`largestRegionBytes`) and the over-budget comparison
(`overByteBudget`). Core is the only package all three callers can reach: the
RPC beside it, canvas's in-fetch gate, and this plugin's
`evaluateRegionTooLarge`. It is the byte axis's counterpart to `featuresPerPx`
on the density axis, which is shared for exactly this reason. Reach the same
comparison separately and a `>` drifting to `>=` on one side is invisible to
every test in the tree.

`gateByteLimit` answers "what may a **single region** cost". Every region is
checked against it, and a multi-region view where each region individually fits
must not be blanked by what they add up to — so a region set reduces to one
comparable number **by max**, worker-side in `measureRegionsBytes` and
main-thread-side in `commitFetchBytes`. `CoreGetRegionByteEstimate` keeps the
`scope` argument for the save dialog, which asks the other question.

**`scope` is required, with no default.** `getRegionByteSize` merges and sums the
index chunks across every region it is handed, so it answers "what does the whole
download cost" by construction, and a caller that says nothing inherits that
reading silently. Both readings are defensible and the right one follows from how
the budget is enforced, not from which is bigger. The two disagree by 5-10x: at
whole-genome view `test_data/breakpoint/hs37d5.HG002-SequelII-CCS.sv.vcf.gz`
reads 5059k<!--m:byte-estimate-scope.70.wholeRequest--> against
`VcfTabixAdapter`'s 5 Mb and banners, where its largest single region is
968k<!--m:byte-estimate-scope.70.largestRegion-->.

<!-- BEGIN GENERATED MEASUREMENT byte-estimate-scope -->

| regions | `wholeRequest` bytes | `largestRegion` bytes | whole/largest | per-region cost |
| ------- | -------------------- | --------------------- | ------------- | --------------- |
| 24      | 3969k                | 381k                  | 10.43x        | 1.00x           |
| 70      | **5059k**            | **968k**              | 5.23x         | 0.90x           |

<!-- END GENERATED MEASUREMENT byte-estimate-scope -->

Splitting the call costs nothing: `getRegionByteSize` already resolves chunks
region by region internally, and only the final merge is shared, so asking per
region moves no work (0.9-1.0x above). What the merge buys is correctness for the
*other* budget — two regions sharing a BGZF block are charged for it once — and
that budget exists: "Save track data" pulls every region in one go, so
`exportByteLimit` is a bound on the whole download and `fetchTrackData` asks for
`scope: 'wholeRequest'`.

**Zero bytes is a measurement, not a missing one.** An index quotes chunks, so a
region with none — an empty contig, a chromosome the file carries no records on —
sums to exactly zero, and the verdict reads that as what it says: nothing to
download, nothing to gate. The one place it cannot serve is as the *baseline* of
`zoomIneffective`'s ratio, where dividing by it yields `Infinity` and reads as
"the bytes did not fall" at the moment they rose from nothing — so
`nextByteEstimate` starts over from a zero baseline, the same way it does from a
zero span. Do not confuse it with the unmeasurable case below: that one stores no
estimate at all.

**The density axis has the same zero, and `featuresPerPx` guards it.** That
function is shared precisely so the worker's short-circuit and the banner agree
on the number, and a zero-width region is the shared function's problem, not
whichever caller remembers it — unguarded, the worker reads `count / 0` as
`Infinity` and refuses to fetch a region that contains nothing.

**`overDensityBudget` beside it is the comparison**, the density axis's
counterpart to `overByteBudget`, with the same three callers the byte axis has:
the pre-fetch sample, the post-fetch exact count, and the main thread's
`densityTooLarge`. The *number* was shared and the *comparison* was not, which
left them free to disagree at exactly the boundary — a mutation sweep swapped
the main thread's `>` for `>=` and no test in the tree went red. An undefined
budget reads there as the axis not gating, never as a budget of zero.
`featureDensity.test.ts` pins both rules.

**A fetch that measured no bytes at all writes nothing** — not
`bytes: undefined`. Two ways that happens, meaning the same thing: the adapter
offers no index estimate, or the fetch carried no `byteLimit` because
`gateActive` was false when it was issued (force-loaded). Neither is a
measurement, so neither may overwrite the last real one, nor reset the
zoom-effectiveness comparison, which needs two real ones. Publish an empty
estimate and it wipes a good one, so a track put back under the gate has no
verdict left to banner from and has to re-derive it from a fresh worker
rejection.

**`ByteEstimate.bytes` is a `number`, and that is what holds the rule.** So
"unmeasurable" and "not measured yet" are one state — no stored estimate — and
`commitFetchBytes` skips its write rather than publishing an empty one when no
region in the batch reported bytes, with no third option to reach for. An
all-stale batch likewise commits nothing, so a superseded fetch can't wipe a good
estimate. Pinned by "keeps a good estimate when a batch measured no bytes" in
`LinearMultiRowFeatureDisplay/derivedRegionTooLarge.test.ts`.

What a batch *does* publish is `bytes` and the span they cover, and nothing else
— the budget they are compared against is the main-thread `gateByteLimit`, the
same getter that produced the worker's `resolvedByteLimit()`, so the two agree by
construction rather than by echoing a limit back across the boundary.

The byte half is handed over as a plain `(number | undefined)[]`, one entry per
region, which is all the max needs. The density half is
`{ displayedRegionIndex, region, result }` — the shape a fetch already holds —
so neither canvas display does span arithmetic of its own; features-per-bp is
the gate's business.

Multi-row's fetch RPC (`MultiRowGetFeatures`) is **byte-only, in both
directions**: it takes a `byteLimit` and deliberately no `maxFeatureDensity`, and
returns `bytes` and deliberately no `featureCount`, because the display turns the
mixin's density axis off. Re-enabling `densityGateEnabled` there fails to
typecheck on both sides rather than silently passing an argument the worker
ignores and storing an answer the display doesn't ask for.

### `CanvasFeatureGateMixin`

Composed on top of `RegionTooLargeMixin` by both canvas feature displays:
`LinearBasicDisplay` and `LinearVariantDisplay` through `baseModel`, plus
`LinearMultiRowFeatureDisplay`. It is **how the density number is measured, and
nothing else**: `densityStatsPerRegion`, `observedMaxDensity`, the
`densityTooLarge` override, and the worker's `maxFeatureDensity` budget (gated
behind the shared `densityGateActive`). The worker's *byte* budget,
`resolvedByteLimit()`, lives on `RegionTooLargeMixin` with the rest of the byte
axis — both its terms are that mixin's, so a copy here would only be a second
place to drift.

**Whether the axis is on is `RegionTooLargeMixin`'s too**, beside the
`densityTooLarge` hook, so "is the density axis on?" has one spelling within
`densityGateActive`'s reach — but the `true` is **contributed here**, next to
the measurement, the way `gateEnabled` is. The axis is on where something
measures it, and this mixin is the only thing that does.

`densityGateEnabled` defaulted to `true` on the base until 2026-08, which put
the five byte-only displays permanently in `densityGateActive === true` — inert,
because their `densityTooLarge` is the base `false`, and a state that reads as
the opposite of what is true. `maf/derivedRegionTooLarge.test.ts` pins that a
byte-only display claims no density axis, and multi-row's pins the other end:
it composes this mixin and turns the axis back off in its own `.views`, after
the `.compose`, so the override does not depend on mixin order. Neither is
reachable from `gateTruthTable`, which overrides the hook in order to enumerate
it and therefore cannot see which way the base points.

Both directions of the wrong compose order are caught, and neither is caught
*here*: `CanvasFeatureGateMixin()` written before `MultiRegionDisplayMixin()` in
one `types.compose` is an eslint error (`no-restricted-syntax`, which carries
the reason), so no getter has to be read back at attach to distinguish the
base's `false` winning from multi-row legitimately turning the axis off. What
the selector does not reach is an order assembled across two files — the gate
mixin composed ahead of a base *model* that carries the foundation — nor an
out-of-tree display, which runs neither our lint nor our tests.

A display opts in by composing the mixin and calling `commitGateMeasurements`
from its fetch's `onComplete`, which is handed the gate state the helper
captured before it issued anything. It does **not**
have to teach anything that a refused region holds no data: the refusal is a
typed answer (`isRegionRefused`, beside the byte budget in core), and nothing
that sees one commits the region. `regionHasData` stays, but its job is now the
reader-side check of that rule rather than the thing standing in for it — an
entry in `loadedRegions` with nothing behind it means the rule was broken
somewhere, and answering off the data map is what makes that a refetch instead of
a freeze. The mixin's own `afterAttach` clears stale stats on chromosome
navigation, so a composing display can't forget it and mis-gate a reused
`displayedRegionIndex`. `baseModel` keeps only what is genuinely its own: the
per-region `RenderFeatureData` fetch and `applyFetchResults`, its peptide-aware
`regionFetchKey` and the `regionHasData` beside it, and
`pruneRpcDataMapToVisible`, which trims `densityStatsPerRegion` alongside
`rpcDataMap`.

While `regionTooLarge` holds, `laidOutDataMap` returns empty, so the GPU upload
pushes nothing and there's no stale-feature flash.

## Force-load

Force-load is **one boolean for the whole track**: `forceLoadTrack`, a volatile
on `RegionTooLargeMixin`. `forceLoad()` sets it (via `setForceLoadTrack`) and
calls `reload()`; `gateExempt` ORs it with the declarative `forceLoad` config
slot, and everything downstream — the verdict, the worker byte budget, the worker
density budget — reads that one getter, through `gateActive` /
`densityGateActive`.
[ADR-074](../architecture-decision-records/adr-074-force-load-is-one-boolean-per-track.md)
is why it is a boolean rather than a raised per-axis ceiling.

The banner quotes the estimated size before the click, so a user approving it has
the magnitude in front of them, and is then never asked again for that track. It
**survives chromosome navigation** (`clearByteEstimate` drops the estimate, not
the flag), because re-prompting per locus is the friction this replaced. The
trade is that force-load is all-or-nothing per track: a user who wanted one huge
locus has the gate off for the whole session. That is the intended scope — the
gate exists to prevent an *unwitting* download, and a click on a banner quoting
the size is witting.

Volatile, so it never reaches a saved or shared session — a recipient would
otherwise download the same data with no warning and no visible reason. A page
load re-arms the gate. The durable, declarative escape hatch is the `forceLoad`
config slot, which is what `jbrowse-img --force` sets via the display snapshot,
so the gate is off before the first fetch. `setForceLoadTrack(false)` puts a
track back under the gate; nothing in the UI calls it, and it exists for tests
and for a plugin that wants it.

## Shared primitives (`shared/regionTooLargeUtils.ts`)

The derived gate and canvas's in-RPC short-circuit differ only in how they
measure. The verdict, the threshold, and the banner text live here so the two
paths can't drift apart.

- `AUTO_FORCE_LOAD_BP` is the span below which the **density** axis stops gating.
  It lives here rather than on the LGV model — the view never reads it — and
  `aboveForceLoadFloor` is its only comparison, with exactly three readers, each
  wanting something different: `densityGateActive` (the density axis stops gating
  below it), MAF's `showSummary` (swap to the summary adapter at it), and
  `gateByteLimit` (multiply the *budget* by `SUB_FLOOR_BYTE_BUDGET_FACTOR` below
  it). Each reads that getter rather than the constant, so the threshold has one
  spelling. It is not exported from the plugin.

  MAF's `showSummary` shares the number but is a rendering decision: where a
  summary tier draws the better picture is a different question from where a
  fetch gets too expensive. `aboveForceLoadFloor` excludes every opt-in term,
  which keeps MAF's read from being a cycle — everything downstream of the swap
  (`byteGateAdapterConfig`) reads it, nothing upstream does.

  **It is not a floor on the byte axis** — it is a budget tier there instead (§
  The sub-floor budget tier). The byte axis has no floor because it measures at
  whatever is on screen rather than assuming a small span is a small fetch. That
  assumption fails in two directions, and both are measured (2026-08-06,
  `bytesForRegions` against files in this repo):

  - **A second dimension the view doesn't shrink.** Cost is bytes per reference
    base **times** something zoom can't reduce. Row count: a 470-way MAF is
    6-8MB on the wire over a 40kb window. Depth: an amplicon or mitochondrial
    pileup is tens of MB in the same window. Either way it is several MB inside
    a gene-sized view. No row-count or coverage threshold is needed to keep
    measuring safe — a shallow alignment measures orders of magnitude under
    `fetchSizeLimit` and never banners.
  - **Index granularity, and it is not where 20kb suggests.** An index quotes
    whole blocks, so the estimate is flat wherever a query stops splitting bins —
    but *where* that happens is a property of the file, not of the linear index's
    16kb bin width:

<!-- BEGIN GENERATED MEASUREMENT index-estimate-flat-spans -->

| file                                                    | flat from        | value |
| ------------------------------------------------------- | ---------------- | ----- |
| `volvox/volvox.maf.bed.gz`                              | 25kb up to 100kb | 307k  |
| `volvox/volvox.maf.bed.gz`                              | 12.5kb down      | 213k  |
| `breakpoint/hs37d5.HG002-SequelII-CCS.sv.vcf.gz` (chr1) | **7.8 Mb down**  | 15k   |
| `ce11.26way.chrI_subset.bed.gz`                         | 200bp to 50kb    | 93k   |

<!-- END GENERATED MEASUREMENT index-estimate-flat-spans -->

  The whole-genome VCF is flat 400x above where a 20kb floor would look, so the
  constant is not "roughly a tabix/BAI linear index's own resolution" — that
  reading describes one dense file and generalizes. It is also what makes
  `zoomCanReleaseGate` evidence rather than a threshold — see § Measurement
  follows the viewport.

  The density axis keeps the floor because its number is still a model — the last
  fetch's features-per-bp times the current bpPerPx — with no measurement under
  it at the span being judged, and because a scan of all 60 indexed files here
  found nothing with that axis on that would banner below 20kb
  ([ARCHITECTURAL_LIMITS.md](ARCHITECTURAL_LIMITS.md) § "The density axis is a
  model with no measurement under it").
- `resolveByteLimit({ adapterFetchSizeLimit, configFetchSizeLimit })` is the one
  place a *gate* byte budget gets resolved: the adapter's limit, else the display
  config. Those two arguments are the only inputs — force-load is not a tier
  here, it bypasses the comparison entirely. A non-positive adapter limit means
  "no opinion" and is skipped, guarding both a `0` and a negative sentinel;
  `BaseTrackModel.exportByteLimit` shares that rule through `adapterByteLimit`
  (see the note at the top of this file).

  Its single caller is `gateByteLimit` on `RegionTooLargeMixin`, and
  `gateByteLimit`'s single caller is `resolvedByteLimit()`. **That is the one
  spelling of the gated budget, and everything takes it from there**: the
  worker's short-circuit, `tooLargeStatus` for the banner, and MAF's
  `framesReadOverBudget`, which bounds the `mafFrames` overlay — a third file,
  fetched alongside whichever tier the gate is watching, that the banner never
  quotes. Read the getter; don't re-assemble the call. A second spelling of "the
  adapter's budget" is how a worker rejection with no banner happens, which is a
  blank display that never refetches, and the chain is one getter deep precisely
  so that no caller can reach a different answer.

  Two of the three used to write `gateActive ? gateByteLimit : undefined`
  out themselves and were kept equal by hand. `gateActive` is not decoration on
  that read: below `AUTO_FORCE_LOAD_BP` `gateByteLimit` resolves the raised
  sub-floor tier, and an *unmeasured* view reads as below the floor — so an
  unguarded read answers with the doubled budget for a view that has no span
  yet.

  The adapter tier is `adapterFetchSizeLimit`, a **main-thread read of the
  adapter's own `fetchSizeLimit` slot**, and the boundary carries bytes only —
  the limit does not ride back on the estimate.

  Read it as a slot **path off the live track config**
  (`readConfObject(track.configuration, [...byteGateAdapterPath, 'fetchSizeLimit'])`),
  never off the display's `adapterConfig`: that is a snapshot, and a snapshot
  omits any slot at its default, so a BAM's declared 5 Mb reads back as
  `undefined` and the 1 Mb display default gates instead. `byteGateAdapterPath`
  is `['adapter']` unless a tiered display moved it — see the tier-swap section
  above. See
  [CONFIG_PATTERN.md §"Reading a slot: node, not snapshot"](CONFIG_PATTERN.md).

  An adapter-declared limit **outranks** the display config, so a display-level
  `fetchSizeLimit` cannot lower a BAM/CRAM/VCF adapter's own default. Lower it on
  the adapter. Which means the budget is spread over two schemas, and both have
  to be read to see what a given track gets:

<!-- GATED_BUDGETS START -->

<!-- prettier-ignore -->
| tier | value | applies to |
| --- | --- | --- |
| adapter slot | 5 Mb | `BamAdapter`, `CramAdapter`, `SplitVcfTabixAdapter`, `VcfTabixAdapter` — whatever display they are under |
| display slot | 5 Mb | `LinearBasicDisplay` — every inheriting adapter under this display |
| display slot | 5 Mb | `LinearMultiRowFeatureDisplay` — every inheriting adapter under this display |
| display slot | 5 Mb | `LinearMafDisplay` — every MAF adapter, none of which declares its own, so this is the whole budget |
| display slot | 1 Mb | `baseLinearDisplayConfigSchema` — every inheriting adapter under every other display |

Adapters with no `fetchSizeLimit` of their own, which therefore take whichever display row applies: `BedTabixAdapter`, `BgzipMafAdapter`, `BgzipTaffyAdapter`, `BigBedAdapter`, `BigMafAdapter`, `GWASAdapter`, `Gff3TabixAdapter`, `GtfTabixAdapter`, `HtsgetBamAdapter`, `MafTabixAdapter`.

<!-- GATED_BUDGETS END -->

  `website/scripts/api-docs/generateGatedBudgetDocs.ts` generates that from the
  schemas, off the same scan `check-gated-adapter-budgets.ts` runs;
  hand-transcribed, it said CRAM 3 Mb for as long as it took someone to notice.
  Below the `AUTO_FORCE_LOAD_BP` span every row is multiplied by
  `SUB_FLOOR_BYTE_BUDGET_FACTOR` (§ The sub-floor budget tier).

  **An adapter that implements `getRegionByteSize` and declares no
  `fetchSizeLimit` inherits whichever display it lands under**, which is how
  three gaps got in: `SplitVcfTabixAdapter` gated five times tighter than the
  single-file VCF beside it, and `LinearMultiRowFeatureDisplay` and
  `LinearMafDisplay` sat on the base 1 Mb while `LinearBasicDisplay` read the
  same files at 5 Mb. All three are at 5 Mb for one reason: the index estimate is
  block-granular, so a single gene still pulls whole BGZF blocks and a tighter
  gate banners a view that isn't large.

  The last two bite hardest, because **neither has a second axis** — multi-row
  turns the density axis off and MAF never had one, so the byte budget is the
  only gate either has. MAF is also where the display value is the *whole*
  budget, since no MAF adapter declares one. On the base 1 Mb that banners an
  hg38 100-way at a gene-sized window: `MAF_LARGE_BLOCKS.md` § "Fetch dominates
  at 470-way" measures a 40 kb buffered window at ~1.3–1.8 MB on the wire, a view
  the same doc measures at 38–55fps, refused for size. A 470-way is ~6–8 MB and
  still asks above the floor, which is where `summaryAdapter` is the answer.

  **You don't have to remember that.** `scripts/check-gated-adapter-budgets.ts`
  fails the `lint` job when a new gated adapter, or a new display overriding
  `gateEnabled`, has no budget decided for it; `--write` regenerates its baseline. Inheriting the display's is a fine
  answer — the check only insists it be an answer, and that the display be
  named, since an opt-in often sits in a shared mixin serving several. It is a
  check rather than an `autogen.ts` generator on purpose: autogen would write a
  new adapter into the baseline silently, which is the decision the file exists
  to force. It shares its scan (`scripts/gatedBudgets.ts`) with the generator
  that renders the table above, so the two cannot disagree; that file's header
  carries the scan's own edge cases.
- `nextByteEstimate(previous, measurement)` folds a fresh measurement into the
  stored one, carrying across the one thing only the previous one knows:
  `zoomIneffective`. A pure function so the "two points make the evidence" rule
  is testable without a model, and so the two ratios sit next to the numbers that
  chose them.
- `bytesTooLargeReason(bytes)` and `TOO_MANY_FEATURES_REASON` are the only two
  banner strings.
- `evaluateRegionTooLarge({ estimatedFetchBytes, byteLimit, densityTooLarge })`
  produces the verdict, its reason, and the `axis` that tripped — a field rather
  than something `zoomCanReleaseGate` re-derives from the reason string, so the
  banner's wording stays free to change. It is *only* the comparison: over the
  byte limit gates before density, and `densityTooLarge` is opt-in, so byte-only
  displays never gate on it. Whether either axis applies — the opt-in,
  force-load, `AUTO_FORCE_LOAD_BP` on the density side — is `gateActive` /
  `densityGateActive`'s question, and each caller passes `undefined` / `false`
  rather than restating why.

## Self-summarizing adapters need no exemption

An adapter that caps what it returns at screen resolution (BigWig, MultiWiggle,
HiC, the sequence adapters) simply doesn't implement `getRegionByteSize`. No
estimate, no byte axis, no gate — however wide the view gets. A display-side
"always render" flag is the wrong shape for this and could not fire anyway: the
only thing that would carry it is an estimate these adapters never produce.

BigMaf deliberately *does* implement it, since it returns full alignment rows
rather than a screen-reduced summary, and a whole-chromosome view can pull enough
packed MAF stanzas to hang the tab.

## Two ungated shapes that are decisions, not omissions

The hook table's default row ("no byte gate: the track downloads whatever it is
pointed at") covers most displays because their adapters self-summarize. Two
cases sit on that default with a measurable or potentially-measurable adapter
underneath, and each is recorded here so the next audit reads a decision rather
than re-deriving a finding:

- **`LinearManhattanDisplay` is ungated on purpose.** `GWASAdapter` inherits
  BedTabix's live index estimate (which is why it appears in the gated-adapter
  baseline as `display`), but the display never opts in: its design case is a
  genome-wide summary-stats view of hundreds of thousands of points, which is
  exactly the fetch a byte gate would banner. The cost is real — a multi-GB
  summary file downloads in full with no banner — and accepted; a user opening
  one has asked for the genome-wide picture. Revisit only with a budget derived
  from what the display can actually draw, not the base 1 Mb.
- **`LGVSyntenyDisplay`'s inherited gate is inert.** It extends
  `LinearAlignmentsDisplay` wholesale, `gateEnabled` included, but no
  comparative adapter implements `getRegionByteSize`, so every measurement
  returns no estimate and the gate never fires — a fine-tier PIF over a whole
  chromosome downloads unbounded. Making it live is one `bytesForRegions` call
  on the indexed PAF adapters plus a budget decision that has to be taken from
  SYNTENY_LOD's measured wire sizes (the base 1 Mb would banner legitimate
  whole-genome synteny): [ideas/synteny-byte-gate.md](../ideas/synteny-byte-gate.md).
