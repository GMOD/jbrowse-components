---
title: Structural variants from Hi-C
sidebar_label: SVs from Hi-C
description:
  Read contact domains and loops off an ENCODE Hi-C matrix, then find a
  translocation by opening two chromosomes in one view
guide_category: Tutorials
tutorial_category: Structural variation
data: hosted
---

**TL;DR:** JBrowse fetches a Hi-C matrix for every _pair_ of regions on screen,
not just each region against itself. Put a chr9 window and a chr22 window in one
linear view and the space between them fills with the contacts between the two,
which in a normal karyotype is background, and in K562 is the Philadelphia
chromosome.

## Prerequisites

- nothing to install to read along: every track is a public ENCODE object served
  with CORS and byte ranges
- for the [scan script](#run-the-scan), `java` and `curl`, which is what
  `juicer_tools` needs; the script downloads `juicer_tools` itself

## What Hi-C measures, and what it looks like

Hi-C counts how often two stretches of the genome are found touching each other
in the nucleus. JBrowse draws the result as a triangle: the diagonal runs along
the top edge, and depth below it is genomic separation, so a bin near the top is
a pair of loci close together and a bin near the bottom is a pair far apart.

[HiGlass](https://higlass.io/) is the reference viewer for Hi-C on its own. A
linear browser puts the matrix in the same coordinate system as genes,
annotations and read-level tracks, which is what the rest of this page reads the
contacts against.

Two features of that picture have names, and ENCODE publishes both as separate
annotation files derived from the same matrix:

- **Contact domains** (also TADs) are the square blocks sitting on the diagonal.
  Inside one, everything contacts everything; across a boundary, contact drops
  sharply. ENCODE calls them with
  [Arrowhead](https://github.com/aidenlab/juicer/wiki/Arrowhead) and ships a
  BEDPE.
- **Loops** are individual bright dots off the diagonal: two specific points
  contacting each other far more than their separation predicts, usually a pair
  of convergent CTCF sites. ENCODE calls them with
  [HiCCUPS](https://github.com/aidenlab/juicer/wiki/HiCCUPS), also a BEDPE.

<Figure src="/img/hic/loops_and_domains.png" caption="Bands on the two corners of one MYC contact domain, with its Arrowhead arc, its bounding HiCCUPS loop and the denser triangle in the matrix all ending on them, under twelve single-cell ATAC pseudobulks." links="Open this view=hic/loops_and_domains" />

A contact domain and the loop at its corner are the same object seen two ways.
The two bands in the figure are the domain's corners, and the block in the
matrix, the Arrowhead arc and the HiCCUPS arc all end on them, because the loop
is what holds the domain together. _MYC_ is at the left one.

All three of those lanes are one experiment read three ways: ENCODE's Arrowhead
and HiCCUPS call sets for GM12878 are derived from the in situ matrix drawn
underneath them, so the arcs cannot agree with the matrix by coincidence and
cannot be checked against it either. That is the reason the page reads GM12878
here rather than any other line: a domain-and-loop figure needs a matrix whose
own published calls are available, and it needs them deep enough that a 600 kb
block has visible edges.

The ATAC lane is the one thing in the frame not derived from the contact map.
GM12878 is a B-lymphoblastoid line, so B-cell accessibility is the nearest
public annotation of which sequence here is regulatory. All twelve lineages are
drawn rather than just the B rows, and each is more accessible inside the domain
than outside it, so the lane says the contacted DNA is regulatory rather than
that it is B-specific.

The window itself is a domain-and-loop pair rather than a slice of chromosome
picked for its genes: a megabase taken at random draws domains wider than the
frame and a fan of arcs with nothing under them. Taking every Arrowhead domain
whose two corners carry a HiCCUPS loop and ranking by that loop's contact count
puts this one near the top, with _MYC_ at its left anchor. The
[scoring script](https://github.com/GMOD/jbrowse-components/blob/main/scripts/hic_pick_loop.py)
prints that ranking and what a candidate window contains.

Which bins the matrix is drawn in decides whether any of it is visible. JBrowse
picks the largest binsize no coarser than twice the current bp-per-pixel, which
at this width is fine enough that the triangle renders as red speckle. The
figure above sets
[`resolutionBias`](/docs/config/linearhicdisplay/#slot-resolutionbias) to `2`,
stepping two levels coarser. If a Hi-C track looks like noise, this is the first
thing to change; see
[adjusting resolution](/docs/user_guides/hic_track#adjusting-resolution).

## Two chromosomes in one view

The matrix is fetched for every pair of displayed regions. With one region on
screen that is just the region against itself; open a second and JBrowse also
fetches the contacts _between_ the two and draws them in the wedge between their
triangles. Nothing needs configuring for this; it falls out of navigating to two
locations at once, which you can do by typing both into the location box
separated by a space.

<Video src="/media/hic/two_regions.mp4" caption="A chr22 window typed into the location box beside a chr9 one, GM12878 above and K562 below: the wedge between the two triangles arrives with the second region." />

That makes a genome browser a translocation detector. Contact frequency decays
with distance along whatever molecule two loci actually sit on, so two regions
on separate chromosomes only touch at the nucleus' low background rate. If they
are fused, they are neighbours, and they contact each other constantly.

K562 is derived from a chronic myeloid leukaemia patient and carries the
Philadelphia chromosome, t(9;22)(q34;q11)
([Rowley 1973](https://doi.org/10.1038/243290a0)), which joins _BCR_ on chr22 to
_ABL1_ on chr9, the fusion imatinib targets. GM12878 is a lymphoblastoid line
with a normal karyotype. Both have deep in situ Hi-C from the same lab and
pipeline in ENCODE, so the two maps are directly comparable.

<Figure src="/img/hic/bcr_abl1_translocation.png" caption="ABL1 (chr9) and BCR (chr22) as two windows in one linear view, GM12878 above and K562 below. The wedge between each panel's own triangles is chr9 against chr22: empty in GM12878, a dense arrowed block in K562." links="Open this view=hic/bcr_abl1_translocation" />

Read the two panels as one comparison. The paired triangles are the same in
both: chr9 and chr22 each fold normally in K562. What differs is the space
between them, empty in one cell line and solid in the other.

## Choosing a control the comparison can rest on

The empty wedge in the top panel does as much work as the dense one below it, so
two choices decide whether the pair says anything, and both go wrong quietly.

**Depth comes first.** ENCODE's GM12878 "supernatant" fraction (`ENCSR730CER`,
the alternative the script carries commented out) is far shallower over this
chromosome pair than the deep in situ file, and a wedge empty because little was
sequenced looks exactly like one empty because there is no translocation. The
figure uses `ENCSR410MDC`. Run the scan as it ships and GM12878 in fact carries
more contact than K562 across the whole chr9-chr22 block; the order inverts only
at the junction bin.

**Then normalization.** Matrix balancing exists to divide out per-bin coverage
differences, and an amplified fusion _is_ a coverage difference. Re-run the scan
below with `NORM=INTER_SCALE` and *ABL1*×*BCR* drops off the top of the table.
Both Hi-C tracks in this demo therefore set
[`selectedNormalization`](/docs/config/linearhicdisplay/#slot-selectednormalization)
to `NONE`. Balanced matrices are what to read domains and loops with;
rearrangements want the raw counts.

The control gets its own ranked list, which the scan prints below the case's.
The bin at its head is hot in GM12878, present in K562, and not a rearrangement,
which is the sort of thing one sample's ranking cannot say about itself.

## Run the scan

The figure shows the translocation; finding it is a dump and a sort.
[`scan_hic_translocation.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/scan_hic_translocation.sh)
pulls the whole chromosome pair out of both files with `juicer_tools`, ranks the
bins, and prints the same bin's value in the control beside each one:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/scan_hic_translocation.sh
bash scan_hic_translocation.sh
```

It needs `java` and `curl` and downloads `juicer_tools` itself; `CASE`, `CTRL`,
`CHR1`, `CHR2`, `RES` and `NORM` are all overridable, so the same scan applies
to any two `.hic` files that hold inter-chromosomal blocks. The top row it
prints pairs _ABL1_ intron 1 with the 5' end of _BCR_, which is the pair of bins
the canonical CML fusion joins rather than the junction itself. Drop `RES` to
`10000` and the top row lands on the junction, _ABL1_ intron 1 against the _BCR_
major breakpoint cluster region.

Further down its list the scan reports a second partner for chr9 elsewhere on
chr22, well clear of the control. K562's karyotype is complex and BCR-ABL1 is
not its only rearrangement, so the ranking is a list of candidates to open
rather than a single answer.

Purpose-built callers do this genome-wide with a trained model rather than one
pair at a time: [EagleC](https://github.com/XiaoTaoWang/EagleC),
[hic_breakfinder](https://github.com/dixonlab/hic_breakfinder) and
[HiNT](https://github.com/parklab/HiNT) are the usual ones. Their output is
BEDPE, which loads here as a
[paired-arc track](/docs/config_guides/hic_track#loops-and-interactions-as-arcs)
next to the matrix it was called from.

## The same control, one scale up

Above the domains and loops of the first figure, the matrix separates into two
interleaved sets of regions that preferentially contact their own kind: the
gene-rich, active A compartment and the inactive B compartment. ENCODE publishes
that call for every Hi-C experiment as a
[compartment eigenvector and a set of subcompartment classes](/docs/user_guides/hic_track#compartments-and-subcompartments),
both derived from the matrix already loaded.

<Figure src="/img/hic/compartment_switch.png" caption="GM12878 and K562 eigenvector tracks over the same window: the TCF4 band falls in opposite compartments in the two lines while the frame edges agree. No contact matrix here, since the eigenvector is that computation over one, published." links="Open this view=hic/compartment_switch" />

The band over _TCF4_ is in the B compartment in GM12878 and the A compartment in
K562, and the sequence either side of it, from the same two files and the same
pipeline, agrees. A difference in one block while its neighbours match is a
difference in the data; one that appears everywhere is a difference in how the
two files were made.

Two things are set up in the figure rather than left to the reader:

- The eigenvector tracks are pinned to one shared scale, because autoscaling
  lets each fill its own lane from its own extremes and the two stop being
  comparable at all.
- An eigenvector names the A compartment only up to a sign, so which sign means
  active is a property of the file rather than a convention. It is read off the
  gene track, since A is the gene-rich compartment by definition.

The
[user guide section](/docs/user_guides/hic_track#compartments-and-subcompartments)
covers both, along with why the subcompartment class numbers cannot be compared
between files on their own.

## Configure it yourself

Every file in this tutorial is a public ENCODE object served with CORS and byte
ranges, so this config works as-is with nothing to download or host. The `.hic`
files are 20 GB and 55 GB and are never fetched whole; only the bins on screen
are requested.

```json addtrack
{
  "type": "HicTrack",
  "trackId": "hic_k562_insitu",
  "name": "K562 in situ Hi-C (ENCODE ENCSR545YBD)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "HicAdapter",
    "uri": "https://encode-public.s3.amazonaws.com/2021/10/28/4d332729-3463-4782-b33c-76e4fa8ff72a/ENCFF080DPJ.hic"
  },
  "displayDefaults": {
    "selectedNormalization": "NONE"
  }
}
```

Use ENCODE's direct S3 URLs rather than the portal's `@@download` links. The
redirect those return is followed fine when a whole file is being read, but
hic-straw's range reader cannot follow a cross-origin redirect and the `.hic`
comes back as a 403. The S3 URL for any ENCODE file is in its metadata under
`cloud_metadata.url`.

The loop and domain BEDPEs need one extra slot each, for opposite reasons:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "hic_gm12878_domains",
  "name": "GM12878 contact domains (Arrowhead)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedpeAdapter",
    "uri": "https://encode-public.s3.amazonaws.com/2021/10/28/467750ae-7aab-47b0-a304-dc5f8dff89f7/ENCFF301CUL.bedpe.gz"
  }
}
```

A contact domain is a `FeatureTrack`, not a paired-arc one. Arrowhead writes
each domain with both BEDPE mates set to the same interval, so an arc would run
from the domain to itself and draw nothing; read as plain features the same file
gives one box per domain, with nested domains stacking into rows. Loops, whose
two mates really are different places, are the paired-arc case. See the
[Hi-C track config guide](/docs/config_guides/hic_track#loops-and-interactions-as-arcs).

To color or filter either track by a column, set
[`columnNames`](/docs/config/bedpeadapter/#slot-columnnames) explicitly. The
adapter otherwise reads names off the file's own header, and juicer writes its
version banner _after_ the defline, so every column past the tenth reads back as
`undefined` and a jexl expression on one silently evaluates against nothing.
HiCCUPS writes 24 columns and Arrowhead 16; only the first ten of either are
positional.

Both callers also leave the standard BEDPE `name` and `score` columns at `.` and
put what they rank by further along, which is why the two are worth naming
rather than assumed: HiCCUPS' is `observed`, and Arrowhead's is a _second_
column called `score`. Values past the tenth column arrive as strings, so
compare them with `>` and `<`, which coerce, rather than with a jexl `==`.

## See also

- [](/docs/user_guides/hic_track)
- [](/docs/config_guides/hic_track)
- [](/docs/tutorials/chromhmm)
- [](/docs/tutorials/cancer_sv)
- [](/docs/user_guides/sv_visualization)
- [HiGlass](https://higlass.io/)
