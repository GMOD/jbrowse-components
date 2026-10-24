---
title: Reviewing a whole SV callset
sidebar_label: SV callset review
description:
  Render every junction in a somatic SV callset as a breakpoint image, triage
  the directory, and check the calls against the matched normal
guide_category: Tutorials
tutorial_category: Cancer genomics
---

A somatic structural-variant caller reports junctions, points where two distant
loci are joined, and we'll check each one in the COLO829 callset against the
tumor and normal reads. We:

- render every junction as an image with `jb2export batch`
- render the matched normal the same way, as the control
- sort the calls with the manifest
- render a three-chromosome rearrangement with `jb2export breakpoint`

## Prerequisites

- [`@jbrowse/img`](/docs/jbrowse-img), which puts `jb2export` on your PATH
- a JBrowse for [the last section](#opening-a-call-in-the-browser)
  ([Web](/docs/quickstart_web) or [Desktop](/docs/quickstart_desktop))

<!-- TUTORIAL_INSTALL jbrowse-img START -->

```bash
npm install -g @jbrowse/img
```

<!-- TUTORIAL_INSTALL jbrowse-img END -->

## The data

The COLO829 somatic SV callset comes from the ONT open-data release's
`wf-somatic-variation` run
([Valle-Inclán et al. 2022](https://doi.org/10.1016/j.xgen.2022.100139)),
rehosted alongside the [cancer SV demo](/docs/tutorials/cancer_sv). The first
command downloads the VCF, and every command streams the reads by URL.

| What it is                                | File                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| The callset these commands fetch directly | [COLO829.somatic-sv.vcf.gz](https://jbrowse.org/demos/cancer_sv/COLO829.somatic-sv.vcf.gz) |

<details>
<summary>Read by URL (no download needed)</summary>

| What it is                                                                                                         | File                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The tumor reads the config's `COLO829_tumor_ont` track streams, Oxford Nanopore R10 from the ONT open-data release | [COLO829_tumor.ht.cram](https://ont-open-data.s3.amazonaws.com/colo829_2024.03/wf_somatic_variation/sup/COLO829_tumor.ht.cram)                                  |
| The matched normal the config's `COLO829BL_normal_ont` track streams                                               | [PAU59807.d052sup4305mCG_5hmCGvHg38.bam](https://ont-open-data.s3.amazonaws.com/colo829_2024.03/basecalls/colo829bl/sup/PAU59807.d052sup4305mCG_5hmCGvHg38.bam) |

</details>

## Rendering every tumor junction with jb2export batch

We'll start with `jb2export batch`, which renders one image per record. An event
on one chromosome gets a single row, and a junction between two chromosomes gets
a breakpoint split view with one panel per chromosome.

```bash
curl -fO https://jbrowse.org/demos/cancer_sv/COLO829.somatic-sv.vcf.gz
# --track: the track id, then display settings as key:value pairs
# --flank: bases drawn either side of each breakend
# --manifest: writes manifest.tsv beside the images
jb2export batch --sites COLO829.somatic-sv.vcf.gz \
  --config https://jbrowse.org/demos/cancer_sv/config.json --assembly hg38 \
  --track COLO829_tumor_ont height:240 \
  --outDir tumor --flank 600 --width 1100 --manifest
```

Each image is named `002_chr1_33053494-chr6_2919922_r_0_0.png`: the record's
index in the callset, its coordinates, and the caller's ID where it has one.

For your own callset, point `--config` at a JBrowse config with the assembly and
an alignments track whose reads have an index (`.bai` or `.crai`) beside them.
The VCF's chromosome names must match the assembly's:

```bash
# --dryRun: list each row's file and loci without rendering
# --limit: render only the first rows; a later --resume run keeps them
# --passOnly: drop records the caller filtered out
# --jobs: render processes, about a gigabyte each
jb2export batch --sites calls.vcf.gz \
  --config your/config.json --assembly <assemblyName> --track <trackId> \
  --outDir out --passOnly --limit 20
```

## Rendering the matched normal as the control

Next we'll render the matched normal into a second directory. Each call keeps
its file name across `tumor/` and `normal/`:

```bash
jb2export batch --sites COLO829.somatic-sv.vcf.gz \
  --config https://jbrowse.org/demos/cancer_sv/config.json --assembly hg38 \
  --track COLO829BL_normal_ont height:240 \
  --outDir normal --flank 600 --width 1100 --manifest
```

<Figure caption="Rows of the two batch directories, tumor on the left and normal on the right, each labelled with its file name." src="/img/jbrowse-img/sv_callset_sheet.png" />

The caller filed `009_chr1_168055349-chr19_23850381` as somatic, but the normal
has the same curves, so the junction is germline.

## Sorting the calls with the manifest

Each `manifest.tsv` row describes one image:

- **`links`** counts the split reads with pieces in more than one window. Sort
  `tumor/manifest.tsv` on it to put the unsupported calls first; re-render one
  with a wider `--flank` before calling it false.
- **`alt`** holds, for an SNV, indel, `<DEL>` or `<INS>`, the reads carrying the
  ALT over the reads covering it (`17/41`). A deletion that one alignment holds
  has its reads here and a `links` of zero.
- **`spec`** is the view as a [session spec](/docs/urlparams#session-spec) that
  opens the same windows in JBrowse.
- **`line`** is the record's line in the VCF, to join a row back to the callset.

A dense fan in a region of ragged coverage is usually a repeat, since a read
mismapped there draws a curve like any other.

## Rendering a three-chromosome rearrangement

COLO829's der(3) joins pieces of chr3, chr10 and chr12, and its reads visit all
three. We'll render it with `jb2export breakpoint`, one `--loc` per panel, then
run the same command with `COLO829BL_normal_ont` as the control:

```bash
# featureHeight:super-compact draws each read 1 px tall
jb2export breakpoint \
  --config https://jbrowse.org/demos/cancer_sv/config.json --assembly hg38 \
  --track COLO829_tumor_ont height:130 force:true featureHeight:super-compact \
  --loc chr3:25,358,511-25,359,711 \
  --loc chr10:58,716,962-58,718,162 \
  --loc chr12:72,272,512-72,273,712 \
  --width 1000 --out der3_tumor.png
```

<Figure caption="COLO829's der(3) loci in separate panels with tumor and normal nanopore reads, and the same loci as one reconstructed contig on the right. A dashed connector marks a read with a segment outside the frame." src="/img/jbrowse-img/sv_review_pair.png" />

The [complex rearrangements tutorial](/docs/tutorials/cancer_sv) builds the
reconstructed contig on the right.

## Opening a call in the browser

Take the coordinates from an image's filename, open the
[SV inspector](/docs/user_guides/sv_inspector_view) on the same VCF, and click
through to the breakpoint split view, which adds the gene track and read
details.

## Rendering calls from other SV callers

`jb2export batch` and `jb2export breakpoint` read any caller that writes
breakends or symbolic SVs (such as `<DEL>`) to a VCF:

- cuteSV, Sniffles, pbsv, Delly, Manta and GRIDSS write a VCF that `--sites`
  reads directly.
- LINX writes clusters and chained links as TSVs. Convert the junction columns
  to the six BEDPE columns with `awk` and pass the `.bedpe` file as `--sites`.
- To draw PURPLE's copy-number segments under the reads, convert them to a
  bedGraph, run `bedGraphToBigWig`, and pass the result as `--bigwig`.

A caller that groups one rearrangement's junctions under VCF 4.4's `EVENT` key,
as DRAGEN and the C-GIAB benchmark do, gets the der(3) image from `batch`
itself, which renders each event visiting more than two loci once more as
`event_<n>_<label>`. Severus writes the grouping as `CLUSTERID`, which the
[SV inspector guide](/docs/user_guides/sv_inspector_view#rearrangement-events)
renames to `EVENT`.

## See also

- [](/docs/tutorials/cancer_sv)
- [](/docs/tutorials/sv_visualization_cgiab)
- [](/docs/tutorials/mappability_qc)
- [](/docs/jbrowse-img)
- [](/docs/user_guides/sv_inspector_view)
- [](/docs/user_guides/sv_visualization)

## Citations

- Valle-Inclán et al. (2022).
  [A multi-platform reference for somatic structural variation detection](https://doi.org/10.1016/j.xgen.2022.100139)
