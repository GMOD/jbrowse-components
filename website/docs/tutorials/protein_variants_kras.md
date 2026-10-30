---
title: 'Variants on protein structures part 4: KRAS G12 in the GTP pocket'
sidebar_label: Proteins (variants pt 4, KRAS G12)
description:
  Open KRAS on codon 12, the most often mutated codon of the gene in cancer,
  beside a crystal structure of KRAS G12C bound to sotorasib, and read which of
  NCBI's conserved sites the codon falls in
guide_category: Tutorials
tutorial_category: Transcriptomics & proteins
tutorial_subcategory: Variants on protein structures
---

_KRAS_ encodes a small G protein that switches growth signalling on while it
holds GTP. In tumours its missense mutations pile up on a few codons: glycine
12, glycine 13 and glutamine 61. A change at any of them keeps the protein in
its GTP-bound, active state. The drug sotorasib binds KRAS G12C covalently at
the mutant cysteine. We open the codon beside the crystal structure of that
complex and read which of the protein's conserved sites the hotspots fall in.
We'll:

- open _KRAS_ on codon 12 in the protein browser, with structure 6OIM, and pin
  the human row of the ortholog alignment
- highlight and label codons 12, 13 and 61 on the genome
- read ClinVar's records at the codon
- color the genome, the alignment and the structure by the alignment's protein
  domains and sites

## Prerequisites

- for your own JBrowse, the protein3d and msaview plugins from the
  [plugin store](/docs/user_guides/plugin_store); genomes.jbrowse.org already
  loads them

## The data

Nothing to download: the protein browser, the plugins and the hosted hg38 config
read these files by URL.

<details>
<summary>The files</summary>

| What it is                                                                                     | File                                                                                   |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| KRAS G12C bound to sotorasib (AMG 510), PDB 6OIM                                               | [6OIM.cif](https://files.rcsb.org/download/6OIM.cif)                                   |
| ClinVar, which UCSC distributes as its ClinVar Variants track and the hosted hg38 config loads | [clinvarMain.bb](https://hgdownload.soe.ucsc.edu/gbdb/hg38/bbi/clinvar/clinvarMain.bb) |
| NCBI's ortholog report, the rows of the alignment                                              | [rest-api/](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/reference-docs/rest-api/)    |

</details>

## Opening KRAS on codon 12

[Part 1](/docs/tutorials/protein_variants_sickle_cell) walks through the protein
browser's linked session. Open it on _KRAS_ residue 12 with structure 6OIM:

- open
  [genomes.jbrowse.org/protein-browser/?gene=KRAS&ref=9606&residue=12&structure=6oim](https://genomes.jbrowse.org/protein-browser/?gene=KRAS&ref=9606&residue=12&structure=6oim)
  and click **Open in JBrowse ↗**
- close the AlphaMissense track with the × on its label
- type `chr12:25245320-25245380[rev]` into the location box. `[rev]` keeps the
  minus-strand gene reading left to right
- click **Reset Zoom**, the circular arrow at the top right of the structure
- pick **Use as reference row** on the `human_query` tip of the alignment's
  tree, so a residue matching human draws as a dot

To label the hotspots, drag across the scale bar over codon 12 and pick
**Highlight region**, then do the same for codon 13. Click the link chip at the
top of each band, pick **Edit label...** and type `G12` or `G13`.

Hover codon 12 on the gene. The hover lights the codon, the alignment column and
the residue on the structure, and the protein view's header compares the two
letters: glycine in the genome, cysteine in the crystal.

<Figure src="/img/protein/kras_codon_hover.png" caption="KRAS at codons 12 and 13 with ClinVar, the ortholog alignment pinned to its human row, and 6OIM. The hovered codon, the alignment column and Cys12 mark one position." />

Every row of the alignment has glycine at 12 and 13. The other columns in the
window are columns of dots too, so across these vertebrate orthologs the start
of KRAS barely varies.

ClinVar has records of several base changes at each of codons 12 and 13. Click a
box to open its record, which names the protein change, its classification and
the conditions submitters reported.

## The domains across all three views

The alignment view fills its rows with NCBI's conserved domains and sites, and
the genome view and the structure read them from the alignment:

- in the alignment view's menu, click **Show domains on the genome**, which adds
  a domain track to the genome view
- in the genome view's menu, untick **Show → CDS reading frame colors**
- type `chr12:25245328-25245372[rev] chr12:25227320-25227364[rev]` into the
  location box, which puts codon 61, in the next exon, beside codons 12 and 13,
  and highlight it as `Q61`
- in the protein view's palette menu, pick **Domains from the alignment**

<Figure src="/img/protein/kras_domains_three_views.png" caption="KRAS in three linked views, colored by the alignment's domains and sites: the genome's domain track, the alignment's rows and the 6OIM cartoon, with each site's side chains as sticks." />

Codon 12 sits inside three of NCBI's sites, the G1 box (the P-loop), the
GTP/Mg2+ binding site and the putative GDI interaction site, and codon 13 inside
the first two. Codon 61 sits in the Switch II region. The protein view's **From
the alignment** rows list the same sites along the sequence, one row each, with
the hovered residue as a vertical line.

## Your own gene

- any gene the protein browser opens takes the same steps, and a residue in the
  link opens the structure focused on it
- **Launch protein view** in a gene's right-click menu picks another structure,
  such as 4OBE, KRAS bound to GDP with glycine at 12
- the highlight list's menu imports a BED file, so a list of hotspot codons
  highlights in one step

## See also

- [](/docs/tutorials/protein_variants_sickle_cell)
- [](/docs/tutorials/protein_variants_tp53)
- [](/docs/tutorials/protein_variants_braf)
- [](/docs/tutorials/genomes_proteins)
- [](/docs/user_guides/highlights)
- [](/docs/tutorials/protein_variants_met_exon14)

## External links

- [Protein browser](https://genomes.jbrowse.org/protein-browser/)
- [ClinVar](https://www.ncbi.nlm.nih.gov/clinvar/)
- [NCBI Conserved Domain Database](https://www.ncbi.nlm.nih.gov/cdd/)
- [jbrowse-plugin-protein3d](https://github.com/GMOD/jbrowse-plugin-protein3d)
- [jbrowse-plugin-msaview](https://github.com/GMOD/jbrowse-plugin-msaview)

## Citations

- Canon et al. (2019).
  [The clinical KRAS(G12C) inhibitor AMG 510 drives anti-tumour immunity](https://doi.org/10.1038/s41586-019-1694-1)
- Landrum et al. (2018).
  [ClinVar: improving access to variant interpretations and supporting evidence](https://doi.org/10.1093/nar/gkx1153)
