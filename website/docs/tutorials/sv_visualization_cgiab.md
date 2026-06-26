---
title: Cancer SVs (C-GIAB)
description:
  Load and inspect structural variants from real cancer sequencing data
guide_category: Tutorials
---

This tutorial walks through loading data from the
[Cancer Genome in a Bottle (C-GIAB)](https://www.nist.gov/programs-projects/cancer-genome-bottle)
project into JBrowse 2 and using several view types to inspect the supplied
benchmark structural variant (SV) and copy-number variant (CNV) calls. The
dataset is HG008, a pancreatic ductal adenocarcinoma (PDAC) cell line with
matched tumor and normal tissue, sequenced with PacBio HiFi long reads. The
project also publishes a phased de novo assembly of the tumor genome, which is
particularly well-suited to JBrowse 2's synteny and dotplot views.

C-GIAB ships several complementary assays beyond bulk sequencing — karyotyping,
directional genome hybridization (DGH), and other cytogenetic characterizations
— which together informed the high-quality benchmark call sets used here. This
tutorial does not load those auxiliary datasets, but the
[NIST C-GIAB page](https://www.nist.gov/programs-projects/cancer-genome-bottle)
is the place to find them, along with
[McDaniel et al. 2025](https://doi.org/10.1038/s41597-025-04944-7) for the
methods behind the dataset.

The general SV-visualization concepts used below are documented in the
[SV visualization guide](/docs/user_guides/sv_visualization) and the
[SV inspector guide](/docs/user_guides/sv_inspector_view). This tutorial focuses
on the data-loading workflow and a few worked examples.

## What you need

This tutorial assumes you are setting up a JBrowse 2 instance on an Apache 2
HTTP server on Ubuntu or Debian Linux, but the data-preparation steps work on
any platform.

You will need:

- A Linux machine with HTTP access (either a public URL or `http://localhost`)
- Approximately 1 TB of free disk space — the BAM/CRAM files are large
- At least 32 GB of RAM for the minimap2 alignment step (you can downsize the
  machine after data prep is done; a 2 GB instance is sufficient to host the
  finished site)
- The following command-line tools, with versions tested at the time of writing
  in parentheses:
  - [JBrowse CLI](/docs/cli) (`@jbrowse/cli` v3.6.5 or later)
  - [Node.js](https://nodejs.org/) (v24.1.0 or later)
  - [tabix](http://www.htslib.org/doc/tabix.html) (v1.21 or later)
  - [samtools](http://www.htslib.org/) (v1.21 or later)
  - [bcftools](http://www.htslib.org/) (v1.20 or later) — for the BAF track
  - [mosdepth](https://github.com/brentp/mosdepth) (v0.3 or later) — for the
    log2 ratio track
  - [minimap2](https://github.com/lh3/minimap2)
  - [megadepth](https://github.com/ChristopherWilks/megadepth) (v1.2.0 or later)
  - [bedGraphToBigWig](https://hgdownload.soe.ucsc.edu/admin/exe/) (UCSC tool) —
    for the log2 ratio and BAF tracks

A script with all of the data-preparation commands below is available as a
[gist](https://gist.github.com/cmdcolin/4f2ccf037b4c3315d6eb36b0a4ec123d).

## Install JBrowse 2 with Apache 2

Install system dependencies and the JBrowse CLI:

```bash
export OUT=/var/www/html/jbrowse2
sudo apt-get update
sudo apt-get install wget apache2 tabix samtools minimap2
sudo service apache2 start

# Debian/Ubuntu's "nodejs" package is often older than the v18 minimum, so
# install a current Node.js from NodeSource — see
# https://github.com/nodesource/distributions
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# confirm node.js >= v18 is installed
node --version
sudo npm install -g @jbrowse/cli

# confirm the jbrowse CLI is installed
jbrowse --version

# download and unzip the latest JBrowse 2, then move it into the web root
jbrowse create tmpdir
sudo mv tmpdir $OUT
```

`jbrowse create` downloads the latest `jbrowse-web.zip` from the
[GitHub releases page](https://github.com/GMOD/jbrowse-components/releases) and
unzips it. See the [web quickstart](/docs/quickstart_web) for more on basic
JBrowse 2 setup.

## Load the human reference

The C-GIAB project uses a specific build of GRCh38 with decoys and several
masked regions. The build is not critical to the visualization itself, but it is
important to use the same reference when converting the BAM files to CRAM in
later steps.

```bash
# download and prepare the GRCh38 build used by the C-GIAB project
curl https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/release/references/GRCh38/GRCh38_GIABv3_no_alt_analysis_set_maskedGRC_decoys_MAP2K3_KMT2C_KCNJ18.fasta.gz > GRCh38_GIABv3.fa.gz
gunzip GRCh38_GIABv3.fa.gz
samtools faidx GRCh38_GIABv3.fa
jbrowse add-assembly GRCh38_GIABv3.fa --out $OUT --load copy

# add NCBI RefSeq gene annotations
jbrowse add-track https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz \
  --indexFile https://jbrowse.org/ucsc/hg38/ncbiRefSeq.gff.gz.csi --out $OUT
```

## Load the C-GIAB benchmark SV and CNV calls

Load the V0.4 HG008-T draft benchmark SV calls (VCF) and CNV calls (BED). The
BED file ships without a header, so we prepend one to give each column a name:

```bash
# C-GIAB benchmark SVs (VCF)
jbrowse add-track https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/NIST_HG008-T_somatic-stvar-CNV_DraftBenchmark_V0.4-20250714/GRCh38_HG008-T-V0.4_somatic-stvar_PASS.draftbenchmark.vcf.gz \
  --out $OUT --category "Variant calls"

# C-GIAB benchmark CNVs (BED, with custom header prepended)
(echo "#chr"$'\t'"start"$'\t'"end"$'\t'"total_copy_number"$'\t'"hap1_copy_number"$'\t'"hap2_copy_number"$'\t'"name" \
  && curl https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/NIST_HG008-T_somatic-stvar-CNV_DraftBenchmark_V0.4-20250714/GRCh38_HG008-T-V0.4_somatic-CNV_PASS.draftbenchmark.calls.bed) \
  > GRCh38_HG008-T-V0.4_somatic-CNV_PASS.draftbenchmark.calls.bed
jbrowse add-track GRCh38_HG008-T-V0.4_somatic-CNV_PASS.draftbenchmark.calls.bed \
  --out $OUT --category "Variant calls" --load move
```

## Convert tumor and normal reads to CRAM, and compute coverage

The tumor and normal BAM files at the C-GIAB FTP are large and slow to access
remotely, and lack `MD` tags (which JBrowse uses to display SNP positions
without re-fetching the reference). We download them with `samtools view`, write
them out as CRAM, and compute whole-genome coverage with megadepth:

```bash
# convert remote BAM files to local CRAM files
# note: this downloads >200 GB of data
samtools view -@8 ftp://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/PacBio_Revio_20240125/HG008-N-P_PacBio-HiFi-Revio_20240125_35x_GRCh38-GIABv3.bam \
  --write-index -o HG008-N-P_PacBio-HiFi-Revio_20240125_35x_GRCh38-GIABv3.cram -T GRCh38_GIABv3.fa
samtools view -@8 ftp://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/PacBio_Revio_20240125/HG008-T_PacBio-HiFi-Revio_20240125_116x_GRCh38-GIABv3.bam \
  --write-index -o HG008-T_PacBio-HiFi-Revio_20240125_116x_GRCh38-GIABv3.cram -T GRCh38_GIABv3.fa

# fetch the megadepth executable
wget https://github.com/ChristopherWilks/megadepth/releases/download/1.2.0/megadepth
chmod +x megadepth

# compute coverage and add both the CRAM and bigWig to the JBrowse config
# note: this loop takes 10-15 minutes per CRAM
for i in *.cram; do
  ./megadepth $i --bigwig
  jbrowse add-track $i --out $OUT --category "Reads" --load move
  jbrowse add-track $i.all.bw --out $OUT --category "Coverage" --load move
done
```

## Build CNV tracks: a log2(tumor/normal) ratio and a BAF track

The coverage bigWigs above are each normalized to their own genome-wide median,
so tumor and normal don't share a baseline and copy-number changes have to be
eyeballed. Two derived tracks make somatic copy-number state readable directly:

- a **log2(tumor/normal) coverage ratio** — the standard somatic copy-number
  signal: 0 = copy-neutral relative to the genome median, positive = gain,
  negative = loss;
- a **B-allele frequency (BAF)** track — the tumor's alt-allele fraction at
  germline-heterozygous SNP sites: ~0.5 where both alleles are retained, pulled
  toward 0 or 1 under loss-of-heterozygosity (LOH) or allelic imbalance.

These steps are generic. Point the variables at your own matched tumor/normal
alignments and a germline small-variant VCF for the normal:

```bash
REF=GRCh38_GIABv3.fa
NORMAL=HG008-N-P_PacBio-HiFi-Revio_20240125_35x_GRCh38-GIABv3.cram
TUMOR=HG008-T_PacBio-HiFi-Revio_20240125_116x_GRCh38-GIABv3.cram
# a 2-column chrom.sizes for the UCSC bedGraphToBigWig tool
cut -f1,2 $REF.fai > GRCh38_GIABv3.chrom.sizes
```

### log2(tumor/normal) coverage ratio

Bin the genome, take mean depth per bin per sample with mosdepth,
median-normalize each sample to 1, then take log2 of the ratio:

```bash
# fixed 10kb windows, no per-base output (-n); -f gives the reference for CRAM
mosdepth -t8 -n -b 10000 -f $REF HG008-N $NORMAL
mosdepth -t8 -n -b 10000 -f $REF HG008-T $TUMOR
# -> HG008-{N,T}.regions.bed.gz : chrom  start  end  meandepth

python3 - <<'PY'
import gzip, math, statistics
def load(p):
    d = {}
    with gzip.open(p, 'rt') as fh:
        for line in fh:
            c, s, e, v = line.split()
            d[(c, int(s), int(e))] = float(v)
    return d
n = load('HG008-N.regions.bed.gz')
t = load('HG008-T.regions.bed.gz')
autosomes = {f'chr{i}' for i in range(1, 23)}
def median(d):
    return statistics.median(v for k, v in d.items() if k[0] in autosomes and v > 0)
mn, mt = median(n), median(t)   # per-sample autosomal median
with open('HG008_log2ratio.bedgraph', 'w') as out:
    for k in sorted(k for k in n if k in t):
        nv, tv = n[k] / mn, t[k] / mt
        if nv > 0 and tv > 0:
            out.write(f'{k[0]}\t{k[1]}\t{k[2]}\t{math.log2(tv / nv):.4f}\n')
PY

# bedGraph -> bigWig (LC_COLLATE=C so decoy/HLA contigs sort the way bigWig expects)
LC_COLLATE=C sort -k1,1 -k2,2n HG008_log2ratio.bedgraph > HG008_log2ratio.sorted.bedgraph
bedGraphToBigWig HG008_log2ratio.sorted.bedgraph GRCh38_GIABv3.chrom.sizes HG008_log2ratio.bw

jbrowse add-track HG008_log2ratio.bw --out $OUT --category "CNV" --load move
```

Plot the log2 ratio with a symmetric y-axis — set **min/max score** to about
`-2`/`2` from the track menu so gains and losses read symmetrically around 0,
and use the **scatter** rendering. We leave it a single overall color rather
than the wiggle's default positive/negative (bicolor) coloring — gains and
losses already read off their position above or below the 0 line, and keeping
this track one color frees red/blue to mean tumor vs normal on the coverage
track below. Note the 0 line is the sample's genome-wide median, **not**
absolute diploid: in a tumor where much of the genome is deleted, copy-neutral
regions sit above 0. The benchmark CNV BED track gives the absolute copy-number
reference alongside it.

<Figure caption="The log2(tumor/normal) coverage ratio across all chromosomes, drawn as a single-color scatter of the per-bin average and capped to a symmetric ±2 domain, above the benchmark somatic CNV calls. Gains (positive) and losses (negative) read off the 0 line by position. Unlike the two independently-normalized coverage tracks, this single track reads directly as relative copy number and lines up with the called intervals." src="/img/sv_cgiab/cnv_log2ratio_genome.png" />

> If you only want a quick approximation and don't want to download the full
> alignments, you can build the same track from
> [indexcov](https://github.com/brentp/goleft) bigWigs (computed in seconds from
> the BAM/CRAM indexes) instead of mosdepth — read each indexcov bigWig over the
> same bins and apply the identical normalization. On this dataset the two
> approaches agree closely (Pearson _r_ ≈ 0.99 across benchmark CNV regions).

### B-allele frequency (BAF)

At germline-heterozygous SNP sites, plot the tumor's fraction of reads
supporting the alt allele. Take the het sites from a germline small-variant VCF
for the **normal** sample (the C-GIAB PacBio germline workflow publishes one),
then read tumor allele depths with `bcftools mpileup`:

```bash
# germline small-variant calls for the normal sample
curl -O https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/PacBio_Revio_20240125/pacbio-wgs-wdl_germline_20240206/HG008-N-P.GRCh38.deepvariant.phased.vcf.gz
GERMLINE_VCF=HG008-N-P.GRCh38.deepvariant.phased.vcf.gz
bcftools index -t $GERMLINE_VCF

# heterozygous SNP sites (GT 0/1), PASS only
bcftools view -g het -v snps -f PASS $GERMLINE_VCF -Oz -o hets.vcf.gz
bcftools index -t hets.vcf.gz

# tumor alt-allele fraction at those sites (sites with depth >= 10)
# use -T (stream the BAM once) rather than -R (which does a per-site index seek
# over millions of sites and takes hours); restrict to the main chromosomes
CHROMS=$(printf 'chr%s,' {1..22})chrX,chrY
bcftools mpileup -f $REF -r $CHROMS -T hets.vcf.gz -a AD -q 1 -Q 0 $TUMOR \
  | bcftools query -f '%CHROM\t%POS\t[%AD]\n' \
  | awk -F'[\t,]' '{d=$3+$4; if(d>=10) printf "%s\t%d\t%d\t%.4f\n",$1,$2-1,$2,$4/d}' \
  > HG008-T_baf.bedgraph

LC_COLLATE=C sort -k1,1 -k2,2n HG008-T_baf.bedgraph > HG008-T_baf.sorted.bedgraph
bedGraphToBigWig HG008-T_baf.sorted.bedgraph GRCh38_GIABv3.chrom.sizes HG008-T_baf.bw

jbrowse add-track HG008-T_baf.bw --out $OUT --category "CNV" --load move
```

`bcftools mpileup` is single-threaded for the pileup itself (`--threads` only
parallelizes BGZF compression), and this step dominates the runtime on deep
long-read data. To speed it up, split by region and run one process per
chromosome, then concatenate — on a 24-core machine this took ~11 minutes versus
well over an hour for the single streaming pass:

```bash
mpileup_chrom() {
  bcftools mpileup -f $REF -r $1 -T hets.vcf.gz -a AD -q 1 -Q 0 $TUMOR \
    | bcftools query -f '%CHROM\t%POS\t[%AD]\n' \
    | awk -F'[\t,]' '{d=$3+$4; if(d>=10) printf "%s\t%d\t%d\t%.4f\n",$1,$2-1,$2,$4/d}' \
    > baf_part.$1.bedgraph
}
export -f mpileup_chrom; export REF TUMOR
printf 'chr%s\n' {1..22} chrX chrY | xargs -P$(nproc) -I{} bash -c 'mpileup_chrom "$@"' _ {}
cat $(printf 'baf_part.chr%s.bedgraph ' {1..22} chrX chrY) > HG008-T_baf.bedgraph
```

When merging per-region output, drop duplicate positions before
`bedGraphToBigWig` (multiallelic sites can emit a position twice, which it
rejects as overlapping):
`LC_COLLATE=C sort -k1,1 -k2,2n HG008-T_baf.bedgraph | awk '!seen[$1"\t"$2]++' > HG008-T_baf.sorted.bedgraph`.

Plot BAF with a fixed `0`..`1` domain and a **scatter** rendering. The wiggle's
default summary mode draws min/max **whiskers** per bin, which for
one-value-per-SNP data spans nearly 0–1 in every bin and fills the track to a
solid band — switch to scatter, which reads this data correctly. Because BAF is
one value per SNP rather than a continuous signal, scatter reads better than a
line: at whole-chromosome zoom, where each pixel bins many SNPs, scatter's
per-bin min/max points keep the 0/1 LOH split visible, whereas a line or density
averages it back to 0.5. Pairing the log2 ratio (copy number) with BAF (allelic
state) is the conventional two-panel somatic-CNV view: a deletion shows up as a
negative log2 ratio **and** a BAF split toward 0/1, while copy-neutral LOH shows
the BAF split with a flat log2 ratio.

This is an _informative-sites_ BAF: we plot only germline-**heterozygous** SNPs,
so it looks different from a SNP-array BAF. An array genotypes every probe and
shows three bands — homozygous-reference (0/0) near 0, het (0/1) near 0.5, and
homozygous-alt (1/1) near 1. Here, balanced regions show a single 0.5 band that
splits toward 0 and 1 under LOH. Restricting to het sites is deliberate: at a
homozygous site the alt fraction is ~0 or ~1 regardless of copy number, so those
sites carry no allelic-imbalance signal — and worse, they would land exactly
where LOH pushes the het signal, drowning out the split this track exists to
show. This is why somatic CNV callers (FACETS, ASCAT, and the like) all work
from germline-het sites.

<Figure caption="The two-panel view over chromosome 3: log2 ratio (top) above BAF (bottom), with the benchmark CNV calls below. The p-arm is a single-copy loss with loss-of-heterozygosity — negative log2 AND the BAF splitting away from 0.5 toward 0 and 1 — while the q-arm returns to a balanced state with the BAF clustered at 0.5. Both tracks use scatter rendering; for BAF this exposes the 0/1 LOH split that a line or density would average back to 0.5." src="/img/sv_cgiab/cnv_log2_baf.png" />

### Calibrate the log2 baseline to diploid using BAF

The log2 track above is centered on each sample's genome-wide median, so 0 is
the modal copy state rather than absolute diploid. With a matched normal already
cancelling technical bias, one extra step gives an absolute, diploid-referenced
baseline without any purity/ploidy model: **anchor 0 to allelically-balanced
regions**. Windows where the het BAF stays tight around 0.5 have both parental
alleles present, so they are copy-neutral diploid; subtract their median log2
from the whole track.

```bash
# WIN must match the mosdepth bin size used above
python3 - <<'PY'
import statistics
from collections import defaultdict
WIN = 10000
autosomes = {f'chr{i}' for i in range(1, 23)}
# allelic balance per window, from the BAF bedgraph
bal = defaultdict(lambda: [0, 0])
for ln in open('HG008-T_baf.bedgraph'):
    c, s, e, v = ln.split()
    if c not in autosomes:
        continue
    k = (c, int(s) // WIN * WIN)
    bal[k][0] += 1
    if abs(float(v) - 0.5) < 0.1:
        bal[k][1] += 1
# diploid baseline = median log2 over windows that are mostly balanced
rows = [ln.split() for ln in open('HG008_log2ratio.bedgraph')]
anchor = []
for c, s, e, v in rows:
    if c not in autosomes:
        continue
    n, b = bal.get((c, int(s) // WIN * WIN), (0, 0))
    if n >= 5 and b / n > 0.7:
        anchor.append(float(v))
off = statistics.median(anchor)
print('diploid baseline (log2) =', round(off, 3))
with open('HG008_log2ratio.calibrated.bedgraph', 'w') as out:
    for c, s, e, v in rows:
        out.write(f'{c}\t{s}\t{e}\t{float(v) - off:.4f}\n')
PY

LC_COLLATE=C sort -k1,1 -k2,2n HG008_log2ratio.calibrated.bedgraph > HG008_log2ratio.calibrated.sorted.bedgraph
bedGraphToBigWig HG008_log2ratio.calibrated.sorted.bedgraph GRCh38_GIABv3.chrom.sizes HG008_log2ratio.calibrated.bw
jbrowse add-track HG008_log2ratio.calibrated.bw --out $OUT --category "CNV" --load move
```

On HG008-T this lands copy-neutral diploid (CN=2) at ~0, single-copy loss (CN=1)
near −1, and a single-copy gain (CN=3) near +0.58 — close to the theoretical
`log2(CN/2)` — so the y-axis can be read directly as relative copy number. This
is a deliberately minimal calibration: it assumes some of the genome is diploid
and heterozygous, and it does not model tumor purity or whole-genome doubling.

The two signals built here — a depth ratio and a BAF/MAF track — are exactly
what production somatic-CNV callers compute internally; the steps above are a
way to understand and visualize that signal, not a replacement for a caller. For
real calling, those tools add segmentation, purity/ploidy estimation, and
integer copy-number assignment on top. For this PacBio HiFi data the natural
choices are long-read aware:

- [HiFiCNV](https://github.com/PacificBiosciences/HiFiCNV) (PacBio) — read-depth
  CNV caller that emits a depth bigWig, a copy-number-segmentation bedGraph, a
  CNV VCF, and a **MAF bigWig** for allelic imbalance — i.e. productionized
  versions of the two tracks above.
- [Wakhan](https://github.com/KolmogorovLab/Wakhan) — haplotype-specific somatic
  copy number from long reads: it reads tumor SNP frequencies at the normal's
  phased heterozygous sites (the BAF signal above) and assigns integer copy
  numbers by Gaussian-mixture deconvolution, also flagging subclonal segments.
  The C-GIAB project publishes Wakhan CNA analyses for HG008-T.

For short-read or array data the established equivalents include
[GATK](https://gatk.broadinstitute.org/) (somatic CNV / CollectAllelicCounts),
[PURPLE](https://github.com/hartwigmedical/hmftools/tree/master/purple),
[FACETS](https://github.com/mskcc/facets),
[Sequenza](https://sequenzatools.bitbucket.io/),
[ASCAT](https://github.com/VanLoo-lab/ascat), and
[CNVkit](https://github.com/etal/cnvkit) — all of which pair a depth ratio with
a BAF track much like this walkthrough.

To see the effect, keep **both** tracks loaded: the raw `HG008_log2ratio.bw`
(centered on the genome median) and the calibrated
`HG008_log2ratio.calibrated.bw` (centered on diploid). Side by side they make
the baseline shift obvious — in a heavily-deleted tumor like HG008-T the raw
0-line sits well above copy-neutral, while the calibrated track puts the
benchmark's CN=2 segments right at 0.

<Figure caption="The raw, median-centered log2 ratio (top) and the BAF-calibrated track (bottom) over chromosome 3, both on a ±2 domain above the benchmark CNV calls. The calibrated track is shifted down by the diploid baseline offset: the CN=2 q-arm drops from above 0 onto 0, and the CN=1 p-arm settles near −1 = log2(1/2), so the y-axis reads directly as relative copy number." src="/img/sv_cgiab/cnv_calibration.png" />

## Align the phased tumor assembly to GRCh38

The C-GIAB project provides a phased de novo assembly of HG008-T (two
haplotypes), produced with [verkko](https://github.com/marbl/verkko). Aligning
both haplotypes against GRCh38 with minimap2 gives us PAF files that JBrowse can
render in the synteny and dotplot views — these are particularly helpful for
complex SVs that are hard to read directly off the alignment track.

```bash
# download the phased assembly (two haplotypes)
curl https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/Verkko_assemblies_05162024/HG008T/HG008T_verkko_v2.2.1_herro_corrected/PBhifi+20kbBCMhifi_UL_ONTq26_herro/assembly.haplotype1.fasta > HG008T.hap1.fa
curl https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/Verkko_assemblies_05162024/HG008T/HG008T_verkko_v2.2.1_herro_corrected/PBhifi+20kbBCMhifi_UL_ONTq26_herro/assembly.haplotype2.fasta > HG008T.hap2.fa

# load both haplotypes as JBrowse assemblies
samtools faidx HG008T.hap1.fa
samtools faidx HG008T.hap2.fa
jbrowse add-assembly HG008T.hap1.fa --load copy --out $OUT
jbrowse add-assembly HG008T.hap2.fa --load copy --out $OUT

# align each haplotype to GRCh38 with minimap2
# note: each command takes about 20 minutes
minimap2 -t8 -cx asm5 GRCh38_GIABv3.fa HG008T.hap1.fa > HG008T.hap1.paf
minimap2 -t8 -cx asm5 GRCh38_GIABv3.fa HG008T.hap2.fa > HG008T.hap2.paf

# load the alignments as synteny tracks
jbrowse add-track HG008T.hap1.paf -a HG008T.hap1,GRCh38_GIABv3 --out $OUT --load copy
jbrowse add-track HG008T.hap2.paf -a HG008T.hap2,GRCh38_GIABv3 --out $OUT --load copy
```

The `-c` flag asks minimap2 to emit base-level CIGAR strings, which encode the
position of insertions and deletions in the alignment. The `-x asm5` preset sets
parameters for same-species assembly-to-assembly alignment. Note that
`add-track -a` takes the assemblies as `query,target` — the **reverse** of the
`minimap2` argument order (`minimap2 target query`). Above, minimap2 is given
`GRCh38_GIABv3.fa HG008T.hap1.fa` (target then query), so the track is loaded
with `-a HG008T.hap1,GRCh38_GIABv3` (query then target). See the
[linear synteny view guide](/docs/user_guides/linear_synteny_view).

## Walkthroughs

Once your JBrowse 2 instance is live, you can explore the loaded data using
three complementary approaches: the SV inspector for whole-genome triage, the
linear genome view for read-level detail at small-to-medium SVs, and the
dotplot/synteny views for chromosome-scale rearrangements in the assembly.

A
[live demo](https://jbrowse.org/code/jb2/latest/?config=/demos/cgiab/config.json)
with all tracks pre-loaded is available to follow along without a local
instance.

### Walkthrough: a chr3–chr13 translocation

Open `http://yourhost.com/jbrowse2/` or the
[live demo](https://jbrowse.org/code/jb2/latest/?config=/demos/cgiab/config.json)
in a web browser. From the start screen, launch the SV inspector.

<Figure caption="The start screen with the SV inspector launcher." src="/img/sv_cgiab/translocation_sv_inspector_start.png" />

Use **Open from track** to pick the C-GIAB benchmark VCF you loaded earlier.

<Figure caption="The Open from track dialog with the C-GIAB SV benchmark VCF selected." src="/img/sv_cgiab/translocation_open_from_track.png" />

The result is a combined data table and circular overview of the SV calls.

<Figure caption="The SV inspector showing the benchmark VCF as a circular overview and a table." src="/img/sv_cgiab/translocation_sv_inspector_view.png" />

Clicking the chord that connects chr3 and chr13 launches a breakpoint split
view; opening the tumor PacBio HiFi reads on each panel and switching to
**compact** mode highlights the supporting split reads as black splines
connecting the two chromosomes.

<Figure caption="Clicking the chord joining chr3 and chr13 opens a breakpoint split view. Black splines connect tumor PacBio HiFi reads that partially map to each chromosome, suggesting a fusion or translocation." src="/img/sv_cgiab/translocation_breakpoint_split.png" />

For the SV inspector workflow itself (filtering the table, search, configuring
the circular overview), see the
[SV inspector guide](/docs/user_guides/sv_inspector_view).

### Walkthrough: a small deletion in CUZD1

For small to medium SVs, the linear genome view is usually all you need. Use the
**search** (magnifying glass) button in the SV inspector to find a specific call
— for example, `SV_85`, a heterozygous deletion that affects two exons of the
CUZD1 gene
([live demo at CUZD1](https://jbrowse.org/code/jb2/latest/?config=/demos/cgiab/config.json&session=spec-%7B"views":%5B%7B"type":"LinearGenomeView","assembly":"GRCh38_GIABv3","loc":"chr5:97050000-97400000","tracks":%5B"GRCh38_HG008-T-V0.4_somatic-stvar_PASS.draftbenchmark.vcf","HG008-T_PacBio-HiFi-Revio_20240125_116x_GRCh38-GIABv3"%5D%7D%5D%7D)).

<Figure caption="The SV inspector after searching for SV_85, a heterozygous CUZD1 deletion. The table's SVTYPE column (hoisted next to ALT) reports the call as a DEL, and clicking the row's location link opens the region in the linear genome view below, where the same SVTYPE is drawn as the <DEL> ALT allele on the variant." src="/img/sv_cgiab/deletion_sv_inspector_search.png" />

Opening the gene annotations and the tumor PacBio HiFi reads, switching the
reads to **compact** mode, and applying **Sort by base pair** with the deletion
centered shows the deletion (enabling the **center line** from the view menu is
helpful for aligning the breakpoint precisely under the center of the view).

<Figure caption="After opening the gene annotations and tumor PacBio HiFi reads, displaying reads in compact mode, and sorting by base pair with the deletion in the center. The deletion removes two CUZD1 exons and is heterozygous." src="/img/sv_cgiab/deletion_linear_view.png" />

For background on SV signals in the alignments track, see the
[SV visualization guide](/docs/user_guides/sv_visualization).

### Walkthrough: CNVs from coverage

Loading raw reads across very large regions is impractical, but whole-genome
coverage stored as a bigWig is fast at any zoom level. From the linear genome
view start screen, click **Show all regions in assembly** to open every
chromosome at once
([live demo on chr5 with normal coverage and CNV calls](https://jbrowse.org/code/jb2/latest/?config=/demos/cgiab/config.json&session=spec-%7B"views":%5B%7B"type":"LinearGenomeView","assembly":"GRCh38_GIABv3","loc":"chr5:1-180915260","tracks":%5B"HG008-N-P_PacBio-HiFi-Revio_20240125_35x_GRCh38-GIABv3.cram.all","GRCh38_HG008-T-V0.4_somatic-CNV_PASS.draftbenchmark.calls"%5D%7D%5D%7D)).

<Figure caption="The linear genome view start screen with the 'Show all regions' button." src="/img/sv_cgiab/cnv_show_all_regions.png" />

Open the tumor and normal bigWigs as a multi-bigwig track for direct comparison.

Apply a manual **min/max score** limit from the track menu to cap the y-axis so
a few high-coverage spikes (centromeres, repeats) don't flatten the copy-number
signal — for the normalized indexcov scale a max of ~2.5 works well. Then switch
the rendering type to **overlapping scatter** so the two samples plot as points
in a single band (tumor red, normal blue), making relative copy-number changes
easy to compare side by side.

<Figure caption="A multi-bigwig track with tumor and normal coverage across all chromosomes: first the track menu's Set min/max score dialog with a manual y-axis cap of 2.5 entered (top), then the same track switched to overlapping scatter (bottom), with normal (blue) and tumor (red) coverage plotted as points in one band. Capping keeps a few centromere/repeat spikes from compressing the copy-number band. These bigWigs are indexcov coverage estimates (computed in seconds from the BAM indexes) normalized so a copy-number-neutral region sits near 1." src="/img/sv_cgiab/cnv_multi_bigwig.png" />

Zoom into a region of interest and open the benchmark CNV BED track to check
whether coverage changes line up with the called CNVs.

<Figure caption="The overlapping-scatter coverage track (tumor red, normal blue) zoomed to chromosome 5, above the benchmark CNV BED track — orange boxes mark individual CNVs and clicking them shows feature details. Coverage drops and gains line up with the called intervals below." src="/img/sv_cgiab/cnv_with_bed_track.png" />

This protocol does not perform normalization or CNV calling; the raw-coverage
bigWig view is a sanity check on existing calls. For a normalized,
copy-number-aware signal, use the log2(tumor/normal) ratio and BAF tracks built
in [Build CNV tracks](#build-cnv-tracks-a-log2tumornormal-ratio-and-a-baf-track)
above. See also the
[multi-quantitative track guide](/docs/user_guides/multiquantitative_track) for
more on tumor vs normal coverage comparison.

### Walkthrough: reading the somatic driver landscape

The tracks built above are not just generic copy-number plots — HG008-T is a
pancreatic ductal adenocarcinoma, and its benchmark calls contain the canonical
PDAC driver alterations. Each of the four classic PDAC drivers shows a
**different** signature across the log2 ratio, BAF, and benchmark CNV tracks,
which makes this dataset a compact tour of how to read somatic copy number:

| Gene             | Role       | Alteration in HG008-T            | Signature on the tracks                  |
| ---------------- | ---------- | -------------------------------- | ---------------------------------------- |
| **CDKN2A**       | suppressor | Focal homozygous deletion (CN 0) | log2 drops to the floor; depth ratio → 0 |
| **TP53**         | suppressor | 17p loss + LOH (CN 1, 1+0)       | negative log2 **and** a BAF split        |
| **SMAD4** (DPC4) | suppressor | 18q loss + LOH (CN 1, 0+1)       | negative log2 **and** a BAF split        |
| **KRAS**         | oncogene   | Allelic gain (CN 3, 2+1)         | positive log2, imbalanced BAF            |

#### CDKN2A: a homozygous deletion vs a single-copy loss

Navigate to `CDKN2A` on chr9. The benchmark calls a focal ~20 kb homozygous
deletion (`SV_75`, total copy number 0) right over the gene, and it reads very
differently from the heterozygous deletions elsewhere in the genome: the
log2(tumor/normal) ratio drops all the way to the **floor**, because a
homozygous deletion removes **both** parental copies and the tumor/normal depth
ratio goes to ~0 (log2 → −∞, here clipped at the −2 axis limit). A single-copy
(heterozygous) loss only halves depth, landing near −1. The deletion sits inside
a larger single-copy-loss arm, so it appears as a deeper focal notch punched
into an already-reduced baseline.

<Figure caption="CDKN2A on chr9: the benchmark SV_75 call is a focal homozygous deletion (copy number 0). The log2 ratio plunges to the floor over the gene — both parental copies are gone, so the depth ratio goes to ~0 — distinct from the surrounding single-copy-loss arm sitting near −0.5. This homozygous-vs-heterozygous distinction is the key to telling a complete two-hit suppressor knockout from a single allelic loss." src="/img/sv_cgiab/driver_cdkn2a_deletion.png" />

#### chr17: loss-with-LOH vs copy-neutral LOH

Chromosome 17 by itself teaches why you build a BAF track alongside the depth
ratio. Open the whole chromosome with the log2 ratio above the BAF:

- the **p-arm** (covering `TP53`) is a single-copy loss with LOH (CN 1, 1+0) —
  the log2 ratio is negative **and** the BAF splits away from 0.5;
- the **q-arm** is **copy-neutral LOH** (CN 2, 2+0): one parental haplotype was
  lost and the other duplicated, so the total copy number is still 2 and the
  log2 ratio stays **flat at 0** — but the BAF still splits hard away from 0.5.

The q-arm event is invisible to depth alone; only the BAF reveals it. That is
the entire argument for pairing the two signals.

<Figure caption="Chromosome 17: log2 ratio (top) over BAF (bottom). The p-arm (left, over TP53) is a single-copy loss with LOH — negative log2 and a BAF split. The q-arm (right) is copy-neutral LOH — the log2 ratio is flat at 0 (total copy number is still 2) yet the BAF splits away from 0.5, so it would be missed by a depth-only analysis. Reading the two tracks together separates the two LOH mechanisms." src="/img/sv_cgiab/driver_chr17_loh.png" />

This is the log2 × BAF decision table the whole CNV section has been building
toward:

| log2 ratio | BAF            | Interpretation            |
| ---------- | -------------- | ------------------------- |
| ~0 (flat)  | tight at 0.5   | balanced diploid          |
| ~0 (flat)  | split from 0.5 | copy-neutral LOH          |
| negative   | split from 0.5 | single-copy loss with LOH |
| positive   | imbalanced     | allelic gain              |

The benchmark BED's per-haplotype columns (`hap1_copy_number`,
`hap2_copy_number`) encode exactly this allelic state: any segment with a `0`
haplotype (e.g. `1+0`, `2+0`) has lost one parental allele and will show a BAF
split, regardless of its total copy number. Clicking a CNV feature shows these
values in the feature details, so you can confirm the allelic call against the
BAF track directly.

#### KRAS and SMAD4

The same reading applies to the remaining two drivers. `KRAS`, the central PDAC
oncogene, sits on a low-level gain on chr12 (CN 3, 2+1) — a positive log2 ratio
with an imbalanced BAF
([live demo at KRAS](https://jbrowse.org/code/jb2/latest/?config=/demos/cgiab/config.json&session=spec-%7B%22views%22%3A%5B%7B%22type%22%3A%22LinearGenomeView%22%2C%22assembly%22%3A%22GRCh38_GIABv3%22%2C%22loc%22%3A%22chr12%3A24%2C000%2C000-27%2C500%2C000%22%2C%22tracks%22%3A%5B%22HG008_log2ratio%22%2C%22HG008-T_baf%22%2C%22GRCh38_HG008-T-V0.4_somatic-CNV_PASS.draftbenchmark.calls%22%5D%7D%5D%7D)).
`SMAD4` (historically "DPC4", _deleted in pancreatic cancer_) is lost with LOH
on 18q (CN 1, 0+1), the mirror image of the TP53 event
([live demo at SMAD4](https://jbrowse.org/code/jb2/latest/?config=/demos/cgiab/config.json&session=spec-%7B%22views%22%3A%5B%7B%22type%22%3A%22LinearGenomeView%22%2C%22assembly%22%3A%22GRCh38_GIABv3%22%2C%22loc%22%3A%22chr18%3A1-80%2C373%2C285%22%2C%22tracks%22%3A%5B%22HG008_log2ratio%22%2C%22HG008-T_baf%22%2C%22GRCh38_HG008-T-V0.4_somatic-CNV_PASS.draftbenchmark.calls%22%5D%7D%5D%7D)).

A few interpretive caveats worth keeping in mind:

- **Purity.** How far the BAF bands separate from 0.5 reflects tumor purity — a
  pure tumor splits LOH all the way to 0 and 1, while normal-cell contamination
  pulls the bands back toward 0.5. The BAF spread is a rough purity readout, not
  just an LOH flag.
- **Whole-genome doubling.** PDAC genomes are doubled in roughly half of cases,
  which shifts the ploidy baseline the simple diploid calibration above assumes;
  allelic states like 2+2 or 2+1 are the tell. Dedicated callers
  ([HiFiCNV](https://github.com/PacificBiosciences/HiFiCNV),
  [Wakhan](https://github.com/KolmogorovLab/Wakhan)) model purity and ploidy
  explicitly — this walkthrough is for reading the raw signal, not replacing
  those tools.

### Walkthrough: synteny and dotplot views of the tumor assembly

Showing the tumor assembly side-by-side with the reference often makes complex
SVs much easier to read than the alignment track alone. Open a dotplot view from
the start screen
([live demo: HG008T hap1 vs GRCh38](https://jbrowse.org/code/jb2/latest/?config=/demos/cgiab/config.json&session=spec-%7B"views":%5B%7B"type":"DotplotView","views":%5B%7B"assembly":"HG008T.hap1"%7D,%7B"assembly":"GRCh38_GIABv3"%7D%5D,"tracks":%5B"HG008T.hap1"%5D%7D%5D%7D)),
set the de novo assembly as one axis and GRCh38 as the other, and pick the
matching synteny track.

<Figure caption="The dotplot import form, with the HG008-T hap1 assembly on one axis and GRCh38 on the other." src="/img/sv_cgiab/dotplot_import_form.png" />

The resulting dotplot reveals chromosomal rearrangements as off-diagonal
segments — for example, the chr3 ↔ chr13 fusion shown in the SV inspector
walkthrough above appears as a distinctive off-diagonal block.

<Figure caption="The resulting dotplot, showing chromosome-scale rearrangements. The chr3–chr13 fusion from the earlier walkthrough is visible as an off-diagonal block." src="/img/sv_cgiab/dotplot_result.png" />

Click and drag over the rearranged region and choose **Open linear synteny
view** to see a base-level alignment of the two genomes; entering `chr3 chr13`
in the GRCh38 search box focuses the view on just those chromosomes.

<Figure caption="A synteny view launched by selecting the chr3/chr13 region in the dotplot — base-level alignment makes the breakpoints easy to read. The minimum alignment length was raised (to ~50kb) to drop short, noisy anchors so the large syntenic blocks read clearly." src="/img/sv_cgiab/synteny_view.png" />

The view above raises the **minimum alignment length** (available in the synteny
view's menu) to filter out short, noisy anchors — without it, many small
overlapping alignments stack up into dense dark fans that obscure the
large-scale syntenic blocks.

For more on these views, see the
[dotplot view guide](/docs/user_guides/dotplot_view) and the
[linear synteny view guide](/docs/user_guides/linear_synteny_view).

See also: [Synteny and genome alignment](/docs/tutorials/synteny_visualization)
— a complementary tutorial on comparing genome assemblies using the same views.

## Troubleshooting

| Problem                                                             | Possible cause                                                     | Solution                                                                                                                                                              |
| ------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The browser stalls when viewing SV regions                          | Too large a region is being loaded with full alignment data        | Use the **Force Load** option with care; downsample very high-depth data; or pre-filter to informative reads (e.g. discordant pairs, split reads with the `SA` tag)   |
| The view is blank, or every position looks like a SNP               | Data was aligned to a different reference than the loaded assembly | Make sure the BAM/CRAM/VCF were aligned against the same FASTA loaded into JBrowse                                                                                    |
| The synteny or dotplot view is blank                                | The assembly arguments to `add-track -a` are flipped               | If you ran `minimap2 ref.fa query.fa > out.paf`, then load with `jbrowse add-track -a query,ref` — the order matters                                                  |
| Errors involving Node.js, or the wrong Node.js version is installed | The apt repository ships an older Node.js                          | Run `sudo apt-get purge -y nodejs npm`, then install from [nodejs.org](https://nodejs.org/en/download) or [NodeSource](https://nodesource.com/products/distributions) |

If you hit a problem not covered above, please file an issue on the
[JBrowse 2 GitHub repository](https://github.com/GMOD/jbrowse-components/issues).

## Next steps

Now that you've explored the C-GIAB HG008 dataset, you can:

- **Load your own SV data** — replace the C-GIAB VCF and BAM files with your own
  calls and sequencing data. The same workflows apply; the main difference is
  that your dataset may have different characteristics (e.g., smaller deletions,
  germline calls, SNVs instead of SVs).
- **Customize track displays** — try different color schemes (pair orientation,
  insert size), read filtering (discordant pairs, soft-clipped), and display
  modes (pileup, read arc, linked reads) to find the visualization that best
  highlights your findings.
- **Use JBrowse Desktop** — all of these workflows work identically in JBrowse 2
  Desktop (Mac, Windows, Linux), which can load files from your local machine
  without needing a web server.
- **Design a de novo assembly alignment** — if you have a phased or
  haplotype-resolved assembly of your own sample, follow the minimap2 steps
  above to create a dotplot and synteny view.

For more on customizing JBrowse 2, see the
[SV visualization guide](/docs/user_guides/sv_visualization).

## References

Diesh, C., Stevens, G. J., Xie, P., et al. (2023).
[JBrowse 2: A Modular Genome Browser with Views of Synteny and Structural Variation](https://doi.org/10.1186/s13059-023-02914-z).
_Genome Biology_, _24_(1), 74.

McDaniel, J. H., Patel, V., Olson, N. D., et al. (2025).
[Development and Extensive Sequencing of a Broadly-Consented Genome in a Bottle Matched Tumor-Normal Pair](https://doi.org/10.1038/s41597-025-04944-7).
_Scientific Data_, _12_(1), 1–22.

Rautiainen, M., Nurk, S., Walenz, B. P., et al. (2023).
[Verkko: telomere-to-telomere assembly of diploid chromosomes](https://doi.org/10.1038/s41587-023-01662-w).
_Nature Biotechnology_, _41_(6), 753–762.

## Data availability

Raw data from C-GIAB is under NCBI BioProject PRJNA200694. Processed data and
benchmark call sets are available from the
[NIST Cancer Genome in a Bottle page](https://www.nist.gov/programs-projects/cancer-genome-bottle).
For the methods behind the dataset, see
[McDaniel et al. 2025](https://doi.org/10.1038/s41597-025-04944-7).
