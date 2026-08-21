---
title: Basic usage of genomes.jbrowse.org
sidebar_label: genomes.jbrowse.org (basic usage)
description:
  Open a hosted genome, search a gene, and work through the UCSC track catalog
  on hg38, from conservation at TP53 to filtering a variant catalog down to
  something readable
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

In 2025 we created [genomes.jbrowse.org](https://genomes.jbrowse.org) which
hosts JBrowse 2 instances for all the main UCSC database browsers (e.g. hg19,
hg38, hs1, mm39 etc) plus the UCSC GenArk project assemblies (which are
trackhubs created for over 50,000 NCBI plants, animals, fungi, bacteria,
viruses, etc). This guide will briefly show you how to use the site

<Figure src="/img/genomes_basics/site_home.png" caption="The genomes.jbrowse.org front page. The top table is the short list of main genomes; the GenArk half below it is the bulk catalog, split by clade and by project." />

[/ucsc](https://genomes.jbrowse.org/ucsc) is the same thing without the
shortlist: every UCSC database, with a filter box over the names, species and
descriptions.

<Figure src="/img/genomes_basics/site_ucsc_list.png" caption="The full UCSC database listing. Each row opens the same kind of JBrowse instance the front page links to." />

The search box in the header takes a common name, a species, an assembly name or
an accession, and covers both catalogs at once.

<Figure src="/img/genomes_basics/site_search.png" caption="The header search box, mid-query. The dropdown mixes UCSC database names with GenArk accessions, since both catalogs are in the one index." />

Picking one loads a JBrowse instance at a plain URL, so wherever you end up is
shareable as a link.

## Searching for a gene

Open hg38. It arrives at its own default locus with **NCBI RefSeq - RefSeq All**
on and the track selector already showing, which is where the next section
starts. Type `TP53` into the location box and press Enter. The hosted config
ships a name index, so gene symbols resolve with no setup, and coordinates like
`chr17:7,668,400-7,687,550` work anywhere a symbol does.

<Figure src="/img/genomes_basics/search_tp53.png" caption="Top: TP53 typed into the location box, answered by the config's own name index. Middle: what Enter opens, as many transcripts as the track's height holds, the gene labelled TP53 +20 more for the ones it does not, and the isoform control circled. Bottom: the same view after picking Representative transcript from it." />

RefSeq All draws each transcript of a gene on its own row and writes the gene
name under the stack, and TP53 has far more transcripts than a track opens tall
enough to show. Rather than hide the last ones behind the track's scrollbar, the
default keeps as many as the height has rows for and says what it left out: the
gene name reads **TP53 +20 more**, and the circled chip at the bottom right says
`Isoforms trimmed to fit`. That is the middle panel. Clicking **+20 more** opens
that one gene; clicking the chip opens **Auto / All transcripts / Representative
transcript**, and picking the last collapses every gene to one transcript, which
is the bottom panel and what the rest of this page uses.

## Finding a track

Open the track selector at the top left. The drawer lists the catalog under
UCSC's own categories, and **Filter tracks** searches all of them at once. Type
`phyloP` and tick **Basewise Conservation (phyloP) - 100-way vertebrate
alignment**, which sits under Comparative Genomics.

The names are UCSC's, so a track known from the UCSC browser is findable under
the label it has there.

## Reading it

phyloP scores each base against the neutral rate the alignment implies. The
score is signed, so the track has a pivot rather than a floor: blue above the
line changes more slowly than neutral, red below it faster.

<Figure src="/img/genomes_basics/phylop_tp53.png" caption="The TP53 transcript over the gene body with phyloP under it, as the track opens. Two blocks are shaded: exons 5-8, and the 3' UTR at the left." />

The peaks are the width of the coding exons rather than of the gene. Exons 5-8
carry the codons this gene is most often mutated at in cancer, and phyloP is
high across all four of them, so a variant landing there has 100 vertebrates
saying the base matters.

The introns drop to the pivot, and so does the other shaded block: the 3' UTR,
an exon as wide as any coding one and present in every transcript. The track
follows the protein, and the 3' UTR is where the protein and the transcript come
apart. A variant there gets no support from this track either way.

## Checking it against the raw data

At gene zoom a per-base score and a smoothed band are the same picture, so zoom
in until the sequence appears. The exon below is exon 7, one of the four shaded
above, and it covers G245, R248 and R249, three of the codons most often mutated
in human cancer: Arg248 reaches into the DNA itself, and the other two hold the
loop that carries it.

One more click makes it readable: tick **Reference sequence**, which is off by
default. The isoform control is the same one the search figure used, and its (×)
shrinks the chip to the icon circled below, which stays in that corner and opens
the same options. At this zoom it matters more, since the default draws the
codon row once per transcript.

<Figure src="/img/genomes_basics/isoform_control.png" caption="The isoform control on the gene track, circled, with the popover it opens. It carries the same Auto, All transcripts and Representative transcript options as the track menu's Gene glyph radio." />

At that zoom the score is visibly one bar per base, and within a codon the third
base is the short one: most third-position changes leave the amino acid alone,
so the constraint is on the protein rather than on the DNA. Hovering a bar reads
back its score.

## The alignment the score came from

phyloP scores a base by comparing a multiple alignment against the tree, and on
this config that alignment is a checkbox too. UCSC publishes no bigMaf for the
100-way, so this section switches to the 470-way pair, both under Comparative
Genomics: **Multiz Alignments - 470-way Mammal Alignment (Hiller lab)** and
**Basewise Conservation (phyloP) - 470 phyloP**. Leave the window where it is.

<Figure src="/img/genomes_basics/multiz_alignment.png" caption="TP53's DNA binding domain at base zoom: one transcript, phyloP 470-way, and the 470-way multiz alignment it was computed from. A base is drawn only where it differs from human." />

Most columns are blank, which is what a positive score is made of. Under S240
nearly every species differs from human, but all carry the **same** base and the
score stays above the line: one substitution on the human branch, however many
rows show it. Under T256 and G244 fewer rows differ and those that do disagree
with each other, and there the score goes red. phyloP counts substitution events
on the tree rather than rows that differ from the reference.

This track only opens at this zoom. A MAF block carries a row per species, so
the byte estimate crosses the too-much-data limit within a few kb and a
gene-wide view asks you to confirm before fetching. Zoomed further out it swaps
to a precomputed summary and draws a conservation bar per species instead of
bases.

## The regulatory end of the same gene

Conservation is one category of about a dozen, and the others are the same two
clicks. Zoom out to the whole gene. Five Regulation and Expression tracks put a
picture over it: **CpG Islands**, **ENCODE cCREs - ENCODE4 cCREs**, **Layered
H3K4Me3 (hg19)**, **Layered H3K27Ac (hg19)** and **EPDnew Promoters - EPDnew
v6**.

The two histone tracks each hold seven cell lines, drawn over one another as
they open. **Track menu → Plot type → Multi-row → XY plot** gives each cell line
a row of its own. Their names carry hg19 because that is the assembly ENCODE3
released them on; the files this config points at are the hg38 ones.

<Figure src="/img/genomes_basics/promoter_regulation.png" caption="TP53 and its promoter, with CpG islands, ENCODE cCREs coloured by class, H3K4me3, H3K27ac and EPDnew's promoter calls. Left: the marks as they open, seven cell lines over one another, with the Plot type menu that separates them. Right: the same six tracks after it." />

The promoter is at the high-coordinate end because the gene is on the minus
strand, and everything lands there together: the CpG island, a promoter-class
cCRE, the EPDnew call and both marks. Over the gene body the marks are flat.
H3K4me3 marks a promoter and H3K27ac marks an active one, so a cell line with
both is transcribing here. All seven carry both.

## Filtering a dense track

A catalog track over a whole gene is usually more records than a screen can
separate, and the way through it is the track's own columns. **gnomAD v4.1 -
gnomAD v4.1 Exomes** under Variation and Repeats opens as several thousand
records over _TP53_, which is one block of colour. Two of its columns cut that
into a shape, and **Track menu → Filter by...** takes either: `feature.AF` is
the allele frequency, `feature.annot` gnomAD's own consequence class (pLoF,
missense, synonymous or other).

The dialog takes one jexl expression per line, and the track redraws with the
records that pass all of them: `jexl:feature.AF >= 0.001` keeps the variants
standing in the population, `jexl:feature.annot == 'pLoF'` the predicted
loss-of-function set.

<Figure src="/img/genomes_basics/gnomad_filter_menu.png" caption="The gnomAD track's menu, and the dialog Filter by... opens over it, with a consequence-class expression typed in." />

The colours are the file's own, and gnomAD uses them for the same consequence
class `annot` names, so the loss-of-function filter leaves a track drawn in one
colour.

A BigBed's extra fields arrive as fields, so whatever columns the published file
carries are what there is to filter and colour on, and the same dialog takes
them for any track. ClinVar's clinical classification is `feature.clinSign`, so
`jexl:feature.clinSign == 'Pathogenic'` cuts that catalog down the same way.

## Tracks in the other categories

The same two clicks reach the rest of the catalog. A few that come up often:

- **Conserved Elements - 100 Vert. El** (Comparative Genomics) is the interval
  companion to phyloP: phyloP scores each base, phastCons calls the runs.
- **RepeatMasker** (Repeats) says which parts of a window are repeat elements,
  worth knowing before reading much into a signal over one.
- **GTEx cis-eQTLs - GTEx DAP-G eQTLs** (Regulation) names the variants
  associated with expression of nearby genes.
- **Long-read SVs - CoLoRSdb 1427 SVs** (Variation and Repeats) covers the size
  range short reads call badly.
- **liftOver** (Pairwise alignments) is a genome-to-genome alignment rather than
  an annotation, and gets a page of its own in
  [](/docs/tutorials/genomes_synteny).

Drag a track by the handle at the left of its header to reorder it; the `×`
closes it.

## What is actually downloaded

The config lives on jbrowse.org, but most UCSC track data resolves back to
hgdownload and JBrowse reads those files by byte range. The track menu's **About
track** prints the adapter, which is where to look when a track is slow or
missing: the file it names is the one being read.

<Figure src="/img/genomes_basics/about_track.png" caption="Left: the phyloP track menu, with the icon that opens it circled and About track boxed. Right: the dialog it opens, naming the BigWig on hgdownload with UCSC's own trackDb entry below it." />

The phyloP file covers the whole genome and only the blocks under the current
view are fetched, which is why a genome-wide signal track opens at gene zoom
without downloading it.

The URL is the file itself, so anything that reads a BigWig by range can take
it. In R that is `rtracklayer`, which reads the same bytes over the same range
into a `GRanges` for a figure of your own:

```r
library(rtracklayer)
scores <- import(
  "https://hgdownload.soe.ucsc.edu/goldenPath/hg38/phyloP100way/hg38.phyloP100way.bw",
  which = GRanges("chr17", IRanges(7668400, 7687550))
)
```

The BigBeds behind the variant and annotation tracks read the same way.

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

<Figure src="/img/genomes_basics/genark_axolotl.png" caption="Axolotl TP53, reached by typing the symbol into the location box of the GCF_ accession." />

The gene is the same gene. The span is not: the axolotl genome is one of the
largest sequenced, and this locus covers a few hundred kb of it.

## See also

- [](/docs/user_guides/gene_track)
- [](/docs/tutorials/genomes_synteny)
- [](/docs/tutorials/genomes_proteins)
- [](/docs/tutorials/pangenome_hprc)
- [](/docs/tutorials/repeatmasker_classes)
- [](/docs/user_guides/quantitative_track)
- [](/docs/user_guides/hub_url)
- [](/docs/agents_hosted_data)

## References

- [Pollard KS et al. Detection of nonneutral substitution rates on mammalian phylogenies. _Genome Res_ 2010](https://pmc.ncbi.nlm.nih.gov/articles/PMC2798823/),
  the phyloP method
- [Bouaoun L et al. TP53 variations in human cancers. _Hum Mutat_ 2016](https://pubmed.ncbi.nlm.nih.gov/27328919/),
  the mutation distribution across TP53 codons
- [Cho Y et al. Crystal structure of a p53 tumor suppressor-DNA complex. _Science_ 1994](https://pubmed.ncbi.nlm.nih.gov/8023157/),
  which hotspot residues contact the DNA and which hold the structure
- [Liao WW et al. A draft human pangenome reference. _Nature_ 2023](https://pubmed.ncbi.nlm.nih.gov/37165242/),
  the HPRC assemblies the pangenome callset is built from
- [UCSC hg38 conservation downloads](https://hgdownload.soe.ucsc.edu/goldenPath/hg38/phyloP100way/)
