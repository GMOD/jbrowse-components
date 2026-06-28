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
and [McDaniel et al. 2025](https://doi.org/10.1038/s41597-025-04944-7).

The SV-visualization concepts used below are covered in the
[SV visualization guide](/docs/user_guides/sv_visualization) and the
[SV inspector guide](/docs/user_guides/sv_inspector_view); this tutorial focuses
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
  - [Node.js](https://nodejs.org/) (v18 minimum; v24.1.0 used for this tutorial)
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

The coverage bigWigs above are on independent scales, so tumor and normal don't
share a baseline and copy-number changes have to be eyeballed. Two derived
tracks make somatic copy-number state readable directly:

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

Plot the log2 ratio from the track menu with a symmetric **min/max score** of
about `-2`/`2` and the **scatter** rendering, in a single color (gains and
losses already read off their position above or below the 0 line). Note the 0
line is the sample's genome-wide median, **not** absolute diploid: in a tumor
where much of the genome is deleted, copy-neutral regions sit above 0 — the
benchmark CNV BED track gives the absolute copy-number reference alongside it.

<Figure caption="The log2(tumor/normal) coverage ratio across all chromosomes, drawn as a single-color scatter capped to a symmetric ±2 domain, above the benchmark somatic CNV calls. Gains (positive) and losses (negative) read off the 0 line by position and line up with the called intervals." src="/img/sv_cgiab/cnv_log2ratio_genome.png" />

> For a quick approximation without downloading the full alignments, build the
> same track from [indexcov](https://github.com/brentp/goleft) bigWigs (computed
> in seconds from the BAM/CRAM indexes) instead of mosdepth — apply the
> identical normalization over the same bins. On this dataset the two agree
> closely (Pearson _r_ ≈ 0.99 across benchmark CNV regions).

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

Plot BAF with a fixed `0`..`1` domain and the **scatter** rendering. Scatter
matters here because BAF is one value per SNP, not a continuous signal: at
whole-chromosome zoom each pixel bins many SNPs, and scatter's per-bin min/max
points keep the 0/1 split visible, whereas a line or the default whisker summary
averages it back to a solid 0.5 band. Pairing the log2 ratio (copy number) with
BAF (allelic state) is the conventional two-panel somatic-CNV view.

Restricting to germline-**heterozygous** sites is deliberate: at a homozygous
site the alt fraction is ~0 or ~1 regardless of copy number, so it carries no
allelic-imbalance signal and would only drown out the LOH split this track
exists to show. Balanced regions then sit at a single 0.5 band that splits
toward 0 and 1 under LOH — which is why somatic CNV callers all work from
germline-het sites.

<Figure caption="The two-panel view over chromosome 3: log2 ratio (top) above BAF (bottom), with the benchmark CNV calls below. The p-arm is a single-copy loss with loss-of-heterozygosity — negative log2 AND the BAF splitting away from 0.5 toward 0 and 1 — while the q-arm returns to a balanced state with the BAF clustered at 0.5." src="/img/sv_cgiab/cnv_log2_baf.png" />

### From signal to calls

The depth ratio and BAF built here are exactly the signals production
somatic-CNV callers compute internally; on top, they add segmentation,
purity/ploidy estimation, and integer copy-number assignment. For this PacBio
HiFi data the long-read-aware choices are
[HiFiCNV](https://github.com/PacificBiosciences/HiFiCNV) (PacBio; emits a depth
bigWig, a copy-number-segmentation bedGraph, a CNV VCF, and a MAF bigWig —
productionized versions of the two tracks above) and
[Wakhan](https://github.com/KolmogorovLab/Wakhan) (haplotype-specific somatic
copy number from long reads, with subclonal flagging; C-GIAB publishes Wakhan
analyses for HG008-T). Short-read and array equivalents include
[GATK](https://gatk.broadinstitute.org/),
[PURPLE](https://github.com/hartwigmedical/hmftools/tree/master/purple),
[FACETS](https://github.com/mskcc/facets),
[Sequenza](https://sequenzatools.bitbucket.io/),
[ASCAT](https://github.com/VanLoo-lab/ascat), and
[CNVkit](https://github.com/etal/cnvkit) — all pairing a depth ratio with a BAF
track much like this walkthrough.

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
CUZD1 gene.

<Figure caption="The SV inspector after searching for SV_85, a heterozygous CUZD1 deletion. The table's SVTYPE column reports the call as a DEL, and clicking the row's location link opens the region in the linear genome view below, where the same call is drawn as the <DEL> ALT allele on the variant." src="/img/sv_cgiab/deletion_sv_inspector_search.png" />

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
**Show all regions in assembly** to open every chromosome at once
([live demo on chr5](https://jbrowse.org/code/jb2/latest/?config=/demos/cgiab/config.json&session=spec-%7B"views":%5B%7B"type":"LinearGenomeView","assembly":"GRCh38_GIABv3","loc":"chr5:1-180915260","tracks":%5B"HG008-N-P_PacBio-HiFi-Revio_20240125_35x_GRCh38-GIABv3.cram.all","GRCh38_HG008-T-V0.4_somatic-CNV_PASS.draftbenchmark.calls"%5D%7D%5D%7D)).
Apply a manual **min/max score** cap from the track menu (a few centromere and
repeat spikes otherwise compress the copy-number signal), then switch to
**overlapping scatter** so the two samples plot as points in one band — tumor
red, normal blue. Zoom to a region and open the benchmark CNV BED track to check
that coverage changes line up with the called intervals.

<Figure caption="A multi-bigwig track with tumor (red) and normal (blue) coverage zoomed to chromosome 5, in overlapping-scatter rendering, above the benchmark CNV BED track. Orange boxes mark individual CNVs (clicking one shows its feature details); coverage drops and gains line up with the called intervals below." src="/img/sv_cgiab/cnv_with_bed_track.png" />

Raw coverage is only a sanity check on existing calls. For a normalized signal
that reads directly as copy number, use the log2 ratio and BAF tracks built
above. HG008-T is a pancreatic ductal adenocarcinoma, and its benchmark calls
contain the canonical PDAC driver alterations — each with a **different**
signature across the log2 ratio, BAF, and benchmark CNV tracks, which makes this
dataset a compact tour of how to read somatic copy number:

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

<Figure caption="CDKN2A on chr9: the benchmark SV_75 call is a focal homozygous deletion (copy number 0). The log2 ratio plunges to the floor over the gene — both parental copies are gone — distinct from the surrounding single-copy-loss arm near −0.5. This homozygous-vs-heterozygous distinction tells a complete two-hit suppressor knockout from a single allelic loss." src="/img/sv_cgiab/driver_cdkn2a_deletion.png" />

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

<Figure caption="Chromosome 17: log2 ratio (top) over BAF (bottom). The p-arm (left, over TP53) is a single-copy loss with LOH — negative log2 and a BAF split. The q-arm (right) is copy-neutral LOH — the log2 ratio is flat at 0 (total copy number is still 2) yet the BAF splits away from 0.5, so it would be missed by a depth-only analysis." src="/img/sv_cgiab/driver_chr17_loh.png" />

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

The same reading covers the other two drivers. `KRAS`, the central PDAC
oncogene, sits on a low-level gain on chr12 (CN 3, 2+1) — positive log2,
imbalanced BAF
([live demo at KRAS](https://jbrowse.org/code/jb2/latest/?config=/demos/cgiab/config.json&session=spec-%7B%22views%22%3A%5B%7B%22type%22%3A%22LinearGenomeView%22%2C%22assembly%22%3A%22GRCh38_GIABv3%22%2C%22loc%22%3A%22chr12%3A24%2C000%2C000-27%2C500%2C000%22%2C%22tracks%22%3A%5B%22HG008_log2ratio%22%2C%22HG008-T_baf%22%2C%22GRCh38_HG008-T-V0.4_somatic-CNV_PASS.draftbenchmark.calls%22%5D%7D%5D%7D)).
`SMAD4` (historically "DPC4", _deleted in pancreatic cancer_) is lost with LOH
on 18q (CN 1, 0+1), the mirror image of the TP53 event
([live demo at SMAD4](https://jbrowse.org/code/jb2/latest/?config=/demos/cgiab/config.json&session=spec-%7B%22views%22%3A%5B%7B%22type%22%3A%22LinearGenomeView%22%2C%22assembly%22%3A%22GRCh38_GIABv3%22%2C%22loc%22%3A%22chr18%3A1-80%2C373%2C285%22%2C%22tracks%22%3A%5B%22HG008_log2ratio%22%2C%22HG008-T_baf%22%2C%22GRCh38_HG008-T-V0.4_somatic-CNV_PASS.draftbenchmark.calls%22%5D%7D%5D%7D)).

Two interpretive caveats: how far the BAF bands separate from 0.5 reflects tumor
purity (normal-cell contamination pulls the split back toward 0.5), and PDAC
genomes are whole-genome-doubled in roughly half of cases, which shifts the
ploidy baseline — allelic states like 2+2 are the tell. Dedicated callers
([HiFiCNV](https://github.com/PacificBiosciences/HiFiCNV),
[Wakhan](https://github.com/KolmogorovLab/Wakhan)) model purity and ploidy
explicitly; this walkthrough reads the raw signal rather than replacing them.
See also the
[multi-quantitative track guide](/docs/user_guides/multiquantitative_track) for
more on tumor vs normal coverage comparison.

### Walkthrough: synteny and dotplot views of the tumor assembly

Showing the tumor assembly side-by-side with the reference often makes complex
SVs much easier to read than the alignment track alone. Open a dotplot view from
the start screen, set the de novo assembly as one axis and GRCh38 as the other,
and pick the matching synteny track.

<Figure caption="The dotplot import form, with the HG008-T hap1 assembly on one axis and GRCh38 on the other." src="/img/sv_cgiab/dotplot_import_form.png" />

The resulting dotplot reveals chromosomal rearrangements as off-diagonal
segments — for example, the chr3 ↔ chr13 fusion from the SV inspector
walkthrough above appears as a distinctive off-diagonal block.

<Figure caption="The resulting dotplot, showing chromosome-scale rearrangements. The chr3–chr13 fusion from the earlier walkthrough is visible as an off-diagonal block." src="/img/sv_cgiab/dotplot_result.png" />

Click and drag over the rearranged region and choose **Open linear synteny
view** to see a base-level alignment of the two genomes; entering `chr3 chr13`
in the GRCh38 search box focuses the view on just those chromosomes. Raising the
**minimum alignment length** (in the synteny view's menu) drops short, noisy
anchors so the large syntenic blocks read clearly.

<Figure caption="A synteny view launched by selecting the chr3/chr13 region in the dotplot — base-level alignment makes the breakpoints easy to read. The minimum alignment length was raised (to ~50kb) to drop short, noisy anchors so the large syntenic blocks read clearly." src="/img/sv_cgiab/synteny_view.png" />

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
