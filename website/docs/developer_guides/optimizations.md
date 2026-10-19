---
title: Optimizations
description:
  Where a track's time goes, the measured optimizations that moved it, what each
  one replaced, and what is still slow
guide_category: Advanced topics
---

A track's cost splits three ways: a cold fetch in a worker, a frame on the main
thread, and the bundle a page evaluates before either can run. An optimization
that moves one of them rarely touches the other two. The sections below say what
dominates each, what we changed, and what each change measured.

Everything here is measured, and every measurement names where to reproduce it.
Several of the obvious next steps measured as losses, and those are on the page
too.

## Three clocks

| clock        | what runs                                                               | what dominates it      | how you know you are on it                                      |
| ------------ | ----------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------- |
| a cold fetch | index read, range requests, decompression, record building, summarizing | decompression          | the RPC workers are busy and the wait tracks the region's bytes |
| a frame      | React re-render, one shader parameter write, one draw call per pass     | main-thread JavaScript | the time scales with CPU throttle and the RPC workers are idle  |
| first paint  | the modules every host evaluates before a plugin can register           | plugin registration    | it is over before any track has been asked for                  |

Identify the clock before optimizing, because the three barely interact:
[the frame clock](#interaction-cost-is-react-re-render) profiles the RPC workers
at 100% idle through a whole gesture, and
[the fetch clock](#decompression-is-where-a-cold-querys-time-goes) is most of a
second while nothing repaints. One `postMessage` separates the two, so moving
one of them leaves the other alone; [the worker boundary](#the-worker-boundary)
describes what crosses it.

The path these clocks run along is in [](/docs/developer_guides/dataflow). What
a session _retains_ is a fourth axis that none of these clocks measures; see
[](/docs/developer_guides/memory).

## The fetch clock

### Decompression is where a cold query's time goes

BAM, CRAM and every tabix-indexed format store their data as a long run of
independently compressed blocks (BGZF), and a query fetches the blocks its index
named and decompresses them. That decompression is 70-90% of the query's wall
clock, against a fraction of a millisecond to a few milliseconds building
records out of the bytes. Two things follow: the decompressor is WebAssembly,
and the blocks go to a pool of workers.

[`@gmod/bgzf-filehandle`](https://github.com/GMOD/bgzf-filehandle/blob/main/docs/optimizations.md#the-codec)
inflates through libdeflate compiled to wasm, at parity with native `zlib` and
2.6-3.5x a per-block JavaScript inflate. That leaves running blocks in parallel,
which `sharedBgzfWorkerPool()` does with
[four workers](https://github.com/GMOD/bgzf-filehandle/blob/main/docs/worker-pool.md#four-workers-is-not-the-ceiling),
one pool per JS context, wired into `BamAdapter` and every `TabixIndexedFile`
site. On BAM a pan through jbrowse-web gains
1.00-1.10x<!--m:bgzf-pool-bam.speedup.range-->, measured against a build whose
pool is off:

<!-- BEGIN GENERATED MEASUREMENT bgzf-pool-bam -->

| track            | in process | pooled | paired speedup |
| ---------------- | ---------- | ------ | -------------- |
| 20x short read   | 597ms      | 597ms  | 1.00x          |
| 200x short read  | 558ms      | 594ms  | 1.02x          |
| 1000x short read | 714ms      | 649ms  | 1.10x          |
| 20x long read    | 598ms      | 598ms  | 1.01x          |
| 200x long read   | 580ms      | 561ms  | 1.01x          |
| 1000x long read  | 1277ms     | 1185ms | 1.09x          |

<!-- END GENERATED MEASUREMENT bgzf-pool-bam -->

The pans above follow each other within 600 ms of the last fetch, so
`FetchVisibleRegions` coalesces them, and that wait rather than the inflate is
most of every row under 1000x.

Tabix, measured on a 213 MB slice of 1000 Genomes over `chr1`, with the same
pool, headless Chrome, real HTTP with range requests and arms interleaved:

<!-- BEGIN GENERATED MEASUREMENT bgzf-pool-tabix -->

| workload      | records | unpooled | pooled | speedup | cached | scan share | inflate speedup |
| ------------- | ------- | -------- | ------ | ------- | ------ | ---------- | --------------- |
| 50kb window   | 2,732   | 498ms    | 246ms  | 2.02x   | 96ms   | 19%        | 2.68x           |
| 100kb window  | 4,878   | 887ms    | 496ms  | 1.79x   | 234ms  | 26%        | 2.49x           |
| 200kb window  | 7,627   | 1351ms   | 697ms  | 1.94x   | 360ms  | 27%        | 2.94x           |
| 400kb window  | 8,503   | 1494ms   | 776ms  | 1.93x   | 400ms  | 27%        | 2.91x           |
| 12 x 20kb pan | 7,627   | 1465ms   | 944ms  | 1.55x   | 452ms  | 31%        | 2.06x           |

<!-- END GENERATED MEASUREMENT bgzf-pool-tabix -->

A tabix query decompresses its blocks and then scans the text inside them line
by line, and the pool speeds up only the first half. The `cached` column runs
the same views again from the decompressed chunk cache, which decompresses
nothing, and so measures the two halves apart: the line scan alone is
19-31%<!--m:bgzf-pool-tabix.scanShare.range--> of the cold query, and the pool
speeds up the rest by 2.06-2.94x<!--m:bgzf-pool-tabix.inflateSpeedup.range-->. A
1000 Genomes line has a genotype field per sample, so the scan is byte scanning
on enormous lines, and getting much past 2x on multi-sample VCF means speeding
up
[the scan](https://github.com/GMOD/tabix-js/blob/main/docs/optimizations.md#scanning-lines).

**The pool falls back without reporting it, so verify it engages.** jbrowse-web
runs adapters under `WebWorkerRpcDriver`, so the pool is a worker spawning
workers. Where nested workers are unavailable (Safari below 16.4), the pool
resolves to `undefined` and every read inflates in process, with no error and no
failing test; the only symptom is the lost speedup. Count worker targets with
puppeteer while loading one bgzip-backed track: four `blob:` workers means
engaged, zero means it fell back, and a bigwig track is the control that spawns
none.
[BGZF_WORKER_POOL.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/BGZF_WORKER_POOL.md)
has the harness and the three benchmark traps, two of which produce numbers that
look real.

### Byte forecasts and multi-region reads

An index gives the size of a region's data before anything downloads it.
[`getRegionByteSize`](https://github.com/GMOD/bbi-js/blob/main/docs/optimizations.md#forecasting-a-query-costs-no-data-blocks)
sums the on-disk block lengths a BigWig's index reports;
[`estimatedBytesForRegions`](https://github.com/GMOD/bam-js/blob/main/docs/optimizations.md#forecasting-a-query-costs-no-io)
does the same for the chunks a BAM query would read. Both cost tenths of a
millisecond against a download that may be megabytes, so they can gate a query
before it is issued. The `regionTooLarge` banner and its Force load override are
[documented with the fetch chain](/docs/developer_guides/data_fetching#byte-estimation-and-regiontoolarge).

A whole-genome overview asks one file for many regions at once, and fetching
them independently costs a round trip each.
`BigWigAdapter.getFeatureArraysMulti` hands the whole set to the library in one
call, which walks every region's index at once, drops any block two regions both
asked for, and merges blocks that sit next to each other on disk into a single
read. A row of adjacent windows merges into one read that way, and the bytes
fall with it, since a block on the boundary between two of them would otherwise
be downloaded and decompressed twice.
[`@gmod/bbi`](https://github.com/GMOD/bbi-js/blob/main/docs/optimizations.md#many-regions-in-one-pass)
records that measurement.

A batched read loses progressive drawing: per-region fetching fills a
whole-genome view as regions arrive, while a batched reader returns all of them
at once. Both modes exist for that reason, and
[ADR-022](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/architecture-decision-records/adr-022-no-batched-wiggle-rpc.md)
records the reversal that added the batched one.

### Level of detail is a precomputed tier, chosen on the main thread

A synteny file lists which piece of one genome aligns to which piece of another,
and at whole-genome zoom the per-base detail is invisible. `jbrowse make-pif`
therefore writes each alignment twice into one indexed file (a PIF): a fine copy
with the per-base alignment string (its CIGAR), and a coarse copy without it,
cut wherever an insertion or deletion is large enough that one bounding box
would misrepresent the alignment. A one-letter prefix on the sequence name
separates the two, so asking for a zoom level is asking for a different region
name.

How much the coarse copy saves depends entirely on how many CIGAR bytes a row
holds, since it keeps every other field:

<!-- BEGIN GENERATED MEASUREMENT pif-coarse-tier-bytes -->

| block len | CIGAR bytes/row | coarse/fine bytes | file vs `--no-coarse` |
| --------- | --------------- | ----------------- | --------------------- |
| 1.5 kb    | 12              | **0.89**          | 1.89x                 |
| 10 kb     | 72              | 0.66              | 1.66x                 |
| 50 kb     | 360             | 0.30              | 1.30x                 |
| 200 kb    | 1.4 K           | 0.10              | 1.10x                 |
| 5 Mb      | 36 K            | **0.005**         | 1.00x                 |

<!-- END GENERATED MEASUREMENT pif-coarse-tier-bytes -->

The table above lists what keeping both copies adds to the file. A read of the
coarse copy saves a different amount, which we measured on a real hosted
alignment (a human/mouse liftOver chain converted to a PIF) by counting the
bytes the server sent for one whole-genome pass:

<!-- BEGIN GENERATED MEASUREMENT pif-tier-wire-bytes -->

| one whole-genome pass, hs1 vs mm39 | bytes over the wire | rows returned | range requests | bytes/row |
| ---------------------------------- | ------------------: | ------------: | -------------: | --------: |
| coarse (no CIGAR)                  |         **1.31 MB** |        43,839 |              6 |        30 |
| fine (per-row CIGAR)               |            64.23 MB |        75,076 |             22 |       856 |

<!-- END GENERATED MEASUREMENT pif-tier-wire-bytes -->

The coarse and fine arms each read every row of a different tier from the same
file. The `bytes/row` column is the one to read: the coarse copy returns
alignments that are far smaller, and the CIGAR accounts for the difference.

The coarse copy once split an alignment into pieces wherever an indel was large
enough to matter, and read whichever piece bounded the query region. It now has
one row per alignment plus a folded CIGAR (`cr:Z:`), which adds bytes back, on
the same hosted human/mouse file:

<!-- BEGIN GENERATED MEASUREMENT pif-coarse-fold-bytes -->

| coarse tier of hs1 vs mm39, one perspective |   rows | uncompressed |        gzip | rows with cr | fold share of bytes |
| ------------------------------------------- | -----: | -----------: | ----------: | -----------: | ------------------: |
| split pieces, no CIGAR (before 2026-09-02)  | 75,738 |      7.24 MB |     2.01 MB |            0 |                  0% |
| coarse CIGAR (cr:Z:)                        | 75,076 |      9.79 MB | **3.41 MB** |        5,047 |                 26% |

<!-- END GENERATED MEASUREMENT pif-coarse-fold-bytes -->

Under 7% of rows have a fold, and most of a fold's bytes are indels between 5
and 10 kb. These are too small to change a whole-genome view, and the fold keeps
them because the format bounds every run to within `--coarse` of the true path.

In the file-size table, the last column lists what keeping both copies adds to
the file, and the `coarse/fine bytes` column beside it lists what reading only
the coarse copy saves. With 1.5 kb alignment blocks it gives up indel detail for
almost nothing; at 5 Mb it is the difference between reading the CIGARs and not.
**The coarse copy makes each alignment cheaper and does not make them fewer**,
so it suits a few huge alignments with megabase CIGARs, and does little for a
dense all-vs-all comparison, where the cost is the number of alignments.

To reduce the cost of a dense all-vs-all comparison, the obvious step is to bin
alignments together as they are read, and its gain has a ceiling. Profiling a
whole-genome fetch of a human-vs-mouse-scale PIF shows 66% of the cost in
reading and parsing lines and 34% in building features and everything after, and
binning inside the line callback leaves the first number unchanged, so its
ceiling is about 1.5x. Only a file that already contains binned alignments cuts
the larger half.
[SYNTENY_LOD.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/SYNTENY_LOD.md)
has the phase table and the recommended scheme.

### Cancelling in-flight reads

A user who pans faster than the data arrives leaves reads in flight for regions
already off screen, and those reads are big:
[`RemoteFileWithRangeCache`](https://github.com/GMOD/range-cache-filehandle)
merges the gaps a parser's reads leave into few requests, so one small viewport
over a 2000x BAM issues a single range read of several MiB. Each abort saves
bandwidth. Measured on a four-hop pan burst throttled to 50 KiB/s, three of six
requests aborted about 1.6 s in, having transferred ~80 KiB each, and roughly
19.5 MiB was abandoned that would otherwise have arrived in full and been thrown
away.

The saving is `range size − (rate × time-to-cancel)`, so a fast link saves less;
the range is large whatever the link speed, so any connection slow enough for a
user to out-pace a read saves something.
[NETWORK_ABORT.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/NETWORK_ABORT.md)
records which adapters forward the signal, the two that cannot, and what goes
wrong when the read being cancelled is one
[two callers are sharing](https://github.com/GMOD/range-cache-filehandle/blob/main/docs/sharing.md#giving-up).

### Genotype codes in a multi-sample VCF

A row of a multi-sample VCF has one genotype per sample, and drawing that row
from substrings cuts one out of the line per sample.
[`@gmod/vcf`](https://github.com/GMOD/vcf-js/blob/main/docs/optimizations.md#one-pass-per-sample-however-many-keys-you-ask-for)
reports each genotype as a pair of offsets into the line it already holds, and
`analyzeVariants` walks those in a single pass per row: each distinct genotype
becomes a small integer code, and ploidy and phasing go into typed arrays as it
goes. The drawing loop then works in codes and keys its style memo by code, so
`0|1` is built as a string once per row rather than once per sample.

<!-- BEGIN GENERATED MEASUREMENT genotype-codes-speedup -->

| corpus                                                          |   speedup |
| --------------------------------------------------------------- | --------: |
| 1000G phase 3 (2504 samples)                                    | **1.87x** |
| 1000G high-coverage (3202 samples, `GT:AB:AD:DP:GQ:PGT:PID:PL`) | **2.47x** |

<!-- END GENERATED MEASUREMENT genotype-codes-speedup -->

Codes, dictionary, sample order, ploidy, phasing and legend flags all come out
byte-identical across the change. **The two halves measure only together.**
Packing a genotype into one integer measured 1.02x alone, which suggests it is
not worth having; the lookup beside it, keyed by sample name, masked the gain,
and the packing was worth another 1.15x once that lookup went.
[MULTI_SAMPLE_VARIANTS.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/MULTI_SAMPLE_VARIANTS.md)
records this pairing.

`feature.get('samples')` builds an object and an array for every FORMAT field of
every sample to reach the one field a phase-set color needs, where
[`processFormatFields`](https://github.com/GMOD/vcf-js/blob/main/docs/optimizations.md#samples-is-the-fallback-and-it-costs-like-one)
reads that field alone:

<!-- BEGIN GENERATED MEASUREMENT format-fields-vs-samples -->

| callset                  | `samples` time | `samples` peak | `processFormatFields` time | `processFormatFields` peak |
| ------------------------ | -------------- | -------------- | -------------------------- | -------------------------- |
| 100 samples, 2k variants | 343ms          | 239 MB         | 33ms                       | 4 MB                       |
| 500 samples, 2k variants | 1686ms         | 1.17 GB        | 113ms                      | 4 MB                       |

<!-- END GENERATED MEASUREMENT format-fields-vs-samples -->

### The MAF column-counting kernel {#two-kernels-that-look-like-wins-and-are-not}

Two rewrites of the kernel measure flat or worse, and both are recorded as
comments on the function a reader would try them in.

A multiple-alignment display counts, for each screen column, how many species
have a base there and how many match the reference. The kernel is a loop over a
block of packed alignment text, one byte per species per column.

**Transposing that walk**, so it reads one species' row end to end instead of
one column across all species, measures 0.92x-1.06x across blocks 120 to 32,000
columns wide. The column-major version's working set is a single block, a few
tens of KB, and where a block does exceed the L2 cache the 26 species being read
at once still prefetch.

**Reading four columns at a time** through a `Uint32Array` view measures 4.5x
for a kernel that only counts depth and matches, and 0.51x once it classifies
correctly. The whole 4.5x comes from testing "is this a base" as
`folded >= 0x40`, which classifies `.` and `*` incorrectly. An exact test for
`-` and ` ` costs three lane-wise zero-byte tests per word, against that one
comparison.

Decomposition did move the walk: the largest single item in the per-cell body
was a bounds test answering a question about the whole block, and hoisting it to
a per-block scan is 1.13-1.24x across eight shapes.
[MAF_LARGE_BLOCKS.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/MAF_LARGE_BLOCKS.md)
has the method: measure the bare loop against the loop-plus-output, sweep the
working set, and peel the body one operation at a time.

## The worker boundary

A track's data is built in a worker and drawn on the main thread, so all of it
crosses one `postMessage`. What crosses is
[one typed array per attribute](https://github.com/GMOD/cram-js/blob/main/docs/optimizations.md#columns-not-objects)
(every record's start position in one array, every record's color in another),
and a record is an index shared across them. Arrays in that shape cross as
[transferables](/docs/developer_guides/rpc_workers#returning-arraybuffers-zero-copy),
so handing a block over costs the same whether it holds ten records or a
million. They are also the buffers the graphics card takes, so the main thread
uploads them without reading them. The decoder writes the arrays the shader
reads, and no step in between converts between representations.

Sending typed arrays instead of objects is the largest single win here: on one
region, the MAF worker's `postMessage` fell from 3.3 s to 0.03 ms.

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

The gain is largest when zooming in, since the new view is a strict subset of
the reads the card already holds. Over a 1000x long-read pileup the block
renderer JBrowse shipped in 4.3.0 refetches, showing a loading indicator for
15321ms<!--m:zoom-in-refetch.1000x-longread.baselineMs-->; the redraw that
replaces it is 50ms<!--m:zoom-in-refetch.1000x-longread.redrawMs-->. **Quoting
that as the speedup overstates it**, because zoom in is the one gesture where
this architecture skips the work rather than doing it faster. The two per-base
color modes are the exception: their worker output is sampled at the zoom's
sub-pixel bin, so a zoom-in that crosses an octave refetches at most once per
octave, which is two or three calls over a seven-octave gesture, each a subset
of the last
([PER_BASE_SUBPIXEL_BIN.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/PER_BASE_SUBPIXEL_BIN.md)).
[BENCHMARKING.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/BENCHMARKING.md)
has the whole table, why it is imported from a sibling checkout instead of
measured here, and the two of its neighbours that are not publishable.

### Coordinates are absolute uint32, split in the shader

Every position array crossing the worker boundary holds absolute genomic
positions as `uint32`. Absolute, because region boundaries move on zoom-out and
anything keyed to `regionStart` becomes wrong when the anchor shifts; `uint32`,
because that is exact to 4.29 Gbp at four bytes per vertex.

A shader does its arithmetic in float32, which holds a coordinate that large
only approximately, so the conversion would lose precision. The shader therefore
cuts the integer into a high half (bits 12..31) and a low half (bits 0..11),
each small enough to be exact in float32, cuts the viewport start the same way
on the CPU, and subtracts high from high and low from low separately. Every
subtraction is then large-minus-large or small-minus-small, and none of them
cancels catastrophically. GenomeSpy applies the same double-single
representation to the same problem.

Two alternatives, and what each costs: `uint32` converted in one step loses
precision above about 16 Mbp, and float hi/lo vertex attributes double
per-vertex position memory and push the split onto every CPU packer.
[BP_PRECISION.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/BP_PRECISION.md)
has the real `hpToClipX`, which threads an extra term so the compiler cannot
algebraically merge the split back into one large-magnitude subtraction.

### Interaction cost is React re-render

Frame time during a zoom scales roughly linearly with CPU throttle, the RPC
workers profile 100% idle through the gesture, and what runs is React re-render
plus CSS-in-JS. The cost to reduce is therefore the number of components that
re-render per frame.

We attributed every DOM mutation during a 5x zoom to its nearest `data-testid`
subtree, which located the churn in the coordinate ruler: the scalebar accounted
for most of the mutation count and the alignments overlays for two mutations.
`ScalebarCoordinateLabels` created and destroyed a `<div>` per tick label per
zoom, because keying the list by base position reuses nodes during a pan (the
labels do not move at all) and rebuilds it on a zoom, where every key changes.

<!-- BEGIN GENERATED MEASUREMENT scalebar-zoom-churn -->

| during a 5× zoom                     | identity keys | positional keys |
| ------------------------------------ | ------------: | --------------: |
| structural (mount/unmount), scalebar |           535 |         **248** |
| attribute patches, scalebar          |           323 |             499 |
| total mutations                      |         1,523 |           1,369 |

<!-- END GENERATED MEASUREMENT scalebar-zoom-churn -->

Read the trade in the table. Creating and destroying nodes is the expensive
class, since each new node needs styling, layout and paint, and the rise in
attribute patches is that same work done the cheap way, on nodes that survived.
[INTERACTION_PERF.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/INTERACTION_PERF.md)
has the mutation-attribution harness that produced this table.

### A computed that rebuilds an array invalidates everything downstream

The number of components that re-render per frame is the cost above, and the
commonest way to add to it is a MobX computed that returns a fresh array of the
same content. The view rebuilds `visibleRegions` on every pan and zoom frame, so
anything deriving from it re-runs per frame whether or not the answer changed.
For that reason the view publishes its content's right edge as a scalar, and the
alignments display compares the region set structurally before merging junctions
against it.

The sashimi overlay is the worked example. Its splice-junction merge depends on
loaded data, the region set on screen and two filter settings; only the
projection to screen x depends on the pan. In one computed, a gesture recomputed
both although only the projection changed. Split, at real RNA-seq junction
counts:

<!-- BEGIN GENERATED MEASUREMENT sashimi-frame-split -->

| region copies | junction entries merged | merge + project (was) | project only (is) | control | of the frame the merge was |
| ------------: | ----------------------: | --------------------: | ----------------: | ------: | -------------------------: |
|             1 |                     651 |               0.516ms |           0.271ms | 0.530ms |                    **47%** |
|             3 |                   1,953 |               0.838ms |           0.236ms | 0.861ms |                    **72%** |

<!-- END GENERATED MEASUREMENT sashimi-frame-split -->

The bigger case is a track with nothing to draw, where the computed still costs
time. Junction arcs are on by default wherever the coverage band draws, so every
alignments track evaluates that pipeline, and reads off DNA have no splice
junction at all, yet the computed still rebuilt a list of empty sections per
frame, and its overlay re-rendered on all 20 frames of a zoom to return a list
of nulls. One shared empty array, returned instead, takes that to zero.

**The same measurement showed no case for** moving these arcs off SVG onto the
canvas the neighbouring read-connection arcs use. The case would be per-feature
DOM work, and none of the expensive kind exists: the paths are keyed by
junction, so React reuses them and a pan patches one path attribute per arc
while creating and destroying no nodes. The coordinate ruler above was fixed to
work the same way.
[INTERACTION_PERF.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/INTERACTION_PERF.md)
has both counts and lists what this still does not measure: a whole-app frame
budget on RNA-seq, because no fixture in the repo has the junction counts for
it.

### The track selector's per-row cost

The hierarchical track selector rebuilds on every filter keystroke, re-reads
configs, re-sorts and re-flattens. A keystroke over 2000 tracks costs well under
a millisecond of model work; mounting the rows costs about 1.4 ms each. One
fewer MUI wrapper per row therefore saves time, and caching the tree does not.
Two alternating A/B rounds agree, with one DOM node per row removed:

<!-- BEGIN GENERATED MEASUREMENT track-selector-row-cost -->

| n=1000 tracks               | before, round 1 | before, round 2 | after, round 1 | after, round 2 |
| --------------------------- | --------------: | --------------: | -------------: | -------------: |
| mount, min of 9             |          1656ms |          1631ms |         1460ms |         1401ms |
| toggle re-render, min of 18 |          80.6ms |          73.6ms |         63.3ms |         66.1ms |
| DOM nodes                   |          21,506 |               — |         20,505 |              — |

<!-- END GENERATED MEASUREMENT track-selector-row-cost -->

Three model-side optimizations measured null, and
[BENCHMARKING.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/BENCHMARKING.md)
records them so nobody spends a second session on them: caching the unfiltered
hierarchy and pruning per keystroke, preserving node identity so memoized items
bail out, and resolving each track's name and categories once instead of per
keystroke.

### Hover picking in a synteny view

A hover over a synteny view must find which alignment is under the pointer. It
asks a `flatbush` interval index which alignments' horizontal extents cover that
x, then tests those exactly. The index is one-dimensional, because a ribbon
spans the whole track height and only its horizontal extent tells it apart from
another; and a ribbon's extent covers everything between its two endpoints.
Those two facts determine the performance.

The collinear and all-vs-all tables below are each 300k drawn ribbons with the
viewport parked mid-genome, differing only in which genome each ribbon connects
to. `kept` is how many ribbons are wide enough to be worth picking and so enter
the index; `candidates` is how many the index returns for one hover.

Two related genomes, where the index works:

<!-- BEGIN GENERATED MEASUREMENT synteny-pick-collinear -->

| zoom         | kept (of 300k) | candidates @0 skew | warm pick | rebuild |
| ------------ | -------------: | -----------------: | --------: | ------: |
| whole-genome |          **0** |        — (no tree) |         — |     1ms |
| 1/100        |           143k |                 16 |    <0.1ms |    33ms |
| 1/10k        |           299k |                 19 |    <0.1ms |    58ms |

<!-- END GENERATED MEASUREMENT synteny-pick-collinear -->

An all-vs-all comparison, where every sequence is aligned against every other,
and where it does not:

<!-- BEGIN GENERATED MEASUREMENT synteny-pick-random -->

| zoom         | kept (of 300k) | candidates @0 skew |  warm pick | rebuild |
| ------------ | -------------: | -----------------: | ---------: | ------: |
| whole-genome |          **0** |        — (no tree) |          — |   1.2ms |
| 1/100        |           143k |         **71,342** |  **5.8ms** |    42ms |
| 1/10k        |           299k |        **149,307** | **12.5ms** |    77ms |

<!-- END GENERATED MEASUREMENT synteny-pick-random -->

Between two related genomes an alignment joins nearby coordinates, so its extent
is about as wide as the alignment itself and a handful of them cover any pixel.
In an all-vs-all comparison an alignment can join anything to anything, half the
extents span the canvas, the index returns all of them, and each one costs a
projection and a test. 12.5ms<!--m:synteny-pick-random.1-10k.warmPickMs--> fits
inside a 16 ms frame but uses most of it, so the hover feels sluggish. The
[measurement page](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/SYNTENY_LOD.md#synteny-picking-measured)
also records what is not worth trying against it.

## The load clock

Every JBrowse host downloads and evaluates a set of modules before it can
register a plugin, and registration makes most of that unavoidable. Six pins
added far more to that set, and all six are the same mistake at different
scales: **a module that must be evaluated eagerly names a React component**,
which pulls that component and everything it imports into the initial bundle.

Measured on the build-your-own examples site, whose sparsest page is a measured
div, one wiggle track and no JBrowse chrome:

<!-- BEGIN GENERATED MEASUREMENT eager-bundle-chunks -->

|                | eager chunks | gzipped |
| -------------- | -----------: | ------: |
| before         |          347 |  667 KB |
| after pins 1-3 |          219 |  523 KB |
| after pin 4    |          218 |  514 KB |
| after pin 5    |          181 |  464 KB |

<!-- END GENERATED MEASUREMENT eager-bundle-chunks -->

The table measures the same page throughout, rendering the same thing; the sixth
pin was measured on a different host and in different units.
[EAGER_BUNDLE.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/EAGER_BUNDLE.md)
names all six and how each was found. A `lazy()` at a registration site only
holds if nothing else in an eagerly evaluated module names the same component,
and a plugin `exports` object is the easiest place to name one by accident,
because it is evaluated when the class is defined.

The accounting above stops at the host. A config that names a third-party plugin
adds the whole of it to the same clock, because a plugin store bundle is one
file: [](/docs/developer_guides/plugin_load_cost) is the author's side of this
page.

A static import of `@gmod/bgzf-filehandle` would repeat that mistake, so
`sharedBgzfWorkerPool` reaches it through a dynamic import. The package inlines
its worker bundle as base64, so a static import pins the blob into the initial
bundle of every entry point that can reach the helper: 23.4 KB gzipped, against
141 bytes plus a chunk fetched once a bgzip-backed track is opened.

## What the data provider controls

Some of the largest wins are decisions about the files.

- **Bgzip and index.** Everything above rests on range requests against a block
  index. A plain `.vcf` or `.gff` is read whole.
- **Serve range requests, and expose the headers to CORS.** A host that answers
  `200` to a `Range` request turns every query into a whole-file download.
- **Write the coarse copy of a synteny file** (`jbrowse make-pif` does by
  default). Without it, the zoomed-out read loses the saving the table above
  measures.
- **Precompute a summary.** A BigWig has zoom levels; a pileup does not, and a
  coverage view over deep alignments pays for that at every zoom.
- **One chunked array beats one file per sample.** A signal track built from one
  BigWig per sample is latency-bound: each file needs several reads to locate a
  region before it can read it, and those reads wait on one another, so the cost
  is a round trip times the number of files.
  [Population CNV](/docs/tutorials/population_cnv) packs the same values into
  one chunked array instead.

## What is still slow

The reference doc that measured each item below is where the next attempt
starts.

- **Interaction is main-thread React re-render bound**, and the residual after
  the ruler fix is the rest of the components that read `bpPerPx` / `offsetPx`
  each frame. Closing it needs a React-render-level measurement, not a CPU flame
  graph
  ([INTERACTION_PERF.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/INTERACTION_PERF.md)).
- **The coarse blocks a view works against advance about every ~500 ms during a
  gesture**, and each advance invalidates a per-track computed chain that
  repaints every open canvas on one frame. The recompute is warranted, because a
  new coarse window covers different data and the stats change. What is left is
  staggering it or making the repaint cheaper
  ([INTERACTION_PERF.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/INTERACTION_PERF.md);
  the declined ideas rule out the suppression direction).
- **One track's parse is single-threaded.** Worker assignment is sticky per
  adapter. Sticky assignment makes the inflate pool worth having and is also a
  ceiling.
- **A hover over an all-vs-all comparison** costs what the picking table lists,
  and the index cannot fix it
  ([SYNTENY_LOD.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/SYNTENY_LOD.md#synteny-picking-measured)).
- **A dense whole-genome synteny view is bound by the number of alignments**,
  and only a file that already contains binned alignments reaches the dominant
  two-thirds of that cost
  ([SYNTENY_LOD.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/SYNTENY_LOD.md)).
- **Dropping small mismatches** would cut the MAF worker's largest remaining
  emission. It trades fidelity for speed, so it is held back deliberately while
  free performance remains
  ([MAF_LARGE_BLOCKS.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/MAF_LARGE_BLOCKS.md)).

One of these is also an architectural limit: the sticky worker assignment has a
retire condition, and
[ARCHITECTURAL_LIMITS.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/ARCHITECTURAL_LIMITS.md)
lists it beside the GPU and scoping ceilings that
[](/docs/developer_guides/memory) describes. The rest are measured costs of the
current design, with no proposal yet to retire them.

## Why not an existing engine, why not Rust

We evaluated drawing through Pixi or deck.gl and rewriting the hot loops in
Rust. [why not deck.gl, Pixi, Rust or wgpu](/docs/developer_guides/why_not_x)
discusses each one, including the three places Rust already is.

## Reproducing a measurement

Every number on this page names the fixture and the method in the reference doc
it links to. Before adding one of your own, read
[BENCHMARKING.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/BENCHMARKING.md),
which catalogues the traps that have produced fake numbers in this repo, each
with the bogus figure it reported. The four that recur:

- **Interleave the arms.** A change in machine state during the run otherwise
  biases only the arm that ran second.
- **Let the caches warm.** At three rounds the inflate pool measured 0.74x (the
  pool apparently making things slower) and 1.46x at six.
- **Node cannot measure anything that uses workers.** `getSharedWorkerPool()`
  needs a global `Worker` and Blob URLs, so every vitest bench of it reports
  parity forever.
- **A ratio survives a loaded machine; a millisecond does not.** Absolute
  figures taken while the box is descheduling are not properties of the code.

BENCHMARKING.md also has the patterns for taking a first measurement of the
frame clock: what to instrument for a render or a scroll that feels slow,
validated against a real jank report.

Each parser library has an equivalent of this page for the fetch half of the
path. Each ends with a "what the consumer has to do" section, which is the other
side of this one:
[`@gmod/bam`](https://github.com/GMOD/bam-js/blob/main/docs/optimizations.md),
[`@gmod/tabix`](https://github.com/GMOD/tabix-js/blob/main/docs/optimizations.md),
[`@gmod/cram`](https://github.com/GMOD/cram-js/blob/main/docs/optimizations.md),
[`@gmod/bbi`](https://github.com/GMOD/bbi-js/blob/main/docs/optimizations.md),
[`@gmod/vcf`](https://github.com/GMOD/vcf-js/blob/main/docs/optimizations.md)
and
[`@gmod/bgzf-filehandle`](https://github.com/GMOD/bgzf-filehandle/blob/main/docs/optimizations.md).
