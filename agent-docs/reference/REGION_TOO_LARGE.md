---
name: region-too-large
description: The byte/density gate that raises the "region too large" banner and holds off the fetch — the derived getter, the shared verdict primitives, and how canvas folds the byte check into its feature RPC. Read when touching fetch gating or the too-large banner.
---

# The region-too-large gate

## TL;DR

**What it does:** you load `chr1:1-1,000,000`. Before fetching, we ask the
adapter roughly how many bytes that region would download. Over the limit → skip
the fetch, show the "region too large" banner. Under → fetch normally. For tabix
the estimate is just an index lookup (a byte range in the file), so it's free.

There's a second gate on the same banner: canvas also blocks regions with too
many *features* to draw, even when the byte count is fine. Same machinery,
different axis (`densityTooLarge`).

**Why there are two byte numbers:** once loaded, panning/zooming changes the span
you'd fetch. Instead of re-asking the adapter every time, we keep the one
estimate we captured and rescale it — bytes scale with span, so half the bp is
half the bytes. `regionTooLarge` is a derived getter that redoes this rescale on
every read, so the banner clears itself once you've zoomed in enough.

- **`estimatedBytesForVisibleSpan`** — rescaled to the span in view now. **Gate on this.**
- **`byteEstimate.bytes`** — the frozen number from when we captured it, stored
  with the span it covers (`byteEstimate.measuredSpanBp`) as one volatile,
  because the two are one measurement. Gating on the raw bytes is the classic
  bug: they never shrink, so the banner never clears.

**The footgun:** gating is **opt-in**, and a display that doesn't opt in never
gates. A pre-flight display sets `byteGateEnabled` (defaults to false); canvas,
which measures inside its own feature RPC, sets `gateFoldedIntoFetch`.
`derivedRegionTooLargeEnabled` is the OR of the two — additive, so composition
order can't turn a gate off.

**The rest:**

- Canvas doesn't do a separate estimate RPC. It folds the byte check **inside**
  its feature RPC (via the adapter's `getRegionByteSize`), so an over-budget
  region short-circuits before downloading any features.
- Force-load ("show me this anyway") is one **volatile boolean per track**
  (`forceLoadTrack`) — never saved to a session, but deliberately kept across
  chromosome navigation, since it approves the track rather than a locus. The
  durable escape hatch is the `forceLoad` config slot.
- An adapter that summarizes at screen resolution (BigWig, MultiWiggle, HiC,
  sequence) simply **reports no estimate**, and no estimate means no byte axis in
  the verdict. There is no `alwaysRender` exemption flag any more: it could only
  arrive on an estimate from an adapter that reports none, so it was dead by
  construction.
- **One adapter method**, `getRegionByteSize(regions)`, serves both halves: the
  pre-flight RPC calls it in a worker, canvas's feature RPCs call it inline. The
  byte *budget* it is compared against never crosses the worker boundary — it is a
  main-thread config read (`gateByteLimit`).

| Code | Path |
| --- | --- |
| `RegionTooLargeMixin` (derived gate, byte axis, worker byte budget) | `plugins/linear-genome-view/src/shared/RegionTooLargeMixin.ts` |
| Shared verdict primitives | `plugins/linear-genome-view/src/shared/regionTooLargeUtils.ts` |
| Pre-flight estimate RPC | `packages/core/src/rpc/methods/CoreGetRegionByteEstimate.ts` |
| Adapter estimate | `BaseFeatureDataAdapter.getRegionByteSize` |
| In-fetch byte short-circuit (both canvas RPCs) | `plugins/canvas/src/RenderFeatureDataRPC/byteGate.ts` |
| `CanvasFeatureGateMixin` (density axis) | `plugins/canvas/src/shared/CanvasFeatureGateMixin.ts` |

Tests: `regionTooLargeUtils.test.ts` for the shared primitives, a
`derivedRegionTooLarge.test.ts` per gated display, and a "the gate opt-in
survives regardless of mixin composition order" pin in
`plugins/canvas/src/LinearBasicDisplay/fetchAutorun.test.ts` and
`plugins/canvas/src/LinearMultiRowFeatureDisplay/derivedRegionTooLarge.test.ts`.

Everything here is plugin-internal: the mixin, the floor and the verdict helpers
are not exported from `@jbrowse/plugin-linear-genome-view`, and
[ADR-045](../architecture-decision-records/adr-045-region-too-large-gate-stays-in-lgv-plugin.md)
is why they live in a plugin rather than a foundation package.

The pre-flight RPC takes no stop token: `getRegionByteSize` bottoms out in a
tabix index lookup (`bytesForRegions`), so there is nothing meaningful to cancel,
and the unused `stopToken` / `headers` / `statusCallback` fields on
`CoreGetRegionByteEstimate`'s arg type are RPC-base boilerplate.

For the wider picture and the five fetch autoruns that consult the verdict, see
[ARCHITECTURE.md § Data fetching pipeline](../ARCHITECTURE.md#data-fetching-pipeline).
`DisplayChrome` turns this one signal into the banner UI; see
[DISPLAYCHROME.md](DISPLAYCHROME.md).

## How the verdict is built

Four steps, all on `RegionTooLargeMixin`:

- `byteGateBlocksFetch(regions, ctx)` is the whole pre-flight, in one action:
  read `visibleBp`, run `CoreGetRegionByteEstimate`, `setByteEstimate`, return
  `regionTooLarge`. Callers do `if (await self.byteGateBlocksFetch(regions, ctx))
  return` and nothing else — `fetchRegions` makes that call for the whole
  `MultiRegionDisplayMixin` family, LD and arc make it from their own global
  fetches. It short-circuits to false when `byteGateEnabled` is off, so the call
  is unconditional at every site.
- `setByteEstimate({ bytes, measuredSpanBp })` stores the estimate together with
  the span it covers — one volatile, written and dropped as a unit, so "bytes
  without a span" is unrepresentable. Storing the span is what makes the rest of
  this work, and
  the span must be captured **before** the measurement round trip, not read from
  `view.visibleBp` at commit time — a zoom during the in-flight fetch would
  otherwise anchor the estimate to a span it never covered, and because
  `FetchVisibleRegions` skips while `regionTooLarge` holds, an over-anchored
  estimate wedges the banner with no refetch to correct it. Reading it inside
  `byteGateBlocksFetch`, above the await, is what makes that structural instead
  of a rule each call site has to honor.
- `estimatedBytesForVisibleSpan` rescales that estimate to the span visible now
  (`bytes × visibleBp / measuredSpanBp`). It reads the span through
  `gateVisibleBp`, the mixin's **only** read of its container, which is
  `undefined` until `view.initialized` — `visibleBp` reads `view.width`, which
  throws before the view is measured, and a bare getter must never throw. Both
  this getter and `gateActive` take the span from there, so the pre-init guard
  exists once.
- `gateActive` answers "may anything gate right now?" — opted in, not exempt,
  view measured, span above the floor. `tooLargeStatus` is `gateActive ?
  evaluateRegionTooLarge({bytes, limit, densityTooLarge}) : NOT_TOO_LARGE`, and
  `regionTooLarge` / `regionTooLargeReason` are thin readers over it.
- The verdict is read immediately after `setByteEstimate`, which works because
  the estimate was just captured at the current viewport. When a later zoom-in
  flips it to false, `FetchVisibleRegions` notices and re-fires on its own.

The estimate deliberately survives `clearAllRpcData()`, so an ordinary viewport
change doesn't flicker the banner. Only chromosome navigation drops it, since
`displayedRegionIndex` values are reused across chromosomes and a stale estimate
would gate the new region against the previous chromosome's numbers. That drop
is `clearByteEstimate()`, fired from `MultiRegionDisplayMixin`'s
`DisplayedRegionsChange` autorun — every display in that family gets it without
wiring anything. LD and arc run on `GlobalFetchMixin` instead and call it from
their own `onDisplayedRegionsChange`.

`clearByteEstimate()` deliberately does **not** touch `forceLoadTrack`: that flag
is a track-wide approval, so expiring it here would reinstate exactly the
per-locus re-prompting it exists to avoid. See § Force-load.

One smaller wire: `onRegionTooLarge()` fires on the false→true transition
(alignments overrides it to clear its hover).

**The `AUTO_FORCE_LOAD_BP` comparison lives in `aboveForceLoadFloor`, and only
there.** `gateActive` adds the opt-in and exemption terms on top of it, and the
verdict, the pre-flight (no estimate RPC below the floor) and the two worker
budgets (`resolvedByteLimit()` on this mixin, `maxFeatureDensity` on the canvas
gate, which go undefined together) all read `gateActive`. It used to be spelled
out separately in `evaluateRegionTooLarge`, `checkByteEstimate` and a
canvas-local `gateInactive` — three layers that had to agree by hand.
`evaluateRegionTooLarge` now only compares (bytes vs limit, then density), and
knows nothing about the floor or force-load. The constant itself sits with the
gate (`shared/regionTooLargeUtils.ts`), not on the view, which never reads it.

MAF's `showSummary` asks the same "how zoomed out am I" question — it flips to the
cheap summary adapter exactly where the detail fetch would be blocked — so it
reads `aboveForceLoadFloor` rather than the constant. That getter deliberately
excludes the opt-in terms, which is what keeps the read from being a cycle: MAF's
`byteGateEnabled` is *itself* a function of `showSummary`.

**Live vs debounced.** The byte axis reads live `view.visibleBp`, so the banner
releases the instant you zoom past the threshold — that responsiveness is the
point of the derived gate. The density axis reads the 500 ms-debounced
`coarseBpPerPx` instead, to share the layout packing cadence and not churn
mid-zoom. The split is deliberate; don't unify it without deciding which
property you're giving up.

## Opt-in hooks

Most displays override none of these.

**`byteGateEnabled`** defaults to false, meaning no pre-flight and no gating.
`byteGateBlocksFetch` and the verdict both read it, so requesting the estimate
and gating on it are one decision, not two: alignments, maf and
multi-sample-variant can't drift into fetching estimates nothing reads, or gating
on estimates nobody fetched. It is a plain boolean **getter** — the previous
shape, a `getByteEstimateConfig()` method that returned `{adapterConfig,
visibleBp}` or null, read the viewport from a place that had to be a view and
could be untracked by being declared in an `.actions` block. That is exactly how
MultiSampleVariant's gate silently went dead. There is nothing viewport-derived
left to untrack.

**`derivedRegionTooLargeEnabled`** is `byteGateEnabled || gateFoldedIntoFetch`,
the union of the two ways to measure. Where both are false (wiggle, Manhattan,
sequence, synteny) `regionTooLarge` is a literal false, the LGV-only getters
below it are never evaluated, and a non-LGV consumer of the mixin never reads
`view.visibleBp`.

**`configuredFetchSizeLimit`** and **`configForceLoad`** read the
`fetchSizeLimit` and `forceLoad` slots from `baseLinearDisplayConfigSchema`,
which every gated display extends. Overridable, but nothing overrides them
today.

**`densityTooLarge`** supplies a second gating axis, false in the base mixin.
Canvas overrides it with its feature-density gate; byte-only displays leave it.

LD turns `byteGateEnabled` off for pre-computed adapters (PlinkLD\*), which
aren't feature adapters — `CoreGetRegionByteEstimate` measures through
`getFeatures` and would throw. MAF turns it off in summary mode, where the read
is a cheap zoom-reduced BigBed.

## Canvas folds the byte check into its fetch RPC

Canvas opts out of the pre-flight entirely — `byteGateEnabled` stays false,
because a second estimate RPC racing the per-region feature fetch is
exactly the two-call coordination this codebase avoids. Instead
`executeRenderFeatureData` and `executeMultiRowGetFeatures` call the adapter's
`getRegionByteSize`, an index-only estimate that downloads no features
(`undefined` by default on `BaseFeatureDataAdapter`, overridden by the tabix
adapters). An over-budget region short-circuits there, before `getFeaturesArray`
runs, and comes back as `{ regionTooLarge, bytes }`. Both RPCs run that stage
through the one shared `measureRegionBytes` (`RenderFeatureDataRPC/byteGate.ts`),
the byte-axis counterpart to `densityGate.ts` — the two used to hold a
copy-pasted block each.

That makes the byte gate symmetric with the density gate, which already
short-circuits inside the RPC and returns `{ regionTooLarge, featureCount }`.
The payoff shows on a whole-genome fan-out: one cheap index read per chromosome
instead of downloading every chromosome's features.

**Accepted behavior: the multi-region rescale mixes denominators.**
`commitGateMeasurements` stores the per-region *max* bytes but anchors to the
*total* `visibleBp` across all visible regions. At capture time that is right —
it reproduces the worker's per-region verdict. On a later zoom it isn't: in a
whole-genome view, zooming into one chromosome shrinks the total span far faster
than that chromosome's own bytes shrink, so the banner releases earlier than it
should. The download is still protected (the worker re-gates per region on the
next fetch, and the banner comes back), so the symptom is one extra round trip
and a flicker.

The behavior is pinned by "releases early when the visible region set shrinks" in
`LinearMultiRowFeatureDisplay/derivedRegionTooLarge.test.ts`, so a per-region
denominator is a deliberate change rather than a silent one. If you make it: the
denominator has to be that region's *visible* span captured before the fetch, not
the span it fetched. Canvas fetches `bufferedVisibleRegions` (half a screen of
buffer each side), so a fetched-span rate quotes about half the bytes the worker's
per-region gate just rejected — the banner clears a region the worker still
refuses, which is the wedge the anchoring rules exist to prevent. It also gives
canvas a different estimate semantic from the pre-flight path, which measures a
region *set* in one adapter call and has no per-region number to keep.

`commitGateMeasurements` records the maximum per-region byte count, not the sum,
because every region is gated against the same per-region budget — a
multi-region view where each region individually fits should never be blanked
just because the regions add up. **A batch that measured no bytes at all writes
nothing** — not `bytes: undefined`. Two ways that happens and they mean the same
thing: the adapter offers no index estimate, or the fetch carried no `byteLimit`
because `gateActive` was false when it was issued (under the force-load floor,
or force-loaded). Neither is a measurement, so neither may overwrite the last
real one or re-anchor it to a new span. Publishing an empty estimate used to
cost a wasted round trip on every re-activation: zooming in past the floor wiped
a perfectly good estimate, so zooming back out had no verdict left to raise the
banner from and had to re-derive it from a fresh worker rejection. The
pre-flight path never had the bug — `byteGateBlocksFetch` skips the RPC outright
when nothing could gate, and so writes nothing either. Pinned by "keeps a good
estimate when a batch measured no bytes" in
`LinearMultiRowFeatureDisplay/derivedRegionTooLarge.test.ts`. An all-stale batch
likewise commits nothing, so a superseded fetch can't wipe a good estimate. What
it does publish is `bytes` and the span they cover, and nothing else — the budget
they are compared against is the main-thread `gateByteLimit`, the same getter
that produced the worker's `resolvedByteLimit()`, so the two agree by
construction rather than by echoing a limit back across the boundary.

A measurement is handed over as `{ displayedRegionIndex, region, result }` — the
shape a fetch already holds — so neither canvas display does span arithmetic of
its own; features-per-bp is the gate's business.

Multi-row's fetch RPC (`MultiRowGetFeatures`) is **byte-only**: it takes a
`byteLimit` and deliberately no `maxFeatureDensity`, because the display turns
the mixin's density axis off. The density gate that used to sit in that worker
was unreachable — `maxFeatureDensity` was always `undefined` — so it was removed
rather than left as a safety net that never fires. Re-enabling `densityGateEnabled`
there now fails to typecheck at the call site instead of silently passing an
argument the worker ignores.

### `CanvasFeatureGateMixin`

Composed on top of `RegionTooLargeMixin` by both canvas feature displays:
`LinearBasicDisplay` and `LinearVariantDisplay` through `baseModel`, plus
`LinearMultiRowFeatureDisplay`. It is the **density axis and nothing else**:
`densityStatsPerRegion`, `observedMaxDensity`, the `densityTooLarge` override,
and the worker's `maxFeatureDensity` budget (gated behind the shared
`gateActive`). The worker's *byte* budget, `resolvedByteLimit()`, lives on
`RegionTooLargeMixin` with the rest of the byte axis — both its terms are that
mixin's, so a copy here would only be a second place to drift. Overriding
`densityGateEnabled` to false drops the density axis for a display that paints
into fixed lanes, such as multi-row, leaving byte-only gating.

A display opts in by composing the mixin, calling `commitGateMeasurements` from
its fetch (with the `visibleBp` captured *before* the fetch), and overriding
`isCacheValid` to require committed data. That last
part matters because a too-large region is marked loaded but stores nothing, so
without the override it would never refetch once the gate released. The mixin's
own `afterAttach` clears stale stats on chromosome navigation, so a composing
display can't forget it and mis-gate a reused `displayedRegionIndex`.
`baseModel` keeps only what is genuinely its own: the per-region
`RenderFeatureData` fetch and `applyFetchResults`, its peptide-aware
`isCacheValid`, and `pruneRpcDataMapToVisible`, which trims
`densityStatsPerRegion` alongside `rpcDataMap`.

While `regionTooLarge` holds, `laidOutDataMap` returns empty, so the GPU upload
pushes nothing and there's no stale-feature flash.

## Force-load

Force-load is **one boolean for the whole track**: `forceLoadTrack`, a volatile on
`RegionTooLargeMixin`. `forceLoad()` sets it (via `setForceLoadTrack`) and calls
`reload()`; `byteGateExempt` ORs it with the declarative `forceLoad` config slot,
and everything downstream — the verdict, the worker byte budget, the worker
density budget — reads that one getter, through `gateActive`.

The banner quotes the estimated size before the click, so a user approving it is
approving the track with the magnitude in front of them. They are then never asked
again for that track, which is the point: it deliberately **survives chromosome
navigation** (`clearByteEstimate` drops the estimate but not the flag), because
re-prompting per locus is the friction this replaced.

Volatile, so it never reaches a saved or shared session — a recipient would
otherwise download the same data with no warning and no visible reason. A page load
re-arms the gate. The durable, declarative escape hatch is the `forceLoad` config
slot, which is also what `jbrowse-img --force` sets via the display snapshot, so
the gate is off before the first fetch. `setForceLoadTrack(false)` puts the track
back under the gate.

**This replaced a per-region, per-axis ceiling system**, and the simplification is
the point — the deleted machinery (`userByteLimit`, `userFeatureDensityLimit`,
`resolveForceLoadLimits`, `forceLoadByteLimit`, `raiseLimitPast`,
`FORCE_LOAD_HEADROOM`, two `raiseForceLoadLimits` implementations) existed only to
answer questions a boolean doesn't raise. Each of these was a real bug or a real
guard against one, and all of them are now unrepresentable rather than handled:

- **Which axis do we raise?** A tabix adapter reports an index-byte estimate even
  when the rejection was about *density*, so a dense-but-small region carried a
  small `bytes`. Adopting it as a ceiling installed a limit *below* the standing
  budget and then wrongly gated later regions that really were large. The fix was
  a "only raise the byte axis if it actually lifts the baseline" rule; now there is
  no ceiling to install.
- **Raise past which number?** The byte axis compares the *rescaled* estimate, so
  raising past the measured-span number left the banner up after a zoom-out (this
  shipped as an LD bug). The density axis had to read the debounced
  `coarseBpPerPx` reading, not a live one, or a click mid-zoom raised past a number
  the gate wasn't comparing against.
- **Does raising one axis disable the other?** It did: `maxFeatureDensity` returned
  `undefined` whenever `userByteLimit` was set, so approving a track's *size*
  silently switched off its *density* gate for the rest of the chromosome.
- **When does a ceiling expire?** Ceilings were dropped on chromosome nav, but only
  `CanvasFeatureGateMixin` did it — the five non-canvas gated displays carried a
  raised ceiling to the next locus and downloaded it unguarded with no banner.

The trade accepted in exchange: force-load is now all-or-nothing per track, so a
user who wanted one huge locus has the gate off for the whole session. That is the
intended scope, not an oversight — the gate exists to prevent an *unwitting*
download, and a click on a banner quoting the size is witting.

## Shared primitives (`shared/regionTooLargeUtils.ts`)

The derived gate and canvas's in-RPC short-circuit differ only in how they
measure. The verdict, the threshold, and the banner text live here so the two
paths can't drift apart.

- `AUTO_FORCE_LOAD_BP` is the floor below which nothing gates. It lives here
  rather than on the LGV model — the view never read it — and
  `aboveForceLoadFloor` is its only comparison. It is not exported from the
  plugin: MAF, the one out-of-plugin reader, reads that getter instead.

  **Both the floor and the rescaling below assume bytes are proportional to
  span, which is false for any format whose feature size is unbounded.** Tabix
  returns whole overlapping lines, and MAF-tabix puts an entire alignment block
  (every species' sequence) on one line — so zooming into a megabase block
  rescales the estimate toward zero while the real cost is unchanged, and the
  20kb floor means the gate isn't consulted at all. The gate under-reports
  exactly the fetch that needs stopping. See
  [MAF_LARGE_BLOCKS.md](../guides/MAF_LARGE_BLOCKS.md) for the failure mode and
  the opt-out sketch (re-measure instead of rescale; let the byte axis fire
  below the floor). Unfixed as of 2026-07-29.
- `resolveByteLimit({ adapterFetchSizeLimit, configFetchSizeLimit })` is the one
  place a byte budget gets resolved: the adapter's limit, else the display config.
  Those two arguments are the only byte-budget *inputs* in the system — force-load
  is not a tier here, it bypasses the comparison entirely. A non-positive adapter
  limit means "no opinion" and is skipped, guarding both a `0` and a negative
  sentinel.

  Its single caller is `gateByteLimit` on `RegionTooLargeMixin` — what the verdict
  compares against, and what `resolvedByteLimit()` hands the worker, so the two
  cannot gate against different numbers. Read the getter; don't re-assemble the
  call: a second spelling of "the adapter's budget" is how a worker rejection with
  no banner happens, which is a blank display that never refetches.

  The adapter tier is `adapterFetchSizeLimit`, a **main-thread read of the
  adapter's own `fetchSizeLimit` slot**. It used to also ride back on the estimate
  (`byteEstimate.fetchSizeLimit`), which BAM/CRAM/VCF filled with exactly that same
  static slot — one value with two spellings and a precedence rule between them, so
  the field went away and the boundary now carries bytes only.

  Read it as a slot **path off the live track config**
  (`readConfObject(track.configuration, ['adapter','fetchSizeLimit'])`), never off
  the display's `adapterConfig`: that is a snapshot, and a snapshot omits any slot
  at its default, so a BAM's declared 5 Mb read back as `undefined` and the 1 Mb
  display default gated instead — the bug this pass had to fix on the way. See
  [CONFIG_PATTERN.md §"Reading a slot: node, not snapshot"](CONFIG_PATTERN.md).

  Note an adapter-declared limit **outranks** the display config, so a
  display-level `fetchSizeLimit` cannot lower a BAM/CRAM/VCF adapter's own default.
  Lower it on the adapter.
- `rescaleByteEstimateToVisibleSpan` holds the span-scaling math.
- `bytesTooLargeReason(bytes)` and `TOO_MANY_FEATURES_REASON` are the only two
  banner strings.
- `evaluateRegionTooLarge({ estimatedBytesForVisibleSpan, byteLimit, densityTooLarge })`
  produces the verdict and its reason, and is *only* the comparison: over the
  byte limit gates before density, and `densityTooLarge` is opt-in, so byte-only
  displays never gate on it. Whether the gate applies at all —
  `AUTO_FORCE_LOAD_BP`, force-load — is `gateActive`'s question, not this
  function's.

## Self-summarizing adapters need no exemption

An adapter that caps what it returns at screen resolution (BigWig, MultiWiggle,
HiC, the sequence adapters) simply doesn't implement `getRegionByteSize`. No
estimate, no byte axis, no gate — however wide the view gets. They used to
declare `alwaysRender: true` on the estimate instead, which was unreachable by
construction (the only carrier of the flag was an estimate none of them
produced), so it was deleted rather than left as a safety net that can't fire —
the same call the unreachable multi-row density gate got.

BigMaf deliberately *does* implement it, since it returns full alignment rows
rather than a screen-reduced summary, and a whole-chromosome view can pull enough
packed MAF stanzas to hang the tab.

