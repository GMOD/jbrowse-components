---
title: Pangenome (HPRC)
description:
  Open HPRC release 2's Minigraph-Cactus graph as a graph in the browser, then
  its 464-haplotype variant callset and per-haplotype ancestry painting, all
  with no preprocessing
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
---

[HPRC release 2](https://doi.org/10.64898/2026.07.21.739710) is roughly a
fivefold expansion over release 1, and three of its products open in a browser
with no preprocessing. This tutorial opens all three, and it leads with the one
most people come for: the pangenome graph itself, drawn as a graph. After that
the variant callset (464 haplotypes as a genotype matrix) and a per-haplotype
local-ancestry painting.

## What release 2 publishes

`pangenomes/freeze/release2/minigraph-cactus/` holds these per reference (a
GRCh38 and a T2T-CHM13 build; everything below uses GRCh38):

| File                | Size   | What it is                                   |
| ------------------- | ------ | -------------------------------------------- |
| `*.sv.gfa.gz`       | 842 MB | SV-resolution graph, and an rGFA             |
| `*.gfa.gz`          | 63 GB  | the base-level graph                         |
| `*.gbz`             | 5.4 GB | the same graph in vg's indexed format        |
| `*.wave.vcf.gz`     | 2.3 GB | every variant, decomposed, **tabix-indexed** |
| `*.wave.vcf.gz.tbi` | 2.2 MB | the index, published beside it               |

The `sv.gfa` is the graph route; the VCF is the variant route. Both open without
downloading the whole file: the VCF ships its index, and we host a small BED
projection of the graph (below). Release 3 has no graphs at all (it is the
verkko assembly and QC release), so release 2 is the one for this.

## Regular GFA vs rGFA

Only one thing makes the graph open by locus straight from the file: its
coordinates.

A **regular GFA** (what pggb, odgi, and the full base-level Minigraph-Cactus
graph emit) records no coordinates on its segments. The only reference positions
in the file live inside the P/W path lines, so you cannot look up a locus
without walking every path, and to draw a subgraph you first cut a window out of
the graph offline with `odgi extract`. That is the route the
[E. coli pangenome tutorial](/docs/tutorials/pangenome_ecoli#the-graph-itself-a-local-subgraph)
takes.

An **rGFA** (what minigraph emits) tags every segment with three fields, the
whole of the [spec](https://github.com/lh3/gfatools/blob/master/doc/rGFA.md):

```
S  s3  TTGCAA  LN:i:6  SN:Z:GRCh38#0#chr1  SO:i:10621  SR:i:0
```

`SN` is the stable sequence the segment sits on, `SO` its offset there, and `SR`
its rank (`0` on the reference backbone). So the file itself states where each
segment sits and which segments are the reference, and JBrowse can open any
locus with no extraction step.

Release 2 ships no `minigraph/` directory and never labels a file "rGFA", so it
looks as though the graph route needs release 1. It does not: the `sv.gfa` above
is the minigraph stage of the Minigraph-Cactus build, so every one of its
segments already carries these tags. "rGFA" names a tag convention, not a
separate format. (The base-level `gfa.gz` beside it does not carry them, and
neither do pggb graphs, which keep the `odgi extract` route.)

Two things follow from those PanSN stable names (`GRCh38#0#chr1`):

- The track needs `assemblyNameToPanSN: { "hg38": "GRCh38" }` to tie an `hg38`
  assembly to the graph's `GRCh38` sample prefix. The prefix disambiguates: the
  same graph also carries `CHM13#0#chr1`.
- The variant callset later in this tutorial needs no such mapping, because its
  contigs are plain GRCh38 (`chr6`, not `GRCh38#0#chr6`).

## Load the graph

JBrowse reads two tabix-indexed BED projections of the graph, not the 842 MB
graph itself. We host them, so a `FeatureTrack` pointed at the shared prefix
downloads nothing but the region in view; the adapter resolves
`<uri>.segs.bed.gz`, `<uri>.links.bed.gz`, and both `.tbi` files:

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

Each segment draws where its tags say it sits, so the GRCh38 backbone tiles the
reference and the graph becomes queryable by locus. Those hosted files are ours,
not HPRC's: we ran the `sv.gfa.gz` through
[`build_rgfa_tabix.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_rgfa_tabix.sh)
and put the output on `jbrowse.org`. The source, its size, the exact commands,
and the build date are in
[README.txt](https://jbrowse.org/demos/hprc/README.txt) beside them.

## Open a locus as a graph

:::info Requires the graph genome view plugin

The graph genome view is a separate plugin,
[jbrowse-plugin-graphgenomeviewer](https://github.com/GMOD/jbrowse-plugin-graphgenomeviewer),
not bundled in JBrowse Web (its force-directed layout uses the GPL-licensed
[Bandage](https://github.com/rrwick/Bandage) engine). It is in **beta and not
published yet**; look for it in the
[plugin store](/docs/user_guides/plugin_store) soon. The tracks above need it
only for the launch menu item.

:::

Navigate somewhere interesting, then:

**Track menu > Launch view > Graph genome view (this region)**

(or right-click a segment for its neighbourhood). This opens the local subgraph,
cut from the same two files, as a graph. Above 100 kb the view declines to draw,
since the layout stops being legible.

<Figure caption="The HLA class II region (chr6:32,500,000-32,560,000) of the HPRC release 2 graph in force-directed layout, with RefSeq genes (HLA-DRB5, HLA-DRB6) and the bubble track above it. The graph's shape: the backbone winds through the frame and every loop and stub hanging off it is an alternate allele from the 464 haplotypes. Node lengths use per-graph Bandage scaling, so a 300 bp allele and a 7 kb backbone segment stay in one picture." src="/img/pangenome/hprc_mhc_bandage.png" />

That is the picture the graph is really about. The toolbar's **Layout** dropdown
also offers an **anchored** layout that puts the x axis back on GRCh38, so the
subgraph lines up under a linear view of the same window:

<Figure caption="The same window anchored to GRCh38: the bubble track and the graph's segments as a feature track on top, the subgraph below. The blue line is the rank-0 backbone at its declared offsets; every orange bar below it is an alternate allele. Each rank is a parallel row, so a bubble reads as a pair of stalks rather than an eye, but the reference axis stays exact and the layout renders in about a millisecond." src="/img/pangenome/hprc_mhc_subgraph.png" />

Loci where the graph is worth a look, all on GRCh38. Zoom to a few tens of kb,
the scale the view is built for:

| Locus     | Region                         | Why                                                          |
| --------- | ------------------------------ | ------------------------------------------------------------ |
| MHC / HLA | `chr6:28,510,000-33,480,000`   | Allelic hyperdiversity, megabase-scale haplotype differences |
| AMY1      | `chr1:103,570,000-103,760,000` | Amylase copy number varies several-fold                      |
| C4        | `chr6:31,980,000-32,050,000`   | C4A/C4B copy number plus an HERV insertion                   |
| SMN       | `chr5:70,900,000-71,000,000`   | Near-identical SMN1/SMN2 duplication                         |
| KIR       | `chr19:54,700,000-55,100,000`  | Gene content differs between haplotypes                      |

## The bubble track

A bubble is where haplotypes diverge and rejoin; the bubble track shows _where_
the graph varies and by how much, in one file rather than the whole graph:

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

The `MinigraphBubbleAdapter` (from the graph plugin) labels each bubble with its
shortest and longest allele: one bubble in the HLA class II window above runs
4,046 to 78,051 bp depending on the haplotype. Read the path count with care: it
counts routes combinatorially, not haplotypes observed, so gfatools saturates it
at `2147483647` and the track labels those bubbles uncountable rather than
printing the sentinel. HPRC publishes no bubble file, so this one is ours too,
built with `gfatools bubble` and hosted beside the indexes.

Both the graph projection and the bubbles come from the same `sv.gfa.gz`.
[`build_rgfa_tabix.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_rgfa_tabix.sh)
builds your own indexes for a different graph, or to check ours: it reads the
gzipped file HPRC ships (nothing to unpack), and on the full 464-haplotype graph
turns the 842 MB download into about 50 MB of index in under a minute.

## The variant callset

The `wave.vcf.gz` needs nothing: its index ships beside it, so JBrowse reads
only the slice you are viewing out of the 2.3 GB file. Paste the S3 URL into a
`VariantTrack` and pick the matrix display:

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
      "renderingMode": "phased"
    }
  ]
}
```

`renderingMode: "phased"` is the setting that matters. The VCF carries 232
samples, all phased, so phased mode splits each into its two haplotypes: 464
independent rows instead of 232 diploid ones, which is what makes co-inherited
blocks visible.

The MHC class II region carries about **66 variants per kilobase** here, so a
200 kb window is over ten thousand variant columns against 464 rows, several
million genotype cells drawn at once. Matrix mode lays out one column per
variant regardless of spacing, so the density stays legible:

<Figure caption="The HPRC2 pangenome VCF as a genotype matrix across chr6:32,450,000-32,650,000. 464 haplotype rows against ~13,000 variant columns: blue non-reference, grey reference, yellow no-call. The vertical yellow band is a region many haplotypes could not be called against the reference; the fainter texture is shared haplotype allele state, which clustering (next) sharpens into blocks." src="/img/hprc2/mhc_matrix.png" />

The banding is suggestive; clustering confirms it. From the track menu,
**Cluster by genotype... > Run clustering** reorders the rows by genotype
similarity and draws a dendrogram beside them. It runs in the worker, so the
view stays responsive:

<Figure caption="The same window with the 464 haplotype rows clustered by genotype and a dendrogram in the sidebar. The diffuse banding resolves into discrete blocks, including one all-yellow group with no calls at all: haplotypes divergent enough that the graph build declined to align them to the reference here, so 'no call' is itself the finding." src="/img/hprc2/mhc_clustered.png" />

## Local ancestry (PCLAI)

The third no-preprocessing product is a per-haplotype ancestry painting.
[PCLAI](https://github.com/AI-sandbox/hprc-pclai) (Point Cloud Local Ancestry
Inference) assigns each genomic window a continuous coordinate in PCA space
rather than a discrete ancestry label, and release 2 publishes those calls as
**one BED per haplotype**, already on GRCh38, with the PCA coordinate encoded as
an interpolated color in the `itemRgb` column.

`LinearMultiRowFeatureDisplay` wants the opposite shape: one file, with a column
naming each feature's row. We provide a ready-made 64-haplotype chr1 BED so you
can load it directly:

```json
{
  "type": "FeatureTrack",
  "trackId": "hprc2_pclai_painting",
  "name": "HPRC2 local ancestry (PCLAI)",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "https://jbrowse.org/demos/hprc/hprc2_pclai_chr1.bed.gz"
  },
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "partitionField": "sample"
    }
  ]
}
```

`partitionField` assigns each feature to a row, and `rowHeight` defaults to
auto-fit, so adding haplotypes shrinks the rows instead of overflowing the
track.
[`build_hprc2_pclai.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_hprc2_pclai.sh)
builds your own for a chromosome and sample count you pick
(`bash build_hprc2_pclai.sh out chr1 64`); it fetches the per-haplotype BEDs,
keeps the columns the painting needs, and writes one bgzipped, tabixed file.

<Figure caption="64 HPRC2 haplotypes painted along chr1 by PCLAI local ancestry, one row per haplotype, colored by the published per-window PCA color. Most rows hold a single color end to end; a few switch color repeatedly along the chromosome, each change a recombination breakpoint between differently-inferred segments. There is no color key: the palette is a continuous interpolation of PCA position, not labeled categories." src="/img/hprc2/local_ancestry.png" />

The same **Cluster by genotype... > Run clustering** menu item works here too,
reordering the haplotype rows so ancestry-similar rows sit together:

<Figure caption="The same 64-haplotype painting with the rows clustered and a dendrogram beside them. Haplotypes sharing an ancestry profile group into blocks, so the continuous PCA colors sort into bands rather than the input file's order." src="/img/hprc2/local_ancestry_clustered.png" />

## Structure, not sequence

The graph view shows structure, not sequence. minigraph records structural
variation (roughly >50 bp) and collapses everything smaller, so SNPs are absent
from the graph even though they are all present in the VCF. That split is the
reason to load both: the matrix for base-level variation across haplotypes, the
graph for how the sequence itself rearranges.
