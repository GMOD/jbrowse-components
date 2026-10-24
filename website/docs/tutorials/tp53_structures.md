---
title: TP53 from prediction to crystal
sidebar_label: Proteins (TP53 structures)
description:
  Open an AlphaFold model, the DNA-bound core domain and the MDM2 complex of p53
  in one view, all linked to the same transcript, and read a hotspot back to its
  codon
guide_category: Tutorials
tutorial_category: Transcriptomics & proteins
---

The p53 protein has a predicted structure covering every residue and crystal
structures covering the parts that fold. The protein3d plugin maps each
structure to the transcript, and Mol\* draws the structures. We:

- open three structures in one view beside the _TP53_ gene, each mapped to the
  same transcript
- click a residue on a crystal to find its codon, and check the codon against
  the reference sequence
- choose the mapped chain in a complex, and open an NMR ensemble

## Prerequisites

- the protein3d plugin. In your own JBrowse,
  [install it from the plugin store](/docs/user_guides/plugin_store); the hosted
  config the links open already loads it

## The data

The links open a hosted hg38 config with NCBI RefSeq genes, and the protein3d
plugin fetches these files when a link opens, so no download is needed.
_Structures of your own gene_ covers a gene of your own.

<details>
<summary>The files</summary>

| What it is                                                                  | File                                                                                     |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| The AlphaFold model of p53, UniProt P04637                                  | [AF-P04637-F1-model_v6.cif](https://alphafold.ebi.ac.uk/files/AF-P04637-F1-model_v6.cif) |
| The p53 core domain bound to DNA, PDB 1TUP                                  | [1TUP.cif](https://files.rcsb.org/download/1TUP.cif)                                     |
| The p53 transactivation peptide bound to MDM2, PDB 1YCR                     | [1YCR.cif](https://files.rcsb.org/download/1YCR.cif)                                     |
| The p53 transactivation domain bound to CBP, solved by NMR, PDB 2L14        | [2L14.cif](https://files.rcsb.org/download/2L14.cif)                                     |
| UniProt's feature annotation of p53, the domain and variant tracks          | [P04637.gff](https://rest.uniprot.org/uniprotkb/P04637.gff)                              |
| SIFTS, which maps where each crystal's residues sit in the UniProt sequence | [1tup](https://www.ebi.ac.uk/pdbe/api/mappings/uniprot/1tup)                             |

</details>

## Opening three TP53 structures mapped to one transcript

An AlphaFold model is one chain, numbered like the UniProt sequence. A crystal
structure often holds one domain of the protein, numbered from wherever the
crystallised construct began. The plugin maps both kinds to the gene by aligning
the structure's sequence to the transcript's translation.

[Open the three structures of TP53](https://jbrowse.org/code/jb2/main/?config=test_data/protein3d_config.json&session=spec-%7B%22views%22%3A%5B%7B%22type%22%3A%22ProteinView%22%2C%22structures%22%3A%5B%7B%22uniprotId%22%3A%22P04637%22%7D%2C%7B%22pdbId%22%3A%221TUP%22%7D%2C%7B%22pdbId%22%3A%221YCR%22%7D%5D%2C%22transcriptId%22%3A%22NM_000546.6%22%2C%22zoomToBaseLevel%22%3Afalse%2C%22connectedView%22%3A%7B%22assembly%22%3A%22hg38%22%2C%22loc%22%3A%22chr17%3A7%2C671%2C000-7%2C684%2C500%22%2C%22tracks%22%3A%5B%22hg38-ncbiRefSeq%22%5D%7D%2C%22color%22%3A%7B%22field%22%3A%22mappedChain%22%7D%7D%5D%7D).
The plugin superposes the structures with TM-align, and the **Color** menu is
set to Mapped chain, which colors the chain the transcript encodes blue and
everything else grey.

The arrow beside each structure in the header opens its alignment panel, with
the transcript's translation on the GENOME row, the structure's sequence on the
STRUCT row and a ruler in the authors' residue numbering:

- **AlphaFold** is one unbroken match. Under its STRUCT row, pLDDT (AlphaFold's
  per-residue confidence) is high across the core and falls away at both ends,
  the same tails both crystals leave out.
- **1TUP** covers the DNA-binding core alone, and its ruler starts at 94, the
  residue where the crystallised construct begins.

## UniProt annotations on the 1TUP core-domain crystal

The feature tracks under each panel come from UniProt, shifted to the
construct's numbering with the SIFTS offset. **Show all feature tracks** in the
display settings menu adds secondary structure, modified residues and other
minor types to the default domains, binding sites and variants.

1TUP holds three copies of the core and two DNA strands. The panel's **Mapped
chain** picker lists them, and the plugin chose the protein entity because its
sequence aligns to the transcript. Hovering any copy in the 3D canvas highlights
the same residue on the genome.

## Finding the codon of the R248 hotspot from the crystal

Open the 1TUP panel and click the R248 hotspot on its STRUCT row, or
[open the same session with R248 selected](https://jbrowse.org/code/jb2/main/?config=test_data/protein3d_config.json&session=spec-%7B%22views%22%3A%5B%7B%22type%22%3A%22ProteinView%22%2C%22structures%22%3A%5B%7B%22uniprotId%22%3A%22P04637%22%7D%2C%7B%22pdbId%22%3A%221TUP%22%2C%22initialResidues%22%3A%7B%22start%22%3A248%2C%22end%22%3A248%7D%7D%2C%7B%22pdbId%22%3A%221YCR%22%7D%5D%2C%22transcriptId%22%3A%22NM_000546.6%22%2C%22zoomToBaseLevel%22%3Afalse%2C%22connectedView%22%3A%7B%22assembly%22%3A%22hg38%22%2C%22loc%22%3A%22chr17%3A7%2C671%2C000-7%2C684%2C500%22%2C%22tracks%22%3A%5B%22hg38-ncbiRefSeq%22%5D%7D%2C%22color%22%3A%7B%22field%22%3A%22mappedChain%22%7D%7D%5D%7D).
The ruler and the transcript row give the same number, because the 1TUP authors
numbered their construct the way UniProt numbers the whole protein.

<Figure src="/img/protein/tp53_hotspot.png" caption="NCBI RefSeq at TP53's R248 codon beside 1TUP with R248 selected. R248 is magenta, and a band marks its codon on the gene." />

Hovering the codon on the gene highlights the residue on the structures that
contain it; hovering the intron beside the exon highlights nothing.

## Choosing the mapped chain in the MDM2 complex 1YCR

1YCR holds the N-terminal domain of MDM2, a p53 regulator, and a fifteen-residue
peptide from the p53 transactivation region, and the transcript encodes the
peptide. Open the 1YCR panel: its **Mapped chain** picker lists both chains, and
the plugin picked the peptide, a short exact match near the start of the
transcript row.

<Figure src="/img/protein/tp53_mapped_chain.png" caption="1YCR with its Mapped chain picker open." />

Switch the picker to Chain A. The plugin realigns against MDM2, which turns
blue, and the GENOME row becomes a scatter of gapped fragments, because the
transcript does not encode MDM2.

## The p53 transactivation domain as an NMR ensemble

PDB 2L14 holds residues 13 to 61 of the p53 transactivation domain, the region
where the AlphaFold pLDDT falls away, bound to the nuclear coactivator binding
domain of CBP. Its authors deposited an NMR ensemble of twenty models that each
fit the data.

[Open 2L14 with its two helices selected](https://jbrowse.org/code/jb2/main/?config=test_data/protein3d_config.json&session=spec-%7B%22views%22%3A%5B%7B%22type%22%3A%22ProteinView%22%2C%22structures%22%3A%5B%7B%22pdbId%22%3A%222L14%22%2C%22initialTranscriptResidues%22%3A%5B%7B%22start%22%3A18%2C%22end%22%3A26%7D%2C%7B%22start%22%3A46%2C%22end%22%3A54%7D%5D%7D%5D%2C%22transcriptId%22%3A%22NM_000546.6%22%2C%22zoomToBaseLevel%22%3Afalse%2C%22connectedView%22%3A%7B%22assembly%22%3A%22hg38%22%2C%22loc%22%3A%22chr17%3A7%2C676%2C140-7%2C676%2C640%22%2C%22tracks%22%3A%5B%22hg38-ncbiRefSeq%22%5D%7D%2C%22color%22%3A%7B%22field%22%3A%22mappedChain%22%7D%7D%5D%7D).
The link selects the two helices the file annotates, residues 18 to 26 and 46 to
54, through `initialTranscriptResidues`, which counts along the transcript's
translation. The view opens slowly because the plugin loads each model as a
separate structure. Click **Reset Zoom**, the circular arrow at the top right of
the canvas, to fit the whole ensemble.

<Figure src="/img/protein/tp53_nmr_ensemble.png" caption="TP53's first coding exons beside every model of 2L14. Bands on the gene mark the codons of the helices in magenta." />

The grey spray on the right is the C-terminal tail of CBP. The first helix lies
within the stretch the 1YCR peptide covers, and its codons straddle an intron,
so its band on the gene splits across two exons.

## Checking the R248 codon against the reference sequence

In the R248 session's genome view, zoom into the band the selection drew on
_TP53_, down to base level, and tick **Reference sequence** in the track
selector. The transcript is on the minus strand, so the codon under the band
reads `CCG` left to right on the reference track, which is `CGG`, arginine, on
the transcript.

## Structures of your own gene

The protein3d plugin is in the [plugin store](/docs/user_guides/plugin_store):
install **Protein3d** from the Tools menu, then right-click a gene and choose
**Launch protein view** to open its AlphaFold model. For several structures at
once, write the view as a session spec. This is the spec behind the
three-structure link. Swap the UniProt accession, the PDB ids, the transcript
and the locus for your gene's, and name a gene track your config has:

```json live config=test_data/protein3d_config.json
{
  "views": [
    {
      "type": "ProteinView",
      "structures": [
        { "uniprotId": "P04637" },
        { "pdbId": "1TUP" },
        { "pdbId": "1YCR" }
      ],
      "transcriptId": "NM_000546.6",
      "color": { "field": "mappedChain" },
      "connectedView": {
        "assembly": "hg38",
        "loc": "chr17:7,671,000-7,684,500",
        "tracks": ["hg38-ncbiRefSeq"]
      }
    }
  ]
}
```

The transcript has to be in one of the `connectedView` tracks at `loc`, since
the plugin maps each structure by aligning its sequence to that transcript's
translation.

## See also

- [](/docs/tutorials/genomes_proteins)
- [](/docs/tutorials/protein_variants_sickle_cell)
- [](/docs/urlparams)

## External links

- [jbrowse-plugin-protein3d](https://github.com/GMOD/jbrowse-plugin-protein3d)
- [AlphaFold DB](https://alphafold.ebi.ac.uk/)
- [RCSB PDB](https://www.rcsb.org/)
- [UniProt](https://www.uniprot.org/)
- [SIFTS](https://www.ebi.ac.uk/pdbe/docs/sifts/)

## Citations

- Cho et al. (1994).
  [Crystal structure of a p53 tumor suppressor-DNA complex: understanding tumorigenic mutations](https://doi.org/10.1126/science.8023157)
- Kussie et al. (1996).
  [Structure of the MDM2 oncoprotein bound to the p53 tumor suppressor transactivation domain](https://doi.org/10.1126/science.274.5289.948)
- Lee et al. (2010).
  [Structure of the p53 transactivation domain in complex with the nuclear receptor coactivator binding domain of CREB binding protein](https://doi.org/10.1021/bi1012996)
