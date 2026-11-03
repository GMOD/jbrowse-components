---
title: Synteny from gene symbols (primates and E. coli)
sidebar_label: Synteny (gene-symbol lanes)
description:
  Stack the great apes, a gibbon and a macaque under a human locus by joining
  their RefSeq annotations on the gene symbol, then run the same join over E.
  coli genomes
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
tutorial_subcategory: Ortholog tables
---

We look at one human locus across seven other primates at once. NCBI gives an
orthologous gene the same symbol in every species it annotates, so an ortholog
table is a join on the gene name over eight GFF3 files. Bacterial annotations
name fewer genes and rename more of them, so the page closes on E. coli to see
what the join does with them. We:

- build the join, and set up each lane's assembly from its hub
- load the table as a multi-genome ortholog track, each primate a lane under the
  human view in the coordinates of that primate's genome
- read the _TP53_ neighbourhood and a 17q window across the lanes
- read human chromosome 2 against the ape chromosomes it fused from
- rebuild the join over E. coli annotations, with lanes built from chromosome
  lengths, and read the O-antigen cluster

## Prerequisites

- The
  [NCBI datasets CLI](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/command-line-tools/)
- htslib (`bgzip`, `tabix`), for the E. coli build
- `python3`
- A running JBrowse instance (the [web quickstart](/docs/quickstart_web) or the
  [desktop quickstart](/docs/quickstart_desktop))

<!-- BEGIN GENERATED TUTORIAL_INSTALL htslib,datasets -->

```bash
# Debian/Ubuntu
sudo apt install tabix
# or conda, which has every tool above
conda install -c bioconda -c conda-forge htslib ncbi-datasets-cli
# or Linux x86_64 binaries for the tools apt lacks
wget -P ~/.local/bin \
  https://ftp.ncbi.nlm.nih.gov/pub/datasets/command-line/v2/linux-amd64/datasets \
  https://ftp.ncbi.nlm.nih.gov/pub/datasets/command-line/v2/linux-amd64/dataformat
chmod +x ~/.local/bin/datasets ~/.local/bin/dataformat
```

<!-- END GENERATED TUTORIAL_INSTALL htslib,datasets -->

## The data

Eight RefSeq assemblies, each fetched by accession with the `datasets` CLI: the
current human reference, the six NHGRI telomere-to-telomere ape assemblies (Yoo
et al. 2025) and the telomere-to-telomere rhesus macaque. The E. coli section
uses E. coli and Shigella assemblies anchored on K-12 MG1655, all pinned by
accession in its build script.

The tracks below read local files that the
[build scripts](#reproduce-it-end-to-end) write, so run them first, or run _An
ortholog table joined on gene names_ over RefSeq accessions of your own. Each
script fetches the annotations and reports it needs for every genome itself.

| What it is                   | File                                                                                                                                          |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Human, GRCh38.p14            | [GCF_000001405.40_GRCh38.p14/](https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/001/405/GCF_000001405.40_GRCh38.p14/)                         |
| Chimpanzee                   | [GCF_028858775.2_NHGRI_mPanTro3-v2.1_pri/](https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/028/858/775/GCF_028858775.2_NHGRI_mPanTro3-v2.1_pri/) |
| Bonobo                       | [GCF_029289425.2_NHGRI_mPanPan1-v2.1_pri/](https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/029/289/425/GCF_029289425.2_NHGRI_mPanPan1-v2.1_pri/) |
| Gorilla                      | [GCF_029281585.2_NHGRI_mGorGor1-v2.1_pri/](https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/029/281/585/GCF_029281585.2_NHGRI_mGorGor1-v2.1_pri/) |
| Sumatran orangutan           | [GCF_028885655.2_NHGRI_mPonAbe1-v2.1_pri/](https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/028/885/655/GCF_028885655.2_NHGRI_mPonAbe1-v2.1_pri/) |
| Bornean orangutan            | [GCF_028885625.2_NHGRI_mPonPyg2-v2.1_pri/](https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/028/885/625/GCF_028885625.2_NHGRI_mPonPyg2-v2.1_pri/) |
| Siamang                      | [GCF_028878055.3_NHGRI_mSymSyn1-v2.1_pri/](https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/028/878/055/GCF_028878055.3_NHGRI_mSymSyn1-v2.1_pri/) |
| Rhesus macaque, T2T-MMU8v2.0 | [GCF_049350105.2_T2T-MMU8v2.0/](https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/049/350/105/GCF_049350105.2_T2T-MMU8v2.0/)                       |
| E. coli K-12 MG1655          | [GCF_000005845.2_ASM584v2/](https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/005/845/GCF_000005845.2_ASM584v2/)                               |

## An ortholog table joined on gene names

An ortholog table in the `.blocks` shape has one row per orthologous group, one
column per genome and a gene id in each cell. NCBI's eukaryotic annotation
pipeline names a gene after its ortholog, so human _TP53_ is chimpanzee _TP53_
and gorilla _TP53_, and for genomes it annotated the table is a join on the
`Name` attribute of each GFF3.

The join needs only the annotations, so the download is a GFF3 and a sequence
report per genome:

<!-- from: scripts/build_primate_orthologs.sh -->

```bash
# one RefSeq accession per line; the first is the genome the rows are anchored on
datasets download genome accession --inputfile accessions.txt \
  --include gff3,seq-report --filename genomes.zip
unzip genomes.zip
```

`symbols_to_blocks.py` reads each GFF3 once, writes a BED of its protein-coding
genes and the table, and prints the column order it used:

<!-- from: scripts/build_primate_orthologs.sh -->

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/symbols_to_blocks.py
# --anchor names the genome whose genes are the rows; every other column is
# the ortholog of that gene, or a dot
python3 symbols_to_blocks.py --anchor human -o primates.blocks \
  human=human.gff.gz chimp=chimp.gff.gz bonobo=bonobo.gff.gz gorilla=gorilla.gff.gz \
  sumatran=sumatran.gff.gz bornean=bornean.gff.gz siamang=siamang.gff.gz macaque=macaque.gff.gz
```

`symbols_to_blocks.py` joins on the case-folded symbol and handles these cases:

- **A gene named with an NCBI `LOC` placeholder** joins nothing. RefSeq names
  the salivary amylase copies that way in the other primates.
- **A symbol shared by several genes in one genome** gets a row per copy,
  because a link joins one gene to one gene. The main case is the
  pseudoautosomal genes, annotated on both X and Y.
- **Open reading frame genes** spell differently in the apes (human _C1orf35_ is
  chimp _C1H1orf35_), and the helper reads that back.

The helper prints how much of each column it filled.

## Setting up each lane's assembly from its hub

Each genome is also a hub on [genomes.jbrowse.org](https://genomes.jbrowse.org).
A hub's `config.json` holds a whole JBrowse assembly: the 2bit sequence, an
alias table that resolves the `NC_` names in the BEDs, and the NCBI RefSeq
genes. Each lane takes its assembly entry and gene track from its hub, so the
ortholog table is the one file built here:

```bash
# a GenArk hub path is the accession cut into threes
curl -fO https://jbrowse.org/hubs/genark/GCF/028/858/775/GCF_028858775.2/config.json
```

The build relabels the lane and adds the short name as an alias, so a session
can still say `chimp`:

```json
{
  "name": "GCF_028858775.2",
  "displayName": "Chimpanzee (NHGRI_mPanTro3-v2.1)",
  "aliases": ["chimp"],
  "sequence": {
    "type": "ReferenceSequenceTrack",
    "trackId": "GCF_028858775.2-ReferenceSequenceTrack",
    "adapter": {
      "type": "TwoBitAdapter",
      "uri": "https://hgdownload.soe.ucsc.edu/hubs/GCF/028/858/775/GCF_028858775.2/GCF_028858775.2.2bit",
      "chromSizes": "https://hgdownload.soe.ucsc.edu/hubs/GCF/028/858/775/GCF_028858775.2/GCF_028858775.2.chrom.sizes.txt"
    }
  },
  "refNameAliases": {
    "adapter": {
      "type": "RefNameAliasAdapter",
      "refNameColumnHeaderName": "ucsc",
      "uri": "https://hgdownload.soe.ucsc.edu/hubs/GCF/028/858/775/GCF_028858775.2/GCF_028858775.2.chromAlias.txt"
    }
  }
}
```

`refNameColumnHeaderName` makes the UCSC names canonical, so the lane headers
read `chr19`. Human is the exception: UCSC serves GRCh38 as `hg38` with no
GenArk hub, so the human lane is [hg38](https://genomes.jbrowse.org/ucsc/hg38/):

```json addassembly
{
  "name": "hg38",
  "uri": "https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz",
  "refNameAliases": {
    "uri": "https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt"
  },
  "cytobands": "https://jbrowse.org/genomes/GRCh38/cytoBand.txt"
}
```

Each lane draws gene models from a gene track on its assembly. For your own
annotation, add one per genome from a bgzipped, tabix-indexed GFF3
([prep](/docs/quickstart_web)) that uses the assembly's refNames:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "chimp_genes",
  "name": "chimp genes",
  "assemblyNames": ["GCF_028858775.2"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "uri": "chimp.sorted.gff3.gz"
  }
}
```

## Loading the multi-genome ortholog track

One `SyntenyTrack` names every assembly, and `blockAssemblies` and
`bedLocations` hold one entry per table column, in the order the helper printed.
In [grammar-of-graphics](/docs/config_guides/mark_display) terms, the display's
`encoding.color` is a color scale, and the `cluster` field maps each gene's
ortholog group, named by its gene symbol, to a color:

- A conserved gene is one color down the whole stack, and a lane missing it
  breaks the column.
- A gene no group claims is grey.
- A key naming the groups appears in the top right once the window holds few
  enough to list. Untick **Show → Legend** in the track menu to hide it.

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "primate_orthologs",
  "name": "Primate orthologs by gene symbol (8 genomes, RefSeq)",
  "assemblyNames": [
    "hg38",
    "GCF_028858775.2",
    "GCF_029289425.2",
    "GCF_029281585.2",
    "GCF_028885655.2",
    "GCF_028885625.2",
    "GCF_028878055.3",
    "GCF_049350105.2"
  ],
  "adapter": {
    "type": "MCScanBlocksAdapter",
    "uri": "primates.blocks.gz",
    "blockAssemblies": [
      "hg38",
      "GCF_028858775.2",
      "GCF_029289425.2",
      "GCF_029281585.2",
      "GCF_028885655.2",
      "GCF_028885625.2",
      "GCF_028878055.3",
      "GCF_049350105.2"
    ],
    "bedLocations": [
      "human.bed.gz",
      "chimp.bed.gz",
      "bonobo.bed.gz",
      "gorilla.bed.gz",
      "sumatran.bed.gz",
      "bornean.bed.gz",
      "siamang.bed.gz",
      "macaque.bed.gz"
    ]
  },
  "displays": [
    {
      "type": "MultiWaySyntenyDisplay",
      "encoding": { "color": "cluster" }
    }
  ]
}
```

## Reading the TP53 neighbourhood across eight primates

In a linear genome view on human, the track draws a lane per primate under the
human axis, each in that genome's coordinates. Each lane's header names the
chromosome and span, with `[rev]` where the lane runs against human
([lane headers](/docs/user_guides/multiway_synteny_display#reading-a-lane-header)).
The ribbons color by strand by default (**Color by → Strand**, under **Ribbons**
on the track menu): each ribbon shows whether its two lanes agree in
orientation. The session below opens the _TP53_ neighbourhood:

```json session config=https://jbrowse.org/demos/primate_orthologs/config.json
{
  "defaultSession": {
    "name": "TP53 neighbourhood across eight primates",
    "views": [
      {
        "type": "LinearGenomeView",
        "assembly": "hg38",
        "loc": "chr17:7,400,000-7,700,000",
        "tracks": [
          {
            "trackId": "primate_orthologs",
            "type": "MultiWaySyntenyDisplay",
            "ribbons": { "encoding": { "color": "strand" } },
            "height": 620
          }
        ]
      }
    ]
  }
}
```

<Figure caption="TP53 on human chr17 over seven primate lanes, each with its own RefSeq genes. The reversed siamang lane shows [rev] and draws its ribbons straight." src="/img/multiway_synteny/primate_tp53_lanes.png" />

Navigate to `chr17:34,000,000-38,000,000` on 17q, where the strand color
separates forward blocks from reversed ones.

<Figure caption="17q over the seven primate lanes, ribbons colored by strand. Blue marks a block read backwards from the lane above." src="/img/multiway_synteny/primate_chr17_inversions.png" />

## Human chromosome 2 as two fused ape chromosomes

Human chromosome 2 is two ape chromosomes joined end to end. To see the join:

- Open human over chimpanzee from **Add → Linear synteny view**, with
  `primate_orthologs` between them
- Navigate the human row to `chr2` and the chimpanzee row to `chr12` and
  `chr13`, the two chromosomes that hold its halves
- Pick **Target** in the palette button menu, which paints each ribbon by the
  chimpanzee chromosome it maps to

<Figure caption="Human chr2 over chimpanzee chr12 and chr13, ribbons colored by chimpanzee chromosome." src="/img/multiway_synteny/primate_chr2_fusion.png" />

In the multi-lane view, a lane whose genome holds the window's genes on two
contigs shows the contig with more of them and names the other in its header.
**Show ⟨contig⟩ in this lane** on the header menu swaps the lane onto it.

## Joining bacterial annotations (E. coli)

Genes NCBI left unnamed, the `LOC` genes above, are common in a bacterial
annotation: RefSeq's Prokaryotic Genome Annotation Pipeline (PGAP) writes a
gene's locus tag into its `Name` when it has no symbol, and renames genes
between releases. Older PGAP runs gave every gene a locus tag and no symbol, so
counting the named genes in an annotation shows whether a genome will join
before anything is built:

<!-- from: scripts/build_ecoli_orthologs.sh -->

```bash
gzip -dc strain.gff.gz | awk -F'\t' '$3 == "gene" && $9 ~ /;gene=/' | wc -l
```

The join is the same command with three flags for PGAP:

<!-- from: scripts/build_ecoli_orthologs.sh -->

```bash
# --unnamed swaps the LOC pattern for the locus-tag shape PGAP falls back to,
# so a hypothetical protein joins nothing; --merge-cited joins a gene PGAP
# renamed to the gene it was annotated from; --pseudogenes keeps a gene NCBI
# writes as a pseudogene feature, such as K-12's wbbL
python3 symbols_to_blocks.py --anchor MG1655 -o ecoli.blocks --unnamed '_RS[0-9]+$' --merge-cited --pseudogenes \
  MG1655=MG1655.gff.gz Sakai=Sakai.gff.gz CFT073=CFT073.gff.gz Sflexneri_301=Sflexneri_301.gff.gz
```

PGAP writes on each CDS the protein it annotated the gene from
(`similar to AA sequence:RefSeq:NP_416533.1`, the K-12 _gnd_ protein), and
`--merge-cited` reads that note to join K-12's _gnd_ to the _gndA_ most strains
carry.

A lane draws its genes from the BED and the gene track, so a strain's assembly
is its chromosome's name and length. The build writes `<strain>.chrom.sizes`,
one tab-separated line, and loads it as a `ChromSizesAdapter`:

```json addassembly
{ "name": "MG1655", "uri": "MG1655.chrom.sizes" }
```

Each strain then takes a gene track like the chimpanzee one above, and the
`SyntenyTrack` lists strains where the primate track lists primates. The
O-antigen cluster between _galF_ and _gnd_ holds the genes that build a strain's
surface sugar chain, a different set in each serotype. The session opens it on
the hosted config, which has every strain, with `height` set to fit the stack:

```json session config=https://jbrowse.org/demos/ecoli_orthologs/config.json
{
  "defaultSession": {
    "name": "The O-antigen cluster across 44 genomes",
    "views": [
      {
        "type": "LinearGenomeView",
        "assembly": "MG1655",
        "loc": "NC_000913.3:2,095,000-2,115,000",
        "tracks": [
          {
            "trackId": "ecoli_orthologs",
            "type": "MultiWaySyntenyDisplay",
            "height": 1500
          }
        ]
      }
    ]
  }
}
```

<Figure caption="The O-antigen cluster on K-12 over the E. coli and Shigella lanes, each with its own RefSeq genes." src="/img/multiway_synteny/ecoli_symbol_oantigen.png" />

Read the lanes from the top:

- The K-12 derivatives sort to the top, since lanes stack by how many of the
  window's genes they place on one contig, and have the cluster gene for gene.
- Below them the flanks chain down every lane: _galF_ on one side, _gnd_ (_gndA_
  in most lanes), _ugd_ and _wzzB_ on the other.
- The interior is grey, except the _rfb_ genes, _wzx_ and _wzy_, which join
  wherever a strain has them.

`symbols_to_blocks.py` gives a symbol K-12 lacks a row of its own, so _vioB_ is
one color down IAI39 and the BL21 lanes. A gene PGAP left under its locus tag,
such as `ECOLC_RS24020` in the ATCC_8739 lane, has no row. Most of the grey is
each serotype's sugar genes, which have no K-12 counterpart to join by name;
[OrthoFinder](/docs/tutorials/orthofinder_synteny) groups genes by protein
sequence, which joins the ones the annotations named differently.

## Reproduce it end to end

The primate script needs the tools under [Prerequisites](#prerequisites) and
works in three steps:

1. Download the eight annotations and sequence reports, and keep the genes on
   the assembled chromosomes each report names, so no lane has a gene on an
   unplaced scaffold.
2. Join the annotations on gene symbol into one table anchored on human.
3. Write the config from each genome's hub entry and gene track, plus the
   ortholog track.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_primate_orthologs.sh
bash build_primate_orthologs.sh
```

The E. coli script also needs htslib, and works in three steps:

1. Download each genome's annotation, sequence report and assembly report, name
   each lane after the report's strain field, and drop a genome the report calls
   neither _E. coli_ nor _Shigella_.
2. Keep each genome's longest sequence as its chromosome, so a lane follows one
   contig and no plasmid, and sort and index the GFF3 as in the
   [web quickstart](/docs/quickstart_web).
3. Join the annotations on gene symbol with the PGAP flags, and write the
   config.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_ecoli_orthologs.sh
bash build_ecoli_orthologs.sh
```

## See also

- [](/docs/tutorials/multiway_synteny_grape_peach_cacao)
- [](/docs/tutorials/orthofinder_synteny)
- [](/docs/tutorials/allvsall_synteny)
- [](/docs/tutorials/t2t_apes_cactus_synteny)
- [](/docs/tutorials/pangenome_ecoli)

## External links

- NCBI Datasets: https://www.ncbi.nlm.nih.gov/datasets/

## Citations

- Yoo et al. (2025).
  [Complete sequencing of ape genomes](https://doi.org/10.1038/s41586-025-08816-3)
- Li et al. (2021).
  [RefSeq: expanding the Prokaryotic Genome Annotation Pipeline reach with protein family model curation](https://doi.org/10.1093/nar/gkaa1105)
- O'Leary et al. (2016).
  [Reference sequence (RefSeq) database at NCBI: current status, taxonomic expansion, and functional annotation](https://doi.org/10.1093/nar/gkv1189)
