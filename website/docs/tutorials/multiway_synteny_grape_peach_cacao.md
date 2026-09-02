---
title: Synteny from an ortholog table (grape, peach, cacao)
sidebar_label: Synteny (ortholog tables)
description: Stack N genomes from a jcvi MCScan .blocks file
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
---

**TL;DR:** jcvi's MCScan lines up orthologous genes across more than two genomes
at once, into one wide table with a column per species. We load that table
directly, draw grape, peach and cacao as rows of a single synteny view, and then
read one grape locus across all seven plant genomes without leaving grape's own
view.

## Prerequisites

- a JBrowse to open them in: [Desktop](/docs/quickstart_desktop) takes a local
  file by path, [Web](/docs/quickstart_web) through **Add track**
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

A linear synteny view stacks N genome rows with a ribbon band between each
adjacent pair. This page builds a grape / peach / cacao stack from a single
[jcvi](https://github.com/tanghaibao/jcvi) MCScan `.blocks` file, a
cross-species ortholog table. An ortholog table compares annotated genes, so it
spans species too divergent to align base by base;
[all-vs-all synteny](/docs/tutorials/allvsall_synteny) covers genomes close
enough for a PAF.

## What a `.blocks` file is

A `.blocks` file is a tab-delimited table: one row per orthologous group, one
column per genome, `.` where a genome has no member. The file names none of its
columns, so `blockAssemblies` does, by position:

```
grape01	peach01	cacao01
grape02	peach02	cacao02
grape03	.	.
```

A real cell holds the annotation's own gene id (`rna-XM_007225519.2` for NCBI).
The table carries no coordinates; one `.bed` per genome places each id.

### One reference, or all against all

A table is **reference-anchored** when every row starts from one genome's gene,
and **all against all** when a row is an orthogroup inferred across the genomes
at once. The difference is in the pairs that leave the reference out. The
adapter takes any two columns and never consults column 0, so either shape
loads.

- **jcvi MCScan tables are anchored.** A peach-cacao ortholog with no grape
  counterpart has no row, so peach against cacao is what their shared grape
  genes imply. [Direct vs transitive pairs](#direct-vs-transitive-pairs)
  measures that.
- **OrthoFinder infers each orthogroup across all genomes at once**, so every
  pair of columns rests on the same inference.
  [](/docs/tutorials/orthofinder_synteny) builds a six-genome view that way.
- **[MCScanX](https://github.com/wyp1125/MCScanX) compares every pair** into one
  `.collinearity` file. [Converting one](#from-mcscanx) picks a reference, and a
  pair that leaves it out stays loadable as its own track.

### A duplicated gene

A cell holds one gene id, and two conventions place a second copy.

`mcscan` writes a column per chain of synteny blocks, so a grape gene syntenic
to two peach regions fills a second peach column. `--iter` caps the chains, and
the run below pins it to one. At `--iter=2`:

```
grape01	peach01	peach01b
grape02	peach02	.
grape03	.	.
```

Name that column `peach` in `blockAssemblies` with `peach.bed` beside it, and
both are drawn. `assemblyNames` lists the genomes the track can render, so peach
appears there once.

The other convention is a copy per row, repeating the grape id:

```
grape01	peach01	cacao01
grape02	peach02a	cacao02
grape02	peach02b	cacao02
grape03	.	.
```

The grape-peach band draws a ribbon from `grape02` to each copy, and the
repeated `cacao02` draws its ribbon twice. `orthogroups_to_blocks.py` writes
this shape by default; the MCScanX converter keeps the best-scoring copy.

## Producing the data

`grape.blocks` and the BEDs come from [jcvi](https://github.com/tanghaibao/jcvi)
and the [LAST](https://gitlab.com/mcfrith/last) aligner over the seven
accessions. One accession supplies the genome, the annotation and (through
`gffread`) the CDS, so the assembly and annotation are one build:

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

Both sides key on the mRNA's GFF3 `ID`: gffread names each CDS after it, and
`--key=ID` writes it into BED column 4. For a key it cannot resolve jcvi
generates `mrna_494685`, which joins to nothing, and that is what
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

Each per-pair table is grape then the mate, so the join emits the grape column
twice and `cut -f1,2,4` keeps it once, followed by one mate per lane, the order
`blockAssemblies` and `bedLocations` list.

Each assembly also gets a `refNameAliases` file from the download's sequence
report, since NCBI names sequences by accession. The adapter reads `.blocks` and
BED files plain or gzipped.

## Bringing your own ortholog table

`MCScanBlocksAdapter` needs two inputs, neither of them MCScan-specific:

- a tab-delimited table, one row per orthogroup and one column per genome, each
  cell holding a single gene id (`.` or an empty cell for no ortholog)
- one BED per column whose fourth field carries those same gene ids

Two columns is a valid table, so a reciprocal-best-hit list already works as a
pairwise synteny track.

### From MCScanX

[`mcscanx_to_anchors.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/mcscanx_to_anchors.py)
pivots a `.collinearity` file into a table, given the two-letter chromosome tag
MCScanX uses for each genome:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/mcscanx_to_anchors.py
python3 mcscanx_to_anchors.py --gff xyz.gff --collinearity xyz.collinearity \
  --species vv=grape --species pp=peach --species tc=cacao
```

That writes `grape.blocks` and a BED per genome. The first `--species` is column
0, so a block between two non-reference genomes has nowhere to go and that pair
is reached transitively. Where one reference gene has blocks against several
genes, the best-scoring takes the cell.

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

Each named column becomes a feature attribute and an entry in the palette
button's menu. RefName and strand handling is in the
[pairwise MCScan tutorial](/docs/tutorials/mcscan_synteny_grape_peach#coming-from-mcscanx);
given two `--species` the script writes that page's `.anchors` files, which
draws a pair the table left out as a second track.

### From OrthoFinder

`Orthogroups.tsv` is one row per orthogroup and one column per genome, with a
header row, a leading id column and comma-separated gene lists per cell:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/orthogroups_to_blocks.py
python3 orthogroups_to_blocks.py Orthogroups.tsv -o grape.blocks \
  --bed grape=grape.bed --bed peach=peach.bed
```

The script prints the column order `blockAssemblies` needs. By default a
duplicated gene becomes one row per copy.
[](/docs/tutorials/orthofinder_synteny) builds a six-genome view this way.

### From Ensembl Compara

Compara publishes one homology TSV per species, so the table is a download:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/compara_to_blocks.py
python3 compara_to_blocks.py Compara.116.protein_default.homologies.tsv.gz \
  --reference sorghum_bicolor=sorghum --species triticum_aestivum=wheat \
  --bed sorghum=sorghum.bed --bed wheat=wheat.bed
```

`attributeColumns` can name `identity`, `homology_identity` and `goc_score` the
way the scored table above names `score`. A partner species the export lacks
writes no table and says nothing, so check each `--species` name against the
file's `homology_species` column. [](/docs/tutorials/homoeolog_synteny) uses
this route for one panel.

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

The reference column is whichever genome you joined on, so
[direct vs transitive](#direct-vs-transitive-pairs) applies to any table built
this way.

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
not, hence the `sub`.

Column 1 must use the JBrowse assembly's sequence names. Column 4 must match the
table's gene ids; the
[adapter's gotchas](/docs/config_guides/synteny_track#gene-ids-are-the-join-in-the-mcscan-adapters)
cover how ids get mangled, and jcvi dropping isoform suffixes is why
`--no_strip_names` is passed. Column 6 is strand, and a ribbon draws inverted
when the two ends disagree.

## Setting up the three assemblies

Grape, peach and cacao each become an assembly (`jbrowse add-assembly`, in the
[script](#reproduce-it-end-to-end)) whose name matches the track's
`assemblyNames` and whose sequence names match its `.bed`. See the
[assemblies configuration guide](/docs/config_guides/assemblies) for the JSON.

## Loading the blocks file with MCScanBlocksAdapter {#loading-it-in-jbrowse-with-mcscanblocksadapter}

One track backs every band of the stack. `assemblyNames` lists the genomes,
`blockAssemblies` names every column in order, and `bedLocations` gives the
matching BED per column:

```json addtrack
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

## Stacking the three genomes

**Add → Linear synteny view** and pick `grape_peach_cacao_blocks`; each of its
three assemblies becomes a row. The
[all-vs-all tutorial](/docs/tutorials/allvsall_synteny#from-the-ui) walks the
dialog. The declarative equivalent, stacking peach-cacao-grape:

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

`tracks` is one entry per band. `autoDiagonalize` reorders and flips each row's
chromosomes on load so the ribbons run along the diagonal, and
`colorBy: "reference"` anchors every band on the middle row.

<Figure caption="Three genomes stacked peach-cacao-grape, with one MCScan .blocks file backing both synteny bands. autoDiagonalize has reordered and flipped each row's chromosomes so the ribbons run along the diagonal, and Color by → Reference anchors both bands on the shared middle row." src="/img/multiway_synteny/grape_peach_cacao.png" />

## Direct vs transitive pairs

The table is anchored on grape, so only pairs including grape are direct. A
peach-cacao link had to pass through a shared grape gene, and any ortholog grape
lost is absent. Put the reference in the middle (peach-grape-cacao) and every
band is direct; the demo above stacks grape at the bottom.

The [script](#reproduce-it-end-to-end) counts, per column pair, the rows where
both cells resolve. Every row has a grape gene, so a grape pair draws every row
its mate fills, and peach-cacao falls short by whatever grape lost.

## Zooming to a conserved block

Zoom to one block with grape in the middle, and turn on each genome's gene track
with **Show only genes**.

<Figure caption="Gene-level view of the same block: ten consecutive orthologs run in the same order across grape, peach, and cacao, so each synteny ribbon links one gene to its ortholog in the row above and below." src="/img/multiway_synteny/grape_peach_cacao_gene_orthologs.png" />

## One locus against all seven genomes

`grape.blocks` carries seven columns, and a plain linear genome view on grape
draws every mate at once:

- Navigate to `11:778,000-866,000` and turn on the grape gene track.
- Turn on **Grape vs peach, cacao, arabidopsis, poplar, tomato, citrus (MCScan
  blocks)**, which renders as an `LGVSyntenyDisplay`: every mate in one pileup.
- Pick **Group by... → Mate assembly** for a lane per genome.

<Figure caption="One grape locus against six other plants, the same MCScan blocks track grouped by mate assembly. Each lane is one genome, so the lanes read as presence and absence down a column: peach, cacao, poplar and citrus keep most of the block, arabidopsis a scattered few, and tomato, the one asterid, a single gene." src="/img/multiway_synteny/blocks_one_vs_all.png" />

## Each genome in its own coordinates

On grape's axis a lane reads as presence and absence and cannot say where in
peach those genes sit. **Display types → Multi-way synteny display** redraws the
lanes in each genome's own coordinates:

- each lane is fitted to its own genome over the orthologs the window brings in
- one grey ribbon per ortholog group joins adjacent lanes, bridging past a lane
  that places nothing
- any track whose features carry a `mate` per assembly feeds the same lanes,
  including an [OrthoFinder table](/docs/tutorials/orthofinder_synteny) or an
  [all-vs-all PAF](/docs/tutorials/allvsall_synteny)

The same thing as a `defaultSession`:

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
  against grape's
- **Right**: the lane's span, and its multiple of grape's span where that is not
  one. Spans snap to a short ladder of multiples, so a pan rarely moves a lane's
  content
- **Ticks** fall at one interval shared by every mate lane. A lane zoomed too
  far out for ticks draws none
- **The view's gridlines stop at the grape lane**, the only lane they are true
  for
- **A lane with no GFF3 track** outlines the table's gene spans and says
  `no annotation`, which is the four `BLOCKS_ONLY_SPECIES` lanes here

### Ordering the lanes

- `rowOrder` pins the lanes it names to the top; the rest follow densest-first
  over the whole fetched table, so the order holds across a pan
- with **Bridge lanes that place nothing** off, a sparse lane mid-stack cuts
  every chain running through it, which densest-first guards against

### Zooming to genes

Cut the window to a few genes and each ribbon connects one gene to one ortholog.
A copy-number difference fans one gene into several, and a lone ortholog draws
at gene size, centered in its lane. Hovering a ribbon highlights its ortholog
group down every lane; clicking a glyph opens the detail panel.

<Figure caption="The same lanes cut to a few genes, close enough to read exon structure in the annotated lanes. Each ribbon links one gene to its ortholog in the lane below, and the lanes that kept a single gene here show it at the anchor's scale." src="/img/multiway_synteny/lgv_track_zoom.png" />

<Video src="/media/synteny/multiway_zoom_out.mp4" caption="The grape lanes from gene scale back out to the block: a hovered ribbon reads one ortholog group down the stack, and each zoom-out re-fits every lane's own frame to the anchor's widening window." />

## Restacking around a locus

Two routes reach the stacked view from the lanes:

- **From the lane track**, **Launch → Linear synteny view (visible region)** in
  its track menu offers a row to every genome aligning in the window
- **From the scale bar**, drag-select a locus and pick **Launch → Linear synteny
  view**. The dialog opens a row per genome with arrows to order them; moving
  grape between peach and cacao is the reference-in-the-middle layout from
  [Direct vs transitive pairs](#direct-vs-transitive-pairs)
- **From a lane's header**, right-click the lane's name: **Re-anchor on peach**
  turns the whole track around on that genome, and **Open peach at the matching
  region** opens it on its own with its gene track

<Figure caption="A lane header's menu: reorder or hide the lane, open peach on its own at the span the lane is drawing, or re-anchor the whole track on it." src="/img/multiway_synteny/lane_header_menu.png" />

<Video src="/media/synteny/restack_around_locus.mp4" caption="Restacking around one grape locus, from the lane reading above: a scale-bar selection raises Launch, the dialog lists a panel per genome and names the mates it can draw a lane for but not a panel, and one arrow moves the reference into the middle of the launched stack." />

## Reproduce it end to end

[`build_grape_peach_cacao_synteny.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_grape_peach_cacao_synteny.sh)
runs everything above and writes a `config.json` with the assemblies, gene
tracks, the synteny track and the stacked default session. Its
`BLOCKS_ONLY_SPECIES` list is where the extra lanes come from; a genome added
there needs only CDS and GFF3.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_grape_peach_cacao_synteny.sh
bash build_grape_peach_cacao_synteny.sh
npx --yes serve grape_peach_cacao_build/jbrowse2  # then open the printed URL
```

It needs the tools under [Prerequisites](#prerequisites).

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
