---
title: Sickle cell from GWAS hit to protein structure
sidebar_label: Proteins (sickle cell variant)
description:
  Follow the sickle cell allele of HBB from its GWAS Catalog associations and
  its distribution across 1000 Genomes ancestries to the residue it changes in
  the crystal structure of sickle haemoglobin
guide_category: Tutorials
tutorial_category: Transcriptomics & proteins
---

Sickle cell disease comes from one base change in _HBB_, the gene for the β
chain of haemoglobin. Codon 7 changes from GAG to GTG, so glutamate 6 of the
mature protein becomes valine. The variant, rs334, turns up again and again in
genome-wide association studies, and its frequency differs sharply between
ancestries. We put all of that in one JBrowse session beside the residue it
changes, in a crystal structure of sickle haemoglobin. We'll:

- open _HBB_ on codon 7 in the protein browser, with structure 2HBS, and hover
  the codon to find its residue
- add the GWAS Catalog and read what has been associated with rs334
- add 1000 Genomes genotypes grouped by ancestry, with a common synonymous
  variant four codons upstream as the control

## Prerequisites

- for your own JBrowse, the protein3d and msaview plugins from the
  [plugin store](/docs/user_guides/plugin_store); genomes.jbrowse.org already
  loads them

## Where the data comes from

Nothing to download: the protein browser, the plugins and the track config below
read these files by URL.

<details>
<summary>The files</summary>

- sickle haemoglobin, deoxy form, PDB 2HBS:
  https://files.rcsb.org/download/2HBS.cif
- the NHGRI-EBI GWAS Catalog, which UCSC distributes as its GWAS Catalog track
  and the hosted hg38 config loads: https://www.ebi.ac.uk/gwas/
- the 1000 Genomes 30x callset for chr11, 3,202 genomes:
  https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/data_collections/1000G_2504_high_coverage/working/20220422_3202_phased_SNV_INDEL_SV/
- the population and superpopulation of each of those genomes:
  https://ftp.1000genomes.ebi.ac.uk/vol1/ftp/data_collections/1000G_2504_high_coverage/20130606_g1k_3202_samples_ped_population.txt
- NCBI's ortholog report, the rows of the alignment:
  https://www.ncbi.nlm.nih.gov/datasets/docs/v2/reference-docs/rest-api/

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
- hover the highlighted codon

Residue 7 counts the initiator methionine, which the mature protein loses, so
the literature's Glu6 is the transcript's residue 7. The protein view's header
reads both numbers off the hover and compares the two letters, glutamate in the
transcript and valine in the crystal.

<Figure src="/img/protein/hbb_codon_hover.png" caption="HBB at codon 7 with its ortholog alignment below and 2HBS beside. The codon band, the orange alignment column and Val6 in magenta mark the same position, and the header reads Structure: V, Genome: E." />

## The GWAS Catalog at rs334

Open the track selector from the genome view's menu, **Open track selector**,
search `GWAS Catalog`, and tick it. The catalog has one record per study and
trait, so a variant studied many times draws as a stack. Click a box to open its
record.

<Figure src="/img/protein/hbb_gwas_catalog.png" caption="The GWAS Catalog under HBB. The stack sits on codon 7 and nothing else in the window has an association." />

The 134 records at rs334 include malaria, haemolytic anaemias, glycated
haemoglobin (HbA1c) and kidney function.

## Sickle allele by ancestry in 1000 Genomes

The 1000 Genomes callset is a VCF of 3,202 genomes, and JBrowse can draw one row
per genome, colored by a column of a sample sheet. The release's ped file holds
each genome's population and superpopulation. This turns it into the sheet
JBrowse reads, sorted so each superpopulation is one block of rows:

```bash
awk 'BEGIN{OFS="\t"} NR>1 {print $2,$6,$7}' samples_ped_population.txt \
  | sort -t$'\t' -k3,3 -k2,2 \
  | (printf 'name\tpopulation\tsuperpopulation\n'; cat) > samples.tsv
```

Add the callset as a track, with a hosted copy of that sheet:

```json addtrack
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

<Figure src="/img/protein/hbb_1000_genomes.png" caption="1000 Genomes genotypes under HBB, one row per genome, colored down the left edge by superpopulation. Under the sickle codon the alternate genotypes sit in the African-ancestry block; the rs713040 column runs through every block." />

## Your own gene

Each step on this page works on any gene the protein browser opens:

- the chips under the search box open other organisms on a residue each, from
  _M. tuberculosis_ _rpoB_ to dog _SOD1_, on genomes.jbrowse.org's GenArk
  assemblies
- **Launch protein view** in a gene's right-click menu picks the structure
  yourself, and its **File or URL** tab takes a PDB or mmCIF of your own, such
  as a ColabFold or AlphaFold model
- any VCF with a sample sheet adds the population layer, colored by whichever
  column of the sheet you name in `rowColor`

## See also

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
