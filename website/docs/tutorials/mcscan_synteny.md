---
title: Synteny visualization (MCScan anchors)
sidebar_label: Synteny (MCScan anchors)
description:
  Load a pairwise jcvi MCScan run as gene-level and block-level synteny tracks,
  and convert an MCScanX run into the same files
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
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

## Why MCScan rather than a whole-genome aligner

Unlike [pairwise minimap2](/docs/tutorials/synteny_visualization), which aligns
sequence to sequence, MCScan compares two genomes through their gene
annotations, so it still finds synteny between species too divergent for a
whole-genome aligner to line up base by base. The cost is resolution: an anchor
is a gene pair, so there is no CIGAR and nothing to draw below the gene.

For three or more genomes from one MCScan run, see
[ortholog tables](/docs/tutorials/multiway_synteny), which loads a `.blocks`
table with one track backing every band.

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
draws one per gene pair. Neither file carries coordinates: the gene ids are
whatever your annotation used, and the BED files are what resolve them.

<Figure src="/img/mcscan_synteny/anchors_vs_simple.png" links="Gene pairs=mcscan_synteny/anchors,Blocks=mcscan_synteny/anchors_simple" caption="A run of MCScan blocks on grape chr9 against peach Pp03. Top: .anchors alone, one ribbon per orthologous gene pair. Bottom: both files on the same band, the .anchors.simple block ribbons pale underneath and their gene pairs drawn over them, so each block is the bundle of pairs it was reduced from." />

### BED files

One BED per genome, prepared from its GFF3 before the ortholog run. Only the
first six columns are read, and column 4 must match the anchor gene ids byte for
byte:

```
chr1	12836	26777	VIT_201s0011g00010.1	0	+
chr1	33170	35791	VIT_201s0011g00030.1	0	+
```

Column 1 must use the same reference sequence names as the JBrowse assembly.

A row naming a gene neither BED carries is dropped, so a partial mismatch draws
fewer ribbons than the file holds rather than erroring; a file where no row
resolves at all fails the track, naming the two BED slots. Ids get mangled by
isoform suffixes and by jcvi stripping suffixes unless run with
`--no_strip_names`, which is why the [script](#reproduce-it-end-to-end) passes
it.

## Producing the data

One jcvi command writes both anchor files and the BEDs are prepared from each
GFF3 beforehand:

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

Both adapters read the whole file into memory. That is fine at MCScan's scale,
where a whole-genome anchor set is a small text file, but it is why there is no
indexed variant the way PAF has [PIF](/docs/config_guides/synteny_track).

## Using both at once

The two tracks describe the same run at different granularity, so they
complement each other in one view. Add a linear synteny view (**Add → Linear
synteny view**), pick peach and grape, and turn on both tracks.

<Figure caption="Peach and grape with both MCScan tracks loaded. The ribbons between the panels are the per-gene .anchors pairs; the strand-colored bars inside each panel are the .anchors.simple blocks, red where the block is collinear and blue where it is inverted." src="/img/mcscan_anchors.png" />

The block track is shown here as an `LGVSyntenyDisplay`, a synteny track dropped
into an ordinary linear genome view row and drawn as features rather than as a
ribbon band. Set that up by adding the track to a panel and picking the display
type, or declaratively. This is the simple-anchors config again with a
`displays` array, which no `add-track` flag covers, so it goes in with
`jbrowse add-track-json`: that inserts a config verbatim and copies no data
files, so the anchors and BEDs have to already sit where their `uri`s point.

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

Read the two together: a bar states that a block is there and which way round it
runs, and the ribbons above it show whether the genes inside it hold their
order. Strand is the `LGVSyntenyDisplay` **Color by** default, and the menu
offers the other modes.

## What an anchor looks like up close

At whole-chromosome zoom a ribbon is a hairline. Zoom to one block, turn each
genome's gene track on and set it to **Show only genes**, and the unit the file
is made of is on screen: one ribbon per `.anchors` line, spanning the gene it
starts from and the gene it ends at.

<Figure caption="One MCScan block on grape chr19 against peach Pp04, both gene tracks set to Show only genes. Each ribbon is one .anchors line, one grape gene to one peach gene, drawn across each gene's own extent. The genes between them have no anchor in this run, so nothing is drawn for them." src="/img/mcscan_synteny/gene_level.png" />

Most of the genes in these two windows carry no ribbon, which is the ordinary
case inside a block: MCScan anchors the ones it could pair confidently and says
nothing about the rest. This is also the resolution limit from the top of the
page made concrete. Zooming further widens the ribbons and adds nothing, because
the anchors file has nothing finer to say than which gene pairs with which.

## The same anchors as a dotplot

Either anchor track also loads in a dotplot (**Add → Dotplot view**, then pick
it in Quick start), where a gene pair is one point and a synteny block is a run
of them.

The two axes start in the order each assembly's index has, which for 19 grape
chromosomes against 8 peach ones scatters the runs over the plot. **Re-order
chromosomes** in the view menu sorts the vertical axis to follow the horizontal
one, using the alignments themselves.

<Figure caption="Grape against peach after Re-order chromosomes, every point one orthologous gene pair from the .anchors file. Each run of points is one MCScan block, and a peach column crossing several grape rows is one peach chromosome matching several grape ones." src="/img/mcscan_synteny/dotplot.png" />

Reordering puts each peach chromosome's strongest grape partner on the diagonal
and leaves the rest of its partners off it, which is a property of these two
genomes rather than of the ordering. The [script](#reproduce-it-end-to-end)
reads that off the `.anchors.simple` file directly: for each peach chromosome it
prints the grape chromosomes it shares blocks with and how many anchors each
pairing carries, and every one of the eight answers to several. Both genomes
descend from the ancestral eudicot hexaploidy (Jaillon et al.) and have
rearranged differently since, so a one-to-one dotplot was never available to
order into.

## Coming from MCScanX

[MCScanX](https://github.com/wyp1125/MCScanX) is a different program from jcvi's
MCScan and neither adapter reads its output as it stands. It writes one
`.collinearity` file holding every block it found, self-synteny and
cross-species together, and tells the genomes apart only by the two-letter tag
it requires on each chromosome name in its `.gff`.

[`mcscanx_to_anchors.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/mcscanx_to_anchors.py)
splits a run into the same four files jcvi writes, in place of the
[jcvi step](#producing-the-data):

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/mcscanx_to_anchors.py
python3 mcscanx_to_anchors.py --gff xyz.gff --collinearity xyz.collinearity \
  --species vv=grape --species pp=peach --strand-gff3 peach=peach.gff3.gz
```

That writes `grape.bed`, `peach.bed`, `grape.peach.anchors` and
`grape.peach.anchors.simple`, which the track configs
[above](#loading-both-tracks) load unchanged. `--species` is given twice, and
its order is the anchors column order, so it has to match the track's
`assemblyNames`.

Two options decide whether the result draws:

- `--chr-prefix peach=Pp0` prepends to the refNames, and `--keep-chr-tag` leaves
  MCScanX's tag on them. The tag is stripped by default (`vv1` becomes `1`),
  because it is a requirement of MCScanX rather than a name the assembly knows,
  and BED column 1 has to match the assembly byte for byte.
- `--strand-gff3 peach=peach.gff3.gz` recovers strand from the annotation the
  MCScanX input came from. MCScanX's `.gff` has no strand column, so without it
  every BED row is `+` and no `.anchors` pair draws as inverted. Block
  orientation is unaffected either way: `.anchors.simple` takes it from the
  plus/minus on the collinearity block header.

Pass `--fai peach=peach.fa.fai` to have the refNames checked against the
assembly rather than finding out in the browser: a name the assembly does not
have resolves to nothing, so the track draws empty instead of erroring. The
script names the mismatched sequences and what the assembly does have.

Scores are converted too, since the two formats mean different things by that
column: an anchors score becomes `-log10` of MCScanX's e-value, where jcvi
writes a bit score, and a simple row is scored with the block's anchor count, as
jcvi scores it.

A MCScanX run of three or more genomes is one `.collinearity` covering every
pair, so naming a third `--species` writes an ortholog table instead of the
anchor files. See
[ortholog tables](/docs/tutorials/multiway_synteny#from-mcscanx), which stacks
those genomes in one view.

### A genome against itself

MCScanX is as often run on one genome to find its own duplicated blocks, which
is the case the two-genome conversion above discards. Name a single `--species`
and the script keeps those blocks instead:

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

Both copies of a block are served, so either one draws its link to the other
wherever you are looking. A dotplot of the track puts the genome on both axes,
where each duplicated block is a run of points away from the diagonal: there is
no diagonal itself, since a gene is not its own anchor.

## Reproduce it end to end

[`build_grape_peach_anchors.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_grape_peach_anchors.sh)
runs everything above in one shot. It downloads the grape and peach genomes from
Ensembl Plants, runs the jcvi ortholog pipeline, downloads JBrowse, and writes a
`config.json` with the two assemblies, gene tracks, both MCScan tracks, and a
default session opening them together.

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
- [](/docs/tutorials/multiway_synteny)
- [](/docs/user_guides/linear_synteny_view)
- [Synteny track config guide](/docs/config_guides/synteny_track)
- [MCScanAnchorsAdapter config](/docs/config/mcscananchorsadapter)
- [MCScanSimpleAnchorsAdapter config](/docs/config/mcscansimpleanchorsadapter)

## References

- Tang et al. (2008).
  [Unraveling ancient hexaploidy through multiply-aligned angiosperm gene maps](https://doi.org/10.1101/gr.080978.108),
  the MCScan method jcvi implements
- Jaillon et al. (2007).
  [The grapevine genome sequence suggests ancestral hexaploidization in major angiosperm phyla](https://doi.org/10.1038/nature06148)
