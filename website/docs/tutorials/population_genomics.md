---
title: Selection scans (Drosophila DGRP)
sidebar_label: Selection scans (DGRP)
description:
  Fst, diversity, and Tajima's D scans plus per-sample inversion genotypes from
  one VCF
guide_category: Tutorials
tutorial_category: Population genomics
---

In _Drosophila melanogaster_, a selective sweep at the insecticide-resistance
gene _Cyp6g1_ and the `In(2L)t` inversion on chromosome 2L each leave a mark in
population-genetic statistics. From a multi-sample VCF of 205 inbred lines we
compute three statistics per window: Fst (how far apart two groups' allele
frequencies sit), nucleotide diversity (π, how much sequences differ within a
group) and Tajima's D (below zero where rare variants are in excess, as after a
sweep). We load each as a bigWig track on dm6, read the _Cyp6g1_ sweep against
the genes, then read the inversion.

## Prerequisites

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
- the finished Fst scan, rehosted: https://jbrowse.org/demos/popgen/fst_In2Lt.bw
- π inside the inverted and standard karyotypes:
  https://jbrowse.org/demos/popgen/pi_INV.bw and
  https://jbrowse.org/demos/popgen/pi_STD.bw
- the π ratio between the two:
  https://jbrowse.org/demos/popgen/pi_ratio_In2Lt.bw
- Tajima's D over the whole panel:
  https://jbrowse.org/demos/popgen/tajimad_all.bw
- π over the whole panel: https://jbrowse.org/demos/popgen/pi_all.bw
- the called-variant count per window:
  https://jbrowse.org/demos/popgen/sites_all.bw
- the `In(2L)t` inversion genotyped per line:
  https://jbrowse.org/demos/popgen/dgrp_In2Lt_sv.vcf.gz
- the karyotype table that genotype track bands its rows by:
  https://jbrowse.org/demos/popgen/dgrp_In2Lt_samples.tsv

The dm6 assembly and gene track are the hosted UCSC
[hub](/docs/user_guides/hub_url)'s own entries.

## Windowed statistics as tracks

A population-genetic scan reports one statistic per window along the genome,
such as Fst, π, or dxy (the average sequence difference between two groups). Any
per-window output loads as a
[quantitative track](/docs/user_guides/quantitative_track), and haplotype
statistics (iHS, XP-EHH, e.g. from
[selscan](https://github.com/szpiech/selscan)) load the same way.

We stack Fst, π and Tajima's D in one view over the
[Drosophila Genetic Reference Panel](https://dgrpool.epfl.ch/) (DGRP) on dm6 and
look at two signals:

- π dips at loci under selection, such as the insecticide-resistance gene
  _Cyp6g1_ ([Daborn et al. 2002](https://doi.org/10.1126/science.1074170)).
- Fst across the `In(2L)t` inversion, a stretch of chromosome 2L flipped end to
  end. It suppresses recombination between the inverted and standard
  arrangements in a heterozygote
  ([Corbett-Detig & Hartl 2012](https://doi.org/10.1371/journal.pgen.1003056)),
  so Fst tracks the arrangement boundary.

## Building Fst, π and Tajima's D bigWigs with vcftools

DGRPool's inversion karyotypes, each line's `In(2L)t` arrangement
([Gardeux et al. 2023](https://doi.org/10.7554/eLife.88981)), harmonize the
typing of [Huang et al. 2015](https://doi.org/10.1534/g3.115.019554): `0` for
standard homozygotes, `2` for inverted, `1` for heterozygotes, which the script
drops.
[`build_dgrp_popgen.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_dgrp_popgen.sh)
derives the two sample lists, one name per line as
[vcftools](https://vcftools.github.io/) takes for `--weir-fst-pop` and `--keep`,
normalizing DGRPool's `DGRP_021` to the VCF's `DGRP-021`. DGRPool also types
`In(3R)Payne`, so repeating the grouping step with that phenotype scans `3R` the
same way.

Each scan is one vcftools run, an awk turning its table into a bedGraph, and a
pack into a bigWig. Fst uses the Weir & Cockerham estimator
([Weir & Cockerham 1984](https://doi.org/10.2307/2408641)):

<!-- from: scripts/build_dgrp_popgen.sh -->

```bash
# chrom.sizes from the VCF header, so it uses the contig names of the scans
bcftools view -h dgrp2.vcf.gz |
  awk -F'[=,>]' '/^##contig/{print $3"\t"$5}' > dm6.chrom.sizes

# window equal to step, so windows tile the genome
vcftools --gzvcf dgrp2.vcf.gz \
  --weir-fst-pop In2Lt_INV.txt --weir-fst-pop In2Lt_STD.txt \
  --fst-window-size 2000 --fst-window-step 2000 --out fst_In2Lt
# BIN_START is 1-based here, hence -1
# negative Fst is an estimator artifact at low-differentiation sites; floor at 0
# $5 is WEIGHTED_FST, the ratio of summed variance components
# $6, MEAN_FST, averages per-site ratios and swings on a few uninformative sites
# BIN_END is the nominal window end, so the last window of a contig passes its
# end; clamp it, or bedGraphToBigWig refuses the whole file
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
`pi_all.windowed.pi`, with `--keep` restricting it to one arrangement:

<!-- from: scripts/build_dgrp_popgen.sh -->

```bash
vcftools --gzvcf dgrp2.vcf.gz --window-pi 2000 --out pi_all
vcftools --gzvcf dgrp2.vcf.gz --keep In2Lt_INV.txt --window-pi 2000 --out pi_INV
```

`$4` of the same table is the called-variant count the figure below stacks under
π, packed into a bigWig by the same `awk` and `bedGraphToBigWig` pair.

The inverted and standard groups are very unequal in size, since the inverted
arrangement is the rarer one. Hudson's estimator is the usual recommendation
where groups differ this much
([Bhatia et al. 2013](https://doi.org/10.1101/gr.154831.113));
[](/docs/tutorials/dog10k_selection) scans with that one.

Tajima's D ([Tajima 1989](https://doi.org/10.1093/genetics/123.3.585)) reports
`BIN_START` 0-based, so no `-1` shift, and no `BIN_END`, so the window end is
constructed before the clamp:

<!-- from: scripts/build_dgrp_popgen.sh -->

```bash
vcftools --gzvcf dgrp2.vcf.gz --TajimaD 2000 --out tajimad_all
# BIN_START is already 0-based, and there is no BIN_END
# build the end here and clamp it to the contig length
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

A contig-name mismatch draws an empty track with no error. The bigWigs take
contig names from the VCF header (`2L`, `2R`, `X`, FlyBase style), where UCSC
dm6 writes `chr2L`, and
[refname aliasing](/docs/developer_guides/refname_aliasing) maps one to the
other.

The DGRP VCF holds variant sites only, so `--window-pi` counts every position
missing from the file as invariant and callable, and a window that lost sites to
filtering shows low diversity. [pixy](https://pixy.readthedocs.io/)
([Korunes & Samuk 2021](https://doi.org/10.1111/1755-0998.13326)) takes an
allSites VCF and reports π, dxy and Fst per window without that bias, and its
output packs into a bigWig the same way. Filtering also shifts the whole
baseline of Tajima's D, so read D at a locus against the genome-wide background
of the 205 lines.

## Loading the scans in JBrowse

We load the dm6 assembly from UCSC. Its reference names arms `chr2L`, and the
alias file maps them to the bare `2L` the scans use:

```json addassembly
{
  "name": "dm6",
  "aliases": ["BDGP6"],
  "sequence": {
    "adapter": {
      "type": "TwoBitAdapter",
      "uri": "https://hgdownload.soe.ucsc.edu/goldenPath/dm6/bigZips/dm6.2bit"
    }
  },
  "refNameAliases": {
    "uri": "https://hgdownload.soe.ucsc.edu/goldenPath/dm6/bigZips/dm6.chromAlias.txt"
  }
}
```

The gene track is UCSC's RefSeq annotation of dm6:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "dm6_ncbiRefSeq",
  "name": "NCBI RefSeq genes",
  "assemblyNames": ["dm6"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "uri": "https://jbrowse.org/ucsc/dm6/ncbiRefSeq.gff.gz"
  }
}
```

Each scan loads as a [quantitative track](/docs/user_guides/quantitative_track)
over its bigWig. To load your own, swap `uri` for the bigWig your build wrote;
its contig names must match the assembly or its aliases.

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

Fst and π sit on very different scales, so each loads as its own track with its
own y-axis. A [multi-wiggle](/docs/config_guides/quantitative_track) shares one
axis across rows, which suits the same statistic across groups, so the per-group
π bigWigs load as one track:

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

In 2 kb windows each arrangement's π swings several fold from one window to the
next, far more than the two arrangements differ, so two rows of it look alike.
Pooling the windows into 250 kb bins and taking log2 of inverted over standard
gives one track that sits at zero wherever the arrangements have equal
diversity. The build script's `awk` step writes it from the two π bedGraphs:

<!-- from: scripts/build_dgrp_popgen.sh -->

```bash
# B: bin width; each bin's pi is the length-weighted mean of its 2 kb windows
awk -F'\t' -v OFS='\t' -v B=250000 '
  NR==FNR { len[$1]=$2; next }
  FNR==1 { g++ }
  { k=$1 SUBSEP int($2/B); w=$3-$2; s[g,k]+=$4*w; n[g,k]+=w; seen[k] }
  END {
    for (k in seen) if (s[1,k]>0 && s[2,k]>0) {
      split(k, a, SUBSEP); end=(a[2]+1)*B; if (end>len[a[1]]) end=len[a[1]]
      print a[1], a[2]*B, end, log((s[1,k]/n[1,k])/(s[2,k]/n[2,k]))/log(2)
    }
  }' dm6.chrom.sizes pi_INV.bedgraph pi_STD.bedgraph |
  sort -k1,1 -k2,2n > pi_ratio_In2Lt.bedgraph
bedGraphToBigWig pi_ratio_In2Lt.bedgraph dm6.chrom.sizes pi_ratio_In2Lt.bw
```

The π ratio track colors bins by their side of zero on a pinned symmetric axis:

```json addtrack
{
  "type": "QuantitativeTrack",
  "trackId": "pi_ratio_in2lt",
  "name": "π, In(2L)t over standard (log2, 250 kb bins)",
  "assemblyNames": ["dm6"],
  "adapter": {
    "type": "BigWigAdapter",
    "uri": "https://jbrowse.org/demos/popgen/pi_ratio_In2Lt.bw"
  },
  "displayDefaults": {
    "color": {
      "field": "score",
      "scale": "threshold",
      "domain": [0],
      "range": ["#e66100", "#1f78b4"],
      "labels": ["inverted lower", "inverted higher"],
      "title": "π, In(2L)t vs standard"
    },
    "scales": {
      "y": { "domainMin": -1.5, "domainMax": 1.5, "title": "log2 ratio" }
    }
  }
}
```

## Reading the Cyp6g1 sweep in Tajima's D and π

Search `Cyp6g1`, an insecticide-resistance gene on `2R`, in the location box.
Add three `QuantitativeTrack`s shaped like the Fst track above: Tajima's D, π,
and the called-variant count per window (column 4 of the table π comes from),
each over all 205 lines.

```json addtrack
{
  "type": "QuantitativeTrack",
  "trackId": "tajd_all",
  "name": "Tajima's D (whole panel)",
  "assemblyNames": ["dm6"],
  "adapter": {
    "type": "BigWigAdapter",
    "uri": "https://jbrowse.org/demos/popgen/tajimad_all.bw"
  }
}
```

```json addtrack
{
  "type": "QuantitativeTrack",
  "trackId": "pi_all",
  "name": "π (whole panel)",
  "assemblyNames": ["dm6"],
  "adapter": {
    "type": "BigWigAdapter",
    "uri": "https://jbrowse.org/demos/popgen/pi_all.bw"
  }
}
```

```json addtrack
{
  "type": "QuantitativeTrack",
  "trackId": "sites_all",
  "name": "Called variants per window",
  "assemblyNames": ["dm6"],
  "adapter": {
    "type": "BigWigAdapter",
    "uri": "https://jbrowse.org/demos/popgen/sites_all.bw"
  }
}
```

To band the swept window, drag across `chr2R:12,130,000-12,200,000` on the
scalebar and pick **Highlight region**.

<Figure src="/img/popgen/tajimad_cyp6g1.png" caption="Tajima's D, π and called variants per window across 2R around Cyp6g1 (highlighted; Cyp6g1 and Cyp6g2 labeled in the gene track). D and π dip together over the highlighted window against their background either side, and the count of called variants under them falls with them."/>

Called variants fall under the sweep because a duplication of _Cyp6g1_
segregates alongside the resistance allele
([Schmidt et al. 2010](https://doi.org/10.1371/journal.pgen.1000998)), and the
duplicated sequence lowers the number of sites called in the window.

## The In(2L)t inversion, genome-wide and within each arrangement {#the-inversion-genome-wide-and-within-each-arrangement}

Open the assembly with no location to lay the six arms out side by side, with
the `In(2L)t` Fst track across all of them.

The inversion itself is one `<INV>` record spanning the published breakpoints,
genotyped `1/1` in the inverted lines and `0/0` in the standard ones. The `END`
field holds the far breakpoint:

```text
#CHROM  POS      ID     REF  ALT    QUAL  FILTER  INFO                     FORMAT  DGRP-026  DGRP-032
2L      2225744  In2Lt  N    <INV>  .     PASS    SVTYPE=INV;END=13154180  GT      1/1       0/0
```

The samples TSV pairs each line with its `karyotype` (standard or inverted),
which the display bands and colors rows by:

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
      "facet": { "field": "karyotype", "domain": ["Standard", "In(2L)t"] },
      "rowColor": "karyotype"
    }
  ]
}
```

The track above Fst in the figure marks the published extent with one inline
feature:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "in2lt_inversion",
  "name": "In(2L)t inversion",
  "assemblyNames": ["dm6"],
  "adapter": {
    "type": "FromConfigAdapter",
    "features": [
      {
        "uniqueId": "in2lt",
        "refName": "chr2L",
        "start": 2225744,
        "end": 13154180,
        "name": "In(2L)t"
      }
    ]
  }
}
```

Open `chr2L` alone, with the π ratio track under Fst:

<Figure src="/img/popgen/in2lt_pi_ratio.png" caption="Top: the six dm6 arms with the In(2L)t extent over Fst between the two arrangements; the block on 2L stands against low background elsewhere. Below, chr2L alone with π in the inverted lines over π in the standard ones, log2 in 250 kb bins." links="Six arms=popgen/fst_in2lt_2L"/>

The inverted lines have less diversity than the standard ones across the
inverted region, most near the breakpoints, where the suppressed recombination
is strongest. Toward the centromere past the inversion, where the arrangements
recombine freely, the ratio sits at zero.

Differentiation decays gradually outside the breakpoints
([Corbett-Detig & Hartl](https://doi.org/10.1371/journal.pgen.1003056)); the
inversion track at the top of the frame marks the published breakpoints.

## Reproduce it end to end

[`build_dgrp_popgen.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_dgrp_popgen.sh)
wraps every step above and writes a ready-to-serve config:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_dgrp_popgen.sh
bash build_dgrp_popgen.sh                  # builds ./dgrp_popgen_build/jbrowse2
npx --yes serve dgrp_popgen_build/jbrowse2 # then open the printed URL
```

The config holds the dm6 assembly, every scan, and one `<INV>` record over the
published In(2L)t breakpoints, genotyped in each line from its DGRPool
karyotype. It opens on In(2L)t across arm 2L. The `.bw` and `.vcf.gz` files are
written next to it, to host elsewhere or
[open as local track files](/docs/user_guides/basic_usage#opening-tracks) in
JBrowse Desktop.

## See also

- [](/docs/user_guides/quantitative_track)
- [](/docs/user_guides/multivariant_track)
- [](/docs/user_guides/gwas_track)
- [](/docs/config_guides/assemblies)
- [](/docs/tutorials/ld_human)
- [](/docs/tutorials/ld_mosquitoes)
- [](/docs/tutorials/dog10k_selection)
- [](/docs/config_guides/grouping_and_ordering)
- [](/docs/jbrowse_anywidget)

## Citations

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
