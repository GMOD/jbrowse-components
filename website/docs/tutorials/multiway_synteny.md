---
title: Multi-way synteny from an ortholog table
description: Build an N-genome linear synteny view from a jcvi MCScan .blocks file
guide_category: Tutorials
---

A linear synteny view can stack more than two genomes: N genome rows with a
synteny "ribbon" band between each adjacent pair. This tutorial builds a
three-way grape / peach / cacao view from a single
[jcvi](https://github.com/tanghaibao/jcvi) MCScan **`.blocks`** file — the
standard way the comparative-genomics community encodes a multi-genome ortholog
table.

You can open the finished demos here:

- [Grape / peach / cacao 3-way synteny](https://jbrowse.org/code/jb2/main/?config=https://jbrowse.org/demos/grape_peach_cacao/config.json)
  (`.blocks`, below)
- [E. coli 4-strain pangenome](https://jbrowse.org/code/jb2/main/?config=https://jbrowse.org/demos/ecoli_pangenome/config.json)
  (all-vs-all PAF, [below](#all-vs-all-paf-the-pangenome-case))

## What a `.blocks` file is

jcvi does not align all genomes at once. It runs **pairwise** comparisons
against one reference genome, then joins the results on the reference gene into
a single wide, tab-delimited table:

```
GSVIVT01012255001   Prupe.1G290900.1   Thecc1EG011472t1
GSVIVT01012253001   Prupe.1G290800.2   Thecc1EG011473t1
GSVIVT01012261001   .                  .
```

- Column 0 is a **reference** gene (grape here).
- Each further column is that gene's ortholog in another genome (`.` = none).
- One row per reference gene.

This is a coordinate-free gene-id table; the accompanying `.bed` files (one per
genome, produced alongside) map each gene id to a genomic position.

## Producing the data

Install [jcvi](https://github.com/tanghaibao/jcvi) and the
[LAST](https://gitlab.com/mcfrith/last) aligner, then grab CDS + GFF3 for each
genome (this example uses Ensembl Plants release 58: grape `PN40024.v4`, peach
`NCBIv2`, cacao Criollo `V2`).

Convert each GFF3 to a jcvi BED (one primary isoform per gene) and normalize the
CDS FASTA so its headers match the BED names:

```bash
for sp in grape peach cacao; do
  python -m jcvi.formats.gff bed --type=mRNA --key=transcript_id \
    --primary_only $sp.gff3.gz -o $sp.bed
  python -m jcvi.formats.fasta format $sp.cds.fa.gz $sp.cds
done
```

Run the pairwise ortholog catalogs against grape (the reference), then MCScan
each pair and join into one `.blocks` table:

```bash
python -m jcvi.compara.catalog ortholog --no_strip_names grape peach
python -m jcvi.compara.catalog ortholog --no_strip_names grape cacao

python -m jcvi.compara.synteny mcscan grape.bed grape.peach.lifted.anchors \
  --iter=1 -o grape.peach.i1.blocks
python -m jcvi.compara.synteny mcscan grape.bed grape.cacao.lifted.anchors \
  --iter=1 -o grape.cacao.i1.blocks

python -m jcvi.formats.base join grape.peach.i1.blocks grape.cacao.i1.blocks \
  --noheader | cut -f1,2,4 > grape.blocks
```

You now have `grape.blocks` plus `grape.bed`, `peach.bed`, and `cacao.bed`.

## Loading it in JBrowse with MCScanBlocksAdapter

A synteny track draws one pair of genomes, but a `.blocks` file describes N. The
`MCScanBlocksAdapter` bridges this: **one `.blocks` file backs the N-1 synteny
tracks of the stacked view.** Each track names the two genomes it draws
(`assemblyNames`), and the adapter pulls those two columns from the table.

The `blockAssemblies` slot names every column in order (column 0 first), and
`bedLocations` gives the matching per-column BED:

```json
{
  "type": "SyntenyTrack",
  "trackId": "peach_grape_blocks",
  "name": "Peach vs Grape (MCScan blocks)",
  "assemblyNames": ["peach", "grape"],
  "adapter": {
    "type": "MCScanBlocksAdapter",
    "mcscanBlocksLocation": { "uri": "grape.blocks.gz" },
    "blockAssemblies": ["grape", "peach", "cacao"],
    "bedLocations": [
      { "uri": "grape.bed.gz" },
      { "uri": "peach.bed.gz" },
      { "uri": "cacao.bed.gz" }
    ],
    "assemblyNames": ["peach", "grape"]
  }
}
```

Add a second track with `assemblyNames: ["grape", "cacao"]` (same adapter,
different pair), then stack the three genomes with the reference in the middle
so both bands are direct comparisons:

```json
{
  "type": "LinearSyntenyView",
  "init": {
    "views": [
      { "assembly": "peach" },
      { "assembly": "grape" },
      { "assembly": "cacao" }
    ],
    "tracks": [["peach_grape_blocks"], ["grape_cacao_blocks"]],
    "drawCurves": true
  }
}
```

`tracks` is one entry per band: `tracks[0]` connects rows 0–1 (peach–grape) and
`tracks[1]` connects rows 1–2 (grape–cacao).

## Reference in the middle, and transitive pairs

Because a `.blocks` table is reference-anchored, any pair that includes the
reference (peach–grape, grape–cacao) is a direct synteny relationship — so
putting the reference genome in the **middle** row keeps every band faithful.

The adapter can also serve a pair where *neither* side is the reference (e.g.
peach–cacao): it joins the two columns on their shared reference gene. That link
means "both are orthologous to the same grape gene" — a **transitive** ortholog
relationship, not a direct alignment — which is worth keeping in mind if you
stack non-reference genomes adjacently.

## All-vs-all PAF: the pangenome case

When your genomes are closely related (strains / accessions of one species), a
better source is a single **all-vs-all** PAF — every genome aligned to every
other. This is what the [PGGB](https://github.com/pangenome/pggb) mapping step
produces, and you can make one directly by concatenating PanSN-named genomes and
self-aligning with minimap2:

```bash
# PanSN names each sequence sample#haplotype#contig, e.g. K12#1#chr
cat K12.fa Sakai.fa CFT073.fa NCTC86.fa > all.fa
minimap2 -c -x asm20 -X all.fa all.fa > all_vs_all.paf
```

Because the file already contains every pairwise comparison, the
`AllVsAllPAFAdapter` lets **one PAF back every band** of the stacked view — no
per-pair alignment step. Each track names the pair it draws; the adapter keeps
only the records whose two sides are that pair (classified by PanSN prefix):

```json
{
  "type": "SyntenyTrack",
  "trackId": "K12_Sakai_ava",
  "name": "K12 vs Sakai (all-vs-all PAF)",
  "assemblyNames": ["K12", "Sakai"],
  "adapter": {
    "type": "AllVsAllPAFAdapter",
    "pafLocation": { "uri": "all_vs_all.paf.gz" },
    "assemblyNames": ["K12", "Sakai"]
  }
}
```

If a JBrowse assembly name differs from its PanSN sample prefix, map it with the
`assemblyNameToPanSN` slot (e.g. `{ "grape": "Vitis_vinifera" }`).

Unlike a reference-anchored `.blocks` table, an all-vs-all file is a **complete
graph** — every adjacent band is a real, direct alignment, so you can stack the
genomes in any order without worrying about transitive links. This makes it the
most convenient source when you have it.
