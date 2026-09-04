---
title: Synteny from gene symbols (47 E. coli genomes)
sidebar_label: Synteny (gene-symbol lanes, bacteria)
description:
  Stack forty-seven E. coli and Shigella genomes under K-12 at one operon by
  joining their RefSeq annotations on the gene symbol, with no alignment step
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
data: pipeline
---

**TL;DR:** we look at one K-12 operon across forty-six other E. coli and
Shigella genomes at once, without aligning any of them. RefSeq's bacterial
pipeline gives an orthologous gene the same symbol in every strain it names, so
the ortholog table is a join on the gene name over the GFF3 files, and each
genome becomes a lane under the K-12 view carrying its own gene models. The join
sees the core genome and nothing else: at a cluster that differs between strains
the lanes draw their own genes and no ribbons, which is where the page ends.

## Prerequisites

- The
  [NCBI datasets CLI](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/command-line-tools/)
- htslib (`bgzip`, `tabix`)
- `python3`
- A running JBrowse instance (the [web quickstart](/docs/quickstart_web) or the
  [desktop quickstart](/docs/quickstart_desktop))

## Where the data comes from

Forty-seven RefSeq assemblies, each fetched by accession with the `datasets`
CLI: the classic reference strains across phylogroups A, B1, B2, D and E, four
Shigella, and complete genomes picked by striding a `datasets summary` listing.
The five strains the [pangenome graph](/docs/tutorials/pangenome_ecoli) and
[all-vs-all](/docs/tutorials/allvsall_synteny) pages build from are all here
under the same accessions — MG1655 is the strain those pages call K12 — so the
three pages read one set of genomes three ways. The
[build script](#reproduce-it-end-to-end) pins every accession; the anchor and
the four Shigella are:

- K-12 MG1655:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/005/845/GCF_000005845.2_ASM584v2/
- Shigella flexneri 301:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/006/925/GCF_000006925.2_ASM692v2/
- Shigella dysenteriae Sd197:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/012/005/GCF_000012005.1_ASM1200v1/
- Shigella boydii Sb227:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/012/025/GCF_000012025.1_ASM1202v1/
- Shigella sonnei 53G:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/283/715/GCF_000283715.1_ASM28371v1/
- the finished table, BEDs and config, rehosted so the lanes load without
  rerunning the pipeline: https://jbrowse.org/demos/ecoli_orthologs/config.json

## A join instead of an alignment

The [all-vs-all page](/docs/tutorials/allvsall_synteny) describes five E. coli
strains to each other by aligning them, which is one minimap2 run per pair and
what holds that demo at five. RefSeq's prokaryotic annotation pipeline names a
gene by its ortholog (_atpA_ is _atpA_ in every strain that carries it), so the
same `.blocks` table can be filled by matching symbols across the GFF3 files,
the route the [primate page](/docs/tutorials/primate_orthologs_synteny) takes
for eight apes. The download is an annotation and a sequence report per genome:

<!-- from: scripts/build_ecoli_orthologs.sh -->

```bash
# one RefSeq accession per line; the first is the genome the rows are anchored on
datasets download genome accession --inputfile accessions.txt \
  --include gff3,seq-report --filename genomes.zip
unzip genomes.zip
```

Each genome's chromosome is the longest sequence in its report, and the plasmids
are dropped: a lane follows one contig at a time. The GFF3 filtered to that
sequence, sorted, bgzipped and tabix-indexed as in the
[web quickstart](/docs/quickstart_web) is the genome's gene track.

PGAP writes a gene's locus tag into its `Name` when it has no symbol for it, so
the join has to be told what an unnamed gene looks like, or every hypothetical
protein would look named and match nothing:

<!-- from: scripts/build_ecoli_orthologs.sh -->

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/symbols_to_blocks.py
# --anchor names the genome whose genes are the rows; --unnamed is the
# locus-tag shape PGAP falls back to, which joins nothing
python3 symbols_to_blocks.py --anchor MG1655 -o ecoli.blocks --unnamed '_RS[0-9]+$' \
  MG1655=MG1655.gff.gz Sakai=Sakai.gff.gz CFT073=CFT073.gff.gz Sflex301=Sflex301.gff.gz
```

The helper reports how much of each column it filled, and that number is the
screen a strain has to pass. Older PGAP runs named genes by locus tag alone, so
a genome can be complete, current and join nothing; of a hundred accessions
tried for this page, a quarter of those that still downloaded were like that,
and two were phage genomes. Counting the named genes in an annotation says which
before anything is built:

<!-- from: scripts/build_ecoli_orthologs.sh -->

```bash
gzip -dc strain.gff.gz | awk -F'\t' '$3 == "gene" && $9 ~ /;gene=/' | wc -l
```

## The ortholog track

One `SyntenyTrack` names all forty-seven assemblies, each of which is a
`ChromSizesAdapter` over its chromosome's length, since the lanes never read
sequence. `blockAssemblies` and `bedLocations` are positional against the
table's columns, in the order the helper printed; the list below is cut to the
first four for the page. At the default height the display keeps every lane at a
readable pitch and scrolls the stack inside the track; the `height` here sizes
the track to the whole stack, so the figure below shows every lane at once:

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "ecoli_orthologs",
  "name": "E. coli orthologs by gene symbol (47 genomes, RefSeq)",
  "assemblyNames": ["MG1655", "Sakai", "CFT073", "Sflex301"],
  "adapter": {
    "type": "MCScanBlocksAdapter",
    "mcscanBlocksLocation": { "uri": "ecoli.blocks" },
    "blockAssemblies": ["MG1655", "Sakai", "CFT073", "Sflex301"],
    "bedLocations": [
      { "uri": "MG1655.bed" },
      { "uri": "Sakai.bed" },
      { "uri": "CFT073.bed" },
      { "uri": "Sflex301.bed" }
    ],
    "assemblyNames": ["MG1655", "Sakai", "CFT073", "Sflex301"]
  },
  "displays": [
    {
      "type": "MultiWaySyntenyDisplay",
      "displayId": "ecoli_orthologs-MultiWaySyntenyDisplay",
      "color": "jexl:feature.name ? randomColor(feature.name) : '#b0b0b0'",
      "height": 1100
    }
  ]
}
```

## One operon, forty-seven genomes

Opened on K-12 at the _atp_ operon, the track draws a lane per genome under the
K-12 axis. Every gene is colored by its symbol, so a conserved gene is one color
running down the whole stack, and a lane's header names its chromosome, where it
is looking and `[rev]` where the strain's chromosome reads the other way. Lanes
stack densest first, so the genomes placing the most of the window sit at the
top and the reduced Shigella genomes fall toward the bottom without anything
naming them.

```json session config=https://jbrowse.org/demos/ecoli_orthologs/config.json
{
  "defaultSession": {
    "name": "The atp operon across 47 genomes",
    "views": [
      {
        "type": "LinearGenomeView",
        "assembly": "MG1655",
        "loc": "NC_000913.3:3,910,000-3,925,000",
        "tracks": [
          {
            "trackId": "ecoli_orthologs",
            "type": "MultiWaySyntenyDisplay",
            "height": 1100
          }
        ]
      }
    ]
  }
}
```

<Figure caption="The atp operon on K-12 over forty-six E. coli and Shigella lanes from one gene-symbol ortholog track, each lane drawing its own RefSeq gene models. Every gene's color runs the full stack; the lanes reading the operon reversed are the ones whose chromosome was deposited the other way round." src="/img/multiway_synteny/ecoli_symbol_atp_operon.png" />

## Where the join stops

The O-antigen cluster between _galF_ and _gnd_ is the locus that differs most
between strains: each serotype carries its own set of sugar pathway genes, and
those share no symbol across serotypes. The lanes that keep the whole cluster
sort to the top, and they are the K-12 derivatives, whose cluster is K-12's gene
for gene. Below them the flanking genes chain down every lane, and between the
flanks each lane draws whatever its own annotation holds with no ribbon to it.
That is the accessory genome as the join sees it.

<Figure caption="The O-antigen cluster on K-12 over the same forty-six lanes. The K-12 derivatives at the top of the stack match the cluster gene for gene; in every lane below, the flanking galF and gnd chains run through and the cluster between them is that strain's own, joined to nothing." src="/img/multiway_synteny/ecoli_symbol_oantigen.png" />

For the variable loci the table wants a homology call across the proteomes, an
[OrthoFinder](/docs/tutorials/orthofinder_synteny) run, or the
[all-vs-all alignment](/docs/tutorials/allvsall_synteny) that draws the same
locus base by base for five strains.

## Reproduce it end to end

The script fetches the forty-seven annotations, builds the table and writes the
config; see [Prerequisites](#prerequisites).

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_ecoli_orthologs.sh
bash build_ecoli_orthologs.sh
```

## See also

- [](/docs/tutorials/primate_orthologs_synteny)
- [](/docs/tutorials/allvsall_synteny)
- [](/docs/tutorials/pangenome_ecoli)

## References

- Li W, et al. RefSeq: expanding the Prokaryotic Genome Annotation Pipeline
  reach with protein family model curation. Nucleic Acids Res (2021).
  https://doi.org/10.1093/nar/gkaa1105
- Touchon M, et al. Organised genome dynamics in the Escherichia coli species
  results in highly diverse adaptive paths. PLoS Genet (2009).
  https://doi.org/10.1371/journal.pgen.1000344
- NCBI Datasets: https://www.ncbi.nlm.nih.gov/datasets/
