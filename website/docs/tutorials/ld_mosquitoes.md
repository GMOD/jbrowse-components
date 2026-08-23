---
title: LD across an inversion (mosquitoes)
description:
  Read precomputed PLINK LD over a 22 Mb inversion, and test whether a locus
  will show up before building the figure
guide_category: Tutorials
tutorial_category: Population genomics
data: hosted
---

**TL;DR:** a 22 Mb inversion reads as one block, from `plink --r2` output
through an [`LDTrack`](/docs/config/ldtrack). What decides whether a locus shows
anything is the panel, the allele frequency floor and the metric. The same
inversion also loads as a structural variant genotyped per mosquito.

## Prerequisites

- nothing to read the figures, which load hosted data
- `plink` (1.9, not plink2), htslib (`bgzip`, `tabix`), `samtools`, `curl`,
  `python3`, and `node` for the [JBrowse CLI](/docs/cli)

## An inversion is one block

Inverted and standard arrangements cannot recombine in a heterozygote, so
wherever both are present the whole segment stays correlated. The 2La inversion
in _Anopheles gambiae_ spans roughly 22 Mb of chromosome arm 2L, far past what
can be computed live from a VCF, so this LD is precomputed with PLINK and read
through [`PlinkLDTabixAdapter`](/docs/config/plinkldtabixadapter). Four lanes
stack below: each population's r² heatmap over its own karyotype lane, one row
per mosquito, 297 from Cameroon and 69 from Gabon.

<Figure src="/img/ld/anopheles_2la.png" caption="Ag1000G chromosome arm 2L, the same window and settings throughout. Top: the published extents of 2La and of Vgsc, the two loci the blocks below sit on. r² fills the 2La extent in the Cameroon panel, which segregates both arrangements, and is empty over that span in Gabon, which is near-fixed for the standard one."/>

The block comes out at the published breakpoint coordinates, so its edges check
against them by eye, and against the karyotype lane below it, whose cells are
drawn at those same coordinates from a different file. Three readings sit in the
frame:

- **Correlation that does not fall off with distance.** That is what marks the
  span as recombination-suppressed rather than merely dense in common variants:
  markers at opposite ends of the block are about as correlated as neighbouring
  ones. A block that faded with distance would be a region of low recombination
  rather than one of none.
- **The other block is that other case.** At the low-coordinate end of the arm,
  in both panels, it is reddest along the diagonal and pales away below it. The
  top lane marks what it sits on, _Vgsc_, the sodium channel whose codon-995
  substitutions confer pyrethroid resistance and which this release was used to
  survey ([Clarkson et al. 2021](https://doi.org/10.1111/mec.15845)).
- **Gabon is a control, not a second example.** 5 of its 69 mosquitoes are
  heterozygous, but the other 64 recombine across the span freely, so there is
  nothing to correlate over — and the MAF floor both files carry drops the
  variants tagging those five. The low-coordinate block is still there, which
  says the 2La span is genuinely uncorrelated rather than unread.

## The rearrangement itself, per mosquito

What the heatmap draws is linkage, not the rearrangement, and the same inversion
also loads as what it is: one `<INV>` record spanning the breakpoints, genotyped
across every mosquito. The
[regular multi-sample variant display](/docs/user_guides/multivariant_track#regular-best-for-full-sv-detail)
draws each genotype at the call's true span, so a carrier's row begins and ends
at the breakpoints — a per-SNP view cannot hold a 22 Mb feature, and one SV call
sidesteps that. [](/docs/tutorials/population_genomics) builds the same
one-record karyotype track for an 11 Mb Drosophila inversion.

That is what the karyotype lanes in the figure above are: cells shaded by allele
dosage, each lane sorted into standard, heterozygous and homozygous-inverted
blocks. The `karyotype` column names the three classes by genotype, and so does
the legend: `2L+a/2L+a`, `2La/2L+a`, `2La/2La`, the `+` marking the non-inverted
arrangement.

Load each population as a `VariantTrack` whose adapter carries the samples TSV,
with a `LinearMultiSampleVariantDisplay` that orders (`groupBy`) and colors
(`colorBy`) its rows by the `karyotype` column:

```json addtrack
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

Two settings there are doing real work:

- [`groupBy`](/docs/config/linearmultisamplevariantdisplay/#slot-groupby) keeps
  the karyotype classes contiguous. Without it the rows keep the VCF's column
  order and the split only reads as blocks by luck.
- [`referenceDrawingMode`](/docs/config/linearmultisamplevariantdisplay/#slot-referencedrawingmode)
  is left on its default, `skip`, which colors the whole lane with the reference
  color and paints only alt cells on top. The lane is then a solid grey field
  with the carriers' blocks on it, and a standard-arrangement mosquito is grey
  rather than blank. `draw` carries the same information as a grey cell per row
  at the call's span, striped by the gaps between rows, which reads as a texture
  rather than as background.

There is no `rowHeight` here, because it is a display model property rather than
a config slot: rows divide the lane's height between them, so 297 mosquitoes in
a 297-pixel lane get a pixel each. Each population is its own track because the
display draws a row for every sample in the file and has no sample filter, so
the file is the row set.

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

## Precompute the LD with PLINK

22 Mb is past what the display can correlate live, so the LD is a file that
`plink --r2` writes: thin the variants, correlate them, index the table.
`keep.CMgam.txt` is the population, two tab-separated columns of the same sample
id, the family/individual pair plink asks for.

<!-- from: scripts/build_ag1000g_ld.sh -->

```bash
# the display uploads n(n-1)/2 cells, and ~800 SNPs across an arm is already at
# screen resolution, so thin to a grid rather than to the callset's density
plink --bfile common --allow-extra-chr --keep keep.CMgam.txt --maf 0.2 \
  --chr 2L --write-snplist --out sel
awk -F'_' -v g=50000 '{p=$2+0; if (p >= nxt) {print $0; nxt = p + g}}' \
  sel.snplist > grid.snplist

# plink 1.9, not plink2, which split --r2 into --r2-phased/--r2-unphased. And
# `--r2 dprime` is not an extra column: it switches r² itself from a dosage
# correlation to the haplotype-frequency estimate, which is what the display
# draws. --ld-window-r2 0 keeps the uncorrelated pairs.
plink --bfile common --allow-extra-chr --keep keep.CMgam.txt \
  --extract grid.snplist --keep-allele-order \
  --r2 dprime --ld-window 999999 --ld-window-kb 1000000 --ld-window-r2 0 \
  --out ag1000g_2L_CMgam

# awk retabs plink's space-padded columns and comments the header — commented
# rather than skipped with `tabix -S 1`, since only a commented one comes back
# from -H. `sort-bed` is then just `sort -k1,1 -k2,2n` under LC_ALL=C with that
# `#` line kept on top, which is what a .ld wants too: same first two columns.
awk 'NR == 1 {$1 = "#"$1} {$1 = $1}1' OFS='\t' ag1000g_2L_CMgam.ld |
  jbrowse sort-bed | bgzip > ag1000g_2L_CMgam.ld.gz
tabix -s 1 -b 2 -e 2 -f ag1000g_2L_CMgam.ld.gz
```

The track over that file is an `LDTrack`. The display reads one of its two
metric columns, and which one is the section below.

```json addtrack
{
  "type": "LDTrack",
  "trackId": "ag1000g_2l_cmgam",
  "name": "Cameroon, both arrangements segregating (r²)",
  "assemblyNames": ["anoGam3"],
  "adapter": {
    "type": "PlinkLDTabixAdapter",
    "uri": "https://jbrowse.org/demos/popgen/ag1000g_2L_CMgam.ld.gz"
  },
  "displays": [
    {
      "type": "LDTrackDisplay",
      "ldMetric": "r2",
      "useGenomicPositions": true,
      "showLegend": true,
      "height": 340
    }
  ]
}
```

## Metric and allele-frequency floor

r² and D' answer different questions. D' asks whether recombination has been
seen between two markers, so it saturates near 1 wherever no recombinant
haplotype has turned up. r² asks how well one marker predicts the other, which
also requires the two to be at similar frequency, so a pair can be in complete
linkage and still score low.

The same block therefore reads brighter under D', which also tints the region
outside it. r² draws the sharper boundary and is the one to read when the
question is whether a marker can stand in for another; D' is the better read on
where recombination stops, which is why the reproduce script uses it to recover
the breakpoints. Switch with
[`ldMetric`](/docs/config/sharedlddisplay/#slot-ldmetric); the script prints
both ratios for every panel.

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

## See also

- [](/docs/tutorials/ld_human)
- [](/docs/tutorials/population_genomics)
- [](/docs/user_guides/multivariant_track)
- [](/docs/user_guides/variant_track)
- [](/docs/config_guides/variant_track)
- [Gallery: variants and populations](/gallery/#variants)

## References

- Anopheles gambiae 1000 Genomes Consortium (2020).
  [Genome variation and population structure among 1142 mosquitoes of the African malaria vector species Anopheles gambiae and Anopheles coluzzii](https://doi.org/10.1101/gr.262790.120)
- Clarkson et al. (2021).
  [The genetic architecture of target-site resistance to pyrethroid insecticides in the African malaria vectors Anopheles gambiae and Anopheles coluzzii](https://doi.org/10.1111/mec.15845)
- Love et al. (2019).
  [In silico karyotyping of chromosomally polymorphic malaria mosquitoes in the Anopheles gambiae complex](https://doi.org/10.1534/g3.119.400445)
- Sharakhov et al. (2006).
  [Breakpoint structure reveals the unique origin of an interspecific chromosomal inversion (2La) in the Anopheles gambiae complex](https://doi.org/10.1073/pnas.0509683103)
- White et al. (2007).
  [Molecular karyotyping of the 2La inversion in Anopheles gambiae](https://doi.org/10.4269/ajtmh.2007.76.334)
