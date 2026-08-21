---
title: Synteny from MCScan anchors (grape, peach)
sidebar_label: Synteny (MCScan anchors)
description:
  Load a pairwise jcvi MCScan run as gene-level and block-level synteny tracks,
  and convert an MCScanX run into the same files
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
data: pipeline
---

**TL;DR:** a pairwise [jcvi](https://github.com/tanghaibao/jcvi) MCScan run
writes two files that JBrowse loads as separate synteny tracks: `.anchors` (one
orthologous gene pair per line, via `MCScanAnchorsAdapter`) and
`.anchors.simple` (one synteny block per line, via
`MCScanSimpleAnchorsAdapter`). Both pair genes by name rather than by position,
so each also needs a BED per genome mapping gene ids to coordinates.

## Prerequisites

- [jcvi](https://github.com/tanghaibao/jcvi) with the
  [LAST](https://gitlab.com/mcfrith/last) aligner
- Or, in place of jcvi, an existing
  [MCScanX](https://github.com/wyp1125/MCScanX) run:
  [converting one](#coming-from-mcscanx) needs only python3
- `samtools`, htslib (`bgzip`, `tabix`), `wget`
- `node`, for the [JBrowse CLI](/docs/cli)
- A running JBrowse instance (the [web quickstart](/docs/quickstart_web) or the
  [desktop quickstart](/docs/quickstart_desktop))

On Debian/Ubuntu, `apt install samtools tabix wget last-align` covers the
aligner and the file tools; jcvi installs with `pip install jcvi` and `node`
comes from [nodejs.org](https://nodejs.org/).

## What MCScan compares

MCScan works through the two genomes' gene annotations rather than their
sequence, which is what lets it find synteny between species too divergent to
line up base by base with [minimap2](/docs/tutorials/synteny_visualization). The
trade is resolution: an anchor is a gene pair, so there is no CIGAR and nothing
to draw below the level of a gene.

For three or more genomes from one MCScan run, see
[ortholog tables](/docs/tutorials/multiway_synteny_grape_peach_cacao), which
loads a `.blocks` table with one track backing every band.

## The two files

`.anchors` is the gene-pair level. Each line is one orthologous pair and its
alignment score, with `###` separating synteny blocks:

```
###
VIT_201s0011g00070.1	Prupe.1G290900.1	1430
VIT_201s0011g00080.1	Prupe.1G290800.1	446
VIT_201s0011g00090.1	Prupe.1G290700.1	147
```

`.anchors.simple` is the same run reduced to one line per block: the first and
last gene of the block on each side, a score, and the block's orientation:

```
VIT_201s0011g00070.1	VIT_201s0011g00910.1	Prupe.1G281700.1	Prupe.1G290900.1	149	-
VIT_201s0011g02000.1	VIT_201s0011g02280.2	Prupe.1G345900.1	Prupe.1G348100.1	53	-
VIT_201s0011g02300.1	VIT_201s0011g02530.1	Prupe.1G299800.1	Prupe.1G303200.1	39	+
```

The adapter turns those four gene ids into one feature spanning the block on
each genome, so `.anchors.simple` draws one ribbon per block where `.anchors`
draws one per gene pair. Neither file carries coordinates, which is what the BED
files are for.

<Figure src="/img/mcscan_synteny/anchors_vs_simple.png" links="Gene pairs=mcscan_synteny/anchors,Blocks=mcscan_synteny/anchors_simple" caption="A run of MCScan blocks on grape chr9 against peach Pp03. Top: .anchors alone, one ribbon per orthologous gene pair. Bottom: both files on the same band, so each block is the bundle of pairs it was reduced from." />

### BED files

One BED per genome, prepared from its GFF3 before the ortholog run. Only the
first six columns are read, and column 4 must match the anchor gene ids byte for
byte:

```
chr1	12836	26777	VIT_201s0011g00010.1	0	+
chr1	33170	35791	VIT_201s0011g00030.1	0	+
```

Column 1 must use the same reference sequence names as the JBrowse assembly.

Which mismatches are loud and which are silent is the
[adapters' own gotcha](/docs/config_guides/synteny_track#gene-ids-are-the-join-in-the-mcscan-adapters).
The one that bites this pipeline is jcvi stripping isoform suffixes unless run
with `--no_strip_names`, which is why the [script](#reproduce-it-end-to-end)
passes it: strip them on one side only and no row resolves at all.

## Producing the data

One jcvi command writes both anchor files and the BEDs are prepared from each
GFF3 beforehand:

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

That leaves `grape.peach.anchors` and `grape.peach.anchors.simple` in the
working directory. The adapters read anchors and BED files plain or gzipped.

## Loading both tracks

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

The simple-anchors track is the same shape with the adapter type and file
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

Both BEDs are `jbrowse add-track` flags, which is the CLI tab on each block
above: `--bed1` and `--bed2` beside the anchors file, and `--load copy` copies
all three into the config's directory.

Both adapters read the whole file into memory, which is fine at MCScan's scale
and is why there is no indexed variant the way PAF has
[PIF](/docs/config_guides/synteny_track).

## Using both at once

The two tracks describe the same run at different granularity. Add a linear
synteny view (**Add → Linear synteny view**), pick peach and grape, and turn on
both.

<Figure caption="Peach and grape with both MCScan tracks loaded. The ribbons between the panels are the per-gene .anchors pairs; the strand-colored bars inside each panel are the .anchors.simple blocks. The marks along the top of the band are anchors whose grape gene is on a chromosome this panel is not showing. Most of this peach chromosome has counterparts elsewhere in grape." src="/img/mcscan_anchors.png" />

The block track is drawn here as an `LGVSyntenyDisplay`: a synteny track in an
ordinary linear genome view row, drawn as features rather than a ribbon band.
The `displays` array no `add-track` flag covers, so this goes in with
`jbrowse add-track-json`, which copies no data files.

```json
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
      "displayId": "grape_peach_anchors_simple-LGVSyntenyDisplay",
      "height": 60
    }
  ]
}
```

Read the two together: a bar says a block is there and which way round it runs,
and the ribbons above it say whether the genes inside hold their order.

## What an anchor looks like up close

Zoom to one block with both gene tracks on and set to **Show only genes**, and
the unit the file is made of is on screen.

<Figure caption="One MCScan block on grape chr19 against peach Pp04, both gene tracks set to Show only genes. Each ribbon is one .anchors line drawn across each gene's own extent; the genes between them have no anchor in this run." src="/img/mcscan_synteny/gene_level.png" />

Most genes in these windows carry no ribbon, the ordinary case inside a block:
MCScan anchors what it could pair confidently and says nothing about the rest.
Zooming further only widens the ribbons, since the file has nothing finer to say
than which gene pairs with which.

## The same anchors as a dotplot

Either track also loads in a dotplot (**Add → Dotplot view**), where a gene pair
is one point and a block is a run of them. The axes start in each assembly's
index order, which scatters the runs; **Re-order chromosomes** sorts the
vertical axis to follow the horizontal one, using the alignments themselves.

<Video src="/media/synteny/dotplot_reorder.mp4" caption="The axes as they open, in each assembly's own index order, and then re-sorted: the reorder is a dialog off the dotplot header's overflow menu, and it reports how many grape chromosomes it moved and how many it flipped." />

<Figure caption="Grape against peach after Re-order chromosomes, every point one orthologous gene pair from the .anchors file. Each run of points is one MCScan block." src="/img/mcscan_synteny/dotplot.png" />

Reordering puts each peach chromosome's strongest grape partner on the diagonal
and leaves its other partners off it, which is a property of these genomes
rather than of the ordering. The [script](#reproduce-it-end-to-end) reads that
off `.anchors.simple` directly, printing per peach chromosome the grape
chromosomes it shares blocks with and the anchors each pairing carries; every
one of the eight answers to several. Both genomes descend from the ancestral
eudicot hexaploidy (Jaillon et al.) and have rearranged differently since, so a
one-to-one dotplot was never available to order into.

## Coming from MCScanX

[MCScanX](https://github.com/wyp1125/MCScanX) is a different program from jcvi's
MCScan and neither adapter reads its output as it stands: it writes one
`.collinearity` holding every block it found, self-synteny and cross-species
together, telling the genomes apart only by the two-letter tag it requires on
each chromosome name.
[`mcscanx_to_anchors.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/mcscanx_to_anchors.py)
splits a run into the same four files jcvi writes, in place of the
[jcvi step](#producing-the-data):

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/mcscanx_to_anchors.py
python3 mcscanx_to_anchors.py --gff xyz.gff --collinearity xyz.collinearity \
  --species vv=grape --species pp=peach --strand-gff3 peach=peach.gff3.gz
```

That writes the four files the track configs [above](#loading-both-tracks) load
unchanged. `--species` order is the anchors column order, so it has to match the
track's `assemblyNames`. Two options decide whether the result draws:

- `--chr-prefix peach=Pp0` prepends to the refNames, and `--keep-chr-tag` leaves
  MCScanX's tag on them. The tag is stripped by default (`vv1` becomes `1`),
  being a requirement of MCScanX rather than a name the assembly knows.
- `--strand-gff3 peach=peach.gff3.gz` recovers strand from the annotation the
  MCScanX input came from. Without it every BED row is `+` and no `.anchors`
  pair draws as inverted. Block orientation is unaffected either way, being
  taken from the collinearity block header.

`--fai peach=peach.fa.fai` checks the refNames against the assembly rather than
leaving you to find out in the browser, where a name it does not have draws
empty instead of erroring. Scores are converted too, an anchors score becoming
`-log10` of MCScanX's e-value where jcvi writes a bit score.

Naming a third `--species` writes an ortholog table instead, since one
`.collinearity` covers every pair. See
[ortholog tables](/docs/tutorials/multiway_synteny_grape_peach_cacao#from-mcscanx).

### A genome against itself

MCScanX is as often run on one genome to find its own duplicated blocks, the
case the two-genome conversion discards. Name a single `--species` and the
script keeps those blocks instead:

```bash
python3 mcscanx_to_anchors.py --gff grape.gff --collinearity grape.collinearity \
  --species vv=grape --strand-gff3 grape=grape.gff3.gz
```

The anchor files that writes name grape on both sides, so the track lists the
assembly twice and both rows of the synteny view are the same genome:

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "grape_self_anchors",
  "name": "Grape duplicated blocks (MCScanX)",
  "assemblyNames": ["grape", "grape"],
  "adapter": {
    "type": "MCScanAnchorsAdapter",
    "uri": "grape.grape.anchors",
    "bed1": "grape.bed",
    "bed2": "grape.bed",
    "assemblyNames": ["grape", "grape"]
  }
}
```

Both copies of a block are served, so either one draws its link to the other. A
dotplot of the track puts the genome on both axes, each duplicated block a run
of points away from the diagonal, and no diagonal itself, since a gene is not
its own anchor.

## Reproduce it end to end

[`build_grape_peach_anchors.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_grape_peach_anchors.sh)
runs everything above in one shot: the grape and peach genomes from Ensembl
Plants, the jcvi ortholog pipeline, and a `config.json` with both assemblies,
gene tracks, both MCScan tracks and a default session opening them together.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_grape_peach_anchors.sh
bash build_grape_peach_anchors.sh
npx --yes serve grape_peach_anchors_build/jbrowse2  # then open the printed URL
```

Its gene ids differ from the samples above, which come from a Phytozome
annotation of the same two genomes. The pipeline is identical; the ids are
whatever the GFF3 carried.

## See also

- [](/docs/tutorials/synteny_visualization)
- [](/docs/tutorials/multiway_synteny_grape_peach_cacao)
- [](/docs/user_guides/linear_synteny_view)
- [](/docs/config_guides/synteny_track)
- [](/docs/config/mcscananchorsadapter)
- [](/docs/config/mcscansimpleanchorsadapter)

## References

- Tang et al. (2008).
  [Unraveling ancient hexaploidy through multiply-aligned angiosperm gene maps](https://doi.org/10.1101/gr.080978.108),
  the MCScan method jcvi implements
- Jaillon et al. (2007).
  [The grapevine genome sequence suggests ancestral hexaploidization in major angiosperm phyla](https://doi.org/10.1038/nature06148)
