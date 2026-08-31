---
title: Synteny from an ortholog table (grape, peach, cacao)
sidebar_label: Synteny (ortholog tables)
description: Stack N genomes from a jcvi MCScan .blocks file
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
data: pipeline
---

**TL;DR:** jcvi's MCScan lines up orthologous genes across more than two genomes
at once, into one wide table with a column per species. We load that table
directly, draw grape, peach and cacao as rows of a single synteny view, and then
read one grape locus across all seven plant genomes without leaving grape's own
view.

## Prerequisites

- [jcvi](https://github.com/tanghaibao/jcvi) with the
  [LAST](https://gitlab.com/mcfrith/last) aligner
- Or any other ortholog table, including an
  [MCScanX](https://github.com/wyp1125/MCScanX) run
  ([converting one](#from-mcscanx) needs only python3)
- the NCBI
  [`datasets`](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/download-and-install/)
  CLI
- [gffread](https://github.com/gpertea/gffread)
- `samtools`
- htslib (`bgzip`, `tabix`)
- `node`, for the [JBrowse CLI](/docs/cli)

On Debian/Ubuntu, `apt install samtools tabix last-align gffread` covers the
aligner and the file tools; jcvi installs with `pip install jcvi`, `datasets` is
a single-binary download, and `node` comes from
[nodejs.org](https://nodejs.org/).

## Where the data comes from

Seven RefSeq assemblies, one per species, each fetched by accession with the
`datasets` CLI.

- grape:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/030/704/535/GCF_030704535.1_ASM3070453v1/
- peach:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/346/465/GCF_000346465.2_Prunus_persica_NCBIv2/
- cacao:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/208/745/GCF_000208745.1_Criollo_cocoa_genome_V2/
- arabidopsis:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/001/735/GCF_000001735.4_TAIR10.1/
- poplar:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/002/775/GCF_000002775.5_P.trichocarpa_v4.1/
- tomato:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/036/512/215/GCF_036512215.1_SLM_r2.1/
- citrus:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/493/195/GCF_000493195.1_Citrus_clementina_v1.0/

- the finished `.blocks` table, BEDs and config, rehosted so the stacked view
  loads without rerunning the pipeline:
  https://jbrowse.org/demos/grape_peach_cacao/config.json

## Three genomes from one ortholog table

A linear synteny view stacks more than two genomes: N genome rows with a synteny
"ribbon" band between each adjacent pair. This tutorial builds a three-way grape
/ peach / cacao view from a single [jcvi](https://github.com/tanghaibao/jcvi)
MCScan `.blocks` file, a standard cross-species ortholog table.

An ortholog table compares annotated genes, so it spans species too divergent to
line up base by base. [All-vs-all synteny](/docs/tutorials/allvsall_synteny)
stacks genomes from a whole-genome PAF, where they are close enough to align.

## What a `.blocks` file is

A `.blocks` file is a wide, tab-delimited table: one row per group of
orthologous genes, one column per genome, `.` where a genome has no member. The
file names none of its columns, so `blockAssemblies` does, by position. With
placeholder ids, a grape, peach and cacao table reads:

```
grape01	peach01	cacao01
grape02	peach02	cacao02
grape03	.	.
```

A real cell holds whatever that genome's annotation calls the gene, which for
the NCBI annotations below looks like `rna-XM_007225519.2`. The table carries no
coordinates: one `.bed` per genome, produced alongside, places each gene id.

### One reference, or all against all

A table is **reference-anchored** when every row starts from one genome's gene
and records what the others have for it, and **all against all** when a row is
an orthogroup inferred across the genomes at once. The difference is in the
pairs that leave the reference out.

**The format and the adapter take any two columns.** To draw a pair the adapter
keeps the rows where both of those cells resolve, and it never consults column
0, so a table with no reference column is fine.

**jcvi MCScan tables are anchored.** `mcscan` writes one row per gene of the
genome you anchor on, so a peach-cacao ortholog with no grape counterpart has no
row to live in. Grape against either mate is a direct alignment; peach against
cacao is what their shared grape genes imply, the approximation
[Direct vs transitive pairs](#direct-vs-transitive-pairs) measures.

**OrthoFinder infers each orthogroup across all the genomes at once.** A
peach-cacao ortholog gets its row whether or not grape kept one, so every pair
of columns rests on the same inference. [](/docs/tutorials/orthofinder_synteny)
builds a six-genome view that way.

**[MCScanX](https://github.com/wyp1125/MCScanX) compares every pair of genomes
in the run.** It writes them all to one `.collinearity` file, so the result is
all against all before anything anchors it. [Converting one](#from-mcscanx)
below picks a reference, and a pair that leaves it out stays loadable as a track
of its own.

### A duplicated gene

A cell holds one gene id, so a second copy needs somewhere else to go, and the
two conventions put it in different places.

`mcscan` writes a column per chain of synteny blocks rather than per genome, so
a grape gene syntenic to two peach regions fills a second peach column. `--iter`
caps how many chains it writes, and the run below pins it to the highest-scoring
one. At `--iter=2`:

```
grape01	peach01	peach01b
grape02	peach02	.
grape03	.	.
```

Name that column in `blockAssemblies` like any other, `peach` twice with
`peach.bed` twice beside it, and both are drawn: a grape gene with a copy in
each column links to each. `assemblyNames` lists the genomes the track can
render, so peach appears there once.

The other convention is a copy per row, repeating the grape id:

```
grape01	peach01	cacao01
grape02	peach02a	cacao02
grape02	peach02b	cacao02
grape03	.	.
```

Both rows resolve, so the grape-peach band draws a ribbon from `grape02` to each
copy, and the repeated `cacao02` draws its grape-cacao ribbon twice over.
`orthogroups_to_blocks.py` writes that shape by default; the MCScanX converter
keeps the best-scoring copy and drops the rest.

## Producing the data

`grape.blocks` and the BED files come from
[jcvi](https://github.com/tanghaibao/jcvi) and the
[LAST](https://gitlab.com/mcfrith/last) aligner, over the seven accessions under
[Where the data comes from](#where-the-data-comes-from), one per species. One
accession supplies the genome, the annotation and (through `gffread`) the CDS,
so the assembly and the annotation drawn on it cannot be two different builds.
From there, `gffread` extracts the CDS and jcvi converts the annotation:

<!-- from: scripts/build_grape_peach_cacao_synteny.sh -->

```bash
for sp in grape peach cacao; do
  gffread "$sp.gff3" -g "$sp.fa" -x "$sp.cds.fa"
  # --key=ID on both sides is what makes the two files join; --primary_only
  # keeps one transcript per gene, so a link is gene to gene
  python -m jcvi.formats.gff bed --type=mRNA --key=ID --primary_only \
    "$sp.gff3" -o "$sp.bed"
  python -m jcvi.formats.fasta format "$sp.cds.fa" "$sp.cds"
done
```

Both sides key on the mRNA's GFF3 `ID`, which is what makes the later join work:
gffread names each extracted CDS after that ID, and jcvi's `--key=ID` writes the
same string into BED column 4. jcvi falls back to a generated `mrna_494685` for
a key it cannot resolve, and a BED full of those joins to nothing, which is what
`--key=transcript_id` and `--key=Name` produce on an NCBI annotation.

Then catalog orthologs against the reference, MCScan each pair, and join:

<!-- from: scripts/build_grape_peach_cacao_synteny.sh -->

```bash
for sp in peach cacao; do
  # --no_strip_names keeps the ids matching the BEDs above
  python -m jcvi.compara.catalog ortholog --no_strip_names grape "$sp"
  # --iter=1 keeps one block per grape gene, which is one lane per mate
  python -m jcvi.compara.synteny mcscan grape.bed "grape.$sp.lifted.anchors" \
    --iter=1 -o "grape.$sp.i1.blocks"
done
python -m jcvi.formats.base join grape.peach.i1.blocks grape.cacao.i1.blocks \
  --noheader | cut -f1,2,4 > grape.blocks
```

Each per-pair table is two columns, grape then the mate, so the join emits the
grape column once per table. `cut -f1,2,4` keeps the grape anchor followed by
one mate per lane, which is the order `blockAssemblies` and `bedLocations` have
to list.

Each assembly also gets a `refNameAliases` file built from the download's own
sequence report, since NCBI names sequences by accession.

The adapter reads `.blocks` and BED files plain or gzipped.

## Bringing your own ortholog table

`MCScanBlocksAdapter` needs two inputs, neither of them MCScan-specific:

- a tab-delimited table, one row per orthogroup and one column per genome, each
  cell holding a single gene id (`.` or an empty cell for no ortholog)
- one BED per column whose fourth field carries those same gene ids

Any ortholog or all-vs-all homology result reshapes into that, and two columns
is a valid table, so a reciprocal-best-hit list already works as a pairwise
synteny track with no MCScan step.

### From MCScanX

[MCScanX](https://github.com/wyp1125/MCScanX) writes one `.collinearity` file
holding every block it found across every pair of genomes in the run.
[`mcscanx_to_anchors.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/mcscanx_to_anchors.py)
pivots one into a table, given the two-letter chromosome tag MCScanX uses for
each genome:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/mcscanx_to_anchors.py
python3 mcscanx_to_anchors.py --gff xyz.gff --collinearity xyz.collinearity \
  --species vv=grape --species pp=peach --species tc=cacao
```

That writes `grape.blocks` and a BED per genome. The first `--species` is column
0 and only a pair including it can fill a cell, so a block MCScanX found between
two non-reference genomes has nowhere to go in the table, and the adapter
reaches that pair transitively instead. Where one reference gene has blocks
against several genes of another genome, the best-scoring takes the cell.

`--blocks-score` appends the row's weakest pairing as a trailing column, which
the adapter's `attributeColumns` names:

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "grape_peach_cacao_scored",
  "name": "Grape / peach / cacao (MCScanX, scored)",
  "assemblyNames": ["grape", "peach", "cacao"],
  "adapter": {
    "type": "MCScanBlocksAdapter",
    "uri": "grape.blocks",
    "blockAssemblies": ["grape", "peach", "cacao"],
    "bedLocations": [
      { "uri": "grape.bed" },
      { "uri": "peach.bed" },
      { "uri": "cacao.bed" }
    ],
    "assemblyNames": ["grape", "peach", "cacao"],
    "attributeColumns": ["score"]
  }
}
```

Each named column becomes a feature attribute, so it shows in the detail panel
and gets its own entry in the palette button's menu, scaled to the values in
view.

The script's refName and strand handling is described in the
[pairwise MCScan tutorial](/docs/tutorials/mcscan_synteny_grape_peach#coming-from-mcscanx).
Given two `--species` it writes that tutorial's `.anchors` files, which draws a
pair the table left out as a second track on that band.

### From OrthoFinder

`Orthogroups.tsv` is already one row per orthogroup and one column per genome,
but it carries a header row, a leading `Orthogroup` id column, and
comma-separated gene lists per cell:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/orthogroups_to_blocks.py
python3 orthogroups_to_blocks.py Orthogroups.tsv -o grape.blocks \
  --bed grape=grape.bed --bed peach=peach.bed
```

The script prints the column order `blockAssemblies` needs, read off the header
row, which is OrthoFinder's own column order. By default a duplicated gene
becomes one row per copy. [](/docs/tutorials/orthofinder_synteny) builds a
six-genome view this way and covers both choices.

### From Ensembl Compara

Compara publishes one homology TSV per species, so the table is a download:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/compara_to_blocks.py
python3 compara_to_blocks.py Compara.116.protein_default.homologies.tsv.gz \
  --reference sorghum_bicolor=sorghum --species triticum_aestivum=wheat \
  --bed sorghum=sorghum.bed --bed wheat=wheat.bed
```

Each row carries what the inference measured, so `attributeColumns` can name
`identity`, `homology_identity` and `goc_score` the same way the scored MCScanX
table above names `score`. A partner species the export does not have writes no
table and says nothing, so check each `--species` name against the file's own
`homology_species` column. [](/docs/tutorials/homoeolog_synteny) uses this route
for one panel of its figure.

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

Any source that exports gene pairs per genome pair joins the same way. The
reference column is whichever genome you joined on, so the
[direct vs transitive](#direct-vs-transitive-pairs) distinction below applies to
any table built this way.

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
the JBrowse assembly. Column 4 must match the table's gene ids, which is where
this goes wrong: the
[adapter's gotchas](/docs/config_guides/synteny_track#gene-ids-are-the-join-in-the-mcscan-adapters)
cover how ids get mangled and which mismatches are loud, and the one this
pipeline has to pass `--no_strip_names` for is jcvi dropping isoform suffixes.
Column 6 is each gene's strand, and a ribbon is drawn inverted when the two ends
disagree.

## Setting up the three assemblies

The stacked view has one row per genome, so grape, peach, and cacao must each be
a JBrowse assembly whose name matches an entry in the track's `assemblyNames`.
Each genome FASTA goes in with `jbrowse add-assembly` (in the
[script](#reproduce-it-end-to-end) below). Each assembly's reference sequence
names must match the chromosome names in the corresponding `.bed` file. See the
[assemblies configuration guide](/docs/config_guides/assemblies) for the
equivalent JSON.

## Loading the blocks file with MCScanBlocksAdapter {#loading-it-in-jbrowse-with-mcscanblocksadapter}

A synteny band draws one pair, but a `.blocks` file describes N, so one track
backs every band of the stack: list all the genomes in `assemblyNames`, and the
view tells the adapter which pair each band draws. `blockAssemblies` names every
column in order (column 0 first) and `bedLocations` gives the matching
per-column BED:

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

Neither `bedLocations` nor `blockAssemblies` is expressible as a
`jbrowse add-track` flag, so this goes in with `jbrowse add-track-json`. That
writes the config and copies no data files, so the table and BEDs have to
already sit where their `uri`s point.

## Stacking the three genomes

Add a linear synteny view (**Add → Linear synteny view**) and pick
`grape_peach_cacao_blocks`: it lists all three assemblies, so each becomes a row
and the one track backs every adjacent band. The
[all-vs-all tutorial](/docs/tutorials/allvsall_synteny#from-the-ui) walks that
dialog step by step.

The declarative equivalent is a top-level `defaultSession`, here stacking them
peach-cacao-grape:

```json session config=https://jbrowse.org/demos/grape_peach_cacao/config.json
{
  "defaultSession": {
    "name": "Grape / Peach / Cacao multi-way synteny",
    "views": [
      {
        "type": "LinearSyntenyView",
        "displayName": "Peach - Cacao - Grape (MCScan blocks)",
        "views": [
          { "assembly": "peach" },
          { "assembly": "cacao" },
          { "assembly": "grape" }
        ],
        "tracks": [["grape_peach_cacao_blocks"], ["grape_peach_cacao_blocks"]],
        "colorBy": "reference",
        "autoDiagonalize": true
      }
    ]
  }
}
```

`tracks` is one entry per band: `tracks[0]` connects rows 0-1 (peach-cacao),
`tracks[1]` rows 1-2 (cacao-grape), both served by the same track.

`autoDiagonalize` reorders and flips each row's chromosomes on load so the
ribbons run along the diagonal. `colorBy: "reference"` anchors every band on the
shared middle row, so a cacao chromosome keeps one color across both.

<Figure caption="Three genomes stacked peach-cacao-grape, with one MCScan .blocks file backing both synteny bands. autoDiagonalize has reordered and flipped each row's chromosomes so the ribbons run along the diagonal, and Color by → Reference anchors both bands on the shared middle row." src="/img/multiway_synteny/grape_peach_cacao.png" />

## Direct vs transitive pairs

This table is anchored on grape, so only pairs including grape are direct
alignments. The adapter still serves peach-cacao, but each such link had to pass
through a shared grape gene to get a row, and any peach-cacao ortholog grape has
lost is absent. Row order therefore matters: put the reference in the middle
(peach-grape-cacao) and every band is direct. The demo above stacks grape at the
bottom, which is the transitive layout.

The [script](#reproduce-it-end-to-end) counts, per column pair, the rows where
both cells resolve, which is every link the band can draw. Grape's own pairs are
the control: every row has a grape gene, so a grape pair draws every row its
mate fills, and the peach-cacao pair falls short of that by whatever grape lost.

## Zooming to a conserved block

Zoom to one conserved block, with grape in the middle so both bands are direct,
and turn on each genome's gene track with **Show only genes**.

<Figure caption="Gene-level view of the same block: ten consecutive orthologs run in the same order across grape, peach, and cacao, so each synteny ribbon links one gene to its ortholog in the row above and below." src="/img/multiway_synteny/grape_peach_cacao_gene_orthologs.png" />

## One locus against all seven genomes

The stacked view draws three rows because only grape, peach and cacao were set
up as assemblies, and `grape.blocks` carries seven columns. The other four are
reachable from a plain linear genome view on grape, where the same track draws
every mate at once:

- Navigate to `11:778,000-866,000` and turn on the grape gene track.
- Turn on the ortholog track **Grape vs peach, cacao, arabidopsis, poplar,
  tomato, citrus (MCScan blocks)**, which in a plain view renders as an
  `LGVSyntenyDisplay`: every mate in one pileup.
- Pick **Group by... → Mate assembly** to split that pileup into a lane per
  genome. Adding a column to the table adds a lane.

<Figure caption="One grape locus against six other plants, the same MCScan blocks track grouped by mate assembly. Each lane is one genome, so the lanes read as presence and absence down a column: peach, cacao, poplar and citrus keep most of the block, arabidopsis a scattered few, and tomato, the one asterid, a single gene." src="/img/multiway_synteny/blocks_one_vs_all.png" />

## Each genome in its own coordinates

Every lane above is drawn on grape's axis, so it reads as presence and absence
down a column and nothing else: the lane cannot say where in peach's own genome
those genes sit, or how much peach DNA they take. **Display types → Multi-way
synteny display** on the same track redraws the lanes in each genome's own
coordinates:

- **Each lane is fitted to its own genome**, spanning the orthologs the visible
  window brings in, so a local expansion takes more of its own lane.
- **One grey ribbon per ortholog group**, joining adjacent lanes and bridging
  past a lane that places nothing for the group, down to the next that does.
- **Any track whose features carry a `mate` per other assembly** feeds the same
  lanes, so an
  [OrthoFinder orthogroup table](/docs/tutorials/orthofinder_synteny) or an
  [all-vs-all PAF](/docs/tutorials/allvsall_synteny) draws them too.

The same thing as a `defaultSession`, which the live link below opens directly:

```json session config=https://jbrowse.org/demos/grape_peach_cacao/config.json
{
  "defaultSession": {
    "name": "Grape multi-way synteny track",
    "views": [
      {
        "type": "LinearGenomeView",
        "assembly": "grape",
        "loc": "11:778,000-866,000",
        "tracks": [
          {
            "trackId": "grape_genes",
            "type": "LinearBasicDisplay",
            "showOnlyGenes": true,
            "displayMode": "compact"
          },
          {
            "trackId": "grape_peach_cacao_blocks",
            "type": "MultiWaySyntenyDisplay",
            "rowOrder": [
              "peach",
              "cacao",
              "poplar",
              "citrus",
              "arabidopsis",
              "tomato"
            ],
            "height": 340
          }
        ]
      }
    ]
  }
}
```

<Figure caption="The grape gene track over the same locus as a multi-way lane stack, one lane per genome from a single MCScan blocks track. The peach and cacao lanes carry their own gene models from those genomes' gene tracks, the lanes without one carry the table's gene spans as boxes, and a ribbon chain stops at the first lane missing the ortholog." src="/img/multiway_synteny/lgv_track_lanes.png" />

### What a lane header says

Each lane has its own scale, so each lane states it:

- **Left**: where the lane starts, with `[rev]` where its gene order runs
  against grape's.
- **Right**: the lane's span, and the multiple of grape's span where that is not
  one. A span snaps to a short ladder of those multiples, so a pan that leaves a
  lane on its rung leaves the lane's content where it was.
- **Ticks** fall at one interval shared by every mate lane, so two lanes at the
  same spacing are at the same bp-per-pixel. A lane zoomed far enough out that
  its ticks would read as hatching draws none, and its multiple is the scale
  statement instead.
- **The view's own gridlines stop at the grape lane**, the only lane they are
  true for.
- **A lane with no GFF3 track for its assembly** outlines the table's gene spans
  and says `no annotation`. Only grape, peach and cacao were loaded as
  assemblies here, so the four `BLOCKS_ONLY_SPECIES` lanes are boxes.

### Ordering the lanes

- `rowOrder` pins the lanes it names to the top; the rest follow densest-first
  over the whole fetched table, so the order holds still across a pan.
- Densest-first is a guard rather than a requirement, since a ribbon bridges
  past a lane that places nothing. Turn **Bridge lanes that place nothing** off
  and a sparse lane mid-stack cuts every chain running through it, which is what
  the ordering protects.

### Zooming to genes

Cut the window to a few genes and each ribbon connects one gene to one ortholog:

- A copy-number difference fans one gene into several.
- A lone ortholog draws at gene size, centered in its lane, since the shortest
  rung on the ladder of lane spans is grape's own.
- Hovering a ribbon names its ortholog group and highlights it down every lane
  that kept the gene; clicking a glyph opens the feature detail panel.

<Figure caption="The same lanes cut to a few genes, close enough to read exon structure in the annotated lanes. Each ribbon links one gene to its ortholog in the lane below, and the lanes that kept a single gene here show it at the anchor's scale." src="/img/multiway_synteny/lgv_track_zoom.png" />

<Video src="/media/synteny/multiway_zoom_out.mp4" caption="The grape lanes from gene scale back out to the block: a hovered ribbon reads one ortholog group down the stack, and each zoom-out re-fits every lane's own frame to the anchor's widening window." />

## Restacking around a locus

A lane you want to drive around on its own is the stacked view's job again, and
two routes reach it from the reading above:

- **From the lane track**, choose **Launch stacked synteny view (visible
  region)** in its track menu. The dialog opens cut from this track's dataset
  over the visible window, offering a full row to every genome aligning there.
- **From the scale bar**, drag-select a locus in any view that has the track
  open and pick **Launch → Linear synteny view**. The launch offers the synteny
  the launching view is drawing, and this track declares all three assemblies,
  so the dialog opens a row per genome with arrows to order them: moving grape
  between peach and cacao is the reference-in-the-middle arrangement from
  [Direct vs transitive pairs](#direct-vs-transitive-pairs), where both bands
  are direct.

<Video src="/media/synteny/restack_around_locus.mp4" caption="Restacking around one grape locus, from the lane reading above: a scale-bar selection raises Launch, the dialog lists a panel per genome and names the mates it can draw a lane for but not a panel, and one arrow moves the reference into the middle of the launched stack." />

## Reproduce it end to end

[`build_grape_peach_cacao_synteny.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_grape_peach_cacao_synteny.sh)
runs everything above in one shot: each genome from NCBI by accession, the jcvi
ortholog pipeline into one `grape.blocks` table, and a `config.json` with the
assemblies and their refName aliases, gene tracks, the synteny track and the
stacked default session. Its `BLOCKS_ONLY_SPECIES` list is where the extra lanes
come from, and a genome added there needs only CDS and GFF3, since a lane on the
grape axis never reads that genome's sequence.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_grape_peach_cacao_synteny.sh
bash build_grape_peach_cacao_synteny.sh
npx --yes serve grape_peach_cacao_build/jbrowse2  # then open the printed URL
```

It needs everything under [Prerequisites](#prerequisites) on your `PATH`.

## See also

- [](/docs/tutorials/allvsall_synteny)
- [](/docs/tutorials/orthofinder_synteny)
- [](/docs/tutorials/homoeolog_synteny)
- [](/docs/tutorials/synteny_visualization)
- [](/docs/tutorials/genomes_synteny)
- [](/docs/user_guides/linear_synteny_view)
- [](/docs/config_guides/synteny_track)
- [](/docs/config/mcscanblocksadapter)
- [](/docs/config/multiwaysyntenydisplay)
