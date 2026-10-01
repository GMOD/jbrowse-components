---
name: region-too-large
description: The byte/density gate that raises the "region too large" banner and holds off the fetch — one measurement inside every gated fetch, one derived verdict, one boolean for force-load. Read when touching fetch gating or the too-large banner.
kind: spec
---

# The region-too-large gate

A gated display's worker asks the adapter's index for a region's byte size
before downloading. Over budget refuses and shows the "region too large"
banner; canvas adds a feature-density axis on the same banner. Force-load turns
both off for the track.

| Code | Path |
| --- | --- |
| `RegionTooLargeMixin` — the verdict, the budgets, force-load | `packages/display-kit/src/RegionTooLargeMixin.ts` |
| `nextGateState`, `resolveByteLimit`, `evaluateRegionTooLarge` | `packages/display-kit/src/regionTooLargeUtils.ts` |
| `measureRegionBytes`, `RegionTooLargeResult`, the budget vocabulary | `packages/core/src/rpc/byteBudget.ts` |
| `gateBatch` — commit-before-cancel for a refusing batch | `packages/display-kit/src/fetchEachRegion.ts` |
| `CanvasFeatureGateMixin` — the density axis | `plugins/canvas/src/shared/CanvasFeatureGateMixin.ts` |
| Adapter estimate | `BaseFeatureDataAdapter.getRegionByteSize` |
| The save dialog's own check, not the gate | `CoreGetRegionByteEstimate`, `fetchTrackData.ts`, `BaseTrackModel.exportByteLimit` |

![What one gated fetch decides, and what the first refusal does to the batch](diagrams/region-too-large-gate.svg)

## How the verdict is built

A display opts in with two lines: override `gateEnabled` to `true`, and pass
`byteLimit: self.resolvedByteLimit()` in its fetch RPC's args. `measureRegionBytes`
runs first in every gated feature RPC and answers a `RegionTooLargeResult` over
budget. Each runner captures `gateFetchState()` at issue and calls
`commitFetchBytes`; `nextGateState` folds the result in. A refused region is
neither stored nor marked loaded. Bytes and the measured viewport commit
separately, because a density refusal measures no bytes and an unmeasurable
result must not wipe a good estimate. A measurement issued against another tier
is dropped. `regionTooLarge` is the stored estimate against `resolvedByteLimit()`,
then `densityTooLarge`.

The estimate survives `clearAllRpcData()`, so a pan doesn't flicker the banner;
`ClearGateMeasurementsOnNavOrTierSwap` drops it on chromosome navigation and
tier swap.

**Neither budget is an RPC cache key.** `resolvedByteLimit()` and canvas's
`maxFeatureDensity` travel as call-site arguments, never in `rpcProps()`, where
a swing at 20 kb or on force-load would be a full refetch. Raising a budget
refetches the refused region; lowering one re-banners from the stored
measurement with no RPC.

**A refusal refuses what the fetch is granular in.** `fetchEachRegion` stops
the batch at the first refusal: the verdict is a display-wide max, so no sibling
can change it. `fetchRegionsBatched` refuses its one payload; `fetchAllRegions`
stores the regions that fit, and no gated display uses it
([ideas/waiting-on-a-call/per-region-banner-for-a-mixed-region-set.md](../ideas/waiting-on-a-call/per-region-banner-for-a-mixed-region-set.md)).
MAF's first refusal aborts a batch-scoped signal (`refusalScope`).

**Commit before cancelling.** Cancelling first strands the verdict and loops
the fetch forever; `gateBatch`'s docstring has the mechanism. The density axis
has the same trap in `fetchGatedRegions`'s `onComplete`.

**A measurement carries whether it covers the set.** An early-stopped batch
reports a max over the regions that won the race. `partial` travels beside
`bytes` (`measurementPartial`), and `nextByteEstimate` leaves `zoomIneffective`
unchanged on a partial one. The banner labels bytes with the whole visible span,
never as a denominator: dividing by span releases a region the worker still
refuses.

## Measurement follows the viewport

The verdict is the last measurement, and the fetch always takes the next one.
Ungated, every fetch measures before it downloads. Gated, the fetch skeletons
skip only on `gateSkipsMeasuredViewport` — the banner is up *and* the
measurement already describes the viewport on screen — so a blocked display
runs one fetch per settled viewport that stops at the gate. Skipping
unconditionally freezes the estimate; never skipping spins on the
`fetchGeneration` bump.

A force-loaded fetch carries no budget, measures nothing, and stamps no
viewport; density stats still commit.

**"Zoom in to see features" is measured.** `nextByteEstimate` sets
`zoomIneffective` when a span at most half the previous returns over 90% of its
bytes, and the banner drops the advice on the byte axis only. Predicting it by
sampling the index at a ladder of spans cost ~18x the single call and was
declined.

## The density probe

`calculateFeatureDensityStats` (`stats.ts`) grows a window from a point 25% into
the region. `densityProbeGate` can stop it once an *admitted* count reads
`DENSITY_SETTLE_MARGIN` times over budget; growth still tests the raw count, so
a filtered view is not refused on a population it filters away. A budget that
cannot size a window (`0`, NaN from jexl) yields no gate. One window is one draw
from a clumpy distribution:

<!-- BEGIN GENERATED MEASUREMENT density-probe-sample-point -->

_Generated by `pnpm autogen` — edit the source, not this block._

| chromosome / zoom      | truth (feat/px) | at the 25% point | min / median / max over offsets | offsets settling |
| ---------------------- | --------------- | ---------------- | ------------------------------- | ---------------- |
| chr1 whole-genome      | 103.4           | 95.5             | 0.5 / 96.0 / 203.5              | **18/19**        |
| chr10 whole-genome     | 94.4            | 78.5             | 33.0 / 90.5 / 150.0             | **19/19**        |
| chr17 whole-genome     | 166.6           | 157.5            | 46.0 / 159.0 / 299.0            | **19/19**        |
| chr1 whole-chromosome  | 8.3             | 10.5             | 0.5 / 7.5 / 17.0                | 15/19            |
| chr10 whole-chromosome | 4.1             | 2.5              | 1.0 / 4.0 / 13.5                | 9/19             |
| chr17 whole-chromosome | 4.5             | 9.5              | 0.5 / 4.5 / 27.5                | 12/19            |

<!-- END GENERATED MEASUREMENT density-probe-sample-point -->

**A settled verdict is confirmed at `DENSITY_CONFIRM_POINT`** on the lower of
two readings, when the first window holds fewer than
`DENSITY_SAMPLE_MIN_FEATURES` raw features. Without it, a sparse track with a
cluster at the 25% mark banners permanently on the user's own file, silently.

**Not running the probe is what makes it cheap; shrinking the window is not.**
A probe's floor is one bgzf chunk. For tabix GFF3/GTF the probe passes
`topLevelOnly` so `readTabixLinesRedispatched` skips flank expansion, which on
an NCBI `GCF_*_genomic.gff.gz` otherwise parses the whole chromosome. An
incremental exact count is declined: the tabix chunk is in the buffer before the
first feature emits, so nothing is left to abort.

## The sub-floor budget tier

Below `AUTO_FORCE_LOAD_BP` the byte budget is multiplied by
`SUB_FLOOR_BYTE_BUDGET_FACTOR`. An off-switch would be bypassable, since a
region over budget below the floor was over budget at the floor too; but the
estimate stops moving below a BAI's 16 kb bins, so the banner's advice is
unactionable:

<!-- BEGIN GENERATED MEASUREMENT subfloor-index-bin-bytes -->

_Generated by `pnpm autogen` — edit the source, not this block._

| file                      | 1kb–10kb (flat) | 20kb   |
| ------------------------- | --------------- | ------ |
| volvox-ultradeep (~2000x) | **7442k**       | 14468k |
| volvox-sorted             | 257k            | 317k   |
| volvox long reads         | 102k            | 102k   |

<!-- END GENERATED MEASUREMENT subfloor-index-bin-bytes -->

The factor is a policy dial sized to the deepest file above. The density axis
stops gating below the floor instead, because its number is an extrapolation
([ARCHITECTURAL_LIMITS.md](ARCHITECTURAL_LIMITS.md)). MAF's summary swap and both
gates read `aboveForceLoadFloor`, not the constant.

## A budget has a scope

`gateByteLimit` is what one **region** may cost, so a region set reduces by max
(`measureRegionBytes` worker-side, `commitFetchBytes` main-side) and a view
where every region fits is never refused for their sum.
`CoreGetRegionByteEstimate` takes a required `scope`: the save dialog asks
`wholeRequest`, because a save is one download.

<!-- BEGIN GENERATED MEASUREMENT byte-estimate-scope -->

_Generated by `pnpm autogen` — edit the source, not this block._

| regions | `wholeRequest` bytes | `largestRegion` bytes | whole/largest | per-region cost |
| ------- | -------------------- | --------------------- | ------------- | --------------- |
| 24      | 3969k                | 381k                  | 10.43x        | 1.00x           |
| 70      | **5059k**            | **968k**              | 5.23x         | 0.90x           |

<!-- END GENERATED MEASUREMENT byte-estimate-scope -->

Zero bytes is a measurement (an empty contig); an absent `bytes` is not, and
never overwrites a stored estimate. `overByteBudget` and `overDensityBudget` are
the shared comparisons, so worker and banner agree at the boundary.

## The density tier

Where the verdict refuses, a display whose adapter carries a `densityAdapter`
sidecar draws features per bin in the banner's place.
[ADR-102](../architecture-decision-records/adr-102-the-density-tier-swaps-on-the-gates-verdict.md)
has the decision. Owners: `CoarseTierMixin` and `DensityTierMixin`
(`packages/display-kit/src/`), `densityToUniformBins` (`alignments-core`),
`CoreGetFeatureDensity`, the bands
([ADR-117](../architecture-decision-records/adr-117-the-density-tier-is-a-mark-layer.md)),
`jbrowse make-density`.

- **The swap is the verdict, plus an optional threshold** (`coarseTierActive`).
  Nothing above changes: a refused fetch still stops at the measurement and
  `regionTooLarge` still reads true; only the chrome and the drawing differ.
- **A bin is a level, not a count.** A bigWig's zoom levels are means, so
  `make-density` writes every base of every reference (empty bins included)
  and `densityToUniformBins` takes the area-weighted mean. A sidecar with empty
  bins omitted reads, zoomed out, as the mean over occupied bins only — flat
  and wrong.
- **The stand-in is total, and it fetches nothing.** The display empties its
  feature data, and `CoarseTierMixin.fetchSuspended` feeds the fetch plan:
  forced `density` downloads nothing; `auto` under a refusal keeps its
  measurement pass, which is what the gate releases through.
- **The bins never touch the fetch tiers.** They live in the tier's own
  `regionDataMap`, and the mode slot never enters `rpcProps()`, so the swap
  drops no loaded region. `coarseTierCovers` declines a re-read while the
  buffered span still covers the view.
- **A gated coarse tier is the gate's measurement pass.** MAF's summary read is
  a whole-feature download, so it sets `coarseTierGated`: `byteGateAdapterPath`
  points at the summary adapter while the tier is up and the detail fetch
  stands down. The density read commits no bytes.

## Force-load

One volatile boolean for the whole track, `forceLoadTrack`, ORed with the
`forceLoad` slot into `gateExempt`; every budget and both axes read it through
`gateActive`. Nothing clears it, so zooming back out does not re-gate. Volatile
so a shared session cannot carry a disabled gate; the slot is the durable form
(`jbrowse-img --force`). Where the density band replaced the banner, the band's
submenu carries the button (`densityTierMenuItems`).
[ADR-074](../architecture-decision-records/adr-074-force-load-is-one-boolean-per-track.md)
is why a boolean rather than a raised ceiling.

## Shared primitives

**Hooks a display may override.** `gateEnabled` (a literal, checked by
`check-gated-adapter-budgets`); `densityTooLarge`; `byteGateAdapterPath`;
`byteGateAdapterConfig`. **`CanvasFeatureGateMixin` must be composed after the
mixin that declares its two members**, or `types.compose` hands them back to the
`false` defaults and the gate is silently off; `no-restricted-syntax` fails the
other order.

**The budget.** `resolveByteLimit` prefers the adapter's declared
`fetchSizeLimit` at `byteGateAdapterPath` over the display's slot and doubles it
below the floor. Consumers read `resolvedByteLimit()`.

<!-- GATED_BUDGETS START -->

_Generated by `pnpm autogen` — edit the source, not this block._

<!-- prettier-ignore -->
| tier | value | applies to |
| --- | --- | --- |
| adapter slot | 5 Mb | `BamAdapter`, `CramAdapter`, `SplitVcfTabixAdapter`, `VcfTabixAdapter` — whatever display they are under |
| display slot | 5 Mb | `LinearBasicDisplay` — every inheriting adapter under this display |
| display slot | 5 Mb | `LinearMultiRowFeatureDisplay` — every inheriting adapter under this display |
| display slot | 5 Mb | `LinearMafDisplay` — every MAF adapter, none of which declares its own, so this is the whole budget |
| display slot | 1 Mb | `baseLinearDisplayConfigSchema` — every inheriting adapter under every other display |

Adapters with no `fetchSizeLimit` of their own, which therefore take whichever display row applies: `BedTabixAdapter`, `BgzipMafAdapter`, `BgzipTaffyAdapter`, `BigBedAdapter`, `BigMafAdapter`, `GWASAdapter`, `Gff3TabixAdapter`, `GtfTabixAdapter`, `HtsgetBamAdapter`, `MafTabixAdapter`, `MultiWiggleAdapter`.

<!-- GATED_BUDGETS END -->

`scripts/check-gated-adapter-budgets.ts` fails when a gated adapter or display
has no budget decided. The 5 Mb rows exist because the index estimate is
block-granular, and on 1 Mb an hg38 100-way MAF banners at a locus that renders
smoothly (`MAF_LARGE_BLOCKS.md`).

**The byte axis has no floor.** Where the estimate goes flat is a property of the file:

<!-- BEGIN GENERATED MEASUREMENT index-estimate-flat-spans -->

_Generated by `pnpm autogen` — edit the source, not this block._

| file                                                    | flat from        | value |
| ------------------------------------------------------- | ---------------- | ----- |
| `volvox/volvox.maf.bed.gz`                              | 25kb up to 100kb | 307k  |
| `volvox/volvox.maf.bed.gz`                              | 12.5kb down      | 213k  |
| `breakpoint/hs37d5.HG002-SequelII-CCS.sv.vcf.gz` (chr1) | **7.8 Mb down**  | 15k   |
| `ce11.26way.chrI_subset.bed.gz`                         | 200bp to 50kb    | 93k   |

<!-- END GENERATED MEASUREMENT index-estimate-flat-spans -->

## What is not gated

- Self-summarizing adapters (BigWig, HiC, sequence) implement no
  `getRegionByteSize`; a BigWig estimate (written and reverted) would gate a
  fetch the tier already bounds
  ([ADR-123](../architecture-decision-records/adr-123-a-mark-reads-a-bigwig-at-the-rungs-floor.md)).
- `LGVSyntenyDisplay`'s gate is inert: no comparative adapter implements the
  estimate
  ([ideas/waiting-on-a-call/synteny-byte-gate.md](../ideas/waiting-on-a-call/synteny-byte-gate.md)).
- `LDTrackDisplay` and `LinearManhattanDisplay` opt out; `HtsgetBamAdapter` has
  no `bam.index`, so it answers `undefined` (`gateDeclined.test.ts`).
