---
name: maf-large-blocks
description: How does the MAF plugin fetch, parse and draw alignments — why megabase blocks are slow and clipping is the wrong fix, where the worker time goes, why sub-pixel cells take no floor, and how a row opens its species' own genome?
kind: measurement
---

# The MAF plugin: fetch, worker pipeline, sub-pixel cells, navigation

What a session touching `plugins/maf` needs before it measures or redesigns
anything.

## Fetch cost of megabase blocks

MAF-tabix is one BED line per alignment block with every species' gapped
sequence in column 6 (`maf_to_bed.py`, read by `MafTabixAdapter`). Tabix returns
whole overlapping lines, so a query touching one base of a 1 Mb block downloads,
decompresses, splits and ships the whole block. Cost quantizes by block, not by
view, and zooming in does not help.

The fetch-cost work is parked: the widest line in every in-tree MAF-tabix file is
about 20 kb, so nothing here reproduces the reported problem. Before building
anything, check a reporter's file with `bgzip -dc their.bed.gz | awk '{print
$3-$2}' | sort -n | tail -5`. Long blocks come from the producer (`hal2maf`
without chunking, pairwise chains converted to MAF).

**Rejected: clip blocks to the visible region.** Clipping pays only after the
expensive layers (the line is downloaded, decompressed and split first, and
finding the column range is the same O(columns) walk), makes loaded data
zoom-dependent so `isBlockCovered` cannot reuse it across zoom, and leaves
tooltips and FASTA export reading wrong per-species coordinates.

What works: TAF (`BgzipTaffyAdapter`'s `.tai` makes cost O(visible span)), or
splitting at conversion time (`scripts/maf_to_bed.py`, cutting only at columns
where no row including the reference has a gap, since a cut inside a gap run
splits an insertion marker or a deletion). A per-line safety valve in the adapter
that names the block instead of running out of memory is unbuilt.

The byte gate takes a real measurement at the viewport being judged and has no
span floor, so a block-quantized file shows "Requested too much data" and the user
chooses; `ByteEstimate.zoomIneffective` stops the banner advising "zoom in"
([REGION_TOO_LARGE.md](REGION_TOO_LARGE.md)).

### The zoom-out tier is opt-in

All four MAF adapters take a `summaryAdapter` slot: a `BedTabixAdapter` over the
BED `maf2bed --summary` writes, or a `bigMafSummary.bb`. Without it a track has no
zoom-out path and force-load is the only way past the gate. The byte gate covers
the summary tier too (`byteGateAdapterConfig` on `RegionTooLargeMixin`), each tier
measured against the file it reads; exempting a tier assumed it was bounded, and a
`BigBedAdapter` read is an unbounded whole-feature download.

A `.tai` is not a tier. It bounds the span a read covers, not its depth, and a
read costs span x depth: over HPRC's published `.tai` files at 464 haplotypes the
ceiling against the default `fetchSizeLimit` is a few hundred kb of MAF and about
10x that of TAF, which does not buy a chromosome.

The `src` column joins the display's rows with no mapping (`parseAssemblyAndChr`,
`rowIndexBySrc`). When the join fails the track reports loaded with no bars.
`maf2bed` v0.6.0 or later has `--summary`; v0.5.x ignores every argument after the
first and silently writes no summary, so check the file exists before wiring the
slot.

### Fetch dominates at 470-way

Splitting and parsing a 470-row 40 kb window takes about 140 ms, against about
63 ms to draw a frame, and the 6-8 MB compressed transfer recurs on every pan out
of the buffer. [SYNTENY_LOD.md](SYNTENY_LOD.md) reached the same conclusion by
profiling. The level-of-detail answer is the precomputed `summaryAdapter` tier;
the gaps are in the tier, not the draw loop: a file written without a summary has
no cheap zoom-out, and the identity plot is confined below the summary threshold
because the summary tier makes `activeRowRendering` fall back to bases.

Two results not to re-derive: byte-scan parsing is not a win over the string
`split` chain (V8's sliced strings make it nearly free), and transferables are a
memory fix, not a speed fix: they remove a full duplicate copy of every species'
sequence leaving the worker.

## The worker pipeline

The worker reads and parses blocks, packs them into the columnar arena
(`MafWirePacker`), then runs `computeMafCoverage`, `computeSNPCoverage` and
`computeInterbaseCoverage`.

**The ranking depends on block shape.** Upstream of coverage pays per row;
coverage pays per cell. "`computeMafCoverage` is half the worker" is true of wide
blocks and false of the narrow blocks real files have (ce11's 26-way has a 7 bp
median), where read+parse+pack dominates. Check which shape a profile came from
before ranking work off it. `plugins/maf/benches/mafTabixFixture.ts` writes the
wide fixture; **divergence is graded 2-20% across species**, because a uniform
rate gets the mismatch count, and so the profile, wrong.

Shipped levers: columnar wire rehydrated at placement (`postMessage` 3.3 s to
0.03 ms on one region); the packer fed from the
adapter's subscription with no buffered sizing pass (`executeMafAlignmentData.ts`
has why); adapters parsing straight into the packer
([ADR-195](../architecture-decision-records/adr-195-a-maf-adapter-parses-its-blocks-into-the-packer.md)).
Byte-native tabix lines (`GMOD/tabix-js#156`) were declined (GMOD/tabix-js ADR
0006).

### Two kernels that look like wins and are not

The JSDoc on `computeMafCoverage` carries both. The transpose to one sequential
scan per row measures 0.92x-1.06x. SWAR (reading the arena as `Uint32`) measures
4.5x only by testing "is a base" as `folded >= 0x40`, which reclassifies `.` and
`*`; the output-identical walk is 0.51x. A hoisted `uniformRows` scan is 1.13-1.24x
across eight shapes.

**Trap for bit-twiddling here:** the textbook zero-byte test `(v - 0x01010101) &
~v & 0x80808080` answers "any zero byte" correctly but its per-lane flags lie (the
borrow flags a lane holding 1 beside a lane holding 0). Use
`~(((v & 0x7f7f7f7f) + 0x7f7f7f7f) | v | 0x7f7f7f7f)`. Miscounting one base in a
million never shows in a coverage bar.

Decompose a hot loop before declaring it finished: counting per-cell operations
said nothing was left because the loop was never ALU bound.
`plugins/maf/benches/mafCoverage.bench.ts` measures the bare loop against
loop-plus-output and peels the body one operation at a time.

Declined: mismatch decimation (the largest remaining win, a fidelity compromise
held back by preference; the tooltip also wants per-position detail) and a
WebAssembly SIMD kernel (costs a wasm module and build step).

## Render cost

Do not re-profile render cost before reading the plugin's commit history, which
holds the passes and their numbers. Three lessons generalize:

- **Check sibling getters before declaring a zoom level cheap.** Decimation fixed
  the base-cell encode while a sibling getter kept a full per-cell scan.
- **A cull has to be at the granularity the walk emits at.** `paintedBpRange` and
  its marker-side twin cover on-screen bp only; a block-level cull protects
  nothing once one stanza spans the buffer.
- **A memo is only a memo if its key stops moving.** `sourceChromRanks` keyed on
  `renderBlocks`, rebuilt every pan tick. `sourceChromRanks.test.ts` pins it by
  identity under an `autorun`, since MobX does not cache an unobserved computed.

**The per-region event index** (`mafRowEvents.ts`) serves insertions and
inversions, deliberately not deletions, so overlays project it instead of
re-deriving from alignment bytes.

- Build per block on first touch; eager indexing makes the first frame after a
  fetch proportional to the buffered span.
- Deletions want a bound, not an index: millions per region. The per-block
  longest run (`regionDeletionRunBounds`) must cover all rows, and must store a
  length, not "does this label", or zooming in loses labels. Neither shows in a
  bench whose viewport never leaves row 0.
- `plugins/maf/benches/mafOverlays.bench.ts` A/Bs against a prior ref and fails
  unless markers match as a multiset. Its traps: reference gaps every 29 columns
  capped every deletion run so the overlay emitted nothing while the bench kept
  timing the walk, and choosing the pan position by round index made `min` across
  rounds a min across different workloads.

Identity plot and conservation band paint a mean and need the whole sample, so
decimation does not transfer (`binning.ts`). Costed and declined: subsampling the
mean (speckle), per-region per-row prefix sums (about 150 MB for a 470-way over
40 kb), and moving the accumulate walk to the worker.

## What a sub-pixel MAF cell looks like

MAF cells are run-merged, so a sub-pixel cell means "this run is shorter than a
pixel", the normal case at any interesting zoom. **Neither backend floors one.**
`MAF_ROW_MARK` declares `minWidthPx: 0`, which makes `extendToMinWidthX` a no-op,
and the `span` painter draws cells at natural width; the rasteriser's blend is the
answer. The multi-row feature painter draws the same `rowRect` module and does
floor (`MULTI_ROW_MIN_CELL_PX`), because a MAF cell sits in a run of neighbours
while a chromosome painting's features are sparse intervals where a sub-pixel tick
reads as nothing.

The no-floor render shot at dpr 4 and box-downsampled is the ground truth; the
table is distance from it:

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

- A floor over-states: every short run claims a whole pixel, so a noisy stretch
  becomes hard bars.
- A device-px floor moves with the monitor (0.5 CSS px at dpr 2).
- Floor + span alpha still spreads each run over a pixel it does not occupy.
- 4x MSAA does not drop sub-pixel cells: adjacent cells are non-overlapping
  primitives.

The Canvas2D row predates the change that feeds one `span` mark to both backends;
re-measure before quoting it. `products/jbrowse-web/browser-tests/probe-maf-subpixel.ts`
re-takes it and needs a real GPU (`--use-gl=angle`), since SwiftShader is a
different rasteriser.

### Wiggle density's 1.5 px floor is the same picture on a tiling

`wiggleDensity.slang` floors bins that tile the row. `extendToMinWidthX` grows a
quad off its own start edge and the next bin's quad covers the growth, so the two
renderings are identical, provided bins arrive in coordinate order (every
quantitative adapter emits them so and nothing in the wiggle path re-sorts):

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

Where bins do not tile (a bedGraph with gaps, a sparse source) density is the
multi-row painter's case: the floor costs several times the row's honest ink and
buys the only legibility those marks have, since unfloored a 0.25 px mark misses
every pixel centre. `plugins/wiggle/src/shared/shaders/densityMinWidth.test.ts`
pins both halves.

`sizeAlpha` is not the analogue. `plugins/alignments` ships floor+alpha
(`alignmentsUniforms.slang`) for indels only; a mismatch is a point event that
stays opaque. `sizeAlpha` gives back the ink a widened mark took, so on a cell
already drawn at natural width it double-counts the narrowness.

## MAF row to other genome navigation

A MAF row knows its species' own coordinates (`chr`, `srcStart`, `strand`,
`srcSize`); when the session can load that genome, right-click a row opens it in a
new LinearGenomeView ([VIEW_INIT.md](VIEW_INIT.md) §"Launching a view on a
region").

**The sample to assembly mapping does not belong in the plugin.** Sample ids come
as UCSC db names, scientific names that map to several assemblies (the alignment
was built against exactly one, so a guess gives silently wrong coordinates), or
lab-internal ids. The mapping is provenance from whoever built the alignment, so
`Sample` (`plugins/maf/src/types.ts`) carries an optional `assemblyName` in the
track config; unset means not navigable.

Under `plugins/maf/src/LinearMafDisplay/`: `components/findRowSpan.ts` computes
the row's locus and shares `forwardPos` with `findRowHover.ts`, so the `-`-strand
mirror agrees between tooltip and target; `stateModel.ts::rowNavigationTargets`
returns spans per row; `components/sampleNavigationItems.ts` adds the menu
entries; `openSampleInNewView.ts` keys the view `<displayId>_<assemblyName>`.

- **`assemblyConfigLocation`** lets a portal-scale site (one config per genome)
  work. `ensureAssembly` fetches that config and `addSessionAssembly`s it with
  `addRelativeUris`; it is a `UriLocation` so a config can point at a sibling by
  relative path.
- **`ensureAssembly` probes with `assemblyManager.has()`, never `get()`.** `get()`
  on an unknown name reports to `Core-handleUnrecognizedAssembly`, which made the
  Hubs plugin connect to a nonexistent config and show a 404 over a navigation
  that worked.
- `rowNavigationTargets` falls back to the sample id when `assemblyManager.has(id)`;
  a config mapping still wins.
- Reproduce without a portal: `test_data/volvox/config_maf_navigation.json`.

**The synteny view, cut from the columns.** `launchMafRowSynteny.ts` builds a
session `SyntenyTrack` over a `FromConfigAdapter` from the fetched blocks' gapped
columns (`addSessionTrackConf`, since the user stood it up). `FromConfigAdapter`
filters by refName alone, so mate copies are not stored: on the E. coli pangenome
every contig is `chr`, and a mate copy would answer the reference row's query too.
The all-samples stack is not offered; a 464-haplotype MAF needs a row picker
first.
