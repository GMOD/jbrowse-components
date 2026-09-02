---
title: Basic usage of genomes.jbrowse.org
sidebar_label: genomes.jbrowse.org (basic usage)
description:
  Open a hosted genome, search a gene, and work through the UCSC track catalog
  on hg38, from conservation at TP53 to filtering a variant catalog down to
  something readable
guide_category: Tutorials
tutorial_category: genomes.jbrowse.org
---

**TL;DR:** genomes.jbrowse.org hosts a ready-made JBrowse config for every UCSC
genome, and each one already carries that genome's UCSC track catalog. Any of
those tracks is a checkbox away, with nothing to download, index or configure.

## Prerequisites

- nothing to install: this is a click-path through a hosted site, and no data,
  config or index is prepared by hand

## Where the data comes from

genomes.jbrowse.org's hosted hg38 config, and the one GenArk assembly this page
opens for comparison.

- hg38: https://jbrowse.org/ucsc/hg38/config.json
- the 100-way phyloP conservation bigWig, read by locus over TP53:
  https://hgdownload.soe.ucsc.edu/goldenPath/hg38/phyloP100way/hg38.phyloP100way.bw
- axolotl (Mex_15411), the GenArk assembly in
  [Trying another genome](#trying-another-genome):
  https://jbrowse.org/hubs/genark/GCF/040/938/575/GCF_040938575.1/config.json

## Opening a genome

[genomes.jbrowse.org](https://genomes.jbrowse.org) hosts a JBrowse 2 instance
for every main UCSC database (hg19, hg38, hs1, mm39 and the rest) plus the UCSC
GenArk assemblies, track hubs for tens of thousands of NCBI plants, animals,
fungi, bacteria and viruses.

<Figure src="/img/genomes_basics/site_home.png" caption="The genomes.jbrowse.org front page. The top table is the short list of main genomes; the GenArk half below it is the bulk catalog, split by clade and by project." />

[/ucsc](https://genomes.jbrowse.org/ucsc) is the same thing without the
shortlist: every UCSC database, with a filter box over the names, species and
descriptions.

<Figure src="/img/genomes_basics/site_ucsc_list.png" caption="The full UCSC database listing. Each row opens the same kind of JBrowse instance the front page links to." />

The search box in the header takes a common name, a species, an assembly name or
an accession, and covers both catalogs at once.

<Figure src="/img/genomes_basics/site_search.png" caption="The header search box, mid-query. The dropdown mixes UCSC database names with GenArk accessions, since both catalogs are in the one index." />

Picking one loads a JBrowse instance at a plain URL, shareable as a link.

## Searching for a gene

Open hg38. It arrives with **NCBI RefSeq - RefSeq All** on and the track
selector showing. Type `TP53` into the location box and press Enter. The hosted
config ships a name index, so gene symbols resolve with no setup, and
coordinates like `chr17:7,668,400-7,687,550` work too.

<Figure src="/img/genomes_basics/search_tp53.png" caption="Top: TP53 typed into the location box, answered by the config's own name index. Middle: what Enter opens, as many transcripts as the track's height holds, the gene labelled TP53 +20 more for the ones it does not, and the isoform control circled. Bottom: the same view after picking Representative transcript from it." />

RefSeq All draws each transcript on its own row, and TP53 has more than the
track's height holds. The gene name reads **TP53 +20 more**, and the circled
chip at the bottom right says `Isoforms trimmed`. Two ways to see more:

- Click **+20 more** to open that one gene
- Click the chip for **Auto / All transcripts / Representative transcript**. The
  last collapses every gene to one transcript, which the rest of this page uses

## Finding a track

The track selector is the drawer down the right; the button at the top left of
the view header closes and reopens it. It lists the catalog under UCSC's own
categories, and **Filter tracks** searches all of them. Type `phyloP` and tick
**Basewise Conservation (phyloP) - 100-way vertebrate alignment**, under
Comparative Genomics.

<Video src="/media/genomes_basics/find_a_track.mp4" caption="The hg38 track catalog in the selector, narrowed by typing phyloP into Filter tracks, with the 100-way vertebrate alignment ticked under Comparative Genomics. The conservation lane arrives under the TP53 transcript." />

The names are UCSC's, so a track known from the UCSC browser is findable under
the same label. UCSC publishes several phyloP tracks for hg38, so the words
after the parenthesis pick one out.

## Reading the phyloP track

phyloP scores each base against the neutral rate the alignment implies. The
score is signed: blue above the line changes more slowly than neutral, red below
it faster.

<Figure src="/img/genomes_basics/phylop_tp53.png" caption="The TP53 transcript over the gene body with phyloP under it, as the track opens. Two blocks are shaded: exons 5-8, and the 3' UTR at the left." />

The peaks are the width of the coding exons. Exons 5-8 carry the codons this
gene is most often mutated at in cancer, and phyloP is high across all four. The
introns drop to the pivot, and so does the 3' UTR, an exon as wide as any coding
one: the score follows the protein, not the transcript.

## Checking the score against the raw data

Zoom in until the sequence appears. The exon below is exon 7, which covers G245,
R248 and R249, three of the codons most often mutated in human cancer.

- Tick **Reference sequence**, which is off by default
- Once its menu has been opened, the isoform chip shrinks to the icon circled
  below, which opens the same options
- At this zoom the default draws the codon row once per transcript

<Figure src="/img/genomes_basics/isoform_control.png" caption="The isoform control on the gene track, circled, with the popover it opens. It carries the same Auto, All transcripts and Representative transcript options as the track menu's Gene glyph radio." />

The score is now one bar per base, and within a codon the third base is the
short one: most third-position changes leave the amino acid alone. Hovering a
bar reads back its score.

## The alignment the score came from

The multiple alignment phyloP was computed from is a checkbox too. UCSC
publishes no bigMaf for the 100-way, so this section switches to the 470-way
pair. Tick both, under Comparative Genomics:

- **Multiz Alignments - 470-way Mammal Alignment (Hiller lab)**
- **Basewise Conservation (phyloP) - 470 phyloP**

<Figure src="/img/genomes_basics/multiz_alignment.png" caption="TP53's DNA binding domain at base zoom: one transcript, phyloP 470-way, and the 470-way multiz alignment it was computed from. A base is drawn only where it differs from human." />

Most columns are blank, which is what a positive score is made of. phyloP counts
substitution events on the tree:

- **Under S240**, nearly every species differs from human, but all carry the
  **same** base: one substitution on the human branch, and the score stays above
  the line
- **Under T256 and G244**, fewer rows differ and those that do disagree with
  each other, and the score goes red

The track's zoom range has two limits: a MAF block carries a row per species, so
a gene-wide view asks you to confirm before fetching, and zoomed further out it
swaps to a precomputed summary with a conservation bar per species.

## The regulatory end of the same gene

Zoom out to the whole gene, and tick five Regulation and Expression tracks:

- **CpG Islands**
- **ENCODE cCREs - ENCODE4 cCREs**
- **Layered H3K4Me3 (hg19)**
- **Layered H3K27Ac (hg19)**
- **EPDnew Promoters - EPDnew v6**

The two histone tracks each hold seven cell lines, drawn over one another as
they open. **Track menu → Plot type → Multi-row → XY plot** gives each a row.
Their names carry hg19 because ENCODE3 released them on it; the files this
config points at are the hg38 ones.

<Figure src="/img/genomes_basics/promoter_regulation.png" caption="TP53 and its promoter, with CpG islands, ENCODE cCREs coloured by class, H3K4me3, H3K27ac and EPDnew's promoter calls. Left: the marks as they open, seven cell lines over one another, with the Plot type menu that separates them. Right: the same six tracks after it." />

The promoter is at the high-coordinate end because the gene is on the minus
strand, and everything lands there together: the CpG island, a promoter-class
cCRE, the EPDnew call and both marks. H3K4me3 marks a promoter and H3K27ac an
active one; all seven cell lines carry both.

## Filtering a dense track

**gnomAD v4.1 - gnomAD v4.1 Exomes** under Variation and Repeats opens as
several thousand records over _TP53_, one block of colour. **Track menu → Filter
by...** takes the track's own columns, one jexl expression per line:

- `jexl:feature.AF >= 0.001` keeps the variants standing in the population
- `jexl:feature.annot == 'pLoF'` keeps gnomAD's predicted loss-of-function
  consequence class (the others are missense, synonymous and other)

<Figure src="/img/genomes_basics/gnomad_filter_menu.png" caption="The gnomAD track's menu, and the dialog Filter by... opens over it, with a consequence-class expression typed in." />

The colours are the file's own, per consequence class, so the loss-of-function
filter leaves a track drawn in one colour.

<Video src="/media/genomes_basics/gnomad_filter.mp4" caption="gnomAD v4.1 Exomes over TP53 and the Add track filters dialog its track menu opens. One consequence-class expression redraws the lane with the predicted loss-of-function records alone, in the one colour the file gives that class." />

Once a filter is in effect the same menu row opens a submenu with **Edit
filters...** and **Clear all filters**.

A BigBed's extra fields arrive as fields, so whatever columns the file carries
are what there is to filter on. ClinVar's clinical classification is
`feature.clinSign`, so `jexl:feature.clinSign == 'Pathogenic'` cuts that catalog
down the same way.

## Other tracks in the hg38 catalog

A few that come up often:

- **Conserved Elements - 100 Vert. El** (Comparative Genomics) is the interval
  companion to phyloP: phyloP scores each base, phastCons calls the runs.
- **RepeatMasker** (Repeats) says which parts of a window are repeat elements.
- **GTEx cis-eQTLs - GTEx DAP-G eQTLs** (Regulation) names the variants
  associated with expression of nearby genes.
- **Long-read SVs - CoLoRSdb 1427 SVs** (Variation and Repeats) covers the size
  range short reads call badly.
- **liftOver** (Pairwise alignments) is a genome-to-genome alignment, and gets a
  page of its own in [](/docs/tutorials/genomes_synteny).

Drag a track by the handle at the left of its header to reorder it; the `×`
closes it.

## What is actually downloaded

The config lives on jbrowse.org, but most UCSC track data resolves back to
hgdownload, read by byte range. The track menu's **About track** prints the
adapter, which is where to look when a track is slow or missing.

<Figure src="/img/genomes_basics/about_track.png" caption="Left: the phyloP track menu, with the icon that opens it circled and About track boxed. Right: the dialog it opens, naming the BigWig on hgdownload with UCSC's own trackDb entry below it." />

Only the blocks under the current view are fetched, which is why a genome-wide
signal track opens at gene zoom without downloading it. The URL is the file
itself, so anything that reads a BigWig by range can take it, such as
`rtracklayer` in R:

```r
library(rtracklayer)
scores <- import(
  "https://hgdownload.soe.ucsc.edu/goldenPath/hg38/phyloP100way/hg38.phyloP100way.bw",
  which = GRanges("chr17", IRanges(7668400, 7687550))
)
```

The BigBeds behind the variant and annotation tracks read the same way.

## Trying another genome

The GenArk assemblies behave the same way, with two differences:

- **Their configs carry a smaller track set**
- **Whether a gene symbol resolves depends on the accession.** The name index is
  built from NCBI RefSeq annotation, so a `GCF_` accession carries gene tracks
  and an index, while a `GCA_` one generally has neither and coordinates are the
  way in

An assembly released both ways appears under both accessions, and only the
RefSeq one searches: the axolotl `Mex_15411` is `GCF_040938575.1` and
`GCA_040938575.1`.

<Figure src="/img/genomes_basics/genark_axolotl.png" caption="Axolotl TP53, reached by typing the symbol into the location box of the GCF_ accession." />

The same gene spans a few hundred kb here; the axolotl genome is one of the
largest sequenced.

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
