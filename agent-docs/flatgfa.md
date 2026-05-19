
  The user's instinct is correct: linearization is the heavy lift. Here's the picture across the three pieces:

  Static-file pipeline (gfa-to-tabix) — the slow, fragile piece.
  - synteny_build (main.rs:1504) is the dominant cost: pairwise align_pair over (ref × hap) on chr20 = 90 haplotypes × 1.86 M segments = ~1 h preprocessing, with synteny.bed.gz + synteny.rev.bed.gz
  accounting for ~140–280 MB of the ~290–480 MB total index (GRAPH_PLAN.md).
  - Correctness is fragile: the X-CIGAR contract between segmentFeatureBuilder and bubbleOverlay exists because we are reconstructing variant signal from synteny blocks + a separate bubbles overlay
  (GRAPH_ARCHITECTURE.md "Fragile boundaries"). chr20 path-symmetry (C3) failed and had to be narrowed; coarsening only works as a flat S-line rectangle stripe with no edges/walks (GRAPH_COARSE_SYSTEM.md).
  - The publication framing already had to retreat: "publication-targeted correctness gates of Phase 0 are met" (GRAPH_AUDIT.md), with C3 reframed and L-lines deferred to v2.

  Runtime graph-server (vg backend) — already fine.
  - /subgraph 10 kb cold = ~0.9 s, 100 kb = ~3 s, cache hit ~3 ms (GRAPH_PERF.md).
  - One-time vg convert -x ~90 s; paths sidecar makes re-boots ~100 ms.
  - This is exactly the odgi extract_selected_loci workflow you linked, just behind an HTTP shim that the browser GraphGenomeView already consumes via loadFromTabixSubgraph.

  FlatGFA — not a fit for what you need.
  - The Cornell project is a flat mmap-able in-memory format optimized for whole-graph traversal (11× ODGI round-trip, 1331× path-listing). It does not expose vg find -p path:start-end -c context style
  range subgraph extraction; that's not in its surface.
  - No WASM, no Node bindings, Rust+Python CLI. Adopting it would be the same shape as today's odgi/vg subprocess — different binary, same architecture, and you'd have to add the range-query indexing
  yourself.
  - Not the leverage point.

  Recommendation: pivot toward subgraph-on-demand + VCF, punt linearization

  You're right that subgraph extraction is comparatively easy — vg find already does it at interactive latency, GraphGenomeView already consumes the GFA, OGDF WASM lays it out. The whole loop works today
  through graph-server. The hard, shaky-foundation piece is the multi-haplotype linearization for MultiLGVSyntenyDisplay.

  A defensible scope cut:

  - Keep: graph-server's /subgraph + GraphGenomeView. This is the workflow the odgi tutorial describes, and it's ~1 s on chr20 today. Don't touch.
  - Keep: vg deconstruct → VCF rendered as a normal JBrowse VariantTrack on the reference. SNPs, small indels, even SVs get the existing variant-track machinery (genotype matrix, sample filters, etc.) for
  free.
  - Add: a one-click launcher — right-click a VCF site (or any region) → opens GraphGenomeView on that subgraph. This is the part the odgi tutorial implies and is small to wire up.
  - Punt or mark experimental: synteny.bed.gz pairwise alignment, MultiLGVSyntenyDisplay-for-graphs, bubbles.bed.gz overlay, the X-CIGAR contract, coarse synteny tiers, C3 path-symmetry framing. Leave the
  code on the branch as research; don't gate publication on it; don't ship it as a user-facing feature in v1.

  What you give up by punting linearization: a single track showing all 90 haplotypes laid out against reference in one LGV. What VCF + on-demand graph view gets you instead: per-sample genotypes at every
  variant site (often more useful in practice), plus the full Bandage view at any locus the user wants to drill into. The structural-variant story (large inversions, novel insertions) is actually better
  served by GraphGenomeView than by a synteny stripe anyway — that's where the graph topology matters.

  If you want a softer pivot, you could keep linearization for chrM-scale fully-traversed cases (where it actually works cleanly) and document chr20-scale linearization as a known limitation rather than a
  blocker.

  The one thing worth doing before deciding: confirm with a real user what the synteny stripe actually buys them over vg deconstruct + on-demand graph view. If the answer is "not much for typical variant
  inspection, mostly the SV/inversion cases," the pivot is clearly worth it.


