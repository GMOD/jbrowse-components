---
name: multi-sample-variant-display
description: Genotype-quality masking, pedigree awareness, `featureColor` presets, and haplotype-block coloring for the multi-sample variant displays.
---

# Multi-sample variant display

Ideas from an analysis of `LinearMultiSampleVariantDisplay` /
`LinearMultiSampleVariantMatrixDisplay` (both share
`plugins/variants/src/shared/MultiSampleVariantBaseModel.ts`). Read
`plugins/variants/src/CLAUDE.md` first — hot-loop rules and the fetch/layout/render
invalidation tiers constrain all of these.

**Opt-in genotype-quality masking/dimming (biggest untapped signal).** The
GT-only fast path (`feature.processGenotypes`, `shared/alleleCounts.ts`) never
surfaces DP/GQ/AD/PL — getting them requires the heavier `feature.get('samples')`
escalation the PS-phasing coloring already takes
(`computeVariantMatrixCells.ts:99`). MVP: a `genotypeQualityThreshold` config
slot (default `0` = off = today's path unchanged); when set, a genotype with
`GQ < threshold` renders as no-call grey instead of its allele color — masking
chosen over continuous dimming because it reuses the existing no-call rendering
end-to-end (no shader/legend work). Bake the decision into the existing
`cellColors` `Uint32Array` worker-side (same place `featureColor` already
applies) — no new per-cell arrays, no shader change, no bigger payload. It's a
**fetch input** (belongs in `rpcProps()`), threaded through
`VariantRPC/executeVariantCellData.ts` into both `computeVariantCells.ts` and
`computeVariantMatrixCells.ts`, with a menu entry (presets GQ ≥ 20/≥ 30 + custom
dialog) cloned from `createMAFFilterMenuItem` under the "Filter by" submenu.
Open question: whether masking should also feed the MAF filter (a masked het
shouldn't count toward AF) — couples to `minorAlleleFrequencyUtils.ts`, defer
past the independent MVP. Same plumbing then unlocks **VAF coloring from AD**
(color het cells by allelic fraction — a somatic/mosaic cohort view) and the
`featureColor` presets below (cheaper still, no new RPC field). `sampleInfo`
(per-sample `maxPloidy`/`isPhased`) is already computed and shipped but only
used internally for haplotype expansion — never surfaced to the user.

**Pedigree / inheritance awareness (biggest biological ceiling).** There is no
pedigree, affected-status, or trio model today — "grouping" is a flat `colorBy` on
arbitrary `samplesTsv` columns (`shared/variantLegend.ts::getSampleGroupLegendItems`).
If the sample metadata carried `father`/`mother`/`affected`, the per-sample genotypes
(already fetched) are enough to compute and highlight **de novo mutations**, **compound
hets**, and **Mendelian-error sites**. Aligns with the existing trio-crossover work.
Large but high-value; start by defining the pedigree metadata shape (columns in
`samplesTsv`, or a dedicated pedigree file) and a worker-side per-site classification
that bakes a highlight color into the existing `cellColors` array (same
bake-into-color discipline as `featureColor`), rather than a new render pass.

**More `featureColor` presets (cheapest wins — no new RPC field).** `featureColor`
already supports arbitrary jexl plus one built-in preset (consequence impact,
`shared/variantConsequence.ts`, surfaced in the "Color cells by" menu). These read
`INFO` fields the feature already carries, so they are near-clones of the consequence
preset with zero worker-plumbing changes:
- **gnomAD / AF rarity** — color by `INFO/AF` or `AF_popmax` so ultra-rare variants pop
  (the classic cohort-filtering read).
- **ClinVar significance** — `INFO/CLNSIG` → pathogenic/benign tiers.
- **Specific SO consequence** — missense vs synonymous vs LOF, not just the 4 impact
  tiers `getVariantImpact` currently collapses to.
Each is a new entry alongside `CONSEQUENCE_IMPACT_JEXL` plus a legend key.

**Per-site summary strip.** Carrier count / allele frequency / call-rate per
site, as a band above the rows. Designed in
[a-per-site-summary-strip-is-a-scalar-band-on-the-coverage-anchor](a-per-site-summary-strip-is-a-scalar-band-on-the-coverage-anchor.md),
which is also the second consumer the coverage y anchor has been waiting for.

**Filter & sort samples by metadata attribute.** Since 2026-08-25 a `colorBy`
group's legend swatch focuses that group (`focusGroup`, over `subtreeFilter`),
and the genotype sort has a column-anchored form a session can name
(`sortRowsByGenotypeAt` / `sortRowsBy`). What is still missing is a predicate
over `samplesTsv` columns — *cases only, in EUR* — and a metadata SORT (order
by a column, not by a genotype); `row-display-followups.md` prices the filter
dialog and why it wants a slot of its own rather than the name set.

**Local haplotype-block coloring (the mosaic a dendrogram cannot show).** Clustering
asks for one distance over the whole window, but a haplotype is a mosaic of segments
with different histories, so past the first recombination breakpoint that distance
describes no position in particular. `shared/anchoredHaplotypeSort.ts` addresses the
*ordering* half of this; the other half is expressing local structure in the cells
rather than the row order. Per (row, column), compute the id of the set of rows
identical over a window around that column and paint it with a stable hash color, rows
staying in whatever order they are in — a crossover then reads as a color change
mid-row. The plumbing already exists: `computeVariantCells.ts` ships a per-cell
`cellColors: Uint32Array`, so this is a worker-side computation plus a color mode, not
new render infrastructure (same bake-into-color discipline as `featureColor`).

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

**Unread: [LDZip](https://github.com/23andMe/LDZip)** (23andMe), LD-aware
genotype compression. Carried over unevaluated from a `search-misc` note; filed
here because `VariantRPC/genotypeMatrixEncoding.ts` is the encoding it would
bear on. Nobody has looked at whether it is a wire format, a storage format, or
neither for us.

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
`LinesConnectingMatrixToGenomicPosition.tsx` the hover shows only `feature.get('name')`
and rescans every line with `pointToSegmentDist` on each mousemove
(`AllLines.onMouseMove`, ~:160-190); `getLineGeometry` is recomputed by several sibling
components each render, and the crosshair-line and hovered-line are separate code paths
computing the same `idx*w + w/2` geometry. Enrich the tooltip (position / ref / alt),
add click-through to feature detail, and dedupe the geometry.

**Matrix ref/no-call cells are silently non-interactive.** Hover requires a decoded
genotype (`LinearMultiSampleVariantMatrixDisplay/components/VariantMatrixComponent.tsx:86`),
so blank grid regions give no tooltip — reads as "the UI is dead here." Small fix.

**Bug: multiallelic sites lose their VCF description.** `shared/buildVariantHit.ts:51`
overwrites the real `description` with the literal `'multiple ALT alleles'` when
`alt.length >= 3`, discarding the actual annotation. Straightforward correctness fix.

**jb2export population coloring (`samplesTsv:` modifier).** The multi-sample variant
matrix now renders real 1000 Genomes data correctly in jb2export — the old "static SSR
renders the genotype matrix empty for real data" blocker was **stale** (verified by
rendering both `display:multivariant` and `display:multivariantmatrix` against
`ALL.chr11.phase3…genotypes.vcf.gz` → full 2,504-sample matrix). The remaining gap for the
flagship figure is `colorBy:'population'`: it needs the VCF adapter's `samplesTsv`
(sample→population map), which the CLI can't yet pass. Add a `samplesTsv:<uri>` track
modifier → `samplesTsvLocation` on the adapter so a genome-wide callset can be colored by
super-population instead of reading as reference-dominant grey.
