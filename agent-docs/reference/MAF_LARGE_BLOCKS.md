---
name: maf-large-blocks
description: Why a MAF-tabix track with very long alignment blocks is slow and can crash, why "clip to the visible region" is the wrong fix, and the three options that are not. Read before touching MafTabixAdapter fetch cost or proposing block clipping.
---

# MAF-tabix and megabase alignment blocks

Design notes for unfinished work. What shipped is the sub-pixel decimation
(commit `perf(maf): decimate base cells once they go sub-pixel`); that fixed
**render** cost at zoom-out and nothing about **fetch** cost. This document is
the fetch half.

## Confirm the premise first

This whole design assumes the user's blocks really are enormous. That was never
confirmed — it started as speculation from a bug report ("plugins/maf is slow and
crashes", no sample data, "potentially each alignment is long"). One line
settles it:

```sh
bgzip -dc their.bed.gz | awk '{print $3-$2}' | sort -n | tail -5
```

If the max block is a few kb, **stop** — blocks are not the problem and
everything below is wasted effort. Look instead at the worker-side allocation
noted in "Still open" at the bottom.

For calibration, run the same line against the files already in this repo
(measured 2026-07-29):

| file | blocks | median | max |
| --- | --- | --- | --- |
| `test_data/ce11.26way.chrI_subset.bed.gz` | 160 | 7bp | 1228bp |
| `test_data/volvox/volvox.maf.bed.gz` | 501 | 100bp | 100bp |
| `test_data/mafperf/synth.maf.bed.gz` | 433 | 1075bp | 1995bp |

The widest single line across all three is 20kb, so **nothing in-tree
reproduces this** — a reproducing file has to come from the reporter. Long
blocks are a property of the *producer* (`hal2maf` without chunking, pairwise
chains/nets converted to MAF), not of MAF generally.

## Why one long block is expensive at every layer

MAF-tabix is one BED line per alignment block, with every species' gapped
sequence joined into column 6 (`maf_to_bed.py`, `MafTabixAdapter.ts:56`). Tabix
is line-oriented: a query returns **whole overlapping lines**. So a 1Mb block
across 10 species is ~10MB of sequence on a single line, and a query touching
one base of it pulls all of it — downloads it, decompresses it, splits it into
strings, encodes it to `Uint8Array`s, and ships it to the main thread.

Zooming in does not help. The cost is quantized by block, not by view.

## The byte gate actively lies here

This is the part worth internalizing, and it is not MAF-specific.

`RegionTooLargeMixin` caches **one** measurement plus the span it covered, then
rescales linearly — `bytes * visibleBp / measuredSpanBp`
(`regionTooLargeUtils.ts:109`). That assumes bytes are proportional to span.
With block-quantized formats they are not: zooming 100x into a megabase block
divides the *estimate* by 100 while the real cost is unchanged.

On top of that, `gateActive` (`RegionTooLargeMixin.ts`) required
`aboveForceLoadFloor` — `visibleBp >= AUTO_FORCE_LOAD_BP` (20kb,
`regionTooLargeUtils.ts:9`). The floor's premise is "a small span is a small
fetch," which is exactly what a long block violates.

Net: the gate reported "tiny" precisely when the fetch was catastrophic, and it
wasn't consulted anyway.

**The second half of that is fixed** — `LinearMafDisplay` sets
`gateBelowForceLoadFloor`, so the gate is now on duty at every zoom (option 3
below). The first half is not: the number it compares down there is still a
linear rescale, so on a block-quantized file it can still be an under-report.
The fix helps the common case regardless, because for a deep alignment the
rescale is roughly right and the estimate is genuinely large.

## Rejected: clip blocks to the visible region

Recorded so it doesn't get re-proposed. The decisive argument:

**Clipping and splitting need the identical coordinate arithmetic.** Mapping a
bp window to a column range and recomputing each species' `start`/`size` for the
slice is what a splitter does. Splitting does it once, offline, where it can be
checked; clipping does it on every fetch, in the hot path.

And clipping only pays off *after* the expensive layers:

- The line is downloaded, decompressed and string-split before anything can be
  clipped, so network and parse cost are unchanged.
- Finding the column range for a bp window means walking columns to account for
  reference gaps — the same O(columns) walk that is the expensive part.
- Clipped region data is zoom-dependent, so `isBlockCovered`
  (`MultiRegionDisplayMixin.ts:451`) can no longer reuse a loaded region across
  zoom. Today zooming within a loaded region costs nothing; clipping makes it
  refetch.
- Tooltips and FASTA export read per-species `chr`/`start`/`strand` off the
  block; clipped blocks silently report wrong coordinates unless those are
  re-derived — which is, again, the splitter's arithmetic.

## The three options that do work

### 1. TAF, structurally (best long-term)

`BgzipTaffyAdapter` already ships. Its `.tai` index maps `(chr, chrStart) →
virtual offset` *within* the alignment (`taiIndex.ts`), and `getFeatures` seeks
to the query start and reads a bounded run of bgzf blocks
(`BgzipTaffyAdapter.ts:194-223`). A megabase alignment is not an atomic unit —
cost is O(visible span) at every layer. **This problem cannot occur in TAF.**

If long blocks are confirmed, "convert to TAF" is the honest recommendation and
the MAF docs should say so.

### 2. Split at conversion time

We own `scripts/maf_to_bed.py` — every tutorial points at it, and it currently
emits one BED line per MAF block verbatim (`bed_line`, lines 32-41). Add
`--max-ref-span` (default ~10kb).

Splitting is simpler than it looks and **strand-safe without a special case**:
MAF `-` rows measure `start` along the reverse complement, and within that frame
the alignment still reads left-to-right, so `start_right = start_left +
size_left` holds for both strands.

**Cut only at "clean" columns** — columns where no row, reference included, has
a gap. This makes the split lossless for display:

- A cut inside a reference-gap run would split one insertion marker in two.
- A cut inside a species' gap run would split a deletion, because
  `forEachDeletion` computes runs strictly within one block
  (`forEachDeletion.ts`).

With ~5% gaps across 10 species roughly 60% of columns are clean, so a clean
column is always within a few bp of the target. Fall back to the nearest
reference-non-gap column when a gappy stretch has none nearby.

FASTA export needs no change — `processFeaturesToFasta` lays rows out in
reference-coordinate space across features, so it is already block-count
agnostic.

The systemic payoff is larger than the cost reduction: once blocks are bounded,
bytes really are proportional to span, **so the gate's linear model becomes
correct**. Splitting restores the assumption the whole gating system is built on.

### 3. Make the gate honest, for files that already exist

Two contained changes, both worth doing on their own merits since the rescaling
bug applies to any format with unbounded feature size:

- **Opt out of rescaling.** **Still unbuilt, and the sketch that used to sit here
  — "invalidate the cached `byteEstimate` on view change so the pre-flight
  re-runs" — does not work.** See the next section before building anything.
- ~~**Let the gate fire below `AUTO_FORCE_LOAD_BP`** when the estimate is over
  budget.~~ **Done** — `gateBelowForceLoadFloor` on `RegionTooLargeMixin`, an
  opt-in defaulting false that removes the floor term from `gateActive` and
  nothing else; `LinearMafDisplay` sets it. Note this landed for the **row-count**
  reason rather than the block-size one (see "Fetch dominates at 470-way" below):
  a 470-way is several MB inside a gene-sized window whatever its block size, and
  that is the common case. It does not fix the rescaling half above — the gate is
  now on duty below the floor, but the number it compares is still a rescale of a
  measurement taken at another zoom, so a megabase-block tabix MAF can still be
  under-reported down there.

Must be an **opt-in**, not a change to the shared verdict — canvas and LD compose
`RegionTooLargeMixin` too. (`LinearAlignmentsDisplay` has since taken the same
opt-in for the depth version of the same premise break; see
REGION_TOO_LARGE.md § `gateBelowForceLoadFloor`.)

Result: zooming into a megabase block shows "Requested too much data (47 Mb)"
and the user chooses, instead of a 30-second freeze. Pair it with a cheap safety
valve in the adapter: if a single line's payload exceeds a budget, fail with a
message naming the block and pointing at the splitter rather than OOMing.

### Why the rescale can't just be removed

Measured 2026-08-06 with `bytesForRegions` against files in this repo. The
estimate is not approximately proportional to span down there — it is **flat**,
because an index reports whole blocks:

| file | 200bp | 1kb | 5kb | 16kb | 50kb |
| --- | --- | --- | --- | --- | --- |
| `volvox/volvox.maf.bed.gz` | 213,443 | 213,443 | 213,443 | 238,685 | 306,719 |
| `breakpoint/hs37d5.HG002…sv.vcf.gz` | 15,408 | 15,408 | 15,408 | 15,408 | 15,408 |
| `ce11.26way.chrI_subset.bed.gz` | 92,757 | 92,757 | 92,757 | 92,757 | 92,757 |

Constant until the tabix linear index's 16kb bins start splitting — i.e. flat
across exactly the range `gateBelowForceLoadFloor` just switched the gate on for.
BigBed is the same shape (`getBlockSizeForRangeMulti` sums whole R-tree leaf
blocks). This is *why* the ce11 26-way never gates, incidentally: 92,757 bytes
against a 1 Mb cap, two orders of magnitude of headroom at every zoom.

The consequence for an over-budget track was: the rescale releases the banner on
zoom-in, the pre-flight re-measures the same flat number, the banner returns. One
aborted fetch cycle and a banner flash per zoom step, never settling. **It never
downloads** — `byteGateBlocksFetch` re-measures before `work()` — so this cost a
round trip, not data. That was the wart, and the honest outcome underneath it
(force-load or nothing, for a genuinely unaffordable file) is correct.

**Fixed**, by the third option below. Two obvious fixes, both wrong:

- **"Stop rescaling; use the measurement as-is."** Deadlocks. The estimate only
  updates inside `byteGateBlocksFetch`, which only runs from a fetch, which
  `FetchVisibleRegions` skips while `regionTooLarge` holds. With no downward
  rescale nothing ever re-measures, so a BAM gated at 200kb stays gated at 2kb
  forever. **The downward rescale is the release mechanism**, not a convenience.
- **"Invalidate the estimate on view change so the pre-flight re-runs."** No
  deadlock, same flash: a dropped estimate reads as "not too large", so the
  banner still disappears, a fetch still starts, and the scrim still shows before
  the new measurement puts the banner back.

Both of those read as "the rescale is all-or-nothing", which is the premise that
was wrong. **The fix is to floor both spans** in
`rescaleByteEstimateToVisibleSpan`:

```
bytes × max(visibleBp, AUTO_FORCE_LOAD_BP) / max(measuredSpanBp, AUTO_FORCE_LOAD_BP)
```

The proportional model is kept exactly where the table above says it holds, and
the estimate goes flat exactly where the index is. Every rescale at or above the
floor is untouched, so the release mechanism is intact and there is no deadlock;
below the floor the verdict is simply the verdict at 20kb, which is what the
monotonicity of index estimates said it always was. Flooring the *denominator*
too is not cosmetic — without it an estimate captured below the floor gets scaled
up by the ratio of the floor to the span it was measured at.

The same constant serves both uses deliberately: the floor was chosen at roughly
the index's own resolution, which is what makes it both a reasonable place to
stop gating and the exact place the estimate stops resolving. A second constant
could only drift, and the drift would mean nothing.

The earlier proposal here was to **decouple measuring from fetching**: re-measure
on viewport change while the gate is blocking, so the verdict updates without a
fetch cycle having to be started and abandoned. That is an autorun on the fetch
mixins (not on `RegionTooLargeMixin`, which has non-LGV consumers and must stay
view-only). It was never built — a real change to shared fetch machinery for a
flash on tracks that are already force-load-only — and the floor removes the
reason to build it: there is no longer a fetch cycle being started and abandoned
down there to need re-measuring out of.

## Recommendation

(2) + (3), with (1) documented as the better format. (2) fixes it properly for
anyone who can regenerate; (3) turns a freeze into an informed choice for
everyone else.

## Still open (the other half of the original report)

Independent of block size, and possibly the real cause of "crashes":

- ~~`computeMafCoverage` builds a `MismatchEntry` object per mismatch per row~~
  **Done** (`perf(maf): emit worker mismatches as typed arrays instead of
  objects`). It now writes the packed arrays directly, so the per-base-per-row
  object rate in the worker is gone. Still a memory fix, not a speed one.
- ~~`MafTabixAdapter` has no cheap zoom-out path: `showSummary` requires a
  `summaryAdapter`, which is BigMaf-only~~ **Done** (`feat(maf): give a tabix
  MAF the zoom-out tier only bigMaf had`). `MafTabixAdapter` now declares the
  same `summaryAdapter` slot and implements `getSummaryFeatures` through the
  shared `mafSummaryFeatures`; point it at a `BedTabixAdapter` over the BED
  `maf2bed --summary` writes in the same pass, or at a `bigMafSummary.bb`.
  Still opt-in — a tabix track configured without the slot has no zoom-out path
  and force-load remains the only way past the gate.

## Render cost is no longer the open question

Worth stating so the next person doesn't re-profile it. Four passes have landed:
the sub-pixel decimation on the base cells, `IdentityColumns` on the per-row
identity plot (2.4-3.9x, and the bp bound on the conservation band), the
source-chromosome ranks moved to a memoized computed, and the deletion overlay
gated on what its label can actually fit (679k markers built and 0 drawn per
frame on a 26-species view — the one item here that was on the *default* path).

The deletion one is the lesson worth carrying: the decimation pass fixed the
base-cell encode and stopped at the encode boundary, while a sibling getter kept
doing a full per-cell scan at the same zooms. When something here gets faster,
check the overlays computing alongside it before declaring the zoom level cheap.

A sixth pass has since landed on the same theme. `paintedBpRange` had been
applied to three Canvas2D painters and to nothing else, so every marker overlay
(`computeVisibleInsertions` / `Deletions` / `EmptyLines` / `Inversions` /
`Labels`) still walked the whole **buffered** region while `visibleRegions`
covers only what is on screen. `eachVisibleRegion` now yields `bpLo`/`bpHi` —
the marker-side twin of `paintedBpRange` — and each helper skips a block before
walking it; `drawMafBlocks`, the one painter the earlier pass missed, took the
`paintedBpRange` bound it should have had. Three cheaper things went with it:

- **`blockHasRefGap`.** A block whose `endBp - startBp` equals its column count
  has no reference-gap column, so no row of it can carry an insertion. 66% of
  blocks in `test_data/ce11.26way.chrI_subset.bed.gz` qualify, and the insertion
  overlay had been re-deriving that per row by walking every column to find
  nothing.
- **`makeRowFlank` builds its per-block edge sets lazily.** Eager was two `Set`s
  per block of the buffered region — ~85k sets a frame — most for blocks the
  now-culled walk never asks about.
- **The inversion consensus is a memoized computed** (`inversionConsensus`),
  like `sourceChromRanks` before it. It is deliberately over every *loaded*
  region so it stays put while panning, which is exactly what makes recomputing
  it per frame the wrong place for it.

Measured on a synthetic ce11-26-way shape (54k blocks, 26 rows, 360kb buffered /
180kb visible): insertions 463ms -> 168ms, deletions 1.39s -> 0.72s.

`findRowHoverAtBp` and the codon spine's `locateRefPos` scanned the block list
linearly; both now use `blockIndexAtBp`, since blocks are disjoint and
ascending. The codon one was the worse of the two — three scans per codon over
the whole buffered region.

**Still on the table, and the next real step:** the insertion and deletion walks
are *pan-independent*. `(anchorBp, rowIndex, length)` does not change when the
view moves — only the bp->px mapping does — so the walks could be a per-region
memoized computed off `rpcDataMap` (block-major, with a per-block offset index
so the bp cull still works) and the per-frame cost would drop to one pass over
the events. Order 400k events x 12 bytes ~= 5MB per region held while loaded.
Not attempted here because the insertion geometry is shared with the hover
hit-test, so it is the one walk worth being careful with.

What remains un-decimated on the main thread is bounded by block size, not span —
`drawMafBlocks` (Canvas2D fallback + SVG export) still walks a whole block once
it is in range, so it is yet another thing a megabase block makes quadratic and
nothing a normal one troubles.

The default render path — GPU base cells plus the worker-packed coverage band —
is in good shape. The identity plot, conservation band and color-by-chromosome
are all opt-in (`rowIdentityMode: 'none'`, `showConservation: false`,
`colorByChromosome: false`), so none of them is what a default-configured track
pays.

Note the decimation trick does **not** transfer to the identity plot or the
conservation band: those paint a mean, and a mean needs its whole sample. See
the note in `binning.ts`.

### The identity plot: measured, and where its limit really is

Measured 2026-08-05, headless, synthetic 100bp-block shape, 1500px wide, rows
fit to the 600px `maxAutoFitHeight` so the whole row set is on screen. One
`drawRowIdentity` call = one pan frame: `renderBlocks` is built from
`visibleRegions`, whose `screenStartPx` is `block.offsetPx - self.offsetPx`,
so it changes identity on every pan tick and the `TrackBandCanvas` autorun
refires.

Short version: the fill loop was doing real redundant work and is fixed; the
walk underneath it is **not** where a 470-way's problem lives, and the two
tables further down are the reason.

| | before | after run-length fill |
| --- | --- | --- |
| 470-way at the byte gate's 20kb ceiling, 30% row density | 94ms | 72ms |
| same, adversarial per-pixel noise | 93ms | 88ms |
| 30-way at the 20kb ceiling | 34ms | 29ms |
| 470-way force-loaded to 150kb | 387ms | 335ms |

The fill loop emitted a 1px rect **per pixel per row** and assigned `fillStyle`
on each — 211k rects and 211k CSS-color assignments a frame at 470 rows. It is
run-length encoded now (adjacent pixels quantizing into the same one of 101 ramp
buckets share a rect), which is lossless and cuts canvas ops to 11–14% of that
on conservation-shaped data, 81% on the adversarial case where identity crosses
a bucket boundary every pixel. The headless numbers above understate the win,
since the benchmark's `fillRect` is a counter; a real 2D context pays per call.

What remains is the accumulate walk, which is O(visible bp x rows). **Do not
optimize it without re-reading the rest of this section** — the row-count curve
and the fetch comparison below are what say it is not the bottleneck it looks
like, and both were nearly missed.

### The row-count curve, and why 470-way is the wrong target

Same harness, 30% row density, at the 20kb ceiling:

| rows | per frame | | row band |
| --- | --- | --- | --- |
| 26 (ce11 26-way) | 18.3ms | 55fps | 21.3px |
| 30 (hg38 30-way) | 18.3ms | 55fps | 18.5px |
| 60 | 22.4ms | 45fps | 9.3px |
| 100 (hg38 100-way) | 26.2ms | 38fps | 5.6px |
| 200 | 38.1ms | 26fps | 2.8px |
| 470 (hg38 470-way) | 63.1ms | 16fps | 1.2px |

18x the rows costs 3.4x the time — a large row-independent term (the per-block
`columns.build` walk) dominates at every realistic size. There is no cliff, and
every multiz anyone actually loads sits in the 38–55fps band. Only the 470-way
lands in jank, and there each row's band is **1.2px**, which is the honest
signal that the row count, not the loop, is what has run out.

### Fetch dominates at 470-way, so render tuning there is the wrong term

One 40kb buffered window through the adapter's own `split` + `parseMafTabixEntry`:

| rows | split+parse | payload (uncompressed) |
| --- | --- | --- |
| 30 | 9ms | 1.6MB |
| 100 | 33ms | 5.3MB |
| 470 | 138ms | 25.1MB |

Real MAF-BED compresses 2.9–4.0x (measured on
`test_data/ce11.26way.chrI_subset.bed.gz` and `volvox.maf.bed.gz`), so a 470-way
40kb window is **6–8MB on the wire, per buffered window**, versus 63ms to draw
a frame from it. The transfer is two orders of magnitude above the render cost
and recurs every time the user pans out of the buffer.

This is the same conclusion `SYNTENY_LOD.md` reached by profiling — "~66% of
cost is fetch + parse, so read-time binning caps at ~1.5x" — and it kills the
same class of fix. Halving the 470-way's render cost would take 16fps to ~30fps
behind a multi-second fetch. **The three render-side options below were costed
and are not worth building.** Recorded so they aren't re-proposed:

- **Subsampling the mean.** Also the one to be skeptical of on its own terms,
  and why the "a mean needs its whole sample" note above is *nearly* right:
  estimating a pixel from a quarter of its bases has a standard error near 0.1
  at p=0.5 — ten ramp buckets — and the artifact is speckle in exactly the view
  whose job is smooth conservation structure.
- **Per-region per-row prefix sums**, making the walk pan-independent. Correct,
  but 2 x 4 bytes x bufferedBp x rows is ~150MB for a 470-way over 40kb, so it
  needs a coarse bucket finer than one pixel plus a fallback — a lot of
  machinery for the term that isn't dominant.
- **Moving the walk to the worker.** Cheapest of the three and the only one
  worth reconsidering, but it buys main-thread responsiveness, not throughput,
  and the thread is already waiting on the fetch.

### What the LOD lesson actually points at

MAF's level-of-detail answer is a **precomputed file tier**, exactly as synteny's
is: `summaryAdapter` (`bigMafSummary`) is fetched instead of the alignment past
the force-load floor. That is the mechanism that makes a deep alignment
affordable, and it is already built. The two real gaps are both in it, not in
the draw loop:

- The summary tier is opt-in and unconfigured tracks don't have it. Both
  `MafTabixAdapter` and `BigMafAdapter` now take a `summaryAdapter` slot (see
  "Still open" above), but a 470-way tabix MAF written without one still has no
  cheap zoom-out path — the tier exists, the file it reads has to be produced.
- The identity plot is confined *below* the summary threshold — `showSummary`
  makes `activeRowRendering` fall back to the bases — so the per-species view
  built for "see all 470 species at once" is only available in the zoom range
  where fetching all 470 species costs the most per useful pixel. The summary
  overlay does draw a per-species band there (presence + score), so this is a
  narrower gap than it sounds, but it is why widening the identity plot's zoom
  range is a **fetch-tier** question rather than a rendering one.

A third gap was in it and is now closed, worth recording because the reasoning
generalizes. The summary tier used to turn the byte gate off outright
(`byteGateEnabled = !showSummary`), on the grounds that it is the cheap tier. It
is cheap per base — no sequence — but `mafSummaryFeatures` calls
`adapter.getFeatures` on the sub-adapter, and a `BigBedAdapter` read is a
whole-feature download; `showSummary` covers 20kb to the whole genome; and a
470-way emits a record per species per aligned run. So the escape hatch from the
gate was itself capable of an unbounded ungated download — the exact failure the
gate exists to prevent, in the one place nothing was watching. Both tiers are
gated now, each measured against the file it actually reads
(`byteGateAdapterConfig` on `RegionTooLargeMixin`). **Exempting a tier assumes it
is bounded; measuring it doesn't have to** — and a genuinely small summary read
is orders of magnitude under the cap, so nothing that worked before now sees a
banner.

## Measurements from the design pass

Encode cost, realistic multi-block synthetic data (1000bp blocks, 8% reference
insertions), before/after the decimation commit:

| | encode | instances | GPU buffer |
| --- | --- | --- | --- |
| 10 sp x 500kb @ 333 bp/px | 511ms -> 8ms | 1,621,300 -> 17,553 | 25.9MB -> 0.28MB |
| 30 sp x 200kb @ 133 bp/px | 614ms -> 11ms | 1,941,932 -> 35,432 | 31.1MB -> 0.57MB |

Two results worth not re-deriving:

- **Byte-scan parsing is not a win.** Replacing the string `split` chain with a
  `Uint8Array` scan measured 3ms vs 5ms on a 1MB line — V8's sliced strings
  already make it nearly free.
- **Transferables are a memory fix, not a speed fix.** `structuredClone` of a
  5MB payload is 8ms; a transfer list saves ~3ms. Worth doing (it removes a full
  duplicate copy of every species' sequence leaving the worker, which is the
  crash-relevant part) but it will not show up as speed.
