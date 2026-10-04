---
title: Complex rearrangements and derivative alleles
sidebar_label: SVs (complex rearrangements)
description:
  Follow a rearrangement that takes several junctions to make across a
  breakpoint split view, and show the derivative allele an assembly built
  against the reference
guide_category: Tutorials
tutorial_category: Cancer genomics
---

Cancer genomes have rearrangements that join several distant pieces of the
genome into one molecule through a chain of junctions. We follow one such chain
in the COLO829 melanoma cell line across the three chromosomes it visits, in a
breakpoint split view, then align the derivative allele assembled from the reads
that span it to the reference, in a synteny view.

## Prerequisites

- a JBrowse to open them in: [Desktop](/docs/quickstart_desktop) takes a local
  file by path, [Web](/docs/quickstart_web) through **Add track**
- [](/docs/cli)
- [samtools](http://www.htslib.org/) (v1.21 or later)
- [minimap2](https://github.com/lh3/minimap2)
- `bedGraphToBigWig` from the
  [UCSC utilities](https://hgdownload.soe.ucsc.edu/admin/exe/)
- `python3`
- a GRCh38 FASTA, and roughly 40 GB of free disk

On Debian/Ubuntu, `apt install samtools minimap2 python3` covers three of those;
`bedGraphToBigWig` is a single static binary from UCSC and `node`, for the CLI,
comes from [nodejs.org](https://nodejs.org/).

## Where the data comes from

All but the last file come from the ONT COLO829 open-data release and its
`wf-somatic-variation` run; the last is the multi-platform truth set
([Valle-Inclán et al. 2022](https://doi.org/10.1016/j.xgen.2022.100139)):

- COLO829 tumor reads (ONT R10, haplotagged):
  https://ont-open-data.s3.amazonaws.com/colo829_2024.03/wf_somatic_variation/sup/COLO829_tumor.ht.cram
- COLO829BL matched normal reads:
  https://ont-open-data.s3.amazonaws.com/colo829_2024.03/basecalls/colo829bl/sup/PAU59807.d052sup4305mCG_5hmCGvHg38.bam
- the somatic SV calls this page works from:
  https://ont-open-data.s3.amazonaws.com/colo829_2024.03/wf_somatic_variation/sup/COLO829.wf-somatic-sv.vcf.gz
- mosdepth coverage regions, tumor:
  https://ont-open-data.s3.amazonaws.com/colo829_2024.03/wf_somatic_variation/sup/COLO829/qc/coverage/COLO829_tumor.regions.bed.gz
- mosdepth coverage regions, normal:
  https://ont-open-data.s3.amazonaws.com/colo829_2024.03/wf_somatic_variation/sup/COLO829/qc/coverage/COLO829_normal.regions.bed.gz
- the GRCh38 build the CRAM decodes against, and the der(3) contig aligns to:
  https://ont-open-data.s3.amazonaws.com/colo829_2024.03/wf_somatic_variation/sup/GCA_000001405.15_GRCh38_no_alt_analysis_set.fasta
- the COLO829 somatic SV truth set, lifted to GRCh38:
  https://zenodo.org/api/records/4716169/files/truthset_somaticSVs_COLO829_hg38lifted.vcf/content

## COLO829 and its coverage tracks

COLO829 is a melanoma cell line with a matched normal, COLO829BL, and a
community reference for somatic structural-variant calling. The tumor is
sequenced deeply on ONT R10, and some of its reads cross a whole rearrangement.

The demo's tumor and normal coverage tracks are the `wf-somatic-variation` run's
`mosdepth` output in 50 kb windows, converted to bigWig:

<!-- from: scripts/build_cancer_sv_demo.sh -->

```bash
# awk keeps the contigs in hg38.chrom.sizes; bedGraphToBigWig fails on any other
gzip -dc COLO829_tumor.regions.bed.gz | sort -k1,1 -k2,2n |
  awk 'NR==FNR{ok[$1];next} ($1 in ok)' hg38.chrom.sizes - > cov.bg
bedGraphToBigWig cov.bg hg38.chrom.sizes COLO829_tumor.coverage.bw
```

## The der(3) chain across chr3, chr10 and chr12

A series of junctions can bring two genes together, as in the KLHDC2-SNTB1
fusion SplitThreader found in SK-BR-3, which needed three variants across three
chromosomes ([Nattestad et al. 2018](https://doi.org/10.1101/gr.231100.117)).

COLO829's der(3), a derivative chromosome 3 assembled from pieces of three
chromosomes, is the chain the rest of this page follows. Three junctions close a
triangle across chr3, chr10 and chr12:

```text
chr3:25,359,111  <-> chr12:72,273,112
chr3:25,359,568  <-> chr10:58,717,464
chr10:58,717,662 <-> chr12:72,273,294
```

The pieces between the junctions are short, under a kilobase in all, spread
across three chromosomes. The genes involved are _RARB_ on chr3, a tumor
suppressor, _BICC1_ on chr10, and _TRHDE_ on chr12.

## Tumor and normal reads at the chr3 breakpoints

The ONT reads were aligned to GRCh38, and the CRAM decodes against it, so we
load that assembly and the two read tracks. Each read file needs its index
beside it, a `.crai` for the CRAM and a `.bai` for the BAM; for your own sample,
swap the `uri`:

```json addassembly
{
  "name": "hg38",
  "uri": "https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz",
  "refNameAliases": {
    "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt"
  },
  "cytobands": "https://jbrowse.org/genomes/GRCh38/cytoBand.txt"
}
```

```json addtrack
{
  "trackId": "COLO829_tumor_ont",
  "name": "COLO829 tumor (ONT R10)",
  "uri": "https://ont-open-data.s3.amazonaws.com/colo829_2024.03/wf_somatic_variation/sup/COLO829_tumor.ht.cram",
  "assemblyNames": ["hg38"]
}
```

```json addtrack
{
  "trackId": "COLO829BL_normal_ont",
  "name": "COLO829BL matched normal (ONT R10)",
  "uri": "https://ont-open-data.s3.amazonaws.com/colo829_2024.03/basecalls/colo829bl/sup/PAU59807.d052sup4305mCG_5hmCGvHg38.bam",
  "assemblyNames": ["hg38"]
}
```

The breakends come from the run's somatic SV calls, which need their `.tbi`
beside them:

```json addtrack
{
  "trackId": "COLO829_somatic_sv",
  "name": "COLO829 somatic SVs (nanomonsv)",
  "uri": "https://ont-open-data.s3.amazonaws.com/colo829_2024.03/wf_somatic_variation/sup/COLO829.wf-somatic-sv.vcf.gz",
  "assemblyNames": ["hg38"]
}
```

Open the SV calls and the tumor and normal read tracks at
`chr3:25,357,600-25,361,000`. At the chr3 breakpoints the tumor pileup becomes
soft-clipped bases, because every read crossing the junction has its remainder
aligned elsewhere. The matched normal at the same locus is clean. Soft clipping
is off by default; turn it on from the track menu with **Show... → Show soft
clipping**. These pileups are deep enough that the track asks before downloading
the window, and **Force load** approves it for the rest of the session.

<Figure caption="Left: COLO829 tumor above COLO829BL normal at the two chr3 breakpoints, soft clipping shown. Tumor reads clip where normal reads read through. Right: the same event as a breakpoint split view over every locus the chain visits." src="/img/cancer_sv/multihop_reads.png" />

## Following the chain across panels

A breakpoint split view, the right half of the figure above, stacks the loci the
chain visits and draws the reads that leave one panel and arrive in another.
**Add → Breakpoint split view** builds a view whose loci you already know, one
row per panel. A variant record already names its loci, so the view can also
open from one: right-click the record in the variant track and choose **Open
breakpoint split view**. The dialog asks for the layout, two stacked panels or
one row spanning both breakends, and the window each panel opens at.

A breakend (BND) record names one partner, so on its own it opens two panels.
With **Follow further breakends at each end** checked, the dialog searches the
callset at each end of the chain for another junction leaving from the same
place, and adds it when there is exactly one. The search stops at a locus with
two candidates, or at one leading back into the chain. On the chr3 record the
chain starts from, it finds three panels, because the chr10 breakend has a
second junction a couple of hundred bases away whose far end is on chr12. The
search assumes that two junctions leaving one locus belong to one molecule, and
the reads crossing both are the evidence for that.

<Figure caption="Opening the split view from the record itself: right-click the breakend, set the shape and window in the dialog, and get three panels because the chain runs chr3 to chr10 to chr12." src="/img/cancer_sv/split_view_from_breakend.png" />

To follow a single read, right-click it and choose **Linear read vs ref**.
JBrowse opens a synteny view with the read as an assembly along the bottom and
every locus it touches along the top, the layout Ribbon
([Nattestad et al. 2021](https://doi.org/10.1093/bioinformatics/btaa1080))
introduced.

The split view shows the event in reference coordinates. The next section
assembles the derivative allele, which shows the order and orientation of the
pieces.

## The derivative allele

The cancer SV demo config, https://jbrowse.org/demos/cancer_sv/config.json,
includes a der(3) contig assembled from the tumor reads that span all three
loci, so every base in it comes from those reads.

To build one from your own data, pull the reads crossing the loci with
`samtools view`, assemble them with
[Flye](https://github.com/mikolmogorov/Flye),
[Shasta](https://github.com/paoloshasta/shasta) or
[hifiasm](https://github.com/chhylp123/hifiasm), and align the contigs to the
reference:

```bash
# asm5: same-species preset; -c: base-level CIGAR, to draw junctions at base scale
minimap2 -cx asm5 GRCh38.fa contigs.fa > der3.vs_reference.paf
jbrowse make-pif der3.vs_reference.paf
```

The published contig aligns to the reference in four blocks:

```text
    derivative       0-32732   + -> chr3:25,326,821-25,359,568
    derivative   32732-32931   + -> chr10:58,717,463-58,717,662
    derivative   32932-33115   - -> chr12:72,273,111-72,273,294
    derivative   33126-39549   - -> chr3:25,352,683-25,359,111
```

The contig has four segments: a chr3 arm, short pieces of chr10 and chr12, and
part of the same chr3 stretch again, inverted. The chr10 and chr12 pieces are
templated insertions, stretches of other chromosomes copied in at a repair
junction. The repeated chr3 stretch makes the allele an inverted duplication, or
fold-back, the first step of a breakage-fusion-bridge cycle.

Index the contigs, then load the contig as an assembly and the PAF as a synteny
track between it and GRCh38:

```bash
samtools faidx contigs.fa
```

```json addassembly
{
  "name": "der3_RARB_BICC1_TRHDE",
  "uri": "contigs.fa"
}
```

The track lists the query assembly (the contig) first and the target (GRCh38)
second, the reverse of the minimap2 argument order. Reversed, the view opens
empty and reports no error:

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "der3_vs_hg38",
  "name": "der3 contig vs hg38",
  "assemblyNames": ["der3_RARB_BICC1_TRHDE", "hg38"],
  "adapter": {
    "type": "PairwiseIndexedPAFAdapter",
    "uri": "der3.vs_reference.pif.gz",
    "queryAssembly": "der3_RARB_BICC1_TRHDE",
    "targetAssembly": "hg38"
  }
}
```

Then add the truth set, called on five platforms before this ONT run existed, so
every junction has an independent call to check against:

```json addtrack config=https://jbrowse.org/demos/cancer_sv/config.json loc=chr3:25,320,000-25,365,000
{
  "type": "VariantTrack",
  "trackId": "COLO829_truth_set",
  "name": "COLO829 validated somatic SVs (Valle-Inclán 2022)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "VcfAdapter",
    "uri": "https://zenodo.org/api/records/4716169/files/truthset_somaticSVs_COLO829_hg38lifted.vcf/content"
  }
}
```

The segment labels, the projected gene annotation and the realigned reads below
come with the demo's config. The assembly, the synteny track and the truth set
above reproduce the ribbons and arcs on your own contig.

Open **Add → Linear synteny view** with hg38 on the top row and
`der3_RARB_BICC1_TRHDE` below, and pick **der3 contig vs hg38** as the synteny
track. The figure shows:

- ribbons coloured by the reference chromosome each segment came from
- a BED track on the derivative labelling each segment with its reference
  interval, which the gene track cannot do because a segment usually sits inside
  one large intron
- the reference gene annotation projected onto the derivative: the first coding
  exon of _RARB_, a short stretch of _TRHDE_ coding sequence in reverse, then
  _RARB_ again, inverted
- the tumor's split reads under the reference row, one row per molecule, with
  the truth set's validated calls above them
- each junction drawn once as an arc, with a tick at each end over the sequence
  that end keeps. Ticks pointing apart mark a deletion-type join, ticks pointing
  toward each other a duplication-type join, and parallel ticks an inversion.

<Figure caption="The reconstructed derivative against its three source loci: RefSeq genes, the truth set and the tumor's split reads above, with each junction drawn once as an arc; the same annotation projected onto the allele below, each segment labelled with the interval it came from." src="/img/cancer_sv/derivative_synteny.png" />

## Checking the reconstruction

Zoom the synteny view to the kilobase holding the junctions; at that zoom each
of the two inserts has a ribbon of its own. Against hg38 every split read stops
at a junction, and the truth set has a validated call at each place they stop.
Realigned to the derivative, most of the same reads cross all four junctions in
one alignment. The consensus was polished from these reads, so the realignment
shows that they agree with each other; the truth set, called from other
platforms, is the independent check.

Each hg38 window extends past the segment the allele includes, so the reference
on either side of the reads is absent from the allele. The read lane shows split
alignments only, so its coverage band counts the reads with a junction and steps
down as each arm ends.

<Figure caption="The stitching at base scale: chr3 runs out, chr10 follows, then chr12 inverted, then chr3 resumes backwards. Above, the truth set's validated calls over the same molecules against hg38, split alignments only, each row stopping at a call with a connector to the piece it continues on; below, the allele's segments over the reads realigned to them." src="/img/cancer_sv/derivative_inserts.png" />

In a breakpoint split view, soft clipping shows on both sides of a junction and
a curve joins the pieces of each read. A dashed connector marks a read passing
through a segment no panel shows.

<Figure caption="COLO829 tumor ONT reads over one junction, twice. Against hg38 (left, split alignments only) they stop at the chr3 junction with their tails clipped; realigned to the derivative (right) they cross at flat depth. The panes are at different zooms." src="/img/cancer_sv/realigned_reads.png" links="hg38=cancer_sv/realigned_reads_reference,derivative=cancer_sv/realigned_reads_derivative" />

## Reproduce it end to end

[`scripts/build_cancer_sv_demo.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_cancer_sv_demo.sh)
builds everything above from public sources into `./cancer_sv_build/jbrowse2`.
For COLO829 it converts the coverage to bigWig as above, adds the tumor and
normal reads as tracks streamed from ONT's bucket, and downloads the published
der(3) contig with its alignment to GRCh38, its segment labels and the spanning
reads realigned to it. [The derivative allele](#the-derivative-allele) shows how
to assemble a contig like it from your own reads. The same run builds the K562
half of the demo, which [](/docs/tutorials/k562_fusions) walks through.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_cancer_sv_demo.sh
bash build_cancer_sv_demo.sh
npx --yes serve cancer_sv_build/jbrowse2
```

## See also

- [](/docs/tutorials/k562_fusions)
- [](/docs/tutorials/sv_callset_review)
- [](/docs/tutorials/hic_structural_variants)
- [](/docs/user_guides/sv_visualization)
- [](/docs/user_guides/sv_inspector_view)
- [](/docs/user_guides/linear_synteny_view)
- [](/docs/tutorials/sv_visualization_cgiab)

## Citations

- Valle-Inclán JE, et al. A multi-platform reference for somatic structural
  variation detection. _Cell Genomics_ (2022).
  https://doi.org/10.1016/j.xgen.2022.100139
- Nattestad M, et al. Complex rearrangements and oncogene amplifications
  revealed by long-read DNA and RNA sequencing of a breast cancer cell line.
  _Genome Research_ (2018). https://doi.org/10.1101/gr.231100.117
- Nattestad M, Aboukhalil R, Chin CS, Schatz MC. Ribbon: intuitive visualization
  for complex genomic variation. _Bioinformatics_ (2021).
  https://doi.org/10.1093/bioinformatics/btaa1080
