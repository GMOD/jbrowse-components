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
- `jbrowse make-gfa-tabix` converts GFA → 2 tabix-indexed files for runtime synteny
  - `*.pos.bed.gz` — position → segment ordinal mapping per genome path
  - `*.segs.bed.gz` — segment ordinal → position mapping across all genomes
  - Both indexed with `tabix -p bed`, supports comment headers
  - Configurable chunk size (default 100 segments per pos chunk)
  - Assembly filtering via `--assemblies` flag

## PairwiseIndexedPAFAdapter

- 3-tier LOD, multi-pair support, `syriType` propagation
- `getMultiPairFeatures()`: fetches all pairs for a region, grouped by query genome
- `getPairInfo()`: exposes pair metadata from PIF header
- `segmentId` support via `sg:Z:` PAF tag for cross-pair shared alignment tracking

## GfaTabixAdapter (A1)

- Runtime GFA synteny adapter using `@gmod/tabix` — zero new dependencies
- Reads pos.bed.gz + segs.bed.gz tabix files created by `make-gfa-tabix`
- `getMultiPairFeatures()`: 2 tabix queries per call (O(1) regardless of genome count)
- Synteny projection: query ref region → get segment ordinals → find all genome positions
- HTTP range request compatible — works with remote files, no WASM needed
- Registered in comparative-adapters plugin with `GfaTabixAdapter` config schema
- Prefix-based config shorthand for minimal configuration
- Prior art: sequenceTubeMap tabix approach (jmonlong), ported to JBrowse's `@gmod/tabix`

## Assembly Auto-Creation from GFA Paths (A4)

- `make-gfa-tabix` now writes `#sizes=` header with per-path total lengths (e.g., `#sizes=ref#1#chr1:5472117,sample1#1#chr1:5485194,...`)
- `GfaTabixAdapter.getChromSizes()` parses the `#sizes=` header → returns `Map<genome, {refName, length}[]>`
- `MultiLGVSyntenyDisplay.afterAttach` auto-creates session assemblies for genomes not already in the assembly manager
  - Uses `FromConfigRegionsAdapter` with inline features derived from chrom sizes
  - No `.chrom.sizes` files needed — everything comes from the GFA tabix header
- Gracefully handles legacy tabix files without `#sizes=` header (returns empty Map, no auto-creation)
- Enables "Launch N-way synteny view" to work even for unconfigured genomes

## Segment Merging for GfaTabixAdapter (E1)

- Adjacent shared segments with same strand and contiguous ref/mate coordinates are merged into single `MultiPairFeature` blocks
- Reduces per-segment noise into larger alignment blocks for cleaner visualization
- Forward strand merging: extends when `mateStart === prevMateEnd`
- Reverse strand merging: extends when `mateEnd === prevMateStart`
- Non-overlapping guarantee: merged features don't overlap on the ref axis
- Tested with HPRC chrM (1393 segments, 44 haplotypes) — verified significant reduction in feature count

## Large-Scale GFA Demo Data (A5)

- Downloaded HPRC minigraph-cactus v1.1 per-chromosome VG files from S3 (`human-pangenomics/pangenomes/freeze/freeze1/`)
- Converted chrM (44 haplotypes, 1393 segments) and chr20 (90 haplotypes, 1.86M segments) to GFA via `vg convert -f`
- Generated tabix files including `#sizes=` header
- chrM: Node.js `make-gfa-tabix` works fine (small data)
- chr20: Node.js OOMs at 8GB — used Rust `tools/gfa-to-tabix` (4.5 min, streaming two-pass, O(segments) memory)
- Demo configs: `config_hprc_chrM.json` (44 haplotypes), `config_hprc_chr20.json` (90 haplotypes)
- Only ref assembly (GRCh38#0) pre-configured; others auto-created at runtime via A4
- Added HPRC demo links to NoConfigMessage.tsx
- Test data: `test/data/synteny-demo/hprc/hprc-v1.1-mc-grch38-{chrM,chr20}.*`

## Streaming GFA Conversion - Rust Tool (A3)

- `tools/gfa-to-tabix/` — Rust CLI for GFA→tabix conversion at pangenome scale
- Two-pass streaming: pass 1 reads segments (HashMap), pass 2 streams paths to sort|bgzip pipes
- Memory: O(segments) for ID→ordinal+length map, O(1) for path processing
- Handles 1.86M segments / 919 paths in ~4.5 min (Node.js version OOMs at 8GB)
- Produces identical output format to Node.js `jbrowse make-gfa-tabix`
- Supports `--assemblies`, `--chunk-size` flags, both P-lines (GFA1) and W-lines (GFA1.1)
- Validated performance: HPRC chr20 (1GB GFA, 90 haplotypes) → 12MB pos.bed.gz + 584MB segs.bed.gz

### Validated Query Performance (chr20, 100kb region)

- **Query time**: 274ms for 100kb region
- **Genomes returned**: 17 (varies by region — not all contigs overlap every ref region)
- **Merged features**: 3909 (segment merging active)

## MultiLGVSyntenyDisplay (B1, A2, B3, B4)

- Non-block-based display using `BaseDisplay` + `TrackHeightMixin` (no server-side rendered blocks)
- Canvas2D rendering with `data-testid="multi_synteny_canvas"`
- afterAttach autorun: fetches multi-pair features via RPC, groups by genome, debounced (300ms)
- Genome sub-selection dialog (searchable checkbox list, select/deselect all)
- Track menu: color by, row height (auto/manual), genome selector, synteny view launchers
- Auto-height mode (default): rows auto-fit to display height (`height / numGenomes`), matching MultiWiggle pattern
- Manual row height mode: fixed px per row (5/10/15/20/30px) for dense display
- Adaptive rendering: hides labels when rowHeight<12, hides separators when <4
- `colorBy` property: strand (blue/orange), syri (SYN/INV/TRANS/DUP), identity (green→red gradient)
- CIGAR detail rendering: insertions (red), deletions (blue), mismatches (brown) overlaid on feature blocks
  - CIGAR colors shared from `drawSyntenyUtils.ts` (same as LinearSyntenyDisplay)
  - `MultiPairFeature.cigar` field extracted from PAF `cg:` tag by PairwiseIndexedPAFAdapter
- Floating legend via `BaseLinearDisplay` `legendItems()` override + `FloatingLegend` component
- "Launch 2-way synteny with..." converted from 90-item submenu to searchable dialog
- Mouse hover tooltips showing genome name, coordinates, size, type, identity, segmentId
- Duck-typed interfaces throughout to avoid circular MST type dependencies

## Scalable N-Way LinearSyntenyView (C1)

- Collapsible synteny levels: each level has `collapsed` property, renders as 10px bar when collapsed
- Focus mode: expand one level, collapse all others (header menu)
- Auto-scale level heights for 4+ levels: `max(40, min(100, 400/numLevels))`
- Collapsed levels skip data fetching (afterAttach checks `isLevelCollapsed`)
- `effectiveHeight` getter on levels, respected by LinearSyntenyDisplay height
- "Synteny levels" header submenu: expand/collapse all, auto-scale, per-level focus radio

## N-Way Diagonalization (C3)

- Extended `DiagonalizationProgressDialog` to support N views (was limited to 2)
- Cascading diagonalization: view[1] against view[0], view[2] against (reordered) view[1], etc.
- Progress bar shows per-level progress (`Level 1/N: message`)
- Uses existing `diagonalizeRegions()` algorithm unchanged — just applied iteratively
- Summary shows total regions reordered and reversed across all levels

## RPC Migration for getMultiPairFeatures (E2)

- New `MultiPairGetFeatures` RPC method moves adapter queries to web worker
- Handles multiple content blocks in a single RPC call (was per-block loop on main thread)
- `fetchChromSizes` flag: assembly auto-creation data fetched in same worker call
- Map→entries serialization for structured clone compatibility (`genomeRows` as `[string, MultiPairFeature[]][]`)
- `MultiLGVSyntenyDisplay.afterAttach` simplified: removed direct adapter access, uses `rpcManager.call()`

## LaunchPairwiseSyntenyDialog

- Searchable dialog for launching 2-way synteny views from MultiLGVSyntenyDisplay
- Replaces long submenu (unusable with 44+ genomes)
- Filter text field, click genome to launch and auto-close
- Duck-typed `{ displayedGenomes: string[] }` interface (no circular model type import)

## Scaffold Name Handling (A6)

- Three-part path naming scheme (`sample#haplotype#scaffoldName`) correctly handles non-standard contig names
- `parseGfaPathName()` correctly extracts scaffold names like `JAHBCB010000023.1` as `mateRefName`
- Assembly auto-creation uses the correct scaffold names from the `#sizes=` header
- No code changes needed — the existing architecture already supports this edge case

## Auto-Default MultiLGVSyntenyDisplay (A6)

- `Core-preProcessTrackConfig` extension reorders displays for multi-pair adapter types
- `multiPairTypes` list: `PairwiseIndexedPAFAdapter`, `GfaTabixAdapter`
- When a SyntenyTrack uses a multi-pair adapter, `MultiLGVSyntenyDisplay` is placed before `LGVSyntenyDisplay` in the display order
- No manual display switching needed — users get multi-genome view by default
- `GfaTabixAdapter` added to `syntenyTypes` list for proper track type detection

## Compact View Mode (E0)

- `compactViews` property on `LinearComparativeView`: per-view boolean array
- Compact views render as 24px label bar showing assembly name
- Click compact bar to expand back to full LGV
- `CompactViewBar` component with theme-aware styling
- "Genome views" header submenu (shown for >2 views): compact all / expand all / per-view checkboxes
- `isViewCompact(idx)` view, `toggleCompactView`/`compactAllViews`/`expandAllViews` actions
- State persisted in snapshots, only serialized when at least one view is compact

## Runtime UI

- `syri` color mode: SYN (gray), INV (orange), TRANS (blue), DUP (cyan)
- Color legend component in header
- Quick Import panel (single-file import with format auto-detection)
- Bulk assembly addition in import form

## Testing

### Unit Tests (51 tests, 4 suites)

- **PairwiseIndexedPAFAdapter** (27 tests): coordinate extraction, CIGAR handling, getRefNames, getPairInfo, getAssemblyNames, multi-pair PIF (pair metadata, multi-genome features, syriType, empty regions, mate coordinate consistency, identity, strand, featureId uniqueness, partial overlap, nonexistent refName, header metadata, structural/summary tier LOD)
- **GfaTabixAdapter** (7 tests): multi-genome features, shared segments, empty regions, nonexistent refNames, featureId uniqueness, strand correctness, getAssemblyNames
- **GFA→SQLite** (9 tests): schema, segments, paths, path steps with offsets, offset range queries, shared segments, synteny projection, total_length verification, assembly filtering
- **GFA→Tabix** (8 tests): file creation + indexing, pos.bed.gz queries, segs.bed.gz queries, segment ordinal ranges, shared segments across genomes, synteny projection workflow, assembly filtering, chunk size granularity

### Browser Tests (14 synteny tests)

- **Multi-LGV Synteny Display** (7 tests): multi-pair PIF genome rows (canvas + page), N-way PIF (canvas + page), Arabidopsis 4-way Chr1 (canvas + page), Arabidopsis multi-genome LGV (canvas)
- **Multi-Way Synteny Views** (4 tests): 3-way volvox, 3-way full page, 2-way with genes, dotplot grape/peach
- **Synteny Views** (3 tests): flipped inverted, regular inverted, LGV synteny track

## Test Data & Demo Configs

| Dataset | Location | Format | Size | Genomes |
|---------|----------|--------|------|---------|
| Plotsr Arabidopsis | `test/data/synteny-demo/plotsr/` | SyRI, PAF, BEDPE | 3.6MB | 4 (Col-0, Ler, Cvi, Eri) |
| Arabidopsis 4-way PIF | `test_data/arabidopsis_synteny/` | Multi-pair PIF | 3MB | 4 (Col-0→Ler→Cvi→Eri) |
| PGGB chrM tabix | `test_data/arabidopsis_synteny/` | GFA tabix (pos+segs) | 7KB | 4 human mitochondrial |
| HPRC minigraph | `test/data/synteny-demo/hprc/` | rGFA (no paths) | 850MB | 90 haplotypes |
| ntSynt great apes | `test/data/synteny-demo/ntsynt/` | TSV blocks | 1.7MB | 6 primates |
| Synthetic 3-way | `test/data/synteny-demo/synthetic/` | PAF | 350KB | 3 genomes, 3 chr |
| Synthetic 8-way | `test/data/synteny-demo/synthetic/` | PAF | 3.4MB | 8 genomes, 5 chr |
| Synthetic all-vs-all | `test/data/synteny-demo/synthetic/` | PAF | 930KB | 5 genomes, 2 chr |
| Synthetic 4-genome GFA | `test/data/synteny-demo/synthetic/` | GFA (P-lines) | 32KB | 4 genomes, 1 chr |
| Synthetic 4-genome tabix | `test_data/volvox/synthetic_4genome.*` | GFA tabix (pos+segs) | 7KB | 4 genomes |
| Volvox multi-pair PIF | `test_data/volvox/volvox_multi.pif.gz` | Multi-pair PIF | small | 3 (volvox+ins+del) |
| Volvox N-way | `test_data/config_synteny_nway.json` | PIF | small | 3 (volvox, volvox_ins, volvox_del) |

### Demo Configs (NoConfigMessage)

- `config_synteny_nway.json` — 3-way volvox synteny (volvox+ins+del)
- `config_multi_lgv_synteny.json` — Multi-genome volvox synteny (LGV, multi-pair)
- `arabidopsis_synteny/config.json` — Arabidopsis 4-way synteny (Col-0, Ler, Cvi, Eri)
- `arabidopsis_synteny/config_chrM_pangenome.json` — Human chrM pangenome (4 genomes, GFA tabix)

### Validated Performance

- HPRC chr1 (46 assemblies, 123K PAF lines, 182MB): **2.3 seconds** to PIF
- Arabidopsis 4-way (39K SyRI records): **~1 second** to multi-pair PIF
- 3-tier LOD tested at chromosome scale through base level

## Key Design Decisions Resolved

1. **GFA indexing strategy**: Tabix-based (2 files: pos.bed.gz + segs.bed.gz). Chose over SQLite+sql.js because: zero new deps, HTTP range request support, proven by sequenceTubeMap at HPRC scale.
2. **Multi-pair PIF vs runtime projection**: Both supported — PIF for pre-computed pairwise, GfaTabixAdapter for runtime graph-based projection.
3. **HPRC minigraph GFA**: rGFA format (segments+links only, no W-lines) — not suitable for multi-genome synteny. Need HPRC GBZ/GFA with explicit paths for full demos.
