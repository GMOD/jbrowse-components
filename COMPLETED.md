# Completed Work — JBrowse Components 2

Organized by feature area. For next steps, see `NEXT_STEPS.md`.

---

## GPU/Canvas2D Backend Migration

### Canvas Fallback Rendering

All 10 track types have Canvas 2D fallback renderers:
- Alignments, Features, Wiggle/Multi-Wiggle, HiC, Dotplot, Variants, Variant Matrix, LD Display, Synteny, Sequence

All renderers respect `?gpu=off` / `getGpuOverride() === 'canvas2d'` and auto-fall back: WebGPU → WebGL2 → Canvas 2D.

### Data Fetching & Redraw Reliability

- Replaced `staticRegions` (legacy 800px-block-based) with viewport-based `mergedVisibleRegions` + explicit 50% buffer
- Wiggle tracks: integrated `isCacheValid()` for resolution-aware re-fetching on zoom-in
- Fixed "1kg Human demo: genes track triggers force load too soon" — replaced `maxFeatureCount=5000` with density-based `maxFeatureDensity=20` (features/pixel)
- `ClearBlockingStateOnViewportChange` clears on zoom OR region change

### Infrastructure & Refactoring

- **MockHal** — records all HAL calls for test assertions
- **initDualBackend** — shared GPU→Canvas2D fallback init, used by all 11 renderer wrappers
- **canvas2dUtils** — shared `prepareCanvas`, `clipBlockForCanvas`, `bpToScreenX`, `lookupColorRamp`, `lookupColorRampCSS`
- **rendererUtils** (alignments-core) — shared `drawCoverageBins`, `drawSnpSegments`, `drawNoncovSegments`, `drawModCovSegments`, `drawIndicators`, `coverageLayout`, `snpColorForType`, `rgbaString`
- **coverageGpuPacking** (alignments-core) — shared `packSnpSegmentsForGpu`, `packNoncovSegmentsForGpu`, `packModCovSegmentsForGpu`, `packIndicatorsForGpu`
- All 11 renderer wrappers use `initDualBackend`
- MultiSyntenyRenderer unified with single `MultiSyntenyBackend` interface (eliminated `isGpu` branching)
- Canvas2D coverage drawing fully uses shared functions
- Canvas2DAlignmentsRenderer modCov/noncov packed into GPU buffer format
- Debug console.log cleanup (~25 statements removed)
- Dead legacy code removed (MultiSyntenyGpuBackend, MultiSyntenyCanvasBackend, GpuRenderOpts, etc.)
- Stale documentation removed (7 outdated AGENTS.md files, GPU_HAL_NEXT_STEPS.md)

### Tests (251 total)

- Naga WGSL shader validation: 16 shaders across 6 plugins
- glAttribute-to-GLSL sync: 174 tests across 8 renderer suites
- GPU integration tests (MockHal): wiggle (14), variant (6), hic (7)
- Shared drawing function unit tests: 11
- Coverage parity tests: 4 (GPU vs Canvas2D produce identical coverage)

---

## Alignments Track Rendering

### Color Schemes & Features

- All 10 color schemes implemented across WebGPU/WebGL2/Canvas2D + SVG export
  - Normal, Strand, Mapping Quality, Insert Size (threshold + gradient), First-of-pair Strand, Pair Orientation, Insert Size+Orientation, Modifications, Tag-based
- Color by per-base quality (HSL formula, same as MAPQ)
- Color by mapping quality — HSL gradient with legend items
- Color by tag (two-phase fetch: discover tags → re-fetch with colors)

### Display Improvements

- Coverage interbase indicators conditional on total coverage with depth-dependent thresholds
- Linked read mode fully wired up (includes `invalidateLoadedRegions()` call)
- Draw outline even when compact (size threshold lowered from 4px to 2px)
- Reset mouseover after changing link mode

### Bug Fixes

| Bug | Resolution |
|-----|-----------|
| Force load stuck | `ClearBlockingStateOnViewportChange` clears on zoom or region change |
| Wrong ratio shown over deletions in tooltip | Fixed |
| Non-intron rendered weirdly for iso-seq | Stencil buffer state leak removed; gaps rendered directly with proper coloring |
| WebGL 2.0 mismatch colors when zoomed out | Re-enable `gl.BLEND` at start of `PileupRenderer.render()` |
| volvox-long reads with SV not rendering when zoomed out | `checkByteEstimate` now uses adapter's `fetchSizeLimit` with proper max() logic |
| Insertion depth weird | Fixed |
| Color by tag not working | e2e test confirms two-phase fetch works |
| Unmapped mate coloring collides with other pink | Flag 8 check precedes other coloring; brown (#8B4513) is visually distinct |
| Hide insertions in low coverage when region has high coverage | Depth-dependent frequency thresholds + sub-pixel alpha |
| Read vs ref synteny view not working | Menu registration fixed (was checking old 'LinearPileupDisplay' name) |
| Bad triangle interbase indicators | Added barycentric-coordinate anti-aliasing to WebGL/WebGPU shaders |
| Click sashimi — make it look selected | Selected arc renders with dark stroke and thicker width; click toggles selection |
| GPU mismatches render without backing read rectangles | `buildSegmentArrays` clipping fix; segments now extend to feature end |
| Outline on alignments shift+scroll | Fixed |
| WebGL arcs not vibrant | Premultiplied alpha fix in arc/sashimi WGSL shaders |
| Canvas2D synteny picking | Implemented using `isPointInPath()`, iterates in reverse draw order |

---

## Wiggle Track Rendering

### Bug Fixes

| Bug | Resolution |
|-----|-----------|
| Cross hatches | `displayCrossHatches` toggle + SVG overlay |
| Multi-wiggle color with overlapping modes | Fixed row index counting to skip empty sources properly |
| Refresh after multi-wiggle fails also fails | Reset `ready`/`drawn`/`error` state on retry |
| Color change wiggle not working (sometimes) | e2e test proves autorun correctly re-fires on color change |

---

## Synteny & Comparative Views

### Rendering & Layout

- MultiLGVSyntenyDisplay non-block-based rendering with Canvas2D + GPU backends
- Coordinate mapping via `bpToPx` closure for deterministic projection
- Backend facade pattern: MultiSyntenyRenderer → Canvas2D / WebGL2 / WebGPU
- Loading overlay with 500ms debounce during refetches
- Pileup-style CIGAR rendering: deletions (grey bars with length text), insertions (purple lines), mismatches (red rectangles / cs base colors)
- Default coloring: grey for forward strand, blue for inversions
- Improved tooltips: ref/query coordinates with sizes, identity %, inversion indicator

### Bug Fixes

| Bug | Resolution |
|-----|-----------|
| Hs1 vs mm39 synteny — excessively slow | Added viewport culling: features where both projections are off-screen (with 50% buffer) are skipped |
| Yeast synteny — error when splitting | `renameIds()` now uses new ID directly instead of concatenating |
| Multi-way synteny — tracks fail to load | `init.tracks` now supports 2D array for explicit per-level assignment |
| Horizontally flipped stuff is inaccurate | Not a bug — strand swap + reversed region double-flip is correct; fixed blank snapshot issue with `drawn-` signal |
| Make scrolling dotplot a little slower | Doubled scroll divisors (horizontal `/5`→`/10`, vertical `/15`→`/30`) |
| Color dotplot red vs black | Done |

---

## SVG Export

| Issue | Resolution |
|-------|-----------|
| Y scale bars wrong in multi-wiggle | Offset not desired for multi-row mode; removed |
| Monospace font on sequence track | Added `font-family="monospace"` to base letter rendering |
| Monospace font on peptides | Added `font-family="monospace"` to peptide letter rendering |
| Alignments SVG: indels too visible | Depth-dependent frequency thresholds + sub-pixel alpha now applied consistently |
| SVG export for MultiLGVSyntenyDisplay | Implemented using SvgCanvas, draws background/stripes/labels/features |

---

## Variant Track

| Bug | Resolution |
|-----|-----------|
| Toggling between matrix and non-matrix modes | Not a bug — works as expected |
| Clicking multisample variant — not enough detail | Click handler now enriches with REF, ALT, description, genotypes, sample info |

---

## Canvas/Interaction

- After zoom, features reposition but mouseover shading stuck — hover state now cleared when new RPC data uploaded
- Labels disappear during zoom — description labels now always included in RPC response; visibility filtered client-side
- Infinite loop after error in multi-wiggle — Added try/catch + `isAlive` guard to prevent infinite re-trigger

---

## Methylation & Modifications

- Color by reference CpG not working — fixed off-by-one in `extractMethylation()`; CpG detection now checks correct position; added 4 unit tests

---

## Session/Config Migration

### Migration Utilities (49 tests)

- **`migrateWiggleSnapshot`** (17 tests) — migrates old SharedWiggleMixin properties
- **`migrateAlignmentsSnapshot`** (15 tests) — remaps old display types (LinearPileupDisplay, LinearReadArcsDisplay, etc. → LinearAlignmentsDisplay)
- **`migrateSessionSnapshot` / `migrateConfigSnapshot`** (17 tests) — recursively walks and remaps
- Wired into `createPluginManager.ts`, `jbrowseModel.ts`, and display preProcessSnapshot hooks
- Test configs updated across all `test_data/volvox/` files

### Effective Track Config

- **`getEffectiveTrackConfig()`** utility (8 tests) — compares stored config values against display model getters, produces track config with overrides
- **`BaseDisplay.effectiveTrackConfig`** — default getter returns raw track config snapshot
- **`LinearWiggleDisplay`, `MultiLinearWiggleDisplay`, `LinearAlignmentsDisplay`** — override with user session overrides
- **`BaseTrackModel.activeDisplay`** — formalizes `displays[0]`
- **`TrackLabelMenu`** — passes `effectiveTrackConfig` to About dialog
- Integration tests (6 tests) verify override inclusion and cross-display-type behavior

---

## Pangenome Synteny Infrastructure

### Format & CLI

- 3-tier PIF format: full (t/q with CIGAR), summary (st/sq), structural (xt/xq with SyRI types)
- SyRI classification via `sy:Z:` tag
- Format converters: PAF, SyRI `.syri.out`, BEDPE, GFA (P-lines + W-lines), MAF
- `--all-vs-all` mode with auto-ordering by syntenic coverage
- `--session` flag for session spec JSON generation
- Multi-pair PIF with pair-indexed prefixes (t0/q0, t1/q1, ...)

### cs Tag as First-Class Citizen

- `MultiPairFeature` interface: `cs: string | undefined` field
- `csUtils.ts` shared utilities: `csToCigar()` and `flipCs()` exported
- `drawCsOps()` renders cs tags with base-specific mismatch colors
- Base letters rendered on mismatches when zoomed in
- Renderer priority: cs > cigar
- cs preserved through make-pif

### Binary Alignment Format (aln.bin + aln.idx)

- Compact binary encoding of CS tags (~50% smaller, ~10x faster to parse)
- Variable-length records sorted by (chrom, refStart)
- Pre-computed identity so zoomed-out rendering skips CS decoding
- Linear index (16kb bins) for range queries
- Rust generation via `gfa-to-tabix --aln-bin`
- TypeScript codec: `encodeBinaryCs()`, `decodeBinaryCs()`, `binaryCsIdentity()`, `binaryCsToCigar()`, `binaryCsFlip()`
- TypeScript reader: `loadAlnIndex()`, `queryAlnBin()`, `parseAlnBinRecords()`

### GFA Tooling

- `jbrowse make-gfa-db` — converts GFA → SQLite with segments, paths, path_steps tables
- `gfa-to-tabix` (Rust) — converts GFA → tabix-indexed files
  - Two-pass streaming: O(segments) memory, handles multi-GB GFA files
  - `*.pos.bed.gz` + `.tbi` — position → segment ordinal mapping per genome path
  - `*.segments.gz` + `.gzi` + `.idx` — segment → position reverse index
  - Combined mode (default) or `--sharded` (per-genome with manifest JSON)
  - Tested at HPRC scale: chr20 (1GB GFA, 90 haplotypes, 1.86M segments)
- cs tag support: `cs:Z:` tags preserved in full-tier, stripped from summary tiers
- `flipCs` function properly swaps cs tag perspective

### Adapters

- **GfaTabixAdapter & ShardedGfaTabixAdapter** — reads pos.bed.gz + segments.gz + optional aln files
  - `getMultiPairFeatures()`: tabix query + byte-range segment lookup
  - Synteny projection: query ref region → get ordinals → find positions via index
  - HTTP range request compatible
  - `assemblyNameMap` config for file→JBrowse name remapping
  - Assembly names derived from file header (`#genomes=`), no manual config needed
  - Prefix-based config shorthand
  - Runtime CIGAR derivation from segment gaps
  - LOD-aware aln.bed.gz loading (only uses base-level aln when `bpPerPx < 10`)
  - Segment merging: adjacent shared segments with same strand merged into single features
  - Deterministic tabix refName resolution via `resolveTabixRefName()`

- **PairwiseIndexedPAFAdapter** — 3-tier LOD, multi-pair support, `syriType` propagation
  - `getMultiPairFeatures()`: fetches all pairs for region, grouped by query genome
  - `getPairInfo()`: exposes pair metadata from PIF header
  - `segmentId` support via `sg:Z:` PAF tag
  - cs tag extraction from PAF `cs:Z:` field

### Assembly Auto-Creation

- `make-gfa-tabix` writes `#sizes=` header with per-path total lengths
- `GfaTabixAdapter.getChromSizes()` parses header → returns `Map<genome, {refName, length}[]>`
- `MultiLGVSyntenyDisplay.afterAttach` auto-creates session assemblies for missing genomes

### GPU Rendering for MultiSynteny

- Backend selection: WebGPU → WebGL2 → Canvas2D
- HP 64-bit float emulation for positioning (matches alignments pattern)
- Per-region draw calls for multi-chromosome views
- Instance buffer layout: 32 bytes per instance (startBp, endBp, genomeRow, featureId, color)
- CIGAR/CS ops expanded at upload time into overlay sub-instances

### SVG Export

- Renders background, alternating row stripes, genome labels, synteny features, SNP detail
- `drawCigarOps()` and `drawCsOps()` accept both Canvas and SvgCanvas contexts

### LinearSyntenyView (N-Way)

- Collapsible synteny levels, focus mode, auto-scale heights
- Collapsed levels skip data fetching
- Cascading diagonalization across N views with progress reporting

### Shared Package: @jbrowse/alignments-core

- HP GLSL/WGSL functions with parameterized 3-arg versions
- InstanceBuilder: growable typed-array buffer
- Shared shader fragments: RECT_LOCALS_WGSL, SIMPLE_FS/GLSL, SIMPLE_VERTEX_OUTPUT_WGSL, PICKING_FS
- Renderer utilities: `getDevicePixelRatio()`, `resizeCanvas()`, `createPickingFbo()`

### Core GPU Utilities (@jbrowse/core/gpu/)

- **webglUtils**: `createProgram()`, `createShader()`, `bindUniformBlock()`, `cacheUniforms()`, `splitPositionWithFrac()`, `enableStandardBlend()`
- **webgpuUtils** (new): STANDARD_BLEND_STATE, `createStandardBindGroupLayout()`, `createStorageBuffer()`, `createStandardBindGroup()`
- **getGpuDevice**: singleton WebGPU device management
- **initGpuContext**: canvas WebGPU context setup

### Testing (154 unit tests + browser tests)

- **binaryCs** (51 tests): encode/decode round-trip, identity, CIGAR parity, flip self-inverse
- **binaryAlnReader** (5 tests): index parsing, range queries, CS round-trip, full-file parse
- **csUtils** (16 tests): csToCigar, flipCs with self-inverse property
- **gfa-to-tabix** (11 tests): file creation, pos/segs queries, ordinals, shared segments, projection, filtering
- **GfaTabixAdapter** (22 tests): multi-genome, shared segments, empty regions, featureId uniqueness, strand, chromSizes, assemblyNameMap
- **ShardedGfaTabixAdapter** (4 tests): round-trip, combined vs sharded parity
- **PairwiseIndexedPAFAdapter** (27 tests): coordinates, CIGAR, multi-pair, syriType, LOD
- **multiSyntenyGpuData** (18 tests): packing, genome row assignment, CIGAR/CS expansion, HP split

---

## Graph Genome Plugin

### Rendering

- WebGPU, WebGL2, Canvas2D fallback with strategy pattern
- GeometryBuilder: polyline tessellation, round caps, Bezier arrowheads, multi-path edge offsets
- Shader-based line thickness: normals + thicknesses per vertex, expanded in vertex shader

### GFA Parsing & Adapter

- GFA1 parser (S/L/P lines)
- GFA1.1 W-line support
- GFA→Graph data structure conversion
- Pathless GFA support (segments + links without reference coordinates)
- Segment merging for contiguous segments with same strand
- `prefix` preprocessor shorthand in config
- GFA2 E-line parsing (extracted as regular links)

### Interaction & View Features

- Pan (drag), zoom (wheel), click-to-select node
- Hit detection for nodes and edges (Bezier sampling)
- Hover highlighting with tooltips
- 5 color schemes: uniform, random, depth, gc-content, grey
- Zoom controls: buttons + wheel zoom
- Dark mode state + rendering support
- Contig/connector thickness volatiles
- Draw paths toggle
- Layout quality selector (0-4) with live recompute
- Linear layout toggle with live recompute

### Layout Engine

- Runtime-loaded layout via WASM from `https://jbrowse.org/demos/bandage`
- Layout via JBrowse RPC system (uses worker pool)
- Lazy WASM init, shared across calls
- Configurable layout URL
- Layout progress bar with stage text
- Auto zoom-to-fit after layout completes
- Error handling: try/catch/finally ensures state cleanup

### Scalability

- Spatial index for hit detection: grid-based, O(1) average per-mousemove
- Transform decoupled from geometry rebuild
- Sub-batches with vertex range tracking
- Hover/select via `bufferSubData`, no geometry rebuild
- Viewport culling with 20% padding, debounced rebuild (150ms)
- Edge spatial index using Bezier bounding boxes
- Incremental color scheme changes via `updateSubBatchColors`
- Scale-independent edge curves with fixed graph-space control points

### Testing (41 tests)

- parseGFA: GFA1 segments/links/paths, GFA2 E-lines, tags, headers (8 tests)
- convertGFAToGraph: strand nodes, CIGAR, depth tags, path mapping (11 tests)
- GeometryBuilder: sub-batches, vertex ranges, normals, recolor, viewport culling (9 tests)
- Hit detection: distance functions, Bezier sampling, node/edge finding (9 tests)
- Browser e2e test: puppeteer canvas snapshot

---

## Bubbles (Pangenome Variants)

### Rust Tool

- `--bubbles <vcf>` flag reads VCF from `vg deconstruct`
- Computes CS between allele pairs
- Outputs `bubbles.bed.gz` + `.tbi` (indexed, tabix-compatible)
- Allele size/pair limits prevent O(n^2) blowup on highly multi-allelic SVs
- Per-haplotype genome name mapping: VCF samples → GFA genome names
- `--output-config <path>` writes JBrowse config with GfaTabix + variant tracks
- Tested on chrM (544 records, 7KB) and chr20 (75MB, ~1.2M records)

### TypeScript Runtime

- `bubblesLocation`/`bubblesIndex` config added to adapter schemas
- `annotateFeaturesWithBubbleCs()` queries bubbles at zoom-in (bpPerPx < 50)
- Finds genome alleles, attaches CS to features
- Debug logging reports matched vs unmatched genome counts

### HPRC Data

- chr20 VCF generated: `vg deconstruct -p "GRCh38#0#chr20" -a chr20.gfa`
- chr20 bubbles: 75MB compressed, ~1.2M records
- Huge SV at chr20:14.7M (84KB ref, 87 alt alleles) handled by limits

### Enhancements

- Bubble CS annotation refactored: sorts before assembly, uses lookup maps, deduplicates, handles non-ref-centric views
- GfaTabixAdapter assemblyNameMap fix: tries reverse-mapped names
- Bubble-derived identity coloring: weighted-average from pairwise identities
- CS parsing deduplication: removed duplicates from multiSyntenyGpuData.ts
- Genome name mismatch fix: bubbles `#genomes` now uses GFA genome names correctly

### Test Data & Demo

- Volvox: `volvox_del_synteny.gfa`, processed through gfa-to-tabix
- Volvox MultiSyntenyTrack added to test config
- Browser e2e tests: canvas + fullpage screenshots
- 50-sample volvox pangenome: synthetic 50-sample pangenome on volvox ctgA (50001bp)
  - ~396 variant sites (357 SNPs, 32 indels, 7 SVs)
  - 1183 segments with W lines for ref + 50 samples
  - Generated files: pos.bed.gz, segments.bin, bubbles.bed.gz
  - Browser e2e tests: full genome + zoomed-in views
- VCF variant tracks alongside synteny in all HPRC configs

---

## Demo Data & Configs

### Available Datasets

| Dataset | Location | Format | Size | Genomes |
|---------|----------|--------|------|---------|
| Volvox pangenome GFA | `test_data/volvox/` | GFA tabix | small | 4 with real sequences |
| Volvox SNP PAF | `test_data/volvox/` | PAF with cs:Z: | small | 2 (~2% SNPs) |
| Volvox SNP PIF | `test_data/volvox/` | PIF with cs:Z: | small | 2 |
| Volvox multi-pair PIF | `test_data/volvox/` | PIF | small | 3 |
| HPRC chrM | `test/data/synteny-demo/hprc/` | GFA tabix | small | 44 haplotypes |
| HPRC chr20 | `test/data/synteny-demo/hprc/` | GFA tabix | 596MB | 90 haplotypes |
| Arabidopsis 4-way | `test_data/arabidopsis_synteny/` | Multi-pair PIF | 3MB | 4 |

### Demo Configs (NoConfigMessage)

Synteny: grape/peach, dotplot, human dotplot, yeast, 3-way volvox, multi-LGV volvox, Arabidopsis 4-way, chrM pangenome (4 genomes), HPRC chrM (44 haplotypes), HPRC chr20 (90 haplotypes), GFA pangenome (with cs), graph genome viewer, hs1 vs mm39, hg19 vs hg38

---

## Architecture & Code Quality

### Design Patterns

- **Backend facade pattern** — Renderer → Backend interface → Canvas2D / WebGL2 / WebGPU implementations
- **HP 64-bit float emulation** — Matches genome-spy approach for multi-chromosome positioning precision
- **Viewport culling** — Skip rendering features entirely outside visible area
- **Spatial indexing** — O(1) average hit detection vs O(N) naive scan

### Testing Philosophy

- Unit tests for algorithms and data structures
- Integration tests for adapter queries
- Browser e2e tests for visual rendering
- Snapshot tests for visual regressions
- Performance benchmarks where relevant
