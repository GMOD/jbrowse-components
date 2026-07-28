---
title: Linkage disequilibrium
description: Read an LD triangle across a selective sweep and an inversion
guide_category: Tutorials
tutorial_category: Population genomics
---

**TL;DR:** JBrowse computes an LD triangle live from phased genotypes and draws
pairwise r² as a heatmap. The one thing to get right is scale: the triangle is a
kb-scale local tool, not a way to see megabase structural variants.

Linkage disequilibrium (LD) is the tendency for nearby variants to be inherited
together. JBrowse draws it as a triangular heatmap of pairwise r² between SNPs:
**each red cell means two SNPs are almost always inherited together, white means
they are independent.** The triangle shows you where a chunk of chromosome moves
as a unit.

## A selective sweep leaves a long haplotype

When positive selection drives one haplotype to high frequency quickly, every
SNP on it rides along, producing a long stretch of correlated SNPs. The classic
example is lactase persistence: a regulatory variant near _LCT_ swept recently
in dairying populations.

<Figure src="/img/ld/lct_lactase.png" caption="LD at the human lactase locus on hg19. The ClinVar lane marks rs4988235, the -13910 C>T variant in an MCM6 intron associated with lactase persistence. Below it is haplotypic r² computed from phased 1000 Genomes genotypes, with the recombination track (1 - r² between adjacent SNPs) above the triangle. The red block sits under that variant and fades into paler flanks on both sides, where the recombination curve rises."/>

- **Causal variant:** ClinVar's rs4988235 annotation, independent of the
  genotypes below it.
- **The block it dragged along:** the red triangle of correlated SNPs.
- **Where it ends:** correlation fades into paler flanks as recombination breaks
  the haplotype apart.

A block this long and common only forms when a haplotype rises faster than
recombination can break it up: the signature of a recent sweep.

## An inversion suppresses recombination

An inversion produces a block for a different reason: inverted and standard
arrangements can't recombine in a heterozygote, so the whole segment stays
correlated. The 17q21.31 inversion (around _MAPT_) is the textbook case:
segmental duplications hide it from short-read SV callers, so the LD block is
how you see it at all.

The two causes look identical in the triangle alone. Telling them apart needs
something outside the r² matrix: an annotated causal variant, a breakpoint call,
or each sample's karyotype, as in the
[population genomics tutorial](/docs/tutorials/population_genomics)'s fly
inversion.

## Marking where a block ends

The blue curve above the triangle is the recombination track
([`showRecombination`](/docs/config/sharedlddisplay/#slot-showrecombination)): 1
− r² between adjacent SNPs, peaking in the white gaps and dipping inside the red
blocks, the block boundaries made explicit.

## LD is a local tool, so mind the scale

The triangle is a **local, kb-scale** view: it plots pairwise correlation
between the SNPs on screen, and r² decays with distance, excellent for a
haplotype block a few kb to a few hundred kb wide, the wrong tool for a large,
low-frequency structural variant.

A megabase inversion at low frequency (like the _Drosophila_ `In(2L)t` inversion
in the [population genomics tutorial](/docs/tutorials/population_genomics))
barely registers: SNPs still recombine normally within any local window, and the
sparse diagnostic SNPs carrying the long-range signal are diluted by the common
ones around them. A **windowed scan** catches it instead (Fst spikes across the
whole region), because it integrates one statistic over a large window rather
than SNP-pair correlation. Triangle for a kb-scale haplotype block, windowed
scan for an Mb-scale structural variant or broad sweep.

## Making an LD track from your own data

Two ways to supply the data, covered in full in the
[variant track config guide](/docs/config_guides/variant_track#linkage-disequilibrium-ld-display):

- **Computed live from a VCF**: attach an `LDDisplay` to a `VariantTrack`. r² is
  computed from the visible region's genotypes, no extra files needed; phased
  genotypes give exact haplotypic r² (what the figure above uses).
- **Precomputed with PLINK**: point an `LDTrack` at PLINK `--r2` output, for
  large cohorts or to match numbers from a published analysis.

One setting did most of the work above: raising the minor allele frequency
filter thins the dense 1000 Genomes SNPs to the common, block-tagging ones,
which also removes rare-allele r² speckle.

## See also

- [](/docs/user_guides/variant_track)
- [](/docs/user_guides/gwas_track)
- [Variant track configuration](/docs/config_guides/variant_track)
- [Gallery: variants and populations](/gallery/#variants)
