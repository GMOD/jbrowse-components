---
name: maf-large-blocks
description: Why a MAF-tabix track with very long alignment blocks is slow and can crash, why "clip to the visible region" is the wrong fix, and the three options that are not. Read before touching MafTabixAdapter fetch cost or proposing block clipping.
kind: measurement
---

# MAF-tabix and megabase alignment blocks

The fetch-cost work below is parked: no file this repo can reach has a block wide
enough to be the reported problem. Sub-pixel decimation fixed render cost at
zoom-out and nothing about fetch cost. This doc is the fetch half.

## Confirm the premise first

The design assumes a reporter's blocks are enormous, which started as speculation
from a bug report with no sample data. Run this against their `.bed.gz` before
building anything, and stop if the max block is a few kb:

```sh
bgzip -dc their.bed.gz | awk '{print $3-$2}' | sort -n | tail -5
```

The widest line in every in-tree MAF-tabix file is about 20 kb, so nothing here
reproduces the problem. Long blocks come from the producer (`hal2maf` without
chunking, pairwise chains converted to MAF), not from MAF generally.

## Why one long block is expensive at every layer

MAF-tabix is one BED line per alignment block, every species' gapped sequence in
column 6 (`maf_to_bed.py`, read by `MafTabixAdapter`). Tabix returns whole
overlapping lines, so a query touching one base of a 1 Mb block across 10 species
downloads, decompresses, splits, encodes and ships all ~10 MB. Zooming in does not
help; cost quantizes by block, not by view.

## The byte gate measures, so block-quantized files are its best case

The gate once rescaled one measurement linearly by span, which block-quantized
formats break: zooming 100x into a megabase block divided the estimate by 100
while the cost stayed. The gate now takes a real measurement at the viewport being
judged and has no span floor ([REGION_TOO_LARGE.md](REGION_TOO_LARGE.md)
§"Measurement follows the viewport" and §"The sub-floor budget tier").
`ByteEstimate.zoomIneffective` detects a flat estimate across zoom, so the banner
stops advising "zoom in" on such a file and offers force-load. Nothing in the gate
is MAF-specific. Zooming into a megabase block shows "Requested too much data" and
the user chooses, rather than freezing.

## Rejected: clip blocks to the visible region

Do not re-propose it. Clipping and splitting need the same coordinate arithmetic
(bp window to column range, recomputed per-species `start`/`size`); splitting does
it once offline, clipping on every fetch in the hot path. Clipping also pays only
after the expensive layers:

- The line is downloaded, decompressed and split before anything clips.
- Finding the column range walks columns for reference gaps, the same O(columns)
  walk that is the expensive part.
- Clipped data is zoom-dependent, so `isBlockCovered`
  (`packages/display-kit/src/planRegionFetch.ts`) cannot reuse a loaded region
  across zoom.
- Tooltips and FASTA export read per-species `chr`/`srcStart`/`strand` off the
  block and report wrong coordinates unless re-derived.

## The options that work

**1. TAF.** `BgzipTaffyAdapter`'s `.tai` maps `(chr, chrStart)` to a virtual offset
within the alignment, so a megabase alignment is not atomic and cost is O(visible
span). The problem cannot occur in TAF; "convert to TAF" is the honest
recommendation for confirmed long blocks.

**2. Split at conversion time.** `scripts/maf_to_bed.py` emits one BED line per MAF
block; a `--max-ref-span` option (default ~10 kb) would bound them. The split is
strand-safe without a special case: a `-` row measures `start` along the reverse
complement and still reads left to right, so `start_right = start_left +
size_left` holds for both strands. Cut only at clean columns, where no row
including the reference has a gap: a cut inside a reference-gap run splits one
insertion marker, and one inside a species' gap run splits a deletion because
`forEachDeletion` computes runs within one block. Fall back to the nearest
reference-non-gap column. FASTA export needs no change. Bounded blocks also make
zooming in cheaper again at every layer.

**3. Per-line safety valve in the adapter (unbuilt).** The gate refuses a region
on an index estimate and says nothing about a single line with an enormous
payload. Failing with a message that names the block and points at the splitter
would beat an OOM.

The recommendation is 2 plus 3, with 1 documented as the better format.

## The zoom-out tier is opt-in

All four MAF adapters take a `summaryAdapter` slot: point it at a `BedTabixAdapter`
over the BED `maf2bed --summary` writes in the same pass, or at a
`bigMafSummary.bb`. A track configured without it has no zoom-out path and
force-load is the only way past the gate.

## Render cost is not the open question

Do not re-profile it before reading `git log --oneline -- plugins/maf`, which
holds the passes and their numbers. Three lessons generalize:

- **Check sibling getters before declaring a zoom level cheap.** Decimation fixed
  the base-cell encode while a sibling getter kept a full per-cell scan at the
  same zooms.
- **A cull has to be at the granularity the walk emits at.** `paintedBpRange` and
  its marker-side twin cover on-screen bp only; marker overlays once walked the
  whole buffered region, and `computeVisibleLabels` had a block-level cull that
  protects nothing once one stanza spans the buffer.
- **A memo is only a memo if its key stops moving.** `sourceChromRanks` keyed on
  `renderBlocks`, rebuilt every pan tick, so it re-ranked every frame. The tell is
  a computed that reads a per-frame array but uses only `displayedRegionIndex`.
  `sourceChromRanks.test.ts` pins it by identity under an `autorun`, since MobX
  does not cache an unobserved computed.

**The per-region event index (`mafRowEvents.ts`)** serves insertions and
inversions, and deliberately not deletions. `(positionBp, rowIndex, length)` does
not change when the view moves, so overlays project the index instead of
re-deriving it from alignment bytes. The shared `forEachInsertion` fills the index
and the hover hit test still calls it directly, so they cannot disagree.

- **Build per block on first touch**, not per region up front. Eager indexing makes
  the first frame after a fetch proportional to the buffered span (145 ms against
  a 4.5 ms frame on 54k blocks).
- **Deletions want a bound, not an index.** A deletion is any run of alignment gap,
  millions per region. A run cannot exceed its block's reference span, so a block
  too narrow to label is answered whole by one subtraction. A per-block longest run
  (`regionDeletionRunBounds`, one `Uint32` per block) closes the common case of
  wide blocks with only short runs. The label test is on length, so
  `maxRun < MIN_LABEL_WIDTH * bpPerPx` drops no marker the per-run test would keep.
  The bound must cover all rows or a scroll loses a deep row's labels, and must
  store a length, not "does this label", or zooming in loses them. Neither shows in
  a bench whose viewport never leaves row 0. First touch costs one full-depth walk.
- **The merge needs no index.** Zoomed out, the insertion overlay collapses a pixel
  column to its longest event. A row's events arrive in ascending bp and bp to px is
  monotonic, so two viewport-sized typed arrays holding the last column and marker
  per visible row replace a `Map` of `Map`s.

`plugins/maf/benches/mafOverlays.bench.ts` A/Bs these against any git ref and fails
unless the markers match as a multiset. Re-run it on a quiet box before quoting a
number. Two traps it hit: reference gaps every 29 columns capped every deletion run
at 28 bp so the overlay emitted nothing while the bench kept timing the walk, and
picking the pan position by round index made `min` across rounds a min across
different workloads.

`drawMafBlocks` (Canvas2D fallback and SVG export) still walks a whole block once
in range, which is quadratic only on megabase blocks. The default path (GPU base
cells plus the worker-packed coverage band) is fine; the identity plot,
conservation band and color-by-chromosome are opt-in. Decimation does not transfer
to the identity plot or conservation band, which paint a mean and need its whole
sample (`binning.ts`).

### The identity plot

The rows encode builds each region's identity once (`buildIdentityRuns`) and the
heatmap and X-Y plot draw it as GPU marks, so a pan moves uniforms. Fill is
run-length encoded: adjacent pixels quantizing into the same ramp bucket share a
rect. What remains is the accumulate walk, O(visible bp x rows), and optimizing it
is the wrong target:

- Frame time grows slowly with rows (18x the rows cost 3.4x the time) because a
  row-independent per-block `columns.build` walk dominates. Every multiz anyone
  loads is in the 38-55 fps band; only the 470-way janks, where each row is 1.2 px
  tall, so row count rather than the loop ran out.

### Fetch dominates at 470-way

One 40 kb buffered window, split and parsed:

| rows | split+parse | payload (uncompressed) |
| --- | --- | --- |
| 30 | 9ms | 1.6MB |
| 100 | 33ms | 5.3MB |
| 470 | 138ms | 25.1MB |

Real MAF-BED compresses 2.9-4.0x, so a 470-way window is 6-8 MB on the wire
against ~63 ms to draw a frame from it, and the transfer recurs on every pan out
of the buffer. [SYNTENY_LOD.md](SYNTENY_LOD.md) reached the same conclusion by
profiling.

Three render-side options were costed and declined: subsampling the mean (standard
error near 0.1 at p=0.5, speckle in the view meant to show smooth conservation),
per-region per-row prefix sums (~150 MB for a 470-way over 40 kb), and moving the
walk to the worker (buys responsiveness, not throughput).

### What the LOD lesson actually points at

MAF's level-of-detail answer is a precomputed file tier, as synteny's is:
`summaryAdapter` (`bigMafSummary`) is fetched instead of the alignment past the
force-load floor. The two gaps are in the tier, not the draw loop:

- A 470-way written without a summary file has no cheap zoom-out path; the file has
  to be produced.
- The identity plot is confined below the summary threshold, since the summary tier
  makes `activeRowRendering` fall back to bases. Widening its zoom range is a
  fetch-tier question. The summary overlay does draw a per-species band there.

The byte gate covers the summary tier too (`byteGateAdapterConfig` on
`RegionTooLargeMixin`), each tier measured against the file it reads. Exempting a
tier assumes it is bounded; a `BigBedAdapter` read is a whole-feature download, so
the exemption was an ungated unbounded download.

### A `.tai` is not a tier

A `.tai` bounds the span a read covers, not its depth, and a read costs span x
depth. Measured with `queryBlockSpan` (the function `taiRegionByteSize` reports to
the gate) over HPRC's published `.tai` files at 464 haplotypes on chr6: flat from
about 100 kb at 19 bytes per bp for the v2.1 MAF and 2.1 for the v2.0 TAF. Against
the default 5 MB `fetchSizeLimit` the ceiling is ~250 kb of MAF and ~1.7 Mb of
TAF; TAF buys about 10x and does not buy a chromosome. So all four adapters take
the `summaryAdapter` slot, through the same `mafSummaryFeatures`. These are wire
bytes off an index, not parse or render cost.

HPRC publishes no `bigMafSummary`, so the slot takes a `maf2bed --summary` BED
produced offline. On the 200 kb around C4 on chr6 the summary is 3.5 kB bgzipped
against 4.35 MB of alignment, ~1,250x, and whole chr6 extrapolates to about 3 MB
against 3.19 GB.

The `src` column joins the display's rows with no mapping: `maf2bed` writes
`HG00408.1` from `HG00408.1.CM085956.1`, and `parseAssemblyAndChr` resolves the
row the same way (`rowIndexBySrc`). When the join fails the track reports loaded
with no bars. `maf2bed` v0.6.0 or later (`cargo install maf2bed`) has `--summary`
and exits 1 on an unknown option; v0.5.x ignores every argument after the first
and silently writes no summary, so check the file exists before wiring the slot.

## Two results not to re-derive

- **Byte-scan parsing is not a win.** A `Uint8Array` scan measured 3 ms against 5 ms
  for the string `split` chain on a 1 MB line; V8's sliced strings make the split
  nearly free.
- **Transferables are a memory fix, not a speed fix.** `structuredClone` of a 5 MB
  payload is 8 ms and a transfer list saves ~3 ms, but it removes a full duplicate
  copy of every species' sequence leaving the worker, which is the crash-relevant
  part.
