---
name: multi-sample-variant-display
description: De novo and compound-het review, haplotype-block coloring, frequency-weighted clustering and connector-line hover for the multi-sample variant displays.
---

# Multi-sample variant display

Ideas from an analysis of `LinearVariantDisplay`'s genotype rows in both their
layouts (`plugins/variants/src/LinearVariantDisplay/model.ts`). Read
`plugins/variants/src/CLAUDE.md` first — hot-loop rules and the fetch/layout/render
invalidation tiers constrain all of these.

**De novo and compound-het review on the pedigree.** `pedigreeLocation` is
built; the per-site Mendelian check moved to bcftools `+mendelian2`, whose
`INFO/MERR` the display colors and filters like any INFO field
([ADR-279](../../architecture-decision-records/adr-279-a-pedigree-feeds-a-per-site-mendelian-check-and-the-assembly-states-transmission.md)).
Reviewing a flagged site as a de novo mutation needs the
[genotype-quality masking](../ready/genotype-quality-masks-a-call-as-no-call.md)
first, since on low-coverage calls most such sites are genotyping
errors. Compound hets (two hets in one gene, one from each parent) are analysis
for an outside tool whose output loads as a track. The parked follow-up is
[stacking the trio's reads](../ready/stack-the-trios-reads-under-the-vcf.md).

**Local haplotype-block coloring (the mosaic a dendrogram cannot show).** Clustering
asks for one distance over the whole window, but a haplotype is a mosaic of segments
with different histories, so past the first recombination breakpoint that distance
describes no position in particular. `LinearVariantDisplay/anchoredHaplotypeSort.ts` addresses the
*ordering* half of this; the other half is expressing local structure in the cells
rather than the row order. Per (row, column), compute the id of the set of rows
identical over a window around that column and paint it with a stable hash color, rows
staying in whatever order they are in — a crossover then reads as a color change
mid-row. The block id is a per-cell value the worker ships beside the cells and
the main thread paints as a color mode ([ADR-203](../../architecture-decision-records/adr-203-the-variant-cells-hue-resolves-on-the-main-thread.md)), not new render
infrastructure.

Three things separate this from HaploBlocker, whose equivalent plot reads as confetti:
carry colors across columns (greedily match each column's partition to the previous
one's by membership overlap and inherit the id, rather than re-deriving blocks
independently); require a minimum block size in *both* variants and rows, painting
below-threshold blocks grey; and ship the cheap single-donor variant first — pick one
row as reference and paint every other row by match-length to it, which is one color
ramp, trivially computed, and already shows where each row's shared segment ends.

The principled version of the whole problem is that there is no one tree, there is an
ARG. A tree-sequence adapter (tsinfer / ARG-Needle `.trees`) supplying the local tree
at the view centre would let the existing sidebar render it unchanged, updating as you
pan.

**Frequency weighting for the clustering distance.** Every variant contributes equally
to the genotype-matrix distance, so the largest LD block in the window numerically
dominates the row ordering — a 10 kb window that is one haplotype block gives a clean
tree, a 1 Mb window gives mush, and neither states which locus it is describing. A
GCTA-style `1/sqrt(2p(1-p))` scaling would weight rare variants (informative about
recent shared ancestry) above common ones; it is a small change to the imputation pass
in `VariantRPC/genotypeMatrixEncoding.ts`, which already walks every site computing
per-site means. Deferred because it changes results and wants a UI knob (a
"Distance" choice next to the linkage selector) rather than a silent switch. LD
pruning is the same idea one level up and a bigger job.

**Matrix connector-line hover is thin and O(features)/mousemove.** In
`shared/ConnectorLines.tsx` the hover shows only the feature name and rescans
every line with `pointToSegmentDist` on each mousemove. Enrich the tooltip
(position / ref / alt) and add click-through to feature detail.
