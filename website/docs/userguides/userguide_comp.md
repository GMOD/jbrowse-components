---
id: userguide_comp
toplevel: true
title: Comprehensive user guide
---

import Figure from '../figure'

This comprehensive user guide covers general UI navigation, features available for different track types, and supplementary tools available in JBrowse.

Use the navigation menu on the right to skip to a topic of interest, if applicable.

## Navigating the UI

### Linear genome view usage

To open a linear genome view (LGV), use the menu bar: `ADD` -> `Linear genome view`

#### Scrolling

You can scroll side to side using your mouse wheel or via click and drag. Left and right pan buttons found in the header of the LGV can also be used to scroll in their respective directions.

#### Zooming

The zoom buttons and the slider bar found in the header of the linear genome view can be used to zoom in and out on the view

You can also hold the `Ctrl` key and use your mousewheel or trackpad to scroll to zoom in and out.

#### Re-ordering tracks

Click and drag up or down on the drag handle on the track labels (indicated by six vertical dots) to reorder tracks.

<Figure caption="(1) Use Add, Linear genome view to add a new LGV. (2) The pan buttons can be used to scroll left or right. (3) The zoom buttons or the slider can be used to zoom on the view. (4) Tracks can be reordered by clicking and dragging the drag handle indicated by six vertical dots." src="/img/lgv_usage_guide.png" />

#### Using the location search box

The location search box is located at the top of the LGV.

You can search a location in several ways when typing in the search box:

1. Searching by region and location, e.g. `chr1:1..100` or `chr1:1-100` or `chr1 1 100`
2. Searching by assembly, region, and location, e.g. `{hg19}chr1:1-100`
3. Searching discontinuous regions, delimited by a space, and opening them side-by-side, e.g. `chr1:1..100 chr2:1..100`
4. Searching in any of the above ways and appending \[rev\] to the end of the region will horizontally flip it, e.g. `chr1:1-100\[rev\]`
5. If configured, searching by gene name or feature keywords, e.g. `BRCA1`

To configure name searching, you or the admin of the instance will need to
create a "text index". See the [configuration guide](./userguide_cli#indexing-feature-names-for-searching) for more information.

<Figure caption="When configured, you can search for gene names or other features via the location search box." src="/img/searching_lgv.png" />

## Opening tracks

To open a new track or connection, use the menu bar: `File` -> `Open track..`

<Figure caption="After opening the menu item for 'Open track..' a drawer widget for the 'Add a track' form will appear" src="/img/add_track_form.png" />

:::info Tip
There is a circular plus (+) icon button inside the "Available tracks" widget that
can also be used to access the "Add a track" form.
:::

<Figure caption="(1) Open the 'Available tracks' widget with the button on the far left of the linear genome view. (2) The orange plus (+) icon button in the bottom right the 'Available Tracks' widget can also be used to launch the 'Add a track' form." src="/img/add_track_tracklist.png" />

In the "Add a track" form, you can provide a URL to a file to load, or you can
also open files from your local machine. In some cases, you need to provide an
index (bigwig files for example have no index, but BAM/CRAM or tabix filetypes
like VCF/GFF/BED tabix do). In some cases we can automatically infer the index
e.g. if you provide a URL for a BAM and the index filename is bamfilename
+'.bai' but you may need to manually supply it in some cases (index inference
can't be done with files from your local machine)

The following file formats are supported in core JBrowse 2:

- CRAM
- BAM
- htsget
- VCF (Tabix-indexed)
- GFF3 (Tabix-indexed)
- BED (Tabix-indexed)
- BigBed
- BigWig
- JBrowse 1 nested containment lists (NCLists)
- plain text VCF, BED, CSV, TSV, BEDPE, STAR-fusion output (tabular formats)
- PAF (synteny/dotplot)
- Indexed FASTA/BGZip indexed FASTA
- 2bit
- .hic (Hi-C contact matrix visualization)

Additional data formats can be supported via plugins; checkout the [plugin store](/plugin_store).

For tabix files, TBI or CSI indexes are allowed. CSI or BAI is allowed for BAM.
Only CRAI is allowed for CRAM. The index will be inferred for BAI or TBI files
as filename+'.bai' for example, but if it is different than this, make sure to
specify the index file explicitly.

:::info Note
If you are an administrator, you can add tracks with the [command line](/docs/userguides/userguide_cli/#adding-a-track) or with the [admin server](/docs/userguides/userguide_gui).
:::

### Undo and redo

You can undo the closing of a view, track, or any other action in the UI with
the Tools->Undo/Redo buttons. The keyboard shortcut "ctrl+z"/"cmd+z"(mac) work
for undo as well as "ctrl+y"/"cmd+shift"z"(mac)

### Undo and redo

You can undo the closing of a view, track, or any other action in the UI with
the Tools->Undo/Redo buttons. The keyboard shortcut "ctrl+z"/"cmd+z"(mac) work
for undo as well as "ctrl+y"/"cmd+shift"z"(mac)

### Sharing sessions

On JBrowse Web, the main menu bar has a "Share" button to enable users to share
their sessions with other people. The share button generates a URL that can be
sent to other users.

You **cannot** copy the URL in your address bar and send it to other users, you
**must** use the "Share" button to share your session.

:::info Note
Sharing sessions is not available for JBrowse Desktop.
:::

<Figure caption="The session share dialog, which gives you a short URL to share your session with other users. It is important to use the URLs generated here, rather than copying and pasting your browser's URL to other users." src="/img/share_button.png" />

The session URL will contain the following:

- what views are on the screen, and settings for the views (e.g. track labels
  overlapping or offset)
- what tracks are in the view
- extra tracks that you added with the "Add track workflow"
- for the alignments track, the show soft clipping and sort settings on the
  pileup
- ...and more!

This means you can share links with your custom tracks with other users,
without being a JBrowse admin!

### Track menu

Users can access track-specific functions by using the track menu, which is
accessible from the track selecter itself ("..." icon) or on the track label
(vertical "..."). Some functions are only available when the track is open e.g.
from the track label, but more basic options like "About track" are available
from the track menu on the track selector.

<Figure caption="Screenshot showing how to open the track menu (both in the track selector area and in the track label area of the linear genome view), and an example of a VCF track with it's track menu open" src="/img/track_menu.png" />

### About track dialog

Using the track menu as described above, you can access the "About track"
dialog.

<Figure caption="Screenshot of the 'About track' dialog for a CRAM file, showing the full CRAM file header and config info. Having the full header of a BAM/CRAM file available is helpful to easily check what genome it was aligned to, for example." src="/img/about_track.png"/>

### Editing track configs

As a non-admin user, in order to edit a track config, you have to make a copy
of the track. This will copy it to your "session tracks", which you can edit
freely.

<Figure caption="Screenshot showing the procedure to copy the track before being able to edit the settings" src="/img/edit_track_settings.png" />

#### Rubberband selection

The scale bars accept a click-and-drag action to select a region. Rubberband selection can be performed on both the main (lower) and overview (upper) scale bars.

<Figure caption="Screenshot of rubberbanding both the main and overview scalebars. The main scalebar produces extra options on selection, e.g. Zoom to region, Get sequence, etc.." src="/img/rubberband.png" />

#### Track label positioning

Track labels can be positioned on their own row or overlapping the data to save
vertical screen space. They can also be hidden. This is done by clicking on the
hamburger menu for a specific view.

<Figure caption="Example of using the overlap and offset track label positioning options." src="/img/tracklabels.png" />

#### Horizontally flip

The view can be horizontally flipped, or reverse complemented, to make the
coordinates go from right to left instead of left to right.

We use triangles pointing in the direction of the orientation in the overview
bar to help indicate whether the app is horizontally flipped or not.

Here is an example of before and after horizontally flipping the view:

<Figure caption="Before and after horizontally flipping." src="/img/horizontally_flip.png" />

## Sequence track

The sequence track shows the reference sequence and a three-frame translation.
If the view is horizontally flipped, the sequence is "reverse complemented" so
the bottom three translation frames go to the top, and the top frames go to the
bottom.

<Figure caption="The sequence track, with a positive strand gene for context, shows the start codon on the first exon in the top-three rows of the translation frame. The bottom panel shows the same view but with the view horizontally flipped, and the gene is now shown reversed and the start codon is in the bottom translation frames." src="/img/sequence_track.png" />

## Alignments tracks

Visualizing alignments is an important aspect of genome browsers. This guide
will go over the main features of the "Alignments track."

The alignments track is a combination of a pileup and a coverage visualization.

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
would contain a 'red' box.

<Figure caption="Screenshot showing the alignments track, which contains both a coverage view at the top and a pileup view at the bottom" src="/img/alignments.png" />

### Show soft clipping

If a read contains bases that do not map the the genome properly, they can
either be removed from the alignment (hard clipping) or can be included, and
not shown by default (soft clipping).

JBrowse 2 also contains an option to "show the soft clipping" that has occurred.
This can be valuable to show the signal around a region that contains
structural variation or difficult mappability.

<Figure caption="The soft clipping option is a toggle in the 'Pileup settings' menu." src="/img/alignments_soft_clipped_menu.png" />
<Figure caption="Shows what turning on soft-clipping enables for a simulated long-read dataset. There is a simulated structural variant, a deletion, at this position, so the read has bases that map to the other side of the deletion being revealed by this." src="/img/alignments_soft_clipped.png" />

### Sort by options

The alignments tracks can also be configured to "sort by" a specific attribute
for reads that span **the center line**.

By default the center line is not shown, but by showing it (detailed below) then you will obtain a better idea
of what the "sort by" option is doing.

### Showing the center line

1. Open the hamburger menu in the top left of the linear genome view
2. Select "Show center line"

<Figure caption="The 'show center line' option is a toggle in the LGV menu." src="/img/alignments_center_line_menu.png" />
<Figure caption="The center line is an indicator that shows what base pair underlies the center of the view." src="/img/alignments_center_line.png" />

:::info Note
The center line is used by the 'Sort by' function discussed in this section; the sort is performed using properties of the feature, or even exact base pair underlying the center line.
:::

### Sorting by base pair

Sorting by base pair will re-arrange the pileup so that the reads that have a
specific base pair mutation at the position crossing the center line (which is
1bp wide) will be arranged in a sorted manner. To enable Sort by base pair:

1. Open the track menu for the specific track using the vertical '...' in the
   track label
2. Select `Pileup settings`->`Sort by`->`Base pair`

<Figure caption="Illustrating the pileup re-ordering that happens when turning on the 'Sort by'->'Base pair'. The sorting is done by specifically what letter of each read underlies the current center line position (the center line is 1bp wide, so sorted by that exact letter)" src="/img/alignments_sort_by_base.png" />

### Sort, color and filter by tag

With these features, we can create expressive views of alignments tracks.
For example, in the below step-by-step guide, it shows how to color and sort
the reads by the HP tag:

<Figure caption="Step-by-step guide showing how to sort and color by haplotype with the HP tag." src="/img/alignments/haplotype.png" />

### Color by modifications/methylation

If you have data that marks DNA/RNA modifications using the MM tag in BAM/CRAM
format, then the alignments track can use these merks to color these modification. It uses two
modes:

1. Modifications mode - draws the modifications as they are
2. Methylation mode - draws both unmodified and modifified CpGs (unmodified
   positions are not indicated by the MM tag and this mode considers the
   sequence context)

<Figure caption="The track menu can be used to access the settings to color by modifications or methylation." src="/img/alignments/modifications1.png" />
<Figure caption="Screenshot showing the same track in both modifications mode and methylation mode." src="/img/alignments/modifications2.png" />
<Figure caption="After the setting has been enabled you can revisit the dialog box to see the current coloring settings." src="/img/alignments/modifications3.png" />

### Color by orientation

JBrowse uses the same color scheme as IGV for coloring by pair orientation.
These pair orientations can be used to reveal complex patterns of structural
variation.

See [IGV's Interpreting Color by Pair Orientation guide](https://software.broadinstitute.org/software/igv/interpreting_pair_orientations)
for further details on interpreting these pair orientations.

<Figure caption="This shows an inverted duplication, the tandem duplication can produce green arrows which have reads pointing in opposite directions e.g. <-- and -->, while blue arrows which can indicate an inversion point in the same direction e.g. --> and -->" src="/img/inverted_duplication.png" />

### Sashimi-style arcs

The alignments track will draw sashimi-track style arcs across spliced
alignments (indicated by N in the CIGAR string). If the reads additionally are
tagged with XS tags, it will try to draw the arcs using the strand indicated by
the alignment.

<Figure caption="Sashimi-style arcs that are automatically drawn from spliced alignments. These arcs will be drawn by default on both short-reads e.g. RNA-seq and long reads e.g. Iso-Seq" src="/img/alignments_track_arcs.png" />

:::info Note
You can disable these by clicking on the track menu (vertical "..."
next to track label, then hovering over SNPCoverage options, and unchecking
"Draw arcs").
:::

### Insertion and clipping indicators

The alignments track will also draw an upside-down histogram of insertion and
soft/hard clipped read counts at all positions, and mark significant positions
(covering 30% of the reads) with a colored triangle.

<Figure caption="Clipping and insertion indicators are drawn at the top of the alignments track. Purple indicates insertions, the blue indicates soft clipping, and red indicates hard clipping." src="/img/alignment_clipping_indicators.png" />

Also, insertions that are larger than 10bp are marked with a larger
purple rectangle, seen in the screenshot below. Generally, long reads span
larger insertions better, so this feature is more prominant with large reads.

<Figure caption="Large insertion indicator drawn from long reads, along with the 'show soft clipping' setting turned on for a short read track." src="/img/insertion_indicators.png" />

:::info Note
You can disable these by clicking on the track menu (vertical "..."
next to track label, then hovering over SNPCoverage options, and unchecking
"Draw insertion/clipping indicators" and "Draw insertion/clipping counts")
:::

## Quantitative tracks

Visualizing genome signals, whether it is read depth-of-coverage or other
signal, can often be done by using BigWig or other quantitative feature files.

<Figure caption="A simple wiggle track with the XY plot renderer." src="/img/bigwig_xyplot.png" />

### Viewing whole-genome coverage for profiling CNV

You can refine the resolution of BigWig tracks, and
view whole genome coverage to get detailed global views of
CNV, for example from whole-genome coverage profiling.

Here is a short picture guide to setup a whole-genome view of a BigWig for CNV
coverage visualization:

1. Open your BigWig track
2. Go to the view menu and select "Show all assembly regions"
3. Adjust the "Autoscale type" to your liking, the new options for "Local +/-
   3sd" allows the autoscaling to avoid outliers
4. Go to the track menu and select "Turn off histogram fill", which then shows
   only a dot for each point on the graph
5. Go to the track menu and select "Resolution->Finer resolution" a couple
   times until resolution looks nice

:::info Note
All tracks have a drag handle on the bottom, which you can drag down to make the track taller.
:::

<Figure caption="A step-by-step guide to view a whole-genome CNV profile of coverage from a BigWig file." src="/img/bigwig/whole_genome_coverage.png" />

## Multi-quantitative tracks

In 2.1.0, we created the ability to have "Multi-quantitative tracks" which is a
single track composed of multiple quantitative signals, which have their
Y-scalebar synchronized. There are 5 rendering modes for the multi-quantitative
tracks

- xyplot
- multirowxyplot
- multiline
- multirowline
- multidensity

You can interactively change these settings through the track menu

<Figure caption="Track menu for the multi-quantitative tracks showing different renderer types" src="/img/multiwig/multi_renderer_types.png" />

With the "multi-row" settings (multirowxyplot, multirowline, multidensity) the
track colors are not modified. For the overlapping (xyplot, multiline), the
tracks will be autoassigned a color from the palette. You can manually
customize the subtrack colors from the track menu as well

<Figure caption="The color/arrangement editor for multi-quantitative tracks let's you change individual subtrack colors, or their ordering in the row based layouts" src="/img/multiwig/multi_colorselect.png" />

Oftentimes, one of the outliers on one of the subtracks may affect the
Y-scalebar too much, so it is often helpful to use the "Autoscale type->Local
+/- 3SD" setting (3 standard deviations are displayed). Manually configuring
the min or max scores is available via the track menu also.

### Adding multi-quantitative tracks via the UI

There are several ways to create multi-quantitative tracks from scratch

1. Using the add track panel to open up a list of URLs for bigwig files, or from several local tracks from your machine
2. Using the track selector to add multiple tracks to your current selection, and then creating a multi-wiggle track from the tracks in your selection
3. Hardcoding the multiwiggle track in your config file (see [multi-quantitative track configuration](../config_guide#multiquantitativetrack-config) for more info)

<Figure caption="Using the add track widget, you can use the select dropdown to access alternative 'add track workflows' including the multi-wiggle add track workflow. In the multiwiggle add track workflow, you can paste a list of bigWig file URLs, or open up multiple bigwig files from your computer" src="/img/multiwig/addtrack.png" />
<Figure caption="Using the track selector, you can add multiple tracks to your current selection. You can use the '...' dropdown menu to add a single track or a whole category of tracks to your selection. Then, the 'shopping cart' icon in the header of the add track widget let's you create a multi-wiggle track from your selection" src="/img/multiwig/trackselector.png" />

## Multi-quantitative tracks

In 2.1.0, we created the ability to have "Multi-quantitative tracks" which is a
single track composed of multiple quantitative signals, which have their
Y-scalebar synchronized. There are 5 rendering modes for the multi-quantitative
tracks

- xyplot
- multirowxyplot
- multiline
- multirowline
- multidensity

You can interactively change these settings through the track menu

<Figure caption="Track menu for the multi-quantitative tracks showing different renderer types" src="/img/multiwig/multi_renderer_types.png" />

With the "multi-row" settings (multirowxyplot, multirowline, multidensity) the
track colors are not modified. For the overlapping (xyplot, multiline), the
tracks will be autoassigned a color from the palette. You can manually
customize the subtrack colors from the track menu as well

<Figure caption="The color/arrangement editor for multi-quantitative tracks let's you change individual subtrack colors, or their ordering in the row based layouts" src="/img/multiwig/multi_colorselect.png" />

Oftentimes, one of the outliers on one of the subtracks may affect the
Y-scalebar too much, so it is often helpful to use the "Autoscale type->Local
+/- 3SD" setting (3 standard deviations are displayed). Manually configuring
the min or max scores is available via the track menu also.

### Adding multi-quantitative tracks via the UI

There are several ways to create multi-quantitative tracks from scratch

1. Using the add track panel to open up a list of URLs for bigwig files, or from several local tracks from your machine
2. Using the track selector to add multiple tracks to your current selection, and then creating a multi-wiggle track from the tracks in your selection
3. Hardcoding the multiwiggle track in your config file (see [multi-quantitative track configuration](../config_guide#multiquantitativetrack-config) for more info)

<Figure caption="Using the add track widget, you can use the select dropdown to access alternative 'add track workflows' including the multi-wiggle add track workflow. In the multiwiggle add track workflow, you can paste a list of bigWig file URLs, or open up multiple bigwig files from your computer" src="/img/multiwig/addtrack.png" />
<Figure caption="Using the track selector, you can add multiple tracks to your current selection. You can use the '...' dropdown menu to add a single track or a whole category of tracks to your selection. Then, the 'shopping cart' icon in the header of the add track widget let's you create a multi-wiggle track from your selection" src="/img/multiwig/trackselector.png" />

## Variant tracks

Visualizing variant tracks from the VCF format alongside the original alignment
evidence track is a common workflow for validating your results, shown below:

<Figure caption="Variant track indicating an SNP alongside the alignment track evidence." src="/img/variant_with_pileup.png" />

### Variant widget

The variant features have a specialized widget that contains a table indicating
all the calls that were made in a multi-sample VCF. Some VCF files, like the
1000 genomes VCF, can contain thousands of samples in a single file. This
table can display the details.

<Figure caption="Screenshot showing the variant feature sidebar with a filtered by genotype (with alternative allele '1'). Users can also filter by sample name or other attributes." src="/img/variant_panel.png" />

## Comparative views

The dotplot view is a 2D comparative view that can display alignments between
different genome assemblies, or even compare a long-read or NGS short-read
against the genome.

### Opening a dotplot view or synteny view

1. Navigate on the header bar `Add`->`Dotplot view` or `Add`->`Linear synteny view`
2. Select the genome assemblies of interest
3. Optionally, add a .paf, .out (MashMap), .delta (Mummer), .chain, .anchors or .anchors.simple (MCScan) file

<Figure caption="Adding a new dotplot or synteny view via the menubar." src="/img/dotplot_menu.png" />

<Figure caption="Screenshot of the import form for a dotplot or synteny view. You can select two different assemblies and an additional file can be supplied." src="/img/dotplot_add.png" />

<Figure caption="Screenshot of a dotplot visualization of the grape vs the peach genome." src="/img/dotplot.png" />

<Figure caption="Screenshot showing the linear synteny view for the grape vs peach genome." src="/img/linear_synteny.png" />

### Opening a synteny view from a dotplot view

You can open a synteny view from a dotplot view by selecting a region on the dotplot and clicking "Open linear synteny view", shown below:

<Figure caption="Screenshow showing the 'click and drag' selection over the dotplot view which prompts you to open up a linear synteny view from the selected region." src="/img/synteny_from_dotplot_view.png" />

### Long read vs reference plots

You can also launch a dotplot view that compares a long read to the reference
genome:

1. With your alignments track open, right click on an alignment
2. Select "Dotplot read vs ref" or "Linear read vs ref" in the context menu

<Figure caption="Screenshot of a dotplot produced by a long read vs the reference genome." src="/img/dotplot_longread.png" />

<Figure caption="Screenshot of a 'synteny' view produced by a long read vs the reference genome." src="/img/linear_longread.png" />

## Hi-C tracks

Visualizing Hi-C data can be performed with .hic files generated by
the Juicebox software suite. It uses the hic-straw module developed by the
juicebox/igv.js team to visualize it in JBrowse.

Currently configuration options are basic for Hi-C tracks, see
[the comprehensive config guide](../config_guide#hictrack-config) for info about configuring Hi-C
tracks.

<Figure caption="Screenshot of a Hi-C track" src="/img/hic_track.png" />

## SV inspector

The Structural Variant (SV) inspector is a "workflow" that is designed to help users inspect
structural variant calls.

### Opening the SV inspector

We can start the SV inspector by launching it from the App level menu bar

<Figure caption="The SV inspector can be launched from the main menu bar" src="/img/sv_inspector_begin.png" />

This will bring up an "import form" that asks you for your SV evidence.

The following formats are supported:

- CSV, TSV
- VCF or VCF.gz (plain text VCF, or (b)gzipped VCF)
- BED, BEDPE
- STAR-fusion result file

<Figure caption="The import form for getting started with the SV inspector" src="/img/sv_inspector_importform.png" />

### Example SV inspector workflow

We can start the SV inspector workflow by opening up this file containing
translocation events called from a breast cancer cell line SKBR3, based on
[these published data](http://schatz-lab.org/publications/SKBR3/).

    ## Example VCF for use in the SV inspector
    https://jbrowse.org/genomes/hg19/skbr3/reads_lr_skbr3.fa_ngmlr-0.2.3_mapped.bam.sniffles1kb_auto_l8_s5_noalt.new.vcf

Copy this URL and paste it into the import form and select hg19:

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
feature. Options include:

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

Some of the parameters such as 500bp and 10bp are arbitrarily chosen, if you are
interested in adjusting these default parameters [let us know](/contact/).

<Figure caption="The sequence for the upstream and downstream, exons, and intron sequences shown in the feature details" src="/img/feature_detail_sequence.png" />

## Using the plugin store

Users can add plugins to their session using the in-app plugin store. The
plugin will be added to your "session" which can be shared with the share
button (or if you are an admin running the admin-server, then it will be added
to the config file).

This can add extra functions, tracks, or many other interesting features. For
example, if you add the CIVIC plugin, it will automatically add a track that
contains the CIVIC cancer gene annotations to hg19.

:::info Note
Not all plugins are directly useful from being added, and require hand-editing of the configuration file to be useful.
If you would like to use such a plugin and do not have access to the configuration file, contact your administrator.
:::

<Figure caption="Screenshot showing the plugin store inside the app" src="/img/plugin_store.png" />

## Using the bookmark widget

The "bookmark widget" can store lists of interesting regions that you might like to easily revisit.

<Figure caption="Clicking and dragging on a region can be used to create a bookmark" src="/img/bookmark_widget.png"/>

The bookmark stores a list of single regions (chromosome, start, and end
coordinate), and clicking on the regions in the bookmark widget will launch a
linear genome view at that region.

You can also import a list of regions from a BED file.

<Figure caption="Importing a list of regions from a BED file" src="/img/bookmark_widget_import.png"/>

:::info Note
You can add "notes" for your list of regions by double clicking on the label field to easily "annotate" your datasets.
:::

<Figure caption="Editing description" src="/img/bookmark_widget_edit_label.png"/>

Finally, you can export your list of regions to a BED file or TSV.
