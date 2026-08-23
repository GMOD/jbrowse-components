---
title: Selection scans (Drosophila DGRP)
sidebar_label: Selection scans (DGRP)
description:
  Fst, diversity, and Tajima's D scans plus per-sample inversion genotypes from
  one VCF
guide_category: Tutorials
tutorial_category: Population genomics
data: pipeline
---

**TL;DR:** compute per-window Fst, nucleotide diversity (π), and Tajima's D from
a multi-sample VCF, load them as bigWig quantitative tracks stacked in one view,
each on its own y-axis, and read where the signals line up against genes.

## Prerequisites

- nothing to read along. Everything below is for building the tracks yourself
- `curl`, and `node` for the [JBrowse CLI](/docs/cli)
- [vcftools](https://vcftools.github.io/) - windowed Fst, π, and Tajima's D from
  a VCF
- [bcftools](https://samtools.github.io/bcftools/) - reading the VCF header and
  sample list
- [htslib](https://www.htslib.org/) (`bgzip`, `tabix`) - compressing and
  indexing the VCF built in the per-sample section
- [`bedGraphToBigWig`](https://hgdownload.soe.ucsc.edu/admin/exe/) - UCSC
  utility that packs a bedGraph into an indexed bigWig

On Debian/Ubuntu, `apt install vcftools bcftools tabix curl` covers everything
but `bedGraphToBigWig`, which is a
[single static binary from UCSC](https://hgdownload.soe.ucsc.edu/admin/exe/).
Homebrew has the same four (`brew install vcftools bcftools htslib`), and all
five are on [bioconda](https://bioconda.github.io/) if you already run conda.

## Windowed statistics as tracks

A population-genetic scan is a per-window statistic running along the genome:
Fst between two groups, nucleotide diversity (π) within one, dxy between them.
That is the shape of a wiggle track, so whatever a scanner writes per window
loads as a [quantitative track](/docs/user_guides/quantitative_track) and reads
against the genes underneath it. Haplotype-based selection statistics (iHS,
XP-EHH, e.g. from [selscan](https://github.com/szpiech/selscan)) capture sweeps
that Fst misses and, being per-site or per-window scores, load the same way.

This tutorial stacks Fst, π and Tajima's D in one view, each scaled to its own
data. The panel is the
[Drosophila Genetic Reference Panel](https://dgrpool.epfl.ch/) (DGRP), 205
inbred lines ([Mackay et al. 2012](https://doi.org/10.1038/nature10811)) on dm6,
and the two signals it draws are Fst across the `In(2L)t` inversion, which
suppresses recombination between the two arrangements in a heterozygote
([Corbett-Detig & Hartl 2012](https://doi.org/10.1371/journal.pgen.1003056)),
and the π landscape, which dips at loci under selection such as the
insecticide-resistance gene _Cyp6g1_
([Daborn et al. 2002](https://doi.org/10.1126/science.1074170)).

## Building the scans

Two inputs, both on stable HTTPS hosts. The genotypes are the DGRP freeze-2
calls lifted to dm6 ([aertslab](https://resources.aertslab.org/DGRP2/)); the
inversion karyotypes come from
[DGRPool's In(2L)t phenotype record](https://dgrpool.epfl.ch/phenotypes/1520)
([Gardeux et al. 2023](https://doi.org/10.7554/eLife.88981)), which harmonizes
the `In(2L)t` typing of
[Huang et al. 2015](https://doi.org/10.1534/g3.115.019554). The karyotype column
is `0` for standard homozygotes, `2` for inverted homozygotes, and `1` for
heterozygotes, which is what splits the panel into the two groups Fst compares.
The heterozygotes are dropped from both groups.

[`build_dgrp_popgen.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_dgrp_popgen.sh)
downloads both files and derives the two sample lists, normalizing DGRPool's
`DGRP_021` to the VCF's `DGRP-021`. Each list is one sample name per line, which
is the form [vcftools](https://vcftools.github.io/) takes for `--weir-fst-pop`
and `--keep`.

Each scan is then one vcftools run, an awk turning its table into a bedGraph,
and a pack into a bigWig. Fst uses the Weir & Cockerham estimator
([Weir & Cockerham 1984](https://doi.org/10.2307/2408641)):

<!-- from: scripts/build_dgrp_popgen.sh -->

```bash
# chrom.sizes from the VCF header, so it carries the same contig names the
# scans will
bcftools view -h dgrp2.vcf.gz |
  awk -F'[=,>]' '/^##contig/{print $3"\t"$5}' > dm6.chrom.sizes

# window == step, so windows tile rather than overlap
vcftools --gzvcf dgrp2.vcf.gz \
  --weir-fst-pop In2Lt_INV.txt --weir-fst-pop In2Lt_STD.txt \
  --fst-window-size 2000 --fst-window-step 2000 --out fst_In2Lt
# BIN_START is 1-based here, hence -1; negative Fst is an estimator artifact
# at low-differentiation sites and is floored at 0.
# $5 is WEIGHTED_FST, the window's summed variance components divided; $6 beside
# it is MEAN_FST, the average of the per-site ratios, which any window with a
# few uninformative sites in it pulls around.
# BIN_END is the NOMINAL window end, so a contig's last window is reported past
# the end of it. Clamp, or bedGraphToBigWig refuses the whole file.
awk -F'\t' 'NR==FNR{len[$1]=$2; next}
     FNR>1 && $5!="nan" && $5!="-nan" {
       v=$5+0; if (v<0) v=0
       end=$3; if (end>len[$1]) end=len[$1]
       if (end>$2-1) print $1"\t"($2-1)"\t"end"\t"v
     }' dm6.chrom.sizes fst_In2Lt.windowed.weir.fst |
  sort -k1,1 -k2,2n > fst_In2Lt.bedgraph
bedGraphToBigWig fst_In2Lt.bedgraph dm6.chrom.sizes fst_In2Lt.bw
```

The clamp reads window ends against that same `chrom.sizes`. Diversity is the
same three steps with `--window-pi 2000`, reading `$5` of `pi_all.windowed.pi`,
and `--keep` restricts it to one arrangement. Reading `$4` of the same table
instead gives the called-variant count the figure below stacks under π.

The two groups here are very unequal, since the inverted arrangement is the
rarer one. Weir & Cockerham corrects for sample size, and Hudson's estimator
summed as a ratio of averages is the usual recommendation where the groups
differ this much ([Bhatia et al. 2013](https://doi.org/10.1101/gr.154831.113));
[](/docs/tutorials/dog10k_selection) scans with that one.

Tajima's D ([Tajima 1989](https://doi.org/10.1093/genetics/123.3.585)) reads its
table differently from the other two. `--TajimaD` reports `BIN_START` 0-based,
so it takes no `-1` shift, and reports no `BIN_END` at all, so the window end is
constructed here before the same clamp applies to it.

<!-- from: scripts/build_dgrp_popgen.sh -->

```bash
vcftools --gzvcf dgrp2.vcf.gz --TajimaD 2000 --out tajimad_all
# BIN_START is already 0-based (no -1), and there is no BIN_END, so the end is
# built here and clamped: an interval past the contig end is rejected downstream
awk -F'\t' 'NR==FNR{len[$1]=$2; next}
     FNR>1 && $4!="nan" && $4!="-nan" {
       end=$2+2000; if (end>len[$1]) end=len[$1]
       if (end>$2) print $1"\t"$2"\t"end"\t"$4
     }' dm6.chrom.sizes tajimad_all.Tajima.D |
  sort -k1,1 -k2,2n > tajimad_all.bedgraph
bedGraphToBigWig tajimad_all.bedgraph dm6.chrom.sizes tajimad_all.bw
```

Window size trades resolution for smoothness. 2 kb is dense enough in this panel
that a single-gene sweep like _Cyp6g1_ resolves sharply. Widen toward 5-10 kb
for smoother genome-wide overviews, or narrow further only where SNP density
stays high.

The one thing to check yourself is chromosome naming: a mismatch draws an empty
track with no error. The bigWigs take their contig names from the VCF header,
which spells the arms `2L`, `2R`, `3L`, `3R`, `X` and `4`, FlyBase style, where
UCSC dm6 prefixes them `chr2L`. If your dm6 assembly uses the UCSC names,
[refname aliasing](/docs/developer_guides/refname_aliasing) reconciles the two
at display time.

Negative Fst estimates, an artifact of the Weir & Cockerham estimator at
low-differentiation sites, are floored at 0. Tajima's D keeps its sign, since
its negative excursions are the signal.

Because this VCF holds variant sites only, `--window-pi` divides by the nominal
window size, so every position not in the file counts as invariant and callable
alike. A window that lost sites to filtering or to coverage reads as low
diversity, and how much each window lost varies.
[pixy](https://pixy.readthedocs.io/)
([Korunes & Samuk 2021](https://doi.org/10.1111/1755-0998.13326)) takes an
allSites VCF, where an invariant position and a missing one are distinguishable,
and reports π, dxy and Fst per window without that bias, one row per window, so
its output packs into a bigWig the same way.

Tajima's D is read as an excursion against the panel's own background. A
variant-sites-only callset of inbred lines lifts the whole baseline, since
filtering takes the rare alleles D is most sensitive to and vcftools counts two
chromosomes where a line contributes one.

## Loading it in JBrowse

You need a dm6 assembly loaded, ideally with a FlyBase or RefSeq gene track so
gene-name search works. See
[configuring assemblies](/docs/config_guides/assemblies) and
[gene tracks](/docs/user_guides/gene_track). Each scan loads as an ordinary
[quantitative track](/docs/user_guides/quantitative_track), which auto-scales to
its own data. Add each track object below to the `tracks` array of your
`config.json` (or paste it via the add-track JSON editor in the app):

```json addtrack
{
  "type": "QuantitativeTrack",
  "trackId": "fst_in2lt",
  "name": "Fst (In(2L)t vs standard, 2kb windows)",
  "assemblyNames": ["dm6"],
  "adapter": {
    "type": "BigWigAdapter",
    "uri": "https://jbrowse.org/demos/popgen/fst_In2Lt.bw"
  }
}
```

Load the Fst and π scans as two separate tracks: they sit on very different
scales (Fst approaches 1, π stays near 0.01), so each needs its own y-axis,
where a [multi-wiggle](/docs/config_guides/multiquantitative_track) shares one
across its rows.

A multi-wiggle suits rows on the same scale, such as the same statistic across
groups. The per-group π bigWigs (`pi_INV.bw`/`pi_STD.bw`) share a scale, so
inverted and standard diversity load as one track on one shared y-domain:

```json
{
  "type": "MultiQuantitativeTrack",
  "trackId": "pi_by_arrangement",
  "name": "π by In(2L)t arrangement",
  "assemblyNames": ["dm6"],
  "adapter": {
    "type": "MultiWiggleAdapter",
    "subadapters": [
      {
        "type": "BigWigAdapter",
        "source": "π In(2L)t",
        "uri": "https://jbrowse.org/demos/popgen/pi_INV.bw"
      },
      {
        "type": "BigWigAdapter",
        "source": "π standard",
        "uri": "https://jbrowse.org/demos/popgen/pi_STD.bw"
      }
    ]
  }
}
```

The inverted lines carry somewhat less diversity than the standard ones across
the inverted region, most noticeably near the breakpoints.

## Reading the signals

The three scans are read against each other. Search `Cyp6g1` (on `2R`) in the
location box and add the Tajima's D track alongside π. Both dip together over
the swept window. D carries π inside it, so the pair says the frequency spectrum
is skewed further toward rare alleles than the drop in diversity on its own
accounts for. Add the called-variant count under them, which is column 4 of the
table π comes from, so it counts the same windows over the same calls. A
duplication of `Cyp6g1` segregates alongside the resistance allele
([Schmidt et al. 2010](https://doi.org/10.1371/journal.pgen.1000998)), and copy
number costs a window called sites.

<Figure src="/img/popgen/tajimad_cyp6g1.png" caption="Tajima's D, π and called variants per window across 2R around Cyp6g1 (highlighted; Cyp6g1 and Cyp6g2 labeled in the gene track). D and π dip over the highlighted window against their background either side, the joint trough being the hard-sweep signature. The count under them falls too, but nothing like as far."/>

Each pair of values reads differently:

| Fst  | Within-group π         | Reading                                          |
| ---- | ---------------------- | ------------------------------------------------ |
| High | Low in one group       | Selective sweep / local adaptation in that group |
| High | High in both, high dxy | Long-standing divergence (e.g. an inversion)     |
| Low  | High                   | Shared variation / gene flow                     |

Other selection loci in this panel read the same way against their own genes,
including _Ace_ and _CHKov1_ on `3R`. `In(3R)Payne`, a cosmopolitan inversion
under clinal selection, is typed in the same DGRPool table set, so repeating the
grouping step with its phenotype scans `3R` exactly as the steps above scan
`2L`.

## The inversion, genome-wide and per line

Opening the assembly with no location shows all of its regions at once, so the
six arms lay out side by side. The `In(2L)t` Fst track rises over the inverted
region of chromosome 2L, against low background Fst on every other arm.

That view gives one number per window across the arrangement. To see which lines
carry it, represent the whole arrangement as a single structural-variant call,
one `<INV>` record spanning the In(2L)t breakpoints (`2L:2,225,744-13,154,180`),
genotyped across every karyotyped line, and load it in the
[regular multi-sample variant display](/docs/user_guides/multivariant_track#regular-best-for-full-sv-detail),
which draws each genotype at the call's true span so the carriers line up under
the Fst plateau. [](/docs/tutorials/ld_mosquitoes) builds the same one-record
karyotype track for a 22 Mb mosquito inversion.

The build script writes both inputs: a `samples.tsv` whose first column is the
sample name and whose other columns are attributes the display can order and
color rows by, and a one-record SV VCF genotyping every karyotyped line `1/1` or
`0/0` from its arrangement call.

Load it as a `VariantTrack` whose adapter carries the samples TSV, with a
`LinearMultiSampleVariantDisplay` that both orders (`groupBy`) and colors
(`colorBy`) its rows by the `karyotype` column:

```json
{
  "type": "VariantTrack",
  "trackId": "dgrp_In2Lt_sv",
  "name": "In(2L)t inversion genotyped across DGRP lines",
  "assemblyNames": ["dm6"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://jbrowse.org/demos/popgen/dgrp_In2Lt_sv.vcf.gz",
    "samplesTsvLocation": {
      "uri": "https://jbrowse.org/demos/popgen/dgrp_In2Lt_samples.tsv"
    }
  },
  "displays": [
    {
      "type": "LinearMultiSampleVariantDisplay",
      "groupBy": "karyotype",
      "colorBy": "karyotype"
    }
  ]
}
```

Viewed across the whole arm, each row is a line colored by its genotype at the
inversion, with the karyotype strip down the sidebar. `groupBy` keeps the two
karyotype classes contiguous, so each reads as one block.

<Figure src="/img/popgen/in2lt_inversion.png" caption="Top: all six dm6 arms, with the In(2L)t extent over Fst between the two arrangements, the block on 2L standing against low background everywhere else. Bottom: the same two tracks across chr2L alone, with one row per DGRP line under them, genotyped for the inversion and grouped by karyotype. The carrier block spans breakpoint to breakpoint; the Fst plateau above it runs past both." links="Six arms=popgen/fst_in2lt_2L,Chromosome 2L=popgen/in2lt_per_sample"/>

The genotypes here are the arrangement karyotypes themselves, so the lane
records which lines carry the inversion, and the two Fst lanes above it quantify
how far ordinary SNPs across the region co-segregate with it. The plateau
carries a few megabases past each breakpoint, the margin
[Corbett-Detig & Hartl](https://doi.org/10.1371/journal.pgen.1003056) report for
the common _Drosophila_ inversions; the extent at the top of the frame is
published coordinates.

## Reproduce it end to end

Every step above (the downloads, the group split, all three scans, and the
per-sample inversion genotypes) is wrapped in
[`build_dgrp_popgen.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_dgrp_popgen.sh),
which also downloads JBrowse and writes a ready-to-serve config:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_dgrp_popgen.sh
bash build_dgrp_popgen.sh                  # builds ./dgrp_popgen_build/jbrowse2
npx --yes serve dgrp_popgen_build/jbrowse2 # then open the printed URL
```

The config carries the dm6 assembly (from UCSC) plus the Fst, π, Tajima's D and
called-variant scan tracks and the inversion genotypes, opening on the In(2L)t
inversion across arm 2L. The `.bw` and `.vcf.gz` files are written next to it,
so you can host them elsewhere or
[open them as local track files](/docs/user_guides/basic_usage#opening-tracks)
in JBrowse Desktop.

## See also

- [](/docs/user_guides/quantitative_track)
- [](/docs/user_guides/multiquantitative_track)
- [](/docs/user_guides/multivariant_track)
- [](/docs/user_guides/gwas_track)
- [](/docs/config_guides/assemblies)
- [](/docs/tutorials/ld_human)
- [](/docs/tutorials/ld_mosquitoes)
- [](/docs/tutorials/dog10k_selection)
- [](/docs/jbrowse_anywidget)

## References

- Bhatia et al. (2013).
  [Estimating and interpreting FST: the impact of rare variants](https://doi.org/10.1101/gr.154831.113)
- Corbett-Detig & Hartl (2012).
  [Population genomics of inversion polymorphisms in Drosophila melanogaster](https://doi.org/10.1371/journal.pgen.1003056)
- Daborn et al. (2002).
  [A single P450 allele associated with insecticide resistance in Drosophila](https://doi.org/10.1126/science.1074170)
- Danecek et al. (2011).
  [The variant call format and VCFtools](https://doi.org/10.1093/bioinformatics/btr330)
- Gardeux et al. (2023).
  [DGRPool: A web tool leveraging harmonized Drosophila Genetic Reference Panel phenotyping data](https://doi.org/10.7554/eLife.88981)
- Huang et al. (2015).
  [Linkage disequilibrium and inversion-typing of the Drosophila melanogaster Genome Reference Panel](https://doi.org/10.1534/g3.115.019554)
- Korunes & Samuk (2021).
  [pixy: Unbiased estimation of nucleotide diversity and divergence in the presence of missing data](https://doi.org/10.1111/1755-0998.13326)
- Mackay et al. (2012).
  [The Drosophila melanogaster Genetic Reference Panel](https://doi.org/10.1038/nature10811)
- Schmidt et al. (2010).
  [Copy number variation and transposable elements feature in recent, ongoing adaptation at the Cyp6g1 locus](https://doi.org/10.1371/journal.pgen.1000998)
- Tajima (1989).
  [Statistical method for testing the neutral mutation hypothesis by DNA polymorphism](https://doi.org/10.1093/genetics/123.3.585)
- Weir & Cockerham (1984).
  [Estimating F-statistics for the analysis of population structure](https://doi.org/10.2307/2408641)
