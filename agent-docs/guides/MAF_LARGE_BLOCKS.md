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
noted in "Still open" at the bottom. For calibration, UCSC ce11 26-way has a
median block of 7bp and a max of 1228bp, so long blocks are a property of the
*producer* (`hal2maf` without chunking, pairwise chains/nets converted to MAF),
not of MAF generally.

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

- `computeMafCoverage` builds a `MismatchEntry` **object per mismatch per row**
  (`computeMafCoverage.ts:106`) — ~650k objects on a wide region — only for
  `buildMafCoverageRegion` to repack them into typed arrays immediately. Only
  ~10% of that function's time, so it is a GC/OOM fix, not a speed one.
- `MafTabixAdapter` has no cheap zoom-out path: `showSummary` requires a
  `summaryAdapter`, which is BigMaf-only. Zoomed out it is gated, and force-load
  removes the ceiling entirely rather than degrading.

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
