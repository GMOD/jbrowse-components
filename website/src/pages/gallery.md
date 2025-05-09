# JBrowse 2 visualizations gallery

Below are some examples of the visualizations JBrowse 2 has to offer. For live
demos, have a look at the [demos page](../demos).

---

![](/img/dotplot.png)

A genome vs genome dotplot displayed in the DotplotView. This displays grape vs
peach genomes via PAF file

---

![](/img/linear_synteny.png)

A linear synteny display for grape vs peach displayed in the LinearSyntenyView
via MCScan anchors file results

---

![](/img/alignments_sort_by_base.png)

Shows sorting the alignments pileup by the base-pair-at-the-given-position in
the AlignmentsTrack

---

![](/img/hic_track.png)

Shows rendering of a .hic file type in the HicTrack

---

![](/img/sv_inspector_importform_loaded.png)

Screenshot of the SV inspector displaying inter-chromosomal translocations in
the SKBR3 cell line. The SV inspector is a tabular view plus whole-genome
circular overview of the SVs

---

![](/img/horizontally_flip.png)

Shows the ability to horizontally flip the current view. This allows the
anti-sense strand to be read left to right

---

![](/img/linear_longread.png)

Using the synteny view to render a long-read vs the reference genome. This is
available simply by clicking an alignments feature and selecting "Linear read vs
ref"

---

![](/img/dotplot_longread.png)

Using the dotplot view to render a long-read vs the reference genome. This is
available by right-clicking an alignments feature and selecting "Dotplot read vs
ref"

---

![](/img/cnv.png)

This is a whole-genome overview of CNV data using a BigWig file of read-coverage
depth. This uses the XYPlot, with fill turned off. The BigWig data is binned at
this resolution, and the blue shades represent the min, mean, and max value in
each bin

---

![](/img/breakpoint_split_view.png)

Image of the "breakpoint split view" which examines the breakpoints of a
structural variant, e.g. an interchromosomal translocation, and connects
supporting reads (black splines) and the variant call itself (green thicker
line, with feet indicating directionality)

---

![](/img/color_by_tag.png)

Image of coloring and sorting by the HP (haplotype) tag, which can be done for
BAM and CRAM. Users can color, sort, and filter by tags

---

![](/img/insertion_indicators.png)

The browser has a variety of ways to help show insertions including "large
insertion indicators" (a feature also seen in IGV) and upside down histogram of
insertion/clipping counts

---

![](/img/read_vs_ref_insertion.png)

The read vs reference visualization on a ~500 base pair insert in PacBio reads
from the SKBR3 (breat cancer) cell line. Users can right-click sequence reads,
then click "read vs reference" to show complex read alignments in a "synteny
style" view. Users can also interactively get the sequence of this inserted read
portion with a click-and-drag action

---

![](/img/modifications.png)

A methylated and unmethylated CpG island shown using the MM tag with nanopore
reads on the COLO829 (melanoma) cancer cell line
([live link](https://jbrowse.org/code/jb2/main/?config=test_data%2Fconfig_demo.json&session=share-LffYr8SI5E&password=VmZVl))

---

![](/img/multisv.png)

An example of the 1000 genomes structural variant call VCF, showing a large
inversion on chromosome 19. This screenshot used the in-app clustering workflow
on the inverted region, and then zoomed out further
([live link](https://jbrowse.org/code/jb2/main/?config=%2Fgenomes%2FGRCh38%2F1000genomes%2Fconfig_1000genomes.json&session=share-DN_h4SIwo4&password=CxkLw))
