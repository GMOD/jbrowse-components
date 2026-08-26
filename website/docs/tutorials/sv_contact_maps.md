---
title: Structural variants from read-pair contact maps
sidebar_label: SVs (read-pair contact maps)
description:
  Turn NA12878's read pairs into Cue-style contact channels, read an inversion
  and a duplication off them, and check both against the reads they came from
guide_category: Tutorials
tutorial_category: Structural variation
data: hosted
---

**TL;DR:** Cue reads structural variants out of a picture rather than out of a
caller's rules: every read pair becomes one pixel joining the two places its
ends landed, sorted into a channel by how the two ends face. That picture is a
contact matrix, so `juicer_tools` and the Hi-C track put it in a genome browser
beside the reads it was computed from.

## Prerequisites

- nothing to install to read along: every track below is hosted
- `samtools` and `python3`, for the [one command](#building-the-four-channels)
  that turns your own reads into channels
- `java`, which `juicer_tools` needs. `sv_contact_maps.py` downloads
  `juicer_tools` itself

## Where the data comes from

NA12878, sequenced deeply by the Genome in a Bottle consortium
([Zook et al. 2016](https://doi.org/10.1038/sdata.2016.25)), read against the
structural variants the 1000 Genomes Project called on the same individual
([Sudmant et al. 2015](https://doi.org/10.1038/nature15394)).

- the whole-genome Illumina alignment the demo's reads are sliced out of, 2x148
  novoalign against hs37d5:
  https://ftp-trace.ncbi.nlm.nih.gov/ReferenceSamples/giab/data/NA12878/NIST_NA12878_HG001_HiSeq_300x/NHGRI_Illumina300X_novoalign_bams/HG001.hs37d5.300x.bam
- the 1000 Genomes phase 3 structural-variant map, genotyped in every sample:
  https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/phase3/integrated_sv_map/ALL.wgs.mergedSV.v8.20130502.svs.genotypes.vcf.gz
- the three-locus slice this page loads:
  https://jbrowse.org/demos/sv_contact_maps/NA12878.sv_contact_maps.bam
- the four channels built from it:
  https://jbrowse.org/demos/sv_contact_maps/discordant.hic,
  https://jbrowse.org/demos/sv_contact_maps/same_strand.hic,
  https://jbrowse.org/demos/sv_contact_maps/outward.hic and
  https://jbrowse.org/demos/sv_contact_maps/depth_difference.hic
- NA12878's own non-reference calls out of that map:
  https://jbrowse.org/demos/sv_contact_maps/NA12878.1000g_sv.vcf.gz

## Where the encoding comes from

Cue ([Popic et al. 2023](https://doi.org/10.1038/s41592-023-01799-x)) genotypes
structural variants with a neural network, and the interesting half of it is
what the network is shown. A window of the genome becomes an image. Pixel (a, b)
counts the read pairs and split reads with one end in bin a and the other in bin
b, so a rearrangement that joins two distant places puts a bright spot off the
diagonal at exactly those two coordinates. Pairs are sorted into separate
channels by how their two ends face, because the facing is what says which
rearrangement it was: an inversion leaves both ends pointing the same way, a
tandem duplication leaves them pointing outward. A last channel holds no pairs
at all, only the difference in read depth between the two bins, which is where a
copy-number change shows up.

An image whose pixel (a, b) counts something joining bin a to bin b is a contact
matrix, and JBrowse already draws those. So the whole encoding fits in files
JBrowse reads today: one `.hic` per channel, all of them in the same coordinate
system as the reads.

## Building the four channels

`sv_contact_maps.py` streams `samtools view` once and writes each pair into
whichever channels it belongs to, then hands each channel to `juicer_tools` to
be packed into a `.hic`:

<!-- from: scripts/build_sv_contact_maps.sh -->

```bash
python3 sv_contact_maps.py reads.bam --out sv_contacts \
  --min-span 1000 \
  --bin 750 \
  --resolutions 750,1500,5000,25000
```

`--min-span` is what "discordant" means for a given library, and it is the
setting to reconsider first on your own data. Below it a pair is just a
fragment: this library's inserts run to about 850 bp at the 99th percentile, so
a kilobase is clear of them. Set it too low and every concordant pair in the
genome lands on the diagonal, which takes the color ramp with it and leaves the
handful of cells that matter at the bottom of it.

`--bin` is the resolution each channel is drawn at, and it has to appear in
`--resolutions`, because the depth channel writes one record per pair of bins
and there has to be a matrix that fine to write them into. The coarser
resolutions are what the track steps out to as you zoom.

Four files come out, one per channel, and each loads as an ordinary Hi-C track:

```json addtrack
{
  "type": "HicTrack",
  "trackId": "sv_contacts_same_strand",
  "name": "Contacts: same-strand pairs (inversion)",
  "assemblyNames": ["hg19"],
  "adapter": {
    "type": "HicAdapter",
    "uri": "https://jbrowse.org/demos/sv_contact_maps/same_strand.hic"
  },
  "displayDefaults": {
    "useColorPercentile": true
  }
}
```

[`useColorPercentile`](/docs/config/linearhicdisplay/#slot-usecolorpercentile)
is the one setting these tracks cannot do without. A Hi-C matrix from an actual
Hi-C experiment fills its whole triangle, and the default ramp is scaled for
that. A channel built from read pairs is nearly empty, so its brightest cell
sits far below where a linear ramp expects the top of the scale to be, and the
track draws as a blank triangle with the answer in it.

## The inversion

The demo opens on a heterozygous inversion NA12878 carries on chromosome 7,
called by delly in the 1000 Genomes map. Both breakpoints are on screen, with
two of the channels above the reads they were computed from.

<Figure src="/img/sv_contact_maps/inversion.png" caption="The same-strand and discordant channels over one inversion call in NA12878, with the read cloud and the 1000 Genomes call under them. One cell carries the inversion in both channels; the discordant channel draws it over a scatter of ordinary long fragments." links="Open this view=sv_contact_maps/inversion" />

The same-strand channel has one bright cell in it. Its two coordinates are the
two breakpoints, which is what an inversion does to a read pair: the sequence
between the breakpoints is flipped, so a fragment straddling one of them puts
its two ends on the same strand instead of facing each other. Every such pair in
the window lands in that one cell, and nothing else in the window puts a pair
there.

The discordant channel below it holds the same cell and a scatter of faint ones
around it. That channel takes every pair whose ends are far enough apart,
whichever way they face, so the scatter is the tail of an ordinary library: real
long fragments, at no particular pair of coordinates. Splitting by orientation
is what separates one from the other, and it is why Cue's encoding has channels
rather than a single image.

The read cloud below the channels is the same evidence one pair at a time. Each
pair is drawn at the position of its two ends, at a height set by how far apart
they are, so the pairs the same-strand cell counted are the tall marks standing
above the modal band. Turn it on from the alignments track menu with **Read
connections → Show read cloud**.

How many pairs the cell holds is a number, and `juicer_tools` will read it back
out of the file the track is drawing:

```bash
# `observed NONE` asks for raw counts. NONE because these files carry no
# normalization vector at all: sv_contact_maps.py builds them with `pre -n`, so
# that a channel too sparse to balance cannot come back empty under a vector the
# display picked on its own.
# BP asks for base-pair bins, and the number after it is the bin size, which has
# to be one of the resolutions the file was built with.
java -jar juicer_tools.jar dump observed NONE \
  same_strand.hic 7 7 BP 750 same_strand.chr7.txt
```

Three columns come back: the two bin starts and the count. Sorting on the third
puts the inversion at the top, and the first two columns are the coordinates the
figure drew it at.

## The duplication that only depth sees

The other two loci in the slice are duplications, and the 1000 Genomes map calls
both of them with genome-STRiP, which works from read depth alone. Open the one
on chromosome 5.

<Figure src="/img/sv_contact_maps/depth_only_duplication.png" caption="A duplication call in NA12878 with the discordant and outward channels above the depth channel. Neither pair channel puts a cell on the two breakpoints; the depth channel is at the top of its ramp." links="Open this view=sv_contact_maps/depth_only_duplication" />

The depth channel lights up across the call, and neither pair channel puts a
cell where the two breakpoints meet. The outward channel is the one a tandem
duplication is supposed to appear in: a fragment crossing the junction of a
head-to-tail duplication has its two ends facing away from each other rather
than toward each other. What the discordant channel does carry here is a scatter
hugging the diagonal, pairs a kilobase or two longer than the modal insert,
which is the tail of an ordinary library rather than a junction.

That is the data rather than the pipeline, and it is worth knowing which. The
call was made on depth, the reads are in the demo, and no pair in them joins
these two breakpoints. A duplication placed somewhere else in the genome, or one
whose junction sits inside a repeat long enough to swallow a fragment, produces
exactly this: a real copy-number change with no junction evidence. The channels
report what is there.

Every other window in this demo runs the same pair channels, and the inversion
window shows what one of them looks like when the junction is there, so the
absence here is a measurement rather than a track that failed to load. That is
the thing a single-channel picture cannot tell you.

<Figure src="/img/sv_contact_maps/depth_channel.png" caption="The depth channel alone over the same duplication, framed with flat sequence on both sides. Two bright arms meet over the call, and the wedge directly under it stays pale. The coverage lane below rises between the same two coordinates." links="Open this view=sv_contact_maps/depth_channel" />

Framed wider, the channel has a shape rather than a bright patch, and the shape
is what the encoding produces. A bin inside an interval of changed copy number
differs from every bin outside it, which draws the two arms, and from no bin
inside it, which leaves the wedge between them pale. The demo carries a second
depth-only duplication on chromosome 17 to open the same way; it sits in a field
of pseudogenes whose own depth swings as hard as the call does, which is what
this channel looks like where mappability is against you.

## Back to the reads

The channels are counts of read pairs, so the last step is to look at the pairs.
Zoom to one of the inversion's breakpoints and color the pileup by pair
orientation from the track menu, **Color by... → Pair orientation**.

<Figure src="/img/sv_contact_maps/breakpoint_reads.png" caption="The pileup at the inversion's right breakpoint, colored by pair orientation. Two same-strand classes meet at one column, one on each side of it, with the library's ordinary pairs drawn in grey through both." links="Open this view=sv_contact_maps/breakpoint_reads" />

The colored reads are the ones the same-strand cell counted. Which class a read
falls in swaps at one column, because a pair reaching across the breakpoint from
the left has both ends on one strand and a pair reaching across from the right
has both ends on the other. The grey reads running through both sides are the
ordinary pairs, and they are unbroken, which is what a heterozygous call looks
like from underneath.

## Without the preprocessing

Everything above builds files first. The same four channels can also be computed
from the BAM as the view moves, by an adapter that does the classification in a
worker and hands the Hi-C track the counts:

```json addtrack
{
  "type": "HicTrack",
  "trackId": "sv_contacts_live",
  "name": "Contacts: same-strand pairs, computed live",
  "assemblyNames": ["hg19"],
  "adapter": {
    "type": "AlignmentsContactAdapter",
    "channel": "sameStrand",
    "minSpan": 1000,
    "binSizes": [750, 1500, 5000, 25000],
    "subadapter": {
      "type": "BamAdapter",
      "uri": "https://jbrowse.org/demos/sv_contact_maps/NA12878.sv_contact_maps.bam"
    }
  },
  "displayDefaults": {
    "useColorPercentile": true
  }
}
```

`channel` picks one of `discordant`, `sameStrand`, `outward` or
`depthDifference`, and the rest of the slots mean what the flags of the same
name mean above. Four tracks over one BAM give the same four channels with
nothing precomputed and nothing to host, which is the route to take on reads you
are still looking at. The `.hic` route is the one to take when the window is
wide, when the reads are somewhere slow, or when the channels have to outlive
the BAM.

## Reproduce it end to end

[`build_sv_contact_maps.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_sv_contact_maps.sh)
slices the three loci out of the GIAB alignment by URL, runs the command above
over the slice, and filters the 1000 Genomes callset down to NA12878. It needs
what [Prerequisites](#prerequisites) names, plus `bcftools` for that last step.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_sv_contact_maps.sh
bash build_sv_contact_maps.sh
```

Cut your own slices wider than any window you mean to look at. Depth inside a
sliced region is the source alignment's exactly, and outside one it decays over
a read length, smoothly and with nothing marking the edge. The depth channel is
a picture of depth, so a slice cut to the window draws a copy-number step at
each frame edge that is not in the genome.

## See also

- [](/docs/tutorials/hic_structural_variants)
- [](/docs/tutorials/sv_callset_review)
- [](/docs/tutorials/sv_visualization_cgiab)
- [](/docs/user_guides/hic_track)
- [](/docs/user_guides/sv_visualization)
- [Cue](https://github.com/PopicLab/cue)

## References

- Popic V, et al. Cue: a deep-learning framework for structural variant
  discovery and genotyping. _Nature Methods_ (2023).
  https://doi.org/10.1038/s41592-023-01799-x
- Zook JM, et al. Extensive sequencing of seven human genomes to characterize
  benchmark reference materials. _Scientific Data_ (2016).
  https://doi.org/10.1038/sdata.2016.25
- Sudmant PH, et al. An integrated map of structural variation in 2,504 human
  genomes. _Nature_ (2015). https://doi.org/10.1038/nature15394
