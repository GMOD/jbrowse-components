---
title: Protein alignments on genomes.jbrowse.org
description:
  Right-click a gene and build a cross-species protein alignment from NCBI's
  precomputed orthologs, with conserved domains overlaid
guide_category: Tutorials
tutorial_category: Transcriptomics & proteins
---

**TL;DR:** genomes.jbrowse.org loads the MSA plugin, so any gene in a linear
genome view can be turned into a cross-species protein alignment without
preparing anything. The alignment is built from NCBI's precomputed orthologs
rather than from a similarity search, so there is no job to queue, its rows are
labelled by species, and NCBI's conserved-domain annotations are drawn on top of
it.

## Prerequisites

- nothing to install: this is a click-path through a hosted site, and no
  sequence, alignment or tree is prepared by hand

## Orthologs, not a search

A similarity search answers "what looks like this sequence". An alignment wants
a different answer: "what is this gene in each species". Those are not the same
question, and the second one has already been computed. NCBI publishes one
ortholog gene per species for most annotated genes, so the plugin looks the
answer up instead of submitting a job.

The practical difference is the wait. A lookup returns immediately, so the only
step that costs real time is the multiple alignment itself. A `blastp`
submission has to queue and run before an alignment can even start.

The BLAST tab is still there, and it is the right tab when a gene has no
resolvable symbol, which is the case a search handles and a lookup cannot.

## Opening the gene

Open [hg38 on genomes.jbrowse.org](https://genomes.jbrowse.org) and type `NLRP1`
into the location box. The hosted config ships a name index, so gene symbols
work with no setup.

_NLRP1_ is an inflammasome sensor. It is a good first gene here because its
domain architecture is not the same in every mammal, which is what the overlay
is for.

## Launching the alignment

Right-click the gene and choose **Launch MSA view**. The dialog opens on the
**Orthologs (fast)** tab.

Three things on that tab matter:

- **Query species** is the species the gene came from, human here.
- **Species to include** is the panel of rows to build. Species with no ortholog
  for this gene are skipped rather than erroring, so leaving them all ticked
  costs nothing.
- The **isoform** selector picks which transcript becomes the query row. That
  row is the one the genome view stays linked to, so hovering the alignment
  highlights the matching codons back in the linear view.

Press **Submit**. A multiple sequence alignment view opens below the genome
view, with a tree on the left, the alignment beside it, and the conserved-domain
overlay drawn over the residues once NCBI returns it.

<Figure src="/img/genomes_msa/launch_sequence.png" caption="The whole path on NLRP1: the right-click menu, the Launch MSA view dialog on its Orthologs tab, and the alignment that Submit builds, with NCBI conserved domains overlaid." />

## Reading the overlay

Each colored block is an NCBI conserved domain, drawn in alignment columns
rather than at each protein's own residue positions. That is what makes the rows
comparable: the same domain lands in the same column in every row that has it,
however different the proteins are in length.

Human _NLRP1_ carries a pyrin (PYD) death-fold domain at its N terminus. Mouse
_Nlrp1a_ does not. Everything after it is shared, so the overlay reads as one
missing block on the left and a matching stack of blocks to the right of it.

## The control

The shared core is the control. NACHT, the winged helix, HD2, FIIND and CARD are
present in every row, so they have to line up in the same columns. If they did
not, the alignment would be wrong and nothing else on the page would be worth
reading. A missing block only means something because the blocks around it
agree.

## Checking it against the raw alignment

A whole-protein view cannot tell "no domain annotated" from "no sequence", so
read the residues. Use the alignment's **Zoom in** button on the columns under
the pyrin block until the letters are legible.

The rows without a pyrin domain are not empty there. Several of them carry
ordinary sequence in those columns with no domain called over it, which is a
different statement from the sequence being absent. Only some rows are gap.

## Trying other genes

The same click-path works on any gene in the view whose symbol NCBI recognises.
What changes between genes is how many species come back: a conserved gene fills
the whole panel, while a fast-evolving one like _NLRP1_ returns orthologs for
only part of it. Genes annotated with an Ensembl identifier and no symbol fall
through to the BLAST tab.

## See also

- [Synteny on genomes.jbrowse.org](/docs/tutorials/genomes_synteny) for the
  other hosted click-path on the same site
- [](/docs/user_guides/gene_track)
- [](/docs/user_guides/plugin_store)
- [react-msaview](https://gmod.org/JBrowseMSA/), the viewer this plugin embeds

## References

- [NCBI Datasets gene orthologs](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/reference-docs/rest-api/)
- [NCBI Conserved Domain Database](https://www.ncbi.nlm.nih.gov/Structure/cdd/cdd.shtml)
- Broz P, Dixit VM. Inflammasomes: mechanism of assembly, regulation and
  signalling. _Nat Rev Immunol_ 2016.
