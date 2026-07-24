---
title: Pangenome (HPRC)
description:
  Stream HPRC release 2's pangenome VCF off S3, cluster 464 haplotypes at a
  locus, and open the same region as a graph
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
---

[HPRC release 2](https://doi.org/10.64898/2026.07.21.739710) is roughly a
fivefold expansion over release 1, and two of its products open in a browser
with no preprocessing: the variant callset and the graph itself.

This tutorial takes both routes. First the VCF, streamed straight off S3 as a
genotype matrix across 464 haplotypes, clustered, and painted by inferred
ancestry. Then the graph, where any locus opens as a subgraph from the track
menu.

## What release 2 publishes

`pangenomes/freeze/release2/minigraph-cactus/` holds these per reference (a
GRCh38 and a T2T-CHM13 build; everything below uses GRCh38):

| File                | Size   | What it is                                   |
| ------------------- | ------ | -------------------------------------------- |
| `*.gfa.gz`          | 63 GB  | the base-level graph                         |
| `*.gbz`             | 5.4 GB | the same graph in vg's indexed format        |
| `*.sv.gfa.gz`       | 842 MB | SV-resolution subset, and an rGFA            |
| `*.wave.vcf.gz`     | 2.3 GB | every variant, decomposed, **tabix-indexed** |
| `*.wave.vcf.gz.tbi` | 2.2 MB | the index, published beside it               |

The VCF needs nothing: the index ships beside it, so JBrowse reads a 50 kb slice
from the middle of the 2.3 GB file without downloading the rest. The `sv.gfa` is
the graph route, and the reason it works is covered
[below](#the-graph-hides-under-minigraph-cactus).

HPRC release 3 has no graphs at all (it is the verkko assembly and QC release).

## Load the variants

Paste the S3 URL into a `VariantTrack`:

```json
{
  "type": "VariantTrack",
  "trackId": "hprc2_wave_grch38",
  "name": "HPRC2 pangenome",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/hprc-v2.0-mc-grch38.wave.vcf.gz"
  },
  "displays": [
    {
      "type": "LinearMultiSampleVariantMatrixDisplay",
      "displayId": "hprc2_wave_grch38_matrix",
      "renderingMode": "phased"
    }
  ]
}
```

`renderingMode: "phased"` is the setting that matters. The VCF carries 232
samples, **all phased**, so phased mode splits each sample into its two
haplotypes: 464 independent rows instead of 232 diploid ones. Co-inherited
blocks become visible only once the haplotypes are separated.

The contig names are plain GRCh38 (`chr6`, not `GRCh38#0#chr6`), so the track
loads onto an ordinary hg38 assembly with no renaming.

## Look at the MHC

The MHC class II region carries about **66 variants per kilobase** here. A 50 kb
window is a few thousand variant columns, and against 464 haplotype rows that is
over a million genotype cells drawn at once.

<Figure caption="The HPRC2 pangenome VCF as a genotype matrix at chr6:32,550,000-32,600,000. 464 haplotype rows against a few thousand variant columns: blue non-reference, grey reference, yellow no-call. Long horizontal runs of shared allele state are the visible haplotype structure." src="/img/hprc2/mhc_matrix.png" />

Matrix mode lays out one column per variant regardless of spacing, which makes a
dense locus legible. The regular display draws each variant at its true genomic
position, so allele lengths stay honest:

<Figure caption="The same track in regular (positional) mode at chr6:32,480,000-32,530,000, so alleles keep their true span. Almost the whole window is blue: nearly every haplotype is non-reference here. Red marks third and further alleles." src="/img/hprc2/mhc_regular.png" />

Across `chr6:32,500,000-32,600,000`, 25 sites carry more than ten alternate
alleles: concrete evidence that one reference represents this locus poorly.

## Cluster the haplotypes

The banding is suggestive; clustering confirms it. From the track menu:

**Track menu > Cluster by genotype... > Run clustering**

The rows reorder by genotype similarity and a dendrogram appears beside them.
Clustering 464 haplotypes over a few thousand variants runs in the worker, so
the view stays responsive.

<Figure caption="The same window with the 464 haplotype rows clustered by genotype and a dendrogram in the sidebar. The diffuse banding of the previous figure resolves into discrete blocks, including one all-yellow group with no calls at all." src="/img/hprc2/mhc_clustered.png" />

The yellow block is worth noting. These are not missing data in the usual sense:
they are haplotypes divergent enough that the graph build declined to align them
to the reference here, so "no call" is itself the finding.

## Other loci in the callset

All GRCh38, with the variant density measured in this VCF:

| Locus     | Region                        | Variants/kb |
| --------- | ----------------------------- | ----------- |
| KIR       | `chr19:54,720,000-54,870,000` | 70.6        |
| MHC / HLA | `chr6:32,400,000-32,700,000`  | 66.5        |
| UGT2B17   | `chr4:68,530,000-68,680,000`  | 23.6        |
| HBA       | `chr16:130,000-185,000`       | 23.3        |
| CYP2D6    | `chr22:42,120,000-42,140,000` | 20.2        |

KIR, not the MHC, is the densest of these per kilobase.

## Paint every haplotype by ancestry

The VCF is not the only release 2 product that needs no preprocessing. PCLAI
local-ancestry calls ship as **one BED per haplotype**, 463 of them, already on
GRCh38. The `itemRgb` column holds a color interpolated from the PCA ancestry
space, and the score column a per-window confidence.

`LinearMultiRowFeatureDisplay` wants the opposite shape: one file with a column
naming each feature's row.
[`scripts/build_hprc2_pclai.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_hprc2_pclai.sh)
fetches both haplotype BEDs for a sample count you pick, keeps the columns the
painting needs, tags each row with its haplotype, and writes a single bgzipped,
tabixed BED. Its arguments are output directory, chromosome, and sample count,
so this writes the 64 haplotype rows of the figure below:

```bash
bash scripts/build_hprc2_pclai.sh out chr1 32
```

```json
{
  "type": "FeatureTrack",
  "trackId": "hprc2_pclai_painting",
  "name": "HPRC2 local ancestry (PCLAI)",
  "assemblyNames": ["hg38"],
  "adapter": { "type": "BedTabixAdapter", "uri": "hprc2_pclai_chr1.bed.gz" },
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "displayId": "hprc2_pclai_painting-LinearMultiRowFeatureDisplay",
      "partitionField": "sample"
    }
  ]
}
```

`partitionField` assigns each feature to a row, and `rowHeight` defaults to
auto-fit, so adding haplotypes shrinks the rows instead of overflowing the
track. Keep the file at 10 columns: named BED fields apply only at exactly 12,
so at this width the color lands in `field8` where the automatic color path
finds it. A BED12 turns the painting a flat palette color.

<Figure caption="64 HPRC2 haplotypes painted along chr1 by PCLAI local ancestry, one row per haplotype, colored by the published per-window PCA color. Most rows hold a single color end to end; a few (HG01167, HG01243, HG01433) switch color repeatedly along the chromosome. Each color change is a recombination breakpoint between differently-inferred segments." src="/img/hprc2/local_ancestry.png" />

There is no color key: the palette is a continuous interpolation of PCA
position, not labeled categories.

## The graph hides under Minigraph-Cactus

The [pangenome graph tutorial](/docs/tutorials/pangenome_ecoli) cuts subgraphs
offline with `odgi extract`. On this graph you can skip that step and open any
locus as a graph from the track menu, but only because the file carries
coordinates on its segments, which only
[rGFA](https://github.com/lh3/gfatools/blob/master/doc/rGFA.md) does.

Release 2 ships no `minigraph/` directory, and searching
[hpp_pangenome_resources](https://github.com/human-pangenomics/hpp_pangenome_resources)
for "rGFA" finds nothing, so it looks as though the graph route needs release 1.
It does not. The `sv.gfa` in the table above comes from the Minigraph-Cactus
graph's minigraph stage, so every segment carries rGFA tags:

```
S  s3  TTGCAA  LN:i:6  SN:Z:GRCh38#0#chr1  SO:i:10621  SR:i:0
```

Those three tags are the whole of the
[spec](https://github.com/lh3/gfatools/blob/master/doc/rGFA.md), and the
[E. coli tutorial](/docs/tutorials/pangenome_ecoli#rgfa-graphs-carry-their-own-coordinates)
walks through them. "rGFA" names a tag convention, not a separate format or
output mode, which is why the release never labels a file with it.

Three things to know before you start:

- The stable names are [PanSN](https://github.com/pangenome/PanSN-spec)
  (`GRCh38#0#chr1`), so the track needs
  `assemblyNameToPanSN: { "hg38": "GRCh38" }` to tie an `hg38` assembly to the
  graph's sample prefix. The prefix disambiguates: the same graph also carries
  `CHM13#0#chr1`. A graph built by minigraph alone usually has bare stable names
  (`chr1`) and needs no mapping. Note the VCF above needs no such mapping, since
  its contigs are plain GRCh38.
- The **full** `hprc-v2.0-mc-grch38.gfa.gz` (63 GB) is base-level. Use the
  `sv.gfa` instead: the same graph at structural-variant resolution, both
  indexable and legible.
- pggb graphs carry no segment coordinates, so they keep the `odgi extract`
  route from the other tutorial. Nothing converts them; the coordinates were
  never recorded.

The paper also describes **GRef coordinates**, "equivalent to rGFA, except
computed post-hoc". They are not interchangeable here: rGFA tags each segment
during construction, while GRef computes a path cover afterwards and stores it
as named reference contigs, closer to the GRC's alt contigs. `RgfaTabixAdapter`
reads tags, so it takes the `sv.gfa` directly but would need a conversion for a
GRef cover. GRef's value is the part `sv.gfa` omits: computed on the full
base-level graph, it can address nested variation inside insertions.

## Load the graph

JBrowse reads two tabix-indexed BED projections of the graph, not the 842 MB
graph itself. We host them: point a `FeatureTrack` at the shared prefix and
download nothing. The adapter resolves `<uri>.segs.bed.gz`,
`<uri>.links.bed.gz`, and both `.tbi` files:

```json
{
  "type": "FeatureTrack",
  "trackId": "hprc_minigraph_segments",
  "name": "HPRC release 2 graph (rGFA segments)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "uri": "https://jbrowse.org/demos/hprc/hprc-v2.0-mc-grch38",
    "assemblyNameToPanSN": { "hg38": "GRCh38" }
  }
}
```

The track draws each segment where its tags say it sits, so the GRCh38 backbone
tiles the reference and the graph becomes queryable by locus.

Those hosted files are ours, not HPRC's. We ran the `sv.gfa.gz` through the
commands in the next section and put the output on `jbrowse.org`, so the data is
HPRC's and the projection is ours. The source file, its size, the exact
commands, and the build date are recorded in
[README.txt](https://jbrowse.org/demos/hprc/README.txt) beside them. Reproduce
them yourself if you would rather not take a third-party index on trust.

## Index it yourself

Build your own indexes for a different graph, or to check ours.
[`scripts/build_rgfa_tabix.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_rgfa_tabix.sh)
projects the graph to the two BED files and tabix-indexes them. It reads the
gzipped file HPRC ships, so nothing needs unpacking:

```bash
wget https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2/minigraph-cactus/hprc-v2.0-mc-grch38.sv.gfa.gz
bash scripts/build_rgfa_tabix.sh hprc-v2.0-mc-grch38.sv.gfa.gz
```

Requires [gfatools](https://github.com/lh3/gfatools) plus bgzip and tabix. On
the full 464-haplotype graph this takes about 40 seconds, peaks near 3.7 GB of
memory, and turns the 842 MB download into 50 MB of index:

| File             | Contents                                         | Size   |
| ---------------- | ------------------------------------------------ | ------ |
| `*.segs.bed.gz`  | one row per segment: stable name, span, id, rank | 6.7 MB |
| `*.links.bed.gz` | one row per link per endpoint                    | 34 MB  |
| `*.tbi`          | the two tabix indexes                            | 9.2 MB |

The first file holds 751,237 segments. The second writes one row per endpoint
and repeats both endpoints in full, because a segment's neighbour usually sits
where no query on your region reaches: an off-reference allele's `SN` is the
assembly contig it came from (`HG01433.2#2#CM086507.1`), never a GRCh38
chromosome.

## Open a locus as a graph

:::info Requires the graph genome view plugin

The graph genome view is a separate plugin,
[jbrowse-plugin-graphgenomeviewer](https://github.com/GMOD/jbrowse-plugin-graphgenomeviewer),
not bundled in JBrowse Web (its force-directed layout uses the GPL-licensed
[Bandage](https://github.com/rrwick/Bandage) engine). It is still in **beta and
not published yet**; look for it in the
[plugin store](/docs/user_guides/plugin_store) soon, as described in the
[E. coli tutorial](/docs/tutorials/pangenome_ecoli#the-graph-itself-a-local-subgraph).
The bubble and segment feature tracks below need it too only for the launch menu
item.

:::

Navigate somewhere interesting, then use the track's menu:

**Track menu > Launch view > Graph genome view (this region)**

Right-click a segment to do the same for its neighbourhood. Both open a graph
view of the local subgraph, cut from the same two files. Above 100 kb the view
declines to draw, since the layout stops being legible.

<Figure caption="The HLA class II region (chr6:32,500,000-32,560,000) of the HPRC release 2 graph. Top: the bubble track, its largest bubble running 4,046 to 78,051 bp across 91 segments. Middle: the graph's segments as a feature track, 68 GRCh38 backbone segments. Bottom: the same window as a graph, launched from that track's menu. The blue line is the rank-0 backbone at its declared offsets; every orange bar below it is an alternate allele from the 464 haplotypes." src="/img/pangenome/hprc_mhc_subgraph.png" />

The layout is read from the file, not computed by a force simulation, so it
renders in about a millisecond and the same locus always draws the same way.
Rows are the stable ranks present in the window: the whole graph ranks far
deeper than any one locus, which holds a handful.

This layout puts the x axis on GRCh38, so it aligns under a linear view of the
same window. Off-reference nodes draw at least 1.5% of the window wide, keeping
a short allele visible next to a multi-kb backbone segment; rank-0 nodes keep
their declared offsets, so the reference axis stays exact. It cannot show the
graph's _shape_: each rank is a parallel row, so a bubble reads as a pair of
stalks rather than an eye. The toolbar's **Layout** dropdown drops the axis and
lays the subgraph out like Bandage (**Force-directed layout**):

<Figure caption="The same HLA class II window in force-directed layout, with RefSeq genes and bubbles above it. The long paths off the backbone are the rank-1 alleles the bubble track summarizes as a span range, here drawn as the paths they are. The x axis means nothing here: this view shows the graph's shape, the anchored view above shows where it sits on the reference." src="/img/pangenome/hprc_mhc_bandage.png" />

Node lengths use the same per-graph Bandage scaling the
[E. coli tutorial](/docs/tutorials/pangenome_ecoli#the-graph-itself-a-local-subgraph)
describes, which here keeps a 300 bp allele and a 7 kb backbone segment in one
picture.

Loci where the graph is worth a look, all on GRCh38:

| Locus     | Region                         | Why                                                          |
| --------- | ------------------------------ | ------------------------------------------------------------ |
| MHC / HLA | `chr6:28,510,000-33,480,000`   | Allelic hyperdiversity, megabase-scale haplotype differences |
| AMY1      | `chr1:103,570,000-103,760,000` | Amylase copy number varies several-fold                      |
| C4        | `chr6:31,980,000-32,050,000`   | C4A/C4B copy number plus an HERV insertion                   |
| SMN       | `chr5:70,900,000-71,000,000`   | Near-identical SMN1/SMN2 duplication                         |
| KIR       | `chr19:54,700,000-55,100,000`  | Gene content differs between haplotypes                      |

Zoom to a few tens of kb, the scale the graph view is built for.

## The bubble track

The bubble track shows _where_ the graph varies and by how much. It runs along
the top of the figures above and is one file rather than the whole graph:

```json
{
  "type": "FeatureTrack",
  "trackId": "hprc_minigraph_bubbles",
  "name": "HPRC release 2 bubbles",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "MinigraphBubbleAdapter",
    "uri": "https://jbrowse.org/demos/hprc/hprc-v2.0-mc-grch38.bubbles.bed.gz",
    "assemblyNameToPanSN": { "hg38": "GRCh38" }
  }
}
```

A bubble is where haplotypes diverge and rejoin. The `MinigraphBubbleAdapter`
(from the graph plugin) reads the
[`gfatools bubble`](https://github.com/lh3/gfatools) columns into named feature
fields and labels each bubble with its shortest and longest allele: one bubble
in the HLA class II window above runs 4,046 to 78,051 bp depending on the
haplotype. The detail panel adds the inversion flag and both allele sequences.

Read the path count with care: it counts routes combinatorially, not haplotypes
observed, so that bubble reports over 510 million across its 91 segments, hence
"up to". gfatools saturates the count at `2147483647`. 406 of the 130,510
bubbles hit that ceiling, and the track labels them uncountable rather than
printing the sentinel.

Bubbles are coarser than the graph and do not show how segments connect, but
they are one URL.

HPRC publishes no bubble file for release 2, so the one above is also ours,
built from the same `sv.gfa.gz` and hosted beside the indexes. Build your own:

```bash
gzip -dc hprc-v2.0-mc-grch38.sv.gfa.gz \
  | gfatools bubble - \
  | sort -k1,1 -k2,2n | bgzip > hprc-v2.0-mc-grch38.bubbles.bed.gz
tabix -p bed hprc-v2.0-mc-grch38.bubbles.bed.gz
```

That takes about 25 seconds and peaks near 4 GB. The rows are PanSN-named, so
the track needs the same `assemblyNameToPanSN` mapping.

## Structure, not sequence

The graph view shows structure, not sequence. minigraph records structural
variation (roughly >50 bp) and collapses everything smaller, so SNPs are absent
from the graph even though they are all present in the VCF at the top of this
tutorial. That split is the reason to load both: the matrix for base-level
variation across haplotypes, the graph for how the sequence itself rearranges.
