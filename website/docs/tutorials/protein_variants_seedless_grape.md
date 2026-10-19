---
title:
  'Variants on protein structures part 3: seedless grapes on an AlphaFold model'
sidebar_label: Proteins (variants pt 3, grape AGL11)
description:
  Open the grapevine seedlessness gene VviAGL11 on codon 197 beside its
  AlphaFold model, and read the model's per-residue confidence before reading
  anything into the residue the seedless allele changes
guide_category: Tutorials
tutorial_category: Transcriptomics & proteins
tutorial_subcategory: Variants on protein structures
---

Most seedless grapes owe it to one missense change in _VviAGL11_, a MADS box
transcription factor that regulates seed development. Arginine 197 becomes
leucine (R197L), and among the cultivars tested only this change was fully
linked with seedlessness
([Royo et al. 2018](https://doi.org/10.1104/pp.18.00259)). The PDB has no
structure of the protein, so we open the codon beside its AlphaFold model and
read how confident the prediction is at residue 197. We'll:

- open _VviAGL11_ on codon 197 from the protein browser, on the Pinot Noir
  reference
- hover the codon's alignment column to find its residue on the model
- read the model's confidence colors around residue 197 and in the MADS domain

The model is of UniProt A0A217EJJ0, a protein sequenced from the seedless
cultivar Sultanina (Thompson Seedless), so residue 197 of the model is leucine,
where the Pinot Noir genome codes arginine.

## Prerequisites

- for your own JBrowse, the protein3d and msaview plugins from the
  [plugin store](/docs/user_guides/plugin_store); genomes.jbrowse.org already
  loads them

## The data

Nothing to download: the protein browser and the plugins read these files by
URL. _Your own model_ opens a model of your own.

<details>
<summary>The files</summary>

| What it is                                                                                          | File                                                                                      |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| The Pinot Noir 40024 reference and its NCBI RefSeq genes, through UCSC's GenArk hub GCF_030704535.1 | [GCF_030704535.1/](https://hgdownload.soe.ucsc.edu/hubs/GCF/030/704/535/GCF_030704535.1/) |
| The AlphaFold model of A0A217EJJ0, with its per-residue confidence                                  | [A0A217EJJ0](https://alphafold.ebi.ac.uk/entry/A0A217EJJ0)                                |
| UniRef, the rows of the alignment                                                                   | [uniref](https://www.uniprot.org/help/uniref)                                             |

</details>

## Opening VviAGL11 on codon 197

NCBI names the gene _MADS5_ (NM_001281189.1), on the minus strand of chr18. Open
the protein browser on residue 197:

- open
  [genomes.jbrowse.org/protein-browser/?gene=AGL11&ref=29760&residue=197](https://genomes.jbrowse.org/protein-browser/?gene=AGL11&ref=29760&residue=197)
  and click **Open in JBrowse ↗**
- type `chr18:32255673-32255763[rev]` into the location box. `[rev]` keeps the
  minus-strand gene reading left to right
- click **Reset Zoom**, the circular arrow at the top right of the structure, to
  fit the whole model
- hover column 197 of the `wine_grape_query` row in the alignment

The structure opens colored by pLDDT, AlphaFold's per-residue confidence, which
the palette icon in the protein view's header sets for any model under **pLDDT
confidence (AlphaFold)**. Dark blue is very high, light blue confident, yellow
low and orange very low, and the header's **pLDDT** row draws the same scale
along the sequence.

<Figure src="/img/protein/agl11_codon_hover.png" caption="VviAGL11 at codon 197 with its UniRef alignment and the AlphaFold model colored by pLDDT." />

Arginine fills most rows of the alignment column, muscadine grape's included.
Residue 197 falls in AlphaFold's low band, where AlphaFold DB advises treating
the chain's placement with caution, and the DNA-binding MADS domain falls in the
very high band.

## Your own model

The protein view takes a model of your own as well:

- **Launch protein view** in a gene's right-click menu, then its **File or URL**
  tab, opens a PDB or mmCIF of your own, such as a ColabFold or AlphaFold 3
  model
- the protein browser's chips open other organisms on a residue each, on
  genomes.jbrowse.org's GenArk assemblies

## See also

- [](/docs/tutorials/protein_variants_sickle_cell)
- [](/docs/tutorials/protein_variants_dog_myelopathy)
- [](/docs/tutorials/genomes_proteins)
- [](/docs/tutorials/tp53_structures)

## External links

- [Protein browser](https://genomes.jbrowse.org/protein-browser/)
- [AlphaFold Protein Structure Database](https://alphafold.ebi.ac.uk/)
- [jbrowse-plugin-protein3d](https://github.com/GMOD/jbrowse-plugin-protein3d)
- [jbrowse-plugin-msaview](https://github.com/GMOD/jbrowse-plugin-msaview)

## Citations

- Royo C, Torres-Pérez R, Mauri N, et al. The major origin of seedless grapes is
  associated with a missense mutation in the MADS-box gene VviAGL11. _Plant
  Physiol_ 2018;177:1234-1253. https://doi.org/10.1104/pp.18.00259
- Varadi M, Bertoni D, Magana P, et al. AlphaFold Protein Structure Database in
  2024: providing structure coverage for over 214 million protein sequences.
  _Nucleic Acids Res_ 2024. https://doi.org/10.1093/nar/gkad1011
