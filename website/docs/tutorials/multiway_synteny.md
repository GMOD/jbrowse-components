---
title: Synteny from ortholog tables
description:
  Stack N genomes in a linear synteny view from a jcvi MCScan .blocks file
guide_category: Tutorials
---

A linear synteny view can stack more than two genomes: N genome rows with a
synteny "ribbon" band between each adjacent pair. This tutorial builds a
three-way grape / peach / cacao view from a single
[jcvi](https://github.com/tanghaibao/jcvi) MCScan **`.blocks`** file — the
standard way the comparative-genomics community encodes a cross-species,
gene-level ortholog table.

For closely related genomes — strains or accessions of one species — a
whole-genome all-vs-all PAF is usually a better source. See
[Synteny all-vs-all](/docs/tutorials/allvsall_synteny).

Every figure below links to the live session that produced it — open the
finished stacked view from its caption to explore it yourself.

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

This is a coordinate-free gene-id table. The accompanying `.bed` files (one per
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

You now have `grape.blocks` plus `grape.bed`, `peach.bed`, and `cacao.bed`. The
adapter reads them plain or gzipped, so `gzip grape.blocks *.bed` to match the
`.gz` paths used below.

## Loading it in JBrowse with MCScanBlocksAdapter

A synteny band draws one pair of genomes, but a `.blocks` file describes N. The
`MCScanBlocksAdapter` bridges this: **one `.blocks` file — and one track — backs
every band of the stacked view.** List all the genomes in `assemblyNames`. The
view tells the adapter which pair each band draws, and the adapter pulls those
two columns from the table.

The `blockAssemblies` slot names every column in order (column 0 first), and
`bedLocations` gives the matching per-column BED:

```json
{
  "type": "SyntenyTrack",
  "trackId": "grape_peach_cacao_blocks",
  "name": "Grape / peach / cacao (MCScan blocks)",
  "assemblyNames": ["grape", "peach", "cacao"],
  "adapter": {
    "type": "MCScanBlocksAdapter",
    "mcscanBlocksLocation": { "uri": "grape.blocks.gz" },
    "blockAssemblies": ["grape", "peach", "cacao"],
    "bedLocations": [
      { "uri": "grape.bed.gz" },
      { "uri": "peach.bed.gz" },
      { "uri": "cacao.bed.gz" }
    ],
    "assemblyNames": ["grape", "peach", "cacao"]
  }
}
```

## Stacking the three genomes

With the track in your config, open the stack either from the UI or
declaratively. In the UI, add a linear synteny view (**Add → Linear synteny
view**), open **Quick start from a synteny track**, and pick
`grape_peach_cacao_blocks`: because it lists all three assemblies, each becomes
a row and the one track is wired to back every adjacent band. The
[all-vs-all tutorial](/docs/tutorials/allvsall_synteny#from-the-ui) walks
through this same quick start step by step.

To open the stack automatically on load, drop the view snapshot into the
config's `defaultSession` — the declarative way JBrowse opens a view, with no
clicks or imperative setup. This demo stacks them peach – cacao – grape:

```json
{
  "defaultSession": {
    "name": "Grape / Peach / Cacao multi-way synteny",
    "views": [
      {
        "type": "LinearSyntenyView",
        "displayName": "Peach – Cacao – Grape (MCScan blocks)",
        "showColorLegend": false,
        "init": {
          "views": [
            { "assembly": "peach" },
            { "assembly": "cacao" },
            { "assembly": "grape" }
          ],
          "tracks": [
            ["grape_peach_cacao_blocks"],
            ["grape_peach_cacao_blocks"]
          ],
          "colorBy": "reference",
          "autoDiagonalize": true
        }
      }
    ]
  }
}
```

`tracks` is one entry per band: `tracks[0]` connects rows 0–1 (peach–cacao) and
`tracks[1]` connects rows 1–2 (cacao–grape) — both served by the same track,
which lists all three genomes in `assemblyNames` so it can back any pair.
`displayName` and `showColorLegend` are ordinary view properties and sit beside
`type`; the one-time load settings (row order, tracks, `colorBy`,
`autoDiagonalize`) go under `init`.

`autoDiagonalize` reorders and flips each row's chromosomes on load so the
ribbons run along the diagonal instead of crossing into a hairball. It sweeps
top-down: the top row stays put, the middle row is reordered to follow it, then
the bottom row is reordered to follow the _reordered_ middle row — so the
diagonal cascades down the whole stack.

`colorBy: "reference"` anchors every band on the shared middle row — cacao, the
one genome both bands touch — so a cacao chromosome keeps a single color as its
orthologs trace up into peach and down into grape. The view's **Color by** menu
offers the other modes (`query`, `strand`, `identity`, …).

<Figure caption="Three genomes stacked peach – cacao – grape, with one MCScan .blocks file backing both synteny bands. autoDiagonalize has reordered and flipped each row's chromosomes so the ribbons run along the diagonal. Color by → Reference anchors both bands on the shared middle row (cacao), so a cacao chromosome keeps one color as its orthologs are traced up into peach and down into grape." src="/img/multiway_synteny/grape_peach_cacao.png" />

## Direct vs transitive pairs

Because a `.blocks` table is reference-anchored on grape (column 0), only pairs
that **include** grape are direct alignments. The adapter still serves a pair
where neither side is the reference — e.g. peach–cacao above — by joining the
two columns on their shared grape gene: a **transitive** ortholog link, not a
direct alignment. So row order is a choice — when one genome dominates (grape's
19 chromosomes vs peach's 8 / cacao's 10) put the cleaner pair on top; otherwise
put the reference in the **middle** (peach – grape – cacao) so every band is
direct.

## See also

- [Synteny all-vs-all](/docs/tutorials/allvsall_synteny) — the whole-genome,
  complete-graph workflow for strains and accessions of one species
- [Synteny visualization](/docs/tutorials/synteny_visualization) — pairwise
  dotplot and linear synteny basics
- [Linear synteny view](/docs/user_guides/linear_synteny_view) — full reference
  for the multi-row `views`/`tracks` structure used above
- [Synteny track config guide](/docs/config_guides/synteny_track) — adapter and
  display options for synteny tracks in general
- [MCScanBlocksAdapter config](/docs/config/mcscanblocksadapter) — full schema
  for the adapter used above
