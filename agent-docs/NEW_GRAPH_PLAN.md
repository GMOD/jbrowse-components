# New Pangenome Browser Plan

## Why we are changing course

The existing GFA tabix format (`segments.bin` / `edges.bin` / ordinal-keyed binary) has
a structural flaw that cannot be patched: segment ordinals are assigned in
reference-path-traversal order, so alt/bubble segments for a genomic viewport are
scattered across a ~1.3 GB file. A 0.69 Mbp chr20 viewport produces 784 HTTP ranges
(5500 ms on S3 vs 84 ms local — 65×). Increasing the merge gap does not help because
the ranges span the whole file; the only real fix is reorganizing the format from scratch.
Rather than do that, we are switching to a system with proven UX quality: pangyplot's
polychain LOD architecture, adapted for browser-native static-file deployment.

## Architecture overview

```
Index build (one-time, ~2–3 h for chr20):
  GFA
  ├─→ odgi convert → .og
  │    └─→ odgi layout   → segments.layout.tsv   (x,y per node)
  ├─→ [keep] sort | bgzip | tabix → pos.bed.gz   (all haplotype paths, subgraph use)
  ├─→ [keep] vg deconstruct → bubbles.bed.gz     (per-base CS detail)
  ├─→ Rust: synteny block walk  → synteny.bed.gz + synteny.rev.bed.gz  ← LINEAR VIEW
  ├─→ Rust: polychain decomposition              → polychain/{meta,chains,decomp/}
  ├─→ Rust: static tile precomputation           → tiles/{0,1,2,3}/{n}.json.gz
  ├─→ Rust: skeleton + spine                     → skeleton.json.gz, spine.{ref}.json.gz
  └─→ Rust: sequence index                       → seq.fa.gz + seq.fa.gz.fai

Browser:
  MultiLGVSyntenyDisplay → tabix synteny.bed.gz   → synteny blocks (NO binary lookups)
  Overview LOD           → fetch tiles/{zoom}/{n}.json.gz → polyline renderer
  LOD switch             → bpPerPx threshold → pick zoom level
  Reference-free         → query synteny.rev.bed.gz in haplotype coordinates
  Subgraph popup         → pos.bed.gz + seq.fa.gz → GFA → OGDF WASM Bandage layout
```

No server. Everything is a static file fetch.

## What survives

| File / component | Why kept |
|---|---|
| `pos.bed.gz` + `.tbi` | Tabix coordinate index for ALL haplotype paths; correct and efficient for subgraph extraction; multi-reference browsing already works via path-name query |
| `bubbles.bed.gz` + `.tbi` | Variant annotation pipeline is orthogonal; keep as-is |
| `plugins/graph` OGDF WASM | Bandage layout already works for subgraph popup; no changes needed |
| `tools/graph-truth-extractor/` | Concordance oracle; only needs to keep the `vg` backend; others can be retired |
| `auditConcordance.test.ts` (vg-only tests) | Only the tests that validate pos.bed.gz / subgraph extraction are worth keeping |

## What is deleted

All of this goes when the new system is working. Delete eagerly — do not keep
"just in case" copies.

**Adapter code:**
- `gfaBinaryIO.ts` — reads segments.bin / edges.bin
- `gfaSubgraphBuilders.ts` — builds GFA from binary ordinal records
- `gfaCoarsener.ts` — runtime coarsener (replaced by precomputed tiles)
- `gfaEmitHelpers.ts` — helpers for the binary builders
- `gfaSeqBinaryIO.ts` — 2-bit sequence reader
- `gfaSeqIO.ts` — FASTA sequence reader (replaced by seq.fa.gz + fai)
- `segmentFeatureBuilder.ts` — builds synteny features from SegRecords
- Most of `gfaTabixUtils.ts` — the 500-line segment-fetch / BFS / path dispatch logic

**Tests for deleted code:**
- `gfaCoarsener.test.ts`
- `gfaSeqBinaryIO.test.ts`
- `gfaSeqIO.test.ts`
- `parseSegmentsBytes.bench.test.ts`
- `getSubgraph.test.ts` (replace with new tile tests)
- `auditConcordance.test.ts` — retire after new concordance story is written

**Rust preprocessor outputs (remove emission code):**
- `segments.bin` / `segments.idx`
- `edges.bin` / `edges.idx`
- `segments.seq.fa` / `.fai` / `.idx`
- `segments.seq.bin` / `.bin.idx`

**Scripts:**
- `scripts/diagnose-fetch.ts`
- `scripts/diagnose-http.ts`
- `scripts/dump-subgraph.ts`
- `scripts/equivalent-ranges.ts`
- `scripts/path-symmetry.ts`
- `scripts/lib/auditShard.ts`

**S3 files** — after new indexes are built, delete the old chr20 index files from
`s3://jbrowse.org/demos/gfadata/`. Do not upload new and old side by side.

## Two distinct views, two distinct data sources

The system must serve two fundamentally different visualizations:

| View | What it shows | Data needed |
|---|---|---|
| **MultiLGVSyntenyDisplay** (linear) | Haplotype lanes aligned to a reference; colored synteny blocks | Per-block: refStart, refEnd, hapStart, hapEnd, mateRefName, strand, identity |
| **Graph view** (2D LOD) | Pangenome as a spatial graph with polyline paths | odgi layout coords + polychain tiles |

The old `segments.bin` tried to serve both from one format and failed at both (range
explosion for the linear view; no 2D layout for the graph view). The new system has
a dedicated file for each.

## New index format

### `prefix.synteny.bed.gz` + `.tbi` (NEW — serves MultiLGVSyntenyDisplay)

Pre-computed synteny alignment blocks for every haplotype vs. the reference assembly.
One BED row per alignment block (a maximal run of co-linear shared segments between
two paths):

```
refChrom  refStart  refEnd  hapChrom  hapStart  hapEnd  strand  identity
GRCh38#0#chr20  1000  5000  HG002#0#chr20  1000  5100  +  0.994
GRCh38#0#chr20  5000  5001  HG002#0#chr20  5100  5200  +  0.41
```

- Tabix-indexed by `(refChrom, refStart, refEnd)`.
- All 90 haplotypes in one file. One tabix query for a viewport returns blocks for
  every haplotype at once.
- `identity`: fraction of shared bases in the block (derived from path co-traversal;
  for bubble spans this is the alt/ref sequence identity from bubbles.bed.gz CS).
- No segment ordinals anywhere — only genomic coordinates.

**Build-time computation (Rust):** walk the reference path; for each segment, find
every other haplotype's row in pos.bed.gz and record its coordinate. Group consecutive
co-linear segments into blocks; emit a BED row per block. Bubbles (segments not on
the reference path) produce a block with a gap on the reference side and an insertion
on the haplotype side.

**Browser adapter:** replace `BaseGfaTabixAdapter`'s segment-fetch + feature-build
pipeline with a single tabix query on `synteny.bed.gz`. The result is a map of
`hapChrom → Feature[]` ready for `MultiLGVSyntenyDisplay` with zero binary lookups.

**Reference-free browsing:** emit a second file indexed by haplotype coordinates —
`prefix.synteny.rev.bed.gz` — where the haplotype is the tabix chromosome. Switching
the reference path then queries the `.rev` file instead of the `.fwd` file. This
covers goal (a) without any architectural complexity.

**Per-base CS detail:** `bubbles.bed.gz` continues to provide CS strings at high
zoom (bpPerPx < 100). No change to the bubble pipeline.

Expected footprint for chr20 (90 haplotypes, ~500 bp average block):
~11.5M records × 60 bytes raw → ~70–140 MB bgzip-compressed. One tabix
query for a 1 Mbp viewport: ~10–50 KB response per haplotype.

### `prefix.pos.bed.gz` (unchanged)

Keep exactly as-is. Tabix-indexed, all haplotype paths as separate chromosomes.
Used for subgraph extraction (Bandage popup) only, not for the linear synteny view.
Query with `HAPNAME#hap#contig:start-end` for ordinal lookups.

### `prefix.segments.layout.bin`

odgi layout output, re-encoded as a compact binary.

- 8-byte header: magic `LAYB` + version `u32`.
- N records of 12 bytes: `nodeId:u32 | x:f32 | y:f32`.
- Sorted by nodeId for binary search.

This is the canonical X/Y position for every segment in the graph.
The Y axis separates haplotype paths (pangyplot-style path lanes).

### `prefix.polychain/`

Directory emitted by the Rust polychain builder (ported from pangyplot's
`PolychainIndex.py`).

- `meta.json` — `{version, chainCount, xMin, xMax, chromosome}`
- `chains.bin` — packed `[chainId:u32, x1:f32, x2:f32]` records; sorted by x1 for
  bisect-based spatial queries (mirrors pangyplot's mmap'd numpy arrays)
- `decomp/{chainId}.json.gz` — per-chain decomposition: sub-chains, bypass links,
  bubble membership. Exact schema mirrors pangyplot's decomp format (keep compatible
  so pangyplot's Python tooling stays usable as an oracle).

### `prefix.tiles/{zoom}/{tileIdx}.json.gz`

Pre-run the pangyplot `/detail-tiles` BFS for every fixed-grid slot and store the
response as gzip'd JSON. The Rust tile emitter partitions the layout X range into
fixed-width tiles at each zoom level and runs the chain-culling + junction-graph
construction once per slot.

Zoom levels (tunable):
- Level 0: full resolution, tile width = 1 Mbp equivalent in layout units
- Level 1: 10×, tile width = 10 Mbp equivalent
- Level 2: 100×, tile width = 100 Mbp equivalent
- Level 3: skeleton (one tile per chromosome)

Tile payload schema (same as pangyplot's `/detail-tiles` response so the rendering
code can be ported directly):
```json
{
  "chains": [{"id":…, "polyline":[[x,y],…], "depth":…}],
  "bubbles": [{"id":…, "x1":…, "x2":…}],
  "bypass_links": [[segA, segB], …],
  "segments": [{"id":…, "x":…, "y":…, "len":…}]
}
```

Expected footprint for chr20 (64 Mbp, 90 haplotypes):
~192 tiles × ~2 MB compressed ≈ **~384 MB** for the tile set.
Total index including layout + polychain + pos.bed.gz ≈ 900 MB.
This replaces the 1.79 GB old index while being spatially addressable.

### `prefix.skeleton.json.gz`

Single-tile full-chromosome view. Used for the initial load and deepest LOD.

### `prefix.spine.{ref}.json.gz`

Reference path spine: array of `[layoutX, genomicBp, laneY]` triples for the
chosen reference assembly. Enables genomic-coordinate ↔ layout-coordinate mapping
in the browser. Emit one per assembly present in the GFA.

### `prefix.seq.fa.gz` + `prefix.seq.fa.gz.fai`

Per-segment FASTA, bgzip-compressed, samtools-faidx indexed. Used only for
subgraph GFA extraction (the Bandage popup). Simpler than the old SEQB binary tier;
range-fetch individual sequences by faidx offset when a subgraph popup is requested.
Sequence lookup happens once per popup, not on every overview render, so the
plaintext BGZF tier is fine.

## Build pipeline changes

`tools/gfa-to-tabix/src/main.rs` becomes the entry point for the full new pipeline.
Additions (in order of execution after the existing pos.bed.gz / bubbles pass):

```
1. odgi convert <input.gfa> -o <tmp.og>
2. odgi layout <tmp.og> -o <tmp.lay> [--threads N]
3. parse tmp.lay → emit prefix.segments.layout.bin
4. synteny_build(pos.bed.gz, ref_assembly) → emit prefix.synteny.{fwd,rev}.bed.gz
5. polychain_build(layout, graph) → emit prefix.polychain/
6. tile_build(polychain, zoom_levels) → emit prefix.tiles/
7. skeleton_build(polychain) → emit prefix.skeleton.json.gz
8. spine_build(pos.bed.gz, layout) → emit prefix.spine.{ref}.json.gz
9. emit prefix.seq.fa.gz (bgzip of per-segment FASTA, one record per segment)
```

Steps 4–8 are Rust. Steps 1–2 shell out to odgi (same pattern as existing vg
shellout). Step 4 (`synteny_build`) is the highest-priority new piece — it is what
unblocks MultiLGVSyntenyDisplay and can be built and tested before odgi layout
is integrated (it only needs pos.bed.gz as input).

Remove from `main.rs`: all `sort_and_build_segments`, `build_edge_index`,
`write_segments_seq_fa`, `write_segments_seq_bin` and related helpers.

## Browser rendering

### New: polyline LOD renderer

A new JBrowse rendering component (in `plugins/comparative-adapters` or a new
`plugins/pangenome` plugin) that:

- On mount / viewport change: computes tile coordinates, fetches 1–3
  `tiles/{zoom}/{n}.json.gz` files
- Renders chains as smooth polylines (pangyplot visual model)
- LOD switch: bpPerPx crosses threshold → fetch the next zoom level's tiles
- Uses the existing canvas/WebGL pipeline for actual drawing

This replaces `MultiLGVSyntenyDisplay`'s current segment-feature-based rendering.

### Existing: OGDF WASM Bandage popup (no changes)

`plugins/graph/src/layout/GraphComputeLayout.ts` stays exactly as-is.
The subgraph popup flow:
1. User right-clicks a region or bubble in the LOD view
2. Adapter queries `pos.bed.gz` for overlapping segment IDs
3. Fetches sequences from `seq.fa.gz` via faidx byte ranges
4. Assembles minimal GFA string
5. Passes to `GraphComputeLayout` RPC → OGDF WASM → layout result
6. Existing graph renderer draws it

### Multi-reference browsing

`pos.bed.gz` already indexes all 90 haplotype paths as separate tabix chromosomes.
The adapter only needs a `referencePath` parameter passed to the tabix query.
UI: a path selector dropdown populated from the `#paths=` header.

## Phased execution

### Phase 1 — Delete old code + stub adapter

Delete all files listed in "What is deleted." The adapter package will not compile
until Phase 2 wires the new adapter. That is intentional.

Keep: `configSchema.ts`, `index.ts` (stubs), `bubbleOverlay.ts`,
`buildCsFromCigarAndSites.test.ts`.

### Phase 2 — `synteny_build`: precomputed synteny blocks (HIGHEST PRIORITY)

This is the first concrete deliverable. It requires only `pos.bed.gz` as input —
no odgi, no layout, no tiles. It unblocks MultiLGVSyntenyDisplay immediately.

In `main.rs`:
1. Walk the reference path's rows in `pos.bed.gz` (in-memory after parse).
2. For each segment ordinal on the reference, collect all other paths' rows
   sharing that ordinal.
3. Group consecutive co-linear segments into blocks. Emit one BED row per block.
4. bgzip + tabix the output as `prefix.synteny.bed.gz`.
5. Emit `prefix.synteny.rev.bed.gz` with haplotype coordinates as the tabix key.

New adapter (`SyntenyBedAdapter` or replace `BaseGfaTabixAdapter`'s feature path):
tabix query `synteny.bed.gz` → parse rows → return `MultiPairFeature[]` keyed by
`hapChrom`. No binary lookups. No BFS. No ordinal resolution.

Smoke test: run on volvox, verify synteny blocks match the old adapter's output
for the same region. Then re-index chrM and spot-check.

### Phase 3 — odgi layout integration

Wire `odgi layout` into the Rust preprocessor. Emit `segments.layout.bin`.
Smoke test on volvox: verify (x,y) coordinates are sane (reference path should
produce a roughly horizontal left-to-right trajectory).

### Phase 4 — Polychain decomposition (Rust port)

Port pangyplot's `PolychainIndex.py` to Rust. Use pangyplot's Python output as the
correctness oracle: run both on the same fixture, assert chain bounding boxes and
decomp structures match. Target: volvox → chrM → chr20.

### Phase 5 — Static tile precomputation

Port pangyplot's `/detail-tiles` BFS to Rust, run for every fixed tile slot.
Verify tile payloads match pangyplot's live endpoint.
Re-index chr20, upload new static files to S3, delete old ones.

### Phase 6 — New polyline LOD renderer

New JBrowse rendering component: fetches tiles, renders polyline chains, handles
LOD transitions. Wire multi-reference path selector to `synteny.rev.bed.gz`.

### Phase 7 — Subgraph popup integration

Wire Bandage popup to `pos.bed.gz + seq.fa.gz → GFA → OGDF WASM`.

### Phase 8 — Paper figure

LGV linear view (synteny blocks from Phase 2) → polyline LOD graph view
(Phase 6) → Bandage popup drill-down (Phase 7).

## New correctness claims

The old concordance story (`auditConcordance.test.ts` + vg-find comparison) is
retired. The new correctness story:

- **Synteny fidelity**: for any reference viewport, `synteny.bed.gz` blocks cover the
  same genomic span and strand assignments as the old `getMultiPairFeaturesFromSegments`
  output on the same region (old adapter as oracle, run during migration only).
- **Synteny totality**: union of all block spans on the reference path equals the
  reference chromosome length (no gaps, no overlaps on the reference side).
- **Tile fidelity**: for any viewport, the tile response contains the same chain set
  as pangyplot's live `/detail-tiles` endpoint on the same fixture (pangyplot Python
  as oracle).
- **Subgraph correctness**: for any bubble region, the GFA produced by pos.bed.gz
  lookup + seq.fa.gz is structurally identical to `vg find` output (existing vg
  concordance test, rewritten for the new extraction path).
- **Layout stability**: `segments.layout.bin` coordinates are a deterministic function
  of the odgi version + input graph (regression test: hash the coordinate file).

## Open questions

- **odgi version pin**: need to pin odgi like we pin vg. Find the current stable
  release and document in `tools/gfa-to-tabix/README.md`.
- **Polychain algorithm fidelity**: pangyplot's PolychainIndex is ~400 lines of
  Python with several tuning constants (CANONICAL_EXPAND_THRESHOLD, RDP epsilon,
  etc.). Port carefully with the Python output as oracle rather than guessing at
  the constants.
- **Tile boundary artifacts**: pangyplot's tiles are viewport-driven (continuous);
  fixed-grid tiles have boundary effects where a chain straddles two tiles. The
  renderer must merge adjacent tiles for chains that cross boundaries. Resolve
  during Phase 5.
- **seq.fa.gz access pattern**: faidx random access over BGZF is efficient for
  individual records but pangyplot does batch lookups. If Bandage popup latency is
  high, consider a compact binary sequence tier (the old SEQB format is already
  proven; could be re-introduced for this purpose only).
- **bubbles.bed.gz dependency on ordinals**: confirmed safe — `bubbleOverlay.ts`
  parses BED rows by `(start, end)` genomic coordinates only. No segment ordinals
  are referenced. The bubble pipeline requires no changes.
