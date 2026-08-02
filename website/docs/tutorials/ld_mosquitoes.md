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
tested before building a figure.

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

<Figure src="/img/ld/anopheles_2la.png" caption="Ag1000G chromosome arm 2L, the same window and settings in both panels. r² fills the published 2La extent in the Cameroon panel and there is nothing there in the Gabon panel. Both panels carry a separate block at the low-coordinate end of the arm."/>

The band comes from the published breakpoint coordinates, so the block's edges
can be checked against them by eye.

The lower panel is a control, not a second example: that population is
effectively fixed for one arrangement, so it has nothing to correlate there. It
still carries a block at the low-coordinate end of the arm, near the
voltage-gated sodium channel, which says the display works and the banded region
is genuinely uncorrelated rather than unread.

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
builds the tabix-indexed `.ld.gz` tracks, and writes a `config.json` opening on
the inversion:

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
