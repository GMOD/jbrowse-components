---
title: Linkage disequilibrium
description:
  Read an LD triangle, and find out first whether your locus will show up in one
guide_category: Tutorials
tutorial_category: Population genomics
---

**TL;DR:** JBrowse draws pairwise LD as a triangular heatmap, either computed
live from phased genotypes or read from precomputed PLINK output. Scale is not
the limit people assume: a 22 Mb inversion reads as one block. What actually
decides whether you see anything is the panel, the allele frequency, and the
metric, and you can test all three before you build a figure.

## Prerequisites

- the two figures below load hosted data
- the [reproduce script](#reproduce-it-end-to-end) needs `plink` (1.9, not
  plink2), htslib (`bgzip`, `tabix`), `samtools`, `curl`, and `python3`

## Reading the triangle

A red cell means two variants are almost always inherited together and white
means they are independent, so the triangle shows where a chunk of chromosome
travels as a unit. The [`LDDisplay`](/docs/config/sharedlddisplay/) is
per-population by construction: LD is a correlation across whatever samples you
hand it.

## A selective sweep leaves a long haplotype

When selection drives one haplotype to high frequency quickly, every variant on
it rides along, leaving a stretch of correlated variants. Lactase persistence is
the classic example.

<Figure src="/img/ld/lct_lactase.png" caption="LD at the human lactase locus on hg19. The ClinVar lane marks rs4988235; below it is haplotypic r² computed live from phased 1000 Genomes genotypes, with the recombination track above the triangle. The solid block covers the banded gene and ends where the recombination curve spikes."/>

The blue curve is the recombination track
([`showRecombination`](/docs/config/sharedlddisplay/#slot-showrecombination)), 1
− r² between adjacent variants. It sits near zero across the block and spikes
outside it, marking the block's edges.

### Compute LD within one panel

r² is a correlation across whatever samples you hand it, so pointing the display
at a whole callset is the first thing to get wrong.

<Figure src="/img/ld/lct_pooled_vs_panel.png" caption="The same locus, window and MAF floor twice, differing only in which samples went in. Pooling every panel breaks the block into a mosaic and leaves the recombination curve spiky throughout; one panel resolves it into a single block with the curve flat across it."/>

Nothing about the display changed between those two lanes. Subset the VCF first:

```bash
bcftools view -S panel.samples --force-samples -Oz -o panel.vcf.gz all.vcf.gz
tabix -p vcf panel.vcf.gz
```

The same applies to species, and more sharply: a panel mixing two species
invents LD that neither species has.

## An inversion is what the triangle is best at

Inverted and standard arrangements cannot recombine in a heterozygote, so
wherever both are present the whole segment stays correlated. The 2La inversion
in _Anopheles gambiae_ spans roughly 22 Mb of chromosome arm 2L, far past what
can be computed live from a VCF, so this one is precomputed with PLINK and read
through [`PlinkLDTabixAdapter`](/docs/config/plinkldtabixadapter).

<Figure src="/img/ld/anopheles_2la.png" caption="Ag1000G chromosome arm 2L, the same window and settings in both panels. r² fills the published 2La extent in the Cameroon panel and there is nothing there in the Gabon panel. Both panels carry a separate block at the low-coordinate end of the arm."/>

The band is drawn from the published breakpoint coordinates, so the block's
edges can be checked against them by eye rather than described. The lower panel
is a control rather than a second example: that population is effectively fixed
for one arrangement, so it has no arrangement to correlate.

It is not an empty track, though, and that is the useful part. Both panels carry
a block at the low-coordinate end of the arm, near the voltage-gated sodium
channel, which has nothing to do with the arrangement. A control that still
shows signal elsewhere tells you the display works and the banded region is
genuinely uncorrelated; a wholly blank track would only tell you something
failed.

## Will your locus show up at all?

A blank or washed-out triangle usually means the locus was never going to show,
not that the display failed. Four checks, all cheap, and the
[reproduce script](#reproduce-it-end-to-end) prints the numbers for each:

- **Is there variation left?** A sweep that went to fixation leaves almost no
  common variants to correlate. Compare common-variant density at your locus
  against a neutral window in the same panel.
- **Is the feature segregating in this panel?** Compare long-range LD inside a
  candidate span against an equally distant control. A population fixed for
  either arrangement can never show a block, whatever you do to the display.
- **Is the background already high?** A bottlenecked panel can show a healthy
  inside/outside ratio while its whole arm renders red. Read the absolute
  background, not only the ratio.
- **Is the feature really two alleles?** r² is a two-allele statistic. Where
  several haplotypes segregate at one locus, they fragment the correlation
  instead of concentrating it, which is why insecticide-resistance alleles at
  _Vgsc_ produce no block in this data even though the sweep is real.

## Pick the metric before you blame the data

r² and D' answer different questions and disagree about the same data. D' runs
higher inside a block, but it also tints the region outside it, while r²
collapses to near zero there. Contrast against background is what makes a block
legible, not how bright its cells are, so r² usually draws the sharper boundary
even though it looks dimmer. Switch with
[`ldMetric`](/docs/config/sharedlddisplay/#slot-ldmetric) and compare; the
reproduce script prints both ratios side by side for every panel.

Raising the minor allele frequency filter
([`minorAlleleFrequencyFilter`](/docs/config/sharedlddisplay/#slot-minorallelefrequencyfilter))
thins dense callsets to the common, block-tagging variants and removes
rare-allele speckle. Push it too high and it deletes the tagging variants
themselves, so the block fades.

## Reproduce it end to end

The Anopheles figure is built by
[`build_ag1000g_ld.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_ag1000g_ld.sh):

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_ag1000g_ld.sh
bash build_ag1000g_ld.sh              # writes ./ag1000g_ld_build/jbrowse2
npx --yes serve ag1000g_ld_build/jbrowse2
```

It downloads the phased haplotypes and the reference, runs each check in the
section above and prints the result, builds the tabix-indexed `.ld.gz` tracks,
and writes a `config.json` opening on the inversion. The numbers it prints are
how the panel and the metric were chosen, so a different locus can be assessed
the same way.

Data is Ag1000G phase 2 AR1, whose terms of use were lifted in March 2022. Cite
the release: Anopheles gambiae 1000 Genomes Consortium, "Genome variation and
population structure among 1142 mosquitoes of the African malaria vector species
Anopheles gambiae and Anopheles coluzzii", Genome Research 2020;30:1533-1548.

## Making an LD track from your own data

Two ways to supply the data, covered in the
[variant track config guide](/docs/config_guides/variant_track#linkage-disequilibrium-ld-display):

- **Computed live from a VCF**: attach an `LDDisplay` to a `VariantTrack`. No
  extra files; phased genotypes give exact haplotypic r².
- **Precomputed with PLINK**: point an `LDTrack` at `plink --r2` output. This is
  the only option once the region is larger than a VCF's genotypes can be
  correlated on the fly, and it is what the inversion figure uses.

Note that `plink --r2 dprime` does not merely add a column: the modifier also
switches r² itself to the haplotype-frequency estimate. plink2 removed `--r2`
and splits it into `--r2-phased` and `--r2-unphased`.

## The other place LD shows up: coloring a GWAS

The triangle is LD between every pair of variants in a window. The other
question people bring to LD is narrower, and JBrowse answers it in a different
display: which variants near a GWAS peak are correlated with the lead SNP, and
therefore which of them the association could be tagging.

A [`GWASTrack`](/docs/config_guides/gwas_track) takes a PLINK `.ld` file as an
`ldAdapter` sub-adapter beside its summary statistics, and
[`colorBy: 'ld'`](/docs/config/linearmanhattandisplay/#slot-colorby) then shades
each point by its r² to the index SNP, LocusZoom style. It is the same
correlation the triangle draws, read along one row of the matrix rather than
over the whole of it, and it needs the same care about which panel the r² came
from. See [](/docs/user_guides/gwas_track) for the display and the
configuration.

## See also

- [](/docs/user_guides/variant_track)
- [](/docs/user_guides/gwas_track)
- [Variant track configuration](/docs/config_guides/variant_track)
- [Gallery: variants and populations](/gallery/#variants)
