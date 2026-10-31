---
title: 'Variants on protein structures part 7: MET exon 14 skipping'
sidebar_label: Proteins (variants pt 7, MET exon 14)
description:
  Find an exon skipped in RNA-seq reads, find the DNA change that causes it at
  the splice site, and follow the missing exon onto a crystal structure of the
  protein it would have bound, in MET from two lung cancer cell lines
guide_category: Tutorials
tutorial_category: Transcriptomics & proteins
tutorial_subcategory: Variants on protein structures
---

Some variants change no amino acid. They break a splice site, the cell splices
the exon out of the RNA, and the protein comes out shorter. In lung cancer, many
different DNA changes around exon 14 of _MET_ all make the RNA join exon 13
straight to exon 15. Exon 14 encodes tyrosine 1003, which the enzyme CBL binds
to mark the MET receptor for degradation
([Kong-Beltran et al. 2006](https://doi.org/10.1158/0008-5472.CAN-05-2749)). We
look at reads from two lung cancer cell lines in the Cancer Cell Line
Encyclopedia: NCI-H596, which skips the exon, and EBC-1, which keeps it. We:

- open _MET_ in the protein browser beside structure 3BUX, CBL bound to the
  stretch of MET around tyrosine 1003
- add DNA and RNA-seq reads as alignment tracks, with arcs for the splice
  junctions
- highlight exon 14 and follow it onto the structure
- copy the view to the splice site and sort the DNA reads on its first intron
  base

## Prerequisites

- for your own JBrowse, the protein3d and msaview plugins from the
  [plugin store](/docs/user_guides/plugin_store); genomes.jbrowse.org already
  loads them
- for your own reads, `hisat2` and `samtools`

<!-- TUTORIAL_INSTALL hisat2,samtools START -->

```bash
# Debian/Ubuntu
sudo apt install hisat2 samtools
# or conda, which has every tool above
conda install -c bioconda -c conda-forge hisat2 samtools
```

<!-- TUTORIAL_INSTALL hisat2,samtools END -->

## The data

Nothing to download: the tracks read the BAM files by URL. They hold the reads
around _MET_ exons 13 to 15 from CCLE
([Ghandi et al. 2019](https://doi.org/10.1038/s41586-019-1186-3)), aligned to
hg38 with HISAT2. A BAM of your own, with its `.bai` index beside it, loads the
same way.

<details>
<summary>Read by URL (no download needed)</summary>

| What it is                                                        | File                                                                       |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------- |
| NCI-H596 whole-genome reads                                       | [NCI-H596_DNA.bam](https://jbrowse.org/demos/metex14/NCI-H596_DNA.bam)     |
| NCI-H596 RNA-seq reads                                            | [NCI-H596_RNA.bam](https://jbrowse.org/demos/metex14/NCI-H596_RNA.bam)     |
| EBC-1 RNA-seq reads, 5% of them, since EBC-1 has extra MET copies | [EBC-1_RNA_5pct.bam](https://jbrowse.org/demos/metex14/EBC-1_RNA_5pct.bam) |
| CBL bound to MET residues 997 to 1009, PDB 3BUX                   | [3BUX.cif](https://files.rcsb.org/download/3BUX.cif)                       |

</details>

## Aligning your own RNA-seq reads

A splice-aware aligner writes each read that crosses an intron as one alignment
with a gap, and JBrowse draws those gaps as junction arcs. HISAT2 gives a BAM
the protein browser can read:

```bash
# -x: a HISAT2 index of hg38; -1/-2: the read pairs
hisat2 -p 8 -x hg38 -1 reads_1.fq.gz -2 reads_2.fq.gz | samtools sort -o rna.bam -
```

```bash
# the .bai index lets JBrowse fetch one region at a time
samtools index rna.bam
```

## Opening MET beside CBL

The protein browser opens a gene's exons, an alignment of the protein across
species and a structure, linked:

- open
  [genomes.jbrowse.org/protein-browser/?gene=MET&ref=9606&structure=3bux](https://genomes.jbrowse.org/protein-browser/?gene=MET&ref=9606&structure=3bux)
  and click **Open in JBrowse ↗**
- pick **Assembly** in the protein view's menu, then the entry for assembly 5,
  marked dimeric. 3BUX opens on its first assembly, the MET stretch alone;
  assembly 5 adds CBL
- close the MET orthologs view with the × on its title bar, and the ClinVar and
  AlphaMissense tracks with the × on each track's label
- type
  `chr7:116771458-116771694 chr7:116771809-116772029 chr7:116774841-116775151`
  into the location box, which keeps exons 13, 14 and 15 with a little intron on
  each side

## Adding the reads

Each BAM goes in through **File → Open track...**, given its URL. Its `.bai`
index is found beside it:

- open `https://jbrowse.org/demos/metex14/NCI-H596_DNA.bam`, then
  `NCI-H596_RNA.bam` and `EBC-1_RNA_5pct.bam` from the same folder
- on each RNA-seq track, turn off **Show → Pileup** and turn on **Show → Sashimi
  read counts** in the track menu, which leaves the coverage and an arc for each
  junction, labelled with its number of reads

## Following exon 14 onto the structure

A highlight on the genome reaches every linked view:

- drag across exon 14 on the scale bar and pick **Highlight region**
- click the link chip at the top of the band, pick **Edit label...** and type
  `exon 14`

The residues of 3BUX that exon 14 encodes take the highlight. Rotate the
structure until they face you; they lie in a groove on CBL.

## The cause at the splice site

The first two bases of an intron are almost always GT, and the splicing
machinery reads them to find the end of the exon. We copy the view to the end of
exon 14:

- pick **View options → Copy view** in the view's menu; the copy opens under the
  first view, so scroll down to it and close its RNA-seq tracks
- type `chr7:116771975-116772005` into the copy's location box
- right-click a read at chr7:116,771,990 and pick **Sort by → Base**

<Figure src="/img/protein/met_ex14.png" caption="MET exons 13 to 15 with NCI-H596 DNA and RNA-seq reads and EBC-1 RNA-seq reads (A), the view copied to the end of exon 14 (B), and 3BUX with the exon 14 highlight on the MET stretch CBL binds (C)." />

In panel A, the NCI-H596 arcs leave exon 13 and land on exon 15, over a dip in
coverage across exon 14, while the EBC-1 arcs enter exon 14 and leave it. In
panel B, every NCI-H596 read carries T where the reference has the G of the
intron's GT. Without exon 14 the receptor lacks tyrosine 1003, the residue CBL
binds in panel C, and CBL marks it for degradation less
([Kong-Beltran et al. 2006](https://doi.org/10.1158/0008-5472.CAN-05-2749)).

## Your own reads

- start from the arcs: an arc that jumps an exon in one sample and not in
  another is the skip, whatever its cause
- then open the DNA reads at the exon's two ends; a skip can come from a base
  change at the splice site, as here, or a deletion that removes it
- any gene the protein browser opens takes the same steps, and **Launch protein
  view** in a gene's right-click menu picks another structure

## Reproduce it end to end

[`scripts/build_metex14.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_metex14.sh)
builds the three BAM files from CCLE's public data in SRA. It:

1. Downloads hg38 chromosome 7 and builds a HISAT2 index of it.
2. Streams the reads CCLE placed around _MET_ exons 13 to 15 from SRA, without
   downloading whole runs.
3. Aligns them to hg38 with HISAT2, the RNA-seq reads spliced and the DNA reads
   not, then sorts and indexes each BAM.
4. Keeps 5% of the EBC-1 reads, which brings its depth near NCI-H596's.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_metex14.sh
bash build_metex14.sh
```

## See also

- [](/docs/tutorials/protein_variants_sickle_cell)
- [](/docs/tutorials/protein_variants_kras)
- [](/docs/tutorials/genomes_proteins)
- [](/docs/user_guides/highlights)

## External links

- [Protein browser](https://genomes.jbrowse.org/protein-browser/)
- [Cancer Cell Line Encyclopedia](https://depmap.org/portal/ccle/)
- [jbrowse-plugin-protein3d](https://github.com/GMOD/jbrowse-plugin-protein3d)

## Citations

- Ghandi et al. (2019).
  [Next-generation characterization of the Cancer Cell Line Encyclopedia](https://doi.org/10.1038/s41586-019-1186-3)
- Kim et al. (2019).
  [Graph-based genome alignment and genotyping with HISAT2 and HISAT-genotype](https://doi.org/10.1038/s41587-019-0201-4)
- Kong-Beltran et al. (2006).
  [Somatic mutations lead to an oncogenic deletion of met in lung cancer](https://doi.org/10.1158/0008-5472.CAN-05-2749)
- Ng et al. (2008).
  [Structural basis for a novel intrapeptidyl H-bond and reverse binding of c-Cbl-TKB domain substrates](https://doi.org/10.1038/emboj.2008.18)
