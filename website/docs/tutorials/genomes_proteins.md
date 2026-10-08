---
title: Proteins on genomes.jbrowse.org
sidebar_label: genomes.jbrowse.org (proteins)
description:
  Take any gene to its AlphaFold structure and its cross-species protein MSA,
  launched from the genome view and linked back to it
guide_category: Tutorials
tutorial_category: genomes.jbrowse.org
---

genomes.jbrowse.org loads the protein3d and msaview plugins, so you can open any
gene in a linear genome view as a 3D structure or as a cross-species protein
MSA. Both views stay linked to the genome, so hovering a variant highlights the
residue it lands on. We open _TP53_ as an AlphaFold structure and _NLRP1_ as an
MSA, then read the MSA's domains back on the genome.

## Where the data comes from

The hosted hg38 config on genomes.jbrowse.org has the gene track the examples
below launch from. The protein3d and msaview plugins fetch everything else live,
per gene, from the services listed here.

Nothing to download: the plugins fetch from these services when you launch a
structure or an alignment.

<details>
<summary>The files</summary>

- AlphaFold DB, where a launched structure comes from:
  https://alphafold.ebi.ac.uk/
- UniProt, the isoform mapping and the projected Domains, Chains, Mutations and
  AA Modifications tracks: https://www.uniprot.org/
- NCBI's ortholog report, the MSA's rows:
  https://www.ncbi.nlm.nih.gov/datasets/docs/v2/reference-docs/rest-api/
- NCBI's Conserved Domain Database, the alignment's overlay:
  https://www.ncbi.nlm.nih.gov/Structure/cdd/cdd.shtml

</details>

## Launching a structure

Open [hg38 on genomes.jbrowse.org](https://genomes.jbrowse.org) and type `TP53`
into the location box. The hosted config ships a name index, so gene symbols
resolve.[^explorer]

Right-click the gene. The menu has **Launch protein view** from protein3d and
**Launch MSA view** from msaview, which [the next section](#launching-an-msa)
covers. Choose **Launch protein view**.

The dialog opens on its **AlphaFoldDB search** tab:

- **Look up from the feature's identifiers** (selected) maps the transcript's
  accession to UniProt entries and picks the reviewed one.
- **Choose transcript isoform** opens on the isoform you right-clicked, picks
  which transcript becomes the query, and tags the isoforms whose translation
  matches the structure's residues.
- **Launch** renders the structure with [Mol\*](https://molstar.org/).

When a structure's sequence differs from the transcript's translation, the
dialog aligns them in the browser. **Import manual alignment...** in the view
menu takes a pairwise alignment of your own in Clustal format instead.

<Video src="/media/proteins/genomes_protein_launch.mp4" caption="TP53 on the hosted hg38 with NCBI RefSeq and ClinVar loaded: the right-click launcher, the dialog resolving a UniProt entry and an isoform, and the structure Launch renders. Hovering a coding position afterwards picks out its residue on the structure and in the alignment above it; the intron between the two exons picks out nothing." />

The structure opens with the genome view still above it. Hovering a genomic
position highlights the matching residue on the structure, on the pairwise
alignment above it and in the per-residue tracks, and hovering the structure
highlights the genomic position.
[g2p_mapper](https://github.com/cmdcolin/g2p_mapper) maps a position to a
residue through the transcript's CDS, so introns, UTRs and residues missing from
the structure highlight nothing. Each missing residue shows as a gap in the
**Pairwise alignment** panel. The lookup needs a gene feature with a
recognizable protein or transcript ID, which the RefSeq gene tracks on the
hosted configs have.

The protein view also has per-residue tracks for pLDDT (AlphaFold's confidence),
domains, helices and hydrophobicity. **Open side by side**, at the foot of the
list the arrow beside the dialog's **Launch** button opens, puts the protein
view beside the genome view. Click the nuclear export signal on the alignment
panel's **Motif** row to select its residues and band their codons on the gene.

<Figure caption="A connected session on human TP53 (UniProt P04637), NCBI RefSeq above the AlphaFold structure. A motif clicked on the protein's feature track selects its residues on the structure and bands the codons they came from on the gene." src="/img/protein/connected.png" />

### Other views and structure sources in the Launch dialog

The arrow beside **Launch** lists everything the dialog can build. **Launch 1D
protein annotation view** opens a linear genome view whose genome is the
protein: the plugin registers the UniProt accession as a temporary assembly with
the amino-acid sequence as its reference, so coordinates are residues. It adds a
track per UniProt feature type, plus Antigen, Variation, AlphaFold confidence
(pLDDT) and AlphaMissense (variant effect) scores. The view opens with none of
them on; find them in the track selector under **Session tracks**.

<Figure src="/img/protein/annotation_1d.png" caption="TP53 on hg38 above the 1D protein view its gene menu launched, with four of the session tracks turned on: the DNA binding call, UniProt natural variants, AlphaFold pLDDT and AlphaMissense substitution scores, all in residue coordinates. Confidence and variant density both fall away over the terminal tails." />

<Video src="/media/proteins/annotation_1d.mp4" caption="TP53's launch dialog opened on the arrow beside Launch, then the 1D annotation view." />

The dialog's other tabs take a structure from elsewhere:

- **PDB search** lists the experimental structures PDBe maps to the protein's
  UniProt entry
- **Foldseek search** finds structures similar to the protein's
- **File or URL** takes a PDB or mmCIF file of yours

## Launching an MSA

On the gene's right-click menu, **Launch MSA view** builds a cross-species
protein MSA from the ortholog gene NCBI publishes per species for most annotated
genes. The dialog opens on its **Orthologs** tab, and these fields matter:

- **Query species** is the species the gene came from, free text resolved
  against NCBI's taxonomy: a scientific name, a common name or a taxon id
- **Rows to align** is how many species to build. NCBI orders its ortholog
  report from the reference organisms outward, so this takes the closest N
- **Choose isoform** picks which transcript becomes the query row, the one the
  genome view stays linked to
- **MSA Algorithm** sets which aligner EBI runs, Clustal Omega by default
- **BLAST query**, a separate tab, takes a gene with no resolvable symbol

Press **Submit**. A multiple sequence alignment view opens below the genome
view, with a tree on the left, the alignment beside it, and the conserved-domain
overlay drawn over the residues once NCBI returns it.

The view opens at residue zoom, a window on the N terminus of a long protein.
**Fit horizontally**, under the toolbar's fit and zoom button, puts the whole
alignment on screen, which is the zoom the domain blocks read at.

Each panel's menu has **Arrange all views → Side by side**, so a hover reaches
the genome, alignment and structure views at once.

<Video src="/media/proteins/tiled_views.mp4" caption="TP53's gene menu launching both an alignment and a structure, then Arrange all views → Side by side arranging the genome, the alignment and the structure in three columns. One hover in the genome moves the highlighted column in the alignment and the highlighted residue on the structure together." />

The figures below take _NLRP1_, an inflammasome sensor whose domain architecture
varies between mammals. Type `NLRP1` into the location box, right-click the
gene, choose **Launch MSA view** and press **Submit**.

<Figure src="/img/genomes_msa/launch_sequence.png" caption="The whole path on NLRP1: the right-click menu, the Launch MSA view dialog on its Orthologs tab, and the alignment Submit builds. In the alignment, the leftmost block is present in some rows and absent in others, the stack of blocks to its right runs down nearly all rows, and the whale rows have only the stack's right-hand end." />

### Reading NLRP1's conserved-domain overlay on the MSA

Each colored block is an NCBI conserved domain, drawn in alignment columns. The
pyrin (PYD) domain sits at the N terminus of human _NLRP1_ and is absent from
mouse _Nlrp1a_. NACHT, the winged helix, HD2, FIIND and CARD run across nearly
every row and are the control; the whale rows have only the C-terminal end.

The domain calls come from NCBI's protein records. For a protein NCBI has no
calls for:

- `react-msaview-cli interproscan` scans the sequences into a domain file.
- **File → Annotations → Open annotation file...** reads that file in.
- **File → Annotations → How to get a domain file...** opens a
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

## Sharing a connected view as a URL

A connected view can also be built as a session-spec URL, for demo links and
embedded apps. This session opens the AlphaFold structure of UniProt P04637
beside a genome view of the TP53 locus with NCBI RefSeq and ClinVar loaded.

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

The short form takes a UniProt accession plus a transcript ID, from which the
plugin derives the AlphaFold structure, finds the transcript in the
`connectedView` tracks at `loc`, and translates its CDS. The explicit form takes
a structure `url`, feature and protein sequence, for a transcript no loaded
track serves. protein3d's
[launching guide](https://github.com/GMOD/jbrowse-plugin-protein3d/blob/main/docs/launching.md#a-structure-connected-to-the-genome)
walks through both.

A `ProteinView` with only a structure `url` and no `connectedView` opens as a
standalone structure, with no genome to exchange highlights with.

## Adding the plugins to your own instance

- Open the [plugin store](/docs/user_guides/plugin_store) (Tools menu) and
  install **Protein3d** and **MSAView**, or
- As an admin, add them to your `config.json` so they load for all users (see
  [configuring plugins](/docs/config_guides/plugins))

The protein3d and msaview plugins add view types launched from a gene's
right-click menu in JBrowse Web and Desktop. The single-view embedded components
host only a linear genome view, so neither view type appears there.
[](/docs/jbrowser)'s `JBrowseRApp` takes both runtime plugins and a `views`
list, while [anywidget](/docs/jbrowse_anywidget)'s `JBrowseApp` has no plugin
loading yet.

The approach is described in
[_Proteins in the Genome Browser_](https://doi.org/10.1016/j.jmb.2026.169645)
(_Journal of Molecular Biology_, 2026).

## See also

- [](/docs/tutorials/genomes_basics)
- [](/docs/tutorials/genomes_synteny)
- [](/docs/tutorials/tp53_structures)

## External links

- [JBrowseMSA user guide](https://github.com/GMOD/JBrowseMSA/blob/main/docs/user_guide.md)
- [jbrowse-plugin-protein3d](https://github.com/GMOD/jbrowse-plugin-protein3d)
- [jbrowse-plugin-msaview](https://github.com/GMOD/jbrowse-plugin-msaview)
- [g2p_mapper](https://github.com/cmdcolin/g2p_mapper)
- [AlphaFold DB](https://alphafold.ebi.ac.uk/)
- [UniProt](https://www.uniprot.org/)
- [NCBI Datasets gene orthologs](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/reference-docs/rest-api/)
- [NCBI Conserved Domain Database](https://www.ncbi.nlm.nih.gov/Structure/cdd/cdd.shtml)
- [Proteins in the Genome Browser](https://github.com/GMOD/proteinbrowser)

## Citations

- Broz P, Dixit VM. Inflammasomes: mechanism of assembly, regulation and
  signalling. _Nat Rev Immunol_ 2016.

[^explorer]:
    The [JBrowseMSA Gene Explorer](https://gmod.org/JBrowseMSA/gene-explorer/)
    builds a linked genome view, structure and MSA from a `gene` and a `taxon`
    in its URL, such as
    [?gene=TP53&taxon=9606](https://gmod.org/JBrowseMSA/gene-explorer/?gene=TP53&taxon=9606).
