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
Several of the obvious next steps measured as losses, and those are on the page
too: a reader deciding what to try needs them more than the wins.

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
second while nothing repaints. Between those two sits one `postMessage`, and
[the shape of what crosses it](#the-worker-boundary) is why moving one of them
leaves the other alone.

[](/docs/developer_guides/dataflow) draws the path these sit on. What a session
_retains_ is a fourth axis none of these clocks measures, and is
[](/docs/developer_guides/memory).

## The fetch clock

### Decompression is where a cold query's time goes

BAM, CRAM and every tabix-indexed format store their data as a long run of
independently compressed blocks (BGZF), and a query fetches the blocks its index
named and decompresses them. That decompression is 70-90% of the query's wall
clock, against a fraction of a millisecond to a few milliseconds building
records out of the bytes. Two things follow, and nothing else at this layer
matters: the decompressor is WebAssembly, and the blocks go to a pool of
workers.

[`@gmod/bgzf-filehandle`](https://github.com/GMOD/bgzf-filehandle/blob/main/docs/optimizations.md#the-codec)
inflates through libdeflate compiled to wasm, at parity with native `zlib` and
2.6-3.5x a per-block JavaScript inflate. That leaves running blocks in parallel,
which is `sharedBgzfWorkerPool()` —
[four workers](https://github.com/GMOD/bgzf-filehandle/blob/main/docs/worker-pool.md#four-workers-is-not-the-ceiling),
one pool per JS context, wired into `BamAdapter` and every `TabixIndexedFile`
site. On BAM it is worth **1.95x** end to end, over a 22-view pan and zoom
across 1000x long-read data with both arms returning the same 38,246 records.

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

The gap to BAM is structural. A tabix query decompresses its blocks and then
scans the text inside them line by line, and only the first half is what the
pool speeds up. Running a second pan over the same file answers from the
decompressed chunk cache and so decompresses nothing, which measures the two
halves apart: the line scan alone is 28% of the cold query, and the pool reaches
the rest at 1.83x. Amdahl's law puts the end-to-end figure at 1.49x against
1.45x measured. A 1000 Genomes line carries a genotype field per sample, so that
28% is byte scanning on enormous lines — more than 1.5x on multi-sample VCF
means attacking
[the scan](https://github.com/GMOD/tabix-js/blob/main/docs/optimizations.md#scanning-lines),
not the decompression.

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

An index says how big a region's data is before anything downloads it.
[`getRegionByteSize`](https://github.com/GMOD/bbi-js/blob/main/docs/optimizations.md#forecasting-a-query-costs-no-data-blocks)
sums the on-disk block lengths a BigWig's index reports;
[`estimatedBytesForRegions`](https://github.com/GMOD/bam-js/blob/main/docs/optimizations.md#forecasting-a-query-costs-no-io)
does the same for the chunks a BAM query would read. Both cost tenths of a
millisecond against a download that may be megabytes, so they can gate a query
before it is issued — the `regionTooLarge` banner and its Force load escape are
[documented with the fetch chain](/docs/developer_guides/data_fetching#byte-estimation-and-regiontoolarge).

A whole-genome overview asks one file for many regions at once, and fetching
them independently costs a round trip each.
`BigWigAdapter.getFeatureArraysMulti` hands the whole set to the library in one
call, which walks every region's index at once, drops any block two regions both
asked for, and merges blocks that sit next to each other on disk into a single
read. A row of adjacent windows collapses to one read that way, and the bytes
fall with it, since a block on the boundary between two of them used to be
downloaded and decompressed twice.
[`@gmod/bbi`](https://github.com/GMOD/bbi-js/blob/main/docs/optimizations.md#many-regions-in-one-pass)
owns that measurement.

What it gives up is progressive drawing: per-region fetching fills a
whole-genome view in as regions arrive, and a batched reader answers all of them
at once. Both modes exist for that reason, and
[ADR-022](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/architecture-decision-records/adr-022-no-batched-wiggle-rpc.md)
is the reversal that added the batched one.

### Level of detail is a precomputed tier, chosen on the main thread

A synteny file says which piece of one genome aligns to which piece of another,
and at whole-genome zoom its per-base detail is invisible. `jbrowse make-pif`
therefore writes each alignment twice into one indexed file (a PIF): a fine copy
carrying the per-base alignment string (its CIGAR), and a coarse copy without
it, cut wherever an insertion or deletion is large enough that one bounding box
would misrepresent the alignment. A one-letter prefix on the sequence name
separates the two, so asking for a zoom level is asking for a different region
name, and a zoom becomes a request for different data.

How much the coarse copy saves depends entirely on how many CIGAR bytes a row
carries, since it keeps every other field:

<!-- BEGIN GENERATED MEASUREMENT pif-coarse-tier-bytes -->

| block len | CIGAR bytes/row | coarse/fine bytes | file vs `--no-coarse` |
| --------- | --------------- | ----------------- | --------------------- |
| 1.5 kb    | 12              | **0.89**          | 1.89x                 |
| 10 kb     | 72              | 0.66              | 1.66x                 |
| 50 kb     | 360             | 0.30              | 1.30x                 |
| 200 kb    | 1.4 K           | 0.10              | 1.10x                 |
| 5 Mb      | 36 K            | **0.005**         | 1.00x                 |

<!-- END GENERATED MEASUREMENT pif-coarse-tier-bytes -->

That table is what carrying both copies costs the file. What reading the coarse
one saves is a different measurement, taken on a real hosted alignment — a
human/mouse liftOver chain converted to a PIF — by counting the bytes the server
actually sent for one whole-genome pass:

<!-- BEGIN GENERATED MEASUREMENT pif-tier-wire-bytes -->

| one whole-genome pass, hs1 vs mm39 | bytes over the wire | rows returned | range requests | bytes/row |
| ---------------------------------- | ------------------: | ------------: | -------------: | --------: |
| coarse (no CIGAR)                  |         **1.31 MB** |        43,839 |              6 |        30 |
| fine (per-row CIGAR)               |            64.23 MB |        75,076 |             22 |       856 |

<!-- END GENERATED MEASUREMENT pif-tier-wire-bytes -->

Both arms read every row of their own tier out of the same file, so this is not
a comparison of two differently-built files. The `bytes/row` column is the one
to read: the coarse copy does not return far fewer alignments, it returns
alignments that are far smaller, and what separates them is the CIGAR.

Back to the file-size table: the last column is what carrying both copies costs
the file; the `coarse/fine bytes` column beside it is what reading the coarse
one saves. With 1.5 kb alignment blocks it gives up indel detail for almost
nothing; at 5 Mb it is the difference between reading the CIGARs and not. **The
coarse copy makes each alignment cheaper and does not make them fewer**, so it
suits a few huge alignments with megabase CIGARs, and does little for a dense
all-vs-all comparison, where the cost is the number of alignments.

Binning alignments together as they are read is the obvious answer to that, and
it is capped. Profiling a whole-genome fetch of a human-vs-mouse-scale PIF puts
66% of the cost in reading and parsing lines and 34% in building features and
everything after, and binning inside the line callback cannot touch the first
number, so its ceiling is about 1.5x. Only a file that already carries binned
alignments cuts the larger half.
[SYNTENY_LOD.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/SYNTENY_LOD.md)
carries the phase table and the recommended scheme.

### Cancel what the user has already left

A user who pans faster than the data arrives leaves reads in flight for regions
already off screen, and those reads are big:
[`RemoteFileWithRangeCache`](https://github.com/GMOD/range-cache-filehandle)
merges a run of neighbouring 256 KiB chunks into one request, so one small
viewport over a 2000x BAM issues a single 6.5 MiB range read. Aborting them is
worth real bandwidth. Measured on a four-hop pan burst throttled to 50 KiB/s,
three of six requests aborted about 1.6 s in having transferred ~80 KiB each —
roughly 19.5 MiB abandoned that would otherwise have arrived in full and been
thrown away.

The saving is `range size − (rate × time-to-cancel)`, so a fast link saves less;
the range is large whatever the link speed, so any connection slow enough for a
user to out-pace a read saves something.
[NETWORK_ABORT.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/NETWORK_ABORT.md)
records which adapters are wired to a stop token, the two that cannot be, and
what goes wrong when the read being cancelled is one
[two callers are sharing](https://github.com/GMOD/range-cache-filehandle/blob/main/docs/sharing.md#giving-up).

### Don't cut a genotype string out of the line for every sample

A row of a multi-sample VCF carries one genotype per sample, and drawing that
row used to mean cutting one substring out of the line per sample.
[`@gmod/vcf`](https://github.com/GMOD/vcf-js/blob/main/docs/optimizations.md#one-pass-per-sample-however-many-keys-you-ask-for)
reports each genotype as a pair of offsets into the line it already holds, and
`computeSampleInfo` walks those in a single pass per row: each distinct genotype
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
byte-identical across the change. **The two halves do not measure separately.**
Packing a genotype into one integer measured 1.02x alone, which reads as not
worth having; the lookup beside it, keyed by sample name, was hiding it, and the
packing was worth another 1.15x once that lookup went. That pairing is the trap
[MULTI_SAMPLE_VARIANTS.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/MULTI_SAMPLE_VARIANTS.md)
exists to record.

Reading one per-sample field is the same lesson one layer up.
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

### Two kernels that look like wins and are not

Both live as comments on the function a reader would try them in.

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
`folded >= 0x40`, which puts `.` and `*` on the wrong side of the line. Testing
for `-` and ` ` exactly costs three lane-wise zero-byte tests per word against
that one comparison. **The 4.5x was the semantic change, priced.**

What did move the walk was decomposition: the largest single item in the
per-cell body was a bounds test answering a question about the whole block, and
hoisting it to a per-block scan is 1.13-1.24x across eight shapes.
[MAF_WORKER_PIPELINE.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/MAF_WORKER_PIPELINE.md)
has the method — measure the bare loop against the loop-plus-output, sweep the
working set, peel the body one operation at a time.

## The worker boundary

A track's data is built in a worker and drawn on the main thread, so all of it
crosses one `postMessage`. What crosses is
[one typed array per attribute](https://github.com/GMOD/cram-js/blob/main/docs/optimizations.md#columns-not-objects)
— every record's start position in one array, every record's color in another —
and a record is an index shared across them. Arrays in that shape cross as
[transferables](/docs/developer_guides/rpc_workers#returning-arraybuffers-zero-copy),
so handing a block over costs the same whether it holds ten records or a
million, and they are the buffers the graphics card takes, so the main thread
uploads them without reading them. The decoder writes the arrays the shader
reads, and no step in between converts between representations.

That is the largest single win here, and everything else on this page compounds
on top of it. The MAF worker is where it was measured: sending typed arrays
instead of objects took its `postMessage` from 3.3 s to 0.03 ms on one region.

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

Zooming in is where that shows up largest, since the new view is a strict subset
of the reads the card already holds. Over a 1000x long-read pileup the block
renderer JBrowse shipped in 4.3.0 refetches, showing a loading indicator for
15321ms<!--m:zoom-in-refetch.1000x-longread.baselineMs-->; the redraw that
replaces it is 50ms<!--m:zoom-in-refetch.1000x-longread.redrawMs-->. **Quoting
that as the speedup overstates it** — zoom in is the one gesture where this
architecture skips the work rather than doing it faster.
[RENDERER_BENCHMARKS.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/RENDERER_BENCHMARKS.md)
carries the whole table, why it is imported from a sibling checkout instead of
measured here, and the two of its neighbours that are not publishable.

### Coordinates are absolute uint32, split in the shader

Every position array crossing the worker boundary holds absolute genomic
positions as `uint32`. Absolute, because region boundaries move on zoom-out and
anything keyed to `regionStart` is silently invalidated when the anchor shifts;
`uint32`, because that is exact to 4.29 Gbp at four bytes per vertex.

A shader does its arithmetic in float32, which cannot hold a coordinate that
large exactly, so the conversion is where the precision would go. The shader
therefore cuts the integer into a high half (bits 12..31) and a low half (bits
0..11), each small enough to be exact in float32, cuts the viewport start the
same way on the CPU, and subtracts high from high and low from low separately.
Every subtraction is then large-minus-large or small-minus-small, and none of
them cancels catastrophically. GenomeSpy applies the same double-single
representation to the same problem.

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
subtree put the churn in the coordinate ruler: the scalebar accounted for most
of the mutation count and the alignments overlays for two mutations.
`ScalebarCoordinateLabels` created and destroyed a `<div>` per tick label per
zoom, because keying the list by base position reuses nodes during a pan — where
the labels do not move at all — and rebuilds it on a zoom, where every key
changes.

<!-- BEGIN GENERATED MEASUREMENT scalebar-zoom-churn -->

| during a 5× zoom                     | identity keys | positional keys |
| ------------------------------------ | ------------: | --------------: |
| structural (mount/unmount), scalebar |           535 |         **248** |
| attribute patches, scalebar          |           323 |             499 |
| total mutations                      |         1,523 |           1,369 |

<!-- END GENERATED MEASUREMENT scalebar-zoom-churn -->

Read the trade rather than the total. Creating and destroying nodes is the
expensive class, since each new node pays styling, layout and paint, and the
rise in attribute patches is that same work done the cheap way, on nodes that
survived.
[INTERACTION_PERF.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/INTERACTION_PERF.md)
has the mutation-attribution harness this came off.

### A long list costs per row

The hierarchical track selector looks model-bound — it rebuilds on every filter
keystroke, re-reads configs, re-sorts, re-flattens. A keystroke over 2000 tracks
costs well under a millisecond of model work; mounting the rows costs about 1.4
ms each. So dropping one MUI wrapper per row pays, and caching the tree does
not. Two alternating A/B rounds, min and median agreeing, one DOM node per row
removed:

<!-- BEGIN GENERATED MEASUREMENT track-selector-row-cost -->

| n=1000 tracks               | before min | before median | after min | after median |
| --------------------------- | ---------: | ------------: | --------: | -----------: |
| mount, min of 9             |     1656ms |        1631ms |    1460ms |       1401ms |
| toggle re-render, min of 18 |     80.6ms |        73.6ms |    63.3ms |       66.1ms |
| DOM nodes                   |     21,506 |             — |    20,505 |            — |

<!-- END GENERATED MEASUREMENT track-selector-row-cost -->

Three model-side optimizations measured null, and
[TRACK_SELECTOR_PERF.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/TRACK_SELECTOR_PERF.md)
records them so nobody spends a second session on them: caching the unfiltered
hierarchy and pruning per keystroke, preserving node identity so memoized items
bail out, and resolving each track's name and categories once instead of per
keystroke.

### An index helps a hover only when the alignments are short

Hovering a synteny view has to find which alignment sits under the pointer. It
asks a `flatbush` interval index which alignments' horizontal extents cover that
x, then tests those exactly. The index is one-dimensional, because a ribbon
spans the whole track height and only its horizontal extent tells it apart from
another; and a ribbon's extent covers everything between its two endpoints.
Those two facts decide the whole performance story.

Both tables are 300k drawn ribbons with the viewport parked mid-genome,
differing only in which genome each ribbon connects to. `kept` is how many
ribbons are wide enough to be worth picking and so enter the index; `candidates`
is how many the index returns for one hover.

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
inside a 16 ms frame and leaves nothing for anything else, so the hover feels
sluggish. The
[measurement page](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/SYNTENY_PICKING.md)
also records what is not worth trying against it.

## The load clock

Every JBrowse host downloads and evaluates a set of modules before it can
register a plugin, and registration makes most of that unavoidable. Six pins
made it pay for far more, all the same mistake at different scales: **a module
that must be evaluated eagerly names a React component**, which pulls that
component and everything it imports into the initial bundle.

Measured on the build-your-own examples site, whose sparsest page is a measured
div, one wiggle track and no JBrowse chrome at all:

<!-- BEGIN GENERATED MEASUREMENT eager-bundle-chunks -->

|                | eager chunks | gzipped |
| -------------- | -----------: | ------: |
| before         |          347 |  667 KB |
| after pins 1-3 |          219 |  523 KB |
| after pin 4    |          218 |  514 KB |
| after pin 5    |          181 |  464 KB |

<!-- END GENERATED MEASUREMENT eager-bundle-chunks -->

Same page throughout, rendering the same thing; the sixth pin was measured on a
different host and in different units.
[EAGER_BUNDLE.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/EAGER_BUNDLE.md)
names all six and how each was found. A `lazy()` at a registration site only
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
- **Write the coarse copy of a synteny file** (`jbrowse make-pif` does by
  default). Suppressing it costs the zoomed-out read the table above measures.
- **Precompute a summary.** A BigWig carries zoom levels; a pileup does not, and
  a coverage view over deep alignments pays for that at every zoom.
- **One chunked array beats one file per sample.** A signal track built from one
  BigWig per sample is latency-bound: each file needs several reads to locate a
  region before it can read it, and those reads wait on one another, so the cost
  is a round trip times the number of files.
  [Population CNV](/docs/tutorials/population_cnv) packs the same values into
  one chunked array instead.

## What is still slow

Each of these is owned by the reference doc that measured it, and that doc is
where the next attempt starts.

- **Interaction is main-thread React re-render bound**, and the residual after
  the ruler fix is the rest of the components that read `bpPerPx` / `offsetPx`
  each frame. Closing it needs a React-render-level measurement, not a CPU flame
  graph
  ([INTERACTION_PERF.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/INTERACTION_PERF.md)).
- **The coarse blocks a view works against advance about every ~500 ms during a
  gesture**, and each advance invalidates a per-track computed chain that
  repaints every open canvas on one frame. Counted, the recompute is warranted —
  a new coarse window covers different data, so the stats genuinely change — so
  what is left is staggering it or making the repaint cheaper
  ([INTERACTION_PERF.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/INTERACTION_PERF.md),
  and the suppression direction is closed in
  [REJECTED_IDEAS.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/REJECTED_IDEAS.md)).
- **One track's parse is single-threaded.** Worker assignment is sticky per
  adapter, which is what makes the inflate pool worth having and is also a
  ceiling.
- **A hover over an all-vs-all comparison** costs what the picking table says,
  and the index cannot fix it
  ([SYNTENY_PICKING.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/SYNTENY_PICKING.md)).
- **A dense whole-genome synteny view is bound by the number of alignments**,
  and only a file that already carries binned alignments reaches the dominant
  two-thirds of that cost
  ([SYNTENY_LOD.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/SYNTENY_LOD.md)).
- **Dropping small mismatches** would cut the MAF worker's largest remaining
  emission. It trades fidelity for speed, so it is held back deliberately while
  free performance remains
  ([MAF_WORKER_PIPELINE.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/MAF_WORKER_PIPELINE.md)).

One of these is also an architectural limit rather than a slow path: the sticky
worker assignment has a retire condition, and
[ARCHITECTURAL_LIMITS.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/ARCHITECTURAL_LIMITS.md)
carries it beside the GPU and scoping ceilings [](/docs/developer_guides/memory)
sends you to. The rest are measured costs of the current design with nothing yet
proposed to retire them, which is why they are on this page instead.

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

Taking a first measurement at all is a different problem from not faking one,
and
[PERF_INSTRUMENTATION.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/PERF_INSTRUMENTATION.md)
carries the patterns for the frame clock — what to instrument for a render or a
scroll that feels slow, validated against a real jank report rather than
invented for the doc.

The parser libraries each keep their own equivalent of this page, and the fetch
half of the path is theirs. Each ends with a "what the consumer has to do"
section, which is the other side of this one:
[`@gmod/bam`](https://github.com/GMOD/bam-js/blob/main/docs/optimizations.md),
[`@gmod/tabix`](https://github.com/GMOD/tabix-js/blob/main/docs/optimizations.md),
[`@gmod/cram`](https://github.com/GMOD/cram-js/blob/main/docs/optimizations.md),
[`@gmod/bbi`](https://github.com/GMOD/bbi-js/blob/main/docs/optimizations.md),
[`@gmod/vcf`](https://github.com/GMOD/vcf-js/blob/main/docs/optimizations.md)
and
[`@gmod/bgzf-filehandle`](https://github.com/GMOD/bgzf-filehandle/blob/main/docs/optimizations.md).
