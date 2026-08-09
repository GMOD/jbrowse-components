---
title: Protein alignments on genomes.jbrowse.org
description:
  Right-click a gene and build a cross-species protein alignment from NCBI's
  precomputed orthologs, with conserved domains overlaid
guide_category: Tutorials
tutorial_category: Transcriptomics & proteins
---

**TL;DR:** genomes.jbrowse.org loads both protein plugins, so any gene in a
linear genome view can be turned into a cross-species protein alignment or a 3D
structure without preparing anything. The alignment is built from NCBI's
precomputed orthologs rather than from a similarity search, so there is no job
to queue, its rows are labelled by species, and NCBI's conserved-domain
annotations are drawn on top of it.

## Prerequisites

- nothing to install: this is a click-path through a hosted site, and no
  sequence, alignment or tree is prepared by hand

## Orthologs, not a search

NCBI publishes one ortholog gene per species for most annotated genes, so the
plugin can look up what this gene is in each species instead of submitting a
similarity search for what looks like this sequence. The lookup returns
immediately, which leaves the multiple alignment itself as the only step that
takes real time; a `blastp` submission has to queue and run before an alignment
can start.

The dialog's **NCBI BLAST query** tab is the route for a gene with no resolvable
symbol, which is the case a search handles and a lookup cannot.

## Opening the gene

Open [hg38 on genomes.jbrowse.org](https://genomes.jbrowse.org) and type `NLRP1`
into the location box. The hosted config ships a name index, so gene symbols
work with no setup.

_NLRP1_ is an inflammasome sensor. It is a good first gene here because its
domain architecture is not the same in every mammal, which is what the overlay
is for.

## Launching the alignment

Right-click the gene. The menu carries one launcher from each of the two protein
plugins the site loads: **Launch MSA view** from msaview, and **Launch protein
view** from protein3d, covered
[further down](#the-structure-view-on-the-same-menu). Choose **Launch MSA
view**, and the dialog opens on its **Orthologs (fast)** tab.

Three fields on that tab matter:

- **Query species** is the species the gene came from, human here.
- **Species to include** is the panel of rows to build. As its label says,
  species with no ortholog for this gene are skipped rather than erroring, so
  leaving them all ticked costs nothing.
- **Choose isoform** picks which transcript becomes the query row. That row is
  the one the genome view stays linked to, so hovering the alignment highlights
  the matching codons back in the linear view.

**MSA Algorithm** is what EBI is asked to run, Clustal Omega by default, and is
the step the wait is actually in.

Press **Submit**. A multiple sequence alignment view opens below the genome
view, with a tree on the left, the alignment beside it, and the conserved-domain
overlay drawn over the residues once NCBI returns it.

The view opens at residue zoom, which on a protein this long is a window on its
N terminus. **Fit horizontally**, under the toolbar's fit and zoom button, puts
the whole alignment on screen, which is the zoom the domain blocks read at.

<Figure src="/img/genomes_msa/launch_sequence.png" caption="The whole path on NLRP1: the right-click menu with both plugins' launchers boxed, the Launch MSA view dialog on its Orthologs tab, and the alignment Submit builds, fitted to the width. Twelve of the twenty-three species offered have an NLRP1 ortholog. The pyrin block is on the great apes and the marmoset and on no other row; the NACHT-to-CARD core to the right of it is in every row." />

## Reading the overlay

Each colored block is an NCBI conserved domain, drawn in alignment columns
rather than at each protein's own residue positions. That is what makes the rows
comparable: the same domain lands in the same column in every row that has it,
however different the proteins are in length.

Human _NLRP1_ carries a pyrin (PYD) death-fold domain at its N terminus, and so
do the chimpanzee, gorilla and marmoset rows. No other row in the panel does,
mouse _Nlrp1a_ included, and neither does the rhesus macaque, whose record
carries plenty of other calls. Everything after the pyrin is shared, so the
overlay reads as one block on the left that a few rows have, and a matching
stack of blocks to the right of it that every row has.

That is a clade-level pattern rather than a quirk of one row, which is what a
panel of twelve mammals buys over a panel of five. It is also a statement about
annotation and not only about biology: the block is drawn where NCBI's
conserved-domain database has called one, and a species missing the call is not
the same as a species missing the sequence, which is what the residue check
below is for.

That shared core is the control. NACHT, the winged helix, HD2, FIIND and CARD
are present in every row, so they have to line up in the same columns; a missing
block only means something because the blocks around it agree.

The calls ride along on NCBI's own protein records, so they arrive with the
sequences and cost no extra step. For a protein NCBI has no calls for, the view
menu offers **Open domains...** to read them from a file and **Query
InterProScan for domains...** to compute them.

## Checking it against the raw alignment

A whole-protein view cannot tell "no domain annotated" from "no sequence", so
read the residues. The zoom the view opened at is already the right one: scroll
back to it, or use the alignment's **Zoom in** button until the letters return.

Which columns the view opens on is worth one detour, because it is a property of
any panel of unequal proteins rather than of this gene. An alignment is as long
as its longest row, so its leftmost columns belong to whichever protein reaches
furthest past the others and every other row is gap underneath them. On a panel
this wide those opening columns are one or two rows' private N-terminal
extensions, which is not what the comparison is about. **Hide columns w/ >N%
gaps**, the slider in the alignment's toolbar, is the lever: bring it down until
the columns only a row or two hold disappear, and the columns the panel shares
(the pyrin among them) come to the left edge.

The rows without a pyrin block are not empty there. Sheep, cattle and dog carry
ordinary residues under the same columns with nothing called over them, which is
a different statement from the sequence being absent, and the horse and rhesus
macaque rows carry a death-domain call that is not the pyrin-specific one. Mouse
and guinea pig are the actual absence: gap right across the frame, because their
rows begin further right in the alignment.

<Figure src="/img/genomes_msa/pyrin_residues.png" caption="NLRP1 across the species NCBI has an ortholog for, at the residue zoom the view opens on, with the gappiest columns hidden so the human N terminus sits at the left edge. The pyrin call, in light blue, is on the human, chimpanzee, gorilla and marmoset rows and on no others." />

## The same domains in genome coordinates

The overlay's calls come from NCBI's conserved-domain database. UniProt
annotates the same proteins independently, and UCSC projects those annotations
back onto the genome, so the hosted config already carries them as ordinary
tracks: **UniProt - Domains**, under Genes and Gene Predictions, is the domain
architecture in genomic coordinates instead of in alignment columns.

Turn it on in the linear view you launched from and the human row's blocks have
a counterpart under the gene, from a different database and reached by a
different route. _NLRP1_ is transcribed right to left, so the pyrin block sits
at the right-hand end of the gene, where its N terminus is, and NACHT, FIIND and
CARD follow it leftward. They are projections of protein spans through exons, so
a domain drawn once in the alignment is drawn once per isoform here, and the
ones that share exons overlap. The neighbouring **UniProt - Chains**,
**Mutations** and **AA Modifications** tracks are the same projection of the
rest of the record.

## Trying other genes

The same click-path works on any gene in the view whose symbol NCBI recognises.
What changes between genes is how many species come back: a conserved gene fills
the whole panel, while a fast-evolving one like _NLRP1_ returns orthologs for
only part of it. Genes annotated with an Ensembl identifier and no symbol fall
through to the BLAST tab.

## The structure view on the same menu

**Launch protein view**, the protein3d item on the same right-click menu, opens
a dialog whose **Launch 3D protein structure view** renders the AlphaFold model
of the same protein, mapped back to the genome the way the alignment is.

That dialog has two more options here than it would on a site running protein3d
alone: it checks whether msaview is loaded, and offers **Launch MSA view** and
**Launch 3D structure + MSA view** when it is, for a protein AlphaFold also
publishes its input alignment for. Both build an MSA view from that alignment
rather than from orthologs. The first carries the same name as the right-click
launcher this page opened with and does something different, so read the
description under it, which is where the a3m is named.

The two alignments answer different questions. The ortholog panel is one row per
named species, which is what makes a present-or-absent domain call readable
across the tree. AlphaFold's is the deep unlabelled alignment its own pipeline
folded from, so it shows what the structure prediction had to work with, and it
is a much larger download.

Both views map a genomic position to a residue the same way, described under
[](/docs/tutorials/protein_structure#how-positions-are-mapped).

## See also

- [](/docs/tutorials/protein_structure)
- [](/docs/tutorials/genomes_basics), navigating the same site and opening its
  tracks
- [](/docs/tutorials/genomes_synteny)
- [](/docs/user_guides/gene_track)
- [](/docs/user_guides/plugin_store)
- [Ortholog search on genomes.jbrowse.org](https://genomes.jbrowse.org/orthologs),
  the same NCBI lookup as a gene-first web page rather than a right-click
- [JBrowseMSA](https://gmod.org/JBrowseMSA/)

## References

- [NCBI Datasets gene orthologs](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/reference-docs/rest-api/)
- [NCBI Conserved Domain Database](https://www.ncbi.nlm.nih.gov/Structure/cdd/cdd.shtml)
- [AlphaFold DB](https://alphafold.ebi.ac.uk/)
- Broz P, Dixit VM. Inflammasomes: mechanism of assembly, regulation and
  signalling. _Nat Rev Immunol_ 2016.
