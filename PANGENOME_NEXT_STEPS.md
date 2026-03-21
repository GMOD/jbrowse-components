# Pangenome Synteny: Next Steps

> Completed items moved to `PANGENOME_COMPLETED.md`.

## Priority

| Priority | Phase | Task | Effort | Impact |
|----------|-------|------|--------|--------|
| 1 | A1 | Indexed GFA adapter (SQLite) | Large | Enables runtime GFA for graph viewer + synteny |
| 2 | D1 | Graph ↔ Synteny navigation | Medium | Connects the two visualization modes |
| 3 | A3 | Streaming GFA conversion | Small | Handles very large GFAs |
| 4 | C2 | Cross-level linking | Small | Transitive relationships for non-adjacent pairs |
| 5 | C3 | N-way diagonalization | Medium | Algorithmic improvement |
| 6 | D2-D3 | Shared adapter + path highlighting | Large | Deep integration with graph viewer |

---

## Phase A: Runtime GFA Integration

### A1. Indexed GFA Querying

Runtime GFA access is needed for both graph visualization AND synteny projection.

**Approach: GFA → SQLite** (done: CLI conversion)

`jbrowse make-gfa-db` converts GFA to SQLite with tables for segments, paths, and path_steps. Uses `node:sqlite` (built-in since Node 22.5). Index by path + cumulative_offset for O(log N) range queries.

```
segments(id, length, sn, so, sr)
paths(id, name, sample, haplotype, sequence, total_length)
path_steps(path_id, step_index, segment_id, orientation, cumulative_offset, segment_length)
```

**Remaining work:**
- `plugins/comparative-adapters/src/GfaSyntenyAdapter/` — runtime adapter that reads SQLite DB and implements `getMultiPairFeatures()`. Needs `sql.js` (WASM) for browser support.
- Assembly auto-creation from GFA paths (each genome → JBrowse assembly)

**Prior art & alternatives:**
- [gfabase](https://github.com/mlin/gfabase) — SQLite-based GFA indexing
- vg/xg format — better for graph traversal performance, widely used in pangenomics community. Consider as future integration for graph viewer (D2-D3).

### A3. GFA-to-PIF Streaming Conversion

For large GFAs that can't be loaded into memory, implement streaming conversion:

1. Parse segments in one pass (store in Map — just IDs and lengths, not sequences)
2. Parse paths/walks, accumulate step offsets
3. For each pair, walk and emit synteny records directly to sort pipe

---

## Phase C: Improved N-Way LinearSyntenyView

### C2. Cross-Level Linking

When viewing N genomes (A, B, C, D), show relationships that skip levels:
- A↔B synteny + B↔C synteny visible by default
- Optional: A↔C "transitive" synteny computed from A↔B + B↔C
- Visual: dotted/faded lines for non-adjacent pairs

### C3. Diagonalization for N Genomes

The existing "Re-order chromosomes" works for 2 genomes. For N genomes:
- Optimize ordering to minimize crossing lines across ALL pairs simultaneously
- Use a weighted objective function: minimize total crossings where adjacent pairs have higher weight
- Consider phylogenetic ordering as a starting heuristic

---

## Phase D: Graph Viewer ↔ Synteny Integration

### D1. Bidirectional Navigation

1. **Graph → Synteny**: User views a bubble/variant in the graph, clicks "Show synteny context" → opens synteny view centered on that variant's coordinates
2. **Synteny → Graph**: User clicks an inversion/translocation in the synteny view → opens graph viewer showing the underlying bubble structure

### D2. Path Highlighting in Graph View

When the synteny view has specific genomes selected, highlight those paths in the graph view and show which bubbles differentiate the selected genomes.

### D3. Shared Adapter Layer

Both the graph viewer and synteny projection should share the same GFA adapter. Single GFA file opened once, graph viewer queries segments + links, synteny adapter queries paths.

---

## Unified Adapter Architecture

```
Data Sources              Adapters                         Consumers
─────────────    ────────────────────────    ──────────────────────────────
PIF files    →   PairwiseIndexedPAFAdapter   →  LinearSyntenyDisplay
PAF files    →   PAFAdapter                  →  LGVSyntenyDisplay
GFA server   →   GfaSyntenyAdapter (new)     →  MultiLGVSyntenyDisplay
GFA file     →   GfaFileSyntenyAdapter (new) →  (any future display)
```

## Key Design Decisions Still Open

1. **GFA indexing strategy**: SQLite vs custom tabix-like index vs server process?
2. **Multi-pair PIF vs runtime projection**: Pre-compute all pairs or compute on demand?
3. **Assembly creation for graph genomes**: How to create JBrowse assemblies from GFA paths?

---

## Future Ideas & Technical Notes

### Segment-Centric Encoding for Extreme Multi-Comparisons

The current multi-pair PIF format is pair-centric: each pair gets its own indexed prefix (`t0`, `t1`, ...). For all-vs-all at scale (e.g., mumemto-style MEMs across hundreds of genomes), a segment-centric format would store each shared segment once with a list of genomes that contain it.

```
# Segment-centric (proposed): block stored once with genome membership
seg42  chr1:1000-5000  genomes=A,B,C,D  strand=+,+,-,+  offsets=1000,1200,800,1100
```

- `segmentId` field already added to `MultiPairFeature` and propagated via `sg:Z:` PAF tag
- `MultiSyntenyRendering` already supports segment-based coloring
- Reference: [mumemto](https://github.com/vikshiv/mumemto)

### RPC Migration for getMultiPairFeatures

Currently `getMultiPairFeatures()` runs on the main thread via direct adapter access. For large pangenomes this should move to an RPC method running in the web worker. The main-thread approach is fine for ≤20 genomes.

### Test Data Needed

1. **HPRC chr20 PAF**: Extract from PGGB untangle PAF
2. **Minigraph-cactus chr20 GFA**: Convert `.vg` → `.gfa` using `vg view`
3. **C. elegans multi-species PAF**: Small genomes, good for integration testing
