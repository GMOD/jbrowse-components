---
title: Synteny from an ortholog table (grape, peach, cacao)
sidebar_label: Synteny (ortholog tables)
description: Stack N genomes from a jcvi MCScan .blocks file
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
tutorial_subcategory: Ortholog tables
---

MCScan, from the jcvi toolkit, lines up orthologous genes across more than two
genomes at once, into one wide table with a column per species. We load that
table directly, stack grape, peach and cacao as rows of a single synteny view,
and then read one grape locus across all seven plant genomes. With that view we:

- stack three genomes from one MCScan `.blocks` file and zoom to a conserved
  block
- read one grape locus against all seven genomes at once, one lane per genome
- redraw each lane in the coordinates of the genome it shows

## Prerequisites

- a JBrowse to open them in: [Desktop](/docs/quickstart_desktop) takes a local
  file by path, [Web](/docs/quickstart_web) through **Add track**
- [jcvi](https://github.com/tanghaibao/jcvi) with the
  [LAST](https://gitlab.com/mcfrith/last) aligner
- Or any other ortholog table, converted as in
  [building a table for MCScanBlocksAdapter](/docs/config_guides/synteny_track#building-a-table-for-mcscanblocksadapter)
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
- the grape, peach and cacao hub configs on genomes.jbrowse.org:
  https://jbrowse.org/hubs/genark/GCF/030/704/535/GCF_030704535.1/config.json
  for grape, and peach and cacao at the same path under their accessions
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

A real cell holds the gene id from the annotation (`rna-XM_007225519.2` for
NCBI); the table carries no coordinates, so one `.bed` per genome places each
id.

### One reference, or all against all

A table is **reference-anchored** when every row starts from a gene in one
genome, and **all against all** when a row is an orthogroup inferred across all
genomes at once; the adapter loads either shape. jcvi MCScan anchors its tables
on column 0. [Direct vs transitive pairs](#direct-vs-transitive-pairs) measures
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
the track draws both; `assemblyNames` on the track still names peach once.

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

`--key=ID` writes the GFF3 id of each mRNA into BED column 4, matching the CDS
name gffread wrote. An unresolved key becomes an id like `mrna_494685` that
joins nothing; `--key=transcript_id` and `--key=Name` give that same id on an
NCBI annotation.

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

The adapter reads `.blocks` and BED files plain or gzipped. A table from another
tool loads the same way, and
[building a table for MCScanBlocksAdapter](/docs/config_guides/synteny_track#building-a-table-for-mcscanblocksadapter)
converts MCScanX, OrthoFinder, Ensembl Compara and reciprocal-best-hit output.

## Setting up the three assemblies

Grape, peach and cacao are each a genome hub on
[genomes.jbrowse.org](https://genomes.jbrowse.org) under the RefSeq accession
the table was built from. Each row takes its assembly entry and gene track from
there:

```bash
# a GenArk hub path is the accession cut into threes
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

`refNameColumnHeaderName` makes the UCSC names canonical, naming the first peach
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

`tracks` is one entry per band. `autoDiagonalize` reorders and flips the
chromosomes in each row so the ribbons run along the diagonal, and
`color: { "field": "reference" }` anchors every band on the middle row.

<Figure caption="Three genomes stacked peach-cacao-grape, with one MCScan .blocks file backing both synteny bands. autoDiagonalize has reordered and flipped the chromosomes in each row so the ribbons run along the diagonal, and Color by → Reference anchors both bands on the shared middle row." src="/img/multiway_synteny/grape_peach_cacao.png" />

## Direct vs transitive pairs

Pairs that include grape are direct, and a peach-cacao link passes through a
shared grape gene. Put the reference in the middle (peach-grape-cacao) for every
band to be direct; the demo above stacks grape at the bottom.

The [script](#reproduce-it-end-to-end) counts, per column pair, the rows where
both cells resolve: a grape pair draws every row its mate fills, and peach-cacao
falls short by whatever grape lost.

## Zooming to a conserved block

Zoom to one block with grape in the middle, and turn on the gene track for each
genome with **Show only genes**.

<Figure caption="Gene-level view of the same block, peach over grape over cacao with the gene track for each genome on. The orthologs step across all three in the same order until the ribbons fan, where three grape copies meet one peach and one cacao ortholog." src="/img/multiway_synteny/grape_peach_cacao_gene_orthologs.png" />

## One locus against all seven genomes

`grape.blocks` carries seven columns, and a track that names all seven in
`blockAssemblies` and `bedLocations`, as the one above names three, draws every
mate at once in a plain linear genome view on grape:

- Navigate to `chr11:778,000-866,000` and turn on grape's **NCBI RefSeq - RefSeq
  All** track.
- Turn on **Grape vs peach, cacao, arabidopsis, poplar, tomato, citrus (MCScan
  blocks)**, an `LGVSyntenyDisplay` drawing every mate in one pileup.
- Pick **Group by... → Mate assembly** for a lane per genome.

<Figure caption="One grape locus against six other plants, the same MCScan blocks track grouped by mate assembly. Each lane is one genome, so the lanes read as presence and absence down a column: peach, cacao, poplar and citrus keep most of the block, while arabidopsis and tomato, the one asterid, keep a scattered few." src="/img/multiway_synteny/blocks_one_vs_all.png" />

## Lanes in per-genome coordinates {#each-genome-in-its-own-coordinates}

On the grape axis, every gene sits at its grape coordinate. **Display types →
Multi-way synteny display** redraws the lanes, each in the coordinates of one
genome:

- the display fits each lane to the genome it shows, over the orthologs the
  window brings in
- one grey ribbon per ortholog group joins adjacent lanes, bridging past an
  empty one
- any track whose features carry a `mate` per assembly feeds the same lanes,
  including an [OrthoFinder table](/docs/tutorials/orthofinder_synteny) or an
  [all-vs-all PAF](/docs/tutorials/allvsall_synteny)

A lane draws gene models from a gene track under its own assembly name, and
outlines the gene spans from the table where it has none. We'll add one for
grape; the other genomes take the same track under their accessions. Swap the
`uri` for your own GFF3, bgzipped and tabix-indexed
([prep](/docs/quickstart_web)), with the same refNames as the assembly:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "grape_genes",
  "name": "grape genes",
  "assemblyNames": ["GCF_030704535.1"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "uri": "grape.sorted.gff3.gz"
  }
}
```

The lanes above, as a `defaultSession` (the track ids come from the hosted
config, so name your own `trackId` instead):

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

<Figure caption="The grape gene track over the same locus as a multi-way lane stack, one lane per genome from a single MCScan blocks track. The peach and cacao lanes draw the gene models from the gene tracks for those genomes, the lanes without one draw the gene spans from the table as boxes, and a chain bridges past a lane that places nothing to end at the last lane that does." src="/img/multiway_synteny/lgv_track_lanes.png" />

### What a lane header shows

Each lane has a separate scale, shown in its header:

- the left end shows where the lane starts, with `[rev]` where its gene order
  runs against grape's
- the right end shows how much sequence the lane spans, and that span as a
  multiple of the grape span
- the ticks fall at one interval shared by every mate lane

The view gridlines stop at the grape lane, the one lane they fit. A lane with no
readable gene track (GFF3, GTF, BigBed or BED) outlines the gene spans from the
table, labeled `no annotation`.

### Ordering the lanes

- `domain` pins the lanes it names to the top; the rest follow densest-first, so
  the order holds across a pan
- With **Show... → Show ribbons across gaps** off, a sparse lane mid-stack cuts
  every chain running through it

### Zooming to genes

Cut the window to a few genes so each ribbon connects one gene to its ortholog,
fanning where a copy-number difference exists. Hover a ribbon to highlight its
ortholog group down every lane, click one to open the details for that pair, and
click empty canvas to clear the outline.

<Figure caption="The same lanes cut to a few genes, with one ribbon clicked. Each ribbon links one gene to its ortholog in the lane below; the clicked group carries an outline down the lanes that chain it, and the details panel opens on the pair the click landed on." src="/img/multiway_synteny/lgv_track_clicked.png" />

## Restacking around a locus

Two routes reach the stacked view from the lanes:

- from the lane track, **Launch → Linear synteny view (visible region)** in its
  track menu offers a row to every aligning genome
- from the scale bar, drag-select a locus and pick **Launch → Linear synteny
  view**. The dialog opens a row per genome, grape already seated between peach
  and cacao for the [reference-in-the-middle](#direct-vs-transitive-pairs)
  layout, with arrows to reorder them

The ⋮ on a lane header, or a right-click on its name, opens the lane menu.
**Re-anchor on peach** turns the track around on that genome, and **Open peach
at the matching region** opens peach in a linear genome view, with its gene
track.

<Figure caption="The lane header menu: reorder or hide the lane, open peach in a linear view at the span the lane is drawing, or re-anchor the whole track on it." src="/img/multiway_synteny/lane_header_menu.png" />

<Video src="/media/synteny/restack_around_locus.mp4" caption="Restacking around one grape locus, from the lane reading above: a scale-bar selection raises Launch, and the dialog lists a panel per genome with the reference between its two mates, naming the mates it can draw a lane for but not a panel." />

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
