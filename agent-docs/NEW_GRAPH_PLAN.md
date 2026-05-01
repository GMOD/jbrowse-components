# New Pangenome Browser Plan

## Problem

`segments.bin` / `edges.bin` are ordinal-keyed binary files. Alt/bubble segments
for any genomic viewport are scattered across a ~1.3 GB file, producing 784 HTTP
byte-ranges for a 0.69 Mbp query (5500 ms on S3, 65× slower than local). The
format cannot be fixed incrementally; we replace it entirely.

**Zero odgi dependency.** pangyplot's tile system requires odgi SGD layout
coordinates (`layout_min_x / layout_max_x`), which are topology-optimised and
not reference-anchored. We need reference coordinates throughout.

---

## Two views, one index

### MultiLGVSyntenyDisplay — linear genome view (all zoom levels)

Feature contract (audited from source):
```
start, end          — reference coordinates (uint32)
mateStart, mateEnd  — haplotype coordinates (uint32)
mateRefName         — haplotype path name
strand              — +1 / -1
identity            — 0–1 float, precomputed offline
cigar / cs          — optional, bpPerPx < 100 only (from bubbles.bed.gz)
```

### GraphGenomeView — Bandage-style graph (≤ 100 kbp regions)

Accepts a GFA string → OGDF WASM layout → WebGL2/WebGPU/Canvas2D render.
For regions > 100 kbp, OGDF stalls (≥ 50k subwalks at HPRC density).
The large-region path renders synteny blocks in reference coordinate space —
same data as MultiLGVSyntenyDisplay, different canvas — so users can zoom out
without leaving the graph view.

---

## Index (one-time build, ~1 h for chr20)

```
GFA — single path-replay pass in main.rs:
  ├─→ sort|bgzip|tabix  → pos.bed.gz               all paths (own-coord chunks)
  ├─→ sort|bgzip|tabix  → synteny.bed.gz            haplotype blocks vs. ref
  ├─→ sort|bgzip|tabix  → synteny.rev.bed.gz        same, hap-coord key
  ├─→ sort|bgzip|tabix  → synteny.coarse.bed.gz     merged blocks (>10 kbp gap)
  ├─→ sort|bgzip|tabix  → edges.spatial.bed.gz      bidirectional edge index
  ├─→ [keep] vg deconstruct → bubbles.bed.gz        per-base CS detail
  └─→ bgzip             → seq.fa.gz + .fai           segment sequences
```

| File | Size (chr20) | Feeds |
|---|---|---|
| `pos.bed.gz` | ~50 MB (unchanged) | GetSubgraph ordinal lookup |
| `bubbles.bed.gz` | ~30 MB (unchanged) | Per-base CS detail |
| `synteny.bed.gz` | ~70–140 MB | MultiLGVSyntenyDisplay + GGV large mode + GetSubgraph hap coords |
| `synteny.rev.bed.gz` | ~70–140 MB | Reference-free browsing |
| `synteny.coarse.bed.gz` | ~5–15 MB | Chromosome-scale views |
| `edges.spatial.bed.gz` | ~40–80 MB | GetSubgraph L-lines |
| `seq.fa.gz` + `.fai` | ~25 MB | GetSubgraph sequences |
| **Total** | **~290–480 MB** | replaces 1.79 GB old index |

---

## Browser query paths

**MultiLGVSyntenyDisplay**
```
bpPerPx > 1000  → tabix synteny.coarse.bed.gz
bpPerPx ≤ 1000  → tabix synteny.bed.gz
bpPerPx < 100   → + tabix bubbles.bed.gz
ref-free        → tabix synteny.rev.bed.gz
```

**GraphGenomeView — small mode (region ≤ 100 kbp)**
```
1. tabix pos.bed.gz refChrom:[A,B]          → reference ordinals
2. tabix synteny.bed.gz refChrom:[A,B]      → (hapChrom, hapStart, hapEnd) per haplotype
3. tabix pos.bed.gz hapChrom:[hapStart,hapEnd]  ← parallel, one per haplotype
                                            → all ordinals including alt/bubble segments
4. tabix edges.spatial.bed.gz refChrom:[A,B] → L-lines (all four edge types)
5. faidx seq.fa.gz per unique ordinal        → sequences
6. assemble GFA string → OGDF WASM → render
```
90 parallel haplotype fetches (step 3) each return one HTTP range. Total: 93
range requests vs. 784 with the old approach.

**GraphGenomeView — large mode (region > 100 kbp)**
```
tabix synteny.bed.gz (or synteny.coarse.bed.gz if bpPerPx > 1000)
  → render synteny blocks as coloured rectangles in reference coordinate space
    (x = ref bp, y = path index)
  → reuse existing WebGL2/WebGPU/Canvas2D renderer; only geometry source changes
```

---

## What is deleted

Once Phase 2 is verified. No copies kept.

**TS files:** `gfaBinaryIO.ts`, `gfaSubgraphBuilders.ts`, `gfaCoarsener.ts`,
`gfaEmitHelpers.ts`, `gfaSeqBinaryIO.ts`, `gfaSeqIO.ts`, `segmentFeatureBuilder.ts`,
bulk of `gfaTabixUtils.ts` (keep pos.bed.gz helpers and `parseGfaPathName`).

**Tests:** `gfaCoarsener.test.ts`, `gfaSeqBinaryIO.test.ts`, `gfaSeqIO.test.ts`,
`parseSegmentsBytes.bench.test.ts`, `getSubgraph.test.ts`, `auditConcordance.test.ts`.

**Scripts:** `diagnose-fetch.ts`, `diagnose-http.ts`, `dump-subgraph.ts`,
`equivalent-ranges.ts`, `path-symmetry.ts`, `lib/auditShard.ts`.

**Rust (main.rs):** `sort_and_build_segments`, `build_edge_index`,
`write_segments_seq_fa`, `write_segments_seq_bin`.

**Kept:** `bubbleOverlay.ts`, `configSchema.ts`, `index.ts`,
`buildCsFromCigarAndSites.test.ts`.

---

## Test fixtures

Committed to `tools/gfa-to-tabix/tests/fixtures/` and
`plugins/gfa-tabix/src/__tests__/fixtures/`. Never use chr20 data in unit tests.

**`linear.gfa`** — A+B+C+D+E, one identical haplotype. Expected: one block,
identity=1.0, no bubble rows.

**`bubble.gfa`** — A-[B|C]-D: ref through B, alt through C. Expected: two shared
blocks + two bubble rows. GetSubgraph must return S-lines for both B and C.

**`inversion.gfa`** — ref A(+)B(+)C(+), alt A(+)B(-)C(+). Expected: middle
block strand=`-`, flanking blocks strand=`+`.

**`insertion.gfa`** — ref A-C, alt A-B1-B2-B3-C. Expected: bubble span with
hapLen > refLen. GetSubgraph must include S-lines for B1, B2, B3.

**`multipath.gfa`** — three haplotypes, two bubbles. Tests per-pair independence.

**`volvox_chr1_0-50k`** — pre-indexed new-format bgzip+tabix files, committed.
Used for integration and browser tests without re-running the build pipeline.

---

## Phases

### Phase 1 — Delete old code

Delete everything above. Build will fail until Phase 2.

**Verification:**
- `pnpm tsc --noEmit` in `plugins/gfa-tabix` fails on deleted symbols only.
- `grep -r "gfaBinaryIO\|segmentFeatureBuilder\|gfaSubgraphBuilders" plugins/gfa-tabix/src` → zero results.

---

### Phase 2 — `synteny_build` + MultiLGVSyntenyDisplay adapter

Add synteny emission to `main.rs` alongside the existing pos.bed.gz pass.
New adapter: one tabix query on `synteny.bed.gz` → `MultiPairFeature[]` grouped
by `mateRefName`. Zero binary lookups.

**Rust tests** (`tools/gfa-to-tabix/src/tests/synteny_build.rs`):

- **`linear_full_coverage`** — merge output ref-intervals; assert merged length = reference length.
- **`bubble_spans`** — assert exactly 4 rows (2 shared + 2 bubble); no overlaps.
- **`inversion_strand`** — assert middle block strand=`-`, flanking strand=`+`.
- **`insertion_identity`** — assert identity ≈ `min/max(refLen, hapLen)` within 0.001.
- **`multipath_independence`** — assert no block for path A appears in path B's rows.
- **`edges_count`** — assert `edges.spatial.bed.gz` row count = 2 × GFA L-line count.
- **`edges_bidirectional`** — for `bubble.gfa`, a tabix query on the ref-side bubble span must return ref→alt AND alt→ref edges. All four edge types reachable.
- **`coarse_merges_small_gap`** — 5 kbp gap → one merged row in coarse.
- **`coarse_keeps_large_gap`** — 15 kbp gap → two separate rows in coarse.
- **`coarse_identity_weighted`** — length 1000 (0.9) + length 2000 (0.8) merged → identity ≈ 0.833 within 0.001.
- **`rev_key_matches`** — every synteny.bed.gz row has a matching synteny.rev.bed.gz row keyed by (hapChrom, hapStart, hapEnd).

**TS tests** (`plugins/gfa-tabix/src/__tests__/syntenyAdapter.test.ts`):

- **`adapter_fidelity`** — old and new adapter for `volvox_chr1_0-50k` chr1:0-50000 return same `{start, end, mateStart, mateEnd, mateRefName, strand}` tuples. Delete when old adapter is removed.
- **`adapter_no_ordinals`** — no returned feature has `segOrd` or `ordinal`.
- **`adapter_identity_range`** — every identity in [0, 1].
- **`adapter_grouping`** — each feature's `mateRefName` matches its source BED row's haplotype.

---

### Phase 3 — New GetSubgraph (unblocks GraphGenomeView small mode)

Implement the 6-step algorithm above. No changes to GraphGenomeView, OGDF, or
the renderer. Profile `seq.fa.gz` faidx access for 100/500/1000 ordinals; note
whether range coalescing is needed before adding complexity.

**TS tests** (`plugins/gfa-tabix/src/__tests__/getSubgraph.test.ts`):

- **`slines_complete`** — every ordinal from ref + haplotype pos.bed.gz queries has a non-empty S-line.
- **`llines_no_dangling`** — every L-line endpoint has a corresponding S-line.
- **`bubble_alt_segments`** — GFA for `bubble.gfa` region includes S-lines for B and C, L-lines A→C and C→D.
- **`insertion_completeness`** — GFA for `insertion.gfa` region includes S-lines for B1/B2/B3 and their L-lines.
- **`vg_oracle`** — compare node IDs, edges, path names against committed `vg find` oracle output for volvox chr1:0-10000.
- **`empty_region`** — region with no pos.bed.gz rows returns a valid H-line-only GFA, not an error.

**Browser test:** open GraphGenomeView for volvox chr1:0-10000; assert canvas has non-empty pixels, no error.

---

### Phase 4 — GraphGenomeView large-region renderer

When `region.end - region.start > 100_000`, fetch `synteny.bed.gz` (or
`synteny.coarse.bed.gz` at bpPerPx > 1000) and render coloured rectangles in
reference coordinate space. Reuse the existing WebGL2/WebGPU/Canvas2D
infrastructure; only the geometry source changes. No new index files.

**TS tests** (`plugins/gfa-tabix/src/__tests__/largeMode.test.ts`):

- **`routing_small`** — 50 kbp region calls GetSubgraph (small mode).
- **`routing_large`** — 200 kbp region calls synteny tabix path (large mode).
- **`spatial_agreement`** — large-mode `{refStart, refEnd, mateRefName}` triples match MultiLGVSyntenyDisplay for the same region.
- **`bpPerPx_routing`** — bpPerPx ≤ 1000 → synteny.bed.gz; bpPerPx > 1000 → synteny.coarse.bed.gz.

**Browser tests:** large-mode render for chr1:0-500000 (non-empty canvas, no error); zoom-out transition from small to large mode without error.

---

### Phase 5 — Paper figure

MultiLGVSyntenyDisplay → select chr20 SV → drill-down to GraphGenomeView small
mode → zoom out to large mode. Run all Phase 2–4 tests against chr20 index
(once, not in CI). Manual screenshot review.

---

## Correctness claims

- **Synteny coverage**: union of synteny.bed.gz ref-side blocks = chromosome length.
- **Synteny fidelity**: new adapter output matches old `getMultiPairFeaturesFromSegments` for the same viewport (oracle used during Phase 2 migration only).
- **Subgraph completeness**: GFA includes S-lines for shared and alt segments, L-lines for all four edge types. Verified against committed `vg find` oracle.
- **Large-mode agreement**: large-mode block extents match MultiLGVSyntenyDisplay blocks for the same region.

---

## Format reference (for implementors)

### `synteny.bed.gz` row schema
```
refChrom  refStart  refEnd  hapChrom  hapStart  hapEnd  strand  identity
GRCh38#0#chr20  1000  5000  HG002#1#chr20  1000  5100  +  0.994
```

### `pos.bed.gz` row schema
```
pathName  chunkStart  chunkEnd  ordinalRanges
GRCh38#0#chr20   0   15000   0-4,7,9-12
HG002#1#chr20    0   14800   0-3,8-12,1001-1003
```
One row per 100-step chunk. Coordinates are in the **path's own bp space**.
A reference-range tabix query returns only reference path rows; haplotype rows
require querying by haplotype contig name. Every traversed segment (including
alt/bubble segments) appears in the chunk's ordinal list.

### `edges.spatial.bed.gz` row schema
```
refChrom  refStart  refEnd  srcOrd  tgtOrd  srcOrient  tgtOrient
```
Each L-line emits two rows — one keyed by each endpoint's reference-space
position. For alt segments with no direct reference coordinate, use the
reference span of the containing bubble (divergence-to-convergence interval).
Row count = 2 × L-line count in source GFA.

### `synteny_build` algorithm
1. Walk reference path; record `(segOrd, refStart, refEnd, orient)` per segment.
2. For each haplotype path, find ordinals shared with the reference.
3. A **block** = maximal co-linear run of shared ordinals (same order, same strand).
4. A **bubble span** = reference/haplotype diverge then rejoin; emit one row each side.
5. Identity: 1.0 for shared blocks; from vg deconstruct CS strings for bubbles, or `min/max(refLen, hapLen)` if unavailable.

All five output streams are emitted in parallel from the same in-memory walk
data — no re-reading of pos.bed.gz.

---

## Open questions

- **Coarse gap threshold**: start 10 kbp; tune on chr20.
- **GetSubgraph cap**: 100 kbp proposed; profile the faidx step during Phase 3 before adjusting.
- **Reference-free browsing UI**: synteny.rev.bed.gz is ready; path selector UI deferred to Phase 4.
- **vg version pin**: add to `tools/gfa-to-tabix/README.md` alongside existing pin.
