---
name: maf-worker-pipeline
description: Where the time goes in LinearMafGetAlignmentData, stage by stage, after the columnar wire made postMessage free — the current profile, the fixture recipe that reproduces it, and the two optimizations that look obvious and measure worse (the coverage transpose, and exact-semantics SWAR). Read before optimizing anything in the MAF worker, or before believing a 4.5x from a kernel that changed what counts as a base.
---

# The MAF worker pipeline

Fetch cost — the byte gate, megabase blocks, why clipping is the wrong fix — is a
separate subject in [MAF_LARGE_BLOCKS.md](MAF_LARGE_BLOCKS.md). This is what
happens after the bytes arrive.

## The profile

One region, 1600 blocks × 26 species × 250 columns = 10.4M cells, 10.8 MB arena.
Synthetic but consistent; **the ranking is the point, not the absolutes** — the
box this was taken on swings wall-clock 2x between runs, which is why everything
here comparing two implementations is an interleaved ratio.

```
  parse (scanMafTabixEntry over the column)      26 ms
  pack (reserve + MafWirePacker)                 31 ms
  computeMafCoverage                             89 ms   <- half the worker
  computeSNPCoverage                             27 ms
  computeInterbaseCoverage                        6 ms
  packCoverageBinsCanvas2D                        1 ms
  packCoverageSegmentsForGpu                      6 ms   <- since folded into
                                                         the two computes
  collectMafTransferables                       0.0 ms
  ---------------------------------------------------
  worker total                                 ~186 ms
  placeMafRegionData (MAIN thread)              3.6 ms
```

Those are the numbers as profiled, before the two commits at the bottom of this
doc — coverage's 89ms is pre-hoist. They are left as measured rather than scaled
by a ratio taken on different data, since the ranking they establish is what the
rest of this doc reasons about and the hoist does not reorder it.

Against the I/O it sits behind, same region from a local file:

```
  cold (read + bgzf decompress + line walk + decode)   36.1 ms
  warm (line walk + decode only, chunks cached)         7.3 ms
  => read + decompress                                 28.8 ms
```

**The I/O is not hiding the CPU** — 29 ms behind 186 ms — so CPU work here is
worth doing. It also caps what a byte-native adapter path can be worth: the line
walk *and* the decode together are 7.3 ms, not the ~26 ms a pre-columnar profile
suggested.

### The ranking above is the WIDE-block ranking, and it inverts

Everything above was taken on 1600 blocks of 250 columns. Re-profiled on 20000
blocks of 8 columns — the shape [MAF_LARGE_BLOCKS.md](MAF_LARGE_BLOCKS.md)
measures real files at — the two halves swap places (min of 12 rounds, warm
chunk cache):

| shape | read + parse + pack | coverage + SNP | stage share |
| --- | --- | --- | --- |
| 1600 blocks × 250 columns | 50 ms | 184 ms | 21% |
| 20000 blocks × 8 columns | 345 ms | 72 ms | **83%** |

Same cell count within a factor of 2.5, opposite answer to "where does the time
go". Coverage walks cells, so it tracks the cell count; everything upstream of
it pays per *row* — a scan, a record, a dictionary lookup, an arena write — and
narrow blocks buy 12x the rows for the same cells.

So "`computeMafCoverage` is half the worker" below is true of wide blocks and
false of the files people actually load, where it is a sixth. Check which shape
a profile came from before ranking work off it — including this one.

### Reproducing it

`plugins/maf/benches/mafTabixFixture.ts` writes it: 1600 lines of
`chr1 \t start \t end \t blockN \t 1 \t <entries>`, each entry
`spN.chr1:start:size:+:srcSize:SEQ` and entries joined with commas, which is
exactly what `MafTabixAdapter` reads out of column 6. 250 columns, 4% `-` in the
reference, and **2–20% divergence graded across the 26 species** so the mismatch
count is realistic (783k for the numbers above) — a uniform divergence gets this
badly wrong in both directions. Then `bgzip` and `tabix -p bed`. It stays out of
the repo at 2.5 MB compressed; the generator is deterministic, so regenerating
it costs a second and gives the same bytes.

## The byte-native adapter path is the restructure, not the bytes

`GMOD/tabix-js#156` proposes `lineBytesCallback` — the decompressed bgzf buffer
and the line's range within it, instead of a decoded string — and MAF is the
consumer its description argues from. `plugins/maf/benches/mafTabixBytes.bench.ts`
measures it end to end, from the bgzf block to a finished `MafWirePacked`,
against the tabix branch with the PR applied.

The result is that "byte-native" is **two** changes, and the one that pays is not
the one the PR enables. Handing over a buffer instead of a string means the
buffer is only valid during the call, which forces the block to be packed inside
the callback rather than buffered for a second pass — and that restructure, on
its own, is most of the win:

| shape | bed+string | string | string-1pass | bytes | peak RSS (string / 1pass / bytes) |
| --- | --- | --- | --- | --- | --- |
| 1600 blocks x 250 columns | 0.92x | 1.00x | 0.97x | **1.17x** | 256 / 207 / 205 MB |
| 20000 blocks x 8 columns | 0.94x | 1.00x | **1.18x** | 1.17x | 491 / 263 / 265 MB |

Min of 30–40 interleaved rounds, byte-identical control within 3% of 1.00 on
every row, all four arms verified to emit identical packed columns.

**The second shape is the real one.** [MAF_LARGE_BLOCKS.md](MAF_LARGE_BLOCKS.md)
measures ce11's 26-way at a 7bp median block and volvox at 100bp; 250 columns is
the synthetic wide case. On the real shape the byte arm does not beat the
single-pass string arm at all, and it never beats it on memory — 228 MB of the
229 MB saved there is the restructure. What the bytes buy is a decode, so their
win scales with bytes per line, while the restructure's win scales with rows.

Two riders. `string` here is already a direct tabix read with no
`BedTabixAdapter` in it, worth 6-8% by itself; quoting the byte arm against
`bed+string` would credit the PR with that too. And the single-pass arm gives up
the exact `reserve` — it grows the arena by doubling, which is the cost the
buffered pass exists to avoid, and it wins anyway on the shape that has 1.2M
rows to retain.

The restructure shipped on its own (`packer fed from the subscription`, below);
the PR was closed with this measurement as GMOD/tabix-js ADR 0006.

## Two things that look like wins and are not

Both are also written into the comment on `computeMafCoverage`, because that is
where someone about to try them will be.

**The transpose.** The walk reads `arena[rowOffset[i] + col]` down the rows of a
column, striding a row length per read, so making it one sequential scan per row
looks free. It measures **0.92x–1.06x** at block widths from 120 to 32,000
columns. A column-major sweep's working set is one *block*, a few tens of KB, not
the arena — and where a block does exceed L2, 26 concurrent sequential streams
still prefetch. It also costs a counting sort per block, because mismatches are a
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

The lesson generalizes past this function: **the 4.5x was not a performance win
with a semantic caveat attached, it was the semantic change, priced.**

One incidental trap if anyone does bit-twiddle here. The famous zero-byte test
`(v - 0x01010101) & ~v & 0x80808080` correctly answers "is there *any* zero
byte", but its per-lane flags lie — the borrow propagates, so a lane holding 1
beside a lane holding 0 is flagged too. Use
`~(((v & 0x7f7f7f7f) + 0x7f7f7f7f) | v | 0x7f7f7f7f)`, which keeps the lanes
independent. Silently miscounting one base in a million never shows up in a
coverage bar.

## What is left

**`computeMafCoverage` is half the worker, and "no non-compromising lever left"
is what this section used to say — wrongly, and for an instructive reason.** The
claim rested on the per-cell body being reduced to about as few operations as the
semantics allow, which was true and irrelevant: the loop was never ALU bound, so
counting its operations measured the wrong thing. What settled it was decomposing
the cost instead of eyeballing it (`plugins/maf/benches/mafCoverage.bench.ts`):

- Gapless data with nothing to emit still costs ~8.5ns/cell, so the cost is the
  loop, not the output. The work the data makes it do — mismatch pushes at a 6%
  rate, insertion runs — adds under 2ns/cell.
- It is not memory either. Hold the inner loop at 447 rows and sweep the block
  footprint from 3KB to 3.5MB, and ns/cell is flat — the same answer the rejected
  row-major transpose gave from the other direction.
- Peel the body one operation at a time and the largest single item is
  `alignedBaseUpper`'s `col >= len` bound test: a kernel without it is **1.8x**
  the one with it, on both a 26x7 and a 447x200 shape.

That test is a per-cell answer to a per-block question, because a MAF block is a
set of rows over the *same* alignment columns and a shorter row is the defensive
case. Hoisting it to a per-block `uniformRows` scan is **1.13-1.24x** on the whole
function across eight shapes (`4177979cca`), against a byte-identical control
reading 0.97-1.04x on the same runs.

The same arm went on the insertion loop (`4a8d7d8f7f`) and is worth stating as a
counterexample: it measures ~1.05x over control only where a *third* of reference
columns are gaps, and 1.00x at the 3-12% rates real alignments run, because that
loop executes on gap columns alone. Same transformation, same function, an order
of magnitude less payoff — how often a loop runs bounds what fixing it can buy,
and the bench had to grow two insertion-heavy shapes before the difference was
even visible.

So the lever that was there for months was invisible to the method being used to
look for it. Before declaring a hot loop finished, decompose it: measure the bare
loop against the loop-plus-output, sweep the working set, and peel the body one
operation at a time. The rung that costs is rarely the rung that looks expensive.

**Mismatch decimation is the biggest remaining win and is a compromise.** A
region that wide emits 783k `(position, base)` pairs which are computed, packed,
transferred, and then averaged into a coverage bar drawn sub-pixel per position.
Binning or skipping emission above some bp-per-pixel would cut the emission, the
SNP pass and the payload at once. It is off the table by explicit preference —
exhaust the free performance first — and it has a real edge anyway: the tooltip
wants per-position detail the moment you hover.

**A WebAssembly SIMD kernel** is the only thing that beats the exact-semantics
ceiling, since `v128` has real 16-byte compare instructions and does not need the
threshold trick to be fast. That means shipping a wasm module and a build step,
a much larger commitment than this stage justifies on its own — but if another
hot loop ever wants one, this walk should be on the list of customers.

## How it got here

Eight commits, all output-identical except where noted:

| commit | change | measured |
| --- | --- | --- |
| `9611ad87ce` | scan the tabix alignment column in place instead of `split(',')` | 152 → 91 ms |
| `d0727b907a` | columnar wire, rehydrated at placement | postMessage 3.3 s → 0.03 ms |
| `64b9710f40` | cell colors from a table filled by memcpy | 16 → 6 ns a cell |
| `e1abf5d533` | count a coverage column in locals, not three arrays per cell | ~1.3x |
| `57e26565a4` | SNP segments in dense lanes, not a `Map` of objects | 78 → 27 ms |
| `7b0cbcee48` | the wire's round-trip contract, under test | — |
| `bc9e6a1d24` | short arena rows by `charCodeAt`, and the sizing pass fused into the discovery walk | 1.30x packer, 1.38-1.64x sizing |
| `4177979cca` | coverage's `col >= len` test hoisted to a per-block scan | 1.13-1.24x |
| `4a8d7d8f7f` | the same arm for coverage's insertion loop | ~1.05x at a 33% gap rate, 1.00x below that |
| `562393d0d7` | the packer fed from the subscription, and the buffered sizing pass dropped | 1.18x and 491 → 263 MB on narrow blocks |

`57e26565a4` is in `packages/alignments-core`, so the alignments coverage
pipeline gets it too. It is the one behavioral difference in the set: SNP
segments now come out in position order rather than first-appearance order, which
only differs for a caller whose mismatches arrive unsorted (alignments, per read).
Same set, same stacking, and nothing downstream reads the order.
