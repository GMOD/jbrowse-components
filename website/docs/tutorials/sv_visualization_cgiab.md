---
title: Structural variants (Cancer GIAB)
sidebar_label: SVs (Cancer GIAB)
description:
  Build a tumor/normal HiFi site from raw reads, and read its benchmark SV and
  CNV calls against the alignments that support them
guide_category: Tutorials
tutorial_category: Cancer genomics
data: pipeline
---

**TL;DR:** the Cancer Genome in a Bottle project publishes HG008, a matched
tumor/normal PDAC cell line, as PacBio HiFi reads, a draft SV and CNV benchmark,
and a telomere-to-telomere assembly of the tumor. Load them as tracks and read
each benchmark call against the alignments and the copy number under it, in a
tumor genome that is hypodiploid, so the depth baseline is not two.

## Prerequisites

- A machine with HTTP access, either a public URL or `http://localhost`
- Approximately 1 TB of free disk space to build the tracks from the raw reads,
  or ~1.5 TB to run the full reproduce pipeline below (the BAM/CRAM files are
  large)
- At least 32 GB of RAM for the minimap2 alignment step. Only data preparation
  needs it; a 2 GB instance hosts the finished site.
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

## The C-GIAB dataset

[Cancer Genome in a Bottle (C-GIAB)](https://www.nist.gov/programs-projects/cancer-genome-bottle)
publishes HG008, a pancreatic ductal adenocarcinoma (PDAC) cell line with
matched tumor (HG008-T) and normal pancreatic tissue (HG008-N-P) sequenced with
PacBio HiFi long reads, plus a near-complete telomere-to-telomere de novo
assembly of the tumor genome.

HG008-T is **hypodiploid**: its assembly recapitulates 35 tumor chromosomes
rather than 46, with widespread arm-level loss and 16 truncal interchromosomal
rearrangements
([Wagner et al. 2026](https://doi.org/10.64898/2026.05.01.722316)). That matters
for every copy-number figure below, since the middle of a depth track is not
copy number 2 here and a balanced region is the exception. The benchmark CNV BED
reports absolute copy number per interval, so it is what every other track gets
read against.

For the full call sets, auxiliary assays and methods, see the
[NIST C-GIAB page](https://www.nist.gov/programs-projects/cancer-genome-bottle)
and [McDaniel et al. 2025](https://doi.org/10.1038/s41597-025-05438-2). The
[SV visualization guide](/docs/user_guides/sv_visualization) and the
[SV inspector guide](/docs/user_guides/sv_inspector_view) cover the concepts;
this page is the data-loading workflow and a few worked examples.

## Setting up

The instance itself is the [web quickstart](/docs/quickstart_web) unchanged. Two
of the prerequisites are release binaries rather than apt packages:

```bash
wget https://github.com/ChristopherWilks/megadepth/releases/download/1.2.0/megadepth
chmod +x megadepth && sudo mv megadepth /usr/local/bin/
curl -L https://github.com/PacificBiosciences/HiFiCNV/releases/download/v1.0.1/hificnv-v1.0.1-x86_64-unknown-linux-gnu.tar.gz \
  | tar xz --strip-components=1 -C /usr/local/bin --wildcards '*/hificnv'
```

The assembly is the C-GIAB build of GRCh38, with decoys and several masked
regions. The build does not matter to the visualization, but the same one has to
be used when converting the BAMs to CRAM below, or every position reads as a
mismatch.

[Reproduce it end to end](#reproduce-it-end-to-end) fetches that reference and
every file below. What follows is the part that is track config rather than data
preparation.

## The benchmark SV and CNV calls

The V0.5 HG008-T draft benchmark SV calls (VCF) and CNV calls (BED) load as
remote URL tracks, with nothing downloaded.

The CNV BED ships without a header, so its columns beyond `chrom/start/end` load
unnamed. Rather than editing the file, name them on the adapter with the
[`columnNames`](/docs/config/bedadapter/#slot-columnnames) slot:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "hg008t_somatic_cnv",
  "name": "HG008-T somatic CNV",
  "assemblyNames": ["GRCh38_GIABv3"],
  "adapter": {
    "type": "BedAdapter",
    "uri": "https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/NIST_HG008-T_somatic-stvar-CNV_DraftBenchmark_V0.5-20260318/GRCh38_HG008-T-V0.5_somatic-CNV_PASS.draftbenchmark.calls.bed",
    "columnNames": [
      "chrom",
      "start",
      "end",
      "total_copy_number",
      "hap1_copy_number",
      "hap2_copy_number",
      "name"
    ]
  }
}
```

## The reads and their coverage

The tumor and normal BAMs at the C-GIAB FTP are large and slow to access
remotely, and lack `MD` tags, which JBrowse uses to display SNP positions
without re-fetching the reference. The build script pulls each one through
`samtools view` into a local CRAM against the reference above and runs
`megadepth --bigwig` over it, so every read-level figure below is a local CRAM
with a whole-genome coverage bigWig beside it.

## Add copy-number tracks from a somatic CNV caller

The coverage bigWigs above are raw depth, so copy-number changes have to be read
by eye. A somatic CNV caller turns that depth into the standard two-panel view:
a copy-number track, and a B-allele / minor-allele frequency track that
separates loss-of-heterozygosity from balanced regions. Run the caller that
matches your reads; each writes files that load straight into JBrowse.

### PacBio HiFi: HiFiCNV

The reads here are PacBio HiFi, so copy number is called with
[HiFiCNV](https://github.com/PacificBiosciences/HiFiCNV), PacBio's somatic CNV
caller. Given the tumor alignment, the reference, and a small-variant VCF whose
allele depths drive the allele-frequency track, it writes a depth bigWig, a
minor-allele-frequency (MAF) bigWig, an integer copy-number bedGraph, and a CNV
VCF.

The `--maf` VCF has to hold the tumor's calls rather than the matched normal's.
HiFiCNV reads the `AD` field out of it and never looks at `--bam`, so a germline
VCF from the normal produces a track sitting near 0.5 everywhere, including
across arms that have lost a copy. It affects that track alone: the depth bigWig
comes from the BAM, and the `copynum` bedGraph is byte-identical either way. The
script passes the Clair3 tumor calls published alongside C-GIAB's own Wakhan CNA
run.

HiFiCNV writes `hificnv.<sample>.depth.bw`, `.maf.bw`, `.copynum.bedgraph` and
`.vcf.gz`; the depth track is named for the `--bam` sample and the maf track for
the `--maf` VCF's sample column, so the two file names differ.

Plot the depth bigWig with the **scatter** rendering. The `copynum` bedGraph
carries HiFiCNV's segmented integer copy number and the CNV VCF its discrete
calls. Read them against the benchmark CNV BED, which holds the absolute copy
number for each interval.

#### A segmented copy ratio beside the depth

Depth is a read count per bin, so a whole-chromosome view is a cloud hundreds of
points deep and a copy-number step is wherever its centre moves. The segmented
form is easier to read and needs no computing here: C-GIAB publishes the New
York Genome Center's somatic pipeline run on this exact tumor/normal pair, and
its [BIC-seq2](https://doi.org/10.1073/pnas.1110574108) output is one log2
tumor-versus-normal copy ratio per segment. It reshapes into a bedGraph in one
`awk` line, and a whole-genome segmentation needs no index.

Plot it as a **line (step)** over a fixed range, which keeps a homozygous
deletion (no reads, so no finite ratio) from setting the axis for the whole
chromosome. The balanced baseline sits above zero because BIC-seq2 normalizes on
total read counts and this genome is hypodiploid; it is shown as published, and
it is the steps that get read against the benchmark's absolute copy numbers.

The allelic panel here is **B-allele frequency** rather than HiFiCNV's own
`maf.bw`, which folds to `min(AF, 1-AF)` so a region that has lost one parental
copy collapses onto a single band near 0. Unfolded BAF keeps the two apart: a
balanced region is one band at 0.5, a loss-of-heterozygosity region two bands at
0 and 1. Build it by piling up the tumor reads at the sites the **normal** calls
heterozygous and taking the alt fraction:

<!-- from: scripts/build_sv_visualization_cgiab.sh -->

```bash
# het sites from the NORMAL, which is the choice the whole track rests on
bcftools view -g het -Oz -o hets.vcf.gz normal.deepvariant.vcf.gz
tabix -p vcf hets.vcf.gz
cut -f1,2 GRCh38.fa.fai > GRCh38.chrom.sizes

# -q 1 drops multi-mapped reads, -Q 0 leaves HiFi base qualities alone
bcftools mpileup -f GRCh38.fa -T hets.vcf.gz -a AD -q 1 -Q 0 tumor.bam |
  bcftools query -f '%CHROM\t%POS\t[%AD]\n' |
  # unfolded alt fraction, so LOH separates into 0 and 1 instead of folding
  # onto one band; the 10x floor keeps thin coverage from painting a fake 0/1
  awk -F'[\t,]' '{d=$3+$4; if (d>=10) printf "%s\t%d\t%d\t%.4f\n",$1,$2-1,$2,$4/d}' |
  LC_COLLATE=C sort -k1,1 -k2,2n > baf.bedgraph
bedGraphToBigWig baf.bedgraph GRCh38.chrom.sizes tumor_baf.bw
```

The germline het list is what makes a site informative, and taking it from the
normal rather than the tumor is the whole point: an LOH site is homozygous in
the tumor, so a tumor-derived list drops exactly the sites the track exists to
show. `-q 1` drops multi-mapped reads, `-Q 0` keeps HiFi base qualities as they
are, and the 10x floor stops a thin-coverage site painting a spurious 0 or 1.
Plot it with **scatter** over a fixed 0 to 1 range, since the spread is the
entire signal and a line rendering would average the two LOH bands back to 0.5.

<Figure caption="Chromosome 3 over the benchmark CNV calls: BIC-seq2's segmented log2 copy ratio, the HiFiCNV depth it summarizes, and B-allele frequency. The p-arm is a single-copy loss with loss-of-heterozygosity; the q-arm is balanced." src="/img/sv_cgiab/cnv_depth_baf.png" />

#### Keep the BAF track off bigWig summaries

A bigWig carries precomputed zoom levels, and each zoomed bin holds only a
minimum, an average and a maximum. That is a fair summary of read depth and a
meaningless one for BAF, which is a _distribution_: every bin over an LOH arm
comes back as minimum 0, maximum 1 and an average that wanders. The default
[`summaryScoreMode`](/docs/config/linearwiggledisplay/#slot-summaryscoremode) of
`whiskers` draws all three, so the split this track exists to show paints as a
solid full-height wash.

Fix it on the adapter, not the display, with
[`resolutionMultiplier`](/docs/config/bigwigadapter/#slot-resolutionmultiplier).
It scales the bases-per-bin the adapter asks for, and a small enough value keeps
the fetch on the raw per-site values at the zoom levels these figures use:

```json
{
  "type": "QuantitativeTrack",
  "trackId": "HG008-T_baf",
  "name": "HG008-T B-allele frequency (BAF)",
  "assemblyNames": ["GRCh38_GIABv3"],
  "adapter": {
    "type": "BigWigAdapter",
    "uri": "HG008-T_baf.bcftools.bw",
    "resolutionMultiplier": 0.001
  },
  "displayDefaults": {
    "defaultRendering": "scatter",
    "scatterPointSize": 1,
    "minScore": 0,
    "maxScore": 1
  }
}
```

Raw het sites are cheap here: a whole chromosome is well under two megabytes,
because the track only carries one value per heterozygous site rather than one
per base. Whole-genome view still falls back to the summary, which is what the
per-haplotype segment track below is for.

**Resolution → Finer** in the track menu is the same control interactively.
Reach for it whenever a scatter track looks like a filled band rather than a
cloud of points.

### Illumina short reads: DRAGEN or CNVkit

Most somatic sequencing is short-read, so if your reads are Illumina, call CNVs
with a short-read tool instead. C-GIAB runs
[DRAGEN](https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/DRAGEN-v4.2.4_ILMN-WGS_20240312/)
(see its `README_DRAGEN_20240312.md`) and publishes the somatic CNV VCF, which
loads with no local compute:

```bash
jbrowse add-track https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/DRAGEN-v4.2.4_ILMN-WGS_20240312/standard/dragen_4.2.4_HG008-mosaic_tumor.cnv.vcf.gz \
  --category "CNV"
```

[CNVkit](https://github.com/etal/cnvkit) is an open-source alternative; its
`.cnr`/`.cns` outputs export to bigWig/BED for the same depth-and-segment view.

### Haplotype-specific copy number: Wakhan

Both callers above fold the two parental alleles into one frequency, so at
whole-genome zoom an LOH block averages back toward balanced.
[Wakhan](https://github.com/KolmogorovLab/Wakhan) phases the germline
heterozygous SNPs and reports copy number _per haplotype_ instead, keeping the
LOH signal clean. C-GIAB publishes Wakhan output for HG008-T, and both
`HG008_HiFi_loh_segments.bed` and `HG008_HiFi_copynumbers_segments.bed` load
from their FTP URLs with nothing to recompute.

The copy-number file is worth a few more lines of config than `add-track`
writes. It is long format, one row per haplotype:

```
#chr	start	end	copynumber_state	coverage	haplotype
chr1	50001	23300000	2	108.025	1
chr1	23300001	121600000	1	55.025	1
```

Its last `#` line is tab-separated, so the adapter picks the column names up on
its own with no [`columnNames`](/docs/config/bedadapter/#slot-columnnames)
needed. Because a haplotype column already assigns each segment to a row, this
is a [`LinearMultiRowFeatureDisplay`](/docs/config/linearmultirowfeaturedisplay)
track: set
[`partitionField`](/docs/config/linearmultirowfeaturedisplay/#slot-partitionfield)
to `haplotype` and it paints one row per parental copy.

```json
{
  "type": "FeatureTrack",
  "trackId": "hg008_wakhan_haplotype",
  "name": "HG008-T Wakhan copy number per haplotype",
  "assemblyNames": ["GRCh38_GIABv3"],
  "adapter": {
    "type": "BedAdapter",
    "uri": "https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/Liss_lab/analysis/NIH_HiFi_Wakhan-CNA_20240308/bed_output/HG008_HiFi_copynumbers_segments.bed"
  },
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "displayId": "hg008_wakhan_haplotype-LinearMultiRowFeatureDisplay",
      "partitionField": "haplotype",
      "color": "jexl:get(feature,'copynumber_state')<0.5?'#2166ac':get(feature,'copynumber_state')<1.5?'#bdbdbd':'#f4a582'",
      "legend": [
        { "label": "Haplotype lost (0)", "color": "#2166ac" },
        { "label": "One copy", "color": "#bdbdbd" },
        { "label": "Two or more copies", "color": "#f4a582" }
      ]
    }
  ]
}
```

`copynumber_state` is one parental copy rather than the total, so `1` is the
expected state and a `0` row is the lost haplotype that makes an arm LOH. Wakhan
emits fractional states for segments that are not clonal, so bucket the color
rather than matching integers exactly. This is the BAF track's information as
segments rather than a point cloud, so it reads the same at every zoom and is
the better whole-genome overview. `coverage` is Wakhan's median depth for the
segment, where the per-copy depth scale can be read directly.

### Subclonal copy number

The tracks above average over every tumor cell, so a change carried by only part
of the tumor reads as a muted, intermediate signal. This line carries that
mixture: karyotyping across passages finds the arm-level losses shared by nearly
all cells but the genome-doubled fraction of the population growing between
early and late passage, so ploidy is mixed
([Wagner et al. 2026](https://doi.org/10.64898/2026.05.01.722316)).

C-GIAB publishes short-read WGS for a panel of HG008-T single-cell-derived
clones (one colony grown from a single tumor cell, so each reports one
subclone's copy number) under
[`HG008-T_clones/`](https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data_somatic/HG008/NIST/HG008-T_clones/).
Call per-clone copy number with a short-read caller (DRAGEN or CNVkit) and load
the clones as rows of one `MultiQuantitativeTrack`, the same track type as the
[single-cell ATAC tutorial](/docs/tutorials/scatac_pseudobulk). A row that
departs from the rest marks a CNV private to that subclone.

Read those integers as the caller's own scale rather than as absolute copy
number: CNVkit centers each sample's log2 on that sample's own median, so on a
hypodiploid genome the balanced state is not the one labeled CN 2. Keep the
benchmark CNV track, whose `total_copy_number` is absolute, in the same view to
anchor it. For purity- and ploidy-aware absolute copy number, run a caller built
for it such as [PURPLE](https://github.com/hartwigmedical/hmftools) and load its
segments the same way.

## Align the tumor assembly to GRCh38

The C-GIAB project provides a near-complete telomere-to-telomere de novo
assembly of HG008-T
([Wagner et al. 2026](https://doi.org/10.64898/2026.05.01.722316)),
haplotype-resolved into T2T scaffolds. The build script loads it as a second
JBrowse assembly and aligns it to GRCh38 with `minimap2 -cx asm5`, giving a PAF
that JBrowse renders in the synteny and dotplot views. Those are particularly
helpful for complex SVs that are hard to read off the alignment track.

One argument order is worth stating, because getting it wrong draws an empty
view: `add-track -a` takes the assemblies as `query,target`, the reverse of
minimap2's `target query`. An alignment run as
`minimap2 GRCh38_GIABv3.fa HG008T_v3.2.fasta` therefore loads with
`-a HG008T_v3.2,GRCh38_GIABv3`. The matched normal assembly
(`HG008N_v6.3.fasta.gz`, same S3 path) loads the same way. See the
[synteny track config guide](/docs/config_guides/synteny_track) and the
[linear synteny view guide](/docs/user_guides/linear_synteny_view).

## Walkthroughs

Once your JBrowse 2 instance is live, the loaded data reads three complementary
ways: the SV inspector for whole-genome triage, the linear genome view for
read-level detail and copy number, and the dotplot/synteny views for
chromosome-scale rearrangements in the assembly.

### Walkthrough: a chr3-chr13 translocation

**Add → SV inspector**, then **Open from track** to pick the C-GIAB benchmark
VCF loaded earlier.

<Figure caption="The SV inspector showing the benchmark VCF as a circular overview alongside a table of calls." src="/img/sv_cgiab/translocation_sv_inspector_view.png" />

Clicking the chord that connects chr3 and chr13 launches a breakpoint split
view. Opening the tumor PacBio HiFi reads on each panel and setting **Read
height** → **Compact** highlights the supporting split reads as black splines
connecting the two chromosomes.

<Figure caption="Clicking the chord joining chr3 and chr13 opens a breakpoint split view. Black splines connect tumor PacBio HiFi reads that partially map to each chromosome, suggesting a fusion or translocation." src="/img/sv_cgiab/translocation_breakpoint_split.png" />

That chord is one breakend of a larger event. The V0.5 benchmark tags `SV_20`
with `EVENTTYPE=CHROMOPLEXY` and files it under `EVENT=cluster_3` with its mate
on chr13 and two further breakends on chr3. Interchromosomal translocations in
HG008 are frequently complex this way
([Wagner et al. 2026](https://doi.org/10.64898/2026.05.01.722316)), which is why
the assembly views below are worth reaching for once a chord has said where to
look.

For the SV inspector workflow itself (filtering the table, search, configuring
the circular overview), see the
[SV inspector guide](/docs/user_guides/sv_inspector_view).

### Walkthrough: the same junction three ways

The chord says where to look. Three things in this instance say what is there,
and none of them is derived from the others.

**The caller.** `SV_20` and `SV_190` are one junction written twice, joining
chr3:139,976,414 to chr13:114,353,244. A BND record names one partner, so on its
own each describes a translocation and nothing more. The `EVENT` field is what
says otherwise: the benchmark files both under `cluster_3` alongside two further
breakends and tags them `EVENTTYPE=CHROMOPLEXY`. A caller can group junctions
into an event because it sees the whole callset at once. It cannot say which
molecule carries them.

**The reads.** Put both breakpoint loci on screen and, from the tumor PacBio
HiFi track's menu, choose **Launch view → Reconstruct derivative allele...**.
The reads in the window are grouped by the route their split alignments
describe, each offered with the number of reads that independently take it. The
top route runs chr13 forward into the junction and then down chr3 inverted, the
orientation the black splines above draw. The matched normal is the control and
a track away: the tumor reads split at this position, the normal reads read
through it.

<Figure caption="Reconstruct derivative allele over both breakpoint loci of the tumor PacBio HiFi track. The top route, chr13 forward then chr3 inverted, is the junction the benchmark and the tumor assembly both name." src="/img/sv_cgiab/three_ways.png" />

**The assembly.** The synteny track loaded earlier says the same thing from no
reads at all. The C-GIAB assembly resolves both loci onto a single tumor contig,
and named that contig for the two chromosomes it fuses. Its chr13 arm ends at
the chr13 breakend above and its chr3 arm begins at the chr3 one, abutting at a
single base of contig coordinate, with the same orientation flip the reads
describe. Open it in the synteny or dotplot view against GRCh38 and the junction
is the point where one contig stops following chr13 and starts following chr3.

Reading the list below the top route is the other half of the exercise. This
window ends at the chr13 q-terminus, so most of what is offered under the real
junction is reads mismapped into the terminal repeats of other chromosomes, each
a confident-looking two-segment route with a real read count behind it. The read
count ranks the routes rather than vouching for them; what vouches for this one
is that the caller and the assembly put its two ends in the same two places.

The reconstruction is bounded twice by what is loaded. It is assembled from the
reads in the **displayed regions**, so a locus not on screen contributes no
route however plainly its reads describe one, which is why both sides of this
junction are open above. And the hosted demo slices the tumor reads to the loci
these walkthroughs visit, so the reads reach one of `cluster_3`'s junctions
where the assembly contig carries both. Rebuilding from the full BAM with
[the build script](#reproduce-it-end-to-end) lifts that limit.

### Which of these calls are drivers

Most somatic calls in a tumour genome are passengers: real events, carried along
by the cell lineage, with no role in the cancer. A handful are drivers. In
pancreatic ductal adenocarcinoma the recurrently altered genes are `KRAS`,
`CDKN2A`, `TP53` and `SMAD4`
([Waddell et al. 2015](https://doi.org/10.1038/nature14169),
[Bailey et al. 2016](https://doi.org/10.1038/nature16965)), and the copy-number
walkthroughs below visit all four in this genome.

Nothing in the browser marks that distinction: the benchmark BED states copy
number and haplotype rather than consequence, and neither does the gene track.
The somatic driver catalogues that would answer it as a lane (COSMIC's Cancer
Gene Census among them) are licensed rather than redistributable, so a public
demo cannot carry one. Each copy-number figure below instead draws one MANE
Select transcript under the lanes, so the event and the gene it covers are read
off the same axis.

### Walkthrough: a small deletion in CUZD1

For small to medium SVs the linear genome view is usually enough. Use the
**search** (magnifying glass) button in the SV inspector to find a specific
call, for example `SV_85`, a heterozygous deletion that affects two exons of the
CUZD1 gene.

_CUZD1_ is a passenger here: a pancreatic acinar protein predicted to act in
trypsinogen activation
([NCBI Gene 50624](https://www.ncbi.nlm.nih.gov/gene/50624)), not one of the
four PDAC genes above, with one heterozygous copy remaining. It makes a good
first example because a ~1.8 kb deletion over two exons is small enough to read
base by base and large enough to see in a pileup.

A public catalogue puts that in a lane. **ClinVar CNVs** carries the submitted
copy-number variants with their clinical significance. Add it from UCSC:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "hg38_clinvar_cnv_ucsc",
  "name": "ClinVar CNVs (UCSC)",
  "assemblyNames": ["GRCh38_GIABv3"],
  "adapter": {
    "type": "BigBedAdapter",
    "uri": "https://hgdownload.soe.ucsc.edu/gbdb/hg38/bbi/clinvar/clinvarCnv.bb"
  },
  "displayDefaults": {
    "jexlFilters": ["get(feature,'_varLen') < 50000"],
    "displayMode": "compact"
  }
}
```

The size filter is what makes the lane readable: ClinVar holds chromosome-scale
records that merely contain a 1.8 kb event, so unfiltered the lane is one bar
edge to edge. `_varLen` is the catalogue's own length field, and filtering on it
keeps the records at this event's scale.

The lane is then empty over this locus, which is the reading: no submitted
ClinVar CNV at anything like this deletion's size covers it.

<Figure caption="The SV inspector after searching for SV_85, a heterozygous CUZD1 deletion, and the linear genome view its location link opens: the <DEL> ALT allele over the ClinVar CNV and NCBI RefSeq gene lanes." src="/img/sv_cgiab/deletion_sv_inspector_search.png" />

Open the gene annotations and the tumor PacBio HiFi reads, set **Read height →
Compact** and **Sort by... → Base pair** from the track menu, and center the
deletion. The view menu's **center line** helps line the breakpoint up.

<Figure caption="Tumor PacBio HiFi reads at compact height, sorted by base pair with the deletion centered, over the gene annotations. The deletion removes two CUZD1 exons and is heterozygous." src="/img/sv_cgiab/deletion_linear_view.png" />

For background on SV signals in the alignments track, see the
[SV visualization guide](/docs/user_guides/sv_visualization).

### Walkthrough: reading copy number

The quickest copy-number check is the tumor and normal coverage bigWigs as one
multi-bigwig track, which is fast at any zoom level:

- **Show all regions in assembly** on the linear genome view start screen opens
  every chromosome at once.
- A manual **min/max score** cap from the track menu keeps a few centromere and
  repeat spikes from compressing the copy-number signal.
- **Overlapping scatter** plots the two samples as points in one band, tumor red
  and normal blue.

Zoom to a region and open the benchmark CNV BED to check the coverage changes
against the called intervals. Coverage says a level changed but not what
changed, so put the BAF track in the same window: chromosome 5 carries three
different answers, each a different shape in that lane.

<Figure caption="The linear genome view start screen: click Show all regions in assembly to lay out every chromosome across the view." src="/img/sv_cgiab/cnv_show_all_regions.png" />

<Figure caption="Chromosome 5: the segmented copy ratio, tumor and normal indexcov coverage as overlapping scatter, B-allele frequency, and the benchmark CNV calls. The normal stays flat while the tumor steps, and the BAF lane says what each step is." src="/img/sv_cgiab/cnv_with_bed_track.png" />

Raw coverage is only a sanity check on existing calls. For a signal that reads
directly as copy number, use the depth, BAF, and copy-number tracks built above.
Four loci in HG008-T each carry a different copy-number state:

| Locus  | State in HG008-T                 | Signature on the tracks             |
| ------ | -------------------------------- | ----------------------------------- |
| CDKN2A | Focal homozygous deletion (CN 0) | depth to 0, copy number 0           |
| TP53   | 17p loss + LOH (CN 1, 1+0)       | depth halved, BAF splits to 0 and 1 |
| SMAD4  | 18q loss + LOH (CN 1, 0+1)       | depth halved, BAF splits to 0 and 1 |
| KRAS   | Tandem duplication (CN 3, 2+1)   | depth raised, BAF to 1/3 and 2/3    |

All four are among the genes most commonly mutated in PDAC, and all four carry
clonal somatic variants in HG008
([Wagner et al. 2026](https://doi.org/10.64898/2026.05.01.722316)).

Keep the BAF track unfolded: folding onto 0 to 0.5 collapses each of those band
pairs onto one line.

Arm-level loss is widespread in this hypodiploid genome, so the single band at
0.5 is the exception rather than the backdrop. When a whole chromosome is LOH
end to end, as chr17 is below, nothing in that view is balanced and the
reference band has to come from another chromosome.

#### CDKN2A: a homozygous deletion vs a single-copy loss

Navigate to `CDKN2A` on chr9. The benchmark calls a focal ~20 kb homozygous
deletion (`SV_75`, total copy number 0) over the gene. A homozygous deletion
removes both parental copies, so depth goes to ~0 and HiFiCNV's copy number
drops to 0; a single-copy loss only halves depth. This deletion sits within a
larger single-copy-loss arm (`CNA_14`, 0+1), so it reads as a deeper notch in an
already-reduced baseline: the focal event removes the one copy the arm-level
loss had left
([Wagner et al. 2026](https://doi.org/10.64898/2026.05.01.722316)).

Load the tumor and matched normal per-base coverage as one
[multi-quantitative track](/docs/user_guides/multiquantitative_track), one row
per sample. Set an explicit score range from the track menu rather than
autoscaling, so both rows are drawn on the same scale.

HiFiCNV's depth is binned, so these coverage tracks are per-base. For the exact
breakpoints, open the PacBio HiFi read pileup below them.

The benchmark's `total_copy_number` is absolute, so CN 2 is a diploid segment.
Nothing in this window is diploid: the whole of 9p has lost a copy in this
tumor, so CN 1 is the local background and the deletion is punched into it.
Widen the view several hundred kilobases to the right to find the first CN 2
segment and read the CN 1 lane against it.

The thin lines crossing the gap in the pileup are single reads carrying the
deletion as one gap in their alignment.

<Figure caption="The CDKN2A deletion at 60 kb: coverage drops out in the tumor row and not in the normal, the read pileup drops out with it, and the CNV call under them reads CN 0." src="/img/sv_cgiab/driver_cdkn2a_deletion.png" />

#### chr17: loss-with-LOH vs copy-neutral LOH

Chromosome 17 shows why the BAF track is read alongside depth. Open the whole
chromosome with the depth track above the BAF:

- the p-arm (covering `TP53`) is a single-copy loss with LOH (`CNA_20`, CN 1,
  1+0): depth is halved and the BAF splits away from 0.5.
- the q-arm is copy-neutral LOH (`CNA_21`, CN 2, 2+0): one parental haplotype
  was lost and the other duplicated, so total copy number is still 2 and depth
  stays flat, yet the BAF still splits away from 0.5.

The q-arm event is invisible to depth alone, which is why the two tracks are
read together.

<Figure caption="Chromosome 17: the segmented copy ratio, the HiFiCNV depth, the BAF and the benchmark CNV calls. The p-arm is a single-copy loss with LOH; the q-arm is copy-neutral LOH, flat in both copy-number lanes and still split in the BAF." src="/img/sv_cgiab/cnv_chr17_loh.png" />

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

The same reading covers the other two loci. `KRAS` on chr12 sits in a gain
(`SV_101`, CN 3, 2+1): the assembly resolves it as a 2 Mb tandem duplication
carrying the G12V-mutated copy, an event associated with advanced disease
([Wagner et al. 2026](https://doi.org/10.64898/2026.05.01.722316)). Depth is
raised over the duplicated span and the BAF moves to 1/3 and 2/3, the partial
imbalance of a 2+1 gain rather than the full drop of a complete haplotype loss.
Because the event is a couple of megabases rather than an arm, zoom to it: at
whole-chromosome scale it is a handful of pixels wide.

<Figure caption="KRAS on chr12: its MANE Select transcript over the segmented copy ratio, the HiFiCNV depth and the BAF, above the CNV calls. Over the tandem duplication the copy-ratio edges land on the called boundaries and the BAF separates into two bands." src="/img/sv_cgiab/driver_kras_gain.png" />

`SMAD4` on 18q is lost with LOH (`CNA_48`, CN 1, 0+1), the mirror image of the
TP53 event. Two controls are in the same picture: the balanced p-arm, and the
matched normal on the same axis as the tumor.

The copy ratio is a log2 of tumor over normal, so read it against zero. Leave
the display's bicolor mode on and it fills from a zero pivot, loss below the
midline and gain above; a symmetric axis keeps the two the same distance.

<Figure caption="Chromosome 18: SMAD4's MANE Select transcript over the segmented copy ratio, the tumor and its matched normal from indexcov, and the BAF, above the CNV calls. All three lanes change together from ~30 Mb to the telomere." src="/img/sv_cgiab/driver_smad4_loh.png" />

See also the
[multi-quantitative track guide](/docs/user_guides/multiquantitative_track) for
comparing tumor and normal coverage.

### Walkthrough: synteny and dotplot views of the tumor assembly

Showing the tumor assembly side-by-side with the reference can make complex SVs
easier to read than the alignment track alone. **Add → Dotplot view**, set the
de novo assembly as one axis and GRCh38 as the other, and pick the matching
synteny track.

<Figure caption="The dotplot import form, with the HG008-T v3.2 assembly on one axis and GRCh38 on the other." src="/img/sv_cgiab/dotplot_import_form.png" />

Drag over a region and open a linear synteny view (below), then zoom in on a
breakpoint to read it at base level.

HG008-T v3.2 is haplotype-resolved, so its scaffold names end in `_hap1` or
`_hap2` and one plot stacks both on the same axis, doubling every diagonal.
Restrict the y axis to one haplotype at a time and each plot reads as a plain
assembly-vs-reference diagonal.

<Figure caption="Haplotype 1 of HG008-T v3.2 (y) against GRCh38 chromosomes (x). Each scaffold is one diagonal segment; scaffolds named for two chromosomes (chr3_chr13_hap1) break into two, which is the translocation." src="/img/sv_cgiab/dotplot_hap1.png" />

<Figure caption="The same plot for haplotype 2. chr13_hap2 carries a single clean diagonal against chr13, the untranslocated counterpart to hap1's fused scaffold." src="/img/sv_cgiab/dotplot_hap2.png" />

Use **Launch → Linear synteny view** from the drag selection, keep **HG008T
v3.2** as the dialog's synteny dataset, then enter `chr3 chr13` in the GRCh38
search box to focus on those chromosomes. Raising the **minimum alignment
length** (in the synteny view's menu) drops short, noisy anchors so the large
syntenic blocks read clearly.

<Figure caption="A synteny view launched from the chr3/chr13 selection in the dotplot: GRCh38 chr3 and chr13 above, the fused chr3_chr13_hap1 scaffold and chr13_hap2 below, at a raised minimum alignment length." src="/img/sv_cgiab/synteny_view.png" />

The chr3/chr13 fusion is one of 16 truncal interchromosomal rearrangements here.
Seven of the 16 hybrid chromosomes break in or near a centromere and nine
involve non-reciprocal foldback inversions
([Wagner et al. 2026](https://doi.org/10.64898/2026.05.01.722316)), which is
exactly what reference-based callers leave unresolved when the sequence either
side is satellite repeat. A scaffold named for two GRCh38 chromosomes is the
cue, so the names on the dotplot's y axis are a worklist.

For more on these views, see the
[dotplot view guide](/docs/user_guides/dotplot_view) and the
[linear synteny view guide](/docs/user_guides/linear_synteny_view).

### Walkthrough: methylation on the tumor reads

The C-GIAB PacBio HiFi BAMs carry per-read 5mC calls in their `MM`/`ML` tags,
and JBrowse renders those with no extra files: open the tumor reads and set
**Color by...** → **Modifications** from the track menu. The tags survive the
conversion to CRAM above, so the reads loaded for the SV walkthroughs already
carry them.

Most somatic LINE insertions in HG008 come from two hypomethylated non-reference
germline LINE insertions, so the methylation state of a source element explains
the insertion burden downstream of it
([Wagner et al. 2026](https://doi.org/10.64898/2026.05.01.722316)). See
[Modifications and methylation](/docs/user_guides/alignments_track#modifications-and-methylation)
for the display modes, and the
[methylation tutorial](/docs/tutorials/methylation) for the aggregate and
allele-specific views.

## Data availability

Raw data from C-GIAB is under NCBI BioProject PRJNA200694. Processed data and
benchmark call sets are available from the
[NIST Cancer Genome in a Bottle page](https://www.nist.gov/programs-projects/cancer-genome-bottle).

## Where to go next

Nothing above is specific to C-GIAB. Swap the VCF, the CRAMs and the assembly
for your own and the same tracks, walkthroughs and callers apply. The
[SV visualization guide](/docs/user_guides/sv_visualization) covers the display
options the walkthroughs reach for: the color schemes (pair orientation, insert
size), the read filters (discordant pairs, soft-clipped), and the display modes
(pileup, read arcs, linked reads).

Within C-GIAB itself there is more on the same FTP than this tutorial loads:

- a **somatic small-variant draft benchmark**, published alongside the SV/CNV
  one used here, which loads as a variant track the same way
- the **matched normal assembly** (`HG008N`), which can be loaded as a second
  JBrowse assembly and used as the synteny target instead of GRCh38. Comparing
  the tumor assembly to the donor's own normal assembly rather than to the
  reference is what separates somatic change from germline difference, and it is
  the approach the C-GIAB assembly paper is built on
- **HG009**, a second matched pair (PDAC liver metastasis with matched CD4+ T
  cells) on the
  [NIST C-GIAB page](https://www.nist.gov/programs-projects/cancer-genome-bottle)

## Reproduce it end to end

[`build_sv_visualization_cgiab.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_sv_visualization_cgiab.sh)
runs the whole data-preparation pipeline above in one shot:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_sv_visualization_cgiab.sh
bash build_sv_visualization_cgiab.sh   # builds ./cgiab_build/jbrowse2
npx --yes serve cgiab_build/jbrowse2
```

It grabs the C-GIAB GRCh38 build and the V0.5 HG008-T benchmark calls, turns the
tumor and normal HiFi BAMs into CRAMs, computes megadepth coverage, calls copy
number with HiFiCNV, builds the BAF bigWig, and loads the published Wakhan
haplotype-specific segments. It also aligns the T2T tumor assembly to GRCh38
with minimap2 for the synteny and dotplot views, then downloads JBrowse and
writes a `config.json` with everything loaded. The BAF and Wakhan tracks go in
with `add-track-json` rather than `add-track`, since the settings that make them
readable (`resolutionMultiplier` on one, `partitionField` on the other) are
track config rather than command-line flags.

It needs the tools listed under [Prerequisites](#prerequisites), plus `bcftools`
and `bedGraphToBigWig`. Be warned that it pulls down more than 200 GB, wants
roughly 1.5 TB of free disk and 32 GB of RAM, and the alignment and copy-number
steps take hours.

## See also

- [](/docs/tutorials/synteny_visualization)
- [](/docs/tutorials/sv_callset_review)
- [](/docs/tutorials/cancer_sv)
- [](/docs/user_guides/sv_visualization)
- [](/docs/user_guides/sv_inspector_view)
- [](/docs/user_guides/multiquantitative_track)

## References

- Diesh et al. (2023).
  [JBrowse 2: A Modular Genome Browser with Views of Synteny and Structural Variation](https://doi.org/10.1186/s13059-023-02914-z)
- McDaniel et al. (2025).
  [Development and Extensive Sequencing of a Broadly-Consented Genome in a Bottle Matched Tumor-Normal Pair](https://doi.org/10.1038/s41597-025-05438-2)
- Rautiainen et al. (2023).
  [Verkko: telomere-to-telomere assembly of diploid chromosomes](https://doi.org/10.1038/s41587-023-01662-6)
- Wagner et al. (2026).
  [A complete human pancreatic cancer genome](https://doi.org/10.64898/2026.05.01.722316)
