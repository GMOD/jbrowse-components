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
