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
  },
  "displayDefaults": {
    "color": "jexl:get(feature,'rank')==0?'rgb(52,152,219)':'rgb(237,137,44)'"
  }
}
```

The `color` jexl is what makes the graph and the linear view read as one
picture: it paints each segment in the graph view's own **Stable rank (rGFA)**
colors, so a segment is the same color in both panels.

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
[Bandage](https://github.com/rrwick/Bandage) engine). It is in **beta** and not
in the [plugin store](/docs/user_guides/plugin_store) yet, but it is a native ES
module and loads from any config today (see
[configuring plugins](/docs/config_guides/plugins)):

```json
{
  "plugins": [
    {
      "name": "GraphGenomeView",
      "esmUrl": "https://jbrowse.org/demos/graphgenomeviewer/jbrowse-plugin-graphgenomeviewer.esm.js"
    }
  ]
}
```

The tracks above need it too: `RgfaTabixAdapter` and `MinigraphBubbleAdapter`
ship in the same plugin.

:::

Navigate somewhere interesting, then:

**Track menu > Launch view > Graph genome view (this region)**

This opens the local subgraph, cut from the same two files, as a graph. Above
100 kb the view declines to draw, since the layout stops being legible. That
menu and the per-segment right-click are pictured in the
[E. coli tutorial](/docs/tutorials/pangenome_ecoli#opening-any-locus-without-a-slice-per-locus).

<Figure caption="The HLA class II region (chr6:32,500,000-32,560,000) of the HPRC release 2 graph in force-directed layout, with RefSeq genes (HLA-DRB5, HLA-DRB6) and the bubble track above it. The graph's shape: the backbone winds through the frame and every loop and stub hanging off it is an alternate allele from the 464 haplotypes. The segments track is colored by the same rank scheme, so its blue blocks are that blue backbone; the orange loops are the alternates, which have no GRCh38 coordinates to draw at. Node lengths use per-graph Bandage scaling, so a 300 bp allele and a 7 kb backbone segment stay in one picture." src="/img/pangenome/hprc_mhc_bandage.png" />

That is the picture the graph is really about. The toolbar's **Layout** dropdown
trades it for an **anchored** layout, which puts the x axis back on GRCh38:

<Figure caption="The same MHC subgraph, anchored. Every x is a GRCh38 coordinate, so the blue rank-0 backbone runs under the segments track that drew the same ids above it, and each allele hangs at the position it attaches to: rank 1 on the first row, the one rank-2 allele at the bottom. A bubble reads as a pair of stalks rather than an eye, and the layout takes about a millisecond." src="/img/pangenome/hprc_mhc_anchored.png" />

Loci where the graph is worth a look, all on GRCh38. Zoom to a few tens of kb,
the scale the view is built for:

| Locus     | Region                         | Why                                                          |
| --------- | ------------------------------ | ------------------------------------------------------------ |
| MHC / HLA | `chr6:28,510,000-33,480,000`   | Allelic hyperdiversity, megabase-scale haplotype differences |
| AMY1      | `chr1:103,570,000-103,760,000` | Amylase copy number varies several-fold                      |
| C4        | `chr6:31,980,000-32,050,000`   | C4A/C4B copy number plus an HERV insertion                   |
| SMN       | `chr5:70,900,000-71,000,000`   | Near-identical SMN1/SMN2 duplication                         |
| KIR       | `chr19:54,700,000-55,100,000`  | Gene content differs between haplotypes                      |

C4, from that table:

<Figure caption="C4A/C4B and CYP21A2 over 70 kb of GRCh38, with the same window's graph below: 30 nodes, 36 edges. Both panels use the rank colors, so the blue blocks above are the blue backbone winding through the graph, and the orange and crimson branches off it are the alleles that have no GRCh38 coordinates to draw at. One 1-104,702 bp bubble covers the locus in the bubbles track; the graph is what that bubble contains." src="/img/pangenome/hprc_c4_subgraph.png" />

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
      "type": "LinearMultiSampleVariantDisplay",
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
200 kb window holds over fourteen thousand records — and all but a couple of
hundred are SNPs. The structural tier is the part a pangenome adds over a
short-read callset, and it is already in this file: add the filter

```
jexl:alleleLength(feature) >= 50
```

from **Edit filters** and the same window drops to 220 alleles, each a real
insertion or deletion. (`alleleLength` is the longest allele the record
describes; a filter on `end - start` would keep only deletions, since an
insertion consumes no reference.)

That same asymmetry is why a deletion draws at its true width here but an
insertion would not: it covers no reference to be drawn across. So the display
widens each insertion cell to a marker sized by the inserted bp, labelled with
the count when the rows are tall enough, in that haplotype's own genotype color
([`showInsertionGlyphs`](/docs/config/sharedvariantdisplay/#slot-showinsertionglyphs)).
Only haplotypes carrying the allele widen, so the marker never implies a sample
has sequence it does not.

That leaves few enough alleles to draw each at its own genomic position, so they
line up with the genes above. From the track menu, **Clustering > Cluster rows
by genotype... > Run clustering** reorders the 464 haplotype rows by genotype
similarity and draws a dendrogram beside them. It runs in the worker, so the
view stays responsive:

<Figure caption="Structural alleles (50 bp and up) of chr6:32,450,000-32,650,000 across 464 HPRC2 haplotypes, clustered by genotype, under the HLA class II genes they fall in. Blue carries the allele, red a second allele at the same site, grey reference, yellow no-call. The blocks are haplotype groups sharing whole sets of insertions and deletions across HLA-DRB5/DRB6/DRB1 — the classical HLA haplotypes, recovered from the pangenome with no HLA typing involved." src="/img/hprc2/mhc_clustered.png" />

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
      "partitionField": "sample",
      "legend": [
        { "label": "Yoruba (NA19240)", "color": "rgb(0,232,178)" },
        { "label": "Kinh Vietnamese (HG02135)", "color": "rgb(255,114,53)" },
        { "label": "Iberian (HG01530)", "color": "rgb(229,161,255)" }
      ]
    }
  ]
}
```

`partitionField` assigns each feature to a row, and `rowHeight` defaults to
auto-fit, so adding haplotypes shrinks the rows instead of overflowing the
track.

The color is a continuous PCA interpolation, so the BED carries no attribute to
derive a key from and `legend` declares one instead. Its three entries name the
extremes of that space by the sample sitting at each; a color between them is a
position between them, not a fourth category.

[`build_hprc2_pclai.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_hprc2_pclai.sh)
builds your own for a chromosome and sample count you pick
(`bash build_hprc2_pclai.sh out chr1 64`); it fetches the per-haplotype BEDs,
keeps the columns the painting needs, and writes one bgzipped, tabixed file.

<Figure caption="64 HPRC2 haplotypes painted by PCLAI local ancestry over the last 39 Mb of chr1, one row per haplotype, colored by the published per-window PCA color. Every vertical edge inside a row is a switch between differently-inferred segments; 44 of the 64 haplotypes switch somewhere in this window. Rows are in file order here, so the colors interleave. The key names the three PCA extremes the palette interpolates between." src="/img/hprc2/local_ancestry.png" />

This display has its own clustering, **Clustering > Cluster rows by similarity**
in the track menu, which reorders the haplotype rows so ancestry-similar rows
sit together:

<Figure caption="The same 64-haplotype painting with the rows clustered and a dendrogram beside them. Haplotypes sharing an ancestry profile group into blocks, so the interleaved rows above sort into three bands, and the haplotypes that switch mid-window stand out against the neighbours they were grouped with." src="/img/hprc2/local_ancestry_clustered.png" />

## Reproduce it end to end

The tracks above load from files we prebuilt and host, so the tutorial needs no
pipeline. Two scripts rebuild those files, for a different graph or a different
chromosome and sample count:

```bash
bash scripts/build_rgfa_tabix.sh hprc-v2.0-mc-grch38.sv.gfa.gz out
bash scripts/build_hprc2_pclai.sh out chr1 64
```

[`build_rgfa_tabix.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_rgfa_tabix.sh)
writes the two tabix indexes `RgfaTabixAdapter` reads, straight from the gzipped
rGFA (nothing to unpack); on the full 464-haplotype graph it turns the 842 MB
download into about 50 MB of index in under a minute. It needs an **rGFA** -
`sv.gfa.gz` is one, the `.gfa.gz` beside it is not (see
[Regular GFA vs rGFA](#regular-gfa-vs-rgfa)).

[`build_hprc2_pclai.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_hprc2_pclai.sh)
fetches the per-haplotype PCLAI BEDs, keeps the columns the painting needs, and
concatenates them into one bgzipped, tabixed file. Both need htslib (`bgzip`,
`tabix`) on your `PATH`.

The provenance of the copies we host - source, size, exact commands, build
date - is in [README.txt](https://jbrowse.org/demos/hprc/README.txt) beside
them.

## Structure, not sequence

The graph view shows structure, not sequence. minigraph records structural
variation (roughly >50 bp) and collapses everything smaller, so SNPs are absent
from the graph even though they are all present in the VCF. That split is the
reason to load both: the matrix for base-level variation across haplotypes, the
graph for how the sequence itself rearranges.
