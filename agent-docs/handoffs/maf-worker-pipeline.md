---
name: maf-worker-pipeline
description: What one MAF region costs end to end as of 2026-08-06, stage by stage, after the columnar wire landed and postMessage stopped being the bottleneck. Carries the current profile so it does not have to be re-derived, the recipe for the fixture that produced it, and two measured negatives — the coverage transpose and exact-semantics SWAR — that both look like obvious wins and are not. Read before optimizing anything in LinearMafGetAlignmentDataRpc.
---

# The MAF worker pipeline

Where the time goes in `LinearMafGetAlignmentData` after a day of work on it, and
what a next session should not re-measure. Fetch cost — the byte gate, megabase
blocks, why clipping is the wrong fix — is a separate thread in
[reference/MAF_LARGE_BLOCKS.md](../reference/MAF_LARGE_BLOCKS.md) and is not
repeated here.

## What shipped

Eight commits, all output-identical except where noted:

| commit | change | measured |
| --- | --- | --- |
| `9611ad87ce` | scan the tabix alignment column in place instead of `split(',')` | 152 → 91 ms |
| `d0727b907a` | columnar wire, rehydrated at placement | postMessage 3.3 s → 0.03 ms |
| `64b9710f40` | cell colors from a table filled by memcpy | 16 → 6 ns a cell |
| `e1abf5d533` | count a coverage column in locals, not three arrays per cell | ~1.3x |
| `57e26565a4` | SNP segments in dense lanes, not a `Map` of objects | 78 → 27 ms |
| `7b0cbcee48` | the wire's round-trip contract, under test | — |
| `d3e5fe7bc6` | the `prefer-includes` lint failure on main | — |
| `add78e65c9` | why SWAR is not here | — |

`57e26565a4` is in `packages/alignments-core`, so the alignments coverage
pipeline gets it too. It is the one behavioral difference in the set: SNP
segments now come out in position order rather than first-appearance order, which
only differs for a caller whose mismatches arrive unsorted (alignments, per read).
Same set, same stacking, nothing downstream reads the order.

## The profile

One region, 1600 blocks × 26 species × 250 columns = 10.4M cells, 10.8 MB arena.
Synthetic but consistent; the ranking is the point, not the absolutes — this box
swings wall-clock 2x between runs, which is why everything here that compares two
implementations is an interleaved ratio.

```
  parse (scanMafTabixEntry over the column)      26 ms
  pack (reserve + MafWirePacker)                 31 ms
  computeMafCoverage                             89 ms   <- half the worker
  computeSNPCoverage                             27 ms
  computeInterbaseCoverage                        6 ms
  packCoverageBinsCanvas2D                        1 ms
  packCoverageSegmentsForGpu                      6 ms
  collectMafTransferables                       0.0 ms
  ---------------------------------------------------
  worker total                                 ~186 ms
  placeMafRegionData (MAIN thread)              3.6 ms
```

Against that, the I/O it sits behind, for the same region from a local file:

```
  cold (read + bgzf decompress + line walk + decode)   36.1 ms
  warm (line walk + decode only, chunks cached)         7.3 ms
  => read + decompress                                 28.8 ms
```

**The I/O is not hiding the CPU** — 29 ms behind 186 ms — so CPU work here is
worth doing. It also puts a real ceiling on the `lineBytesCallback` idea: the
line walk *and* the decode together are 7.3 ms, not the ~26 ms the pre-columnar
profile suggested. See "Open threads" below for what that PR is actually worth.

### Reproducing it

The fixture is not in the repo — 2.8 MB compressed, and generating it is four
lines. Write 1600 lines of `chr1 \t start \t end \t blockN \t 1 \t <entries>`,
where each entry is `spN.chr1:start:size:+:srcSize:SEQ` and entries are joined
with commas — that is exactly what `MafTabixAdapter` reads out of column 6. Use
~250 columns, ~4% `-` in the reference, and 2–20% divergence graded across the 26
species so the mismatch count is realistic (783k for the numbers above; a uniform
divergence gets this badly wrong in both directions). Then `bgzip` and
`tabix -p bed`.

## Two things that look like wins and are not

Both are written into the comment on `computeMafCoverage` itself, because that is
where someone about to try them will be. Repeated here only so this file says
what the thread cost.

**The transpose.** The walk reads `arena[rowOffset[i] + col]` down the rows of a
column, striding a row length per read, so making it one sequential scan per row
looks free. It is 0.92x–1.06x at block widths from 120 to 32,000 columns. A
column-major sweep's working set is one *block*, a few tens of KB, not the arena
— and where a block does exceed L2, 26 concurrent sequential streams still
prefetch. It also costs a counting sort per block, because mismatches are a
sequence whose order a test and both consumers depend on.

**SWAR.** Reading the arena as `Uint32` and classifying four columns at once. A
kernel doing only the depth and match counts measures **4.5x**, which is what
makes it worth writing down. That number is bought entirely by testing "is this a
base" as `folded >= 0x40`, which quietly reclassifies `.` and `*` — both of which
count as bases today. Testing for `-` and ` ` exactly costs three lane-wise
zero-byte tests per word against the threshold's single add, and the whole
advantage goes with it: a full exact-semantics SWAR walk, verified
output-identical across seeds, block widths and both reference configurations,
measured **0.51x**.

The lesson generalizes past this function: the 4.5x was not a performance win
with a semantic caveat attached, it was the semantic change, priced.

One incidental trap if anyone does bit-twiddle here. The famous zero-byte test
`(v - 0x01010101) & ~v & 0x80808080` correctly answers "is there *any* zero
byte", but its per-lane flags lie — the borrow propagates, so a lane holding 1
beside a lane holding 0 is flagged too. Use
`~(((v & 0x7f7f7f7f) + 0x7f7f7f7f) | v | 0x7f7f7f7f)`, which keeps the lanes
independent. Silently miscounting one base in a million never shows up in a
coverage bar.

## What is actually left

**`computeMafCoverage` is half the worker and has no non-compromising lever
left** that I found. The two structural ideas are the ones above. What remains
inside it is per-cell bookkeeping already reduced to about as few operations as
the semantics allow.

**Mismatch decimation is the biggest remaining win and is a compromise.** A
region that wide emits 783k `(position, base)` pairs which are computed, packed,
transferred, and then averaged into a coverage bar drawn sub-pixel per position.
Binning or skipping emission above some bp-per-pixel would cut the emission, the
SNP pass and the payload at once. It is off the table by explicit preference —
exhaust the free performance first — and it has a real edge anyway: the tooltip
wants per-position detail the moment you hover.

**A WebAssembly SIMD kernel** is the only thing that beats the exact-semantics
ceiling, since `v128` has real 16-byte compare instructions and does not need the
threshold trick to be fast. That means shipping a wasm module and a build step
for it, which is a much larger commitment than this stage is worth on its own —
but if other hot loops ever want one, this walk should be on the list of
customers.

## Open threads

**`GMOD/tabix-js` PR #156** adds `lineBytesCallback` — the decompressed buffer
and the line's `[lineStart, lineEnd)` range instead of a decoded string. Open,
mergeable, tests and lint green there. Nothing in jbrowse consumes it and nothing
can until it is published.

Size it honestly before spending the follow-up: the decode it removes is part of
a 7.3 ms line walk, not the 26 ms the old profile implied. The real win for MAF
is downstream of the decode — `MafWirePacker.write` already takes a `Uint8Array`
as readily as a string, so a byte-native adapter path skips the decode *and* the
`encodeInto` inside the 31 ms pack stage. That is the number to measure when the
publish lands, and it is a different number from the one the PR description
argues.

**The alignments track inherits `57e26565a4` untested at scale.** The SNP change
is verified output-identical and its 2352 tests pass, but every measurement in
this file is from MAF data. A deep pileup has a different mismatch distribution —
far more mismatches per position, far fewer distinct positions — which is the
shape where dense lanes win by the most, so the direction is safe. The magnitude
is unmeasured.
