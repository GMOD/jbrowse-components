---
title: Linkage disequilibrium
description:
  Read an LD triangle, see a selective sweep and an inversion, and know when LD
  is the wrong tool
guide_category: Tutorials
tutorial_category: Population genomics
---

Linkage disequilibrium (LD) is the tendency for nearby variants to be inherited
together. JBrowse draws it as a triangular heatmap of pairwise r² between SNPs:
**each red cell means two SNPs are almost always inherited together, white means
they are independent.** The triangle shows you where a chunk of chromosome moves
as a unit.

This tutorial reads two real examples from the 1000 Genomes Project, both
computed live in the browser from phased genotypes (no precomputed LD file), then
covers the one thing people most often get wrong about LD: its scale.

## A selective sweep leaves a long haplotype

When positive selection drives one haplotype to high frequency quickly, every
SNP that happened to sit on that haplotype rides along with it. The result is a
long stretch of correlated SNPs. The classic human example is lactase
persistence: a regulatory variant upstream of the _LCT_ (lactase) gene swept
recently in dairying populations, dragging a long haplotype with it.

<Figure src="/img/ld/lct_lactase.png" caption="LD at the human lactase locus (LCT/MCM6), computed live from phased 1000 Genomes genotypes (exact r², common SNPs). The red block over the highlighted gene is the long haplotype left by recent positive selection for lactase persistence — its SNPs travel as a unit — and you can see LD decay into the lighter flanks on either side."/>

Read it as a block: the SNPs inside the red triangle are correlated with each
other, and that correlation fades as you move into the paler flanks, where
recombination has had time to break the haplotype apart.

The triangle summarizes those correlations; you can also look at the haplotypes
themselves. Load the same phased genotypes as a multi-sample variant matrix and
turn on genotype clustering, and the samples reorder so co-inherited haplotypes
group into contiguous bands:

<Figure src="/img/ld/lct_haplotype_matrix.png" caption="The haplotypes behind the LCT block: the same phased 1000 Genomes slice drawn as a multi-sample variant matrix (one column per variant, one row per each of the 2504 samples), with rows clustered by genotype similarity. Co-inherited haplotypes fall into contiguous horizontal bands rather than scattering row to row, and the large shared block of alternate alleles (dark blue) is the swept lactase-persistence haplotype that the r² triangle renders as a solid corner. Gene models (LCT, MCM6) sit above for context."/>

Each band is a set of samples carrying the same stretch of alleles. The big
block is the lactase-persistence haplotype: the same unit the r² triangle shows
as correlation, here shown as the actual shared sequence across people.

## An inversion suppresses recombination

An inversion produces a block for a different reason. Because the inverted and
standard arrangements cannot recombine in a heterozygote, the whole inverted
segment is inherited as one unit, so its SNPs stay correlated across the entire
region. The common 17q21.31 inversion (around the _MAPT_ gene) shows this
cleanly.

<Figure src="/img/ld/mapt_17q21_inversion.png" caption="LD across the common 17q21.31 inversion (human, 1000 Genomes). Red triangular blocks are haplotypes inherited as units; the blue recombination track on top (1 − r² between adjacent SNPs) peaks at the white gaps between them, marking where LD breaks down. The recombination-suppressed inverted segment reads as an extended block."/>

The blue recombination track along the top makes the boundaries explicit: it
peaks in the white gaps (adjacent SNPs uncorrelated, LD breaking down) and dips
inside the red blocks (adjacent SNPs locked together).

## LD is a local tool — mind the scale

The single most useful thing to know about the LD triangle is what it _cannot_
show. It is a **local, kb-scale** view: it plots pairwise correlation between the
SNPs currently on screen, and pairwise r² decays with distance. It is excellent
for a haplotype block a few kb to a few hundred kb wide.

It is the wrong tool for a large, low-frequency structural variant. A megabase
inversion segregating at ~10% frequency — like the _Drosophila_ `In(2L)t`
inversion in the
[population genomics tutorial](/docs/tutorials/population_genomics) — barely
registers in a pairwise LD triangle: within any local window the SNPs recombine
normally, only the sparse arrangement-diagnostic SNPs carry the long-range
signal, and they are diluted to invisibility by the common SNPs around them.

That inversion is obvious to a **windowed scan** (Fst between arrangements spikes
across the whole inverted region) precisely because a scan integrates one
statistic over a large window rather than measuring SNP-pair correlation. LD
triangles and windowed scans (Fst, π, Tajima's D) are complementary: reach for
the triangle at the kb scale of a haplotype block, and for a windowed scan at the
Mb scale of a structural variant or a broad sweep.

## Making an LD track from your own data

Two ways to supply the data, covered in full in the
[variant track config guide](/docs/config_guides/variant_track#linkage-disequilibrium-ld-display):

- **Computed live from a VCF** — attach an `LDDisplay` to a normal
  `VariantTrack`. r² is computed from the genotypes in the visible region, so no
  extra files are needed, and phased genotypes give exact haplotypic r². This is
  what both figures above use.
- **Precomputed with PLINK** — for large cohorts, or to publish a fixed matrix,
  point an `LDTrack` at PLINK `--r2` output. This is the authoritative route when
  you want LD numbers that match a published analysis.

Two display settings did most of the work in the figures above: the minor allele
frequency filter (raised to thin the dense 1000 Genomes SNPs to the common,
block-tagging ones — this also removes the noisy r² speckle from rare-allele
pairs) and the recombination track toggle used on the inversion figure.
