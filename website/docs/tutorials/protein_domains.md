---
title: Protein domains on gene models
sidebar_label: Protein domains (Pfam)
description:
  Call Pfam domains on a genome's proteins, place each domain on the exons that
  encode it, and draw the domains under the genes, one row per isoform
guide_category: Tutorials
tutorial_category: Genes & annotation
---

A gene model shows where the exons are, and Pfam names the protein domains they
encode, such as a kinase or a DNA-binding fold. Domain callers report each
domain in residues along the protein, so the domains need placing back on the
exons before they line up under the genes. Done for every transcript, the
placement shows which exons encode each domain and which isoforms leave one out.
We work through the honey bee RefSeq annotation and the _vav_ gene (LOC413488),
whose isoforms differ at their first domain. We:

- translate the gene models and call Pfam domains on the proteins with `hmmscan`
- place each domain on the exons that encode it with
  `jbrowse make-protein-features`
- load the domains as a track under the genes, colored by Pfam family

## Prerequisites

- a JBrowse to paste the track into ([Web](/docs/quickstart_web) or
  [Desktop](/docs/quickstart_desktop)), or the honey bee genome on
  [genomes.jbrowse.org](https://genomes.jbrowse.org)
- `gffread`, which translates each transcript's CDS
- HMMER (`hmmscan`, `hmmpress`), which calls the domains
- htslib (`bgzip`, `tabix`), which indexes the domain file
- `node`, for the [JBrowse CLI](/docs/cli)
- samtools, for the FASTA index the [build script](#reproduce-it-end-to-end)
  writes

<!-- TUTORIAL_INSTALL gffread,hmmer,htslib,samtools,node,jbrowse-cli START -->

```bash
# Debian/Ubuntu
sudo apt install gffread hmmer tabix samtools nodejs
# or conda, which has every tool above
conda install -c bioconda -c conda-forge gffread hmmer htslib samtools \
  nodejs
# any platform
npm install -g @jbrowse/cli
```

<!-- TUTORIAL_INSTALL gffread,hmmer,htslib,samtools,node,jbrowse-cli END -->

## The data

The figures read the honey bee Amel_HAv3.1 assembly and its NCBI RefSeq
annotation from genomes.jbrowse.org, and a Pfam domain file built from that
annotation with the commands below. Nothing to download to follow the page: the
track config reads the domain file by URL. The commands take your own genome
FASTA and GFF3 the same way.

| What it is                                                 | File                                                                                                                                                                          |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The honey bee genome, which gffread reads the CDS from     | [GCF_003254395.2_Amel_HAv3.1_genomic.fna.gz](https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/003/254/395/GCF_003254395.2_Amel_HAv3.1/GCF_003254395.2_Amel_HAv3.1_genomic.fna.gz) |
| Its RefSeq gene models, which the domains are placed on    | [GCF_003254395.2_Amel_HAv3.1_genomic.gff.gz](https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/003/254/395/GCF_003254395.2_Amel_HAv3.1/GCF_003254395.2_Amel_HAv3.1_genomic.gff.gz) |
| The Pfam HMM library, about 400 MB, which hmmscan searches | [Pfam-A.hmm.gz](https://ftp.ebi.ac.uk/pub/databases/Pfam/current_release/Pfam-A.hmm.gz)                                                                                       |

## Calling Pfam domains on the proteins

We'll start from the two files any annotation project has, the genome FASTA and
the gene models, and translate every transcript's CDS into a protein FASTA:

<!-- from: scripts/build_protein_domains.sh -->

```bash
# -y writes each protein named by its transcript ID; -S spells a stop codon `*`,
# which HMMER reads and gffread's default `.` is not. gffread wants the FASTA
# uncompressed.
gffread -S -y proteins.fa -g genome.fa genes.gff3
```

`hmmscan` searches each protein against every Pfam family and writes one row per
domain hit, in residue coordinates along the protein. The library needs pressing
once:

<!-- from: scripts/build_protein_domains.sh -->

```bash
hmmpress Pfam-A.hmm
```

<!-- from: scripts/build_protein_domains.sh -->

```bash
# --cut_ga: each Pfam family's curated gathering threshold, the cutoff InterPro
# uses, in place of one E-value for every family. A whole insect proteome takes
# an hour or two.
hmmscan --cut_ga --cpu 16 --noali --domtblout pfam.domtblout Pfam-A.hmm proteins.fa >/dev/null
```

An annotation pipeline that already ran InterProScan has the same calls in its
TSV output (`-f tsv`), which the next step reads in place of `pfam.domtblout`.

## Placing the domains on the exons

`jbrowse make-protein-features` walks each transcript's CDS in the direction of
translation and places each domain on the bases that encode it, on either strand
and across introns. It writes a bgzipped, indexed BED with one row per domain
per transcript:

<!-- from: scripts/build_protein_domains.sh -->

```bash
# matches each protein to its transcript by transcript ID, CDS protein_id or
# CDS ID, so gffread, NCBI and Ensembl protein names all work. Where HMMER hits
# on one protein overlap, the lowest E-value is kept.
jbrowse make-protein-features genes.gff3 pfam.domtblout --out pfam.bed.gz
```

- A domain crossing an intron is one row with a block per exon, as BED12 draws a
  spliced transcript.
- The row's `name` is the Pfam family; `accession`, `description`, `transcript`,
  `proteinStart`, `proteinEnd` and `evalue` follow as named columns, and JBrowse
  shows them on click.
- `--source Pfam` keeps only the Pfam rows of an InterProScan TSV.

## Loading the domains under the genes

The domain track reads the BED with `disableGeneHeuristic`, which stops JBrowse
drawing a stranded BED12 row as a coding transcript, and colors each domain by
its family:

```json addtrack loc=NC_037640.1:1,971,400-1,976,800
{
  "type": "FeatureTrack",
  "trackId": "pfam_domains",
  "name": "Pfam domains",
  "assemblyNames": ["GCF_003254395.2"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "https://jbrowse.org/demos/protein_domains/pfam.bed.gz",
    "disableGeneHeuristic": true
  },
  "displayDefaults": {
    "color": { "field": "name" }
  }
}
```

Point `uri` at your own `pfam.bed.gz` and `assemblyNames` at your assembly.

To follow along on genomes.jbrowse.org, open the honey bee genome, add the track
above, go to `NC_037640.1:1,971,400-1,976,800`, and turn on the gene track,
**NCBI RefSeq - RefSeq All (GFF)**.

The track draws one copy of each domain per isoform, and a domain crossing an
intron as blocks joined like the exons above it. Clicking a domain shows its
transcript, accession and residue range.

<Figure src="/img/protein_domains/vav.png" caption="Honey bee vav: the four RefSeq isoforms over the Pfam domains they encode, colored by family. The top isoform skips the exon encoding CH, so CH has three copies where the other domains have four." />

## Reproduce it end to end

[`build_protein_domains.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_protein_domains.sh)
runs every step above on your own genome FASTA and GFF3. The script:

1. Translates each transcript's CDS with gffread.
2. Downloads and presses the Pfam library once, then calls domains with hmmscan.
3. Places the domains on the exons with `jbrowse make-protein-features`.
4. Builds a JBrowse with the genome, the genes and the domain track.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_protein_domains.sh
bash build_protein_domains.sh genome.fa genes.gff3   # builds ./protein_domains_build/jbrowse2
npx --yes serve protein_domains_build/jbrowse2       # then open the printed URL
```

The script reads `genome.fa` and `genes.gff3` plain or gzipped, and
`THREADS=32 bash build_protein_domains.sh ...` gives hmmscan more cores.

## See also

- [](/docs/tutorials/genomes_proteins)
- [](/docs/tutorials/protein_variants_tp53)
- [](/docs/user_guides/multirow_feature_track)
- [](/docs/tutorials/repeatmasker_classes)
- [](/docs/cli)

## Citations

- Mistry et al. (2021).
  [Pfam: The protein families database in 2021](https://doi.org/10.1093/nar/gkaa913)
- Eddy (2011).
  [Accelerated profile HMM searches](https://doi.org/10.1371/journal.pcbi.1002195)
- Pertea and Pertea (2020).
  [GFF utilities: GffRead and GffCompare](https://doi.org/10.12688/f1000research.23297.2)
- Wallberg et al. (2019).
  [A hybrid de novo genome assembly of the honeybee, Apis mellifera, with chromosome-length scaffolds](https://doi.org/10.1186/s12864-019-5642-0)
