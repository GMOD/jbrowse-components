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
loci are joined, and a callset can hold hundreds of them. Opening each in a
browser is slow, so we render every junction in the COLO829 callset to an image
of the tumor reads, with the matched normal beside it, and triage the images.
We:

- render every junction as a breakpoint image with `jb2export batch`, from the
  tumor reads and from the matched normal's
- review the calls as a queue of cards, grouped by split-read support, with a
  verdict on each
- render a three-chromosome rearrangement with `jb2export breakpoint`
- open a call in JBrowse from its manifest row

## Prerequisites

- [`@jbrowse/img`](/docs/jbrowse-img), which puts `jb2export` on your PATH
- [variant-review-portal](https://github.com/cmdcolin/variant-review-portal),
  cloned and installed with `pnpm install`, for the review page
- a JBrowse for [the last section](#opening-a-call-in-the-browser)
  ([Web](/docs/quickstart_web) or [Desktop](/docs/quickstart_desktop))

<!-- BEGIN GENERATED TUTORIAL_INSTALL jbrowse-img -->

```bash
npm install -g @jbrowse/img@next
```

<!-- END GENERATED TUTORIAL_INSTALL jbrowse-img -->

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

## Render every tumor junction with jb2export batch

We'll start with `jb2export batch`, which renders one image per record: a linear
view with the record's windows side by side in one row, whether its ends are on
one chromosome or two.

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

## Render the matched normal as the control

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
has split reads joining the same two ends, so the junction is germline.

## Review the calls as a queue

Next we'll build a review page from the two directories with
variant-review-portal. Each call becomes a card with its tumor and normal
images, the record's VCF columns, nanomonsv's read counts beside the manifest's,
and a link that opens the same windows in JBrowse:

```bash
# --images: a name for the reads in a directory's images, then the directory;
#   the first is the sample under review and the rest are its controls
# --support: the FORMAT keys nanomonsv counts supporting reads under, the
#   tumor's (AD) first and the normal's (NAD) after
# --jbrowse, --config: the JBrowse and config each card's link opens
node variant-review-portal/bin/make-portal.mjs \
  --vcf COLO829.somatic-sv.vcf.gz \
  --images tumor=tumor --images normal=normal \
  --support AD,NAD \
  --jbrowse https://jbrowse.org/code/jb2/main/ \
  --config https://jbrowse.org/demos/cancer_sv/config.json \
  --out portal
npx serve portal
```

The [COLO829 review page](https://jbrowse.org/demos/colo829_review/) is this
callset built the same way, from one `batch` run that draws the genes, the
callset, both samples' reads and the repeats into each image.

The support filter splits the queue on nanomonsv's counts into calls with no
supporting read, calls whose normal has supporting reads too, and calls with
supporting reads in the tumor alone. <kbd>j</kbd> and <kbd>k</kbd> move between
cards, <kbd>1</kbd>, <kbd>2</kbd> and <kbd>3</kbd> mark one real, needing a look
or an artifact, and **Export** writes the verdicts to a TSV with each record's
position and ID. A callset that records no read counts takes
`--support jb2export`, which groups the queue on the manifest's counts.

Each `manifest.tsv` row holds the fields of one image:

- **`links`** counts the split reads with pieces in more than one window. Sort
  `tumor/manifest.tsv` on it to put the unsupported calls first; re-render one
  with a wider `--flank` before calling it false.
- **`alt`** holds, for an SNV, indel, `<DEL>` or `<INS>`, the reads with the ALT
  over the reads covering it (`17/41`). A deletion within a single alignment has
  its reads counted here and a `links` of zero.
- **`spec`** is the view as a [session spec](/docs/urlparams#session-spec) that
  opens the same windows in JBrowse.
- **`line`** is the record's line in the VCF, to join a row back to the callset.

A dense fan in a region of ragged coverage is usually a repeat, since the view
draws an arc for a read mismapped there as for any other.

## Render a three-chromosome rearrangement

COLO829's der(3) contains pieces of chr3, chr10 and chr12, and its reads align
to all three. We'll render it with `jb2export breakpoint`, one `--loc` per
panel, then run the same command with `COLO829BL_normal_ont` as the control:

```bash
# featureHeight:super-compact draws each read 1 px tall
jb2export breakpoint \
  --config https://jbrowse.org/demos/cancer_sv/config.json --assembly hg38 \
  --track COLO829_tumor_ont height:167 force:true featureHeight:super-compact \
  --loc chr3:25,358,511-25,359,711 \
  --loc chr10:58,716,962-58,718,162 \
  --loc chr12:72,272,512-72,273,712 \
  --width 1000 --out der3_tumor.png
```

<Figure caption="COLO829's der(3) loci in separate panels with tumor and normal nanopore reads, and the same loci as one reconstructed contig on the right." src="/img/jbrowse-img/sv_review_pair.png" />

The [complex rearrangements tutorial](/docs/tutorials/cancer_sv) builds the
reconstructed contig on the right.

## Open a call in the browser {#opening-a-call-in-the-browser}

To look closer at a call, open it in JBrowse from its manifest row. The row's
`spec` column is a [session spec](/docs/urlparams#session-spec): add it,
URL-encoded, to a JBrowse URL as `&session=spec-<spec>`, with `config=` naming
the config you rendered from. Or open the
[SV inspector](/docs/user_guides/sv_inspector_view) on the same VCF and click
through to the breakpoint split view, where the gene track and each read's
details are a click away.

## Render calls from other SV callers

`jb2export batch` and `jb2export breakpoint` read the VCF of any caller that
writes breakends or symbolic SVs (such as `<DEL>`):

- cuteSV, Sniffles, pbsv, Delly, Manta and GRIDSS write a VCF that `--sites`
  reads directly.
- LINX writes clusters and chained links as TSVs. Convert the junction columns
  to the six BEDPE columns with `awk` and pass the `.bedpe` file as `--sites`.
- To draw PURPLE's copy-number segments under the reads, convert them to a
  bedGraph, run `bedGraphToBigWig`, and pass the result as `--bigwig`.

For a caller that groups one rearrangement's junctions under VCF 4.4's `EVENT`
key, as DRAGEN and the C-GIAB benchmark do, `batch` itself draws the der(3)
image: it renders each event spanning more than two loci once more as
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
