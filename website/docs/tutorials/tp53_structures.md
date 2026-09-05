---
title: TP53 from prediction to crystal
sidebar_label: Proteins (TP53 structures)
description:
  Open an AlphaFold model, the DNA-bound core domain and the MDM2 complex of p53
  in one view, all linked to the same transcript, and read a hotspot back to its
  codon
guide_category: Tutorials
tutorial_category: Transcriptomics & proteins
data: hosted
---

**TL;DR:** the p53 protein has a predicted structure covering every residue and
crystal structures covering the parts that fold. This page opens three of them
in one view beside the _TP53_ gene, superposed and each mapped to the same
transcript, then clicks a cancer hotspot on the crystal and reads it back to its
codon and its ClinVar entries. The protein3d plugin does the mapping; Mol\*
draws the structures.

## Prerequisites

- nothing to install: every link below opens a hosted JBrowse that already loads
  the protein3d plugin, and the structures, annotations and mappings are fetched
  live from the services named next

## Where the data comes from

The hg38 config the links open carries NCBI RefSeq and ClinVar; everything about
the protein arrives per structure from the services beside it.

- hg38 with NCBI RefSeq and ClinVar:
  https://jbrowse.org/code/jb2/main/test_data/protein3d_config.json
- the AlphaFold model of p53, UniProt P04637:
  https://alphafold.ebi.ac.uk/files/AF-P04637-F1-model_v6.cif
- the p53 core domain bound to DNA, PDB 1TUP:
  https://files.rcsb.org/download/1TUP.cif
- the p53 transactivation peptide bound to MDM2, PDB 1YCR:
  https://files.rcsb.org/download/1YCR.cif
- UniProt's feature annotation of p53, the domain and variant tracks:
  https://rest.uniprot.org/uniprotkb/P04637.gff
- SIFTS, which says where each crystal's residues sit in the UniProt sequence:
  https://www.ebi.ac.uk/pdbe/api/mappings/uniprot/1tup

## Three structures of one protein

An AlphaFold model is one chain, numbered like the UniProt sequence it was
predicted from. A crystal structure is whatever was crystallised: a domain cut
out of the protein, sometimes several copies of it, often with a partner or a
piece of DNA, and numbered from wherever the construct began. Putting the two
kinds beside a gene means answering the same question for each, which residue of
the structure is which codon of the transcript, and the plugin answers it by
aligning each structure's own sequence to the transcript's translation.

[Open the three structures of TP53](https://jbrowse.org/code/jb2/main/?config=test_data/protein3d_config.json&session=spec-%7B%22views%22%3A%5B%7B%22type%22%3A%22ProteinView%22%2C%22structures%22%3A%5B%7B%22uniprotId%22%3A%22P04637%22%7D%2C%7B%22pdbId%22%3A%221TUP%22%7D%2C%7B%22pdbId%22%3A%221YCR%22%7D%5D%2C%22transcriptId%22%3A%22NM_000546.6%22%2C%22zoomToBaseLevel%22%3Afalse%2C%22connectedView%22%3A%7B%22assembly%22%3A%22hg38%22%2C%22loc%22%3A%22chr17%3A7%2C671%2C000-7%2C684%2C500%22%2C%22tracks%22%3A%5B%22hg38-ncbiRefSeq%22%2C%22clinvar_ncbi_hg38%22%5D%7D%7D%5D%7D).
The link is a session spec naming the gene's locus, its RefSeq transcript
`NM_000546.6`, and three structures by id: a UniProt accession for the AlphaFold
model and two PDB ids. The plugin resolves each id to a file, translates the
transcript's CDS against hg38, aligns every structure to that translation, and
superposes the structures with TM-align.

<Figure src="/img/protein/tp53_three_structures.png" caption="TP53 on hg38 with NCBI RefSeq and ClinVar beside a protein view holding the AlphaFold model, 1TUP and 1YCR. Each structure has its own alignment panel over the shared Mol* canvas, where the two crystal fragments sit on the model's core and the model's tails run on past them." />

Each alignment panel puts the transcript's translation on the GENOME row and the
structure's own sequence on the STRUCT row, with a residue ruler under them in
the numbering the structure's authors assigned. The AlphaFold panel is one
unbroken match. The 1TUP panel starts in the middle of the transcript and stops
well before its end, because the crystallised construct is the DNA-binding core;
its ruler starts at 94, the residue of p53 the construct begins at, so a tick
under the row is the number a paper would cite.

Under the STRUCT row of the AlphaFold panel, pLDDT is high across the core and
falls away at both ends of the protein, which is the same region the crystal
panels leave as gap: the tails that the crystals do not contain are the tails
the model is least sure of.

## The crystal keeps its annotations

The feature tracks under each panel come from UniProt, whose coordinates are the
full-length sequence. For the AlphaFold model that is the structure's own
numbering. For 1TUP the plugin asks SIFTS where the construct starts and shifts
every feature by that offset, so the DNA binding region and the natural variants
land on the residues the crystal actually has, and features outside the
construct are dropped. The caption under the panel names the UniProt entry the
tracks came from.

A crystal can also hold more than one chain. 1TUP has three copies of the core
and two DNA strands, and the panel's **Mapped chain** picker lists them; the
plugin chose the protein entity because it is the one whose sequence aligns to
the transcript. Hover any of the three copies in the 3D canvas and the same
residue lights on the genome.

## Click a hotspot

[Open the same session with R248 selected](https://jbrowse.org/code/jb2/main/?config=test_data/protein3d_config.json&session=spec-%7B%22views%22%3A%5B%7B%22type%22%3A%22ProteinView%22%2C%22structures%22%3A%5B%7B%22uniprotId%22%3A%22P04637%22%7D%2C%7B%22pdbId%22%3A%221TUP%22%2C%22initialResidues%22%3A%7B%22start%22%3A248%2C%22end%22%3A248%7D%7D%2C%7B%22pdbId%22%3A%221YCR%22%7D%5D%2C%22transcriptId%22%3A%22NM_000546.6%22%2C%22zoomToBaseLevel%22%3Afalse%2C%22connectedView%22%3A%7B%22assembly%22%3A%22hg38%22%2C%22loc%22%3A%22chr17%3A7%2C671%2C000-7%2C684%2C500%22%2C%22tracks%22%3A%5B%22hg38-ncbiRefSeq%22%2C%22clinvar_ncbi_hg38%22%5D%7D%7D%5D%7D),
or click residue 248 on the 1TUP panel's STRUCT row yourself: the ruler under
the row and the transcript row above agree on the number, because 1TUP's authors
numbered their construct the way UniProt numbers the whole protein.

<Figure src="/img/protein/tp53_hotspot.png" caption="R248 selected on 1TUP: magenta on the crystal's DNA-contact loop, a band over its codon on NCBI RefSeq, and the ClinVar rows that fall inside the band. The AlphaFold model carries the same residue, so the hover reaches both structures." />

The selection is magenta on the crystal, where the residue sits in the loop that
reaches into the DNA's minor groove, and a band on the genome tracks over the
codon. The ClinVar rows inside the band are the substitutions at that codon.
Hover one of them and the residue lights on both structures at once, since both
map it; hover the intron beside the exon and nothing lights anywhere.

## The complex maps the right chain

1YCR is not a p53 structure so much as an MDM2 structure with a piece of p53 in
it: MDM2's N-terminal domain and a fifteen-residue peptide from p53's
transactivation region. Both are chains of the file, and only one of them is
encoded by the transcript.

The 1YCR panel's **Mapped chain** picker shows both. The plugin picked the
peptide, whose alignment is a short exact match near the start of the transcript
row; MDM2 is listed above it.

<Figure src="/img/protein/tp53_mapped_chain.png" caption="1YCR's Mapped chain picker open. The p53 peptide, Chain B, is the mapped one; Chain A is MDM2." />

Switch the picker to Chain A. The alignment is recomputed against MDM2, and the
GENOME row becomes a scatter of gapped fragments, since nothing in the
transcript encodes it; hovering the structure now reaches no consistent codon.
Switch back to Chain B and the peptide's alignment returns. A complex of two
paralogs is where the plugin's own choice can land on the wrong one, and the
picker is the way back.

## Checking the hotspot against the sequence

Back on the genome view, zoom into the band the R248 selection drew, down to
base level. The codon under the band is `CGG`; the ClinVar rows over it are the
R248Q and R248W entries, one changing the middle base and one the first. The
transcript is on the minus strand, so the codon reads right to left on the
reference track.

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
