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

A genome browser lays a genome's sequence out as a horizontal coordinate axis
and stacks annotation files under it as tracks (genes, conservation scores,
variant catalogs), so you can read them together at one locus and zoom from a
whole chromosome down to single bases. genomes.jbrowse.org has a browser ready
to open for every UCSC genome, each with that genome's UCSC track catalog. We
read the human tumor suppressor gene _TP53_ on hg38, then look up the same gene
on the axolotl. We:

- open hg38 from the site, search for _TP53_ in the location box and trim the
  gene track's isoforms
- tick the phyloP conservation track and its multiple alignment in the track
  selector
- turn on regulation tracks at the promoter and split the layered ones into a
  row per cell line from **Plot type**
- filter the gnomAD variant track to predicted loss of function from **Filter
  by**
- search for _TP53_ on a GenArk genome, the axolotl

## Opening a genome

[genomes.jbrowse.org](https://genomes.jbrowse.org) hosts a JBrowse instance for
every main UCSC database (hg19, hg38, hs1, mm39 and the rest) and for the UCSC
GenArk assemblies, the track hubs UCSC builds for NCBI's plant, animal, fungal,
bacterial and viral genomes. Three routes lead to one, each ending at an
instance with a URL you can share:

- The front page's table of main genomes, with the GenArk catalog below it

<Figure src="/img/genomes_basics/site_home.png" caption="The genomes.jbrowse.org front page." />

- The [/ucsc](https://genomes.jbrowse.org/ucsc) page, with a filter box over
  every UCSC database's name, species and description

<Figure src="/img/genomes_basics/site_ucsc_list.png" caption="The UCSC database listing." />

- The header search box, which takes a common name, a species, an assembly name
  or an accession across both catalogs

<Figure src="/img/genomes_basics/site_search.png" caption="The header search box, mid-query, mixing UCSC databases with GenArk accessions." />

## Searching for TP53 and trimming its isoforms

Open hg38. The view starts with one track on, the **NCBI RefSeq - RefSeq All**
gene track, and the track selector open down the right. The location box at the
top of the view takes a gene symbol, because the hosted config ships a name
index, or a coordinate range such as `chr17:7,668,400-7,687,550`:

- Type `TP53` into the location box and press Enter

<Figure src="/img/genomes_basics/search_tp53.png" caption="Top: TP53 typed into the location box. Bottom: the view Enter opens, with the isoform control circled." />

RefSeq All draws each transcript on a separate row, and _TP53_ has more
transcripts than the track's height holds. Two controls trim them:

- Click the **+19 more** link beside the gene name to open that one gene
- Click the `Isoforms trimmed` chip at the bottom right for **Auto / All
  transcripts / Representative transcript**. The last collapses every gene to
  one transcript, which the rest of this page uses

## Finding the phyloP conservation track in the catalog

Every other track in the catalog is a checkbox in the track selector, the drawer
down the right, which the button at the top left of the view header closes and
reopens. The selector lists the catalog under UCSC's categories, and **Filter
tracks** searches all of them.

Type `phyloP` into **Filter tracks**. Under Comparative Genomics, tick
**Basewise Conservation (phyloP) - 100-way vertebrate alignment**.

<Video src="/media/genomes_basics/find_a_track.mp4" caption="The hg38 track catalog in the selector, narrowed by typing phyloP into Filter tracks, with the 100-way vertebrate alignment ticked under Comparative Genomics. The conservation track appears under the TP53 transcript." />

## Reading the phyloP track

phyloP scores each base against the neutral rate the alignment implies. The
score is signed: blue above the line marks a base that changes more slowly than
neutral, and red below it one that changes faster.

We'll zoom to single bases in exon 7, where phyloP draws one bar per base:

- Type `chr17:7,674,180-7,674,290` into the location box
- Tick **Reference sequence**, which is off by default
- If the gene track draws a codon row per transcript, pick **Representative
  transcript** from the isoform control to keep one

<Figure src="/img/genomes_basics/isoform_control.png" caption="The gene track's isoform control and the popover it opens." />

Within a codon the third base's bar is the short one, since most third-position
changes leave the amino acid alone. Hover a bar to read its score.

## The multiple alignment behind the phyloP score

The multiple alignment behind a phyloP track is a checkbox too. UCSC publishes
no bigMaf (indexed alignment file) for the 100-way, so this section switches to
the 470-way pair. Tick both, under Comparative Genomics:

- **Multiz Alignments - 470-way Mammal Alignment (Hiller lab)**
- **Basewise Conservation (phyloP) - 470 phyloP**

<Figure src="/img/genomes_basics/multiz_alignment.png" caption="TP53's DNA binding domain at base zoom with phyloP and the 470-way multiz alignment. A base is drawn only where it differs from human." />

In the alignment track, most columns are blank because every species matches
human at those bases, and conserved columns give a positive score. phyloP counts
substitution events on the tree:

- under S240 (serine 240), nearly every species differs from human, but all have
  the same base, which is one substitution on the human branch, so the score
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

The Layered H3K4Me3 and H3K27Ac tracks each hold several cell lines and open
with all of them overlaid in one plot, UCSC's layered arrangement. Their names
include hg19 from ENCODE3's release, but the config points at the hg38 files. To
give each cell line a row:

- Choose **Plot type → Multi-row → Bar plot** in each layered track's menu

<Figure src="/img/genomes_basics/promoter_regulation.png" caption="TP53's promoter. Left: the Plot type menu over the overlaid marks. Right: a row per cell line." />

_TP53_ is on the minus strand, so its promoter sits at the high-coordinate end,
where every track in the figure has a call.

## Filtering gnomAD's TP53 variants to predicted loss of function

The **gnomAD v4.1.1 - gnomAD v4.1.1 Exomes** track, under Variation and Repeats,
opens as a dense run of variant records over _TP53_, one block of color. A
filter keeps the records that match an expression:

- Choose **Filter by → Edit filters...** in the track menu. The dialog takes one
  [jexl](/docs/config_guides/jexl) expression per line, and a record has to pass
  every line
- **Insert field…** lists the file's columns with the description the file gives
  each, and writes the one you pick at the cursor
- Type `feature.annot == 'pLoF'` to keep gnomAD's predicted loss-of-function
  consequence class (the others are missense, synonymous and other)
- Add `feature.AF >= 0.001` on a second line to drop the rarest variants

<Figure src="/img/genomes_basics/gnomad_filter_menu.png" caption="The gnomAD track's menu and the filter dialog Edit filters... opens." />

<Video src="/media/genomes_basics/gnomad_filter.mp4" caption="gnomAD Exomes over TP53, filtered to one consequence class from the track menu." />

Once a filter is in effect, the same submenu adds **Clear all filters**.

The filter works on any column a BigBed has. ClinVar's clinical classification
is the column `clinSign`, so `feature.clinSign == 'Pathogenic'` filters that
catalog the same way.

The **Filter by** menus also work on a file of your own, drawn beside the hosted
catalog. Click **Add track** in the track selector and give it the file's URL,
or pick it from disk; the [web quickstart](/docs/quickstart_web#adding-tracks)
lists the index each format needs.

## Where the track data is read from

The config is hosted on jbrowse.org, and most UCSC track data resolves back to
hgdownload, read by byte range. **About track** in the track menu prints the
adapter and its file URL, which is where to look when a track is slow or
missing.

<Figure src="/img/genomes_basics/about_track.png" caption="Left: the phyloP track menu with About track boxed. Right: the dialog it opens." />

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

Type `axolotl` into the site's header search, open `GCF_040938575.1`, and type
`TP53` into its location box.

<Figure src="/img/genomes_basics/genark_axolotl.png" caption="Axolotl TP53, reached by typing the symbol into the location box." />

## See also

- [](/docs/tutorials/genomes_synteny)
- [](/docs/tutorials/genomes_proteins)
- [](/docs/tutorials/repeatmasker_classes)
- [](/docs/quickstart_web)
- [](/docs/quickstart_desktop)
- [](/docs/tutorials/pangenome_hprc)
- [](/docs/user_guides/gene_track)
- [](/docs/user_guides/quantitative_track)
- [](/docs/user_guides/hub_url)
- [](/docs/agents_hosted_data)

## External links

- [UCSC hg38 conservation downloads](https://hgdownload.soe.ucsc.edu/goldenPath/hg38/phyloP100way/)

## Citations

- Pollard et al. (2010).
  [Detection of nonneutral substitution rates on mammalian phylogenies](https://pmc.ncbi.nlm.nih.gov/articles/PMC2798823/),
  the phyloP method
