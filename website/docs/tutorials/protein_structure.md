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

Both plugins come preconfigured on the public genome browsers linked from
[genomes.jbrowse.org](https://genomes.jbrowse.org) — pick a genome (for example
[hg38](https://jbrowse.org/code/jb2/latest/?config=/ucsc/hg38/config.json)) to
open JBrowse, search for a gene, right click it, and choose to launch the 3D
protein viewer or the MSA viewer.

For a one-click example, this link opens the AlphaFold structure of human BRAF
(UniProt P15056) directly in the hg38 browser:

[Live demo — BRAF 3D structure](https://jbrowse.org/code/jb2/latest/?config=/ucsc/hg38/config.json&session=spec-%7B%22views%22%3A%5B%7B%22type%22%3A%22ProteinView%22%2C%22url%22%3A%22https%3A%2F%2Falphafold.ebi.ac.uk%2Ffiles%2FAF-P15056-F1-model_v6.cif%22%7D%5D%7D)

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

## Linking variants to a 3D structure

The structure view is most useful when it stays connected to a genome view.
Launching the protein viewer from a gene keeps the two linked: hovering a
position in the genome highlights the corresponding residue on the structure
(and on the sequence alignment), and hovering the structure highlights the
genomic position. This lets you read a coding variant straight onto the folded
protein — for example, to see whether a ClinVar missense variant lands in a
functional domain or is buried in the core.

<Figure caption="A connected session on human TP53 (UniProt P04637). The genome view (top) shows the NCBI RefSeq gene models and ClinVar variants; the protein view (bottom) shows the AlphaFold structure together with the genome-to-structure sequence alignment and per-residue tracks (pLDDT confidence, domains, helices, hydrophobicity). Hovering a variant in the genome highlights the matching residue on the structure." src="/img/protein/connected.png" />

The genome-to-protein mapping is derived from the transcript's coding exons, so
intronic and UTR positions are skipped and each codon maps to a single residue.

## Viewing a multiple sequence alignment

Right click a gene and open the MSA viewer to load a precomputed alignment and
phylogenetic tree, or run a fresh NCBI BLAST query. As with the structure view,
genomic positions map onto alignment columns so you can relate variants to
conserved residues across species.

See the
[MSAView user guide](https://github.com/GMOD/JBrowseMSA/blob/main/docs/user_guide.md)
for details.

## See also

- [Variant tracks](/docs/user_guides/variant_track) — loading and filtering VCFs
  such as ClinVar in the genome view
- [Plugin store](/docs/user_guides/plugin_store) — installing Protein3d,
  MSAView, and other plugins
- [protein3d developer docs](https://github.com/GMOD/jbrowse-plugin-protein3d/blob/main/DEVELOPERS.md)
  — launching a connected protein view programmatically or via session-spec URLs
- [2026 _Journal of Molecular Biology_ paper](https://doi.org/10.1016/j.jmb.2026.169645)
  — the methods behind these plugins
