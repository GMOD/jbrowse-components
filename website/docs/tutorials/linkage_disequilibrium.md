---
title: Linkage disequilibrium
description: Read an LD triangle across a selective sweep and an inversion
guide_category: Tutorials
tutorial_category: Population genomics
---

Linkage disequilibrium (LD) is the tendency for nearby variants to be inherited
together. JBrowse draws it as a triangular heatmap of pairwise r² between SNPs:
**each red cell means two SNPs are almost always inherited together, white means
they are independent.** The triangle shows you where a chunk of chromosome moves
as a unit.

This tutorial reads a real example from the 1000 Genomes Project, computed live
in the browser from phased genotypes (no precomputed LD file), covers the second
way a block arises, and then covers the one thing people most often get wrong
about LD: its scale.

## What you need

Nothing to install. The example is computed live in the browser from hosted 1000
Genomes genotypes, and the figure below has a live link that opens the view.

## A selective sweep leaves a long haplotype

When positive selection drives one haplotype to high frequency quickly, every
SNP that happened to sit on that haplotype rides along with it. The result is a
long stretch of correlated SNPs. The classic human example is lactase
persistence: a regulatory variant upstream of the _LCT_ (lactase) gene swept
recently in dairying populations, dragging a long haplotype with it.

<Figure src="/img/ld/lct_lactase.png" caption="LD at the human lactase locus on hg19. The ClinVar lane marks rs4988235, the -13910 C>T variant in an MCM6 intron associated with lactase persistence. Below it is haplotypic r² computed from phased 1000 Genomes genotypes. The red block sits under that variant and fades into paler flanks on both sides."/>

Read the figure top to bottom and it makes one argument:

- **A causal variant.** ClinVar names rs4988235 as the lactase-persistence
  allele, an independent annotation, not something derived from the genotypes
  below it.
- **The block it dragged along.** The red triangle beneath it is the stretch of
  SNPs correlated with each other, all inherited as a unit.
- **Where the block ends.** The correlation fades into the paler flanks, where
  recombination has had time to break the haplotype apart.

That bounded shape is the point. Neutral variation doesn't build a block this
long at this frequency, because recombination erodes it. A long, common, sharply
bounded haplotype means it rose to frequency faster than recombination could
break it up, which is the signature of a recent selective sweep.

## An inversion suppresses recombination

An inversion produces a block for a different reason. Because the inverted and
standard arrangements cannot recombine in a heterozygote, the whole inverted
segment is inherited as one unit, so its SNPs stay correlated across the entire
region. The common 17q21.31 inversion (around the _MAPT_ gene) is the textbook
example: short-read SV callers miss the inversion itself, because segmental
duplications flank it, so the LD block is how you see it at all.

Read off the triangle alone, the two causes look the same. Telling them apart
takes something outside the r² matrix: an annotated causal variant (the ClinVar
lane above), a breakpoint call, or the karyotype of each sample. The
[population genomics tutorial](/docs/tutorials/population_genomics) does the
last of these for a fly inversion, genotyping the arrangement itself across the
panel.

## Marking where a block ends

Turn on the LD display's recombination track
([`showRecombination`](/docs/config/sharedlddisplay/#slot-showrecombination)) to
make block boundaries explicit: the 1 − r² curve between adjacent SNPs peaks in
the white gaps (LD breaking down) and dips inside the red blocks (SNPs locked
together). Open the figure above live and turn on **Show recombination track**
in the track menu to see the curve step down over the LCT block.

## LD is a local tool, so mind the scale

The single most useful thing to know about the LD triangle is what it _cannot_
show. It is a **local, kb-scale** view: it plots pairwise correlation between
the SNPs currently on screen, and pairwise r² decays with distance. It is
excellent for a haplotype block a few kb to a few hundred kb wide.

It is the wrong tool for a large, low-frequency structural variant. A megabase
inversion segregating at ~10% frequency (like the _Drosophila_ `In(2L)t`
inversion in the
[population genomics tutorial](/docs/tutorials/population_genomics)) barely
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

- **Computed live from a VCF**: attach an `LDDisplay` to a normal
  `VariantTrack`. r² is computed from the genotypes in the visible region, so no
  extra files are needed, and phased genotypes give exact haplotypic r². This is
  what the figure above uses.
- **Precomputed with PLINK**: for large cohorts, or to publish a fixed matrix,
  point an `LDTrack` at PLINK `--r2` output. This is the authoritative route
  when you want LD numbers that match a published analysis.

One display setting did most of the work in the figure above: the minor allele
frequency filter, raised to thin the dense 1000 Genomes SNPs to the common,
block-tagging ones, which also removes the noisy r² speckle from rare-allele
pairs.

## See also

- [Variant track](/docs/user_guides/variant_track)
- [GWAS / Manhattan track](/docs/user_guides/gwas_track)
- [Variant track configuration](/docs/config_guides/variant_track)
- [Gallery: variants and populations](/gallery/#variants)
