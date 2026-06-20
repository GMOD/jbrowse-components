# Synteny block-level data: importing / generating from external tools

Brainstorming doc. Status: **exploration**, no code committed for this yet.

## The problem this addresses

Whole-genome synteny overviews render as a *hairball*: thousands of raw
minimap2 local alignments, each drawn as a ribbon, crisscrossing. We've
attenuated the **visual** symptom in the renderer (see "Already done" below),
but the structural cause is the *input*: we draw raw alignments, while the tools
that produce elegant plots (plotsr, ntSynt-viz, circos) draw **detected synteny
blocks** — a handful of large, classified regions. The hairball was already
collapsed by an upstream analysis step before those tools ever drew a pixel.

So the lever here is **block-level data**: collapse runs of collinear
alignments into blocks, and serve those at coarse zoom. This is the data-layer
counterpart to the renderer-layer fade — they compose.

## Already done (renderer layer — separate from this doc)

- Per-ribbon **width-proportional fade** (perpendicular width) replacing the
  full-opacity sub-pixel floor, in both the GPU fill shader (`fillCoverage` in
  `syntenyTypes.slang`) and Canvas2D (`Canvas2DSyntenyRenderer`). Small
  alignments fade instead of stacking hard lines; nothing is dropped.
- Canvas2D sub-pixel decision keyed on **perpendicular** width so steep
  diagonals stroke a clean 1px centerline instead of filling a ragged sliver.

These soften the hairball for free but cannot truly declutter an all-to-all
tangle of many *separate* small alignments. That needs blocks.

## Tool landscape (get this right before picking a route)

| Tool | What it is | Input | Cross-species? | Notes |
| --- | --- | --- | --- | --- |
| **plotsr** | plotter only | SyRI output | no | block detection is SyRI's, not plotsr's |
| **SyRI** | block + rearrangement caller | whole-genome aln (minimap2/MUMmer SAM/BAM/PAF/delta) | **no** — same-species/strain | assumes near-complete, chromosome-level, ~1:1 collinear alignment; finds longest syntenic path then classifies residue. Degrades on fragmented/divergent/many-to-many. |
| **ntSynt** | multi-genome synteny blocks | **FASTA genomes** (minimizer graphs, ntHash/ntJoin lineage) | **yes** — designed for it | robust to divergence + rearrangement. Does **not** consume a PAF — it replaces minimap2. Snakemake/C++/Python pipeline. Output = block TSV. ntSynt-viz draws ribbons from it. |
| **MCScan / MCScanX / DAGchainer** | gene-anchor collinearity | anchor pairs (homology/BLAST) | yes (anchor-based) | we already have an MCScan adapter (block-level). Plant/WGD heritage. |
| **(generic) PAF collinear chaining** | chain/merge alignments into blocks | minimap2 PAF | yes | the stage every tool above runs internally; implementable directly. |

Key correction to the intuition that "we could import from SyRI/plotsr": **SyRI
is same-species** — don't anchor cross-species work on it. **ntSynt is the
cross-species reference**, but its input is FASTA, not PAF, so it's a *replace
minimap2* path, not an *import-our-PAF* path.

## Three routes to block-level pif

### Route A — adopt a tool's block output (preprocessing)
Run ntSynt (cross-species) or MCScan as an external step; write a small
**block-import adapter** reading its block TSV → pif.
- **Pros:** highest-quality blocks; no algorithm to maintain.
- **Cons:** external tool + pipeline step (not in-browser); ntSynt is a heavy
  Snakemake/C++/Python dependency; another file format to parse.

### Route B — own PAF collinear chaining (recommended first step)
The operation we literally want — "collapse a minimap2 PAF into block-level
pif" — is **collinear chaining**, the internal stage of every tool above:
- sort alignments by target,
- chain those whose query/target coords advance monotonically on a consistent
  strand within gap tolerances,
- emit one block per chain,
- break a chain on strand flip / large gap / target jump.

DAGchainer-style DP or a greedy diagonal-merge. Organism-agnostic, **no new
dependency**, consumes the PAF we already produce, slots into existing tooling
as a `make-pif --blocks` (or `--merge`) mode.
- **Pros:** no dependency; uses existing data + tooling; in-repo, testable.
- **Cons:** we own the algorithm; pure-PAF chaining won't match ntSynt quality
  on the hardest divergent cases (acceptable — use Route A there).

### Route C — reimplement ntSynt's minimizer-graph algorithm
**Don't.** Substantial, and re-derives a maintained tool. Shell out (Route A) if
that specific quality is needed.

## Architecture: blocks are a zoom *tier*, not a replacement

Block data should **not** replace raw alignments — it's a coarser LOD tier:

- whole-genome / coarse `coarseBpPerPx` → serve **block** pif
- zoomed in → serve **raw** minimap2 pif (full CIGAR detail, the "frisson")

This is our existing **multi-tier format** pattern, and it's the legitimate home
for the adapter-level **`lodMode`** (`auto | fine | coarse`) already plumbed
RFC→RPC. `lodMode` selects the tier; it is **distinct** from the renderer fade
(which we deliberately kept `lodMode`-independent). The two compose:

- **blocks** kill the structural hairball at overview,
- **perpendicular fade** keeps whatever raw alignments still render at
  intermediate zooms honest.

## Recommendation

1. **Route B first** — a `make-pif --blocks` collinear-chaining pass emitting a
   block-level pif tier. No dependency, uses current data, fits `lodMode`
   tiering. A/B it against raw alignments on grape/peach and hs1/mm39.
2. **ntSynt as the quality reference** (and a Route-A importer later) for hard
   cross-species cases where pure PAF chaining isn't enough.
3. **Skip SyRI/plotsr for cross-species.** (A SyRI importer could still be a
   nice same-species/strain feature, but it's a separate, narrower use case.)

## Open questions

- Chaining parameters (max gap, diagonal tolerance, min block length) — expose
  per-comparison, or auto-derive? Prefer pixel/data-derived over hard bp.
- Where does chaining run — `make-pif` CLI (precompute, cached) vs a worker pass
  (live, no extra files)? CLI matches the multi-tier-on-disk model and avoids
  per-load cost.
- Block pif schema: reuse the `de:f:` identity tag convention? Carry a member
  count / classification (syntenic vs inverted) for coloring?
- Do we classify rearrangements (inversion/translocation/dup) like SyRI, or just
  emit collinear blocks + strand? Classification enables semantic coloring but
  adds scope.
- Multi-genome (>2) blocks (ntSynt's strength) vs pairwise — pif is pairwise
  today; n-way would need a different container.
