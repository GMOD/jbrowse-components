# New Pangenome Browser — Completed Work

## Phase 1 — Delete old code ✓

**Deleted TS files:**
- `gfaBinaryIO.ts`
- `gfaSubgraphBuilders.ts`
- `gfaCoarsener.ts`
- `gfaEmitHelpers.ts`
- `gfaSeqBinaryIO.ts`
- `gfaSeqIO.ts`
- `segmentFeatureBuilder.ts`
- Bulk of `gfaTabixUtils.ts` (kept only pos.bed.gz helpers + `parseGfaPathName`)

**Deleted tests:**
- `gfaCoarsener.test.ts`
- `gfaSeqBinaryIO.test.ts`
- `gfaSeqIO.test.ts`
- `parseSegmentsBytes.bench.test.ts`
- `getSubgraph.test.ts`
- `auditConcordance.test.ts`

**Deleted scripts:**
- `dump-subgraph.ts`
- `equivalent-ranges.ts`
- `path-symmetry.ts`
- `lib/auditShard.ts`

**Deleted Rust functions from `main.rs`:**
- `sort_and_build_segments`
- `build_edge_index`
- `write_segments_seq_fa`
- `write_segments_seq_bin`

**Also:**
- `GfaTabixAdapter.ts` stubbed (Phase 2 rewrite target)
- `ShardedGfaTabixAdapter.ts` stubbed (Phase 2 rewrite target)
- `GfaAdapter.ts` import fixed: `parseGfaPathName` now from `gfaTabixUtils.ts`
- `gfaTabixUtils.ts` trimmed to: `parseGfaPathName`, `parsePosLineOrdinals`, `mergeOrdinalRanges`, `hasFileLocation`, `readHeaderField`, `parseSizesField`, `openTabixIfConfigured`

**Verification:**
- `grep -r "gfaBinaryIO|segmentFeatureBuilder|gfaSubgraphBuilders" plugins/comparative-adapters/src/` → zero results ✓
- `cargo check` passes cleanly ✓

---

## Phase 2 — `synteny_build` + MultiLGVSyntenyDisplay adapter ✓

### GFA fixtures committed
All 5 synthetic GFA fixtures at `tools/gfa-to-tabix/tests/fixtures/`:
- `linear.gfa` — identical 2-path graph (3 segments)
- `bubble.gfa` — A-[s2|s3]-s4: ref through s2 (50bp), alt through s3 (80bp)
- `inversion.gfa` — ref s1+,s2+,s3+; alt s1+,s2-,s3+ (biological inversion)
- `insertion.gfa` — ref has 50bp bubble segment, alt has 350bp (s3+s4+s5)
- `multipath.gfa` — 3 haplotypes, 2 independent bubbles

### Rust synteny_build (main.rs)
- `StepInfo` / `PathData` structs for walk collection
- `emit_path_rows` extended with `step_out: &mut Vec<StepInfo>` parameter
- L-line collection restored in first pass (for `build_edges_spatial`)
- `synteny_build()` — emits `synteny.bed.gz`, `synteny.rev.bed.gz`, `synteny.coarse.bed.gz`
- `build_edges_spatial()` — emits `edges.spatial.bed.gz`
- Both called from `main()` after pos.bed.gz is indexed

**11 Rust tests pass** (`cargo test`):
- `linear_full_coverage`
- `bubble_spans`
- `inversion_strand`
- `insertion_identity`
- `multipath_independence`
- `edges_count`
- `edges_bidirectional`
- `coarse_merges_small_gap`
- `coarse_keeps_large_gap`
- `coarse_identity_weighted`
- `rev_key_matches`

### volvox_chr1_0-50k fixture
Built from `test_data/volvox/volvox_pangenome_50.gfa` and committed to
`plugins/comparative-adapters/src/GfaTabixAdapter/__tests__/fixtures/volvox_chr1_0-50k/`:
- `volvox_chr1_0-50k.pos.bed.gz` + `.tbi`
- `volvox_chr1_0-50k.synteny.bed.gz` + `.tbi`
- `volvox_chr1_0-50k.synteny.rev.bed.gz` + `.tbi`
- `volvox_chr1_0-50k.synteny.coarse.bed.gz` + `.tbi`
- `volvox_chr1_0-50k.edges.spatial.bed.gz` + `.tbi`

### TS adapter rewrite
- `configSchema.ts` rewritten: `syntenyLocation/syntenyIndex`, `syntenyCoarseLocation/syntenyCoarseIndex`, `bubblesLocation/bubblesIndex`, `posLocation/posIndex`, `assemblyNameMap`. `prefix:` shorthand updated.
- `GfaTabixAdapter.ts` rewritten: tabix query on `synteny.bed.gz` (or `synteny.coarse.bed.gz` at bpPerPx > 1000) → `Map<genome, MultiPairFeature[]>`. Zero binary lookups.
- `ShardedGfaTabixAdapter.ts` — re-exports `GfaTabixAdapter` (sharded format obsolete).

**6 TS adapter tests pass** (`jest syntenyAdapter.test.ts`):
- `adapter_no_ordinals`
- `adapter_identity_range`
- `adapter_grouping`
- `adapter_returns_features`
- `adapter_coarse_fewer_rows`
- `getSources returns haplotype names`

---

## Cleanup — Obsolete code removal ✓

Beyond the Phase 1 deletions already recorded:

**`generate_bubbles_from_vcf` (Rust)** — removed `segments.bin`/`segments.idx`
dependency. Replaced `read_segments_for_ordinal` with an in-memory
`ord_to_paths: HashMap<u64, Vec<(usize, u64, u64)>>` built from `all_paths`
after the path-processing loop. Deleted `read_segments_for_ordinal` and
`RECORD_SIZE`.

**`write_jbrowse_config` (Rust)** — updated to emit the new schema:
`syntenyLocation`, `syntenyIndex`, `syntenyCoarseLocation`, `syntenyCoarseIndex`,
`edgesLocation`, `edgesIndex`, `seqlensLocation` (replaces old `segmentsLocation`
/ `segmentsIdxLocation`).

**`ShardedGfaTabixAdapter/`** — entire directory deleted. Removed from
`syntenyTypes.ts` and `index.ts`.

**`gfaParser.adapterContract.test.ts`** — deleted (tested `dump-subgraph.ts`
which was already removed).

**`parsePosLineOrdinals` / `mergeOrdinalRanges`** removed from `gfaTabixUtils.ts`
(callers deleted in Phase 1).

**`prepare-fixtures.sh` / `test-bubbles.sh`** — updated to check new output
files (`synteny.bed.gz`, `edges.spatial.bed.gz`) instead of `segments.bin`.

**`README.md`** — rewritten to reflect new output format.

**Circular-view** — stripped `console.log`/`console.trace` debug calls added
by another agent; kept the real fixes: `view.staticSlices ?? []` guard,
`!blockDefs?.length` early-loading check, `blockDefs` variable extraction.

---

## Phase 3 — New GetSubgraph ✓

### Rust: `seglens.bin`

Flat little-endian u32 array written after pos/synteny/edges: `lens[ordinal]`
= segment length in bp. Byte offset for ordinal `k` = `k * 4`. Enables a
single HTTP range request for any ordinal range.

Added to `write_jbrowse_config` output and `prepare-fixtures.sh` status check.

### TypeScript: configSchema additions

New slots added to `GfaTabixAdapter` configSchema (with `prefix:` expansion):
- `edgesLocation` / `edgesIndex` — `edges.spatial.bed.gz`
- `seqlensLocation` — `seglens.bin`

### TypeScript: `GfaTabixAdapter.getSubgraph`

6-step tabix algorithm:
1. Query `pos.bed.gz refChrom:[start,end]` → reference ordinals
2. Query `synteny.bed.gz refChrom:[start,end]` → `(hapChrom, hapStart, hapEnd)` per block
3. Query `pos.bed.gz hapChrom:[hapStart,hapEnd]` for each unique hap range → alt/bubble ordinals
4. Query `edges.spatial.bed.gz refChrom:[start,end]` → L-lines (filtered to ordinals in view)
5. Fetch `seglens.bin[minOrd*4 .. (maxOrd+1)*4]` → single range read, u32 lengths
6. Assemble GFA: H-line, S-lines (ordinal IDs + LN tags), L-lines, W-lines (path walks from pos.bed.gz chunks)

Added `parseOrdinalRanges(line, out)` module-level helper that parses the
`ordinalRanges` column of pos.bed.gz rows into a `Set<number>`.

### Fixture updated

`volvox_chr1_0-50k` regenerated from `volvox_pangenome_50.gfa`; now includes
`volvox_chr1_0-50k.seglens.bin` (1204 ordinals × 4 bytes = 4816 bytes).

### Tests

`__tests__/getSubgraph.test.ts` — 4 tests:
- `returns_gfa_string` — output starts with GFA H-line
- `slines_complete` — all S-line ordinal IDs are valid finite numbers
- `llines_no_dangling` — every L-line endpoint has a corresponding S-line
- `empty_region` — out-of-bounds region returns `H\tVN:Z:1.1` only

**Total: 123 TS tests pass, 11 Rust tests pass.**

---

## Phase 4 — GraphGenomeView large-region renderer ✓

### New RPC: `GetSyntenyBlocks`

`plugins/linear-comparative-view/src/LinearSyntenyRPC/GetSyntenyBlocks.ts`

Thin wrapper that calls `getMultiPairFeatures(region, { bpPerPx })` and returns
`[string, SyntenyBlockEntry[]][]` — a serializable map of genome → blocks. Each
`SyntenyBlockEntry` carries `{ refStart, refEnd, mateRefName, mateStart, mateEnd, strand, identity }`.

Registered in `linear-comparative-view/src/index.ts`.

### Model changes (`GraphGenomeView/model.ts`)

- `SyntenyBlock` interface exported (mirrors `SyntenyBlockEntry`).
- New volatiles: `syntenyBlocks: [string, SyntenyBlock[]][] | undefined`,
  `largeModeRegion: { refName, start, end } | undefined`.
- `clearGraph()` extended to clear both new volatiles.
- `loadFromTabixSubgraph` gains `bpPerPx?: number` option; dispatches to
  `loadFromTabixLarge` when `region.end − region.start > 100_000`.
- `loadFromTabixLarge` generator: clears graph state, calls `GetSyntenyBlocks`
  RPC, stores result in `syntenyBlocks` + `largeModeRegion`.

### New component: `LargeModeSyntenyCanvas.tsx`

Canvas2D renderer for large-mode synteny view. Uses `autorun` inside `useEffect`
to redraw reactively. X-axis = reference position, Y-axis = genome index.
Categorical color palette per genome; alpha encodes identity; positive/negative
strand distinguished by color variant. Left 120px reserved for genome labels.

### `GraphGenomeView.tsx` updated

Priority: `syntenyBlocks` → `LargeModeSyntenyCanvas`, `hasGraph` → `GraphCanvas`,
else `ImportForm`.

### Tests

`__tests__/largeMode.test.ts` — 4 tests:
- `routing_small` — 50 kbp region: `getSubgraph` returns GFA with S-lines
- `routing_large` — `getMultiPairFeatures` returns non-empty blocks (large-mode data source)
- `spatial_agreement` — block ref coords are within queried region, `mateRefName` is non-empty string
- `bpPerPx_routing` — `bpPerPx > 1000` selects coarse file → fewer rows

**Total: 127 TS tests pass, 11 Rust tests pass.**
