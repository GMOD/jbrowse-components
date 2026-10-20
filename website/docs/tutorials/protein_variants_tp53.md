---
title: 'Variants on protein structures part 5: TP53 R248 and R273 on DNA'
sidebar_label: Proteins (variants pt 5, TP53 R248)
description:
  Open TP53 on codons 248 and 273, two of its most often mutated codons in
  cancer, beside the crystal structure of the p53 core domain bound to DNA, and
  read which of NCBI's conserved sites they fall in
guide_category: Tutorials
tutorial_category: Transcriptomics & proteins
tutorial_subcategory: Variants on protein structures
---

The p53 protein, from _TP53_, is a transcription factor that binds DNA and stops
the cell cycle after DNA damage. Most _TP53_ mutations in tumours are missense
changes in its DNA-binding core, and the arginines at residues 175, 248 and 273
change more often than any other residue. We open codons 248 and 273 side by
side, beside the crystal structure of the core domain bound to DNA, and read
which of the protein's conserved sites each hotspot falls in. We'll:

- open _TP53_ in the protein browser with structure 1TUP, and pin the human row
  of the ortholog alignment
- show codons 248 and 273 side by side, highlighted and labelled
- color the genome, the alignment and the structure by the alignment's protein
  domains and sites, with Arg175 as the comparison

## Prerequisites

- for your own JBrowse, the protein3d and msaview plugins from the
  [plugin store](/docs/user_guides/plugin_store); genomes.jbrowse.org already
  loads them

## The data

Nothing to download: the protein browser and the plugins read these files by
URL.

<details>
<summary>The files</summary>

| What it is                                        | File                                                                                |
| ------------------------------------------------- | ----------------------------------------------------------------------------------- |
| The p53 core domain bound to DNA, PDB 1TUP        | [1TUP.cif](https://files.rcsb.org/download/1TUP.cif)                                |
| NCBI's ortholog report, the rows of the alignment | [rest-api/](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/reference-docs/rest-api/) |

</details>

## Opening TP53 on codons 248 and 273

[Part 1](/docs/tutorials/protein_variants_sickle_cell) walks through the protein
browser's linked session. Open it on _TP53_ with structure 1TUP:

- open
  [genomes.jbrowse.org/protein-browser/?gene=TP53&ref=9606&structure=1tup](https://genomes.jbrowse.org/protein-browser/?gene=TP53&ref=9606&structure=1tup)
  and click **Open in JBrowse ↗**
- close the ClinVar and AlphaMissense tracks with the × on each track's label
- type `chr17:7674201-7674239[rev] chr17:7673783-7673821[rev]` into the location
  box, which puts codon 273 beside codon 248
- click **Reset Zoom**, the circular arrow at the top right of the structure
- pick **Use as reference row** on the `human_query` tip of the alignment's
  tree, so a residue matching human draws as a dot
- drag across the scale bar over codon 248 and pick **Highlight region**, then
  over codon 273. Click the link chip at the top of each band, pick **Edit
  label...** and type `R248` or `R273`

The link names no residue. With `residue=248` in it, the protein browser opens
the seed alignment of p53's Pfam family, a few dozen distant relatives, in place
of _TP53_'s orthologs.

Hover codon 248 on the gene. The protein view's header reads the residue in both
the genome and the crystal, and 1TUP lights the residue in each of its three
copies of the core domain.

<Figure src="/img/protein/tp53_codon_hover.png" caption="TP53 at codons 248 and 273 with the ortholog alignment pinned to its human row, and 1TUP: three copies of the p53 core domain on a DNA duplex." />

Every row of the alignment has arginine at 248 and at 273, while several columns
from 259 on hold other letters in many rows.

## The domains across all three views

The alignment view fills its rows with NCBI's conserved domains and sites, and
the genome view and the structure read them from the alignment:

- in the alignment view's menu, click **Show domains on the genome**, which adds
  a domain track to the genome view
- in the genome view's menu, untick **Show... → CDS reading frame colors**
- in the protein view's palette menu, pick **Domains from the alignment**
- type
  `chr17:7675069-7675107[rev] chr17:7674201-7674239[rev] chr17:7673783-7673821[rev]`
  into the location box, which puts codon 175 before codons 248 and 273, and
  highlight it as `R175`

<Figure src="/img/protein/tp53_domains_three_views.png" caption="TP53 in three linked views, colored by the alignment's domains and sites: the genome's domain track, the alignment's rows and the 1TUP cartoon, with each site's side chains as sticks." />

Codons 248 and 273 both sit inside NCBI's DNA binding site of the P53 domain,
and on the structure both side chains reach the DNA. Arg175, the third hotspot,
sits in none of the sites and away from the DNA.

[Part 1](/docs/tutorials/protein_variants_sickle_cell) found the opposite at
_HBB_ codon 7: the sickle position lies outside the globin domain and every
site, and the orthologs vary there.

## Your own gene

- any gene the protein browser opens takes the same steps, and the chain picker
  in the protein view's header chooses among the copies in a crystal
- **Launch protein view** in a gene's right-click menu picks another structure,
  and [](/docs/tutorials/tp53_structures) lays several of p53's side by side

## See also

- [](/docs/tutorials/protein_variants_sickle_cell)
- [](/docs/tutorials/protein_variants_kras)
- [](/docs/tutorials/protein_variants_braf)
- [](/docs/tutorials/tp53_structures)
- [](/docs/user_guides/highlights)

## External links

- [Protein browser](https://genomes.jbrowse.org/protein-browser/)
- [NCBI Conserved Domain Database](https://www.ncbi.nlm.nih.gov/cdd/)
- [jbrowse-plugin-protein3d](https://github.com/GMOD/jbrowse-plugin-protein3d)
- [jbrowse-plugin-msaview](https://github.com/GMOD/jbrowse-plugin-msaview)

## Citations

- Cho Y, Gorina S, Jeffrey PD, Pavletich NP. Crystal structure of a p53 tumor
  suppressor-DNA complex: understanding tumorigenic mutations. _Science_
  1994;265:346-355. https://doi.org/10.1126/science.8023157
