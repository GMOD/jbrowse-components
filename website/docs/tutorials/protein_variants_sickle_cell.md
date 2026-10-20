---
title:
  'Variants on protein structures part 1: sickle cell from GWAS hit to
  haemoglobin S'
sidebar_label: Proteins (variants pt 1, sickle cell)
description:
  Follow the sickle cell allele of HBB from its GWAS Catalog associations and
  its distribution across 1000 Genomes ancestries to the residue it changes in
  the crystal structure of sickle haemoglobin
guide_category: Tutorials
tutorial_category: Transcriptomics & proteins
tutorial_subcategory: Variants on protein structures
---

Sickle cell disease comes from one base change in _HBB_, the gene for the β
chain of haemoglobin. Codon 7 changes from GAG to GTG, so glutamate 6 of the
mature protein becomes valine. The variant, rs334, turns up again and again in
genome-wide association studies, and its frequency differs sharply between
ancestries. We put all of that in one JBrowse session beside the residue it
changes, in a crystal structure of sickle haemoglobin. We'll:

- open _HBB_ on codon 7 in the protein browser, with structure 2HBS, and hover
  the codon's alignment column to find its residue
- add the GWAS Catalog, then a copy filtered to rs334's strongest record for
  each trait tied to sickle cell trait, and read what each record reports
- add 1000 Genomes genotypes grouped by ancestry, with a common synonymous
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

| What it is                                                                                                    | File                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sickle haemoglobin, deoxy form, PDB 2HBS                                                                      | [2HBS.cif](https://files.rcsb.org/download/2HBS.cif)                                                                                                                              |
| The NHGRI-EBI GWAS Catalog, which UCSC distributes as its GWAS Catalog track and the hosted hg38 config loads | [gwas/](https://www.ebi.ac.uk/gwas/)                                                                                                                                              |
| The 1000 Genomes 30x callset for chr11, 3,202 genomes                                                         | [20220422_3202_phased_SNV_INDEL_SV/](https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/data_collections/1000G_2504_high_coverage/working/20220422_3202_phased_SNV_INDEL_SV/)             |
| The population and superpopulation of each of those genomes                                                   | [20130606_g1k_3202_samples_ped_population.txt](https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/data_collections/1000G_2504_high_coverage/20130606_g1k_3202_samples_ped_population.txt) |
| NCBI's ortholog report, the rows of the alignment                                                             | [rest-api/](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/reference-docs/rest-api/)                                                                                               |

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
  fit both haemoglobin tetramers in the asymmetric unit
- pick **Use as reference row** on the `human_query` tip of the alignment's
  tree: the human sequence pins above the alignment, and a residue matching it
  draws as a dot
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

## Sickle allele by ancestry in 1000 Genomes

The 1000 Genomes callset is a VCF with a column per genome, and JBrowse can draw
one row per genome, colored by a column of a sample sheet. The release's ped
file holds each genome's population and superpopulation. This turns it into the
sheet JBrowse reads, sorted so each superpopulation is one block of rows:

```bash
awk 'BEGIN{OFS="\t"} NR>1 {print $2,$6,$7}' samples_ped_population.txt \
  | sort -t$'\t' -k3,3 -k2,2 \
  | (printf 'name\tpopulation\tsuperpopulation\n'; cat) > samples.tsv
```

Add the callset as a track, with a hosted copy of that sheet:

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
    },
    "samplesTsvLocation": {
      "uri": "https://jbrowse.org/demos/1000g/1kgp_3202_superpopulations.tsv"
    }
  },
  "displays": [
    {
      "type": "LinearMultiSampleVariantDisplay",
      "displayId": "kgp3202_chr11_snv-LinearMultiSampleVariantDisplay",
      "rowColor": "superpopulation"
    }
  ]
}
```

Read two columns. rs334 sits under the highlighted codon, and rs713040, a
synonymous change in the His3 codon four codons upstream, sits to its left on
screen. HbC, rs33930165, a second allele of the same codon, shares the
highlighted column.

<Figure src="/img/protein/hbb_1000_genomes.png" caption="1000 Genomes genotypes under HBB, one row per genome, colored down the left edge by superpopulation." />

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

In the protein view's header, the **From the alignment** rows list the same
domains and sites.

<Figure src="/img/protein/hbb_domains_three_views.png" caption="HBB in three linked views, colored by the alignment's domains: the genome's domain track, the alignment's rows and the 2HBS cartoon. On the structure a cartoon color marks a domain and side-chain sticks mark a site." />

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
- any VCF with a sample sheet adds the population layer, colored by whichever
  column of the sheet you name in `rowColor`

## See also

- [](/docs/tutorials/protein_variants_dog_myelopathy)
- [](/docs/tutorials/protein_variants_seedless_grape)
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
