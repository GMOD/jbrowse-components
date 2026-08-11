---
title: Complex rearrangements and gene fusions
sidebar_label: Complex rearrangements
description:
  Search a somatic SV callset for rearrangements that take several junctions to
  make, reconstruct the derivative allele, and check it against the reads
guide_category: Tutorials
tutorial_category: Cancer genomics
data: pipeline
---

**TL;DR:** a gene fusion does not always come from one breakpoint. Search a
somatic SV callset for chains of junctions a single long read could cross,
reconstruct the derivative allele from the reads that span it, and show that
reconstruction against the reference as a synteny view.

## Prerequisites

- nothing to read along. Everything below is for rebuilding the data
- [](/docs/cli)
- [samtools](http://www.htslib.org/) (v1.21 or later) and
  [minimap2](https://github.com/lh3/minimap2)
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

## The datasets

**COLO829** is a melanoma cell line with a matched normal, COLO829BL, and is a
community reference for somatic structural-variant calling
([Valle-Inclán et al. 2022](https://doi.org/10.1016/j.xgen.2022.100139)). The
tracks here are Oxford Nanopore R10 reads for tumor and normal from the
[ONT open-data release](https://registry.opendata.aws/ont-open-data/), with the
somatic SV calls from its `wf-somatic-variation` run.

**K562** is a chronic myeloid leukemia line carrying the Philadelphia
chromosome. It covers the transcript side: PacBio Iso-Seq from
[ENCODE](https://www.encodeproject.org/), plus STAR-Fusion calls and copy-number
segments from [DepMap](https://depmap.org/portal/), which publishes the same
pipeline output for roughly 1900 cell lines.

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

```bash
python3 sv_multihop.py chains COLO829.wf-somatic-sv.vcf.gz --min-hops 3
```

```
100 distinct junctions in COLO829.wf-somatic-sv.vcf.gz
4 chain(s) of >=3 junctions linked by reference segments <=20000 bp

chain 1: 3 junctions across 3 chromosome(s)
    chr3:25,359,111 <-> chr12:72,273,112
    chr3:25,359,568 <-> chr10:58,717,464
    chr10:58,717,662 <-> chr12:72,273,294
    --loci chr10:58717464,chr12:72273112,chr3:25359111
```

Those three junctions form a closed cycle, and the whole derivative path is
under a kilobase spread across three chromosomes. The genes involved are RARB on
chr3, a retinoic-acid receptor that acts as a tumor suppressor, BICC1 on chr10,
and TRHDE on chr12.

`--max-segment` is the knob that matters. It is the longest reference segment
one read is assumed to bridge, so set it from your own read-length distribution.

## Reads at the breakpoints

At the chr3 breakpoints the tumor pileup becomes soft-clipped bases, because
every read crossing the junction has its remainder aligned elsewhere. The
matched normal at the same locus is clean, which is what separates a somatic
event from a mapping artifact.

<Figure caption="Left: COLO829 tumor above COLO829BL normal at the two chr3 breakpoints, soft clipping shown. Tumor reads clip; normal reads read through, and the nanomonsv records between them name chr12 and chr10 in their ALT. Right: the same event as a breakpoint split view over every locus the chain visits, tumor reads only, where the reads leaving the chr3 panel reappear in the chr10 and chr12 panels and come back to chr3." src="/img/cancer_sv/multihop_reads.png" />

Soft clipping is off by default. Turn it on from the track menu with **Show soft
clipping**. These pileups are deep enough that the track asks before downloading
the window; **Force load** approves it for the rest of the session.

## Following the chain across panels

A breakpoint split view, the right half of the figure above, stacks the loci the
chain visits and draws the reads that leave one panel and arrive in another.

The reads already know which loci those are and in what order, so the view is
built from them rather than typed in. On the tumor track, **Launch view →
Reconstruct derivative allele...** groups the reads in the window by their split
alignments and lists the routes through the reference they describe; picking
one, setting **Draw as** to **Breakpoint split view** and choosing **Replace
current view** puts a panel per segment of that route in the launching view's
place, in the order the reads cross it, carrying the tracks that view had. That
is how the panels above were made, with no locus typed anywhere; the dialog
itself is the top frame of
[the reconstruction figure below](#reconstructing-the-derivative-allele-in-the-browser).

One panel per segment rather than per chromosome, which is the difference
between the two routes: this chain leaves chr3 and returns to it, so it gets two
chr3 panels, and a form filled in by hand gets one. Every panel opens on the
same span, centered on the junction its segment carries. A segment's own length
is a property of the reads that happened to describe it, and panels at different
zooms put the connecting curves in the corners instead of across the frame.

**Add → Breakpoint split view** is still there for a view whose loci you already
know, and takes one row per panel.

One record needs no typing at all. Right-click it in the variant track and
choose **Open breakpoint split view**: one dialog asks for the shape, two
stacked panels or one row spanning both breakends, and for the window each panel
opens at.

A BND names one partner, so the record on its own is two loci. **Follow further
breakends at each end** is what reaches the rest of the rearrangement, and it
does it from the callset rather than from the reads: at each end of the chain it
looks for another junction leaving from the same place, and takes it when there
is exactly one. On this record that is three panels rather than two, because the
chr10 breakend it names has a second junction a couple of hundred bases away
whose far end is on chr12. The walk then stops, since the only junction at the
chr12 end returns to where the chain began.

What the option assumes is worth being clear about, because the caller does not
assert it: two junctions leaving one locus are being read as one molecule. The
walk refuses the cases where that reading is a guess rather than a reading. Two
open continuations at a locus stop it, because the records cannot say which
molecule carries which; a continuation that leads back into the chain stops it
too, since a closed cycle is a shape already fully on screen. The evidence for
the assumption is the reads, and it is the dialog above: **Reconstruct
derivative allele** ranks whole routes by how many molecules independently take
each.

<Figure caption="Opening the split view from the record rather than the import form, in three steps. 1: right-click the breakend and choose Open breakpoint split view. 2: the dialog, where the shape, the window each panel opens at, and whether to follow further breakends are set together. 3: the result, three panels because the chain runs chr3 to chr10 to chr12, with the reads that cross each junction drawn as connectors between the pileups." src="/img/cancer_sv/split_view_from_breakend.png" />

For one read rather than the pileup, right-click a read and choose **Linear read
vs ref**. That builds a synteny view with the read as its own assembly along the
bottom and every locus it touches along the top, which is the view Ribbon
([Nattestad et al. 2021](https://doi.org/10.1093/bioinformatics/btaa1080))
introduced for this.

Stacked panels confirm that reads cross a junction, but they describe the event
in reference coordinates. Laying it out along the derivative instead shows the
order and orientation of the pieces, which is the synteny view in the next
section: the same three loci along the top, and the reconstructed derivative
along the bottom with a ribbon per segment. The next section builds that view
from the reads already on screen; the one after it rebuilds the allele's
sequence, which the base-level checks need.

## Reconstructing the derivative allele in the browser

A split read is already an ordered, oriented list of reference intervals, which
is what a derivative allele is. So the reconstruction does not have to be
searched for by hand: with the tumor reads open at a breakpoint, the alignments
track menu's **Reconstruct derivative allele...** groups the reads in view by
the path their split alignments describe and offers each path with the number of
reads that independently describe it.

A read count ranks the paths but does not vouch for them, so each row also draws
its segments to scale. That is the difference between an allele and an aligner
splitting one read: a rearrangement is usually a long arm carrying short
inserts, while a read chopped into pieces is a row of equal blocks, and the two
have the same total length.

The result is the same view type **Linear read vs ref** produces from a read you
right-click, with the axis swapped: the lower panel is the path a group of reads
agrees on rather than one molecule, so a ribbon carries its whole group's
support. Picking a supporting read out of the pileup and running **Linear read
vs ref** on it is then the single-molecule evidence behind one candidate.
Whatever else was open in the view comes along onto the reference panel, so the
path is read against the genes it runs through.

The dialog offers two destinations. **Open in new view** appends the
reconstruction below the pileup it came from; **Replace current view** puts it
in that view's place, which is what the figures here use, since the window the
pileup is showing is the window the reconstruction is anchored on.

### A fold-back on one chromosome

The smallest thing this menu produces is an allele of two segments on one
chromosome, so that is where to read it first. COLO829 has one on chr9, where
the tumour reads run out at 28,031,837 and resume inverted from 28,059,142: the
arm turns around and continues backwards, which is a fold-back. A second call
anchors 28 bp from the first, the pattern repeated breakage-fusion-bridge cycles
leave behind.

The fold-back's own row names the same chromosome twice, once inverted, which is
the fold-back written out, and its strip draws it: two blocks of one color whose
arrows point at each other. In the panel below, the track under the allele names
the interval each arm came from.

It is not the first row. Two routes here are described by the same number of
reads, and rows tied on support are ordered by segment count, so the
three-segment route through the second anchor sorts above the two-segment
fold-back. The count is what ranks a row; the strip is what identifies it.

<Figure caption="Top: the candidate list at the chr9 fold-back anchors. Bottom: the two-segment fold-back drawn, two windows of chr9 on the reference panel and the allele below. The ribbons cross instead of running parallel, which is what a segment returning inverted looks like." src="/img/cancer_sv/foldback_reconstruction.png" />

More than one row here means more than one allele. Reads reaching the anchors
from different directions describe different routes through the same
breakpoints, and each route is offered separately with its own support.

The window is deliberately narrower than the event. Reconstruction reads SA
tags, so the arm a read returns from does not have to be on screen to be
reconstructed, and asking for the whole event at this depth is more alignment
than the track will fetch: the pileup then renders as `force load` with no reads
behind it, and the reconstruction correctly reports that nothing in the window
is supported.

### The der(3) allele, four segments across three chromosomes

The same menu at the chr3 breakpoint this page has been following returns two
rows, and the first is the whole event: a 52.3 kb arm of chr3, 199 bp of chr10,
183 bp of chr12 inverted, then 8.43 kb of chr3 inverted. The second is the same
route with the chr12 piece missing, chr3 to chr10 and straight back to chr3, and
two reads take it. Both cross the same first junction, so the disagreement is
about what follows it, and a picture drawn only from the reads that support the
top row cannot contain it. It is a harder picture than the fold-back for a
reason the figure states rather than hides. The reconstruction is anchored on
the window the pileup was showing, so the reference row is tens of kilobases of
chr3 with the two insert loci occupying a few pixels at its right-hand end, and
the ribbons reaching them are hairlines because the segments are hairlines. The
genes of those loci, and the gene track carried up from the launching view,
collide in the same few pixels. The next two sections open those junctions at
base scale, where the same two pieces are as wide as the chr3 arms.

<Figure caption="Top: the candidate list over the tumor pileup it was computed from, each row a route through the reference that COLO829 reads cross in the same order and orientation, with its segments drawn to scale. Bottom: the synteny view the top row draws, reference above and allele below, a ribbon per segment." src="/img/cancer_sv/derivative_autogenerated.png" />

The reads describing one allele agree on its junctions and on nothing else: each
starts and stops where its own molecule did, and each crosses the allele from
whichever end it was sequenced from. Both are properties of the read rather than
of the event, so paths are identified by their junctions alone and a chain is
folded together with its reverse complement before the counting. That is what
puts this event on one row rather than splitting its support across several.
Which end the row is laid out from is a presentation choice, matching the
orientation `derive` reports below.

The lower panel has no sequence track. This reconstruction is the allele's order
and orientation, taken from where the reads' alignments start and stop; it does
not recover the bases at a junction. That is the next section.

Read counts rank the candidates; they do not decide them. Reads mismapped into a
repeat produce a confident-looking path, which is why the output is a proposal
to look at rather than a call: check that the reads run through each junction
instead of clipping at it, and that the segments land in the genes the event is
supposed to involve. The segment sizes are the other check, and the reason this
wants long reads: a route assembled from read-length pieces is an aligner
splitting one short read across the genome.

None of those checks are base-level, and none of them can be. The path is
assembled from where the reads' alignments start and stop, so it agrees with
those alignments by construction and inherits whatever the aligner got wrong.
Deciding whether the reads' own bases support a junction takes a sequence to
align them to, which is the next section: `derive` builds the allele's consensus
and realigns the spanning reads onto it, and a wrong junction then shows as
clipping and mismatches at that exact position.

## Reconstructing the allele's sequence

The candidates above are structure. `derive` builds the allele's **sequence**,
which is what the base-level checks below need: it pulls the reads spanning
every locus, takes the longest as a backbone, polishes it into a consensus with
the rest, aligns that consensus back to the reference, and realigns the reads to
it.

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

The reference's own gene annotation belongs on the derivative too, since what
the allele does to a gene is the reason to build it. `--genes` takes a
tabix-indexed GFF3 and projects it through those same segments, so each feature
lands in derivative coordinates, clipped where a junction cut it and flipped
where a segment is inverted:

```bash
python3 sv_multihop.py derive ... --genes ncbiRefSeq.gff.gz
```

```
wrote der3_RARB.derivative_genes.gff3 (44 features from 41 reference rows)
```

This allele carries RARB's first coding exon and its start codon, then the 183
bp of chr12 that the second junction splices in, which is TRHDE coding sequence
in reverse, then RARB again inverted.

Ribbons below are colored by the reference chromosome they come from, so the
wide green one is the chr3 arm and the crossing ribbons at right are the chr10
and chr12 inserts with chr3 returning inverted.

<Figure caption="The reconstructed derivative against its three source loci: RefSeq genes above, the same annotation projected onto the allele below, each segment labelled with the interval it came from. Both rows carry the same molecules — against hg38 (top, split alignments only) they end together on the last breakpoint, against the allele (bottom) they run the length of it at flat depth. The chr3 window reaches past that breakpoint, so the reference right of the ribbons is what this allele leaves behind." src="/img/cancer_sv/derivative_synteny.png" />

## Checking the reconstruction

Zoomed to the kilobase holding the junctions, the two inserts are the same width
as the arms flanking them. Realigned against the derivative, reads that the
reference split into four pieces run straight through: none of the 29 spanning
reads clips at any of the four junction positions, and depth does not dip at
them. Both the reconstruction and this check come from the reads, so the figure
is evidence rather than illustration.

<Figure caption="The stitching at base scale, over the reads realigned to it: chr3 runs out, chr10 follows, then chr12 inverted, then chr3 resumes backwards. The projected genes under the segments carry the same names as the reference row above, so the chr12 insert reads as a piece of TRHDE on the allele's other strand. The pileup under the reference row is the same reads against hg38, stopping in a straight line on the junction; the one under the allele crosses every join at flat depth." src="/img/cancer_sv/derivative_inserts.png" />

The two figures above put both alignments of those molecules in one frame but
leave the correspondence to the coordinates. Following one read across is the
next figure's job, and it is what a breakpoint split view does: soft clipping is
shown on both sides, and a curve joins each molecule's pieces. The hg38 side
carries a panel per locus the allele visits, so every connector runs between two
segments that are both on screen. A connector drawn dashed would mean the
opposite, that the read passes through a segment no panel is showing.

<Figure caption="COLO829 tumour ONT reads over one junction, twice. Against hg38 (left, split alignments only) they stop at chr3:25,359,568 with their tails clipped, and the curves follow the same molecules onto 199 bp of chr10, onto 183 bp of chr12, and back to chr3. Realigned to the derivative (right) they cross the junction at flat depth. The panes are at different zooms and each carries its own scale bar." src="/img/cancer_sv/realigned_reads.png" links="hg38=cancer_sv/realigned_reads_reference,derivative=cancer_sv/realigned_reads_derivative" />

## The transcript view

The COLO829 event is genomic. What a fusion looks like in RNA, and how a
caller's output relates to the reads under it, is easier to follow on a known
fusion.

The SV inspector opens DepMap's STAR-Fusion output as a table beside a circular
view of it, one chord per row. **Add → SV inspector**, then a File Type of
STAR-Fusion, which the wizard cannot infer from this file's `.tsv` extension;
all 44 calls load as one table, their artifact tail converging on chrM between
chrY and chr1. Both of those steps are live links under the figure below.

Searching the table narrows both halves, since the circle draws the rows the
search leaves. `chr9` leaves `BCR--ABL1` and `NUP214--XKR3`, one junction seen
from both sides, carrying an order of magnitude more junction reads than
anything else in the file.

A triaged row is not the end of the table. Every row carries a menu on its
caret, and **Open in linear genome view** takes it to its own breakpoint; type
the partner's window into the location box after it and the view holds both side
by side.

Then turn on **Read connections → View as pairs**. That merges each molecule's
two alignments onto one row across the two regions, so the fusion reads as a
flat line per molecule instead of a fan of curves. Flip the chr22 region as well
(`[rev]`): XKR3 is on the minus strand, so without it both halves of a molecule
run opposite ways.

<Figure caption="NUP214--XKR3 as two regions of one view with reads linked, opened from its row in the SV inspector. The breakpoints are banded green and each line is one Iso-Seq molecule running from NUP214 into XKR3. The legend names the read colors, which come from each segment's strand relative to its own chain rather than from the color-by setting." src="/img/cancer_sv/k562_fusion_inspector_reads.png" links="Import form=cancer_sv/k562_fusion_inspector_form,All 44 calls=cancer_sv/k562_fusion_inspector_all,Searched for chr9=cancer_sv/k562_fusion_inspector_pair,Linked reads=cancer_sv/k562_fusion_inspector_reads" />

That is the `NUP214--XKR3` side of the pair. The `BCR--ABL1` side gets the rest
of this section, in the same layout.

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
reads. Putting both partners in one view as two displayed regions, rather than
in two stacked panels, lays the fusion out the way FusionInspector does: type
both locations into the location box, separated by a space.

A read that crosses the junction is one alignment on chr22 and a supplementary
alignment on chr9. **Read connections → Use curved connectors** draws a curve
between the two, and with both partners displayed those curves cross from one
region into the other. **Show... → Show only split alignments** then drops every
read that stays on one chromosome, so the pileup is the fusion's own support.

<Figure caption="BCR on chr22 beside ABL1 on chr9 as two regions of one view, each banded at its STAR-Fusion breakpoint, showing only split reads with supplementary alignments linked. Coverage drops after the BCR band and starts at the ABL1 band, the arcs over the coverage are the reads' own exon junctions, and each row below is one molecule running from its chr22 alignment across to its chr9 supplementary." src="/img/cancer_sv/k562_bcr_abl_split.png" />

The fusion is also amplified. Both chr9 breakpoints fall inside a segment at
roughly seven copies, while the chr22 partners sit at one, so what is amplified
is the piece of chr9 that the two junctions cut out. DepMap's segmentation
covers no interval over BCR itself, which is why that window has an arc but no
copy-number step under it.

A fusion caller only reports junctions that are transcribed, so those arcs land
on exon boundaries and cannot say where the amplified block begins. The lane
under them is the DNA answer, from a different assay: ENCODE's 10X Chromium
linked-read run on K562 (ENCSR053AXS), whose large-SV calls are on hg19 and are
lifted to hg38 by the build script. Its chr9 breakpoint for BCR-ABL1 is at
130,731,760, the shaded stripe in the figure, which is where the copy-number
lane above it steps up. The transcript junction the red arc uses is 122 kb to
the right of that, inside ABL1's first intron: the amplicon boundary is a DNA
break, and the transcript is spliced from it to the nearest exon.

<Figure caption="Copy number in three windows, with the calls as arcs across them. Red, the STAR-Fusion RNA junctions, running from the amplified chr9q34 block to its chr22 partners XKR3 and BCR. Blue, the same two junctions called from 10X linked-read DNA. The shaded stripe is chr9:130,731,760, where the DNA arc ends and copy number steps up. The red arc ends 122 kb further in." src="/img/cancer_sv/k562_cn_amplicon.png" />

This is the reasoning SplitThreader applied to the ERBB2 amplicon in SK-BR-3:
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

- [](/docs/user_guides/sv_visualization)
- [](/docs/user_guides/sv_inspector_view)
- [](/docs/user_guides/linear_synteny_view)
- [](/docs/tutorials/sv_visualization_cgiab)
