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
- a JBrowse to open them in: [Desktop](/docs/quickstart_desktop) takes a local
  file by path, [Web](/docs/quickstart_web) through **Add track**
- `curl`
- `node`, for the [JBrowse CLI](/docs/cli)
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

## Where the data comes from

The Drosophila Genetic Reference Panel, 205 inbred lines
([Mackay et al. 2012](https://doi.org/10.1038/nature10811)), lifted to dm6.

- the DGRP freeze-2 genotype calls:
  https://resources.aertslab.org/DGRP2/NCSU/final/dm6/DGRP2.source_NCSU.dm6.final.SNPs_only.vcf.gz
- the `In(2L)t` inversion karyotype for each line, from DGRPool's phenotype
  record: https://dgrpool.epfl.ch/phenotypes/1520/download
- the finished Fst scan, rehosted so the tracks on this page load without
  rebuilding: https://jbrowse.org/demos/popgen/fst_In2Lt.bw
- π inside the inverted and standard karyotypes:
  https://jbrowse.org/demos/popgen/pi_INV.bw and
  https://jbrowse.org/demos/popgen/pi_STD.bw
- the inversion genotypes and the line table beside them:
  https://jbrowse.org/demos/popgen/dgrp_In2Lt_sv.vcf.gz and
  https://jbrowse.org/demos/popgen/dgrp_In2Lt_samples.tsv

The dm6 assembly and gene track are the hosted UCSC
[hub](/docs/user_guides/hub_url)'s own entries.

## Windowed statistics as tracks

A population-genetic scan is a per-window statistic along the genome: Fst
between two groups, nucleotide diversity (π) within one, dxy between them. That
is the shape of a wiggle track, so whatever a scanner writes per window loads as
a [quantitative track](/docs/user_guides/quantitative_track). Haplotype
statistics (iHS, XP-EHH, e.g. from
[selscan](https://github.com/szpiech/selscan)) load the same way.

This tutorial stacks Fst, π and Tajima's D in one view over the
[Drosophila Genetic Reference Panel](https://dgrpool.epfl.ch/) (DGRP), 205
inbred lines ([Mackay et al. 2012](https://doi.org/10.1038/nature10811)) on dm6.
Two signals stand out:

- **Fst across the `In(2L)t` inversion.** The inversion suppresses recombination
  between the two arrangements in a heterozygote
  ([Corbett-Detig & Hartl 2012](https://doi.org/10.1371/journal.pgen.1003056)),
  so Fst tracks the arrangement boundary.
- **The π landscape.** It dips at loci under selection, such as the
  insecticide-resistance gene _Cyp6g1_
  ([Daborn et al. 2002](https://doi.org/10.1126/science.1074170)).

## Building the scans

The inversion karyotypes
([Gardeux et al. 2023](https://doi.org/10.7554/eLife.88981)) harmonize the
`In(2L)t` typing of [Huang et al. 2015](https://doi.org/10.1534/g3.115.019554):
`0` for standard homozygotes, `2` for inverted, `1` for heterozygotes, which are
dropped.
[`build_dgrp_popgen.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_dgrp_popgen.sh)
derives the two sample lists, one name per line as
[vcftools](https://vcftools.github.io/) takes for `--weir-fst-pop` and `--keep`,
normalizing DGRPool's `DGRP_021` to the VCF's `DGRP-021`.

Each scan is one vcftools run, an awk turning its table into a bedGraph, and a
pack into a bigWig. Fst uses the Weir & Cockerham estimator
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

Diversity is the same three steps with `--window-pi 2000`, reading `$5` of
`pi_all.windowed.pi`, with `--keep` restricting it to one arrangement. `$4` of
the same table is the called-variant count the figure below stacks under π.

The two groups are very unequal, since the inverted arrangement is the rarer
one. Hudson's estimator is the usual recommendation where groups differ this
much ([Bhatia et al. 2013](https://doi.org/10.1101/gr.154831.113));
[](/docs/tutorials/dog10k_selection) scans with that one.

Tajima's D ([Tajima 1989](https://doi.org/10.1093/genetics/123.3.585)) reports
`BIN_START` 0-based, so no `-1` shift, and no `BIN_END`, so the window end is
constructed before the clamp:

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

Window size trades resolution for smoothness. 2 kb resolves a single-gene sweep
like _Cyp6g1_ sharply; widen toward 5-10 kb for smoother genome-wide overviews.

Check chromosome naming: a mismatch draws an empty track with no error. The
bigWigs take their contig names from the VCF header (`2L`, `2R`, `X`, FlyBase
style) where UCSC dm6 prefixes them `chr2L`.
[Refname aliasing](/docs/developer_guides/refname_aliasing) reconciles the two.

Because this VCF holds variant sites only, `--window-pi` counts every position
not in the file as invariant and callable alike, so a window that lost sites to
filtering reads as low diversity. [pixy](https://pixy.readthedocs.io/)
([Korunes & Samuk 2021](https://doi.org/10.1111/1755-0998.13326)) takes an
allSites VCF and reports π, dxy and Fst per window without that bias, and its
output packs into a bigWig the same way. The same filtering lifts Tajima's D's
whole baseline, so D reads as an excursion against the panel's own background.

## Loading the scans in JBrowse

With a dm6 assembly and gene track loaded (see
[configuring assemblies](/docs/config_guides/assemblies) and
[gene tracks](/docs/user_guides/gene_track)), each scan is a
[quantitative track](/docs/user_guides/quantitative_track) over its bigWig:

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

Fst and π sit on very different scales, so load them as separate tracks with
their own y-axes. A [multi-wiggle](/docs/config_guides/multiquantitative_track)
shares one axis across rows, which suits the same statistic across groups, so
the per-group π bigWigs load as one track:

```json addtrack
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

The inverted lines carry less diversity than the standard ones across the
inverted region, most noticeably near the breakpoints.

## Reading the signals

Search `Cyp6g1` (on `2R`) in the location box and add the Tajima's D track
alongside π. Both dip together over the swept window. Add the called-variant
count under them, column 4 of the table π comes from. A duplication of _Cyp6g1_
segregates alongside the resistance allele
([Schmidt et al. 2010](https://doi.org/10.1371/journal.pgen.1000998)), and copy
number costs a window called sites.

<Figure src="/img/popgen/tajimad_cyp6g1.png" caption="Tajima's D, π and called variants per window across 2R around Cyp6g1 (highlighted; Cyp6g1 and Cyp6g2 labeled in the gene track). D and π dip together over the highlighted window against their background either side. The count under them falls too, but nothing like as far."/>

Each pair of values reads differently:

| Fst  | Within-group π         | Reading                                          |
| ---- | ---------------------- | ------------------------------------------------ |
| High | Low in one group       | Selective sweep / local adaptation in that group |
| High | High in both, high dxy | Long-standing divergence (e.g. an inversion)     |
| Low  | High                   | Shared variation / gene flow                     |

_Ace_ and _CHKov1_ on `3R` read the same way. `In(3R)Payne` is typed in the same
DGRPool table set, so repeating the grouping step with its phenotype scans `3R`
as above.

## The inversion, genome-wide and per line

Opening the assembly with no location lays the six arms out side by side. The
`In(2L)t` Fst track rises over the inverted region of 2L against low background
everywhere else.

To see which lines carry it, represent the arrangement as one `<INV>` record
spanning the In(2L)t breakpoints (`2L:2,225,744-13,154,180`), genotyped across
every karyotyped line, and load it in the
[regular multi-sample variant display](/docs/user_guides/multivariant_track#regular-best-for-full-sv-detail),
which draws each genotype at the call's true span.
[](/docs/tutorials/ld_mosquitoes) builds the same track for a mosquito
inversion.

The build script writes both inputs: a `samples.tsv` whose first column is the
sample name and whose other columns are attributes to order and color rows by,
and a one-record SV VCF genotyping every line `1/1` or `0/0`. Load it with a
`LinearMultiSampleVariantDisplay` that orders (`groupBy`) and colors (`colorBy`)
rows by the `karyotype` column:

```json addtrack
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

Each row is a line colored by its genotype, with the karyotype strip down the
sidebar and the two classes contiguous.

<Figure src="/img/popgen/in2lt_inversion.png" caption="Top: all six dm6 arms, with the In(2L)t extent over Fst between the two arrangements, the block on 2L standing against low background everywhere else. Bottom: the same two tracks across chr2L alone, with one row per DGRP line under them, genotyped for the inversion and grouped by karyotype. The carrier block spans breakpoint to breakpoint; the Fst plateau above it runs past both." links="Six arms=popgen/fst_in2lt_2L,Chromosome 2L=popgen/in2lt_per_sample"/>

Differentiation decays outside the breakpoints rather than stopping at them
([Corbett-Detig & Hartl](https://doi.org/10.1371/journal.pgen.1003056)); the
extent at the top of the frame is published coordinates.

## Reproduce it end to end

[`build_dgrp_popgen.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_dgrp_popgen.sh)
wraps every step above and writes a ready-to-serve config:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_dgrp_popgen.sh
bash build_dgrp_popgen.sh                  # builds ./dgrp_popgen_build/jbrowse2
npx --yes serve dgrp_popgen_build/jbrowse2 # then open the printed URL
```

The config carries the dm6 assembly plus every scan and the inversion genotypes,
opening on In(2L)t across arm 2L. The `.bw` and `.vcf.gz` files are written next
to it, to host elsewhere or
[open as local track files](/docs/user_guides/basic_usage#opening-tracks) in
JBrowse Desktop.

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
