---
title: Reviewing a whole SV callset
sidebar_label: SV callset review
description:
  Render every junction in a somatic SV callset as a breakpoint image, triage
  the directory, and check the calls against the matched normal
guide_category: Tutorials
tutorial_category: Cancer genomics
---

The COLO829 somatic structural-variant callset lists over a hundred junctions,
and each one is worth checking against the reads. We render every junction as an
image of the reads at both ends with `jb2export batch`, then render the matched
normal the same way as the control.

## Prerequisites

- [`@jbrowse/img`](/docs/jbrowse-img), which puts `jb2export` on your PATH
- a JBrowse for [the last section](#opening-a-call-in-the-browser)
  ([Web](/docs/quickstart_web) or [Desktop](/docs/quickstart_desktop))

```bash
npm install -g @jbrowse/img
```

## Where the data comes from

The COLO829 somatic SV callset comes from the ONT open-data release's
`wf-somatic-variation` run
([Valle-Inclán et al. 2022](https://doi.org/10.1016/j.xgen.2022.100139)),
rehosted alongside the [cancer SV demo](/docs/tutorials/cancer_sv).

- the callset these commands fetch directly:
  https://jbrowse.org/demos/cancer_sv/COLO829.somatic-sv.vcf.gz
- the config the batch renders read tracks from:
  https://jbrowse.org/demos/cancer_sv/config.json
- the tumor reads the config's `COLO829_tumor_ont` track streams, Oxford
  Nanopore R10 from the ONT open-data release:
  https://ont-open-data.s3.amazonaws.com/colo829_2024.03/wf_somatic_variation/sup/COLO829_tumor.ht.cram
- the matched normal the config's `COLO829BL_normal_ont` track streams:
  https://ont-open-data.s3.amazonaws.com/colo829_2024.03/basecalls/colo829bl/sup/PAU59807.d052sup4305mCG_5hmCGvHg38.bam

## COLO829, a tumor callset with a matched normal

**COLO829** is a melanoma cell line with a matched normal, COLO829BL, and a
community reference for somatic structural-variant calling. The
[multi-hop tutorial](/docs/tutorials/cancer_sv) follows one event in this
callset in detail; here we render every junction.

## Rendering every tumor junction with jb2export batch

A breakpoint split view shows the two loci a junction joins as two panels.
`jb2export batch` renders one such view per record:

```bash
curl -fO https://jbrowse.org/demos/cancer_sv/COLO829.somatic-sv.vcf.gz
# --track: the track id, then display settings as key:value pairs
jb2export batch --vcf COLO829.somatic-sv.vcf.gz \
  --config https://jbrowse.org/demos/cancer_sv/config.json --assembly hg38 \
  --track COLO829_tumor_ont height:240 \
  --outDir tumor --flank 600 --width 1100
```

```text
[########################] 100% 135/135
wrote 135/135 images to tumor
```

For your own callset, point `--config` at a JBrowse config that holds the
assembly and an alignments track. `--assembly` is the assembly's `name` in that
config and `--track` the track's `trackId`. The track's reads need their index
beside them (`.bai` or `.crai`), and the VCF's chromosome names must match the
assembly's.

```bash
jb2export batch --vcf calls.vcf.gz \
  --config your/config.json --assembly <assemblyName> --track <trackId> \
  --outDir out
```

A record that fits one window is drawn as a single panel: an insertion names one
locus, and a deletion shorter than `--flank` has both ends in one frame. Callers
write each breakend pair as two records, and `batch` renders the pair once.

`batch` parses the ALT bracket with `@gmod/vcf`, which handles four cases that a
hand-written parser gets wrong without raising an error:

- the replacement string may contain inserted sequence either side of the
  bracket (`GTGATGGATTCA[CHR12:72273112[`)
- callers upper-case the mate contig, and hg38 has no contig named `CHR12`
- `END=` matches inside `CIEND=`, and the first hit wins
- the two records of one breakend pair name the same translocation twice

`batch` writes one image per record, named
`002_chr1_33053494-chr6_2919922_r_0_0.png`. The filename starts with the
record's index, so the directory sorts in callset order, then gives the
coordinates and the caller's ID where the record has one.

A breakend is one base, so `--flank` sets the window drawn around it. `--dryRun`
prints the file and loci of every row and renders nothing, and `--limit 20`
renders the first few, to check the framing before the whole callset.

For a long run:

- `--resume` skips a row whose image is already in `--outDir`. A `--limit` run
  names its images as the whole run will, so the whole run picks them up
- `--manifest` writes `manifest.tsv` beside the images: one row per image with
  its file, its panels' loci, its name, its `EVENT`, and whether it rendered.
  The `line` column is the record's line in the VCF, which joins a row back to
  any column of the callset
- `--passOnly` drops records the caller filtered out. `--limit` takes the first
  N in file order, so on an unfiltered callset the two go together
- `--jobs` sets how many processes render, each about a gigabyte. The default is
  half the cores, up to four. Once the network is the bottleneck, more processes
  do not speed the run up

`batch` streams the reads from the hosted CRAM and fetches a `--config` URL or
`--hub` once. It reports a row it cannot render and continues, and `--resume`
retries that row. Deep long reads can put even a `--flank` window over a track's
size limit, where the app would ask you to press **Force load**; `batch` loads
every panel as if you had.

A dashed connector marks a read with a segment at a locus outside the frame.
COLO829's der(3), a derivative chromosome 3 joined from pieces of chr3, chr10
and chr12, has reads that visit all three loci, so the figure renders that event
with `jb2export breakpoint` and one `--loc` per panel. The matched normal gets
the same `--loc` list and `--width`, and sits beside it as the control:

```bash
jb2export breakpoint \
  --config https://jbrowse.org/demos/cancer_sv/config.json --assembly hg38 \
  --track COLO829_tumor_ont height:130 force:true featureHeight:super-compact \
  --loc chr3:25,358,511-25,359,711 \
  --loc chr10:58,716,962-58,718,162 \
  --loc chr12:72,272,512-72,273,712 \
  --width 1000 --out der3_tumor.png
```

<Figure caption="The three loci of COLO829's der(3), chr3 then chr10 then chr12, at the same width in every panel. The tumor nanopore reads have a solid curve at every breakend and the matched normal has none at them. On the right, the same three loci as one reconstructed contig." src="/img/jbrowse-img/sv_review_pair.png" />

`featureHeight:super-compact` in the `jb2export breakpoint` command draws each
read 1 px tall, which fits six pileups on one screen.

A curve shows that two loci are joined, and the reconstructed contig on the
right shows the order and orientation of the pieces. The
[multi-hop tutorial](/docs/tutorials/cancer_sv) builds that contig from these
reads, and rendering it is another `jb2export` run with the contig as
`--assembly`.

## Rendering the matched normal as the control

Render the matched normal into a second directory:

```bash
jb2export batch --vcf COLO829.somatic-sv.vcf.gz \
  --config https://jbrowse.org/demos/cancer_sv/config.json --assembly hg38 \
  --track COLO829BL_normal_ont height:240 \
  --outDir normal --flank 600 --width 1100
```

A somatic call has curves in `tumor/` and none in `normal/`. The same file name
in both directories puts each call beside its control:

<Figure caption="Three rows of the two batch directories, tumor on the left and the matched normal on the right, each labelled with its file name. The chr7 junction has a fan of curves in the tumor and none in the normal. The chr1 to chr19 junction has curves in both. The chr2 deletion has no curve in either; one tumor read has it as a gap through both panels." src="/img/jbrowse-img/sv_callset_sheet.png" />

The caller filed the chr1 to chr19 junction as somatic, and the normal's curves
say it is germline.

## Reading the tumor and normal images side by side

- A fan of curves at both breakends is the junction as the reads describe it.
- With no curve between the panels, the reads give no support for the caller's
  coordinates: either the call is false, or the breakpoint is far enough off
  that `--flank` missed it. Re-render that row wider.
- Curves in the normal as well mean the variant is germline.
- A dense fan in a region of ragged coverage is usually a repeat. JBrowse draws
  the connectors from the aligner's output, so a read mismapped into a repeat
  adds a confident-looking curve.

Add `--manifest` to both `batch` runs and each directory gets a `manifest.tsv`,
whose `links` column counts the curves in each image: the split reads with
pieces in more than one panel. Sorting `tumor/manifest.tsv` on it puts the calls
no split read joins at the top, and the same column of `normal/manifest.tsv`
says which calls the normal has too. A deletion short enough for one alignment
to hold draws a gap through both panels and no curve, so it counts zero links
although the reads support it.

## Opening a call in the browser

Take the coordinates from an image's filename, open the
[SV inspector](/docs/user_guides/sv_inspector_view) on the same VCF, and click
through to the breakpoint split view, with the gene track and read details
attached.

A junction can be one hop of something larger. COLO829's der(3) is three
junctions across three chromosomes, and
[the cancer SV tutorial](/docs/tutorials/cancer_sv#following-the-chain-across-panels)
follows it from the record the rest of the way.

## Rendering calls from other SV callers

Anything that writes breakends or symbolic SVs to a VCF goes through the same
two commands:

- cuteSV, Sniffles, pbsv, Delly, Manta and GRIDSS write a VCF that `--vcf` reads
  directly.
- LINX writes clusters and chained links as TSVs. Convert the junction columns
  to the six BEDPE columns with `awk` and pass the file as `--bedpe` in place of
  `--vcf`; one `--outDir` per cluster renders a chromothripsis event as one
  directory.
- PURPLE writes copy-number segments. Convert the segment TSV to a bedGraph, run
  `bedGraphToBigWig` on it, and add it as a `--bigwig` to draw the copy number
  under the reads in every image.

The COLO829 callset does not group its junctions, so the der(3) figure above
needed a hand-written `--loc` list. A caller that files the junctions of one
rearrangement under VCF 4.4's `EVENT` key, as DRAGEN and the C-GIAB benchmark
do, gets that image from `batch` itself: every event visiting more than two loci
is drawn once more as `event_<n>_<label>`, one panel per locus in contig order.
Severus writes the same grouping as `CLUSTERID`, and the
[SV inspector guide](/docs/user_guides/sv_inspector_view#rearrangement-events)
has the rename.

Ordering breakends into a derivative chromosome needs allele-specific copy
number and a centromere constraint.
[LINX derives both from PURPLE's purity and ploidy](https://doi.org/10.1016/j.xgen.2022.100112).

## Reproduce it end to end

The commands above run against hosted files. The der(3) figure comes from three
`jb2export` runs: two `breakpoint` renders with one `--loc` per panel, one per
sample, and a plain render of the derivative assembly, which are the
`sv_review_tumor`, `sv_review_normal` and `sv_review_derivative` specs in
[`website/scripts/specs/jbrowse-img.ts`](https://github.com/GMOD/jbrowse-components/blob/main/website/scripts/specs/jbrowse-img.ts).
The contact sheet's `sv_sheet` specs in the same file render three rows of the
two `batch` runs, each with the `--loc` list `batch` builds for that row.

## See also

- [](/docs/tutorials/cancer_sv)
- [](/docs/tutorials/sv_visualization_cgiab)
- [](/docs/tutorials/mappability_qc)
- [](/docs/jbrowse-img)
- [](/docs/user_guides/sv_inspector_view)
- [](/docs/user_guides/sv_visualization)

## Citations

- Valle-Inclán JE, et al. A multi-platform reference for somatic structural
  variation detection. _Cell Genomics_ (2022).
  https://doi.org/10.1016/j.xgen.2022.100139
- Shale C, et al. Unscrambling cancer genomes via integrated analysis of
  structural variation and copy number. _Cell Genomics_ (2022).
  https://doi.org/10.1016/j.xgen.2022.100112
