---
title: AlphaGenome predictions
description:
  Predict expression, accessibility, splicing and 3D contacts over a locus, then
  score a variant against the reference
guide_category: Tutorials
tutorial_category: Epigenomics & single cell
---

AlphaGenome reads a megabase of DNA and predicts where it is transcribed, where
the chromatin is open, how it splices, and how it folds. We ask it about _TAL1_
in two cell lines, stack the answers that share units on one axis, and then
score an oncogenic insertion against the reference to see the enhancer it
creates.

:::caution Experimental

The AlphaGenome plugin is beta, and every track on this page is a model's
prediction. We welcome your [feedback](/contact).

:::

## Prerequisites

- [the AlphaGenome plugin](#the-alphagenome-plugin), which contributes the
  adapters these tracks use, the query panel, and the variant right-click item

## Where the data comes from

We ran two predictions over the _TAL1_ locus against
[AlphaGenome](https://www.alphagenomedocs.com/) and stored them under stable
tokens, following the AlphaGenome team's
[worked example](https://www.alphagenomedocs.com/colabs/example_analysis_workflow.html).
Reading the stored predictions needs no AlphaGenome API key and spends no quota.

- the reference prediction over chr1:46,700,048..47,748,623, all eleven output
  types, K562 and GM12878:
  https://0t0e9nn6bj.execute-api.us-east-2.amazonaws.com/Prod/api/predict/demo-tal1-interval
- the variant prediction, the same window scored for the Jurkat MuTE insertion
  in CD34+ common myeloid progenitors:
  https://0t0e9nn6bj.execute-api.us-east-2.amazonaws.com/Prod/api/predict/demo-tal1-variant-cd34
- the oncogenic _TAL1_ variants: https://jbrowse.org/demos/alphagenome_test.bed
- hg38's NCBI RefSeq annotation:
  https://jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz
- the hg38 sequence:
  https://hgdownload.soe.ucsc.edu/goldenPath/hg38/bigZips/hg38.2bit

## Predicted assays from sequence

Given a window of reference sequence and a cell type, AlphaGenome predicts the
RNA-seq, DNase, ATAC, CAGE, PRO-cap and ChIP-seq signal an experiment would
produce there, plus splice junctions and a contact map. Because the input is
sequence, changing one base and asking again gives a second prediction, and the
difference between the two is the variant's predicted effect.

The window is a megabase centered on _TAL1_, a transcription factor whose
misexpression drives T-cell acute lymphoblastic leukemia (T-ALL). _TAL1_ is on
in K562, an erythroleukemia line, and off in GM12878, a lymphoblastoid line, the
control in the locus figures below.

## The AlphaGenome plugin

The plugin is not in the [plugin store](/docs/user_guides/plugin_store) yet, so
it loads by URL from the `plugins` array in `config.json` (see
[configuring plugins](/docs/config_guides/plugins)):

```json
{
  "plugins": [
    {
      "name": "AlphaGenome",
      "umdUrl": "https://jbrowse.org/demos/alphagenome-plugin/jbrowse-plugin-alphagenome.umd.js"
    }
  ]
}
```

On [JBrowse Desktop](/docs/quickstart_desktop), install it once from the start
screen at **Global plugins... → Add custom plugin**, with that URL as the plugin
URL and the name `AlphaGenome`.

The plugin sends requests to a small service that holds the API key, runs the
prediction and stores the arrays. The public instance is the default, and
`setApiRoot` points the plugin at your own.[^license]

## Ask for a prediction

Open the session below. The locus is in view with RefSeq genes and the oncogenic
_TAL1_ variants, and no predictions yet.

```json session config=https://jbrowse.org/demos/alphagenome/config.json
{
  "defaultSession": {
    "name": "TAL1",
    "views": [
      {
        "id": "alphagenome_lgv",
        "type": "LinearGenomeView",
        "assembly": "hg38",
        "loc": "chr1:47,189,833..47,259,832",
        "tracks": ["genes", "tal1_variants"]
      }
    ]
  }
}
```

**AlphaGenome predictions…** in the view menu opens the query panel, which takes
four inputs:

- **what to predict**: any of the eleven output types, or a preset group
- **which cell types and tissues**: a search over the biosample catalog. This
  page uses K562 and GM12878 for the locus, and CD34+ progenitors for the
  variant
- **how wide a window**: 16 kb, 100 kb, 500 kb or 1 Mb, centered on the view
- **a variant**: left empty, the panel predicts the reference

A wide request takes minutes, and the browser polls until it finishes. The
service keys requests by content, so repeating a request this page already made
returns at once.[^rounding]

## Two cell lines on one axis

A finished prediction lists its tracks, often thousands. Filter the list to
`polyA plus`, tick K562 and GM12878, and **Add selected** puts both in one
multi-wiggle track on a shared y-axis. The panel stacks tracks in the same units
this way: several biosamples of one assay, DNase beside ATAC, CAGE beside
PRO-cap, histone ChIP beside TF ChIP. Untick **Stack on a shared scale** for one
track per pick.

<Figure caption="Predicted polyA plus RNA-seq over TAL1 in K562 and GM12878, both rows on one y-axis. The K562 row shows a block of signal across the annotated exons that the GM12878 row does not." src="/img/alphagenome/expression_two_cell_lines.png" />

_TAL1_ shows predicted transcription on its exons in K562 and almost none in
GM12878. _STIL_, to the right, is predicted in both lines, which shows the
GM12878 row loaded.

## Where the chromatin is open

Add the DNase and ATAC tracks for both biosamples the same way. All four land in
one track on one axis.

<Figure caption="Predicted DNase and ATAC for K562 and GM12878, four rows on one shared y-axis because accessibility is one set of units. The K562 ATAC row runs high across the whole window; the K562 DNase row below it resolves into peaks." src="/img/alphagenome/accessibility_shared_axis.png" />

Predicted ATAC in K562 sits above every other row across the window, and K562
DNase resolves into peaks. The GM12878 rows have peaks too, at open chromatin
that is not transcribed.

## Splice junctions

Splice junctions come back as arcs in a sashimi plot. Add the K562 and GM12878
polyA junctions and zoom in to _TAL1_.[^junctions]

<Figure caption="Predicted splice junctions over TAL1 for K562 and GM12878 polyA plus RNA-seq. The K562 arcs join the exons the RefSeq track draws; the GM12878 lane has none." src="/img/alphagenome/splice_junctions.png" />

The K562 arcs land on the exon boundaries in the RefSeq track. The GM12878 lane
is empty, because _TAL1_ is off there.

## Contact map

AlphaGenome predicts contact maps at 2 kb bins for about a dozen cell lines,
GM12878 among them. Add the GM12878 contact map and zoom out to the whole
predicted megabase; the adapter reads each range the view asks for from the
stored arrays, so navigating starts no new prediction.

<Figure caption="The predicted GM12878 contact map across the whole 1 Mb window, at 2 kb bins. Blocks of self-interaction meet along the diagonal, with TAL1 near the middle of the view." src="/img/alphagenome/contact_map.png" />

The display saturates at the 95th percentile, because predicted maps are less
skewed than sequenced ones.

## Scoring a variant

In T-ALL, _TAL1_ is switched on in a lineage where it should be silent. One
route is a small insertion upstream of the gene that creates a binding site, and
the variant track on screen holds one.

Right-click the insertion and choose **Predict variant effect with
AlphaGenome**, the last row of the menu. The query panel opens with the position
and the two alleles loaded. Running it predicts the window twice, once for the
reference and once with the insertion.

<Figure caption="Right-clicking a variant in the oncogenic TAL1 variants track. The last row of the menu is the plugin's, and it opens the query panel with the variant under the cursor already loaded." src="/img/alphagenome/predict_variant_menu.png" />

The stored prediction is for the **Jurkat** insertion,
`chr1:47239296 C>CCGTTTCCTAACC`, in CD34+ common myeloid progenitors, the
closest AlphaGenome cell type to the CD34+ hematopoietic cells Mansour et al.
studied. To reach it, replace K562 in the biosample box with "common myeloid
progenitor, CD34-positive" and type the insertion into the variant box. Any
other variant or biosample makes a live API call.

The panel warns when the variant falls outside the window. In variant mode
AlphaGenome reports only the junctions the variant could affect, so clear the
variant to get the whole locus back.

## Reading the difference

A track from a variant prediction comes as two tracks: the reference and
alternate curves together, and a difference row where positive is a gain from
the insertion.[^mapping] Add the CD34+ DNase, polyA plus RNA-seq and H3K27ac
tracks, zoom to _TAL1_ and the insertion, and close the reference and alternate
tracks to keep the three difference rows. Untick **Score → Clip outliers** on
the DNase difference row, because on a row this sparse the default clipping
flattens the gain at the insertion.

<Figure caption="The Jurkat insertion scored in CD34+ progenitors: the alternate-minus-reference difference for DNase, polyA plus RNA-seq and H3K27ac. Accessibility rises at the insertion, while H3K27ac and TAL1 transcription rise with it." src="/img/alphagenome/variant_difference.png" />

Accessibility rises at the insertion. H3K27ac, the mark of an active enhancer,
rises across the locus, and predicted transcription rises over the _TAL1_ exons.

## Sharing a prediction

The panel adds predictions as session tracks whose adapters read the stored
arrays through presigned URLs, and those URLs expire within the hour. A track
config copied into another session stops loading once they expire. To share a
prediction, re-open the panel in the other session and repeat the query, which
returns the same stored arrays with fresh URLs.

## See also

- [](/docs/tutorials/rnaseq)
- [](/docs/tutorials/chromhmm)
- [](/docs/tutorials/hic_structural_variants)
- [](/docs/config_guides/plugins)

## References

Avsec Ž, et al. AlphaGenome: advancing regulatory variant effect prediction with
a unified DNA sequence model. bioRxiv (2025).
https://doi.org/10.1101/2025.06.25.661532

Mansour MR, et al. An oncogenic super-enhancer formed through somatic mutation
of a noncoding intergenic element. Science 346:1373-1377 (2014).
https://doi.org/10.1126/science.1259037

[^license]:
    The plugin is Apache-2.0. AlphaGenome's API is
    [free for non-commercial use](https://deepmind.google.com/science/alphagenome/terms),
    and that restriction applies to the public instance and to any instance run
    with your own key.

[^rounding]:
    The service rounds the window to 4 kb before keying the request, because
    browser windows of different widths ask about the same locus in coordinates
    tens of bases apart. A cached result can therefore cover a window up to
    about 2 kb off the one asked for, and the track list names the interval
    returned.

[^junctions]:
    AlphaGenome returns tens of thousands of junctions for a megabase. The
    adapter loads them all and draws only those scoring 0.5 or more, which over
    one gene leaves the few strong arcs rather than dozens of faint ones. The
    track colors arcs by strand and strokes them by score.

[^mapping]:
    AlphaGenome lays out the alternate prediction along the alternate sequence,
    12 bases longer than the reference here. The plugin maps it back onto
    reference coordinates before subtracting, collapsing the inserted bases onto
    the base they follow, as AlphaGenome's own variant scorers do.
