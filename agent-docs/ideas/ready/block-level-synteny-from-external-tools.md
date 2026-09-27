---
name: block-level-synteny-from-external-tools
description: Import or generate block-level synteny (chained collinear runs) as a zoom tier of the pif, not a replacement for the raw minimap2 rows — the tool landscape, three routes to a block-level pif, and why chaining (Route B) is what the coarse tier's strip-and-split pass does not do.
---

# Block-level synteny data from external tools

Split out of the synteny-comparative collection on 2026-09-27.

A coarse LOD *tier* (Route B's tiering architecture) ships —
[SYNTENY_LOD.md](../../reference/SYNTENY_LOD.md) — and true cross-row block
**chaining** (Route B's algorithm) does not.

**Important:** the coarse tier is a per-row *strip + split* pass, the opposite of the
block *merge* below. It coarsens each alignment individually; it does **not**
collapse runs of separate collinear alignments into blocks. The hairball's
structural cause (many separate small alignments) is untouched — only per-ribbon
CIGAR detail is dropped at overview. Route B's chaining is still the open work.

## The problem this addresses

Whole-genome synteny overviews render as a *hairball*: thousands of raw
minimap2 local alignments, each drawn as a ribbon, crisscrossing. We've
attenuated the **visual** symptom in the renderer (per-ribbon width-proportional
fade in the GPU fill shader + Canvas2D; sub-pixel decision keyed on
*perpendicular* width so steep diagonals stroke a clean 1px centerline), but the
structural cause is the *input*: we draw raw alignments, while the tools that
produce elegant plots (plotsr, ntSynt-viz, circos) draw **detected synteny
blocks** — a handful of large, classified regions collapsed by an upstream
analysis step before those tools ever drew a pixel. The renderer fade softens
the hairball for free but cannot truly declutter an all-to-all tangle of many
*separate* small alignments; that needs blocks. The two compose.

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

- **Route A — adopt a tool's block output (preprocessing).** Run ntSynt
  (cross-species) or MCScan as an external step; write a small block-import
  adapter reading its block TSV → pif. Highest-quality blocks, no algorithm to
  maintain; but external pipeline (not in-browser), ntSynt is a heavy
  Snakemake/C++/Python dependency, another format to parse.
- **Route B — own PAF collinear chaining (recommended first step).** The
  operation we literally want — "collapse a minimap2 PAF into block-level pif" —
  is collinear chaining, the internal stage of every tool above: sort by target;
  chain alignments whose query/target coords advance monotonically on a
  consistent strand within gap tolerances; emit one block per chain; break on
  strand flip / large gap / target jump. DAGchainer-style DP or greedy
  diagonal-merge. Organism-agnostic, **no new dependency**, consumes the PAF we
  already produce, slots in as `make-pif --blocks` (or `--merge`). We own the
  algorithm; pure-PAF chaining won't match ntSynt on the hardest divergent cases
  (acceptable — use Route A there).
- **Route C — reimplement ntSynt's minimizer-graph algorithm. Don't.**
  Substantial, and re-derives a maintained tool. Shell out (Route A) if that
  specific quality is needed.

## Architecture: blocks are a zoom *tier*, not a replacement

Block data should **not** replace raw alignments — it's a coarser LOD tier:
whole-genome / coarse `coarseBpPerPx` serves **block** pif; zoomed in serves
**raw** minimap2 pif (full CIGAR detail). This is our existing multi-tier format
pattern, and the legitimate home for the adapter-level `lodMode` already plumbed
RFC→RPC. `lodMode` selects the tier; it is **distinct** from the renderer fade
(deliberately kept `lodMode`-independent). Blocks kill the structural hairball at
overview; perpendicular fade keeps whatever raw alignments still render at
intermediate zooms honest.

## Recommendation & open questions

Route B first — a `make-pif --blocks` collinear-chaining pass emitting a
block-level pif tier (no dependency, uses current data, fits `lodMode` tiering;
A/B against raw alignments on grape/peach and hs1/mm39). ntSynt as the quality
reference (and a Route-A importer later) for hard cross-species cases. Skip
SyRI/plotsr for cross-species (a SyRI importer could still be a nice
same-species/strain feature — separate, narrower). Open: chaining parameters
(max gap, diagonal tolerance, min block length) exposed vs pixel/data-derived;
where chaining runs (`make-pif` CLI precompute vs live worker pass — CLI matches
the multi-tier-on-disk model); block-pif schema (reuse `de:f:` identity? carry a
member count / syntenic-vs-inverted classification for coloring?); classify
rearrangements like SyRI or emit collinear blocks + strand only; and multi-genome
(>2) blocks (ntSynt's strength) vs today's pairwise pif container.
