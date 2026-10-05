---
title: Synteny from gene symbols (44 E. coli genomes)
sidebar_label: Synteny (gene-symbol lanes, bacteria)
description:
  Stack forty-four E. coli and Shigella genomes under K-12 at one operon by
  joining their RefSeq annotations on the gene symbol, with no alignment step
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
tutorial_subcategory: Ortholog tables
---

We look at one K-12 operon across forty-three other E. coli and Shigella genomes
at once, without aligning any of them. RefSeq's bacterial pipeline gives an
orthologous gene the same symbol in every strain it names, so the ortholog table
is a join on the gene name over the GFF3 files, and each genome becomes a lane
under the K-12 view, holding the gene models annotated in that genome. The join
connects genes that share a symbol with a K-12 gene, which covers the core
genome. The page ends at a cluster that differs between strains, where most
genes in each lane draw grey with no ribbon.

## Prerequisites

- The
  [NCBI datasets CLI](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/command-line-tools/)
- htslib (`bgzip`, `tabix`)
- `python3`
- A running JBrowse instance (the [web quickstart](/docs/quickstart_web) or the
  [desktop quickstart](/docs/quickstart_desktop))

## Where the data comes from

Forty-four RefSeq assemblies, each fetched by accession with the `datasets` CLI:
the classic reference strains across phylogroups A, B1, B2, D and E, four
Shigella, and complete genomes picked by striding a `datasets summary` listing.
The five strains the [pangenome graph](/docs/tutorials/pangenome_ecoli) and
[all-vs-all](/docs/tutorials/allvsall_synteny) pages build from are all here
under the same accessions (MG1655 is the strain those pages call K12), so the
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
- the finished table: https://jbrowse.org/demos/ecoli_orthologs/ecoli.blocks.gz
- the finished config: https://jbrowse.org/demos/ecoli_orthologs/config.json

## A join on the gene symbols

RefSeq's Prokaryotic Genome Annotation Pipeline (PGAP) gives a gene the symbol
of its ortholog (_atpA_ is _atpA_ in every strain that has it), so matching
symbols across the GFF3 files builds an ortholog table with no alignment step:
one row per gene, one column per genome, in the `.blocks` format that
`MCScanBlocksAdapter` reads. Most of the effort goes to PGAP's unnamed and
renamed genes. The download is an annotation and a sequence report per genome:

<!-- from: scripts/build_ecoli_orthologs.sh -->

```bash
# one RefSeq accession per line; the first is the genome the rows are anchored on
datasets download genome accession --inputfile accessions.txt \
  --include gff3,seq-report --filename genomes.zip
unzip genomes.zip
```

The build script takes the longest sequence in each report as the chromosome and
drops the plasmids, since a lane follows one contig at a time. It filters the
GFF3 to that sequence, then sorts, bgzips and tabix-indexes it as in the
[web quickstart](/docs/quickstart_web) to make the gene track for that genome.

Each lane takes its name from the strain field of the assembly report (MG1655
rather than "K-12 substr. MG1655", and `Sflexneri_301` for the Shigella so it
does not read as an E. coli strain). The build also checks the organism name in
the report and drops a genome that is neither _E. coli_ nor _Shigella_.

PGAP writes a gene's locus tag into its `Name` when it has no symbol for it, so
the join has to be told what an unnamed gene looks like, or every hypothetical
protein would look named and match nothing:

<!-- from: scripts/build_ecoli_orthologs.sh -->

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/symbols_to_blocks.py
# --anchor names the genome whose genes lead the table; --unnamed is the
# locus-tag shape PGAP falls back to, which joins nothing; --merge-cited
# joins a gene PGAP renamed to the gene it was annotated from
python3 symbols_to_blocks.py --anchor MG1655 -o ecoli.blocks --unnamed '_RS[0-9]+$' --merge-cited \
  MG1655=MG1655.gff.gz Sakai=Sakai.gff.gz CFT073=CFT073.gff.gz Sflexneri_301=Sflexneri_301.gff.gz
```

PGAP also renames genes between releases, so most strains here call K-12's _gnd_
_gndA_. Each CDS records the protein PGAP annotated the gene from
(`similar to AA sequence:RefSeq:NP_416533.1`, the K-12 _gnd_ protein), and
`--merge-cited` joins the two symbols when that protein is in the table under
the other name. Two symbols one genome has side by side, such as K-12's _narH_
and its paralog _narY_, stay apart. The table then adds a row for each symbol
K-12 lacks that two other genomes share, with a dot in K-12's column.

`symbols_to_blocks.py` reports how much of each column it filled, which tells
whether a strain joins. Older PGAP runs gave genes a locus tag and no symbol, so
a genome can be complete, current and join nothing. Counting the named genes in
an annotation shows which genomes will fail before anything is built:

<!-- from: scripts/build_ecoli_orthologs.sh -->

```bash
gzip -dc strain.gff.gz | awk -F'\t' '$3 == "gene" && $9 ~ /;gene=/' | wc -l
```

## Loading the assemblies, gene tracks and ortholog track

Each strain is an assembly that needs only its chromosome's length, since the
lanes never read sequence. The build writes `<strain>.chrom.sizes` (a name and a
length, tab-separated) and loads it as a `ChromSizesAdapter`. A reader with ten
strains repeats this block and the gene track below once per strain:

```json addassembly
{ "name": "MG1655", "uri": "MG1655.chrom.sizes" }
```

Each lane draws gene models from the strain's gene track, the sorted, bgzipped
and tabix-indexed GFF3 the build made above:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "MG1655_genes",
  "name": "MG1655 genes",
  "assemblyNames": ["MG1655"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "uri": "MG1655.gff.gz"
  }
}
```

One `SyntenyTrack` names all forty-four assemblies. `blockAssemblies` and
`bedLocations` hold one entry per table column, in the order the helper printed.
The config below keeps the four genomes the command above joined, and the hosted
[config.json](https://jbrowse.org/demos/ecoli_orthologs/config.json) has all
forty-four. The adapter decompresses the table and BEDs itself and reads each
file whole before the first lane draws:

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "ecoli_orthologs",
  "name": "E. coli orthologs by gene symbol (44 genomes, RefSeq)",
  "assemblyNames": ["MG1655", "Sakai", "CFT073", "Sflexneri_301"],
  "adapter": {
    "type": "MCScanBlocksAdapter",
    "mcscanBlocksLocation": { "uri": "ecoli.blocks.gz" },
    "blockAssemblies": ["MG1655", "Sakai", "CFT073", "Sflexneri_301"],
    "bedLocations": [
      "MG1655.bed.gz",
      "Sakai.bed.gz",
      "CFT073.bed.gz",
      "Sflexneri_301.bed.gz"
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

## Reading the atp operon across forty-four genomes

At the _atp_ operon (the ATP synthase genes) on K-12, the track draws a lane per
genome under the K-12 axis. Each lane uses its own genome's coordinates, and its
header names the strain, contig and span shown, with `[rev]` where the lane runs
against K-12
([lane headers](/docs/tutorials/multiway_synteny_grape_peach_cacao#what-a-lane-header-shows)).
The colors read as follows:

- Every gene is colored by its ortholog group, which the table names after the
  K-12 gene anchoring it, so a conserved gene is one color running down the
  whole stack.
- A gene no group claims is grey, which marks the genes specific to a strain at
  a glance.
- The key in the top right turns a color back into a group's name, and **Show...
  → Show legend** on the track menu hides it. The display leaves it out in any
  window holding more than thirty groups.

Lanes stack with the genome placing the most of the window's genes first. The
default height scrolls the stack inside the track, so the session sets a
`height` that fits every lane:

```json session config=https://jbrowse.org/demos/ecoli_orthologs/config.json
{
  "defaultSession": {
    "name": "The atp operon across 44 genomes",
    "views": [
      {
        "type": "LinearGenomeView",
        "assembly": "MG1655",
        "loc": "NC_000913.3:3,910,000-3,925,000",
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

<Figure caption="The atp operon on K-12 over forty-three E. coli and Shigella lanes, each drawing its own RefSeq gene models. A gene's color runs the full stack. Lanes marked [rev] hold this window's genes in the opposite order to K-12 and are mirrored, so their ribbons draw straight." src="/img/multiway_synteny/ecoli_symbol_atp_operon.png" />

## The O-antigen cluster, where the gene-symbol join stops

The O-antigen cluster between _galF_ and _gnd_ holds the genes that build a
strain's surface sugar chain. Each serotype has a different set, so the locus
differs most between strains. Open the cluster:

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

<Figure caption="The O-antigen cluster on K-12 over the same forty-three lanes. K-12 derivatives at the top match the cluster gene for gene. In every lane below, the flanking galF, gnd, ugd and wzzB ribbons run through, the rfb genes, wzx and wzy join where a strain has them, and the serotype-specific genes between them are grey." src="/img/multiway_synteny/ecoli_symbol_oantigen.png" />

Read the lanes from the top:

- The K-12 derivatives (DH10B, HMS174, C3026, MGY, tolC and MG1655_TMP32XR1)
  sort to the top and have the cluster gene for gene.
- Below them the flanks chain down every lane: _galF_ on one side, _gnd_ (_gndA_
  in most lanes), _ugd_ and _wzzB_ on the other.
- The interior is grey, except the _rfb_ genes, _wzx_ and _wzy_, which join
  wherever a strain has them.

A window anchored on K-12 draws only the rows holding a K-12 gene, so the
serotype's own sugar pathway genes stay grey. A gene PGAP left under its locus
tag, such as `ECOLC_RS24020` in the ATCC_8739 lane, has no row either.

Most of that grey is the biology: each serotype's sugar genes arrived by
horizontal transfer and have no K-12 counterpart to join. A homology call across
the proteomes, such as an [OrthoFinder](/docs/tutorials/orthofinder_synteny)
run, would add the genes the annotations named differently, and the
[all-vs-all alignment](/docs/tutorials/allvsall_synteny) draws the same locus
base by base for five strains.

## Reproduce it end to end

The script needs the tools under [Prerequisites](#prerequisites) and works in
four steps:

1. Download each genome's annotation, sequence report and assembly report by
   accession.
2. Name each lane after the report's strain field, and drop a genome the report
   calls neither _E. coli_ nor one of the four _Shigella_ species.
3. Keep each genome's longest sequence as its chromosome, so a lane follows one
   contig and no plasmid, and sort and index the GFF3 for it.
4. Join the annotations on gene symbol, treating PGAP's locus-tag names as
   unnamed and merging the symbols PGAP renamed, and write the config.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_ecoli_orthologs.sh
bash build_ecoli_orthologs.sh
```

## See also

- [](/docs/tutorials/primate_orthologs_synteny)
- [](/docs/tutorials/allvsall_synteny)
- [](/docs/tutorials/pangenome_ecoli)

## External links

- NCBI Datasets: https://www.ncbi.nlm.nih.gov/datasets/

## Citations

- Li W, et al. RefSeq: expanding the Prokaryotic Genome Annotation Pipeline
  reach with protein family model curation. Nucleic Acids Res (2021).
  https://doi.org/10.1093/nar/gkaa1105
- Touchon M, et al. Organised genome dynamics in the Escherichia coli species
  results in highly diverse adaptive paths. PLoS Genet (2009).
  https://doi.org/10.1371/journal.pgen.1000344
