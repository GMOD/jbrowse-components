---
title: Synteny visualization (MCScan anchors)
sidebar_label: Synteny (MCScan anchors)
description:
  Load a pairwise jcvi MCScan run as gene-level and block-level synteny tracks
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
- `samtools`, htslib (`bgzip`, `tabix`), `wget`
- `node`, for the [JBrowse CLI](/docs/cli)
- A running JBrowse instance (the [web quickstart](/docs/quickstart_web) or the
  [desktop quickstart](/docs/quickstart_desktop))

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
each genome, so `.anchors.simple` draws as solid blocks where `.anchors` draws
as a fan of per-gene ribbons. Neither file carries coordinates: the gene ids are
whatever your annotation used, and the BED files are what resolve them.

### BED files

jcvi writes one BED per genome alongside the anchors. Only the first six columns
are read, and column 4 must match the anchor gene ids byte for byte:

```
chr1	12836	26777	VIT_201s0011g00010.1	0	+
chr1	33170	35791	VIT_201s0011g00030.1	0	+
```

Column 1 must use the same reference sequence names as the JBrowse assembly.

Both MCScan anchor adapters **throw** on an id that isn't in the BED, so a
mismatch surfaces as a track error rather than an empty view. Ids get mangled by
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

```json
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
  }
}
```

Neither `bed1`/`bed2` is expressible as a `jbrowse add-track` flag, so these go
in with `jbrowse add-track-json`, which inserts a full track config verbatim.
Unlike `add-track` it does not copy data files, so put the anchors and BEDs
where their `uri`s point, or reference them by URL.

Both adapters read the whole file into memory. That is fine at MCScan's scale,
where a whole-genome anchor set is a small text file, but it is why there is no
indexed variant the way PAF has [PIF](/docs/config_guides/synteny_track).

## Using both at once

The two tracks describe the same run at different granularity, so putting both
in one view is the useful arrangement rather than a duplicate. Add a linear
synteny view (**Add → Linear synteny view**), pick peach and grape, and turn on
both tracks.

<Figure caption="Peach and grape with both MCScan tracks loaded. The ribbons between the panels are the per-gene .anchors pairs; the strand-colored bars inside each panel are the .anchors.simple blocks, red where the block is collinear and blue where it is inverted." src="/img/mcscan_anchors.png" />

The block track is shown here as an `LGVSyntenyDisplay`, a synteny track dropped
into an ordinary linear genome view row and drawn as features rather than as a
ribbon band. Set that up by adding the track to a panel and picking the display
type, or declaratively:

```json
{
  "trackId": "grape_peach_anchors_simple",
  "type": "LGVSyntenyDisplay",
  "height": 60
}
```

Reading the two together is the point: a bar tells you a block is there and
which way round it runs, and the ribbons above it show whether the genes inside
it hold their order. Strand is the `LGVSyntenyDisplay` **Color by** default; the
menu offers the other modes.

## Reproduce it end to end

[`build_grape_peach_anchors.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_grape_peach_anchors.sh)
runs everything above in one shot. It downloads the grape and peach genomes from
Ensembl Plants, runs the jcvi ortholog pipeline, downloads JBrowse, and writes a
`config.json` with the two assemblies, gene tracks, both MCScan tracks, and a
default session opening them together.

```bash
bash scripts/build_grape_peach_anchors.sh
npx --yes serve grape_peach_anchors_build/jbrowse2  # then open the printed URL
```

Its gene ids differ from the samples above, which come from a Phytozome
annotation of the same two genomes. The pipeline is identical; the ids are
whatever the GFF3 carried.

## See also

- [Synteny visualization (pairwise minimap2)](/docs/tutorials/synteny_visualization)
- [Synteny visualization (ortholog tables)](/docs/tutorials/multiway_synteny)
- [](/docs/user_guides/linear_synteny_view)
- [Synteny track config guide](/docs/config_guides/synteny_track)
- [MCScanAnchorsAdapter config](/docs/config/mcscananchorsadapter)
- [MCScanSimpleAnchorsAdapter config](/docs/config/mcscansimpleanchorsadapter)
