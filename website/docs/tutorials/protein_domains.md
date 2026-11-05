---
title: Protein domains on gene models
sidebar_label: Protein domains (Pfam)
description:
  Call Pfam domains on a genome's proteins, place each domain on the exons that
  encode it, and draw each isoform with its domains in a separate row
guide_category: Tutorials
tutorial_category: Genes & annotation
---

A gene model shows where the exons are, and Pfam names the protein domains they
encode, such as a kinase or a DNA-binding fold. Domain callers report each
domain in residues along the protein, so the domains need placing back on the
exons before JBrowse can draw them under the genes. The placement for every
transcript shows which exons encode each domain and which isoforms lack one. We
work through the honey bee RefSeq annotation and the _Su(var)3-9_ gene, whose
isoforms encode two different proteins. We:

- translate the gene models and call Pfam domains on the proteins with `hmmscan`
- place each domain on the exons that encode it with `domains2genome`
- draw each transcript in a separate row of the multi-row feature display, with
  its domains over its exons colored by Pfam family

## Prerequisites

- a JBrowse to paste the track into ([Web](/docs/quickstart_web) or
  [Desktop](/docs/quickstart_desktop)), or the honey bee genome on
  [genomes.jbrowse.org](https://genomes.jbrowse.org)
- `gffread`, which translates each transcript's CDS
- HMMER (`hmmscan`, `hmmpress`), which calls the domains
- htslib (`bgzip`, `tabix`), which indexes the domain file
- `node`, whose `npx` runs
  [domains2genome](https://github.com/GMOD/domains2genome)
- samtools, for the FASTA index the [build script](#reproduce-it-end-to-end)
  writes

<!-- BEGIN GENERATED TUTORIAL_INSTALL gffread,hmmer,htslib,samtools,node -->

```bash
# Debian/Ubuntu
sudo apt install gffread hmmer tabix samtools nodejs
# or conda, which has every tool above
conda install -c bioconda -c conda-forge gffread hmmer htslib samtools \
  nodejs
```

<!-- END GENERATED TUTORIAL_INSTALL gffread,hmmer,htslib,samtools,node -->

## The data

The figures read the honey bee Amel_HAv3.1 assembly and its NCBI RefSeq
annotation from genomes.jbrowse.org, and a Pfam domain file built from that
annotation with the commands below. You don't need these files to follow the
page, since the track config reads a hosted copy of the domain file; to build
your own, run the commands on your genome FASTA and GFF3.

| What it is                                                                         | File                                                                                                                                                                          |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The honey bee genome, which gffread reads the CDS from                             | [GCF_003254395.2_Amel_HAv3.1_genomic.fna.gz](https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/003/254/395/GCF_003254395.2_Amel_HAv3.1/GCF_003254395.2_Amel_HAv3.1_genomic.fna.gz) |
| Its RefSeq gene models, which the domains are placed on                            | [GCF_003254395.2_Amel_HAv3.1_genomic.gff.gz](https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/003/254/395/GCF_003254395.2_Amel_HAv3.1/GCF_003254395.2_Amel_HAv3.1_genomic.gff.gz) |
| The Pfam HMM library, about 400 MB and 1.5 GB once pressed, which hmmscan searches | [Pfam-A.hmm.gz](https://ftp.ebi.ac.uk/pub/databases/Pfam/current_release/Pfam-A.hmm.gz)                                                                                       |

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
domain hit, in residue coordinates along the protein. The library downloads
gzipped, and needs unpacking and pressing once:

<!-- from: scripts/build_protein_domains.sh -->

```bash
gzip -d Pfam-A.hmm.gz
```

<!-- from: scripts/build_protein_domains.sh -->

```bash
hmmpress Pfam-A.hmm
```

```bash
# --cut_ga: each Pfam family's curated gathering threshold, the cutoff InterPro
# uses, in place of one E-value for every family. hmmscan keeps about two cores
# busy whatever --cpu asks for, so the build script splits proteins.fa into
# chunks and scans them at once, about a quarter hour for an insect proteome
# with THREADS=18.
hmmscan --cut_ga --cpu 2 --noali --domtblout pfam.domtblout Pfam-A.hmm proteins.fa >/dev/null
```

An annotation pipeline that already ran InterProScan 6 has the same calls in its
GFF3 output (`--formats gff3`), named by Pfam's short family names. The next
step reads it in place of `pfam.domtblout`, with `--source Pfam` to keep only
the Pfam rows.

## Placing the domains on the exons

`domains2genome` walks each transcript's CDS in the direction of translation and
places each domain on the bases that encode it, on either strand and across
introns. With `--gff3` it writes each coding transcript as an mRNA with its
exons and CDS, and each domain on it as a `protein_match` child, which bgzip
compresses:

<!-- from: scripts/build_protein_domains.sh -->

```bash
# matches each protein to its transcript by transcript ID, CDS protein_id or
# CDS ID, so gffread, NCBI and Ensembl protein names all work. Where HMMER hits
# on one protein overlap by more than half, the lowest E-value is kept.
npx -y 'domains2genome@>=2.4.0' genes.gff3 pfam.domtblout --gff3 | bgzip >pfam.gff3.gz
```

tabix indexes the GFF3, so JBrowse reads only the region on screen:

<!-- from: scripts/build_protein_domains.sh -->

```bash
tabix -f -C -p gff pfam.gff3.gz
```

- A `protein_match`'s `Name` is the Pfam family, its source column the analysis
  and its score the E-value; `accession`, `description`, `proteinStart` and
  `proteinEnd` are attributes, and JBrowse shows them on click.
- A domain crossing an intron is one `protein_match` written on a line per exon,
  the lines sharing an ID.
- The mRNA has the annotation's ID and `Name`, the name the gene track labels
  the transcript with, and its `protein_id` and `product`.
- Every coding transcript is written, with or without a domain on it.
- Without `--gff3`, domains2genome writes the domains alone as BED12, one row
  per domain per transcript, which IGV and the UCSC browser draw too.

## Drawing the domains on their transcripts

JBrowse loads the file as a track in the multi-row feature display, which gives
each transcript a row: its UTR thin and light grey, its coding exons full height
and darker, and its domains over them. `encoding.color` colors each domain by
its Pfam family, and the key names both greys and the families on screen.

```json addtrack loc=NC_037653.1:4,839,300-4,850,050
{
  "type": "FeatureTrack",
  "trackId": "pfam_domains",
  "name": "Pfam domains",
  "assemblyNames": ["GCF_003254395.2"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "uri": "https://jbrowse.org/demos/protein_domains/pfam.gff3.gz",
    "csi": true
  },
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "displayId": "pfam_domains-LinearMultiRowFeatureDisplay",
      "encoding": {
        "color": { "field": "name", "legend": { "title": "Pfam family" } }
      }
    }
  ]
}
```

For your own data, point `uri` at your `pfam.gff3.gz` and `assemblyNames` at
your assembly. To follow along on genomes.jbrowse.org, open the honey bee
genome, add the track above, and go to `NC_037653.1:4,839,300-4,850,050`.

<Figure src="/img/protein_domains/suvar39.png" caption="Honey bee Su(var)3-9: each RefSeq transcript in a separate row, its UTR and coding exons grey and its Pfam domains over them, colored by family." />

The two curated transcripts (NM_) encode different proteins from the same first
three exons. NM_001040277.1 goes on into the exon that encodes Chromo, Pre-SET
and SET, the Su(var)3-9 histone methyltransferase. NM_001171169.1 skips that
exon and joins the exons of eIF2γ, the GTP-binding subunit of translation
initiation factor 2, and so has the GTP_EFTU, GTP_EFTU_D2 and eIF2_C domains.
XM_006561307.3 and XM_006561308.3, which differ only at their 5′ ends, leave the
Su(var)3-9 exon partway through SET and continue into the eIF2γ exons, so each
encodes Chromo and Pre-SET and the eIF2γ domains in one protein. The two genes
share one transcription unit across the insects that undergo complete
metamorphosis (Krauss and Reuter, 2000). XM_001121123.5 is a transcript of the
neighboring gene.

## Reproduce it end to end

[`build_protein_domains.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_protein_domains.sh)
runs every step above on your own genome FASTA and GFF3. The script:

1. Translates each transcript's CDS with gffread.
2. Downloads and presses the Pfam library once, then calls domains with hmmscan,
   on chunks of the proteins at once.
3. Places the domains on the exons with domains2genome.
4. Builds a JBrowse with the genome, the genes and the domain track.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_protein_domains.sh
bash build_protein_domains.sh genome.fa genes.gff3   # builds ./protein_domains_build/jbrowse2
npx --yes serve protein_domains_build/jbrowse2       # then open the printed URL
```

The script reads `genome.fa` and `genes.gff3` plain or gzipped, and
`THREADS=32 bash build_protein_domains.sh ...` scans more chunks at once.

## See also

- [](/docs/tutorials/genomes_proteins)
- [](/docs/tutorials/protein_variants_kras)
- [](/docs/user_guides/multirow_feature_track)
- [](/docs/tutorials/repeatmasker_classes)
- [](/docs/cli)

## Citations

- Mistry et al. (2021).
  [Pfam: The protein families database in 2021](https://doi.org/10.1093/nar/gkaa913)
- Eddy (2011).
  [Accelerated profile HMM searches](https://doi.org/10.1371/journal.pcbi.1002195)
- Krauss and Reuter (2000).
  [Two genes become one: the genes encoding heterochromatin protein Su(var)3-9 and translation initiation factor subunit eIF-2gamma are joined to a dicistronic unit in holometabolic insects](https://doi.org/10.1093/genetics/156.3.1157)
- Pertea and Pertea (2020).
  [GFF utilities: GffRead and GffCompare](https://doi.org/10.12688/f1000research.23297.2)
- Wallberg et al. (2019).
  [A hybrid de novo genome assembly of the honeybee, Apis mellifera, with chromosome-length scaffolds](https://doi.org/10.1186/s12864-019-5642-0)
