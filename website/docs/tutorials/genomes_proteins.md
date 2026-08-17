---
title: Proteins on genomes.jbrowse.org
sidebar_label: genomes.jbrowse.org (proteins)
description:
  Take any gene to its AlphaFold structure and its cross-species protein MSA,
  launched from the genome view and linked back to it
guide_category: Tutorials
tutorial_category: genomes.jbrowse.org
data: hosted
---

**TL;DR:** genomes.jbrowse.org loads the protein3d and msaview plugins, so any
gene in a linear genome view can be taken to a 3D structure or to a
cross-species protein MSA with nothing prepared beforehand. Both views stay
linked to the genome, so hovering a variant highlights the residue it lands on.

## Prerequisites

- nothing to install: this is a click-path through hosted sites, and no
  sequence, structure, alignment or tree is prepared by hand
- to add these views to your own JBrowse instead, see
  [Adding the plugins to your own instance](#adding-the-plugins-to-your-own-instance)

## Two ways in

Two hosted sites reach the same three linked views, and they suit different
starting points.

[genomes.jbrowse.org](https://genomes.jbrowse.org) is the one to take when you
are already looking at a genome. It hosts a JBrowse instance for every UCSC
genome, each carrying that genome's UCSC track catalog, and each loading both
protein plugins. Search a gene, right-click it, and the two launchers are in the
menu. It works on any gene in any of those genomes, which is why the rest of
this page walks that route.

The [JBrowseMSA Gene Explorer](https://gmod.org/JBrowseMSA/gene-explorer/) is
the one to take when the gene is what you have. Pick a species, type a gene
symbol, and **Open in JBrowse** opens a session with all three views already
built and connected. It takes a `gene` and a `taxon` in its own URL, so
[?gene=TP53&taxon=9606](https://gmod.org/JBrowseMSA/gene-explorer/?gene=TP53&taxon=9606)
arrives with the gene resolved and one button left to press.

The Gene Explorer's session differs from the click-path below in two ways worth
knowing before you pick one. Its genome view collapses the introns, so the
coding exons sit side by side and the whole CDS is on screen at residue zoom.
And its catalog is seven species: human genes arrive with all three views, while
mouse, zebrafish, fly, worm, plant and yeast arrive as a genome view and a
structure. The right-click route works on every genome the site hosts.

<Video src="/media/proteins/gene_explorer.mp4" caption="TP53 from the Gene Explorer's examples row: the session it builds opens the collapsed coding exons, the vertebrate alignment and the AlphaFold model in one window, and a hover in the genome answers in all three at once." />

The three views are connected in every direction, so a hover in the alignment or
a click on the structure highlights the codon it belongs to back in the genome.

## Launching a structure

Open [hg38 on genomes.jbrowse.org](https://genomes.jbrowse.org) and type `TP53`
into the location box. The hosted config ships a name index, so gene symbols
work with no setup.

Right-click the gene. The menu carries one launcher from each plugin: **Launch
protein view** from protein3d, and **Launch MSA view** from msaview, which
[the next section](#launching-an-msa) takes. Choose **Launch protein view**.

The dialog opens on its **AlphaFoldDB search** tab with **Auto-detect using
UniProt ID mapping API** selected, and fills itself in from the transcript you
clicked: it maps the transcript's accession to UniProt entries, lists what it
found, and picks the reviewed one. Below that, **Choose transcript isoform**
picks which transcript becomes the query, tagging the isoforms whose translation
matches the structure's own residues. **Launch** renders the structure with
[Mol\*](https://molstar.org/).

The structure the dialog resolves carries its own sequence, and it is often not
the translation of the transcript you clicked: an AlphaFold model covers one
UniProt isoform, and a PDB entry can be a construct, a fragment or another
species. When the two differ the dialog says so and aligns them in the browser
before mapping any position. The gear beside that notice opens **Alignment
settings**, which switches between **Smith-Waterman (local alignment)**, the
default and the one to keep for a structure covering part of the protein, and
**Needleman-Wunsch (global alignment)**; **Import manual alignment...** takes a
pairwise alignment in Clustal format instead. The same options sit under
**Advanced...** in the view menu afterwards.

<Video src="/media/proteins/genomes_protein_launch.mp4" caption="TP53 on the hosted hg38 with NCBI RefSeq and ClinVar loaded: the right-click launcher, the dialog resolving a UniProt entry and an isoform, and the structure Launch renders. Hovering a coding position afterwards picks out its residue on the structure and in the alignment above it; the intron between the two exons picks out nothing." />

The structure arrives with the genome view still above it, and the two are
connected. Hovering a genomic position highlights the matching residue on the
structure, on the pairwise alignment above it, and in the per-residue tracks
beside them; hovering the structure highlights the genomic position. That is
what makes a variant track worth having in the same session: the residue a
variant lands on is a click away from the variant itself.

Both views map a genomic position to a residue through the transcript's CDS with
[g2p_mapper](https://github.com/cmdcolin/g2p_mapper), so a hover highlights
nothing when the position has no residue to land on. Introns and UTRs have none,
and neither does a residue the structure is missing, which shows up as a gap in
the **Pairwise alignment** panel below the structure. That panel shows the
transcript row against the structure row with a consensus line, so it is where
to check a mapping before trusting a highlight. For exact correspondence, fold
the transcript's own sequence with AlphaFold instead of taking a database
structure.

The lookup needs a gene feature carrying a recognizable protein or transcript
ID. The RefSeq gene tracks on the hosted configs have them, so a feature track
without such IDs will not resolve a structure.

The protein view carries the AlphaFold structure, the genome-to-structure
sequence alignment, and per-residue tracks for pLDDT confidence, domains,
helices and hydrophobicity. The gear beside the dialog's **Launch** button opens
**Launch settings**, whose side-by-side option puts the protein view beside the
genome view rather than under it.

<Figure caption="A connected session on human TP53 (UniProt P04637). Hovering a variant in the genome view highlights the matching residue on the structure." src="/img/protein/connected.png" />

### The other things that dialog launches

The arrow beside **Launch** opens everything the dialog can build: the 3D
structure that **Launch** itself renders, and three others.

**Launch 1D protein annotation view** opens a linear genome view whose genome is
the protein. The plugin registers the UniProt accession as a temporary assembly
whose reference sequence is the amino-acid sequence, then turns on one track per
UniProt feature type over it, plus Antigen, Variation, AlphaFold confidence
(pLDDT) and AlphaMissense scores. Coordinates are residues, so this is the view
to take when the question is where along the chain something falls. It needs a
session it can add tracks to, which is why it does not appear in the single-view
embedded components.

The two MSA destinations appear when msaview is loaded in the same session, and
both build their alignment from the one AlphaFold's own pipeline folded from,
which is deep, unlabelled by species, and a much larger download than the
ortholog panel below. One opens the alignment alone, the other opens it beside
the structure.

The dialog's other two tabs take a structure from somewhere else: **Foldseek
search** finds structures resembling the protein's own, and **Open file
manually** takes a PDB or mmCIF file of yours.

## Launching an MSA

**Launch MSA view**, the msaview item on the same right-click menu, builds a
cross-species protein MSA. The dialog opens on its **Orthologs (fast)** tab, and
three fields on it matter:

- **Query species** is the species the gene came from. It is free text resolved
  against NCBI's taxonomy, so a scientific name, a common name or a taxon id all
  work.
- **Rows to align** is how many species to build. NCBI orders its ortholog
  report from the reference organisms outward, so this takes the closest N of
  however many that gene has.
- **Choose isoform** picks which transcript becomes the query row. That row is
  the one the genome view stays linked to, so hovering the alignment highlights
  the matching codons back in the linear view.

**MSA Algorithm** is what EBI is asked to run, Clustal Omega by default, and is
the step the wait is actually in. What it costs scales with the row count, so
**Rows to align** is the dial between a deeper panel and a shorter wait.

NCBI publishes one ortholog gene per species for most annotated genes, so this
tab looks up what this gene is in each species. The lookup returns immediately,
which leaves the multiple alignment as the only step that takes real time. For a
gene with no resolvable symbol there is nothing to look up, and the dialog's
**NCBI BLAST query** tab is the route to take instead.

Press **Submit**. A multiple sequence alignment view opens below the genome
view, with a tree on the left, the alignment beside it, and the conserved-domain
overlay drawn over the residues once NCBI returns it.

The view opens at residue zoom, which on a long protein is a window on its N
terminus. **Fit horizontally**, under the toolbar's fit and zoom button, puts
the whole alignment on screen, which is the zoom the domain blocks read at.

The figures below take _NLRP1_ rather than _TP53_, because the overlay only says
something when the rows differ, and _NLRP1_ is an inflammasome sensor whose
domain architecture is not the same in every mammal.

<Figure src="/img/genomes_msa/launch_sequence.png" caption="The whole path on NLRP1: the right-click menu, the Launch MSA view dialog on its Orthologs tab, and the alignment Submit builds. The pyrin block is on the great apes and the marmoset and on no other row." />

### Reading the overlay

Each colored block is an NCBI conserved domain, drawn in alignment columns
rather than at each protein's own residue positions. That is what makes the rows
comparable: the same domain lands in the same column in every row that has it,
however different the proteins are in length.

Human _NLRP1_ carries a pyrin (PYD) death-fold domain at its N terminus. Some
rows have it and some do not, mouse _Nlrp1a_ among those that do not, so the
overlay reads as a block on the left that comes and goes down the panel against
a stack to the right of it that every row shares. Because the aligner's tree
orders the rows, the rows that have it sit together, and the pattern reads as
clades rather than as a scatter.

The shared core is the control. NACHT, the winged helix, HD2, FIIND and CARD run
across every row, so a missing block on the left only means something because
the blocks around it agree.

The calls ride along on NCBI's own protein records, so they arrive with the
sequences and cost no extra step. For a protein NCBI has no calls for, the view
menu offers **Open domains...** to read them from a file and **Query
InterProScan for domains...** to compute them.

### Checking it against the raw alignment

A whole-protein view cannot tell "no domain annotated" from "no sequence", so
read the residues. The zoom the view opened at is already the right one: scroll
back to it, or use the alignment's **Zoom in** button until the letters return.

An alignment is as long as its longest row, so its leftmost columns belong to
whichever protein reaches furthest past the others, which on a panel this wide
is one or two rows' private N-terminal extensions. **Hide columns w/ >N% gaps**,
the slider in the alignment's toolbar, brings the columns the panel shares (the
pyrin among them) to the left edge.

The rows without a pyrin block are not all the same. Some carry ordinary
residues under those columns with nothing called over them, which is a different
statement from the sequence being absent; some carry a generic death-domain call
instead of the pyrin-specific one; and some are gap right across the frame,
because their rows begin further right in the alignment. Only the third is an
absent sequence, and at whole-protein zoom all three looked alike.

<Figure src="/img/genomes_msa/pyrin_residues.png" caption="NLRP1 orthologs at the residue zoom the view opens on, with the gappiest columns hidden. Under the pyrin columns some rows carry residues with no call over them and others are gap." />

### The same domains in genome coordinates

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

### Trying other genes

The same click-path works on any gene in the view whose symbol NCBI recognises.
What changes between genes is how far down the tree the panel reaches, and the
tree on the left is where you read it. Every _NLRP1_ ortholog NCBI has is a
mammal, so the panel stops at mammals however high **Rows to align** is set,
while the same click-path on _CFTR_ reaches birds, amphibians and fish. The rows
arrive grouped by clade rather than by the order they were fetched, because the
tree comes from the aligner. Genes annotated with an Ensembl identifier and no
symbol fall through to the BLAST tab.

## Where each MSA comes from

Three routes on this page open the same view type over three different MSAs, and
which one you want depends on what the rows are for.

| Route                                     | MSA                                                              | Rows                                |
| ----------------------------------------- | ---------------------------------------------------------------- | ----------------------------------- |
| **Launch MSA view** on the gene menu      | built per gene from NCBI's ortholog records, aligned at EBI      | one per species, named              |
| The Gene Explorer                         | UCSC's precomputed multiz alignment across a hundred vertebrates | one per species, named; human genes |
| **Launch MSA view** in the protein dialog | the input alignment AlphaFold folded from                        | deep, unlabelled                    |

The named panels are the ones to read a present-or-absent domain call across,
since a row means a species. AlphaFold's is the one to read depth from, and it
is the largest download of the three.

## Sharing a connected view as a URL

A connected view can also be built declaratively as a session-spec URL, useful
for demo links and embedded apps. This session opens human TP53 as a connected
pair: the AlphaFold structure of UniProt P04637 beside a genome view of its
locus with NCBI RefSeq and ClinVar loaded.

```json live config=test_data/protein3d_config.json
{
  "views": [
    {
      "type": "ProteinView",
      "uniprotId": "P04637",
      "transcriptId": "NM_000546.6",
      "sideBySide": true,
      "connectedView": {
        "assembly": "hg38",
        "loc": "chr17:7,671,000-7,684,500",
        "tracks": ["hg38-ncbiRefSeq", "clinvar_ncbi_hg38"]
      }
    }
  ]
}
```

The fence above is the short form: a UniProt accession plus a transcript ID, and
the plugin derives the AlphaFold structure, finds the transcript in the
`connectedView` tracks at `loc`, and translates its CDS to align against the
structure. The explicit form takes a structure `url`, feature, and protein
sequence instead, for a transcript no loaded track serves. See the parameters
and further example URLs in the
[protein3d developer docs](https://github.com/GMOD/jbrowse-plugin-protein3d/blob/main/DEVELOPERS.md#connected-genome--protein-view).

A `ProteinView` with only a structure `url` and no `connectedView` opens as a
standalone structure: it renders and is interactive, but nothing maps its
residues to a genome, so no highlight is exchanged.

## Adding the plugins to your own instance

Both plugins are worth installing together rather than picking one: protein3d
checks at runtime whether msaview is loaded, and grows the two extra launch
options described above when it is.

- Open the [plugin store](/docs/user_guides/plugin_store) (Tools menu) and
  install **Protein3d** and **MSAView**, or
- As an admin, add them to your `config.json` so they load for all users (see
  [configuring plugins](/docs/config_guides/plugins))

Both plugins add view types launched from a gene's right-click menu in JBrowse
Web and Desktop. The single-view embedded components host only a linear genome
view, so neither view type appears there. The full-app embedded components can
host one in principle: [](/docs/jbrowser)'s `JBrowseRApp` takes both runtime
plugins and a `views` list, while [anywidget](/docs/jbrowse_anywidget)'s
`JBrowseApp` has no plugin loading yet.

The approach is described in
[_Proteins in the Genome Browser_](https://doi.org/10.1016/j.jmb.2026.169645)
(_Journal of Molecular Biology_, 2026).

## See also

- [](/docs/tutorials/genomes_basics)
- [](/docs/tutorials/genomes_synteny)
- [JBrowseMSA user guide](https://github.com/GMOD/JBrowseMSA/blob/main/docs/user_guide.md)
- [jbrowse-plugin-protein3d](https://github.com/GMOD/jbrowse-plugin-protein3d)
- [jbrowse-plugin-msaview](https://github.com/GMOD/jbrowse-plugin-msaview)
- [g2p_mapper](https://github.com/cmdcolin/g2p_mapper)

## References

- [AlphaFold DB](https://alphafold.ebi.ac.uk/)
- [UniProt](https://www.uniprot.org/)
- [NCBI Datasets gene orthologs](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/reference-docs/rest-api/)
- [NCBI Conserved Domain Database](https://www.ncbi.nlm.nih.gov/Structure/cdd/cdd.shtml)
- [Proteins in the Genome Browser](https://github.com/GMOD/proteinbrowser)
- Broz P, Dixit VM. Inflammasomes: mechanism of assembly, regulation and
  signalling. _Nat Rev Immunol_ 2016.
