---
title: Structural variants from Hi-C
sidebar_label: SVs from Hi-C
description:
  Read contact domains and loops off an ENCODE Hi-C matrix, then find a
  translocation by opening two chromosomes in one view
guide_category: Tutorials
tutorial_category: Structural variation
---

**TL;DR:** JBrowse fetches a Hi-C matrix for every _pair_ of regions on screen,
not just each region against itself. Put a chr9 window and a chr22 window in one
linear view and the space between them fills with the contacts between the two —
which in a normal karyotype is background, and in K562 is the Philadelphia
chromosome.

## What Hi-C measures, and what it looks like

Hi-C counts how often two stretches of the genome are found touching each other
in the nucleus. JBrowse draws the result as a triangle: the diagonal runs along
the top edge, and depth below it is genomic separation, so a bin near the top is
a pair of loci close together and a bin near the bottom is a pair far apart.

Two features of that picture have names, and ENCODE publishes both as separate
annotation files derived from the same matrix:

- **Contact domains** (also TADs) are the square blocks sitting on the diagonal.
  Inside one, everything contacts everything; across a boundary, contact drops
  sharply. ENCODE calls them with
  [Arrowhead](https://github.com/aidenlab/juicer/wiki/Arrowhead) and ships a
  BEDPE.
- **Loops** are individual bright dots off the diagonal — two specific points
  contacting each other far more than their separation predicts, usually a pair
  of convergent CTCF sites. ENCODE calls them with
  [HiCCUPS](https://github.com/aidenlab/juicer/wiki/HiCCUPS), also a BEDPE.

<Figure src="/img/hic/loops_and_domains.png" caption="GM12878 in situ Hi-C on 2.4 Mb of chr18 at 10 kb bins, with the Arrowhead contact domains and HiCCUPS loops called from it stacked above. Loops are colored by contact count: the one dark red arc spans the same interval as the matrix's largest block, and its two feet sit on that block's corner. MANE genes on top." links="Open this view=hic/loops_and_domains" />

The dark arc is the point of the figure. A contact domain and the loop at its
corner are the same object seen two ways — the block in the matrix and the arc
above it end at the same two coordinates, because the loop is what holds the
domain together.

Getting that picture at all depends on one setting. JBrowse picks a binsize from
the file's own resolution list, choosing the largest that is no coarser than
twice the current bp-per-pixel. Over 2.4 Mb that lands on 2 kb bins, and at 2 kb
each bin of an inter-chromosomal matrix holds almost nothing, so the triangle
renders as red speckle with no visible domain edges. The figure above sets
[`resolutionBias`](/docs/config/linearhicdisplay/#slot-resolutionbias) to `2`,
stepping two levels coarser to 10 kb, which is where blocks appear. If a Hi-C
track looks like noise, this is the first thing to change — see
[adjusting resolution](/docs/user_guides/hic_track#adjusting-resolution).

## Two chromosomes in one view

The matrix is fetched for every pair of displayed regions. With one region on
screen that is just the region against itself; open a second and JBrowse also
fetches the contacts _between_ the two and draws them in the wedge between their
triangles. Nothing needs configuring for this — it falls out of navigating to
two locations at once, which you can do by typing both into the location box
separated by a space.

That makes a genome browser a translocation detector. Contact frequency decays
with distance along whatever molecule two loci actually sit on, so two regions
on separate chromosomes only touch at the nucleus' low background rate. If they
are fused, they are neighbours, and they contact each other constantly.

K562 is derived from a chronic myeloid leukaemia patient and carries the
Philadelphia chromosome, t(9;22)(q34;q11)
([Rowley 1973](https://doi.org/10.1038/243290a0)), which joins _BCR_ on chr22 to
_ABL1_ on chr9 — the fusion imatinib targets. GM12878 is a lymphoblastoid line
with a normal karyotype. Both have deep in situ Hi-C from the same lab and
pipeline in ENCODE, so the two maps are directly comparable.

<Figure src="/img/hic/bcr_abl1_translocation.png" caption="ABL1 (chr9) and BCR (chr22) open as two windows in one linear view, with GM12878 above and K562 below. Each panel's own two triangles are its intra-chromosomal contacts; the wedge between them is chr9 against chr22. It is empty in GM12878 and carries a dense block in K562, arrowed, whose apex sits where the two highlighted genes meet." links="Open this view=hic/bcr_abl1_translocation" />

Read the two panels as one comparison. The paired triangles are the same in both
— chr9 and chr22 each fold normally in K562. What differs is the space between
them, and that space is not a subtle enrichment: it is empty in one cell line
and solid in the other.

## Why the control matters more than the sample

It would be easy to produce that figure dishonestly, and the two ways to do it
are worth knowing because both fail silently.

**Pick a shallow control and the difference is sequencing depth, not
karyotype.** ENCODE has several GM12878 Hi-C experiments; the "supernatant"
fraction (`ENCSR730CER`) has a couple of hundred occupied bins in this window
with a maximum of 7 contacts. Against K562 it looks like a spectacular result,
but an empty panel is empty because nothing was sequenced. The figure above uses
`ENCSR410MDC`, which is the _deeper_ of the two files — and that is the point.
Run the scan below and the totals come out the wrong way round from what the
figure suggests: across the whole chr9–chr22 block GM12878 has **more** contact
than K562, 2,072,975 against 1,539,676. It is only at the junction bin that the
order inverts, 149 against 161,282. A focal difference against a higher
background is an argument; a difference in totals is not.

**Normalize, and you delete the finding.** Matrix balancing exists to divide out
per-bin coverage differences, and an amplified fusion _is_ a coverage
difference. Under `INTER_SCALE` the K562 peak stops being at *ABL1*×*BCR* and
moves to a mapping artifact at chr9:129.4 Mb × chr22:23.5 Mb that is present in
both cell lines. Both Hi-C tracks in this demo therefore set
[`selectedNormalization`](/docs/config/linearhicdisplay/#slot-selectednormalization)
to `NONE`. Balanced matrices are the right choice for reading domains and loops,
and the wrong choice for reading rearrangements.

That artifact is the reason a single ranked sample proves nothing. It is the
hottest bin in this chromosome pair in GM12878 _and_ near the top in K562, and
it is not a rearrangement. What identifies a breakpoint is a bin hot in the
sample and cold in the control.

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
`CHR1`, `CHR2` and `RES` are all overridable, so the same scan applies to any
two `.hic` files that hold inter-chromosomal blocks. The top row it prints is
`chr9:130,750,000 × chr22:23,000,000` — _ABL1_ intron 1 against the _BCR_ major
breakpoint cluster region, the canonical CML fusion, at 161,282 contacts against
149 in GM12878.

The scan also reports a second partner for chr9 at chr22:16.75 Mb, 22,278
contacts against 10. K562's karyotype is complex and BCR-ABL1 is not its only
rearrangement, which is a good reminder that the ranked list is a list of
candidates rather than a single answer.

Purpose-built callers do this genome-wide with a trained model rather than one
pair at a time — [EagleC](https://github.com/XiaoTaoWang/EagleC),
[hic_breakfinder](https://github.com/dixonlab/hic_breakfinder) and
[HiNT](https://github.com/parklab/HiNT) are the usual ones. Their output is
BEDPE, which loads here as a
[paired-arc track](/docs/config_guides/hic_track#loops-and-interactions-as-arcs)
next to the matrix it was called from.

## Configure it yourself

Every file in this tutorial is a public ENCODE object served with CORS and byte
ranges, so this config works as-is with nothing to download or host. The `.hic`
files are 20 GB and 55 GB and are never fetched whole — only the bins on screen
are requested.

```json
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

```json
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
two mates really are different places, are the paired-arc case — see the
[Hi-C track config guide](/docs/config_guides/hic_track#loops-and-interactions-as-arcs).

For the loops file, set
[`columnNames`](/docs/config/bedpeadapter/#slot-columnnames) explicitly if you
want to color or filter by a column. The adapter otherwise takes column names
from the file's own header line, and juicer writes its version banner _after_
the defline; the last header line therefore has no tab-separated fields, name
resolution gives up, and every extra column reads back as `undefined` — a jexl
expression on `observed` then silently evaluates against nothing. Listing the 24
columns in config skips the guesswork.

## See also

- [](/docs/user_guides/hic_track) — resolution, color scales, normalization, and
  the region-pair mechanism this tutorial leans on
- [](/docs/config_guides/hic_track)
- [](/docs/tutorials/chromhmm), the other ENCODE annotation stacked
  many-rows-deep
- [](/docs/tutorials/cancer_sv), the same translocation question answered from
  reads instead of contacts
- [](/docs/user_guides/sv_visualization)
- [HiGlass](https://higlass.io/) is the reference viewer for Hi-C on its own,
  with matrix-versus-matrix layouts JBrowse has no equivalent of. The trade here
  is the other way round: a linear browser puts the matrix in the same
  coordinate system as genes, annotations and read-level tracks.
