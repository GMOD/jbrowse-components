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
- nothing installed locally, and no AlphaGenome API key: the page reads two
  stored predictions, each recorded once, so following it spends no quota

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

AlphaGenome is given a window of reference sequence and returns what an RNA-seq,
DNase, ATAC, CAGE, PRO-cap or ChIP-seq experiment in a named cell type would
have produced over it, plus splice junctions and a contact map. One request
carries all of them, per biosample, so asking about K562 and GM12878 together
gives two cell types to read against each other.

The model takes sequence, so it answers just as readily for sequence that does
not exist: change one base, ask again, and the difference between the two
answers is the variant's predicted effect.

The window is a megabase centered on _TAL1_ on chr1, a transcription factor
whose misexpression drives T-cell acute lymphoblastic leukemia. It is on in
K562, an erythroleukemia line, and off in GM12878, a lymphoblastoid line, the
control in the locus figures below.

## The AlphaGenome plugin

The plugin is beta and not in the [plugin store](/docs/user_guides/plugin_store)
yet, so it loads by URL from the `plugins` array in `config.json` (see
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

The plugin holds no API key. It talks to a small service that runs the
prediction, stores the arrays, and hands the browser a manifest of byte ranges.
The public instance is the default; `setApiRoot` points it at your own.

The plugin is Apache-2.0, but AlphaGenome's API is
[offered as a free service for non-commercial use](https://deepmind.google.com/science/alphagenome/terms),
so the public instance, and any instance run with your own key, carries that
restriction.

## Ask for a prediction

Open the session below and the locus is already in view, with RefSeq genes and
the oncogenic _TAL1_ variants above it and no predictions yet.

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

**AlphaGenome predictions…** in the view menu opens the query panel. Four things
go into a request:

- **what to predict.** Eleven output types; asking for all of them is one call,
  and the presets pick the usual groups
- **which cell types and tissues.** The box searches the catalog of predictable
  tracks by biosample, and marks a biosample that has none of the output types
  asked for. This page uses K562 and GM12878 for the locus, and CD34+
  progenitors for the variant
- **how wide a window.** 16 kb, 100 kb, 500 kb or 1 Mb, centered on the view.
  The panel prints the interval it will ask about
- **a variant, or none.** Left empty, the locus is predicted as it is

A wide request takes minutes, so it is registered and the browser polls for it.
Requests are keyed by content with the window rounded to 4 kb, so asking again
for what this page already asked returns at once, which is why the prediction
behind the figures below is instant. The rounding matters because a view's
region comes from an integer pixel offset, and two browser windows of different
widths ask about the same locus in coordinates tens of bases apart. A hit can
therefore return a window up to about 2 kb off the one asked for, and the track
list names the interval that came back.

## Two cell lines on one axis

A finished prediction is a list of tracks, often thousands. None cost anything
to add, because the service stores the arrays and a track is only an HTTP range
request into one. Filter the list to `polyA plus`, tick K562 and GM12878, and
**Add selected** puts both in a single multi-wiggle track.

Predicted RNA-seq in two cell types is a comparison only if the rows share a
y-axis. Everything measured in the same units goes onto one axis: several
biosamples of one assay, and DNase beside ATAC, splice sites beside splice site
usage, CAGE beside PRO-cap, histone ChIP beside TF ChIP. Untick **Stack on a
shared scale** for one track per pick instead.

On that shared axis, _TAL1_ carries predicted transcription in K562 and
essentially none in GM12878, on the annotated exons. The lane to the right is
_STIL_, predicted in both lines, which shows the flat GM12878 row is a
prediction rather than a track that failed to load.

<Figure caption="Predicted polyA plus RNA-seq over TAL1 in K562 and GM12878, both rows on one y-axis. The K562 row shows a block of signal across the annotated exons that the GM12878 row does not." src="/img/alphagenome/expression_two_cell_lines.png" />

## Where the chromatin is open

Add the DNase and ATAC tracks for both biosamples the same way. All four land in
one track, because accessibility is one scale, and a DNase peak in K562 should
also be an ATAC peak in K562.

On the shared axis, predicted ATAC in K562 sits well above everything else
across the window, while the same cell line's DNase resolves into peaks. On a
per-row scale the two would look alike. The GM12878 rows are not empty either;
chromatin is open at plenty of places that are not transcribed.

<Figure caption="Predicted DNase and ATAC for K562 and GM12878, four rows on one shared y-axis because accessibility is one set of units. The K562 ATAC row runs high across the whole window; the K562 DNase row below it resolves into peaks." src="/img/alphagenome/accessibility_shared_axis.png" />

## Splicing and folding

The other two output types are not quantitative rows and never join a stacked
track.

**Splice junctions** come back as arcs, a sashimi plot. AlphaGenome returns tens
of thousands for a megabase, so the adapter ships them whole and thresholds them
in the browser. Add the K562 and GM12878 polyA junctions and zoom in to _TAL1_.
The adapter's own threshold is low, which over one gene leaves dozens of faint
arcs around a few strong ones; raise the Min score slider in the K562 track's
menu and the strong ones remain, landing on the exon boundaries the RefSeq track
draws. The track colors arcs by strand, one color here because every junction
over _TAL1_ is on the gene's strand, and the GM12878 lane is empty because
_TAL1_ is off there.

<Figure caption="Predicted splice junctions over TAL1 for K562 and GM12878 polyA plus RNA-seq, with the K562 track's minimum score raised. The K562 arcs join the exons the RefSeq track draws; the GM12878 lane has none." src="/img/alphagenome/splice_junctions.png" />

**Contact maps** come back as a triangle at 2 kb bins, and only for about a
dozen cell lines, GM12878 among them. Predicted maps are much less skewed than
sequenced ones, so the display saturates at the 95th percentile rather than at a
fraction of the maximum.

At the 70 kb this page has been sitting at, a 2 kb map is thirty-five bins
across; zoom out to the whole predicted megabase and the domain structure
appears. Navigating after the prediction is free, since the adapter reads
whatever range the view asks for from the stored arrays.

<Figure caption="The predicted GM12878 contact map across the whole 1 Mb window, at 2 kb bins. Blocks of self-interaction meet along the diagonal, with TAL1 near the middle of the view." src="/img/alphagenome/contact_map.png" />

## Scoring a variant

_TAL1_ is off in GM12878 and on in K562, and in T-ALL patients it is switched on
in a lineage where it should be silent. One way that happens is a small
insertion upstream of the gene that creates a binding site, and one of those is
in the variant track on screen.

Right-click it and the last row of the menu reads **Predict variant effect with
AlphaGenome**. It opens the query panel with the variant loaded: the chip names
the position and the two alleles, and the Predict button renames itself to
match. Run it, and the same window comes back twice, once for the reference
sequence and once with the insertion in place.

<Figure caption="Right-clicking a variant in the oncogenic TAL1 variants track. The last row of the menu is the plugin's, and it opens the query panel with the variant under the cursor already loaded." src="/img/alphagenome/predict_variant_menu.png" />

The recorded prediction this page reads is for the **Jurkat** insertion,
`chr1:47239296 C>CCGTTTCCTAACC`, scored in CD34+ common myeloid progenitors: the
cell type the worked example uses, and the closest match AlphaGenome has to the
CD34+ hematopoietic cells Mansour et al. studied. To reach it, remove K562 from
the biosample box, add "common myeloid progenitor, CD34-positive", and type the
insertion into the variant box. Any other variant or biosample is a real API
call rather than a stored answer.

Before running one yourself:

- **the variant has to be inside the window.** The panel warns when it is not,
  and offers to navigate there
- **splice junctions go sparse in variant mode.** AlphaGenome reports only
  junctions the variant could plausibly affect, which for a variant nowhere near
  a splice site is none. Clear the variant to get the whole locus back

## Reading the difference

Adding a track from a variant prediction gives two tracks: the reference and
alternate curves together, and a third row for their difference, where positive
is a gain from the insertion and negative a loss. Add the CD34+ DNase, polyA
plus RNA-seq and H3K27ac tracks, and zoom to _TAL1_ and the insertion. The
figure below closes the reference and alternate tracks and keeps the three
difference rows.

On the three difference rows, accessibility rises sharply at the insertion
itself, H3K27ac, the mark of an active enhancer, rises across the locus, and
predicted transcription rises over the _TAL1_ exons. The DNase difference row is
set to **Score → Autoscale type → Local** in its track menu: the default clips
the outermost percent of each sign, which on a row this sparse flattens the gain
at the insertion.

AlphaGenome returns the alternate prediction laid out along the alternate
sequence, 12 bases longer than the reference here. The plugin maps it back onto
reference coordinates before subtracting, the way AlphaGenome's own variant
scorers do, collapsing the inserted bases onto the base they follow, so every
difference compares one reference base with itself.

<Figure caption="The Jurkat insertion scored in CD34+ progenitors: the alternate-minus-reference difference for DNase, polyA plus RNA-seq and H3K27ac. Accessibility rises at the insertion, while H3K27ac and TAL1 transcription rise with it." src="/img/alphagenome/variant_difference.png" />

## What a prediction is, as configuration

The tracks the panel adds are session tracks, and their adapters address a
stored array through a presigned URL that expires within the hour, so a track
config copied out of one session does not load in the next. Re-open the panel
and rebuild the same query instead; requests are keyed by content, so the same
query lands back on the same arrays for free.

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
