---
title: Structural variants from Hi-C
sidebar_label: SVs from Hi-C
description:
  Read contact domains and loops off an ENCODE Hi-C matrix, then find a
  translocation by opening two chromosomes in one view
guide_category: Tutorials
tutorial_category: Structural variation
---

**TL;DR:** JBrowse fetches a Hi-C matrix for every _pair_ of regions on screen.
Put a chr9 window and a chr22 window in one linear view and the space between
them fills with the contacts between the two: background in a normal karyotype,
and the Philadelphia chromosome in K562.

## Prerequisites

- nothing to install to read along: every track is a public ENCODE object served
  with CORS and byte ranges
- a JBrowse to paste the tracks into ([Web](/docs/quickstart_web) or
  [Desktop](/docs/quickstart_desktop)); every file here is a URL, so Desktop
  needs nothing hosted
- `java`, which `juicer_tools` needs for the [scan script](#run-the-scan); the
  script downloads `juicer_tools` itself
- `curl`, for the same [scan script](#run-the-scan)

## Where the data comes from

Deep in situ Hi-C for GM12878 and K562 from ENCODE, plus ENCODE's own domain,
loop and compartment calls over the same two matrices.

- GM12878 in situ Hi-C (ENCSR410MDC):
  https://encode-public.s3.amazonaws.com/2021/10/28/6f0cc163-86c7-4a68-baac-65af90f5a90d/ENCFF053VBX.hic
- K562 in situ Hi-C (ENCSR545YBD):
  https://encode-public.s3.amazonaws.com/2021/10/28/4d332729-3463-4782-b33c-76e4fa8ff72a/ENCFF080DPJ.hic
- GM12878 contact domains (Arrowhead):
  https://encode-public.s3.amazonaws.com/2021/10/28/467750ae-7aab-47b0-a304-dc5f8dff89f7/ENCFF301CUL.bedpe.gz
- GM12878 loops (HiCCUPS):
  https://encode-public.s3.amazonaws.com/2021/10/28/70e6944c-1212-45f9-855c-dbc74e9a21f5/ENCFF712NKX.bedpe.gz
- GM12878 compartment eigenvector:
  https://encode-public.s3.amazonaws.com/2021/10/28/5b488af0-df49-4b9b-9feb-8ad671b7eaef/ENCFF661LPK.bigWig
- K562 compartment eigenvector:
  https://encode-public.s3.amazonaws.com/2021/10/28/1180b7b2-99fd-429a-bfe1-f76cc8aa751a/ENCFF699RSL.bigWig
- pseudobulk ATAC-seq by blood lineage beside the MYC domain (10x 5k-PBMC,
  SnapATAC2), rehosted for the
  [scATAC pseudobulk tutorial](/docs/tutorials/scatac_pseudobulk). One bigWig
  per cell type, so CD14 monocytes are
  https://jbrowse.org/demos/scatac_pbmc5k/CD14_Mono.bw and naive CD4 T cells
  https://jbrowse.org/demos/scatac_pbmc5k/CD4_Naive.bw

## What Hi-C measures, and what it looks like

Hi-C counts how often two stretches of the genome touch in the nucleus. JBrowse
draws the result as a triangle: the diagonal runs along the top edge, and depth
below it is genomic separation. Two features of that picture have names, and
ENCODE publishes both as annotation files derived from the matrix:

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

The loop is what holds the domain together, so the block in the matrix, the
Arrowhead arc and the HiCCUPS arc all end on the domain's two corners. _MYC_ is
at the left one. The ATAC lane comes from outside the contact map: GM12878 is a
B-lymphoblastoid line, and all twelve lineages are more accessible inside the
domain than outside it.

The window was chosen by taking every Arrowhead domain whose two corners carry a
HiCCUPS loop and ranking by that loop's contact count; the
[scoring script](https://github.com/GMOD/jbrowse-components/blob/main/scripts/hic_pick_loop.py)
prints that ranking.

JBrowse picks the largest binsize no coarser than twice the current
bp-per-pixel, which at this width renders the triangle as red speckle. The
figure sets
[`resolutionBias`](/docs/config/linearhicdisplay/#slot-resolutionbias) to `2`,
stepping two levels coarser. If a Hi-C track looks like noise, change this
first; see
[adjusting resolution](/docs/user_guides/hic_track#adjusting-resolution).

## Two chromosomes in one view

The matrix is fetched for every pair of displayed regions. Open a second region
and JBrowse also fetches the contacts _between_ the two, drawn in the wedge
between their triangles. Type both locations into the location box, separated by
a space.

<Video src="/media/hic/two_regions.mp4" caption="A chr22 window typed into the location box beside a chr9 one, GM12878 above and K562 below: the wedge between the two triangles arrives with the second region." />

Contact frequency decays with distance along whatever molecule two loci sit on,
so two regions on separate chromosomes only touch at background rate. If they
are fused, they contact each other constantly.

K562 carries the Philadelphia chromosome, t(9;22)(q34;q11)
([Rowley 1973](https://doi.org/10.1038/243290a0)), joining _BCR_ on chr22 to
_ABL1_ on chr9. GM12878 has a normal karyotype. Both have deep in situ Hi-C from
the same ENCODE lab and pipeline.

<Figure src="/img/hic/bcr_abl1_translocation.png" caption="ABL1 (chr9) and BCR (chr22) as two windows in one linear view, GM12878 above and K562 below. The wedge between each panel's own triangles is chr9 against chr22: empty in GM12878, a dense arrowed block in K562." links="Open this view=hic/bcr_abl1_translocation" />

The paired triangles are the same in both panels: chr9 and chr22 each fold
normally in K562.

## Depth and normalization

**Depth.** ENCODE's GM12878 "supernatant" fraction (`ENCSR730CER`, which the
script carries commented out) is much shallower over this chromosome pair than
the in situ file the figure uses, `ENCSR410MDC`, and a wedge empty for want of
reads looks the same as one empty for want of a translocation. As shipped, the
scan finds GM12878 carrying more contact than K562 across the whole chr9-chr22
block, with the order inverting at the junction bin.

**Normalization.** Matrix balancing divides out per-bin coverage differences,
and an amplified fusion is one. Re-run the scan with `NORM=INTER_SCALE` and
*ABL1*×*BCR* drops off the top of the table. Both Hi-C tracks here set
[`selectedNormalization`](/docs/config/linearhicdisplay/#slot-selectednormalization)
to `NONE`: balanced matrices for domains and loops, raw counts for
rearrangements.

The scan prints the control's own ranked list below the case's. The bin at its
head is hot in GM12878, present in K562, and not a rearrangement.

## Run the scan

Finding the translocation is a dump and a sort, one dump per file:

<!-- from: scripts/scan_hic_translocation.sh -->

```bash
# `observed NONE` asks for raw counts. NONE rather than a balanced vector for
# the reason above: balancing divides out per-bin coverage differences, and an
# amplified fusion is one, so a balanced dump removes what the scan looks for.
# A balanced vector is stored only at the coarser bin sizes, so asking for one
# at a fine resolution comes back as an empty file rather than an error.
# BP asks for base-pair bins rather than restriction fragments, and the number
# after it is the bin size.
# -Xmx4g because a whole chromosome pair does not fit in the default heap.
java -Xmx4g -jar juicer_tools.jar dump observed NONE \
  sample.hic chr9 chr22 BP 250000 sample.chr9_chr22.txt
```

Three columns come back: bin1 start, bin2 start, contact count. Rank the
sample's bins and read the control's value for each.
[`scan_hic_translocation.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/scan_hic_translocation.sh)
does exactly that:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/scan_hic_translocation.sh
bash scan_hic_translocation.sh
```

Underneath it, that is one dump per file and a sort:

<!-- from: scripts/scan_hic_translocation.sh -->

```bash
# one inter-chromosomal block at one bin size. An empty output file means this
# .hic stores neither the pair nor a KR vector at that resolution; read its
# footer.
java -Xmx4g -jar juicer_tools.jar dump observed KR \
  case.hic chr9 chr22 BP 25000 case.txt

# bin1, bin2, contacts. awk and not `| head`, which closes the pipe and kills
# sort with SIGPIPE mid-table under `set -o pipefail`.
sort -k3,3 -rn case.txt | awk 'NR <= 10'
```

`CASE`, `CTRL`, `CHR1`, `CHR2`, `RES` and `NORM` are all overridable, so the
same scan applies to any two `.hic` files that hold inter-chromosomal blocks.
The top row pairs _ABL1_ intron 1 with the 5' end of _BCR_. Drop `RES` to
`10000` and it lands on the junction itself, _ABL1_ intron 1 against the _BCR_
major breakpoint cluster region. Further down, a second chr9 partner elsewhere
on chr22 sits well clear of the control; the ranking is a list of candidates to
open.

Purpose-built callers do this genome-wide with a trained model:
[EagleC](https://github.com/XiaoTaoWang/EagleC),
[hic_breakfinder](https://github.com/dixonlab/hic_breakfinder) and
[HiNT](https://github.com/parklab/HiNT) are the usual ones. Their output is
BEDPE, which loads here as a
[paired-arc track](/docs/config_guides/hic_track#loops-and-interactions-as-arcs)
next to the matrix it was called from.

## A and B compartments

Above domains and loops, the matrix separates into two interleaved sets of
regions that contact their own kind: the gene-rich, active A compartment and the
inactive B compartment. ENCODE publishes that call for every experiment as a
[compartment eigenvector and a set of subcompartment classes](/docs/user_guides/hic_track#compartments-and-subcompartments).

<Figure src="/img/hic/compartment_switch.png" caption="GM12878 and K562 eigenvector tracks over the same window: the TCF4 band falls in opposite compartments in the two lines while the frame edges agree." links="Open this view=hic/compartment_switch" />

The band over _TCF4_ is in the B compartment in GM12878 and the A compartment in
K562, and the sequence either side of it agrees. Two settings in the figure:

- The eigenvector tracks are pinned to one shared scale
- An eigenvector names the A compartment only up to a sign, so which sign is
  active is read off the gene track, A being the gene-rich compartment

The
[user guide section](/docs/user_guides/hic_track#compartments-and-subcompartments)
covers both, and why subcompartment class numbers cannot be compared between
files.

## Configuring the Hi-C tracks

The `.hic` files are 20 GB and 55 GB, and only the bins on screen are requested.

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

Use ENCODE's direct S3 URLs. hic-straw's range reader cannot follow the
cross-origin redirect the portal's `@@download` links return, and the `.hic`
comes back as a 403. The S3 URL for any ENCODE file is in its metadata under
`cloud_metadata.url`.

The loop and domain BEDPEs each need one extra slot:

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

Arrowhead writes each domain with both BEDPE mates set to the same interval, so
as a `FeatureTrack` the file gives one box per domain, nested domains stacking
into rows. Loops, whose mates differ, are the paired-arc case. See the
[Hi-C track config guide](/docs/config_guides/hic_track#loops-and-interactions-as-arcs).

To color or filter either track by a column, set
[`columnNames`](/docs/config/bedpeadapter/#slot-columnnames) explicitly. Juicer
writes its version banner after the defline, so names read off the header make
every column past the tenth `undefined`, and a jexl expression on one silently
evaluates against nothing. HiCCUPS writes 24 columns and Arrowhead 16.

Both callers leave `name` and `score` at `.` and put what they rank by further
along: HiCCUPS' is `observed`, Arrowhead's a second column called `score`.
Values past the tenth column arrive as strings, so compare with `>` and `<`,
which coerce, rather than `==`.

## See also

- [](/docs/user_guides/hic_track)
- [](/docs/config_guides/hic_track)
- [](/docs/tutorials/chromhmm)
- [](/docs/tutorials/cancer_sv)
- [](/docs/user_guides/sv_visualization)
- [HiGlass](https://higlass.io/)
