---
title: Basic usage of genomes.jbrowse.org
description:
  Open a hosted genome, search a gene, and work through the UCSC track catalog
  on hg38, from conservation and variation at TP53 to p53's own binding sites at
  CDKN1A
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
plus the GenArk assemblies, each with a link into JBrowse and one to its page at
UCSC.

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

<Figure src="/img/genomes_basics/search_tp53.png" caption="Top: the hg38 instance as it opens. Bottom: the view after TP53 goes into the location box, with RefSeq All drawing one transcript per row, past the bottom of the track." />

RefSeq All draws each transcript on its own row, and TP53 has more of them than
the track's height shows, so the rest are behind the track's own scrollbar. The
isoform control at the bottom right of the track collapses them.

## Finding a track

Open the track selector at the top left. The drawer lists the catalog under
UCSC's own categories, and **Filter tracks** searches all of them at once. Type
`phyloP` and tick **Basewise Conservation (phyloP) - 100-way vertebrate
alignment**, which sits under Comparative Genomics.

<Figure src="/img/genomes_basics/turn_on_phylop.png" caption="Left: Filter tracks narrowed to phyloP, which leaves the Comparative Genomics rows. Right: the same drawer after the checkbox, with the track drawn under the genes." />

The names are UCSC's, so a track known from the UCSC browser is findable under
the label it has there.

## Reading it

phyloP scores each base against the neutral rate the alignment implies. The
score is signed, so the track has a pivot rather than a floor: blue above the
line changes more slowly than neutral, red below it faster.

<Figure src="/img/genomes_basics/phylop_tp53.png" caption="The RefSeq transcripts over the TP53 body with phyloP under them, both as they open. The tall peaks sit under the columns where the coding exons (yellow) stack up, including the lone exon out in the middle of the intron. The wide 3' UTR block at the left is an exon too, and carries nothing like them." />

The peaks are the width of the coding exons rather than of the gene: the introns
between them drop to the pivot, and the 3' UTR block at the left end is an exon
carrying none of them.

## Checking it against the raw data

At gene zoom a per-base score and a smoothed band are the same picture, so zoom
in until the sequence appears. The exon below is in the DNA binding domain and
covers R248 and R249, two of the codons most often mutated in human cancer.

Two more clicks make it readable: tick **Reference sequence**, which is off by
default, and set the gene track's isoform control to **Longest coding
transcript**, so the codon row is drawn once.

<Figure src="/img/genomes_basics/isoform_control.png" caption="The isoform control on the gene track, open. It carries the same Auto, All transcripts and Longest coding transcript options as the track menu's Gene glyph radio." />

<Figure src="/img/genomes_basics/phylop_bases.png" caption="One coding exon of TP53 at base zoom: the gene collapsed to one transcript with its residue labels, phyloP under it, and the reference sequence with its translation below that. The signal is one bar per base, and within each codon the third base is the short one. The few bars that go red are third positions." />

Within a codon the third base is the short one: most third-position changes
leave the amino acid alone, so the constraint is on the protein rather than on
the DNA. Hovering a bar reads back its score.

## The alignment the score came from

phyloP scores a base by comparing a multiple alignment against the tree, and on
this config that alignment is a checkbox too. UCSC publishes no bigMaf for the
100-way, so this section switches to the 470-way pair, both under Comparative
Genomics: **Multiz Alignments - 470-way Mammal Alignment (Hiller lab)** and
**Basewise Conservation (phyloP) - 470 phyloP**. Leave the window where it is.

<Figure src="/img/genomes_basics/multiz_alignment.png" caption="TP53's DNA binding domain at base zoom: the gene collapsed to one transcript, phyloP 470-way, and the 470-way multiz alignment it was computed from, one row per species down the tree. A base is drawn only where it differs from human. The column under S240 keeps a positive score; T256 and G244 are where it goes red." />

Most columns are blank, which is what a positive score is made of. The ones that
are not do not score the way their density suggests. Under S240 nearly every
species differs from human, but they all carry the **same** base, and the score
stays above the line: that is one substitution on the human branch, however many
rows show it. Under T256 and G244 fewer rows differ and the ones that do
disagree with each other too, and those are the columns where the score goes
red. phyloP counts substitution events on the tree, not rows that differ from
the reference.

This track only opens at this zoom. A MAF block carries a row per species, so
the byte estimate crosses the too-much-data limit within a few kb and a
gene-wide view asks you to confirm before fetching. Zoomed further out it swaps
to a precomputed summary and draws a conservation bar per species instead of
bases.

## The regulatory end of the same gene

Conservation is one category of about a dozen, and the others are the same two
clicks. Start at the promoter, which for _TP53_ is at the high-coordinate end
because the gene is on the minus strand. Four Regulation tracks put a picture
there: **CpG Islands**, **ENCODE cCREs - ENCODE4 cCREs**, **Layered H3K4Me3
(hg19)** and **Layered H3K27Ac (hg19)**, plus **EPDnew Promoters - EPDnew v6**
from Expression.

The two histone tracks each hold seven cell lines, drawn over one another as
they open. The track menu's **Plot type → Multi-row → XY plot** gives each cell
line a row of its own, which is how they are drawn below. Their names carry hg19
because that is the assembly ENCODE3 released them on; the files this config
points at are the hg38 ones.

<Figure src="/img/genomes_basics/promoter_regulation.png" caption="The promoter end of TP53: CpG islands, ENCODE cCREs coloured by class, then H3K4me3 and H3K27ac as one row per cell line, over EPDnew's promoter calls." />

H3K4me3 marks a promoter and H3K27ac marks an active one, so a cell line with
both is transcribing here. All seven carry both.

## Four readings of one exon

Two more tracks from Phenotypes, Variants, and Literature go on the same exon.
**ClinVar Variants - ClinVar SNVs** carries variants submitted with a clinical
interpretation. **AlphaMissense** scores every possible single-base substitution
for the amino acid change it would cause, as four subtracks, one per substituted
base: a column is a position, a row is what it would become.

<Figure src="/img/genomes_basics/exon_four_ways.png" caption="One DNA binding domain exon of TP53: AlphaMissense in four substitution rows, phyloP, ClinVar coloured by clinical significance, and the reference sequence with its translation." />

AlphaMissense cells are empty where the substitution leaves the residue alone; a
column tall in all four rows is a position where no substitution is predicted to
be tolerated. Most columns in this exon are, phyloP is high over the same bases,
and pathogenic is the commonest ClinVar classification here.

The fourth reading needs the whole transcript. **gnomAD v4.1 - gnomAD v4.1
Exomes** under Variation and Repeats opens as several thousand records over the
gene, which is one block of colour. Two of its columns cut that down to
something with a shape, and **Filter by...** takes either: `feature.AF` is the
allele frequency, and `feature.annot` is gnomAD's own consequence class, one of
pLoF, missense, synonymous or other.

`grpmax` is a third column, naming the genetic ancestry group that carries the
variant at its highest frequency. **Color by... → Attribute...** takes any
column name and assigns each value a colour; the figure uses a named palette
instead, so the legend can say which group is which.

<Figure src="/img/genomes_basics/gnomad_filters.png" caption="The TP53 transcript with phyloP and gnomAD exomes, filtered three ways. Top: every record. Middle: variants above 0.1 percent, coloured by the ancestry group carrying each at its highest frequency. Bottom: the variants gnomAD calls predicted loss of function." />

Unfiltered, gnomAD is densest where phyloP peaks, since that is what an exome
captures. Filtered to the common variants, few remain in coding sequence and the
rest are intronic or in the 3' UTR. Filtered to predicted loss of function, the
track fills the coding exons again.

ClinVar takes the same treatment on its own classification column, `clinSign`,
which leaves the records called pathogenic. Clicking one reads it back.

<Figure src="/img/genomes_basics/variant_details.png" caption="ClinVar filtered to the pathogenic classes, with one variant clicked open. The panel carries the file's own columns, including clinical significance, review status, molecular consequence and the phenotype cross-references, each linking out." />

A BigBed's extra fields arrive as fields: whatever columns the published file
carries are what a click gives back, and are what there is to filter and colour
on.

## Where the protein binds

_TP53_ codes for a transcription factor, so its binding sites are at other
genes. _CDKN1A_ encodes p21, which p53 induces to arrest the cell cycle after
DNA damage. Type `CDKN1A` into the location box.

**JASPAR Transcription Factors - JASPAR 2026 TFBS** under Regulation holds motif
matches for every factor in the collection, so **Filter by...** asks for one:
`feature.TFName == 'TP53'`. Under it go three Regulation tracks from the
promoter section, which are what the matches get read against: **ENCODE cCREs -
ENCODE4 cCREs**, **Layered H3K4Me3 (hg19)** and **Layered H3K27Ac (hg19)**.

<Figure src="/img/genomes_basics/p53_target_cdkn1a.png" caption="The CDKN1A promoter region: RefSeq, JASPAR filtered to the TP53 motif, ENCODE cCREs, then H3K4me3 and H3K27ac as one row per cell line. The shaded pair are the two matches that fall in a cCRE with signal over them; the four to their left have neither." />

Six positions match the motif well enough to be called, spread across the
upstream region. The signal tracks are low over the upstream half and rise from
the shaded pair toward the gene. Each of those two falls inside a cCRE, one
classified a promoter and one a proximal enhancer, and they are where the
response elements for p21 were described. The other four have the motif and no
signal under it.

**PANDAR** and **DINOL**, drawn by the same RefSeq track, are p53-induced
lncRNAs transcribed from the same region.

Zooming to the higher-scoring element shows the motif against the sequence.

<Figure src="/img/genomes_basics/p53_element_sequence.png" caption="The distal element at base zoom: the JASPAR match, the promoter-class cCRE it sits inside, and the reference sequence. The match is called on both strands because the site is two copies of the p53 half-site end to end, which is what the boxes span." />

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

<Figure src="/img/genomes_basics/about_track.png" caption="Left: the phyloP track menu, with About track at the top of it. Right: the dialog that opens. The adapter names the BigWig on hgdownload, and the metadata below it is UCSC's own trackDb entry, carried through the conversion." />

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

<Figure src="/img/genomes_basics/genark_axolotl.png" caption="Axolotl TP53, reached by typing the symbol into the location box of the GCF_ accession. The gene track is the one the name index answered from, with GC percent and RepeatMasker under it, the repeats drawn as one lane per class." />

The gene is the same gene and the track set is the familiar one. The span is
not: the axolotl genome is large and repeat-rich, and RepeatMasker under the
introns is where that shows.

Both tracks under the gene carry a setting from their track menus. RepeatMasker
is one lane per repeat class, through **Display types → Multi-row feature
display (painting)**, the subject of [](/docs/tutorials/repeatmasker_classes).
GC percent is on **Score → Summary score mode → Average** and the 30 to 70
bounds UCSC's own trackDb asks for, through **Score → Set min/max score...**.

## See also

- [](/docs/user_guides/gene_track)
- [](/docs/tutorials/genomes_synteny)
- [](/docs/tutorials/genomes_msa)
- [](/docs/tutorials/pangenome_hprc)
- [](/docs/tutorials/repeatmasker_classes)
- [](/docs/user_guides/quantitative_track)
- [](/docs/user_guides/hub_url)
- [](/docs/agents_hosted_data)

## References

- [Pollard KS et al. Detection of nonneutral substitution rates on mammalian phylogenies. _Genome Res_ 2010](https://pmc.ncbi.nlm.nih.gov/articles/PMC2798823/),
  the phyloP method
- [Cheng J et al. Accurate proteome-wide missense variant effect prediction with AlphaMissense. _Science_ 2023](https://pubmed.ncbi.nlm.nih.gov/37733863/),
  the AlphaMissense scores
- [Bouaoun L et al. TP53 variations in human cancers. _Hum Mutat_ 2016](https://pubmed.ncbi.nlm.nih.gov/27328919/),
  the mutation distribution across TP53 codons
- [Liao WW et al. A draft human pangenome reference. _Nature_ 2023](https://pubmed.ncbi.nlm.nih.gov/37165242/),
  the HPRC assemblies the pangenome callset is built from
- [el-Deiry WS et al. WAF1, a potential mediator of p53 tumor suppression. _Cell_ 1993](https://pubmed.ncbi.nlm.nih.gov/8242752/),
  the p53 response elements upstream of CDKN1A
- [Ovek Baydar D et al. JASPAR 2026: expansion of transcription factor binding profiles and integration of deep learning models. _Nucleic Acids Res_ 2026](https://pubmed.ncbi.nlm.nih.gov/41325984/),
  the motif collection the TFBS track is scanned from
- [UCSC hg38 conservation downloads](https://hgdownload.soe.ucsc.edu/goldenPath/hg38/phyloP100way/)
