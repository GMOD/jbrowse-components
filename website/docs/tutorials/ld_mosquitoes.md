---
title: LD across an inversion (mosquitoes)
sidebar_label: LD across an inversion (mosquitoes)
description:
  Read precomputed PLINK LD over a 22 Mb inversion, and test whether a locus
  will show up before building the figure
guide_category: Tutorials
tutorial_category: Population genomics
---

**TL;DR:** a 22 Mb inversion reads as one block, from `plink --r2` output
through an [`LDTrack`](/docs/config/plinkldtabixadapter). What decides whether a
locus shows anything is the panel, the allele frequency floor and the metric,
all three testable before a figure is built. The same inversion also loads as a
structural variant genotyped per mosquito, which is the same event drawn a
different way.

## Prerequisites

- nothing to read the figures, which load hosted data
- `plink` (1.9, not plink2), htslib (`bgzip`, `tabix`), `samtools`, `curl` and
  `python3` for the [reproduce script](#reproduce-it-end-to-end)

## An inversion is one block

Inverted and standard arrangements cannot recombine in a heterozygote, so
wherever both are present the whole segment stays correlated. The 2La inversion
in _Anopheles gambiae_ spans roughly 22 Mb of chromosome arm 2L, far past what
can be computed live from a VCF, so this LD is precomputed with PLINK and read
through [`PlinkLDTabixAdapter`](/docs/config/plinkldtabixadapter).

Four lanes stack below: each population's r² heatmap over its own karyotype
lane, one row per mosquito, 297 from Cameroon and 69 from Gabon. Both panels
also carry a separate block at the low-coordinate end of the arm, which the next
section returns to.

<Figure src="/img/ld/anopheles_2la.png" caption="Ag1000G chromosome arm 2L, the same window and settings throughout. r² fills the published 2La extent in the Cameroon panel, which segregates both arrangements, and is empty over that span in Gabon, which is near-fixed for the standard one."/>

The heatmap's block comes out at the published breakpoint coordinates, so its
edges can be checked against them by eye, and against the karyotype lane below
it, whose cells are drawn at those same coordinates from a different file.

What marks the span as recombination-suppressed, rather than merely dense in
common variants, is that the correlation does not fall off with distance inside
it. Markers at opposite ends of the block are about as correlated as
neighbouring ones, which is why the Cameroon triangle stays filled out to its
apex instead of fading away from the diagonal. Everywhere else on the arm, and
across the whole Gabon panel, r² decays with separation in the ordinary way.
That contrast is the diagnostic; a block that faded with distance would be a
region of low recombination rather than one of none.

The Gabon panel is a control rather than a second example. That population is
not inversion-free: 5 of its 69 mosquitoes are heterozygous, the blue rows at
the bottom of its karyotype lane. What it lacks is enough of them to hold the
segment together, since the other 64 recombine across it freely, so there is
nothing to correlate over the 2La span. It still carries a block at the
low-coordinate end of the arm, near the voltage-gated sodium channel, which says
the display works and the span is genuinely uncorrelated rather than unread.

Both files were built with a minor allele frequency floor, and in Gabon the
inverted arrangement sits far below it, so the variants tagging those five
carriers are not in the file at all. The empty panel supports the claim that the
arrangement is too rare there to structure the common variation around it, not
that no correlated carrier haplotype exists.

## The rearrangement itself, per mosquito

What the heatmap draws is linkage, not the rearrangement. The two are worth
keeping apart, so the same inversion can also be loaded as what it is: a
structural variant, one `<INV>` record spanning the breakpoints, genotyped
across every mosquito in the two panels and loaded in the
[regular multi-sample variant display](/docs/user_guides/multivariant_track#regular-best-for-full-sv-detail),
which draws each genotype at the call's true span so the carrier rows begin and
end at the breakpoints. A per-SNP view cannot hold a 22 Mb feature on screen,
and one SV call sidesteps that, because the call is a single feature no matter
how wide it is. [](/docs/tutorials/population_genomics) builds the same
one-record karyotype track for an 11 Mb Drosophila inversion.

That is what the karyotype lanes in the figure above are: cells shaded by allele
dosage, each lane sorted into standard, heterozygous and homozygous-inverted
blocks. The `karyotype` column, and so the legend, names those three classes by
genotype: `2L+a/2L+a` (standard/standard, the `+` marking the non-inverted
arrangement), `2La/2L+a` (heterozygous), `2La/2La` (inverted/inverted).

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
span instead. That is the same information, but as a rectangle striped by the
gaps between rows, which reads as a texture rather than as background.

There is no `rowHeight` here, because it is a display model property rather than
a config slot: rows divide the lane's height between them, so the lane height is
the row height. 297 mosquitoes in a 297-pixel lane get a pixel each. That is
also why each population is its own track rather than both being one: the
display draws a row for every sample in the file and has no sample filter, so
the file is the row set, and at a one-pixel row the sidebar has no space for a
text label, leaving the track header as the only place a population name can go.

### What is inferred here, and what is not

The inversion is not something this pipeline discovers. 2La is a cytologically
defined arrangement whose breakpoints have been cloned and sequenced
([Sharakhov et al. 2006](https://doi.org/10.1073/pnas.0509683103)), and the
coordinates the call is drawn at are that published extent. PCR across the
junctions karyotypes single mosquitoes, checked against polytene cytology on
field specimens
([White et al. 2007](https://doi.org/10.4269/ajtmh.2007.76.334)).

What is inferred is each mosquito's karyotype, by scoring the tag SNPs of
[Love et al. 2019](https://doi.org/10.1534/g3.119.400445), the in-silico method
MalariaGEN ships for the current Ag3 release. The score is the mean number of
alternate alleles across the tags, and rounding it into a genotype is only
defensible because it comes out trimodal with empty space between the peaks. The
[reproduce script](#reproduce-it-end-to-end) prints that histogram and the
karyotype breakdown per population, which is the independent check on the
heatmaps: the panel that shows a block is the one segregating both arrangements,
and the flat one is near-fixed for the standard arrangement.

## When a locus has no block to show

A blank or washed-out triangle usually means the locus was never going to show.
The [reproduce script](#reproduce-it-end-to-end) prints the numbers behind each
of these:

- Is there variation left? A sweep that went to fixation leaves almost no common
  variants to correlate. Compare common-variant density at your locus against a
  neutral window in the same panel.
- Is the feature segregating in this panel? Compare long-range LD inside a
  candidate span against an equally distant control. A population fixed for
  either arrangement can never show a block.
- Is the background already high? A bottlenecked panel can show a healthy
  inside/outside ratio while its whole arm renders red. Read the absolute
  background, not only the ratio.
- Is the feature really two alleles? r² is a correlation between two biallelic
  markers, so where several haplotypes segregate at one locus they fragment it:
  each carries a different background, and no single pair of markers tags them
  all. A soft sweep can therefore leave a weaker and patchier block than its
  strength suggests, which is a reason to read a faint block carefully rather
  than to conclude nothing happened.

## Metric and allele-frequency floor

r² and D' answer different questions, so they disagree about the same data by
design. D' asks whether recombination has been seen between two markers: it is
scaled by the most the two allele frequencies would allow, so it saturates near
1 wherever no recombinant haplotype has turned up. r² asks how well one marker
predicts the other, which also requires the two to be at similar frequency, so a
pair can be in complete linkage and still score low.

That is why the same block reads brighter under D', and why D' also tints the
region outside it where r² collapses to near zero. Contrast against background,
not cell brightness, is what makes a block legible, so r² usually draws the
sharper boundary despite looking dimmer, and it is the one to read when the
question is whether a marker can stand in for another. D' is the better read on
where recombination stops, which is why the reproduce script uses it, not r², to
recover the breakpoints. Switch with
[`ldMetric`](/docs/config/sharedlddisplay/#slot-ldmetric); the script prints
both ratios for every panel, so the two metrics can be compared on identical
pairs before either one is drawn.

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

The data is Ag1000G phase 2 AR1. MalariaGEN opens its older releases, and phase
2's terms of use were lifted in March 2022, so the script downloads it without
registration or a data-access agreement. The current Ag3 release is not open
access yet, which is why this tutorial builds on phase 2 while taking its
karyotyping tag SNPs from the Ag3 method.

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
- [](/docs/tutorials/population_genomics)
- [](/docs/user_guides/multivariant_track)
- [](/docs/user_guides/variant_track)
- [Variant track configuration](/docs/config_guides/variant_track)
- [Gallery: variants and populations](/gallery/#variants)

## References

- Anopheles gambiae 1000 Genomes Consortium (2020).
  [Genome variation and population structure among 1142 mosquitoes of the African malaria vector species Anopheles gambiae and Anopheles coluzzii](https://doi.org/10.1101/gr.262790.120)
- Love et al. (2019).
  [In silico karyotyping of chromosomally polymorphic malaria mosquitoes in the Anopheles gambiae complex](https://doi.org/10.1534/g3.119.400445)
- Sharakhov et al. (2006).
  [Breakpoint structure reveals the unique origin of an interspecific chromosomal inversion (2La) in the Anopheles gambiae complex](https://doi.org/10.1073/pnas.0509683103)
- White et al. (2007).
  [Molecular karyotyping of the 2La inversion in Anopheles gambiae](https://doi.org/10.4269/ajtmh.2007.76.334)
