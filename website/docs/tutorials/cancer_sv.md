---
title: Complex rearrangements and gene fusions
sidebar_label: Complex rearrangements
description:
  Search a somatic SV callset for rearrangements that take several junctions to
  make, reconstruct the derivative allele, and check it against the reads
guide_category: Tutorials
tutorial_category: Structural variation
---

**TL;DR:** a gene fusion does not always come from one breakpoint. Search a
somatic SV callset for chains of junctions a single long read could cross,
reconstruct the derivative allele from the reads that span it, and show that
reconstruction against the reference as a synteny view.

## Prerequisites

Nothing is needed to read along. To rebuild the data:

- [](/docs/cli)
- [samtools](http://www.htslib.org/) (v1.21 or later) and
  [minimap2](https://github.com/lh3/minimap2)
- `bedGraphToBigWig` from the
  [UCSC utilities](https://hgdownload.soe.ucsc.edu/admin/exe/)
- a GRCh38 FASTA, and roughly 40 GB of free disk

## The datasets

**COLO829** is a melanoma cell line with a matched normal, COLO829BL, and is a
community reference for somatic structural-variant calling
([Valle-Inclán et al. 2022](https://doi.org/10.1016/j.xgen.2022.100139)). The
tracks here are Oxford Nanopore R10 reads for tumour and normal from the
[ONT open-data release](https://registry.opendata.aws/ont-open-data/), with the
somatic SV calls from its `wf-somatic-variation` run.

**K562** is a chronic myeloid leukaemia line carrying the Philadelphia
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
to any somatic SV callset, and `scripts/sv_multihop.py` runs it.

## Finding the chains

The search needs only the VCF. Two junctions belong to the same chain when an
endpoint of one lands close enough to an endpoint of the other that a single
read could carry both:

```bash
python3 scripts/sv_multihop.py chains COLO829.wf-somatic-sv.vcf.gz --min-hops 3
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
chr3, a retinoic-acid receptor that acts as a tumour suppressor, BICC1 on chr10,
and TRHDE on chr12.

`--max-segment` is the knob that matters. It is the longest reference segment
one read is assumed to bridge, so set it from your own read-length distribution.

## Reads at the breakpoints

At the chr3 breakpoints the tumour pileup becomes soft-clipped bases, because
every read crossing the junction has its remainder aligned elsewhere. The
matched normal at the same locus is clean, which is what separates a somatic
event from a mapping artefact.

<Figure caption="Left: COLO829 tumour above COLO829BL normal at the two chr3 breakpoints, soft clipping shown. Tumour reads clip; normal reads read through, and the nanomonsv records between them name chr12 and chr10 in their ALT. Right: the same event as a breakpoint split view over all three loci, tumour reads only, where the reads leaving the chr3 panel reappear in the chr10 and chr12 panels." src="/img/cancer_sv/multihop_reads.png" />

Soft clipping is off by default. Turn it on from the track menu with
`Show soft clipping`.

## Following the chain across panels

A breakpoint split view, the right half of the figure above, stacks the loci and
draws the reads that leave one panel and arrive in another.

`ADD` -> `Breakpoint split view` opens an import form with one row per panel.
The `+` button adds rows, and each row takes an assembly and a location, so the
three loci from the `--loci` line above give that view without writing any
session JSON.

For one read rather than the pileup, right-click a read and choose
`Linear read vs ref`. That builds a synteny view with the read as its own
assembly along the bottom and every locus it touches along the top, which is the
view Ribbon
([Nattestad et al. 2021](https://doi.org/10.1093/bioinformatics/btaa1080))
introduced for this.

Stacked panels confirm that reads cross a junction, but they describe the event
in reference coordinates. Laying it out along the derivative instead shows the
order and orientation of the pieces, which is the synteny view in the next
section: the same three loci along the top, and the reconstructed derivative
along the bottom with a ribbon per segment.

## Reconstructing the derivative allele

Papers usually draw the derivative chromosome by hand. `derive` builds it from
the data: it pulls the reads spanning every locus, takes the longest as a
backbone, polishes it into a consensus with the rest, aligns that consensus back
to the reference, and realigns the reads to it.

```bash
python3 scripts/sv_multihop.py derive \
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
python3 scripts/sv_multihop.py derive ... --genes ncbiRefSeq.gff.gz
```

```
wrote der3_RARB.derivative_genes.gff3 (44 features from 41 reference rows)
```

This allele carries RARB's first coding exon and its start codon, then the
183 bp of chr12 that the second junction splices in, which is TRHDE coding
sequence in reverse, then RARB again inverted.

<Figure caption="The reconstructed derivative against its three source loci: RefSeq genes on the reference row, the same annotation projected onto the allele on the derivative row, with each segment labelled with the interval it came from. RARB's transcript starts partway along the allele and is cut off at the first junction. The wide ribbon is the chr3 arm; the crossing ribbon at right is chr3 returning inverted." src="/img/cancer_sv/derivative_synteny.png" />

## Checking the reconstruction

Zoomed to the kilobase holding the junctions, the two inserts are the same width
as the arms flanking them. Realigned against the derivative, reads that the
reference split into four pieces run straight through: none of the 29 spanning
reads clips at any of the four junction positions, and depth does not dip at
them. Both the reconstruction and this check come from the reads, so the figure
is evidence rather than illustration.

<Figure caption="The stitching at base scale, over the reads realigned to it: chr3 runs out, chr10 follows, then chr12 inverted, then chr3 resumes backwards. The projected genes under the segments carry the same names as the reference row above, so the chr12 insert reads as a piece of TRHDE on the allele's other strand. The reads below cross every join at flat depth." src="/img/cancer_sv/derivative_inserts.png" />

## The transcript view

The COLO829 event is genomic. What a fusion looks like in RNA, and how a
caller's output relates to the reads under it, is easier to follow on a known
fusion.

Loading DepMap's STAR-Fusion output through `StarFusionAdapter` and opening it
in a circular view draws the whole call set at once, each call a chord from its
left breakpoint to its right. A chord needs both of its ends on the circle, so
the track is opened in a `Circular view` (`ADD` -> `Circular view`) rather than
a window: in a single-locus linear view every interchromosomal call is dropped
and the track shows a lone breakend glyph. Most of the output is noise, ten of
K562's calls being mitochondrial artefacts, while `BCR--ABL1` and `NUP214--XKR3`
carry an order of magnitude more support than the rest and are the two sides of
the same chr9/chr22 junction.

<Figure caption="K562 STAR-Fusion calls as chords, colored by junction-read support. Red is the reciprocal chr9/chr22 pair plus one intrachromosomal call on chr6; the fan converging on chrM, between chrY and chr1, is the artefact tail." src="/img/cancer_sv/k562_starfusion_triage.png" />

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
alignment on chr9. `Read connections` -> `Use curved connectors` draws a curve
between the two, and with both partners displayed those curves cross from one
region into the other. `Show...` -> `Show only split alignments` then drops every
read that stays on one chromosome, so the pileup is the fusion's own support.

<Figure caption="BCR on chr22 beside ABL1 on chr9 as two regions of one view, each banded at its STAR-Fusion breakpoint, showing only split reads. Coverage drops after the BCR band and starts at the ABL1 band, the arcs over the coverage are the reads' own exon junctions, and each curve in the fan joins a read's chr22 alignment to its chr9 supplementary." src="/img/cancer_sv/k562_bcr_abl_split.png" />

The fusion is also amplified. Both chr9 breakpoints fall inside a segment at
roughly seven copies, while the chr22 partners sit at one, so what is amplified
is the piece of chr9 that the two junctions cut out.

<Figure caption="Copy number in three windows, with the STAR-Fusion calls as arcs across them: the amplified chr9q34 block in the middle carries both chr9 breakpoints, and the arcs run to its chr22 partners, XKR3 on the left and BCR on the right. DepMap's segmentation covers no interval over BCR." src="/img/cancer_sv/k562_cn_amplicon.png" />

This is the reasoning SplitThreader applied to the ERBB2 amplicon in SK-BR-3:
copy-number steps and breakpoints that describe the same interval are evidence
of one event.

## Reproduce it end to end

[`scripts/build_cancer_sv_demo.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_cancer_sv_demo.sh)
builds everything above from public sources:

```bash
bash scripts/build_cancer_sv_demo.sh
npx --yes serve cancer_sv_build/jbrowse2
```

It fetches the ONT COLO829 somatic SV calls and coverage, runs both
`sv_multihop.py` steps against the tumour CRAM over HTTP, pulls the ENCODE K562
Iso-Seq alignments, and converts a DepMap release into a STAR-Fusion TSV and a
copy-number bigWig.

## See also

- [](/docs/user_guides/sv_visualization)
- [](/docs/user_guides/sv_inspector_view)
- [](/docs/user_guides/linear_synteny_view)
- [](/docs/tutorials/sv_visualization_cgiab)
