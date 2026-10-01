---
name: maf-worker-pipeline
description: Where the time goes in LinearMafGetAlignmentData stage by stage, the fixture that reproduces it, and the two optimizations that look obvious and measure worse. Read before optimizing anything in the MAF worker.
kind: measurement
---

# The MAF worker pipeline

Fetch cost — the byte gate, megabase blocks, why clipping is the wrong fix — is
[MAF_LARGE_BLOCKS.md](MAF_LARGE_BLOCKS.md). This doc covers what happens after
the bytes arrive.

## The ranking depends on block shape

The worker reads and parses blocks, packs them into the columnar arena
(`MafWirePacker`), then runs `computeMafCoverage`, `computeSNPCoverage` and
`computeInterbaseCoverage`; placement on the main thread is a few ms. Upstream
of coverage pays per **row** (a scan, a record, an arena write); coverage pays
per **cell**. So the ranking inverts with block width (min of 12 rounds, warm
chunk cache, before ADR-195):

| shape | read + parse + pack | coverage + SNP | stage share |
| --- | --- | --- | --- |
| 1600 blocks × 250 columns | 50 ms | 184 ms | 21% |
| 20000 blocks × 8 columns | 345 ms | 72 ms | **83%** |

"`computeMafCoverage` is half the worker" is true of wide blocks and false of
the narrow blocks real files have (MAF_LARGE_BLOCKS.md measures ce11's 26-way at
a 7bp median). Check which shape a profile came from before ranking work off it.

Read plus bgzf decompress is ~29 ms behind ~186 ms of CPU on the wide shape, so
I/O does not hide CPU work here.

### Reproducing it

`plugins/maf/benches/mafTabixFixture.ts` writes the wide fixture (1600 blocks ×
26 species × 250 columns) in the BED-with-entries shape `MafTabixAdapter` reads
out of column 6, then `bgzip` and `tabix -p bed`. **Divergence is graded 2–20%
across species**; a uniform rate gets the mismatch count, and so the profile,
wrong in both directions. The generator is deterministic, so the 2.5 MB output
stays out of the repo.

## Shipped levers

- **Columnar wire**, rehydrated at placement: `postMessage` went from 3.3 s to
  0.03 ms on one region.
- **The packer is fed from the adapter's subscription** with no buffered sizing
  pass; `executeMafAlignmentData.ts` has why buffering lost on narrow blocks.
- **Adapters parse straight into the packer** with no `MafFeature`
  ([ADR-195](../architecture-decision-records/adr-195-a-maf-adapter-parses-its-blocks-into-the-packer.md),
  which has the table). It pays on narrow blocks, not wide ones.
- **Byte-native tabix lines** (`GMOD/tabix-js#156`) were declined: the win was
  the single-pass restructure a byte callback forces, not the bytes, and on the
  narrow shape the bytes add nothing. GMOD/tabix-js ADR 0006 holds the
  measurement.
- `computeSNPCoverage` in `packages/alignments-core` emits SNP segments in
  position order, not first-appearance order. That differs only for unsorted
  mismatches (alignments, per read), and nothing downstream reads the order.

## Two kernels that look like wins and are not

The JSDoc on `computeMafCoverage` carries both, where someone about to try them
will be.

**The transpose** to one sequential scan per row measures **0.92x–1.06x** at
block widths from 120 to 32,000 columns: a column-major sweep's working set is
one block, and 26 concurrent streams still prefetch.

**SWAR** (reading the arena as `Uint32`, four columns at once) measures **4.5x**
only by testing "is a base" as `folded >= 0x40`, which reclassifies `.` and `*`.
Exact semantics need three lane-wise zero-byte tests per word, and the
output-identical walk measured **0.51x**. The 4.5x was the semantic change,
priced.

**Trap for anyone bit-twiddling here:** the textbook zero-byte test
`(v - 0x01010101) & ~v & 0x80808080` answers "any zero byte" correctly, but its
per-lane flags lie — the borrow flags a lane holding 1 beside a lane holding 0.
Use `~(((v & 0x7f7f7f7f) + 0x7f7f7f7f) | v | 0x7f7f7f7f)`. Miscounting one base
in a million never shows in a coverage bar.

## Decompose a hot loop before declaring it finished

Counting the per-cell operations of `computeMafCoverage` said nothing was left,
because the loop was never ALU bound. `plugins/maf/benches/mafCoverage.bench.ts`
decomposes it instead: measure the bare loop against loop-plus-output, sweep the
working set, and peel the body one operation at a time. That found a per-cell
bound test answering a per-block question; hoisting it to the per-block
`uniformRows` scan is 1.13-1.24x on the whole function. The same hoist on the
insertion loop pays only at implausible gap rates, because that loop runs on gap
columns alone — how often a loop runs bounds what fixing it can buy.

## Declined and parked

- **Mismatch decimation** — binning or skipping mismatch emission above some
  bp-per-pixel — is the largest remaining win and a fidelity compromise, held
  back by preference until free performance runs out. The tooltip also wants
  per-position detail on hover.
- **A WebAssembly SIMD kernel** is the only thing that beats the exact-semantics
  ceiling (`v128` has real byte compares). It costs a wasm module and a build
  step, more than this stage justifies alone; if another hot loop wants one,
  this walk is a second customer.
