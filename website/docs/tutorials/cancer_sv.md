---
title: Complex rearrangements and gene fusions
sidebar_label: SVs (complex rearrangements)
description:
  Search a somatic SV callset for rearrangements that take several junctions to
  make, reconstruct the derivative allele, and check it against the reads
guide_category: Tutorials
tutorial_category: Cancer genomics
data: pipeline
---

**TL;DR:** a gene fusion can take several junctions to make. Search a somatic SV
callset for chains of junctions a single long read could cross, reconstruct the
derivative allele from the reads that span it, and show that reconstruction
against the reference as a synteny view.

## Prerequisites

- nothing to read along. Everything below is for rebuilding the data
- [](/docs/cli)
- [samtools](http://www.htslib.org/) (v1.21 or later)
- [minimap2](https://github.com/lh3/minimap2)
- `bedGraphToBigWig` from the
  [UCSC utilities](https://hgdownload.soe.ucsc.edu/admin/exe/)
- `python3`, for `sv_multihop.py`
- a GRCh38 FASTA, and roughly 40 GB of free disk

On Debian/Ubuntu, `apt install samtools minimap2 python3` covers three of those;
`bedGraphToBigWig` is a single static binary from UCSC and `node`, for the CLI,
comes from [nodejs.org](https://nodejs.org/). `sv_multihop.py` is one file:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/sv_multihop.py
```

## Where the data comes from

Two cell lines, out of separate releases.

**COLO829**, whose reads, calls and coverage are all the ONT open-data release's
own `wf-somatic-variation` run
([Valle-Inclán et al. 2022](https://doi.org/10.1016/j.xgen.2022.100139)):

- COLO829 tumor reads (ONT R10, haplotagged):
  https://ont-open-data.s3.amazonaws.com/colo829_2024.03/wf_somatic_variation/sup/COLO829_tumor.ht.cram
- COLO829BL matched normal reads:
  https://ont-open-data.s3.amazonaws.com/colo829_2024.03/basecalls/colo829bl/sup/PAU59807.d052sup4305mCG_5hmCGvHg38.bam
- the somatic SV calls `sv_multihop.py` searches:
  https://ont-open-data.s3.amazonaws.com/colo829_2024.03/wf_somatic_variation/sup/COLO829.wf-somatic-sv.vcf.gz
- mosdepth coverage regions, tumor:
  https://ont-open-data.s3.amazonaws.com/colo829_2024.03/wf_somatic_variation/sup/COLO829/qc/coverage/COLO829_tumor.regions.bed.gz
- mosdepth coverage regions, normal:
  https://ont-open-data.s3.amazonaws.com/colo829_2024.03/wf_somatic_variation/sup/COLO829/qc/coverage/COLO829_normal.regions.bed.gz
- the GRCh38 build the CRAM decodes against, which `derive` also realigns the
  consensus to:
  https://ont-open-data.s3.amazonaws.com/colo829_2024.03/wf_somatic_variation/sup/GCA_000001405.15_GRCh38_no_alt_analysis_set.fasta
  **K562**, ENCODE Iso-Seq and DepMap's STAR-Fusion and copy-number calls, with
  its DNA breakpoints ENCODE's 10X linked-read set lifted from hg19:

- K562 PacBio Iso-Seq, ENCODE `ENCFF433YKW`:
  https://www.encodeproject.org/files/ENCFF433YKW/@@download/ENCFF433YKW.bam
- K562 PacBio Iso-Seq, ENCODE `ENCFF092NLB`:
  https://www.encodeproject.org/files/ENCFF092NLB/@@download/ENCFF092NLB.bam
- K562 PacBio Iso-Seq, ENCODE `ENCFF515YRZ`:
  https://www.encodeproject.org/files/ENCFF515YRZ/@@download/ENCFF515YRZ.bam
- K562 PacBio Iso-Seq, ENCODE `ENCFF475XQX`:
  https://www.encodeproject.org/files/ENCFF475XQX/@@download/ENCFF475XQX.bam
- K562 STAR-Fusion calls (DepMap 24Q4, `OmicsFusionFiltered.csv`):
  https://ndownloader.figshare.com/files/51065693
- K562 copy-number segments (DepMap 24Q4 WGS, `OmicsCNSegmentsProfile.csv`):
  https://ndownloader.figshare.com/files/51065333
- K562 DNA breakpoints (ENCODE 10X linked-read large-SV calls, hg19, lifted to
  hg38 by the build script):
  https://www.encodeproject.org/files/ENCFF863MPP/@@download/ENCFF863MPP.vcf.gz
- the hg19-to-hg38 chain the lift uses:
  https://hgdownload.soe.ucsc.edu/goldenPath/hg19/liftOver/hg19ToHg38.over.chain.gz

## COLO829 and K562

**COLO829** is a melanoma cell line with a matched normal, COLO829BL, and a
community reference for somatic structural-variant calling
([Valle-Inclán et al. 2022](https://doi.org/10.1016/j.xgen.2022.100139)).

The coverage lanes beside those reads are the same run's `mosdepth` output in 50
kb windows, repacked as bigWig:

<!-- from: scripts/build_cancer_sv_demo.sh -->

```bash
# awk drops the alt and decoy contigs: bedGraphToBigWig rejects a contig absent
# from the chrom.sizes outright, so one leftover row fails the conversion.
gzip -dc COLO829_tumor.regions.bed.gz | sort -k1,1 -k2,2n |
  awk 'NR==FNR{ok[$1];next} ($1 in ok)' hg38.chrom.sizes - > cov.bg
bedGraphToBigWig cov.bg hg38.chrom.sizes COLO829_tumor.coverage.bw
```

**K562** is a chronic myeloid leukemia line carrying the Philadelphia
chromosome. It covers the transcript side: PacBio Iso-Seq from
[ENCODE](https://www.encodeproject.org/), plus STAR-Fusion calls and copy-number
segments from [DepMap](https://depmap.org/portal/), which publishes the same
pipeline output for roughly 1900 cell lines.

Its DNA breakpoints come from ENCODE on hg19, and lifting a BND callset is the
one step here that fails quietly. A breakend record carries a second coordinate
inside its `ALT` string, so a plain `liftOver` of the `POS` column produces a
valid VCF whose partner coordinates still point at hg19.
[`lift_bnd_vcf.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/lift_bnd_vcf.py)
moves both:

<!-- from: scripts/build_cancer_sv_demo.sh -->

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/lift_bnd_vcf.py
python3 lift_bnd_vcf.py calls.hg19.vcf.gz hg19ToHg38.over.chain.gz \
  ./liftOver calls.hg38.vcf liftwork
bgzip calls.hg38.vcf && tabix -p vcf calls.hg38.vcf.gz
```

Its five arguments are the input VCF, the chain, the `liftOver` binary, the
output VCF and a scratch directory.

## Multi-hop fusions

Fusion callers generally look for one junction joining two genes. Two genes can
also be brought together by a series of junctions, and when the reference
segments between them are short, the result is indistinguishable at the
transcript level from a simple fusion.

SplitThreader made this concrete in SK-BR-3
([Nattestad et al. 2018](https://doi.org/10.1101/gr.231100.117)): searching the
SV graph for short paths between fusion partners found a KLHDC2-SNTB1 fusion
that required three variants across three chromosomes. The same search applies
to any somatic SV callset, and
[`sv_multihop.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/sv_multihop.py)
runs it.

## Finding the chains

The search needs only the VCF. Two junctions belong to the same chain when an
endpoint of one lands close enough to an endpoint of the other that a single
read could carry both:

<!-- from: scripts/build_cancer_sv_demo.sh -->

```bash
python3 sv_multihop.py chains COLO829.somatic-sv.vcf.gz --min-hops 3
```

```
100 distinct junctions in COLO829.somatic-sv.vcf.gz
4 chain(s) of >=3 junctions linked by reference segments <=20000 bp

chain 1: 3 junctions across 3 chromosome(s)
    chr3:25,359,111 <-> chr12:72,273,112
    chr3:25,359,568 <-> chr10:58,717,464
    chr10:58,717,662 <-> chr12:72,273,294
    --loci chr10:58717464,chr12:72273112,chr3:25359111
```

Those three junctions form a closed cycle, and the whole derivative path is
under a kilobase spread across three chromosomes. The genes involved are _RARB_
on chr3, a retinoic-acid receptor that acts as a tumor suppressor, _BICC1_ on
chr10, and _TRHDE_ on chr12.

`--max-segment` is the longest reference segment one read is assumed to bridge,
so set it from your own read-length distribution.

## Reads at the breakpoints

At the chr3 breakpoints the tumor pileup becomes soft-clipped bases, because
every read crossing the junction has its remainder aligned elsewhere. The
matched normal at the same locus is clean.

<Figure caption="Left: COLO829 tumor above COLO829BL normal at the two chr3 breakpoints, soft clipping shown. Tumor reads clip where normal reads read through. Right: the same event as a breakpoint split view over every locus the chain visits." src="/img/cancer_sv/multihop_reads.png" />

Soft clipping is off by default. Turn it on from the track menu with **Show soft
clipping**. These pileups are deep enough that the track asks before downloading
the window; **Force load** approves it for the rest of the session.

## Following the chain across panels

A breakpoint split view, the right half of the figure above, stacks the loci the
chain visits and draws the reads that leave one panel and arrive in another.

The reads already know which loci those are and in what order, so the view is
built from them. On the tumor track, **Launch view → Reconstruct derivative
allele...** lists the routes the reads describe; pick one, set **Draw as** to
**Breakpoint split view** and choose **Replace current view**, and the launching
view is replaced by a panel per segment of that route, in the order the reads
cross it, carrying the tracks that view had.

<Video src="/media/sv/derivative_allele_route.mp4" caption="The route over the chr3 breakpoints: the tumor track menu, the routes the reads describe with the read count and segment sizes behind each one, and Breakpoint split view replacing the window with a panel per segment. The soft-clipped tails at the start return as the curves between panels." />

There is one panel per segment: this chain leaves chr3 and returns to it, so it
gets two chr3 panels. Every panel opens on the same span, centered on the
junction its segment carries, which puts the connecting curves across the frame.

**Add → Breakpoint split view** builds a view whose loci you already know, one
row per panel.

A single record opens the same way. Right-click it in the variant track and
choose **Open breakpoint split view**: one dialog asks for the shape, two
stacked panels or one row spanning both breakends, and for the window each panel
opens at.

A BND names one partner, so the record on its own is two loci. **Follow further
breakends at each end** reaches the rest of the rearrangement from the callset:
at each end of the chain it looks for another junction leaving from the same
place, and takes it when there is exactly one. On this record that is three
panels, because the chr10 breakend it names has a second junction a couple of
hundred bases away whose far end is on chr12. The walk then stops, since the
only junction at the chr12 end returns to where the chain began.

The option assumes two junctions leaving one locus belong to one molecule. Two
open continuations at a locus end the walk, since the records cannot say which
molecule carries which, and so does a continuation leading back into the chain.
The reads are the evidence for that assumption, which is the dialog above.

<Figure caption="Opening the split view from the record itself: right-click the breakend, set the shape and window in the dialog, and get three panels because the chain runs chr3 to chr10 to chr12." src="/img/cancer_sv/split_view_from_breakend.png" />

For a single read, right-click it and choose **Linear read vs ref**. That builds
a synteny view with the read as its own assembly along the bottom and every
locus it touches along the top, the view Ribbon
([Nattestad et al. 2021](https://doi.org/10.1093/bioinformatics/btaa1080))
introduced for this.

Stacked panels describe the event in reference coordinates. Laid out along the
derivative, it shows the order and orientation of its pieces. The next section
builds that view from the reads already on screen; the one after it rebuilds the
allele's sequence, which the base-level checks need.

## Reconstructing the derivative allele in the browser

A split read is already an ordered, oriented list of reference intervals, which
is what a derivative allele is. With the tumor reads open at a breakpoint, the
alignments track menu's **Reconstruct derivative allele...** groups the reads in
view by the path their split alignments describe and offers each path with the
number of reads that independently describe it.

A read count ranks the paths, and each row also draws its segments to scale: a
rearrangement is usually a long arm carrying short inserts, and a read the
aligner chopped into pieces is a row of equal blocks of the same total length.

The result is the view type **Linear read vs ref** produces from a read you
right-click, with the lower panel holding the path a group of reads agrees on,
so a ribbon carries its whole group's support. Running **Linear read vs ref** on
one supporting read is the single-molecule evidence behind a candidate. Whatever
else was open comes along onto the reference panel, so the path is read against
the genes it runs through.

**Open in new view** appends the reconstruction below the pileup it came from;
**Replace current view** puts it in that view's place, which is what the figures
here use.

### A fold-back on one chromosome

The smallest thing this menu produces is an allele of two segments on one
chromosome, so that is where to read it first. COLO829 has one on chr9, where
the tumor reads run out at 28,031,837 and resume inverted from 28,059,142: the
arm turns around and continues backwards, which is a fold-back. A second call
anchors 28 bp from the first, the pattern repeated breakage-fusion-bridge cycles
leave behind.

The fold-back's row names the same chromosome twice, once inverted, and its
strip draws it as two blocks of one color whose arrows point at each other. Rows
tied on read count are ordered by segment count, so the three-segment route
through the second anchor sorts above it.

<Figure caption="Top: the candidate list at the chr9 fold-back anchors. Bottom: the two-segment fold-back drawn, two windows of chr9 above and the allele below. The ribbons cross where the arm turns around." src="/img/cancer_sv/foldback_reconstruction.png" />

More than one row here means more than one allele: reads reaching the anchors
from different directions describe different routes through the same
breakpoints, each offered with its own support.

The window is narrower than the event. Reconstruction reads SA tags, so the arm
a read returns from can be off screen, and the whole event at this depth is more
alignment than the track will fetch.

### The der(3) allele, four segments across three chromosomes

The same menu at the chr3 breakpoint this page has been following returns two
rows. The first is the whole event: a 52.3 kb arm of chr3, 199 bp of chr10, 183
bp of chr12 inverted, then 8.43 kb of chr3 inverted. The second is that route
with the chr12 piece missing, and two reads take it; both cross the same first
junction, so the disagreement is about what follows it.

The reconstruction is anchored on the window the pileup was showing, so the
reference row is tens of kilobases of chr3 with the two insert loci a few pixels
wide at its right-hand end, and the ribbons reaching them are hairlines. The
next two sections open those junctions at base scale.

<Figure caption="Top: the candidate list over the tumor pileup it was computed from, each row's segments drawn to scale. Bottom: the synteny view the top row draws, reference above and allele below, a ribbon per segment." src="/img/cancer_sv/derivative_autogenerated.png" />

The reads describing one allele agree on its junctions: each starts and stops
where its own molecule did, and each crosses the allele from whichever end it
was sequenced from. Both are properties of the read, so paths are identified by
their junctions alone and a chain is folded together with its reverse complement
before the counting, which puts this event on one row.

The output is a proposal: reads mismapped into a repeat produce a
confident-looking path, so check that the reads run through each junction and
that the segments land in the genes the event is supposed to involve.

Those checks are structural. The path is assembled from where the reads'
alignments start and stop, so it agrees with those alignments by construction
and inherits whatever the aligner got wrong. Deciding whether the reads' own
bases support a junction takes a sequence to align them to, which is the next
section: `derive` builds the allele's consensus and realigns the spanning reads
onto it, and a wrong junction shows as clipping and mismatches at that position.

## Reconstructing the allele's sequence

The candidates above are structure. `derive` builds the allele's **sequence**,
which is what the base-level checks below need: it pulls the reads spanning
every locus, takes the longest as a backbone, polishes it into a consensus with
the rest, aligns that consensus back to the reference, and realigns the reads to
it.

<!-- from: scripts/build_cancer_sv_demo.sh -->

```bash
python3 sv_multihop.py derive \
  --aln COLO829_tumor.ht.cram --ref GRCh38.fa \
  --loci chr10:58717464,chr12:72273112,chr3:25359111 \
  --out der3_RARB --name der3_RARB_BICC1_TRHDE
```

```
29 spanning reads
backbone read 8315652b-cd0f-4290-ad6b-51112f93a44a (57,134 bp)
wrote der3_RARB.derivative.fa (39,549 bp supported by >=3 reads)
wrote der3_RARB.vs_reference.paf
    derivative       0-32732   + -> chr3:25,326,821-25,359,568
    derivative   32732-32931   + -> chr10:58,717,463-58,717,662
    derivative   32932-33115   - -> chr12:72,273,111-72,273,294
    derivative   33126-39549   - -> chr3:25,352,683-25,359,111
wrote der3_RARB.derivative_segments.bed
```

Four contiguous segments: two chr3 arms in opposite orientations, a foldback,
with short pieces of chr10 and chr12 spliced in at the turn. Those two fragments
are templated insertions, short stretches of other chromosomes captured at a
repair junction.

The PAF is a synteny track and the consensus is an assembly, so the
reconstruction loads against the reference directly. The BED is the same
segments as a feature track on the derivative, each labelled with the interval
it came from. Adding `--jbrowse-out config.json` writes the config that wires
those together (both assemblies, the synteny track, the segments and the
realigned reads) and prints the URL that opens them as a synteny view.

`--genes` takes a tabix-indexed GFF3 and projects the reference's own gene
annotation through those same segments, so each feature lands in derivative
coordinates, clipped where a junction cut it and flipped where a segment is
inverted:

```bash
python3 sv_multihop.py derive ... --genes ncbiRefSeq.gff.gz
```

```
wrote der3_RARB.derivative_genes.gff3 (44 features from 41 reference rows)
```

This allele carries _RARB_'s first coding exon and its start codon, then the 183
bp of chr12 that the second junction splices in, which is _TRHDE_ coding
sequence in reverse, then _RARB_ again inverted.

Ribbons below are colored by the reference chromosome they come from, so the
wide green one is the chr3 arm and the crossing ribbons at right are the chr10
and chr12 inserts with chr3 returning inverted.

That last segment is what names the event: an interval the allele has already
carried, read back on the other strand, so the derivative turns around on
itself, a fold-back. The turn leaves that stretch in the allele twice in
opposite orientations, which is the same thing as an inverted duplication, and
the two templated inserts are what sits at the turn. Fold-backs are the
canonical opening move of a breakage-fusion-bridge cycle.

A read lane sits under each row. Against hg38 it draws split alignments only, so
the band over it counts the molecules carrying a junction; on the allele it
draws every read realigned there.

The allele's lane thins partway along. The tumor has two chromosome 3s: the
allele begins as sequence they share, so reads off the intact homolog align down
it and stop where the derivative leaves chr3, and reads off the rearranged copy
carry on. The shaded band marks what only the rearranged copy reaches.

Between the two, each junction is drawn once as an arc joining its two ends,
with a short tick at each foot lying over the sequence that end keeps: ticks
pointing away from each other are a deletion-type join, toward each other a
duplication-type, and parallel an inversion.

<Figure caption="The reconstructed derivative against its three source loci: RefSeq genes above, the same annotation projected onto the allele below, each segment labelled with the interval it came from, a read lane under each row, and the junctions drawn once each as arcs over the hg38 lane. Shaded on the allele: the stretch only the rearranged chromosome reaches, where the read lane thins to one allele's worth." src="/img/cancer_sv/derivative_synteny.png" />

## Checking the reconstruction

Zoomed to the kilobase holding the junctions, the two inserts are the same width
as the arms either side of them. Realigned against the derivative, reads the
reference tore into pieces run straight through: none clips at a junction, and
depth holds flat across them.

Each hg38 window runs past the segment the allele takes, so the bare reference
either side of the reads is what this allele leaves behind. That lane draws
split alignments only, and its coverage band counts the same subset: the reads
carrying a junction, stepping down as each arm runs out.

<Figure caption="The stitching at base scale: chr3 runs out, chr10 follows, then chr12 inverted, then chr3 resumes backwards. Above, the same molecules against hg38, split alignments only, each row stopping at a junction with a connector to the piece it continues on; below, the allele's segments over the reads realigned to them at flat depth." src="/img/cancer_sv/derivative_inserts.png" />

Following one read across the two alignments is what a breakpoint split view
does: soft clipping is shown on both sides, and a curve joins each molecule's
pieces. The hg38 side carries a panel per locus the allele visits, so every
connector runs between two segments that are both on screen; a dashed connector
means the read passes through a segment no panel is showing.

<Figure caption="COLO829 tumor ONT reads over one junction, twice. Against hg38 (left, split alignments only) they stop at chr3:25,359,568 with their tails clipped; realigned to the derivative (right) they cross at flat depth. The panes are at different zooms." src="/img/cancer_sv/realigned_reads.png" links="hg38=cancer_sv/realigned_reads_reference,derivative=cancer_sv/realigned_reads_derivative" />

## The transcript view

The COLO829 event is genomic. A known fusion shows what one looks like in RNA,
and how a caller's output relates to the reads under it.

The SV inspector opens DepMap's STAR-Fusion output as a table beside a circular
view of it, one chord per row. **Add → SV inspector**, then a File Type of
STAR-Fusion, which the wizard cannot infer from this file's `.tsv` extension.
Both of those steps are live links under the figure below.

Searching the table narrows both halves, since the circle draws the rows the
search leaves. `chr9` leaves `BCR--ABL1` and `NUP214--XKR3`, one junction seen
from both sides, carrying more junction reads than anything else in the file.

Every row carries a menu on its caret, and **Open in linear genome view** takes
it to its own breakpoint; type the partner's window into the location box after
it and the view holds both side by side.

Then turn on **Read connections → View as pairs**. That merges each molecule's
two alignments onto one row across the two regions, so the fusion reads as a
flat line per molecule. Flip the chr22 region as well (`[rev]`), since _XKR3_ is
on the minus strand and the flip runs both halves of a molecule the same way.

<Figure caption="NUP214--XKR3 as two regions of one view with reads linked, opened from its row in the SV inspector. The breakpoints are banded green and each line is one Iso-Seq molecule running from NUP214 into XKR3." src="/img/cancer_sv/k562_fusion_inspector_reads.png" links="Import form=cancer_sv/k562_fusion_inspector_form,All 44 calls=cancer_sv/k562_fusion_inspector_all,Searched for chr9=cancer_sv/k562_fusion_inspector_pair,Linked reads=cancer_sv/k562_fusion_inspector_reads" />

That is the `NUP214--XKR3` side of the pair, and `BCR--ABL1` takes the rest of
the section in the same layout, off the STAR-Fusion calls the build script adds
as this track:

```json
{
  "type": "VariantTrack",
  "trackId": "K562_star_fusion",
  "name": "K562 STAR-Fusion calls (DepMap 24Q4)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "StarFusionAdapter",
    "starFusionLocation": { "uri": "K562.star-fusion.tsv" }
  }
}
```

The Iso-Seq reads stop and start at the bases STAR-Fusion reported from short
reads. Putting both partners in one view as displayed regions lays the fusion
out the way FusionInspector does: type the locations into the location box,
separated by spaces. The transcript reaches _ABL1_ at more than one place, so
this view uses three regions, the _BCR_ donor and two acceptor windows.

A read that crosses the junction is one alignment on chr22 and a supplementary
alignment on chr9. **Read connections → Use curved connectors** draws a curve
between the two, and with both partners displayed those curves cross from one
region into the other. **Filter by... → Split alignments → Only split
alignments** then drops every read that stays on one chromosome, so the pileup
is the fusion's own support.

Near-identical curves stack into one line, so a curve per molecule cannot show
how many molecules agree on a junction. **Read connections → Show read arcs**
adds a band under the coverage where each junction is drawn once, thickened by
the reads behind it. An arc is drawn when both of its ends are in view, so it
reaches across a region divider, and each acceptor window receives one. The
vertical at the _BCR_ donor stands for the molecules whose _ABL1_ alignment
lands in neither window.

<Figure caption="BCR on chr22 beside two ABL1 windows on chr9 as three regions of one view, showing only split reads with supplementary alignments linked. The arc band draws one counted arc from the BCR donor into each ABL1 window, and only the right-hand window carries a STAR-Fusion band." src="/img/cancer_sv/k562_bcr_abl_split.png" />

The fusion is also amplified. Both chr9 breakpoints fall inside a segment at
roughly seven copies, while the chr22 partners sit at one, so what is amplified
is the piece of chr9 that the two junctions cut out. DepMap's segmentation
covers no interval over _BCR_ itself, which is why that window has an arc but no
copy-number step under it.

A fusion caller only reports junctions that are transcribed, so those arcs land
on exon boundaries and cannot say where the amplified block begins. The DNA
answer comes from a different assay: ENCODE's 10X Chromium linked-read run on
K562 (ENCSR053AXS), whose large-SV calls are on hg19 and are lifted to hg38 by
the build script. Its chr9 breakpoint for BCR-ABL1 is at 130,731,760, and
DepMap's copy-number segmentation steps up at 130,731,326. The transcript
junction is 122 kb to the right of both, inside _ABL1_'s first intron: the
amplicon boundary is a DNA break, and the transcript is spliced from it to the
nearest exon.

This is the reasoning SplitThreader applied to the _ERBB2_ amplicon in SK-BR-3:
copy-number steps and breakpoints that describe the same interval are evidence
of one event. Here two independent assays put that interval's edge in the same
place.

## Reproduce it end to end

[`scripts/build_cancer_sv_demo.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_cancer_sv_demo.sh)
builds everything above from public sources:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_cancer_sv_demo.sh
bash build_cancer_sv_demo.sh    # builds ./cancer_sv_build/jbrowse2
npx --yes serve cancer_sv_build/jbrowse2
```

It fetches the ONT COLO829 somatic SV calls and coverage, runs both
`sv_multihop.py` steps against the tumor CRAM over HTTP, pulls the ENCODE K562
Iso-Seq alignments, and converts a DepMap release into a STAR-Fusion TSV and a
copy-number bigWig. The K562 DNA breakpoints come from ENCODE on hg19, so it
also downloads UCSC's chain and `liftOver` and runs `lift_bnd_vcf.py`, which
moves both coordinates of every breakend rather than just the POS column.

## See also

- [](/docs/tutorials/sv_callset_review)
- [](/docs/tutorials/hic_structural_variants)
- [](/docs/user_guides/sv_visualization)
- [](/docs/user_guides/sv_inspector_view)
- [](/docs/user_guides/linear_synteny_view)
- [](/docs/tutorials/sv_visualization_cgiab)

## References

- Valle-Inclán JE, et al. A multi-platform reference for somatic structural
  variation detection. _Cell Genomics_ (2022).
  https://doi.org/10.1016/j.xgen.2022.100139
- Nattestad M, et al. Complex rearrangements and oncogene amplifications
  revealed by long-read DNA and RNA sequencing of a breast cancer cell line.
  _Genome Research_ (2018). https://doi.org/10.1101/gr.231100.117
- Nattestad M, Aboukhalil R, Chin CS, Schatz MC. Ribbon: intuitive visualization
  for complex genomic variation. _Bioinformatics_ (2021).
  https://doi.org/10.1093/bioinformatics/btaa1080
