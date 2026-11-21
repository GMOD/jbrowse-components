---
title: A bacterial genome annotated by Prokka
sidebar_label: Bacterial genome (Prokka GenBank)
description:
  A bacterial assembly annotated by Prokka and opened from the one GenBank file
  Prokka writes, with its chromosome and plasmids as rings, its genes searchable
  by name and a plasmid saved back out as GenBank
guide_category: Tutorials
tutorial_category: Genes & annotation
---

A bacterial assembly is usually a chromosome and a few plasmids, annotated by a
pipeline such as Prokka, which writes the sequence and every gene it found into
one GenBank file. JBrowse opens that one file as both the genome and its gene
track, so the annotation of a new assembly can be browsed, searched and checked
gene by gene without converting anything. We annotate the assembly of
_Escherichia coli_ O157:H7 Sakai, an outbreak strain whose chromosome and two
plasmids were sequenced in full (Hayashi et al. 2001), and look at the Shiga
toxin genes on its chromosome and the enterohemolysin operon on its plasmid
pO157 (Makino et al. 1998). We:

- annotate the assembly's FASTA with Prokka
- load Prokka's GenBank file as the genome and as a gene track, with the
  chromosome and plasmids marked circular
- index the gene names, find a gene by typing its name, and read its protein
- open pO157 in the circular view
- save pO157 and its genes back out as a GenBank file

## Prerequisites

- a JBrowse to open the sessions in ([Web](/docs/quickstart_web) or
  [Desktop](/docs/quickstart_desktop))
- [Prokka](https://github.com/tseemann/prokka), which annotates the assembly
- [Node.js](https://nodejs.org/), which the JBrowse CLI runs on
- the [JBrowse CLI](/docs/cli), for `jbrowse add-assembly`, `jbrowse add-track`
  and `jbrowse text-index`

<!-- BEGIN GENERATED TUTORIAL_INSTALL prokka,node,jbrowse-cli -->

```bash
# Debian/Ubuntu
sudo apt install nodejs
# or conda, which has every tool above
conda install -c bioconda -c conda-forge nodejs
# prokka in a conda environment of its own
conda create -n prokka -c bioconda -c conda-forge prokka=1.15.6
conda activate --stack prokka
# any platform
npm install -g @jbrowse/cli@next
```

<!-- END GENERATED TUTORIAL_INSTALL prokka,node,jbrowse-cli -->

Installed beside other tools, conda resolves the old Prokka 1.13, so Prokka gets
an environment of its own.

## The data

GCF_000008865.2 is NCBI's assembly of the Sakai strain: the chromosome
NC_002695.2 and the plasmids pOSAK1 (NC_002127.1) and pO157 (NC_002128.1). The
first command below fetches its FASTA, the only input, and every step after it
runs on that copy; for your own genome, use your assembly's FASTA in its place.

| What it is                                 | File                                                                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| The Sakai assembly, a copy of NCBI's FASTA | [GCF_000008865.2_ASM886v2_genomic.fna.gz](https://jbrowse.org/demos/prokka_sakai/GCF_000008865.2_ASM886v2_genomic.fna.gz) |

## Annotating the assembly

We'll download the assembly, 1.6 MB compressed:

```bash
wget -c https://jbrowse.org/demos/prokka_sakai/GCF_000008865.2_ASM886v2_genomic.fna.gz
```

We decompress it for Prokka:

```bash
gzip -dc GCF_000008865.2_ASM886v2_genomic.fna.gz > assembly.fna
```

Prokka finds the genes and names them by similarity to known proteins, then
writes the same annotation in several formats into one directory. On your own
assembly, pick your own locus tag prefix:

<!-- from: scripts/build_prokka_genbank.sh -->

```bash
# --locustag prefixes every gene's locus_tag (SAKAI_00001, ...)
# --cpus 0 uses every core
prokka --outdir annotation --prefix sakai --locustag SAKAI --cpus 0 assembly.fna
```

`annotation/sakai.gbk` is the GenBank file: one record per contig, each with its
sequence and its genes. Prokka names each record after its contig and writes
every record as linear, as each record's first line shows:

```bash
grep '^LOCUS' annotation/sakai.gbk
```

```text output
LOCUS       NC_002695.2          5498578 bp    DNA     linear       21-NOV-2026
LOCUS       NC_002127.1             3306 bp    DNA     linear       21-NOV-2026
LOCUS       NC_002128.1            92721 bp    DNA     linear       21-NOV-2026
```

A contig name longer than the LOCUS line's name column, such as SPAdes's
`NODE_1_length_52345_cov_23.451523`, runs into the length on that line; JBrowse
splits the two again by the record's length, so the refNames match the contig
names in your FASTA and in any reads mapped to it. Prokka refuses a name over 37
characters, though, and its `--centre` and `--compliant` options get past that
by renaming the contigs, after which the names match neither.

## Loading the genome and the genes

We'll run the JBrowse commands from the `annotation` folder, beside `sakai.gbk`.
The GenBank file is the genome, and `circularRefNames` lists the contigs that
are rings, here the chromosome and both plasmids, since Prokka writes every
record as linear. On your own assembly, Flye's `assembly_info.txt` marks each
circular contig `Y`. The add-genome form has no field for `circularRefNames` or
a GenBank file, so in JBrowse Desktop the assembly loads from a
[CLI-built config.json](/docs/tutorials/cli_desktop#open-the-cli-built-folder-in-jbrowse-desktop):

```json addassembly
{
  "name": "sakai",
  "displayName": "E. coli O157:H7 Sakai (Prokka)",
  "uri": "sakai.gbk",
  "circularRefNames": ["NC_002695.2", "NC_002127.1", "NC_002128.1"]
}
```

`sakai.gbk` is also the gene track. Its features are Prokka's CDS, tRNA, rRNA
and tmRNA records, each labeled by its `/gene`, else its `/locus_tag`, and one
CRISPR array as a `repeat_region`:

```json addtrack
{
  "trackId": "sakai_prokka",
  "name": "Prokka genes",
  "assemblyNames": ["sakai"],
  "uri": "sakai.gbk"
}
```

The assembly and the track each read the whole file into memory when the genome
opens, which suits a genome of a few megabases.[^gff]

## Finding a gene by name

We'll index the gene names, so a name typed into the location box goes to the
gene. `text-index` reads each record's `/gene` and `/locus_tag`:

<!-- from: scripts/build_prokka_genbank.sh -->

```bash
jbrowse text-index --tracks sakai_prokka
```

Prokka numbers a name it gives more than once, so typing `stxA` into the
location box offers `stxA_1` and `stxA_2`, the A subunits of the two Shiga toxin
operons on the chromosome. Choosing `stxA_1` opens NC_002695.2 at the gene, with
`stxB_1` beside it.

## Reading a CDS's protein

Clicking a CDS opens its details: the qualifiers Prokka wrote, including its
`/product`, the `/inference` lines naming the protein it was matched to, and its
`/translation`. **Show feature sequence** then reads the CDS's bases from the
genome, and the **Protein** choice in its menu translates them with the genetic
code in the CDS's `/transl_table`:

```json session config=test_data/prokka_sakai/config.json
{
  "defaultSession": {
    "name": "Prokka's stxA_1",
    "views": [
      {
        "type": "LinearGenomeView",
        "assembly": "sakai",
        "loc": "NC_002695.2:1,266,700-1,268,700",
        "tracks": ["sakai_prokka"]
      }
    ]
  }
}
```

<Figure src="/img/prokka_genbank/stx_protein.png" caption="stxA_1 and stxB_1 on the Sakai chromosome, with stxA_1's details open and its sequence shown as protein." />

## pO157 as a ring

We'll open pO157 in the circular view. A circular view of one circular sequence
closes at position 1, ticks its bases, and prints the sequence's name and length
in the middle:

```json session config=test_data/prokka_sakai/config.json
{
  "defaultSession": {
    "name": "pO157 as a circle",
    "views": [
      {
        "type": "CircularView",
        "assembly": "sakai",
        "displayedRegionNames": ["NC_002128.1"],
        "tracks": ["sakai_prokka"]
      }
    ]
  }
}
```

<Figure src="/img/prokka_genbank/po157_ring.png" caption="pO157 as a circle, with Prokka's genes around it." />

Prokka names the enterohemolysin operon `hlyC`, `ehxA`, `hlyB` and `hlyD`, the
four genes in a row on one strand between 16 and 24 kb.

## Saving a plasmid as GenBank

We'll write pO157 and its genes back out as a GenBank file, for a plasmid map
program or a collaborator. Type `NC_002128.1` into a linear view's location box
to show the whole plasmid, then choose **Save track data...** in the gene
track's menu and pick **GenBank**. The file holds one record over the plasmid,
written circular because the assembly lists it in `circularRefNames`, with the
`source` feature and each CDS's qualifiers as Prokka wrote them. `Genus species`
and `strain` are Prokka's placeholders; its `--genus`, `--species` and
`--strain` options fill them in. The file begins:

```text
LOCUS       NC_002128.1            92721 bp    DNA     circular UNK 10-JAN-1970
DEFINITION  NC_002128.1:1..92721 from sakai.
ACCESSION   NC_002128.1
VERSION     NC_002128.1
KEYWORDS    .
SOURCE      Genus species
  ORGANISM  Genus species
            .
FEATURES             Location/Qualifiers
     source          1..92721
                     /organism="Genus species"
                     /mol_type="genomic DNA"
                     /strain="strain"
     CDS             88..2502
                     /label="stcE"
                     /gene="stcE"
                     /locus_tag="SAKAI_05419"
                     /EC_number="3.4.24.-"
                     /inference="ab initio prediction:Prodigal:v2.6"
                     /inference="similar to AA sequence:UniProtKB:O82882"
                     /codon_start=1
                     /transl_table=11
                     /product="Metalloprotease StcE"
```

## Reproduce it end to end

[`build_prokka_genbank.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_prokka_genbank.sh)
wraps every step above. It:

- downloads the Sakai assembly, or takes your own FASTA
- annotates it with Prokka
- writes a JBrowse with the GenBank file as the assembly and the gene track, the
  chromosome and plasmids circular and the gene names indexed

With your own FASTA, `CIRCULAR` names the contigs that are rings, and none are
unless you list them; the default session opens the last one listed in the
circular view, or every contig in a linear view when the list is empty.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_prokka_genbank.sh
bash build_prokka_genbank.sh                    # builds ./prokka_genbank_build/jbrowse2
FASTA=my_assembly.fna CIRCULAR=contig_2,contig_3 NAME=my_genome LOCUSTAG=MYG DISPLAY_NAME="My genome" bash build_prokka_genbank.sh my_build
npx --yes serve prokka_genbank_build/jbrowse2  # then open the printed URL
```

[^gff]:
    Prokka also writes the annotation as `sakai.gff`, with the sequence appended
    under a `##FASTA` line. `jbrowse sort-gff sakai.gff | bgzip > sakai.gff.gz`
    drops that section, so `tabix -p gff sakai.gff.gz` can index the rest, for a
    track over `sakai.fna` as the assembly. Bakta (Schwengers et al. 2021)
    writes its GenBank file as `<prefix>.gbff`, which loads the same way; on
    this assembly it named the contigs `contig_1` to `contig_3` and wrote each
    as circular, because NCBI's FASTA headers call each one complete
    (`--complete` does the same for any FASTA).

## See also

- [](/docs/tutorials/organelle_map)
- [](/docs/tutorials/pangenome_ecoli)
- [](/docs/user_guides/circular_view)
- [](/docs/config_guides/text_searching)

## External links

- [GCF_000008865.2 at NCBI](https://www.ncbi.nlm.nih.gov/datasets/genome/GCF_000008865.2/)
- [Prokka](https://github.com/tseemann/prokka)
- [Bakta](https://github.com/oschwengers/bakta)

## Citations

- Hayashi et al. (2001).
  [Complete genome sequence of enterohemorrhagic Escherichia coli O157:H7 and genomic comparison with a laboratory strain K-12](https://doi.org/10.1093/dnares/8.1.11)
- Makino et al. (1998).
  [Complete nucleotide sequences of 93-kb and 3.3-kb plasmids of an enterohemorrhagic Escherichia coli O157:H7 derived from Sakai outbreak](https://doi.org/10.1093/dnares/5.1.1)
- Seemann (2014).
  [Prokka: rapid prokaryotic genome annotation](https://doi.org/10.1093/bioinformatics/btu153)
- Schwengers et al. (2021).
  [Bakta: rapid and standardized annotation of bacterial genomes via alignment-free sequence identification](https://doi.org/10.1099/mgen.0.000685)
