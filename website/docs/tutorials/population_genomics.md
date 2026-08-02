---
title: Selection scans (Drosophila DGRP)
sidebar_label: Selection scans (DGRP)
description:
  Fst, diversity, and Tajima's D scans plus per-sample inversion genotypes from
  one VCF
guide_category: Tutorials
tutorial_category: Population genomics
---

**TL;DR:** compute per-window Fst, nucleotide diversity (π), and Tajima's D from
a multi-sample VCF, load them as bigWig quantitative tracks stacked on a shared
axis, and read where the signals line up against genes. JBrowse draws the
windowed statistic your tool produced; it runs no population-genetic inference
of its own.

## Prerequisites

To build the tracks:

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

Population-genetic scans are per-window statistics running along the genome: Fst
(differentiation between groups), nucleotide diversity (π) within a group, dxy
(divergence between groups). Each has the same shape as a wiggle track, so once
you've computed them from a multi-sample VCF you can load them into JBrowse and
read the peaks and troughs against genes. JBrowse does no population-genetic
inference itself; it draws the windowed statistic your tool produced. No single
statistic is decisive alone, so this tutorial stacks Fst, π, and Tajima's D on a
shared genomic axis: where the signals line up is what points to a selective
sweep, an inversion, or gene flow.

The [Jupyter selection-scan example](/docs/jbrowse_jupyter) runs this same
compute-then-view loop in Python and is available as a Colab notebook.

Everything below is a reproducible pipeline: each command runs against publicly
hosted _Drosophila melanogaster_ data on the dm6 assembly and produces bigWig
tracks you can load. Along the way it reproduces two signals from the
[Drosophila Genetic Reference Panel](https://dgrpool.epfl.ch/) (DGRP), a panel
of 205 inbred lines ([Mackay et al. 2012](https://doi.org/10.1038/nature10811)):

- Fst across the `In(2L)t` inversion: lines carrying the cosmopolitan `In(2L)t`
  inversion are strongly differentiated from standard-arrangement lines across
  the whole inverted region of chromosome arm `2L`, because the inversion
  suppresses recombination there
  ([Corbett-Detig & Hartl 2012](https://doi.org/10.1371/journal.pgen.1003056)).
  This megabase-scale signal is exactly what a windowed scan catches and a
  pairwise [LD triangle](/docs/tutorials/ld_human) misses. See
  that tutorial for why the two tools work at different scales.
- Genome-wide nucleotide diversity (π): the diversity landscape, dropping in
  low-recombination regions near the centromeres and at loci under selection
  such as `Cyp6g1`, an insecticide-resistance gene
  ([Daborn et al. 2002](https://doi.org/10.1126/science.1074170)).

The same workflow applies to any species and any grouping. Swap in your own
populations or your own VCF and the JBrowse side is identical.

## Build the scans

Two inputs, both on stable HTTPS hosts. The genotypes are the DGRP freeze-2
calls lifted to dm6 ([aertslab](https://resources.aertslab.org/DGRP2/)); the
inversion karyotypes come from
[DGRPool's In(2L)t phenotype record](https://dgrpool.epfl.ch/phenotypes/1520)
([Gardeux et al. 2023](https://doi.org/10.7554/eLife.88981)), which harmonizes
the `In(2L)t` typing of
[Huang et al. 2015](https://doi.org/10.1534/g3.115.019554). The karyotype column
is `0` for standard homozygotes, `2` for inverted homozygotes, and `1` for
heterozygotes, which is what splits the panel into the two groups Fst compares.

[`build_dgrp_popgen.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_dgrp_popgen.sh)
runs the whole pipeline: it downloads both files, derives the two sample lists
(normalizing DGRPool's `DGRP_021` to the VCF's `DGRP-021`), runs
[vcftools](https://vcftools.github.io/) for the Weir & Cockerham Fst estimator
([Weir & Cockerham 1984](https://doi.org/10.2307/2408641)), per-window
nucleotide diversity and Tajima's D
([Tajima 1989](https://doi.org/10.1093/genetics/123.3.585)) in 2 kb windows, and
packs each into a bigWig with `bedGraphToBigWig`. See
[reproduce it end to end](#reproduce-it-end-to-end) for the invocation.

The one thing to check yourself is chromosome naming, because a mismatch there
draws an empty track rather than an error. The script takes the contig names
from the VCF header, and this VCF calls the chromosome arms `2L`, `2R`, `3L`,
`3R`, `X` and `4`, FlyBase style, so the bigWigs use those names too. UCSC dm6
prefixes them `chr2L` and so on. If your dm6 assembly uses the UCSC names,
[refname aliasing](/docs/developer_guides/refname_aliasing) reconciles the two
at display time.

The rest of what the script does is bookkeeping you would otherwise have to get
right by hand: the three vcftools outputs disagree about whether a window start
is 0-based or 1-based, and one of them leaves the window end off entirely. A
mistake there shifts a whole track sideways by one window instead of failing.

Windows vcftools could not estimate come out as `nan` and are dropped. Negative
Fst estimates, an expected artifact of the Weir & Cockerham estimator at
low-differentiation sites, are floored at 0 for display, which is conventional.
Tajima's D keeps its sign: unlike Fst it is meaningfully signed, and the
negative excursions are the signal.

Because this VCF holds only variant sites, `--window-pi` sums diversity over the
genotyped SNPs and omits invariant positions, so the absolute values are not
calibrated. They remain directly comparable across windows of the same VCF. For
calibrated absolute π and dxy you need an allSites VCF and a tool that expects
one, such as [pixy](https://pixy.readthedocs.io/)
([Korunes & Samuk 2021](https://doi.org/10.1111/1755-0998.13326)), which
computes π, dxy, and Fst together without the missing-data bias. Its output is
one row per window with the value in a column, so it packs into a bigWig the
same way.

## Loading in JBrowse

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

Load the Fst and π scans as two separate tracks. Fst and π sit on very different
scales (Fst approaches 1, π stays near 0.01), so each needs its own y-axis (this
is the figure below). A
[multi-wiggle](/docs/config_guides/multiquantitative_track) is not appropriate
here: it shares one y-axis across its rows, which would flatten π against the
much larger Fst.

A multi-wiggle is appropriate when the rows are on the same scale, such as the
same statistic across groups. The per-group π bigWigs (`pi_INV.bw`/`pi_STD.bw`)
share a scale, so inverted and standard diversity load as one track on one
shared y-domain:

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
the inverted region, most noticeably near the breakpoints, but it is a mild
difference. Fst, below, is the signal that actually makes this arrangement stand
out.

## Reading the signals

We zoom out to the whole genome (all six arms). The `In(2L)t` Fst track rises
into a tall block of differentiation across the inverted region of chromosome
2L, while every other arm sits at low background Fst. Viewing all the arms at
once gives that block something to be measured against.

<Figure src="/img/popgen/fst_in2lt_2L.png" caption="All six dm6 arms. Top: the In(2L)t inversion extent. Bottom: Fst between In(2L)t and standard-arrangement lines, a tall block across the whole left arm of chromosome 2 against low background on every other arm."/>

Then we use the search box to jump to `Cyp6g1` (on `2R`) and add the Tajima's D
track from the pipeline alongside π. Both statistics dip together over the swept
window, which marks a hard sweep where either one alone would be ambiguous.

<Figure src="/img/popgen/tajimad_cyp6g1.png" caption="Tajima's D (top) and π (middle) across 2R around Cyp6g1 (highlighted; Cyp6g1 and Cyp6g2 labeled in the gene track). Both dip over the highlighted window against their flanking background: the joint trough is the hard-sweep signature."/>

Reading the two statistics together is what the stack is for, because each pair
of values means something different:

| Fst  | Within-group π         | Reading                                          |
| ---- | ---------------------- | ------------------------------------------------ |
| High | Low in one group       | Selective sweep / local adaptation in that group |
| High | High in both, high dxy | Long-standing divergence (e.g. an inversion)     |
| Low  | High                   | Shared variation / gene flow                     |

Other selection loci in this panel read the same way against their own genes,
including `Ace` and `CHKov1` on `3R`. `In(3R)Payne`, a cosmopolitan inversion
under clinal selection, is typed in the same DGRPool table set, so repeating the
grouping step with its phenotype scans `3R` exactly as the steps above scan
`2L`.

## Per-sample view: the inversion genotyped across the panel

The windowed Fst scan summarizes the inversion into one number per window. To
see which lines carry it, represent the whole arrangement as a single
structural-variant call, one `<INV>` record spanning the In(2L)t breakpoints
(`2L:2,225,744–13,154,180`), genotyped across every karyotyped line, and load it
in the [multi-sample variant display](/docs/user_guides/multivariant_track). A
per-SNP view can't hold a ~11 Mb inversion on screen: zoom out far enough to see
both breakpoints and the individual markers shrink to nothing. One SV call
sidesteps that, because the inversion is a single feature no matter how wide it
is.

Use the regular multi-sample display here rather than its matrix mode. Matrix
mode spaces one evenly-sized column per variant, which suits many SNPs but
discards the call's genomic extent. The regular display draws each genotype at
the call's true span, so the carriers line up under the Fst plateau.

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

Viewed across the whole arm, the single call resolves the arrangement at once:
each row is a line, colored by its genotype at the inversion, so the standard
lines form the pale homozygous-reference field and the In(2L)t carriers the
darker block beneath it, with the karyotype strip down the sidebar. `groupBy` is
what keeps those two blocks contiguous. Without it the rows keep the VCF's
column order, and the split only reads as two blocks by luck.

<Figure src="/img/popgen/in2lt_per_sample.png" caption="Whole chr2L. Top: the In(2L)t extent. Middle: Fst between arrangements. Bottom: one row per DGRP line, genotyped for the inversion as a single SV call and grouped by karyotype. The carrier block spans breakpoint to breakpoint, directly under the Fst plateau. Inversions draw as a tapered glyph, so each carrier row thins toward its left breakpoint."/>

The genotypes here are the arrangement karyotypes themselves, so this is the
cleanest per-line view of _who_ carries the inversion. The independent evidence
that ordinary SNPs across the region co-segregate with it (the reason the
arrangement behaves as one recombination-suppressed block) is exactly what the
Fst scan above quantifies.

## Notes

- Window size trades resolution for smoothness. The scans above use 2 kb
  windows, dense enough in this panel that a single-gene sweep like Cyp6g1
  resolves sharply. Widen toward 5-10 kb for smoother genome-wide overviews, or
  narrow further only where SNP density stays high.
- Heterozygous karyotypes were dropped from both groups above. Contrasting
  homozygous arrangements gives the clearest inversion signal.
- Haplotype-based selection statistics (iHS, XP-EHH, e.g. from
  [selscan](https://github.com/szpiech/selscan)) capture sweeps that Fst misses
  and, being per-site or per-window scores, load as bigWig quantitative tracks
  the same way.

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

The config carries the dm6 assembly (from UCSC) plus the Fst, π, and Tajima's D
scan tracks and the inversion genotypes, opening on the In(2L)t inversion across
arm 2L. The `.bw` and `.vcf.gz` files are written next to it, so you can host
them elsewhere or
[open them as local track files](/docs/user_guides/basic_usage#opening-tracks)
in JBrowse Desktop.

## See also

- [](/docs/user_guides/quantitative_track)
- [](/docs/user_guides/multiquantitative_track)
- [Multi-sample variant track](/docs/user_guides/multivariant_track)
- [](/docs/user_guides/gwas_track)
- [Configuring assemblies](/docs/config_guides/assemblies)

## References

Corbett-Detig, R. B., & Hartl, D. L. (2012).
[Population genomics of inversion polymorphisms in Drosophila melanogaster](https://doi.org/10.1371/journal.pgen.1003056).
_PLoS Genetics_, _8_(12), e1003056.

Daborn, P. J., Yen, J. L., Bogwitz, M. R., et al. (2002).
[A single P450 allele associated with insecticide resistance in Drosophila](https://doi.org/10.1126/science.1074170).
_Science_, _297_(5590), 2253–2256.

Danecek, P., Auton, A., Abecasis, G., et al. (2011).
[The variant call format and VCFtools](https://doi.org/10.1093/bioinformatics/btr330).
_Bioinformatics_, _27_(15), 2156–2158.

Gardeux, V., Gonzalez-Morales, N., Deplancke, B., et al. (2023).
[DGRPool: A web tool leveraging harmonized Drosophila Genetic Reference Panel phenotyping data](https://doi.org/10.7554/eLife.88981).
_eLife_, _12_, e88981.

Huang, W., Massouras, A., Inoue, Y., et al. (2015).
[Linkage disequilibrium and inversion-typing of the Drosophila melanogaster Genome Reference Panel](https://doi.org/10.1534/g3.115.019554).
_G3: Genes, Genomes, Genetics_, _5_(8), 1695–1701.

Korunes, K. L., & Samuk, K. (2021).
[pixy: Unbiased estimation of nucleotide diversity and divergence in the presence of missing data](https://doi.org/10.1111/1755-0998.13326).
_Molecular Ecology Resources_, _21_(4), 1359–1368.

Mackay, T. F. C., Richards, S., Stone, E. A., et al. (2012).
[The Drosophila melanogaster Genetic Reference Panel](https://doi.org/10.1038/nature10811).
_Nature_, _482_(7384), 173–178.

Tajima, F. (1989).
[Statistical method for testing the neutral mutation hypothesis by DNA polymorphism](https://doi.org/10.1093/genetics/123.3.585).
_Genetics_, _123_(3), 585–595.

Weir, B. S., & Cockerham, C. C. (1984).
[Estimating F-statistics for the analysis of population structure](https://doi.org/10.2307/2408641).
_Evolution_, _38_(6), 1358–1370.
