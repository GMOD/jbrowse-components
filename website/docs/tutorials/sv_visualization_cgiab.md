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
matched tumor (HG008-T) and normal pancreatic tissue (HG008-N-P), sequenced with
PacBio HiFi long reads. The project also publishes a phased de novo assembly of
the tumor genome, which is well-suited to JBrowse 2's synteny and dotplot views.

C-GIAB's goal is to build the reference standards, methods, and data needed to
bring cancer genome sequencing into clinical practice. For the full call sets,
auxiliary assays, and methods, see the
[NIST C-GIAB page](https://www.nist.gov/programs-projects/cancer-genome-bottle)
and [McDaniel et al. 2025](https://doi.org/10.1038/s41597-025-05438-2).

The SV-visualization concepts used below are covered in the
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
  machine after data prep is done, and a 2 GB instance is sufficient to host the
  finished site)
- The following command-line tools, with versions tested at the time of writing
  in parentheses:
  - [JBrowse CLI](/docs/cli) (`@jbrowse/cli` v3.6.5 or later)
  - [Node.js](https://nodejs.org/) (v18 minimum, v24.1.0 used for this tutorial)
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

The coverage bigWigs above are on independent scales, so tumor and normal do not
share a baseline and copy-number changes must be assessed by eye. Two derived
tracks make somatic copy-number state readable directly:

- a **log2(tumor/normal) coverage ratio** — the standard somatic copy-number
  signal: 0 = copy-neutral relative to the genome median, positive = gain,
  negative = loss.
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
# fixed 500bp windows, no per-base output (-n); -f gives the reference for CRAM.
# 500bp is safe at this coverage (35x normal / 116x tumor) — adjacent-bin log2
# noise stays low (median |Δ|≈0.04); drop to a coarser -b if your depth is lower
mosdepth -t8 -n -b 500 -f $REF HG008-N $NORMAL
mosdepth -t8 -n -b 500 -f $REF HG008-T $TUMOR
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

Plot the log2 ratio from the track menu with a symmetric **min/max score** of
about `-2`/`2` and the **scatter** rendering, in a single color (gains and
losses already read off their position above or below the 0 line). Note the 0
line is the sample's genome-wide median, not absolute diploid: in a tumor where
much of the genome is deleted, copy-neutral regions sit above 0 — the benchmark
CNV BED track gives the absolute copy-number reference alongside it.

<Figure caption="Genome-wide somatic copy number, top to bottom: tumor-vs-normal coverage (indexcov — tumor red, normal blue), the log2(tumor/normal) ratio (±2 scatter; 0 = genome median, above = gain, below = loss), the raw BAF (0.5 = balanced; LOH splits toward 0 and 1), and the benchmark CNV calls." src="/img/sv_cgiab/cnv_log2ratio_genome.png" />

> For a quick approximation without downloading the full alignments, build the
> same track from [indexcov](https://github.com/brentp/goleft) bigWigs (computed
> in seconds from the BAM/CRAM indexes) instead of mosdepth — apply the
> identical normalization over the same bins. On this dataset the two agree
> closely across the benchmark CNV regions.

### B-allele frequency (BAF)

At germline-heterozygous SNP sites, plot the tumor's fraction of reads
supporting the alt allele. Take the het sites from a germline small-variant VCF
for the normal sample (the C-GIAB PacBio germline workflow publishes one), then
read tumor allele depths with `bcftools mpileup`:

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

Plot BAF with a fixed `0`..`1` domain and the **scatter** rendering. BAF is one
value per SNP, not a continuous signal, so at whole-chromosome zoom each pixel
bins many SNPs. Scatter's per-bin min/max points keep the 0/1 split visible,
whereas a line or the default whisker summary averages it back to a solid 0.5
band. Pairing the log2 ratio (copy number) with BAF (allelic state) is the
conventional two-panel somatic-CNV view.

Restricting to germline-heterozygous sites is deliberate: at a homozygous site
the alt fraction is ~0 or ~1 regardless of copy number, so it carries no
allelic-imbalance signal and would only drown out the LOH split. Balanced
regions then sit at a single 0.5 band that splits toward 0 and 1 under LOH.

<Figure caption="Chromosome 3, the two-panel CNV view: log2 ratio over the raw BAF over the benchmark CNV calls. The p-arm is a single-copy loss with LOH — negative log2 and the BAF split off 0.5 — while the q-arm is balanced: log2 near 0, BAF a single 0.5 band." src="/img/sv_cgiab/cnv_log2_baf.png" />

### Going further: haplotype-specific copy number with Wakhan

The raw BAF above is exact per SNP, and its scatter keeps the LOH split visible
at chromosome zoom (above). At whole-genome zoom, though, each on-screen pixel
bins so many SNPs that they can no longer be plotted individually, and any
per-bin _average_ of a raw LOH bin — a genuine mix of points near 0 and 1 —
collapses back toward ~0.5, indistinguishable from a balanced bin.

The production fix is to compute the allelic signal _per haplotype_ rather than
per allele. [Wakhan](https://github.com/KolmogorovLab/Wakhan), a
haplotype-specific long-read CNV caller, phases the normal's germline
heterozygous SNPs, assigns each SNP's tumor read support to a haplotype,
corrects phase-switch errors from coverage, and emits one already-summarized
value per phase block — so the LOH signal is clean by construction rather than
recovered from a smoothed average. C-GIAB publishes Wakhan analyses for HG008-T.

```bash
# 1. phase the normal's germline hets against its own long reads
# (longphase: https://github.com/twolinin/longphase — fast, ~1-3 min
# genome-wide at 24 threads; works directly on a CRAM with -r for the
# reference; any variant caller's VCF works as input, not just Clair3)
longphase phase -s $GERMLINE_VCF -b $NORMAL -r $REF --pb -t 24 -o normal_phased
bgzip normal_phased.vcf && tabix -p vcf normal_phased.vcf.gz

# 2. tumor-normal mode: for each phased het SNP, pileup the tumor BAM for
# allele-specific coverage, then segment copy number and estimate
# purity/ploidy. --change-point-detection-for-cna (or a real --breakpoints
# SV VCF, e.g. from Severus) is required or Wakhan silently no-ops; an empty
# placeholder VCF also works and avoids an unrelated crash in segment export.
python wakhan.py all --threads 24 --reference $REF --target-bam $TUMOR \
  --normal-phased-vcf normal_phased.vcf.gz --genome-name HG008-T \
  --change-point-detection-for-cna --breakpoints empty_breakpoints.vcf \
  --out-dir-plots wakhan_out

# 3. fold coverage_data/baf.csv (chrom,pos,minor_haplotype_fraction — ~0.5 in
# balanced regions, ~0.0 under full LOH, i.e. already inverted relative to a
# per-allele BAF) into a 0=balanced/0.5=LOH bedGraph, then to bigWig
awk -F, '{print $1"\t"$2"\t"$2+50000"\t"(0.5-$3)}' wakhan_out/*/coverage_data/baf.csv \
  | sort -k1,1 -k2,2n > HG008-T_baf_folded.bedgraph
bedGraphToBigWig HG008-T_baf_folded.bedgraph GRCh38_GIABv3.chrom.sizes HG008-T_baf_folded.bw

jbrowse add-track HG008-T_baf_folded.bw --out $OUT --category "CNV" --load move
```

Wakhan's `bed_output/` carries haplotype-specific copy-number segments
(`total`/`hap1`/`hap2` columns) — the same shape the benchmark CNV-calls track
already labels explicitly in the chr17 and driver walkthroughs, so they drop
straight into a labeled feature track. (Wakhan also writes a per-haplotype BAF
bigWig; the figures in this tutorial keep the raw per-SNP BAF, which reads
directly as allele fraction.)

### From signal to calls

The depth ratio and BAF built here are the same signals production somatic-CNV
callers compute internally. On top of them, callers add segmentation,
purity/ploidy estimation, and integer copy-number assignment.

For this PacBio HiFi data the long-read-aware options are:

- [HiFiCNV](https://github.com/PacificBiosciences/HiFiCNV) (PacBio) — emits a
  depth bigWig, a copy-number-segmentation bedGraph, a CNV VCF, and a MAF
  bigWig, the production versions of the two tracks above.
- [Wakhan](https://github.com/KolmogorovLab/Wakhan) — haplotype-specific somatic
  copy number from long reads, with subclonal flagging. C-GIAB publishes Wakhan
  analyses for HG008-T.

Short-read and array equivalents include
[GATK](https://gatk.broadinstitute.org/),
[PURPLE](https://github.com/hartwigmedical/hmftools/tree/master/purple),
[FACETS](https://github.com/mskcc/facets),
[Sequenza](https://sequenzatools.bitbucket.io/),
[ASCAT](https://github.com/VanLoo-lab/ascat), and
[CNVkit](https://github.com/etal/cnvkit), all pairing a depth ratio with a BAF
track like this walkthrough.

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
`add-track -a` takes the assemblies as `query,target` — the reverse of the
`minimap2` argument order (`minimap2 target query`). Above, minimap2 is given
`GRCh38_GIABv3.fa HG008T.hap1.fa` (target then query), so the track is loaded
with `-a HG008T.hap1,GRCh38_GIABv3` (query then target). See the
[synteny track config guide](/docs/config_guides/synteny_track) for the adapter
options and the
[linear synteny view guide](/docs/user_guides/linear_synteny_view).

## Walkthroughs

Once your JBrowse 2 instance is live, you can explore the loaded data using
three complementary approaches: the SV inspector for whole-genome triage, the
linear genome view for read-level detail and copy number, and the
dotplot/synteny views for chromosome-scale rearrangements in the assembly.

A
[live demo](https://jbrowse.org/code/jb2/latest/?config=/demos/cgiab/config.json)
with all tracks pre-loaded is available to follow along without a local
instance.

### Walkthrough: a chr3–chr13 translocation

Open `http://yourhost.com/jbrowse2/` or the
[live demo](https://jbrowse.org/code/jb2/latest/?config=/demos/cgiab/config.json)
in a web browser. From the start screen, launch the SV inspector, then use
**Open from track** to pick the C-GIAB benchmark VCF you loaded earlier. The
result is a combined data table and circular overview of the SV calls.

<Figure caption="The SV inspector showing the benchmark VCF as a circular overview alongside a table of calls." src="/img/sv_cgiab/translocation_sv_inspector_view.png" />

Clicking the chord that connects chr3 and chr13 launches a breakpoint split
view. Opening the tumor PacBio HiFi reads on each panel and switching to
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
CUZD1 gene.

<Figure caption="The SV inspector after searching for SV_85, a heterozygous CUZD1 deletion. The table's SVTYPE column reports the call as a DEL, and clicking the row's location link opens the region in the linear genome view below, where the same call is drawn as the <DEL> ALT allele on the variant, above the NCBI RefSeq gene track showing the affected CUZD1 exons." src="/img/sv_cgiab/deletion_sv_inspector_search.png" />

Opening the gene annotations and the tumor PacBio HiFi reads, switching the
reads to **compact** mode, and applying **Sort by base pair** with the deletion
centered shows the deletion (enabling the **center line** from the view menu is
helpful for aligning the breakpoint precisely under the center of the view).

<Figure caption="After opening the gene annotations and tumor PacBio HiFi reads, displaying reads in compact mode, and sorting by base pair with the deletion in the center. The deletion removes two CUZD1 exons and is heterozygous." src="/img/sv_cgiab/deletion_linear_view.png" />

For background on SV signals in the alignments track, see the
[SV visualization guide](/docs/user_guides/sv_visualization).

### Walkthrough: reading copy number

Whole-genome coverage stored as a bigWig is fast at any zoom level, so the
quickest copy-number check is to open the tumor and normal coverage bigWigs as a
single **multi-bigwig** track. From the linear genome view start screen, click
**Show all regions in assembly** to open every chromosome at once. Apply a
manual **min/max score** cap from the track menu (a few centromere and repeat
spikes otherwise compress the copy-number signal), then switch to **overlapping
scatter** so the two samples plot as points in one band — tumor red, normal
blue. Zoom to a region and open the benchmark CNV BED track to check that
coverage changes line up with the called intervals.

<Figure caption="The linear genome view start screen: click Show all regions in assembly to lay out every chromosome across the view." src="/img/sv_cgiab/cnv_show_all_regions.png" />

<Figure caption="A multi-bigwig track with tumor (red) and normal (blue) coverage zoomed to chromosome 5, in overlapping-scatter rendering, above the benchmark CNV BED track. Orange boxes mark individual CNVs (clicking one shows its feature details), and coverage drops and gains line up with the called intervals below." src="/img/sv_cgiab/cnv_with_bed_track.png" />

Raw coverage is only a sanity check on existing calls. For a normalized signal
that reads directly as copy number, use the log2 ratio and BAF tracks built
above. Four loci in HG008-T each carry a different copy-number state, so
together they make a compact tour of how the log2 ratio, BAF, and benchmark CNV
tracks read against one another:

| Locus  | State in HG008-T                 | Signature on the tracks                  |
| ------ | -------------------------------- | ---------------------------------------- |
| CDKN2A | Focal homozygous deletion (CN 0) | log2 drops to the floor, depth ratio → 0 |
| TP53   | 17p loss + LOH (CN 1, 1+0)       | negative log2 and a BAF split            |
| SMAD4  | 18q loss + LOH (CN 1, 0+1)       | negative log2 and a BAF split            |
| KRAS   | Allelic gain (CN 3, 2+1)         | positive log2, imbalanced BAF            |

#### CDKN2A: a homozygous deletion vs a single-copy loss

Navigate to `CDKN2A` on chr9. The benchmark calls a focal ~20 kb homozygous
deletion (`SV_75`, total copy number 0) over the gene. It reads differently from
the heterozygous deletions elsewhere in the genome. A homozygous deletion
removes both parental copies, so the tumor/normal depth ratio goes to ~0 and the
log2 ratio drops to the floor of the axis (log2 → −∞, clipped at the −2 limit).
A single-copy (heterozygous) loss only halves depth, landing near −1. This
deletion sits within a larger single-copy-loss arm, so it appears as a deeper
notch in an already-reduced baseline.

The whole-genome log2 ratio above is built from 500 bp bins, which is coarse
next to a ~20 kb event's edges: it shows the drop but not the precise
breakpoints. To resolve those, compute per-base coverage over just this locus.
Slice the tumor BAM to the region, index the slice, and run plain `mosdepth`
with no `-b`/`-n` flags. That is per-base mode — cheap here because the slice is
tiny, but far slower over the whole genome:

```bash
samtools view -b $TUMOR chr9:21,800,000-22,200,000 -o cdkn2a_slice.bam
samtools index cdkn2a_slice.bam
mosdepth -t4 cdkn2a_perbase cdkn2a_slice.bam
zcat cdkn2a_perbase.per-base.bed.gz > HG008-T_coverage_perbase.bedgraph
bedGraphToBigWig HG008-T_coverage_perbase.bedgraph GRCh38_GIABv3.chrom.sizes HG008-T_coverage_perbase.bw

jbrowse add-track HG008-T_coverage_perbase.bw --out $OUT --category "CNV" --load move
```

Plotted with the default line/area rendering, this resolves the deletion's
boundaries: depth drops to 0 at the deletion edges, matching the benchmark call
closely.

<Figure caption="The CDKN2A deletion on chr9, top to bottom: NCBI RefSeq genes (compact display), the per-base coverage BigWig, the PacBio HiFi read pileup, and the benchmark CNV calls. The deletion reads as coverage dropping to 0 and a gap in the pileup right at the deletion's edges. The pileup has 'View as pairs / link supplementary alignments' on, so each read and its split (supplementary) segments are chained onto one row. The salmon reads are those split long-read alignments spanning the deletion breakpoints (they are colored by strand — salmon forward, purple reverse). The bottom track is the benchmark CNV call, whose feature label reads the copy-number columns from the BED." src="/img/sv_cgiab/driver_cdkn2a_deletion.png" />

#### chr17: loss-with-LOH vs copy-neutral LOH

Chromosome 17 shows why the BAF track is built alongside the depth ratio. Open
the whole chromosome with the log2 ratio above the BAF:

- the p-arm (covering `TP53`) is a single-copy loss with LOH (CN 1, 1+0) — the
  log2 ratio is negative and the BAF splits away from 0.5.
- the q-arm is copy-neutral LOH (CN 2, 2+0): one parental haplotype was lost and
  the other duplicated, so the total copy number is still 2 and the log2 ratio
  stays flat at 0, but the BAF still splits away from 0.5.

The q-arm event is invisible to depth alone. Only the BAF reveals it, which is
why the two signals are read together.

<Figure caption="Chromosome 17 with the log2(tumor/normal) ratio (top) over the raw BAF (middle) over the benchmark CNV calls. The p-arm (covering TP53) is a single-copy loss with LOH — the log2 ratio drops below 0 and the BAF het SNPs split off the 0.5 line (CNA_20, CN 1, 1+0). The q-arm is copy-neutral LOH — the log2 ratio stays flat at 0, yet the BAF still splits off 0.5 (CNA_21, CN 2, 2+0). The q-arm event is invisible to depth alone; only the BAF reveals it." src="/img/sv_cgiab/cnv_chr17_loh.png" />

The log2 × BAF combinations read as a compact decision table:

| log2 ratio | BAF            | Interpretation            |
| ---------- | -------------- | ------------------------- |
| ~0 (flat)  | tight at 0.5   | balanced diploid          |
| ~0 (flat)  | split from 0.5 | copy-neutral LOH          |
| negative   | split from 0.5 | single-copy loss with LOH |
| positive   | imbalanced     | allelic gain              |

The benchmark BED's per-haplotype columns (`hap1_copy_number`,
`hap2_copy_number`) encode this allelic state: any segment with a `0` haplotype
(e.g. `1+0`, `2+0`) has lost one parental allele and will show a BAF split,
regardless of its total copy number. Clicking a CNV feature shows these values
in the feature details, so you can confirm the allelic call against the BAF
track directly.

#### KRAS and SMAD4

The same reading covers the other two loci. `KRAS` on chr12 is a low-level gain
(CN 3, 2+1) — positive log2, and a BAF that splits only modestly off the 0.5
line (toward ~1/3 and ~2/3), the partial imbalance a 2+1 gain produces rather
than the full split toward 0 and 1 of a complete haplotype loss.

<Figure caption="KRAS on chr12: log2 ratio over the raw BAF over the CNV calls. The gain (SV_101, CN 3, 2+1) reads as log2 just above 0 and a BAF that splits only modestly off 0.5 — the partial imbalance of a 2+1 gain, not the full 0/1 split of a haplotype loss." src="/img/sv_cgiab/driver_kras_gain.png" />

`SMAD4` on 18q is lost with LOH (CN 1, 0+1), the mirror image of the TP53 event,
though the shift here is more muted than the chr17 example.

<Figure caption="Chromosome 18: log2 ratio over the raw BAF over the CNV calls. CNA_48 (single-copy loss with LOH over SMAD4) spans most of the chromosome but reads as only a modest log2 dip and a sparse BAF split off 0.5 — weaker than the TP53 event because fewer tumor cells carry it. The centromere-proximal ~22 Mb is uncalled mapping-bias noise (noCNV)." src="/img/sv_cgiab/driver_smad4_loh.png" />

The same allelic state reads strong or muted between loci, set by the fraction
of tumor cells carrying it — HG008-T is a pure cell line, so this is
subclonality, not normal-cell contamination. Dedicated callers
([HiFiCNV](https://github.com/PacificBiosciences/HiFiCNV),
[Wakhan](https://github.com/KolmogorovLab/Wakhan)) model subclonal fraction and
ploidy explicitly; this walkthrough reads the raw signal off the tracks. See
also the
[multi-quantitative track guide](/docs/user_guides/multiquantitative_track) for
tumor vs normal coverage comparison.

### Walkthrough: synteny and dotplot views of the tumor assembly

Showing the tumor assembly side-by-side with the reference can make complex SVs
easier to read than the alignment track alone. Open a dotplot view from the
start screen, set the de novo assembly as one axis and GRCh38 as the other, and
pick the matching synteny track.

<Figure caption="The dotplot import form, with the HG008-T hap1 assembly on one axis and GRCh38 on the other." src="/img/sv_cgiab/dotplot_import_form.png" />

The resulting dotplot is a whole-genome overview of the assembly aligned to
GRCh38: each contig's alignments run as diagonal segments, and it is the launch
point for drilling into a region of interest. Drag over a region and open a
linear synteny view (below), where a specific rearrangement becomes legible at
base level.

<Figure caption="The resulting dotplot: HG008-T hap1 contigs (y) aligned to GRCh38 chromosomes (x), a whole-genome overview of the assembly-to-reference alignment." src="/img/sv_cgiab/dotplot_result.png" />

Use **Open linear synteny view** from the drag selection, then enter
`chr3 chr13` in the GRCh38 search box to focus on those chromosomes. Raising the
**minimum alignment length** (in the synteny view's menu) drops short, noisy
anchors so the large syntenic blocks read clearly.

<Figure caption="A synteny view launched by selecting the chr3/chr13 region in the dotplot — base-level alignment makes the breakpoints easy to read. The minimum alignment length was raised (to ~50kb) to drop short, noisy anchors so the large syntenic blocks read clearly." src="/img/sv_cgiab/synteny_view.png" />

For more on these views, see the
[dotplot view guide](/docs/user_guides/dotplot_view) and the
[linear synteny view guide](/docs/user_guides/linear_synteny_view).

See also: [Synteny visualization](/docs/tutorials/synteny_visualization) — a
complementary tutorial on comparing genome assemblies using the same views.

## Troubleshooting

| Problem                                                             | Possible cause                                                     | Solution                                                                                                                                                              |
| ------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The browser stalls when viewing SV regions                          | Too large a region is being loaded with full alignment data        | Use the **Force Load** option with care, downsample very high-depth data, or pre-filter to informative reads (e.g. discordant pairs, split reads with the `SA` tag)   |
| The view is blank, or every position looks like a SNP               | Data was aligned to a different reference than the loaded assembly | Make sure the BAM/CRAM/VCF were aligned against the same FASTA loaded into JBrowse                                                                                    |
| The synteny or dotplot view is blank                                | The assembly arguments to `add-track -a` are flipped               | If you ran `minimap2 ref.fa query.fa > out.paf`, then load with `jbrowse add-track -a query,ref` — the order matters                                                  |
| Errors involving Node.js, or the wrong Node.js version is installed | The apt repository ships an older Node.js                          | Run `sudo apt-get purge -y nodejs npm`, then install from [nodejs.org](https://nodejs.org/en/download) or [NodeSource](https://nodesource.com/products/distributions) |

If you hit a problem not covered above, please file an issue on the
[JBrowse 2 GitHub repository](https://github.com/GMOD/jbrowse-components/issues).

## Next steps

Now that you've explored the C-GIAB HG008 dataset, you can:

- **Load your own SV data** — replace the C-GIAB VCF and BAM files with your own
  calls and sequencing data. The same workflows apply. The main difference is
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

## See also

- [Synteny visualization](/docs/tutorials/synteny_visualization) — the same
  dotplot/synteny views, worked with bacterial genome assemblies
- [SV visualization](/docs/user_guides/sv_visualization) — reference for the SV
  display types and read-signal patterns used throughout
- [SV inspector view](/docs/user_guides/sv_inspector_view) — the SV inspector
  workflow used in the translocation and CUZD1 walkthroughs
- [Multi-quantitative track](/docs/user_guides/multiquantitative_track) —
  tumor/normal coverage comparison referenced in the CNV section

## References

Diesh, C., Stevens, G. J., Xie, P., et al. (2023).
[JBrowse 2: A Modular Genome Browser with Views of Synteny and Structural Variation](https://doi.org/10.1186/s13059-023-02914-z).
_Genome Biology_, _24_(1), 74.

McDaniel, J. H., Patel, V., Olson, N. D., et al. (2025).
[Development and Extensive Sequencing of a Broadly-Consented Genome in a Bottle Matched Tumor-Normal Pair](https://doi.org/10.1038/s41597-025-05438-2).
_Scientific Data_, _12_, 1195.

Rautiainen, M., Nurk, S., Walenz, B. P., et al. (2023).
[Verkko: telomere-to-telomere assembly of diploid chromosomes](https://doi.org/10.1038/s41587-023-01662-w).
_Nature Biotechnology_, _41_(6), 753–762.

## Data availability

Raw data from C-GIAB is under NCBI BioProject PRJNA200694. Processed data and
benchmark call sets are available from the
[NIST Cancer Genome in a Bottle page](https://www.nist.gov/programs-projects/cancer-genome-bottle).
For the methods behind the dataset, see
[McDaniel et al. 2025](https://doi.org/10.1038/s41597-025-05438-2).
