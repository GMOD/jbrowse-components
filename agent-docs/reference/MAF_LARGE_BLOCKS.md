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

On top of that, `gateActive` (`RegionTooLargeMixin.ts:288`) requires
`aboveForceLoadFloor` — `visibleBp >= AUTO_FORCE_LOAD_BP` (20kb,
`regionTooLargeUtils.ts:9`). The floor's premise is "a small span is a small
fetch," which is exactly what a long block violates.

Net: the gate reports "tiny" precisely when the fetch is catastrophic, and it
isn't consulted anyway. **There is no ceiling on the one path that needs one.**

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

- **Opt out of rescaling.** Invalidate the cached `byteEstimate` on view change
  so the pre-flight re-runs and `measuredSpanBp == visibleBp`. `bytesForRegions`
  is index-only, so this costs no data download and is truthful at any zoom.
- **Let the gate fire below `AUTO_FORCE_LOAD_BP`** when the estimate is over
  budget.

Must be an **opt-in**, not a change to the shared verdict — canvas, LD and
alignments all compose `RegionTooLargeMixin`.

Result: zooming into a megabase block shows "Requested too much data (47 Mb)"
and the user chooses, instead of a 30-second freeze. Pair it with a cheap safety
valve in the adapter: if a single line's payload exceeds a budget, fail with a
message naming the block and pointing at the splitter rather than OOMing.

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
- `MafTabixAdapter` has no cheap zoom-out path: `showSummary` requires a
  `summaryAdapter`, which is BigMaf-only. Zoomed out it is gated, and force-load
  removes the ceiling entirely rather than degrading.

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

### …except the identity plot at high row counts, which is still slow

Measured 2026-08-05, headless, synthetic 100bp-block shape, 1500px wide, rows
fit to the 600px `maxAutoFitHeight` so the whole row set is on screen. One
`drawRowIdentity` call = one pan frame: `renderBlocks` is built from
`visibleRegions`, whose `screenStartPx` is `block.offsetPx - self.offsetPx`,
so it changes identity on every pan tick and the `TrackBandCanvas` autorun
refires.

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

**What remains is the accumulate walk, and it is the real ceiling: O(visible bp
x rows) per frame, on the main thread.** 72ms is ~14fps while panning a 470-way,
and force-load removes the bound entirely. Two things keep it off most users'
path — the identity plot is opt-in, and with a `summaryAdapter` configured the
summary path takes the rows over at 20kb, which is where the table's ceiling
comes from — so this is a deep-alignment problem, not a general one.

Three options, none attempted:

- **Subsampling is the one to be skeptical of**, and is why the "a mean needs
  its whole sample" note above is *nearly* right. Estimating a pixel's identity
  from a quarter of its bases has a standard error near 0.1 at p=0.5 — ten ramp
  buckets — and the artifact is speckle in exactly the view whose job is to show
  smooth conservation structure. Correlated neighbours make it better than that
  bound in practice and it would still be visible. Don't reach for it first.
- **Make the walk pan-independent.** The per-(row, bp) match/classifiable
  classification does not change when the view moves — only the bp->px mapping
  does. Per-region per-row prefix sums make any pixel O(1), but at 2 x 4 bytes x
  bufferedBp x rows that is ~150MB for a 470-way over 40kb, so it needs a coarse
  bucket size and a fallback, and the bucket has to be finer than one pixel.
  This is the same observation already parked above for the insertion and
  deletion walks; the identity plot is the case where it pays most.
- **Move it to the worker.** It reads only `refSeqBytes`/`alignmentBytes`, which
  the worker already has before it ships them, and the output (one float per
  pixel per row) is far smaller than the input. Zoom-dependent, so it would
  refetch-or-recompute on zoom the way the summary path already does.

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
