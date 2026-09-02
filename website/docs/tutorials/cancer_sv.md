---
title: Complex rearrangements and derivative alleles
sidebar_label: SVs (complex rearrangements)
description:
  Search a somatic SV callset for rearrangements that take several junctions to
  make, reconstruct the derivative allele, and check it against the reads
guide_category: Tutorials
tutorial_category: Cancer genomics
---

**TL;DR:** a rearrangement can take several junctions to make, and the genes it
brings together say nothing about how many. Search a somatic SV callset for
chains of junctions a single long read could cross, rebuild the derivative
allele from the reads that span it, and show that reconstruction against the
reference as a synteny view.

## Prerequisites

- nothing to read along. Everything below is for rebuilding the data
- a JBrowse to open them in: [Desktop](/docs/quickstart_desktop) takes a local
  file by path, [Web](/docs/quickstart_web) through **Add track**
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

Every file comes out of one ONT open-data release, from its own
`wf-somatic-variation` run
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

## COLO829

COLO829 is a melanoma cell line with a matched normal, COLO829BL, and a
community reference for somatic structural-variant calling. The tumor is
sequenced deeply enough on ONT R10 that a read crosses a whole rearrangement.

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

## Multi-hop fusions

Fusion callers generally look for one junction joining two genes. Two genes can
also be brought together by a series of junctions, and when the reference
segments between them are short, the result is indistinguishable at the
transcript level from a simple fusion. SplitThreader made this concrete in
SK-BR-3 ([Nattestad et al. 2018](https://doi.org/10.1101/gr.231100.117)),
finding a KLHDC2-SNTB1 fusion that required three variants across three
chromosomes.
[`sv_multihop.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/sv_multihop.py)
runs the same search on any somatic SV callset.

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
on chr3, a tumor suppressor, _BICC1_ on chr10, and _TRHDE_ on chr12.
`--max-segment` is the longest reference segment one read is assumed to bridge,
so set it from your own read-length distribution.

## Reads at the breakpoints

At the chr3 breakpoints the tumor pileup becomes soft-clipped bases, because
every read crossing the junction has its remainder aligned elsewhere. The
matched normal at the same locus is clean. Soft clipping is off by default; turn
it on from the track menu with **Show soft clipping**. These pileups are deep
enough that the track asks before downloading the window, and **Force load**
approves it for the rest of the session.

<Figure caption="Left: COLO829 tumor above COLO829BL normal at the two chr3 breakpoints, soft clipping shown. Tumor reads clip where normal reads read through. Right: the same event as a breakpoint split view over every locus the chain visits." src="/img/cancer_sv/multihop_reads.png" />

## Following the chain across panels

A breakpoint split view, the right half of the figure above, stacks the loci the
chain visits and draws the reads that leave one panel and arrive in another. On
the tumor track, **Launch → Reconstruct derivative allele...** lists the routes
the reads describe; pick one, set **Draw as** to **Breakpoint split view** and
choose **Replace current view**, and the view is replaced by a panel per segment
of that route, in the order the reads cross it.

The reads already know which loci those are and in what order, so the view is
built from them. On the tumor track, **Launch → Reconstruct derivative
allele...** lists the routes the reads describe; pick one, set **Draw as** to
**Breakpoint split view** and choose **Replace current view**, and the launching
view is replaced by a panel per segment of that route, in the order the reads
cross it, carrying the tracks that view had.

<Video src="/media/sv/derivative_allele_route.mp4" caption="The route over the chr3 breakpoints: the tumor track menu, the routes the reads describe with the read count and segment sizes behind each one, and Breakpoint split view replacing the window with a panel per segment. The soft-clipped tails at the start return as the curves between panels." />

This chain leaves chr3 and returns to it, so it gets two chr3 panels. Every
panel opens on the same span, centered on the junction its segment carries.
**Add → Breakpoint split view** builds a view whose loci you already know, one
row per panel.

**Add → Breakpoint split view** builds a view whose loci you already know, one
row per panel.

A single record opens the same way. Right-click it in the variant track and
choose **Open breakpoint split view**: one dialog asks for the shape, two
stacked panels or one row spanning both breakends, and the window each panel
opens at.

A BND names one partner, so the record on its own is two loci. **Follow further
breakends at each end** walks the callset: at each end of the chain it looks for
another junction leaving from the same place, and takes it when there is exactly
one. On this record that is three panels, because the chr10 breakend has a
second junction a couple of hundred bases away whose far end is on chr12. The
walk stops at two open continuations, or at one leading back into the chain. The
reads are the evidence for the assumption that two junctions leaving one locus
belong to one molecule, which is the dialog above.

<Figure caption="Opening the split view from the record itself: right-click the breakend, set the shape and window in the dialog, and get three panels because the chain runs chr3 to chr10 to chr12." src="/img/cancer_sv/split_view_from_breakend.png" />

For a single read, right-click it and choose **Linear read vs ref**. That builds
a synteny view with the read as its own assembly along the bottom and every
locus it touches along the top, the view Ribbon
([Nattestad et al. 2021](https://doi.org/10.1093/bioinformatics/btaa1080))
introduced.

Stacked panels describe the event in reference coordinates. Laid out along the
derivative, it shows the order and orientation of its pieces. The next section
builds that view from the reads on screen; the one after rebuilds the allele's
sequence for the base-level checks.

## Reconstructing the derivative allele in the browser

A split read is an ordered, oriented list of reference intervals, which is what
a derivative allele is. With the tumor reads open at a breakpoint, the
alignments track menu's **Reconstruct derivative allele...** groups the reads in
view by the path their split alignments describe and offers each path with the
number of reads behind it. Each row draws its segments to scale: a rearrangement
is usually a long arm carrying short inserts, and a read the aligner chopped
into pieces is a row of equal blocks.

Each row leads with the route as a lettered string, the reference cut into
pieces at every breakpoint and a prime on a piece crossed against it. **Save
segment map (SVG)** writes that map for the picked route as a figure, and **Copy
caption** puts the string and each letter's coordinates on the clipboard.

This dataset is the reconstruction at its easiest: ONT reads tens of kilobases
long, an event that moves whole arms, and 29 molecules crossing all three loci.
Junctions under 1 kb are mostly missed, because the aligner writes them inside a
read's CIGAR rather than as a split alignment. What the reconstruction needs,
and how to weigh a route once it appears, is in
[](/docs/user_guides/sv_visualization#what-the-reconstruction-needs).

The result is the view **Linear read vs ref** produces from a read, with the
lower panel holding the path a group of reads agrees on. Running **Linear read
vs ref** on one supporting read is the single-molecule evidence behind a
candidate. Whatever else was open comes along onto the reference panel. **Open
in new view** appends the reconstruction below the pileup; **Replace current
view** puts it in that view's place, which the figures here use.

### A fold-back on one chromosome

The smallest allele this menu produces is two segments on one chromosome.
COLO829 has one on chr9, where the tumor reads run out at 28,031,837 and resume
inverted from 28,059,142: the arm turns around and continues backwards, a
fold-back. A second call anchors 28 bp from the first, the pattern repeated
breakage-fusion-bridge cycles leave behind.

The fold-back's row names the same chromosome twice, once inverted, and its
strip draws two blocks of one color whose arrows point at each other. Rows tied
on read count are ordered by segment count. More than one row means more than
one allele: reads reaching the anchors from different directions describe
different routes through the same breakpoints.

<Figure caption="Top: the candidate list at the chr9 fold-back anchors. Bottom: the two-segment fold-back drawn, two windows of chr9 above and the allele below. The ribbons cross where the arm turns around." src="/img/cancer_sv/foldback_reconstruction.png" />

Reconstruction reads SA tags, so the arm a read returns from can be off screen.

### The der(3) allele, four segments across three chromosomes

The same menu at the chr3 breakpoint returns two rows. The first is the whole
event: a 52.3 kb arm of chr3, 199 bp of chr10, 183 bp of chr12 inverted, then
8.43 kb of chr3 inverted. The second is that route with the chr12 piece missing,
and two reads take it.

**Save segment map (SVG)** on the first row writes this figure.

<Figure caption="The der(3) route as a segment map: chr3 cut into A B C by the returning arm's edges, the copies the derivative carries of each stepped above, and the derivative below with B carried twice, forward in the arm and inverted at the end." src="/img/segment-maps/cancer_sv_der3.svg" />

The reconstruction is anchored on the window the pileup was showing, so the
reference row is tens of kilobases of chr3 with the two insert loci a few pixels
wide at its right-hand end. The next two sections open those junctions at base
scale.

<Figure caption="Top: the candidate list over the tumor pileup it was computed from, each row's segments drawn to scale. Bottom: the synteny view the top row draws, reference above and allele below, a ribbon per segment." src="/img/cancer_sv/derivative_autogenerated.png" />

Paths are identified by their junctions alone, and a chain is folded together
with its reverse complement before counting, which puts this event on one row.

The output is a proposal. The path is assembled from where the reads' alignments
start and stop, so it inherits whatever the aligner got wrong, and reads
mismapped into a repeat produce a confident-looking path. Deciding whether the
reads' own bases support a junction takes a sequence to align them to, which is
the next section.

## Reconstructing the allele's sequence

`derive` builds the allele's **sequence**: it pulls the reads spanning every
locus, takes the longest as a backbone, polishes it into a consensus with the
rest, aligns that consensus back to the reference, and realigns the reads to it.

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
are templated insertions, stretches of other chromosomes captured at a repair
junction.

The PAF is a synteny track and the consensus is an assembly, so the
reconstruction loads against the reference directly. The BED is the same
segments as a feature track on the derivative. Adding
`--jbrowse-out config.json` writes the config that wires those together and
prints the URL that opens them as a synteny view.

`--genes` takes a tabix-indexed GFF3 and projects the reference's gene
annotation through those segments into derivative coordinates, clipped where a
junction cut it and flipped where a segment is inverted:

```bash
python3 sv_multihop.py derive ... --genes ncbiRefSeq.gff.gz
```

```
wrote der3_RARB.derivative_genes.gff3 (44 features from 41 reference rows)
```

This allele carries _RARB_'s first coding exon and its start codon, then the 183
bp of chr12 that the second junction splices in, which is _TRHDE_ coding
sequence in reverse, then _RARB_ again inverted.

Ribbons below are colored by the reference chromosome they come from. The last
segment names the event: an interval the allele has already carried, read back
on the other strand, so the derivative turns around on itself. That leaves the
stretch in the allele twice in opposite orientations, an inverted duplication,
with the two templated inserts at the turn. Fold-backs are the canonical opening
move of a breakage-fusion-bridge cycle.

A read lane sits under each row. Against hg38 it draws split alignments only, so
the band over it counts the molecules carrying a junction; on the allele it
draws every read realigned there. The allele's lane thins partway along: the
allele begins as sequence both chromosome 3s share, so reads off the intact
homolog stop where the derivative leaves chr3, and reads off the rearranged copy
carry on. The shaded band marks what only the rearranged copy reaches.

Between the two, each junction is drawn once as an arc joining its two ends,
with a short tick at each foot over the sequence that end keeps: ticks pointing
away from each other are a deletion-type join, toward each other a
duplication-type, and parallel an inversion.

<Figure caption="The reconstructed derivative against its three source loci: RefSeq genes above, the same annotation projected onto the allele below, each segment labelled with the interval it came from, a read lane under each row, and the junctions drawn once each as arcs over the hg38 lane. Shaded on the allele: the stretch only the rearranged chromosome reaches, where the read lane thins to one allele's worth." src="/img/cancer_sv/derivative_synteny.png" />

## Checking the reconstruction

Zoomed to the kilobase holding the junctions, the two inserts are the same width
as the arms either side. Realigned against the derivative, reads the reference
tore into pieces run straight through: none clips at a junction, and depth holds
flat.

Each hg38 window runs past the segment the allele takes, so the bare reference
either side of the reads is what this allele leaves behind. That lane draws
split alignments only, and its coverage band counts the reads carrying a
junction, stepping down as each arm runs out.

<Figure caption="The stitching at base scale: chr3 runs out, chr10 follows, then chr12 inverted, then chr3 resumes backwards. Above, the same molecules against hg38, split alignments only, each row stopping at a junction with a connector to the piece it continues on; below, the allele's segments over the reads realigned to them at flat depth." src="/img/cancer_sv/derivative_inserts.png" />

A breakpoint split view follows one read across its alignments: soft clipping is
shown on both sides, and a curve joins each molecule's pieces. A dashed
connector means the read passes through a segment no panel is showing.

<Figure caption="COLO829 tumor ONT reads over one junction, twice. Against hg38 (left, split alignments only) they stop at chr3:25,359,568 with their tails clipped; realigned to the derivative (right) they cross at flat depth. The panes are at different zooms." src="/img/cancer_sv/realigned_reads.png" links="hg38=cancer_sv/realigned_reads_reference,derivative=cancer_sv/realigned_reads_derivative" />

## Reproduce it end to end

[`scripts/build_cancer_sv_demo.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_cancer_sv_demo.sh)
builds everything above from public sources:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_cancer_sv_demo.sh
bash build_cancer_sv_demo.sh    # builds ./cancer_sv_build/jbrowse2
npx --yes serve cancer_sv_build/jbrowse2
```

It fetches the ONT COLO829 somatic SV calls and coverage and runs both
`sv_multihop.py` steps against the tumor CRAM over HTTP. The same script builds
the K562 half of the demo, which [](/docs/tutorials/k562_fusions) walks through.

## See also

- [](/docs/tutorials/k562_fusions)
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
