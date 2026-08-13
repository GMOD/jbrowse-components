---
title: Basic usage of genomes.jbrowse.org
description:
  Open a hosted genome, search a gene, and work through the UCSC track catalog
  on hg38 at TP53, from phyloP conservation to pangenome genotypes
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
with a link to each one in JBrowse and the matching page at UCSC.

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

<Figure src="/img/genomes_basics/search_tp53.png" caption="Top: the hg38 instance as it opens. Bottom: the view after TP53 goes into the location box, with RefSeq All stacking every transcript of the gene." />

RefSeq All draws each transcript on its own row. The isoform control at the
bottom right of the track collapses them, and is worth knowing about early
because a gene with this many transcripts is otherwise most of the window.

## Finding a track

Open the track selector at the top left. The drawer lists the catalog under
UCSC's own categories, and **Filter tracks** searches all of them at once. Type
`phyloP` and tick **Basewise Conservation (phyloP) - 100-way vertebrate
alignment**, which sits under Comparative Genomics.

<Figure src="/img/genomes_basics/turn_on_phylop.png" caption="Left: Filter tracks narrowed to phyloP, which leaves the Comparative Genomics rows. Right: the same drawer after the checkbox, with the track drawn under the genes." />

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

<Figure src="/img/genomes_basics/isoform_control.png" caption="The isoform control on the gene track, open. It carries the same Auto, All transcripts and Longest coding transcript options as the track menu's Gene glyph radio." />

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

## The regulatory end of the same gene

Conservation is one category of about a dozen, and the rest of this page is the
same two clicks on the others, at the same gene. Start at the promoter, which
for _TP53_ is at the high-coordinate end because the gene is on the minus
strand. Four Regulation tracks put a picture there: **CpG Islands**, **ENCODE
cCREs - ENCODE4 cCREs**, **DNase (Layered)** and **H3K27ac (Layered)**, plus
**EPDnew Promoters - EPDnew v6** from Expression.

<Figure src="/img/genomes_basics/promoter_regulation.png" caption="The promoter end of TP53, with WRAP53 running the other way out of the same interval: CpG islands, ENCODE cCREs coloured by class, and the layered DNase and H3K27ac signal, one colour per tissue, over EPDnew's promoter calls." />

The two layered tracks are each one track holding dozens of tissue subtracks
drawn over one another, which is how UCSC publishes them. The DNase peaks are
narrow and land on the cCREs called promoters rather than enhancers; H3K27ac is
broader and covers the interval around them. EPDnew names a promoter for _TP53_
and several for _WRAP53_, which starts transcribing the other way out of the
same place.

## What a substitution would do

phyloP says which bases have not changed. AlphaMissense, under Phenotypes,
Variants, and Literature, says what would happen if they did: it scores every
possible single-base substitution for the effect of the amino acid change it
causes. The track is four subtracks, one per substituted base, so a column is a
position and a row is what that position would become.

<Figure src="/img/genomes_basics/alphamissense_exon.png" caption="The same DNA binding domain exon: AlphaMissense in four rows, one per substituted base, over phyloP and the reference sequence with its translation." />

Cells are empty where there is no amino acid change to score, which is the base
a position already carries and the substitutions that leave the residue alone.
Where a column is tall in all four rows, no substitution there is predicted to
be tolerated.

The two tracks are independent readings of the same exon rather than two views
of one number: phyloP is measured, from the alignment across species, and
AlphaMissense is predicted, from the protein. Both are read the same way in
JBrowse, and hovering either gives the score back.

## Clinical and population variation

The same locus, from two more catalogs: **ClinVar Variants - ClinVar SNVs**
under Phenotypes, Variants, and Literature, and **gnomAD v4.1 - gnomAD v4.1
Exomes** under Variation and Repeats.

<Figure src="/img/genomes_basics/clinvar_gnomad.png" caption="ClinVar SNVs and gnomAD v4.1 exome variants over the TP53 transcript, with the gene collapsed above them. ClinVar colours each variant by clinical significance." />

Both variant sets pile up on the coding exons, and for different reasons:
ClinVar's records are there because that is where the submitted variants were
looked for, gnomAD's exome callset because that is where the exome capture
reads. The colours are the part that separates them, and clicking a variant is
how to read one.

<Figure src="/img/genomes_basics/variant_details.png" caption="A ClinVar variant clicked open. The panel carries the file's own columns, including clinical significance, review status, molecular consequence and the phenotype cross-references, each linking out." />

A BigBed's extra fields arrive as fields, so nothing about this panel is
particular to ClinVar: whatever columns the published file carries are what a
click gives back.

## A pangenome panel

Under Variation and Repeats, **Human Pangenome (HPRC)** holds the pangenome
callset for the same coordinates: variants called from assembled haplotypes
rather than from reads mapped to the reference. Its default display is one
allele-frequency band; the track menu's display types include a per-sample one,
which draws a row per haplotype.

<Figure src="/img/genomes_basics/hprc_pangenome.png" caption="The HPRC pangenome callset over TP53 as a genotype matrix, one row per haplotype and one column per variant, drawn at each variant's real position. The legend names the genotype colours." />

A column that runs the full height is a variant most haplotypes carry, which is
to say a place the reference is the unusual sequence. The scattered single cells
are the opposite.

## Other tracks, same two clicks

Nothing above was specific to conservation, regulation or variation. Some others
worth opening, with the category each one filters out of:

- **Conserved Elements - 100 Vert. El** (Comparative Genomics) is the interval
  companion to phyloP. phyloP scores each base, phastCons calls the runs.
- **RepeatMasker** (Repeats) says which parts of a window are repeat elements,
  which is worth knowing before reading much into a signal over one.
- **JASPAR Transcription Factors - JASPAR 2026 TFBS** (Regulation) puts motif
  matches under the peaks above, and is dense enough to want a narrow window.
- **GTEx cis-eQTLs - GTEx DAP-G eQTLs** (Regulation) names the variants
  associated with expression of nearby genes.
- **Long-read SVs - CoLoRSdb 1427 SVs** (Variation and Repeats) covers the size
  range short reads call badly.
- **liftOver** (Pairwise alignments) is a genome-to-genome alignment rather than
  an annotation, and gets a page of its own in
  [](/docs/tutorials/genomes_synteny).

Turning several on at once is fine. Drag a track by the handle at the left of
its header to reorder, and the `×` in the header closes it again.

## What is actually downloaded

The config lives on jbrowse.org, but most UCSC track data resolves back to
hgdownload and JBrowse reads those files by byte range. The track menu's **About
track** prints the adapter, which is where to look when a track is slow or
missing: the file it names is the one being read.

<Figure src="/img/genomes_basics/about_track.png" caption="About track on the phyloP track. The adapter names the BigWig on hgdownload, and the metadata below it is UCSC's own trackDb entry, carried through the conversion." />

The phyloP file covers the whole genome and only the blocks under the current
view are fetched, which is why a genome-wide signal track opens at gene zoom
without downloading it.

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

<Figure src="/img/genomes_basics/genark_axolotl.png" caption="Axolotl TP53, reached by typing the symbol into the location box of the GCF_ accession. The gene track is the one the name index answered from, with GC percent and RepeatMasker under it." />

The gene is the same gene and the track set is the familiar one. The span is
not: the axolotl genome is large and repeat-rich, and RepeatMasker under the
introns is where that shows.

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
- [Cheng J et al. Accurate proteome-wide missense variant effect prediction with AlphaMissense. _Science_ 2023](https://pubmed.ncbi.nlm.nih.gov/37733863/),
  the AlphaMissense scores
- [Bouaoun L et al. TP53 variations in human cancers. _Hum Mutat_ 2016](https://pubmed.ncbi.nlm.nih.gov/27328919/),
  the mutation distribution across TP53 codons
- [Liao WW et al. A draft human pangenome reference. _Nature_ 2023](https://pubmed.ncbi.nlm.nih.gov/37165242/),
  the HPRC assemblies the pangenome callset is built from
- [UCSC hg38 conservation downloads](https://hgdownload.soe.ucsc.edu/goldenPath/hg38/phyloP100way/)
