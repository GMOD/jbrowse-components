---
title:
  'Variants on protein structures part 1: sickle cell from GWAS hit to
  haemoglobin S'
sidebar_label: Proteins (variants pt 1, sickle cell)
description:
  Follow the sickle cell allele of HBB from its GWAS Catalog associations and
  its 1000 Genomes genotypes to the residue it changes in the crystal structure
  of sickle haemoglobin
guide_category: Tutorials
tutorial_category: Transcriptomics & proteins
tutorial_subcategory: Variants on protein structures
---

Sickle cell disease comes from one base change in _HBB_, the gene for the β
chain of haemoglobin. Codon 7 changes from GAG to GTG, so glutamate 6 of the
mature protein becomes valine. The variant, rs334, turns up again and again in
genome-wide association studies, and population callsets show who carries one
copy and who carries two. We put all of that in one JBrowse session beside the
residue it changes, in a crystal structure of sickle haemoglobin. We'll:

- open _HBB_ on codon 7 in the protein browser, with structure 2HBS, and hover
  the codon's alignment column to find its residue
- add the GWAS Catalog, then a copy filtered to rs334's strongest record for
  each trait tied to sickle cell trait, and read what each record reports
- add 1000 Genomes genotypes, one row per genome, with a common synonymous
  variant four codons upstream as the control
- color the genome, the alignment and the structure by the alignment's protein
  domains

## Prerequisites

- for your own JBrowse, the protein3d and msaview plugins from the
  [plugin store](/docs/user_guides/plugin_store); genomes.jbrowse.org already
  loads them

## The data

Nothing to download: the protein browser, the plugins and the track configs
below read these files by URL. _Your own gene_ covers a gene of your own.

<details>
<summary>The files</summary>

| What it is                                                                                                    | File                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sickle haemoglobin, deoxy form, PDB 2HBS                                                                      | [2HBS.cif](https://files.rcsb.org/download/2HBS.cif)                                                                                                                  |
| The NHGRI-EBI GWAS Catalog, which UCSC distributes as its GWAS Catalog track and the hosted hg38 config loads | [gwas/](https://www.ebi.ac.uk/gwas/)                                                                                                                                  |
| The 1000 Genomes 30x callset for chr11, 3,202 genomes                                                         | [20220422_3202_phased_SNV_INDEL_SV/](https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/data_collections/1000G_2504_high_coverage/working/20220422_3202_phased_SNV_INDEL_SV/) |
| NCBI's ortholog report, the rows of the alignment                                                             | [rest-api/](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/reference-docs/rest-api/)                                                                                   |

</details>

## Opening HBB on the sickle cell codon

The protein browser opens a gene, a structure and an alignment as one linked
session ([](/docs/tutorials/genomes_proteins) walks through its page). Open it
on _HBB_ residue 7 with structure 2HBS:

- open
  [genomes.jbrowse.org/protein-browser/?gene=HBB&ref=9606&residue=7&structure=2hbs](https://genomes.jbrowse.org/protein-browser/?gene=HBB&ref=9606&residue=7&structure=2hbs)
  and click **Open in JBrowse ↗**
- close the ClinVar and AlphaMissense tracks with the × on each track's label
- type `chr11:5226956-5227046[rev]` into the location box. `[rev]` keeps the
  minus-strand gene reading left to right, the way it opened
- click **Reset Zoom**, the circular arrow at the top right of the structure, to
  fit the haemoglobin tetramer
- pick **Use as reference row** on the `human_query` tip of the alignment's
  tree: the human sequence pins above the alignment, and a residue matching it
  draws as a dot
- drag across codon 7, the `E` of the gene's translation, in the genome view's
  ruler, and pick **Highlight region**
- click the link chip at the top of the new band, pick **Edit label...** and
  type `E6V`. The genome view writes the label on the band, the alignment on
  column 7 and the structure beside Val6
- hover column 7 of the `human_query` row in the alignment

Residue 7 counts the initiator methionine, which the mature protein loses, so
the literature's Glu6 is the transcript's residue 7. The protein view's header
reads both numbers off the hover and compares the two letters, glutamate in the
transcript and valine in the crystal.

<Figure src="/img/protein/hbb_codon_hover.png" caption="HBB at codon 7 with its ortholog alignment and 2HBS. The codon band, the alignment column and Val6 mark the same position." />

## The GWAS Catalog at rs334

Open the track selector from the genome view's menu, **Open track selector**,
search `GWAS Catalog`, and tick it. The catalog has one record per study and
trait, so a variant studied many times draws as a stack. Click a box to open its
record.

The records at rs334 include malaria, haemolytic anaemias, glycated haemoglobin
(HbA1c) and kidney disease. A second copy of the catalog keeps rs334's strongest
record for each of those traits, the one with the smallest p-value, and labels
it with its trait, p-value, first author and year, read from the file's own
columns:

```json addtrack loc=chr11:5226956-5227046
{
  "type": "FeatureTrack",
  "trackId": "gwasCatalog_sickle_cell_traits",
  "name": "GWAS Catalog at rs334, one record per trait",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "bedGzLocation": {
      "uri": "https://jbrowse.org/ucsc/hg38/gwasCatalog.bed.gz"
    },
    "index": {
      "indexType": "CSI",
      "location": {
        "uri": "https://jbrowse.org/ucsc/hg38/gwasCatalog.bed.gz.csi"
      }
    }
  },
  "displayDefaults": {
    "filter": [
      "jexl:feature.name == 'rs334'",
      "jexl:feature.trait in ['Malaria', 'Hereditary hemolytic anemias (PheCode 282)', 'Glycated hemoglobin levels', 'Chronic Kidney Disease, Stage III (PheCode 585.33)']",
      "jexl:feature.pValue in ['4E-69', '1E-323', '3E-39', '9E-31']"
    ],
    "labels": {
      "name": "trait",
      "description": "jexl:'p=' + feature.pValue + ', ' + substring(feature.pubDate, 0, 4) + ', ' + feature.author"
    },
    "showLabels": "nameAndDescription"
  }
}
```

The subset is a filter, which **Filter by... → Edit filters...** in the track
menu edits to keep other traits.

<Figure src="/img/protein/hbb_gwas_catalog.png" caption="The GWAS Catalog under HBB, and the copy filtered to rs334's strongest record for each trait, labeled with its trait." />

## Sickle allele in 1000 Genomes

The 1000 Genomes callset is a VCF with a column per genome, which JBrowse draws
as one row per genome:

```json addtrack loc=chr11:5226956-5227046
{
  "type": "VariantTrack",
  "trackId": "kgp3202_chr11_snv",
  "name": "1000 Genomes 30x, chr11 SNVs and indels",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "vcfGzLocation": {
      "uri": "https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/data_collections/1000G_2504_high_coverage/working/20220422_3202_phased_SNV_INDEL_SV/1kGP_high_coverage_Illumina.chr11.filtered.SNV_INDEL_SV_phased_panel.vcf.gz"
    },
    "index": {
      "location": {
        "uri": "https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/data_collections/1000G_2504_high_coverage/working/20220422_3202_phased_SNV_INDEL_SV/1kGP_high_coverage_Illumina.chr11.filtered.SNV_INDEL_SV_phased_panel.vcf.gz.tbi"
      }
    }
  },
  "displays": [
    {
      "type": "LinearMultiSampleVariantDisplay",
      "displayId": "kgp3202_chr11_snv-LinearMultiSampleVariantDisplay"
    }
  ]
}
```

rs334 sits under the highlighted codon. Right-click its column and pick **Sort
rows by genotype here**, which gathers its carriers into one block. Nearly all
of them carry one copy. rs713040, a synonymous change in the His3 codon four
codons upstream, sits to its left on screen as the control: common, and carried
as one copy or two. HbC, rs33930165, a second allele of the same codon, shares
the highlighted column.

<Figure src="/img/protein/hbb_1000_genomes.png" caption="1000 Genomes genotypes under HBB, one row per genome, sorted by genotype at rs334." />

## The domains across all three views

The alignment view fills its rows with NCBI's conserved domains and sites. The
genome view and the structure read them from the alignment, so each domain keeps
one color in every view:

- in the alignment view's menu, click **Show domains on the genome**, which adds
  a domain track to the genome view
- in the genome view's menu, untick **Show... → CDS reading frame colors**,
  whose frame colors would mix with the domain colors
- type `chr11:5226956-5227046[rev] chr11:5226750-5226799[rev]` into the location
  box, which adds the start of exon 2 beside codon 7
- in the protein view's palette menu, pick **Domains from the alignment**
- in the protein view's menu, pick **Assembly → Deposited model (every chain)**,
  which draws both tetramers the crystal holds, then click **Reset Zoom**

In the protein view's header, the **From the alignment** rows list the same
domains and sites.

<Figure src="/img/protein/hbb_domains_three_views.png" caption="HBB in three linked views: the genome's GWAS, 1000 Genomes and domain tracks, the alignment's rows and the 2HBS cartoon, colored by the alignment's domains. On the structure a cartoon color marks a domain and side-chain sticks mark a site." />

The numbered callouts follow rs334 from a statistic to a mechanism, one view at
a time:

1. the GWAS records tie the allele to malaria and to haemolytic anaemia and
   kidney disease: one copy protects against severe malaria, and two copies
   cause sickle cell disease
2. nearly every 1000 Genomes carrier has one copy, the protected genotype
3. the alignment and the domain track mark no heme-binding or tetramer-interface
   site at Glu6, which sits on the protein's surface[^domain]
4. on the structure, the hydrophobic valine 6 of the second tetramer's chain H
   fills a pocket of Phe85 and Leu88 on the first tetramer's chain B.
   Deoxygenated haemoglobin S stacks into fibres through this contact, and the
   fibres bend red cells into sickles

[^domain]:
    The Hb-beta-like domain, NCBI's cd08925, starts at the transcript's residue
    8, one past the sickle residue. In 2HBS, helix A runs from Thr4, so Glu6
    sits inside the globin fold; the bar's start marks where cd08925's model
    begins.

## Your own gene

Each step on this page works on any gene the protein browser opens:

- the chips under the search box open other organisms on a residue each, from
  _M. tuberculosis_ _rpoB_ to dog _SOD1_, on genomes.jbrowse.org's GenArk
  assemblies. [Part 2](/docs/tutorials/protein_variants_dog_myelopathy) takes
  dog _SOD1_ onto the assembly its population callset uses, and
  [part 3](/docs/tutorials/protein_variants_seedless_grape) reads a grapevine
  gene on an AlphaFold model
- **Launch protein view** in a gene's right-click menu picks the structure
  yourself, and its **File or URL** tab takes a PDB or mmCIF of your own, such
  as a ColabFold or AlphaFold model
- any multi-sample VCF adds the genotype layer, and **Sort rows by genotype
  here** gathers the carriers of whichever variant you right-click

## See also

- [](/docs/tutorials/protein_variants_dog_myelopathy)
- [](/docs/tutorials/protein_variants_seedless_grape)
- [](/docs/tutorials/protein_variants_kras)
- [](/docs/tutorials/protein_variants_tp53)
- [](/docs/tutorials/protein_variants_braf)
- [](/docs/tutorials/genomes_proteins)
- [](/docs/tutorials/tp53_structures)
- [](/docs/tutorials/population_genomics)

## External links

- [Protein browser](https://genomes.jbrowse.org/protein-browser/)
- [NHGRI-EBI GWAS Catalog](https://www.ebi.ac.uk/gwas/)
- [1000 Genomes 30x data collection](https://www.internationalgenome.org/data-portal/data-collection/30x-grch38)
- [jbrowse-plugin-protein3d](https://github.com/GMOD/jbrowse-plugin-protein3d)
- [jbrowse-plugin-msaview](https://github.com/GMOD/jbrowse-plugin-msaview)

## Citations

- Harrington DJ, Adachi K, Royer WE Jr. The high resolution crystal structure of
  deoxyhemoglobin S. _J Mol Biol_ 1997. https://doi.org/10.1006/jmbi.1997.1279
- Byrska-Bishop M, Evani US, Zhao X, et al. High-coverage whole-genome
  sequencing of the expanded 1000 Genomes Project cohort including 602 trios.
  _Cell_ 2022. https://doi.org/10.1016/j.cell.2022.08.004
- Sollis E, Mosaku A, Abid A, et al. The NHGRI-EBI GWAS Catalog: knowledgebase
  and deposition resource. _Nucleic Acids Res_ 2023.
  https://doi.org/10.1093/nar/gkac1010
