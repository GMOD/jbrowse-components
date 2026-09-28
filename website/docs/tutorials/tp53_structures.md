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
structures covering the parts that fold. We open three of them in one view
beside the _TP53_ gene, superposed and each mapped to the same transcript, click
a cancer hotspot on the crystal and read it back to its codon, and open an NMR
ensemble of the transactivation domain the same way. The protein3d plugin does
the mapping; Mol\* draws the structures.

## Prerequisites

- every link below opens a hosted JBrowse with the protein3d plugin loaded

## Where the data comes from

The hg38 config the links open carries NCBI RefSeq; the services listed beside
each structure provide everything about the protein.

- hg38 with NCBI RefSeq:
  https://jbrowse.org/code/jb2/main/test_data/protein3d_config.json
- the AlphaFold model of p53, UniProt P04637:
  https://alphafold.ebi.ac.uk/files/AF-P04637-F1-model_v6.cif
- the p53 core domain bound to DNA, PDB 1TUP:
  https://files.rcsb.org/download/1TUP.cif
- the p53 transactivation peptide bound to MDM2, PDB 1YCR:
  https://files.rcsb.org/download/1YCR.cif
- the p53 transactivation domain bound to CBP, solved by NMR, PDB 2L14:
  https://files.rcsb.org/download/2L14.cif
- UniProt's feature annotation of p53, the domain and variant tracks:
  https://rest.uniprot.org/uniprotkb/P04637.gff
- SIFTS, which maps where each crystal's residues sit in the UniProt sequence:
  https://www.ebi.ac.uk/pdbe/api/mappings/uniprot/1tup

## Three structures of one protein

An AlphaFold model covers the whole protein, numbered like its UniProt sequence.
A crystal structure covers a domain, often with a partner or DNA, and is
numbered from wherever the construct began. The plugin maps each structure's
residues to codons of the transcript by aligning the structure's sequence to the
transcript's translation.

[Open the three structures of TP53](https://jbrowse.org/code/jb2/main/?config=test_data/protein3d_config.json&session=spec-%7B%22views%22%3A%5B%7B%22type%22%3A%22ProteinView%22%2C%22structures%22%3A%5B%7B%22uniprotId%22%3A%22P04637%22%7D%2C%7B%22pdbId%22%3A%221TUP%22%7D%2C%7B%22pdbId%22%3A%221YCR%22%7D%5D%2C%22transcriptId%22%3A%22NM_000546.6%22%2C%22zoomToBaseLevel%22%3Afalse%2C%22connectedView%22%3A%7B%22assembly%22%3A%22hg38%22%2C%22loc%22%3A%22chr17%3A7%2C671%2C000-7%2C684%2C500%22%2C%22tracks%22%3A%5B%22hg38-ncbiRefSeq%22%5D%7D%2C%22colorScheme%22%3A%22mapped-chain%22%7D%5D%7D).
The link is a session spec naming the gene's locus, its RefSeq transcript
`NM_000546.6`, and three structures by id. The plugin superposes them with
TM-align, and **Color → Mapped chain** paints the chain the transcript encodes
blue and everything else grey.

The arrow beside a structure's header line opens its alignment panel: the
transcript's translation on the GENOME row, the structure's sequence on the
STRUCT row, and a ruler in the authors' numbering. The AlphaFold panel is one
unbroken match. The 1TUP panel starts in the middle of the transcript and stops
early, because the crystal holds only the DNA-binding core, and its ruler starts
at residue 94. In the AlphaFold panel, pLDDT falls away at both ends of the
protein, the same tails that are missing from the crystals.

## Annotations mapped onto the crystal

The feature tracks under each panel come from UniProt, in full-length numbering.
For 1TUP the plugin asks SIFTS where the construct starts and shifts each
feature by that offset, so the DNA binding region and the natural variants land
on residues the crystal has. **Show all feature tracks** in the display settings
menu adds secondary structure and modified residues.

1TUP has three copies of the core and two DNA strands, and the **Mapped chain**
picker lists them. Hover any copy in the 3D canvas and the same residue lights
on the genome.

## Click a hotspot

Open the 1TUP panel and click residue 248 on its STRUCT row, or
[open the same session with R248 selected](https://jbrowse.org/code/jb2/main/?config=test_data/protein3d_config.json&session=spec-%7B%22views%22%3A%5B%7B%22type%22%3A%22ProteinView%22%2C%22structures%22%3A%5B%7B%22uniprotId%22%3A%22P04637%22%7D%2C%7B%22pdbId%22%3A%221TUP%22%2C%22initialResidues%22%3A%7B%22start%22%3A248%2C%22end%22%3A248%7D%7D%2C%7B%22pdbId%22%3A%221YCR%22%7D%5D%2C%22transcriptId%22%3A%22NM_000546.6%22%2C%22zoomToBaseLevel%22%3Afalse%2C%22connectedView%22%3A%7B%22assembly%22%3A%22hg38%22%2C%22loc%22%3A%22chr17%3A7%2C671%2C000-7%2C684%2C500%22%2C%22tracks%22%3A%5B%22hg38-ncbiRefSeq%22%5D%7D%2C%22colorScheme%22%3A%22mapped-chain%22%7D%5D%7D).
<Figure src="/img/protein/tp53_hotspot.png" caption="NCBI RefSeq at TP53's R248 codon beside 1TUP with R248 selected. The crystal's three copies of p53's core are blue on grey DNA, R248 is magenta on each with its neighbours drawn as sticks, and a band marks its codon on the gene." />

R248 and its neighbours draw as sticks, and on one copy its side chain reaches
into the DNA's minor groove. A band on the gene track marks the codon. Hover the
codon and the residue lights on both structures at once, and hovering the intron
beside it lights nothing.

## The complex maps the right chain

1YCR holds MDM2's N-terminal domain and a fifteen-residue peptide of p53, and
only the peptide is encoded by the transcript. Open the 1YCR panel: its **Mapped
chain** picker lists both, and the plugin picked the peptide, a short exact
match near the start of the transcript row.

<Figure src="/img/protein/tp53_mapped_chain.png" caption="1YCR with its Mapped chain picker open. Chain B, the p53 peptide, is the mapped one, blue against grey MDM2; Chain A above it in the picker is MDM2." />

Switch the picker to Chain A. MDM2 turns blue and the GENOME row becomes a
scatter of gapped fragments, since nothing in the transcript encodes MDM2.
Switch back to Chain B to restore the peptide. In a complex of two paralogs the
automatic choice can land on the wrong chain, and the picker corrects it.

## The transactivation domain as an NMR ensemble

PDB 2L14 holds residues 13 to 61 of p53's transactivation domain, where the
AlphaFold model's pLDDT falls away, bound to the coactivator binding domain of
CBP. Its authors solved it by NMR and deposited twenty models.

[Open 2L14 with its two helices selected](https://jbrowse.org/code/jb2/main/?config=test_data/protein3d_config.json&session=spec-%7B%22views%22%3A%5B%7B%22type%22%3A%22ProteinView%22%2C%22structures%22%3A%5B%7B%22pdbId%22%3A%222L14%22%2C%22initialTranscriptResidues%22%3A%5B%7B%22start%22%3A18%2C%22end%22%3A26%7D%2C%7B%22start%22%3A46%2C%22end%22%3A54%7D%5D%7D%5D%2C%22transcriptId%22%3A%22NM_000546.6%22%2C%22zoomToBaseLevel%22%3Afalse%2C%22connectedView%22%3A%7B%22assembly%22%3A%22hg38%22%2C%22loc%22%3A%22chr17%3A7%2C676%2C140-7%2C676%2C640%22%2C%22tracks%22%3A%5B%22hg38-ncbiRefSeq%22%5D%7D%2C%22colorScheme%22%3A%22mapped-chain%22%7D%5D%7D).
The link selects residues 18 to 26 and 46 to 54, the two annotated helices,
through `initialTranscriptResidues`, which counts along the transcript's
translation. Each of the twenty models loads as a structure, so the view opens
slowly. Click **Reset Zoom**, the circular arrow at the top right of the canvas,
to fit the whole ensemble.

<Figure src="/img/protein/tp53_nmr_ensemble.png" caption="NCBI RefSeq over TP53's first coding exons beside every model of 2L14. The p53 chain is blue on grey CBP with its two helices in magenta; the helices overlap from model to model, the linker leaving the first one spreads, and bands on the gene mark the helices' codons." />

The two helices sit on CBP in the same place in every model, while the linker
leaving the first helix and both chain ends take a different path in each. The
first helix's codons straddle an intron, so its band splits across two exons.

## Checking the hotspot against the sequence

On the genome view, zoom to base level on the band the R248 selection drew and
turn on the reference sequence. The transcript is on the minus strand, so the
codon reads `CCG` on the reference track, which is `CGG`, arginine, on the
transcript. R248W and R248Q, the commonest substitutions at the codon in
tumours, change its first and middle bases.

## See also

- [](/docs/tutorials/genomes_proteins)
- [](/docs/urlparams)
- [jbrowse-plugin-protein3d](https://github.com/GMOD/jbrowse-plugin-protein3d)

## References

- [AlphaFold DB](https://alphafold.ebi.ac.uk/)
- [RCSB PDB](https://www.rcsb.org/)
- [UniProt](https://www.uniprot.org/)
- [SIFTS](https://www.ebi.ac.uk/pdbe/docs/sifts/)
- Cho Y, Gorina S, Jeffrey PD, Pavletich NP. Crystal structure of a p53 tumor
  suppressor-DNA complex: understanding tumorigenic mutations. _Science_ 1994.
- Kussie PH, Gorina S, Marechal V, et al. Structure of the MDM2 oncoprotein
  bound to the p53 tumor suppressor transactivation domain. _Science_ 1996.
- Lee CW, Martinez-Yamout MA, Dyson HJ, Wright PE. Structure of the p53
  transactivation domain in complex with the nuclear receptor coactivator
  binding domain of CREB binding protein. _Biochemistry_ 2010.
