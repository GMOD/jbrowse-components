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

The AlphaGenome plugin is beta, and every track on this page is a model's answer
rather than a measurement. We welcome your [feedback](/contact).

:::

## Prerequisites

- [the AlphaGenome plugin](#the-alphagenome-plugin), which contributes the
  adapters these tracks use, the query panel, and the variant right-click item
- no AlphaGenome API key: the page reads two stored predictions, so following it
  spends no quota

## Where the data comes from

We made two predictions over the _TAL1_ locus once against
[AlphaGenome](https://www.alphagenomedocs.com/) and froze them under stable
tokens, and the list below also carries the hg38 annotation they are read
against. The locus and the variant follow the AlphaGenome team's
[worked example](https://www.alphagenomedocs.com/colabs/example_analysis_workflow.html).

- the reference prediction over chr1:46,700,048..47,748,623, all eleven output
  types, K562 and GM12878, as the manifest a browser reads it through:
  https://0t0e9nn6bj.execute-api.us-east-2.amazonaws.com/Prod/api/predict/demo-tal1-interval
- the variant prediction, the same window scored twice for the Jurkat MuTE
  insertion, in CD34+ common myeloid progenitors:
  https://0t0e9nn6bj.execute-api.us-east-2.amazonaws.com/Prod/api/predict/demo-tal1-variant-cd34
- the oncogenic _TAL1_ variants as a variant track, the insertion among them:
  https://jbrowse.org/demos/alphagenome_test.bed
- hg38's NCBI RefSeq annotation:
  https://jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz
- the hg38 sequence:
  https://hgdownload.soe.ucsc.edu/goldenPath/hg38/bigZips/hg38.2bit

## Predicted assays from sequence

AlphaGenome takes a window of reference sequence and returns what RNA-seq,
DNase, ATAC, CAGE, PRO-cap or ChIP-seq experiments in named cell types would
have produced there, plus splice junctions and a contact map. Changing one base
and asking again gives the variant's predicted effect.

The window is a megabase centered on _TAL1_, a transcription factor whose
misexpression drives T-cell acute lymphoblastic leukemia. _TAL1_ is on in K562,
an erythroleukemia line, and off in GM12878, a lymphoblastoid line.

## The AlphaGenome plugin

The plugin is beta and not in the
[plugin store](/docs/user_guides/plugin_store), so it loads by URL from the
`plugins` array in `config.json` (see
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

On [JBrowse Desktop](/docs/quickstart_desktop), install it from the start screen
at **Global plugins... → Add custom plugin**, with that URL and the name
`AlphaGenome`.

The plugin holds no API key. It talks to a service that runs the prediction and
stores the arrays, and `setApiRoot` points it at your own. AlphaGenome's API is
[free for non-commercial use](https://deepmind.google.com/science/alphagenome/terms),
which restricts the public instance and any instance run with your own key.

## Ask for a prediction

Open the session below. It shows the locus with RefSeq genes and the oncogenic
_TAL1_ variants and no predictions yet.

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

**AlphaGenome predictions…** in the view menu opens the query panel:

- **what to predict**: eleven output types, in presets
- **which cell types and tissues**: K562 and GM12878 for the locus, CD34+
  progenitors for the variant
- **how wide a window**: 16 kb, 100 kb, 500 kb or 1 Mb, centered on the view
- **a variant, or none**

A wide request takes minutes, and the browser polls for it. Requests are keyed
by content with the window rounded to 4 kb, so repeating this page's request
returns at once, with an interval up to about 2 kb off the one asked for. The
track list names the interval that came back.

## Two cell lines on one axis

A finished prediction is a list of thousands of tracks, and each track is an
HTTP range request into the stored arrays. Filter the list to `polyA plus`, tick
K562 and GM12878, and **Add selected** puts both in one multi-wiggle track.
Assays measured in the same units share an axis: several biosamples of one
assay, DNase with ATAC, CAGE with PRO-cap, histone ChIP with TF ChIP. Untick
**Stack on a shared scale** for one track per pick.

_TAL1_ shows predicted transcription in K562 and essentially none in GM12878.
_STIL_, to the right, is predicted in both lines, so the flat GM12878 row is a
prediction.

<Figure caption="Predicted polyA plus RNA-seq over TAL1 in K562 and GM12878, both rows on one y-axis. The K562 row shows a block of signal across the annotated exons that the GM12878 row does not." src="/img/alphagenome/expression_two_cell_lines.png" />

## Where the chromatin is open

Add the DNase and ATAC tracks for both biosamples the same way. All four land in
one track. Predicted ATAC in K562 sits above everything else across the window,
and the K562 DNase resolves into peaks. The GM12878 rows are not empty:
chromatin is open at many places that are not transcribed.

<Figure caption="Predicted DNase and ATAC for K562 and GM12878, four rows on one shared y-axis because accessibility is one set of units. The K562 ATAC row runs high across the whole window; the K562 DNase row below it resolves into peaks." src="/img/alphagenome/accessibility_shared_axis.png" />

## Splicing and folding

Splice junctions and contact maps are not quantitative rows and never join a
stacked track.

**Splice junctions** draw as arcs. AlphaGenome returns tens of thousands per
megabase, so the adapter thresholds them in the browser. Add the K562 and
GM12878 polyA junctions, zoom to _TAL1_, and raise **Min score** in the K562
track's menu until the arcs that remain land on the exon boundaries of the
RefSeq track. The GM12878 lane is empty because _TAL1_ is off there.

<Figure caption="Predicted splice junctions over TAL1 for K562 and GM12878 polyA plus RNA-seq, with the K562 track's minimum score raised. The K562 arcs join the exons the RefSeq track draws; the GM12878 lane has none." src="/img/alphagenome/splice_junctions.png" />

**Contact maps** come as a triangle at 2 kb bins, for about a dozen cell lines
including GM12878. The display saturates at the 95th percentile. Zoom out to the
whole predicted megabase to see the domain structure.

<Figure caption="The predicted GM12878 contact map across the whole 1 Mb window, at 2 kb bins. Blocks of self-interaction meet along the diagonal, with TAL1 near the middle of the view." src="/img/alphagenome/contact_map.png" />

## Scoring a variant

In T-ALL patients _TAL1_ switches on in a lineage where it should be silent. One
cause is a small insertion upstream of the gene that creates a binding site, and
the variant track on screen holds one. Right-click it and pick **Predict variant
effect with AlphaGenome**, the last row of the menu. The query panel opens with
the variant loaded, and the prediction returns the window twice, once for the
reference sequence and once with the insertion.

<Figure caption="Right-clicking a variant in the oncogenic TAL1 variants track. The last row of the menu is the plugin's, and it opens the query panel with the variant under the cursor already loaded." src="/img/alphagenome/predict_variant_menu.png" />

The recorded prediction is for the **Jurkat** insertion,
`chr1:47239296 C>CCGTTTCCTAACC`, in CD34+ common myeloid progenitors, the
closest match to the cells Mansour et al. studied. To reach it, replace K562 in
the biosample box with "common myeloid progenitor, CD34-positive" and type the
insertion into the variant box. The variant has to lie inside the window, and
splice junctions go sparse in variant mode, so clear the variant to get the
whole locus back. Any other variant or biosample is a live API call.

## Reading the difference

A variant prediction adds the reference and alternate curves together, plus a
row for their difference, where positive is a gain from the insertion. Add the
CD34+ DNase, polyA plus RNA-seq and H3K27ac tracks, zoom to the insertion and
close the reference and alternate tracks.

The difference rows show accessibility rising sharply at the insertion, H3K27ac
rising across the locus, and transcription rising over the _TAL1_ exons. Untick
**Score → Clip outliers** in the DNase difference row's menu, since the default
clips the outermost percent of each sign and flattens the gain at the insertion.

The alternate prediction is 12 bases longer than the reference. The plugin maps
it back onto reference coordinates before subtracting, collapsing the inserted
bases onto the base they follow.

<Figure caption="The Jurkat insertion scored in CD34+ progenitors: the alternate-minus-reference difference for DNase, polyA plus RNA-seq and H3K27ac. Accessibility rises at the insertion, while H3K27ac and TAL1 transcription rise with it." src="/img/alphagenome/variant_difference.png" />

The prediction tracks are session tracks addressing stored arrays through a
presigned URL that expires within the hour, so a config copied out of one
session does not load in the next. Re-open the panel and repeat the query, which
lands on the same arrays.

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
