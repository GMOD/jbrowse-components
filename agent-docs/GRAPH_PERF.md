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
