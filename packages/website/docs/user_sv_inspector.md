---
id: user_sv_inspector
title: SV inspector
---

The SV inspector is a "workflow" that is designed to help users inspect
structural variant calls

### Opening the SV inspector

We can start the SV inspector by launching it from the App level menu bar

![](/jb2/img/sv_inspector_begin.png)
The SV inspector can be launched from the main menu bar

This will bring up an "import form" that asks you for your SV evidence. This
can be provided using a URL in these formats:

- VCF (plain text VCF, not tabix VCF)
- BEDPE
- STAR-fusion result file
- or other formats

![](/jb2/img/sv_inspector_importform.png)
SV inspector import form

### Example SV inspector workflow

We can start the SV inspector workflow by opening up this file containing
translocation events called from a breast cancer cell line SKBR3, based on
these published data http://schatz-lab.org/publications/SKBR3/

    https://s3.amazonaws.com/jbrowse.org/genomes/hg19/skbr3/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.bam.sniffles1kb_auto_l8_s5_noalt.new.vcf

Copy this URL and paste it into the import form and select hg19

![](/jb2/img/sv_inspector_importform_after.png)
SV inspector import form with URL

### SV inspector results

After loading the user's requested file, you will have a spreadsheet with each
row representing a row of the file you opened, along with a whole-genome
overview of the SVs on the right

![](/jb2/img/sv_inspector_importform_loaded.png)
SV inspector with loaded results

Now here is where things can become interesting

We can perform searching and filtering on the table, which can filter down the
number of rows being displayed, and then this dynamically filters the circos
view on the right also.

![](/jb2/img/sv_inspector_importform_filtered.png)
SV inspector with filter applied

### Launching breakpoint split view

By clicking on the features in the Circos, or clicking on the triangle
drop-down on the leftmost column of the spreadsheet, we can dynamically launch
a new view of the data that is called the "split view" or the "breakpoint split
view"

This allows us to inspect the breakpoints of the structural variant, and
compare each side to the alignments.
