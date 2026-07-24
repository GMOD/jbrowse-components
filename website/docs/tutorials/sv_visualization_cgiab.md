---
title: Structural variants (Cancer GIAB)
sidebar_label: SVs (Cancer GIAB)
description:
  Load and inspect structural variants from real cancer sequencing data
guide_category: Tutorials
tutorial_category: Structural variation
---

This tutorial walks through loading data from the
[Cancer Genome in a Bottle (C-GIAB)](https://www.nist.gov/programs-projects/cancer-genome-bottle)
project into JBrowse 2 and using several view types to inspect the supplied
benchmark structural variant (SV) and copy-number variant (CNV) calls. The
dataset is HG008, a pancreatic ductal adenocarcinoma (PDAC) cell line with
matched tumor (HG008-T) and normal pancreatic tissue (HG008-N-P), sequenced with
PacBio HiFi long reads. The project also publishes a near-complete
telomere-to-telomere de novo assembly of the tumor genome, which is well-suited
to JBrowse 2's synteny and dotplot views.

For the full call sets, auxiliary assays, and methods, see the
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
- Approximately 1 TB of free disk space for the interactive walkthrough, or ~1.5
  TB to run the full reproduce pipeline below (the BAM/CRAM files are large)
- At least 32 GB of RAM for the minimap2 alignment step (you can downsize the
  machine after data prep is done, and a 2 GB instance is sufficient to host the
  finished site)
- The following command-line tools, with versions tested at the time of writing
  in parentheses:
  - [JBrowse CLI](/docs/cli) (`@jbrowse/cli` v3.6.5 or later)
  - [Node.js](https://nodejs.org/) (v18 minimum, v24.1.0 used for this tutorial)
  - [tabix](http://www.htslib.org/doc/tabix.html) (v1.21 or later)
  - [samtools](http://www.htslib.org/) (v1.21 or later)
  - [minimap2](https://github.com/lh3/minimap2)
  - [megadepth](https://github.com/ChristopherWilks/megadepth) (v1.2.0 or
    later), for the coverage tracks
  - [HiFiCNV](https://github.com/PacificBiosciences/HiFiCNV) (v1.0 or later),
    for the copy-number tracks

All of the data-preparation commands below are also collected into one
reproducible script (see [Reproduce it end to end](#reproduce-it-end-to-end)).

## Install JBrowse 2 with Apache 2

Install system dependencies and the JBrowse CLI:

```bash
export OUT=/var/www/html/jbrowse2
sudo apt-get update
sudo apt-get install wget apache2 tabix samtools minimap2
sudo service apache2 start

# Debian/Ubuntu's "nodejs" package is often older than the v18 minimum, so
# install a current Node.js from NodeSource; see
# https://github.com/nodesource/distributions
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# confirm node.js >= v18 is installed
node --version
sudo npm install -g @jbrowse/cli

# confirm the jbrowse CLI is installed
jbrowse --version

# megadepth and HiFiCNV are release binaries (not in apt); fetch both onto PATH
wget https://github.com/ChristopherWilks/megadepth/releases/download/1.2.0/megadepth
chmod +x megadepth && sudo mv megadepth /usr/local/bin/
curl -L https://github.com/PacificBiosciences/HiFiCNV/releases/latest/download/hificnv-linux_x86_64.tar.gz \
  | tar xz --strip-components=1 -C /usr/local/bin --wildcards '*/hificnv'

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

Load the V0.5 HG008-T draft benchmark SV calls (VCF) and CNV calls (BED), both
kept as remote URL tracks:

```bash
BENCH=https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/NIST_HG008-T_somatic-stvar-CNV_DraftBenchmark_V0.5-20260318

jbrowse add-track $BENCH/GRCh38_HG008-T-V0.5_somatic-stvar_PASS.draftbenchmark.vcf.gz \
  --out $OUT --category "Variant calls"
jbrowse add-track $BENCH/GRCh38_HG008-T-V0.5_somatic-CNV_PASS.draftbenchmark.calls.bed \
  --out $OUT --category "Variant calls"
```

The CNV BED ships without a header, so its columns beyond `chrom/start/end` load
unnamed. Rather than editing the file, name them on the adapter with the
[`columnNames`](/docs/config/bedadapter/#slot-columnnames) slot in
`config.json`:

```json
"adapter": {
  "type": "BedAdapter",
  "uri": ".../GRCh38_HG008-T-V0.5_somatic-CNV_PASS.draftbenchmark.calls.bed",
  "columnNames": ["chrom", "start", "end", "total_copy_number", "hap1_copy_number", "hap2_copy_number", "name"]
}
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

# compute coverage and add both the CRAM and bigWig to the JBrowse config
# note: this loop takes 10-15 minutes per CRAM
for i in *.cram; do
  megadepth $i --bigwig
  jbrowse add-track $i --out $OUT --category "Reads" --load move
  jbrowse add-track $i.all.bw --out $OUT --category "Coverage" --load move
done
```

## Add copy-number tracks from a somatic CNV caller

The coverage bigWigs above are raw depth, so copy-number changes have to be read
by eye. A somatic CNV caller turns that depth into the standard two-panel view:
a copy-number track, and a B-allele / minor-allele frequency track that
separates loss-of-heterozygosity from balanced regions. Run the caller that
matches your reads; each writes files that load straight into JBrowse.

### PacBio HiFi: HiFiCNV

The reads here are PacBio HiFi, so we call copy number with
[HiFiCNV](https://github.com/PacificBiosciences/HiFiCNV), PacBio's somatic CNV
caller. Given the tumor alignment, the reference, and a small-variant VCF whose
allele depths drive the allele-frequency track, it writes a depth bigWig, a
minor-allele-frequency (MAF) bigWig, an integer copy-number bedGraph, and a CNV
VCF.

If you do use that MAF track, the VCF has to hold the **tumor's** calls, not the
matched normal's. HiFiCNV builds the track by reading the `AD` field out of the
`--maf` VCF and never looks at `--bam` for it, so a germline VCF from the normal
produces a track sitting near 0.5 everywhere, including across arms that have
lost a copy. With the tumor's calls a germline het inside a
loss-of-heterozygosity arm is homozygous in the tumor, so its minor allele
fraction collapses toward 0 and the loss becomes visible. On chr3p, which the
benchmark calls a single-copy loss, that is the difference between 1742
heterozygous sites and 13.

The choice affects that track and nothing else: the depth bigWig comes from the
BAM, and re-running with the normal's VCF instead of the tumor's leaves the
`copynum` bedGraph byte-identical, so the segmentation and the CNV VCF are not
MAF-informed. This tutorial plots BAF instead of `maf.bw` (below), so the
`--maf` argument here only decides whether that one unused output is meaningful.

```bash
# Clair3 tumor calls published alongside C-GIAB's Wakhan CNA run
curl -O https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/NIH_HiFi_Wakhan-CNA_20240308/vcf_inputs/merge_output_tumor.vcf.gz
tabix -p vcf merge_output_tumor.vcf.gz

hificnv \
  --bam HG008-T_PacBio-HiFi-Revio_20240125_116x_GRCh38-GIABv3.cram \
  --ref GRCh38_GIABv3.fa \
  --maf merge_output_tumor.vcf.gz \
  --threads 8 --output-prefix hificnv
# -> hificnv.<sample>.depth.bw, .maf.bw, .copynum.bedgraph, .vcf.gz
# the depth track is named for the --bam sample, the maf track for the --maf
# VCF's sample column, so the two file names differ

tabix -p vcf hificnv.*.vcf.gz
for f in hificnv.*.depth.bw hificnv.*.maf.bw hificnv.*.vcf.gz; do
  jbrowse add-track "$f" --out $OUT --category "CNV" --load move
done
```

Plot the depth bigWig with the **scatter** rendering. The `copynum` bedGraph
carries HiFiCNV's segmented integer copy number and the CNV VCF its discrete
calls. Read them against the benchmark CNV BED, which holds the absolute copy
number for each interval.

For the allelic panel we use **B-allele frequency** rather than HiFiCNV's own
`maf.bw`. HiFiCNV folds its track to `min(AF, 1-AF)`, so a region that has lost
one parental copy collapses onto a single band near 0. Unfolded BAF keeps the
two bands apart, and that mirrored split is the shape most cancer-genomics
readers recognize on sight: a balanced region is one band at 0.5, and a
loss-of-heterozygosity region splits into two bands at 0 and 1. Build it by
piling up the tumor reads at germline heterozygous sites and taking the alt
fraction (`scripts/build_sv_visualization_cgiab.sh` does this with
`bcftools mpileup`, keeping sites with at least 10x). Plot it with **scatter**
over a fixed 0 to 1 range: the value is one point per het site and the spread is
the entire signal, so a line rendering would average the two LOH bands back to
0.5 and erase the event.

<Figure caption="Chromosome 3, the two-panel copy-number view over the benchmark CNV calls: the HiFiCNV depth track above B-allele frequency. The p-arm is a single-copy loss with loss-of-heterozygosity (depth halves, BAF splits into two bands at 0 and 1); the q-arm is balanced (flat depth, one BAF band at 0.5)." src="/img/sv_cgiab/cnv_depth_baf.png" />

### Illumina short reads: DRAGEN or CNVkit

Most somatic sequencing is short-read, so if your reads are Illumina, call CNVs
with a short-read tool instead. C-GIAB runs
[DRAGEN](https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/DRAGEN-v4.2.4_ILMN-WGS_20240312/)
(see its `README_DRAGEN_20240312.md`) and publishes the somatic CNV VCF, which
loads with no local compute:

```bash
jbrowse add-track https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/DRAGEN-v4.2.4_ILMN-WGS_20240312/standard/dragen_4.2.4_HG008-mosaic_tumor.cnv.vcf.gz \
  --out $OUT --category "CNV"
```

[CNVkit](https://github.com/etal/cnvkit) is an open-source alternative; its
`.cnr`/`.cns` outputs export to bigWig/BED for the same depth-and-segment view.

### Haplotype-specific copy number: Wakhan

Both callers above fold the two parental alleles into one frequency, so at
whole-genome zoom an LOH block averages back toward balanced.
[Wakhan](https://github.com/KolmogorovLab/Wakhan) phases the germline
heterozygous SNPs and reports copy number _per haplotype_ instead, keeping the
LOH signal clean. C-GIAB publishes Wakhan output for HG008-T; its `bed_output/`
segments (`total`/`hap1`/`hap2` copy number) load as labeled feature tracks with
nothing to recompute:

```bash
WAKHAN=https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/NIH_HiFi_Wakhan-CNA_20240308/bed_output
jbrowse add-track $WAKHAN/HG008_HiFi_copynumbers_segments.bed --out $OUT --category "CNV"
jbrowse add-track $WAKHAN/HG008_HiFi_loh_segments.bed --out $OUT --category "CNV"
```

### Subclonal copy number

The tracks above average over every tumor cell, so a change carried by only part
of the tumor reads as a muted, intermediate signal. C-GIAB publishes short-read
WGS for a panel of HG008-T single-cell-derived clones (one colony grown from a
single tumor cell, so each reports one subclone's copy number) under
[`HG008-T_clones/`](https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/NIST/HG008-T_clones/).
Call per-clone copy number with a short-read caller (DRAGEN or CNVkit) and load
the clones as rows of one `MultiQuantitativeTrack`, the same track type as the
[single-cell ATAC tutorial](/docs/tutorials/scatac_pseudobulk). A row that
departs from the rest marks a CNV private to that subclone.

## Align the tumor assembly to GRCh38

The C-GIAB project provides a near-complete telomere-to-telomere de novo
assembly of HG008-T
([Wagner et al. 2026](https://doi.org/10.64898/2026.05.01.722316)),
haplotype-resolved into T2T scaffolds. Aligning it against GRCh38 with minimap2
gives a PAF file that JBrowse renders in the synteny and dotplot views, which
are particularly helpful for complex SVs that are hard to read off the alignment
track.

```bash
# download the T2T tumor assembly (v3.2) and load it as a JBrowse assembly
curl -L https://nist-giab.s3.us-east-1.amazonaws.com/giab_tumor-normal/analysis/HG008/NIST_asm_dev/HG008T_v3.2/HG008T_v3.2.fasta.gz > HG008T_v3.2.fasta.gz
gunzip HG008T_v3.2.fasta.gz
samtools faidx HG008T_v3.2.fasta
jbrowse add-assembly HG008T_v3.2.fasta --name HG008T_v3.2 --load copy --out $OUT

# align to GRCh38 with minimap2 (about 20 minutes)
minimap2 -t8 -cx asm5 GRCh38_GIABv3.fa HG008T_v3.2.fasta > HG008T_v3.2.paf

# load the alignment as a synteny track
jbrowse add-track HG008T_v3.2.paf -a HG008T_v3.2,GRCh38_GIABv3 --out $OUT --load copy
```

The `-c` flag asks minimap2 to emit base-level CIGAR strings, which encode the
position of insertions and deletions. The `-x asm5` preset sets parameters for
same-species assembly-to-assembly alignment. `add-track -a` takes the assemblies
as `query,target`, the reverse of the `minimap2` argument order
(`minimap2 target query`): minimap2 is given
`GRCh38_GIABv3.fa HG008T_v3.2.fasta` (target then query), so the track loads
with `-a HG008T_v3.2,GRCh38_GIABv3` (query then target). The matched normal
assembly (`HG008N_v6.3.fasta.gz`, same S3 path) loads the same way. See the
[synteny track config guide](/docs/config_guides/synteny_track) and the
[linear synteny view guide](/docs/user_guides/linear_synteny_view).

## Reproduce it end to end

[`build_sv_visualization_cgiab.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_sv_visualization_cgiab.sh)
runs the whole data-preparation pipeline above in one shot:

```bash
bash scripts/build_sv_visualization_cgiab.sh   # builds ./cgiab_build/jbrowse2
npx --yes serve cgiab_build/jbrowse2
```

It grabs the C-GIAB GRCh38 build and the V0.5 HG008-T benchmark calls, turns the
tumor and normal HiFi BAMs into CRAMs, computes megadepth coverage, calls copy
number with HiFiCNV, and loads the published Wakhan haplotype-specific segments.
It also aligns the T2T tumor assembly to GRCh38 with minimap2 for the synteny
and dotplot views, then downloads JBrowse and writes a `config.json` with
everything loaded.

You will need `samtools`, `tabix`, `megadepth`, `hificnv`, `minimap2`, and
`node`. Be warned that it pulls down more than 200 GB, wants roughly 1.5 TB of
free disk and 32 GB of RAM, and the alignment and copy-number steps take hours.

## Walkthroughs

Once your JBrowse 2 instance is live, we can explore the loaded data three
complementary ways: the SV inspector for whole-genome triage, the linear genome
view for read-level detail and copy number, and the dotplot/synteny views for
chromosome-scale rearrangements in the assembly.

A
[live demo](https://jbrowse.org/code/jb2/latest/?config=/demos/cgiab/config.json)
with all tracks pre-loaded is available to follow along without a local
instance.

### Walkthrough: a chr3–chr13 translocation

Open `http://yourhost.com/jbrowse2/` (or the live demo linked above) in a web
browser. From the start screen, launch the SV inspector, then use **Open from
track** to pick the C-GIAB benchmark VCF you loaded earlier. The result is a
combined data table and circular overview of the SV calls.

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

For small to medium SVs, the linear genome view is usually all we need. We use
the **search** (magnifying glass) button in the SV inspector to find a specific
call, for example `SV_85`, a heterozygous deletion that affects two exons of the
CUZD1 gene.

<Figure caption="The SV inspector after searching for SV_85, a heterozygous CUZD1 deletion. The SVTYPE column reports a DEL. Clicking the row's location link opens it in the linear genome view below, drawn as the <DEL> ALT allele above the NCBI RefSeq gene track." src="/img/sv_cgiab/deletion_sv_inspector_search.png" />

Opening the gene annotations and the tumor PacBio HiFi reads, switching the
reads to **compact** mode and applying **Sort by base pair** (both from the
track menu) with the deletion centered shows the deletion (enabling the **center
line** from the view menu is helpful for aligning the breakpoint precisely under
the center of the view).

<Figure caption="After opening the gene annotations and tumor PacBio HiFi reads, displaying reads in compact mode, and sorting by base pair with the deletion in the center. The deletion removes two CUZD1 exons and is heterozygous." src="/img/sv_cgiab/deletion_linear_view.png" />

For background on SV signals in the alignments track, see the
[SV visualization guide](/docs/user_guides/sv_visualization).

### Walkthrough: reading copy number

Whole-genome coverage stored as a bigWig is fast at any zoom level, so the
quickest copy-number check is to open the tumor and normal coverage bigWigs as a
single multi-bigwig track. From the linear genome view start screen, click
**Show all regions in assembly** to open every chromosome at once. Apply a
manual **min/max score** cap from the track menu (a few centromere and repeat
spikes otherwise compress the copy-number signal), then switch to **overlapping
scatter** so the two samples plot as points in one band (tumor red, normal
blue). Zoom to a region and open the benchmark CNV BED track to check that
coverage changes line up with the called intervals.

<Figure caption="The linear genome view start screen: click Show all regions in assembly to lay out every chromosome across the view." src="/img/sv_cgiab/cnv_show_all_regions.png" />

<Figure caption="A multi-bigwig track with tumor (red) and normal (blue) coverage zoomed to chromosome 5, in overlapping-scatter rendering, above the benchmark CNV BED track. Orange boxes mark individual CNVs (clicking one shows its feature details), and coverage drops and gains line up with the called intervals below." src="/img/sv_cgiab/cnv_with_bed_track.png" />

Raw coverage is only a sanity check on existing calls. For a signal that reads
directly as copy number, use the depth, BAF, and copy-number tracks built above.
Four loci in HG008-T each carry a different copy-number state, so together they
make a compact tour of how depth, BAF, and the benchmark CNV calls read against
one another:

| Locus  | State in HG008-T                 | Signature on the tracks             |
| ------ | -------------------------------- | ----------------------------------- |
| CDKN2A | Focal homozygous deletion (CN 0) | depth to 0, copy number 0           |
| TP53   | 17p loss + LOH (CN 1, 1+0)       | depth halved, BAF splits to 0 and 1 |
| SMAD4  | 18q loss + LOH (CN 1, 0+1)       | depth halved, BAF splits to 0 and 1 |
| KRAS   | Allelic gain (CN 3, 2+1)         | depth raised, BAF to 1/3 and 2/3    |

The BAF column is why the unfolded track earns its place: each copy-number state
has its own band pattern, and the bands are symmetric about 0.5. A balanced
region is one band at 0.5, a single-copy loss splits to 0 and 1, and a CN 3 gain
sits at 1/3 and 2/3 because one of the three copies carries the B allele (or two
of three do). Folding the track onto 0 to 0.5 collapses each of those pairs onto
one line and throws that away.

#### CDKN2A: a homozygous deletion vs a single-copy loss

Navigate to `CDKN2A` on chr9. The benchmark calls a focal ~20 kb homozygous
deletion (`SV_75`, total copy number 0) over the gene. A homozygous deletion
removes both parental copies, so depth goes to ~0 and HiFiCNV's copy number
drops to 0; a single-copy loss only halves depth. This deletion sits within a
larger single-copy-loss arm (`CNA_14`, 0+1), so it reads as a deeper notch in an
already-reduced baseline.

HiFiCNV's depth is binned, so for the exact breakpoints open the PacBio HiFi
read pileup: both depth and the pileup drop to zero right at the deletion's
edges, matching the benchmark call.

<Figure caption="The CDKN2A deletion on chr9, top to bottom: NCBI RefSeq genes (longest coding transcript), the HiFiCNV depth track, the PacBio HiFi read pileup at super-compact read height, and the benchmark CNV calls. Depth and the pileup both drop to 0 at the deletion's edges; the few thin lines crossing the gap are single reads carrying the deletion as one long gap in their alignment." src="/img/sv_cgiab/driver_cdkn2a_deletion.png" />

Nothing above proves the deletion is _somatic_. A homozygous drop-out looks the
same whether it was acquired by the tumor or inherited, and the answer is in the
matched normal: load the tumor and normal coverage tracks together over the same
locus. Pin both to the same score range, since the whole point is one track's
height read against the other's, and independent autoscaling would rescale the
normal to fill its row and destroy the comparison.

<Figure caption="The same CDKN2A locus with the matched normal underneath: NCBI RefSeq genes, HG008-T per-base coverage, HG008-N coverage, and the benchmark CNV calls. Both coverage tracks share a fixed 0 to 80 range. The tumor floors at 0 across the deletion while the normal runs flat through it, which is what makes the event somatic rather than inherited." src="/img/sv_cgiab/cdkn2a_tumor_normal_coverage.png" />

#### chr17: loss-with-LOH vs copy-neutral LOH

Chromosome 17 shows why the BAF track is read alongside depth. Open the whole
chromosome with the depth track above the BAF:

- the p-arm (covering `TP53`) is a single-copy loss with LOH (`CNA_20`, CN 1,
  1+0): depth is halved and the BAF splits away from 0.5.
- the q-arm is copy-neutral LOH (`CNA_21`, CN 2, 2+0): one parental haplotype
  was lost and the other duplicated, so total copy number is still 2 and depth
  stays flat, yet the BAF still splits away from 0.5.

The q-arm event is invisible to depth alone. Only the BAF reveals it, which is
why the two are read together.

<Figure caption="Chromosome 17 with the HiFiCNV depth track (top) over the BAF track (middle) over the benchmark CNV calls. The p-arm (covering TP53) is a single-copy loss with LOH (CNA_20, CN 1, 1+0): depth halved, BAF split to 0 and 1. The q-arm is copy-neutral LOH (CNA_21, CN 2, 2+0): depth flat, yet the BAF is still split, invisible to depth alone." src="/img/sv_cgiab/cnv_chr17_loh.png" />

The depth and BAF combinations read as a compact decision table:

| depth       | BAF             | Interpretation            |
| ----------- | --------------- | ------------------------- |
| flat (CN 2) | one band at 0.5 | balanced diploid          |
| flat (CN 2) | split to 0, 1   | copy-neutral LOH          |
| halved      | split to 0, 1   | single-copy loss with LOH |
| raised      | 1/3 and 2/3     | allelic gain              |

The benchmark BED's per-haplotype columns (`hap1_copy_number`,
`hap2_copy_number`) encode this allelic state: any segment with a `0` haplotype
(e.g. `1+0`, `2+0`) has lost one parental allele and its BAF splits away from
0.5, regardless of its total copy number. Clicking a CNV feature shows these
values in the feature details, so you can confirm the allelic call against the
BAF track directly.

#### KRAS and SMAD4

The same reading covers the other two loci. `KRAS` on chr12 is a low-level gain
(`SV_101`, CN 3, 2+1): depth is raised and the MAF shifts only modestly off 0.5,
the partial imbalance a 2+1 gain produces rather than the full drop of a
complete haplotype loss.

<Figure caption="KRAS on chr12: the HiFiCNV depth track over the MAF track over the CNV calls. The gain (SV_101, CN 3, 2+1) reads as raised depth and an MAF that shifts only modestly off 0.5, the partial imbalance of a 2+1 gain." src="/img/sv_cgiab/driver_kras_gain.png" />

`SMAD4` on 18q is lost with LOH (`CNA_48`, CN 1, 0+1), the mirror image of the
TP53 event, though more muted than the chr17 example.

<Figure caption="Chromosome 18: the HiFiCNV depth track over the MAF track over the CNV calls. CNA_48 (single-copy loss with LOH over SMAD4) spans most of the chromosome but reads as only a modest depth dip and a sparse MAF shift off 0.5." src="/img/sv_cgiab/driver_smad4_loh.png" />

See also the
[multi-quantitative track guide](/docs/user_guides/multiquantitative_track) for
comparing tumor and normal coverage.

### Walkthrough: synteny and dotplot views of the tumor assembly

Showing the tumor assembly side-by-side with the reference can make complex SVs
easier to read than the alignment track alone. We open a dotplot view from the
start screen, set the de novo assembly as one axis and GRCh38 as the other, and
pick the matching synteny track.

<Figure caption="The dotplot import form, with the HG008-T v3.2 assembly on one axis and GRCh38 on the other." src="/img/sv_cgiab/dotplot_import_form.png" />

The resulting dotplot is a whole-genome overview of the assembly aligned to
GRCh38: each contig's alignments run as diagonal segments, and it is the launch
point for drilling into a region of interest. Drag over a region and open a
linear synteny view (below), where a specific rearrangement becomes legible at
base level.

HG008-T v3.2 is haplotype-resolved, so its scaffold names end in `_hap1` or
`_hap2` and a single plot stacks both haplotypes on one axis — every GRCh38
chromosome gets two counterparts and the diagonal doubles. Restrict the y axis
to one haplotype at a time and each plot reads as a plain assembly-vs-reference
diagonal.

<Figure caption="Haplotype 1 of HG008-T v3.2 (y) against GRCh38 chromosomes (x). Each scaffold is one diagonal segment; scaffolds named for two chromosomes (chr3_chr13_hap1) break into two, which is the translocation." src="/img/sv_cgiab/dotplot_hap1.png" />

<Figure caption="The same plot for haplotype 2. chr13_hap2 carries a single clean diagonal against chr13 — the untranslocated counterpart to hap1's fused scaffold." src="/img/sv_cgiab/dotplot_hap2.png" />

Use **Open linear synteny view** from the drag selection, then enter
`chr3 chr13` in the GRCh38 search box to focus on those chromosomes. Raising the
**minimum alignment length** (in the synteny view's menu) drops short, noisy
anchors so the large syntenic blocks read clearly.

<Figure caption="A synteny view launched by selecting the chr3/chr13 region in the dotplot. Base-level alignment makes the breakpoints easy to read. The minimum alignment length was raised (to ~50kb) to drop short, noisy anchors so the large syntenic blocks read clearly." src="/img/sv_cgiab/synteny_view.png" />

For more on these views, see the
[dotplot view guide](/docs/user_guides/dotplot_view) and the
[linear synteny view guide](/docs/user_guides/linear_synteny_view).

## Troubleshooting

| Problem                                                             | Possible cause                                                     | Solution                                                                                                                                                              |
| ------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The browser stalls when viewing SV regions                          | Too large a region is being loaded with full alignment data        | Use the **Force Load** option with care, downsample very high-depth data, or pre-filter to informative reads (e.g. discordant pairs, split reads with the `SA` tag)   |
| The view is blank, or every position looks like a SNP               | Data was aligned to a different reference than the loaded assembly | Make sure the BAM/CRAM/VCF were aligned against the same FASTA loaded into JBrowse                                                                                    |
| The synteny or dotplot view is blank                                | The assembly arguments to `add-track -a` are flipped               | If you ran `minimap2 ref.fa query.fa > out.paf`, then load with `jbrowse add-track -a query,ref`. The order matters                                                   |
| Errors involving Node.js, or the wrong Node.js version is installed | The apt repository ships an older Node.js                          | Run `sudo apt-get purge -y nodejs npm`, then install from [nodejs.org](https://nodejs.org/en/download) or [NodeSource](https://nodesource.com/products/distributions) |

If you hit a problem not covered above, please file an issue on the
[JBrowse 2 GitHub repository](https://github.com/GMOD/jbrowse-components/issues).

## Next steps

Now that you've explored the C-GIAB HG008 dataset, you can:

- Load your own SV data by replacing the C-GIAB VCF and BAM files with your own
  calls and sequencing data.
- Customize track displays with different color schemes (pair orientation,
  insert size), read filtering (discordant pairs, soft-clipped), and display
  modes (pileup, read arc, linked reads) to find the visualization that best
  highlights your findings.

For more on customizing JBrowse 2, see the
[SV visualization guide](/docs/user_guides/sv_visualization).

## See also

- [Synteny visualization](/docs/tutorials/synteny_visualization) - the same
  dotplot/synteny views, worked with bacterial genome assemblies
- [SV visualization](/docs/user_guides/sv_visualization) - reference for the SV
  display types and read-signal patterns used throughout
- [SV inspector view](/docs/user_guides/sv_inspector_view) - the SV inspector
  workflow used in the translocation and CUZD1 walkthroughs
- [Multi-quantitative track](/docs/user_guides/multiquantitative_track) -
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
