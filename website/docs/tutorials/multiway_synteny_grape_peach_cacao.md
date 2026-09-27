---
title: Synteny from an ortholog table (grape, peach, cacao)
sidebar_label: Synteny (ortholog tables)
description: Stack N genomes from a jcvi MCScan .blocks file
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
tutorial_subcategory: Ortholog tables
---

jcvi's MCScan lines up orthologous genes across more than two genomes at once,
into one wide table with a column per species. We load that table directly,
stack grape, peach and cacao as rows of a single synteny view, and then read one
grape locus across all seven plant genomes. With that view we:

- stack three genomes from one MCScan `.blocks` file and zoom to a conserved
  block
- read one grape locus against all seven genomes at once, one lane per genome
- redraw the lanes in each genome's own coordinates

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
- grape's, peach's and cacao's hub configs on genomes.jbrowse.org:
  https://jbrowse.org/hubs/genark/GCF/030/704/535/GCF_030704535.1/config.json
  for grape, and peach and cacao at the same path under their own accessions
- the finished `.blocks` table, BEDs and config, rehosted:
  https://jbrowse.org/demos/grape_peach_cacao/config.json

## What a `.blocks` file is

A `.blocks` file is a tab-delimited table. Each row is an orthologous group and
each column a genome, with `.` where a genome has no member. The file names none
of its columns, so `blockAssemblies` does, by position:

```text
grape01	peach01	cacao01
grape02	peach02	cacao02
grape03	.	.
```

A real cell holds the annotation's own gene id (`rna-XM_007225519.2` for NCBI);
the table carries no coordinates, so one `.bed` per genome places each id.

### One reference, or all against all

A table is **reference-anchored** when every row starts from one genome's gene,
and **all against all** when a row is an orthogroup inferred across all genomes
at once; the adapter loads either shape. jcvi's MCScan tables are anchored on
column 0. [Direct vs transitive pairs](#direct-vs-transitive-pairs) measures
what that costs.

### A duplicated gene

A cell holds one gene id; two conventions place a second copy.

`mcscan` writes a column per chain of synteny blocks, so a grape gene syntenic
to two peach regions fills a second peach column (`--iter` caps the chains). At
`--iter=2`:

```text
grape01	peach01	peach01b
grape02	peach02	.
grape03	.	.
```

Name that column `peach` in `blockAssemblies` with `peach.bed` beside it, and
both are drawn; the track's own `assemblyNames` still names peach once.

The other convention repeats the grape id, one row per copy:

```text
grape01	peach01	cacao01
grape02	peach02a	cacao02
grape02	peach02b	cacao02
grape03	.	.
```

`orthogroups_to_blocks.py` writes this shape by default; the MCScanX converter
keeps the best-scoring copy.

## Producing the data

`grape.blocks` and the BEDs come from [jcvi](https://github.com/tanghaibao/jcvi)
and the [LAST](https://gitlab.com/mcfrith/last) aligner over the seven
accessions, each providing one genome, annotation and CDS:

<!-- from: scripts/build_grape_peach_cacao_synteny.sh -->

```bash
for sp in grape peach cacao; do
  gffread "$sp.gff3" -g "$sp.fa" -x "$sp.cds.fa"
  # --key=ID joins the two files; --primary_only keeps one transcript per gene
  python -m jcvi.formats.gff bed --type=mRNA --key=ID --primary_only \
    "$sp.gff3" -o "$sp.bed"
  python -m jcvi.formats.fasta format "$sp.cds.fa" "$sp.cds"
done
```

`--key=ID` writes the mRNA's GFF3 id into BED column 4, matching the CDS name
gffread wrote. An unresolved key becomes `mrna_494685`, unjoinable;
`--key=transcript_id` and `--key=Name` give that same id on an NCBI annotation.

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

Each per-pair table lists grape then the mate, so the join emits the grape
column twice; `cut -f1,2,4` keeps it once, in the order `blockAssemblies` and
`bedLocations` list.

The adapter reads `.blocks` and BED files plain or gzipped.

## Bringing your own ortholog table

`MCScanBlocksAdapter` needs two inputs, neither of them MCScan-specific:

- a tab-delimited table, one row per orthogroup and one column per genome, each
  cell holding a single gene id (`.` or an empty cell for no ortholog)
- one BED per column whose fourth field carries those same gene ids

### From MCScanX

[`mcscanx_to_anchors.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/mcscanx_to_anchors.py)
pivots a `.collinearity` file into a table, given the two-letter chromosome tag
MCScanX uses for each genome:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/mcscanx_to_anchors.py
python3 mcscanx_to_anchors.py --gff xyz.gff --collinearity xyz.collinearity \
  --species vv=grape --species pp=peach --species tc=cacao
```

`mcscanx_to_anchors.py` writes `grape.blocks` and a BED per genome, anchored on
the first `--species`; ties resolve to the best-scoring block.

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
    "bedLocations": ["grape.bed", "peach.bed", "cacao.bed"],
    "attributeColumns": ["score"]
  }
}
```

Each named column becomes a feature attribute and an entry in the palette
button's menu.

### From OrthoFinder

`Orthogroups.tsv` is one row per orthogroup and one column per genome, with a
header row, a leading id column and comma-separated gene lists per cell:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/orthogroups_to_blocks.py
python3 orthogroups_to_blocks.py Orthogroups.tsv -o grape.blocks \
  --bed grape=grape.bed --bed peach=peach.bed
```

The script prints the column order `blockAssemblies` needs.

### From Ensembl Compara

Compara publishes one homology TSV per species, so the table is a download:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/compara_to_blocks.py
python3 compara_to_blocks.py Compara.116.protein_default.homologies.tsv.gz \
  --reference sorghum_bicolor=sorghum --species triticum_aestivum=wheat \
  --bed sorghum=sorghum.bed --bed wheat=wheat.bed
```

`attributeColumns` can name `identity`, `homology_identity` and `goc_score` the
way the scored table above names `score`.

### From reciprocal best BLAST hits

Reduce each direction of an all-vs-all `blastp` or DIAMOND run (`-outfmt 6`) to
its best hit per query, then keep the pairs that agree both ways:

```bash
# sort by bitscore (column 12) descending, keep the first hit per query
sort -k1,1 -k12,12gr grape_vs_peach.tsv | awk '!seen[$1]++ {print $1 "\t" $2}' > g2p
sort -k1,1 -k12,12gr peach_vs_grape.tsv | awk '!seen[$1]++ {print $1 "\t" $2}' > p2g
# keep a pair only where each side's best hit is the other
awk 'NR == FNR {best[$1] = $2; next} best[$2] == $1' p2g g2p > grape_peach.rbh
```

`grape_peach.rbh` is a two-column table, loadable as-is with
`blockAssemblies: ["grape", "peach"]`. For more genomes, run the same reduction
against one reference genome and outer-join the results on the reference gene:

```bash
export LC_ALL=C  # join and sort must agree on collation
# -a1 -a2 keep a one-sided grape gene, -e . fills the gap; -o lists the join
# field then each file's column 2: grape gene, peach ortholog, cacao ortholog
join -t $'\t' -a1 -a2 -e . -o 0,1.2,2.2 \
  <(sort -k1,1 grape_peach.rbh) <(sort -k1,1 grape_cacao.rbh) > grape.blocks
```

### BED files

Only the first six BED fields are read. From a GFF3:

```bash
# column 3 is the feature type; only gene rows become BED features
awk -F'\t' -v OFS='\t' '$3 == "gene" && match($9, /ID=[^;]+/) {
  id = substr($9, RSTART + 3, RLENGTH - 3)  # strip the leading "ID="
  sub(/^gene:/, "", id)
  # BED start is 0-based, so the GFF3's 1-based start shifts down by one
  print $1, $4 - 1, $5, id, 0, $7
}' grape.gff3 > grape.bed
```

Ensembl namespaces its GFF3 ids (`ID=gene:VIT_00000001`); the `sub` strips that.

Column 1 must use the JBrowse assembly's sequence names, and column 4 must match
the table's gene ids
([adapter gotchas](/docs/config_guides/synteny_track#gene-ids-are-the-join-in-the-mcscan-adapters)
cover how ids get mangled). Column 6 is strand.

## Setting up the three assemblies

Grape, peach and cacao are each a genome hub on
[genomes.jbrowse.org](https://genomes.jbrowse.org) under the RefSeq accession
the table was built from. Each row takes its assembly entry and gene track from
there:

```bash
# a GenArk hub's path is its accession cut into threes
curl -fO https://jbrowse.org/hubs/genark/GCF/000/346/465/GCF_000346465.2/config.json
```

The build keeps each hub entry, labels the row, and adds the short name as an
alias, so a session can still say `peach`:

```json
{
  "name": "GCF_000346465.2",
  "displayName": "peach",
  "aliases": ["peach"],
  "sequence": {
    "type": "ReferenceSequenceTrack",
    "trackId": "GCF_000346465.2-ReferenceSequenceTrack",
    "adapter": {
      "type": "TwoBitAdapter",
      "uri": "https://hgdownload.soe.ucsc.edu/hubs/GCF/000/346/465/GCF_000346465.2/GCF_000346465.2.2bit",
      "chromSizes": "https://hgdownload.soe.ucsc.edu/hubs/GCF/000/346/465/GCF_000346465.2/GCF_000346465.2.chrom.sizes.txt"
    }
  },
  "refNameAliases": {
    "adapter": {
      "type": "RefNameAliasAdapter",
      "refNameColumnHeaderName": "ucsc",
      "uri": "https://hgdownload.soe.ucsc.edu/hubs/GCF/000/346/465/GCF_000346465.2/GCF_000346465.2.chromAlias.txt"
    }
  }
}
```

`refNameColumnHeaderName` makes the UCSC names canonical, naming peach's first
chromosome `chrG1` where the BED says `NC_034009.1`.

## Loading the blocks file with MCScanBlocksAdapter {#loading-it-in-jbrowse-with-mcscanblocksadapter}

One track backs every band of the stack. `blockAssemblies` names every column in
order, and `bedLocations` gives the matching BED per column; the adapter needs
no `assemblyNames` unless you mean to narrow it to fewer genomes:

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "grape_peach_cacao_blocks",
  "name": "Grape / peach / cacao (MCScan blocks)",
  "assemblyNames": ["GCF_030704535.1", "GCF_000346465.2", "GCF_000208745.1"],
  "adapter": {
    "type": "MCScanBlocksAdapter",
    "uri": "grape.blocks.gz",
    "blockAssemblies": [
      "GCF_030704535.1",
      "GCF_000346465.2",
      "GCF_000208745.1"
    ],
    "bedLocations": ["grape.bed.gz", "peach.bed.gz", "cacao.bed.gz"]
  }
}
```

## Stacking the three genomes

**Add → Linear synteny view** and pick `grape_peach_cacao_blocks`; the
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
          { "assembly": "GCF_000346465.2" },
          { "assembly": "GCF_000208745.1" },
          { "assembly": "GCF_030704535.1" }
        ],
        "tracks": [["grape_peach_cacao_blocks"], ["grape_peach_cacao_blocks"]],
        "color": { "field": "reference" },
        "autoDiagonalize": true
      }
    ]
  }
}
```

`tracks` is one entry per band.

<Figure caption="Three genomes stacked peach-cacao-grape, with one MCScan .blocks file backing both synteny bands. autoDiagonalize has reordered and flipped each row's chromosomes so the ribbons run along the diagonal, and Color by → Reference anchors both bands on the shared middle row." src="/img/multiway_synteny/grape_peach_cacao.png" />

## Direct vs transitive pairs

Only pairs including grape are direct: a peach-cacao link passes through a
shared grape gene. Put the reference in the middle (peach-grape-cacao) for every
band to be direct; the demo above stacks grape at the bottom instead.

The [script](#reproduce-it-end-to-end) counts, per column pair, the rows where
both cells resolve: a grape pair draws every row its mate fills, and peach-cacao
falls short by whatever grape lost.

## Zooming to a conserved block

Zoom to one block with grape in the middle, and turn on each genome's gene track
with **Show only genes**.

<Figure caption="Gene-level view of the same block, peach over grape over cacao with each genome's gene track on. The orthologs step across all three in the same order until the ribbons fan, where three grape copies meet one peach and one cacao ortholog." src="/img/multiway_synteny/grape_peach_cacao_gene_orthologs.png" />

## One locus against all seven genomes

`grape.blocks` carries seven columns, and a plain linear genome view on grape
draws every mate at once:

- Navigate to `chr11:778,000-866,000` and turn on grape's **NCBI RefSeq - RefSeq
  All** track.
- Turn on **Grape vs peach, cacao, arabidopsis, poplar, tomato, citrus (MCScan
  blocks)**, an `LGVSyntenyDisplay` drawing every mate in one pileup.
- Pick **Group by... → Mate assembly** for a lane per genome.

<Figure caption="One grape locus against six other plants, the same MCScan blocks track grouped by mate assembly. Each lane is one genome, so the lanes read as presence and absence down a column: peach, cacao, poplar and citrus keep most of the block, while arabidopsis and tomato, the one asterid, keep a scattered few." src="/img/multiway_synteny/blocks_one_vs_all.png" />

## Each genome in its own coordinates

On grape's axis, every gene sits at grape's coordinate. **Display types →
Multi-way synteny display** redraws the lanes in each genome's own coordinates:

- each lane is fitted to the genome it shows, over the orthologs the window
  brings in
- one grey ribbon per ortholog group joins adjacent lanes, bridging past an
  empty one
- any track whose features carry a `mate` per assembly feeds the same lanes,
  including an [OrthoFinder table](/docs/tutorials/orthofinder_synteny) or an
  [all-vs-all PAF](/docs/tutorials/allvsall_synteny)

The lanes above, as a `defaultSession`:

```json session config=https://jbrowse.org/demos/grape_peach_cacao/config.json
{
  "defaultSession": {
    "name": "Grape multi-way synteny track",
    "views": [
      {
        "type": "LinearGenomeView",
        "assembly": "GCF_030704535.1",
        "loc": "chr11:778,000-866,000",
        "tracks": [
          {
            "trackId": "GCF_030704535.1-ncbiRefSeq",
            "type": "LinearBasicDisplay",
            "showOnlyGenes": true,
            "displayMode": "compact"
          },
          {
            "trackId": "grape_peach_cacao_blocks",
            "type": "MultiWaySyntenyDisplay",
            "domain": [
              "GCF_000346465.2",
              "GCF_000208745.1",
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

<Figure caption="The grape gene track over the same locus as a multi-way lane stack, one lane per genome from a single MCScan blocks track. The peach and cacao lanes draw the gene models from those genomes' gene tracks, the lanes without one draw the table's gene spans as boxes, and a chain bridges past a lane that places nothing to end at the last lane that does." src="/img/multiway_synteny/lgv_track_lanes.png" />

### What a lane header shows

Each lane has a separate scale, shown in its header:

- **Left**: where the lane starts, with `[rev]` where its gene order runs
  against grape's
- **Right**: the lane's span and its multiple of grape's span
- **Ticks** fall at one interval shared by every mate lane
- **The view's gridlines stop at the grape lane**, the only lane they fit
- **A lane with no readable gene track** (GFF3, GTF, BigBed or BED) outlines the
  table's gene spans, labeled `no annotation`

### Ordering the lanes

- `domain` pins the lanes it names to the top; the rest follow densest-first, so
  the order holds across a pan
- With **Show... → Show ribbons across gaps** off, a sparse lane mid-stack cuts
  every chain running through it

### Zooming to genes

Cut the window to a few genes so each ribbon connects one gene to its ortholog,
fanning where a copy-number difference exists. Hover a ribbon to highlight its
ortholog group down every lane, click one to open the pair's details, and click
empty canvas to clear the outline.

<Figure caption="The same lanes cut to a few genes, with one ribbon clicked. Each ribbon links one gene to its ortholog in the lane below; the clicked group carries an outline down the lanes that chain it, and the details panel opens on the pair the click landed on." src="/img/multiway_synteny/lgv_track_clicked.png" />

<Video src="/media/synteny/multiway_zoom_out.mp4" caption="The grape lanes from gene scale back out to the block: a hovered ribbon reads one ortholog group down the stack, and each zoom-out re-fits every lane's frame to the anchor's widening window." />

## Restacking around a locus

Two routes reach the stacked view from the lanes:

- **From the lane track**, **Launch → Linear synteny view (visible region)** in
  its track menu offers a row to every aligning genome
- **From the scale bar**, drag-select a locus and pick **Launch → Linear synteny
  view**. The dialog opens a row per genome with arrows to order them; moving
  grape between peach and cacao gives the
  [reference-in-the-middle](#direct-vs-transitive-pairs) layout
- **From a lane's header**, click the ⋮ or right-click its name. **Re-anchor on
  peach** turns the track around on that genome, and **Open peach at the
  matching region** opens it on its own with its gene track

<Figure caption="A lane header's menu: reorder or hide the lane, open peach on its own at the span the lane is drawing, or re-anchor the whole track on it." src="/img/multiway_synteny/lane_header_menu.png" />

<Video src="/media/synteny/restack_around_locus.mp4" caption="Restacking around one grape locus, from the lane reading above: a scale-bar selection raises Launch, the dialog lists a panel per genome and names the mates it can draw a lane for but not a panel, and one arrow moves the reference into the middle of the launched stack." />

## Reproduce it end to end

[`build_grape_peach_cacao_synteny.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_grape_peach_cacao_synteny.sh)
runs everything above and writes a `config.json` with the hub assemblies, gene
tracks, synteny track and default session. `BLOCKS_ONLY_SPECIES` lists the extra
lanes; a genome added there needs only CDS and GFF3.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_grape_peach_cacao_synteny.sh
bash build_grape_peach_cacao_synteny.sh
npx --yes serve grape_peach_cacao_build  # then open config.json at the printed URL
```

The script needs the tools under [Prerequisites](#prerequisites).

## See also

- [](/docs/tutorials/allvsall_synteny)
- [](/docs/tutorials/orthofinder_synteny)
- [](/docs/tutorials/homoeolog_synteny)
- [](/docs/tutorials/synteny_visualization)
- [](/docs/tutorials/genomes_synteny)
- [](/docs/user_guides/linear_synteny_view)
- [](/docs/config_guides/synteny_track)
- [](/docs/config_guides/grouping_and_ordering)
- [](/docs/config/mcscanblocksadapter)
- [](/docs/config/multiwaysyntenydisplay)
