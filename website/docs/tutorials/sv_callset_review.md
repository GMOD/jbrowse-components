---
title: Reviewing a whole SV callset
sidebar_label: SV callset review
description:
  Render every junction in a somatic SV callset as a breakpoint image, triage
  the directory, and check the calls against the matched normal
guide_category: Tutorials
tutorial_category: Cancer genomics
---

`jb2export batch` renders every record of a somatic callset as an image, a
junction as a breakpoint split view, so triage becomes a directory of images.
The matched normal, rendered the same way, is the control.

## Prerequisites

- [`@jbrowse/img`](/docs/jbrowse-img), which puts `jb2export` on your PATH
- nothing to download: the callset, the tumor reads and the matched normal are
  all hosted
- a JBrowse, for [the last section](#opening-a-call-in-the-browser) only
  ([Web](/docs/quickstart_web) or [Desktop](/docs/quickstart_desktop)); the
  renders above need none

```bash
npm install -g @jbrowse/img
```

## Where the data comes from

COLO829's somatic SV callset is the ONT open-data release's own
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

## COLO829 and its matched normal

**COLO829** is a melanoma cell line with a matched normal, COLO829BL, and a
community reference for somatic structural-variant calling. The
[multi-hop tutorial](/docs/tutorials/cancer_sv) follows one event in this
callset all the way down; this page renders every junction at a glance.

## The contact sheet

A junction joins two loci, which are the two panels of a breakpoint split view,
so a callset renders straight into a review queue:

```bash
curl -fO https://jbrowse.org/demos/cancer_sv/COLO829.somatic-sv.vcf.gz
jb2export batch --vcf COLO829.somatic-sv.vcf.gz \
  --config https://jbrowse.org/demos/cancer_sv/config.json --assembly hg38 \
  --track COLO829_tumor_ont height:240 \
  --outDir tumor --flank 600 --width 1100
```

```
[########################] 100% 135/135
wrote 135/135 images to tumor
```

A record that fits one window is drawn as a single panel: an insertion names one
locus, and a deletion shorter than `--flank` has both ends in one frame. Each
breakend pair is written twice and collapses to one.

The ALT bracket is parsed with `@gmod/vcf` rather than by hand, which matters
because hand-parsing it goes wrong four ways, none of them raising an error:

- the replacement string may carry inserted sequence either side of the bracket
  (`GTGATGGATTCA[CHR12:72273112[`)
- callers upper-case the mate contig, and `CHR12` is not a region hg38 has
- `END=` matches inside `CIEND=`, and the first hit wins
- the two records of one breakend pair name the same translocation twice

One image per row, named `002_chr1_33053494-chr6_2919922_r_0_0.png`: the
filename opens with the index so the directory sorts in callset order, then the
coordinates, then the caller's ID where the record has one.

`--flank` frames the panel, since a breakend is one base. `--dryRun` prints the
file and loci of every row and renders nothing, and `--limit 20` renders the
first few, to check the framing before the whole callset.

For a long run:

- `--resume` skips a row whose image is already in `--outDir`. A `--limit` run
  names its images as the whole run will, so the whole run picks them up
- `--manifest` writes `manifest.tsv` beside the images: one row per image with
  its file, its panels' loci, its name, its `EVENT`, and whether it rendered.
  The `line` column is the record's line in the VCF, which joins a row back to
  any column of the callset
- `--passOnly` drops records the caller filtered out. `--limit` takes the first
  N in file order, so on an unfiltered callset the two go together

The reads stream from the hosted CRAM, the module graph loads once for the whole
callset, and a `--config` URL or `--hub` is fetched once. A row that cannot be
rendered is reported and the run continues. Deep long reads can put even a
`--flank` window over a track's size limit, which the app answers with a **Force
load** button; `batch` loads every panel as if it had been pressed.

A connector drawn dashed means the read has a segment at a locus the frame does
not show. These reads also visit chr10, so this junction takes a third panel,
and the control belongs beside it: one render per sample, the same `--loc` list
and `--width`.

<Figure caption="The three loci of COLO829's der(3), chr3 then chr10 then chr12, at the same width in every panel. The tumor nanopore reads carry a solid curve at every breakend and the matched normal carries none. On the right, the same three loci as one reconstructed contig." src="/img/jbrowse-img/sv_review_pair.png" />

`featureHeight:super-compact` draws reads at 1 px apiece, which keeps six
pileups on one screen.

A curve marks two loci as joined; a contig shows the order and orientation. The
[multi-hop tutorial](/docs/tutorials/cancer_sv) builds that contig from these
reads, and rendering it is another `jb2export` run with a different
`--assembly`.

## The same export over the normal

One directory per track:

```bash
jb2export batch --vcf COLO829.somatic-sv.vcf.gz \
  --config https://jbrowse.org/demos/cancer_sv/config.json --assembly hg38 \
  --track COLO829BL_normal_ont height:240 \
  --outDir normal --flank 600 --width 1100
```

Side by side, the somatic calls are the ones with curves in `tumor/` and none in
`normal/`.

## Reading the sheet

What each picture shows:

- **a fan of curves at both breakends** is the junction as the reads describe it
- **nothing connecting the panels** means the reads do not support the caller's
  coordinates, which is either a false call or a breakpoint placed far enough
  off that `--flank` missed it. Re-render that row wider
- **curves in the normal too** means the variant is germline
- **a dense fan in a region of ragged coverage** is usually a repeat. The
  connectors are drawn from what the aligner reported, so a read mismapped into
  a repeat contributes a confident-looking curve

The manifest's `links` column counts those curves: the split reads with pieces
in more than one panel of that image. Sorting `tumor/manifest.tsv` on it puts
the calls no split read joins at the top, and the same column of
`normal/manifest.tsv` says which calls the normal carries too. A deletion short
enough for one alignment to carry draws a gap through both panels and no curve,
so it counts as none with its support in plain sight.

## Opening a call in the browser

Take the coordinates from an image's filename, open the
[SV inspector](/docs/user_guides/sv_inspector_view) on the same VCF, and click
through to the breakpoint split view, with the gene track and read details
attached.

A junction can be one hop of something larger. COLO829's der(3) is three
junctions across three chromosomes, and the
[multi-hop tutorial](/docs/tutorials/cancer_sv) follows it the rest of the way.

## Other callers

Anything that writes breakends or symbolic SVs to a VCF goes through the same
two commands:

- **cuteSV, Sniffles, pbsv, Delly, Manta, GRIDSS** all write a VCF that `--vcf`
  reads directly
- **LINX** publishes clusters and chained links as TSVs. Convert the junction
  columns to the six BEDPE columns with `awk`; one `--outDir` per cluster gives
  a chromothripsis event as a contact sheet
- **PURPLE** copy-number segments are not junctions. Convert the segment TSV to
  a bedGraph, `bedGraphToBigWig` it, and add it as a `--bigwig` so every image
  carries the copy number under the reads

COLO829's callset leaves its junctions ungrouped, which is why der(3)'s third
panel above took a hand-written `--loc` list. A caller that files the junctions
of one rearrangement under VCF 4.4's `EVENT` key, as DRAGEN and the C-GIAB
benchmark do, gets that image from `batch` itself: every event visiting more
than two loci is drawn once more as `event_<n>_<label>`, one panel per locus in
contig order. Severus writes the same grouping as `CLUSTERID`, and the
[SV inspector guide](/docs/user_guides/sv_inspector_view#rearrangement-events)
has the rename.

Ordering breakends into a derivative chromosome needs allele-specific copy
number and a centromere constraint.
[LINX derives both from PURPLE's purity and ploidy](https://doi.org/10.1016/j.xgen.2022.100112).

## Reproduce it end to end

Everything on this page is the commands above against hosted files. The figure
is three `jb2export` invocations: two `breakpoint` renders with one `--loc` per
panel, one per sample, and a plain render of the derivative assembly, which are
the `sv_review_tumor`, `sv_review_normal` and `sv_review_derivative` specs in
[`website/scripts/specs/jbrowse-img.ts`](https://github.com/GMOD/jbrowse-components/blob/main/website/scripts/specs/jbrowse-img.ts).

## See also

- [](/docs/tutorials/cancer_sv)
- [](/docs/tutorials/sv_visualization_cgiab)
- [](/docs/tutorials/mappability_qc)
- [](/docs/jbrowse-img)
- [](/docs/user_guides/sv_inspector_view)
- [](/docs/user_guides/sv_visualization)

## References

- Valle-Inclán JE, et al. A multi-platform reference for somatic structural
  variation detection. _Cell Genomics_ (2022).
  https://doi.org/10.1016/j.xgen.2022.100139
- Shale C, et al. Unscrambling cancer genomes via integrated analysis of
  structural variation and copy number. _Cell Genomics_ (2022).
  https://doi.org/10.1016/j.xgen.2022.100112
