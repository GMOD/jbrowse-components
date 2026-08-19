---
name: maf-large-blocks
description: Why a MAF-tabix track with very long alignment blocks is slow and can crash, why "clip to the visible region" is the wrong fix, and the three options that are not. Read before touching MafTabixAdapter fetch cost or proposing block clipping.
---

# MAF-tabix and megabase alignment blocks

Design notes for unfinished work, and the work is **parked**: no file this repo
can reach has a block wide enough to be the reported problem, so the premise
below is waiting on a `.bed.gz` from a reporting user. Run the one line under
"Confirm the premise first" against that file before building any of this — if
the max block is a few kb, say so and stop. What shipped is the sub-pixel decimation
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

For calibration, run the same line against the two MAF-tabix files this repo
carries, plus the synthesized bench fixture (measured 2026-07-29):

| file | blocks | median | max |
| --- | --- | --- | --- |
| `test_data/ce11.26way.chrI_subset.bed.gz` | 160 | 7bp | 1228bp |
| `test_data/volvox/volvox.maf.bed.gz` | 501 | 100bp | 100bp |
| synthesized, 250 columns | 433 | 1075bp | 1995bp |

The third is generated rather than committed, by the four-line recipe in
[MAF_WORKER_PIPELINE.md](MAF_WORKER_PIPELINE.md) § "Reproducing it" — worth
knowing before going looking for it, since it is the only one of the three whose
blocks are wide enough to be interesting and it is not on disk.

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

## The byte gate used to lie here, and no longer does

This is the part worth internalizing, and it is not MAF-specific.

The gate used to keep **one** measurement plus the span it covered and rescale it
linearly (`bytes * visibleBp / measuredSpanBp`), which assumes bytes are
proportional to span. Block-quantized formats are exactly where that breaks:
zooming 100x into a megabase block divided the *estimate* by 100 while the real
cost was unchanged. On top of that the byte axis stopped at a 20kb span floor
whose premise — "a small span is a small fetch" — a long block violates by
construction. Net: the gate reported "tiny" precisely when the fetch was
catastrophic, and it wasn't consulted anyway.

**Both halves are fixed, and the fix was general rather than MAF-specific.** The
rate model is retired: the estimate is a measurement taken at the viewport being
judged, the fetch autoruns skip on `regionTooLarge && !gateMeasurementStale`, and
a blocked display takes one real measurement per settled viewport. The floor left
the byte axis in the same pass, replaced below 20kb by a raised budget rather
than an off-switch, so the gate is now on duty at every zoom. The measurements
and the two obvious fixes that were wrong are in
[REGION_TOO_LARGE.md](REGION_TOO_LARGE.md) §"Measurement follows the viewport"
and §"The sub-floor budget tier"; the closed story is in
[HISTORICAL.md](HISTORICAL.md) §"The byte estimate was a rate".

**Block-quantized files are now the case the gate handles best**, which is worth
saying because this doc spent its first version arguing the opposite. A megabase
block's estimate is both correct and *flat across zoom*, and flatness is exactly
what `ByteEstimate.zoomIneffective` detects from two consecutive measurements —
so the banner stops advising "zoom in to see features", which on such a file is
advice that cannot work, and offers only force-load. Nothing here had to know
about MAF.

What stays MAF-specific: the ce11 26-way never gates at all — 92,757 bytes
against `LinearMafDisplay`'s 5 Mb (10 Mb below the force-load floor) is ~54x of
headroom at every zoom — so the gate is not what stands between that file and a
megabase block. Only a file whose blocks are genuinely large reaches the premise
this doc opens with.

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
**zooming in gets cheaper again**, at every layer and not only at the gate. That
was written here as "the gate's linear model becomes correct", which no longer
names anything — the gate measures rather than models. The real payoff outlasted
its original argument: on a bounded-block file a smaller window is a smaller
read, so the banner's "zoom in to see features" is advice that works, where on a
megabase-block file the same bytes come down however far the user goes.

### 3. Make the gate honest, for files that already exist

~~Two contained changes.~~ **Done, and not by anything MAF-specific** — see
§"The byte gate used to lie here" above. Both halves were fixed in the gate
itself: the rescale is retired in favour of a measurement at the viewport being
judged, and the span floor left the byte axis. Neither needed the display-side
opt-out this section proposed, and the two that briefly existed
(`gateBelowForceLoadFloor`, on MAF and alignments) are gone with it — there is
nothing left to opt out of.

Worth keeping from the original sketch, because it is the half the gate does not
cover: the adapter has no cheap safety valve. The gate refuses a *region* on an
index estimate; it says nothing about a **single line** whose payload is
enormous, which is the failure this doc opens with. If one line's payload exceeds
a budget, failing with a message that names the block and points at the splitter
would beat OOMing. Still unbuilt, and still gated on confirming the premise.

Result today: zooming into a megabase block shows "Requested too much data
(47 Mb)" and the user chooses, instead of a 30-second freeze.

## Recommendation

(2) + (3), with (1) documented as the better format. (2) fixes it properly for
anyone who can regenerate; (3) turns a freeze into an informed choice for
everyone else.

## The other half of the original report, now closed

Both items landed. The one consequence worth carrying: `MafTabixAdapter` has the
`summaryAdapter` zoom-out tier that used to be BigMaf-only, but it is **opt-in**
— point it at a `BedTabixAdapter` over the BED `maf2bed --summary` writes in the
same pass, or at a `bigMafSummary.bb`. A tabix track configured without the slot
still has no zoom-out path, and force-load remains the only way past the gate.

## Render cost is no longer the open question

Worth stating so the next person doesn't re-profile it: eleven passes have landed
(sub-pixel decimation on the base cells, `IdentityColumns` on the identity plot,
memoized source-chromosome ranks and inversion consensus, the deletion overlay
gated on what its label can fit, `bpLo`/`bpHi` culling for every marker overlay,
`blockIndexAtBp` replacing two linear block scans, per-*column* culling in
`computeVisibleLabels`, the codon spine's per-block indexes built on first use,
the source-chromosome ranks re-keyed off `renderBlocks`, the per-region event
index the marker overlays now project, and the per-block longest-run bound that
retires the deletion walk). `git log --oneline -- plugins/maf` has them with
their numbers.

Three lessons generalize, and they are why the list above is not the point:

- **Check the siblings before declaring a zoom level cheap.** The decimation
  pass fixed the base-cell encode and stopped at the encode boundary, while a
  sibling getter kept doing a full per-cell scan at the same zooms — 679k
  deletion markers built and 0 drawn per frame on a 26-species view, on the
  *default* path.
- **`paintedBpRange` and its marker-side twin are easy to apply to three call
  sites and miss the fourth.** Every marker overlay walked the whole *buffered*
  region while `visibleRegions` covers only what is on screen; `drawMafBlocks`
  was the painter the earlier pass missed. Measured on a synthetic ce11-26-way
  shape (54k blocks, 26 rows, 360kb buffered / 180kb visible): insertions
  463ms -> 168ms, deletions 1.39s -> 0.72s.

  The pass after that missed a *fifth* site of a different shape:
  `computeVisibleLabels` had the block-level cull and nothing finer, which is
  the same amount of protection as none once one stanza spans the whole
  buffered region — the cull has to be at the granularity the walk emits at,
  not at the granularity the neighbouring walks happened to need.
- **A memo is only a memo if its key stops moving.** `sourceChromRanks` was
  keyed on `renderBlocks`, which is rebuilt on every pan tick, so it re-ranked
  every (block, row) pair per frame to produce the identical map — the blocks
  only chose *which region* to walk, and a region carries the whole buffered
  span either way. Its sibling `inversionConsensus` had always keyed off
  `rpcDataMap`. The tell is a computed that reads a per-frame array but uses
  only `displayedRegionIndex` off it; the fix and the stability argument are
  the same one, since a value that shouldn't move with the view shouldn't be
  recomputed when it does. `sourceChromRanks.test.ts` pins it by identity under
  an `autorun` — a bare read won't do, since MobX doesn't cache an unobserved
  computed at all.

**The pan-independence step is built** (`mafRowEvents.ts`), and it landed for
insertions and inversions but deliberately *not* for deletions. The premise held:
`(positionBp, rowIndex, length)` does not change when the view moves, only the
bp->px mapping over it does, so the overlays project a per-region index instead
of re-deriving it from the alignment bytes every frame. The care the sketch asked
for was cheap in the end — the shared `forEachInsertion` is what fills the index
and the hover hit-test still calls it directly for the row under the cursor, so
the two cannot disagree.

Three things the sketch got wrong, and they are the transferable part:

- **Build it per block on first touch, not per region up front.** A whole-region
  build inverts the cost model the walks already had. They are proportional to
  the *viewport*; eagerly indexing makes the first frame after a fetch
  proportional to the buffered span instead — 145ms against a 4.5ms frame when
  zoomed in on a 54k-block region, a jank on every navigation bought with
  cheaper pans. Filling only the blocks the bp cull admits keeps every frame
  proportional to what it draws, and a full pan across the region still walks it
  exactly once.
- **Deletions want a bound, not an index.** An insertion needs a reference gap to
  exist, so insertions are sparse; a deletion is any run of alignment gap, a few
  percent of every row, which is millions of events per region where insertions
  are hundreds of thousands — the 5MB estimate above was for the wrong walk. They
  get an exact per-block bound instead: a run can be at most as long as its
  block's own reference span, so at a fixed zoom a block narrower than one digit
  cannot label and is answered whole, for all its rows, by one subtraction.
  Indexing what is cheap to bound is how a per-frame walk becomes a per-region
  memory leak.

  **A second bound followed, and it is where the win actually is.** The span
  bound says nothing about a block wide enough to label whose runs are all short
  — a 200bp block of 2bp runs at 13bp/px — and that is the common shape, so the
  columns were still walked every frame to emit nothing. One `Uint32` per block
  holding its longest run (`regionDeletionRunBounds`) closes it, and the label
  test is a test on *length*, so `maxRun < MIN_LABEL_WIDTH * bpPerPx` drops no
  marker the per-run test would have kept. Measured against a 1.02x control, and
  the ratios are not typos: the steady-state pan is **2,750x** on 20kb blocks
  with dense reference gaps (267ms → 0.10ms) and **2,149x** on the 447-way
  (627ms → 0.29ms), both output-identical, because the whole walk goes away.
  The shape where runs really do label is 0.965x against a 1.023x control — i.e.
  unchanged, which is the point: the bound only removes walks that emit nothing.

  The cost is **first touch, and it is the same trade the index makes**: the
  bound has to be over all rows or it cannot survive a scroll, so the block that
  fills it walks its full depth where a frame walks only what it draws. On the
  447-way that is 0.872x against a 1.004x control — 13% on one frame, against
  three orders of magnitude on every frame after it.

  Two things nearly went wrong, both caught by the tests rather than the bench,
  and both mutation-checked by narrowing the code and re-running. A bound taken
  over the *visible* rows loses a deep row's labels the moment you scroll to it.
  A bound stored as "does this label" rather than as a length loses them on zoom
  in. Neither shows up in a bench, whose viewport never moves off row 0.

  A third was only visible in the bench: on the shape the bound cannot cull, the
  first version measured **0.867x**. The walk was unchanged — the cost was the
  emit callback, whose context chain had gained a level because `longest` sat in
  a per-block scope, plus a `??=` resolving the flank per row. Hoisting both put
  it back to 1.02x. When a change to a hot loop's *surroundings* costs 13%, look
  at what the innermost closure now captures.
- **The merge underneath it needed no index either.** Zoomed out the insertion
  overlay collapses everything in a pixel column of a row to the longest, which
  was a `Map` of `Map`s. A row's events arrive in ascending bp and bp->px is
  monotonic, so the ones sharing a column are *adjacent* in that row's stream:
  two viewport-sized typed arrays holding the last column and marker per visible
  row replace the whole structure.

`plugins/maf/benches/mafOverlays.bench.ts` A/Bs all three against any git ref and
fails the run unless the markers match as a multiset. Steady-state pans came back
several-fold faster on every shape, clearing the control by a wide margin; the
figures were taken on a contended box, so re-run it on a quiet one before quoting
a number. Two traps it walked into first are worth knowing, since both reported
confidently and neither was noise — a shape whose reference gaps every 29 columns
capped *every* deletion run at 28bp, so the overlay emitted zero markers on every
shape while the bench went on timing the walk and calling it the full case; and
rounds that picked their pan position by round index, which made `min` across
rounds a min across twelve different workloads rather than the least-contended
sample of one.

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
| 470-way at 20kb, 30% row density | 94ms | 72ms |
| same, adversarial per-pixel noise | 93ms | 88ms |
| 30-way at 20kb | 34ms | 29ms |
| 470-way force-loaded to 150kb | 387ms | 335ms |

20kb was "the byte gate's ceiling" when these were taken, because the gate
stopped at that span. It no longer does; the window is still the right one to
compare against, since a 470-way at 20kb is over budget either way.

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

- The summary tier is opt-in and unconfigured tracks don't have it. All four MAF
  adapters take a `summaryAdapter` slot now (see "Still open" above and "A `.tai`
  is not a tier" below), but a 470-way written without one still has no cheap
  zoom-out path — the tier exists, the file it reads has to be produced.
- The identity plot is confined *below* the summary threshold — `showSummary`
  makes `activeRowRendering` fall back to the bases — so the per-species view
  built for "see all 470 species at once" is only available in the zoom range
  where fetching all 470 species costs the most per useful pixel. The summary
  overlay does draw a per-species band there (presence + score), so this is a
  narrower gap than it sounds, but it is why widening the identity plot's zoom
  range is a **fetch-tier** question rather than a rendering one.

A third gap was in it and is now closed, worth recording because the reasoning
generalizes. The summary tier used to turn the byte gate off outright
(`measuresBytesPreFlight = !showSummary`), on the grounds that it is the cheap tier. It
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

### A `.tai` is not a tier — measured on HPRC's own indexes

`BgzipMafAdapter` and `BgzipTaffyAdapter` shipped without the `summaryAdapter`
slot, and the reason was written down as a decision rather than left implicit: a
`.tai` seeks *within* an alignment, so a read costs the span on screen rather
than the blocks that span lands in, and the block-quantization failure the rest
of this document is about cannot happen. That much is true.

It is also only one factor. A read costs **span × depth**, the index bounds the
span, and nothing bounds the depth. Measured 2026-08-06 by running the repo's own
`queryBlockSpan` — the same function `taiRegionByteSize` reports to the gate —
over the two `.tai` files HPRC publishes, at 464 haplotypes, chr6 (the C4 locus
the tutorial figure uses):

| span | v2.1 MAF (53 GB) | v2.0 TAF (5.96 GB) |
| --- | --- | --- |
| 10 kb | 598 kB | 107 kB |
| 100 kb | 2.2 MB | 301 kB |
| 500 kb | 9.6 MB | 1.1 MB |
| 1 Mb | 19.3 MB | 2.5 MB |
| 10 Mb | 192 MB | 25.2 MB |
| whole chr6, 170.8 Mb | **3.19 GB** | **354 MB** |

Both are flat in bytes-per-bp from about 100 kb up — **19 for the MAF, 2.1 for
the TAF** — which is the shape a span-bounded read should have, and exactly why
it runs out: against the default 1 MB `fetchSizeLimit` the ceiling is ~50 kb of
MAF and ~350 kb of TAF, and it moves linearly with the limit thereafter. TAF
buys about 10x. It does not buy a chromosome.

So the two adapters that read *published* whole-genome alignments were the two
without a zoom-out tier, while the two that have it (`MafTabixAdapter`,
`BigMafAdapter`) read formats you produce yourself by conversion. Both take the
slot now, through the same `mafSummaryFeatures` and the same `getSummaryFeatures`
as the other two — the display side needed no change at all, since `showSummary`
only ever asked whether the slot was set.

One thing this does *not* claim: it is a wire-bytes measurement off an index, not
a download, so it says nothing about parse or render cost past the gate — those
are the tables above.

### What the tier is worth on this alignment, and the producer gap

HPRC publishes no `bigMafSummary`, so the slot has to be pointed at a
`maf2bed --summary` BED produced offline. Both halves were run for real
(2026-08-06), on the 200 kb of chr6 around C4 that the tutorial figure uses,
range-read out of the published v2.1 MAF at the offsets `queryBlockSpan` gives:

| | alignment | summary |
| --- | --- | --- |
| bgzipped | **4.35 MB** | **3.5 kB** |
| uncompressed BED | 105.9 MB | 35.7 kB |

**~1,250x on the wire for the same span**, and the summary carries all 464
haplotypes — extrapolated flat, whole chr6 is about 3 MB of summary against
3.19 GB of alignment. That is the whole-chromosome view of a 464-haplotype
alignment, and it is a 3 MB file.

The `src` column matches the display's row names with no mapping: MAF rows are
`HG00408.1.CM085956.1`, `maf2bed` writes `HG00408.1`, and
`parseAssemblyAndChr` resolves the row to `HG00408.1` as well. That is the join
`rowIndexBySrc` makes, and the failure mode when it doesn't hold is a fully
"loaded" track with no bars.

**The producer was the gap and is now published.** `--summary` sat committed and
unpushed in `~/src/maf2bed` while every doc here told users to run it; the
released crate was v0.5.1, which has no such flag *and* parses only `args[1]`,
ignoring everything after — so `maf2bed hg38 --summary summary.bed < file.maf`
exited 0, wrote the alignment BED, and wrote no summary at all. **maf2bed v0.6.0
is on crates.io** (tag `v0.6.0`, `cargo install maf2bed`), and the numbers in the
table above were re-derived with it: the published binary's output over the C4
slice is identical to the local build's, 915 rows.

v0.6.0 also exits 1 on an unknown option, so the silent-ignore failure cannot
recur. It is still worth checking the summary file exists before wiring the slot,
because a stale v0.5.x on `PATH` behaves the old way.

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
