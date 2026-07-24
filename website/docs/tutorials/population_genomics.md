---
title: Selection scans (Fst, π, Tajima's D)
sidebar_label: Selection scans
description:
  Fst, diversity, and Tajima's D scans plus per-sample inversion genotypes from
  one VCF
guide_category: Tutorials
tutorial_category: Population genomics
---

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
[Drosophila Genetic Reference Panel](http://dgrp2.gnets.ncsu.edu/) (DGRP), a
panel of 205 inbred lines from a single Raleigh, North Carolina population
([Mackay et al. 2012](https://doi.org/10.1038/nature10811)):

- Fst across the `In(2L)t` inversion: lines carrying the cosmopolitan `In(2L)t`
  inversion are strongly differentiated from standard-arrangement lines across
  the whole inverted region of chromosome arm `2L`, because the inversion
  suppresses recombination there
  ([Corbett-Detig & Hartl 2012](https://doi.org/10.1371/journal.pgen.1003056)).
  This megabase-scale signal is exactly what a windowed scan catches and a
  pairwise [LD triangle](/docs/tutorials/linkage_disequilibrium) misses. See
  that tutorial for why the two tools work at different scales.
- Genome-wide nucleotide diversity (π): the diversity landscape, dropping in
  low-recombination regions near the centromeres and at loci under selection
  such as `Cyp6g1`, an insecticide-resistance gene
  ([Daborn et al. 2002](https://doi.org/10.1126/science.1074170)).

The same workflow applies to any species and any grouping. Swap in your own
populations or your own VCF and the JBrowse side is identical.

## What you need

The pipeline uses these standard command-line tools, plus `curl` and `node` for
the [JBrowse CLI](/docs/cli):

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

## Get the data

Two downloads, both on stable HTTPS hosts. The genotypes are the DGRP freeze-2
calls lifted to dm6 ([aertslab](https://resources.aertslab.org/DGRP2/)). The
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
guaranteed to match (the usual cause of an empty track is a name mismatch):

```bash
bcftools view -h "$VCF" \
  | awk -F'[=,>]' '/^##contig/{print $3"\t"$5}' > dm6.chrom.sizes
```

This VCF names the chromosome arms `2L`, `2R`, `3L`, `3R`, `X`, `4` (FlyBase
style). UCSC dm6 prefixes them `chr2L`, etc. If your JBrowse dm6 assembly uses
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
  --fst-window-size 2000 --fst-window-step 2000 \
  --out fst_In2Lt
# -> fst_In2Lt.windowed.weir.fst
#    CHROM  BIN_START  BIN_END  N_VARIANTS  WEIGHTED_FST  MEAN_FST
```

Convert to bigWig. Take `WEIGHTED_FST` (column 5), skip the windows vcftools
could not estimate (it writes these as `nan` or `-nan`, either of which
`bedGraphToBigWig` rejects), floor slightly-negative estimates at 0, and shift
`BIN_START` from 1-based to the 0-based half-open coordinates bedGraph expects:

```bash
awk 'NR>1 && $5!="nan" && $5!="-nan" {v=($5<0?0:$5); print $1"\t"($2-1)"\t"$3"\t"v}' \
  fst_In2Lt.windowed.weir.fst \
  | sort -k1,1 -k2,2n > fst_In2Lt.bedgraph
bedGraphToBigWig fst_In2Lt.bedgraph dm6.chrom.sizes fst_In2Lt.bw
```

## Windowed diversity (π) → bigWig

The same tool computes per-window nucleotide diversity. Run it on the whole
panel, or restrict it with `--keep` to one group at a time so the two groups'
diversity can be compared on the same scale:

```bash
# whole panel
vcftools --gzvcf "$VCF" --window-pi 2000 --out pi_all
# -> pi_all.windowed.pi   CHROM  BIN_START  BIN_END  N_VARIANTS  PI

# per In(2L)t group (reuses the sample lists from above)
vcftools --gzvcf "$VCF" --keep In2Lt_INV.txt --window-pi 2000 --out pi_INV
vcftools --gzvcf "$VCF" --keep In2Lt_STD.txt --window-pi 2000 --out pi_STD

# same awk-to-bigWig conversion for each
for g in all INV STD; do
  awk 'NR>1 && $5!="nan" {print $1"\t"($2-1)"\t"$3"\t"$5}' pi_$g.windowed.pi \
    | sort -k1,1 -k2,2n > pi_$g.bedgraph
  bedGraphToBigWig pi_$g.bedgraph dm6.chrom.sizes pi_$g.bw
done
```

Because this VCF holds only variant sites, `--window-pi` sums diversity over the
genotyped SNPs and omits invariant positions, so the absolute values are not
calibrated. They are still directly comparable across windows of the same VCF.
For calibrated absolute π and dxy you need an allSites VCF below.

## Tajima's D → bigWig

Tajima's D ([Tajima 1989](https://doi.org/10.1093/genetics/123.3.585)) looks at
the _shape_ of a window's diversity rather than just the amount, so it catches
sweeps that π alone would miss. It's another per-window statistic, so it loads
as another bigWig track. Adding it next to π is useful: a window where both drop
points to a selective sweep, not just a region that happens to be low-diversity.

`vcftools` computes it in fixed windows straight from the VCF, with no group
split needed since it is a whole-panel statistic:

```bash
vcftools --gzvcf "$VCF" --TajimaD 2000 --out tajimad_all
# -> tajimad_all.Tajima.D   CHROM  BIN_START  N_SNPS  TajimaD
```

Convert to bigWig. Take `TajimaD` (column 4), skip `nan` windows, and keep
negative values (unlike Fst, Tajima's D is meaningfully signed, and the negative
excursions are the signal). This output reports only a window _start_, so unlike
the other two scans you have to construct the end yourself, clamping it to the
contig length so the final window of a chromosome cannot run off the end:

```bash
awk -F'\t' 'NR==FNR{len[$1]=$2; next}
     FNR>1 && $4!="nan" && $4!="-nan" {
       end=$2+2000; if (end>len[$1]) end=len[$1]
       if (end>$2) print $1"\t"$2"\t"end"\t"$4
     }' dm6.chrom.sizes tajimad_all.Tajima.D \
  | sort -k1,1 -k2,2n > tajimad_all.bedgraph
bedGraphToBigWig tajimad_all.bedgraph dm6.chrom.sizes tajimad_all.bw
```

Two coordinate details are worth keeping straight, because getting either wrong
produces a track that is silently shifted rather than an error:

- `vcftools --TajimaD` reports `BIN_START` 0-based, so it maps directly to the
  0-based half-open bedGraph coordinate with no `-1` shift, unlike the 1-based
  `--window-pi` and `--fst-window-size` output above.
- `--window-pi` and windowed Fst emit a `BIN_END` already clamped to the contig,
  so they need no clamp. `--TajimaD` does not, and `bedGraphToBigWig` fails hard
  on an interval that ends past its chromosome.

## Reproduce it end to end

Every step on this page (the downloads, the group split, all three scans, and
the per-sample inversion genotypes below) is wrapped in one script,
[`build_dgrp_popgen.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_dgrp_popgen.sh),
which also downloads JBrowse and writes a ready-to-serve config:

```bash
bash scripts/build_dgrp_popgen.sh          # builds ./dgrp_popgen_build/jbrowse2
npx --yes serve dgrp_popgen_build/jbrowse2 # then open the printed URL
```

It writes a `config.json` with the dm6 assembly (from UCSC) plus the Fst, π, and
Tajima's D scan tracks and the inversion genotypes, opening on the In(2L)t
inversion across arm 2L. It requires:

- `vcftools`
- `bcftools`
- htslib (`bgzip`, `tabix`)
- UCSC `bedGraphToBigWig`
- `curl`
- `node`

On Debian/Ubuntu, `apt install vcftools bcftools tabix curl` covers four of
these; `bedGraphToBigWig` is a
[UCSC binary download](https://hgdownload.soe.ucsc.edu/admin/exe/), and `node`
comes from [nodejs.org](https://nodejs.org/).

The `.bw` and `.vcf.gz` files are written next to the config, so you can host
them elsewhere or
[open them as local track files](/docs/user_guides/basic_usage#opening-tracks)
in JBrowse Desktop.

## Loading in JBrowse

You need a dm6 assembly loaded, ideally with a FlyBase or RefSeq gene track so
gene-name search works. See
[configuring assemblies](/docs/config_guides/assemblies) and
[gene tracks](/docs/user_guides/gene_track). Each scan loads as an ordinary
[quantitative track](/docs/user_guides/quantitative_track), which auto-scales to
its own data. Add each track object below to the `tracks` array of your
`config.json` (or paste it via the add-track JSON editor in the app):

```json
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
share a scale, so inverted and standard diversity can be compared
window-for-window on a shared axis:

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
        "source": "π inverted",
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

On the shared axis, inverted-arrangement π runs mildly below standard across the
inverted region on `2L`, and roughly equal to it outside. The contrast between
arrangements is stronger in the Fst scan than in within-group π.

Read that difference with the group sizes in mind: 19 inverted lines against 161
standard ones. π itself corrects for sample size, so the two rows are on a
comparable scale, but the 19-line row is much noisier window to window. Trust
the trend across the region, not any single window.

## Reading the signals

We zoom out to the whole genome (all six arms). The `In(2L)t` Fst track rises
into a tall block of differentiation across the entire left arm of chromosome 2
(roughly `2L:2,200,000–13,200,000`, the inverted region), while every other arm
sits at low background Fst. Seeing all the arms at once is what makes the signal
read as genuinely elevated, rather than a baseline with nothing to compare it
to.

<Figure src="/img/popgen/fst_in2lt_2L.png" caption="All six dm6 arms, each track auto-scaled. Top: the In(2L)t inversion extent. Middle: Fst between In(2L)t and standard-arrangement lines, a tall block across the whole left arm of chromosome 2 against low background on every other arm. Bottom: whole-panel nucleotide diversity (π)."/>

Then we use the search box to jump to `Cyp6g1` (on `2R`) and add the Tajima's D
track from the pipeline alongside π. Both statistics dip together in the same
window: π drops to under a tenth of the arm-wide average, and Tajima's D falls
sharply negative while sitting near zero genome-wide. Seeing both drop in the
same window is what marks a hard sweep, where either one alone would be
ambiguous.

<Figure src="/img/popgen/tajimad_cyp6g1.png" caption="Tajima's D (top) and π (middle) across ~400 kb of 2R around Cyp6g1 (highlighted; Cyp6g1 and Cyp6g2 labeled in the gene track). Both dip together over the swept window (Tajima's D to about -2, π to under a tenth of the flanking background): the joint trough is the hard-sweep signature."/>

Other resistance and selection loci can be examined the same way, reading the
signal against the gene:

| Gene / locus  | Arm | Signal                                                        |
| ------------- | --- | ------------------------------------------------------------- |
| `Cyp6g1`      | 2R  | DDT / neonicotinoid resistance, recent worldwide sweep        |
| `Ace`         | 3R  | Organophosphate resistance (acetylcholinesterase target-site) |
| `CHKov1`      | 3R  | Organophosphate / viral resistance, from a transposon insert  |
| `In(3R)Payne` | 3R  | Cosmopolitan inversion under clinal / latitudinal selection   |

`In(3R)Payne` is typed in the same DGRPool table set. Repeat the grouping step
with its phenotype to scan `3R` the same way.

## Interpreting the combination

| Fst  | Within-group π         | Reading                                          |
| ---- | ---------------------- | ------------------------------------------------ |
| High | Low in one group       | Selective sweep / local adaptation in that group |
| High | High in both, high dxy | Long-standing divergence (e.g. an inversion)     |
| Low  | High                   | Shared variation / gene flow                     |

## Per-sample view: the inversion genotyped across the panel

The windowed Fst scan _summarizes_ the inversion into one number per window. To
see which lines actually carry it, represent the whole arrangement as a single
structural-variant call, one `<INV>` record spanning the In(2L)t breakpoints
(`2L:2,225,744–13,154,180`), genotyped across every karyotyped line, and load it
in the [multi-sample variant display](/docs/user_guides/multivariant_track). A
per-SNP view can't hold a ~11 Mb inversion on screen: zoom out far enough to see
both breakpoints and the individual markers shrink to nothing. One SV call
sidesteps that, because the inversion is a single feature no matter how wide it
is.

Use the regular multi-sample display here, not its matrix mode. Matrix mode
spaces one evenly-sized column per variant, which is what you want for many
SNPs; for a single call it would throw away the one thing that matters here, the
call's genomic extent. The regular display draws each genotype at the call's
true span, so the carriers line up under the Fst plateau.

First write a `samples.tsv` mapping each line to its arrangement. This is the
per-sample metadata file the display reads: its first column is the sample name
and every other column is an attribute the display can order and color rows by.

```bash
# samples.tsv (name<TAB>karyotype) so the display can group/color by arrangement
{ printf 'name\tkaryotype\n'
  awk '{print $1"\tIn(2L)t"}' In2Lt_INV.txt
  awk '{print $1"\tStandard"}' In2Lt_STD.txt; } > dgrp_In2Lt_samples.tsv
```

Then build a one-record SV VCF straight from those karyotype calls, using `1/1`
for the In(2L)t lines and `0/0` for the standard lines:

```bash
samples=$(tail -n +2 dgrp_In2Lt_samples.tsv | cut -f1 | paste -sd'\t')
gts=$(tail -n +2 dgrp_In2Lt_samples.tsv \
  | awk -F'\t' '{print ($2=="In(2L)t") ? "1/1" : "0/0"}' | paste -sd'\t')
{
  printf '##fileformat=VCFv4.3\n##contig=<ID=2L,length=23513712>\n'
  printf '##ALT=<ID=INV,Description="Inversion">\n'
  printf '##INFO=<ID=SVTYPE,Number=1,Type=String,Description="SV type">\n'
  printf '##INFO=<ID=END,Number=1,Type=Integer,Description="End position">\n'
  printf '##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">\n'
  printf '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\t%s\n' "$samples"
  printf '2L\t2225744\tIn2Lt\tN\t<INV>\t.\tPASS\tSVTYPE=INV;END=13154180\tGT\t%s\n' "$gts"
} | bgzip > dgrp_In2Lt_sv.vcf.gz
tabix -p vcf dgrp_In2Lt_sv.vcf.gz
```

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

Viewed across the whole arm, the single call resolves the ~11 Mb arrangement at
once: each row is a line, colored by its genotype at the inversion, so the 161
standard lines form the pale homozygous-reference field and the 19 In(2L)t
carriers (~10% of the panel) the darker block beneath it, with the karyotype
strip down the sidebar. `groupBy` is what makes those two blocks contiguous.
Without it the rows keep the VCF's column order, and the split only reads as two
blocks by luck.

<Figure src="/img/popgen/in2lt_per_sample.png" caption="Whole chr2L. Top: the In(2L)t extent. Middle: Fst between arrangements. Bottom: one row per DGRP line, genotyped for the inversion as a single SV call and grouped by karyotype. The carrier block spans breakpoint to breakpoint, directly under the Fst plateau. Inversions draw as a tapered glyph, so each carrier row thins toward its left breakpoint."/>

The genotypes here are the arrangement karyotypes themselves, so this is the
cleanest per-line view of _who_ carries the inversion. The independent evidence
that ordinary SNPs across the region co-segregate with it (the reason the
arrangement behaves as one recombination-suppressed block) is exactly what the
Fst scan above quantifies.

## Unbiased π and dxy with pixy {#unbiased-pi-and-dxy-with-pixy}

The vcftools `--window-pi` scan above is fine for relative comparisons, but
variant-only VCFs and missing data bias absolute π and dxy estimates.
[pixy](https://pixy.readthedocs.io/)
([Korunes & Samuk 2021](https://doi.org/10.1111/1755-0998.13326)) computes π,
dxy, and Fst together without that bias, at the cost of needing an allSites VCF
that includes invariant sites (the DGRP2 SNPs-only file above does not have
these, so you would call your own allSites VCF with `bcftools mpileup` or GATK):

```bash
pixy --stats pi fst dxy \
  --vcf allsites.vcf.gz \
  --populations popfile.txt \
  --window_size 10000 \
  --output_prefix scan
# -> scan_pi.txt, scan_dxy.txt, scan_fst.txt
```

The window columns are `chromosome, window_pos_1, window_pos_2`. The value is
`avg_pi` (π file, column 5), `avg_dxy` (dxy file, column 6), or `avg_wc_fst`
(Fst file, column 6). Convert each to its own bigWig with the same
awk-to-`bedGraphToBigWig` pattern used above and load them as more multi-wiggle
rows. `window_pos_1` is 1-based and `window_pos_2` is clamped to the contig, so
these behave like the `--window-pi` output: subtract 1 from the start, and add
no clamp.

## Notes

- Window size trades resolution for smoothness. The scans above use 2 kb
  windows. With the DGRP panel's dense SNPs (~1 site per 70 bp) each window
  still holds tens of segregating sites, so a single-gene sweep like Cyp6g1
  resolves sharply. Widen toward 5–10 kb for smoother, broad genome-wide
  overviews, or narrow further only where SNP density stays high.
- Negative Fst estimates are an expected artifact of the Weir & Cockerham
  estimator at low-differentiation sites. Flooring at 0 for display (as above)
  is conventional.
- Heterozygous karyotypes were dropped from both groups above. Contrasting
  homozygous arrangements gives the clearest inversion signal.
- Haplotype-based selection statistics (iHS, XP-EHH, e.g. from
  [selscan](https://github.com/szpiech/selscan)) capture sweeps that Fst misses
  and, being per-site or per-window scores, load as bigWig quantitative tracks
  the same way.

## See also

- [Quantitative track](/docs/user_guides/quantitative_track)
- [Multi-quantitative track](/docs/user_guides/multiquantitative_track)
- [Multi-sample variant track](/docs/user_guides/multivariant_track)
- [GWAS / Manhattan track](/docs/user_guides/gwas_track)
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
