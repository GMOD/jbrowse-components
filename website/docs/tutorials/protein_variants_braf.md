---
title: 'Variants on protein structures part 6: BRAF V600 in the activation loop'
sidebar_label: Proteins (variants pt 6, BRAF V600)
description:
  Open BRAF on codon 600 beside a crystal structure of the V600E kinase, and
  read which of NCBI's conserved sites of the kinase domain the codon falls in
guide_category: Tutorials
tutorial_category: Transcriptomics & proteins
tutorial_subcategory: Variants on protein structures
---

_BRAF_ encodes a serine/threonine kinase of the MAPK pathway, which passes
growth signals from RAS to MEK. In about half of melanomas, and in thyroid and
colorectal tumours, one base change turns valine 600 into glutamate (V600E), and
the kinase signals without RAS. Vemurafenib and dabrafenib inhibit the mutant
kinase. We open the codon beside a crystal structure of the V600E kinase domain
and read which of the kinase domain's conserved sites it falls in. We'll:

- open _BRAF_ in the protein browser with structure 4MNF, and pin the human row
  of the ortholog alignment
- highlight and label codon 600 and read ClinVar's records at it
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
| The BRAF V600E kinase domain bound to GDC-0879, PDB 4MNF                                       | [4MNF.cif](https://files.rcsb.org/download/4MNF.cif)                                   |
| ClinVar, which UCSC distributes as its ClinVar Variants track and the hosted hg38 config loads | [clinvarMain.bb](https://hgdownload.soe.ucsc.edu/gbdb/hg38/bbi/clinvar/clinvarMain.bb) |
| NCBI's ortholog report, the rows of the alignment                                              | [rest-api/](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/reference-docs/rest-api/)    |

</details>

## Opening BRAF on codon 600

[Part 1](/docs/tutorials/protein_variants_sickle_cell) walks through the protein
browser's linked session. Open it on _BRAF_ with structure 4MNF:

- open
  [genomes.jbrowse.org/protein-browser/?gene=BRAF&ref=9606&structure=4mnf](https://genomes.jbrowse.org/protein-browser/?gene=BRAF&ref=9606&structure=4mnf)
  and click **Open in JBrowse ↗**
- close the AlphaMissense track with the × on its label
- type `chr7:140753306-140753366[rev]` into the location box. `[rev]` keeps the
  minus-strand gene reading left to right
- click **Reset Zoom**, the circular arrow at the top right of the structure
- pick **Use as reference row** on the `human_query` tip of the alignment's
  tree, so a residue matching human draws as a dot
- drag across the scale bar over codon 600 and pick **Highlight region**, then
  click the link chip at the top of the band, pick **Edit label...** and type
  `V600`

The link names no residue. With `residue=600` in it, the protein browser opens
the seed alignment of the kinase domain's Pfam family, kinases of many genes and
species, in place of _BRAF_'s orthologs.

Hover codon 600 on the gene. The protein view's header compares the two letters:
valine in the genome, glutamate in the crystal. 4MNF leaves most of the
activation loop past residue 600 unmodelled, so the cartoon breaks off there.

<Figure src="/img/protein/braf_codon_hover.png" caption="BRAF at codon 600 with ClinVar, the ortholog alignment pinned to its human row, and the 4MNF kinase domain dimer. The hovered codon, the alignment column and Glu600 mark one position." />

Every row of the alignment has valine at 600. ClinVar stacks records of several
base changes on the codon; click a box to open its record, which names the
protein change, its classification and the conditions submitters reported.

## The domains across all three views

The alignment view fills its rows with NCBI's conserved domains and sites, and
the genome view and the structure read them from the alignment:

- in the alignment view's menu, click **Show domains on the genome**, which adds
  a domain track to the genome view
- in the genome view's menu, untick **Show → CDS reading frame colors**
- in the protein view's palette menu, pick **Domains from the alignment**

<Figure src="/img/protein/braf_domains_three_views.png" caption="BRAF in three linked views, colored by the alignment's domains and sites: the genome's domain track, the alignment's rows and the 4MNF cartoon, with each site's side chains as sticks." />

Codon 600 sits inside the activation loop, one of NCBI's sites of the STKc_Raf
kinase domain. The ATP binding site ends upstream, at Asp594 of the DFG motif.

## Your own gene

- any gene the protein browser opens takes the same steps, and a residue in the
  link opens the structure focused on it
- **Launch protein view** in a gene's right-click menu picks another structure,
  such as 3OG7, BRAF V600E bound to vemurafenib, whose first chain leaves
  residue 600 unmodelled

## See also

- [](/docs/tutorials/protein_variants_sickle_cell)
- [](/docs/tutorials/protein_variants_kras)
- [](/docs/tutorials/protein_variants_tp53)
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

- Haling et al. (2014).
  [Structure of the BRAF-MEK complex reveals a kinase activity independent role for BRAF in MAPK signaling](https://doi.org/10.1016/j.ccr.2014.07.007)
- Davies et al. (2002).
  [Mutations of the BRAF gene in human cancer](https://doi.org/10.1038/nature00766)
- Landrum et al. (2018).
  [ClinVar: improving access to variant interpretations and supporting evidence](https://doi.org/10.1093/nar/gkx1153)
