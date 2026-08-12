---
title: Basic usage of genomes.jbrowse.org
description:
  Open a hosted genome, search a gene, and turn on a track from the UCSC
  catalog, worked on hg38 phyloP conservation over TP53
guide_category: Tutorials
tutorial_category: genomes.jbrowse.org
data: hosted
---

**TL;DR:** genomes.jbrowse.org hosts a ready-made JBrowse config for every UCSC
genome, and each one already carries that genome's UCSC track catalog. Any of
those tracks is a checkbox away, with nothing to download, index or configure.

## Prerequisites

- nothing to install: this is a click-path through a hosted site, and no data,
  config or index is prepared by hand

## Opening a genome

[genomes.jbrowse.org](https://genomes.jbrowse.org) indexes every UCSC database
plus the GenArk assemblies. The front page lists the handful most people want,
[/ucsc](https://genomes.jbrowse.org/ucsc) lists the UCSC databases in full, and
the search box in the header takes a common name, a species, an assembly name or
an accession and covers all of them at once. Picking one loads a JBrowse
instance at a plain URL, so wherever you end up is shareable as a link.

Open hg38 and type `TP53` into the location box. The hosted config ships a name
index, so gene symbols resolve with no setup, and coordinates like
`chr17:7,668,400-7,687,550` work anywhere a symbol does. The view arrives with
**NCBI RefSeq - RefSeq All** on, which stacks every transcript of a gene; the
isoform control at the bottom right of the track collapses them.

## Finding a track

Open the track selector at the top left. The drawer lists the catalog under
UCSC's own categories, and **Filter tracks** searches all of them at once. Type
`phyloP` and tick **Basewise Conservation (phyloP) - 100-way vertebrate
alignment**, which sits under Comparative Genomics.

The names are UCSC's, so a track you know from the UCSC browser is findable
under the label it has there, and nothing about the checkbox is particular to a
signal file.

## Reading it

phyloP scores each base against the neutral rate the alignment implies. The
score is signed, so the track has a pivot rather than a floor: blue above the
line changes more slowly than neutral, red below it faster.

<Figure src="/img/genomes_basics/phylop_tp53.png" caption="The RefSeq transcripts over the TP53 body with phyloP under them, both as they open. The tall peaks sit under the columns where the coding exons (yellow) stack up, including the lone exon out in the middle of the intron. The wide 3' UTR block at the left is an exon too, and carries nothing like them." />

The peaks are the width of the coding exons rather than of the gene, and the
control sits in the same frame twice: the introns between them drop to the
pivot, and the widest exon in the view is the 3' UTR block at the left end,
which carries none of the tall peaks. Conservation here tracks the protein, not
the transcript.

## Checking it against the raw data

At gene zoom a per-base score and a smoothed band are the same picture, so zoom
in until the sequence appears. The exon below is in the DNA binding domain and
covers R248 and R249, two of the codons most often mutated in human cancer.

Two more clicks make it readable, both covered above: tick **Reference
sequence**, which is off by default, and set the gene track's isoform control to
**Longest coding transcript** so the codon row is drawn once rather than once
per transcript.

<Figure src="/img/genomes_basics/phylop_bases.png" caption="One coding exon of TP53 at base zoom: the gene collapsed to one transcript with its residue labels, phyloP under it, and the reference sequence with its translation below that. The signal is one bar per base, and within each codon the third base is the short one. The few bars that go red are third positions." />

The bars are one per base and are not equal within a codon: the third base is
short and the first two carry the height, which is the signature of constraint
on the protein rather than on the DNA, since most third-position changes leave
the amino acid alone. The handful of bars that go red here are third positions
too. Hovering a bar reads back its score.

## The alignment the score came from

phyloP scores a base by comparing a multiple alignment against the tree, and on
this config that alignment is a checkbox too. UCSC publishes no bigMaf for the
100-way, so this section switches to the 470-way pair, both under Comparative
Genomics: **Multiz Alignments - 470-way Mammal Alignment (Hiller lab)** and
**Basewise Conservation (phyloP) - 470 phyloP**. Leave the window where it is.

<Figure src="/img/genomes_basics/multiz_alignment.png" caption="TP53's DNA binding domain at base zoom: the gene collapsed to one transcript, phyloP 470-way, and the 470-way multiz alignment it was computed from, one row per species down the tree. A base is drawn only where it differs from human. The column under S240 keeps a positive score; T256 and G244 are where it goes red." />

Each row is one species, ordered by the tree drawn at the left, and a base is
only drawn where it differs from human. Most columns are therefore blank, which
is what a positive score is made of.

The columns that are not blank come in two kinds, and they do not score the way
their density suggests. Under S240 nearly every species carries a base that
differs from human, but they all carry the **same** one, and the score there
stays above the line. That pattern is what a single substitution on the human
branch looks like, however many rows show it. Under T256 and G244 far fewer rows
differ, but the ones that do disagree with each other as well as with human, and
those are the two columns where the score goes red. What phyloP counts is
substitution events on the tree, not rows that differ from the reference.

This track only opens at this zoom. Its whole-genome file is read by byte range
like the phyloP one, but a MAF block carries a row per species, so the estimate
crosses the too-much-data limit within a few kb and a gene-wide view asks you to
confirm before fetching. Zoomed further out it swaps to a precomputed summary
and draws a conservation bar per species instead of bases.

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
hgdownload and JBrowse reads those files by byte range. The phyloP file covers
the whole genome and only the blocks under the current view are fetched, which
is why a genome-wide signal track opens at gene zoom without downloading it.

## Trying another genome

The GenArk assemblies behave the same way, with two differences: their configs
carry a smaller track set, and whether a gene symbol resolves is decided by
which accession you opened. The name index is built from an assembly's NCBI
RefSeq annotation, so a `GCF_` accession (RefSeq) carries gene tracks and an
index and searches like hg38 does, while a `GCA_` one (GenBank) generally has
neither and coordinates are the way in.

An assembly released both ways appears under both accessions, same sequence, and
only the RefSeq one searches: the axolotl `Mex_15411` is `GCF_040938575.1` and
`GCA_040938575.1`.

## See also

- [](/docs/tutorials/genomes_synteny)
- [](/docs/tutorials/genomes_msa)
- [](/docs/tutorials/repeatmasker_classes)
- [](/docs/user_guides/quantitative_track)
- [](/docs/user_guides/hub_url)
- [](/docs/agents_hosted_data)

## References

- [Pollard KS et al. Detection of nonneutral substitution rates on mammalian phylogenies. _Genome Res_ 2010](https://pmc.ncbi.nlm.nih.gov/articles/PMC2798823/),
  the phyloP method
- [Bouaoun L et al. TP53 variations in human cancers. _Hum Mutat_ 2016](https://pubmed.ncbi.nlm.nih.gov/27328919/),
  the mutation distribution across TP53 codons
- [UCSC hg38 conservation downloads](https://hgdownload.soe.ucsc.edu/goldenPath/hg38/phyloP100way/)
