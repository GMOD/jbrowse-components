---
title: Protein structures
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

These approaches are described in our
[_Proteins in the Genome Browser_ paper](https://doi.org/10.1016/j.jmb.2026.169645)
(_Journal of Molecular Biology_, 2026).

## Try it without installing anything

The quickest way to see all three views linked at once is the hosted
[JBrowseMSA Gene Explorer](https://gmod.org/JBrowseMSA/gene-explorer/): search a
human gene and it auto-launches a connected MSA (across 100 vertebrates), an
AlphaFold 3D structure, and a linear genome view, with hovering synchronized
across all three. It is part of the
[Proteins in the Genome Browser](https://github.com/GMOD/proteinbrowser)
project.

The same plugins come preconfigured on the public genome browsers at
[genomes.jbrowse.org](https://genomes.jbrowse.org) — pick a genome (for example
[hg38](https://jbrowse.org/code/jb2/latest/?config=/ucsc/hg38/config.json)),
search for a gene, right click it, and choose to launch the 3D protein viewer or
the MSA viewer.

For a one-click example, this session opens the AlphaFold structure of human
BRAF (UniProt P15056) directly in the hg38 browser:

```json live config=/ucsc/hg38/config.json base="https://jbrowse.org/code/jb2/latest/"
{
  "views": [
    {
      "type": "ProteinView",
      "url": "https://alphafold.ebi.ac.uk/files/AF-P15056-F1-model_v6.cif"
    }
  ]
}
```

## Installing the plugins

To add the feature to your own JBrowse 2:

- Open the [plugin store](/docs/user_guides/plugin_store) (Tools menu) and
  install **Protein3d** and **MSAView**, or
- As an admin, add the plugins to your `config.json` so they load for all users
  (see [configuring plugins](/docs/config_guides/plugins))

## Viewing a 3D structure

Right click a gene and open the protein structure viewer. The plugin looks up a
structure for the gene's protein (from AlphaFold DB or UniProt) and renders it
with Mol\*. Mouse over a position in the genome view to highlight the matching
residue on the structure, which lets you see where a variant or feature lands in
3D.

## Linking variants to a 3D structure

The structure view is most useful when it stays connected to a genome view.
Launching the protein viewer from a gene keeps the two linked: hovering a
position in the genome highlights the corresponding residue on the structure
(and on the sequence alignment), and hovering the structure highlights the
genomic position. This lets you read a coding variant straight onto the folded
protein — for example, to see whether a ClinVar missense variant lands in a
functional domain or is buried in the core.

<Figure caption="A connected session on human TP53 (UniProt P04637). The genome view (left) shows the NCBI RefSeq gene models and ClinVar variants, while the protein view (right) shows the AlphaFold structure together with the genome-to-structure sequence alignment and per-residue tracks (pLDDT confidence, domains, helices, hydrophobicity). Hovering a variant in the genome highlights the matching residue on the structure." src="/img/protein/connected.png" />

The genome-to-protein mapping is derived from the transcript's coding exons, so
intronic and UTR positions are skipped and each codon maps to a single residue.

### Sharing a connected view as a URL

A connected session can also be built **declaratively** as a session-spec URL,
which is handy for demo links and embedded apps. In the simplest form you give
the plugin a UniProt accession and a transcript id, plus the genome location and
tracks to show, and it resolves the rest — the AlphaFold structure, the
transcript feature, and the aligned protein sequence:

The session is passed as the `session` URL parameter, prefixed with `spec-` (the
prefix tells JBrowse the value is an inline session). Tagging the block below
`live` builds that `?config=…&session=spec-…` link straight from this JSON, so
the link and the shown session can never drift:

```json live config=/ucsc/hg38/config.json base="https://jbrowse.org/code/jb2/latest/"
{
  "views": [
    {
      "type": "ProteinView",
      "uniprotId": "P04637",
      "transcriptId": "NM_000546.6",
      "connectedView": {
        "assembly": "hg38",
        "loc": "chr17:7,668,421-7,687,550",
        "tracks": ["hg38-ncbiRefSeqCurated", "hg38-clinvarMain"]
      }
    }
  ]
}
```

The transcript must be present in one of the listed `tracks` at `loc`. If you
need a transcript that isn't loaded as a track, you can instead pass the
structure `url`, the `feature`, and the protein sequence explicitly. Both forms,
the full parameter list, and ready-to-open URLs are documented in the
[protein3d developer docs](https://github.com/GMOD/jbrowse-plugin-protein3d/blob/main/DEVELOPERS.md#connected-genome--protein-view).

## Viewing a multiple sequence alignment

Right click a gene and open the MSA viewer to load a precomputed alignment and
phylogenetic tree, or run a fresh NCBI BLAST query. As with the structure view,
genomic positions map onto alignment columns so you can relate variants to
conserved residues across species.

See the
[MSAView user guide](https://github.com/GMOD/JBrowseMSA/blob/main/docs/user_guide.md)
for details.

## See also

- [JBrowseMSA Gene Explorer](https://gmod.org/JBrowseMSA/gene-explorer/) —
  hosted one-click demo linking an MSA, AlphaFold 3D structure, and linear
  genome view for any human gene
- [Proteins in the Genome Browser](https://github.com/GMOD/proteinbrowser) —
  metapage linking the Protein3d and MSAView plugins, their developer docs, and
  demos
- [Proteins in the Genome Browser paper](https://doi.org/10.1016/j.jmb.2026.169645)
  — the methods behind these plugins
- [Gene tracks](/docs/user_guides/gene_track) — color-by-CDS reading frames and
  peptide lettering on the linear gene track
- [Variant tracks](/docs/user_guides/variant_track) — loading and filtering VCFs
  such as ClinVar
- [Plugin store](/docs/user_guides/plugin_store) — installing Protein3d,
  MSAView, and other plugins
