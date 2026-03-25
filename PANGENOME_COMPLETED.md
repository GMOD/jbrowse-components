# Pangenome Synteny: Completed Work

## CLI (`jbrowse make-pif`, `jbrowse make-gfa-db`) and `gfa-to-tabix` (Rust)

- 3-tier PIF format: full (t/q with CIGAR), summary (st/sq with
  absolute-position indels), structural (xt/xq with SyRI types)
- SyRI classification on all tiers via `sy:Z:` tag
- Format converters: PAF, SyRI `.syri.out`, BEDPE, GFA (P-lines + W-lines), MAF
- `--all-vs-all` mode with auto-ordering by syntenic coverage
- `--session` flag for session spec JSON generation
- Multi-pair PIF with pair-indexed prefixes (t0/q0, t1/q1, ...)
- GFA parser emits `sg:Z:` segment IDs for cross-pair tracking
- `segmentId` field on `PAFLikeRecord`, emitted as `sg:Z:` tag in PAF output
- `jbrowse make-gfa-db` converts GFA → SQLite with segments, paths, path_steps
  tables
  - Supports P-lines (GFA1) and W-lines (GFA1.1+), assembly filtering
  - Uses `node:sqlite` (built-in), indexed by path + cumulative_offset
- `gfa-to-tabix` (Rust, `tools/gfa-to-tabix/`) converts GFA → tabix-indexed
  files for runtime synteny
  - Two-pass streaming: O(segments) memory, handles multi-GB GFA files
  - `*.pos.bed.gz` + `.tbi` — position → segment ordinal mapping per genome path
  - `*.segments.gz` + `.gzi` + `.idx` — segment → position reverse index with
    bgzip companion byte-offset index
  - Combined mode (default) or `--sharded` mode (one segments file per genome
    with manifest JSON)
  - Configurable chunk size (default 100 segments per pos chunk)
  - Assembly filtering via `--assemblies` flag
  - Tested at HPRC scale: chr20 (1GB GFA, 90 haplotypes, 1.86M segments)
- cs tag support in make-pif: `cs:Z:` tags preserved in full-tier lines,
  stripped from summary tiers
- `flipCs` function properly swaps cs tag perspective for q-prefix lines
  (*XY→*YX, +seq→-seq, -seq→+seq)

## cs Tag as First-Class Citizen

- `MultiPairFeature` interface: `cs: string | undefined` field alongside `cigar`
- `csUtils.ts` shared utilities: `csToCigar()` and `flipCs()` exported from
  comparative-adapters plugin
- `drawCsOps()` renders cs tags directly with base-specific mismatch colors
  (A=#00bf00, C=#4747ff, G=#d5bb04, T=#f00)
- Base letters rendered on mismatches when zoomed in (pxPerBp >= 6,
  rowHeight >= 8)
- Renderer priority: cs > cigar (if cs available, used directly without CIGAR
  conversion)
- cs extracted from: GFA aln.bed.gz (precomputed), PAF `cs:Z:` tag, PIF
  (preserved through make-pif)
- 16 unit tests for cs utilities (csToCigar + flipCs including self-inverse
  property)

## Binary Alignment Format (aln.bin + aln.idx)

BAM-like binary format for pangenome alignments, replacing text aln.bed.gz for
production use. Generated directly from GFA by `gfa-to-tabix --aln-bin`.

### Binary CS encoding

Compact binary encoding of CS tags (analogous to BAM's binary CIGAR):
- Match (`00xxxxxx`): 1 byte for lengths 1-63, varint for longer
- Substitution (`01xxRRAA`): always 1 byte (ref + alt bases in 4 bits)
- Insertion/Deletion (`10`/`11` + length + 2-bit packed bases)
- ~50% smaller than text CS, ~10x faster to parse (typed array walk vs
  character scanning)

### Binary record format (aln.bin)

Variable-length records sorted by (chrom, refStart):
```
refStart: u32, refEnd: u32, queryGenomeIdx: u16, mateChromIdx: u16,
mateStart: u32, mateEnd: u32, strand: u8, identity: u16, csLen: u16,
csData: [u8; csLen]    — total: 25 bytes fixed + variable CS
```
Identity pre-computed at build time (matchBp / totalAligned × 10000) so
zoomed-out rendering skips CS decoding entirely.

### Linear index (aln.idx)

Header with genome/chrom name tables + per-chromosome linear index (16kb bins).
Range query: look up bin offsets → single HTTP range read → parse records.

### Rust generation (`gfa-to-tabix --aln-bin`)

Generates aln.bin directly from GFA segment sequences:
- Walks shared segments between ref and query paths as alignment anchors
- Compares bubble sequences base-by-base → binary CS
- Grooming: detects/flips reverse-complemented contigs (>99% opposite orient)
- Pre-lowercased ordinal-indexed sequence Vec for O(1) lookup
- Optional parallelism via `--threads` flag (rayon)
- Performance: chr20 (90 haplotypes, 1.86M segments) in ~44s aln generation

### TypeScript codec (`binaryCs.ts`)

- `encodeBinaryCs()` / `decodeBinaryCs()` — text ↔ binary round-trip
- `binaryCsIdentity()` — fast identity from binary (no string parsing)
- `binaryCsToCigar()` — binary CS → packed CIGAR array (parseCigar2 format)
- `binaryCsFlip()` — flip perspective (swap ref/alt, ins↔del)
- 51 unit tests: round-trip, identity, CIGAR parity, flip self-inverse

### TypeScript reader (`binaryAlnReader.ts`)

- `loadAlnIndex()` — reads aln.idx header + per-chrom linear index
- `queryAlnBin()` — range query via 16kb bin offsets + HTTP range reads
- `parseAlnBinRecords()` — parses binary records from raw bytes
- 5 unit tests: index parsing, range queries, CS round-trip, full-file parse

### Adapter integration

- `getMultiPairFeaturesFromAlnBin()` in `BaseGfaTabixAdapter` — loads binary
  aln with lazy CS decoding (skips CIGAR/CS conversion when bpPerPx > 50)
- Dispatch priority: binary aln > text aln > segments
- Config: `alnBinLocation` / `alnBinIdxLocation` with prefix shorthand
- Both `GfaTabixAdapter` and `ShardedGfaTabixAdapter` schemas updated

### Files on S3

| File | Size | Records | Genomes |
|------|------|---------|---------|
| `pggb-chrM.aln.bin` + `.idx` | 540B + 223B | 3 | 4 |
| `hprc-v1.1-mc-grch38-chrM.aln.bin` + `.idx` | 41KB + 1.9KB | 43 | 44 |
| `hprc-v1.1-mc-grch38-chr20.aln.bin` + `.idx` | 141MB + 39KB | 25,856 | 90 |

## GfaTabixAdapter Enhancements

- Runtime CIGAR derivation from segment gaps
  (`getMultiPairFeaturesFromSegments`): between shared anchors, ref gaps → D,
  query gaps → I, both → X
- Precomputed alignment support (`getMultiPairFeaturesFromAln`): reads
  aln.bed.gz, converts cs→CIGAR, computes identity from cs
- LOD-aware aln.bed.gz loading: only uses base-level aln path when
  `bpPerPx < 10`, falls back to lightweight segment-based CIGAR at wider zoom
- Config schema: `alnLocation`/`alnIndex` fields with prefix shorthand
- Consolidated `setup()`/`setupPre()` initialization pattern: single cached
  promise resolves header, chrom sizes, pos/aln refName sets, and aln
  availability in one shot (follows BamAdapter pattern)
- Deterministic tabix refName resolution via `resolveTabixRefName()`: checks
  the tabix file's actual refName set (from `getReferenceSequenceNames()`)
  instead of try/catch guessing with candidate formats

## MultiPairFeature Shared Interface

- `MultiPairFeature` moved from `PairwiseIndexedPAFAdapter.ts` to shared
  `plugins/comparative-adapters/src/MultiPairFeature.ts`
- Added `origRefName` field: carries the reference genome's refName from the
  query that produced the feature, enabling deterministic coordinate mapping
  downstream without guessing or iterating displayed regions

## MultiLGVSyntenyDisplay Rendering Overhaul

- Coordinate mapping uses `view.bpToPx({ refName: feat.origRefName, coord })`
  for deterministic bp→px conversion, delegating to the LGV's own region-aware
  logic (handles multiple regions, reversed regions, inter-region padding)
- Renderer receives a `BpToPxFn` closure instead of raw `bpPerPx`/`offsetPx`/
  `displayedRegionStart` — clean separation between view state and rendering
- Loading overlay: `LoadingOverlay` with 500ms debounce during refetches, using
  `model.statusMessage` from RPC `statusCallback` (matches alignments pattern)
- Renderer backend architecture: `MultiSyntenyRenderer` facade →
  `MultiSyntenyCanvasBackend` / `MultiSyntenyGpuBackend` interfaces →
  Canvas2D, WebGL2, and WebGPU implementations
  - Follows same pattern as `AlignmentsRenderer` and `SyntenyRenderer`
  - `getOrCreate()` + `init()` with cancelled flag, dispose-before-reinit
  - Backend selection: WebGPU → WebGL2 → Canvas2D fallback via
    `getGpuOverride()`
- Pileup-style CIGAR rendering:
  - Deletions: thick grey bars with deletion length text (white, centered)
  - Insertions: purple vertical line with triangle markers at top/bottom
  - Mismatches (CIGAR): red full-height rectangles
  - Mismatches (cs): base-specific colors with letter labels when zoomed in
  - Shared `drawDeletion()`/`drawInsertion()` helpers eliminate code duplication
- Default coloring: grey (#c8c8c8) for forward strand, blue (#6899e0) for
  inversions
- Improved tooltips: ref/query coordinates with sizes, identity %, inversion
  indicator

## PairwiseIndexedPAFAdapter

- 3-tier LOD, multi-pair support, `syriType` propagation
- `getMultiPairFeatures()`: fetches all pairs for a region, grouped by query
  genome
- `getPairInfo()`: exposes pair metadata from PIF header
- `segmentId` support via `sg:Z:` PAF tag for cross-pair shared alignment
  tracking
- cs tag extraction from PAF `cs:Z:` field into MultiPairFeature

## GfaTabixAdapter and ShardedGfaTabixAdapter (A1)

- Two adapter types sharing a base class (`BaseGfaTabixAdapter`):
  - `GfaTabixAdapter` — combined segments.gz (single file)
  - `ShardedGfaTabixAdapter` — per-genome segments files with manifest JSON
- Reads pos.bed.gz + segments.gz (+ .gzi + .idx) + optional aln.bed.gz
- `getMultiPairFeatures()`: tabix query + byte-range segment lookup
- Synteny projection: query ref region → get segment ordinals → find all genome
  positions via companion byte-offset index
- HTTP range request compatible — works with remote files
- `assemblyNameMap` config: optional remapping of file genome names to JBrowse
  assembly names (e.g., `GRCh38#0` → `hg38`)
- Assembly names derived from file header (`#genomes=...`), no need to configure
  `assemblyNames` on the adapter
- Prefix-based config shorthand for minimal configuration
- Registered in comparative-adapters plugin with `syntenyTypes` and
  `multiPairTypes`

## Assembly Auto-Creation from GFA Paths (A4)

- `make-gfa-tabix` now writes `#sizes=` header with per-path total lengths
- `GfaTabixAdapter.getChromSizes()` parses the `#sizes=` header → returns
  `Map<genome, {refName, length}[]>`
- `MultiLGVSyntenyDisplay.afterAttach` auto-creates session assemblies for
  genomes not already in the assembly manager
- No `.chrom.sizes` files needed — everything comes from the GFA tabix header

## Segment Merging for GfaTabixAdapter (E1)

- Adjacent shared segments with same strand and contiguous ref/mate coordinates
  are merged into single `MultiPairFeature` blocks
- Forward and reverse strand merging with CIGAR derivation from gaps
- Tested with HPRC chrM (1393 segments, 44 haplotypes)

## Large-Scale GFA Demo Data (A5)

- HPRC minigraph-cactus v1.1: chrM (44 haplotypes), chr20 (90 haplotypes)
- Demo configs added to NoConfigMessage
- Test data: `test/data/synteny-demo/hprc/`

## Streaming GFA Conversion - Rust Tool (A3)

- `tools/gfa-to-tabix/` — sole converter, replaces previous TS implementation
- Two-pass streaming: O(segments) memory, handles multi-GB GFA files
- Pass 1: read S-lines → segment lengths + ordinals
- Pass 2: read P/W-lines → stream pos.bed.gz + segments rows to temp file →
  external sort → build companion byte-offset index → bgzip
- Combined mode (single segments.gz) or `--sharded` (per-genome segments files)
- Output: `segments.gz` + `.gzi` + `.idx` (bgzip with companion byte-offset
  index, not tabix)
- HPRC chr20 (1GB GFA, 90 haplotypes, 1.86M segments) → 12MB pos.bed.gz + 541MB
  segments.gz
- Build: `cargo build --release --manifest-path tools/gfa-to-tabix/Cargo.toml`
- Build script: `test/data/synteny-demo/scripts/build-gfa-tabix.sh` downloads
  HPRC per-chromosome .vg files, converts via `vg convert`, then indexes

## MultiLGVSyntenyDisplay (B1, A2, B3, B4)

- Non-block-based display using `BaseDisplay` + `TrackHeightMixin`
- Canvas2D rendering with backend facade pattern
- afterAttach autorun: fetches multi-pair features via RPC, groups by genome,
  debounced (300ms)
- Genome sub-selection dialog, color by (strand/syri/identity), auto/manual row
  height
- Floating legend, searchable 2-way synteny launch dialog
- Mouse hover tooltips with ref/query coordinates, size, identity, segment ID

## Scalable N-Way LinearSyntenyView (C1)

- Collapsible synteny levels, focus mode, auto-scale heights
- Collapsed levels skip data fetching

## N-Way Diagonalization (C3)

- Cascading diagonalization across N views with progress reporting

## RPC Migration for getMultiPairFeatures (E2)

- `MultiPairGetFeatures` RPC method moves adapter queries to web worker
- Map→entries serialization for structured clone compatibility

## Testing

### Unit Tests (154 tests, 12 suites)

- **binaryCs** (51 tests): encode/decode round-trip, identity computation,
  CIGAR parity with text csToCigar, flip self-inverse, encoding size
- **binaryAlnReader** (5 tests): index parsing, range queries, CS round-trip
  validation, full-file record count, unknown chromosome handling
- **csUtils** (16 tests): csToCigar, flipCs with self-inverse property
- **gfa-to-tabix converter** (11 tests): file creation, pos/segs queries,
  segment ordinals, shared segments, synteny projection, assembly filtering,
  chunk size, sharded mode with manifest, sharded/combined parity
- **GfaTabixAdapter** (22 tests): multi-genome features, shared segments, empty
  regions, featureId uniqueness, strand, chromSizes, assemblyNamesFromHeader,
  assemblyNameMap remapping (features, chromSizes, header), HPRC chrM (44
  haplotypes — full-chromosome query, mid-region subset, snapshot at chrM:8000,
  reciprocal query from non-reference genome, segment merging, performance)
- **ShardedGfaTabixAdapter** (4 tests): round-trip conversion + query, combined
  vs sharded parity, chromSizes, assemblyNamesFromHeader
- **PairwiseIndexedPAFAdapter** (27 tests): coordinates, CIGAR, multi-pair,
  syriType, LOD tiers
- **multiSyntenyGpuData** (18 tests): instance buffer packing, genome row
  assignment, refName sorting/indexing, CIGAR expansion (D/I/X with ref
  position tracking), CS expansion (substitutions with base colors,
  deletions, insertions), feature ID uniqueness, HP split correctness,
  region render param computation

### Browser Tests (5 pangenome tests + 14 existing synteny tests)

- **GFA Pangenome** (3 tests): precomputed aln.bed.gz with cs tags, runtime
  CIGAR fallback, full page
- **HPRC Pangenome** (2 tests, remote): chrM 44-haplotype multi-LGV canvas +
  full page

## Test Data & Demo Configs

| Dataset               | Location                                | Format                   | Size  | Genomes                            |
| --------------------- | --------------------------------------- | ------------------------ | ----- | ---------------------------------- |
| Volvox pangenome GFA  | `test_data/volvox/volvox_pangenome.*`   | GFA tabix (pos+segs+aln) | small | 4 genomes, real sequences          |
| Volvox SNP PAF        | `test_data/volvox/volvox_snp.paf`       | PAF with cs:Z: tags      | small | 2 (volvox vs volvox_snp, ~2% SNPs) |
| Volvox SNP PIF        | `test_data/volvox/volvox_snp_cs.pif.gz` | PIF with cs:Z: preserved | small | 2 (volvox vs volvox_snp)           |
| HPRC chrM             | `test/data/synteny-demo/hprc/`          | GFA tabix (pos+segs+aln) | small | 44 haplotypes                      |
| HPRC chr20            | `test/data/synteny-demo/hprc/`          | GFA tabix (pos+segs+aln) | 596MB | 90 haplotypes                      |
| Arabidopsis 4-way     | `test_data/arabidopsis_synteny/`        | Multi-pair PIF           | 3MB   | 4                                  |
| Volvox multi-pair PIF | `test_data/volvox/volvox_multi.pif.gz`  | Multi-pair PIF           | small | 3                                  |

### Demo Configs (NoConfigMessage)

- Synteny: grape/peach, dotplot, human dotplot, yeast, 3-way volvox, multi-LGV
  volvox, Arabidopsis 4-way, chrM pangenome (4 genomes), HPRC chrM (44
  haplotypes), HPRC chr20 (90 haplotypes), GFA pangenome (with cs), graph genome
  viewer, hs1 vs mm39, hg19 vs hg38

## `@jbrowse/alignments-core` Shared Package

New package (`packages/alignments-core/`) containing GPU rendering utilities
shared between the alignments plugin and the MultiLGVSyntenyDisplay:

- **HP GLSL functions** (`hpGlsl.ts`): `HP_GLSL_CORE` with parameterized 3-arg
  `hpSplitUint`, `hpToClipX`, `hpScaleLinear` (caller provides hpZero value);
  `HP_GLSL_WITH_UNIFORM` adds `uniform float u_zero;` and 2-arg overloads for
  alignments backward compatibility
- **HP WGSL functions** (`hpWgsl.ts`): `HP_WGSL_CORE` with parameterized 3-arg
  versions; alignments WGSL call sites updated to pass `uf(5u)` explicitly
- **InstanceBuilder** (`InstanceBuilder.ts`): growable typed-array buffer with
  `alloc()` returning element offset, shared `u32`/`f32` views, auto-doubling
  capacity — used by both MultiLGV GPU data prep and adaptable for alignments
- **`bindUniformBlock`** moved to `@jbrowse/core/gpu/webglUtils` (generic
  WebGL2 UBO helper used by both plugins)

- **Shared shader fragments** (`sharedShaders.ts`): `RECT_LOCALS_WGSL`
  (6-vertex quad corner selection), `SIMPLE_FS_WGSL` / `SIMPLE_FS_GLSL`
  (passthrough fragment shaders), `SIMPLE_VERTEX_OUTPUT_WGSL` (standard vertex
  output struct), `PICKING_FS_GLSL` / `PICKING_FS_WGSL` (featureId → RGB
  picking fragment shaders)
- **Renderer utilities** (`rendererUtils.ts`): `getDevicePixelRatio()`,
  `resizeCanvas()` (DPR-aware canvas resize with change detection),
  `createPickingFbo()` (WebGL2 picking FBO setup/teardown); re-exports
  generic GPU utilities from `@jbrowse/core/gpu/`

## `@jbrowse/core/gpu/` Shared GPU Utilities

Generic WebGL/WebGPU utilities used across all GPU track types:

- **`webglUtils.ts`**: `createProgram()`, `createShader()`,
  `bindUniformBlock()`, `cacheUniforms()`, `splitPositionWithFrac()`,
  `enableStandardBlend()` (standard alpha blend setup)
- **`webgpuUtils.ts`** (new): `STANDARD_BLEND_STATE` (shared GPUBlendState),
  `createStandardBindGroupLayout()` (storage + uniform at binding 0/1),
  `createStorageBuffer()` (create + writeBuffer helper),
  `createStandardBindGroup()` (storage + uniform bind group helper)
- **`getGpuDevice.ts`**: singleton WebGPU device management
- **`initGpuContext.ts`**: canvas WebGPU context setup

Consumers (all GPU renderers):
- Alignments `WebGPUAlignmentsRenderer.ts` imports
  `STANDARD_BLEND_STATE`, `createStandardBindGroupLayout`,
  `createStorageBuffer`, `createStandardBindGroup`
- Alignments `wgsl/common.ts` imports shared shader fragments from
  `@jbrowse/alignments-core`
- Pairwise `WebGPUSyntenyRenderer.ts` imports all webgpuUtils +
  `getDevicePixelRatio`, `resizeCanvas`
- Pairwise `WebGLSyntenyRenderer.ts` imports `enableStandardBlend`,
  `bindUniformBlock` (removed local reimplementation)
- MultiLGV `WebGPUMultiSyntenyRenderer.ts` imports all webgpuUtils +
  `getDevicePixelRatio`, `resizeCanvas`
- MultiLGV `WebGLMultiSyntenyRenderer.ts` imports `enableStandardBlend`,
  `getDevicePixelRatio`, `resizeCanvas`, `createPickingFbo`
- MultiLGV `multiSyntenyGpuShaders.ts` imports shared shader fragments

## WebGL/WebGPU Backend for MultiSyntenyRenderer

GPU-accelerated rendering for MultiLGVSyntenyDisplay using HP (High Precision)
64-bit float emulation, matching the approach used in the alignments plugin.

### Architecture

- **Backend selection**: `MultiSyntenyRenderer` tries WebGPU → WebGL2 →
  Canvas2D fallback, using dynamic `import()` for GPU backends
- **Data flow**: geometry uploaded once on feature change
  (`prepareMultiSyntenyGpuData`), per-frame render updates only uniforms
- **No JS bpToPx in render path**: all position computation happens on the GPU
  via HP shader functions

### HP 64-Bit Float Emulation

Feature bp coordinates stored as `uint32` in instance buffers. The shader
splits each coordinate into hi/lo components using a 12-bit mask (`0xFFF`),
then computes positions with compiler guards that prevent GLSL/WGSL optimizers
from combining the split terms:

- `hpSplitUint(uint)` → `vec2(float(hi), float(lo))` where `hi` is multiple
  of 4096
- `hpScaleLinear(splitPos, bpRange, hpZero)` uses `1.0/hpZero` (runtime
  infinity), `max(-inf)`, and `dot()` to maintain precision
- `splitPositionWithFrac()` on JS side splits region start for uniform upload

Technique from genome-spy (MIT license).

### Per-Region Draw Calls

Multi-chromosome views supported via per-displayed-region draw calls:

- Features sorted by `origRefName` with a `RefNameIndex` map for O(1) lookup
- Each region gets its own `bpRange` uniform (hi/lo split of region start +
  region bp length) and screen-space position
- WebGL2: rebinds instance buffer with byte offset per region (no
  `firstInstance` support)
- WebGPU: uses `draw(vertexCount, instanceCount, 0, firstInstance)` with
  per-region command encoder submit (ensures `writeBuffer` completes before
  render pass reads uniforms)

### Instance Buffer Layout (32 bytes per instance)

```
startBp: u32, endBp: u32, genomeRow: u32, featureId: u32, color: vec4f
```

- WGSL: `vec4f` at offset 16 is 16-byte aligned in storage buffer
- GLSL: `uvec4 a_data0` via `vertexAttribIPointer` + `vec4 a_color` via
  `vertexAttribPointer`
- CIGAR/CS ops expanded at upload time into overlay sub-instances (deletions,
  insertions, mismatches) with appropriate colors from `cssColorToNormalizedRgba`

### Files

| File | Purpose |
|------|---------|
| `multiSyntenyGpuShaders.ts` | GLSL + WGSL shaders with HP functions |
| `multiSyntenyGpuData.ts` | Instance data prep, CIGAR/CS expansion, sorting |
| `WebGLMultiSyntenyRenderer.ts` | WebGL2 renderer with UBO + instanced draws |
| `WebGPUMultiSyntenyRenderer.ts` | WebGPU renderer with storage buffer + pipelines |
| `multiSyntenyBackendTypes.ts` | Split into Canvas and GPU backend interfaces |
| `MultiSyntenyRenderer.ts` | Backend selection facade |
| `MultiSyntenyRendering.tsx` | React component with separated upload/render effects |

### Tests (18 tests)

- `multiSyntenyGpuData.test.ts`: instance packing, genome row assignment,
  refName sorting/indexing, CIGAR expansion (D/I/X), CS expansion
  (substitutions/deletions/insertions), insertion ref position invariant,
  feature ID uniqueness, HP split correctness, region param computation

## GfaTabixAdapter Reliability

- **Warning logs for missing headers**: `setupPre()` now `console.warn()`s
  when `#genomes=` or `#sizes=` headers are missing from pos.bed.gz, preventing
  silent failures from malformed data
- **stopToken cancellation**: `getMultiPairFeatures()` threads `stopToken`
  through to `getMultiPairFeaturesFromAln()` and
  `getMultiPairFeaturesFromSegments()` via opts parameter.
  `checkStopToken()` called in tabix lineCallbacks (per-line cancellation) and
  at async boundaries before `getSegsForOrdinals()`.

## SVG Export for MultiLGVSyntenyDisplay

- `renderSvg.tsx` added to `MultiLGVSyntenyDisplay/`, enabling image/SVG export
  for multi-genome views (used by jbrowse-img and screenshot functionality)
- Uses `SvgCanvas` from `@jbrowse/core/util/offscreenCanvasUtils` to produce
  vector SVG output, mirroring the `Canvas2DMultiSyntenyRenderer.render()` logic
- Draws background, alternating row stripes, genome labels, synteny features
  (strand/syri/identity coloring), SNP detail (CIGAR + cs ops), and row separators
- `drawCigarOps()` and `drawCsOps()` in `multiSyntenyColorUtils.ts` widened to
  accept `CanvasRenderingContext2D | SvgCanvas` for shared use between interactive
  rendering and SVG export
- Model wires `renderSvg()` action via lazy `import()` following the same pattern
  as `LinearAlignmentsDisplay` and `BaseLinearDisplay`

## Key Design Decisions Resolved

1. **GFA indexing strategy**: pos.bed.gz (tabix) + segments.gz (bgzip with
   companion byte-offset index). Combined or sharded (per-genome) modes. HTTP
   range request support, proven at HPRC scale (90 haplotypes, 1.86M segments).
   Converter is Rust-only for scalable memory usage.
2. **Multi-pair PIF vs runtime projection**: Both supported — PIF for
   pre-computed pairwise, GfaTabixAdapter for runtime graph-based projection.
3. **cs tag as first-class**: cs preferred over CIGAR when available, rendered
   with base-specific colors. Stored alongside CIGAR in MultiPairFeature
   interface.
4. **Renderer backend pattern**: Facade → Backend interface → Canvas2D / WebGL2
   / WebGPU implementations, matching AlignmentsRenderer/SyntenyRenderer
   patterns. GPU backends use HP 64-bit float emulation for positioning.
5. **Rendering style**: Pileup-inspired — grey for matches, base-colored SNPs,
   grey deletion bars with length, purple insertion markers.
