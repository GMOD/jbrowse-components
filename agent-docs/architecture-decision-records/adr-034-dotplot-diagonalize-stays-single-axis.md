# ADR-034: Dotplot/synteny auto-diagonalize stays single-axis; both-axis seriation rejected

## Status

Accepted. Both-axis ("seriate both arrays") layout — including a faithful
mummerplot `--layout` recursive-spanning implementation — is **Rejected** for
the reference-vs-assembly case that motivated it. It is **Deferred** (not
foreclosed) for de-novo-vs-de-novo, where it is the only option that orders both
unordered axes.

## Context

`autoDiagonalize` reorders the panels of a dotplot / stacked synteny view so the
primary alignment forms a clean diagonal. `diagonalizeRegions`
(`packages/core/src/util/diagonalizeRegions.ts`) reorders **one** of the two
`displayedRegions` arrays (the "free" axis) and holds the other (the "fixed"
axis) as the anchor: for each free-axis sequence it picks the fixed-axis
sequence holding the most aligned bases, then sorts the free axis by
`(fixedSeqIndex, weightedPositionAlongFixedSeq)`, flipping a sequence whose
dominant strand is negative.

A screenshot-review note on `sv_cgiab/dotplot_result` (HG008T.hap1 assembly vs
GRCh38, whole-genome PIF) — _"autodiagonalize is pretty good but there are
significant off-diagonals; compare against mummerplot"_ — raised the question of
whether reordering **both** axes (seriation) would produce a cleaner single
diagonal. A prior session concluded it would and wrote a handoff targeting a
mummerplot recursive-spanning both-axis layout (an earlier greedy-span +
barycenter attempt had been reverted for producing an offset staircase).

## Decision

**Keep `autoDiagonalize` single-axis. Do not build a both-axis path for
reference-vs-assembly.** The existing algorithm already yields a clean diagonal;
the only real tuning lever is *axis orientation* — which axis is held fixed —
and that is a per-view spec/config choice, not an algorithm change. For a
fragmented-assembly-vs-reference plot, hold the axis that has a meaningful order
(the karyotype reference) fixed and reorder the fragmented assembly. That is the
current `sv_cgiab/dotplot_result` spec and it is correct as-is.

## Reasoning

Established against the real PIF and the real WebGL render pipeline (prototype
scripts + proof renders were kept in `agent-docs/dotplot-diagonalize-analysis/`
during the investigation and deleted once this ADR captured the conclusion).

### Single-axis reorder always produces a clean diagonal

Because the free axis is sorted to *follow whatever order the fixed axis is in*
(`fixedSeqIndex` is the primary sort key), the diagonal co-varies with the fixed
axis and stays clean **regardless of how scrambled the fixed axis is**. A
doubly-scrambled reference (randomly permuted *and* reverse-oriented) still
diagonalized cleanly in the prototype. In the real renderer, the two
orientations of the sv_cgiab plot — reorder the GRCh38 axis vs reorder the hap1
axis — both produced the same clean diagonal; they differed *only* in which axis
stayed readable (reordering GRCh38 left it as `chr10, chr16, chr12, chr8…`
instead of `chr1→chrY`). The diagonal quality was never the problem, so there is
nothing for a both-axis algorithm to improve.

### The residual off-diagonals are real data, not a layout defect

~91% of aligned bases already sit on each chromosome's single best contig. The
~9% off-diagonal is genuine many-to-many structure (a chromosome split across
two contigs; a contig spanning two chromosomes). A contig is a single interval
on its axis: if it maps to two separated chromosomes, one hit is *always*
off-diagonal unless the sequence is split into blocks — which mummerplot does
not do either. No reordering, single- or both-axis, removes these dots.

### Full both-axis spanning is worse for reference-vs-assembly

GRCh38 in karyotype order is already a good seriation. Recursive spanning
reorders the reference by alignment connectivity, which (a) scrambles that
readable axis and (b) empirically introduced *more* staircase steps than
single-axis, not fewer. The one genuinely missing ingredient in the earlier
failed both-axis attempts — reducing to significant (near one-to-one) edges
*before* spanning — made the braid coherent but still did not beat holding the
good axis fixed.

### The earlier "Option C staircases" verdict was a prototype bug

The prior handoff rejected the readable-axis orientation ("Option C") as a
staircase. That came from a throwaway prototype that sorted the free axis by
best-fixed-seq *index only*, dropping the position-along-fixed-seq tiebreak.
Production `diagonalizeRegions` sorts by weighted position, so it renders as a
coherent diagonal. The orientation was fine all along; only the prototype was
wrong. Metric caution still holds: mean-distance-to-diagonal is a poor proxy for
"one clean line" (a barycenter attempt lowered it while looking worse) — judge
diagonalization visually.

### Why the synteny path also stays single-axis

`diagonalizeRegions` is shared with `LinearSyntenyView`'s pinned-reference
cascade (each stacked level's top row is fixed by the level above — a downward
Sugiyama layer-sweep). Reordering both axes there would break the cascade, so
any future both-axis work must be a **separate, dotplot-only** function
(`diagonalizeRegionsBothAxes`) and leave the shared single-axis function
untouched.

## Consequences

- No product code change. `autoDiagonalize` and `diagonalizeRegions` are
  unchanged; the sv_cgiab dotplot spec keeps the karyotype reference on the
  fixed axis.
- The improvement lever for a bad-looking auto-diagonalized plot is to check
  **which axis is fixed**, not to reach for a fancier algorithm.
- **Deferred:** de-novo-assembly-vs-de-novo-assembly (neither axis pre-ordered)
  is the only case where both-axis seriation adds value — a self-consistent
  spanning order for *both* contig sets. If ever built, do it as a separate
  dotplot-only `diagonalizeRegionsBothAxes` with **best-hit edge reduction
  before spanning**, and validate the diagonal visually rather than by a scalar.

## Related

- ADR-010 (synteny/dotplot pixel offsets)
- ADR-012 (synteny worker output split)
- ADR-033 (synteny/dotplot LOD — prune at data layer)
