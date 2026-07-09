---
title: Population genomics
description:
  Windowed Fst and nucleotide diversity scans from a real multi-sample
  Drosophila VCF, loaded as wiggle tracks — a fully reproducible pipeline
guide_category: Tutorials
---

Population-genetic scans — **Fst** (differentiation between groups),
**nucleotide diversity (π)** within a group, and **dxy** (divergence between
groups) — are per-window statistics along the genome. That is exactly the shape
of a wiggle track, so once you compute them from a multi-sample VCF you can load
them straight into JBrowse and read the peaks and troughs against genes.

JBrowse does no population-genetic inference itself; it draws the windowed
statistic your tool produced. This tutorial is an end-to-end **reproducible
pipeline**: every command below runs against real, publicly hosted _Drosophila
melanogaster_ data on the dm6 assembly and produces bigWig tracks you can load.
It reproduces two signals from the
[Drosophila Genetic Reference Panel](http://dgrp2.gnets.ncsu.edu/) (DGRP), a
panel of 205 inbred lines from a single Raleigh, North Carolina population
([Mackay et al. 2012](https://doi.org/10.1038/nature10811)):

- **Fst across the `In(2L)t` inversion** — lines carrying the cosmopolitan
  `In(2L)t` inversion are strongly differentiated from standard-arrangement
  lines across the whole inverted region of chromosome arm `2L`, because the
  inversion suppresses recombination there
  ([Corbett-Detig & Hartl 2012](https://doi.org/10.1371/journal.pgen.1003056)).
- **Genome-wide nucleotide diversity (π)** — the diversity landscape, dropping
  in low-recombination regions near the centromeres and at loci under selection
  such as `Cyp6g1`, the insecticide-resistance cytochrome P450 whose resistance
  haplotype segregates at high frequency in this derived population
  ([Daborn et al. 2002](https://doi.org/10.1126/science.1074170)).

The same workflow applies to any species and any grouping — swap in your own
populations or your own VCF and the JBrowse side is identical.

## Tools

The pipeline uses three standard command-line tools:

- [vcftools](https://vcftools.github.io/) — windowed Fst and π from a VCF
- [bcftools](https://samtools.github.io/bcftools/) — reading the VCF header and
  sample list
- [`bedGraphToBigWig`](https://hgdownload.soe.ucsc.edu/admin/exe/) — UCSC
  utility that packs a bedGraph into an indexed bigWig

All three are on [bioconda](https://bioconda.github.io/):
`conda install -c bioconda vcftools bcftools ucsc-bedgraphtobigwig`.

## Get the data

Two downloads, both on stable HTTPS hosts. The genotypes are the DGRP freeze-2
calls lifted to dm6 ([aertslab](https://resources.aertslab.org/DGRP2/)); the
inversion karyotypes come from [DGRPool](https://dgrpool.epfl.ch/)
([Gardeux et al. 2023](https://doi.org/10.7554/eLife.88981)), which harmonizes
the `In(2L)t` typing of
[Huang et al. 2015](https://doi.org/10.1534/g3.115.019554):

```bash
BASE=https://resources.aertslab.org/DGRP2/NCSU/final/dm6
curl -LO "$BASE/DGRP2.source_NCSU.dm6.final.SNPs_only.vcf.gz"
curl -LO "$BASE/DGRP2.source_NCSU.dm6.final.SNPs_only.vcf.gz.csi"
VCF=DGRP2.source_NCSU.dm6.final.SNPs_only.vcf.gz

# In(2L)t karyotype per line (columns: DGRP, sex, value)
curl -Lo In2Lt.tsv https://dgrpool.epfl.ch/phenotypes/1520/download
```

Derive `chrom.sizes` straight from the VCF header so the contig names are
**guaranteed** to match — the usual cause of an empty track is a name mismatch:

```bash
bcftools view -h "$VCF" \
  | awk -F'[=,>]' '/^##contig/{print $3"\t"$5}' > dm6.chrom.sizes
```

This VCF names the chromosome arms `2L`, `2R`, `3L`, `3R`, `X`, `4` (FlyBase
style). UCSC dm6 prefixes them `chr2L`, etc.; if your JBrowse dm6 assembly uses
the UCSC names, JBrowse's
[refname aliasing](/docs/developer_guides/refname_aliasing) reconciles the two
at display time.

## Define the two groups

The `In2Lt.tsv` `value` column is `0` for standard homozygotes, `2` for inverted
homozygotes, and `1` for heterozygotes. Split the homozygous karyotypes into two
sample lists, normalize the `DGRP_021` naming to the VCF's `DGRP-021`, and keep
only lines actually present in the VCF:

```bash
bcftools query -l "$VCF" | sort > vcf.samples
awk -F'\t' 'NR>1 && $3==0 {gsub(/_/,"-",$1); print $1}' In2Lt.tsv \
  | sort | comm -12 - vcf.samples > In2Lt_STD.txt   # standard arrangement
awk -F'\t' 'NR>1 && $3==2 {gsub(/_/,"-",$1); print $1}' In2Lt.tsv \
  | sort | comm -12 - vcf.samples > In2Lt_INV.txt   # In(2L)t inverted
wc -l In2Lt_STD.txt In2Lt_INV.txt   # ~161 standard, ~19 inverted
```

## Windowed Fst → bigWig

[vcftools](https://vcftools.github.io/) computes the Weir & Cockerham Fst
estimator ([Weir & Cockerham 1984](https://doi.org/10.2307/2408641)) in fixed
windows from a VCF and two sample lists:

```bash
vcftools --gzvcf "$VCF" \
  --weir-fst-pop In2Lt_INV.txt \
  --weir-fst-pop In2Lt_STD.txt \
  --fst-window-size 10000 --fst-window-step 10000 \
  --out fst_In2Lt
# -> fst_In2Lt.windowed.weir.fst
#    CHROM  BIN_START  BIN_END  N_VARIANTS  WEIGHTED_FST  MEAN_FST
```

Convert to bigWig. Take `WEIGHTED_FST` (column 5), skip `-nan` windows, floor
slightly-negative estimates at 0, and shift `BIN_START` from 1-based to the
0-based half-open coordinates bedGraph expects:

```bash
awk 'NR>1 && $5!="-nan" {v=($5<0?0:$5); print $1"\t"($2-1)"\t"$3"\t"v}' \
  fst_In2Lt.windowed.weir.fst \
  | sort -k1,1 -k2,2n > fst_In2Lt.bedgraph
bedGraphToBigWig fst_In2Lt.bedgraph dm6.chrom.sizes fst_In2Lt.bw
```

## Windowed diversity (π) → bigWig

The same tool computes per-window nucleotide diversity. Run it on the whole
panel, or per group to compare inverted against standard:

```bash
vcftools --gzvcf "$VCF" --window-pi 10000 --out pi_all
# -> pi_all.windowed.pi   CHROM  BIN_START  BIN_END  N_VARIANTS  PI

awk 'NR>1 && $5!="nan" {print $1"\t"($2-1)"\t"$3"\t"$5}' pi_all.windowed.pi \
  | sort -k1,1 -k2,2n > pi_all.bedgraph
bedGraphToBigWig pi_all.bedgraph dm6.chrom.sizes pi_all.bw
```

Because this VCF holds only variant sites, `--window-pi` sums diversity over the
genotyped SNPs and omits invariant positions, so the absolute values are not
calibrated; they are still directly comparable **across windows of the same
VCF**. For calibrated absolute π and dxy you need an allSites VCF below.

## Full pipeline

The whole thing as one script — save as `popgen.sh` and run it in an empty
directory:

```bash
#!/usr/bin/env bash
set -euo pipefail

BASE=https://resources.aertslab.org/DGRP2/NCSU/final/dm6
VCF=DGRP2.source_NCSU.dm6.final.SNPs_only.vcf.gz

# 1. data (skip re-download if already present)
[ -f "$VCF" ]     || curl -LO "$BASE/$VCF"
[ -f "$VCF.csi" ] || curl -LO "$BASE/$VCF.csi"
[ -f In2Lt.tsv ]  || curl -Lo In2Lt.tsv https://dgrpool.epfl.ch/phenotypes/1520/download

# 2. chrom.sizes from the VCF header (names guaranteed to match)
bcftools view -h "$VCF" \
  | awk -F'[=,>]' '/^##contig/{print $3"\t"$5}' > dm6.chrom.sizes

# 3. In(2L)t karyotype groups, normalized to VCF sample names
bcftools query -l "$VCF" | sort > vcf.samples
awk -F'\t' 'NR>1 && $3==0 {gsub(/_/,"-",$1); print $1}' In2Lt.tsv \
  | sort | comm -12 - vcf.samples > In2Lt_STD.txt
awk -F'\t' 'NR>1 && $3==2 {gsub(/_/,"-",$1); print $1}' In2Lt.tsv \
  | sort | comm -12 - vcf.samples > In2Lt_INV.txt

# 4. windowed Fst -> bigWig
vcftools --gzvcf "$VCF" \
  --weir-fst-pop In2Lt_INV.txt --weir-fst-pop In2Lt_STD.txt \
  --fst-window-size 10000 --fst-window-step 10000 --out fst_In2Lt
awk 'NR>1 && $5!="-nan" {v=($5<0?0:$5); print $1"\t"($2-1)"\t"$3"\t"v}' \
  fst_In2Lt.windowed.weir.fst | sort -k1,1 -k2,2n > fst_In2Lt.bedgraph
bedGraphToBigWig fst_In2Lt.bedgraph dm6.chrom.sizes fst_In2Lt.bw

# 5. windowed pi -> bigWig
vcftools --gzvcf "$VCF" --window-pi 10000 --out pi_all
awk 'NR>1 && $5!="nan" {print $1"\t"($2-1)"\t"$3"\t"$5}' \
  pi_all.windowed.pi | sort -k1,1 -k2,2n > pi_all.bedgraph
bedGraphToBigWig pi_all.bedgraph dm6.chrom.sizes pi_all.bw

echo "done: fst_In2Lt.bw pi_all.bw"
```

Host `fst_In2Lt.bw` and `pi_all.bw` somewhere JBrowse can reach (any static web
server, or
[open them as local track files](/docs/user_guides/basic_usage#opening-tracks)
in JBrowse Desktop).

## Loading in JBrowse

You need a dm6 assembly loaded, ideally with a FlyBase or RefSeq gene track so
gene-name search works — see
[configuring assemblies](/docs/config_guides/assemblies) and
[gene tracks](/docs/user_guides/gene_track). A single bigWig loads as an
ordinary [quantitative track](/docs/user_guides/quantitative_track):

```json
{
  "type": "QuantitativeTrack",
  "trackId": "fst_in2lt",
  "name": "Fst (In(2L)t vs standard, 10kb windows)",
  "assemblyNames": ["dm6"],
  "adapter": {
    "type": "BigWigAdapter",
    "uri": "https://jbrowse.org/demos/popgen/fst_In2Lt.bw"
  }
}
```

To read the Fst and diversity scans together, put one `BigWigAdapter` per scan
into a single **multi-wiggle** track so the rows stack in alignment (see the
[multi-quantitative track guide](/docs/config_guides/multiquantitative_track)):

```json
{
  "type": "MultiQuantitativeTrack",
  "trackId": "popgen_scans",
  "name": "Population-genomic scans",
  "assemblyNames": ["dm6"],
  "adapter": {
    "type": "MultiWiggleAdapter",
    "subadapters": [
      {
        "type": "BigWigAdapter",
        "source": "Fst In(2L)t vs standard",
        "uri": "https://jbrowse.org/demos/popgen/fst_In2Lt.bw"
      },
      {
        "type": "BigWigAdapter",
        "source": "π (whole panel)",
        "uri": "https://jbrowse.org/demos/popgen/pi_all.bw"
      }
    ]
  }
}
```

## Reading the signals

Navigate to chromosome arm **`2L`**. The `In(2L)t` Fst row rises across the
whole inverted region — roughly `2L:2,200,000–13,200,000` — and peaks near the
breakpoints: the inversion suppresses recombination between arrangements, so
inverted and standard lines diverge across the entire span rather than at a
single locus. This is the recombination-suppression footprint of a segregating
inversion, the fly analog of any large balanced polymorphism.

<!-- FIGURE PENDING: multi-wiggle over 2L — Fst (In(2L)t vs standard) elevated
     plateau across ~2.2–13.2 Mb with breakpoint peaks, π rows below, FlyBase
     gene track. Needs the bigWigs hosted in a dm6 demo config + screenshot spec. -->

Then search **`Cyp6g1`** (on `2R`) and inspect its window in the π row: the
insecticide-resistance haplotype rose to high frequency in this derived
population, locally depressing diversity. Other well-documented resistance and
selection loci make good places to look next, each read the same way — signal
against gene:

| Gene / locus  | Arm | Signal                                                             |
| ------------- | --- | ------------------------------------------------------------------ |
| `Cyp6g1`      | 2R  | DDT / neonicotinoid resistance; recent worldwide sweep             |
| `Ace`         | 3R  | Organophosphate resistance (acetylcholinesterase target-site)      |
| `CHKov1`      | 3R  | Organophosphate / viral resistance; sweep from a transposon insert |
| `In(3R)Payne` | 3R  | Cosmopolitan inversion under clinal / latitudinal selection        |

`In(3R)Payne` is typed in the same DGRPool table set — repeat the grouping step
with its phenotype to scan `3R` the same way.

## Interpreting the combination

| Fst  | Within-group π         | Reading                                          |
| ---- | ---------------------- | ------------------------------------------------ |
| High | Low in one group       | Selective sweep / local adaptation in that group |
| High | High in both, high dxy | Long-standing divergence (e.g. an inversion)     |
| Low  | High                   | Shared variation / gene flow                     |

## Unbiased π and dxy with pixy {#unbiased-pi-and-dxy-with-pixy}

The vcftools `--window-pi` scan above is fine for relative comparisons, but
variant-only VCFs and missing data bias absolute π and dxy estimates.
[pixy](https://pixy.readthedocs.io/)
([Korunes & Samuk 2021](https://doi.org/10.1111/1755-0998.13326)) computes π,
dxy, and Fst together without that bias — at the cost of needing an **allSites
VCF** that includes invariant sites (the DGRP2 SNPs-only file above does not
have these; you would call your own allSites VCF with `bcftools mpileup` or
GATK):

```bash
pixy --stats pi fst dxy \
  --vcf allsites.vcf.gz \
  --populations popfile.txt \
  --window_size 10000 \
  --output_prefix scan
# -> scan_pi.txt, scan_dxy.txt, scan_fst.txt
```

The window columns are `chromosome, window_pos_1, window_pos_2`; the value is
`avg_pi` (π file, column 5), `avg_dxy` (dxy file, column 6), or `avg_wc_fst`
(Fst file, column 6). Convert each to its own bigWig with the same
awk-to-`bedGraphToBigWig` pattern used above and load them as more multi-wiggle
rows.

## Notes

- **Window size** trades resolution for smoothness — 5–10 kb windows resolve
  single-gene signals in the compact _Drosophila_ genome; larger windows suit
  broad, genome-wide overviews.
- **Negative Fst** estimates are an expected artifact of the Weir & Cockerham
  estimator at low-differentiation sites; flooring at 0 for display (as above)
  is conventional.
- **Heterozygous karyotypes** were dropped from both groups above; contrasting
  homozygous arrangements gives the cleanest inversion signal.
- **Haplotype-based selection statistics** (iHS, XP-EHH, e.g. from
  [selscan](https://github.com/szpiech/selscan)) capture sweeps that Fst misses
  and, being per-site or per-window scores, load as bigWig quantitative tracks
  the same way.

## See also

- [Quantitative track](/docs/user_guides/quantitative_track) — loading and
  displaying a single bigWig signal
- [Multi-quantitative track](/docs/user_guides/multiquantitative_track) —
  stacking the Fst and π scans as one track
- [GWAS / Manhattan track](/docs/user_guides/gwas_track) — the same
  genome-wide-statistic-as-track pattern for association scans
- [Introgression tracts](/docs/tutorials/introgression) — another population-
  genomic analysis (archaic ancestry segments) in the genome browser
- [Configuring assemblies](/docs/config_guides/assemblies) — loading a non-human
  reference such as dm6

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

Weir, B. S., & Cockerham, C. C. (1984).
[Estimating F-statistics for the analysis of population structure](https://doi.org/10.2307/2408641).
_Evolution_, _38_(6), 1358–1370.
