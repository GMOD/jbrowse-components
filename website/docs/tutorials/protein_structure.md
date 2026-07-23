---
title: Protein structures
description: View 3D protein structures and MSAs linked to genomic variants
guide_category: Tutorials
tutorial_category: Transcriptomics & proteins
---

JBrowse 2 can link genomic data to protein-level views: interactive 3D
structures from [AlphaFold DB](https://alphafold.ebi.ac.uk/) and
[UniProt](https://www.uniprot.org/), and multiple sequence alignments (MSAs)
with phylogenetic trees. Hovering a variant in the genome view highlights the
matching residue on the structure or alignment, and vice versa.

Two plugins provide this:

- [jbrowse-plugin-protein3d](https://github.com/GMOD/jbrowse-plugin-protein3d) -
  embeds [Mol\*](https://molstar.org/) 3D structure views, querying AlphaFold DB
  and UniProt
- [jbrowse-plugin-msaview](https://github.com/GMOD/jbrowse-plugin-msaview) -
  embeds [react-msaview](https://github.com/GMOD/react-msaview) for MSA and tree
  views, and can run NCBI BLAST

Both add new view types, launched from a gene's right-click menu in JBrowse Web
and Desktop. The single-view embedded components render only a linear genome
view, so neither view type appears there; the full-app embedded components can
in principle host one, since [JBrowseR](/docs/jbrowser)'s `JBrowseRApp` takes
both runtime plugins and a `views` list, while
[anywidget](/docs/jbrowse_jupyter)'s `JBrowseApp` currently has no plugin
loading.

The approach is described in our
[_Proteins in the Genome Browser_ paper](https://doi.org/10.1016/j.jmb.2026.169645)
(_Journal of Molecular Biology_, 2026).

## What you need

Nothing, to start: the next section opens a preconfigured instance with both
plugins already loaded. To use them on your own data you add the two plugins to
a JBrowse instance, covered under
[Installing the plugins](#installing-the-plugins).

## Try it without installing anything

The [JBrowseMSA Gene Explorer](https://gmod.org/JBrowseMSA/gene-explorer/) shows
all three views linked at once: search a human gene and it launches an MSA
(across 100 vertebrates), an AlphaFold structure, and a linear genome view, with
hovering synchronized across all three.

Both plugins are also preconfigured on the public browsers at
[genomes.jbrowse.org](https://genomes.jbrowse.org). Pick a genome such as
[hg38](https://jbrowse.org/code/jb2/latest/?config=/ucsc/hg38/config.json),
search for a gene, and right-click it to launch either view.

This session opens the AlphaFold structure of human BRAF (UniProt P15056) in the
hg38 browser:

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

Only needed to add these views to your own JBrowse:

- Open the [plugin store](/docs/user_guides/plugin_store) (Tools menu) and
  install **Protein3d** and **MSAView**, or
- As an admin, add them to your `config.json` so they load for all users (see
  [configuring plugins](/docs/config_guides/plugins))

## Viewing a 3D structure

Right-click a gene and launch the protein-structure view from its menu. The
plugin looks up a structure for that gene's protein in AlphaFold DB or UniProt
and renders it with Mol\*.

The lookup needs a gene feature carrying a recognizable protein or transcript ID
(the RefSeq gene tracks on the public browsers have them), so a feature track
without such IDs won't resolve a structure.

Launching from a gene keeps the two views linked: hovering a genomic position
highlights the matching residue on the structure and its sequence alignment, and
hovering the structure highlights the genomic position. This lets you read a
coding variant straight onto the folded protein, for example to see whether a
ClinVar missense variant lands in a functional domain or is buried in the core.

<Figure caption="A connected session on human TP53 (UniProt P04637). The genome view (left) shows the NCBI RefSeq gene models and ClinVar variants, while the protein view (right) shows the AlphaFold structure together with the genome-to-structure sequence alignment and per-residue tracks (pLDDT confidence, domains, helices, hydrophobicity). Hovering a variant in the genome highlights the matching residue on the structure." src="/img/protein/connected.png" />

### How positions are mapped

Linking a genome position to a residue takes two steps.

**Genome to protein position.** The plugins use
[g2p_mapper](https://github.com/cmdcolin/g2p_mapper) on the transcript's CDS
subfeatures to build the `g2p`/`p2g` lookups, handling strand and CDS phase.
Intronic and UTR positions are skipped, and each codon maps to one residue.
Codons that straddle an exon boundary have several genomic pieces, so
highlighting uses their enclosing span.

**Protein position to structure residue.** A structure file carries its own
sequence, which frequently is not the translation of the transcript you launched
from: PDB entries are often a construct, a fragment, a different isoform, or a
different species, and residues can be missing or modified. When the two
sequences are identical the positions map one to one.

When they differ, the launch dialog says so ("Transcript and structure sequences
differ, will run Smith-Waterman alignment") and the plugin aligns them in the
browser with BLOSUM62 and EMBOSS-style gap penalties. Residue positions are then
mapped through the alignment columns, and positions falling in a gap are simply
unmapped, which is what you are seeing when hovering a variant highlights
nothing. The gear beside that notice switches between Smith-Waterman (local, the
default, good for a structure covering only part of the protein) and
Needleman-Wunsch (global), or takes a precomputed pairwise alignment pasted in
Clustal format. The same options are available afterwards under **Advanced** in
the view menu.

The resulting alignment is not hidden: the **Pairwise alignment** panel below
the structure shows the transcript row against the structure row with a
consensus line, so you can check the mapping is sane before trusting a residue
highlight. If you need exact correspondence, fold the transcript's own sequence
with AlphaFold instead of using a database structure.

When you open a structure of your own, the transcript picker uses this same
comparison, listing isoforms whose translation exactly matches the structure
sequence ahead of those that do not.

The MSA view maps positions the same way: genome to protein position with
g2p_mapper, then that position to a column of the matching alignment row, which
is where the row's gaps get taken into account.

### Sharing a connected view as a URL

A connected view can also be built declaratively as a session-spec URL, useful
for demo links and embedded apps: pass a UniProt accession and transcript ID (or
an explicit structure `url`, feature, and sequence) alongside the genome
location and tracks, and the plugin resolves the structure and alignment. See
the parameters and example URLs in the
[protein3d developer docs](https://github.com/GMOD/jbrowse-plugin-protein3d/blob/main/DEVELOPERS.md#connected-genome--protein-view).

## Viewing a multiple sequence alignment

Right-click a gene and launch the MSA view to load a precomputed alignment and
phylogenetic tree, or run a fresh NCBI BLAST query. As with the structure view,
genomic positions map onto alignment columns, so you can relate variants to
residues conserved across species.

See the
[MSAView user guide](https://github.com/GMOD/JBrowseMSA/blob/main/docs/user_guide.md)
for details.

## See also

- [JBrowseMSA Gene Explorer](https://gmod.org/JBrowseMSA/gene-explorer/)
- [Proteins in the Genome Browser](https://github.com/GMOD/proteinbrowser)
- [Proteins in the Genome Browser paper](https://doi.org/10.1016/j.jmb.2026.169645)
- [g2p_mapper](https://github.com/cmdcolin/g2p_mapper)
- [Gene tracks](/docs/user_guides/gene_track)
- [Variant tracks](/docs/user_guides/variant_track)
- [Plugin store](/docs/user_guides/plugin_store)
