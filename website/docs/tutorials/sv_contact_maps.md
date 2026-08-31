---
title: Structural variants from read-pair channels
sidebar_label: SVs (read-pair channels)
description:
  Sort NA12878's read pairs into Cue's channels, read an inversion and a
  duplication off them as arcs and as contact maps, and check both against the
  reads they came from
guide_category: Tutorials
tutorial_category: Structural variation
data: hosted
---

**TL;DR:** Cue turns an alignment into a picture and reads structural variants
off it: every read pair becomes one mark joining the two places its ends landed,
sorted into a channel by how the two ends face, beside a channel of read depth.
One alignments track draws all of that as coverage plus arcs, one band per
orientation class, with the ruler as the scale. The same channels binned are
contact matrices, so `juicer_tools` and the Hi-C track put Cue's own image in
the browser beside it.

## Prerequisites

- nothing to install to read along: every track below is hosted
- a JBrowse to paste the tracks into ([Web](/docs/quickstart_web) or
  [Desktop](/docs/quickstart_desktop)); every file here is a URL, so Desktop
  needs nothing hosted
- `samtools` and `python3`, for the [one command](#building-the-four-channels)
  that turns your own reads into contact channels
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
- the four contact channels built from it:
  https://jbrowse.org/demos/sv_contact_maps/discordant.hic,
  https://jbrowse.org/demos/sv_contact_maps/same_strand.hic,
  https://jbrowse.org/demos/sv_contact_maps/outward.hic and
  https://jbrowse.org/demos/sv_contact_maps/depth_difference.hic
- NA12878's own non-reference calls out of that map:
  https://jbrowse.org/demos/sv_contact_maps/NA12878.1000g_sv.vcf.gz

## Where the encoding comes from

Cue ([Popic et al. 2023](https://doi.org/10.1038/s41592-023-01799-x)) genotypes
structural variants with a neural network. A window of the genome becomes an
image. Pixel (a, b) counts the read pairs and split reads with one end in bin a
and the other in bin b, so a rearrangement that joins two distant places puts a
bright spot off the diagonal at exactly those two coordinates. A last channel
holds no pairs at all, only read depth, which is where a copy-number change
shows up.

Coloring by pair orientation is the sort into channels; the read-connection arcs
are the marks joining a pair's two ends; the coverage band is the depth channel.

## The four channels as one track

Group the reads by pair orientation, draw the pairs as arcs under each group's
coverage, and hide the pileup:

```json addtrack
{
  "type": "AlignmentsTrack",
  "trackId": "na12878_sv_channels",
  "name": "NA12878 SV channels: depth and pairs by orientation",
  "assemblyNames": ["hg19"],
  "adapter": {
    "type": "BamAdapter",
    "uri": "https://jbrowse.org/demos/sv_contact_maps/NA12878.sv_contact_maps.bam"
  },
  "displayDefaults": {
    "showPileup": false,
    "coverageHeight": 40,
    "readConnections": "arc",
    "readConnectionsDown": true,
    "readConnectionsHeight": 110,
    "drawProperPairArcs": false,
    "groupBy": { "type": "pairOrientation" },
    "linkedReads": "normal"
  }
}
```

**Track menu → Read connections → SV channels (pairs by orientation)** writes
four of those keys in one click: **Group by → Pair orientation**, **Read
connections → Show read arcs**, **Arc / read cloud band options → Show
concordant-pair arcs** unchecked, and **Show... → Show pileup** off. `colorBy`
is absent on purpose: with the pileup hidden there are no read fills to paint,
and the arcs take their color from `arcColorByType`.

Four bands come out, one per orientation class, each with its own coverage curve
and its own arcs:

- **LR**, the ordinary facing. Its coverage is the read depth of the library,
  and with concordant arcs off the only arcs left in it are pairs whose ends are
  farther apart than the insert-size distribution allows: the deletion
  signature, and Cue's split-read-and-read-pair channel.
- **RL**, mates pointing away from each other: the tandem-duplication signature.
- **RR** and **LL**, both mates on one strand: the inversion signature, one band
  per strand.

An arc's feet are on the ruler. It stands on the two places the pair's ends
aligned, and its width is the distance between them; the height only spreads the
arcs so they can be told apart, and clamps at the band's edge for a pair wider
than the band is tall. `linkedReads` also connects a split read's segments;
these novoalign alignments carry no `SA` tags, so the demo has none to draw.

## Building the four channels

Cue's network sees the channels binned, as a square image per channel. A binned
channel whose pixel (a, b) counts something joining bin a to bin b is a contact
matrix, and JBrowse draws those from `.hic` files. `sv_contact_maps.py` streams
`samtools view` once, writes each pair into whichever channels it belongs to,
and hands each channel to `juicer_tools` to be packed into a `.hic`:

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
a kilobase is clear of them.

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
is the one setting these tracks cannot do without. A channel built from read
pairs is nearly empty, so its brightest cell sits far below where a linear ramp
expects the top of the scale to be, and the track draws as a blank triangle with
the answer in it.

A contact track has its own geometry, and it is the arcs' geometry folded. The
track draws the cell joining bins a and b at the x midway between them and as
far below the diagonal as half the distance between them, so a cell's two upper
edges run back up to the diagonal at exactly a and b.

## The inversion

The demo opens on a heterozygous inversion NA12878 carries on chromosome 7,
called by delly in the 1000 Genomes map. Both breakpoints are on screen and
marked with a band, with the channels track under the same-strand contact
channel built from the same reads.

<Figure src="/img/sv_contact_maps/inversion.png" caption="One inversion call in NA12878, with the same-strand contact channel over the four channels as arcs. The RR and LL bands each hold one bundle of arcs spanning the two marked breakpoints and nothing else; the LR band holds the library's scatter of long fragments and RL is empty. Above them, each bundle binned is one cell." links="Open this view=sv_contact_maps/inversion" />

The two bundles reach the same right breakpoint, and their left feet sit either
side of a hole in the coverage of the LR band, a few kilobases the alignment
carries no reads over. The callset says as much in the record's own name: `CINV`
is a complex inversion, and the call carries a confidence interval on each end.

How many pairs a cell holds is a number, and `juicer_tools` will read it back
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
puts the inversion's cells at the top, and the first two columns are the
coordinates the figure drew each one at.

## The duplication that only depth sees

The other two loci in the slice are duplications, and the 1000 Genomes map calls
both of them with genome-STRiP, which works from read depth alone. Open the one
on chromosome 5.

<Figure src="/img/sv_contact_maps/depth_only_duplication.png" caption="A genome-STRiP duplication call with no read-pair evidence under it: the RL band a tandem duplication's junction pairs would fill is empty across the call, and so are both same-strand bands. Depth alone marks it, and the raised block does not line up with the breakpoints." links="Open this view=sv_contact_maps/depth_only_duplication" />

A duplication that landed somewhere else in the genome, or one whose junction
sits inside a repeat long enough to swallow a fragment, leaves the same trace: a
copy-number change with no junction under it.

<Figure src="/img/sv_contact_maps/depth_channel.png" caption="The depth channel alone over the same duplication, framed wider, with the coverage lane under it. The call's own breakpoints stand at the top corners of a pale wedge, with the channel's brightest cells on either side of it." links="Open this view=sv_contact_maps/depth_channel" />

Cue's depth channel is not the coverage curve but its self-comparison: cell (a,
b) is the difference in depth between bin a and bin b. A bin inside an interval
of changed copy number differs from the bins outside it and least from the bins
inside it with it, which fills the two fields either side and leaves the wedge
between the breakpoints pale.

<Figure src="/img/sv_contact_maps/depth_channel_wide.png" caption="The same channel across the whole slice. Two other loci swing the ramp about as hard as the call, with nothing in the SV track over either one." links="Open this view=sv_contact_maps/depth_channel_wide" />

The demo carries a second depth-only duplication on chromosome 17 to open the
same way; it sits in a field of pseudogenes whose own depth swings as hard as
the call does, which is what this channel looks like where mappability is
against you throughout, not just at one other locus.

## Back to the reads

The channels are counts of read pairs, so the last step is to look at the pairs.
Zoom to one of the inversion's breakpoints on the reads track and color the
pileup by pair orientation from the track menu, **Color by... → Pair
orientation**.

<Figure src="/img/sv_contact_maps/breakpoint_reads.png" caption="The pileup at the inversion's right breakpoint, colored by pair orientation. Two same-strand classes meet at one column, one on each side of it, with the library's ordinary pairs drawn in grey through both." links="Open this view=sv_contact_maps/breakpoint_reads" />

The colored reads are the ones the RR and LL bands drew arcs for. Which class a
read falls in swaps at one column, because a pair reaching across the breakpoint
from the left has both ends on one strand and a pair reaching across from the
right has both ends on the other. The grey reads running through both sides are
the ordinary pairs, and they are unbroken, which is what a heterozygous call
looks like from underneath.

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
