---
title: Synteny visualization (OrthoFinder orthogroups)
sidebar_label: Synteny (OrthoFinder)
description:
  Stack genomes on OrthoFinder orthogroups, built from protein homology, and
  find each genome duplication as one region against two or three copies
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
tutorial_subcategory: Ortholog tables
---

Genomes too far apart to align base by base still keep their genes in order
along the chromosomes. OrthoFinder infers orthogroups, sets of genes descended
from one ancestral gene, from protein similarity alone. An orthogroup keeps
every copy of a gene, so where a genome doubled or tripled, one region of a
relative without that duplication pairs with two or three regions of it: bread
wheat's three subgenomes, maize, zebrafish and tomato, and the fruit flies as a
lineage with one copy. We:

- run OrthoFinder and convert the orthogroups to a `.blocks` table that JBrowse
  reads
- load the `wheat` orthogroups as a synteny track, stack tauschii over bread
  wheat, and color each link by its tauschii chromosome
- open four more sets the same way (grasses, vertebrates, nightshades and
  drosophila) at one locus each, three of them also as multi-way lanes under one
  genome
- chain the drosophila orthogroups into collinear blocks with MCScanX and load
  them as a PAF track

## Prerequisites

- [OrthoFinder](https://github.com/davidemms/OrthoFinder) with
  [DIAMOND](https://github.com/bbuchfink/diamond) on `PATH` as `orthofinder`
- [MCScanX](https://github.com/wyp1125/MCScanX) (`MCScanX_h`), for the
  [collinear blocks](#collinear-blocks)
- `python3`, htslib (`bgzip`, `tabix`)
- `node`, for the [JBrowse CLI](/docs/cli)
- [NCBI datasets CLI](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/command-line-tools/)
  (`datasets`, `dataformat`)
- [gffread](https://github.com/gpertea/gffread), for
  [your own genomes](#your-own-genomes) only
- A running JBrowse instance ([web](/docs/quickstart_web) or
  [desktop](/docs/quickstart_desktop))

<!-- BEGIN GENERATED TUTORIAL_INSTALL htslib,diamond,gffread,node,jbrowse-cli,datasets,mcscanx,orthofinder -->

```bash
# Debian/Ubuntu
sudo apt install tabix diamond-aligner gffread nodejs
# or conda, which has every tool above
conda install -c bioconda -c conda-forge htslib diamond gffread nodejs \
  ncbi-datasets-cli mcscanx orthofinder
# or Linux x86_64 binaries for the tools apt lacks
wget -P ~/.local/bin \
  https://ftp.ncbi.nlm.nih.gov/pub/datasets/command-line/v2/linux-amd64/datasets \
  https://ftp.ncbi.nlm.nih.gov/pub/datasets/command-line/v2/linux-amd64/dataformat
chmod +x ~/.local/bin/datasets ~/.local/bin/dataformat
# any platform
npm install -g @jbrowse/cli@next
```

<!-- END GENERATED TUTORIAL_INSTALL htslib,diamond,gffread,node,jbrowse-cli,datasets,mcscanx,orthofinder -->

## The data

Each genome is an NCBI assembly, and the script fetches its protein FASTA, GFF3
and sequence report together with `datasets download genome accession`.

The page's commands build local files from these, and the tracks over those read
them from disk; every other track reads a hosted copy. The
[build script](#reproduce-it-end-to-end) fetches everything itself. _Running
OrthoFinder and building the blocks table_ takes a proteome per genome of your
own.

| What it is                                                               | File                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`vertebrates`**: human, chicken, frog, gar, zebrafish                  | [GCF_000001405.40](https://www.ncbi.nlm.nih.gov/datasets/genome/GCF_000001405.40/), [GCF_016699485.2](https://www.ncbi.nlm.nih.gov/datasets/genome/GCF_016699485.2/), [GCF_000004195.4](https://www.ncbi.nlm.nih.gov/datasets/genome/GCF_000004195.4/), [GCF_000242695.1](https://www.ncbi.nlm.nih.gov/datasets/genome/GCF_000242695.1/), [GCF_000002035.6](https://www.ncbi.nlm.nih.gov/datasets/genome/GCF_000002035.6/) |
| **`grasses`**: rice, sorghum, maize, brachypodium, setaria               | [GCF_001433935.1](https://www.ncbi.nlm.nih.gov/datasets/genome/GCF_001433935.1/), [GCF_000003195.3](https://www.ncbi.nlm.nih.gov/datasets/genome/GCF_000003195.3/), [GCF_902167145.1](https://www.ncbi.nlm.nih.gov/datasets/genome/GCF_902167145.1/), [GCF_000005505.3](https://www.ncbi.nlm.nih.gov/datasets/genome/GCF_000005505.3/), [GCF_000263155.2](https://www.ncbi.nlm.nih.gov/datasets/genome/GCF_000263155.2/)   |
| **`wheat`**: tauschii, wheat, durum, emmer, urartu                       | [GCF_002575655.3](https://www.ncbi.nlm.nih.gov/datasets/genome/GCF_002575655.3/), [GCF_018294505.1](https://www.ncbi.nlm.nih.gov/datasets/genome/GCF_018294505.1/), [GCA_900231445.1](https://www.ncbi.nlm.nih.gov/datasets/genome/GCA_900231445.1/), [GCF_002162155.2](https://www.ncbi.nlm.nih.gov/datasets/genome/GCF_002162155.2/), [GCF_003073215.2](https://www.ncbi.nlm.nih.gov/datasets/genome/GCF_003073215.2/)   |
| **`drosophila`**: melanogaster, simulans, yakuba, pseudoobscura, virilis | [GCF_000001215.4](https://www.ncbi.nlm.nih.gov/datasets/genome/GCF_000001215.4/), [GCF_016746395.2](https://www.ncbi.nlm.nih.gov/datasets/genome/GCF_016746395.2/), [GCF_016746365.2](https://www.ncbi.nlm.nih.gov/datasets/genome/GCF_016746365.2/), [GCF_009870125.1](https://www.ncbi.nlm.nih.gov/datasets/genome/GCF_009870125.1/), [GCF_030788295.1](https://www.ncbi.nlm.nih.gov/datasets/genome/GCF_030788295.1/)   |
| **`solanaceae`**: tomato, potato, pepper, tobacco, coffee                | [GCF_036512215.1](https://www.ncbi.nlm.nih.gov/datasets/genome/GCF_036512215.1/), [GCA_020169535.1](https://www.ncbi.nlm.nih.gov/datasets/genome/GCA_020169535.1/), [GCF_002878395.1](https://www.ncbi.nlm.nih.gov/datasets/genome/GCF_002878395.1/), [GCF_001879085.1](https://www.ncbi.nlm.nih.gov/datasets/genome/GCF_001879085.1/), [GCA_900059795.1](https://www.ncbi.nlm.nih.gov/datasets/genome/GCA_900059795.1/)   |

## The wheat set: genomes of one polyploid history {#wheat}

The `wheat` set is the genomes of wheat's polyploid history:

- **Aegilops tauschii**, diploid D donor
- **bread wheat**, hexaploid, A+B+D
- **durum**, domesticated tetraploid, A+B
- **wild emmer**, durum's wild tetraploid ancestor
- **Triticum urartu**, diploid A donor

## Running OrthoFinder and building the blocks table {#producing-the-blocks-table}

The build commands here produce the `wheat` set; the other four differ only in
the proteomes used:

<!-- from: scripts/build_orthofinder_synteny.sh -->

```bash
# -og stops after the orthogroups, skipping the gene trees and the species
# tree, which this table does not use and which are most of the runtime.
# -S diamond picks the aligner; -t is threads.
orthofinder -f proteomes -og -S diamond -t "$(getconf _NPROCESSORS_ONLN)"
```

The run writes
`proteomes/OrthoFinder/Results_<date>/Orthogroups/Orthogroups.tsv`, which the
next command reduces to one gene id per cell:

<!-- from: scripts/build_orthofinder_synteny.sh -->

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/orthogroups_to_blocks.py
python3 orthogroups_to_blocks.py Orthogroups.tsv -o tauschii.blocks \
  --bed tauschii=tauschii.bed --bed wheat=wheat.bed --bed durum=durum.bed \
  --bed emmer=emmer.bed --bed urartu=urartu.bed \
  --max-copies 4
```

`blockAssemblies` must match the column order the script prints.
`--assembly COLUMN=NAME` renames a column; a misspelled column there renames
nothing and raises no error, while a typo in `--bed` is an error:

```bash
python3 orthogroups_to_blocks.py Orthogroups.tsv -o tauschii.blocks \
  --bed tauschii=tauschii.bed --bed wheat=wheat.bed \
  --assembly wheat=bread_wheat
```

### Duplicated genes: one ribbon, two ribbons or none {#what-to-do-with-a-duplicated-gene}

In `Orthogroups.tsv` each cell lists one genome's genes in an orthogroup, so two
genes in one cell have no single ribbon. `--pick` chooses among three
treatments:

| `--pick`           | A rice gene with two maize orthologs                         | Use when                                                  |
| ------------------ | ------------------------------------------------------------ | --------------------------------------------------------- |
| `first`            | one ribbon, to whichever maize gene OrthoFinder listed first | you want maximum coverage and accept the arbitrary choice |
| `expand` (default) | two ribbons, one per maize copy                              | the duplication is part of what you are looking at        |
| `single`           | no ribbon                                                    | you want a strictly one-to-one table                      |

A cell over `--max-copies` counts as a family and contributes no row:

```bash
python3 orthogroups_to_blocks.py Orthogroups.tsv -o tauschii.blocks \
  --bed tauschii=tauschii.bed --bed wheat=wheat.bed \
  --pick single --max-copies 2
```

### Matching gene ids between the table and the BEDs

Column 4 of each BED must match the ids in the table exactly. The build script
keeps each gene's longest protein and names it by the gene id, so OrthoFinder
sees one protein per gene under the id the BED has. `--bed name=file` reports
the share of ids placed, and the conversion stops if it places none.

## Loading the wheat orthogroups as a synteny track

One track backs each pair of adjacent rows in the stack:

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "wheat_orthogroups",
  "name": "Wheat orthogroups (OrthoFinder)",
  "assemblyNames": ["tauschii", "wheat", "durum", "emmer", "urartu"],
  "adapter": {
    "type": "MCScanBlocksAdapter",
    "uri": "tauschii.blocks.gz",
    "blockAssemblies": ["durum", "emmer", "tauschii", "urartu", "wheat"],
    "bedLocations": [
      "durum.bed.gz",
      "emmer.bed.gz",
      "tauschii.bed.gz",
      "urartu.bed.gz",
      "wheat.bed.gz"
    ]
  }
}
```

A mismatch between `blockAssemblies` and the column order the conversion printed
raises a track error naming both lists.

### Assemblies from a chrom.sizes

A gene-level synteny view reads no sequence, so each assembly is a
[`ChromSizesAdapter`](/docs/config/chromsizesadapter) over a `.chrom.sizes` file
(a name and a length per line) built from its NCBI sequence report. We'll load
wheat; the other genomes repeat the block under each genome's name:

```json addassembly
{ "name": "wheat", "uri": "wheat.chrom.sizes" }
```

### Gene tracks, one per genome

The multi-way display draws a lane per genome, with gene models from a gene
track on that genome's assembly in the config, open or not
([`laneGeneTracks`](/docs/config/multiwaysyntenydisplay/#slot-lanegenetracks)
picks one when a genome has several). For your own annotation, add one per
genome from a bgzipped, sorted GFF3 ([prep](/docs/quickstart_web)) that uses the
assembly's refNames, indexed with `tabix -C`:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "wheat_genes",
  "name": "wheat genes",
  "assemblyNames": ["wheat"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "uri": "wheat.sorted.gff3.gz",
    "csi": true
  }
}
```

## Stacking tauschii over wheat {#stacking-the-wheat-genomes}

We'll stack the D-genome donor over bread wheat: **Add → Linear synteny view**,
pick `wheat_orthogroups` and add tauschii above wheat; the
[all-vs-all tutorial](/docs/tutorials/allvsall_synteny#from-the-ui) walks the
dialog. Then:

- Navigate the wheat row to
  `1A 1B 1D 2A 2B 2D 3A 3B 3D 4A 4B 4D 5A 5B 5D 6A 6B 6D 7A 7B 7D`, the seven
  homoeologous groups side by side, with the unplaced `Un` left out.
- Pick **Query** in the palette button menu. The palette sets the view's
  `encoding.color`, a color scale from a field to colors, and **Query** paints
  each link by its tauschii chromosome.

The same view as a session over the hosted wheat config:

```json session config=https://jbrowse.org/demos/orthofinder_wheat/config.json
{
  "defaultSession": {
    "name": "Tauschii over wheat",
    "views": [
      {
        "type": "LinearSyntenyView",
        "views": [
          { "assembly": "tauschii" },
          {
            "assembly": "wheat",
            "loc": "1A 1B 1D 2A 2B 2D 3A 3B 3D 4A 4B 4D 5A 5B 5D 6A 6B 6D 7A 7B 7D"
          }
        ],
        "tracks": ["wheat_orthogroups"],
        "encoding": { "color": "query", "opacity": 0.15 }
      }
    ]
  }
}
```

<Figure caption="Aegilops tauschii over bread wheat on the wheat orthogroups track, each link colored by its tauschii chromosome." src="/img/orthofinder_synteny/wheat.png" />

An orthogroup holds a gene's A, B and D copies (homoeologs) together, and
`--pick expand` draws a link to each, so every tauschii chromosome fans out to
the three wheat chromosomes of its group.

### Wheat 4A against the D genome

Navigate the wheat row to `4A` alone, keeping **Query**:

<Figure caption="Aegilops tauschii's D-genome chromosomes over wheat 4A. Color by → Query gives each chromosome its own color." src="/img/orthofinder_synteny/wheat_4a.png" />

Other chromosomes appear on 4A only as single genes. The runs from tauschii 5
and 7 are the 4AL/5AL and 4AL/7BS translocations (Devos et al. 1995; Dvorak et
al. 2018).

## Grasses: one rice region in two maize copies {#grasses}

The other four sets build with `bash build_orthofinder_synteny.sh <set>`
([Reproduce it end to end](#reproduce-it-end-to-end)), and each has a hosted
config at `https://jbrowse.org/demos/orthofinder_<set>/config.json`.

Maize went through a whole-genome duplication after it split from sorghum
(Schnable et al. 2009), so one rice region pairs with one sorghum region and two
maize regions.

### One rice locus against both maize copies

Open the `grasses` config and stack sorghum over rice over maize, with
`grasses_orthogroups` in each band. Then:

- Turn on **sorghum genes**, **rice genes** and **maize genes**.
- Navigate the rows to `1:5,934,000-6,126,000[rev]`, `3:31,590,000-31,775,000`
  and `1:286,676,000-287,665,000 5:6,261,000-6,790,000[rev]`.
- Pick **Target** in the palette button menu to paint each link by the
  chromosome it lands on.

Sorghum is the control: it shares the ancestry and lacks the duplication.

<Figure caption="One rice locus between sorghum and maize from the grasses orthogroups track, a gene track under each row." src="/img/orthofinder_synteny/grasses_maize_wgd.png" />

### A rice window against four grasses

Open the same five grasses as a
[multi-way synteny track](/docs/user_guides/multiway_synteny_display) on rice.
Its top lane draws the rice genes, so no separate gene track is needed:

```json session config=https://jbrowse.org/demos/orthofinder_grasses/config.json
{
  "defaultSession": {
    "name": "Grasses multi-way synteny track",
    "views": [
      {
        "type": "LinearGenomeView",
        "assembly": "rice",
        "loc": "3:31,590,000-31,775,000",
        "tracks": [
          {
            "trackId": "grasses_orthogroups",
            "type": "MultiWaySyntenyDisplay",
            "rows": {
              "sort": ["sorghum", "brachypodium", "setaria", "maize"]
            },
            "height": 480
          }
        ]
      }
    ]
  }
}
```

<Figure caption="A rice window over four grass lanes from one orthogroups track, each drawing its own gene models." src="/img/multiway_synteny/grasses_rice_lanes.png" />

A stacked view shows both maize copies at once. **Advanced → Launch → Linear
synteny view (visible region)** in the lane track menu offers a full row per
grass.

<Video src="/media/synteny/multiway_launch_stack.mp4" caption="Launching a stack from the lane track: the track menu entry, the dialog's row checkboxes, and Replace current view." />

## Vertebrates: one gar chromosome in two zebrafish copies {#vertebrates}

The teleost fishes, zebrafish among them, descend from a genome duplication that
spotted gar branched off before (Braasch et al. 2016). Open the `vertebrates`
config and stack gar over zebrafish, with `vertebrates_orthogroups` in the band.
Then:

- Navigate the gar row to `LG11` and leave zebrafish whole.
- Pick **Target** in the palette button menu to paint each link by its zebrafish
  chromosome.
- Uncheck **Off-screen mates** in the settings menu, which otherwise labels the
  zebrafish genes whose gar partners sit on other gar chromosomes.

<Figure caption="Gar LG11 over the whole zebrafish genome from the vertebrates orthogroups track, each link colored by its zebrafish chromosome." src="/img/orthofinder_synteny/vertebrates.png" />

### The human HOXD cluster against four vertebrates

Open human at `2:176,090,000-176,290,000`, the _HOXD_ cluster of body-axis
patterning genes, with the orthogroups track on the
[multi-way synteny display](/docs/user_guides/multiway_synteny_display). A lane
(one horizontal strip per genome) for each of chicken, frog, gar and zebrafish
draws under the human genes.

<Figure caption="The human HOXD cluster over four vertebrate lanes from one orthogroups track, each lane with its genome's genes." src="/img/multiway_synteny/vertebrate_hox_lanes.png" />

## Nightshades: one coffee region in three tomato copies {#nightshades}

Tomato, potato and pepper share a whole-genome triplication that coffee lacks
(Tomato Genome Consortium 2012; Denoeud et al. 2014). Open the `solanaceae`
config and stack tomato over coffee over tomato, with `solanaceae_orthogroups`
in both bands. Then:

- Navigate the rows to `7:66,700,000-70,550,000`, `VII:24,200,000-28,800,000`
  and `10:850,000-2,400,000[rev] 12:4,600,000-6,900,000`: one tomato copy above
  coffee and the other two below.
- Pick **Reference** in the palette button menu to paint each link by its tomato
  chromosome.
- Uncheck **Off-screen mates** in the settings menu, which otherwise marks the
  coffee genes whose other partners fall outside the windows.

<Figure caption="One coffee window between three tomato windows from the solanaceae orthogroups track, links colored by tomato chromosome." src="/img/orthofinder_synteny/solanaceae.png" />

Each copy has lost genes since the triplication, so most coffee genes draw to
one of the three.

## Drosophila: one copy, rearranged {#drosophila}

The `drosophila` set stacks _D. melanogaster_ with close relatives _D. simulans_
and _D. yakuba_ and the distant _D. pseudoobscura_ and _D. virilis_, which share
no genome duplication since they split. The chromosome arms (Muller elements)
keep their gene content, while inversions reorder the genes inside each arm. In
_D. pseudoobscura_ melanogaster's 3L arm (Muller D) is the right arm of the X
(Richards et al. 2005).

Open the `drosophila` config and stack the flies as simulans, melanogaster,
yakuba, melanogaster, pseudoobscura, melanogaster, virilis, so every band sets
one fly against melanogaster, with `drosophila_orthogroups` in each band. Then:

- Pick **Show whole genome - same bp per pixel** in the view menu
  (`coord: { ratio: 1 }` in a session spec), which puts the rows on one bp/px,
  so row length on screen matches genome size.
- Pick **Rows → Re-order chromosomes** (`autoDiagonalize` in a session spec),
  which sorts each row's chromosomes against its neighbour so the links run
  along a diagonal.
- Pick **Reference** in the palette button menu to paint each ribbon by the
  melanogaster arm it leaves.

<Figure caption="Four flies stacked with melanogaster between each pair, ribbons colored by melanogaster arm." src="/img/orthofinder_synteny/drosophila.png" />

### Gene order in one 3L window across the flies

Open melanogaster at `3L:5,789,000-5,931,000` with the
[multi-way synteny display](/docs/user_guides/multiway_synteny_display), which
draws a lane per fly. Every fly keeps this window's melanogaster genes.

<Figure caption="Melanogaster 3L over four Drosophila lanes from one orthogroups track." src="/img/multiway_synteny/drosophila_lanes.png" />

### Collinear blocks from the same orthogroups {#collinear-blocks}

An orthogroup lists the related genes and holds no gene order.
[MCScanX](https://github.com/wyp1125/MCScanX)'s `MCScanX_h` chains ortholog
pairs that keep their order into collinear blocks. Start by writing every gene
pair an orthogroup holds between two flies:

<!-- from: scripts/build_orthofinder_synteny.sh -->

```bash
# every melanogaster-simulans pair in an orthogroup, each copy of a duplicated
# gene included, so MCScanX_h picks the collinear copy by gene order
python3 orthogroups_to_blocks.py Orthogroups.tsv -o melanogaster.blocks \
  --homology melanogaster:simulans=x.homology
```

`MCScanX_h` reads those pairs and `x.gff`, four columns per gene (chromosome,
gene id, start, end) with each chromosome name prefixed by a two-letter code for
its genome:

<!-- from: scripts/build_orthofinder_synteny.sh -->

```bash
# -s 10: a block holds at least 10 gene pairs
# -m 24: at most 24 genes skipped between two pairs of a block
# -g 0: a skipped gene costs nothing, so -s alone sets the size cutoff
# -b 2: blocks between the two genomes only, none within one
# -a: write the .collinearity file and skip the HTML
MCScanX_h x -a -b 2 -s 10 -m 24 -g 0
```

Convert the blocks to PAF, one line per block, with each sequence named for its
assembly (`melanogaster#1#2L`):

<!-- from: scripts/build_orthofinder_synteny.sh -->

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/mcscanx_to_anchors.py
python3 mcscanx_to_anchors.py --gff x.gff --collinearity x.collinearity \
  --species aa=melanogaster --species bb=simulans \
  --paf melanogaster.simulans.paf \
  --chrom-sizes melanogaster=melanogaster.chrom.sizes \
  --chrom-sizes simulans=simulans.chrom.sizes
```

The PAF files of every pair, concatenated, back every band of a stack from one
track:

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "drosophila_blocks",
  "name": "Drosophila collinear blocks (MCScanX)",
  "assemblyNames": [
    "melanogaster",
    "simulans",
    "yakuba",
    "pseudoobscura",
    "virilis"
  ],
  "adapter": {
    "type": "MultiGenomePAFAdapter",
    "uri": "https://jbrowse.org/demos/orthofinder_drosophila/drosophila.blocks.paf.gz",
    "assemblyNames": [
      "melanogaster",
      "simulans",
      "yakuba",
      "pseudoobscura",
      "virilis"
    ]
  }
}
```

Stack the flies in the same order as above and pick `drosophila_blocks` for
every band:

<Figure caption="The same stack from the drosophila_blocks track, one ribbon per collinear block." src="/img/orthofinder_synteny/drosophila_blocks.png" />

## Reproduce it end to end

[`build_orthofinder_synteny.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_orthofinder_synteny.sh)
runs everything above and writes a `config.json` with the assemblies, gene
tracks, the synteny track and a stacked default session:

1. Download each genome's proteins, GFF3 and sequence report from NCBI, keeping
   each gene's longest protein under its gene id so the table and the BEDs
   agree, and write a gene BED and chrom.sizes per genome.
2. Run OrthoFinder to the orthogroups only.
3. Convert the orthogroups to a `.blocks` table, dropping cells over `MAXCOPIES`
   as gene families, and print how one-to-one each adjacent pair of genomes is.
4. Chain every pair of genomes into collinear blocks with `MCScanX_h`, and
   collect the blocks into one PAF.
5. Write the assemblies, gene tracks, the orthogroups and blocks tracks and a
   stacked session.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_orthofinder_synteny.sh
bash build_orthofinder_synteny.sh wheat   # or: vertebrates, grasses, drosophila, solanaceae
npx --yes serve orthofinder_wheat_build/jbrowse2  # then open the printed URL
```

The sets the script accepts, and what each costs to build:

<!-- BEGIN GENERATED ORTHOFINDER_SETS -->

<!-- prettier-ignore -->
| Set | Genomes | DIAMOND runs | NCBI annotation |
| --- | --- | --- | --- |
| <code>vertebrates</code> | human, chicken, frog, gar, zebrafish | 25 | RefSeq |
| <code>grasses</code> | rice, sorghum, maize, brachypodium, setaria | 25 | RefSeq |
| <code>wheat</code> | tauschii, wheat, durum, emmer, urartu | 25 | RefSeq and GenBank |
| <code>drosophila</code> | melanogaster, simulans, yakuba, pseudoobscura, virilis | 25 | RefSeq |
| <code>solanaceae</code> | tomato, potato, pepper, tobacco, coffee | 25 | RefSeq and GenBank |

<!-- END GENERATED ORTHOFINDER_SETS -->

Two cuts are environment variables:

<!-- BEGIN GENERATED ORTHOFINDER_CUTS -->

<!-- prettier-ignore -->
| Variable | Default | What it cuts |
| --- | --- | --- |
| <code>MAXSEQ</code> | 30 | sequence regions kept per genome, the ones with the most genes |
| <code>MAXCOPIES</code> | 4 | genes in one orthogroup cell past which it is a gene family rather than a set of copies |

<!-- END GENERATED ORTHOFINDER_CUTS -->

```bash
MAXSEQ=60 MAXCOPIES=6 bash build_orthofinder_synteny.sh wheat
```

The NCBI `datasets` CLI names chromosomes that a GFF3 gives as INSDC accessions,
each from its [sequence report](/docs/config/ncbisequencereportaliasadapter).

## Your own genomes

A set name tells the script which NCBI assemblies to download. Your own genomes
need a FASTA and a GFF3 per genome.
[gffread](https://github.com/gpertea/gffread) translates each CDS into the
proteome and prints the transcript-to-gene map and FASTA index alongside.

Name the files in a manifest, one line per genome:

```bash
cat > my_genomes.tsv <<'EOF'
# name    genome                    annotation              aliases
speciesA  data/speciesA.fa.gz       data/speciesA.gff3.gz
speciesB  https://host/B.fa.gz      https://host/B.gff3.gz  GCF_000001405.40
EOF

bash build_orthofinder_synteny.sh my_genomes.tsv
npx --yes serve orthofinder_my_genomes_build/jbrowse2  # then open the printed URL
```

- Column 1 names the assembly, and columns 2 and 3 take a local path or URL.
- Column 4 is optional. An INSDC accession fetches NCBI's sequence report for
  chromosome names, and a file name supplies a two-column alias table.
- Column 2 also takes a proteome directly, which skips translation; its headers
  then need a `gene:<id>` tag matching `ID=gene:<id>` in the GFF3.
- Two genomes make a valid manifest.

## See also

- [](/docs/tutorials/multiway_synteny_grape_peach_cacao)
- [](/docs/tutorials/mcscan_synteny_grape_peach)
- [](/docs/tutorials/synteny_visualization)
- [](/docs/user_guides/linear_synteny_view)
- [](/docs/config_guides/synteny_track)
- [](/docs/config/mcscanblocksadapter)

## Citations

- Emms and Kelly (2019).
  [OrthoFinder: phylogenetic orthology inference for comparative genomics](https://doi.org/10.1186/s13059-019-1832-y)
- Wang et al. (2012).
  [MCScanX: a toolkit for detection and evolutionary analysis of gene synteny and collinearity](https://doi.org/10.1093/nar/gkr1293)
- Schnable et al. (2009).
  [The B73 maize genome: complexity, diversity, and dynamics](https://doi.org/10.1126/science.1178534)
- Braasch et al. (2016).
  [The spotted gar genome illuminates vertebrate evolution and facilitates human-teleost comparisons](https://doi.org/10.1038/ng.3526)
- Tomato Genome Consortium (2012).
  [The tomato genome sequence provides insights into fleshy fruit evolution](https://doi.org/10.1038/nature11119)
- Denoeud et al. (2014).
  [The coffee genome provides insight into the convergent evolution of caffeine biosynthesis](https://doi.org/10.1126/science.1255274)
- Richards et al. (2005).
  [Comparative genome sequencing of Drosophila pseudoobscura: chromosomal, gene, and cis-element evolution](https://doi.org/10.1101/gr.3059305)
- Devos et al. (1995).
  [Structural evolution of wheat chromosomes 4A, 5A, and 7B and its impact on recombination](https://doi.org/10.1007/BF00220890)
- Dvorak et al. (2018).
  [Reassessment of the evolution of wheat chromosomes 4A, 5A, and 7B](https://doi.org/10.1007/s00122-018-3165-8)
