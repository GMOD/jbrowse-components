---
title: Basic usage of genomes.jbrowse.org
description:
  Open a hosted genome, search a gene, and turn on a track from the UCSC
  catalog, worked on hg38 phyloP conservation over TP53
guide_category: Tutorials
tutorial_category: Getting started
---

**TL;DR:** genomes.jbrowse.org hosts a ready-made JBrowse config for every UCSC
genome, and each one already carries that genome's whole UCSC track catalog. Any
of those tracks is a checkbox away, with nothing to download, index or
configure. This page turns on hg38's phyloP conservation over _TP53_ and then
reads it against the gene model it lands next to.

## Prerequisites

- nothing to install: this is a click-path through a hosted site, and no data,
  config or index is prepared by hand

## Opening a genome

[genomes.jbrowse.org](https://genomes.jbrowse.org) opens on an index of the
genomes it hosts, every UCSC database plus the UCSC GenArk assemblies. Picking
one loads a JBrowse instance with that genome's config, which is a plain URL, so
the state you end up in is shareable as a link.

Open hg38, and type `TP53` into the location box. The hosted config ships a name
index, so gene symbols work with no setup. Coordinates like
`chr17:7,668,400-7,687,550` work anywhere a symbol does.

The view arrives with **NCBI RefSeq - RefSeq All** on, the one track the site
opens by default. RefSeq annotates _TP53_ with many transcripts and that track
stacks every one of them, which is what the rows in the figures below are. The
isoform control at the bottom right of the gene track collapses them to one
transcript per gene when that is what you want, and the same three options sit
under the track menu's **Gene glyph**.

## Finding a track

Open the track selector with the button at the top left of the view. The drawer
lists the catalog under the categories UCSC files its own tracks in: Genes and
Gene Predictions, Regulation, Variation and Repeats, Comparative Genomics,
Pairwise alignments, and so on. Expanding a category is one way in. The other is
**Filter tracks** at the top of the drawer, which searches every category at
once and is the quicker route whenever you know roughly what the track is
called.

Type `phyloP`. Conservation lives under Comparative Genomics, and hg38 carries
several: the 30-way and 100-way vertebrate alignments, the 241-way and 470-way
mammal sets, and the 447-way primates. Tick **Basewise Conservation (phyloP) -
100-way vertebrate alignment**.

<Figure src="/img/genomes_basics/turn_on_phylop.png" caption="Filtering the hg38 catalog down to phyloP, with boxes on the row that gets ticked and the category it sits in. Below, the same view once the checkbox is on: the track opens under the TP53 gene model, already drawn." />

The names in the list are UCSC's own, so a track you know from the UCSC browser
is findable here under the label it has there. Nothing about the checkbox is
particular to a signal file either. The same two clicks open a gene set, a
variant file or a repeat annotation.

## Reading it

phyloP scores each base for how quickly it changes compared with the neutral
rate the alignment implies, and the score is signed, so the track has a pivot
rather than a floor. Blue above the line is a base changing more slowly than
neutral, red below it a base changing faster.

<Figure src="/img/genomes_basics/phylop_tp53.png" caption="The RefSeq transcripts over the TP53 body with phyloP under them, both as they open. The tall peaks sit under the columns where the coding exons (yellow) stack up, including the lone exon out in the middle of the intron. The wide 3' UTR block at the left is an exon too, and carries nothing like them." />

The peaks are on the coding exons, and they are the width of the exons rather
than of the gene. The control is in the same frame, twice over. The introns
between those exons drop to the pivot, and the widest exon in the view is the 3'
UTR block at the left end, which carries none of the tall peaks the small coding
exons do. Conservation here is tracking the protein, not the transcript.

Every transcript stacked in that track has the same exon columns, which is why
the peaks line up with a column rather than with any one row.

## Checking it against the raw data

At gene zoom a per-base score and a smoothed band are the same picture, so zoom
in until the sequence appears. Any coding exon will do. The one below is in the
DNA binding domain and covers R248 and R249, two of the codons most often
mutated in human cancer.

Two more clicks make it readable, and both are things covered above. **Reference
sequence** is off by default, so tick it in the track selector the way phyloP
was ticked. And the gene track is still stacking every transcript, which at this
zoom is the same codon row repeated once per transcript, so set the isoform
control at its bottom right to **Longest coding transcript**. The residue
numbers that leaves are the longest coding transcript's, which is the numbering
the TP53 literature uses.

<Figure src="/img/genomes_basics/phylop_bases.png" caption="One coding exon of TP53 at base zoom: the gene collapsed to one transcript with its residue labels, phyloP under it, and the reference sequence with its translation below that. The signal is one bar per base, and within each codon the third base is the short one. The few bars that go red are third positions." />

The bars are one per base, and they are not equal within a codon: the third base
of each is short, while the first two carry the height. That is the signature of
constraint on the protein rather than on the DNA, since most third-position
changes leave the amino acid alone. The residue labels along the gene track make
it readable without counting, and the handful of bars that go red in this exon
are third positions too.

Hovering a bar reads back its score, which is the check when a difference is too
small to be sure of by eye.

## Other tracks, same two clicks

Nothing above was specific to conservation. Some others worth opening, with the
category each one filters out of:

- **Conserved Elements - 100 Vert. El** (Comparative Genomics) is the interval
  companion to this track. phyloP scores each base, phastCons calls the runs.
- **ENCODE cCREs - ENCODE4 cCREs** (Regulation) puts candidate regulatory
  elements under the promoters and enhancers.
- **ClinVar Variants - ClinVar SNVs** (Phenotypes, Variants, and Literature)
  brings clinical interpretations to the same locus.
- **RepeatMasker** (Repeats) says which parts of a window are repeat elements,
  which is worth knowing before reading much into a signal over one.
- **liftOver** (Pairwise alignments) is a genome-to-genome alignment rather than
  an annotation, and gets a page of its own in
  [](/docs/tutorials/genomes_synteny).

Turning several on at once is fine. Drag a track by the handle at the left of
its header to reorder, and the `×` in the header closes it again.

## What is actually downloaded

The config lives on jbrowse.org, but most UCSC track data resolves back to
hgdownload, and JBrowse reads those files by byte range. The phyloP file covers
the whole genome, and only the blocks under the current view are fetched, which
is why a genome-wide signal track opens in about a second at gene zoom and why a
jump to a new locus shows a moment of loading before the track paints.

## Trying another genome

Every UCSC database on the site behaves the same way, and so do the GenArk
assemblies, with two differences worth knowing: GenArk configs carry a smaller
track set, and many of them ship no name index, so on those a gene symbol may
not resolve and coordinates are the way in.

## See also

- [](/docs/tutorials/genomes_synteny), the same site's pairwise alignments
- [](/docs/tutorials/genomes_msa), building a protein alignment from a gene in
  the same view
- [](/docs/user_guides/quantitative_track) for what else the phyloP track's menu
  can do (plot type, scale, autoscale, colors)
- [](/docs/user_guides/hub_url) for opening a hub that the site does not host
- [](/docs/agents_hosted_data) for the same catalog addressed by URL rather than
  by clicking

## References

- [Pollard KS et al. Detection of nonneutral substitution rates on mammalian phylogenies. _Genome Res_ 2010](https://pmc.ncbi.nlm.nih.gov/articles/PMC2798823/),
  the phyloP method
- [Bouaoun L et al. TP53 variations in human cancers. _Hum Mutat_ 2016](https://pubmed.ncbi.nlm.nih.gov/27328919/),
  the mutation distribution across TP53 codons
- [UCSC hg38 conservation downloads](https://hgdownload.soe.ucsc.edu/goldenPath/hg38/phyloP100way/)
