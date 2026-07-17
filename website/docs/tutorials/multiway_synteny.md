---
title: Synteny from ortholog tables
description: Stack N genomes from a jcvi MCScan .blocks file
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
---

A linear synteny view can stack more than two genomes: N genome rows with a
synteny "ribbon" band between each adjacent pair. This tutorial builds a
three-way grape / peach / cacao view from a single
[jcvi](https://github.com/tanghaibao/jcvi) MCScan `.blocks` file, the standard
way the comparative-genomics community encodes a cross-species, gene-level
ortholog table.

For closely related genomes (strains or accessions of one species), a
whole-genome all-vs-all PAF is usually a better source. See
[Synteny all-vs-all](/docs/tutorials/allvsall_synteny).

Every figure below links to the live session that produced it. Open the finished
stacked view from its caption to explore it yourself.

## What a `.blocks` file is

jcvi does not align all genomes at once. It runs pairwise comparisons against
one reference genome, then joins the results on the reference gene into a single
wide, tab-delimited table:

```
GSVIVT01012255001   Prupe.1G290900.1   Thecc1EG011472t1
GSVIVT01012253001   Prupe.1G290800.2   Thecc1EG011473t1
GSVIVT01012261001   .                  .
```

- Column 0 is a reference gene (grape here).
- Each further column is that gene's ortholog in another genome (`.` = none).
- One row per reference gene.

This is a coordinate-free gene-id table. The accompanying `.bed` files (one per
genome, produced alongside) map each gene id to a genomic position.

## Producing the data

Install [jcvi](https://github.com/tanghaibao/jcvi) and the
[LAST](https://gitlab.com/mcfrith/last) aligner, then grab the genome (dna),
CDS, and GFF3 for each species from
[Ensembl Plants release 58](http://ftp.ensemblgenomes.org/pub/plants/release-58),
renaming to the short `grape` / `peach` / `cacao` names used throughout (a
`short prefix assembly` table drives the loop):

```bash
base=http://ftp.ensemblgenomes.org/pub/plants/release-58
while read -r name prefix asm; do
  species=$(echo "$prefix" | tr 'A-Z' 'a-z')
  wget -O $name.dna.fa.gz  $base/fasta/$species/dna/$prefix.$asm.dna.toplevel.fa.gz
  wget -O $name.cds.fa.gz  $base/fasta/$species/cds/$prefix.$asm.cds.all.fa.gz
  wget -O $name.gff3.gz    $base/gff3/$species/$prefix.$asm.58.gff3.gz
  gunzip -c $name.dna.fa.gz > $name.fa
done <<'EOF'
grape  Vitis_vinifera   PN40024.v4
peach  Prunus_persica   Prunus_persica_NCBIv2
cacao  Theobroma_cacao  Theobroma_cacao_20110822
EOF
```

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

The `cut -f1,2,4` keeps the grape gene (col 1), its peach ortholog (col 2), and
its cacao ortholog (col 4), dropping col 3, the duplicate grape column the join
emits from the second table.

You now have `grape.blocks` plus `grape.bed`, `peach.bed`, and `cacao.bed`. The
adapter reads them plain or gzipped, so `gzip grape.blocks *.bed` to match the
`.gz` paths used below.

## Set up the three assemblies

The stacked view has one row per genome, so grape, peach, and cacao must each be
a JBrowse assembly whose name matches an entry in the track's `assemblyNames`.
Add each genome FASTA (the same Ensembl Plants genomes the `.bed` coordinates
refer to) with the CLI:

```bash
for sp in grape peach cacao; do
  jbrowse add-assembly $sp.fa --name $sp --load copy
done
```

Each assembly's reference sequence names must match the chromosome names in the
corresponding `.bed` file. See the
[assemblies configuration guide](/docs/config_guides/assemblies) for the
equivalent JSON.

## Loading it in JBrowse with MCScanBlocksAdapter

A synteny band draws one pair of genomes, but a `.blocks` file describes N. The
`MCScanBlocksAdapter` bridges this: one `.blocks` file, and one track, backs
every band of the stacked view. List all the genomes in `assemblyNames`. The
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

`bedLocations` is a per-column array and `blockAssemblies` names those columns.
Neither is expressible as a `jbrowse add-track` flag. To add this track from the
CLI, save the JSON above to a file and hand it to `jbrowse add-track-json`,
which inserts a full track config verbatim (any adapter shape works):

```bash
jbrowse add-track-json blocks_track.json --out /path/to/jb2
```

Unlike `add-track`, `add-track-json` only writes the config and does not copy
data files, so put `grape.blocks.gz` and the BED files where their `uri`s point
(e.g. the config directory) or reference them by URL.

## Stacking the three genomes

With the track in your config, open the stack either from the UI or
declaratively. In the UI, add a linear synteny view (**Add → Linear synteny
view**), which opens in **Quick start**, and pick `grape_peach_cacao_blocks`:
because it lists all three assemblies, each becomes a row and the one track is
wired to back every adjacent band. The
[all-vs-all tutorial](/docs/tutorials/allvsall_synteny#from-the-ui) walks
through this same Quick start step by step.

To open the stack automatically on load, add a top-level `defaultSession` key to
your `config.json` holding the view snapshot, the declarative way JBrowse opens
a view, with no clicks or imperative setup. This demo stacks them peach – cacao
– grape:

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
`tracks[1]` connects rows 1–2 (cacao–grape), both served by the same track,
which lists all three genomes in `assemblyNames` so it can back any pair.
`displayName` and `showColorLegend` are ordinary view properties and sit beside
`type`; the one-time load settings (row order, tracks, `colorBy`,
`autoDiagonalize`) go under `init`.

`autoDiagonalize` reorders and flips each row's chromosomes on load so the
ribbons run along the diagonal instead of crossing over each other. It works
top-down: the top row stays put, the middle row is reordered to follow it, and
then the bottom row is reordered to follow the reordered middle row, so the
diagonal carries all the way down the stack.

`colorBy: "reference"` anchors every band on the shared middle row (cacao, the
one genome both bands touch) so a cacao chromosome keeps a single color as its
orthologs trace up into peach and down into grape. The view's **Color by** menu
offers the other modes (`query`, `strand`, `identity`, …).

<Figure caption="Three genomes stacked peach – cacao – grape, with one MCScan .blocks file backing both synteny bands. autoDiagonalize has reordered and flipped each row's chromosomes so the ribbons run along the diagonal. Color by → Reference anchors both bands on the shared middle row (cacao), so a cacao chromosome keeps one color as its orthologs are traced up into peach and down into grape." src="/img/multiway_synteny/grape_peach_cacao.png" />

## Direct vs transitive pairs

Because a `.blocks` table is reference-anchored on grape (column 0), only pairs
that include grape are direct alignments. The adapter can still serve a pair
where neither side is the reference (peach–cacao above, say) by joining the two
columns on their shared grape gene, but that's a transitive ortholog link rather
than a direct alignment. So row order is a real choice. When one genome
dominates — grape's 19 chromosomes against peach's 8 or cacao's 10 — put the
cleaner pair on top; otherwise put the reference in the middle (peach – grape –
cacao) so every band is direct.

## Zooming to a conserved block

A whole-genome multi-way view is busy: several grape segments map to each peach
or cacao segment, so the ribbons genuinely cross. Zooming to a single conserved
block tells the clearer story. Grape chromosome 11 and its homeologs (peach G7
and cacao IX) stay collinear across all three genomes. Putting grape in the
middle makes both bands direct MCScan pairs.

At the gene level, the ribbons connect individual orthologous genes. Turning on
each genome's gene track (with **Show only genes** so each locus collapses to
its gene glyph) shows a run of ten orthologs stepping in the same order across
grape, peach, and cacao.

<Figure caption="Gene-level view of the same block: ten consecutive orthologs run in the same order across grape, peach, and cacao, so each synteny ribbon links one gene to its ortholog in the row above and below." src="/img/multiway_synteny/grape_peach_cacao_gene_orthologs.png" />

## See also

- [Synteny all-vs-all](/docs/tutorials/allvsall_synteny) - the whole-genome,
  complete-graph workflow for strains and accessions of one species
- [Synteny visualization](/docs/tutorials/synteny_visualization) - pairwise
  dotplot and linear synteny basics
- [Linear synteny view](/docs/user_guides/linear_synteny_view) - full reference
  for the multi-row `views`/`tracks` structure used above
- [Synteny track config guide](/docs/config_guides/synteny_track) - adapter and
  display options for synteny tracks in general
- [MCScanBlocksAdapter config](/docs/config/mcscanblocksadapter) - full schema
  for the adapter used above
