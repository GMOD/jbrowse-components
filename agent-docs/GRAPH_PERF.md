## Step 0 — odgi spike results (2026-05-01, no-commit)

**Gate result: FAIL on chr20 segment-reduction gate.**

### Environment

- odgi v0.9.4-2-g405be8f6 (`~/src/vendor/odgi/bin/odgi`) — **unchop broken in
  this build**: crashes with `std::length_error: cannot create std::vector larger
  than max_size()` on every graph, including 278-node fixtures. Root cause
  unknown (likely a libhandlegraph ABI mismatch in the local build). Odgi build
  command and stats commands work; only unchop and view crash.
- vg v1.69.0 (`~/.local/bin/vg`) — fully functional. Used as primary measurement
  tool since `vg mod -u` is the cross-check oracle anyway.
- Fixtures: volvox (test_data/volvox/volvox_pangenome_50.gfa), chrM
  (~/hprc-data/hprc-v1.1-mc-grch38.chrM.gfa), chr20 (~/hprc-data/hprc-v1.1-mc-grch38.chr20.vg).

### Linear-chain contraction (vg mod -u) results

| Fixture | Input nodes | Input edges | After unchop | After unchop edges | Wall time | Reduction |
|---------|-------------|-------------|--------------|-------------------|-----------|-----------|
| volvox  | 1,204       | 1,622       | 1,204        | 1,622             | < 0.1 s   | 0%        |
| chrM    | 1,393       | 1,885       | 1,393        | 1,885             | < 0.1 s   | 0%        |
| chr20   | 1,859,947   | 2,574,969   | 1,842,238    | 2,557,260         | 1 m 37 s  | **0.95%** |

**chr20 gate check:**
- Time gate (< 30 min): PASS (1 m 37 s).
- Segment-reduction gate (< 1/3 of detail count = < 620 K): **FAIL** (1,842,238 >> 620,000).

### Root cause

HPRC minigraph-cactus pangenomes have 90 haplotypes at ~34 bp average node
size. At that haplotype density, nearly every graph node borders a variant site
in at least one haplotype, giving it bidirected degree > 2. Linear-chain
contraction (unchop) requires degree-2 nodes with a single unambiguous
predecessor and successor; such nodes are essentially absent. The algorithm is
correct but the input has no chains to collapse.

This is distinct from the unchop use-case for which it was designed (graphs
that have been artificially chopped to a fixed node length, where long
haplotype-invariant stretches remain chainable). HPRC MC graphs were not
chopped; their short nodes reflect natural variation density.

### Next steps (per GRAPH_COARSE_DESIGN.md gate-failure clause)

Linear-chain contraction is not a viable coarsening primitive for HPRC MC
pangenomes. Candidate alternatives:

- **Coordinate-tile coarsening (odgi bin).** Group nodes by reference-coordinate
  windows (e.g., 10 kbp). `odgi bin -w N` bins nodes by pangenome position;
  output is already reference-anchored. Guaranteed N-fold linear compression by
  choosing N. Disadvantage: lossy (topology within bin is summarised, not
  preserved). But the existing runtime coarsener already does this effectively
  (10 super-segments per 1 Mbp) — the static-file port would use `odgi bin`
  as the engine.
- **vg snarls (top-level only).** Snarl decomposition identifies the
  hierarchical SV structure. Top-level snarls at chr20 scale are the large
  inversions/translocations; the backbone chains between them are the collinear
  stretches. This would give a semantically meaningful coarse graph (SV sites
  as super-nodes, backbone as chain). Disadvantage: vg snarls on chr20 has not
  been timed; could be slow.
- **Hand-rolled Rust chain contraction with a reference-distance threshold.**
  Define "chainable" not by graph topology but by reference position: two nodes
  are merged if they are adjacent on the reference path and their combined
  reference span < threshold. This is equivalent to the existing
  `synteny.coarse.bed.gz` merge logic, applied to the graph tier.

Recommendation: measure `odgi bin` on chr20 next (fast to run; odgi bin does
not crash). If bin output is usable as coarse BED rows, pivot the design to use
it as the engine.

---

## Revised Step 1 — tile and snarl implementation (2026-05-01)

### Tile approach (--graph-coarse-method tile)

Implemented in `tools/gfa-to-tabix/src/main.rs`. Groups ref-path steps into fixed
N-bp windows. Emits `prefix.graph.coarse.bed.gz`.

| Fixture | Input segments | Tiles (10kbp) | Wall time | Gate |
|---------|---------------|---------------|-----------|------|
| volvox  | 1,204         | 5             | < 0.1 s   | PASS |
| chrM    | 1,393         | 2             | < 0.1 s   | PASS |
| chr20 (Python count) | 1,859,947 | 6,188 | < 1 s | PASS |

Gate checks for tile method:
- Super-node count < 50,000: PASS (6,188 for chr20)
- Wall time < 5 min: PASS (< 1 s)
- Determinism (SHA256): PASS (volvox, chrM confirmed)
- Contiguity (no gaps): PASS (all fixtures)
- superOrd = min(constituentOrds): PASS (verified)

**Re-entering path observation (volvox fixture).** Ordinals 644 and 645 appear
in two consecutive tiles (30891–41996 and 41996–50001). The volvox reference path
revisits these segments, likely at an inverted repeat. The per-step disjointness
invariant holds (each step is in exactly one tile); per-ordinal uniqueness does
not hold for re-entering paths. This is a documented property, not a bug.
See `GRAPH_COARSE_SYSTEM.md` for details.

### Snarl approach (--graph-coarse-method snarl)

Implemented using `vg snarls | vg view -R` subprocess. Emits `prefix.graph.coarse.bed.gz`
with `type=snarl` (variation sites) and `type=chain` (backbone) rows.

| Fixture | Top-level snarls | Large (>=100bp) | Total super-nodes | Wall time | Gate |
|---------|-----------------|-----------------|-------------------|-----------|------|
| volvox  | 383             | 265             | 283               | < 1 s     | PASS |
| chrM    | 454             | 104             | 127               | < 1 s     | PASS |
| chr20 GFA | 497,227 | TBD | TBD | 6:27 | **FAIL (time)** |

**chr20 snarl timing:**

| Input format | Threads | Wall time | Gate |
|---|---|---|---|
| chr20.gfa | 1 (default) | 6:27 | FAIL |
| chr20.vg | 4 | 0:52 | PASS |

- chr20 top-level snarl count: 497,227 (same for both formats, expected — same graph).
- Count after filtering to >= 100bp ref-span: TBD.
- The design doc estimated 32 s — that number was not measured from actual vg
  snarls and should be treated as incorrect.

**Resolution**: Tile method is v1 default (passes all gates on GFA input). Snarl
method works on chr20 when using the `.vg` file as input to `vg snarls` with
4 threads (52 s). The snarl implementation in main.rs automatically uses a
co-located `.vg` file if present, otherwise falls back to the GFA.

---

## Performance

**Surgical node dragging in `plugins/graph`.** Currently, moving a single node
triggers a full `buildGeometry` and `uploadGeometry` for the entire graph
(all nodes and edges) via the `viewportDirty` flag.
- *Optimization:* Implement `updateSubBatchGeometry` in `GraphRenderer`
  backends to allow partial buffer updates.
- *Action:* Update `moveNode` to only re-tessellate the dragged node and
  its connected edges, then push only those vertex slices to the GPU.
- *Prerequisite:* Demonstrate slowness with a large graph example (e.g.,
  10k+ nodes) using the added `[Graph Performance]` console logging.

**`chainIdMap` perf.** Gate to `linkedRead + chain highlights active`.
Currently iterates every read × region on every data update.

## Coarsener (runtime prototype) — chr20 multi-scale benchmark

Measured 2026-04-30 against `~/chr20-test/chr20.*` (HPRC v1.1 mc grch38
chr20: 1.86 M segments, 90 haplotypes). Cold-cache local file fetches
via `LocalFile` on a single CPU thread (`dump-subgraph.ts --coarsen on`).
Default threshold formula
`max(20, region_bp / 50_000)`.

| Region size | Mode      | Wall   | Segments | Links | Walks | Output bytes |
|-------------|-----------|--------|----------|-------|-------|--------------|
| 100 kbp     | per-seg   | 260 ms | 2,994    | 3,992 | 199   | 414 KB       |
| 1 Mbp       | coarsened | 388 ms | 10       | 15    | 1     | 674 B        |
| 5 Mbp       | coarsened | 2.0 s  | 8        | 13    | 1     | 585 B        |
| 10 Mbp      | coarsened | 4.7 s  | 13       | 22    | 1     | 955 B        |

The 10 Mbp output preserves 5 structural variants (max alt-walk 1.47 kb +
1 × 600 bp + 3 × 1–11 bp boundary segs) connecting 4 super-segments
(135 K + 7 K + 1 + 1.5 K ref segments collapsed). Output is structurally
valid GFA — every alt-segment has at least one L-line connecting it back
to a super-segment (verified by `gfaCoarsener.test.ts` "always emits a
connected graph" assertion).

Wall-time scales linearly with region (each Mbp adds ~470 ms — dominated
by `getEdgesForOrdinals` BFS over alt branches). At HPRC chr20 full
length (60 Mbp) this projects to ~30 s, which is too slow for an
interactive query. The Rust port (planned, see GRAPH_PLAN.md item 2)
should hit < 100 ms at the 1 Mbp tile-pyramid level since the topology
walk is precomputed.

Memory: peak heap on the 10 Mbp run was ~85 MB (most of which is the
chr20 segments.idx and edges.idx eager-loaded BigUint64Arrays — 30 MB +
15 MB respectively per `GRAPH_PLAN.md` item "loadBinaryIndex
eager-loads"). Coarsener-specific allocations (super-segment arrays,
bubble accumulators, link sets) are negligible.

## Lightning-rod finding 2026-04-30: chr20 path-symmetry

`bash tools/graph-truth-extractor/test-path-symmetry.sh --prefix /home/cdiesh/chr20-test/chr20 --path GRCh38#0#chr20 --start 30000000 --end 30001000 --context 0`

- chrM control (44 paths, MT:5000-5500): all fingerprints **match** (`3d0e925d0f33b04a`).
- chr20 30M region (11 equivalent paths, 1 kb window, context=0): all fingerprints **diverge**.

Per-pair segment-set overlap (context=0, 1 kb window):

| Pair                         | shared | A-only | B-only |
|------------------------------|--------|--------|--------|
| GRCh38 vs HG01175#2 (1004bp) | 33     | 10     | 9      |
| GRCh38 vs HG01243#1 (833bp)  | 24     | 19     | 74     |

The bounding-box equivalent-ranges helper produces same-bp windows on each
path's own contig, but those windows extract structurally different
subgraphs because:

- HPRC chr20 haplotype contigs (`JAHAMA*`, `JAHBCB*`, …) are fragmented;
  most are < 500 kb. The bounding box on a small contig clips at contig
  boundaries.
- Segment fragmentation differs per haplotype. A path that diverges from
  GRCh38 around a locus traverses many short alt-allele segments; one
  that agrees with GRCh38 traverses one long segment. HG01243#1 has 98
  segments in its 833 bp window (2× density of GRCh38's 43 in 1000 bp).

The C3 path-symmetry claim as currently written ("querying the same
locus from N reference paths yields the same canonical subgraph") holds
for **fully-traversed chromosomes** (chrM is the working example) but
not for fragmented-contig pangenome chromosomes (chr20). The publication
needs to either (a) restrict C3 to fully-traversed cases, (b) reframe
C3 around a subset/intersection invariant, or (c) define a different
"same locus" mapping that accounts for fragmentation.

## Lightning-rod follow-up 2026-04-30: intersection test was a tautology

After the chr20 N-way symmetry failure, an "intersection-restricted"
reframing was tried — restrict each path's extraction to segments
common to N paths (or to a pair), then compare. It "passed" at every
scale tested.

**Then realized it was a tautology.** Both extractions read the same
`segments.bin` and `edges.bin`. Restricting to the same segment
subset and emitting the same canonical bidirected-edge form
necessarily produces identical output — "reading the same file twice
gives the same answer," not a structural symmetry claim.

Script (`tools/graph-truth-extractor/intersection-symmetry.ts`) was
deleted. Cross-path-symmetry framing dropped from GRAPH_PLAN.md.
The publishable C3 claim is the narrower, honest one: per-path
correctness against `vg find` (covered by `auditConcordance.test.ts`).
On fully-traversed chromosomes, the strong "all paths agree" property
does hold and is verified by
`tools/graph-truth-extractor/test-path-symmetry.sh` on chrM (44
paths, fp `3d0e925d0f33b04a`).
