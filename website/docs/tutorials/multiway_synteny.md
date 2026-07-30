---
title: Synteny visualization (ortholog tables)
sidebar_label: Synteny (ortholog tables)
description: Stack N genomes from a jcvi MCScan .blocks file
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
---

**TL;DR:** stack N genomes in one linear synteny view from a single jcvi MCScan
`.blocks` ortholog table, using `MCScanBlocksAdapter` with one BED per column.
The table is reference-anchored on column 0, so only pairs that include that
reference are direct alignments and row order is a real choice.

## Prerequisites

- [jcvi](https://github.com/tanghaibao/jcvi) with the
  [LAST](https://gitlab.com/mcfrith/last) aligner
- `samtools`, htslib (`bgzip`, `tabix`), `wget`
- `node`, for the [JBrowse CLI](/docs/cli)

Like [All-vs-all synteny](/docs/tutorials/allvsall_synteny), a linear synteny
view here stacks more than two genomes: N genome rows with a synteny "ribbon"
band between each adjacent pair. This tutorial builds a three-way grape / peach
/ cacao view from a single [jcvi](https://github.com/tanghaibao/jcvi) MCScan
`.blocks` file, a standard cross-species ortholog table.

For closely related genomes (strains or accessions of one species), a
whole-genome all-vs-all PAF is usually a better source. See
[All-vs-all synteny](/docs/tutorials/allvsall_synteny).

## What a `.blocks` file is

A `.blocks` file is a wide, tab-delimited table, reference-anchored on one
genome:

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

Nothing in the adapter is specific to jcvi: any ortholog table of this shape
loads, whatever produced it. See
[Bringing your own ortholog table](#bringing-your-own-ortholog-table).

## Producing the data

`grape.blocks` and the three BED files come from
[jcvi](https://github.com/tanghaibao/jcvi) and the
[LAST](https://gitlab.com/mcfrith/last) aligner: for each species, download the
genome, CDS, and GFF3 from
[Ensembl Plants release 58](http://ftp.ensemblgenomes.org/pub/plants/release-58),
convert the GFF3 to a jcvi BED, catalog orthologs against grape, MCScan each
pair, and join the results into one reference-anchored table. The
[end-to-end script](#reproduce-it-end-to-end) at the bottom runs every command.

The adapter reads `.blocks` and BED files plain or gzipped, and the config below
uses the gzipped `.gz` names.

## Bringing your own ortholog table

`MCScanBlocksAdapter` needs two inputs, neither of them MCScan-specific:

- a tab-delimited table, one row per orthogroup and one column per genome, each
  cell holding a single gene id (`.` or an empty cell for no ortholog)
- one BED per column whose fourth field carries those same gene ids

Any ortholog or all-vs-all homology result reshapes into that. Two columns is a
valid table, so a plain reciprocal-best-hit list already works as a pairwise
synteny track with no MCScan step at all.

### From OrthoFinder

`Orthogroups.tsv` is already one row per orthogroup and one column per genome,
but it carries a header row, a leading `Orthogroup` id column, and
comma-separated gene lists per cell. Drop the first two and keep one gene per
cell:

```bash
tail -n +2 Orthogroups.tsv \
  | cut -f2- \
  | awk -F'\t' -v OFS='\t' '{
      for (i = 1; i <= NF; i++) {
        sub(/,.*/, "", $i)
        gsub(/ /, "", $i)
        if ($i == "") $i = "."
      }
      print
    }' > orthogroups.blocks
```

`blockAssemblies` then lists the genomes in the order of the header row you
dropped, which is the order of the FASTAs you gave OrthoFinder.

### From reciprocal best BLAST hits

Reduce each direction of an all-vs-all `blastp` or DIAMOND run (`-outfmt 6`) to
its best hit per query, then keep the pairs that agree both ways:

```bash
sort -k1,1 -k12,12gr grape_vs_peach.tsv | awk '!seen[$1]++ {print $1 "\t" $2}' > g2p
sort -k1,1 -k12,12gr peach_vs_grape.tsv | awk '!seen[$1]++ {print $1 "\t" $2}' > p2g
awk 'NR == FNR {best[$1] = $2; next} best[$2] == $1' p2g g2p > grape_peach.rbh
```

`grape_peach.rbh` is a two-column table, loadable as-is with
`blockAssemblies: ["grape", "peach"]`. For more genomes, run the same reduction
against one reference genome and outer-join the results on the reference gene:

```bash
export LC_ALL=C  # join and sort must agree on collation
join -t $'\t' -a1 -a2 -e . -o 0,1.2,2.2 \
  <(sort -k1,1 grape_peach.rbh) <(sort -k1,1 grape_cacao.rbh) > grape.blocks
```

Ensembl Compara, OrthoDB, InParanoid and SonicParanoid all export gene pairs per
genome pair, so they join the same way. The reference column is whichever genome
you joined on, so the [direct vs transitive](#direct-vs-transitive-pairs)
distinction below applies to any table built this way.

### BED files

Only the first six BED fields are read, and only the fourth (name) has to match
the table. From a GFF3:

```bash
awk -F'\t' -v OFS='\t' '$3 == "gene" {
  match($9, /ID=[^;]+/)
  print $1, $4 - 1, $5, substr($9, RSTART + 3, RLENGTH - 3), 0, $7
}' grape.gff3 > grape.bed
```

Column 1 must use the same sequence names as the JBrowse assembly, and column 4
must match the table's gene ids byte for byte. That last point is the usual
failure: the track loads without an error and draws nothing, because no cell
resolved to a BED entry. Ids get mangled by isoform suffixes, by BLAST
truncating a FASTA header at the first space, and by jcvi stripping suffixes
unless run with `--no_strip_names` (which is why the
[script](#reproduce-it-end-to-end) passes it). Spot-check a few ids from each
side against each other before loading.

## Set up the three assemblies

The stacked view has one row per genome, so grape, peach, and cacao must each be
a JBrowse assembly whose name matches an entry in the track's `assemblyNames`.
Each genome FASTA goes in with `jbrowse add-assembly` (in the
[script](#reproduce-it-end-to-end) below). Each assembly's reference sequence
names must match the chromosome names in the corresponding `.bed` file. See the
[assemblies configuration guide](/docs/config_guides/assemblies) for the
equivalent JSON.

## Loading it in JBrowse with MCScanBlocksAdapter

A synteny band draws one pair of genomes, but a `.blocks` file describes N. The
`MCScanBlocksAdapter` bridges this: a single `.blocks` file and a single track
back every band of the stacked view. List all the genomes in `assemblyNames`.
The view tells the adapter which pair each band draws, and the adapter pulls
those two columns from the table.

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
    "uri": "grape.blocks.gz",
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

Neither `bedLocations` (a per-column array) nor `blockAssemblies` (which names
those columns) is expressible as a `jbrowse add-track` flag, so this track goes
in with `jbrowse add-track-json`, which inserts a full track config verbatim
(any adapter shape works). Unlike `add-track`, it only writes the config and
does not copy data files, so put `grape.blocks.gz` and the BED files where their
`uri`s point (e.g. beside `config.json`) or reference them by URL.

## Stacking the three genomes

With the track in your config, open the stack either from the UI or
declaratively. In the UI, add a linear synteny view (**Add → Linear synteny
view**), which opens in **Quick start**, and pick `grape_peach_cacao_blocks`:
because it lists all three assemblies, each becomes a row and the one track is
wired to back every adjacent band. The
[all-vs-all tutorial](/docs/tutorials/allvsall_synteny#from-the-ui) walks
through this same Quick start step by step.

To open the stack automatically on load, add a top-level `defaultSession` key to
your `config.json` holding the view snapshot, the declarative alternative to the
UI steps above. This demo stacks them peach–cacao–grape:

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
`type`. The one-time load settings (row order, tracks, `colorBy`,
`autoDiagonalize`) go under `init`.

`autoDiagonalize` reorders and flips each row's chromosomes on load so the
ribbons run along the diagonal instead of crossing over each other.

`colorBy: "reference"` anchors every band on the shared middle row (cacao) so
one chromosome keeps a single color across both bands. The view's **Color by**
menu offers the other modes (`query`, `strand`, `identity`, …).

<Figure caption="Three genomes stacked peach–cacao–grape, with one MCScan .blocks file backing both synteny bands. autoDiagonalize has reordered and flipped each row's chromosomes so the ribbons run along the diagonal. Color by → Reference anchors both bands on the shared middle row (cacao), so a cacao chromosome keeps one color as its orthologs are traced up into peach and down into grape." src="/img/multiway_synteny/grape_peach_cacao.png" />

## Direct vs transitive pairs

Because a `.blocks` table is reference-anchored on grape (column 0), only pairs
that include grape are direct alignments. The adapter can still serve a pair
where neither side is the reference (peach–cacao above, say) by joining the two
columns on their shared grape gene, but that link is transitive rather than a
direct alignment. Row order therefore matters. When one genome dominates
(grape's 19 chromosomes against peach's 8 or cacao's 10), put the cleaner pair
on top. Otherwise put the reference in the middle (peach–grape–cacao) so every
band is direct. The demo above stacks grape on the bottom instead, to show the
transitive-band layout.

## Zooming to a conserved block

A whole-genome view is busy: many segments map to each other, so the ribbons
cross. Zoom to a single conserved block for a clearer story, and put grape in
the middle so both bands are direct MCScan pairs.

Turn on each genome's gene track with **Show only genes** (so each locus
collapses to its gene glyph) to see the ribbons connect individual orthologous
genes.

<Figure caption="Gene-level view of the same block: ten consecutive orthologs run in the same order across grape, peach, and cacao, so each synteny ribbon links one gene to its ortholog in the row above and below." src="/img/multiway_synteny/grape_peach_cacao_gene_orthologs.png" />

## Restacking around a locus

The stack above is fixed at load time, and rebuilding it by hand to put a
different genome in the middle is tedious. Instead, drag-select the locus in one
row's scale bar and pick **Launch → Linear synteny view**: with the MCScan track
as the dialog's dataset, and because it lists all three genomes, the dialog
finds both of the others and opens a row for each, with up/down arrows to order
them before launching.

The row you selected in is in that list too, so the whole stack is orderable
from one place: select in any row, drag grape to the middle, and you get the
reference-in-the-middle arrangement from
[Direct vs transitive pairs](#direct-vs-transitive-pairs) with both bands
direct.

The same track dropped into a plain linear genome view (as an
`LGVSyntenyDisplay`) draws every pair at once rather than one, so a grape row
shows both its peach and its cacao links; **Group by... > Mate assembly** splits
them into a lane per genome. That is the one-genome reading of the same table:
no second row to frame, and a lane per genome that has an ortholog there.

<Figure caption="The same block on grape alone, with the MCScan blocks track grouped by mate assembly. The peach and cacao lanes carry the anchors each genome shares with the grape genes above, so a gene with an ortholog in one of them draws a bar in one lane." src="/img/multiway_synteny/blocks_one_vs_all.png" />

## Reproduce it end to end

[`build_grape_peach_cacao_synteny.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_grape_peach_cacao_synteny.sh)
runs everything above in one shot. It downloads the grape, peach, and cacao
genomes from Ensembl Plants, runs the jcvi ortholog pipeline into one
`grape.blocks` table, downloads JBrowse, and writes a `config.json` with the
three assemblies, per-genome gene tracks, the MCScan blocks synteny track, and a
default session that stacks the three genomes.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_grape_peach_cacao_synteny.sh
bash build_grape_peach_cacao_synteny.sh
npx --yes serve grape_peach_cacao_build/jbrowse2  # then open the printed URL
```

It needs [jcvi](https://github.com/tanghaibao/jcvi) with the
[LAST](https://gitlab.com/mcfrith/last) aligner, `samtools`, htslib's `bgzip`
and `tabix`, `wget`, and node (for the JBrowse CLI).

## See also

- [All-vs-all synteny](/docs/tutorials/allvsall_synteny)
- [Synteny visualization](/docs/tutorials/synteny_visualization)
- [](/docs/tutorials/genomes_synteny) for hosted pairwise alignments with no
  setup
- [](/docs/user_guides/linear_synteny_view)
- [Synteny track config guide](/docs/config_guides/synteny_track)
- [MCScanBlocksAdapter config](/docs/config/mcscanblocksadapter)
