---
title: Synteny from MCScan anchors (grape, peach)
sidebar_label: Synteny (MCScan anchors)
description:
  Load a pairwise jcvi MCScan run as gene-level and block-level synteny tracks,
  and convert an MCScanX run into the same files
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
tutorial_subcategory: Ortholog tables
---

Grape and peach keep long runs of genes in the same order, though the genomes
have diverged too far to align base by base. We:

- produce the gene BEDs and anchor files with
  [jcvi](https://github.com/tanghaibao/jcvi) MCScan
- load the assemblies, gene tracks, and the `.anchors` and `.anchors.simple`
  tracks
- open a linear synteny view, with a ribbon for each gene pair and a bar for
  each block (a run of gene pairs in conserved order), and color by syntenic
  depth
- open the same pairs in a dotplot, and convert an MCScanX run the same way

## Prerequisites

- [jcvi](https://github.com/tanghaibao/jcvi) with the
  [LAST](https://gitlab.com/mcfrith/last) aligner
- Or, in place of jcvi, an existing
  [MCScanX](https://github.com/wyp1125/MCScanX) run:
  [converting one](#coming-from-mcscanx) needs only python3
- `samtools`
- htslib (`bgzip`, `tabix`)
- `wget`
- `node`, for the [JBrowse CLI](/docs/cli)
- A running JBrowse instance (the [web quickstart](/docs/quickstart_web) or the
  [desktop quickstart](/docs/quickstart_desktop))

<!-- TUTORIAL_INSTALL samtools,htslib,node,jbrowse-cli,jcvi,last START -->

```bash
# Debian/Ubuntu
sudo apt install samtools tabix nodejs last-align
# or conda, which has every tool above
conda install -c bioconda -c conda-forge samtools htslib nodejs last
# any platform
pip install jcvi
npm install -g @jbrowse/cli
```

<!-- TUTORIAL_INSTALL samtools,htslib,node,jbrowse-cli,jcvi,last END -->

## The data

Grape ([Jaillon et al. 2007](https://doi.org/10.1038/nature06148)) and peach
genomes and gene annotations, Ensembl Plants release 58.

The tracks below read local files that the
[build script](#reproduce-it-end-to-end) writes from these, so run it first, or
run _Producing the BEDs and anchor files with jcvi_ on a GFF3 and a CDS FASTA
per genome of your own. The script fetches everything itself.

| What it is                                                         | File                                                                                         |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Grape (Vitis_vinifera, PN40024.v4) genome and CDS FASTA            | [vitis_vinifera/](http://ftp.ensemblgenomes.org/pub/plants/release-58/fasta/vitis_vinifera/) |
| Grape gene annotation                                              | [vitis_vinifera/](http://ftp.ensemblgenomes.org/pub/plants/release-58/gff3/vitis_vinifera/)  |
| Peach (Prunus_persica, Prunus_persica_NCBIv2) genome and CDS FASTA | [prunus_persica/](http://ftp.ensemblgenomes.org/pub/plants/release-58/fasta/prunus_persica/) |
| Peach gene annotation                                              | [prunus_persica/](http://ftp.ensemblgenomes.org/pub/plants/release-58/gff3/prunus_persica/)  |

## What `.anchors` and `.anchors.simple` hold

The run writes two files that JBrowse loads as separate synteny tracks.
`.anchors`, via `MCScanAnchorsAdapter`, is the gene-pair level: each line is one
orthologous pair and its alignment score, with `###` separating synteny blocks.
The sample lines and the figures below come from a Phytozome annotation of the
same genomes, so their gene ids and chromosome names differ from the ones the
script writes:

```text
###
VIT_201s0011g00070.1	Prupe.1G290900.1	1430
VIT_201s0011g00080.1	Prupe.1G290800.1	446
VIT_201s0011g00090.1	Prupe.1G290700.1	147
```

`.anchors.simple`, via `MCScanSimpleAnchorsAdapter`, is the same run reduced to
one line per block: the first and last gene of the block on each side, a score,
and the block's orientation:

```text
VIT_201s0011g00070.1	VIT_201s0011g00910.1	Prupe.1G281700.1	Prupe.1G290900.1	149	-
VIT_201s0011g02000.1	VIT_201s0011g02280.2	Prupe.1G345900.1	Prupe.1G348100.1	53	-
VIT_201s0011g02300.1	VIT_201s0011g02530.1	Prupe.1G299800.1	Prupe.1G303200.1	39	+
```

`.anchors.simple` draws one ribbon per block where `.anchors` draws one per gene
pair. The BED files supply the coordinates for both.

### BED files mapping gene ids to coordinates

One BED per genome, prepared from its GFF3 before the ortholog run. The adapters
read the first six columns, and column 4 must match the anchor gene ids byte for
byte:

```text
chr1	12836	26777	VIT_201s0011g00010.1	0	+
chr1	33170	35791	VIT_201s0011g00030.1	0	+
```

Column 1 must use the same reference sequence names as the JBrowse assembly.

A gene id in the anchors file that no BED names breaks the join, and some such
mismatches load with no error; the
[synteny track guide](/docs/config_guides/synteny_track#gene-ids-are-the-join-in-the-mcscan-adapters)
lists which. The mismatch that matters here is jcvi stripping isoform suffixes
from the ids unless run with `--no_strip_names`, which the command in the next
section passes.

## Producing the BEDs and anchor files with jcvi {#producing-the-data}

The BEDs come from each GFF3, and one jcvi command then writes both anchor
files:

<!-- from: scripts/build_grape_peach_anchors.sh -->

```bash
python -m jcvi.formats.gff bed --type=mRNA --key=transcript_id \
  --primary_only grape.gff3.gz -o grape.bed
python -m jcvi.formats.gff bed --type=mRNA --key=transcript_id \
  --primary_only peach.gff3.gz -o peach.bed
python -m jcvi.formats.fasta format grape.cds.fa.gz grape.cds
python -m jcvi.formats.fasta format peach.cds.fa.gz peach.cds

python -m jcvi.compara.catalog ortholog --no_strip_names grape peach
```

The command writes `grape.peach.anchors` and `grape.peach.anchors.simple` to the
working directory. The adapters read anchors and BED files plain or gzipped. The
configs below name gzipped copies, which `gzip -k` makes of each of the four
files; drop `.gz` from a `uri` to read the plain file.

## Loading the grape and peach assemblies and gene tracks

We'll load the two genomes the BEDs describe. `samtools faidx` writes each
`.fai` the assembly needs beside its FASTA.

```json addassembly
{ "name": "grape", "uri": "grape.fa" }
```

```json addassembly
{ "name": "peach", "uri": "peach.fa" }
```

Each genome also gets a gene track, which the
[close-up](#what-an-anchor-looks-like-up-close) below turns to **Show only
genes**. Add the same track with `peach.sorted.gff3.gz` under `peach`. Swap the
`uri` for your own GFF3, bgzipped and tabix-indexed
([prep](/docs/quickstart_web)).

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "grape_genes",
  "name": "grape genes",
  "assemblyNames": ["grape"],
  "adapter": {
    "type": "Gff3TabixAdapter",
    "uri": "grape.sorted.gff3.gz"
  }
}
```

## Loading the .anchors and .anchors.simple tracks {#loading-both-tracks}

Each adapter takes the anchor file plus the two BEDs, and `assemblyNames` lists
the genomes in the order the anchor columns are in (column 1's genome first):

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "grape_peach_anchors",
  "name": "Grape peach synteny (MCScan, anchors)",
  "assemblyNames": ["grape", "peach"],
  "adapter": {
    "type": "MCScanAnchorsAdapter",
    "uri": "grape.peach.anchors.gz",
    "bed1": "grape.bed.gz",
    "bed2": "peach.bed.gz",
    "assemblyNames": ["grape", "peach"]
  }
}
```

The `.anchors.simple` track takes the same shape with the adapter type and file
swapped:

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "grape_peach_anchors_simple",
  "name": "Grape peach synteny (MCScan, simple anchors)",
  "assemblyNames": ["grape", "peach"],
  "adapter": {
    "type": "MCScanSimpleAnchorsAdapter",
    "uri": "grape.peach.anchors.simple.gz",
    "bed1": "grape.bed.gz",
    "bed2": "peach.bed.gz",
    "assemblyNames": ["grape", "peach"]
  }
}
```

`MCScanAnchorsAdapter` and `MCScanSimpleAnchorsAdapter` read the whole file into
memory, which MCScan output is small enough for.

## Viewing gene pairs and blocks in one synteny view

We'll start with **Add → Linear synteny view** and pick peach and grape. Then:

- Turn on both MCScan tracks in the band between them.
- Turn on the simple-anchors track in each panel's track selector, where it
  draws as a row of bars.

<Figure caption="Peach and grape with both MCScan tracks: .anchors.simple blocks as wide ribbons, the per-gene .anchors pairs over them. Marks along the top of the band are pairs whose grape gene is on a chromosome not shown." src="/img/mcscan_anchors.png" />

The bars in each panel come from the block track's `LGVSyntenyDisplay`, which
draws synteny as features in an ordinary linear genome view row. Selecting it by
name needs the full `displays` array:

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "grape_peach_anchors_simple",
  "name": "Grape peach synteny (MCScan, simple anchors)",
  "assemblyNames": ["grape", "peach"],
  "adapter": {
    "type": "MCScanSimpleAnchorsAdapter",
    "uri": "grape.peach.anchors.simple.gz",
    "bed1": "grape.bed.gz",
    "bed2": "peach.bed.gz",
    "assemblyNames": ["grape", "peach"]
  },
  "displays": [
    {
      "type": "LGVSyntenyDisplay",
      "height": 60
    }
  ]
}
```

<Figure src="/img/mcscan_synteny/anchors_vs_simple.png" links="Gene pairs=mcscan_synteny/anchors,Blocks=mcscan_synteny/anchors_simple" caption="MCScan blocks on grape chr9 against peach Pp03. Top: .anchors alone. Bottom: both files on one band." />

## A single gene pair up close {#what-an-anchor-looks-like-up-close}

Zoom to one block with both gene tracks on and set to **Filter by... → Genes →
Only genes**.

<Figure caption="One MCScan block with both gene tracks set to Only genes. Each ribbon is one .anchors line, spanning the two genes it pairs." src="/img/mcscan_synteny/gene_level.png" />

MCScan anchors only the pairs it could call confidently, so most genes have no
ribbon.

## Tandem copies sharing one ortholog {#syntenic-depth}

Pick **Color by value → Syntenic depth** on the palette button in the view
header. A ribbon stays grey where its two genes pair only with each other, and
turns orange where several genes share one ortholog, which is often a tandem
array. The count covers the whole `.anchors` file, so a gene whose other copies
are off screen still takes color.

<Figure caption="Grape chr1 against peach Pp04, the .anchors track colored by syntenic depth." src="/img/mcscan_synteny/syntenic_depth.png" />

## Viewing the gene pairs as a dotplot

The anchors track and the simple anchors track also load in a dotplot, where a
gene pair is one point and a block a run of them; **Add → Dotplot view** opens
one. The axes start in index order; **Re-order chromosomes**, in the overflow
menu of the dotplot header, sorts the vertical axis to follow the horizontal
one.

<Video src="/media/synteny/dotplot_reorder.mp4" caption="The dotplot axes in index order, then re-sorted from the header's overflow menu." />

<Figure caption="Peach against grape after Re-order chromosomes, every point one .anchors gene pair." src="/img/mcscan_synteny/dotplot.png" />

**Re-order chromosomes** puts each peach chromosome's strongest grape partner on
the diagonal, and its other partners stay off it. The
[script](#reproduce-it-end-to-end) prints the same pairings off
`.anchors.simple`.

## Converting an MCScanX run {#coming-from-mcscanx}

[MCScanX](https://github.com/wyp1125/MCScanX) is a different program from jcvi's
MCScan. It writes one `.collinearity` holding every block, self-synteny and
cross-species together, and tells genomes apart by a two-letter tag on each
chromosome name.
[`mcscanx_to_anchors.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/mcscanx_to_anchors.py)
splits a run into the four files jcvi writes, in place of the
[jcvi step](#producing-the-data):

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/mcscanx_to_anchors.py
python3 mcscanx_to_anchors.py --gff xyz.gff --collinearity xyz.collinearity \
  --species vv=grape --species pp=peach --strand-gff3 peach=peach.gff3.gz
```

The track configs [above](#loading-both-tracks) load the converted files
unchanged. `--species` order is the anchors column order, so it has to match the
track's `assemblyNames`. Two options decide whether the result draws:

- `--chr-prefix peach=Pp0` prepends to the refNames, and `--keep-chr-tag` keeps
  MCScanX's tag, stripped by default (`vv1` becomes `1`)
- `--strand-gff3 peach=peach.gff3.gz` recovers strand from the annotation, so an
  inverted `.anchors` pair draws as inverted

`--fai peach=peach.fa.fai` checks the refNames against the assembly; an unknown
name draws empty. An anchors score becomes `-log10` of MCScanX's e-value.

The number of `--species` names sets what the run writes:

- A third species writes an ortholog table instead, since one `.collinearity`
  covers every pair. See
  [ortholog tables](/docs/config_guides/synteny_track#from-mcscanx).
- A single species keeps the blocks duplicated within that genome, which
  [](/docs/tutorials/homoeolog_synteny) draws as a dotplot of one assembly on
  both axes.

## Reproduce it end to end

[`build_grape_peach_anchors.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_grape_peach_anchors.sh)
runs everything above and writes a `config.json` with both assemblies, gene
tracks, both MCScan tracks and a default session opening them together:

1. Download the grape and peach genomes, annotations and CDS from Ensembl
   Plants.
2. Write a BED and a CDS file per genome keyed on transcript ids, and run jcvi
   with `--no_strip_names` so the anchor ids match the BEDs.
3. Count anchors per peach-grape chromosome pair off `.anchors.simple`, the
   pairing the reordered dotplot shows.
4. Write the config with both assemblies, gene tracks, both MCScan tracks and a
   session.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_grape_peach_anchors.sh
bash build_grape_peach_anchors.sh
npx --yes serve grape_peach_anchors_build/jbrowse2  # then open the printed URL
```

## See also

- [](/docs/tutorials/synteny_visualization)
- [](/docs/tutorials/multiway_synteny_grape_peach_cacao)
- [](/docs/user_guides/linear_synteny_view)
- [](/docs/config_guides/synteny_track)
- [](/docs/config/mcscananchorsadapter)
- [](/docs/config/mcscansimpleanchorsadapter)

## Citations

- Tang et al. (2008).
  [Unraveling ancient hexaploidy through multiply-aligned angiosperm gene maps](https://doi.org/10.1101/gr.080978.108),
  the MCScan method jcvi implements
- Jaillon et al. (2007).
  [The grapevine genome sequence suggests ancestral hexaploidization in major angiosperm phyla](https://doi.org/10.1038/nature06148)
