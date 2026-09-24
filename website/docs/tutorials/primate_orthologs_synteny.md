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
primate then becomes a lane under the human view, laid out in that genome's
coordinates, with the gene models annotated on it. The join reaches exactly as
far as the naming does, and it stops at a gene family whose copies carry
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
et al. 2025) and the telomere-to-telomere rhesus macaque. Only the annotation
and the sequence report are downloaded, a few hundred megabytes for the eight.
Human is GRCh38 rather than T2T-CHM13 so the window's coordinates are the ones
the rest of the ecosystem quotes.

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
- each genome's hub config on genomes.jbrowse.org, whose assembly entry and NCBI
  RefSeq gene track each lane takes verbatim:
  https://jbrowse.org/ucsc/hg38/config.json for human, and for chimpanzee
  https://jbrowse.org/hubs/genark/GCF/028/858/775/GCF_028858775.2/config.json,
  the other ape and macaque hubs at the same path under their own accessions
- the finished table, BEDs and config, rehosted so the lanes load without
  rerunning the pipeline:
  https://jbrowse.org/demos/primate_orthologs/config.json

## An ortholog table joined on gene names

The [grape, peach and cacao](/docs/tutorials/multiway_synteny_grape_peach_cacao)
page builds its ortholog table by aligning coding sequence, and the
[OrthoFinder](/docs/tutorials/orthofinder_synteny) page by clustering proteins.
Both produce the same `.blocks` shape: one row per orthologous group, one column
per genome, a gene id in each cell. Genomes annotated by one pipeline fill that
table a third way. NCBI's eukaryotic annotation pipeline names a gene after its
ortholog, so human _TP53_ is chimpanzee _TP53_ and gorilla _TP53_, and the table
is a join on the `Name` attribute of each GFF3.

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
# that gene's ortholog, or a dot
python3 symbols_to_blocks.py --anchor human -o primates.blocks \
  human=human.gff.gz chimp=chimp.gff.gz bonobo=bonobo.gff.gz gorilla=gorilla.gff.gz \
  sumatran=sumatran.gff.gz bornean=bornean.gff.gz siamang=siamang.gff.gz macaque=macaque.gff.gz
```

Symbols are compared case-folded, so a mouse `Atp5f1a` would meet the human
`ATP5F1A`, and a gene whose name is an NCBI `LOC` placeholder joins nothing. A
link joins one gene to one gene, so a symbol several genes in one genome carry
gets a row per copy, which the
[OrthoFinder page](/docs/tutorials/orthofinder_synteny#what-to-do-with-a-duplicated-gene)
draws as a ribbon per copy over maize's whole-genome duplication. Little of that
reaches these eight. RefSeq gives a duplicated primate gene either its own
lettered symbol, _AMY1A_ against _AMY1B_, or a `LOC` placeholder. The
pseudoautosomal genes are an exception, annotated on both X and Y, so each Y
copy gets a separate row. The helper prints how much of each column it filled;
for these eight the lanes come back nearly full, because the annotations share
one naming pipeline.

## Setting up the assemblies

Each of these genomes is also a genome hub on
[genomes.jbrowse.org](https://genomes.jbrowse.org), the apes and the macaque
under their accessions, and a hub's `config.json` holds a whole JBrowse
assembly: the 2bit sequence, an alias table that resolves the `NC_` names in the
BEDs, and the NCBI RefSeq genes. Each lane takes its assembly entry and gene
track from there, so the ortholog table is the only thing built here:

```bash
# a GenArk hub's path is its accession cut into threes
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
read `chr19` where the assembly's own name is `chr19_hap1_hsa17`. Human is the
one exception to the accession rule: UCSC serves GRCh38 as `hg38` rather than as
a GenArk hub, so the human lane is
[hg38](https://genomes.jbrowse.org/ucsc/hg38/). A lane finds its gene models
through the session, so the hub's gene track only has to exist under the lane's
assembly name.

## The ortholog track

One `SyntenyTrack` names all eight assemblies. `blockAssemblies` and
`bedLocations` are positional against the table's columns, in the order the
helper printed. `{ "field": "cluster" }` colors a gene by its ortholog group,
which the table names after the human gene anchoring it, so a conserved gene is
one color down the whole stack, a lane missing it breaks the column, and a gene
no group claims is grey. A key naming the groups appears in the top right once
the window holds few enough to list, and stays out of the way at the windows
below:

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
      "displayId": "primate_orthologs-MultiWaySyntenyDisplay",
      "color": { "field": "cluster" }
    }
  ]
}
```

## One locus, eight genomes

Opened in a linear genome view on human, the track draws a lane per genome under
the human axis, each fitted to wherever that genome keeps the window's genes. A
lane's header names its chromosome, the span it shows and `[rev]` where it reads
the other way, and the ribbons between adjacent lanes join each gene to its
ortholog. **Color by... → Strand**, under **Ribbons** on the track menu, colors
each ribbon by the strand of the pair it joins, the two lanes' orientations
against the human axis multiplied out, rather than by whether the ribbon is
drawn crossed. A lane reading the block backwards is drawn mirrored, so its
ribbons come out straight while the strand color still marks every one of them
as an inversion.

The stack sorts densest-first, so the genome sharing the most of the window's
genes sits directly under the anchor. A ribbon joins adjacent lanes only, so a
sparse lane in the middle would cut every chain running through it. That makes
lane order a property of the window rather than of the phylogeny, and it differs
between the pictures below. **Move up** and **Move down** on a lane's header
menu pin an order, **Lanes → Reset lane order** on the track menu gives it back,
and a session or a config authors the same thing as `domain`.

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

<Figure caption="The TP53 neighbourhood on human chr17 over seven primate lanes from one gene-symbol ortholog track, each lane drawing the RefSeq gene models annotated on its chromosome. Every lane has the block in order; the siamang lane has it reversed, so its header shows [rev] and its ribbons are the reversed-strand ones, drawn straight because the lane is mirrored." src="/img/multiway_synteny/primate_tp53_lanes.png" />

Zoomed out to four megabases the same track reads as a synteny painting, and
color separates forward blocks from reversed ones. A block painted as reversed
is one that lane reads backwards from the lane above it, whether the mirroring
left it drawn straight or crossed. One block runs down the middle of the frame
with same-orientation flanks on either side of it, and one pair of lanes crosses
near the right-hand edge. The headers give the other fact. Every lane sits at
its own offset and scale, and a lane whose header names a multiple is holding
the same genes over more sequence.

<Figure caption="Four megabases of human chr17 over the seven primate lanes, ribbons colored by strand. Blue is a block read backwards from the lane above: one runs down the middle of the frame between same-orientation flanks, and the two bottom lanes cross where a block flips between them." src="/img/multiway_synteny/primate_chr17_inversions.png" />

## A chromosome fusion

Human chromosome 2 is two ape chromosomes joined end to end. The same track in a
linear synteny view shows it, with human chr2 on one row and the two chimpanzee
chromosomes that carry its halves on the other. The palette button's **Target**
paints each ribbon by the chimpanzee chromosome it lands on.

<Figure caption="Human chr2 over chimpanzee chr12 and chr13, the hsa2a and hsa2b chromosomes, from the gene-symbol ortholog track, ribbons colored by the chimpanzee chromosome. The orthologs of one chimpanzee chromosome fill human chr2 up to 2q13 and those of the other fill it past there." src="/img/multiway_synteny/primate_chr2_fusion.png" />

In the lanes, a window across the fusion point has orthologs on both chimpanzee
chromosomes, and a lane follows one contig at a time. Each ape lane picks the
one holding more of the window's genes and names the other in its header, and
**Show ⟨contig⟩ in this lane** on the header menu swaps the lane onto it.

## Placeholder names

The join is exactly as good as the naming. The salivary amylase cluster on human
chr1 is a run of near-identical copies whose human names are lettered (_AMY1A_,
_AMY1B_, _AMY1C_), while the other primates' copies were left as placeholder
`LOC` ids, so most of them have no row in the table. Every lane still draws the
gene copies annotated in that genome, and the ribbons stop where the naming
does. A locus like this needs a real homology call, such as the one the
[OrthoFinder page](/docs/tutorials/orthofinder_synteny) builds, or an alignment.

## Reproduce it end to end

The script fetches the eight annotations, builds the table and writes the
config; see [Prerequisites](#prerequisites).

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_primate_orthologs.sh
bash build_primate_orthologs.sh
```

## See also

- [](/docs/tutorials/multiway_synteny_grape_peach_cacao)
- [](/docs/tutorials/orthofinder_synteny)
- [](/docs/tutorials/ecoli_orthologs_synteny)
- [](/docs/tutorials/allvsall_synteny)

## References

- Yoo D, Rhie A, et al. Complete sequencing of ape genomes. Nature (2025).
  https://doi.org/10.1038/s41586-025-08816-3
- O'Leary NA, et al. Reference sequence (RefSeq) database at NCBI: current
  status, taxonomic expansion, and functional annotation. Nucleic Acids Res
  (2016). https://doi.org/10.1093/nar/gkv1189
- NCBI Datasets: https://www.ncbi.nlm.nih.gov/datasets/
