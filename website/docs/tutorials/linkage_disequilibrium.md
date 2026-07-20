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
computed live in the browser from phased genotypes (no precomputed LD file),
then covers the one thing people most often get wrong about LD: its scale.

## A selective sweep leaves a long haplotype

When positive selection drives one haplotype to high frequency quickly, every
SNP that happened to sit on that haplotype rides along with it. The result is a
long stretch of correlated SNPs. The classic human example is lactase
persistence: a regulatory variant upstream of the _LCT_ (lactase) gene swept
recently in dairying populations, dragging a long haplotype with it.

<Figure src="/img/ld/lct_lactase.png" caption="LD at the human lactase locus on hg19. The ClinVar lane marks rs4988235 (LACTASE PERSISTENCE) — the −13910 C>T enhancer variant in an MCM6 intron that keeps LCT switched on into adulthood. Below it, exact haplotypic r² computed live from phased 1000 Genomes genotypes: the solid red block sits directly under that variant and fades into paler flanks on both sides. One variant swept, and the whole block of neighbouring SNPs went with it."/>

Read the figure top to bottom and it makes one argument:

1. **A causal variant.** ClinVar names rs4988235 as the lactase-persistence
   allele — an independent annotation, not something derived from the genotypes
   below it.
2. **The block it dragged along.** The red triangle beneath it is the stretch of
   SNPs correlated with each other, all inherited as a unit.
3. **Where the block ends.** The correlation fades into the paler flanks, where
   recombination has had time to break the haplotype apart.

That bounded shape is the point. Neutral variation doesn't build a block this
long at this frequency — recombination erodes it. A long, common, sharply
bounded haplotype means it rose to frequency faster than recombination could
break it up, which is the signature of a recent selective sweep.

## An inversion suppresses recombination

An inversion produces a block for a different reason. Because the inverted and
standard arrangements cannot recombine in a heterozygote, the whole inverted
segment is inherited as one unit, so its SNPs stay correlated across the entire
region. The common 17q21.31 inversion (around the _MAPT_ gene) is the textbook
example: short-read SV callers miss the inversion itself, because segmental
duplications flank it, so the LD block is how you see it at all.

Turn on the LD display's recombination track (`showRecombination`) to make block
boundaries explicit: the 1 − r² curve between adjacent SNPs peaks in the white
gaps (LD breaking down) and dips inside the red blocks (SNPs locked together).

## LD is a local tool — mind the scale

The single most useful thing to know about the LD triangle is what it _cannot_
show. It is a **local, kb-scale** view: it plots pairwise correlation between
the SNPs currently on screen, and pairwise r² decays with distance. It is
excellent for a haplotype block a few kb to a few hundred kb wide.

It is the wrong tool for a large, low-frequency structural variant. A megabase
inversion segregating at ~10% frequency — like the _Drosophila_ `In(2L)t`
inversion in the
[population genomics tutorial](/docs/tutorials/population_genomics) — barely
registers in a pairwise LD triangle: within any local window the SNPs recombine
normally, only the sparse arrangement-diagnostic SNPs carry the long-range
signal, and they are diluted to invisibility by the common SNPs around them.

That inversion is obvious to a **windowed scan** (Fst between arrangements
spikes across the whole inverted region) precisely because a scan integrates one
statistic over a large window rather than measuring SNP-pair correlation. LD
triangles and windowed scans (Fst, π, Tajima's D) are complementary: reach for
the triangle at the kb scale of a haplotype block, and for a windowed scan at
the Mb scale of a structural variant or a broad sweep.

## Making an LD track from your own data

Two ways to supply the data, covered in full in the
[variant track config guide](/docs/config_guides/variant_track#linkage-disequilibrium-ld-display):

- **Computed live from a VCF** — attach an `LDDisplay` to a normal
  `VariantTrack`. r² is computed from the genotypes in the visible region, so no
  extra files are needed, and phased genotypes give exact haplotypic r². This is
  what both figures above use.
- **Precomputed with PLINK** — for large cohorts, or to publish a fixed matrix,
  point an `LDTrack` at PLINK `--r2` output. This is the authoritative route
  when you want LD numbers that match a published analysis.

Two display settings did most of the work in the figures above: the minor allele
frequency filter (raised to thin the dense 1000 Genomes SNPs to the common,
block-tagging ones — this also removes the noisy r² speckle from rare-allele
pairs) and the recombination track toggle used on the inversion figure.
