# Pangenome Synteny: Next Steps

> Completed items moved to `PANGENOME_COMPLETED.md`.

## Priority

| Priority | Phase | Task                                            | Effort | Impact                                          |
| -------- | ----- | ----------------------------------------------- | ------ | ----------------------------------------------- |
| 1        | B5    | MultiLGV scrolling for manual row height mode   | Small  | Scroll through assemblies when rows exceed display |
| 2        | B6    | MultiLGV sorting/grouping by assembly properties | Small  | Organize 90+ assemblies by clade, identity, etc.  |
| 3        | D1    | Graph ↔ Synteny navigation                      | Medium | Blocked: no graph viewer yet                    |
| 4        | D2-D3 | Shared adapter + path highlighting              | Large  | Blocked: no graph viewer yet                    |
| 5        | C2    | Cross-level linking                             | Medium | Transitive relationships for non-adjacent pairs |

---

## Phase C: Improved N-Way LinearSyntenyView

### C2. Cross-Level Linking (deprioritized — Medium effort, not Small)

When viewing N genomes (A, B, C, D), show relationships that skip levels.
Dotted/faded lines for non-adjacent pairs (A↔C, A↔D).

**Rendering approach**: Full-height canvas overlay (`pointer-events: none`) on
`LinearComparativeRenderArea`. Track each view's vertical offset via refs +
ResizeObserver. Draw faded dotted lines from view[i] to view[j]. Uses
`view.bpToPx()` for horizontal, `getBoundingClientRect()` for vertical.

**Transitive computation** (two paths):
- *Coordinate chaining* (universal): for A↔B feature with mate B[y1,y2], find
  B↔C features overlapping that B region. Chain A→C. O(n×m) naive, interval
  tree for scale.
- *Segment-ID based* (GFA only): group features by `segmentId` across levels —
  no coordinate math needed.
- *User-provided*: direct A↔C PAF/PIF files, no computation.

**Visual**: dotted lines, ~0.3 alpha, color inherited from source feature.

---

## Phase D: Graph Viewer ↔ Synteny Integration

### D1. Bidirectional Navigation

1. **Graph → Synteny**: User views a bubble/variant in the graph, clicks "Show
   synteny context" → opens synteny view centered on that variant's coordinates
2. **Synteny → Graph**: User clicks an inversion/translocation in the synteny
   view → opens graph viewer showing the underlying bubble structure

### D2. Path Highlighting in Graph View

When the synteny view has specific genomes selected, highlight those paths in
the graph view and show which bubbles differentiate the selected genomes.

### D3. Shared Adapter Layer

Both the graph viewer and synteny projection should share the same GFA adapter.
Single GFA file opened once, graph viewer queries segments + links, synteny
adapter queries paths.

**Prior art:**

- sequenceTubeMap server-side: uses `vg chunk` or `chunkix.py` (tabix) to
  extract subgraphs
- Consider optional server component using vg/xg for graph traversal queries
- sequenceTubeMap source: `~/sequencetubemap` — Python scripts in
  `scripts/pgtabix.py` and `scripts/chunkix.py`

---

## Phase E: Performance & Scale

### E3. DuckDB/Parquet Investigation

For future scale beyond tabix (hundreds of genomes, complex graph queries):

- **DuckDB-WASM** (~10MB): native Parquet support, analytical query performance,
  HTTP range requests via `httpfs`
- **Parquet**: column-oriented storage ideal for segment-centric encoding
  ("which genomes share segment X?")
- Trade-off: larger WASM bundle vs. much richer query capability
- Most useful for Phase D graph viewer integration where complex JOIN queries
  are needed

---

## Unified Adapter Architecture

```
Data Sources              Adapters                         Consumers
─────────────    ────────────────────────    ──────────────────────────────
PIF files    →   PairwiseIndexedPAFAdapter   →  LinearSyntenyDisplay
PAF files    →   PAFAdapter                  →  LGVSyntenyDisplay
GFA tabix    →   GfaTabixAdapter (done)      →  MultiLGVSyntenyDisplay
GFA server   →   (future: vg/xg backend)     →  Graph viewer
```

---

## Test Data Still Needed

1. **C. elegans multi-species PAF**: Small genomes, good for integration testing
2. **Large Arabidopsis FASTA files**: For full demo with sequence tracks
   (download from TAIR/NCBI, host on S3)

## Future Ideas & Technical Notes

### Segment-Centric Encoding for Extreme Multi-Comparisons

The current multi-pair PIF format is pair-centric: each pair gets its own
indexed prefix (`t0`, `t1`, ...). For all-vs-all at scale (e.g., mumemto-style
MEMs across hundreds of genomes), a segment-centric format would store each
shared segment once with a list of genomes that contain it.

```
# Segment-centric (proposed): block stored once with genome membership
seg42  chr1:1000-5000  genomes=A,B,C,D  strand=+,+,-,+  offsets=1000,1200,800,1100
```

- `segmentId` field already added to `MultiPairFeature` and propagated via
  `sg:Z:` PAF tag
- `MultiSyntenyRendering` already supports segment-based coloring
- The GfaTabixAdapter's segs.bed.gz is essentially a segment-centric format
- Reference: [mumemto](https://github.com/vikshiv/mumemto)

### sequenceTubeMap Integration Notes

The sequenceTubeMap project (`~/sequencetubemap`) demonstrates two approaches:

1. **VG-based**: `vg chunk` extracts subgraphs — requires vg binary, ~33s per
   query
2. **Tabix-based** (jmonlong): 3 indexed files (nodes.tsv.gz, pos.bed.gz,
   haps.gaf.gz) — ~0.5s per query, scales to HPRC v1.1

JBrowse's GfaTabixAdapter follows the tabix approach but with a simplified
2-file format optimized for synteny projection rather than full graph
visualization. For future graph viewer integration (Phase D), the full 3-file
format with node sequences would be needed.

See also:

- [README.tabix.md](https://github.com/vgteam/sequenceTubeMap/blob/master/README.tabix.md)
- [jmonlong pangenome annotation manuscript](https://jmonlong.github.io/manu-vggafannot/)
- [rGFA spec](https://github.com/lh3/gfatools/blob/master/doc/rGFA.md) (most GFA
  files are NOT rGFA)
