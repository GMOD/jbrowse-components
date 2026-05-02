# Pangenome Browser Plan

## Status

Phases 1–4 complete.

---

## Two views, one index (implemented)

### MultiLGVSyntenyDisplay — linear genome view (all zoom levels)

Feature contract:
```
start, end          — reference coordinates (uint32)
mateStart, mateEnd  — haplotype coordinates (uint32)
mateRefName         — haplotype path name
strand              — +1 / -1
identity            — 0–1 float, precomputed offline
cigar / cs          — optional, bpPerPx < 100 only (from bubbles.bed.gz)
```

### GraphGenomeView — Bandage-style graph (≤ 100 kbp) / synteny overview (> 100 kbp)

Small mode: GFA subgraph → OGDF WASM layout → WebGL2/WebGPU/Canvas2D.
Large mode: synteny.bed.gz → coloured rectangles in reference coordinate space.

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
| `pos.bed.gz` | ~50 MB | GetSubgraph ordinal lookup |
| `bubbles.bed.gz` | ~30 MB | Per-base CS detail |
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

**GraphGenomeView — large mode (region > 100 kbp)**
```
tabix synteny.bed.gz (or synteny.coarse.bed.gz if bpPerPx > 1000)
  → GetSyntenyBlocks RPC → syntenyBlocks volatile → LargeModeSyntenyCanvas
```

---

## Phase 5 — Paper figure

MultiLGVSyntenyDisplay → select chr20 SV → drill-down to GraphGenomeView small
mode → zoom out to large mode. Run all Phase 2–4 tests against chr20 index
(once, not in CI). Manual screenshot review.

**chr20 validation scripts** (to run manually, not in CI):

- `scripts/validate-synteny-chr20.mjs` — query synteny.bed.gz for dense SNP
  region, large SV, near-telomeric region; assert coverage ≈ 1 Mbp per window;
  assert all identity in [0, 1]; assert coarse fewer rows than fine. Puppeteer:
  MultiLGVSyntenyDisplay at bpPerPx 1, 100, 1000.

- `scripts/validate-subgraph-chr20.mjs` — getSubgraph for ~10 kbp SNP region,
  large SV region, centromere-adjacent; assert S-line count bounds, no dangling
  L-lines, path count = 90, no duplicate node IDs. Puppeteer: GraphGenomeView
  small mode, wait for OGDF layout, assert non-empty canvas.

- `scripts/validate-large-mode-chr20.mjs` — GraphGenomeView 500 kbp region,
  assert large-mode fires (not OGDF), canvas non-empty, no error overlay.
  Screenshot both GGV and MultiLGVSyntenyDisplay for same region; assert same
  haplotype path names visible. Full-chr20 bpPerPx > 1000: assert coarse file
  fetched and render completes.

---

## Correctness claims

- **Synteny coverage**: union of synteny.bed.gz ref-side blocks = chromosome length.
- **Synteny fidelity**: new adapter output matches old `getMultiPairFeaturesFromSegments` for the same viewport.
- **Subgraph completeness**: GFA includes S-lines for shared and alt segments, L-lines for all four edge types.
- **Large-mode agreement**: large-mode block extents match MultiLGVSyntenyDisplay blocks for the same region.

---

## Format reference

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

### `edges.spatial.bed.gz` row schema
```
refChrom  refStart  refEnd  srcOrd  tgtOrd  srcOrient  tgtOrient
```
Each L-line emits two rows. Row count = 2 × L-line count in source GFA.

### `synteny_build` algorithm
1. Walk reference path; record `(segOrd, refStart, refEnd, orient)` per segment.
2. For each haplotype path, find ordinals shared with the reference.
3. A **block** = maximal co-linear run of shared ordinals (same order, same strand).
4. A **bubble span** = reference/haplotype diverge then rejoin; emit one row each side.
5. Identity: 1.0 for shared blocks; from vg deconstruct CS strings for bubbles, or `min/max(refLen, hapLen)` if unavailable.

---

## Open questions

- **Coarse gap threshold**: 10 kbp used; tune on chr20 if blocks look fragmented.
- **Reference-free browsing UI**: synteny.rev.bed.gz is ready; path selector UI not yet built.
- **vg version pin**: add to `tools/gfa-to-tabix/README.md`.
