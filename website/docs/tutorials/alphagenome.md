---
title: AlphaGenome predictions
description:
  Predict expression, accessibility, splicing and 3D contacts over a locus, then
  score a variant against the reference
guide_category: Tutorials
tutorial_category: Epigenomics & single cell
data: hosted
---

**TL;DR:** AlphaGenome reads a megabase of DNA and says what it does: where it
is transcribed, where the chromatin is open, how it splices, and how it folds.
This page asks it about _TAL1_ in two cell lines, stacks the answers that share
units on one axis, and then scores an oncogenic insertion against the reference
to see the enhancer it creates.

:::caution Experimental

The AlphaGenome plugin is beta, and every track on this page is a model's answer
rather than a measurement. We welcome your [feedback](/contact).

:::

## Prerequisites

- [the AlphaGenome plugin](#the-alphagenome-plugin), which contributes the
  adapters these tracks use, the query panel, and the variant right-click item
- nothing installed locally, and no AlphaGenome API key: the two predictions
  this page reads were recorded once and stored, so following it spends no quota

## Where the data comes from

Two predictions over the _TAL1_ locus, made once against
[AlphaGenome](https://www.alphagenomedocs.com/) and frozen under stable tokens,
plus the hg38 annotation they are read against. The locus and the variant follow
the AlphaGenome team's
[worked example](https://www.alphagenomedocs.com/colabs/example_analysis_workflow.html).

- the reference prediction over chr1:46,700,048..47,748,623, all eleven output
  types, K562 and GM12878, as the manifest a browser reads it through:
  https://0t0e9nn6bj.execute-api.us-east-2.amazonaws.com/Prod/api/predict/demo-tal1-interval
- the variant prediction, the same window scored twice for the Jurkat MuTE
  insertion:
  https://0t0e9nn6bj.execute-api.us-east-2.amazonaws.com/Prod/api/predict/demo-tal1-variant
- the oncogenic _TAL1_ variants as a variant track, the insertion among them:
  https://jbrowse.org/demos/alphagenome_test.bed
- hg38's NCBI RefSeq annotation:
  https://jbrowse.org/genomes/GRCh38/ncbi_refseq/GCA_000001405.15_GRCh38_full_analysis_set.refseq_annotation.sorted.gff.gz
- the hg38 sequence:
  https://hgdownload.soe.ucsc.edu/goldenPath/hg38/bigZips/hg38.2bit

## A model instead of an experiment

Every other track in these docs is a picture of something that was measured.
AlphaGenome's are not: the model is given a window of reference sequence and
returns what an RNA-seq, DNase, ATAC, CAGE, PRO-cap or ChIP-seq experiment in a
named cell type would have produced over it, plus splice junctions and a contact
map. One request can carry all of them, and the answer is per biosample, so
asking about K562 and GM12878 in the same call gives two cell types to read
against each other.

The model takes sequence, so it will answer just as readily for sequence that
does not exist, which is what makes the second half of the page possible: change
one base, ask again, and the difference between the two answers is the variant's
predicted effect.

The window here is a megabase centered on _TAL1_ on chr1, a transcription factor
whose misexpression drives T-cell acute lymphoblastic leukemia. It is on in
K562, an erythroleukemia line, and off in GM12878, a lymphoblastoid line, which
gives every figure below a control in the same frame.

## The AlphaGenome plugin

It is beta and not in the [plugin store](/docs/user_guides/plugin_store) yet, so
it loads by URL. In JBrowse Web that is a `plugins` array at the top level of
`config.json`, beside `assemblies` and `tracks` (see
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
prediction, stores the arrays it gets back, and hands the browser a manifest of
byte ranges. The public instance is the default; `setApiRoot` points it at your
own.

The plugin is Apache-2.0, but the model behind it is not ours to relicense:
AlphaGenome's API is
[offered as a free service for non-commercial use](https://deepmind.google.com/science/alphagenome/terms),
so the public instance above — and any instance you point `setApiRoot` at with
your own key — carries that restriction with it.

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

- **what to predict.** Eleven output types, and asking for all of them is one
  call rather than eleven, so there is little reason to be sparing. The presets
  pick the usual groups.
- **which cell types and tissues.** The box searches the catalog of about 5,900
  predictable tracks by biosample, and marks a biosample that has none of the
  output types asked for. K562 and GM12878 are the two this page uses.
- **how wide a window.** 16 kb, 100 kb, 500 kb or 1 Mb, centered on what the
  view is showing. The panel prints the interval it will actually ask about, so
  the window is visible before anything is spent.
- **a variant, or none.** Left empty, the locus is predicted as it is. That is
  the first half of this page.

A wide request over many output types takes minutes, well past what an API
gateway holds a connection open for, so the request is registered and the
browser polls for it. Requests are keyed by content, with the window rounded to
4 kb before it is hashed, so asking again for what this page already asked for
costs nothing and returns at once — which is why the prediction behind the
figures below is instant. The rounding is what makes that true in practice
rather than in principle: a view's region comes from an integer pixel offset, so
two browser windows of different widths ask about the same locus in coordinates
tens of bases apart, and keyed exactly, neither would ever hit the other's
answer. A hit can therefore return a window up to about 2 kb off the one asked
for, out of a megabase, and the track list names the interval that came back.

## Two cell lines on one axis

A finished prediction is a list of tracks, often thousands of them, and none of
them cost anything to add: the arrays are already stored, and a track is an HTTP
range request into one. Filter the list to `polyA plus`, tick K562 and GM12878,
and **Add selected** puts both in a single multi-wiggle track.

The stacking is the point. Predicted RNA-seq in two cell types is a comparison
only if the two rows share a y-axis, and four separately-scaled rows are four
unrelated pictures. Everything measured in the same units goes onto one axis:
several biosamples of one assay always, and DNase beside ATAC, splice sites
beside splice site usage, CAGE beside PRO-cap, histone ChIP beside TF ChIP.
Anything else keeps its own. Untick **Stack on a shared scale** to get one track
per pick instead.

On that shared axis, _TAL1_ carries predicted transcription in K562 and
essentially none in GM12878, and the RefSeq track above says the signal sits on
the annotated exons. The lane to the right is `STIL`, which the model predicts
in both lines — which is what says the flat GM12878 row is a prediction rather
than a track that failed to load.

<Figure caption="Predicted polyA plus RNA-seq over TAL1 in K562 and GM12878, both rows on one y-axis. The K562 row carries a block of signal across the annotated exons that the GM12878 row does not." src="/img/alphagenome/expression_two_cell_lines.png" />

## Where the chromatin is open

Add the DNase and ATAC tracks for both biosamples the same way. All four land in
one track, because accessibility is one scale: this is the case the shared axis
was built for, since a DNase peak that is real in K562 should also be an ATAC
peak in K562 and neither should be conspicuous in GM12878.

The shared axis is also what makes the rows' floors comparable, and that is the
first thing to read here: predicted ATAC in K562 sits well above everything else
across the whole window, while the same cell line's DNase resolves into
individual peaks. On a per-row scale those two would look alike. The GM12878
rows are not empty either, which is the honest shape of the prediction —
chromatin is open at plenty of places that are not being transcribed.

<Figure caption="Predicted DNase and ATAC for K562 and GM12878, four rows on one shared y-axis because accessibility is one set of units. The K562 ATAC row runs high across the whole window; the K562 DNase row below it resolves into peaks." src="/img/alphagenome/accessibility_shared_axis.png" />

## Splicing and folding

The other two output types are not quantitative rows and never join a stacked
track.

**Splice junctions** come back as arcs, which is a sashimi plot. AlphaGenome
returns tens of thousands of them for a megabase, so the adapter ships them
whole and thresholds them in the browser. Add the K562 polyA junctions and the
arcs land on the same exon boundaries the RefSeq track draws, colored by the
strand they were called on — one color here, because every junction over _TAL1_
is on the strand the gene is transcribed from.

<Figure caption="Predicted splice junctions for K562 polyA plus RNA-seq, as sashimi arcs. The arcs span the introns between the TAL1 exons the RefSeq track draws above them, with a second set over STIL to the right." src="/img/alphagenome/splice_junctions.png" />

**Contact maps** come back as a triangle, at 2 kb bins and only for about a
dozen cell lines, so they want a wide window and a biosample that has one. The
GM12878 map is the one this prediction carries. Predicted maps are much less
skewed than sequenced ones, so the display saturates at the 95th percentile
rather than at a fraction of the maximum; the default ramp washes the whole
triangle out.

The window matters as much as the ramp. At the 70 kb this page has been sitting
at, a 2 kb map is thirty-five bins across and shows nothing; zoom out to the
whole predicted megabase and the domain structure appears. Navigating after the
prediction is free — the arrays are already stored, and the adapter reads
whatever range the view asks for.

<Figure caption="The predicted GM12878 contact map across the whole 1 Mb window, at 2 kb bins. Blocks of self-interaction meet along the diagonal, with TAL1 near the middle of the view." src="/img/alphagenome/contact_map.png" />

## Scoring a variant

The expression track raised a question the reference prediction cannot answer.
_TAL1_ is off in GM12878 and on in K562, and in T-ALL patients it is switched on
in a lineage where it should be silent. One of the ways that happens is a small
insertion upstream of the gene that creates a binding site, and one of those is
in the variant track already on screen.

Right-click it and the last row of the menu reads **Predict variant effect with
AlphaGenome**. That row opens the query panel with the variant already loaded:
its chip names the position and the two alleles, and the Predict button renames
itself to match. Run it, and the same window comes back twice — once for the
reference sequence and once with the insertion in place.

<Figure caption="Right-clicking a variant in the oncogenic TAL1 variants track. The last row of the menu is the plugin's, and it opens the query panel with the variant under the cursor already loaded." src="/img/alphagenome/predict_variant_menu.png" />

The recorded prediction this page reads is for the **Jurkat** insertion,
`chr1:47239297 C>CCGTTTCCTAACC`, which sits in the same stack of patient
variants and is easiest to reach by typing it into the panel's variant box.
Right-clicking any other row asks a question nobody has asked yet, which is a
real API call rather than a stored answer.

Two things are worth knowing before running one of these yourself:

- **the variant has to be inside the window.** The panel says when it is not,
  and offers to navigate there.
- **splice junctions go sparse in variant mode.** AlphaGenome reports only
  junctions the variant could plausibly affect, which for a variant nowhere near
  a splice site is none at all. Clear the variant to get the whole locus back.

## Reading the difference

Adding a track from a variant prediction gives two tracks rather than one: the
reference and alternate curves side by side, and their difference on its own
row.

The pair is there to be looked at first, and at this scale the two curves sit
almost exactly on top of each other. That is the reason the difference gets its
own row, and why its axis runs to a fifth of a unit where the tracks above it
run to six.

On the difference track, positive is where the insertion raises predicted
expression and negative is where it lowers it. The row is flat across most of
the window and moves only where something is transcribed: over _TAL1_, and again
over _STIL_ to the right. Neither is a clean one-sided shift — each carries
positive and negative within the same gene body, which is a redistribution of
predicted coverage rather than a simple increase.

The flatness everywhere else is the check. A difference track that lit up across
the whole megabase would be a prediction responding to the request rather than
to the variant, and there would be no way to tell which part of it was the
insertion.

<Figure caption="A variant prediction adds two tracks: the reference and alternate curves together, and their difference below. The difference is flat except over TAL1 and STIL, and its axis spans a fraction of the one above it." src="/img/alphagenome/variant_difference.png" />

## What a prediction is, as configuration

The tracks the panel adds are session tracks, and they are not portable the way
the rest of these docs' configs are. Their adapters address a stored array by
byte range through a presigned URL that expires within the hour, so a track
config copied out of one session does not load in the next one. Re-open the
panel instead: the prediction itself is still stored, the request is keyed by
content, and rebuilding the same query lands back on the same arrays for free.

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
