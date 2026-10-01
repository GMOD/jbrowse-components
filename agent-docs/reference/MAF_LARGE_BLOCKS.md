---
name: maf-large-blocks
description: How does the MAF plugin fetch, parse and draw alignments — why megabase blocks are slow and clipping is the wrong fix, where the worker time goes, why sub-pixel cells take no floor, and how a row opens its species' own genome?
kind: measurement
---

# The MAF plugin: fetch, worker pipeline, sub-pixel cells, navigation

This doc holds what a session touching `plugins/maf` needs before it measures or
redesigns anything: the fetch cost of long MAF-tabix blocks, the worker stages
and the kernels that measure worse than they look, the render-side lessons, the
rule that sub-pixel cells draw at natural width, and the row-to-genome navigation
design. [MULTIWAY_SYNTENY_DISPLAY.md](MULTIWAY_SYNTENY_DISPLAY.md),
[MODIFICATION_TAGS.md](MODIFICATION_TAGS.md) and
[ORTHOLOG_TABLES.md](ORTHOLOG_TABLES.md) cover the neighbouring displays.

## Fetch cost of megabase blocks

The fetch-cost work is parked: no file this repo can reach has a block wide enough
to be the reported problem. Sub-pixel decimation fixed render cost at zoom-out and
nothing about fetch cost.

### Confirm the premise first

The design assumes a reporter's blocks are enormous, which started as speculation
from a bug report with no sample data. Run this against their `.bed.gz` before
building anything, and stop if the max block is a few kb:

```sh
bgzip -dc their.bed.gz | awk '{print $3-$2}' | sort -n | tail -5
```

The widest line in every in-tree MAF-tabix file is about 20 kb, so nothing here
reproduces the problem. Long blocks come from the producer (`hal2maf` without
chunking, pairwise chains converted to MAF), not from MAF generally.

### Why one long block is expensive at every layer

MAF-tabix is one BED line per alignment block, every species' gapped sequence in
column 6 (`maf_to_bed.py`, read by `MafTabixAdapter`). Tabix returns whole
overlapping lines, so a query touching one base of a 1 Mb block across 10 species
downloads, decompresses, splits, encodes and ships all ~10 MB. Zooming in does not
help; cost quantizes by block, not by view.

### The byte gate measures, so block-quantized files are its best case

The gate once rescaled one measurement linearly by span, which block-quantized
formats break: zooming 100x into a megabase block divided the estimate by 100
while the cost stayed. The gate now takes a real measurement at the viewport being
judged and has no span floor ([REGION_TOO_LARGE.md](REGION_TOO_LARGE.md)
§"Measurement follows the viewport" and §"The sub-floor budget tier").
`ByteEstimate.zoomIneffective` detects a flat estimate across zoom, so the banner
stops advising "zoom in" on such a file and offers force-load. Nothing in the gate
is MAF-specific. Zooming into a megabase block shows "Requested too much data" and
the user chooses, rather than freezing.

### Rejected: clip blocks to the visible region

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

### The options that work

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

### The zoom-out tier is opt-in

All four MAF adapters take a `summaryAdapter` slot: point it at a `BedTabixAdapter`
over the BED `maf2bed --summary` writes in the same pass, or at a
`bigMafSummary.bb`. A track configured without it has no zoom-out path and
force-load is the only way past the gate.

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

MAF's level-of-detail answer is a precomputed file tier, as synteny's is:
`summaryAdapter` (`bigMafSummary`) is fetched instead of the alignment past the
force-load floor. The two gaps are in the tier, not the draw loop:

- A 470-way written without a summary file has no cheap zoom-out path; the file has
  to be produced.
- The identity plot is confined below the summary threshold, since the summary tier
  makes `activeRowRendering` fall back to bases. Widening its zoom range is a
  fetch-tier question. The summary overlay does draw a per-species band there.

### Two results not to re-derive

- **Byte-scan parsing is not a win.** A `Uint8Array` scan measured 3 ms against 5 ms
  for the string `split` chain on a 1 MB line; V8's sliced strings make the split
  nearly free.
- **Transferables are a memory fix, not a speed fix.** `structuredClone` of a 5 MB
  payload is 8 ms and a transfer list saves ~3 ms, but it removes a full duplicate
  copy of every species' sequence leaving the worker, which is the crash-relevant
  part.

## The worker pipeline

The worker reads and parses blocks, packs them into the columnar arena
(`MafWirePacker`), then runs `computeMafCoverage`, `computeSNPCoverage` and
`computeInterbaseCoverage`; placement on the main thread is a few ms. This
section covers what happens after the bytes arrive.

### The ranking depends on block shape

Upstream of coverage pays per **row** (a scan, a record, an arena write); coverage
pays per **cell**. So the ranking inverts with block width (min of 12 rounds, warm
chunk cache, before ADR-195):

| shape | read + parse + pack | coverage + SNP | stage share |
| --- | --- | --- | --- |
| 1600 blocks × 250 columns | 50 ms | 184 ms | 21% |
| 20000 blocks × 8 columns | 345 ms | 72 ms | **83%** |

"`computeMafCoverage` is half the worker" is true of wide blocks and false of
the narrow blocks real files have (ce11's 26-way has a 7bp median). Check which
shape a profile came from before ranking work off it.

Read plus bgzf decompress is ~29 ms behind ~186 ms of CPU on the wide shape, so
I/O does not hide CPU work here.

### Reproducing it

`plugins/maf/benches/mafTabixFixture.ts` writes the wide fixture (1600 blocks ×
26 species × 250 columns) in the BED-with-entries shape `MafTabixAdapter` reads
out of column 6, then `bgzip` and `tabix -p bed`. **Divergence is graded 2–20%
across species**; a uniform rate gets the mismatch count, and so the profile,
wrong in both directions. The generator is deterministic, so the 2.5 MB output
stays out of the repo.

### Shipped levers

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

### Two kernels that look like wins and are not

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

### Decompose a hot loop before declaring it finished

Counting the per-cell operations of `computeMafCoverage` said nothing was left,
because the loop was never ALU bound. `plugins/maf/benches/mafCoverage.bench.ts`
decomposes it instead: measure the bare loop against loop-plus-output, sweep the
working set, and peel the body one operation at a time. That found a per-cell
bound test answering a per-block question; hoisting it to the per-block
`uniformRows` scan is 1.13-1.24x on the whole function. The same hoist on the
insertion loop pays only at implausible gap rates, because that loop runs on gap
columns alone — how often a loop runs bounds what fixing it can buy.

### Declined and parked

- **Mismatch decimation** — binning or skipping mismatch emission above some
  bp-per-pixel — is the largest remaining win and a fidelity compromise, held
  back by preference until free performance runs out. The tooltip also wants
  per-position detail on hover.
- **A WebAssembly SIMD kernel** is the only thing that beats the exact-semantics
  ceiling (`v128` has real byte compares). It costs a wasm module and a build
  step, more than this stage justifies alone; if another hot loop wants one,
  this walk is a second customer.

## Render cost

Render cost is not the open question. Do not re-profile it before reading
`git log --oneline -- plugins/maf`, which holds the passes and their numbers.
Three lessons generalize:

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

### The per-region event index

`mafRowEvents.ts` serves insertions and inversions, and deliberately not
deletions. `(positionBp, rowIndex, length)` does not change when the view moves,
so overlays project the index instead of re-deriving it from alignment bytes. The
shared `forEachInsertion` fills the index and the hover hit test still calls it
directly, so they cannot disagree.

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

Three render-side options were costed and declined: subsampling the mean (standard
error near 0.1 at p=0.5, speckle in the view meant to show smooth conservation),
per-region per-row prefix sums (~150 MB for a 470-way over 40 kb), and moving the
walk to the worker (buys responsiveness, not throughput).

## What a sub-pixel MAF cell looks like

MAF cells are run-merged, so a sub-pixel cell means "this run is shorter than a
pixel" — the normal case for a multiple alignment at any interesting zoom. At
`ctgA:1-4000` on volvox (~3.25 bp/px) a 1-bp cell is 0.31 CSS px.

**Neither backend floors one.** `MAF_ROW_MARK` declares `minWidthPx: 0`, which
makes the shader's `extendToMinWidthX` a no-op, and the `span` painter draws
cells at their natural width. The rasteriser blends them, and the blend is the
answer.

The multi-row feature painter draws the same `rowRect` module and does floor
(`MULTI_ROW_MIN_CELL_PX`). The asymmetry turns on whether the marks tile: a MAF
cell sits in a run of neighbours and the run is what is read, while a chromosome
painting's features are sparse intervals beside white paper, where a sub-pixel
tick reads as nothing.

### The ground truth that settled it

The no-floor render shot at dpr 4 (a 1-bp cell is 1.25 device px, so nothing is
floored away) and box-downsampled by 4 is the base-weighted mix a dpr-1 pixel
should hold. Distance from it, over the rows band:

<!-- BEGIN GENERATED MEASUREMENT maf-subpixel-floor -->

_Generated by `pnpm autogen` — edit the source, not this block._

| rule                              | dist. from truth | px differing >30 | mean chroma | cross-dpr drift |
| --------------------------------- | ---------------: | ---------------: | ----------: | --------------: |
| no floor                          |         **4.31** |            15.7% |       11.23 |        **3.67** |
| floor + span alpha                |             5.53 |            21.3% |        9.63 |            4.63 |
| floor at 1 device px              |            15.05 |              32% |       24.97 |           11.41 |
| Canvas2D as shipped               |            26.58 |              76% |       19.98 |            6.02 |
| ground truth (dpr 4, downsampled) |                — |                — |       10.64 |               — |

<!-- END GENERATED MEASUREMENT maf-subpixel-floor -->

- **A floor over-states.** Every short run claims a whole pixel at full
  saturation, so a noisy stretch becomes a wall of hard bars where the truth is a
  soft mixture, and widened cells overwrite each other instead of sharing the
  pixel.
- **A device-px floor moves with the monitor.** At dpr 2 a 1-device-px floor is
  0.5 CSS px, so the same alignment carried visibly less colour on a retina
  screen. An appearance that depends on circumstances the reader cannot see is a
  defect on its own terms.
- **Floor + span alpha washes out.** It recovers most of the over-statement but
  still spreads each run over a pixel it does not occupy, blurring the column
  structure.
- **4x MSAA does not drop sub-pixel cells.** Adjacent cells are non-overlapping
  primitives, so each writes its own samples and the resolve averages them.

The **Canvas2D row predates** the change that feeds one `span` mark to both
backends and stopped Canvas2D compounding the translucent match tone; re-measure
before quoting it.

`products/jbrowse-web/browser-tests/probe-maf-subpixel.ts` re-takes the shipped
rule's row and the Canvas2D row against a fresh truth. It needs a real GPU
(`--use-gl=angle`); under SwiftShader the numbers belong to a different
rasteriser. The measurement record's `repro` says how to stand the floored arms
back up.

### Wiggle density's 1.5 px floor paints the same picture on a tiling

`wiggleDensity.slang` writes `MIN_FILL_WIDTH_PX` into `minCellPx` over bins that
tile the row. That is not the contradiction it looks like: `extendToMinWidthX`
grows a quad off its own start edge, the next bin's quad covers the growth, and
the last quad covering a sample point is the bin holding that point under either
rule. The two renderings are identical for any sample pattern, provided bins
arrive in coordinate order — which every quantitative adapter emits and nothing
in the wiggle path re-sorts.

Measured on `volvox-sorted.bam.coverage.bw` at 3.25 bp/px (a non-integer bp/px,
so the tie is not an artefact of bins landing on sample positions):

<!-- BEGIN GENERATED MEASUREMENT density-subpixel-floor -->

_Generated by `pnpm autogen` — edit the source, not this block._

| arm                                        | tiling: dist | tiling: ink | sparse: dist | sparse: ink |
| ------------------------------------------ | -----------: | ----------: | -----------: | ----------: |
| GPU floored 1.5px, 4x MSAA (shipped)       |     **0.26** |      126.31 |        41.35 |   **76.84** |
| GPU no floor, 4x MSAA                      |     **0.26** |      126.31 |         3.28 |       15.77 |
| GPU floored 1.5px, 1 sample                |         0.94 |      126.19 |        46.57 |       74.92 |
| GPU no floor, 1 sample                     |         0.94 |      126.19 |        14.52 |       15.96 |
| Canvas2D floored (shipped)                 |         0.33 |      126.29 |        40.96 |       77.06 |
| Canvas2D no floor (seam only)              |         0.33 |      126.28 |        27.62 |       57.06 |
| ground truth (unfloored, 16x supersampled) |            — |      126.28 |            — |       15.80 |

<!-- END GENERATED MEASUREMENT density-subpixel-floor -->

Where bins do not tile — a bedGraph with gaps, a sparse source — density is the
multi-row painter's case, and the floor costs what a floor costs: several times
the row's honest ink. It buys the only legibility those marks have: unfloored on
a single-sampled target, a 0.25 px mark misses every pixel centre and the row
comes back blank.

`plugins/wiggle/src/shared/shaders/densityMinWidth.test.ts` pins both halves.

### Why `sizeAlpha` is not the analogue

The floor+alpha shape is what `plugins/alignments` ships
(`alignmentsUniforms.slang`), deliberately for indels only: a mismatch is a point
event whose whole value is being visible when a screen holds more bases than
pixels, so it stays opaque. A MAF cell is per-base identity, and `sizeAlpha`
gives back the ink a widened mark took, so applying it to a cell drawn at
natural width double-counts the narrowness. The table's floor + span alpha row
shows the wash-out.

## MAF row to other genome navigation

A MAF row knows the aligned species' own coordinates (`chr`, `srcStart`,
`strand`, `srcSize`). When that species is a genome the session can load, the
row is a navigable link: right-click a row to open `SPRET_EiJ chr2:…` in a new
LinearGenomeView. [VIEW_INIT.md](VIEW_INIT.md) §"Launching a view on a region" covers the entry
point; this section covers where the sample → assembly mapping comes from.

### The mapping does not belong in the plugin

Sample ids in real tracks come in three unrelated flavors:

- UCSC db names (`mm10`), resolvable only against a portal that hosts them.
- Scientific names (`Acinonyx_jubatus`), which map to **several** assemblies.
  The alignment was built against exactly one, and landing on another gives
  silently wrong coordinates.
- Lab-internal ids (`HLnomLeu4`), not name-resolvable at all.

The plugin must not guess. The mapping is provenance from whoever built the
alignment, so it lives in the track config, precomputed the way jb2hubs
precomputes `synteny_pairs.json`.

### Shape

`Sample` (`plugins/maf/src/types.ts`) carries an optional `assemblyName`, threaded
through `normalizeSamples` → the adapters' `samples` slot → `MafSource` → the
display's `samples` getter. Unset means not navigable, so existing tracks are
unchanged.

```js
samples: [
  {
    id: 'SPRET_EiJ',
    label: 'SPRET/EiJ',
    assemblyName: 'SPRET_EiJ',
    assemblyConfigLocation: {
      uri: 'https://jbrowse.org/hubs/genark/mouseStrains/SPRET_EiJ/config.json',
      locationType: 'UriLocation',
    },
  },
]
```

Under `plugins/maf/src/LinearMafDisplay/`:

- `components/findRowSpan.ts` computes the row's own locus over a reference bp
  range. It shares `forwardPos` with `findRowHover.ts`, so the `−`-strand mirror
  through `srcSize` agrees between tooltip and target. A row that changes
  chromosome mid-range clips to the first, so the result is one locus.
- `stateModel.ts::rowNavigationTargets` returns that span plus each sample's
  `assemblyName`/label for a `[startRow, endRow)` range. A row is absent when it
  has no aligned base there or its sample has no assembly.
- `components/sampleNavigationItems.ts` appends menu entries to
  `SubsequenceContextMenu`: `sampleNavigationItems` ("Open aligned genome at the
  matching region") and `mafSyntenyLaunchItems` ("Linear synteny view, ⟨ref⟩
  vs..."), each with one submenu item per row.
- `openSampleInNewView.ts` launches `addView('LinearGenomeView', {assembly,
  loc})` keyed `<displayId>_<assemblyName>`, so following the same species
  re-navigates one view.

**`assemblyConfigLocation`** lets a portal-scale site (one config per genome)
work, since an alignment's species are not all in the config the user opened.
`ensureAssembly` fetches just that assembly's config and `addSessionAssembly`s it
with `addRelativeUris`, as `JB2TrackHubConnection/doConnect.ts` does. It is a
`UriLocation` so `addRelativeUris` stamps its `baseUri`, which lets a config point
at a sibling config by relative path. Omit it when the assembly is already in the
config.

**`ensureAssembly` probes with `assemblyManager.has()`, never `get()`.** `get()`
on an unknown name reports to `Core-handleUnrecognizedAssembly`, which made the
Hubs plugin open a connection to a nonexistent config and show a 404 over a
navigation that worked. Both hub connections' `doConnect` use `has()` too.

**Reproduce without a portal:** the no-config screen's "MAF row → that species'
own genome" link opens `test_data/volvox/config_maf_navigation.json`. It covers
each row state: `volvox` is already in the config, `simvolvox`/`minivolvox` load
from the sibling `config_maf_nav_targets.json`, and samples without
`assemblyName` are not offered. Coverage is `findRowSpan.test.ts` and
`sampleNavigationItems.test.ts`.

### A sample whose id is a loaded assembly

The pangenome tutorials' MAFs name samples by PanSN strain (`Sakai`, `CFT073`),
and the same config loads those strains as assemblies under those names.
`rowNavigationTargets` falls back to the sample id when `assemblyManager.has(id)`,
because an assembly under the exact id is the author's statement of which genome
it is. A config mapping still wins.

### The synteny view, cut from the columns

`launchMafRowSynteny.ts` (via `mafSyntenyLaunchItems`) builds a synteny view for
one row. `buildMafRowSynteny` walks the fetched blocks' gapped columns (both
bases `M`, reference gap `I`, row gap `D`), clipped half-open to the selection,
with coordinates through `forwardPos`. The features go into a session
`SyntenyTrack` over a `FromConfigAdapter` (`addSessionTrackConf`, since the user
stood it up), reference-anchored side only, then `addView` with a two-row
`init`.

**`FromConfigAdapter` filters by refName alone**, so the mate copies a read-vs-ref
store keeps are not stored: on the E. coli pangenome every contig is `chr`, and a
mate copy would answer the reference row's query too.

The all-samples stack is not offered. A stack's bands join adjacent rows, so
sample-vs-sample bands would need column-transitive features, and a 464-haplotype
MAF needs a row picker first.
