---
id: sv_inspector_view
title: SV inspector view
---

import Figure from '../figure'

The Structural Variant (SV) inspector is a "workflow" that is designed to help
users inspect structural variant calls.

We can start the SV inspector by launching it from the App level menu bar

<Figure caption="The SV inspector can be launched from the main menu bar." src="/img/sv_inspector_begin.png" />

This will bring up an "import form" that asks you for your SV evidence.

The following formats are supported:

- CSV, TSV
- VCF or VCF.gz (plain text VCF, or (b)gzipped VCF)
- BED, BEDPE
- STAR-fusion result file

<Figure caption="The import form for getting started with the SV inspector." src="/img/sv_inspector_importform.png" />

### Sources of data for SV inspector

The SV inspector currently is designed for viewing `<TRA>` and breakend type
entries.

Examples of variant callers that produce a VCF that can be used with the SV
inspector:

Short read based:

- Manta
- Delly
- Lumpy

Long read based

- pbsv
- Sniffles

### Example SV inspector workflow

We can start the SV inspector workflow by opening up this file containing
translocation events called from a breast cancer cell line SKBR3, based on
[these published data](http://schatz-lab.org/publications/SKBR3/).

### Example VCF for use in the SV inspector

https://jbrowse.org/genomes/hg19/skbr3/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.bam.sniffles1kb_auto_l8_s5_noalt.new.vcf

Copy this URL and paste it into the import form and select hg19:

<Figure caption="The SV inspector with the import form and URL pasted." src="/img/sv_inspector_importform_after.png" />

### SV inspector results

After loading the user's requested file, you will have a tabular view with each
row representing a row of the file you opened, along with a whole-genome
overview of the SVs on the right

<Figure caption="The SV inspector with loaded results." src="/img/sv_inspector_importform_loaded.png" />

We can search and filter the table, with filtering and searching being reflected
in the circular view as well.

<Figure caption="The SV inspector with filter applied." src="/img/sv_inspector_importform_filtered.png" />

### Launching breakpoint split view

By clicking on the features in the circular view, or clicking on the triangle
drop-down on the leftmost column of the table, we can dynamically launch a new
view of the data that is called the "split view" or the "breakpoint split view"

This allows us to inspect the breakpoints of the structural variant, and compare
each side to the alignments.

<Figure caption="Screenshot of the 'breakpoint split view' which examines the breakpoints of a structural variant, e.g. an interchromosomal translocation, and connects supporting reads (black splines) and the variant call itself (green thicker line, with feet indicating directionality)." src="/img/breakpoint_split_view.png" />
