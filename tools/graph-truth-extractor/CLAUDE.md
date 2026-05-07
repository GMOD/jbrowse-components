# graph-truth-extractor

CLI tool that extracts a "truth" subgraph from a GFA file using an external
backend (vg, odgi, chunkix, or naive), then compares it against the subgraph
produced by our adapter. Used to verify that `GetSubgraph` RPC reproduces the
correct physical graph.

## Canonicalization (`canonicalize.ts`)

Two GFA files that represent the same graph may use different node IDs, edge
directions, or walk orientations. `canonicalize` normalizes a GFA into a stable
form so two equivalent graphs compare equal.

**Algorithm:**

1. **Seed labels** — each node gets an initial label derived from its sequence
   (or length when sequences are placeholder `*`) plus a hash of which haplotype
   paths visit it and what sequence is immediately adjacent in those paths
   (`pathContextLabels`). Path context is critical for Phase 0 (no sequences):
   Weisfeiler-Leman alone cannot distinguish twin single-nucleotide-polymorphism
   nodes that have identical length and neighbor structure but sit on different
   haplotype paths. We use local sequence context (prev/next step sequences)
   rather than absolute step index, so the label is portable when backends split
   the same walk at different positions.

2. **Weisfeiler-Leman refinement** (`refineLabels`) — iteratively replace each
   node's label with a hash of itself plus the sorted labels of its neighbors.
   Converges when the partition of nodes into equivalence classes stops
   changing. Capped at min(n+1, 32) iterations.

3. **Canonical relabeling** (`assignCanonicalIds`) — sort nodes by
   (Weisfeiler-Leman label, original id) and rename them n0, n1, .... Nodes with
   the same label (structurally identical) get deterministic but distinct
   identifiers.

4. **Emit** (`emitCanonicalGfa`) — write edges sorted and with bidirected
   partners normalized (`canonicalEdge`), paths sorted and with forward/reverse
   walks normalized (`canonicalPathSteps`).

**`structuralFingerprint`** skips full canonicalization and instead hashes four
multisets (seq, link, path, deg) over actual sequences. This is the primary
equality check used by `--all-backends`. Walk splitting is handled by grouping
W-lines with the same base name (stripping `:offset`) and merging them in offset
order before hashing, so backends that split the same haplotype walk at
different positions still produce identical path fingerprints.

## Phase 0 vs Phase 1

- **Phase 0** — S lines in our tabix index are placeholders (no sequence, just
  length). Set `useSequence: false` (default). Labels are based on
  `(length, path context)`.
- **Phase 1** — real sequences available. Set `useSequence: true`. Labels use
  actual nucleotide sequence, which is more discriminating and removes the
  reliance on path context for disambiguation.

## Running

```
node --experimental-strip-types cli.ts \
  --backend vg \
  --gfa path/to/graph.gfa \
  --path chr1 --start 1000 --end 5000
```

`--all-backends` runs all available backends and reports agreement.
`--emit canonical` prints the canonicalized GFA for manual inspection.
