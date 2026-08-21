---
title: Reviewing a whole SV callset
sidebar_label: SV callset review
description:
  Render every junction in a somatic SV callset as a breakpoint image, triage
  the directory, and check the calls against the matched normal
guide_category: Tutorials
tutorial_category: Cancer genomics
---

**TL;DR:** a somatic caller hands you hundreds of junctions and clicking through
them one at a time is the slow part. `jb2export batch` renders each one as a
breakpoint split view, so triage becomes a directory of images. The matched
normal, rendered the same way, is the control.

## Prerequisites

- [`@jbrowse/img`](/docs/jbrowse-img), which puts `jb2export` on your PATH
- nothing to download: the callset, the tumor reads and the matched normal are
  all hosted

```bash
npm install -g @jbrowse/img
```

## The dataset

**COLO829** is a melanoma cell line with a matched normal, COLO829BL, and a
community reference for somatic structural-variant calling
([Valle-Inclán et al. 2022](https://doi.org/10.1016/j.xgen.2022.100139)). The
reads are Oxford Nanopore R10 from the
[ONT open-data release](https://registry.opendata.aws/ont-open-data/); the calls
are that release's own `wf-somatic-variation` run, served alongside the
[cancer SV demo](/docs/tutorials/cancer_sv).

That tutorial follows **one** event all the way down. This one goes the other
way: every junction in the callset, at a glance, which is what you do first.

## The contact sheet

A junction joins two loci, and those two loci are exactly the two panels of a
breakpoint split view. So a callset renders straight into a review queue:

```bash
curl -fO https://jbrowse.org/demos/cancer_sv/COLO829.somatic-sv.vcf.gz
jb2export batch --vcf COLO829.somatic-sv.vcf.gz \
  --config https://jbrowse.org/demos/cancer_sv/config.json --assembly hg38 \
  --track COLO829_tumor_ont height:240 \
  --outDir tumor --flank 600 --width 1100
```

```
Warning: skipped 35 record(s), e.g. line 271: names no second locus (INS)
[########################] 100% 100/100
wrote 100/100 images to tumor
```

**100 junctions.** Insertions name one locus, so there is no second panel to
stack and they are counted out rather than dropped in silence; what remains
collapses because a caller writes each breakend pair twice. That is the same 100
that `sv_multihop.py chains` reports on this file in the
[multi-hop tutorial](/docs/tutorials/cancer_sv#finding-the-chains), and the two
agree junction for junction, in the same order.

They agree because neither parses the ALT bracket by hand, which goes wrong four
ways, all of them silent:

- the replacement string may carry inserted sequence either side of the bracket
  (`GTGATGGATTCA[CHR12:72273112[`)
- callers upper-case the mate contig, and `CHR12` is not a region hg38 has
- `END=` matches inside `CIEND=`, and the first hit wins
- the two records of one breakend pair name the same translocation twice

One image per row, written as `1_chr1_33053494-chr6_2919922_gridss12o.png`:
index first so the directory sorts in callset order, coordinates next so you can
find the one you are looking at, and the caller's own ID last so you can go back
to the VCF row it came from. A file with no ID column falls back to
`junction_<n>`.

`--flank` is the setting that decides the picture. A caller's breakend is one
base, and a panel drawn on one base is zoomed past anything readable, so the
flank is what actually frames it. `--dryRun` prints the file and loci of every
row and renders nothing, and `--limit 20` renders the first few, so you can
check the framing before committing to the whole callset.

Two flags for a long run. `--resume` skips a row whose image is already in
`--outDir`, so an interrupted callset continues from where it stopped.
`--manifest` writes `manifest.tsv` beside the images: one row per junction with
its file, both loci, its name, and whether it rendered. The status column is
where the failed rows stay readable after the run's output has scrolled past.

`--passOnly` drops the records the caller has already filtered out. `--limit`
takes the first N in _file_ order, so on an unfiltered callset the two go
together.

Nothing is downloaded and no browser is involved: the reads stream from the
hosted CRAM and each image is rendered server-side. The run is a single process,
so the module graph loads once for the whole callset rather than once per
variant, and a `--config` URL or a `--hub` is fetched once rather than per row.

A row that cannot be rendered is reported and the run continues, so a
translocation into a contig the assembly does not have costs you that row and
not the other 99.

A junction is two loci, so that is what `batch` draws. A connector drawn dashed
means the read carrying it has a segment at a locus the frame does not show, and
these reads also visit chr10, so this junction wants a third panel. The control
belongs beside it: one render per sample, the same `--loc` list and the same
`--width`.

<Figure caption="The three loci of COLO829's der(3), chr3 then chr10 then chr12, at the same width in every panel. The tumor nanopore reads carry a solid curve at every breakend and the matched normal carries none. On the right, the same three loci as one 39.5 kb reconstructed contig." src="/img/jbrowse-img/sv_review_pair.png" />

Reads at 1 px apiece (`featureHeight:super-compact`) is what keeps six pileups
on one screen; at the default height the picture is mostly pileup and the curves
it is read for are drawn over it.

A curve says two loci are joined in this sample; a contig says in what order and
in which orientation, which takes a reconstruction step this page does not do.
The [multi-hop tutorial](/docs/tutorials/cancer_sv) builds that contig from
these same reads, and rendering it is another `jb2export` run with a different
`--assembly`, since a derivative allele is an assembly like any other.

## The control

The whole callset gets the same treatment, one directory per track:

```bash
jb2export batch --vcf COLO829.somatic-sv.vcf.gz \
  --config https://jbrowse.org/demos/cancer_sv/config.json --assembly hg38 \
  --track COLO829BL_normal_ont height:240 \
  --outDir normal --flank 600 --width 1100
```

Put the two directories side by side and the somatic calls are the ones with
curves in `tumor/` and none in `normal/`, which is why the normal renders at the
same flank and width.

## Reading the sheet

What the picture can tell you, and what it cannot:

- **a fan of curves at both breakends** is the junction as the reads describe it
- **nothing connecting the panels** means the reads do not support the caller's
  coordinates, which is either a false call or a breakpoint placed far enough
  off that `--flank` missed it. Re-render that row wider before concluding
  anything
- **curves in the normal too** means germline, not somatic
- **a dense fan in a region of ragged coverage** is usually a repeat. The
  connectors are drawn from what the aligner said, so a read mismapped into a
  repeat contributes a confident-looking curve

The images rank nothing and vouch for nothing; they are a fast way to put your
eyes on every call in the set rather than on the handful there was time for.

## Opening one in the browser

Triage ends where the browser starts. Take the coordinates from an image's
filename, open the [SV inspector](/docs/user_guides/sv_inspector_view) on the
same VCF, and click through to the breakpoint split view for the interactive
version of the picture you just looked at, with the gene track and the read
details attached.

For a junction that turns out to be one hop of something larger, the alignments
track menu's **Reconstruct derivative allele...** groups the reads in view by
the route their split alignments describe. COLO829's der(3), the junction in the
figures above, is three junctions across three chromosomes, and the
[multi-hop tutorial](/docs/tutorials/cancer_sv) follows it the rest of the way.

## Other callers

The recipe is the format, not the caller. Anything that writes breakends or
symbolic SVs to a VCF goes through the same two commands:

- **cuteSV, Sniffles, pbsv, Delly, Manta, GRIDSS** all write a VCF that
  `sv_multihop.py bedpe` reads directly
- **LINX** publishes its clusters and chained links as TSVs rather than VCF.
  Convert the junction columns to the six BEDPE columns with `awk` and the rest
  of this page is unchanged; the cluster and chain ids make good `--outDir`
  names, so one directory per cluster gives you a chromothripsis event as a
  contact sheet
- **PURPLE** copy-number segments are not junctions. Convert the segment TSV to
  a bedGraph, `bedGraphToBigWig` it, and add it as a `--bigwig` so every image
  carries the copy number under the reads

JBrowse deliberately does not order breakends into a derivative chromosome
itself. Doing that properly needs allele-specific copy number and a centromere
constraint, which is exactly what
[LINX does with PURPLE's purity and ploidy](https://doi.org/10.1016/j.xgen.2022.100112);
run it, and load its output here.

## Reproduce it end to end

Everything on this page is the commands above against hosted files. The figure
is three `jb2export` invocations: two `breakpoint` renders with one `--loc` per
panel, one per sample, and a plain render of the derivative assembly, which are
the `sv_review_tumor`, `sv_review_normal` and `sv_review_derivative` specs in
[`website/scripts/specs/jbrowse-img.ts`](https://github.com/GMOD/jbrowse-components/blob/main/website/scripts/specs/jbrowse-img.ts).
Putting them side by side, and labelling which is which, is the figure
pipeline's job, not jb2export's.

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
