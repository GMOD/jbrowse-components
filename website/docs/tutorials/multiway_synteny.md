---
title: Synteny visualization (ortholog tables)
sidebar_label: Synteny (ortholog tables)
description: Stack N genomes from a jcvi MCScan .blocks file
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
---

**TL;DR:** stack N genomes in one linear synteny view from a single wide
ortholog table, using `MCScanBlocksAdapter` with one BED per column. The adapter
pairs any two columns, so the table can be all-vs-all. What limits you to one
reference is the tool that wrote it: jcvi MCScan anchors every row on one
genome, while OrthoFinder orthogroups do not.

## Prerequisites

- [jcvi](https://github.com/tanghaibao/jcvi) with the
  [LAST](https://gitlab.com/mcfrith/last) aligner
- Or any other ortholog table, including an
  [MCScanX](https://github.com/wyp1125/MCScanX) run
  ([converting one](#from-mcscanx) needs only python3)
- the NCBI
  [`datasets`](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/download-and-install/)
  CLI, and [gffread](https://github.com/gpertea/gffread)
- `samtools`, htslib (`bgzip`, `tabix`)
- `node`, for the [JBrowse CLI](/docs/cli)

On Debian/Ubuntu, `apt install samtools tabix last-align gffread` covers the
aligner and the file tools; jcvi installs with `pip install jcvi`, `datasets` is
a single-binary download, and `node` comes from
[nodejs.org](https://nodejs.org/).

## Three genomes from one ortholog table

Like [All-vs-all synteny](/docs/tutorials/allvsall_synteny), a linear synteny
view here stacks more than two genomes: N genome rows with a synteny "ribbon"
band between each adjacent pair. This tutorial builds a three-way grape / peach
/ cacao view from a single [jcvi](https://github.com/tanghaibao/jcvi) MCScan
`.blocks` file, a standard cross-species ortholog table.

For closely related genomes (strains or accessions of one species), a
whole-genome all-vs-all PAF is usually a better source. See
[All-vs-all synteny](/docs/tutorials/allvsall_synteny).

## What a `.blocks` file is

A `.blocks` file is a wide, tab-delimited table: one row per group of
orthologous genes, one column per genome, `.` where a genome has no member.

```
GSVIVT01012255001   Prupe.1G290900.1   Thecc1EG011472t1
GSVIVT01012253001   Prupe.1G290800.2   Thecc1EG011473t1
GSVIVT01012261001   .                  .
```

This is a coordinate-free gene-id table. The accompanying `.bed` files (one per
genome, produced alongside) map each gene id to a genomic position.

### One reference, or all against all

Worth being precise about, because the two are easy to conflate and only one of
them is a real limit.

**The format and the adapter are not reference-anchored.** To draw a pair the
adapter takes the two columns for those genomes and keeps the rows where both
cells resolve. It never consults column 0, so a row carrying a peach gene and a
cacao gene draws a peach-cacao link whether or not that row also has a grape
gene, and a table with no reference column at all is fine.

**jcvi MCScan tables are.** `mcscan` writes one row per gene of the genome you
anchor on, so a peach-cacao ortholog with no grape counterpart has no row to
live in. Joining several `grape.X` tables side by side, as the
[script below](#reproduce-it-end-to-end) does, gives every non-grape pair only
the orthologs that happen to pass through grape. For grape against each of the
others, which is what the one-vs-all figure draws, that costs nothing: those
columns are direct grape-vs-X alignments. For the peach-cacao band in a stacked
view it is a real approximation.

**OrthoFinder orthogroups are not.** `Orthogroups.tsv` is inferred across all
the genomes at once, so a group can contain peach and cacao and no grape, and it
converts to this table with nothing lost.
[](/docs/tutorials/orthofinder_synteny) builds a six-genome view that way. Use
it when the non-reference pairs matter; use MCScan when you want synteny blocks
rather than gene-level orthogroups.

Nothing in the adapter is specific to jcvi: any ortholog table of this shape
loads, whatever produced it. See
[Bringing your own ortholog table](#bringing-your-own-ortholog-table).

## Producing the data

`grape.blocks` and the BED files come from
[jcvi](https://github.com/tanghaibao/jcvi) and the
[LAST](https://gitlab.com/mcfrith/last) aligner. Every species is one NCBI
RefSeq accession, fetched with the `datasets` CLI: grape `GCF_030704535.1`,
peach `GCF_000346465.2`, cacao `GCF_000208745.1`, and for the extra lanes
arabidopsis `GCF_000001735.4`, poplar `GCF_000002775.5`, tomato
`GCF_036512215.1` and citrus `GCF_000493195.1`. One accession supplies the
genome, the annotation and (through `gffread`) the CDS, so an assembly and the
annotation drawn on it cannot be two different builds — which is the failure
this is worth being careful about, because it shows up as features that quietly
fail to resolve rather than as an error. From there: convert each GFF3 to a jcvi
BED, catalog orthologs against grape, MCScan each pair, and join the results.
The [end-to-end script](#reproduce-it-end-to-end) at the bottom runs every
command.

NCBI names sequences by accession, so each assembly also gets a `refNameAliases`
file built from the accession-to-chromosome mapping in the download's own
sequence report. That is a lookup rather than a guess, which is what makes it
safe: the accession already identifies that exact sequence.

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

### From MCScanX

[MCScanX](https://github.com/wyp1125/MCScanX) writes one `.collinearity` file
holding every block it found across every pair of genomes in the run, rather
than a table.
[`mcscanx_to_anchors.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/mcscanx_to_anchors.py)
pivots one into a table, given the two-letter chromosome tag MCScanX uses for
each genome:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/mcscanx_to_anchors.py
python3 mcscanx_to_anchors.py --gff xyz.gff --collinearity xyz.collinearity \
  --species vv=grape --species pp=peach --species tc=cacao
```

That writes `grape.blocks` and a BED per genome, which the config below loads as
they are. The first `--species` is column 0, so it is the reference this table
is anchored on: only pairs that include it fill a cell, and a MCScanX block
between two non-reference genomes is dropped, since the adapter derives that
pair through the reference anyway. Where MCScanX puts one reference gene in
blocks against several genes of another genome, the best-scoring one takes the
cell, because a cell holds a single id.

The same script's refName and strand handling is described in the
[pairwise MCScan tutorial](/docs/tutorials/mcscan_synteny#coming-from-mcscanx),
and applies to the BEDs written here too. Given two `--species` it writes that
tutorial's `.anchors` files instead of a table.

### From OrthoFinder

`Orthogroups.tsv` is already one row per orthogroup and one column per genome,
but it carries a header row, a leading `Orthogroup` id column, and
comma-separated gene lists per cell:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/orthogroups_to_blocks.py
python3 orthogroups_to_blocks.py Orthogroups.tsv -o grape.blocks \
  --bed grape=grape.bed --bed peach=peach.bed
```

The script prints the column order `blockAssemblies` needs, which comes from the
header row rather than from the order the FASTAs were given to OrthoFinder, and
by default a duplicated gene becomes one row per copy rather than a link to
whichever copy was listed first. [](/docs/tutorials/orthofinder_synteny) builds
a six-genome view this way and covers both choices.

### From Ensembl Compara

Compara publishes one TSV per species holding its homologies against every
other, so an ortholog table is a download rather than an all-against-all protein
search. This one takes sorghum against bread wheat and against Aegilops
tauschii, writing a table per pair:

```bash
curl -fO https://ftp.ensemblgenomes.ebi.ac.uk/pub/plants/release-63/tsv/ensembl-compara/homologies/sorghum_bicolor/Compara.116.protein_default.homologies.tsv.gz
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/compara_to_blocks.py
python3 compara_to_blocks.py Compara.116.protein_default.homologies.tsv.gz \
  --reference sorghum_bicolor=sorghum \
  --species triticum_aestivum=wheat --species aegilops_tauschii=tauschii \
  --bed sorghum=sorghum.bed --bed wheat=wheat.bed --bed tauschii=tauschii.bed
```

An export covers a fixed set of partner species rather than every genome in the
division, and they are not reciprocal: sorghum's file carries both bread wheat
and tauschii, while bread wheat's carries neither. Naming a partner the file
does not have exits with the list of the ones it does.

Each row carries what the inference measured, plus a `copies` column the script
counts: how many orthologs the reference gene has in that partner. The adapter
names them with `attributeColumns`:

```json
{
  "type": "SyntenyTrack",
  "trackId": "sorghum_wheat",
  "name": "Sorghum / bread wheat orthologs",
  "assemblyNames": ["sorghum", "wheat"],
  "adapter": {
    "type": "MCScanBlocksAdapter",
    "uri": "sorghum.wheat.blocks.gz",
    "blockAssemblies": ["sorghum", "wheat"],
    "bedLocations": [{ "uri": "sorghum.bed.gz" }, { "uri": "wheat.bed.gz" }],
    "assemblyNames": ["sorghum", "wheat"],
    "attributeColumns": ["identity", "homology_identity", "goc_score", "copies"]
  }
}
```

Each named column becomes a feature attribute, so it shows in the detail panel
when a ribbon is clicked, and each is offered in the view's **Color by** menu
under its own name. `identity` has a named mode with a fixed 0-100% domain; the
rest scale to the values in view.

A column describes the **row**, so it is meaningful where a row is one link,
which is why the script writes one table per pair rather than one for the set.
That is not a limit on stacking genomes: a synteny view takes one entry per
band, so an N-genome stack uses N-1 pairwise tracks, each carrying its own
measurements.

#### Selection pressure between a polyploid's own copies

Bread wheat is an allohexaploid, carrying three near-complete copies of its
genome, so almost every gene exists three times. Compara types those trios as
`homoeolog_one2one`, which makes bread wheat against _itself_ a comparison of
69,940 gene pairs:

```bash
python3 compara_to_blocks.py Compara.116.protein_default.homologies.tsv.gz \
  --reference triticum_aestivum=wheat --species triticum_aestivum=wheat \
  --homology-type homoeolog_one2one --bed wheat=wheat.bed
```

One assembly named twice is a self-comparison, and `blockAssemblies` lists it
once per column so the two sides stay distinguishable.

Nothing publishes dN/dS for those pairs, so it is computed:
[`kaks_from_pairs.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/kaks_from_pairs.py)
aligns each pair in codon space and runs Nei-Gojobori, writing the `dn` and `ds`
columns **Color by → dN/dS** divides, plus the substitution count and Fisher p
that say whether a given ratio means anything. Homoeologs are recent enough that
dS stays well short of where the method saturates.

The plot that comes out is the left panel of
[the wheat-and-oat figure](/docs/tutorials/homoeolog_synteny#reading-the-plot),
where it sits beside a second hexaploid and is worth more than it is alone: the
two are the same picture of the same three homoeologous groups, so what differs
between them is the karyotype rather than the method. Three things read off the
wheat side: the subgenome structure as parallel segments, the 4A translocations
as segments leaving their group, and per-gene divergence as colour. 4A carries
359 links to 5D and 199 to 7D where an unrearranged chromosome carries about 20.

The blue is the reliable part of that colour. Very few of the warm pairs survive
the Fisher test in the table's own `fisher_p` column, which is what a pairwise
ratio can and cannot support; see
[Selection pressure](/docs/tutorials/selection_pressure).

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

Only the first six BED fields are read. From a GFF3:

```bash
awk -F'\t' -v OFS='\t' '$3 == "gene" && match($9, /ID=[^;]+/) {
  id = substr($9, RSTART + 3, RLENGTH - 3)
  sub(/^gene:/, "", id)
  print $1, $4 - 1, $5, id, 0, $7
}' grape.gff3 > grape.bed
```

Ensembl namespaces its GFF3 ids (`ID=gene:VIT_00000001`) where its proteomes do
not, so the `sub` is what makes an Ensembl BED match an ortholog table built
from Ensembl proteins.

Three of the six fields have a job. Column 1 must use the same sequence names as
the JBrowse assembly. Column 4 must match the table's gene ids byte for byte;
ids get mangled by isoform suffixes, by BLAST truncating a FASTA header at the
first space, and by jcvi stripping suffixes unless run with `--no_strip_names`
(which is why the [script](#reproduce-it-end-to-end) passes it). Column 6 is
each gene's strand, and a ribbon is drawn inverted when the two ends disagree,
so a BED written without it draws every ribbon as if the gene pair were
collinear.

A column whose BED places none of its ids fails the track naming that column,
and so does a table that resolves nowhere; the
[adapter's gotchas](/docs/config_guides/synteny_track#gene-ids-are-the-join-in-the-mcscan-adapters)
cover which mismatches are loud and which are not.

## Setting up the three assemblies

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
UI steps above. This demo stacks them peach-cacao-grape:

```json
{
  "defaultSession": {
    "name": "Grape / Peach / Cacao multi-way synteny",
    "views": [
      {
        "type": "LinearSyntenyView",
        "displayName": "Peach - Cacao - Grape (MCScan blocks)",
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

`tracks` is one entry per band: `tracks[0]` connects rows 0-1 (peach-cacao) and
`tracks[1]` connects rows 1-2 (cacao-grape), both served by the same track,
which lists all three genomes in `assemblyNames` so it can back any pair.
`displayName` and `showColorLegend` are ordinary view properties and sit beside
`type`. The one-time load settings (row order, tracks, `colorBy`,
`autoDiagonalize`) go under `init`.

`autoDiagonalize` reorders and flips each row's chromosomes on load so the
ribbons run along the diagonal instead of crossing over each other.

`colorBy: "reference"` anchors every band on the shared middle row (cacao) so
one chromosome keeps a single color across both bands. The view's **Color by**
menu offers the other modes (`query`, `strand`, `identity`, …).

<Figure caption="Three genomes stacked peach-cacao-grape, with one MCScan .blocks file backing both synteny bands. autoDiagonalize has reordered and flipped each row's chromosomes so the ribbons run along the diagonal. Color by → Reference anchors both bands on the shared middle row (cacao), so a cacao chromosome keeps one color as its orthologs are traced up into peach and down into grape." src="/img/multiway_synteny/grape_peach_cacao.png" />

## Direct vs transitive pairs

Because _this_ table came from MCScan anchored on grape (see
[One reference, or all against all](#one-reference-or-all-against-all)), only
pairs that include grape are direct alignments. The adapter still serves
peach-cacao, but every such link had to pass through a shared grape gene to get
a row at all, so it is transitive rather than a direct alignment, and any
peach-cacao ortholog grape has lost is simply absent. An OrthoFinder table has
no such asymmetry. Row order therefore matters here. When one genome dominates
(grape's 19 chromosomes against peach's 8 or cacao's 10), put the cleaner pair
on top. Otherwise put the reference in the middle (peach-grape-cacao) so every
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
shows its links to every genome in the table; **Group by... → Mate assembly**
splits them into a lane per genome. That is the one-genome reading of the same
table, and it is the reading that scales: adding a genome adds a lane, not a
panel, so the question stops being "how do these two compare" and becomes "which
of these kept it".

<Figure caption="One grape locus against six other plants, the same MCScan blocks track grouped by mate assembly. Each lane is one genome, and a bar means that grape gene has a syntenic partner there, so the lanes read as presence and absence down a column: the four rosids keep most of the block, tomato keeps one gene of it, and arabidopsis keeps a scattered few." src="/img/multiway_synteny/blocks_one_vs_all.png" />

## Reproduce it end to end

[`build_grape_peach_cacao_synteny.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_grape_peach_cacao_synteny.sh)
runs everything above in one shot. It downloads each genome from NCBI by
accession, runs the jcvi ortholog pipeline into one `grape.blocks` table,
downloads JBrowse, and writes a `config.json` with the assemblies and their
refName aliases, per-genome gene tracks, the MCScan blocks synteny track, and a
default session that stacks the three genomes. Its `BLOCKS_ONLY_SPECIES` list is
where the extra lanes come from: a genome added there needs only CDS and GFF3,
because a lane on the grape axis is resolved from the blocks table and that
genome's BED and never reads its sequence.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_grape_peach_cacao_synteny.sh
bash build_grape_peach_cacao_synteny.sh
npx --yes serve grape_peach_cacao_build/jbrowse2  # then open the printed URL
```

It needs everything under [Prerequisites](#prerequisites) on your `PATH`.

## See also

- [All-vs-all synteny](/docs/tutorials/allvsall_synteny)
- [](/docs/tutorials/homoeolog_synteny) - the same self-comparison with the
  pairs computed rather than downloaded, so it runs on any assembly
- [Synteny visualization](/docs/tutorials/synteny_visualization)
- [](/docs/tutorials/genomes_synteny) for hosted pairwise alignments with no
  setup
- [](/docs/user_guides/linear_synteny_view)
- [Synteny track config guide](/docs/config_guides/synteny_track)
- [MCScanBlocksAdapter config](/docs/config/mcscanblocksadapter)
