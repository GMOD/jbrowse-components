---
title: Synteny from gene symbols (eight primates)
sidebar_label: Synteny (gene-symbol lanes)
description:
  Stack the great apes, a gibbon and a macaque under a human locus by joining
  their RefSeq annotations on the gene symbol
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
tutorial_subcategory: Ortholog tables
---

We look at one human locus across seven other primates at once. NCBI gives an
orthologous gene the same symbol in every species it annotates, so an ortholog
table is a join on the gene name, built from eight GFF3 files in seconds. Each
primate then becomes a lane under the human view, laid out in the coordinates of
its genome, with the gene models annotated there. The join covers the genes
every annotation names alike, and it stops at a gene family whose copies have
placeholder names.

## Prerequisites

- The
  [NCBI datasets CLI](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/command-line-tools/)
- `python3`
- A running JBrowse instance (the [web quickstart](/docs/quickstart_web) or the
  [desktop quickstart](/docs/quickstart_desktop))

## Where the data comes from

Eight RefSeq assemblies, each fetched by accession with the `datasets` CLI: the
current human reference, the six NHGRI telomere-to-telomere ape assemblies (Yoo
et al. 2025) and the telomere-to-telomere rhesus macaque. The build downloads
the annotation and sequence report for each genome, a few hundred megabytes for
the eight. Human is GRCh38, so the window coordinates are the ones the rest of
the ecosystem quotes.

- human, GRCh38.p14:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/001/405/GCF_000001405.40_GRCh38.p14/
- chimpanzee:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/028/858/775/GCF_028858775.2_NHGRI_mPanTro3-v2.1_pri/
- bonobo:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/029/289/425/GCF_029289425.2_NHGRI_mPanPan1-v2.1_pri/
- gorilla:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/029/281/585/GCF_029281585.2_NHGRI_mGorGor1-v2.1_pri/
- Sumatran orangutan:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/028/885/655/GCF_028885655.2_NHGRI_mPonAbe1-v2.1_pri/
- Bornean orangutan:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/028/885/625/GCF_028885625.2_NHGRI_mPonPyg2-v2.1_pri/
- siamang:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/028/878/055/GCF_028878055.3_NHGRI_mSymSyn1-v2.1_pri/
- rhesus macaque, T2T-MMU8v2.0:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/049/350/105/GCF_049350105.2_T2T-MMU8v2.0/
- the hub config for each genome on genomes.jbrowse.org, whose assembly entry
  and NCBI RefSeq gene track each lane takes verbatim:
  https://jbrowse.org/ucsc/hg38/config.json for human, and for chimpanzee
  https://jbrowse.org/hubs/genark/GCF/028/858/775/GCF_028858775.2/config.json,
  the other ape and macaque hubs at the same path under their accessions
- the finished table, BEDs and config:
  https://jbrowse.org/demos/primate_orthologs/config.json

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

`symbols_to_blocks.py` joins on the symbol and handles these cases:

- Symbols compare case-folded, so a mouse `Atp5f1a` would meet the human
  `ATP5F1A`.
- A gene named with an NCBI `LOC` placeholder joins nothing. RefSeq names the
  salivary amylase copies that way in the other primates.
- A symbol shared by several genes in one genome gets a row per copy, because a
  link joins one gene to one gene. RefSeq gives duplicated primate genes
  distinct lettered symbols (_AMY1A_, _AMY1B_) or placeholders, so the main case
  is the pseudoautosomal genes, annotated on both X and Y, where each Y copy
  gets its own row.
- RefSeq spells open reading frame genes differently in the apes: human
  _C1orf35_ becomes chimp _C1H1orf35_, and the helper reads that back.
- The helper prints how much of each column it filled, nearly full for these
  eight because the annotations share one naming pipeline. It also writes a row
  for each symbol human lacks, which a window anchored on human does not draw.
  Those are genes human has only as a pseudogene or non-coding RNA, _CMAH_ among
  them, and genes the ape annotations name differently from human's.

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

The build keeps each entry as the hub wrote it, relabels the lane and adds the
short name as an alias, so a session can still say `chimp`:

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
read `chr19` where the assembly names it `chr19_hap1_hsa17`. The other apes and
the macaque take the same entry with their own accession. Human is the one
exception to the accession rule: UCSC serves GRCh38 as `hg38` with no GenArk
hub, so the human lane is [hg38](https://genomes.jbrowse.org/ucsc/hg38/):

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

Each lane draws gene models from a gene track under its own assembly name. For
your own annotation, add one per genome, with a GFF3 that is bgzipped,
tabix-indexed ([prep](/docs/quickstart_web)) and uses the assembly's refNames:

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

## Loading the eight-genome ortholog track

One `SyntenyTrack` names all eight assemblies. `blockAssemblies` and
`bedLocations` hold one entry per table column, in the order the helper printed.
`{ "field": "cluster" }` colors each gene by its ortholog group, named by its
gene symbol: a conserved gene is one color down the whole stack, a lane missing
it breaks the column, and a gene no group claims is grey. A key naming the
groups appears in the top right once the window holds few enough to list. At the
windows below, the ribbon-strand key takes that corner, and **Show... → Show
legend** on the track menu hides either:

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
    "mcscanBlocksLocation": { "uri": "primates.blocks.gz" },
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
      "color": { "field": "cluster" }
    }
  ]
}
```

## Reading the TP53 neighbourhood across eight primates

In a linear genome view on human, the track draws a lane per primate under the
human axis. Each lane uses its own genome's coordinates, and its header names
the chromosome and span shown, with `[rev]` where the lane runs against human
([lane headers](/docs/tutorials/multiway_synteny_grape_peach_cacao#what-a-lane-header-shows)).
**Color by... → Strand**, under **Ribbons** on the track menu, colors each
ribbon by the product of its two lanes' orientations against the human axis. The
session below opens the TP53 neighbourhood with it:

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
            "ribbonColor": { "field": "strand" },
            "height": 620
          }
        ]
      }
    ]
  }
}
```

<Figure caption="The TP53 neighbourhood on human chr17 over seven primate lanes, each drawing its own RefSeq gene models. Every lane has the block in order. The siamang lane is reversed, so its header shows [rev] and its ribbons, drawn straight because the lane is mirrored, carry the reverse-strand color." src="/img/multiway_synteny/primate_tp53_lanes.png" />

Navigate to `chr17:34,000,000-38,000,000` on 17q, where the strand color
separates forward blocks from reversed ones.

<Figure caption="Human chr17 on 17q over the seven primate lanes, ribbons colored by strand. Blue marks a block read backwards from the lane above. One runs down the middle of the frame between same-orientation flanks, and the two bottom lanes cross where a block flips between them." src="/img/multiway_synteny/primate_chr17_inversions.png" />

## Human chromosome 2 as two fused ape chromosomes

Human chromosome 2 is two ape chromosomes joined end to end. To see the join:

- Open human over chimpanzee from **Add → Linear synteny view**, with
  `primate_orthologs` between them
- Navigate the human row to `chr2` and the chimpanzee row to `chr12` and
  `chr13`, the two chromosomes that hold its halves
- Pick **Target** in the palette button menu, which paints each ribbon by the
  chimpanzee chromosome it lands on

<Figure caption="Human chr2 over chimpanzee chr12 and chr13, the hsa2a and hsa2b chromosomes, ribbons colored by the chimpanzee chromosome. The orthologs of one chimpanzee chromosome fill human chr2 up to 2q13 and those of the other fill it past there." src="/img/multiway_synteny/primate_chr2_fusion.png" />

In the multi-lane view, a window across the fusion point has orthologs on both
chimpanzee chromosomes, but a lane follows one contig at a time. Each ape lane
picks the contig with more genes in the window and names the other in its
header; **Show ⟨contig⟩ in this lane** on the header menu swaps the lane onto
it.

## Reproduce it end to end

The script needs the tools under [Prerequisites](#prerequisites) and works in
three steps:

1. Download the eight annotations and sequence reports, and keep the genes on
   the assembled chromosomes each report names, so no lane lands on an unplaced
   scaffold.
2. Join the annotations on gene symbol into one table anchored on human.
3. Write the config from each genome's hub entry and gene track, plus the
   ortholog track.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_primate_orthologs.sh
bash build_primate_orthologs.sh
```

## See also

- [](/docs/tutorials/multiway_synteny_grape_peach_cacao)
- [](/docs/tutorials/orthofinder_synteny)
- [](/docs/tutorials/ecoli_orthologs_synteny)
- [](/docs/tutorials/allvsall_synteny)

## External links

- NCBI Datasets: https://www.ncbi.nlm.nih.gov/datasets/

## Citations

- Yoo D, Rhie A, et al. Complete sequencing of ape genomes. Nature (2025).
  https://doi.org/10.1038/s41586-025-08816-3
- O'Leary NA, et al. Reference sequence (RefSeq) database at NCBI: current
  status, taxonomic expansion, and functional annotation. Nucleic Acids Res
  (2016). https://doi.org/10.1093/nar/gkv1189
