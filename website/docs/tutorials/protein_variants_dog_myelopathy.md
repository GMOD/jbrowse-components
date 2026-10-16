---
title: 'Variants on protein structures part 2: degenerative myelopathy in dogs'
sidebar_label: Proteins (variants pt 2, dog SOD1)
description:
  Open dog SOD1 on codon 40 beside a crystal structure of the E40K protein that
  causes degenerative myelopathy, then read the allele across 1,987 breed dogs,
  village dogs and wild canids from the Dog10K callset
guide_category: Tutorials
tutorial_category: Transcriptomics & proteins
tutorial_subcategory: Variants on protein structures
---

Degenerative myelopathy is a late-onset paralysis of dogs that resembles
amyotrophic lateral sclerosis in people. A genome-wide association study found
the risk allele in _SOD1_: c.118G>A changes glutamate 40 of superoxide dismutase
to lysine (E40K), and most affected dogs are homozygous for it
([Awano et al. 2009](https://doi.org/10.1073/pnas.0812297106)). We put the codon
beside a crystal structure of the E40K protein itself, then read the allele
across the Dog10K collection, where wolves and coyotes are the control: an
allele no wild canid has arose after domestication. We'll:

- open _SOD1_ on codon 40 of the canFam4 dog assembly and launch structure 7WX0
  and an ortholog alignment from the gene's right-click menu
- slice _SOD1_ out of the Dog10K SNV callset and make a sample sheet of each
  animal's category
- add the slice as a track, one row per animal, colored by category

[Part 1](/docs/tutorials/protein_variants_sickle_cell) opened its gene from the
protein browser. The protein browser opens dog genes on a Labrador assembly, and
Dog10K is called against canFam4, so here we launch the same three views
ourselves on canFam4.

## Prerequisites

- for your own JBrowse, the protein3d and msaview plugins from the
  [plugin store](/docs/user_guides/plugin_store); genomes.jbrowse.org already
  loads them
- `bcftools` built with libcurl, and htslib (`tabix`)
- `curl`

## Where the data comes from

The Dog10K consortium's public share
([Meadows et al. 2023](https://doi.org/10.1186/s13059-023-03023-7)). The
commands below read these files from their URLs, so there is nothing to download
by hand.

- the SNV callset, 397 GB over 1,987 canids on canFam4 (UU_Cfam_GSD_1.0):
  https://kiddlabshare.med.umich.edu/dog10K/SNP_and_indel_calls_2021-10-17/AutoAndXPAR.SNPs.vqsr99.vcf.gz
- the sample table, breed and category per animal:
  https://kiddlabshare.med.umich.edu/dog10K/sample-information/dog10K-alignment-sample-table.2022-02-23-v7.txt

<details>
<summary>Read by URL (no download needed)</summary>

- canine SOD1 E40K, PDB 7WX0: https://files.rcsb.org/download/7WX0.cif
- NCBI's ortholog report, the rows of the alignment:
  https://www.ncbi.nlm.nih.gov/datasets/docs/v2/reference-docs/rest-api/

</details>

## Opening SOD1 on codon 40 with the E40K structure

Codon 40 of NM_001003035.1 sits in _SOD1_'s second coding exon, at
chr31:27,123,057-27,123,059 on canFam4. Open the
[canFam4 hub on genomes.jbrowse.org](https://genomes.jbrowse.org/ucsc/canFam4/)
and:

- type `chr31:27123013-27123103` into the location box
- in the track selector, tick **NCBI RefSeq - RefSeq Curated**
- right-click the _SOD1_ transcript and choose **Launch protein view**. On the
  **PDB search** tab pick 7WX0, then choose **Open side by side** from the arrow
  beside **Launch**
- right-click the transcript again and choose **Launch MSA view**, which opens
  on its **Orthologs** tab; press **Submit**
- click **Reset Zoom**, the circular arrow at the top right of the structure, to
  fit both chains of the 7WX0 dimer
- hover the alignment column of residue 40

The hover lights the codon on the gene, the column in the alignment and the
residue on the structure, and the protein view's header compares the two
letters: glutamate in the dog genome, lysine in the crystal.

<Figure src="/img/protein/sod1_codon_hover.png" caption="SOD1 at codon 40 on canFam4, its ortholog alignment below and 7WX0 beside. The hovered column, the codon band and Lys40 in magenta mark one position, and the header reads Structure: K, Genome: E." />

## Slicing SOD1 out of Dog10K

The Dog10K callset has a tabix index, so `bcftools` reads one gene over HTTP.
This keeps the genotypes and drops the rest, which leaves a file of a few tens
of kilobytes:

```bash
SNVS=https://kiddlabshare.med.umich.edu/dog10K/SNP_and_indel_calls_2021-10-17/AutoAndXPAR.SNPs.vqsr99.vcf.gz
# -x INFO,^FORMAT/GT: drop every INFO field and every FORMAT field but GT
bcftools annotate -r chr31:27118000-27128000 -x INFO,^FORMAT/GT \
  -Oz -o dog10k_sod1.vcf.gz "$SNVS"
tabix -p vcf dog10k_sod1.vcf.gz
```

The sample table files each animal under a category:

```bash
curl -o sample-table.txt https://kiddlabshare.med.umich.edu/dog10K/sample-information/dog10K-alignment-sample-table.2022-02-23-v7.txt
```

An awk command turns the table into the sheet JBrowse reads, with wolves first,
then coyotes, village dogs, mixed and other dogs, and breed dogs, sorted by
breed within each:

```bash
awk -F'\t' 'BEGIN { OFS = "\t"
    n = split("Wolf Coyote Village_Dogs Mixed/Other Breed_Dogs", o, " ")
    for (i = 1; i <= n; i++) rank[o[i]] = i }
  NR > 1 { print rank[$3], $1, $3, $2 }' sample-table.txt \
  | sort -t$'\t' -k1,1n -k4,4 -k2,2 | cut -f2- \
  | (printf 'name\tcategory\tbreed\n'; cat) > samples.tsv
```

## E40K across breeds, village dogs and wild canids

Add the slice as a track, with hosted copies of the two files:

```json addtrack
{
  "type": "VariantTrack",
  "trackId": "dog10k_sod1",
  "name": "Dog10K SNVs at SOD1",
  "assemblyNames": ["canFam4"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "vcfGzLocation": {
      "uri": "https://jbrowse.org/demos/dog10k_sod1/dog10k_sod1.vcf.gz"
    },
    "index": {
      "location": {
        "uri": "https://jbrowse.org/demos/dog10k_sod1/dog10k_sod1.vcf.gz.tbi"
      }
    },
    "samplesTsvLocation": {
      "uri": "https://jbrowse.org/demos/dog10k_sod1/dog10k_samples.tsv"
    }
  },
  "displays": [
    {
      "type": "LinearMultiSampleVariantDisplay",
      "displayId": "dog10k_sod1-LinearMultiSampleVariantDisplay",
      "rowColor": "category"
    }
  ]
}
```

To put a site the wolves carry beside codon 40, type
`chr31:27122805-27122834 chr31:27123013-27123103` into the location box. The
first region is 30 bp of the upstream intron, around an SNV at chr31:27,122,819.

<Figure src="/img/protein/sod1_dog10k.png" caption="Dog10K genotypes under SOD1, one row per canid, colored down the left edge by category: wolves at the top, then coyotes, village dogs, mixed and other dogs, and breed dogs. Under codon 40 the alternate genotypes sit in the village and breed dog blocks and the wolf rows are reference; the intronic SNV to the left is alternate in every block." />

## Counting E40K carriers by category

The command below joins each animal's genotype at chr31:27,123,057 to its
category in `samples.tsv` and prints carriers, then animals, per category:

```bash
bcftools query -r chr31:27123057 -f '[%SAMPLE\t%GT\n]' dog10k_sod1.vcf.gz \
  | awk -F'\t' 'NR == FNR { cat[$1] = $2; next }
      { n[cat[$1]]++; if ($2 ~ /1/) carriers[cat[$1]]++ }
      END { for (c in n) print c, carriers[c] + 0, n[c] }' samples.tsv - \
  | sort
```

```text
Breed_Dogs 165 1593
Coyote 0 4
Mixed/Other 3 18
Village_Dogs 30 309
Wolf 0 63
```

## See also

- [](/docs/tutorials/protein_variants_sickle_cell)
- [](/docs/tutorials/dog10k_lof)
- [](/docs/tutorials/genomes_proteins)

## External links

- [Dog10K data share](https://kiddlabshare.med.umich.edu/dog10K/)
- [jbrowse-plugin-protein3d](https://github.com/GMOD/jbrowse-plugin-protein3d)
- [jbrowse-plugin-msaview](https://github.com/GMOD/jbrowse-plugin-msaview)

## Citations

- Awano T, Johnson GS, Wade CM, et al. Genome-wide association analysis reveals
  a SOD1 mutation in canine degenerative myelopathy that resembles amyotrophic
  lateral sclerosis. _Proc Natl Acad Sci U S A_ 2009.
  https://doi.org/10.1073/pnas.0812297106
- Hashimoto K, Watanabe S, Akutsu M, et al. Intrinsic structural vulnerability
  in the hydrophobic core induces species-specific aggregation of canine SOD1
  with degenerative myelopathy-linked E40K mutation. _J Biol Chem_ 2023.
  https://doi.org/10.1016/j.jbc.2023.104798
- Meadows JRS, Kidd JM, Wang GD, et al. Genome sequencing of 2000 canids by the
  Dog10K consortium advances the understanding of demography, genome function
  and architecture. _Genome Biol_ 2023.
  https://doi.org/10.1186/s13059-023-03023-7
