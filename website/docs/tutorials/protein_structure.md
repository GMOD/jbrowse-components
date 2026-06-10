---
title: Protein structures and multiple sequence alignments
description: View 3D protein structures and MSAs linked to genomic variants
guide_category: Tutorials
---

JBrowse 2 can connect genomic data to protein-level views: interactive 3D
structures from [AlphaFold DB](https://alphafold.ebi.ac.uk/) and
[UniProt](https://www.uniprot.org/), and multiple sequence alignments (MSAs)
with phylogenetic trees. Mousing over a variant in the genome view highlights
the corresponding residue on the structure or alignment.

This functionality is provided by two plugins:

- [jbrowse-plugin-protein3d](https://github.com/GMOD/jbrowse-plugin-protein3d) —
  embeds [Mol\*](https://molstar.org/) 3D structure views and can query
  AlphaFold DB and UniProt
- [jbrowse-plugin-msaview](https://github.com/GMOD/jbrowse-plugin-msaview) —
  embeds [react-msaview](https://github.com/GMOD/react-msaview) for MSA and tree
  views, and can run NCBI BLAST

These approaches are described in a
[2026 _Journal of Molecular Biology_ paper](https://doi.org/10.1016/j.jmb.2026.169645).

## Try it without installing anything

A hosted instance with both plugins preconfigured is available at
[genomes.jbrowse.org](https://genomes.jbrowse.org). Open a gene track, right
click a gene, and choose to launch the MSA or 3D protein viewer.

## Installing the plugins

To add the feature to your own JBrowse 2:

- Open the plugin store (Tools menu) and install **Protein3d** and **MSAView**,
  or
- As an admin, add the plugins to your `config.json` so they load for all users

## Viewing a 3D structure

Right click a gene and open the protein structure viewer. The plugin looks up a
structure for the gene's protein (from AlphaFold DB or UniProt) and renders it
with Mol\*. Mouse over a position in the genome view to highlight the matching
residue on the structure, which lets you see where a variant or feature lands in
3D.

<Figure caption="The Mol* protein structure view showing the AlphaFold model of human BRAF (UniProt P15056). When launched from a gene, hovering a residue here highlights the matching genomic position, and hovering the genome highlights the residue." src="/img/protein/structure.png" />

## Viewing a multiple sequence alignment

Right click a gene and open the MSA viewer to load a precomputed alignment and
phylogenetic tree, or run a fresh NCBI BLAST query. As with the structure view,
genomic positions map onto alignment columns so you can relate variants to
conserved residues across species.

See the
[MSAView user guide](https://github.com/GMOD/JBrowseMSA/blob/main/docs/user_guide.md)
for details.
