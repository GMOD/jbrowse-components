---
id: sv_inspector_view
title: SV inspector view
description: Structural variant spreadsheet and circular view
guide_category: Views
---


The SV inspector is a combined variant table and whole-genome circular view for
triaging structural variant calls.

For an end-to-end walkthrough using real cancer sequencing data, see the
[C-GIAB tutorial](/docs/tutorials/sv_visualization_cgiab).

Launch it from the main menu bar:

<Figure caption="The SV inspector can be launched from the main menu bar." src="/img/sv_inspector_begin.png" />

An import form will appear asking for your SV data.

The following formats are supported:

- CSV, TSV
- VCF or VCF.gz (plain text VCF, or (b)gzipped VCF)
- BED, BEDPE
- STAR-fusion result file

<Figure caption="The import form for getting started with the SV inspector." src="/img/sv_inspector_importform.png" />

### Sources of data for SV inspector

The SV inspector currently is designed for viewing `<TRA>` and breakend type
entries.

Compatible variant callers:

Short read based:

- Manta
- Delly
- Lumpy

Long read based

- pbsv
- Sniffles

### Example SV inspector workflow

As an example, load this file of translocation events called from the SKBR3
breast cancer cell line
([published data](https://schatz-lab.org/publications/SKBR3/)).

### Example VCF for use in the SV inspector

https://jbrowse.org/genomes/hg19/skbr3/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.bam.sniffles1kb_auto_l8_s5_noalt.new.vcf

Copy this URL and paste it into the import form and select hg19:

<Figure caption="The SV inspector with the import form and URL pasted." src="/img/sv_inspector_importform_after.png" />

### SV inspector results

The loaded file appears as a searchable table with each row representing one
variant, alongside a whole-genome circular overview.

<Figure caption="The SV inspector with loaded results." src="/img/sv_inspector_importform_loaded.png" />

Table filters are reflected in the circular view.

<Figure caption="The SV inspector with filter applied." src="/img/sv_inspector_importform_filtered.png" />

### Launching breakpoint split view

Click a feature in the circular view, or the triangle dropdown on any table row,
to open the breakpoint split view for that variant.

<Figure caption="Screenshot of the 'breakpoint split view' which examines the breakpoints of a structural variant, e.g. an interchromosomal translocation, and connects supporting reads (black splines) and the variant call itself (green thicker line, with feet indicating directionality)." src="/img/breakpoint_split_view.png" />

### Loading alignment tracks

The breakpoint split view opens with empty top and bottom views. Add alignment tracks to both views using their track selectors (the tracks button in each view header). Read arcs and splines connecting supporting reads then appear automatically.
