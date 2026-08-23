---
title: LD across an inversion (mosquitoes)
description:
  Read precomputed PLINK LD over a 22 Mb inversion, and load the same inversion
  genotyped per mosquito
guide_category: Tutorials
tutorial_category: Population genomics
data: hosted
---

**TL;DR:** a 22 Mb inversion reads as one block, from `plink --r2` output
through an [`LDTrack`](/docs/config/ldtrack). The same inversion also loads as a
structural variant genotyped per mosquito.

## Prerequisites

- nothing to read the figures, which load hosted data
- `plink` (1.9, not plink2), htslib (`bgzip`, `tabix`), `samtools`, `curl`,
  `python3`, and `node` for the [JBrowse CLI](/docs/cli)

## Where the data comes from

Every genotype on this page is Ag1000G phase 2 AR1
([Anopheles gambiae 1000 Genomes Consortium 2020](https://doi.org/10.1101/gr.262790.120)),
whose terms of use were lifted in March 2022, so the phased haplotypes download
without registration or a data-access agreement. Two populations are used
throughout: `CMgam`, 297 mosquitoes from Cameroon, which segregates both
arrangements of 2La, and `GAgam`, 69 from Gabon, which is near-fixed for the
standard arrangement.

Each mosquito's 2La karyotype is scored from the tag SNPs of
[Love et al. 2019](https://doi.org/10.1534/g3.119.400445), the in-silico method
MalariaGEN ships for the current Ag3 release. The
[reproduce script](#reproduce-it-end-to-end) does that scoring, and the tables
it writes are [rehosted on jbrowse.org](https://jbrowse.org/demos/popgen/) so
the track blocks on this page load without the download.

## The 2La inversion as one LD block

Inverted and standard arrangements cannot recombine in a heterozygote, so
wherever both are present the whole segment stays correlated. The 2La inversion
in _Anopheles gambiae_ spans roughly 22 Mb of chromosome arm 2L, past what can
be computed live from a VCF, so this LD is precomputed with PLINK and read
through [`PlinkLDTabixAdapter`](/docs/config/plinkldtabixadapter). The sections
below build that table, load the same inversion genotyped per mosquito, and read
the two together.

## Precompute the LD with PLINK

The LD is a file that `plink --r2` writes in three steps: thin the variants,
correlate them, index the table. `keep.CMgam.txt` is the population, two
tab-separated columns of the same sample id, the family/individual pair plink
asks for.

<!-- from: scripts/build_ag1000g_ld.sh -->

```bash
# the display uploads n(n-1)/2 cells, and ~800 SNPs across an arm is already at
# screen resolution, so thin to a grid rather than to the callset's density
plink --bfile common --allow-extra-chr --keep keep.CMgam.txt --maf 0.2 \
  --chr 2L --write-snplist --out sel
awk -F'_' -v g=50000 '{p=$2+0; if (p >= nxt) {print $0; nxt = p + g}}' \
  sel.snplist > grid.snplist

# plink 1.9: plink2 splits --r2 into --r2-phased/--r2-unphased. `--r2 dprime`
# switches r² itself from a dosage correlation to the haplotype-frequency
# estimate, which is what the display draws. --ld-window-r2 0 keeps the
# uncorrelated pairs.
plink --bfile common --allow-extra-chr --keep keep.CMgam.txt \
  --extract grid.snplist --keep-allele-order \
  --r2 dprime --ld-window 999999 --ld-window-kb 1000000 --ld-window-r2 0 \
  --out ag1000g_2L_CMgam

# awk retabs plink's space-padded columns and comments the header, which is what
# `tabix -H` returns. `sort-bed` is `sort -k1,1 -k2,2n` under LC_ALL=C with that
# `#` line kept on top, which is what a .ld wants too: same first two columns.
awk 'NR == 1 {$1 = "#"$1} {$1 = $1}1' OFS='\t' ag1000g_2L_CMgam.ld |
  jbrowse sort-bed | bgzip > ag1000g_2L_CMgam.ld.gz
tabix -s 1 -b 2 -e 2 -f ag1000g_2L_CMgam.ld.gz
```

The track over that file is an `LDTrack`, and the display reads one of its two
metric columns:

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

## The inversion genotyped per mosquito

The same inversion loads as one `<INV>` record spanning the breakpoints,
genotyped across every mosquito. The
[regular multi-sample variant display](/docs/user_guides/multivariant_track#regular-best-for-full-sv-detail)
draws each genotype at the call's true span, so a carrier's row begins and ends
at the breakpoints. [](/docs/tutorials/population_genomics) builds the same
one-record karyotype track for an 11 Mb Drosophila inversion.

Those genotypes are what the karyotype lanes in the figure below are: cells
shaded by allele dosage, each lane sorted into standard, heterozygous and
homozygous-inverted blocks. The `karyotype` column names the three classes by
genotype, and so does the legend: `2L+a/2L+a`, `2La/2L+a`, `2La/2La`, the `+`
marking the non-inverted arrangement.

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

[`groupBy`](/docs/config/linearmultisamplevariantdisplay/#slot-groupby) keeps
the karyotype classes contiguous, so each class reads as one block.
[`referenceDrawingMode`](/docs/config/linearmultisamplevariantdisplay/#slot-referencedrawingmode)
is on its default, `skip`, which fills the lane with the reference color and
paints alt cells on top: a solid grey field with the carriers' blocks on it.

Rows divide the lane's height between them, so a 300-pixel lane gives each of
297 mosquitoes about a pixel. The display draws a row for every sample in the
file, which makes each population its own track.

### The karyotype calls

2La is a cytologically defined arrangement whose breakpoints have been cloned
and sequenced
([Sharakhov et al. 2006](https://doi.org/10.1073/pnas.0509683103)), and the call
is drawn at that published extent. PCR across the junctions karyotypes single
mosquitoes, checked against polytene cytology on field specimens
([White et al. 2007](https://doi.org/10.4269/ajtmh.2007.76.334)).

The tag-SNP score is the mean number of alternate alleles across the tags,
rounded into a genotype, and it comes out trimodal with empty space between the
peaks. The [reproduce script](#reproduce-it-end-to-end) prints that histogram
and the karyotype breakdown per population.

## The block on the karyotype lanes

Four lanes stack in the figure: each population's r² heatmap over its own
karyotype lane, one row per mosquito, 297 from Cameroon and 69 from Gabon.

<Figure src="/img/ld/anopheles_2la.png" caption="Ag1000G chromosome arm 2L, the same window and settings throughout. Top: the published extents of 2La and of Vgsc, the two loci the blocks below sit on. r² fills the 2La extent in the Cameroon panel, which segregates both arrangements, and is empty over that span in Gabon, which is near-fixed for the standard arrangement."/>

The block's edges land on the published breakpoint coordinates, and on the
karyotype lane beneath the heatmap, whose cells are drawn at those same
coordinates from a different file. Across the block, markers at opposite ends
are about as correlated as neighbouring ones: correlation holds flat with
distance over a recombination-suppressed span.

The second block, at the low-coordinate end of the arm in both panels, is
reddest along the diagonal and pales away below it. That block sits on _Vgsc_,
the sodium channel whose codon-995 substitutions confer pyrethroid resistance
and which this release was used to survey
([Clarkson et al. 2021](https://doi.org/10.1111/mec.15845)). Gabon shows that
block too. Across the 2La span in that panel, 64 of its 69 mosquitoes recombine
freely, and the MAF floor both files carry drops the variants tagging the 5
heterozygotes, so the span reads flat.

## What an LD block depends on

Four things decide how strongly a block reads, and the
[reproduce script](#reproduce-it-end-to-end) prints the numbers behind each:

- **Common-variant density.** A sweep that went to fixation leaves few common
  variants to correlate. Compare density at the locus against a neutral window
  in the same panel.
- **Whether the panel segregates the feature.** Long-range LD inside a candidate
  span, against an equally distant control, reads as a block only where both
  arrangements are present.
- **Background LD.** A bottlenecked panel renders red across the whole arm, so
  read the absolute background alongside the inside/outside ratio.
- **Number of haplotypes.** r² is a correlation between two biallelic markers,
  so several haplotypes at one locus fragment the block: each carries a
  different background, and no single pair of markers tags them all. A soft
  sweep leaves a patchier block than its strength suggests.

## Metric and allele-frequency floor

D' asks whether recombination has been seen between two markers, so it saturates
near 1 wherever no recombinant haplotype has turned up. That makes it the read
on where recombination stops, and the reproduce script uses it to recover the
breakpoints. r² asks how well one marker predicts the other, which also requires
the two to be at similar frequency, so it draws the sharper boundary and reads
on whether a marker can stand in for another. Switch with
[`ldMetric`](/docs/config/sharedlddisplay/#slot-ldmetric); the script prints
both ratios for every panel.

Raising the minor allele frequency filter
([`minorAlleleFrequencyFilter`](/docs/config/sharedlddisplay/#slot-minorallelefrequencyfilter))
thins dense callsets to the common, block-tagging variants. High enough, it
reaches the tagging variants themselves and the block fades.

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
