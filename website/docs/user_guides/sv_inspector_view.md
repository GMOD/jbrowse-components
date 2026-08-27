---
title: SV inspector view
description: Structural variant spreadsheet and circular view
guide_category: Views
---

**TL;DR:** The SV inspector is a combined variant table and whole-genome
circular view for triaging structural variant calls. For an end-to-end
walkthrough on real cancer sequencing data, see the
[C-GIAB tutorial](/docs/tutorials/sv_visualization_cgiab).

Launch it from the **Add** menu in the main menu bar; an import form then asks
for your SV data.

<Figure caption="Launching the SV inspector from the Add menu." src="/img/sv_cgiab/translocation_sv_inspector_start.png" />

The following formats are supported:

- VCF or VCF.gz (plain text or (b)gzipped)
- BED, BEDPE
- STAR-fusion result file

The import form cannot infer STAR-Fusion from a `.tsv` extension, so that one
needs its File Type set by hand; [](/docs/tutorials/k562_fusions) walks a
caller's output through the inspector and out to the reads behind each call.

## Record types and compatible callers

The SV inspector is best for long-range SV records: VCF entries with
`SVTYPE=BND` (breakends; the VCF-spec way to encode translocations) or the
caller-specific `SVTYPE=TRA` used by some tools.

Single-locus deletions and duplications load into the table like anything else,
but the circular overview cannot draw them: a chord runs between a record's two
ends, and at whole-genome scale a deletion's two ends are the same point. The
legend below the circle is what says so — it counts every class in the rows on
screen, including the ones with no chord to draw, so a mostly-local callset
reads as such.

Compatible variant callers include:

- Short-read - Manta, Delly, Lumpy
- Long-read - pbsv, Sniffles

## Example workflow

As an example, load this
[VCF of translocation events](https://jbrowse.org/genomes/hg19/skbr3/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.bam.sniffles1kb_auto_l8_s5_noalt.new.vcf)
called from the SKBR3 breast cancer cell line
([published data](https://schatz-lab.org/publications/SKBR3/)). Paste the URL
into the import form and select hg19:

<Figure caption="The SV inspector import form with a VCF URL pasted. As the callout notes, 'Open from track' fills the inspector from a VCF track already open in the session." src="/img/sv_inspector_importform_after.png" />

## SV inspector results

The loaded file appears as a searchable table, one variant per row, alongside a
whole-genome circular overview.

<Figure caption="The SV inspector with loaded results." src="/img/sv_inspector_importform_loaded.png" />

Table filters are reflected in the circular view.

<Figure caption="The SV inspector with filter applied." src="/img/sv_inspector_importform_filtered.png" />

<Video src="/media/sv/inspector_route.mp4" caption="The same callset from the Add menu onward: the import form, the URL and assembly it wants, the table and circle it opens, and a chromosome typed into the table filter taking the chords with it." />

## Launching breakpoint split view

Click a feature in the circular view, or the triangle dropdown on any table row,
to open the
[breakpoint split view](/docs/user_guides/sv_visualization#breakpoint-split-view)
for that variant: two stacked linear genome views, each centered on one
breakpoint. It opens empty; add alignment tracks to both via their track
selectors, and the arcs and splines connecting supporting reads appear
automatically.

## See also

- [](/docs/user_guides/circular_view)
- [](/docs/user_guides/spreadsheet_view)
- [Structural variant visualization](/docs/user_guides/sv_visualization)
- [Cancer SVs (C-GIAB) tutorial](/docs/tutorials/sv_visualization_cgiab)
- [](/docs/tutorials/k562_fusions)
- [Multi-sample SVs (1000 Genomes) tutorial](/docs/tutorials/sv_multisamples)
- [Gallery: structural variant examples](/gallery/#sv)
