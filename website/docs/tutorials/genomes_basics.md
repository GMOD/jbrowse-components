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

genomes.jbrowse.org hosts a ready-made JBrowse config for every UCSC genome,
with that genome's UCSC track catalog. We open hg38, find _TP53_, and turn on
its conservation, regulation and variant tracks from the catalog.

## Opening a genome

[genomes.jbrowse.org](https://genomes.jbrowse.org) hosts a JBrowse 2 instance
for every main UCSC database (hg19, hg38, hs1, mm39 and the rest) plus the UCSC
GenArk assemblies, track hubs for tens of thousands of NCBI plants, animals,
fungi, bacteria and viruses. Three routes lead to one, each ending at an
instance with a URL you can share:

- The front page's table of main genomes, with the GenArk catalog below it

<Figure src="/img/genomes_basics/site_home.png" caption="The genomes.jbrowse.org front page. The top table is the short list of main genomes, and the GenArk catalog starts below it." />

- The [/ucsc](https://genomes.jbrowse.org/ucsc) page, with a filter box over
  every UCSC database's name, species and description

<Figure src="/img/genomes_basics/site_ucsc_list.png" caption="The full UCSC database listing. Each row opens the same kind of JBrowse instance the front page links to." />

- The header search box, which takes a common name, a species, an assembly name
  or an accession across both catalogs

<Figure src="/img/genomes_basics/site_search.png" caption="The header search box, mid-query. The dropdown mixes UCSC database names with GenArk accessions, since both catalogs are in the one index." />

## Searching for TP53 and trimming its isoforms

Open hg38. The page starts with **NCBI RefSeq - RefSeq All** on and the track
selector showing. Type `TP53` into the location box and press Enter. The hosted
config ships a name index, so gene symbols resolve, and coordinates like
`chr17:7,668,400-7,687,550` work too.

<Figure src="/img/genomes_basics/search_tp53.png" caption="Top: TP53 typed into the location box, found by the config's name index. Middle: what Enter opens, as many transcripts as the track's height holds, a link beside the TP53 label for the ones it does not, and the isoform control circled. Bottom: the same view after picking Representative transcript from it." />

RefSeq All draws each transcript on a separate row, and _TP53_ has more than the
track's height holds. Two controls trim the isoforms:

- Click the **+19 more** link beside the gene name to open that one gene
- Click the `Isoforms trimmed` chip at the bottom right for **Auto / All
  transcripts / Representative transcript**. The last collapses every gene to
  one transcript, which the rest of this page uses

## Finding the phyloP conservation track in the catalog

The track selector is the drawer down the right; the button at the top left of
the view header closes and reopens it. It lists the catalog under UCSC's
categories, and **Filter tracks** searches all of them. Type `phyloP` and tick
**Basewise Conservation (phyloP) - 100-way vertebrate alignment**, under
Comparative Genomics.

<Video src="/media/genomes_basics/find_a_track.mp4" caption="The hg38 track catalog in the selector, narrowed by typing phyloP into Filter tracks, with the 100-way vertebrate alignment ticked under Comparative Genomics. The conservation lane appears under the TP53 transcript." />

## Reading the phyloP track

phyloP scores each base against the neutral rate the alignment implies. The
score is signed: blue above the line marks a base that changes more slowly than
neutral, and red below it one that changes faster.

Type `chr17:7,674,180-7,674,290`, a stretch of exon 7, into the location box.

- Tick **Reference sequence**, which is off by default
- At this zoom the gene track draws a codon row per transcript; pick
  **Representative transcript** from the isoform control to keep one

<Figure src="/img/genomes_basics/isoform_control.png" caption="The isoform control on the gene track, circled, with the popover it opens. The popover offers the same Auto, All transcripts and Representative transcript options as the track menu's Gene glyph radio." />

At this zoom phyloP draws one bar per base, and within a codon the third base's
bar is the short one, since most third-position changes leave the amino acid
alone. Hover a bar to read its score.

## The multiple alignment behind the phyloP score

The multiple alignment behind a phyloP track is a checkbox too. UCSC publishes
no bigMaf (indexed alignment file) for the 100-way, so this section switches to
the 470-way pair. Tick both, under Comparative Genomics:

- **Multiz Alignments - 470-way Mammal Alignment (Hiller lab)**
- **Basewise Conservation (phyloP) - 470 phyloP**

<Figure src="/img/genomes_basics/multiz_alignment.png" caption="TP53's DNA binding domain at base zoom: one transcript, phyloP 470-way, and the 470-way multiz alignment it was computed from. A base is drawn only where it differs from human." />

In the alignment track, most columns are blank because every species matches
human at those bases, and conserved columns give a positive score. phyloP counts
substitution events on the tree:

- under S240 (serine 240), nearly every species differs from human, but all have
  the _same_ base, which is one substitution on the human branch, so the score
  stays above the line
- under T256 and G244 (threonine 256, glycine 244), fewer rows differ and those
  that do disagree with each other, and the score goes red

A MAF block has a row per species, so at gene-wide zoom the alignment track asks
you to confirm before fetching.

## Regulatory tracks at the TP53 promoter

Zoom out to the whole gene, and tick five Regulation and Expression tracks:

- **CpG Islands**
- **ENCODE cCREs - ENCODE4 cCREs**
- **Layered H3K4Me3 (hg19)**
- **Layered H3K27Ac (hg19)**
- **EPDnew Promoters - EPDnew v6**

The Layered H3K4Me3 and H3K27Ac tracks each hold seven cell lines, and open with
all seven in one plot box, UCSC's layered arrangement. **Plot type → Multi-row →
XY plot** in the track menu gives each cell line a row of its own. Their names
include hg19 from ENCODE3's release; the config points at the hg38 files.

<Figure src="/img/genomes_basics/promoter_regulation.png" caption="TP53 and its promoter, with CpG islands, ENCODE cCREs coloured by class, H3K4me3, H3K27ac and EPDnew's promoter calls. Left: the two marks with their seven cell lines in one plot box, and the Plot type menu that separates them. Right: the same six tracks with a row per cell line." />

_TP53_ is on the minus strand, so its promoter sits at the high-coordinate end,
where every track in the figure has a call.

## Filtering gnomAD's TP53 variants to predicted loss of function

The **gnomAD v4.1.1 - gnomAD v4.1.1 Exomes** track, under Variation and Repeats,
opens as several thousand variant records over _TP53_, one block of colour.
**Filter by...** in the track menu takes rows of field, operator and value over
the track's columns. Type a column name into the field box, which lists the
file's columns with the description the file gives each. A record has to pass
every row:

- `annot` is `pLoF` keeps gnomAD's predicted loss-of-function consequence class
  (the others are missense, synonymous and other)
- `AF` ≥ `0.001` drops the rarest variants

<Figure src="/img/genomes_basics/gnomad_filter_menu.png" caption="The gnomAD track's menu, and the dialog Filter by... opens over it, with a consequence-class row filled in." />

<Video src="/media/genomes_basics/gnomad_filter.mp4" caption="gnomAD v4.1.1 Exomes over TP53 and the filter dialog its track menu opens. One consequence-class row redraws the lane with the predicted loss-of-function records alone, in the one colour the file gives that class." />

Once a filter is in effect, the track menu's filter row opens a submenu with
**Edit filters...** and **Clear all filters**.

The filter works on any column a BigBed has. ClinVar's clinical classification
is the column `clinSign`, so the row `clinSign` is `Pathogenic` filters that
catalog the same way. The same menus apply to a bigWig or BigBed of your own
added with **Add track**; the
[web quickstart](/docs/quickstart_web#adding-tracks) covers the steps.

## Where the track data is read from

The config is hosted on jbrowse.org, but most UCSC track data resolves back to
hgdownload, read by byte range. The track menu's **About track** prints the
adapter, which is where to look when a track is slow or missing.

<Figure src="/img/genomes_basics/about_track.png" caption="Left: the phyloP track menu, with the icon that opens it circled and About track boxed. Right: the dialog it opens, naming the BigWig on hgdownload with UCSC's trackDb entry below it." />

The URL is the file itself, and any program that reads a BigWig by range can
open it, such as `rtracklayer` in R:

```r
library(rtracklayer)
scores <- import(
  "https://hgdownload.soe.ucsc.edu/goldenPath/hg38/phyloP100way/hg38.phyloP100way.bw",
  which = GRanges("chr17", IRanges(7668400, 7687550))
)
```

## Searching TP53 on a GenArk genome, the axolotl

The GenArk configs have a smaller track set than the UCSC database configs, and
their name indexes come from NCBI RefSeq annotation. A `GCF_` accession has gene
tracks and resolves gene symbols, while a `GCA_` accession generally has neither
and takes coordinates. An assembly released both ways appears under both
accessions: the axolotl `Mex_15411` is `GCF_040938575.1` and `GCA_040938575.1`.
Open `GCF_040938575.1` from the site's header search for `axolotl`, and type
`TP53` into its location box.

<Figure src="/img/genomes_basics/genark_axolotl.png" caption="Axolotl TP53, reached by typing the symbol into the location box of the GCF_ accession." />

## See also

- [](/docs/user_guides/gene_track)
- [](/docs/tutorials/genomes_synteny)
- [](/docs/tutorials/genomes_proteins)
- [](/docs/tutorials/pangenome_hprc)
- [](/docs/tutorials/repeatmasker_classes)
- [](/docs/user_guides/quantitative_track)
- [](/docs/user_guides/hub_url)
- [](/docs/agents_hosted_data)

## External links

- [UCSC hg38 conservation downloads](https://hgdownload.soe.ucsc.edu/goldenPath/hg38/phyloP100way/)

## Citations

- [Pollard KS et al. Detection of nonneutral substitution rates on mammalian phylogenies. _Genome Res_ 2010](https://pmc.ncbi.nlm.nih.gov/articles/PMC2798823/),
  the phyloP method
- [Bouaoun L et al. TP53 variations in human cancers. _Hum Mutat_ 2016](https://pubmed.ncbi.nlm.nih.gov/27328919/),
  the mutation distribution across TP53 codons
- [Cho Y et al. Crystal structure of a p53 tumor suppressor-DNA complex. _Science_ 1994](https://pubmed.ncbi.nlm.nih.gov/8023157/),
  which hotspot residues contact the DNA and which hold the structure
- [Liao WW et al. A draft human pangenome reference. _Nature_ 2023](https://pubmed.ncbi.nlm.nih.gov/37165242/),
  the HPRC assemblies the pangenome callset is built from
