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

Open the finished demo:
[Grape / peach / cacao 3-way synteny](https://jbrowse.org/code/jb2/main/?config=https://jbrowse.org/demos/grape_peach_cacao/config.json).

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

You now have `grape.blocks` plus `grape.bed`, `peach.bed`, and `cacao.bed`.

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

Stack the three genomes and reference that single track from each band. This
demo stacks them peach – cacao – grape:

```json
{
  "type": "LinearSyntenyView",
  "init": {
    "views": [
      { "assembly": "peach" },
      { "assembly": "cacao" },
      { "assembly": "grape" }
    ],
    "tracks": [["grape_peach_cacao_blocks"], ["grape_peach_cacao_blocks"]],
    "drawCurves": true,
    "autoDiagonalize": true
  }
}
```

`tracks` is one entry per band: `tracks[0]` connects rows 0–1 (peach–cacao) and
`tracks[1]` connects rows 1–2 (cacao–grape) — both served by the same track,
which lists all three genomes in `assemblyNames` so it can back any pair.

`autoDiagonalize` reorders and flips each row's chromosomes on load so the
ribbons run along the diagonal instead of crossing into a hairball. It sweeps
top-down: the top row stays put, the middle row is reordered to follow it, then
the bottom row is reordered to follow the _reordered_ middle row — so the
diagonal cascades down the whole stack.

That view snapshot goes straight into the config's `defaultSession`, which is
how JBrowse opens a view declaratively on load — no clicks, no imperative setup.
The session is a `views` array of the same snapshots. Sibling fields like
`displayName` and `showColorLegend` are ordinary view properties, while the
one-time load settings (row order, tracks, `colorBy`, `autoDiagonalize`) go
under `init`:

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
          "drawCurves": true,
          "colorBy": "query",
          "autoDiagonalize": true
        }
      }
    ]
  }
}
```

<Figure caption="Three genomes stacked peach – cacao – grape, with one MCScan .blocks file backing both synteny bands. autoDiagonalize has reordered and flipped each row's chromosomes so the ribbons run along the diagonal. Color by → Reference paints both bands by the max-adjacency middle row (cacao), so a cacao chromosome keeps one consistent color as its orthologs are traced up into peach and down into grape." src="/img/multiway_synteny/grape_peach_cacao.png" link="https://jbrowse.org/code/jb2/main/?config=https://jbrowse.org/demos/grape_peach_cacao/config.json" />

## Direct vs transitive pairs, and row order

Because a `.blocks` table is reference-anchored on grape (column 0), only pairs
that **include** grape are direct synteny relationships. The adapter can still
serve a pair where _neither_ side is the reference — e.g. peach–cacao, the top
band above — by joining the two columns on their shared grape gene. That link
means "both are orthologous to the same grape gene": a **transitive** ortholog
relationship, not a direct alignment.

So row order is a choice. Grape has more chromosomes (19) than peach (8) or
cacao (10), a consequence of an ancestral genome triplication, so any band
_containing_ grape fans out into a busy many-to-one ribbon tangle. Peach and
cacao have similar chromosome counts and align close to one-to-one. Stacking
peach – cacao – grape therefore puts the most legible band on top, at the cost
of making it a transitive link (peach and cacao joined through their shared
grape ortholog, not directly aligned). When no genome dominates like this, put
the reference in the **middle** — peach – grape – cacao — so _every_ band is a
direct comparison.

That triplication is easiest to see one chromosome at a time: restrict a
peach-vs-grape dotplot to a single peach chromosome and it resolves into three
diagonal blocks — the three grape paralogs of that region, the same 1:3 mapping
that makes a whole-genome grape/peach synteny show crossing ribbons.

## See also

- [Synteny all-vs-all](/docs/tutorials/allvsall_synteny) — the whole-genome,
  complete-graph workflow for strains and accessions of one species.
- [Synteny visualization](/docs/tutorials/synteny_visualization) — pairwise
  dotplot and linear synteny basics.
- [Linear synteny view](/docs/user_guides/linear_synteny_view) — full reference
  for the multi-row `views`/`tracks` structure used above.
- [Synteny track config guide](/docs/config_guides/synteny_track) — adapter and
  display options for synteny tracks in general.
- [MCScanBlocksAdapter config](/docs/config/mcscanblocksadapter) — full schema
  for the adapter used above.
