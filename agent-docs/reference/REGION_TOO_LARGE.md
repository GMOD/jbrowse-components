---
name: region-too-large
description: The byte/density gate that raises the "region too large" banner and holds off the fetch — one measurement inside every gated fetch, one derived verdict, one boolean for force-load. Read when touching fetch gating or the too-large banner.
---

# The region-too-large gate

Before a gated display downloads a region, the worker asks the adapter's index
how many bytes that would be. Over budget → refuse, and the display shows the
"region too large" banner. Under → download. Canvas adds a second axis on the
same banner, too many *features* to draw. Force-load turns both off for the
track.

| Code | Path |
| --- | --- |
| `RegionTooLargeMixin` — the verdict, the budgets, force-load | `packages/display-kit/src/RegionTooLargeMixin.ts` |
| `nextGateState`, `resolveByteLimit`, `evaluateRegionTooLarge` | `packages/display-kit/src/regionTooLargeUtils.ts` |
| `measureRegionBytes`, `RegionTooLargeResult`, the budget vocabulary | `packages/core/src/rpc/byteBudget.ts` |
| `CanvasFeatureGateMixin` — the density axis | `plugins/canvas/src/shared/CanvasFeatureGateMixin.ts` |
| Adapter estimate | `BaseFeatureDataAdapter.getRegionByteSize` |
| The save dialog's own check, not the gate | `CoreGetRegionByteEstimate`, `fetchTrackData.ts`, `BaseTrackModel.exportByteLimit` |

Tests: `regionTooLargeUtils.test.ts` and `nextGateState.test.ts` for the pure
parts, `gateTruthTable.test.ts` for every getter against boundary values
(67,200 rows collapse to 7 banner-facing states, listed at the top of its golden
file), a `derivedRegionTooLarge.test.ts` per gated display, and the fetch
runners' own files for the commit and the refusal skip. History, and the bugs
each rule closed: [HISTORICAL.md](HISTORICAL.md).

## How the verdict is built

A display opts in with two lines: override `gateEnabled` to `true`, and pass
`byteLimit: self.resolvedByteLimit()` in its fetch RPC's args. Everything else
is the mixin's and the fetch runners'.

1. **The RPC measures first.** `measureRegionBytes` is the first await of every
   gated feature RPC (canvas's two, alignments, arc, both MAF tiers,
   multi-sample variant, LD): one index read per region, no features. Over
   budget, it answers a `RegionTooLargeResult` in place of the payload; under,
   the payload carries `bytes` too. Canvas then samples density before the
   download and refuses on that axis the same way.
2. **The runner commits.** `fetchEachRegion`, `fetchAllRegions`,
   `fetchRegionsBatched` and `runGlobalFetch` capture `gateFetchState()` before
   issuing — the viewport, whether the gate was active, and which adapter tier
   it was about — and call `commitFetchBytes(perRegionBytes, issued)` when the
   results land. A refused region is neither stored nor marked loaded.
3. **`nextGateState` applies the commit.** The per-region max is folded into
   `byteEstimate` when the fetch measured bytes, and the viewport is stamped
   as measured when the fetch was gated at issue — two halves, because a
   density refusal measures no bytes and an unmeasurable result must not wipe
   a good estimate. A measurement issued against another tier is dropped.
4. **The verdict is derived.** `regionTooLarge` is the stored estimate against
   `resolvedByteLimit()`, then `densityTooLarge` when `densityGateActive`. The
   banner reads `regionTooLargeReason`; `zoomCanReleaseGate` decides whether
   it offers "zoom in".

The estimate survives `clearAllRpcData()`, so a pan doesn't flicker the banner.
One autorun on the mixin, `ClearByteEstimateOnNavOrTierSwap`, drops it when
the estimate stops describing the fetch the display would make: chromosome
navigation (`displayedRegionIndex` is reused) and a tier swap
(`byteGateAdapterKey` changes — MAF's summary tier at 20 kb). `forceLoadTrack`
survives both.

**Neither budget is an RPC cache key.** `resolvedByteLimit()` and canvas's
`maxFeatureDensity` swing at 20 kb and on force-load, so they travel as
call-site arguments, never in `rpcProps()`, where a swing would be a full
refetch. Raising a budget releases the verdict and refetches the refused
region; lowering one re-banners from the stored measurement with no RPC.

**A refusal refuses what the fetch is granular in.** Per-region runners skip
the refused region and draw its neighbours; a batched fetch (variants, MAF, LD,
arc) refuses the whole payload. The banner quotes the largest region's bytes
labelled with the whole visible span — a label, never a denominator: dividing
by span releases a region the worker still refuses.

## Measurement follows the viewport

The verdict is the last measurement, so the question is when a new one is
taken, and the answer is always "the fetch takes it". Ungated, every fetch
measures before it downloads. Gated, the fetch skeletons skip only on
`gateSkipsMeasuredViewport` — the banner is up *and* the measurement already
describes the viewport on screen — so a blocked display runs one fetch per
settled viewport that stops at the gate: an index read on the byte axis, the
1 kb density probe on canvas. Skipping unconditionally freezes the estimate;
never skipping spins on the `fetchGeneration` bump.

A force-loaded fetch carries no budget, measures nothing, and stamps no
viewport; density stats still commit, so zooming back out re-gates.

**"Zoom in to see features" is measured too.** An index quotes whole blocks,
so whether zooming shrinks a file's fetch is a property of the file:
`volvox.maf.bed.gz` quotes the same 306,719 bytes from 25 kb to 100 kb, while a
whole-genome VCF's halvings buy 47%, 34%, 26%, 17%, 12%, 4%, 2%, 0%.
`nextByteEstimate` sets `zoomIneffective` when a span at most half the previous
comes back with more than 90% of its bytes, and the banner drops the advice on
the byte axis only — density is features per pixel and always falls with zoom.
Predicting this instead would sample the index at a ladder of spans, 18x the
one call on a whole-genome region set (2.4 s against 133 ms).

## The sub-floor budget tier

Below `AUTO_FORCE_LOAD_BP` (20 kb) the byte budget is multiplied by
`SUB_FLOOR_BYTE_BUDGET_FACTOR` (2). The gate keeps asking at every zoom — an
off-switch would be bypassable, since a region over budget below the floor was
over budget at 20 kb too — but against a larger number, because a user at a
gene-sized window navigated there deliberately. The tier exists because the
estimate stops moving below a BAI's 16 kb bins, so the user cannot act on the
banner's own advice:

<!-- BEGIN GENERATED MEASUREMENT subfloor-index-bin-bytes -->

| file                      | 1kb–10kb (flat) | 20kb   |
| ------------------------- | --------------- | ------ |
| volvox-ultradeep (~2000x) | **7442k**       | 14468k |
| volvox-sorted             | 257k            | 317k   |
| volvox long reads         | 102k            | 102k   |

<!-- END GENERATED MEASUREMENT subfloor-index-bin-bytes -->

2x is what the deepest file here needs: 7.44 Mb against BAM's 5 Mb becomes
7.44 against 10. A policy dial, not a derived constant. The density axis stops
gating below the floor instead, because its number is a model with no
measurement under it at that span, and no indexed file in the repo would trip
it there ([ARCHITECTURAL_LIMITS.md](ARCHITECTURAL_LIMITS.md)). MAF's
`showSummary` swaps to its summary adapter at the same span, and all three read
`aboveForceLoadFloor` rather than the constant.

## A budget has a scope

`gateByteLimit` is what one **region** may cost, so a region set reduces by
max — in `measureRegionBytes` worker-side and `commitFetchBytes` on the main
thread — and a multi-region view where every region fits is never refused for
their sum. `getRegionByteSize` itself sums merged chunks across whatever it is
handed, so `CoreGetRegionByteEstimate` takes a required `scope`: the save
dialog asks `wholeRequest`, because a save is one download. The two readings
differ by 5-10x: at whole-genome view
`test_data/breakpoint/hs37d5.HG002-SequelII-CCS.sv.vcf.gz` reads
5059k<!--m:byte-estimate-scope.70.wholeRequest--> against `VcfTabixAdapter`'s
5 Mb and banners, where its largest single region is
968k<!--m:byte-estimate-scope.70.largestRegion-->.

<!-- BEGIN GENERATED MEASUREMENT byte-estimate-scope -->

| regions | `wholeRequest` bytes | `largestRegion` bytes | whole/largest | per-region cost |
| ------- | -------------------- | --------------------- | ------------- | --------------- |
| 24      | 3969k                | 381k                  | 10.43x        | 1.00x           |
| 70      | **5059k**            | **968k**              | 5.23x         | 0.90x           |

<!-- END GENERATED MEASUREMENT byte-estimate-scope -->

Zero bytes is a measurement (an empty contig); an absent `bytes` is not, and
never overwrites a stored estimate. `overByteBudget` and `overDensityBudget`
are the shared comparisons, so the worker's refusal and the banner cannot
disagree at the boundary.

## Force-load

One volatile boolean for the whole track, `forceLoadTrack`, ORed with the
`forceLoad` config slot into `gateExempt`; every budget and both axes read it
through `gateActive`. The banner quotes the size before the click, and the
user is never asked again for that track. Volatile so a shared session cannot
carry a disabled gate; the slot is the durable form (`jbrowse-img --force`).
[ADR-074](../architecture-decision-records/adr-074-force-load-is-one-boolean-per-track.md)
is why a boolean rather than a raised ceiling.

## Shared primitives

**Hooks a display may override.** `gateEnabled` (a literal, checked by
`check-gated-adapter-budgets`); `densityTooLarge`; `byteGateAdapterPath`, which
a tiered display points at the sub-adapter it reads so the measurement and the
budget name one file; `byteGateAdapterConfig`, for an adapter config that is
synthesized rather than read. `fetchSizeLimit` and `forceLoad` are the mixin's
own slots (`regionTooLargeConfigSchemaFields`), spread into every composer's
schema. `CanvasFeatureGateMixin` contributes `gateEnabled` and
`densityGateEnabled`, so it must be composed after the mixin that declares
them; `no-restricted-syntax` fails the other order.

**The budget.** `resolveByteLimit` prefers the adapter's declared
`fetchSizeLimit`, read off the live track config at `byteGateAdapterPath`,
over the display's slot, and doubles it below the floor. Every consumer —
the worker, the banner, MAF's `framesReadOverBudget` — reads
`resolvedByteLimit()`. An adapter that implements `getRegionByteSize` and
declares no limit inherits its display's:

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

`scripts/check-gated-adapter-budgets.ts` fails when a new gated adapter or
gating display has no budget decided, and shares its scan with the generator
of that table. The 5 Mb rows exist because the index estimate is block-granular
— a gene-sized window still pulls whole BGZF blocks, and on 1 Mb an hg38
100-way MAF banners at a locus that renders at 38–55 fps
(`MAF_LARGE_BLOCKS.md`).

**Why the byte axis has no floor.** Cost is bytes per base times something
zoom cannot shrink — a 470-way MAF is 6-8 MB over 40 kb, an amplicon pileup
tens of MB — and where the estimate goes flat is a property of the file, not
of the index's bin width:

<!-- BEGIN GENERATED MEASUREMENT index-estimate-flat-spans -->

| file                                                    | flat from        | value |
| ------------------------------------------------------- | ---------------- | ----- |
| `volvox/volvox.maf.bed.gz`                              | 25kb up to 100kb | 307k  |
| `volvox/volvox.maf.bed.gz`                              | 12.5kb down      | 213k  |
| `breakpoint/hs37d5.HG002-SequelII-CCS.sv.vcf.gz` (chr1) | **7.8 Mb down**  | 15k   |
| `ce11.26way.chrI_subset.bed.gz`                         | 200bp to 50kb    | 93k   |

<!-- END GENERATED MEASUREMENT index-estimate-flat-spans -->

**What is not gated.** Self-summarizing adapters (BigWig, HiC, sequence)
implement no `getRegionByteSize` and need no exemption. `LinearManhattanDisplay`
never opts in, by decision: its case is a genome-wide summary-stats view.
`LGVSyntenyDisplay` inherits alignments' opt-in but no comparative adapter
implements the estimate, so its gate is inert
([ideas/synteny-byte-gate.md](../ideas/synteny-byte-gate.md)). MAF's
`mafFrames` overlay is bounded privately by `framesReadOverBudget` and never
banners.
