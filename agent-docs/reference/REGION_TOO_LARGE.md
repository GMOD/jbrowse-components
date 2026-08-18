---
name: region-too-large
description: The byte/density gate that raises the "region too large" banner and holds off the fetch — the derived getter, the shared verdict primitives, and how canvas folds the byte check into its feature RPC. Read when touching fetch gating or the too-large banner.
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
axis's own terms. `RegionTooLargeMixin`'s header comment carries why, and what
the names were before.

| Code | Path |
| --- | --- |
| `RegionTooLargeMixin` (derived gate, byte axis, worker byte budget) | `plugins/linear-genome-view/src/shared/RegionTooLargeMixin.ts` |
| Shared verdict primitives | `plugins/linear-genome-view/src/shared/regionTooLargeUtils.ts` |
| Pre-flight estimate RPC | `packages/core/src/rpc/methods/CoreGetRegionByteEstimate.ts` |
| Adapter estimate | `BaseFeatureDataAdapter.getRegionByteSize` |
| In-fetch byte short-circuit (both canvas RPCs) | `plugins/canvas/src/RenderFeatureDataRPC/byteGate.ts` |
| `CanvasFeatureGateMixin` (density axis) | `plugins/canvas/src/shared/CanvasFeatureGateMixin.ts` |
| MAF's private bound on the `mafFrames` overlay | `framesReadOverBudget`, `plugins/maf/src/LinearMafDisplay/fetchMafData.ts` |
| The save dialog's own pre-flight, not the gate | `fetchTrackData.ts` + `BaseTrackModel.exportByteLimit` |

Tests: `regionTooLargeUtils.test.ts` for the shared primitives, a
`derivedRegionTooLarge.test.ts` per gated display, and a "the gate opt-in
survives regardless of mixin composition order" pin in
`plugins/canvas/src/LinearBasicDisplay/fetchAutorun.test.ts` and
`plugins/canvas/src/LinearMultiRowFeatureDisplay/derivedRegionTooLarge.test.ts`.

Everything here is plugin-internal but one type: the mixin, the floor and the
verdict helpers are not exported from `@jbrowse/plugin-linear-genome-view`, and
[ADR-045](../architecture-decision-records/adr-045-region-too-large-gate-stays-in-lgv-plugin.md)
is why they live in a plugin rather than a foundation package. The exception is
`GateViewport`, which canvas's duck-typed fetch contracts have to name — a
display hands `commitGateMeasurements` the viewport its measurement was taken
at. `ByteEstimate` and `RegionTooLargeStatus` rode out beside it with no
consumer and no longer do.

The pre-flight RPC does take a stop token, and it earns it. `getRegionByteSize`
bottoms out in an index lookup (`bytesForRegions`), which is a set of range reads
over the network for BAM/CRAM/tabix and runs on the critical path of the fetch it
precedes — so a superseded viewport must stop measuring a file it will not
download. `byteGateBlocksFetch` passes `ctx.stopToken` and `ctx.statusCallback`
both into the args and to the `updateStatus('Estimating size', …)` wrapper, which
makes the phase a cancellation boundary as well as the label the user sees first
when a track opens wide. Narrowing that parameter to `ctx.isStale()` alone left
both on the floor at every call site. Only `headers` is unused RPC-base
boilerplate.

**One caller of that RPC is not the gate at all**, and it is easy to miss when
changing either: "Save track data" pre-flights the same index lookup in
`packages/core/.../fetchTrackData.ts`, against `BaseTrackModel.exportByteLimit`.
It pulls the region a blocked display just refused, so it needs a bound of its
own — deliberately more generous, since a save is a confirmation rather than a
refusal and the user asked for those bytes by name. `exportByteLimit` re-derives
the **adapter tier** by hand (`['adapter','fetchSizeLimit']`, skipped when
non-positive) rather than through `resolveByteLimit`, which lives in
`@jbrowse/plugin-linear-genome-view` and so is out of `packages/core`'s reach
([ADR-045](../architecture-decision-records/adr-045-region-too-large-gate-stays-in-lgv-plugin.md)).
Two spellings of one rule: change either and check the other.

For the wider picture and the five fetch autoruns that consult the verdict, see
[ARCHITECTURE.md § Data fetching pipeline](../ARCHITECTURE.md#data-fetching-pipeline).
`DisplayChrome` turns this one signal into the banner UI; see
[DISPLAYCHROME.md](DISPLAYCHROME.md).

## How the verdict is built

Four steps and a note, all on `RegionTooLargeMixin`:

- `byteGateBlocksFetch(regions, ctx)` is the whole pre-flight, in one action:
  read `gateViewport`, run `CoreGetRegionByteEstimate`, commit, return
  `regionTooLarge`. Callers do `if (await self.byteGateBlocksFetch(regions, ctx))
  return` and nothing else — `fetchRegions` makes that call for the whole
  `MultiRegionDisplayMixin` family, LD and arc make it from their own global
  fetches. It short-circuits to false when `measuresBytesPreFlight` is off, so the call
  is unconditional at every site.
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
  `byteGateBlocksFetch` reads it above the await, so no call site has to
  remember.
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
  (the config, stringified), so overriding `byteGateAdapterConfig` stays the
  whole opt-in and no display has to remember a second wire — the same call
  `CanvasFeatureGateMixin` makes for its own stale-stat cleanup. Guarded on
  `gateEnabled`, so a display that never gates still never
  evaluates the adapter getters below the opt-in.

  Skipping it shows the wrong number, and MAF is the worked example. It gates at
  every zoom, so it captures a 470-way *detail* estimate inside a gene-sized
  window; zoom out past 20kb and `showSummary` flips to the cheap tier while that
  number — megabytes — banners a summary read that would have measured ~60 kB.
  Only that direction is unsafe: a stale *summary* estimate under-reports, so the
  fetch proceeds and the pre-flight re-measures before `work()` runs. The clear
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
there.** Three readers, each wanting something different: the density axis stops
gating below it, MAF swaps to its summary adapter at it, and the byte axis
multiplies its *budget* by `SUB_FLOOR_BYTE_BUDGET_FACTOR` below it. The byte axis
has no floor — it measures at the span it is judging — but it does have a tier,
for reasons about what the user asked for rather than what the fetch costs (§ The
sub-floor budget tier). `evaluateRegionTooLarge` only compares bytes against
limit, then density, and knows none of this. The constant sits with the gate
(`shared/regionTooLargeUtils.ts`), not on the view, which never reads it.

MAF's `showSummary` shares that number but is a rendering decision: where a
summary tier draws the better picture is a different question from where a fetch
gets too expensive. `aboveForceLoadFloor` excludes every opt-in term, which keeps
MAF's read from being a cycle — everything downstream of the swap
(`byteGateAdapterConfig`) reads it, nothing upstream does.

**Neither axis reads the live viewport for its *value*.** The byte axis compares
a measurement, refreshed once per settled viewport on whatever debounce the
display's fetch autorun carries — 600 ms for the whole `MultiRegionDisplayMixin`
family, 500 ms on LD and 1000 ms on arc; the density axis reads the 500
ms-debounced `coarseBpPerPx`, sharing the layout packing cadence. Reading live `visibleBp` and
rescaling is what used to release the banner the instant you crossed a
threshold — against a number the index does not charge.

**Neither worker budget may be an RPC cache key.** Both `resolvedByteLimit()` and
canvas's `maxFeatureDensity` are resolved values that go undefined the moment
their axis stops gating — `densityGateActive` still folds in
`AUTO_FORCE_LOAD_BP`, so `maxFeatureDensity` swings at 20 kb, and both swing on
force-load. **`resolvedByteLimit()` now swings at 20 kb too**, on
`SUB_FLOOR_BYTE_BUDGET_FACTOR`, so what was a density-only hazard is a
both-axes one and the rule below is what makes the tier affordable at all.
Canvas passes them as call-site arguments to
`RenderFeatureData` / `MultiRowGetFeatures`; they are deliberately **not** in
`rpcProps()`. `maxFeatureDensity` used to be, and that made zooming across the
floor a full `SettingsInvalidate` → `clearAllRpcData()` → refetch, blanking the
display at exactly the zoom people settle a gene at, for data identical on both
sides of it. The *slots* the budgets resolve from — `fetchSizeLimit`,
`forceLoad`, `maxFeatureScreenDensity` — travel instead, as
`LinearBasicDisplay`'s `gateSlots` field, so a real settings change still
invalidates. Read the field rather than looking for them in `displayConfig`:
nothing in the worker reads them, so the pick that builds the worker's config
leaves them out and they are named separately (see ARCHITECTURE.md
"[Pick the payload out of the snapshot](../ARCHITECTURE.md#pick-the-payload-out-of-the-snapshot-never-subtract-from-it)").

**The multi-row display carries none of them, and nothing yet says which of the
two is right.** Its `rpcProps()` returns `partitionField` / `lengthField` /
`colorConfig` only, so editing a budget there does not move its cache key. By the
argument below that costs nothing, which makes the basic display's extra
invalidation redundant — and worse for a region already loaded and fine, where it
re-downloads to arrive at the same features. Against that, the basic display's
behavior is deliberate and pinned twice, on the worry that a track would
otherwise strand at a budget the user just raised. Resolving it means deciding
whether `FetchVisibleRegions` re-running off the released `regionTooLarge` is
enough alone; until someone does, don't "unify" these by copying either onto the
other.

Losing a budget swing as an invalidation trigger loses no protection. A region
the worker rejected stores nothing, so `isCacheValid` is already false and it
refetches once the gate releases. Zooming back *out* re-gates from the live
main-thread verdict, since `densityStatsPerRegion` is committed on every
successful fetch regardless of budget and the byte estimate survives a no-budget
one. The worker re-gates whenever a fetch actually happens, which is when a
download would occur. Pinned by "gate budgets are not RPC cache keys" in
`LinearBasicDisplay/fetchAutorun.test.ts`.

## The sub-floor budget tier

Below `AUTO_FORCE_LOAD_BP` the byte budget is multiplied by
`SUB_FLOOR_BYTE_BUDGET_FACTOR` (2). The gate keeps asking down there — this is a
tier, not the off-switch the floor used to be — but it asks against a larger
number, because at gene scale the user navigated to this locus deliberately and a
banner is a worse answer than a few seconds of download.

**Why not simply the floor back.** Index estimates are monotone non-decreasing in
span, so a region over budget below the floor was over budget at 20 kb too.
Turning the gate off down there therefore made it *bypassable*: the banner said
"zoom in to see features", and zooming in handed over the very bytes it had just
refused — or, arriving by locus search rather than by zooming, showed no banner
at all. A tier keeps the gate reachable at every zoom, so a mitochondrial or
amplicon pileup at tens of MB inside a gene-sized window still asks.

**Why a tier is warranted at all**, given the floor's stated premise ("a small
span is a small fetch") is false: below the floor the estimate stops moving, so
the user cannot act on the banner's own advice. A BAI's linear index resolves
16 kb bins. Measured 2026-08-14, `estimatedBytesForRegions` on `ctgA`:

| span | volvox-ultradeep (~2000x) | volvox-sorted | volvox long reads |
| --- | --- | --- | --- |
| 1 kb – 10 kb | 7,441,672 (flat) | 256,892 (flat) | 101,982 (flat) |
| 20 kb | 14,468,389 | 317,130 | 101,982 |

So the sub-floor budget is "what one index bin costs", and 2x is what the deepest
file here needs to clear it — 7.44 Mb against BAM's 5 Mb becomes 7.44 against 10.
A policy dial, not a derived constant: raise it if real tracks keep bannering at
a locus, lower it if a tab hangs. It multiplies the resolved budget rather than
replacing it, so an adapter declaring its own `fetchSizeLimit` keeps its
relationship to the display default at both tiers.

**It is not the deleted per-region ceiling system wearing a hat** (§ Force-load).
None of the four questions that killed that one reaches a static span tier: it is
not derived from a measurement, so there is no "raise past which number"; it is
single-axis by construction; it never expires; and it does not turn the other
axis off.

## Measurement follows the viewport

The verdict is the last measurement, so the whole design question is *when does a
new one get taken*. Two states, and the answer in both is "the fetch takes it":

- **Not gated** — every fetch measures before it downloads. The pre-flight in
  `byteGateBlocksFetch`, or `measureRegionBytes` ahead of `getFeaturesArray` in
  canvas's own feature RPC.
- **Gated** — the fetch autoruns run that same fetch **once per settled
  viewport**, and it stops at whichever gate rejected it, because that is what a
  fetch does when the answer is over budget.

  What a blocked track costs per settled pan or zoom: on the **byte** axis, one
  index read and no features, on both paths. On canvas's **density** axis, the
  pre-fetch probe `samplePreFetchDensity` — a 1kb sample window, doubling until
  it has seen 70 features — then the short-circuit. A region dense enough to be
  density-blocked satisfies that on the first window, so it is bounded but not
  free, and it is a cost that did not exist when the blocked branch was a dead
  end.

**A fetch the gate sat out is not a measurement, and neither path stamps one.**
`gateMeasurementStale` compares a stamp against `gateViewport.key`, and the stamp
means "the gate asked the adapter about this viewport". A force-loaded fetch
carries no budget on either axis, so the worker measured against nothing.
`byteGateBlocksFetch` returns above its own stamp when `gateActive` is false;
`commitGateMeasurements` stamped unconditionally until 2026-08, so a canvas
display put back under the gate inherited a stamp from fetches that never
measured. Latent — nothing in the UI revokes force-load — but two paths
disagreeing about what a stamp means is only ever found the hard way. The density
*stats* are still committed on a force-loaded fetch, which is what lets zooming
back out re-gate from the live main-thread verdict.

**That guard is read a beat late, and knowing so is the point.**
`commitGateMeasurements` asks `gateActive` at *commit* time, while the budget the
fetch actually carried was resolved at *issue* time — `viewport` is threaded
through precisely because a value like that can't be recovered afterwards, and
this one isn't. The only way they disagree is force-load being revoked while a
fetch is in flight, which `setForceLoadTrack(false)` does and nothing else calls;
turning force-load *on* supersedes the fetch through `reload()`, so that
direction can't reach the commit at all. Closing it means passing the issue-time
answer alongside the viewport, and both call sites already hold it — `byteLimit`
is `undefined` exactly when the gate was inactive at issue.

The gated half is one condition, in the two fetch autoruns:

```js
if (self.regionTooLarge && !self.gateMeasurementStale) return
```

Both halves are load-bearing. Skipping unconditionally — which is what
`FetchVisibleRegions` and every global composer's `shouldFetch` used to do —
freezes the estimate at the viewport it was captured over, which is why there had
to be a *derived* second byte number to release the banner, and why that number
had to be a lie (HISTORICAL.md § "The byte estimate was a rate"). Not skipping at
all spins: a too-large region stores nothing, stays in `needed`, and the
`fetchGeneration` bump after each attempt re-fires the autorun.

`gateMeasurementStale` compares `gateMeasuredViewportKey` against
`gateViewport.key`. It is stamped by **any** gated fetch, on either axis, which
is the one subtlety: a dense region short-circuits on its feature count and
reports no bytes at all, and `commitGateMeasurements` deliberately does not
overwrite a good byte estimate with an unmeasurable one — so keying the stamp on
`byteEstimate` instead makes a density-blocked display refetch forever.

**No measurement-only RPC path exists, and that is deliberate.** The obvious
shape — a `remeasureByteEstimate()` the blocked autorun calls instead of
fetching — would give canvas a second RPC racing its feature fetch, which is the
two-call coordination it is built to avoid, to take a measurement its own fetch
already takes. It also spread staleness over two mechanisms.

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

**`measuresBytesPreFlight`** defaults to false, meaning no pre-flight and no
gating. `byteGateBlocksFetch` and the verdict both read it, so requesting the
estimate and gating on it are one decision: alignments, maf and
multi-sample-variant can't drift into fetching estimates nothing reads, or gating
on estimates nobody fetched. It is a plain boolean **getter**, because the
previous shape — a `getByteEstimateConfig()` method returning `{adapterConfig,
visibleBp}` or null — read the viewport from an `.actions` block and so read it
untracked, which is how MultiSampleVariant's gate silently went dead.

**`gateEnabled`** is `measuresBytesPreFlight || measuresBytesInFetch`. Where both
are false (wiggle, Manhattan, sequence, synteny) `regionTooLarge` is a literal
false, the LGV-only getters below it are never evaluated, and a non-LGV consumer
of the mixin never reads `view.visibleBp`.

**Renaming a gate hook is itself a hazard**, and `RegionTooLargeMixin`'s
`afterAttach` carries a dev-time check for it (`RENAMED_HOOKS`). An out-of-tree
display overriding an old name lands on a getter nothing reads: the gate stays
off and the display downloads whatever it is pointed at with no banner and no
error — the same silent-disable failure the additive OR and
`CanvasFeatureGateMixin`'s compose-order check exist to prevent. Add to that map
before renaming another one.

**`configuredFetchSizeLimit`** and **`configForceLoad`** read the
`fetchSizeLimit` and `forceLoad` slots from `baseLinearDisplayConfigSchema`,
which every gated display extends. Overridable, but nothing overrides them
today.

**`densityTooLarge`** supplies a second gating axis, false in the base mixin.
Canvas overrides it with its feature-density gate; byte-only displays leave it.

**`byteGateAdapterConfig`** is which adapter the pre-flight measures, defaulting
to the display's own. A display that swaps files by zoom overrides it so the
estimate always describes the fetch about to happen — MAF points it at the
`summaryAdapter` sub-adapter while `showSummary`, and at the MAF adapter below
the swap. Overriding it is the whole opt-in: the cached estimate is dropped when
this getter's value changes, so a measurement can't outlive the tier it measured
(§ How the verdict is built).

One thing it does **not** move is the budget. `adapterFetchSizeLimit` reads
`['adapter','fetchSizeLimit']` off the containing track, so a swapped-in
sub-adapter is measured against the *parent* adapter's declared limit. Inert
today — no MAF adapter declares the slot, so both tiers land on the display
config — but a tiered display whose sub-adapter declares one would gate against
the wrong number, and the fix is to override `adapterFetchSizeLimit` alongside
this getter rather than to teach the slot path about tiers.

That getter lets a tiered display keep `measuresBytesPreFlight` on for **both**
tiers. The alternative reads as obviously safe and is not: MAF used to spell the
swap as `measuresBytesPreFlight = !showSummary`, exempting the summary tier for
being the cheap one. Cheap *per base* — it carries no sequence — but a
`BigBedAdapter` read is still a whole-feature download, and `showSummary` is on
from 20kb to the whole genome. So the one path that escaped the gate was also the
one that could pull unbounded per-species records with no size quoted and no way
to decline. **Exempting a tier assumes it is bounded; measuring it doesn't have
to** — a genuinely small summary read sits orders of magnitude under
`fetchSizeLimit` and never banners.

**Nothing turns `measuresBytesPreFlight` off, and there is no reason to.** The
last user was LD, which turned it off for pre-computed adapters (PlinkLD\*)
because those aren't feature adapters and `CoreGetRegionByteEstimate` threw on
them. The RPC returns `undefined` for a non-feature adapter now —
"unmeasurable", the same answer a BigWig gives by not implementing
`getRegionByteSize` — and an undefined `estimatedFetchBytes` already keeps the
byte axis out of the verdict. The cost is one round trip per pre-computed LD
fetch; those adapters load lazily (`PlinkLDAdapterBase.loadConfigCached`), so
resolving one reads no file.

The general rule, which the deleted `alwaysRender` flag and this both broke: **a
display-side flag that exists to describe an *adapter* will be wrong for the next
adapter that display is pointed at.**

## Canvas folds the byte check into its fetch RPC

Canvas opts out of the pre-flight entirely — `measuresBytesPreFlight` stays false,
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

**The multi-region denominator mismatch is gone.** `commitGateMeasurements`
stores the per-region *max* bytes labelled with the *total* `visibleBp`, and
those used to be the two sides of a division: zooming into one chromosome shrank
the total span far faster than that chromosome's own bytes, so the banner
released a region the worker still refused. The span is a label now, not a
denominator, so a shrinking region set leaves the verdict alone and the next
measurement decides it on what is on screen. Pinned by "does not release on a
shrinking region set until a re-measure says so" in
`LinearMultiRowFeatureDisplay/derivedRegionTooLarge.test.ts`.

**The pre-flight has a smaller version of the same seam, inert for a different
reason.** `fetchRegions` measures `needed` — only the regions the loaded data
doesn't already cover — while `byteGateBlocksFetch` labels the result with the
whole `gateViewport.spanBp`. Nothing divides one by the other, so the banner
quotes what the adapter said about the regions actually being fetched. The one
reader spanning two measurements is `zoomIneffective`, which compares bytes taken
over region sets that may differ — so a zoom-in whose covered set *grows* can
read as "the bytes didn't fall", costing one measurement pair's zoom advice. It
self-corrects on the next, and threading a per-region anchor through would burden
the single-region case that is nearly every case.

`commitGateMeasurements` records the maximum per-region byte count, not the sum,
because every region is gated against the same per-region budget — a
multi-region view where each region individually fits should never be blanked
just because the regions add up.

## A budget has a scope

The rule above is not canvas's; it is the **byte budget's**, and it is the one
idea both halves of the gate now turn on. `gateByteLimit` answers "what may a
single region cost" — every region is checked against it, and a multi-region view
where each region individually fits must not be blanked by what they add up to.
So a region set reduces to one comparable number **by max**, and it does so in
both places: `commitGateMeasurements` over canvas's per-region fetches, and
`CoreGetRegionByteEstimate` for the pre-flight, which asks for it by name with
`scope: 'largestRegion'`.

**The scope used to be implicit, and the gate silently had the wrong one.**
`getRegionByteSize` merges and sums the index chunks across every region it is
handed, so it answers "what does the whole download cost" by construction — and
every caller inherited that reading without saying so. The pre-flight family
(alignments/MAF/MSV/LD/arc) therefore gated on the total while canvas gated on
the worst region, and the same file reached opposite verdicts through
`LinearMultiSampleVariantDisplay` and `LinearVariantDisplay`. Not hypothetical:
at whole-genome view `test_data/breakpoint/hs37d5.HG002…sv.vcf.gz` reads
5059k<!--m:byte-estimate-scope.70.wholeRequest--> against `VcfTabixAdapter`'s
5 Mb and banners, where its largest single region is
968k<!--m:byte-estimate-scope.70.largestRegion-->.

<!-- BEGIN GENERATED MEASUREMENT byte-estimate-scope -->

| regions | `wholeRequest` bytes | `largestRegion` bytes | whole/largest | per-region cost |
| ------- | -------------------- | --------------------- | ------------- | --------------- |
| 24      | 3969k                | 381k                  | 10.43x        | 1.00x           |
| 70      | **5059k**            | **968k**              | 5.23x         | 0.90x           |

<!-- END GENERATED MEASUREMENT byte-estimate-scope -->

Splitting the call costs nothing, which is why "neither converts cheaply" was the
wrong reading of it: `getRegionByteSize` already resolves chunks region by region
internally, and only the final merge is shared, so asking per region moves no
work (0.9-1.0x above). What the merge does buy is correctness for the *other*
budget — two regions sharing a BGZF block are charged for it once — and that
budget exists: "Save track data" pulls every region in one go, so
`exportByteLimit` is a bound on the whole download and `fetchTrackData` asks for
`scope: 'wholeRequest'`.

**`scope` is required, with no default.** Both readings are defensible and the
right one follows from how the budget is enforced, not from which is bigger — so
a third caller has to say which it is rather than inherit whichever the adapter
happened to compute.

**A fetch that measured no bytes at all writes nothing** — not
`bytes: undefined`. Two ways that happens, meaning the same thing: the adapter
offers no index estimate, or the fetch carried no `byteLimit` because
`gateActive` was false when it was issued (force-loaded). Neither is a
measurement, so neither may overwrite the last real one, nor reset the
zoom-effectiveness comparison, which needs two real ones. Publishing an empty
estimate wiped a good one, so putting a track back under the gate had no verdict
left to banner from and had to re-derive it from a fresh worker rejection.

**`ByteEstimate.bytes` is a `number`, and that is what holds the rule.** So
"unmeasurable" and "not measured yet" are one state — no stored estimate — and
each writer skips its write rather than publishing an empty one:
`commitGateMeasurements` when no region in the batch reported bytes,
`byteGateBlocksFetch` when the RPC answered `undefined`. The pre-flight half of
that was missing until 2026-08: it skipped the RPC when nothing could gate, which
covers force-load, but published the `undefined` an adapter with no index
estimate returns — the same wipe, arrived at by the other route. The two paths
now agree because the type gives them no third option. An all-stale batch
likewise commits nothing, so a superseded fetch can't wipe a good estimate.
Pinned by "keeps a good estimate when a batch measured no bytes" in
`LinearMultiRowFeatureDisplay/derivedRegionTooLarge.test.ts`.

What a batch *does* publish is `bytes` and the span they cover, and nothing else
— the budget they are compared against is the main-thread `gateByteLimit`, the
same getter that produced the worker's `resolvedByteLimit()`, so the two agree by
construction rather than by echoing a limit back across the boundary.

A measurement is handed over as `{ displayedRegionIndex, region, result }` — the
shape a fetch already holds — so neither canvas display does span arithmetic of
its own; features-per-bp is the gate's business.

Multi-row's fetch RPC (`MultiRowGetFeatures`) is **byte-only, in both
directions**: it takes a `byteLimit` and deliberately no `maxFeatureDensity`, and
returns `bytes` and deliberately no `featureCount`, because the display turns the
mixin's density axis off. The density gate that used to sit in that worker was
unreachable — `maxFeatureDensity` was always `undefined` — so it was removed
rather than left as a safety net that never fires. Re-enabling
`densityGateEnabled` there now fails to typecheck on both sides instead of
silently passing an argument the worker ignores and storing an answer the display
doesn't ask.

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

**Whether the axis is on is `RegionTooLargeMixin`'s too.** `densityGateEnabled`
lived here, out of `densityGateActive`'s reach, so "is the density axis on?" had
two spellings and its one consumer had to ask both. Overriding it to false still
drops the axis for a display painting into fixed lanes, such as multi-row,
leaving byte-only gating; the override lands on the base mixin now, beside the
`densityTooLarge` hook.

A display opts in by composing the mixin, calling `commitGateMeasurements` from
its fetch (with the `visibleBp` captured *before* the fetch), and overriding
`isCacheValid` to require committed data. That last part matters because a
too-large region is marked loaded but stores nothing, so without the override it
would never refetch once the gate released. The mixin's own `afterAttach` clears
stale stats on chromosome navigation, so a composing display can't forget it and
mis-gate a reused `displayedRegionIndex`.
`baseModel` keeps only what is genuinely its own: the per-region
`RenderFeatureData` fetch and `applyFetchResults`, its peptide-aware
`isCacheValid`, and `pruneRpcDataMapToVisible`, which trims
`densityStatsPerRegion` alongside `rpcDataMap`.

While `regionTooLarge` holds, `laidOutDataMap` returns empty, so the GPU upload
pushes nothing and there's no stale-feature flash.

## Force-load

Force-load is **one boolean for the whole track**: `forceLoadTrack`, a volatile on
`RegionTooLargeMixin`. `forceLoad()` sets it (via `setForceLoadTrack`) and calls
`reload()`; `gateExempt` ORs it with the declarative `forceLoad` config slot,
and everything downstream — the verdict, the worker byte budget, the worker
density budget — reads that one getter, through `gateActive` /
`densityGateActive`.

The banner quotes the estimated size before the click, so a user approving it has
the magnitude in front of them, and is then never asked again for that track. It
**survives chromosome navigation** (`clearByteEstimate` drops the estimate, not
the flag), because re-prompting per locus is the friction this replaced.

Volatile, so it never reaches a saved or shared session — a recipient would
otherwise download the same data with no warning and no visible reason. A page
load re-arms the gate. The durable, declarative escape hatch is the `forceLoad`
config slot, which is what `jbrowse-img --force` sets via the display snapshot,
so the gate is off before the first fetch. `setForceLoadTrack(false)` puts a
track back under the gate; nothing in the UI calls it, and it exists for tests
and for a plugin that wants it.

**This replaced a per-region, per-axis ceiling system.** The deleted machinery
(`userByteLimit`, `userFeatureDensityLimit`, `resolveForceLoadLimits`,
`forceLoadByteLimit`, `raiseLimitPast`, `FORCE_LOAD_HEADROOM`, two
`raiseForceLoadLimits` implementations) existed only to answer questions a
boolean doesn't raise. Each was a real bug or a guard against one, and all are
unrepresentable now rather than handled:

- **Which axis do we raise?** A tabix adapter reports an index-byte estimate even
  when the rejection was about *density*, so a dense-but-small region carried a
  small `bytes`. Adopting it as a ceiling installed a limit *below* the standing
  budget and then wrongly gated later regions that really were large. The fix was
  a "only raise the byte axis if it actually lifts the baseline" rule; now there is
  no ceiling to install.
- **Raise past which number?** The byte estimate is re-measured as the viewport
  moves, so a ceiling installed past one measurement was stale by the next —
  raising past the measured number left the banner up after a zoom-out, which
  shipped as an LD bug. The density axis had to read the debounced
  `coarseBpPerPx` reading, not a live one, or a click mid-zoom raised past a
  number the gate wasn't comparing against.
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

- `AUTO_FORCE_LOAD_BP` is the span below which the **density** axis stops gating.
  It lives here rather than on the LGV model — the view never read it — and
  `aboveForceLoadFloor` is its only comparison, with exactly three readers:
  `densityGateActive`, MAF's `showSummary`, and `gateByteLimit` (each reads that
  getter rather than the constant, so the threshold has one spelling). It is not
  exported from the plugin.

  **It is not a floor on the byte axis, and it used to be** — it is a budget
  tier there instead (§ The sub-floor budget tier). The floor's premise was "a
  small span is a small fetch", and the byte gate now checks that rather than
  assuming it — it measures at whatever is on screen. The premise fails in two
  directions and both are measured (2026-08-06, `bytesForRegions` against files
  in this repo):

  - **A second dimension the view doesn't shrink.** Cost is bytes per reference
    base **times** something zoom can't reduce. Row count: a 470-way MAF is
    6-8MB on the wire over a 40kb window. Depth: an amplicon or mitochondrial
    pileup is tens of MB in the same window. Either way it is several MB inside
    a gene-sized view the floor declined to look at. The per-display opt-out this
    needed (`gateBelowForceLoadFloor`) is gone, with nothing left to opt out of
    and no row-count or coverage threshold needed to keep it safe — a shallow
    alignment measures orders of magnitude under `fetchSizeLimit` and never
    banners.
  - **Index granularity, and it is not where 20kb suggested.** An index quotes
    whole blocks, so the estimate is flat wherever a query stops splitting bins —
    but *where* that happens is a property of the file, not of the linear index's
    16kb bin width:

    | file | flat from | value |
    | --- | --- | --- |
    | `volvox/volvox.maf.bed.gz` | 25kb up to 100kb | 306,719 |
    | `volvox/volvox.maf.bed.gz` | 12.5kb down | 213,443 |
    | `breakpoint/hs37d5.HG002…sv.vcf.gz` (chr1) | 7.8 Mb down | 15,408 |
    | `ce11.26way.chrI_subset.bed.gz` | 200bp to 50kb | 92,757 |

    The whole-genome VCF is flat 400x above where a 20kb floor would have looked,
    which is what killed the old reading of this constant ("roughly a tabix/BAI
    linear index's own resolution"): it described one dense file and generalized.
    It is also what makes `zoomCanReleaseGate` evidence rather than a threshold —
    see § Measurement follows the viewport.

  The density axis keeps the floor because its number is still a model — the last
  fetch's features-per-bp times the current bpPerPx — with no measurement under it
  at the span being judged, and because a scan of all 60 indexed files here found
  nothing with that axis on that would banner below 20kb
  ([ARCHITECTURAL_LIMITS.md](ARCHITECTURAL_LIMITS.md) § "The density axis is a
  model with no measurement under it").
- `resolveByteLimit({ adapterFetchSizeLimit, configFetchSizeLimit })` is the one
  place a *gate* byte budget gets resolved: the adapter's limit, else the display
  config. Those two arguments are the only inputs — force-load is not a tier
  here, it bypasses the comparison entirely. A non-positive adapter limit means
  "no opinion" and is skipped, guarding both a `0` and a negative sentinel.
  (`BaseTrackModel.exportByteLimit` applies the same adapter-tier rule to the
  save dialog from `packages/core`, which cannot import this; see the note at the
  top of this file.)

  Its single caller is `gateByteLimit` on `RegionTooLargeMixin` — what the verdict
  compares against, and what `resolvedByteLimit()` hands the worker, so the two
  cannot gate against different numbers. Read the getter; don't re-assemble the
  call: a second spelling of "the adapter's budget" is how a worker rejection with
  no banner happens, which is a blank display that never refetches. Three things
  read it, and all three do so under `gateActive`, because below
  `AUTO_FORCE_LOAD_BP` it resolves the raised sub-floor tier and an *unmeasured*
  view reads as below the floor: `resolvedByteLimit()`, `tooLargeStatus`, and
  MAF's `framesReadOverBudget`, which bounds the `mafFrames` overlay — a third
  file, fetched alongside whichever tier the gate is watching, that the banner
  never quotes.

  The adapter tier is `adapterFetchSizeLimit`, a **main-thread read of the
  adapter's own `fetchSizeLimit` slot**. It used to also ride back on the estimate
  (`byteEstimate.fetchSizeLimit`) — one value with two spellings and a precedence
  rule between them, so the field went away and the boundary carries bytes only.

  Read it as a slot **path off the live track config**
  (`readConfObject(track.configuration, ['adapter','fetchSizeLimit'])`), never off
  the display's `adapterConfig`: that is a snapshot, and a snapshot omits any slot
  at its default, so a BAM's declared 5 Mb reads back as `undefined` and the 1 Mb
  display default gates instead. See
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

Adapters with no `fetchSizeLimit` of their own, which therefore take whichever display row applies: `BedTabixAdapter`, `BgzipMafAdapter`, `BgzipTaffyAdapter`, `BigBedAdapter`, `BigMafAdapter`, `Gff3TabixAdapter`, `GtfTabixAdapter`, `MafTabixAdapter`.

<!-- GATED_BUDGETS END -->

  Generated from the schemas by `website/scripts/api-docs/generateGatedBudgetDocs.ts`,
  off the same scan `check-gated-adapter-budgets.ts` runs; hand-transcribed, it
  said CRAM 3 Mb for as long as it took someone to notice. Below the
  `AUTO_FORCE_LOAD_BP` span every row is multiplied by
  `SUB_FLOOR_BYTE_BUDGET_FACTOR` (§ The sub-floor budget tier).

  **An adapter that implements `getRegionByteSize` and declares no
  `fetchSizeLimit` inherits whichever display it lands under**, which is how
  three gaps got in: `SplitVcfTabixAdapter` gated five times tighter than the
  single-file VCF beside it, and `LinearMultiRowFeatureDisplay` and
  `LinearMafDisplay` sat on the base 1 Mb while `LinearBasicDisplay` read the
  same files at 5 Mb. All three are closed at 5 Mb for one reason: the index
  estimate is block-granular, so a single gene still pulls whole BGZF blocks and
  a tighter gate banners a view that isn't large.

  The last two bite hardest, because **neither has a second axis** — multi-row
  turns the density axis off and MAF never had one, so the byte budget is the
  only gate either has. MAF is also where the display value is the *whole*
  budget, since no MAF adapter declares one. On the base 1 Mb that bannered an
  hg38 100-way at a gene-sized window: `MAF_LARGE_BLOCKS.md` § "Fetch dominates
  at 470-way" measures a 40 kb buffered window at ~1.3–1.8 MB on the wire, a view
  the same doc measures at 38–55fps, refused for size. A 470-way is ~6–8 MB and
  still asks above the floor, which is where `summaryAdapter` is the answer.

  **You no longer have to remember that.** `scripts/check-gated-adapter-budgets.ts`
  scans for `getRegionByteSize` implementations, resolves each budget from its
  sibling `configSchema.ts`, and diffs against `scripts/gatedAdapterBudgets.json`
  — the table above, machine-checkable. A new gated adapter fails the `lint` job
  until someone writes down which budget it gets; `--write` regenerates the
  baseline. Inheriting the display's is a fine answer; the check only insists it
  be an answer. Its second half diffs the files overriding
  `measuresBytesPreFlight` / `measuresBytesInFetch` against `GATE_OPT_IN_SITES`,
  which is what closes the `LinearMafDisplay` shape — "inherits the display's"
  had been accepted without anything asking *which* display.

  It pins **sites rather than display names**. An adapter can be named from its
  path; a display's opt-in routinely cannot — two of the six are shared mixins
  serving several displays each, and canvas's covers three from a file named for
  none of them, so a directory-name heuristic emits a row called `shared` and
  silently omits `LinearBasicDisplay`. `DISPLAY_TIERS` carries the names, its
  values read from the schemas.

  Deliberately **not** an `autogen.ts` generator, though it looks like one:
  autogen would silently write a new adapter into the baseline, which is the
  decision the file exists to force. Same reason `abiBaseline.json` is
  hand-edited. A method declaration is what counts, so the gate's own callers
  don't register as adapters, and `BaseFeatureDataAdapter`'s `undefined` default
  is excluded — that default *is* the no-gate path.
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
estimate, no byte axis, no gate — however wide the view gets. They used to
declare `alwaysRender: true` on the estimate instead, which was unreachable by
construction (the only carrier of the flag was an estimate none of them
produced), so it was deleted rather than left as a safety net that can't fire —
the same call the unreachable multi-row density gate got.

BigMaf deliberately *does* implement it, since it returns full alignment rows
rather than a screen-reduced summary, and a whole-chromosome view can pull enough
packed MAF stanzas to hang the tab.

