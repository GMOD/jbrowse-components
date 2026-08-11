---
title: Reviewing a whole SV callset
sidebar_label: SV callset review
description:
  Render every junction in a somatic SV callset as a breakpoint image, triage
  the directory, and check the calls against the matched normal
guide_category: Tutorials
tutorial_category: Cancer genomics
data: download
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
Warning: 35 record(s) name no junction to draw, e.g. line 271: names no second locus (INS)
[########################] 100% 100/100
wrote 100/100 images to tumor
```

**100 junctions.** Insertions name one locus, so there is no second panel to
stack and they are counted out rather than dropped in silence; what remains
collapses because a caller writes each breakend pair twice. That is the same 100
that `sv_multihop.py chains` reports on this file in the
[multi-hop tutorial](/docs/tutorials/cancer_sv#finding-the-chains), and the two
agree junction for junction, in the same order.

They agree because neither parses the ALT bracket by hand. Four things go wrong
there and all four go wrong **silently**:

- the replacement string may carry inserted sequence either side of the bracket
  (`GTGATGGATTCA[CHR12:72273112[`), which a pattern matching one base of context
  drops. On this file most of the breakend records are that shape
- callers upper-case the mate contig. `CHR12` is not a region hg38 has, so the
  panel renders empty rather than failing
- `END=` matches inside `CIEND=`, and the first hit wins, so a caller that
  writes its confidence interval first gets a junction at position 5
- the two records of one breakend pair queue the same translocation twice

One image per row, written as `1_chr1_33053494-chr6_2919922_junction_0.png`:
index first so the directory sorts in callset order, coordinates next so you can
find the one you are looking at.

`--flank` is the setting that decides the picture. A caller's breakend is one
base, and a panel drawn on one base is zoomed past anything readable, so the
flank is what actually frames it. Start with `--limit 20` to check the framing
before committing to the whole callset.

Nothing is downloaded and no browser is involved: the reads stream from the
hosted CRAM and each image is rendered by React server-side rendering. Because
the run is a single process, the module graph loads once for the whole callset
rather than once per variant, which is most of the wall time on a shell loop.

A row that cannot be rendered is reported and the run continues, so a
translocation into a contig the assembly does not have costs you that row and
not the other 99.

A junction is two loci, so that is what `batch` draws. This one is worth looking
at on its own, because two panels are not the whole story: a connector drawn
dashed means the read carrying it has a segment at a locus the frame does not
show, and these reads also visit chr10. Rendering the junction by hand with that
third panel is the same picture with nothing left off it.

<Figure caption="The three loci of COLO829's der(3) in the tumor reads, chr3 then chr10 then chr12, with a curve per read that leaves one panel and arrives in another. The fan of curves is the junction's support, the reads stop dead at the breakpoint on every side, and no connector is dashed." src="/img/jbrowse-img/sv_review_tumor.png" />

## The control

The same junctions, the same windows, the matched normal:

```bash
jb2export batch --vcf COLO829.somatic-sv.vcf.gz \
  --config https://jbrowse.org/demos/cancer_sv/config.json --assembly hg38 \
  --track COLO829BL_normal_ont height:240 \
  --outDir normal --flank 600 --width 1100
```

Drawn by hand with the same three panels, the control says the same thing about
the whole cycle rather than about one of its junctions:

<Figure caption="The same three windows in the matched normal COLO829BL. The reads read straight through all three loci and not one curve connects them, which is what somatic looks like." src="/img/jbrowse-img/sv_review_normal.png" />

Put the two directories side by side and the somatic calls are the ones with
curves in `tumor/` and none in `normal/`. That comparison is the whole reason to
render the normal at the same flank and width: a difference between two pictures
only reads as a difference when nothing else about them differs.

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

That last point is the limit of this whole workflow, and it is worth being blunt
about: these images rank nothing and vouch for nothing. They are a fast way to
put your eyes on all 100 calls instead of on the six you had time for.

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

Everything on this page is the commands above against hosted files. The figures
are rendered by the `sv_review_tumor` and `sv_review_normal` specs in
`website/scripts/screenshot-spec-helpers.ts`, which are the same
`jb2export breakpoint` invocation with one `--loc` per panel.

## See also

- [](/docs/tutorials/cancer_sv) - the same dataset, following one multi-hop
  event all the way to a reconstructed allele
- [](/docs/tutorials/sv_visualization_cgiab) - the same triage done
  interactively, on PacBio HiFi
- [](/docs/jbrowse-img) - every `jb2export` mode and flag
- [](/docs/user_guides/sv_inspector_view) - the interactive callset table
- [](/docs/user_guides/sv_visualization) - what each SV picture in JBrowse shows

## References

- Valle-Inclán JE, et al. A multi-platform reference for somatic structural
  variation detection. _Cell Genomics_ (2022).
  https://doi.org/10.1016/j.xgen.2022.100139
- Shale C, et al. Unscrambling cancer genomes via integrated analysis of
  structural variation and copy number. _Cell Genomics_ (2022).
  https://doi.org/10.1016/j.xgen.2022.100112
