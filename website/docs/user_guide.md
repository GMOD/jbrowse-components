---
id: user_guide
toplevel: true
title: User guide
---

import Figure from './figure'

## Navigating the UI

### Linear genome view usage

To start a linear genome view, use the menu bar

File->Add->Linear genome view

#### Using the location search box

- Use the search box in the LGV
- Enter syntax chr1:1-100 or chr1:1..100
- You can also specify an assembly name with the locstring {hg19}chr1:1-100

Note: searching by gene name is not yet available but will be added soon!

#### Scrolling

Mouse wheel can scroll side to side, as well as click and drag. The pan buttons
also exist in the header of the linear genome view

#### Zooming

The zoom buttons exist in the header of the linear genome view, and there is
also a slider bar to zoom in and out.

Note: You can also hold the "Ctrl" key and use your mousewheel or trackpad to
scroll and this will zoom in and out

#### Re-ordering tracks

There is a drag handle on the track labels indicating by the six dots, clicking
and dragging on this part of the track label can reorder tracks

## Adding tracks

To add a new track or connection, you can use the menu bar in the app to open
the form for adding a track:

File->Open Track

<Figure caption="After opening the menu item for 'Open new track' a drawer widget for the 'Add track form' will appear" src="/img/add_track_form.png" />

Note: There is also a circular "+" button inside the track selector menu that
can also be used to access the "Add track" form.

<Figure caption="The orange plus icon in the bottom right of a tracklist can also be used to launch the 'Add track form'" src="/img/add_track_tracklist.png" />

In the "Add track" form, you can provide a URL to a file to load, or you can
also open files from your local machine. In some cases, you need to provide an
index (bigwig files for example have no index, but BAM/CRAM or tabix filetypes
like VCF/GFF/BED tabix do). In some cases we can automatically infer the index
e.g. if you provide a URL for a BAM and the index filename is bamfilename
+'.bai' but you may need to manually supply it in some cases (index inference
can't be done with files from your local machine)

The following file formats are supported

- Tabixed VCF
- Tabixed BED
- Tabixed GFF
- BAM
- CRAM
- BigWig
- BigBed
- .hic file (Juicebox)
- PAF

For tabix files, TBI or CSI indexes are allowed. CSI or BAI is allowed for BAM.
Only CRAI is allowed for CRAM. The index will be inferred for BAI or TBI files
as filename+'.bai' for example, but if it is different than this, make sure to
specify the index file explicitly.

Note: If you are an administrator, you can add tracks with the command line or
with the admin server [add-track](cli#jbrowse-add-track) or [admin-server
guide](quickstart_gui)

### Sharing sessions

The main menu bar has a "Share" button to enable users to share their sessions
with other people. The share button generates a URL that can be sent to other
users. It is not possible to copy your URL bar and send this to another user
currently, because sessions can become too large for the address bar in many
cases.

Note that you can copy and paste URLs between different tabs in your local
browser though

<Figure caption="The session share dialog, which gives you a short URL to share your session with other users. It is important to use these URLs generated here rather than simply copying and pasting your URL to other users" src="/img/share_button.png" />

The session URL will contain

- what views are on the screen, and settings for the views (e.g. track labels
  overlapping or offset)
- what tracks are in the view
- extra tracks that you added with the "Add track workflow"
- for the alignments track, the show soft clipping and sort settings on the
  pileup
- etc

All this stuff gets included in the session

This means you can share links with your custom tracks with other users,
without being a JBrowse admin!

### Editing track configs

Currently, in order to edit a track config, you have to make a copy of the track

<Figure caption="Screenshot showing how to copy a track. In order to edit detailed configuration of a track, we require that you first make a copy of it, which can be done via the track menu" src="/img/copy_track.png" />

After you have copied the track, you can edit the track settings

<Figure caption="After copying a track, which puts it in your 'session tracks', you can then edit the track settings, and you have full control over your session tracks" src="/img/session_track_settings.png" />

Your new track is a "session track" and can be shared with other
users with the "Share" button

#### Rubberband selection

The scale bars accept a click and drag action to select a region

<!--
https://s3.amazonaws.com/jbrowse.org/code/jb2/main/index.html?config=test_data%2Fvolvox%2Fconfig.json&session=share-6_PDCGXnZY&password=sufpR
-->

<Figure caption="Rubberband selection can be performed on both the region and overview scale bars" src="/img/rubberband.png" />

#### Track label positioning

Track labels can be positioned on their own row or overlapping the data to save
vertical screen space. They can also be hidden. This is done by clicking on the
hamburger menu for a specific view.

<!--
http://localhost:3000/?config=test_data%2Fvolvox%2Fconfig.json&session=share-1RbMciFHOT&password=wYEDf
-->

<Figure caption="Example of using the overlap and offset track label positioning options" src="/img/tracklabels.png" />

#### Horizontally flip

The view can be horizontally flipped, or reverse complemented, to make the
coordinates go from right to left instead of left to right

We use triangles pointing in the direction of the orientation in the overview
bar to help indicate whether the app is horizontally flipped or not

Here is an example of before and after horizontally flipping the view

<Figure caption="Before and after horizontally flipping" src="/img/horizontally_flip.png" />

## Sequence track

The sequence track shows the reference sequence and a three-frame translation.
If the view is horizontally flipped, the sequence is "reverse complemented" so
the bottom three translation frames go to the top, and the top frames go to the
bottom.

<Figure caption="The sequence track, with a positive strand gene for context, shows the start codon on the first exon in the top-three rows of the translation frame. The bottom panel shows the same view but with the view horizontally flipped, and the gene is now shown reversed and the start codon is in the bottom translation frames." src="/img/sequence_track.png" />

## Alignments tracks

Visualizing alignments is an important aspect of genome browsers. This guide
will go over the main features of the "Alignments track"

The alignments track is a combination of a pileup and a coverage visualization

### Pileup visualization

The pileup is the lower part of the alignments track and shows each of the
reads as boxes positioned on the genome.

By default the reads are colored red if they aligned to the forward strand of
the reference genome, or blue if they aligned to the reverse strand.

### Coverage visualization

The coverage visualization shows the depth-of-coverage of the reads at each
position on the genome, and also draws using colored boxes any occurrence of
mismatches between the read and the reference genome, so if 50% of the reads
had a T instead of the reference A, half the height of the coverage histogram
would contain a 'red' box

<!--
image info:
window.innerWidth
1378
window.innerHeight
513
https://s3.amazonaws.com/jbrowse.org/code/jb2/alpha/master/index.html?config=test_data%2Fconfig_demo.json&session=eJztVctu2kAU_RU0q1Yixjbh5V0e5NFSioA2UqsKje2LPYk9tmYGSIL8770zJsYkRF1U6qoLFtzXOXN8Zu6WcJoC8cgYNo0ZSMky3nBt1z6xeyd2d-7aXsf17IFlO70fpElSKiLGiWc3SSjoBsQdC1VMvHb_tEnWDDaSeD-3hIU48u75Sn1yJ_c-9oVM5gl9GpdgceQMMKiecv1vxDhQcQ08S-E7jsBMtlxKUJNH4jnt027X6nR7_U7HcQY9u9Mkfj4BYZLVYAinECH3El7Acofk4DCpqFCGMnDk5Z4O3I7ddbFZwBqEBAwuaSKhSaiUkPrJAc_iFzIVNHioHe2b0x9GjjMc7U9xlrCIp8CVnOtiTMTAohiB3QFqE2R8yaKVoApZYjmP0kRg0YQlsMrLFq8SbhEl12rUH-7H1-v2ox3bfjN6e7zFHOE2fIFe5CaLiZ0BZp_Pp-1GTgOfZY0P4-svo-nHRlVUF0brUEqDygRUQZSJJx0zI3SQhjRXIGpczml6tgvi96PpKAsquivBtNZK5dJrtWTboil9zjjdSCvI0ta9L7KNBCsTUSsyJpEtjd4SQEO5wKPIB1-0rSVdmJOd2JZrtRcpzXMILcQiRZMwHsKjBkv-ITD-GCmKQhsN8QV6TcOW32W6C735YFUC-2br6AqoWgk4Un4kWRi02XhykaGzaQSHxkqSYJjOzmTK98Z6U7x316D_vrmOtL12mOR5sCv5g80OK__WazVqe8_Jlf_flQeufG3LmmzHzHYka2ZISCBQ-v3VUcYjLNZnk3G2eekgnhIrKGOlycuIflpjFsINUtdou1d4H_qK_XqrVCnjsZmBzMS8pBYzBBFBzAKakBLEWHJEfUhkHfsCn2cQet_sBmoC1R6LQBkh6vPmdbzqHr1fUV2rm_dKLmtwRN-vJKG52UFbVG3JEmQ4h0elZSxX6sEq1ZLTQLE1XL7iXZjLyhEEjXTLcevxAEyi-A3q17Nj
-->

<Figure caption="Screenshot showing the alignments track, which contains both a coverage view at the top and a pileup view at the bottom" src="/img/alignments.png" />

### Show soft clipping

If a read contains bases that do not map the the genome properly, they can
either be removed from the alignment (hard clipping) or can be included, and
not shown by default (soft clipping)

JBrowse 2 also contains an option to "show the soft clipping" that has occurred.
This can be valuable to show the signal around a region that contains
structural variation or difficult mappability

<!--
image info:
window.innerWidth
1378
window.innerHeight
513
http://localhost:3001/?config=test_data%2Fvolvox%2Fconfig.json&session=eJztVVFv2jAQ_ivIT5sENAHaoryxdms7VR0qrJs0Tcgkh-M1cTLbCTCU_76zQ5N0pFWr7XEvkXx33_edL5_tHRE0BuKRK6GBSap5IjoalO7AhsZpBKRLYioZF8RzuiSQdA3yCw90SLzheNQlOYe1It63HeEB0vCaZmFoEK63qRG45gKovACRxHCHIMwkq5UCPd0Qb3Dijkb9oTMYDN3T8fhkeNwly3QK0iSdvovKXKUR3UJwCwzJS0kJq5uyfV-zCTIqTaW2nYLAdo4dx0GshBykAgysaKSgS6hSEC-j7R6cJ1GebEjxHZuV1L9v7Icx9-P7H4uv63ojk4gzEYPQam6KMRECZyHKDo5R2E_EirOsnEFF3osSwXoSaKB6Ku_5ksYInPIIsrSk8faKm9j9fJ8Fp25YSzbrajnXOZTbtUPstq6C59pZpBaBxaI5FVvZsZWdNddhZ3bXeWPq33YqQHOcZnYPA8V5-hT9kMitidaDMxka0FSDbLR8hqyTfRSRuLpO_GpfmeRYYzy1CKimR6XGUdt--na8heXgf8NhPtwQKfiZgfBhctD0fJ2847puW9v1i0X7gyXXpCgK41IRgESjGlD5-273oYP_WiUQN8vZB6A6k9BS3pIsrNrsZnqW4LGgDB77T7Nfq_MLeTPa1P47KK5NOHrGgy2wlxhRidTfw17hxseof2TJxg7qX6yy5X_zPjLvn-5tjK3Nky1Zy6EgAl-bK95EuWBYbDcQJusHBPG0zKCMlWehjJjLO-QBXOIIjNr-pq9DnxBvHqsqZa04s5KJnJethRxFpB9yn0akFLHOvaZLiFRT-wxNA9I8antC00D1PDLQdhBNvnlTrzpuT1dUp-_yqZLzhpwxXRJFNLXv3A6ntuIRdjiHjTZjLF_qthfaTJ76mudw_or2n8kV9kYQuECNK4FvMprP8BXFb9Ec-8Q
-->

<Figure caption="Shows what turning on soft-clipping enables for a simulated long-read dataset. There is a simulated structural variant, a deletion, at this position, so the read has bases that map to the other side of the deletion being revealed by this." src="/img/alignments_soft_clipped.png" />

### Sort by options

The alignments tracks can also be configured to "sort by" a specific attribute
for reads that span **the center line**.

By default the center line is not shown, but by showing it (Go to the view's
hamburger menu->Select "Show center line") then you will obtain a better idea
of what the "sort by" option is doing

### Showing the center line

Here is how to turn on the center line

1. Open the hamburger menu in the top left of the linear genome view
2. Select "Show center line"

<Figure caption="Illustrates before and after turning on the center line. The center line is an indicator that shows what base pair underlies the center of the view. Note that this is used in the 'Sort by' option discussed below; the sort is performed using properties of the feature or even exact base pair underlying the center line" src="/img/alignments_center_line.png" />

### Sorting by base

Sorting by base will re-arrange the pileup so that the reads that have a
specific base-pair mutation at the position crossing the center line (which is
1bp wide) will be arranged in a sorted manner. To enable Sort by base

1. Open the track menu for the specific track using the vertical '...' in the
   track label
2. Select 'Sort by'->'Base pair'

<Figure caption="Illustrating the pileup re-ordering that happens when turning on the 'Sort by'->'Base pair'. The sorting is done by specifically what letter of each read underlies the current center line position (the center line is 1bp wide, so sorted by that exact letter)" src="/img/alignments_center_line.png" />

### Sort, color and filter by tag

We can now also do things like

- Sort by tag
- Filter by tag
- Color by tag

With these features, we can create very expressive views of alignments tracks.
For example, in the below step-by-step guide, it shows how to color and sort
the reads by the HP tag.

<Figure caption="Step-by-step guide showing how to sort and color by haplotype with the HP tag" src="/img/alignments/haplotype.png" />

### Color by modifications/methylation

If you have data that marks DNA/RNA modifications using the MM tag in BAM/CRAM
format, then the alignments track can use these to color these. It uses two
modes

1. Modifications mode - draws the modifications as they are
2. Methylation mode - draws both unmodified and modifified CpGs (unmodified
   positions are not indicated by the MM tag and this mode considers the
   sequence context)

<Figure caption="The track menu can be used to access the settings to color by modifications or methylation" src="/img/alignments/modifications1.png" />
<Figure caption="Screenshot showing the same track in both modifications mode and methylation mode" src="/img/alignments/modifications2.png" />
<Figure caption="After the setting has been enabled you can revisit the dialog box to see the current coloring settings" src="/img/alignments/modifications3.png" />

### Color by orientation

JBrowse uses the same color scheme as IGV for coloring by pair orientation.
These pair orientations can be used to reveal complex patterns of structural
variation

See https://software.broadinstitute.org/software/igv/interpreting_pair_orientations for a good guide on interpreting these pair orientations

<Figure caption="This shows an inverted duplication, the tandem duplication can produce green arrows which have reads pointing in opposite directions e.g. <-- and -->, while blue arrows which can indicate an inversion point in the same direction e.g. --> and -->" src="/img/inverted_duplication.png" />

## BigWig tracks

Visualizing genome signals, whether it is read depth-of-coverage or other
signal, can often be done by using BigWig files

<Figure caption="A simple wiggle track with the XY plot renderer" src="/img/bigwig_xyplot.png" />

### Viewing whole-genome coverage for profiling CNV

The latest jbrowse also allows refining the resolution of BigWig
tracks, and viewing whole genome coverage. This allows us to get detailed
global views of CNV for example from whole-genome coverage profiling

Here is a short picture guide to setup a whole-genome view of a BigWig
for CNV coverage visualization

1. Open your BigWig track
2. Go to the view menu and select "Show all assembly regions"
3. Adjust the "Autoscale type" to your liking, the new options for "Local
   +/- 3sd" allows the autoscaling to avoid outliers
4. Go to the track menu and select "Turn off histogram fill", which then
   shows only a dot for each point on the graph
5. Go to the track menu and select "Resolution->Finer resolution" a
   couple times until resolution looks nice

Also note: all tracks have a drag handle on the bottom of it which you
can drag down to make the track taller

<Figure caption="A step-by-step guide to view a whole-genome CNV profile of coverage from a BigWig file" src="/img/bigwig/whole_genome_coverage.png" />

## Variant tracks

Visualizing variant tracks from the VCF format alongside the original alignment
evidence track is a common workflow for validating your results. In JBrowse 2
we can open a variant track and an alignments track as shown below

<Figure caption="Variant track indicating a SNP alongside the alignment track evidence" src="/img/variant_with_pileup.png" />

### Variant widget

The variant features have a specialized widget that contains a table indicating
all the calls that were made in a multi-sample VCF. Some VCF files, like the
1000 genomes VCF, can contain thousands of samples in a single file. This
table can display the details

<Figure caption="Screenshot showing the variant feature sidebar with a filtered by genotype (with alternative allele '1'). Users can also filter by sample name or other attributes" src="/img/variant_panel.png" />

## Linear synteny and dotplot views

The dotplot view is a 2D comparative view that can display alignments between
different genome assemblies, or even compare a long-read or NGS short-read
versus the genome

### Opening a dotplot view

Currently the workflow for launching a dotplot is done by navigating in the
header bar to the File->Add->Dotplot view

This will let you select the genome assemblies of interest

Then you can also provide a synteny file in the form of PAF via the Add track
workflow

Then currently you must configuration edit the PAFAdapter to indicate the two
assemblies in the PAFAdapter

<Figure caption="Adding a new dotplot or synteny view via the menubar" src="/img/dotplot_menu.png" />

<Figure caption="Example of the import form for a dotplot or synteny view. Allows you to select two different assemblies and a PAF file can be supplied via a URL" src="/img/dotplot_add.png" />

<Figure caption="Example of a dotplot visualization of the grape vs the peach genome" src="/img/dotplot.png" />

See the [dotplot configuration](config_guide#dotplot-view-config) for more
detailed descriptions

### Opening a linear synteny view

Use the main menu bar to select

File->Add->Linear synteny view

<Figure caption="Example of the import form for a synteny view allowing you to select two different assemblies and optionally adding a PAF file via a URL" src="/img/dotplot_add.png" />

<Figure caption="Example screenshot showing the linear synteny view for grape vs peach" src="/img/linear_synteny.png" />

See the [linear synteny
configuration](config_guide#configuring-linear-synteny-views) for more details
on manually configuring the synteny view

### Opening a synteny view from a dotplot view

We have designed JBrowse 2 to be able to open up a synteny view from a dotplot
view. This is enabled by "display modes" so that the same track can be
displayed in different contexts.

Here is a short demo that shows opening a synteny view from a dotplot view
selection

<Figure caption="Screenshow showing the 'click and drag' selection over the dotplot view prompts you to open up a linear synteny view from the selected region" src="/img/synteny_from_dotplot_view.png" />

### Long read vs reference plots

One can also launch a dotplot view that compares a long read to the reference
genome by

- Right clicking an alignment
- Select "Dotplot read vs ref" or "Linear read vs ref" in the context menu

<Figure caption="Example of a dotplot of a long read vs the reference genome" src="/img/dotplot_longread.png" />

<Figure caption="Example of a 'synteny' view of a long read vs the reference genome" src="/img/linear_longread.png" />

## Hi-C tracks

Visualizing Hi-C data can be performed with .hic files which are generated by
the Juicebox software suite. It uses the hic-straw module developed by the
juicebox/igv.js team to visualize it in jbrowse.

Currently configuration options are basic for Hi-C tracks, see
[configuration](config_guide#hictrack-config) for info about configuring Hi-C
tracks

<Figure caption="Screenshot of a Hi-C track" src="/img/hic_track.png" />

## SV inspector

The SV inspector is a "workflow" that is designed to help users inspect
structural variant calls

### Opening the SV inspector

We can start the SV inspector by launching it from the App level menu bar

<Figure caption="The SV inspector can be launched from the main menu bar" src="/img/sv_inspector_begin.png" />

This will bring up an "import form" that asks you for your SV evidence. This
can be provided opening a file locally or using a URL for files in the
following formats:

- VCF or VCF.gz (plain text VCF, or (b)gzipped VCF)
- BEDPE
- STAR-fusion result file

<Figure caption="The import form for getting started with the SV inspector" src="/img/sv_inspector_importform.png" />

### Example SV inspector workflow

We can start the SV inspector workflow by opening up this file containing
translocation events called from a breast cancer cell line SKBR3, based on
these published data http://schatz-lab.org/publications/SKBR3/

    ## Example VCF for use in the SV inspector
    https://jbrowse.org/genomes/hg19/skbr3/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.bam.sniffles1kb_auto_l8_s5_noalt.new.vcf

Copy this URL and paste it into the import form and select hg19

<Figure caption="The SV inspector with the import form and URL pasted" src="/img/sv_inspector_importform_after.png" />

### SV inspector results

After loading the user's requested file, you will have a tabular view with each
row representing a row of the file you opened, along with a whole-genome
overview of the SVs on the right

<Figure caption="The SV inspector with loaded results" src="/img/sv_inspector_importform_loaded.png" />

Now here is where things can become interesting

We can search and filter the table, with filtering and searching being reflected
in the circular view as well.

<Figure caption="The SV inspector with filter applied" src="/img/sv_inspector_importform_filtered.png" />

### Launching breakpoint split view

By clicking on the features in the circular view, or clicking on the triangle
drop-down on the leftmost column of the table, we can dynamically launch
a new view of the data that is called the "split view" or the "breakpoint split
view"

This allows us to inspect the breakpoints of the structural variant, and
compare each side to the alignments.

<Figure caption="Screenshot of the 'breakpoint split view' which examines the breakpoints of a structural variant, e.g. an interchromosomal translocation, and connects supporting reads (black splines) and the variant call itself (green thicker line, with feet indicating directionality)" src="/img/breakpoint_split_view.png" />

## Getting the protein sequence for features

If you have a track with gene or transcript level features, then the feature
detail sidebar will automatically stitch together the sequence for that
feature. The options include:

- CDS - the coding sequences, spliced together
- Protein - performs protein translation on the CDS, currently assuming the
  default codon translation table
- cDNA - the CDS plus UTR, or just all exons if a non-coding gene
- Gene w/ introns - the entire gene region sequence with the introns included
- Gene w/ 10bp of introns - the spliced gene sequence with 10bp around the
  splice sites shown
- Gene w/ 500 up+down stream - the entire gene region with 500bp upstream and
  downstream (shown in light red)
- Gene w/ 500 up+down stream + 10bp of introns - the spliced gene sequence with
  10bp around the splice sites shown and the up/down stream shown

Some of the params such as 500bp and 10bp are arbitrarily chosen, if you are
interested in adjusting these parameters let us know

<Figure caption="The sequence for the upstream and downstream, exons, and intron sequences shown in the feature details" src="/img/feature_details_sequence.png" />

## Using the plugin store

Users can add plugins to their session using the in-app plugin store. The
plugin will be added to your "session" which can be shared with the share
button (or if you are an admin running the admin-server, then it will be added
to the config file).

This can add extra functions or tracks or many other interesting features. For
example, if you add the CIVIC plugin, it will automatically add a track that
contains the CIVIC cancer gene annotations to hg19.

Note that not all plugins are directly useful from being added (sometimes it
needs extra work on the part of the plugin developer to make them useful in the
GUI, some plugins require hand editing of configuration files).

<Figure caption="Screenshot showing the plugin store inside the app" src="/img/plugin_store.png" />
