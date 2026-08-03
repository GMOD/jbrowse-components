---
title: LD across an inversion (mosquitoes)
sidebar_label: LD across an inversion (mosquitoes)
description:
  Read precomputed PLINK LD over a 22 Mb inversion, and test whether a locus
  will show up before building the figure
guide_category: Tutorials
tutorial_category: Population genomics
---

**TL;DR:** scale is not the limit people assume. A 22 Mb inversion reads as one
block, from `plink --r2` output through an
[`LDTrack`](/docs/config/plinkldtabixadapter). What decides whether you see
anything is the panel, the allele frequency and the metric, and all three can be
tested before building a figure. The same inversion also loads as what it is, a
structural variant genotyped per mosquito, which is a different picture of the
same thing.

## Prerequisites

- the figure loads hosted data
- the [reproduce script](#reproduce-it-end-to-end) needs `plink` (1.9, not
  plink2), htslib (`bgzip`, `tabix`), `samtools`, `curl`, and `python3`

## An inversion is one block

Inverted and standard arrangements cannot recombine in a heterozygote, so
wherever both are present the whole segment stays correlated. The 2La inversion
in _Anopheles gambiae_ spans roughly 22 Mb of chromosome arm 2L, far past what
can be computed live from a VCF, so this LD is precomputed with PLINK and read
through [`PlinkLDTabixAdapter`](/docs/config/plinkldtabixadapter).

<Figure src="/img/ld/anopheles_2la.png" caption="Ag1000G chromosome arm 2L, the same window and settings throughout. Each population's r² heatmap sits above its own karyotype lane, one row per mosquito: 297 from Cameroon, 69 from Gabon. r² fills the published 2La extent in the Cameroon panel, whose lane shows both arrangements segregating. The Gabon panel is empty over that span, and its lane is nearly all standard homozygotes. Both panels carry a separate block at the low-coordinate end of the arm."/>

The heatmap's block comes out at the published breakpoint coordinates, so its
edges can be checked against them by eye — and against the karyotype lane below
it, whose cells are drawn at those same coordinates from a different file.

The Gabon panel is a control, not a second example. That population is not
inversion-free: 5 of its 69 mosquitoes are heterozygous, and they are the blue
rows at the bottom of its karyotype lane. What it lacks is enough of them for
the arrangement to hold the segment together, since the other 64 recombine
across it freely, so there is nothing to correlate over the 2La span. The panel
still carries a block at the low-coordinate end of the arm, near the
voltage-gated sodium channel, which says the display works and the 2La span is
genuinely uncorrelated rather than unread.

Read that panel as a statement about common variation, which is what it is made
of. Both files were built with a minor allele frequency floor, and in Gabon the
inverted arrangement sits far below it, so the variants tagging those five
carriers are not in the file. The claim the empty panel supports is that the
arrangement is too rare there to structure the common variants around it, not
that no correlated carrier haplotype exists.

## The rearrangement itself, per mosquito

What the heatmap draws is linkage, not the rearrangement. The two are worth
keeping apart, so the same inversion can also be loaded as what it is: a
structural variant, one `<INV>` record spanning the breakpoints, genotyped
across every mosquito in the two panels and loaded in the
[multi-sample variant display](/docs/user_guides/multivariant_track). A per-SNP
view cannot hold a 22 Mb feature on screen, and one SV call sidesteps that,
because the call is a single feature no matter how wide it is.

Use the regular multi-sample display rather than its matrix mode. Matrix mode
spaces one evenly sized column per variant, which discards the call's genomic
extent; the regular display draws each genotype at the call's true span, so the
carrier rows begin and end at the breakpoints. That is what the karyotype lanes
in the figure above are: cells shaded by allele dosage, each lane sorted into
standard, heterozygous and homozygous-inverted blocks. The `karyotype` column,
and so the legend, names those three classes by genotype: `2L+a/2L+a`
(standard/standard, the `+` marking the non-inverted arrangement), `2La/2L+a`
(heterozygous), `2La/2La` (inverted/inverted).

Load each population as a `VariantTrack` whose adapter carries the samples TSV,
with a `LinearMultiSampleVariantDisplay` that orders (`groupBy`) and colors
(`colorBy`) its rows by the `karyotype` column:

```json
{
  "type": "VariantTrack",
  "trackId": "ag1000g_2la_karyotype_cmgam",
  "name": "Cameroon, one row per mosquito",
  "assemblyNames": ["anoGam3"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://jbrowse.org/demos/popgen/ag1000g_2La_CMgam.vcf.gz",
    "samplesTsvLocation": {
      "uri": "https://jbrowse.org/demos/popgen/ag1000g_2La_CMgam_samples.tsv"
    }
  },
  "displays": [
    {
      "type": "LinearMultiSampleVariantDisplay",
      "groupBy": "karyotype",
      "colorBy": "karyotype",
      "referenceDrawingMode": "skip"
    }
  ]
}
```

Two settings there are doing real work.
[`groupBy`](/docs/config/linearmultisamplevariantdisplay/#slot-groupby) is what
keeps the karyotype classes contiguous; without it the rows keep the VCF's
column order and the split only reads as blocks by luck. And
[`referenceDrawingMode`](/docs/config/linearmultisamplevariantdisplay/#slot-referencedrawingmode)
is left on its default, `skip`, which colors the whole lane with the reference
color and paints only alt cells on top. The lane is then a solid grey field with
the carriers' blocks on it, and a standard-arrangement mosquito is grey rather
than blank. The alternative, `draw`, paints a grey cell per row at the call's
span instead — the same information, but as a rectangle striped by the gaps
between rows, which reads as a texture rather than as background.

There is no `rowHeight` here, because it is a display model property rather than
a config slot: rows divide the lane's height between them, so the lane height is
the row height. 297 mosquitoes in a 297-pixel lane get a pixel each. That is
also why one track per population rather than one track holding both — the
display draws a row for every sample in the file and has no sample filter, so
the file is the row set, and at a one-pixel row the sidebar has no space for a
text label, leaving the track header as the only place a population name can go.

### What is inferred here, and what is not

The inversion is not something this pipeline discovers. 2La is a cytologically
defined arrangement, both of its breakpoints have been cloned and sequenced
([Sharakhov et al. 2006](https://doi.org/10.1073/pnas.0509683103)), and a PCR
across the junctions karyotypes single mosquitoes, checked against polytene
cytology on field specimens
([White et al. 2007](https://doi.org/10.4269/ajtmh.2007.76.334)). The
coordinates the call is drawn at are that published extent.

What is inferred is each mosquito's karyotype, by scoring the tag SNPs of
[Love et al. 2019](https://doi.org/10.1534/g3.119.400445), the in-silico method
MalariaGEN ships for the current Ag3 release. Those tags were ascertained on
held-out Ag1000G samples and checked against specimens whose karyotypes had been
read off polytene chromosomes, so the inference has an orthogonal reference to
be wrong against. The score itself is the mean number of alternate alleles
across the tags, and it is only worth rounding into a genotype because it comes
out trimodal with empty space between the peaks. The
[reproduce script](#reproduce-it-end-to-end) prints that histogram, so the
property can be checked rather than taken on trust.

The same script prints the karyotype breakdown per population, which is the
independent check on the heatmaps above: the panel that shows a block is the one
segregating both arrangements, and the flat panel is the one near-fixed for the
standard arrangement. If those disagreed, the heatmap figure would be the thing
to doubt.

## Will your locus show up at all?

A blank or washed-out triangle usually means the locus was never going to show.
Four checks, all cheap, and the [reproduce script](#reproduce-it-end-to-end)
prints the numbers for each:

- **Is there variation left?** A sweep that went to fixation leaves almost no
  common variants to correlate. Compare common-variant density at your locus
  against a neutral window in the same panel.
- **Is the feature segregating in this panel?** Compare long-range LD inside a
  candidate span against an equally distant control. A population fixed for
  either arrangement can never show a block.
- **Is the background already high?** A bottlenecked panel can show a healthy
  inside/outside ratio while its whole arm renders red. Read the absolute
  background, not only the ratio.
- **Is the feature really two alleles?** r² is a two-allele statistic. Where
  several haplotypes segregate at one locus they fragment the correlation, which
  is why insecticide-resistance alleles at _Vgsc_ produce no block in this data
  even though the sweep is real.

## Pick the metric before you blame the data

r² and D' disagree about the same data. D' runs higher inside a block but also
tints the region outside it, while r² collapses to near zero there. Contrast
against background is what makes a block legible, not how bright its cells are,
so r² usually draws the sharper boundary despite looking dimmer. Switch with
[`ldMetric`](/docs/config/sharedlddisplay/#slot-ldmetric); the reproduce script
prints both ratios for every panel.

Raising the minor allele frequency filter
([`minorAlleleFrequencyFilter`](/docs/config/sharedlddisplay/#slot-minorallelefrequencyfilter))
thins dense callsets to the common, block-tagging variants. Push it too high and
it deletes the tagging variants themselves, so the block fades.

## Reproduce it end to end

[`build_ag1000g_ld.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_ag1000g_ld.sh)
downloads the phased haplotypes, runs each check above and prints the result,
builds the tabix-indexed `.ld.gz` tracks and the per-mosquito karyotype calls,
and writes a `config.json` opening on the inversion:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_ag1000g_ld.sh
bash build_ag1000g_ld.sh              # writes ./ag1000g_ld_build/jbrowse2
npx --yes serve ag1000g_ld_build/jbrowse2
```

The numbers it prints are how the panel and the metric were chosen, so another
locus can be assessed the same way.

Data is Ag1000G phase 2 AR1, whose terms of use were lifted in March 2022. Cite
the release: Anopheles gambiae 1000 Genomes Consortium, "Genome variation and
population structure among 1142 mosquitoes of the African malaria vector species
Anopheles gambiae and Anopheles coluzzii", Genome Research 2020;30:1533-1548.

## Making an LD track from your own data

Two ways to supply the data, both in the
[variant track config guide](/docs/config_guides/variant_track#linkage-disequilibrium-ld-display):

- **Computed live from a VCF**: attach an `LDDisplay` to a `VariantTrack`. No
  extra files, and phased genotypes give exact haplotypic r². This is what
  [](/docs/tutorials/ld_human) uses.
- **Precomputed with PLINK**: point an `LDTrack` at `plink --r2` output, which
  is the only option once the region is larger than a VCF's genotypes can be
  correlated on the fly.

Note that `plink --r2 dprime` does not merely add a column: the modifier also
switches r² itself to the haplotype-frequency estimate. plink2 removed `--r2`
and splits it into `--r2-phased` and `--r2-unphased`.

## See also

- [](/docs/tutorials/ld_human)
- [](/docs/user_guides/variant_track)
- [Variant track configuration](/docs/config_guides/variant_track)
- [Gallery: variants and populations](/gallery/#variants)
