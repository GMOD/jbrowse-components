---
title: SV inspector view
description: Structural variant spreadsheet and circular view
guide_category: Views
---

The SV inspector is a combined variant table and whole-genome circular view for
triaging structural variant calls.

For an end-to-end walkthrough using real cancer sequencing data, see the
[C-GIAB tutorial](/docs/tutorials/sv_visualization_cgiab).

Launch it from the **Add** menu in the main menu bar; an import form then
appears asking for your SV data.

<Figure caption="Launching the SV inspector from the Add menu." src="/img/sv_cgiab/translocation_sv_inspector_start.png" />

The following formats are supported:

- CSV, TSV
- VCF or VCF.gz (plain text or (b)gzipped)
- BED, BEDPE
- STAR-fusion result file

## What the SV inspector is good for

The SV inspector is best for long-range SV records: VCF entries with
`SVTYPE=BND` (breakends; the VCF-spec way to encode translocations) or the
caller-specific `SVTYPE=TRA` used by some tools. Single-locus deletions and
duplications load fine but don't show up usefully in the circular overview.

Compatible variant callers include:

- Short-read - Manta, Delly, Lumpy
- Long-read - pbsv, Sniffles

## Example workflow

As an example, load this
[VCF of translocation events](https://jbrowse.org/genomes/hg19/skbr3/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.bam.sniffles1kb_auto_l8_s5_noalt.new.vcf)
called from the SKBR3 breast cancer cell line
([published data](https://schatz-lab.org/publications/SKBR3/)). Paste the URL
into the import form and select hg19:

<Figure caption="The SV inspector import form with a VCF URL pasted. As the callout notes, you can instead choose 'Open from track' to populate the inspector from a VCF track already open in the session, rather than re-entering its URL." src="/img/sv_inspector_importform_after.png" />

## SV inspector results

The loaded file appears as a searchable table with each row representing one
variant, alongside a whole-genome circular overview.

<Figure caption="The SV inspector with loaded results." src="/img/sv_inspector_importform_loaded.png" />

Table filters are reflected in the circular view.

<Figure caption="The SV inspector with filter applied." src="/img/sv_inspector_importform_filtered.png" />

## Launching breakpoint split view

Click a feature in the circular view, or the triangle dropdown on any table row,
to open the
[breakpoint split view](/docs/user_guides/sv_visualization#breakpoint-split-view)
for that variant: two stacked linear genome views, each centered on one
breakpoint. It opens with empty views; add alignment tracks to both via their
track selectors, and the read arcs and splines connecting supporting reads
appear automatically.

## See also

- [Circular genome view](/docs/user_guides/circular_view) - the whole-genome
  chord overview on its own, for plotting a single SV track without the table
- [Spreadsheet view](/docs/user_guides/spreadsheet_view) - the tabular half on
  its own, for importing CSV/TSV/BED/VCF as a searchable feature table
- [Structural variant visualization](/docs/user_guides/sv_visualization) -
  interpreting SV signals across alignment colorings, arcs, and the breakpoint
  split view
- [Cancer SVs (C-GIAB) tutorial](/docs/tutorials/sv_visualization_cgiab) -
  end-to-end workflow on real tumor/normal data
- [Multi-sample SVs (1000 Genomes) tutorial](/docs/tutorials/sv_multisamples) -
  population-scale SV genotypes
- [Gallery: structural variant examples](/gallery/#sv) - the live SV inspector,
  breakpoint split view, and inversion sessions to open and explore
