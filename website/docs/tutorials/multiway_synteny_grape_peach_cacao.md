---
title: Synteny from an ortholog table (grape, peach, cacao)
sidebar_label: Synteny (MCScan blocks)
description: Stack N genomes from a jcvi MCScan .blocks file
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
tutorial_subcategory: Ortholog tables
---

MCScan, from the jcvi toolkit, lines up orthologous genes across more than two
genomes at once, into one wide table with a column per species. We:

- load the `.blocks` file as a synteny track and stack grape, peach and cacao as
  rows of one synteny view, telling direct gene pairs from transitive ones
- zoom the stack to a block conserved in every genome
- open one grape locus against all the genomes as a multi-way track, one lane
  per genome
- redraw each lane in the coordinates of its genome, and restack the genomes
  around a locus

## Prerequisites

- A running JBrowse instance (the [web quickstart](/docs/quickstart_web) or the
  [desktop quickstart](/docs/quickstart_desktop))
- [jcvi](https://github.com/tanghaibao/jcvi) with the
  [LAST](https://gitlab.com/mcfrith/last) aligner
- Or any other ortholog table, converted as in
  [building a table for MCScanBlocksAdapter](/docs/config_guides/synteny_track#building-a-table-for-mcscanblocksadapter)
- the NCBI
  [`datasets`](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/download-and-install/)
  CLI
- [gffread](https://github.com/gpertea/gffread)
- `samtools`

<!-- BEGIN GENERATED TUTORIAL_INSTALL samtools,gffread,jcvi,datasets,last,python -->

```bash
# Debian/Ubuntu
sudo apt install samtools gffread last-align python-is-python3
# or conda, which has every tool above
conda install -c bioconda -c conda-forge samtools gffread ncbi-datasets-cli \
  last python
# or Linux x86_64 binaries for the tools apt lacks
wget -P ~/.local/bin \
  https://ftp.ncbi.nlm.nih.gov/pub/datasets/command-line/v2/linux-amd64/datasets \
  https://ftp.ncbi.nlm.nih.gov/pub/datasets/command-line/v2/linux-amd64/dataformat
chmod +x ~/.local/bin/datasets ~/.local/bin/dataformat
# any platform
pip install jcvi
```

<!-- END GENERATED TUTORIAL_INSTALL samtools,gffread,jcvi,datasets,last,python -->

## The data

RefSeq assemblies, one per species, each fetched by accession with the
`datasets` CLI.

You don't need these files to follow the sessions, which read hosted copies. The
track configs name local files that the [build script](#reproduce-it-end-to-end)
writes, so run it first, or follow [the jcvi steps](#producing-the-data) on a
GFF3 and a FASTA per genome of your own.

| What it is  | File                                                                                                                                          |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Grape       | [GCF_030704535.1_ASM3070453v1/](https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/030/704/535/GCF_030704535.1_ASM3070453v1/)                       |
| Peach       | [GCF_000346465.2_Prunus_persica_NCBIv2/](https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/346/465/GCF_000346465.2_Prunus_persica_NCBIv2/)     |
| Cacao       | [GCF_000208745.1_Criollo_cocoa_genome_V2/](https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/208/745/GCF_000208745.1_Criollo_cocoa_genome_V2/) |
| Arabidopsis | [GCF_000001735.4_TAIR10.1/](https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/001/735/GCF_000001735.4_TAIR10.1/)                               |
| Poplar      | [GCF_000002775.5_P.trichocarpa_v4.1/](https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/002/775/GCF_000002775.5_P.trichocarpa_v4.1/)           |
| Tomato      | [GCF_036512215.1_SLM_r2.1/](https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/036/512/215/GCF_036512215.1_SLM_r2.1/)                               |
| Citrus      | [GCF_000493195.1_Citrus_clementina_v1.0/](https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/493/195/GCF_000493195.1_Citrus_clementina_v1.0/)   |

## Produce grape.blocks and the BEDs with jcvi {#producing-the-data}

`grape.blocks` and the BEDs come from [jcvi](https://github.com/tanghaibao/jcvi)
and the [LAST](https://gitlab.com/mcfrith/last) aligner.

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
name gffread wrote. On an NCBI annotation, `--key=transcript_id` and
`--key=Name` leave jcvi a key it cannot resolve, and it writes a placeholder id
like `mrna_494685` that matches no CDS name.

Then catalog orthologs against grape, MCScan each pair, and join. The catalog
step writes `grape.<species>.lifted.anchors`, which `mcscan` reads:

<!-- from: scripts/build_grape_peach_cacao_synteny.sh -->

```bash
for sp in peach cacao; do
  # --no_strip_names keeps the ids matching the BEDs above; --no_dotplot skips
  # jcvi's own PDF, which needs LaTeX
  python -m jcvi.compara.catalog ortholog --no_strip_names --no_dotplot grape "$sp"
  # --iter=1 keeps one block per grape gene, so one mate per genome
  python -m jcvi.compara.synteny mcscan grape.bed "grape.$sp.lifted.anchors" \
    --iter=1 -o "grape.$sp.i1.blocks"
done
# each per-pair table lists grape then the mate, so the join emits the grape
# column twice; cut -f1,2,4 keeps it once, in the order blockAssemblies and
# bedLocations list
python -m jcvi.formats.base join grape.peach.i1.blocks grape.cacao.i1.blocks \
  --noheader | cut -f1,2,4 > grape.blocks
```

The commands above build the per-pair tables the stack uses, peach and cacao
against grape. The build script runs the same steps for arabidopsis, poplar,
tomato and citrus too, joins all the tables and keeps column 1 and every even
column after it, which writes the `grape.blocks` with a column per genome.

A `.blocks` file is a tab-delimited table. Each row is an orthologous group and
each column a genome, with `.` where a genome has no member. The file has no
header row, so `blockAssemblies` names its columns by position:

```text
grape01	peach01	cacao01
grape02	peach02	cacao02
grape03	.	.
```

A real cell holds the gene id from the annotation (`rna-XM_007225519.2` for
NCBI); the table has no coordinates, so one `.bed` per genome holds each id's
coordinates.

<details>
<summary>Two conventions for a second copy of a gene</summary>

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

OrthoFinder's converter, `orthologs2jbrowse orthofinder`, writes this layout by
default; the MCScanX converter keeps the best-scoring copy.

</details>

[Building a table for MCScanBlocksAdapter](/docs/config_guides/synteny_track#building-a-table-for-mcscanblocksadapter)
shows how to convert MCScanX, OrthoFinder, Ensembl Compara and
reciprocal-best-hit output to the same layout, and the adapter reads the
`.blocks` and BED files plain or gzipped.

## Set up the grape, peach and cacao assemblies {#setting-up-the-grape-peach-and-cacao-assemblies}

Grape, peach and cacao are each a genome hub on
[genomes.jbrowse.org](https://genomes.jbrowse.org) under the RefSeq accession
the table was built from. The assembly entry and gene track of each row come
from there:

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

`refNameColumnHeaderName` makes the UCSC names canonical, so the first peach
chromosome is `chrG1` where the BED has `NC_034009.1`.

## Load the blocks file with MCScanBlocksAdapter {#loading-it-in-jbrowse-with-mcscanblocksadapter}

One track supplies the ribbons between each pair of adjacent rows.
`blockAssemblies` names every column in order, and `bedLocations` gives the
matching BED per column; the adapter needs no `assemblyNames` unless you mean to
narrow it:

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

The hosted
[config.json](https://jbrowse.org/demos/grape_peach_cacao/config.json) holds the
version of this track with a column for each genome in the data table, under the
same `trackId`, named **Grape vs peach, cacao, arabidopsis, poplar, tomato,
citrus (MCScan blocks)**. Every session and figure below uses that track. Its
`assemblyNames` lists only grape, peach and cacao, the genomes with an assembly,
and JBrowse draws the other four columns as multi-way lanes from the table and
their BED alone.

## Stack grape, peach and cacao

- **Add → Linear synteny view** opens the form in **Quick start**.
- Choose `grape_peach_cacao_blocks`, whose assemblies become rows.
- Click **Launch**.

As a `defaultSession`, the same stack ordered peach-cacao-grape:

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
        "tracks": ["grape_peach_cacao_blocks"],
        "encoding": { "color": "reference" },
        "autoDiagonalize": true,
        "collapseEmptyRows": true
      }
    ]
  }
}
```

- `tracks` names the track once, and it supplies both bands because its
  `assemblyNames` list every genome
- `collapseEmptyRows` gives each trackless row a bare scale bar
- `encoding.color` is a color scale, a `field` mapped to colors; with the
  `reference` field, both bands are colored by the chromosomes of the shared
  middle row

<Figure caption="Peach, cacao and grape stacked from one MCScan .blocks file. Color by → Reference colors both bands by the middle row's chromosomes." src="/img/multiway_synteny/grape_peach_cacao.png" />

Every row of `grape.blocks` starts from a grape gene, as in any jcvi MCScan
table, so the bands of a stack differ in where their ribbons come from:

- A band touching grape shows pairs straight from the table (direct pairs).
- In a peach-cacao band, JBrowse draws a ribbon only through a grape gene both
  genomes share, so each of its ribbons is transitive, and no ribbon is drawn
  for a row where grape has no member.
- This stack puts grape at the bottom, so its peach-cacao band is the transitive
  one. A peach, grape, cacao stack makes both bands direct.

## Zoom to one block conserved in every genome

We'll stack peach over grape over cacao, by listing the session's `views` in
that order. Then:

- Navigate the rows to `chrG7:18,565,100-18,700,100`, `chr11:787,000-914,000`
  and `chr9:3,898,700-4,003,700`.
- Turn on each genome's **NCBI RefSeq - RefSeq All** track with **Filter by →
  Genes → Only genes**.
- Pick **Color by value → Syntenic depth** on the palette button in the view
  header.

<Figure caption="One conserved block at gene level with each genome's gene track, ribbons colored by syntenic depth." src="/img/multiway_synteny/grape_peach_cacao_gene_orthologs.png" />

## Open one grape locus against all the genomes

`grape.blocks` has a column per genome, and the hosted track names every column
in `blockAssemblies` and `bedLocations`, so JBrowse draws every mate (the
ortholog in each other genome) at once in a linear genome view on grape:

- Navigate to `chr11:778,000-866,000` and turn on grape's **NCBI RefSeq - RefSeq
  All** track.
- Turn on **Grape vs peach, cacao, arabidopsis, poplar, tomato, citrus (MCScan
  blocks)**, which shows every mate in one pileup.
- Pick **Group by → Mate assembly** to facet the track into one lane per genome.

<Figure caption="One grape locus against the other plants, the blocks track grouped by mate assembly, one lane per genome." src="/img/multiway_synteny/blocks_one_vs_all.png" />

## Redraw each lane in its genome's coordinates {#each-genome-in-its-own-coordinates}

In the one-locus view above, every gene sits at its grape coordinate. **Display
types → Multi-way synteny display** redraws the lanes, each in the coordinates
of one genome:

- the display fits each lane to the genome it shows, over the orthologs in the
  window
- one ribbon per ortholog group joins adjacent lanes, bridging past an empty
  one, red where the two lanes run the same way and blue where one is reversed
- any track whose features have a `mate` per assembly can fill the same lanes

Each lane's gene models come from a gene track on that lane's assembly, and gene
spans from the table are outlined where there is none. We'll add one for grape;
each other genome gets the same track under its accession. Swap the `uri` for
your own GFF3, [sorted and indexed with tabix](/docs/quickstart_web), with the
same refNames as the assembly:

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

The multi-way lanes as a `defaultSession` (the track ids come from the hosted
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
            "filter": ["geneLike"],
            "displayMode": "compact"
          },
          {
            "trackId": "grape_peach_cacao_blocks",
            "type": "MultiWaySyntenyDisplay",
            "rows": {
              "sort": [
                "GCF_000346465.2",
                "GCF_000208745.1",
                "poplar",
                "citrus",
                "arabidopsis",
                "tomato"
              ]
            },
            "height": 340
          }
        ]
      }
    ]
  }
}
```

<Figure caption="The grape gene track above multi-way lanes from one MCScan blocks track. A chain of ribbons bridges past a lane with no ortholog in view." src="/img/multiway_synteny/lgv_track_lanes.png" />

Each lane header gives the lane's range, with `[rev]` where its gene order runs
against grape's, and, on a lane zoomed out past grape, its span as a multiple of
the grape window. `rows.sort` in the session above sets the lane order, peach
and cacao first. The
[multi-way synteny display guide](/docs/user_guides/multiway_synteny_display)
covers the headers, lane order and lane menus.

### Zoom the lanes to a few genes

Zoom in until each ribbon connects one gene to its ortholog, fanning where copy
number differs.

- Hover a ribbon to highlight its ortholog group down every lane.
- Click a ribbon to open the details for that pair, and click empty canvas to
  clear the outline.

<Figure caption="Lanes zoomed to a few genes with one ribbon clicked: its ortholog group is outlined down every lane, and the details panel opens on the pair." src="/img/multiway_synteny/lgv_track_clicked.png" />

## Restack the genomes around a locus

A stacked synteny view opens from the lanes by two routes:

- from the lane track, **Advanced → Launch → Linear synteny view (visible
  region)...** in its track menu offers a row to every aligning genome
- from the scale bar, drag-select a locus and pick **Launch → Linear synteny
  view**. The dialog opens a row per genome, grape already placed between peach
  and cacao for the
  [grape-in-the-middle](#zoom-to-one-block-conserved-in-every-genome) stack,
  with arrows to reorder them

<Video src="/media/synteny/restack_around_locus.mp4" caption="Restacking around one grape locus: a selection on the scale bar opens a menu with Launch, and the dialog lists a panel per genome with grape between its two mates." />

## Reproduce it end to end

[`build_grape_peach_cacao_synteny.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_grape_peach_cacao_synteny.sh)
runs everything above and writes a `config.json` with the hub assemblies, gene
tracks, synteny track and default session:

- Download the RefSeq genomes and annotations, and write a BED and a CDS file
  per genome keyed on the mRNA's GFF3 `ID`, so the two join.
- Catalog orthologs against grape and MCScan each pair with `--iter=1`, one
  block per grape gene.
- Join the per-pair tables on the grape column into one `grape.blocks`.
- Write the config from the grape, peach and cacao hubs, with the other four
  genomes as lanes of the blocks track.

`BLOCKS_ONLY_SPECIES` lists the extra lanes; a genome added there needs an NCBI
accession with an annotation, and gets a lane but no row in the synteny view.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_grape_peach_cacao_synteny.sh
bash build_grape_peach_cacao_synteny.sh
npx --yes serve grape_peach_cacao_build  # then open config.json at the printed URL
```

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
