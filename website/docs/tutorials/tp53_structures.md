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

- nothing to install: every link below opens a hosted JBrowse that already loads
  the protein3d plugin, and the structures, annotations and mappings are fetched
  live from the services named next

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

An AlphaFold model is one chain, numbered like the UniProt sequence it was
predicted from. A crystal structure is whatever was crystallised: a domain cut
out of the protein, sometimes several copies of it, often with a partner or a
piece of DNA, and numbered from wherever the construct began. Putting the two
kinds beside a gene means answering the same question for each, which residue of
the structure is which codon of the transcript, and the plugin answers it by
aligning each structure's own sequence to the transcript's translation.

[Open the three structures of TP53](https://jbrowse.org/code/jb2/main/?config=test_data/protein3d_config.json&session=spec-%7B%22views%22%3A%5B%7B%22type%22%3A%22ProteinView%22%2C%22structures%22%3A%5B%7B%22uniprotId%22%3A%22P04637%22%7D%2C%7B%22pdbId%22%3A%221TUP%22%7D%2C%7B%22pdbId%22%3A%221YCR%22%7D%5D%2C%22transcriptId%22%3A%22NM_000546.6%22%2C%22zoomToBaseLevel%22%3Afalse%2C%22connectedView%22%3A%7B%22assembly%22%3A%22hg38%22%2C%22loc%22%3A%22chr17%3A7%2C671%2C000-7%2C684%2C500%22%2C%22tracks%22%3A%5B%22hg38-ncbiRefSeq%22%5D%7D%2C%22colorScheme%22%3A%22mapped-chain%22%7D%5D%7D).
The link is a session spec naming the gene's locus, its RefSeq transcript
`NM_000546.6`, and three structures by id: a UniProt accession for the AlphaFold
model and two PDB ids. The plugin resolves each id to a file, translates the
transcript's CDS against hg38, aligns every structure to that translation, and
superposes the structures with TM-align. The **Color** menu is on Mapped chain:
the chain the transcript encodes is blue and everything else is grey. The
figures in the next two sections open one structure of that session each.

The header has a line per structure, and the arrow beside one opens that
structure's alignment panel, one at a time. A panel puts the transcript's
translation on the GENOME row and the structure's own sequence on the STRUCT
row, with a residue ruler under them in the numbering the structure's authors
assigned. The AlphaFold panel, open first, is one unbroken match. Open 1TUP's:
it starts in the middle of the transcript and stops well before its end, because
the crystallised construct is the DNA-binding core. Its ruler starts at 94, the
residue of p53 the construct begins at, so a tick under the row is the number a
paper would cite.

Under the STRUCT row of the AlphaFold panel, pLDDT is high across the core and
falls away at both ends of the protein. The crystal panels leave the same region
as a gap: the tails missing from both crystals are the tails the model is least
sure of.

## Annotations mapped onto the crystal

The feature tracks under each panel come from UniProt, whose coordinates are the
full-length sequence. For the AlphaFold model that is the structure's own
numbering. For 1TUP the plugin asks SIFTS where the construct starts and shifts
every feature by that offset, so the DNA binding region and the natural variants
land on the residues the crystal actually has, and features outside the
construct are dropped. The caption under the panel names the UniProt entry the
tracks came from. The panel shows domains, binding sites and variants; **Show
all feature tracks** in the display settings menu adds secondary structure,
modified residues and the other minor types.

A crystal can also hold more than one chain. 1TUP has three copies of the core
and two DNA strands, and the panel's **Mapped chain** picker lists them; the
plugin chose the protein entity because it is the one whose sequence aligns to
the transcript. Hover any of the three copies in the 3D canvas and the same
residue lights on the genome.

## Click a hotspot

Open the 1TUP panel and click residue 248 on its STRUCT row, or
[open the same session with R248 selected](https://jbrowse.org/code/jb2/main/?config=test_data/protein3d_config.json&session=spec-%7B%22views%22%3A%5B%7B%22type%22%3A%22ProteinView%22%2C%22structures%22%3A%5B%7B%22uniprotId%22%3A%22P04637%22%7D%2C%7B%22pdbId%22%3A%221TUP%22%2C%22initialResidues%22%3A%7B%22start%22%3A248%2C%22end%22%3A248%7D%7D%2C%7B%22pdbId%22%3A%221YCR%22%7D%5D%2C%22transcriptId%22%3A%22NM_000546.6%22%2C%22zoomToBaseLevel%22%3Afalse%2C%22connectedView%22%3A%7B%22assembly%22%3A%22hg38%22%2C%22loc%22%3A%22chr17%3A7%2C671%2C000-7%2C684%2C500%22%2C%22tracks%22%3A%5B%22hg38-ncbiRefSeq%22%5D%7D%2C%22colorScheme%22%3A%22mapped-chain%22%7D%5D%7D).
The ruler under the row and the transcript row above agree on the number,
because 1TUP's authors numbered their construct the way UniProt numbers the
whole protein.

<Figure src="/img/protein/tp53_hotspot.png" caption="NCBI RefSeq at TP53's R248 codon beside 1TUP with R248 selected. The crystal's three copies of p53's core are blue on grey DNA, R248 is magenta on each with its neighbours drawn as sticks, and a band marks its codon on the gene." />

A session that opens on a residue focuses it the way clicking it in 3D does:
R248 and the residues and bases around it are drawn as sticks, and on one copy
its side chain reaches into the DNA's minor groove. A band on the gene track
marks the codon. Hover the codon and the residue lights on both structures at
once, since both map it; hover the intron beside the exon and nothing lights
anywhere.

## The complex maps the right chain

1YCR is an MDM2 structure carrying a piece of p53: MDM2's N-terminal domain and
a fifteen-residue peptide from p53's transactivation region. Both are chains of
the file, and only one of them is encoded by the transcript.

Open the 1YCR panel: its **Mapped chain** picker shows both. The plugin picked
the peptide, whose alignment is a short exact match near the start of the
transcript row; MDM2 is listed above it.

<Figure src="/img/protein/tp53_mapped_chain.png" caption="1YCR with its Mapped chain picker open. Chain B, the p53 peptide, is the mapped one, blue against grey MDM2; Chain A above it in the picker is MDM2." />

Switch the picker to Chain A. The alignment is recomputed against MDM2, MDM2
turns blue, and the GENOME row becomes a scatter of gapped fragments, since
nothing in the transcript encodes it; hovering the structure now reaches no
consistent codon. Switch back to Chain B and the peptide's alignment returns. In
a complex of two paralogs, the plugin's automatic choice can land on the wrong
chain, and the picker switches it.

## The transactivation domain as an NMR ensemble

1YCR's peptide is fifteen residues of p53's transactivation domain, the
N-terminal region where the AlphaFold model's pLDDT falls away. PDB 2L14 holds
more of that domain, residues 13 to 61, bound to the nuclear coactivator binding
domain of CBP. Its authors solved it by NMR and deposited twenty models, each
consistent with their measured restraints.

[Open 2L14 with its two helices selected](https://jbrowse.org/code/jb2/main/?config=test_data/protein3d_config.json&session=spec-%7B%22views%22%3A%5B%7B%22type%22%3A%22ProteinView%22%2C%22structures%22%3A%5B%7B%22pdbId%22%3A%222L14%22%2C%22initialTranscriptResidues%22%3A%5B%7B%22start%22%3A18%2C%22end%22%3A26%7D%2C%7B%22start%22%3A46%2C%22end%22%3A54%7D%5D%7D%5D%2C%22transcriptId%22%3A%22NM_000546.6%22%2C%22zoomToBaseLevel%22%3Afalse%2C%22connectedView%22%3A%7B%22assembly%22%3A%22hg38%22%2C%22loc%22%3A%22chr17%3A7%2C676%2C140-7%2C676%2C640%22%2C%22tracks%22%3A%5B%22hg38-ncbiRefSeq%22%5D%7D%2C%22colorScheme%22%3A%22mapped-chain%22%7D%5D%7D).
The link selects residues 18 to 26 and 46 to 54, the two helices the file
annotates, through `initialTranscriptResidues`, which counts along the
transcript's translation. The plugin loads each model as a structure of its own,
so the view takes longer to open than a crystal's, and the colour scheme and the
selection reach all twenty. The view opens framed on the helices; click **Reset
Zoom**, the circular arrow at the top right of the canvas, to fit the whole
ensemble.

<Figure src="/img/protein/tp53_nmr_ensemble.png" caption="NCBI RefSeq over TP53's first coding exons beside every model of 2L14. The p53 chain is blue on grey CBP with its two helices in magenta; the helices overlap from model to model, the linker leaving the first one spreads, and bands on the gene mark the helices' codons." />

2L14's two helices sit on CBP in the same place in every model. The linker
leaving the first helix takes a different path in each, and so do both ends of
the chain; the grey spray on the right is CBP's own C-terminal tail. The first
helix lies within the stretch 1YCR's peptide covers, bound here to CBP. On the
gene its codons straddle an intron, so its band is split across two exons.

## Checking the hotspot against the sequence

Back on the genome view, zoom into the band the R248 selection drew, down to
base level, and turn on the reference sequence. The transcript is on the minus
strand, so the codon under the band reads `CCG` left to right on the reference
track, which is `CGG`, arginine, on the transcript. R248W and R248Q, the two
commonest substitutions at the codon in tumours, change its first base and its
middle one.

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
