---
title: Proteins on genomes.jbrowse.org
sidebar_label: genomes.jbrowse.org (proteins)
description:
  Type a gene into the protein browser and open its exons, its 3D structure and
  a protein alignment as one linked JBrowse session, then launch the same views
  from a gene's right-click menu
guide_category: Tutorials
tutorial_category: genomes.jbrowse.org
---

A missense variant changes one codon, and what it does depends on where that
residue sits in the folded protein and how conserved it is across related
proteins. The [protein browser](https://genomes.jbrowse.org/protein-browser/) on
genomes.jbrowse.org takes a gene symbol and opens the gene, its 3D structure and
an alignment of related proteins as one JBrowse session, linked so that a
residue picked in one view lights up in the other two. We'll:

- open _TP53_ in the protein browser on R248, a cancer hotspot, and read the
  session it launches
- change what the session opens on: a domain, a structure, a coloring
- launch the same views from a gene's right-click menu, where you choose the
  structure and the species to align, on _NLRP1_, whose domains differ between
  mammals

## Prerequisites

- for the right-click route in your own JBrowse, the protein3d and msaview
  plugins from the plugin store
  ([Adding the plugins to your own instance](#adding-the-plugins-to-your-own-instance));
  genomes.jbrowse.org already loads them

## Where the data comes from

Nothing to download: the protein browser and the two plugins fetch from these
services, per gene, when you open a session.

<details>
<summary>The files</summary>

- AlphaFold DB, the predicted structures: https://alphafold.ebi.ac.uk/
- PDBe, the experimental structures: https://www.ebi.ac.uk/pdbe/
- UniProt, the protein each gene encodes and the projected Domains, Chains,
  Mutations and AA Modifications tracks: https://www.uniprot.org/
- InterPro, the protein browser's domain map and the Pfam seed alignments:
  https://www.ebi.ac.uk/interpro/
- PDBe-KB, the protein browser's partner and ligand lists:
  https://www.ebi.ac.uk/pdbe/pdbe-kb/
- UniRef, the cluster a protein with no NCBI orthologs is aligned with:
  https://www.uniprot.org/help/uniref
- NCBI's ortholog report, the rows of an ortholog alignment:
  https://www.ncbi.nlm.nih.gov/datasets/docs/v2/reference-docs/rest-api/
- NCBI's Conserved Domain Database, the alignment's domain overlay:
  https://www.ncbi.nlm.nih.gov/Structure/cdd/cdd.shtml

</details>

## Opening TP53 in the protein browser

We'll start on _TP53_'s R248, one of the residues most often mutated in human
cancer, where the protein contacts DNA. Open the
[protein browser](https://genomes.jbrowse.org/protein-browser/) and click the
**TP53** chip, which focuses the page on that residue:

- The page draws the protein end to end with its InterPro domains, marks R248 on
  the ruler, and shows the focus beside the launch button as **Opens at Cancer
  hotspot R248**.
- Tick **Advanced**. The **Structure** box shows the entry the chip picked,
  3KMD, the DNA-binding core of p53 bound to DNA.
- Set **Color** to **AlphaMissense pathogenicity**, which paints each residue by
  how damaging AlphaMissense predicts a substitution there to be.
- Click **Open in JBrowse ↗**.

Typing a gene into the search box and pressing **Search** opens the same card
with no focus. Advanced also adds a species box, which takes any species name or
NCBI taxon ID whose genome genomes.jbrowse.org hosts with NCBI gene annotation,
and the chips after **TP53** open other organisms on a residue each, such as
rifampicin resistance in _M. tuberculosis_ _rpoB_.

<Figure caption="The protein browser on the TP53 chip with Advanced ticked: the structure the chip picked and the AlphaMissense coloring above the launch button, and the protein map below it, with R248 on the ruler inside the DNA-binding domain and a line under the map saying what is known at that residue." src="/img/protein/protein_browser_page.png" />

## Reading the TP53 session

Open in JBrowse opens a new tab with one session and three views of the same
transcript:

- **The gene**, its coding exons back to back with the introns cut out, read 5′
  to 3′, above ClinVar's variants and AlphaMissense's scores
- **The alignment**, the seed alignment of the Pfam family R248 falls in, P53,
  opened on the columns around R248 with _TP53_'s own row, linked to the gene,
  in the middle. The launch button's tooltip names the alignment before you
  click.
- **The structure**, 3KMD in [Mol\*](https://molstar.org/), with R248 selected

Hover a codon in the gene view and its residue lights up on the structure and
its column in the alignment; hover the structure or the alignment and the codon
lights up in turn. [g2p_mapper](https://github.com/cmdcolin/g2p_mapper) maps
each position through the transcript's coding sequence, so introns, UTRs and
residues the structure does not cover highlight nothing.

<Figure caption="TP53 as the protein browser launches it on R248: the coding exons above ClinVar and AlphaMissense, the P53 family's Pfam seed alignment under them, opened on R248's column with TP53's row in the middle, beside the fish p53s and human p73, and an arginine down nearly every row, and 3KMD beside, four copies of the DNA-binding core on DNA, colored by AlphaMissense. The cores are red and their outer loops pale. R248 is magenta in each copy where it reaches into the DNA, and a line through its codon in the genome view." src="/img/protein/protein_browser_tp53.png" />

## Changing what the TP53 session opens on

The page picks the session's alignment and structure from the focus beside the
launch button. Click **Clear** to drop it, and choose another:

- **A domain**: click a block on the map's Domains row. The session opens on the
  domain, with the seed alignment of its Pfam family.
- **A residue**: type a position into the **Residue** box, which Advanced shows
  while nothing is focused. The alignment becomes the Pfam seed of the domain
  the residue falls in, and the structure the PDB entry in which that residue
  was seen touching DNA, a small molecule or another protein, else the AlphaFold
  model.
- **A partner or a ligand**: under Advanced, click **Partners…** or **Ligands…**
  on the map to list the proteins and small molecules PDB entries show touching
  this one. Clicking one opens the complex they were seen in.
- **A truncation**: under a focused residue, **More about residue** offers to
  open on the residues a stop codon there, or skipping its exon, would remove.
- **Nothing**: the session opens on the whole gene, the AlphaFold model and an
  alignment of the gene's orthologs from NCBI, one per species, built in the
  browser when the session opens. NCBI lists orthologs for vertebrates and
  insects; any other protein gets its UniRef50 cluster instead.

**Structure** under Advanced overrides the pick with any AlphaFold or PDB entry,
and **Color** also offers ClinVar pathogenic variants and, on an AlphaFold
model, AlphaFold confidence (pLDDT). The page URL holds the gene, the focus and
the structure, so
[?gene=TP53&ref=9606&residue=248&structure=3kmd](https://genomes.jbrowse.org/protein-browser/?gene=TP53&ref=9606&residue=248&structure=3kmd)
reopens this launch.

## Launching from the gene's right-click menu

The protein browser picks the structure and the alignment for you. A gene's
right-click menu, in any JBrowse with the protein3d and msaview plugins, lets
you pick both, and starts from a gene already on screen.

Open [hg38 on genomes.jbrowse.org](https://genomes.jbrowse.org), type `TP53`
into the location box, and right-click the gene. The menu has **Launch protein
view** from protein3d and **Launch MSA view** from msaview. Choose **Launch
protein view**.

The dialog opens on its **AlphaFoldDB search** tab:

- **Look up from the feature's identifiers** (selected) maps the transcript's
  accession to UniProt entries and picks the reviewed one.
- **Choose transcript isoform** opens on the isoform you right-clicked, picks
  which transcript becomes the query, and tags the isoforms whose translation
  matches the structure's residues.
- **Launch** renders the structure.

<Video src="/media/proteins/genomes_protein_launch.mp4" caption="TP53 on the hosted hg38 with NCBI RefSeq and ClinVar loaded: the right-click launcher, the dialog resolving a UniProt entry and an isoform, and the structure Launch renders. Hovering a coding position afterwards picks out its residue on the structure and in the alignment above it; the intron between the two exons picks out nothing." />

The structure opens under the genome view, linked the same way as the protein
browser's. Where its sequence differs from the transcript's translation, the
**Pairwise alignment** panel shows each residue the structure lacks as a gap,
and **Import manual alignment...** in the view menu takes a pairwise alignment
of your own in Clustal format instead. The lookup needs a gene feature with a
recognizable protein or transcript ID, which the RefSeq gene tracks on the
hosted configs have.

The protein view also has per-residue tracks for pLDDT, domains, helices and
hydrophobicity. **Open side by side**, at the foot of the list the arrow beside
the dialog's **Launch** button opens, puts the protein view beside the genome
view. Click the nuclear export signal on the alignment panel's **Motif** row to
select its residues and band their codons on the gene.

<Figure caption="A connected session on human TP53 (UniProt P04637), NCBI RefSeq above the AlphaFold structure. A motif clicked on the protein's feature track selects its residues on the structure and bands the codons they came from on the gene." src="/img/protein/connected.png" />

### Other structure sources and views in the Launch dialog

The dialog's other tabs take a structure from elsewhere:

- **PDB search** lists the experimental structures PDBe maps to the protein's
  UniProt entry
- **Foldseek search** finds structures similar to the protein's
- **File or URL** takes a PDB or mmCIF file of yours

Click the arrow beside **Launch** to list everything the dialog can build.
**Launch 1D protein annotation view** opens a linear genome view whose genome is
the protein: the plugin registers the UniProt accession as a temporary assembly
with the amino-acid sequence as its reference, so coordinates are residues. The
view has a track per UniProt feature type, plus Antigen, Variation, AlphaFold
confidence (pLDDT) and AlphaMissense scores. None is on at first, so turn them
on in the track selector under **Session tracks**.

<Figure src="/img/protein/annotation_1d.png" caption="TP53 on hg38 above the 1D protein view its gene menu launched, with four of the session tracks turned on: the DNA binding call, UniProt natural variants, AlphaFold pLDDT and AlphaMissense substitution scores, all in residue coordinates. Confidence and variant density both fall away over the terminal tails." />

<Video src="/media/proteins/annotation_1d.mp4" caption="TP53's launch dialog opened on the arrow beside Launch, then the 1D annotation view." />

Launch an alignment from the same right-click menu too, and each panel's menu
has **Arrange all views → Side by side**, which puts the genome, alignment and
structure in three columns.

<Video src="/media/proteins/tiled_views.mp4" caption="TP53's gene menu launching both an alignment and a structure, then Arrange all views → Side by side arranging the genome, the alignment and the structure in three columns. One hover in the genome moves the highlighted column in the alignment and the highlighted residue on the structure together." />

## Choosing the species to align for NLRP1

**Launch MSA view** builds an alignment from the orthologs NCBI publishes for
most annotated genes, one per species, with the rows and the aligner yours to
choose. We'll use _NLRP1_, an inflammasome sensor whose domain architecture
varies between mammals. Type `NLRP1` into the location box, right-click the gene
and choose **Launch MSA view**. The dialog opens on its **Orthologs** tab:

- **Query species** is the species the gene came from, free text resolved
  against NCBI's taxonomy: a scientific name, a common name or a taxon id
- **Rows to align** is how many species to build. NCBI orders its ortholog
  report from the reference organisms outward, so this takes the closest N
- **Choose isoform** picks which transcript becomes the query row, the one the
  genome view stays linked to
- **MSA Algorithm** sets which aligner EBI runs, Clustal Omega by default
- **BLAST query**, a separate tab, takes a gene with no resolvable symbol

Press **Submit**. The alignment opens below the genome view, with a tree on the
left and NCBI's conserved domains drawn over the residues once NCBI returns
them. It opens at residue zoom on the N terminus; **Fit horizontally**, under
the toolbar's fit and zoom button, puts the whole alignment on screen, which is
the zoom the domain blocks read at.

<Figure src="/img/genomes_msa/launch_sequence.png" caption="The whole path on NLRP1: the right-click menu, the Launch MSA view dialog on its Orthologs tab, and the alignment Submit builds. In the alignment, the leftmost block is present in some rows and absent in others, the stack of blocks to its right runs down nearly all rows, and the whale rows have only the stack's right-hand end." />

### Reading NLRP1's conserved-domain overlay on the MSA

Each colored block is an NCBI conserved domain, drawn in alignment columns. The
pyrin (PYD) domain sits at the N terminus of human _NLRP1_ and is absent from
mouse _Nlrp1a_. NACHT, the winged helix, HD2, FIIND and CARD run across nearly
every row and are the control; the whale rows have only the C-terminal end.

The domain calls come from NCBI's protein records. For a protein NCBI has no
calls for:

- `react-msaview-cli interproscan` scans the sequences into a domain file.
- **File → Open annotation file...** reads that file in. The dialog's _How to
  make one_ link opens a
  [walkthrough](https://gmod.org/JBrowseMSA/tutorials/protein_family) that also
  covers `interpro`, the instant path when the rows are UniProt accessions.

### UniProt domains in genome coordinates for NLRP1

UCSC projects UniProt's annotations onto the genome, so the hosted config holds
them as tracks. Turn on **UniProt - Domains** (under Genes and Gene Predictions)
in the linear view you launched from, then narrow it to one record:

- **Filter by...** in the track menu applies the row `uniProtId` is `Q9C000`,
  the gene's reviewed UniProt entry. Without it, the track draws a domain once
  per isoform, and isoforms sharing exons overlap.
- **UniProt - Chains**, **Mutations** and **AA Modifications** project the rest
  of the record.

<Figure src="/img/genomes_msa/genomic_domains.png" caption="NLRP1 with NCBI RefSeq above UniProt - Domains, filtered to the gene's reviewed UniProt entry. Pyrin sits at the right-hand end, where the N terminus is, and NACHT, FIIND and CARD run leftward from it." />

## Adding the plugins to your own instance

The plugin store lists the two plugins as **Protein3d** and **MSAView**, and
[](/docs/user_guides/plugin_store) covers each way to install them.

The protein3d and msaview plugins add view types launched from a gene's
right-click menu in JBrowse Web and Desktop. The single-view embedded components
host only a linear genome view, so neither view type appears there.
[](/docs/jbrowser)'s `JBrowseRApp` takes both runtime plugins and a `views`
list, while [anywidget](/docs/jbrowse_anywidget)'s `JBrowseApp` has no plugin
loading yet.[^session]

The approach is described in
[_Proteins in the Genome Browser_](https://doi.org/10.1016/j.jmb.2026.169645)
(_Journal of Molecular Biology_, 2026).

## See also

- [](/docs/tutorials/genomes_basics)
- [](/docs/tutorials/genomes_synteny)
- [](/docs/tutorials/tp53_structures)
- [](/docs/tutorials/sickle_cell_variant)

## External links

- [Protein browser](https://genomes.jbrowse.org/protein-browser/)
- [JBrowseMSA user guide](https://github.com/GMOD/JBrowseMSA/blob/main/docs/user_guide.md)
- [jbrowse-plugin-protein3d](https://github.com/GMOD/jbrowse-plugin-protein3d)
- [jbrowse-plugin-msaview](https://github.com/GMOD/jbrowse-plugin-msaview)
- [g2p_mapper](https://github.com/cmdcolin/g2p_mapper)
- [AlphaFold DB](https://alphafold.ebi.ac.uk/)
- [UniProt](https://www.uniprot.org/)
- [InterPro](https://www.ebi.ac.uk/interpro/)
- [NCBI Datasets gene orthologs](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/reference-docs/rest-api/)
- [NCBI Conserved Domain Database](https://www.ncbi.nlm.nih.gov/Structure/cdd/cdd.shtml)
- [Proteins in the Genome Browser](https://github.com/GMOD/proteinbrowser)

## Citations

- Broz P, Dixit VM. Inflammasomes: mechanism of assembly, regulation and
  signalling. _Nat Rev Immunol_ 2016.

[^session]:
    A `ProteinView` entry in a session-spec URL opens a connected view for demo
    links and embedded apps. The short form takes `uniprotId`, `transcriptId`
    and a `connectedView` with the `assembly`, `loc` and `tracks` to look the
    transcript up in; the plugin derives the AlphaFold structure and translates
    the transcript's CDS. The explicit form takes a structure `url`, feature and
    protein sequence, for a transcript no loaded track serves. A `ProteinView`
    with only a `url` opens as a standalone structure. The protein3d
    [launching guide](https://github.com/GMOD/jbrowse-plugin-protein3d/blob/main/docs/launching.md#a-structure-connected-to-the-genome)
    has both forms.
