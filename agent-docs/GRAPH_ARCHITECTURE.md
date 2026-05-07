# Graph & GFA-Tabix Architecture

End-to-end map of the GFA-tabix index path: from static index files on disk
through the data adapter, into the comparative LGV synteny display, and into
the standalone graph view. Companion to:

- `agent-docs/GRAPH_PLAN.md` — publication plan and phase numbering.
- `agent-docs/GRAPH_INDEX_FORMAT.md` — on-disk file-format spec (magic
  bytes, BED/BGZF schemas, versioning).
- `agent-docs/GRAPH_AUDIT.md`, `GRAPH_PERF.md` — audits and per-phase status.
- `agent-docs/GRAPH_COARSE_DESIGN.md` — design contract for megabase-scale
  coarse graph viewing (tile + snarl methods; runtime tabix lookups).
  Step 1 (preprocessor) and Step 2 routing implemented; browser dogfood pending.

This file documents *what code lives where and why*, plus the cross-cutting
invariants that hold across the whole pipeline. When code drifts, update
this file.

## Pipeline overview

```
┌────────────────────────┐
│ vg + tools/gfa-to-tabix│  (offline; produces static files)
└──────────┬─────────────┘
           ▼
┌──────────────────────────────────────────────────────────────┐
│ pos.bed.gz       segments.bin     edges.bin    seq.bin / fa  │
│  + .tbi           + .idx           + .idx       + .idx       │
│ bubbles.bed.gz   (snarls.bed.gz — Phase 4)                   │
│  + .tbi                                                      │
└──────────┬───────────────────────────────────────────────────┘
           ▼
┌──────────────────────────────────────────────────────────────┐
│ plugins/comparative-adapters/src/GfaTabixAdapter             │
│  • setup → header parse                                      │
│  • fetchSegmentsForRegion → ord lookup → seg fetch           │
│  • getMultiPairFeatures → per-pair features + bubble CS      │
│  • getSubgraph → GFA text for graph view                     │
│  • getEquivalentRanges → C3 path-symmetry helper             │
└────┬───────────────────────────────────────────────────┬─────┘
     │ MultiPairFeature[]                                │ GFA text
     ▼                                                    ▼
┌───────────────────────────────────────┐  ┌────────────────────────────┐
│ plugins/linear-comparative-view/      │  │ plugins/graph/             │
│   MultiLGVSyntenyDisplay              │  │   GraphGenomeView          │
│  • backend.sync(sources)              │  │  • parseGFA → Graph        │
│  • backend.renderBlocks(blocks)       │  │  • RPC: GraphComputeLayout │
│  • prepareBlockGeometry (uint32 bp)   │  │  • buildGeometry → GPU     │
│  • shaders/multiSyntenyFill           │  │  • shaders/graphRenderer   │
└───────────────────────────────────────┘  └────────────────────────────┘
```

## On-disk index (input)

See `GRAPH_INDEX_FORMAT.md` for byte layouts and headers. Three things to
keep in mind when reading the rest of this document:

- **Ordinals.** Every node in the graph has a stable `segOrd` (u32). All
  binary records and all in-memory cross-references key on `segOrd`. Path
  names live in the `pos.bed.gz` `#paths=` header and are referenced by
  `pathNameIdx` (u16) inside `segments.bin`.
- **Multiple records per ordinal.** `segments.bin` has *one record per
  (segment, path-visit)*. A segment visited by 47 paths produces 47
  records. The `.idx` BigUint64Array ranges over ordinals; reading
  `[lo, hi]` returns records for *all* paths visiting any of those
  ordinals.
- **Tabix BED rows.** `pos.bed.gz` is keyed on `(refPath, start, end)` and
  carries the ordinal range that covers the BED interval. This is the
  entry point for any region query: ord → seg → all paths' offsets.

## Adapter: `plugins/comparative-adapters/src/GfaTabixAdapter`

| File | Role |
|------|------|
| `index.ts` | `AdapterType` registration; lazy-loads class. |
| `configSchema.ts` | Adapter config: `posLocation`, `segmentsLocation`, `edgesLocation`, `seqFastaLocation`, `bubblesLocation`, `assemblyNameMap`. |
| `GfaTabixAdapter.ts` | Concrete single-shard subclass. Opens one segments shard; provides `getSegsForOrdinals`. |
| `gfaTabixUtils.ts` | `BaseGfaTabixAdapter` — abstract; everything except segment I/O. The abstract method `getSegsForOrdinals` is the single point of variance between `GfaTabixAdapter` (single shard) and `ShardedGfaTabixAdapter` (per-genome shards). The base also caches the forward + reverse `assemblyNameMap` once on the instance and re-uses both for every name lookup; bubble overlay receives the reverse map directly so it does not rebuild per query. |
| `gfaBinaryIO.ts` | Binary record parsers: `parseSegmentsBinary`, `parseEdgesBinary`, `loadBinaryIndex`, `getSegmentsForOrdinalsFromShard`, `parseGfaPathName`, `parsePosLineOrdinals`, `mergeOrdinalRanges`. |
| `segmentFeatureBuilder.ts` | `buildFeaturesForPath`: ref-vs-other segment co-traversal → `MultiPairFeature[]` with CIGAR. Receives `refByOrd` from the in-`gfaTabixUtils.ts` `partitionByRef` helper, which is the single point that splits a region's segments into the ref bucket plus per-other-path buckets. |
| `bubbleOverlay.ts` | One-stop bubble pipeline: parse rows → group into `BubbleSite[]` (one entry per locus) → per-feature lockstep walk over CIGAR + sites → write `feat.cs` and `feat.identity`. Public surface is `annotateFeaturesWithBubbleCs`; `buildCsFromCigarAndSites` and `findBubblePair` are exported for tests. |
| `gfaSubgraphBuilders.ts` | `buildGfaFromEdges` (single-shard adapter, edges always present) and `buildGfaFromPathInference` (sharded adapter, no edge shard). Emit GFA text consumed by the graph view. The sharded variant deliberately has no `edgesLocation` slot in its config — its primary workload is `getMultiPairFeatures` at HPRC scale, where path-inferred adjacency for `getSubgraph` is acceptable. |
| `gfaSeqIO.ts` | Per-ordinal sequence fetch (FASTA tier today; binary 2-bit tier per Phase 1). |

### Setup (`BaseGfaTabixAdapter.setup`)

Header-parse on first call, memoized via `setupP`:

- `pos.bed.gz` header → `genomes`, `sizes`, `paths`, `input-format`.
  `paths=` is preferred; falls back to deriving names from `sizes=` if
  missing. `input-format=walks|paths` selects the GFA emission style for
  `getSubgraph`.
- `bubbles.bed.gz` header (if present) → bubble-side `genomes` list. May
  differ from `pos.bed.gz` `genomes` because VCF samples flatten
  per-haplotype. Routing through the original (pre-`assemblyNameMap`)
  names happens in `bubbleAnnotator.ts`.

### Region query (`fetchSegmentsForRegion`)

1. Resolve `(assemblyName, refName)` → tabix path name. Tries
   `assembly#refName` (PanSN-qualified), then bare `refName`, then walks
   `assemblyNameMap` reverse to find an unmapped name. See
   `resolveTabixRefName`.
2. `posFile.getLines(refPath, start, end)` → raw ordinal ranges parsed by
   `parsePosLineOrdinals`.
3. `mergeOrdinalRanges` collapses adjacent ranges. Coalesced reads happen
   inside `getSegmentsForOrdinalsFromShard` via `MERGE_GAP=65kb` /
   `MAX_MERGED_BYTES=20MB`.
4. `getSegsForOrdinals` (subclass-defined) returns `SegRecord[]` covering
   the ordinal set across *all* paths.

### Comparative-LGV path (`getMultiPairFeatures`)

`getMultiPairFeaturesFromSegments` partitions returned segments by
`pathNameIdx`: one bucket for the ref path, one per other path. For each
other path, `buildFeaturesForPath`:

- Joins ref/other segments by `segOrd` (`refByOrd`).
- Sorts by `refSeg.offset`.
- Walks the matched list, accumulating contiguous runs into a single
  `MultiPairFeature` with a CIGAR string. Discontinuities flush the
  current feature.
- CIGAR ops emitted: `=` (match runs), `D`/`I` (unequal-length gaps), `X`
  (equal-length swaps — SNV-shaped). The X branch is essential for
  bubble-CS overlay: alt-allele samples have *different* segment ordinals
  for SNVs (ref allele = ord 17, alt allele = ord 18, both 1bp), and
  emitting `1D1I` would cause `bubbleOverlay.ts` to drop the bubble's `*xy`
  ops because they fall inside `D` regions.

When `bpPerPx < 50` and a bubbles index is configured,
`annotateFeaturesWithBubbleCs` runs (`bubbleOverlay.ts`):

- Tabix-fetch all rows from `bubbles.bed.gz` overlapping the query
  region. The on-disk row shape is one row per allele pair; the
  parser groups rows sharing `(start, end)` into one `BubbleSite` per
  locus (with `alleleByGenome` and `pairs[alleleLo-alleleHi]` maps)
  and sorts sites by position. The runtime never reads VCF — that's
  preprocessor input only (see `tools/gfa-to-tabix`).
- Per-feature: binary-search the first site whose `end > feat.start`,
  then `buildCsFromCigarAndSites` walks the feature's CIGAR and
  overlapping sites in lockstep. `=` and `X` runs sub-walk into sites;
  `D`/`N`/`I` emit synthetic length-only `-`/`+` ops (renderer reads
  only length, not bases).
- `findBubblePair` resolves which CS applies to a given (refGenome,
  queryGenome) pair: looks up each genome's allele on the site, picks
  the `(min, max)` pair record, flips the CS when refAllele >
  queryAllele. Genome routing uses the bubble-side `#genomes=` list
  with `assemblyNameMap` applied in reverse.

**Why a runtime overlay, not preprocessing?** Two distinct tradeoffs
to keep separate:

- *Per-genome-pair* CS storage would be O(N²) in genome count (90
  genomes → 4 005 rows per site). We don't do that. Genome →
  allele membership is stored once per genome on each site;
  pair-level work is at runtime via `findBubblePair`.
- *Per-allele-pair* CS storage is what `bubbles.bed.gz` actually
  holds — one row per `(alleleA, alleleB)`. For biallelic SNVs
  (the common case) that's 1 row per site; multi-allelic loci
  scale as `C(k, 2)` in allele count, not genome count. The
  preprocessor pre-aligns those allele pairs so the runtime can
  splice the right CS in without re-aligning sequences.

The runtime cost of fetching + grouping + CIGAR-walking is
proportional to viewport size, not genome count or graph size,
because we only annotate features the region query actually
returned. See
`architecture-decision-records/adr-013-bubble-shape-per-pair.md`
for the per-pair vs per-allele tradeoff in detail.

The CS supersedes CIGAR once written: the GPU encoder in
`MultiLGVSyntenyDisplay/features/fill/packGpu.ts` reads `feat.cs` first,
falls back to `parseCigar2(feat.cigar)`. Identity is recomputed from CS
match/total bp.

### Graph-view path (`getSubgraph`)

Used by RPC handler `GetSubgraph` (called from `GraphGenomeView.loadFromTabixSubgraph`).
Returns plain GFA text.

**Coarse tier (regionSize > 100,000 bp).** If `graphCoarseLocation` is
configured, `getSubgraph` routes to `getCoarseSubgraph` which queries
`prefix.graph.coarse.bed.gz` via tabix and returns a flat GFA: one S-line per
super-segment (using `superOrd` as the segment ID and `refEnd - refStart` as
`LN:i`), no L-lines, no W-lines. The graph view renders these as proportional
rectangles. See `GRAPH_COARSE_SYSTEM.md` for the full coarse tier description.

**Detail tier (regionSize ≤ 100,000 bp, or no coarse file configured).**

- Compute `viewportRefOrds` via `collectViewportRefOrds` (helper shared
  with `getEquivalentRanges`): segments on the ref path that overlap
  `[start, end)`.
- If `edgeShard` is configured → `buildGfaFromEdges`:
  - BFS k hops (`context`, default 1) from seed ords through
    `edges.bin` → `allNodeOrds` + canonical L-line set
    (`canonicalLinkKey` de-duplicates bidirected partners).
  - Backfill non-traversed edges between `allNodeOrds`.
  - Re-fetch alt-segment records (`fetchSegments` over merged ord
    ranges) so `computePathSubwalks` sees their per-path positions.
- Else → `buildGfaFromPathInference`:
  - Per non-ref path, find the [firstShared, lastShared] range of
    records sharing ordinals with the viewport, extend outward through
    adjacent alts, emit one subwalk.
  - Infer L lines from path co-traversal (any two adjacent records in a
    subwalk).
- `assembleGfa` writes `H` + `S` + `L` + `P|W` lines. Caps emission at
  `maxPathsEmitted` (default 50k from `GraphGenomeView`); past that
  emit a `# truncated paths:` comment, preserving structure for the
  renderer.

### Audit helper (`getEquivalentRanges`)

C3 path-symmetry probe. Given a viewport on path A, return the
coordinate ranges on each *other* path B, C, … that traverse the same
physical segments. Used by `auditConcordance.test.ts` and the
publication's path-symmetry table.

Returns keys in *unmapped* (file-side) PanSN form (e.g., `GRCh38#0#chr20`).
Callers re-map through `assemblyNameMap` themselves.

## Synteny display: `plugins/linear-comparative-view/src/MultiLGVSyntenyDisplay`

Mirrors `plugins/alignments/src/LinearAlignmentsDisplay` per its
`CLAUDE.md`. Key concepts:

- **Backend interface.** `Backend.sync(sources)` for whole-map upload;
  `renderBlocks(blocks: RenderBlock[], state)` for per-frame draw.
  Block geometry is *not* part of `state`.
- **Pure draw entry.** `drawSyntenyBlocks(ctx, regions, blocks, state)`
  takes any `Ctx2D`. On-screen GPU path wraps it in
  `Canvas2DMultiSyntenyRenderer.renderBlocks`; SVG export wraps with
  `paintLayer`. One source of truth.
- **uint32 genomic positions.** GPU buffers store positions as `uint32`
  attributes. Shaders use `hpSplitUint` + `hpScaleLinear`/`hpClipX` for
  exact float math at 3 Gbp. Never store genomic positions as `float32`.
  See `agent-docs/ARCHITECTURE.md` "BP precision".

### Where bubble CS lands on the GPU

`features/fill/packGpu.ts` `prepareBlockGeometry`:

- For each `MultiPairFeature`, push one `Instance` for the feature body
  (start/end in absolute bp, genomeRow, featureId, color).
- If `showSnps`, run `buildGpuOpsVisitor` over `visitCsOps(feat.cs, …)`
  (preferred) or `visitCigarOps(parseCigar2(feat.cigar), …)`. Each
  mismatch/deletion/insertion op writes one or more additional
  `Instance` records (specialized colors).
- Sort instances by `(genomeRow, startBp)` for rendering order; GPU
  upload happens in `features/fill/uploadGpu.ts`.

`features/mismatch/extract.ts` is the per-mismatch instance writer
(`emitMismatchGpu`). Strand-specific per-base colors come from
`buildColorArrays(colors)`.

### rpcProps() / gpuProps() split

`rpcProps()` method — fields that gate refetch via `SettingsInvalidate`
(refetch when these change). `gpuProps()` method — fields that drive
main-thread encoding only (no RPC roundtrip). The display CLAUDE.md
warns against putting fetch-derived values into `rpcProps()` (causes
infinite-fetch loops).

## Graph view: `plugins/graph/src/GraphGenomeView`

Standalone view that consumes GFA text from any source — uploaded file,
worker output, or RPC `GetSubgraph` from the GFA-tabix adapter.

| File | Role |
|------|------|
| `model.ts` | MST model. `loadGFA` (text), `loadFromTabixSubgraph` (RPC + parse). Holds `graph`, `nodePositions`, `layoutResult`, viewport state. |
| `index.ts` | `ViewType` registration. |
| `components/` | React UI: file picker, graph canvas, hover/select. |
| `../gfa/gfaParser.ts` + `gfaConverter.ts` | GFA text → `Graph` (nodes/edges/paths). |
| `../renderer/GeometryBuilder.ts` | `buildGeometry` packs node/edge/arrow vertices for the GPU. |
| `../renderer/GraphRenderer.ts` | WebGL2/WebGPU draw passes. |

### Bandage-tuned scaling

`loadFromTabixSubgraph` calls `parseAndLayout` with override
`BandageScaleOpts`:

- `nodeLengthPerMegabase: 1_000_000` — 1 unit per bp. Matters for
  pangenome data: with the default 1000 units/Mbp, every <1kb node
  clamps to `minimumNodeLength` and SNPs render at the same visual
  length as multi-kb contigs. The 1:1 scale gives proportional layout.
- `minimumNodeLength: 0.5` — keeps SNP nodes visible at all.
- `nodeSegmentLength: 5` — caps OGDF subnode count per node so FMMM
  layout stays fast.

These overrides are *only* applied for tabix-subgraph loads. Manually
uploaded GFA uses defaults.

### Render path (autoruns inside `installGpuDisplay`)

Two autoruns:

- **upload** — rebuild geometry (`buildGeometry`) when graph data,
  positions, color scheme, thickness, or `viewportDirty` changes.
  `viewportDirty` is debounced (`VIEWPORT_DEBOUNCE_MS=150`) so pan/zoom
  doesn't trigger full geometry rebuilds.
- **render** — re-upload transform uniforms on pan/zoom/darkMode
  without rebuilding geometry. Reads `scale`, `translate*`, `darkMode`.

This split is identical in intent to alignments' `Backend.sync` /
`Backend.renderBlocks` separation.

### Path emission cap

`maxPathsEmitted: 50_000` default. At HPRC chr20 scale, 1 Mbp emits
~219k subwalks and 5 Mbp ~434k. Past ~50k the geometry rebuild stalls
and the user gains no detail; the adapter truncates with a `# truncated
paths:` comment line, the parser preserves graph structure but skips
path overlay.

## Cross-cutting invariants

These hold across the whole pipeline. Violating any of them is a bug.

- **Coordinate convention: absolute genomic uint32 across the worker
  boundary.** Adapter output (RPC return values) carries absolute bp
  positions, not regionStart-relative offsets. GPU shaders use uint32
  attributes + `hpSplitUint` for precision. See
  `agent-docs/ARCHITECTURE.md` "Coordinate convention".
- **CS supersedes CIGAR** for any feature where bubble-CS annotation
  ran. Encoder reads `feat.cs` first; CIGAR is a fallback when CS is
  missing (zoomed-out features, bubbles index unconfigured).
- **CIGAR `X` on equal-length swaps.** `segmentFeatureBuilder.ts`
  must emit `X` (not `D`+`I`) when `refGap === queryGap > 0`. See
  "Fragile boundaries" below — this is the most subtle invariant in
  the bubble-overlay pipeline.
- **`assemblyNameMap` applies to display-side names only.** All tabix
  lookups, bubble routing, and getEquivalentRanges keys use the
  *original* file-side PanSN names. The display→file reverse map is
  built once in `BaseGfaTabixAdapter`'s constructor and consumed by
  `resolveTabixRefName` (region queries) and `annotateFeaturesWithBubbleCs`
  (bubble genome-index lookup) — neither rebuilds it per call.
- **`segments.bin` records are per (segment, path-visit).** A region
  query that pulls ords `[lo, hi]` returns records for *all* paths
  visiting any ord in the range, not just the ref path. Filtering by
  `pathNameIdx` happens in the adapter callers
  (`getMultiPairFeaturesFromSegments`, `collectViewportRefOrds`,
  `getEquivalentRanges`).
- **Path emission is structure-preserving.** Truncating
  `maxPathsEmitted` drops `P`/`W` lines but keeps `S`/`L` lines and
  appends a `# truncated paths:` comment. Renderers detect the comment
  and disable path overlay; structure stays intact.
- **Magic + version on every binary file.** Readers in `gfaBinaryIO.ts`
  validate magic and version on open. New file types must register a
  4-ASCII magic in `GRAPH_INDEX_FORMAT.md`.

## On-disk-shape opportunity (future)

The `bubbles.bed.gz` schema today is *one row per allele pair*, with two
genome-list columns (`genomesA`, `genomesB`). The runtime groups rows
sharing `(start, end)` into per-site records on every region query.
This is fast (linear in returned-row count), but it's also pure
preprocessing: the same grouping yields the same per-site shape every
time.

A cleaner v2 schema would emit one row per *site*, with the per-pair
CSs and per-genome alleles already grouped:

```
path | start | end | alleleByGenome (compact) | pairs (cs;identity per allele-pair)
```

This would let the runtime parser instantiate `BubbleSite` directly,
deleting `parseBubbleLine` + the row-grouping pass from
`bubbleOverlay.ts`. **Not worth changing pre-publication** — the
runtime grouping is sub-millisecond at HPRC chr20 scale, and the
schema bump would invalidate every fixture in `prepare-fixtures.sh`.
Worth doing the next time the bubbles schema changes for any other
reason. The Rust preprocessor (`tools/gfa-to-tabix`) already has the
site grouping internally, before it splits to one row per pair on
emit; emitting per-site is a `~20-line` change.

## Fragile boundaries

These are places where two pieces of code coordinate through an
implicit contract — usually a CIGAR character choice, an ordering
convention, or a name-routing lookup — and where breaking the
contract produces silent data loss rather than a loud failure.
Listed here so they don't have to be re-derived from the bug report
the next time a regression slips through.

### `segmentFeatureBuilder` ↔ `bubbleOverlay`: the X contract

**Contract.** When two consecutive matched segments differ between
ref and other path *and* the ref-side gap equals the other-side gap
(`refGap === queryGap > 0`),
`segmentFeatureBuilder.ts:buildFeaturesForPath` emits a CIGAR `X` run
of that length. Unequal-length gaps emit `D` and/or `I`.

**Why the contract exists.** `bubbleOverlay.ts:buildCsFromCigarAndSites`
sub-walks bubble sites *only inside `=`/`M`/`X` runs*. `D`/`N`/`I`
runs emit synthetic length-only `-`/`+` placeholder ops, and any
bubble sites overlapping those CIGAR ops are intentionally skipped
(the bubble CS describes ref bp the alt path doesn't carry). For an
equal-length swap (the SNV-shaped case), the right behavior is to
treat it as a mismatch run that bubble sites can overlay.

**What breaking it looks like.** If `segmentFeatureBuilder` emits
`1D 1I` instead of `1X` for a 1bp swap, the bubble's `*xy` op falls
inside the `D` run. `consumeSitesWithin` is never called there;
the `*xy` is silently dropped. The user sees a feature with no
mismatches at all even though the bubble is present in the index.
This was the SNP-disappearance regression on alt-allele samples;
fix and detail in `git log -- segmentFeatureBuilder.ts bubbleOverlay.ts`.

**What guards it.**
`buildCsFromCigarAndSites.test.ts` ("treats X like = so bubble pair
CS overlays alt-allele SNVs", "falls back to `:N` for X runs without
bubble coverage"). Any change to `segmentFeatureBuilder.ts`'s gap
handling or to `bubbleOverlay.ts`'s op dispatch must keep these
tests green.

**When to revisit.** If we ever stop sub-walking inside `=` runs
(e.g., a future "structural-only" rendering tier), this contract
goes away with it. As long as the runtime overlays per-base detail
inside matched runs, the contract has to hold.

### `assemblyNameMap` direction

**Contract.** `assemblyNameMap` is a *display-side rename* —
"file-side `GRCh38#0` shows up in the UI as `hg38`". Every tabix
lookup, every `genomesA`/`genomesB` index resolution, and every
`getEquivalentRanges` key uses the **original file-side** name.
Mapped (display) names are only used at the boundary — when the
synteny display passes a `displayedRegion.assemblyName` into
`getMultiPairFeatures`, the adapter reverse-maps it to the
file-side name before opening tabix.

**Why the contract exists.** Tabix file headers (`#genomes=`,
`#paths=`, `#sizes=`) are produced by the preprocessor, which never
sees the user's display preferences. If the runtime applied the
forward map before tabix lookup, every lookup would miss.

**What breaking it looks like.** Tabix returns no rows; bubbles
silently disappear; `getEquivalentRanges` returns an empty map.
None of these throw — the user just sees nothing.

**What guards it.** Indirect: the audit harness
(`auditConcordance.test.ts`) compares against `vg find` and
`chunkix.py`, both of which use file-side names. Drift on the map
direction shows up as a concordance miss.

### `BubbleSite` allele-pair key encoding

**Contract.** `BubbleSite.pairs` is keyed by `${lo}-${hi}` where
`lo = Math.min(alleleA, alleleB)` and `hi = Math.max(...)`.
`findBubblePair` does the same `(min, max)` swap on lookup, then
applies `flipCs` when `refAllele > queryAllele`.

**Why the contract exists.** A bubble row's CS direction is from
`alleleA` to `alleleB` *as written*. Without the canonicalization,
the lookup for `(refAllele=1, queryAllele=0)` would miss when the
preprocessor stored `(alleleA=0, alleleB=1)`.

**What guards it.** `findBubblePair.test.ts` covers both the
straight and flipped paths; `flipCs` correctness is in
`csUtils.ts`'s implicit contract (any change to `flipCs` semantics
needs a test, since this is the only consumer that hits non-trivial
cases like `+seq → -seq`).

### `build_synteny` path pairing: ordinals, not chromosome names

**Contract.** In `tools/gfa-to-tabix/src/main.rs`, `build_synteny` pairs
haplotype paths to reference paths by calling `align_pair` for every
(ref_path, hap_path) combination. `align_pair` decides relatedness through
*shared graph ordinals* — it returns empty for pairs with no ordinal
intersection, which is fast. Grouping paths by chromosome name before calling
`align_pair` is wrong.

**Why the contract exists.** "Same chromosome name" is a valid proxy for
"same genomic region" only for reference-quality assemblies that follow the
reference naming convention. HPRC haplotype assemblies name their contigs
with assembly-specific identifiers (`HG00438#1#JAHBCB010000023.1`) that do
not match the reference chromosome name (`chr20`). If paths are grouped by
the last `#`-token in their PanSN name before pairing, every such contig
lands in its own group with no reference path, and is silently dropped.
CHM13 was the only non-reference assembly that survived the old approach
because its contigs were explicitly named `chr*` — same tokens as GRCh38.

**What breaking it looks like.** At 90-genome HPRC chr20 scale, 88 of 90
non-reference haplotypes are silently absent from `synteny.bed.gz`. CHM13
appears; all HG/HG-like assemblies do not. No error is emitted.

**What guards it.** `synteny_cross_chrom_hprc_style` in `main.rs` asserts
that a path named `HG00438#1#JAHBCB010000023.1` — sharing graph ordinals
with the reference but not its chromosome name — appears in the output.

**When to revisit.** If `build_synteny` ever adds a pre-filter for
performance (e.g., skip hap paths whose ordinal sets cannot overlap a given
reference path), that filter must still be ordinal-based, not name-based.

### `BaseGfaTabixAdapter` abstraction

**Contract.** `BaseGfaTabixAdapter` is abstract on exactly one method:
`getSegsForOrdinals(ranges)`. Two implementations exist —
`GfaTabixAdapter` (one segments shard) and `ShardedGfaTabixAdapter`
(per-genome shards, queried in parallel).

**Why the contract exists.** Single-shard reads pay a single network
round-trip for a contiguous record range; sharded reads scale to
HPRC-pangenome size by parallelizing across shards. Everything else
(setup, region partition, bubble overlay, subgraph emit) is
strategy-independent and lives in the base class.

**What breaking it looks like.** Collapsing the abstract class into
one concrete class would force per-call branching on shard topology
inside the region-fetch path; merging the configs would expose
sharded-only fields to single-shard users. Keep them separate.

**When to revisit.** If a third storage strategy emerges (cloud
object-store with native range-fetch, in-memory test fixture, etc.)
the seam is in the right place — add a new subclass. If the sharded
variant ever gains an edges layer, `buildGfaFromPathInference` becomes
deletable and `getSubgraph` becomes single-strategy.

## Test infrastructure

- `auditConcordance.test.ts` — C1/C2/C3 acceptance: subgraph extraction
  vs `vg find` and `chunkix.py`. Runs against fixtures in
  `test_data/volvox/gfa-tabix/` and HPRC-derived fixtures.
- `getSubgraph.test.ts` — adapter-internal correctness for both edge
  and path-inference builders.
- `buildCsFromCigarAndSites.test.ts` — bubble-CS overlay path,
  including the X-run regression (alt-allele SNVs were silently
  dropped before the X path was added).
- `findBubblePair.test.ts` — allele-pair routing with CS flip.
- `gfaSeqIO.test.ts` — sequence fetch correctness.
- `parseSegmentsBytes.bench.test.ts` — record-parse perf benchmark.
- `GfaTabixAdapter.test.ts` — top-level adapter surface
  (`getMultiPairFeatures`, `getSources`, `getChromSizes`,
  `getEquivalentRanges`).

`agent-docs/TEST_INFRASTRUCTURE.md` documents the full 26-suite test
matrix used in CI.

## When something goes wrong

- **No SNPs visible in synteny display.** Verify `feat.cs` is
  populated. Check `bpPerPx < 50` gate in
  `getMultiPairFeaturesFromSegments`. If alt-allele samples specifically
  show zero mismatches, suspect the X-CIGAR path in
  `segmentFeatureBuilder.ts` (regression: emitting `D`+`I` instead of
  `X` for equal-length swaps).
- **Path-symmetry table mismatches.** Check `assemblyNameMap` reverse
  lookup in `getEquivalentRanges`; keys must be unmapped (file-side)
  PanSN names.
- **Most haplotypes absent from synteny output.** If only reference-style
  assemblies (CHM13, GRCh38) appear in `synteny.bed.gz` while HPRC haplotypes
  are missing, `build_synteny` is grouping by chromosome name instead of
  pairing via `align_pair` ordinal intersection. See "Fragile boundaries —
  `build_synteny` path pairing".
- **Graph view stalls on load.** Check `maxPathsEmitted` cap; HPRC
  chr20 past ~5 Mbp blows through 50k subwalks. Lower the cap or
  shrink the region.
- **Wrong sequences in graph view.** Ord routing in `gfaSeqIO.ts`;
  `seqShard.idxFile` must agree on (magic, version) with the
  segments index. Magic mismatch error is loud; silent corruption
  means a non-versioned override slipped in.
