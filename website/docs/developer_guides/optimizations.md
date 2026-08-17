---
title: Optimizations
description:
  Where a track's time goes, the measured optimizations that moved it, what each
  one replaced, and what is still slow
guide_category: Advanced topics
---

**TL;DR:** A track's cost splits three ways — a cold fetch in a worker, a frame
on the main thread, and the bundle a page evaluates before either can run — and
an optimization that moves one of them rarely touches the other two. This page
says what dominates each, what we changed, and what each change measured.

Everything here is measured, and every measurement names where to reproduce it.
Several of the obvious next steps have already been measured as losses, and
those are on the page too, because a reader deciding what to try needs them more
than they need the wins.

## Three clocks

| clock        | what runs                                                               | what dominates it      |
| ------------ | ----------------------------------------------------------------------- | ---------------------- |
| a cold fetch | index read, range requests, decompression, record building, summarizing | decompression          |
| a frame      | React re-render, a uniform write, one draw call per pass                | main-thread JavaScript |
| first paint  | the modules every host evaluates before a plugin can register           | plugin registration    |

[](/docs/developer_guides/dataflow) draws the path these sit on.

## The fetch clock

### Decompression is where a cold query's time goes

A BGZF-backed query spends 70-90% of its wall clock inflating the blocks it
fetched, against a fraction of a millisecond to a few milliseconds building
records out of them. Two things follow, and they are the only two that matter at
this layer: the codec is WebAssembly, and the blocks go to a pool.

[`@gmod/bgzf-filehandle`](https://github.com/GMOD/bgzf-filehandle) inflates
through libdeflate compiled to wasm, which sits at parity with native `zlib` and
beats a per-block JavaScript inflate by 2.6-3.5x. That leaves running blocks in
parallel as the remaining lever, which is `sharedBgzfWorkerPool()` — four
workers, one pool per JS context, wired into `BamAdapter` and every
`TabixIndexedFile` site. On BAM that is worth **1.95x** end to end, measured
over a 22-view pan and zoom across 1000x long-read data with both arms returning
the same 38,246 records.

Tabix is worth appreciably less. Same pool, a 213 MB slice of 1000 Genomes over
`chr1`, headless Chrome, real HTTP with range requests, arms interleaved, min of
six:

<!-- BEGIN GENERATED MEASUREMENT bgzf-pool-tabix -->

| workload      | records | unpooled | pooled | speedup |
| ------------- | ------- | -------- | ------ | ------- |
| 50kb window   | 2,732   | 803ms    | 562ms  | 1.43x   |
| 100kb window  | 4,878   | 1222ms   | 887ms  | 1.38x   |
| 200kb window  | 7,627   | 1880ms   | 1289ms | 1.46x   |
| 400kb window  | 8,503   | 2025ms   | 1390ms | 1.46x   |
| 12 x 20kb pan | 7,627   | 2446ms   | 1822ms | 1.34x   |

<!-- END GENERATED MEASUREMENT bgzf-pool-tabix -->

The gap to BAM is structural. Running a second pan over the same file answers
from the decompressed chunk cache and so inflates nothing, which separates the
two halves: line scanning alone is 28% of the cold query, and the pool reaches
the other 72% at 1.83x. Amdahl puts the end-to-end figure at 1.49x against 1.45x
measured. A 1000 Genomes line carries a genotype field per sample, so that floor
is per-line byte scanning on enormous lines — anyone wanting more than 1.5x on
multi-sample VCF should attack the scan.

**The pool degrades silently, so verify it engages.** jbrowse-web runs adapters
under `WebWorkerRpcDriver`, so the pool is a worker spawning workers. Where
nested workers are unavailable — Safari below 16.4 — the pool resolves to
`undefined`, every read inflates in process, and nothing fails: no error, no
failing test, just the speedup gone. Count worker targets with puppeteer while
loading one bgzip-backed track: four `blob:` workers means engaged, zero means
it fell back, and a bigwig track is the control that spawns none.
[BGZF_WORKER_POOL.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/BGZF_WORKER_POOL.md)
has the harness and the three benchmark traps, two of which produce numbers that
look real.

### Ask for less before asking faster

A byte estimate comes off the index alone. `getRegionByteSize` in
[`@gmod/bbi`](https://github.com/GMOD/bbi-js) sums the on-disk block lengths the
R-tree reports; `@gmod/bam`'s `estimatedBytesForRegions` forecasts the chunks
the query will actually read. Both cost tenths of a millisecond against a
download that may be megabytes, which is what makes them usable as a gate before
the query is issued at all — the `regionTooLarge` banner and its Force load
escape are
[documented with the fetch chain](/docs/developer_guides/data_fetching#byte-estimation-and-regiontoolarge).

A whole-genome overview asks one file for many regions at once, and fetching
them independently costs a round trip each.
`BigWigAdapter.getFeatureArraysMulti` hands the whole set to the library in one
call, which walks every region's index concurrently, dedupes blocks by file
offset and coalesces the union — so a block two windows share is read once, and
blocks from different regions merge into one read when they are adjacent on
disk. A row of adjacent windows collapses to a single read that way, and the
byte count falls with it, because the boundary blocks were being downloaded and
inflated by both of the windows touching them; the numbers are in
[`@gmod/bbi`'s own optimizations doc](https://github.com/GMOD/bbi-js/blob/main/docs/optimizations.md),
which owns that measurement.

What it gives up is progressive drawing: per-region fetching fills a
whole-genome view in as regions arrive, and a batched reader answers all of them
at once. Both modes exist for that reason, and
[ADR-022](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/architecture-decision-records/adr-022-no-batched-wiggle-rpc.md)
is the reversal that added the batched one.

### Level of detail is a precomputed tier, chosen on the main thread

`jbrowse make-pif` writes two tiers into one tabix-indexed PIF, distinguished by
a one-letter prefix on the seqid: a fine tier carrying per-row CIGAR, and a
coarse tier without it, split wherever an indel exceeds the threshold so each
piece's bounding box stays tight. The view asks for a tier alongside the region,
so a zoom is a request for different data.

The tier's value is entirely a function of CIGAR weight per row, because a
coarse row passes through every other tag:

<!-- BEGIN GENERATED MEASUREMENT pif-coarse-tier-bytes -->

| block len | CIGAR bytes/row | coarse/fine bytes | file vs `--no-coarse` |
| --------- | --------------- | ----------------- | --------------------- |
| 1.5 kb    | 12              | **0.89**          | 1.89×                 |
| 10 kb     | 72              | 0.66              | 1.66×                 |
| 50 kb     | 360             | 0.30              | 1.30×                 |
| 200 kb    | 1.4 K           | 0.10              | 1.10×                 |
| 5 Mb      | 36 K            | **0.005**         | 1.00×                 |

<!-- END GENERATED MEASUREMENT pif-coarse-tier-bytes -->

The last column is what carrying both tiers costs the file. At the top of that
table the switch gives up indel wedges to read 11% fewer bytes, and at the
bottom it cuts the read by 200x. **The coarse tier cuts per-alignment cost and
does not cut alignment count**, so it is the right tool for a few huge
alignments with megabase CIGARs and marginal for a dense all-vs-all pangenome,
where the bottleneck is N.

Read-time binning is the obvious answer to that N, and it is capped. Profiling a
whole-genome fetch of a human-vs-mouse-scale PIF splits the cost 66% reading and
parsing lines against 34% constructing features and everything downstream —
binning inside the line callback cannot touch the first number, so its ceiling
is about 1.5x. Only a precomputed binned tier cuts the dominant half.
[SYNTENY_LOD.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/SYNTENY_LOD.md)
carries the phase table and the recommended scheme.

### Cancel what the user has already left

A pan that outruns its own fetch leaves bytes in flight, and coalescing makes
each of those reads large: `RemoteFileWithRangeCache` merges a contiguous run of
missing 256 KiB chunks into one request, so a single small viewport over a 2000x
BAM issues one 6.5 MiB range read. Measured on a four-hop pan burst throttled to
50 KiB/s, three of six requests aborted about 1.6 s in having transferred ~80
KiB each — roughly 19.5 MiB abandoned that would otherwise have been downloaded
in full and discarded.

The saving is `range size − (rate × time-to-cancel)`, so it shrinks on a fast
link. The range size is large regardless of link speed, which is what makes this
real bandwidth on any connection slow enough for a user to out-pace a read.
[NETWORK_ABORT.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/NETWORK_ABORT.md)
records which adapters are wired to a stop token, the two that cannot be, and
the shared-fetch coalescing trap that comes with cancelling a read two callers
are waiting on.

## The boundary between them

The worker boundary belongs to neither clock, which is why it is its own
section: what crosses it is decided by the decoder and paid for by the frame.

### One shape, parsed and moved and drawn

A decoded block is one typed array per attribute, and a record is an index
shared across them. The same buffers cross the worker boundary as
[transferables](/docs/developer_guides/rpc_workers#returning-arraybuffers-zero-copy),
so ownership moves in constant time, and the same buffers upload to the graphics
card. The shape a decoder produces is the shape the shader reads, and nothing on
the path translates between representations.

That property is what the individual wins below compound into, and it is worth
more than any of them. The MAF worker is the clearest single measurement of the
boundary itself: moving its payload to a columnar wire rehydrated at placement
took `postMessage` from 3.3 s to 0.03 ms on one region.

### A string per sample per site is the thing to remove

`computeSampleInfo` makes one pass per feature over
[`@gmod/vcf`](https://github.com/GMOD/vcf-js)'s callback — which reports a
genotype as a range into the line — and from that single pass interns genotype
codes, accumulates ploidy and phasing into typed arrays indexed by column, and
folds the legend flags. The cell loops then index those codes and key their
style memos by code, so a genotype string is materialized once per site per
distinct genotype.

<!-- BEGIN GENERATED MEASUREMENT genotype-codes-speedup -->

| corpus                                                          |   speedup |
| --------------------------------------------------------------- | --------: |
| 1000G phase 3 (2504 samples)                                    | **1.87x** |
| 1000G high-coverage (3202 samples, `GT:AB:AD:DP:GQ:PGT:PID:PL`) | **2.47x** |

<!-- END GENERATED MEASUREMENT genotype-codes-speedup -->

Codes, dictionary, sample order, ploidy, phasing and legend flags are all
byte-identical across the change. **The two halves of it do not measure
separately**: packing a short genotype into one int read as 1.02x on its own and
not worth having, because the name-keyed lookup beside it was masking it, and it
was worth another 1.15x once that lookup went. That pairing is the trap the
measurement exists to record.

Reading one FORMAT field is the same lesson one layer up.
`feature.get('samples')` parses every FORMAT field of every sample — an object
and an array apiece — to reach the one field a phase-set color needs:

<!-- BEGIN GENERATED MEASUREMENT format-fields-vs-samples -->

| callset                  | `samples`       | `processFormatFields` |
| ------------------------ | --------------- | --------------------- |
| 100 samples, 2k variants | 343ms / 239MB   | 33ms / 4MB            |
| 500 samples, 2k variants | 1686ms / 1.17GB | 113ms / 4MB           |

<!-- END GENERATED MEASUREMENT format-fields-vs-samples -->

### Two kernels that look like wins and are not

Both live as comments on the function a reader would try them in.

**Transposing the MAF coverage walk** to make it one sequential scan per row
measures 0.92x-1.06x across block widths from 120 to 32,000 columns. A
column-major sweep's working set is one block, a few tens of KB, and where a
block does exceed L2 the 26 concurrent streams still prefetch.

**SWAR over the same walk** — reading the arena as `Uint32` and classifying four
columns at once — measures 4.5x for a kernel doing only the depth and match
counts, and 0.51x once it is exact. The whole 4.5x is bought by testing "is this
a base" as `folded >= 0x40`, which reclassifies `.` and `*`. Testing for `-` and
` ` exactly costs three lane-wise zero-byte tests per word against the
threshold's single add. **The 4.5x was the semantic change, priced.**

What did move that walk was decomposition rather than inspection: the largest
single item in the per-cell body turned out to be a bounds test answering a
per-block question, and hoisting it to a per-block scan is 1.13-1.24x across
eight shapes.
[MAF_WORKER_PIPELINE.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/MAF_WORKER_PIPELINE.md)
has the method — measure the bare loop against the loop-plus-output, sweep the
working set, peel the body one operation at a time.

## The frame clock

### A pan or a zoom is a redraw

`attachRenderingBackend` spawns two MobX autoruns: one uploads when the data
changes, one redraws when anything visible changes. Because the bytes on the
graphics card are genomic coordinates, a pan, a zoom, a recolor, a re-sort and a
resize are all changes of shader parameter over data that is already there. The
[GPU display guide](/docs/developer_guides/creating_gpu_display) is the
walkthrough, and the
[architecture spec](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/ARCHITECTURE.md#gpu-rendering-architecture)
is the reference.

### Coordinates are absolute uint32, split in the shader

Every position array crossing the worker boundary holds absolute genomic
positions as `uint32`. Absolute, because region boundaries move on zoom-out and
anything keyed to `regionStart` is silently invalidated when the anchor shifts;
`uint32`, because that is exact to 4.29 Gbp at four bytes per vertex.

Float32 is where the precision goes, so the split happens at the conversion. The
shader cuts the integer into a high half (bits 12..31) and a low half (bits
0..11), both exact in float32, splits the viewport start the same way on the
CPU, and subtracts hi-from-hi and lo-from-lo separately — every subtraction is
large-minus-large or small-minus-small, and none of them cancels
catastrophically. This is the standard double-single representation, and
GenomeSpy applies it to the same problem.

Two alternatives, and what each costs: `uint32` converted in one step loses
precision above about 16 Mbp, and float hi/lo vertex attributes double
per-vertex position memory and push the split onto every CPU packer.
[BP_PRECISION.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/BP_PRECISION.md)
carries the real `hpToClipX`, which threads an extra term precisely so the
compiler cannot algebraically collapse the split back into one large-magnitude
subtraction.

### Interaction cost is React re-render

Frame time during a zoom scales roughly linearly with CPU throttle, the RPC
workers profile 100% idle through the gesture, and what runs is React re-render
plus CSS-in-JS. So the lever is the number of components that re-render per
frame.

Attributing every DOM mutation during a 5x zoom to its nearest `data-testid`
subtree found the churn in the coordinate ruler and not in the track overlays:
719 structural node add/remove in the scalebar against 2 of 2056 mutations in
the alignments overlays. `ScalebarCoordinateLabels` created and destroyed ~144
tick `<div>`s per zoom, because keying by base reuses nodes during a pan — where
the labels do not move at all — and rebuilds the list on a zoom, where every key
changes.

<!-- BEGIN GENERATED MEASUREMENT scalebar-zoom-churn -->

| during a 5× zoom                     | identity keys | positional keys |
| ------------------------------------ | ------------- | --------------- |
| structural (mount/unmount), scalebar | 535           | **248**         |
| attribute patches, scalebar          | 323           | 499             |
| total mutations                      | 1523          | 1369            |

<!-- END GENERATED MEASUREMENT scalebar-zoom-churn -->

Read the trade rather than the total: structural churn is the expensive class,
since each new node pays styling, layout and paint, and the rise in attribute
patches is the same work done the cheap way on nodes that survived.

### A long list costs per row

The hierarchical track selector looks model-bound — it rebuilds on every filter
keystroke, re-reads configs, re-sorts, re-flattens. A keystroke over 2000 tracks
costs well under a millisecond of model work; mounting the rows costs about 1.4
ms each. So dropping one MUI wrapper per row pays, and caching the tree does
not. Two alternating A/B rounds, min and median agreeing, one DOM node per row
removed:

<!-- BEGIN GENERATED MEASUREMENT track-selector-row-cost -->

| n=1000 tracks               | before         | after          |
| --------------------------- | -------------- | -------------- |
| mount, min of 9             | 1656 / 1631 ms | 1460 / 1401 ms |
| toggle re-render, min of 18 | 80.6 / 73.6 ms | 63.3 / 66.1 ms |
| DOM nodes                   | 21506          | 20505          |

<!-- END GENERATED MEASUREMENT track-selector-row-cost -->

Three model-side optimizations measured null, and
[TRACK_SELECTOR_PERF.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/TRACK_SELECTOR_PERF.md)
records them so nobody spends a second session on them: caching the unfiltered
hierarchy and pruning per keystroke, preserving node identity so memoized items
bail out, and resolving each track's name and categories once instead of per
keystroke.

### An index helps a hover when the hulls are narrow

Synteny picking stabs a `flatbush` index of per-instance x-hulls and tests what
comes back exactly. The index is 1D — a ribbon spans the whole track height, so
horizontal extent is the only discriminator — and a ribbon's hull spans both of
its endpoints. Together those decide the whole performance story.

Both tables are 300k instances with the viewport parked mid-genome, differing
only in how query and target are paired. `kept` is how many instances survive
the pickable-width exclusion and therefore enter the tree; `candidates` is how
many the stab returns for one hover.

Two related genomes, where the index works:

<!-- BEGIN GENERATED MEASUREMENT synteny-pick-collinear -->

| zoom         | kept         | candidates @0 skew | warm pick | rebuild |
| ------------ | ------------ | ------------------ | --------- | ------- |
| whole-genome | **0** / 300k | — (no tree)        | —         | 1.0ms   |
| 1/100        | 143k         | 16                 | <0.1ms    | 33ms    |
| 1/10k        | 299k         | 19                 | <0.1ms    | 58ms    |

<!-- END GENERATED MEASUREMENT synteny-pick-collinear -->

An all-vs-all PAF, where it does not:

<!-- BEGIN GENERATED MEASUREMENT synteny-pick-random -->

| zoom         | kept         | candidates @0 skew | warm pick  | rebuild |
| ------------ | ------------ | ------------------ | ---------- | ------- |
| whole-genome | **0** / 300k | — (no tree)        | —          | 1.2ms   |
| 1/100        | 143k         | **71,342**         | **5.8ms**  | 42ms    |
| 1/10k        | 299k         | **149,307**        | **12.5ms** | 77ms    |

<!-- END GENERATED MEASUREMENT synteny-pick-random -->

On two related genomes a hull is about as wide as its alignment and a handful
cover any pixel. On an all-vs-all PAF half the hulls span the canvas, the stab
returns them, and each pays a projection and a cull test. 12.5 ms is inside a 16
ms frame and leaves nothing for anything else, so that hover reads as sluggish.
The
[measurement page](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/SYNTENY_PICKING.md)
also records what is not worth trying against it.

## The load clock

Every JBrowse host downloads and evaluates a set of modules before it can
register a plugin, and plugin registration makes most of that unavoidable. What
was making it pay for far more was six pins, all the same mistake at different
scales: **a module that must be evaluated eagerly names a React component.**

Measured on the build-your-own examples site, whose sparsest page is a measured
div, one wiggle track and no JBrowse chrome at all:

<!-- BEGIN GENERATED MEASUREMENT eager-bundle-chunks -->

|                | eager chunks | gzipped |
| -------------- | ------------ | ------- |
| before         | 347          | 667 KB  |
| after pins 1-3 | 219          | 523 KB  |
| after pin 4    | 218          | 514 KB  |
| after pin 5    | 181          | 464 KB  |

<!-- END GENERATED MEASUREMENT eager-bundle-chunks -->

Same page throughout, rendering the same thing; the sixth pin was measured on a
different host and in different units. A `lazy()` at a registration site only
holds if nothing else in an eagerly evaluated module names the same component,
and a plugin `exports` object is the easiest place to name one by accident — it
is evaluated when the class is defined.

The same reasoning is why `sharedBgzfWorkerPool` reaches `@gmod/bgzf-filehandle`
through a dynamic import. That package inlines its worker bundle as base64, so a
static import pins the blob into the initial bundle of every entry point that
can reach the helper: 23.4 KB gzipped, against 141 bytes plus a chunk fetched
once a bgzip-backed track is opened.

## What the data provider controls

Some of the largest wins are decisions about the files, not about the code.

- **Bgzip and index.** Everything above rests on range requests against a block
  index. A plain `.vcf` or `.gff` is read whole.
- **Serve range requests, and expose the headers to CORS.** A host that answers
  `200` to a `Range` request turns every query into a whole-file download.
- **Write the coarse tier** (`jbrowse make-pif` does by default). Suppressing it
  costs the zoomed-out read the table above measures.
- **Precompute a summary.** A BigWig carries zoom levels; a pileup does not, and
  a coverage view over deep alignments pays for that at every zoom.
- **One chunked array beats one file per sample.** A signal track built from one
  BigWig per sample is latency-bound: each file needs several reads to locate a
  region before it can read it, and those reads wait on one another, so the cost
  is a round trip times the number of files.
  [Population CNV](/docs/tutorials/population_cnv) packs the same values into
  one chunked array instead.

## What is still slow

- **Interaction is main-thread React re-render bound**, and the residual after
  the ruler fix is the rest of the components that read `bpPerPx` / `offsetPx`
  each frame. Closing it needs a React-render-level measurement, not a CPU flame
  graph.
- **A coarse tick lands every ~500 ms** and invalidates a per-track computed
  chain that repaints every open canvas on one frame. Counted, the recompute is
  warranted — the stats genuinely change at every tick — so what is left is
  staggering it or making the repaint cheaper.
- **One track's parse is single-threaded.** Worker assignment is sticky per
  adapter, which is what makes the inflate pool worth having and is also a
  ceiling.
- **A hover over an all-vs-all PAF** costs what the picking table says, and the
  hull index cannot fix it.
- **A whole-genome dense synteny view is bound by N**, and only a precomputed
  binned tier reaches the dominant two-thirds of that cost.
- **Mismatch decimation** would cut the MAF worker's largest remaining emission,
  and is a fidelity compromise held back deliberately while free performance
  remains.

[ARCHITECTURAL_LIMITS.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/ARCHITECTURAL_LIMITS.md)
is the live register of these, each with the condition that would retire it.

## Reproducing any of this

Every number on this page names the fixture and the method in the reference doc
it links to. Before adding one of your own, read
[BENCHMARKING.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/BENCHMARKING.md),
which catalogues the traps that have produced fake numbers in this repo, each
with the bogus figure it actually reported. The four that recur:

- **Interleave the arms.** Any drift in machine state otherwise lands entirely
  on whichever arm ran second.
- **Let the caches warm.** At three rounds the inflate pool measured 0.74x — the
  pool apparently making things slower — and 1.46x at six.
- **Node cannot measure anything worker-shaped.** `getSharedWorkerPool()` needs
  a global `Worker` and Blob URLs, so every vitest bench of it reports parity
  forever.
- **A ratio survives a loaded machine; a millisecond does not.** Absolute
  figures taken while the box is descheduling are not properties of the code.

The parser libraries each keep their own equivalent of this page, and the fetch
half of the path is theirs:
[`@gmod/bam`](https://github.com/GMOD/bam-js/blob/main/docs/optimizations.md),
[`@gmod/tabix`](https://github.com/GMOD/tabix-js/blob/main/docs/optimizations.md),
[`@gmod/cram`](https://github.com/GMOD/cram-js/blob/main/docs/optimizations.md),
[`@gmod/bbi`](https://github.com/GMOD/bbi-js/blob/main/docs/optimizations.md)
and
[`@gmod/bgzf-filehandle`](https://github.com/GMOD/bgzf-filehandle/blob/main/docs/optimizations.md).
