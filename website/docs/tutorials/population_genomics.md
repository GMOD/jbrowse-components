---
title: Population genomics
description:
  Windowed Fst, nucleotide diversity, and Tajima's D scans plus a genotype
  matrix, LD heatmap, and a between-population sweep from real Drosophila data —
  a fully reproducible pipeline
guide_category: Tutorials
tutorial_category: Population genomics
---

Population-genetic scans — **Fst** (differentiation between groups),
**nucleotide diversity (π)** within a group, and **dxy** (divergence between
groups) — are per-window statistics along the genome, the same form as a wiggle
track. Once you compute them from a multi-sample VCF you can load them into
JBrowse and read the peaks and troughs against genes.

No single statistic is decisive, and the mindset this tutorial builds is to read
them **together**. Fst asks how different two groups are; π asks how much
variation a group carries; Tajima's D asks what shape its allele frequencies
take. A real event — a selective sweep, an inversion, gene flow — leaves a
_coordinated_ signature across all of them, and it is where the signals line up
that tells the processes apart. A low-diversity window on its own could be a
sweep or just low recombination, but a diversity valley that also sits under an
Fst peak and a negative Tajima's D is a sweep. That is why the figures below
stack the statistics on a shared genomic axis: the interpretation lives in the
overlap.

Working in a notebook? The
[Jupyter selection-scan example](/docs/jbrowse_jupyter) runs this same
compute-then-view loop in Python — a windowed Fst scan loaded straight from a
DataFrame — and opens in Colab with one click.

JBrowse does no population-genetic inference itself. It draws the windowed
statistic your tool produced. This tutorial is a reproducible pipeline: every
command below runs against publicly hosted _Drosophila melanogaster_ data on the
dm6 assembly and produces bigWig tracks you can load. It reproduces two signals
from the [Drosophila Genetic Reference Panel](http://dgrp2.gnets.ncsu.edu/)
(DGRP), a panel of 205 inbred lines from a single Raleigh, North Carolina
population ([Mackay et al. 2012](https://doi.org/10.1038/nature10811)):

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

The pipeline uses these standard command-line tools:

- [vcftools](https://vcftools.github.io/) — windowed Fst, π, and Tajima's D from
  a VCF
- [bcftools](https://samtools.github.io/bcftools/) — reading the VCF header and
  sample list
- [`bedGraphToBigWig`](https://hgdownload.soe.ucsc.edu/admin/exe/) — UCSC
  utility that packs a bedGraph into an indexed bigWig
- [PLINK](https://www.cog-genomics.org/plink/) — pairwise LD (`--r2`) for the
  linkage-disequilibrium section

All are on [bioconda](https://bioconda.github.io/):
`conda install -c bioconda vcftools bcftools ucsc-bedgraphtobigwig plink`.

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
**guaranteed** to match — the usual cause of an empty track is a name mismatch:

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
calibrated. They are still directly comparable **across windows of the same
VCF**. For calibrated absolute π and dxy you need an allSites VCF below.

## Tajima's D → bigWig

π measures how much diversity a window holds; **Tajima's D**
([Tajima 1989](https://doi.org/10.1093/genetics/123.3.585)) measures the _shape_
of that diversity — whether the allele-frequency spectrum is skewed toward rare
or common variants relative to the neutral expectation. A hard selective sweep
leaves a characteristic signature: as a favored haplotype fixes it strips out
diversity (low π), then new mutations accumulate on that swept background as an
excess of **rare** alleles, driving Tajima's D **negative**. Seeing π and
Tajima's D drop in the same window is what separates a sweep from a region that
is simply low-diversity for other reasons.

`vcftools` computes it in fixed windows straight from the VCF — no group split
needed, it is a whole-panel statistic:

```bash
vcftools --gzvcf "$VCF" --TajimaD 2000 --out tajd_all
# -> tajd_all.Tajima.D   CHROM  BIN_START  N_SNPS  TajimaD
```

Convert to bigWig. Take `TajimaD` (column 4), skip `nan` windows, and keep
negative values (unlike Fst, Tajima's D is meaningfully signed — the negative
excursions are the signal):

```bash
awk 'NR>1 && $4!="nan" && $4!="-nan" {print $1"\t"$2"\t"($2+2000)"\t"$4}' \
  tajd_all.Tajima.D \
  | sort -k1,1 -k2,2n > tajd_all.bedgraph
bedGraphToBigWig tajd_all.bedgraph dm6.chrom.sizes tajd_all.bw
```

`vcftools --TajimaD` reports `BIN_START` 0-based, so it maps directly to the
0-based half-open bedGraph coordinate — no `-1` shift, unlike the 1-based
`--window-pi` output above.

## Full pipeline

The complete pipeline as one script — save as `popgen.sh` and run it in an empty
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
  --fst-window-size 2000 --fst-window-step 2000 --out fst_In2Lt
awk 'NR>1 && $5!="-nan" {v=($5<0?0:$5); print $1"\t"($2-1)"\t"$3"\t"v}' \
  fst_In2Lt.windowed.weir.fst | sort -k1,1 -k2,2n > fst_In2Lt.bedgraph
bedGraphToBigWig fst_In2Lt.bedgraph dm6.chrom.sizes fst_In2Lt.bw

# 5. windowed pi -> bigWig (whole panel + each In(2L)t arrangement)
vcftools --gzvcf "$VCF" --window-pi 2000 --out pi_all
vcftools --gzvcf "$VCF" --keep In2Lt_INV.txt --window-pi 2000 --out pi_INV
vcftools --gzvcf "$VCF" --keep In2Lt_STD.txt --window-pi 2000 --out pi_STD
for g in all INV STD; do
  awk 'NR>1 && $5!="nan" {print $1"\t"($2-1)"\t"$3"\t"$5}' \
    pi_$g.windowed.pi | sort -k1,1 -k2,2n > pi_$g.bedgraph
  bedGraphToBigWig pi_$g.bedgraph dm6.chrom.sizes pi_$g.bw
done

# 6. windowed Tajima's D -> bigWig (whole panel)
vcftools --gzvcf "$VCF" --TajimaD 2000 --out tajd_all
awk 'NR>1 && $4!="nan" && $4!="-nan" {print $1"\t"$2"\t"($2+2000)"\t"$4}' \
  tajd_all.Tajima.D | sort -k1,1 -k2,2n > tajd_all.bedgraph
bedGraphToBigWig tajd_all.bedgraph dm6.chrom.sizes tajd_all.bw

echo "done: fst_In2Lt.bw pi_all.bw pi_INV.bw pi_STD.bw tajd_all.bw"
```

Host the `.bw` files somewhere JBrowse can reach (any static web server, or
[open them as local track files](/docs/user_guides/basic_usage#opening-tracks)
in JBrowse Desktop).

## Loading in JBrowse

You need a dm6 assembly loaded, ideally with a FlyBase or RefSeq gene track so
gene-name search works — see
[configuring assemblies](/docs/config_guides/assemblies) and
[gene tracks](/docs/user_guides/gene_track). Each scan loads as an ordinary
[quantitative track](/docs/user_guides/quantitative_track), which auto-scales to
its own data:

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

## Reading the signals

Zoom out to the **whole genome** (all six arms). The `In(2L)t` Fst track rises
into a tall block of differentiation across the entire left arm of chromosome 2
— roughly `2L:2,200,000–13,200,000`, the inverted region — while every other arm
sits at low background Fst. Seeing all the arms at once is what makes the signal
read as genuinely elevated rather than a baseline with nothing to compare it to.
(The inversion suppresses recombination between arrangements across this span.)

<Figure src="/img/popgen/fst_in2lt_2L.png" caption="Genome-wide view of all six dm6 arms, each track auto-scaled to its own data. Top: the In(2L)t inversion extent. Middle: Fst between In(2L)t-inverted and standard-arrangement lines — a tall elevated block across the whole left arm of chromosome 2 (the inverted region, ~2.2–13.2 Mb) that stands out against low background Fst on every other arm. Bottom: whole-panel nucleotide diversity (π), near-uniform across arms — the expected contrast to the localized Fst spike. Output from this tutorial's pipeline, hosted at jbrowse.org/demos/popgen."/>

Then use the search box to jump to **`Cyp6g1`** (on `2R`) and add the **Tajima's
D** track from the pipeline alongside π. Both statistics dip together in the
same window. π collapses to under a tenth of the arm-wide average — but where π
only tells you diversity is low, Tajima's D tells you _why_: at Cyp6g1 it falls
sharply negative while sitting near zero genome-wide, the excess of rare alleles
accumulating on the swept background. Two statistics dropping in the same window
is the diagnostic hard-sweep signature, not the ambiguity of either alone.

<Figure src="/img/popgen/tajimad_cyp6g1.png" caption="Tajima's D (top) and π (middle) across a 1 Mb window of 2R over Cyp6g1 (highlighted band), with the RefSeq gene track below. Both statistics dip together at the locus: Tajima's D falls to about -2 against a genome-wide-neutral baseline near zero, and π collapses to under a tenth of the arm-wide background in the same window. The joint dip — a diversity valley skewed toward rare alleles — is the classic footprint of the hard sweep at this insecticide-resistance gene."/>

Other resistance and selection loci can be examined the same way, reading the
signal against the gene:

| Gene / locus  | Arm | Signal                                                        |
| ------------- | --- | ------------------------------------------------------------- |
| `Cyp6g1`      | 2R  | DDT / neonicotinoid resistance, recent worldwide sweep        |
| `Ace`         | 3R  | Organophosphate resistance (acetylcholinesterase target-site) |
| `CHKov1`      | 3R  | Organophosphate / viral resistance, from a transposon insert  |
| `In(3R)Payne` | 3R  | Cosmopolitan inversion under clinal / latitudinal selection   |

`In(3R)Payne` is typed in the same DGRPool table set — repeat the grouping step
with its phenotype to scan `3R` the same way.

## Interpreting the combination

| Fst  | Within-group π         | Reading                                          |
| ---- | ---------------------- | ------------------------------------------------ |
| High | Low in one group       | Selective sweep / local adaptation in that group |
| High | High in both, high dxy | Long-standing divergence (e.g. an inversion)     |
| Low  | High                   | Shared variation / gene flow                     |

## Between populations: the Cyp6g1 sweep {#between-populations}

The In(2L)t scan above contrasts two _arrangements_ within one panel. Reading
the same statistics across two _populations_ picks out the top row of the table
directly. [DEST](https://dest.bio) publishes Pool-Seq allele frequencies for _D.
melanogaster_ populations worldwide on dm6, spanning the ancestral African range
and the derived cosmopolitan range where the Cyp6g1 resistance allele swept.

Grouping the sub-Saharan African samples against the North American samples and
scanning the Cyp6g1 region produces that first-row pattern in a single figure:
Fst peaks at the gene, and diversity collapses in the cosmopolitan population
while the African population holds at background.

<Figure src="/img/popgen/combined_cyp6g1_dest.png" caption="Fst between African and cosmopolitan populations (top) and each population's nucleotide diversity (middle) across a 500 kb window of 2R over Cyp6g1 (highlighted band), with the RefSeq gene track below. Fst rises to its regional maximum (~0.37) at the gene, and in the same window cosmopolitan diversity (red) collapses while African diversity (blue) stays at background. A differentiation peak sitting on a population-specific diversity valley is the signature of local adaptation — the resistance allele swept in the cosmopolitan range but not in Africa. Allele frequencies from DEST; windowed statistics from this section's pipeline, hosted at jbrowse.org/demos/popgen."/>

DEST reports a per-pool alternate-allele frequency (`FREQ`) rather than
individual genotypes, so the scan works from frequencies directly: tabix the
region, average `FREQ` within each population group, then take windowed
[Hudson](https://doi.org/10.1093/genetics/132.2.583) Fst and per-group expected
heterozygosity (a diversity proxy that pooled data supports).

```bash
DEST=https://berglandlab.pods.uvarc.io/vcf/dest.all.PoolSNP.001.50.24Aug2024.ann.vcf.gz
tabix -h "$DEST" 2R:11700000-12700000 | bgzip > dest_cyp.vcf.gz   # ~44k SNPs
```

The `FORMAT` is `GT:RD:AD:DP:FREQ`; `FREQ` is the pool's alternate-allele
frequency and `DP` its depth. Average `FREQ` within each group, then write
windowed statistics as bedGraphs:

```python
import gzip, collections
AFR = {'ET','ZA','ZW','ZM','UG','RW','NG','KE','GN','GA'}   # sub-Saharan
grp = lambda s: 'AFR' if s.split('_')[0] in AFR else ('US' if s.startswith('US_') else None)
WIN = 10000
lines = (l for l in gzip.open('dest_cyp.vcf.gz','rt'))
samples = next(l for l in lines if l.startswith('#CHROM')).split('\t')[9:]
groups = [grp(s.strip()) for s in samples]
fnum = collections.defaultdict(float); fden = collections.defaultdict(float)
het = collections.defaultdict(lambda: [0.,0.,0])
for line in lines:
    f = line.split('\t'); pos = int(f[1]); fmt = f[8].split(':')
    fi, di = fmt.index('FREQ'), fmt.index('DP')
    af, us = [], []
    for g, cell in zip(groups, f[9:]):
        p = cell.split(':')
        if g and p[di].isdigit() and int(p[di]) >= 10:   # require depth >= 10
            (af if g == 'AFR' else us).append(float(p[fi]))
    if len(af) >= 5 and len(us) >= 5:                    # both groups covered
        p1, p2 = sum(af)/len(af), sum(us)/len(us); w = pos//WIN*WIN
        fnum[w] += (p1-p2)**2; fden[w] += p1*(1-p2) + p2*(1-p1)   # Hudson Fst
        h = het[w]; h[0] += 2*p1*(1-p1); h[1] += 2*p2*(1-p2); h[2] += 1
for name, val in [('fst', lambda w: fnum[w]/fden[w]),
                  ('div_african', lambda w: het[w][0]/het[w][2]),
                  ('div_cosmopolitan', lambda w: het[w][1]/het[w][2])]:
    with open(f'{name}.bg','w') as o:
        for w in sorted(w for w in het if het[w][2] >= 20):      # SNP-dense windows
            o.write(f'2R\t{w}\t{w+WIN}\t{val(w):.5f}\n')
```

```bash
for f in fst div_african div_cosmopolitan; do
  bedGraphToBigWig "$f.bg" chrom.sizes "dest_cyp6g1_$f.bw"
done
```

Load the Fst bigWig as a `QuantitativeTrack` and the two diversity bigWigs as
one `MultiWiggleAdapter` track (shared scale — same statistic on both rows) to
reproduce the figure.

## Per-sample view: the inversion genotyped across the panel

The windowed Fst scan _summarizes_ the inversion into one number per window. To
see which lines actually carry it, represent the whole arrangement as a single
structural-variant call — one `<INV>` record spanning the In(2L)t breakpoints
(`2L:2,225,744–13,154,180`) — genotyped across every karyotyped line, and load
it as a [multi-sample variant matrix](/docs/user_guides/multivariant_track). A
per-SNP matrix can't hold a ~13 Mb inversion on screen: zoom out far enough to
see both breakpoints and the individual marker columns collapse to nothing. One
SV call sidesteps that — the inversion is a single feature no matter how wide it
is.

First subset the panel to the karyotyped lines over `2L` (this biallelic-SNP
subset also feeds the LD step below) and write a `samples.tsv` so the matrix can
color rows by arrangement:

```bash
# subset to the 180 karyotyped lines, 2L, biallelic SNPs
vcftools --gzvcf "$VCF" --chr 2L --keep In2Lt_STD.txt --keep In2Lt_INV.txt \
  --min-alleles 2 --max-alleles 2 --remove-indels --mac 10 \
  --recode --stdout | bgzip > dgrp_In2Lt_2L.vcf.gz
tabix -p vcf dgrp_In2Lt_2L.vcf.gz

# samples.tsv (name<TAB>karyotype) so the matrix can group/color by arrangement
{ echo -e "name\tkaryotype";
  awk '{print $1"\tIn(2L)t"}' In2Lt_INV.txt;
  awk '{print $1"\tStandard"}' In2Lt_STD.txt; } > dgrp_In2Lt_samples.tsv
```

Then build a one-record SV VCF straight from those karyotype calls — `1/1` for
the In(2L)t lines, `0/0` for the standard lines:

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
`LinearMultiSampleVariantMatrixDisplay` colored by the `karyotype` column:

```json
{
  "type": "VariantTrack",
  "trackId": "dgrp_In2Lt_matrix",
  "name": "In(2L)t inversion genotyped across DGRP lines",
  "assemblyNames": ["dm6"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "vcfGzLocation": {
      "uri": "https://jbrowse.org/demos/popgen/dgrp_In2Lt_sv.vcf.gz"
    },
    "index": {
      "location": {
        "uri": "https://jbrowse.org/demos/popgen/dgrp_In2Lt_sv.vcf.gz.tbi"
      }
    },
    "samplesTsvLocation": {
      "uri": "https://jbrowse.org/demos/popgen/dgrp_In2Lt_samples.tsv"
    }
  },
  "displays": [
    {
      "type": "LinearMultiSampleVariantMatrixDisplay",
      "colorBy": "karyotype"
    }
  ]
}
```

Viewed across the inversion, the single call resolves the whole ~11 Mb
arrangement at once: each row is a line, colored by its genotype at the
inversion, so the 19 In(2L)t carriers (~10% of the panel) form the
homozygous-alt block at top and the 161 standard lines the homozygous-reference
block below, with the karyotype strip down the sidebar.

The genotypes here are the arrangement karyotypes themselves, so this is the
cleanest per-line view of _who_ carries the inversion. The independent evidence
that ordinary SNPs across the region co-segregate with it — the reason the
arrangement behaves as one recombination-suppressed block — is exactly what the
Fst scan above quantifies.

## Linkage disequilibrium

That suppression is itself measurable, as **linkage disequilibrium** (LD) — the
non-random association of alleles at different sites. Where recombination is
free, LD between two SNPs decays as they get farther apart; where recombination
is suppressed (or a sweep is recent), it persists. JBrowse draws pairwise LD as
a triangular heatmap. Pre-compute it with PLINK's `--r2` and load it through the
`PlinkLDTabixAdapter`:

```bash
# pairwise r2 among common SNPs in a window (PLINK reads the VCF directly)
plink --vcf dgrp_In2Lt_2L.vcf.gz --double-id --allow-extra-chr \
  --set-missing-var-ids '@:#' --maf 0.1 \
  --r2 --ld-window-kb 400 --ld-window 999999 --ld-window-r2 0 \
  --out ld
# tab-delimit, sort by BP_A, bgzip and tabix (columns: CHR_A BP_A SNP_A CHR_B BP_B SNP_B R2)
tail -n +2 ld.ld | awk 'BEGIN{OFS="\t"}{print $1,$2,$3,$4,$5,$6,$7}' \
  | sort -k1,1 -k2,2n | bgzip > ld.ld.gz
tabix -s1 -b2 -e2 ld.ld.gz
```

Unlike the bigWig and VCF tracks above, the LD-heatmap track does **not** apply
[refname aliasing](/docs/developer_guides/refname_aliasing) — it matches
chromosome names literally — so name the `CHR_A`/`CHR_B` columns to match your
loaded assembly. The demo dm6 hub uses UCSC-style `chr2R`, so prefix the FlyBase
`2R` names from the VCF:

```bash
tail -n +2 ld.ld \
  | awk 'BEGIN{OFS="\t"}{print "chr"$1,$2,$3,"chr"$4,$5,$6,$7}' \
  | sort -k1,1 -k2,2n | bgzip > ld_chr.ld.gz
tabix -s1 -b2 -e2 ld_chr.ld.gz
```

```json
{
  "type": "LDTrack",
  "trackId": "dgrp_ld",
  "name": "LD (r²)",
  "assemblyNames": ["dm6"],
  "adapter": {
    "type": "PlinkLDTabixAdapter",
    "uri": "https://jbrowse.org/demos/popgen/ld_2R_decay_chr.ld.gz"
  }
}
```

In a freely recombining region the triangle is bright along its top edge (nearby
SNP pairs are correlated) and fades into the body as pairs get farther apart —
the LD **decay** that sets how far a single tag SNP's signal reaches, and hence
the resolution of association mapping.

Inside the `In(2L)t` inversion the picture is different: because recombination
between arrangements is suppressed, LD does **not** decay the same way — pairs
megabases apart stay associated, the flip side of the single co-inherited block
the genotype matrix above shows. Note that with the inversion at only ~10%
frequency in this panel, that persistence is clearest among the
arrangement-informative markers (and in `D'`) rather than as a bright
genome-wide r² block.

## Unbiased π and dxy with pixy {#unbiased-pi-and-dxy-with-pixy}

The vcftools `--window-pi` scan above is fine for relative comparisons, but
variant-only VCFs and missing data bias absolute π and dxy estimates.
[pixy](https://pixy.readthedocs.io/)
([Korunes & Samuk 2021](https://doi.org/10.1111/1755-0998.13326)) computes π,
dxy, and Fst together without that bias — at the cost of needing an **allSites
VCF** that includes invariant sites (the DGRP2 SNPs-only file above does not
have these, so you would call your own allSites VCF with `bcftools mpileup` or
GATK):

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
rows.

## Notes

- **Window size** trades resolution for smoothness. The scans above use 2 kb
  windows — with the DGRP panel's dense SNPs (~1 site per 70 bp) each window
  still holds tens of segregating sites, so a single-gene sweep like Cyp6g1
  resolves sharply. Widen toward 5–10 kb for smoother, broad genome-wide
  overviews, or narrow further only where SNP density stays high.
- **Negative Fst** estimates are an expected artifact of the Weir & Cockerham
  estimator at low-differentiation sites. Flooring at 0 for display (as above)
  is conventional.
- **Heterozygous karyotypes** were dropped from both groups above. Contrasting
  homozygous arrangements gives the clearest inversion signal.
- **Haplotype-based selection statistics** (iHS, XP-EHH, e.g. from
  [selscan](https://github.com/szpiech/selscan)) capture sweeps that Fst misses
  and, being per-site or per-window scores, load as bigWig quantitative tracks
  the same way.

## See also

- [Quantitative track](/docs/user_guides/quantitative_track) — loading and
  displaying a single bigWig signal
- [Multi-quantitative track](/docs/user_guides/multiquantitative_track) —
  stacking the Fst and π scans as one track
- [Multi-sample variant track](/docs/user_guides/multivariant_track) — the
  genotype-matrix display, grouping and coloring samples by metadata
- [GWAS / Manhattan track](/docs/user_guides/gwas_track) — the same
  genome-wide-statistic-as-track pattern for association scans
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

Tajima, F. (1989).
[Statistical method for testing the neutral mutation hypothesis by DNA polymorphism](https://doi.org/10.1093/genetics/123.3.585).
_Genetics_, _123_(3), 585–595.

Weir, B. S., & Cockerham, C. C. (1984).
[Estimating F-statistics for the analysis of population structure](https://doi.org/10.2307/2408641).
_Evolution_, _38_(6), 1358–1370.
