# Pangenome Synteny: Completed Work

## CLI (`jbrowse make-pif`, `jbrowse make-gfa-db`, `jbrowse make-gfa-tabix`)

- 3-tier PIF format: full (t/q with CIGAR), summary (st/sq with absolute-position indels), structural (xt/xq with SyRI types)
- SyRI classification on all tiers via `sy:Z:` tag
- Format converters: PAF, SyRI `.syri.out`, BEDPE, GFA (P-lines + W-lines), MAF
- `--all-vs-all` mode with auto-ordering by syntenic coverage
- `--session` flag for session spec JSON generation
- Multi-pair PIF with pair-indexed prefixes (t0/q0, t1/q1, ...)
- GFA parser emits `sg:Z:` segment IDs for cross-pair tracking
- `segmentId` field on `PAFLikeRecord`, emitted as `sg:Z:` tag in PAF output
- `jbrowse make-gfa-db` converts GFA → SQLite with segments, paths, path_steps tables
  - Supports P-lines (GFA1) and W-lines (GFA1.1+), assembly filtering
  - Uses `node:sqlite` (built-in), indexed by path + cumulative_offset
- `jbrowse make-gfa-tabix` converts GFA → tabix-indexed files for runtime synteny
  - `*.pos.bed.gz` — position → segment ordinal mapping per genome path
  - `*.segs.bed.gz` — segment ordinal → position mapping across all genomes
  - `*.aln.bed.gz` — precomputed pairwise alignments with cs tags (base-level detail)
  - Both indexed with `tabix -p bed`, supports comment headers
  - Configurable chunk size (default 100 segments per pos chunk)
  - Assembly filtering via `--assemblies` flag
- cs tag support in make-pif: `cs:Z:` tags preserved in full-tier lines, stripped from summary tiers
- `flipCs` function properly swaps cs tag perspective for q-prefix lines (*XY→*YX, +seq→-seq, -seq→+seq)

## cs Tag as First-Class Citizen

- `MultiPairFeature` interface: `cs: string | undefined` field alongside `cigar`
- `csUtils.ts` shared utilities: `csToCigar()` and `flipCs()` exported from comparative-adapters plugin
- `drawCsOps()` renders cs tags directly with base-specific mismatch colors (A=#00bf00, C=#4747ff, G=#d5bb04, T=#f00)
- Base letters rendered on mismatches when zoomed in (pxPerBp >= 6, rowHeight >= 8)
- Renderer priority: cs > cigar (if cs available, used directly without CIGAR conversion)
- cs extracted from: GFA aln.bed.gz (precomputed), PAF `cs:Z:` tag, PIF (preserved through make-pif)
- 16 unit tests for cs utilities (csToCigar + flipCs including self-inverse property)

## GFA Alignment Preprocessing (aln.bed.gz)

- `make-gfa-tabix` stores segment sequences from GFA S-lines in memory
- After writing pos/segs files, computes pairwise alignments for each query genome vs reference
- Walks shared segment anchors, detects bubbles between them
- Bubble cs computation: shared segments → `:N`, ref-only → `-seq`, query-only → `+seq`, equal-length both → base-by-base comparison producing `*XY` substitution ops
- `computeBubbleCs()` and `baseByBaseCs()` functions with revcomp support for negative strand segments
- Output: `aln.bed.gz` (tabix-indexed) with format: `refPath\tstart\tend\tqueryGenome\tqueryChrom\tqStart\tqEnd\tstrand\tcs`
- Tested with volvox_pangenome.gfa (4 genomes, 12 segments, real sequences — verified base-level SNPs in cs output)

## GfaTabixAdapter Enhancements

- Runtime CIGAR derivation from segment gaps (`getMultiPairFeaturesFromSegments`): between shared anchors, ref gaps → D, query gaps → I, both → X
- Precomputed alignment support (`getMultiPairFeaturesFromAln`): reads aln.bed.gz, converts cs→CIGAR, computes identity from cs
- Graceful fallback: uses aln.bed.gz when available, otherwise segment-based runtime CIGAR
- Config schema: `alnLocation`/`alnIndex` fields with prefix shorthand
- `isAlnAvailable()` with promise caching for efficient availability check

## MultiLGVSyntenyDisplay Rendering Overhaul

- Renderer backend architecture: `MultiSyntenyRenderer` facade → `MultiSyntenyBackend` interface → `Canvas2DMultiSyntenyRenderer`
  - Follows same pattern as `AlignmentsRenderer` and `SyntenyRenderer`
  - `getOrCreate()` + `init()` with cancelled flag, dispose-before-reinit
  - Backend selection via `getGpuOverride()` — WebGL/WebGPU implementations can be added
- Pileup-style CIGAR rendering:
  - Deletions: thick grey bars with deletion length text (white, centered)
  - Insertions: purple vertical line with triangle markers at top/bottom
  - Mismatches (CIGAR): red full-height rectangles
  - Mismatches (cs): base-specific colors with letter labels when zoomed in
  - Shared `drawDeletion()`/`drawInsertion()` helpers eliminate code duplication
- Default coloring: grey (#c8c8c8) for forward strand, blue (#6899e0) for inversions
- Improved tooltips: ref/query coordinates with sizes, identity %, inversion indicator

## PairwiseIndexedPAFAdapter

- 3-tier LOD, multi-pair support, `syriType` propagation
- `getMultiPairFeatures()`: fetches all pairs for a region, grouped by query genome
- `getPairInfo()`: exposes pair metadata from PIF header
- `segmentId` support via `sg:Z:` PAF tag for cross-pair shared alignment tracking
- cs tag extraction from PAF `cs:Z:` field into MultiPairFeature

## GfaTabixAdapter (A1)

- Runtime GFA synteny adapter using `@gmod/tabix` — zero new dependencies
- Reads pos.bed.gz + segs.bed.gz + optional aln.bed.gz tabix files
- `getMultiPairFeatures()`: 2-3 tabix queries per call (O(1) regardless of genome count)
- Synteny projection: query ref region → get segment ordinals → find all genome positions
- HTTP range request compatible — works with remote files, no WASM needed
- Registered in comparative-adapters plugin with `GfaTabixAdapter` config schema
- Prefix-based config shorthand for minimal configuration

## Assembly Auto-Creation from GFA Paths (A4)

- `make-gfa-tabix` now writes `#sizes=` header with per-path total lengths
- `GfaTabixAdapter.getChromSizes()` parses the `#sizes=` header → returns `Map<genome, {refName, length}[]>`
- `MultiLGVSyntenyDisplay.afterAttach` auto-creates session assemblies for genomes not already in the assembly manager
- No `.chrom.sizes` files needed — everything comes from the GFA tabix header

## Segment Merging for GfaTabixAdapter (E1)

- Adjacent shared segments with same strand and contiguous ref/mate coordinates are merged into single `MultiPairFeature` blocks
- Forward and reverse strand merging with CIGAR derivation from gaps
- Tested with HPRC chrM (1393 segments, 44 haplotypes)

## Large-Scale GFA Demo Data (A5)

- HPRC minigraph-cactus v1.1: chrM (44 haplotypes), chr20 (90 haplotypes)
- Demo configs added to NoConfigMessage
- Test data: `test/data/synteny-demo/hprc/`

## Streaming GFA Conversion - Rust Tool (A3)

- `tools/gfa-to-tabix/` — Rust CLI for GFA→tabix conversion at pangenome scale
- Two-pass streaming: O(segments) memory, handles multi-GB GFA files
- HPRC chr20 (1GB GFA, 90 haplotypes, 1.86M segments) → 12MB pos.bed.gz + 584MB segs.bed.gz in ~4.5 min

## MultiLGVSyntenyDisplay (B1, A2, B3, B4)

- Non-block-based display using `BaseDisplay` + `TrackHeightMixin`
- Canvas2D rendering with backend facade pattern
- afterAttach autorun: fetches multi-pair features via RPC, groups by genome, debounced (300ms)
- Genome sub-selection dialog, color by (strand/syri/identity), auto/manual row height
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

### Unit Tests (37+ tests, 4 suites)

- **csUtils** (16 tests): csToCigar (10 — match runs, substitutions, insertions, deletions, mixed ops, GFA bubble cs, empty, zero-length, long sequences), flipCs (6 — preserves matches, swaps bases, swaps I/D, mixed ops, empty, self-inverse property)
- **GFA→Tabix** (11 tests): file creation + indexing, pos/segs queries, segment ordinal ranges, shared segments, synteny projection, assembly filtering, chunk size, aln.bed.gz generation with cs tags, cs substitution detection
- **GfaTabixAdapter** (11 tests): multi-genome features, shared segments, empty regions, featureId uniqueness, strand, getAssemblyNames, chromSizes (+ 1 remote HPRC test)
- **PairwiseIndexedPAFAdapter** (27 tests): coordinates, CIGAR, multi-pair, syriType, LOD tiers

### Browser Tests (5 pangenome tests + 14 existing synteny tests)

- **GFA Pangenome** (3 tests): precomputed aln.bed.gz with cs tags, runtime CIGAR fallback, full page
- **HPRC Pangenome** (2 tests, remote): chrM 44-haplotype multi-LGV canvas + full page

## Test Data & Demo Configs

| Dataset | Location | Format | Size | Genomes |
|---------|----------|--------|------|---------|
| Volvox pangenome GFA | `test_data/volvox/volvox_pangenome.*` | GFA tabix (pos+segs+aln) | small | 4 genomes, real sequences |
| Volvox SNP PAF | `test_data/volvox/volvox_snp.paf` | PAF with cs:Z: tags | small | 2 (volvox vs volvox_snp, ~2% SNPs) |
| Volvox SNP PIF | `test_data/volvox/volvox_snp_cs.pif.gz` | PIF with cs:Z: preserved | small | 2 (volvox vs volvox_snp) |
| HPRC chrM | `test/data/synteny-demo/hprc/` | GFA tabix (pos+segs) | small | 44 haplotypes |
| HPRC chr20 | `test/data/synteny-demo/hprc/` | GFA tabix (pos+segs) | 596MB | 90 haplotypes |
| Arabidopsis 4-way | `test_data/arabidopsis_synteny/` | Multi-pair PIF | 3MB | 4 |
| Volvox multi-pair PIF | `test_data/volvox/volvox_multi.pif.gz` | Multi-pair PIF | small | 3 |

### Demo Configs (NoConfigMessage)

- Synteny: grape/peach, dotplot, human dotplot, yeast, 3-way volvox, multi-LGV volvox, Arabidopsis 4-way, chrM pangenome (4 genomes), HPRC chrM (44 haplotypes), HPRC chr20 (90 haplotypes), GFA pangenome (with cs), graph genome viewer, hs1 vs mm39, hg19 vs hg38

## Key Design Decisions Resolved

1. **GFA indexing strategy**: Tabix-based (3 files: pos.bed.gz + segs.bed.gz + optional aln.bed.gz). Zero new deps, HTTP range request support, proven at HPRC scale.
2. **Multi-pair PIF vs runtime projection**: Both supported — PIF for pre-computed pairwise, GfaTabixAdapter for runtime graph-based projection.
3. **cs tag as first-class**: cs preferred over CIGAR when available, rendered with base-specific colors. Stored alongside CIGAR in MultiPairFeature interface.
4. **Renderer backend pattern**: Facade → Backend interface → Canvas2D implementation, matching AlignmentsRenderer/SyntenyRenderer patterns. Ready for WebGL/WebGPU.
5. **Rendering style**: Pileup-inspired — grey for matches, base-colored SNPs, grey deletion bars with length, purple insertion markers.
