---
title: Structural variants from Hi-C
sidebar_label: SVs from Hi-C
description:
  Find a translocation in ENCODE Hi-C by opening two chromosomes in one view,
  and read the domain, loop and compartment calls over the same matrices
guide_category: Tutorials
tutorial_category: Structural variation
---

Two chromosomes joined by a translocation touch along the join, so Hi-C reads
linking them run far above background. We look for the Philadelphia chromosome,
the _BCR_-_ABL1_ fusion, in the Hi-C of the K562 leukemia line against GM12878's
normal karyotype. JBrowse fetches a Hi-C matrix for every _pair_ of regions on
screen, so a chr9 window and a chr22 window in one linear view draw the contacts
between the two. Over the same matrices, we then compare the two lines'
compartment calls at _EBF1_, a gene B cells depend on for their identity.

## Prerequisites

- a JBrowse to paste the tracks into ([Web](/docs/quickstart_web) or
  [Desktop](/docs/quickstart_desktop))
- `java`, which `juicer_tools` needs for the
  [scan script](#ranking-chr9-chr22-contact-bins-with-juicer_tools); the script
  downloads `juicer_tools` itself
- `curl`, for the same
  [scan script](#ranking-chr9-chr22-contact-bins-with-juicer_tools)

## Where the data comes from

Deep in situ Hi-C for GM12878 and K562 from ENCODE, plus ENCODE's domain, loop
and compartment calls over the same two matrices.

Nothing to download: the track configs and the scan script below read these
files by URL.

<details>
<summary>The files</summary>

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

</details>

## Reading a Hi-C contact map: the triangle, domains and loops

Hi-C counts how often two stretches of the genome touch in the nucleus. JBrowse
draws the result as a triangle: the diagonal runs along the top edge, and depth
below it is genomic separation. Two features of that picture have names, and
ENCODE publishes both as annotation files derived from the matrix:

- **Contact domains** (also called topologically associating domains, TADs) are
  the square blocks sitting on the diagonal. Inside one, everything contacts
  everything; across a boundary, contact drops sharply. ENCODE calls them with
  [Arrowhead](https://github.com/aidenlab/juicer/wiki/Arrowhead) and ships a
  BEDPE.
- **Loops** are individual bright dots off the diagonal: two specific points
  contacting each other far more than their separation predicts, usually a pair
  of convergent CTCF sites. ENCODE calls them with
  [HiCCUPS](https://github.com/aidenlab/juicer/wiki/HiCCUPS), also a BEDPE.

Over a wide window the triangle can render as red speckle. If a Hi-C track looks
like noise, change
[`resolutionBias`](/docs/config/linearhicdisplay/#slot-resolutionbias) first,
which steps to coarser bins
([adjusting resolution](/docs/user_guides/hic_track#adjusting-resolution)).

## Loading the GRCh38 assembly

ENCODE aligned both Hi-C libraries to GRCh38, so we load that assembly before
adding any track.

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

## Adding the Hi-C and contact-domain tracks

The `.hic` files are 20 GB and 55 GB, and JBrowse requests only the bins on
screen.

```json addtrack
{
  "trackId": "hic_k562_insitu",
  "name": "K562 in situ Hi-C (ENCODE ENCSR545YBD)",
  "uri": "https://encode-public.s3.amazonaws.com/2021/10/28/4d332729-3463-4782-b33c-76e4fa8ff72a/ENCFF080DPJ.hic",
  "assemblyNames": ["hg38"],
  "displayDefaults": {
    "selectedNormalization": "NONE"
  }
}
```

```json addtrack
{
  "trackId": "hic_gm12878_insitu",
  "name": "GM12878 in situ Hi-C, deep (ENCODE ENCSR410MDC)",
  "uri": "https://encode-public.s3.amazonaws.com/2021/10/28/6f0cc163-86c7-4a68-baac-65af90f5a90d/ENCFF053VBX.hic",
  "assemblyNames": ["hg38"],
  "displayDefaults": {
    "selectedNormalization": "NONE"
  }
}
```

Use ENCODE's direct S3 URLs. hic-straw's range reader cannot follow the
cross-origin redirect the portal's `@@download` links return, and the `.hic`
comes back as a 403. The S3 URL for any ENCODE file is in its metadata under
`cloud_metadata.url`.

The domain BEDPE needs one extra slot, `"type": "FeatureTrack"`:

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

Arrowhead writes each domain with both BEDPE ends set to the same interval, so
as a `FeatureTrack` the file gives one box per domain, nested domains stacking
into rows. Loops, whose mates differ, are the paired-arc case in the
[Hi-C track config guide](/docs/config_guides/hic_track#loops-and-interactions-as-arcs);
the whole GM12878 loops track is `hic_gm12878_loops` in
https://jbrowse.org/code/jb2/main/test_data/config_demo.json.

To color or filter either track by a column, set
[`columnNames`](/docs/config/bedpeadapter/#slot-columnnames)
explicitly.[^juicer]

## Opening chr9 and chr22 in one view to look for the translocation

Type both locations into the location box, separated by a space:
`chr9:129,730,000-131,730,000 chr22:22,285,000-24,285,000`.

<Video src="/media/hic/two_regions.mp4" caption="A chr22 window entered into the location box beside a chr9 one, GM12878 above and K562 below: the wedge between the two triangles appears with the second region." />

Two regions on separate chromosomes touch at background rate. If they are fused,
they contact each other constantly.

K562 has the Philadelphia chromosome, t(9;22)(q34;q11)
([Rowley 1973](https://doi.org/10.1038/243290a0)), joining _BCR_ on chr22 to
_ABL1_ on chr9.

<Figure src="/img/hic/bcr_abl1_translocation.png" caption="ABL1 (chr9) and BCR (chr22) as two windows in one linear view, GM12878 above and K562 below. The wedge between the two panels' triangles is chr9 against chr22: empty in GM12878, a dense block under the arrow in K562." links="Open this view=hic/bcr_abl1_translocation" />

The domain boundaries inside each window line up between the two lines, so chr9
and chr22 each fold normally in K562.

## Choosing the control and normalization for the translocation scan

**Control depth.** The scan script below compares a case `.hic` against a
control, ENCODE's deep GM12878 in situ file `ENCSR410MDC` by default. The script
leaves the much shallower GM12878 "supernatant" fraction, `ENCSR730CER`,
commented out, because a wedge empty for want of reads looks the same as one
empty for want of a translocation. With the deep file, the scan finds GM12878
with more contact than K562 across the whole chr9-chr22 block except the
junction bin, where the order inverts.

**Normalization.** Matrix balancing divides out per-bin coverage differences,
and an amplified fusion is such a difference, so balancing hides it. Re-run the
scan with `NORM=INTER_SCALE` and _ABL1_×_BCR_ drops off the top of the table.
Balanced matrices suit domains and loops and raw counts suit rearrangements, so
both Hi-C tracks here set
[`selectedNormalization`](/docs/config/linearhicdisplay/#slot-selectednormalization)
to `NONE`.

The scan prints a ranked list for the control below the one for the case. The
top bin in the control list is hot in both GM12878 and K562, so it is a
reproducible mapping artifact and not a rearrangement.

## Ranking chr9-chr22 contact bins with juicer_tools

Finding the translocation takes one dump per `.hic` file and a sort. Dump the
raw contact counts between the two chromosomes:

<!-- from: scripts/scan_hic_translocation.sh -->

```bash
# NONE: raw counts, for the reason above
# BP 250000: 250 kb base-pair bins
# -Xmx4g: a whole chromosome pair needs more than the default heap
java -Xmx4g -jar juicer_tools.jar dump observed NONE \
  case.hic chr9 chr22 BP 250000 case.txt
```

An empty output file means the `.hic` stores nothing at that resolution, or has
no vector for the normalization you asked for (a file may store those only at
coarser bins). The file has three columns: bin1 start, bin2 start and contact
count. Rank the bins by count:

<!-- from: scripts/scan_hic_translocation.sh -->

```bash
# awk in place of head, which would kill sort with SIGPIPE under pipefail
sort -k3,3 -rn case.txt | awk 'NR <= 10'
```

[`scan_hic_translocation.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/scan_hic_translocation.sh)
dumps the case and the control, ranks the case bins and prints the control count
beside each:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/scan_hic_translocation.sh
bash scan_hic_translocation.sh
```

Override `CASE`, `CTRL`, `CHR1`, `CHR2`, `RES` and `NORM` to scan any two `.hic`
files that hold inter-chromosomal blocks. Reading the output:

- The top row pairs _ABL1_ intron 1 with the 5' end of _BCR_.
- `RES=10000` lands on the junction itself, _ABL1_ intron 1 against the _BCR_
  major breakpoint cluster region.
  [The K562 fusions tutorial](/docs/tutorials/k562_fusions) places the DNA break
  of the same fusion in that intron.
- A second chr9-chr22 bin further down also sits well clear of the control, so
  treat the ranking as a list of candidates to open.

Purpose-built callers scan the whole genome:
[EagleC](https://github.com/XiaoTaoWang/EagleC),
[hic_breakfinder](https://github.com/dixonlab/hic_breakfinder) and
[HiNT](https://github.com/parklab/HiNT). Each writes BEDPE, which loads here as
a
[paired-arc track](/docs/config_guides/hic_track#loops-and-interactions-as-arcs)
next to the matrix it was called from.

## A and B compartments at EBF1 in GM12878 and K562

The genome sorts into two interleaved sets of regions, the gene-rich, active A
compartment and the inactive B compartment, and each region contacts regions in
the same set most. ENCODE publishes that call for every experiment as a
[compartment eigenvector and a set of subcompartment classes](/docs/user_guides/hic_track#compartments-and-subcompartments).

We load each line's eigenvector, a score per bin whose sign marks the
compartment, as a bigWig. Both tracks pin `scales.y`, the y scale, to one
symmetric range, so they compare directly and 0, where the compartment flips,
sits in the middle of each:

```json addtrack
{
  "trackId": "hic_gm12878_compartments",
  "name": "GM12878 compartment eigenvector (ENCFF661LPK)",
  "uri": "https://encode-public.s3.amazonaws.com/2021/10/28/5b488af0-df49-4b9b-9feb-8ad671b7eaef/ENCFF661LPK.bigWig",
  "assemblyNames": ["hg38"],
  "displayDefaults": {
    "scales": { "y": { "domainMin": -0.012, "domainMax": 0.012 } }
  }
}
```

The K562 track uses
`https://encode-public.s3.amazonaws.com/2021/10/28/1180b7b2-99fd-429a-bfe1-f76cc8aa751a/ENCFF699RSL.bigWig`.
On an eigenvector track already open, **Y axis... → Range** writes the same two
ends. Open both eigenvector tracks over _EBF1_ on chr5:

<Figure src="/img/hic/compartment_switch.png" caption="GM12878 and K562 eigenvector tracks over the same window: the band at EBF1 is in opposite compartments in the two lines while the frame edges agree." links="Open this view=hic/compartment_switch" />

The band over _EBF1_ is in the A compartment in GM12878, a B-lymphoblastoid
line, and the B compartment in K562, an erythroleukemia, while the sequence
either side of it agrees. The sign of an eigenvector is arbitrary, so use the
gene track to tell which sign is A, the gene-rich compartment.

## See also

- [](/docs/user_guides/hic_track)
- [](/docs/config_guides/hic_track)
- [](/docs/tutorials/chromhmm)
- [](/docs/tutorials/cancer_sv)
- [](/docs/tutorials/k562_fusions)
- [](/docs/user_guides/sv_visualization)

## External links

- [HiGlass](https://higlass.io/)

[^juicer]:
    Juicer writes a version banner after the header line, so column names read
    from the header come out `undefined` past the tenth column, and a jexl
    expression on one of them matches nothing and reports no error. HiCCUPS
    writes 24 columns and Arrowhead 16, and both leave `name` and `score` at `.`
    and put what they rank by further along: `observed` for HiCCUPS, a second
    column called `score` for Arrowhead. Values past the tenth column arrive as
    strings, so compare with `>` and `<`, which coerce.
