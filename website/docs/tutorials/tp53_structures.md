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
beside the _TP53_ gene, each mapped to the same transcript, click a cancer
hotspot on a crystal to find its codon, and open an NMR ensemble of the
transactivation domain. The protein3d plugin maps each structure to the
transcript, and Mol\* draws the structures.

## Where the data comes from

The links open a hosted hg38 config with NCBI RefSeq genes, and the protein3d
plugin fetches the structures, annotations and mappings from these services.

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

An AlphaFold model is one chain, numbered like the UniProt sequence. A crystal
structure often holds one domain of the protein, sometimes in several copies and
with a partner or DNA, numbered from wherever the crystallised construct began.
The plugin maps both kinds to the gene by aligning the structure's sequence to
the transcript's translation.

[Open the three structures of TP53](https://jbrowse.org/code/jb2/main/?config=test_data/protein3d_config.json&session=spec-%7B%22views%22%3A%5B%7B%22type%22%3A%22ProteinView%22%2C%22structures%22%3A%5B%7B%22uniprotId%22%3A%22P04637%22%7D%2C%7B%22pdbId%22%3A%221TUP%22%7D%2C%7B%22pdbId%22%3A%221YCR%22%7D%5D%2C%22transcriptId%22%3A%22NM_000546.6%22%2C%22zoomToBaseLevel%22%3Afalse%2C%22connectedView%22%3A%7B%22assembly%22%3A%22hg38%22%2C%22loc%22%3A%22chr17%3A7%2C671%2C000-7%2C684%2C500%22%2C%22tracks%22%3A%5B%22hg38-ncbiRefSeq%22%5D%7D%2C%22colorScheme%22%3A%22mapped-chain%22%7D%5D%7D).
The link is a session spec naming the gene's locus, the RefSeq transcript
`NM_000546.6`, and three structures: the AlphaFold model by UniProt accession,
and PDB 1TUP and 1YCR. The plugin superposes the structures with TM-align. The
**Color** menu is set to Mapped chain, which colours the chain the transcript
encodes blue and everything else grey.

The arrow beside each structure in the header opens its alignment panel, with
the transcript's translation on the GENOME row, the structure's sequence on the
STRUCT row, and a ruler in the authors' residue numbering. The AlphaFold panel
is one unbroken match. The 1TUP panel covers the DNA-binding core alone, and its
ruler starts at 94, the residue where the crystallised construct begins. Under
the AlphaFold STRUCT row, pLDDT, AlphaFold's per-residue confidence, is high
across the core and falls away at both ends, the same tails both crystals leave
out.

## Annotations mapped onto the crystal

The feature tracks under each panel come from UniProt, numbered along the
full-length protein. For 1TUP the plugin looks up where the construct starts in
SIFTS and shifts every feature by that offset, dropping features outside the
construct. **Show all feature tracks** in the display settings menu adds
secondary structure, modified residues and other minor types to the default
domains, binding sites and variants.

1TUP holds three copies of the core and two DNA strands. The panel's **Mapped
chain** picker lists them, and the plugin chose the protein entity because its
sequence aligns to the transcript. Hovering any of the three copies in the 3D
canvas highlights the same residue on the genome.

## Finding the codon of the R248 hotspot from the crystal

Open the 1TUP panel and click residue 248 on its STRUCT row, or
[open the same session with R248 selected](https://jbrowse.org/code/jb2/main/?config=test_data/protein3d_config.json&session=spec-%7B%22views%22%3A%5B%7B%22type%22%3A%22ProteinView%22%2C%22structures%22%3A%5B%7B%22uniprotId%22%3A%22P04637%22%7D%2C%7B%22pdbId%22%3A%221TUP%22%2C%22initialResidues%22%3A%7B%22start%22%3A248%2C%22end%22%3A248%7D%7D%2C%7B%22pdbId%22%3A%221YCR%22%7D%5D%2C%22transcriptId%22%3A%22NM_000546.6%22%2C%22zoomToBaseLevel%22%3Afalse%2C%22connectedView%22%3A%7B%22assembly%22%3A%22hg38%22%2C%22loc%22%3A%22chr17%3A7%2C671%2C000-7%2C684%2C500%22%2C%22tracks%22%3A%5B%22hg38-ncbiRefSeq%22%5D%7D%2C%22colorScheme%22%3A%22mapped-chain%22%7D%5D%7D).
The ruler and the transcript row give the same number, because the 1TUP authors
numbered their construct the way UniProt numbers the whole protein.

<Figure src="/img/protein/tp53_hotspot.png" caption="NCBI RefSeq at TP53's R248 codon beside 1TUP with R248 selected. The crystal's three copies of p53's core are blue on grey DNA, R248 is magenta on the copies in view, with its neighbours drawn as sticks, and a band marks its codon on the gene." />

R248 and the residues and bases around it are drawn as sticks, and on one copy
its side chain reaches into the minor groove of the DNA. Hovering the codon on
the gene highlights the residue on both structures that contain it; hovering the
intron beside the exon highlights nothing.

## Mapped chain in a complex

1YCR holds the N-terminal domain of MDM2 and a fifteen-residue peptide from the
p53 transactivation region, and the transcript encodes the peptide. Open the
1YCR panel: its **Mapped chain** picker lists both chains, and the plugin picked
the peptide, a short exact match near the start of the transcript row.

<Figure src="/img/protein/tp53_mapped_chain.png" caption="1YCR with its Mapped chain picker open. Chain B, the p53 peptide, is the mapped one, blue against grey MDM2; Chain A above it in the picker is MDM2." />

Switch the picker to Chain A. The plugin realigns against MDM2, which turns
blue, and the GENOME row becomes a scatter of gapped fragments, because the
transcript does not encode MDM2. Switch back to Chain B. In a complex of two
different proteins the automatic choice can land on the wrong chain, and the
picker corrects it.

## The transactivation domain as an NMR ensemble

PDB 2L14 holds residues 13 to 61 of the p53 transactivation domain, the region
where the AlphaFold pLDDT falls away, bound to the nuclear coactivator binding
domain of CBP. Its authors solved it by NMR and deposited twenty models.

[Open 2L14 with its two helices selected](https://jbrowse.org/code/jb2/main/?config=test_data/protein3d_config.json&session=spec-%7B%22views%22%3A%5B%7B%22type%22%3A%22ProteinView%22%2C%22structures%22%3A%5B%7B%22pdbId%22%3A%222L14%22%2C%22initialTranscriptResidues%22%3A%5B%7B%22start%22%3A18%2C%22end%22%3A26%7D%2C%7B%22start%22%3A46%2C%22end%22%3A54%7D%5D%7D%5D%2C%22transcriptId%22%3A%22NM_000546.6%22%2C%22zoomToBaseLevel%22%3Afalse%2C%22connectedView%22%3A%7B%22assembly%22%3A%22hg38%22%2C%22loc%22%3A%22chr17%3A7%2C676%2C140-7%2C676%2C640%22%2C%22tracks%22%3A%5B%22hg38-ncbiRefSeq%22%5D%7D%2C%22colorScheme%22%3A%22mapped-chain%22%7D%5D%7D).
The link selects the two helices the file annotates, residues 18 to 26 and 46 to
54, through `initialTranscriptResidues`, which counts along the transcript's
translation. The plugin loads each model as a separate structure, so the view
opens more slowly than a crystal's. Click **Reset Zoom**, the circular arrow at
the top right of the canvas, to fit the whole ensemble.

<Figure src="/img/protein/tp53_nmr_ensemble.png" caption="NCBI RefSeq over TP53's first coding exons beside every model of 2L14. The p53 chain is blue on grey CBP with its two helices in magenta; the helices overlap from model to model, the linker leaving the first one spreads, and bands on the gene mark the helices' codons." />

The two helices sit on CBP in the same place in every model. The linker after
the first helix and both ends of the chain differ from model to model, and the
grey spray on the right is the C-terminal tail of CBP. The first helix lies
within the stretch the 1YCR peptide covers. Its codons straddle an intron, so
its band on the gene is split across two exons.

## Checking the hotspot against the sequence

In the R248 session's genome view, zoom into the band the selection drew on
_TP53_, down to base level, and tick **Reference sequence** in the track
selector. The transcript is on the minus strand, so the codon under the band
reads `CCG` left to right on the reference track, which is `CGG`, arginine, on
the transcript. R248W and R248Q, the two commonest substitutions at the codon in
tumours, change its first base and its middle one.

## Structures of your own gene

The protein3d plugin is in the [plugin store](/docs/user_guides/plugin_store):
install **Protein3d** from the Tools menu, then right-click a gene and choose
**Launch protein view** to open its AlphaFold model. For several structures at
once, write the view as a session spec. This is the spec behind the first link
on this page; swap the UniProt accession, the PDB ids, the transcript and the
locus for your gene's, and name a gene track your config has:

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
      "colorScheme": "mapped-chain",
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
- [](/docs/urlparams)

## External links

- [jbrowse-plugin-protein3d](https://github.com/GMOD/jbrowse-plugin-protein3d)
- [AlphaFold DB](https://alphafold.ebi.ac.uk/)
- [RCSB PDB](https://www.rcsb.org/)
- [UniProt](https://www.uniprot.org/)
- [SIFTS](https://www.ebi.ac.uk/pdbe/docs/sifts/)

## Citations

- Cho Y, Gorina S, Jeffrey PD, Pavletich NP. Crystal structure of a p53 tumor
  suppressor-DNA complex: understanding tumorigenic mutations. _Science_ 1994.
- Kussie PH, Gorina S, Marechal V, et al. Structure of the MDM2 oncoprotein
  bound to the p53 tumor suppressor transactivation domain. _Science_ 1996.
- Lee CW, Martinez-Yamout MA, Dyson HJ, Wright PE. Structure of the p53
  transactivation domain in complex with the nuclear receptor coactivator
  binding domain of CREB binding protein. _Biochemistry_ 2010.
