---
title: Pangenome (pggb)
description:
  Build a five-strain pggb pangenome graph and load its linear projections plus
  the graph itself in JBrowse
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
---

A pangenome graph collapses many genomes into one structure: shared sequence is
a single path that every sample walks, and where samples differ the path
branches. [pggb](https://github.com/pangenome/pggb),
[Minigraph-Cactus](https://github.com/ComparativeGenomicsToolkit/cactus/blob/master/doc/pangenome.md),
and [progressiveCactus](https://github.com/ComparativeGenomicsToolkit/cactus)
build these graphs, and [odgi](https://github.com/pangenome/odgi) manipulates
them.

## Prerequisites

- `docker`, for the pggb image, which also carries odgi
- the NCBI
  [`datasets`](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/download-and-install/)
  CLI
- `samtools`, `bedGraphToBigWig` (UCSC kentUtils)
- `python3`, htslib (`bgzip`, `tabix`), `unzip`
- `node`, for the [JBrowse CLI](/docs/cli)

The graph is built here, not downloaded.

Most of what JBrowse draws are the graph's **linear projections**: the same
graph flattened onto one reference genome's coordinates. There are four of them,
and every builder can emit all four, so a graph built with any of these tools
lands on track types you already have:

| Projection             | What it shows                                               | From the graph                                           | JBrowse track                                                      |
| ---------------------- | ----------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| All-vs-all synteny     | The blocks each pair of genomes shares                      | the wfmash all-vs-all PAF, `odgi untangle`, `halSynteny` | [synteny track](/docs/config_guides/synteny_track)                 |
| Pangenome variants     | Every difference the graph calls, across all samples        | `pggb -V`, `cactus-pangenome --vcf`, `vg deconstruct`    | [multi-sample variant track](/docs/user_guides/multivariant_track) |
| Whole-genome alignment | The multiple alignment, column by column                    | `pggb -M`, `hal2maf`                                     | [](/docs/user_guides/maf_track)                                    |
| Pangenome depth        | How many genomes cover each reference base (core/accessory) | `odgi depth`                                             | [quantitative track](/docs/config_guides/quantitative_track)       |

This tutorial builds a five-strain _E. coli_ pangenome with pggb, loads all four
projections, and draws the graph itself. It uses the same five genomes as the
[all-vs-all synteny tutorial](/docs/tutorials/allvsall_synteny), which builds
the synteny projection alone from a plain minimap2 alignment. Here that same
projection falls out of the graph, alongside the variant and MAF projections.

## Building the graph with pggb

pggb takes one FASTA of all the genomes,
[PanSN](https://github.com/pangenome/PanSN-spec)-named `sample#haplotype#contig`
so it can tell them apart. Concatenate the five strains (haplotype `1`, since
these are haploid bacterial assemblies) and index the result:

```bash
for strain in K12 Sakai CFT073 NCTC86 IAI39; do
  awk -v s="$strain" '/^>/{print ">" s "#1#chr"; next} {print}' "$strain.fa"
done > all.fa
bgzip all.fa
samtools faidx all.fa.gz
```

Then run pggb. `-V K12` decomposes the graph into a VCF against the K12 path,
and `-M` writes the multiple alignment as a MAF. The image also carries
[odgi](https://github.com/pangenome/odgi), which the subgraph, depth, and
presence sections below reuse, so wrap the `docker run` once and call it
`in_pggb`:

```bash
in_pggb() {
  docker run --rm -u "$(id -u):$(id -g)" -w /data -v "$PWD":/data \
    ghcr.io/pangenome/pggb:202603141454453ade6b "$@"
}

in_pggb pggb -i /data/all.fa.gz -o /data/pggb -n 5 -c 4 -p 90 -s 5000 -V K12 -M -t 16
```

Pinning the image to a dated build tag (rather than `:latest`) keeps the graph
reproducible.

`-n` is the number of haplotypes, `-p` the minimum alignment identity, and `-s`
the segment length. `-p 90 -s 5000` suits a bacterial pangenome.

Two flags are easy to miss. `-c, --n-mappings` is separate from `-n` and
defaults to `1`, so `-n 5` alone keeps each segment's single best match and
builds an under-connected graph that crashes smoothxg. Set it to the haplotype
count minus one. The other is `-w /data` in the wrapper, which gives the `-u`
user a writable working directory. Without it seqwish cannot write its temporary
files.

pggb runs [wfmash](https://github.com/waveygang/wfmash) (all-vs-all alignment),
[seqwish](https://github.com/ekg/seqwish) (induces the graph), and
[smoothxg](https://github.com/pangenome/smoothxg) (normalizes it), then the `-V`
and `-M` steps. The output directory holds everything the sections below load:
the graph (`*.smooth.final.gfa`), the all-vs-all PAF, the VCF, and the MAF.

## All-vs-all synteny projection

pggb's first step is a wfmash all-vs-all PAF, exactly the input the
[all-vs-all synteny tutorial](/docs/tutorials/allvsall_synteny) loads. Index it
once with `jbrowse make-pif` and load it with an
[`AllVsAllIndexedPAFAdapter`](/docs/config/allvsallindexedpafadapter), so a
range query fetches only the region in view:

```bash
cp pggb/*.alignments.wfmash.paf ecoli_pggb_ava.paf
jbrowse make-pif ecoli_pggb_ava.paf   # -> ecoli_pggb_ava.pif.gz (+ .tbi)
```

```json
{
  "type": "SyntenyTrack",
  "trackId": "ecoli_pggb_ava",
  "name": "pggb graph: all-vs-all synteny (wfmash)",
  "assemblyNames": ["K12", "Sakai", "CFT073", "NCTC86", "IAI39"],
  "adapter": {
    "type": "AllVsAllIndexedPAFAdapter",
    "uri": "ecoli_pggb_ava.pif.gz",
    "assemblyNames": ["K12", "Sakai", "CFT073", "NCTC86", "IAI39"]
  }
}
```

Stack the five strains in a linear synteny view exactly as the
[all-vs-all tutorial](/docs/tutorials/allvsall_synteny#stacking-the-genomes)
describes. The PanSN `sample#` prefix on every PAF record is how the adapter
maps a record to its strain.

<Figure caption="The graph's own all-vs-all alignment: the five strains stacked K12 to IAI39, a ribbon between each adjacent pair drawn from the wfmash PAF pggb built the graph from. Continuous diagonal ribbons are shared backbone, the crossings in the bottom band are IAI39's inversions, and the gaps are accessory sequence." src="/img/pangenome/pggb_synteny.png" />

The all-vs-all tutorial draws these same strains from a `minimap2 -c` PAF, and
the two pictures nearly agree. An independent pairwise aligner and the graph's
own input alignment place the backbone and IAI39's inversions the same way. Only
the grain differs: wfmash emits shorter segments than minimap2's `asm20` blocks,
so the same `minAlignmentLength` leaves a denser band here.

## Pangenome variants projection

`pggb -V K12` writes a VCF of every variant the graph decomposes against the K12
path, genotyped across the other four strains. Its `CHROM` is the PanSN
reference path (`K12#1#chr`), so rename it to the K12 assembly's refName
(`chr`), then bgzip and tabix:

```bash
sed 's/K12#1#chr/chr/g' pggb/*.smooth.final.K12.vcf | bgzip > ecoli_pggb.vcf.gz
tabix -p vcf ecoli_pggb.vcf.gz
```

Load it as a [`VariantTrack`](/docs/config_guides/variant_track) on K12 and pick
the multi-sample display, which draws one row per sample with each variant at
its genomic position:

```json
{
  "type": "VariantTrack",
  "trackId": "ecoli_pggb_variants",
  "name": "pggb graph: pangenome variants (vs K12)",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "ecoli_pggb.vcf.gz"
  },
  "displays": [{ "type": "LinearMultiSampleVariantDisplay" }]
}
```

Stack the MAF alignment (below) in the same window and each variant row sits
above the per-strain alignment it was decomposed from.

The [multi-sample variant track guide](/docs/user_guides/multivariant_track)
covers the matrix versus the per-position display, genotype coloring, and
clustering samples by genotype.

### Two tiers in one file

A graph VCF is nested, which an ordinary callset is not. pggb decomposes a snarl
tree, so each record carries `LV` (its level, `0` at the top) and `PS` (its
parent), and the file holds both a bubble and the variants inside it. A sixth of
the records here sit inside another one, and a few hundred span a kilobase or
more of K12.

Those wide records draw over the fine layer decomposed from them, painting a
flat block across the rows that carry them and hiding every SNP underneath. Both
figures on this page filter them out, with

```
jexl:get(feature,'end')-get(feature,'start') < 100
```

from **Edit filters** in the track menu. Invert that to read the bubble tier
instead, or filter on `LV` to pick a level of the snarl tree directly.

## Whole-genome alignment (MAF) projection

`pggb -M` writes the multiple alignment as a MAF, which JBrowse reads as a
[](/docs/config_guides/maf_track). One wrinkle: pggb orders each MAF block from
its longest path, so the block's reference row is not consistently the same
genome, whereas a MAF track projects onto a single reference. Re-root every
block on K12 (drop blocks that lack it), and rename the PanSN names to
`sample.chr` so the MAF display can split each row's species off on the `.`:

```bash
# reroot_maf.py keeps K12-containing blocks, puts K12 first (+ strand), sorts by
# K12 position, and gives each K12 row in a repeat-collapsed block its own block
python3 reroot_maf.py pggb/*.smooth.maf ecoli_pggb.maf
```

[`reroot_maf.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/reroot_maf.py)
ships with the reproducible build below. One block per reference row matters
because an index keys a block on its first row, so a repeat's second copy is
only queryable once it anchors a block of its own.

Then convert the MAF to the tabix-indexed BED the
[`MafTabixAdapter`](/docs/config/maftabixadapter) reads, one line per block
carrying that block's rows:

```bash
python3 maf_to_bed.py ecoli_pggb.maf ecoli_pggb.maf.bed
bgzip ecoli_pggb.maf.bed
tabix -p bed ecoli_pggb.maf.bed.gz
```

```json
{
  "type": "MafTrack",
  "trackId": "ecoli_pggb_maf",
  "name": "pggb graph: whole-genome alignment (MAF, vs K12)",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "MafTabixAdapter",
    "samples": ["K12", "Sakai", "CFT073", "NCTC86", "IAI39"],
    "uri": "ecoli_pggb.maf.bed.gz"
  }
}
```

<Figure caption="The graph's whole-genome alignment projected onto K12 across 60 kb: the coverage band on top, then one row per strain (K12 first), each colored where it differs from K12, with the variant calls above. A blank row is a strain with no alignment to K12 there, so accessory structure and SNP divergence read in one picture. Numbered boxes are insertions, labeled with the bases the allele adds beyond K12." src="/img/pangenome/maf.png" />

The `samples` list fixes the row order and labels. Supply an `nhLocation` Newick
tree instead to draw the rows as a dendrogram. The
[MAF track guide](/docs/user_guides/maf_track) covers the conservation band,
per-row identity, and codon view, all derived from the alignment with no extra
files.

## Pangenome depth projection (core vs accessory)

The three projections above show where the genomes differ. Depth shows how much
of the graph is shared:
[`odgi depth`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_depth.html)
counts how many paths traverse the graph under each reference base, near the
strain count over core sequence and toward 1 over K12-private accessory
sequence. odgi ships inside the pggb image.

Tile the K12 path into windows, ask odgi for each window's mean depth, rename
the PanSN path to the assembly's `chr`, and convert to bigWig with
[`bedGraphToBigWig`](https://genome.ucsc.edu/goldenPath/help/bigWig.html):

```bash
# K12 length from the concatenated FASTA index, tiled into 500 bp windows
reflen=$(awk '$1 == "K12#1#chr" {print $2}' all.fa.gz.fai)
awk -v len="$reflen" 'BEGIN{for(s=0;s<len;s+=500){e=s+500; if(e>len)e=len; print "K12#1#chr\t"s"\t"e}}' \
  > depth_windows.bed

gfa=$(ls pggb/*.smooth.final.gfa)
in_pggb odgi depth -i "/data/$gfa" -b /data/depth_windows.bed \
  | awk -v OFS='\t' '$1 == "K12#1#chr" {print "chr", $2, $3, $4}' \
  | sort -k1,1 -k2,2n > ecoli_pggb_depth.bedgraph

printf 'chr\t%s\n' "$reflen" > chrom.sizes
bedGraphToBigWig ecoli_pggb_depth.bedgraph chrom.sizes ecoli_pggb_depth.bw
```

Load it as a [`QuantitativeTrack`](/docs/config_guides/quantitative_track) on
K12:

```json addtrack
{
  "type": "QuantitativeTrack",
  "trackId": "ecoli_pggb_depth",
  "name": "pggb graph: pangenome depth (paths over K12)",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "BigWigAdapter",
    "uri": "ecoli_pggb_depth.bw"
  }
}
```

Zoomed out, the track is the pangenome's core/accessory landscape along K12: a
plateau near the strain count, dropping over the accessory stretches the variant
and MAF projections zoom into.

<Figure caption="odgi depth across all 4.64 Mb of K12. The curve sits near 5 (every strain traverses the graph there, so the sequence is core) and drops toward 1 over the accessory stretches private to fewer strains." src="/img/pangenome/depth.png" />

The troughs sit at depth 1 where no other strain traverses the graph. Those
stretches are K12's private sequence, and the gene lane names what is in them.

The peaks go the other way, reaching about twice the strain count over the rRNA
operons, which the graph collapses into a single path that each strain then
walks twice. Read the signal as relative rather than as an exact genome tally.

### Per-strain presence

The depth track sums every path into one curve.
[`odgi pav`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_pav.html)
splits it per strain: over the same K12 windows it reports the fraction of each
window that strain's path traverses, 1 where the strain is fully present and
toward 0 where the window is accessory in it. Slice each strain's rows into its
own bigWig and load the set as one
[`MultiQuantitativeTrack`](/docs/user_guides/multiquantitative_track):

```bash
# cols: chrom start end name group pav
in_pggb odgi pav -i "/data/$gfa" -b /data/depth_windows.bed > pav.tsv
for strain in Sakai CFT073 NCTC86 IAI39; do
  awk -v OFS='\t' -v g="$strain#1#chr" '$5 == g && $6 + 0 == $6 { print "chr", $2, $3, $6 }' \
    pav.tsv | sort -k1,1 -k2,2n > "ecoli_pggb_pav_$strain.bedgraph"
  bedGraphToBigWig "ecoli_pggb_pav_$strain.bedgraph" chrom.sizes "ecoli_pggb_pav_$strain.bw"
done
```

```json
{
  "type": "MultiQuantitativeTrack",
  "trackId": "ecoli_pggb_pav",
  "name": "pggb graph: per-strain presence (odgi pav, vs K12)",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "MultiWiggleAdapter",
    "subadapters": [
      {
        "type": "BigWigAdapter",
        "name": "Sakai",
        "uri": "ecoli_pggb_pav_Sakai.bw"
      },
      {
        "type": "BigWigAdapter",
        "name": "CFT073",
        "uri": "ecoli_pggb_pav_CFT073.bw"
      },
      {
        "type": "BigWigAdapter",
        "name": "NCTC86",
        "uri": "ecoli_pggb_pav_NCTC86.bw"
      },
      {
        "type": "BigWigAdapter",
        "name": "IAI39",
        "uri": "ecoli_pggb_pav_IAI39.bw"
      }
    ]
  }
}
```

Where the aggregate curve dips, this track shows which strain is missing: one
row falls to 0 over its own accessory stretch while the others hold at 1. Each
strain is absent from a different several percent of the windows. The windows
where all four rows are absent at once are the K12-private islands the depth
track bottoms out over.

<Figure caption="odgi pav over the same K12 windows, one row per non-K12 strain, near 1 where that strain is present and 0 over its own accessory stretches. The gap patterns differ per strain, so a single dip in the aggregate depth curve resolves into which strain accounts for it." src="/img/pangenome/pav.png" />

## Compared to `odgi viz`

odgi ships its own one-line renderer,
[`odgi viz`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_viz.html)
(`odgi viz -i graph.gfa -o graph.png`), which draws the graph the way the graph
is stored, rather than projected onto a reference.

<Figure caption="The same five-strain graph drawn by odgi viz: one row per strain, filled where the strain traverses the graph and white over accessory sequence. The axis is graph node order, not K12 coordinates, so nothing lines up with a gene or a chromosome position." src="/img/pangenome/graph.png" />

`odgi viz` gives one row per strain, as the MAF and per-strain-presence tracks
do, but its horizontal axis is the graph's node order (the "pangenome
sequence"), not any genome's coordinates. Sequence every strain walks is a
filled column across all rows; accessory sequence is a gap in the rows that skip
it. That is the graph's real structure, but no gene is numbered in node order,
and the axis counts pangenome bases rather than reference ones, so a locus takes
up more of it wherever the other strains carry sequence K12 lacks.

The four JBrowse projections keep the one-row-per-strain idea and re-draw
everything on K12's coordinates. Depth is the raster's column coverage summed
into one curve, per-strain presence is its filled-vs-gap rows windowed, the MAF
track is those same rows at single-base resolution colored by mismatch, and the
variant track is the points where the rows branch, one column each.

The
[Minigraph-Cactus tutorial](/docs/tutorials/pangenome_cactus#compared-to-odgi-viz)
marks one 100 kb window on both axes on the same five strains, which shows how
much wider a locus is on the graph axis than on a reference one.

## The graph itself

The four projections above flatten the graph onto K12. JBrowse can also draw it
as a graph, beside a linear view of the same window, through the
[graph genome view plugin](/docs/user_guides/graph_genome_view). That guide
covers the view itself, its layouts, and moving between the two panels. This
section covers the part specific to pggb: getting a base-level graph in.

### Browsing the whole graph by locus

A plain GFA records no coordinates on its segments, but its P lines carry the
same information in a different encoding. Walking a path in step order gives
every segment it visits an interval on that path's own sequence. Doing that walk
once, offline, and writing the result as the two tabix-indexed BEDs that
`RgfaTabixAdapter` reads makes the whole graph queryable by locus:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_pggb_tabix.sh
bash build_pggb_tabix.sh pggb/*.smooth.final.gfa ecoli_pggb K12
```

That takes about ten seconds on this graph and produces `ecoli_pggb.segs.bed.gz`
and `ecoli_pggb.links.bed.gz` with their indexes. The reference argument names
the path to treat as rank 0, and every other path contributes the segments no
earlier path reached, on its own coordinates. The walk agrees with the
`odgi extract` route [below](#a-window-as-a-file): at that window every interval
it derives matches the ones `gfa_nodes_to_bed.py` derives from the extracted
subgraph.

Load it as one `FeatureTrack` pointed at the shared prefix, the same shape the
[graph view tutorial](/docs/user_guides/graph_genome_view#route-1-a-graph-track-browsable-by-locus)
uses for an rGFA:

```json
{
  "type": "FeatureTrack",
  "trackId": "ecoli_pggb_segments",
  "name": "pggb graph segments",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "uri": "https://jbrowse.org/demos/ecoli_pangenome/ecoli_pggb"
  }
}
```

Now the segments draw as an ordinary track on K12, and **Track menu → Launch
view → Graph genome view (this region)** cuts a subgraph from the index with no
`odgi` step in between. Rubberbanding the ruler and picking **Graph genome view
(this selection)** does the same for a window you drag.

<Figure caption="A 1 kb window of the pggb graph, cut from the index rather than from a file prepared beforehand. Both panels are colored by reference position, so the segment lane above and the backbone below run through the same hues left to right, and each bubble in the graph sits under the stretch of reference it belongs to." src="/img/pangenome/pggb_locus_graph.png" />

Switching **Layout** to **Sample rows** gives each strain its own row. On this
graph a row means carriage, since it names a path that actually walks the
segment. On an rGFA it means build order instead, because minigraph's `SR` names
the assembly that contributed the segment first.

<Figure caption="The same window in Sample rows. Each row is one strain and each mark is a segment that strain carries, colored by where on K12 it sits, so a bubble shows which strains take which route through it." src="/img/pangenome/pggb_locus_sample_rows.png" />

#### Where this stops, and what to do instead

This gives browsing by locus rather than seamless browsing of any graph, and it
has four limits.

The index is built once, offline, and nothing reads the GFA live, so it has to
be rebuilt when the graph changes. It grows with total sequence rather than with
variation: a pggb graph runs about 17 bp per segment, so a five-strain bacterial
pangenome is a few hundred thousand segments and a human pangenome at base level
is several orders of magnitude past that. For a graph that large, build the
index a chromosome at a time if at all, and prefer the SV-resolution minigraph
graph for whole-genome browsing.

The window that draws is also small, because of the graph rather than the index.
At 17 bp per segment, 1 kb is around 150 nodes and 3 kb is a solid braid, and
the view declines past its node budget rather than drawing something unreadable.
Finally, a segment carried by several assemblies draws on one row: sample rows
put it on the first path that walks it, and the others are listed in the node
popup.

When the graph is too large to index, cut a window offline and open that file
instead, [below](#a-window-as-a-file).

### A window as a file

With no index, **Add → Graph genome view** takes a GFA by file or URL. This is
the route for a graph too large to index, or for a window someone hands you.
Three odgi commands cut one: `extract -E` takes every node between the first and
last in the range, `sort -O` compacts the node ids, and `view -g` writes GFA:

```bash
# resolve the graph on the host, since a /data/*.og glob can't expand in docker
og=$(ls pggb/*.smooth.final.og)
in_pggb bash -c "odgi extract -i /data/$og -r K12#1#chr:1004500-1004900 -E -o - \
  | odgi sort -i - -o - -O \
  | odgi view -i - -g" > ecoli_pggb_subgraph.gfa
```

Nothing in a plain GFA marks one path as the reference, so pick which to anchor
on under **Settings → Reference path**. `odgi extract` writes the window into
the path name (`K12#1#chr:1004500-1004961`), which is where the offsets come
from.

The same walk outside the browser puts those nodes on a linear track, so the
segment under the cursor is the same segment in both panels:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/gfa_nodes_to_bed.py
python3 gfa_nodes_to_bed.py ecoli_pggb_subgraph.gfa K12#1#chr chr \
  | sort -k1,1 -k2,2n | bgzip > ecoli_pggb_subgraph_nodes.bed.gz
tabix -p bed ecoli_pggb_subgraph_nodes.bed.gz
```

The BED's `itemRgb` is the view's own viridis **Depth** ramp sampled the same
way, so the track needs no color configuration and cannot drift from the graph.
Nodes the reference path never visits are the alternate alleles. They have no
K12 position, so they are absent from the linear track.

<Figure caption="One slice of the five-strain graph drawn both ways, under a linear view of the same locus. Left, anchored on the graph's K12 path: both panels share an axis and the Depth colors, so the backbone row is the node strip above it and the green-to-yellow step, where the fifth strain rejoins the shared sequence, is at the same x in both. Right, force-directed: the same nodes and colors with nothing holding them to the axis. The alternate alleles have no K12 coordinate either way, and their drawn width is a visibility floor rather than their length in bp, which the node tooltip gives." src="/img/pangenome/local_subgraph.png" links="Anchored=pangenome/local_subgraph_anchored,Force-directed=pangenome/local_subgraph_force" />

## Reproduce it end to end

[`build_ecoli_pangenome_graph.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_ecoli_pangenome_graph.sh)
runs everything above in one shot, fetching the helper scripts it needs beside
itself:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_ecoli_pangenome_graph.sh
bash build_ecoli_pangenome_graph.sh   # builds ./ecoli_pangenome_graph_build/jbrowse2
npx --yes serve ecoli_pangenome_graph_build/jbrowse2
```

It downloads the RefSeq genomes, runs pggb, converts the wfmash PAF, VCF, MAF,
`odgi depth`, and `odgi pav` into the projections above, downloads JBrowse, and
writes a `config.json` with the assemblies, per-strain gene tracks, the five
graph-derived tracks, and a default session. It also writes the `odgi viz`
raster, the two graph-view subgraphs (`ecoli_pggb_subgraph.gfa` and
`ecoli_rgfa_slice.gfa`), and the rGFA tabix indexes behind the segments track,
all of which need the cactus image for minigraph and gfatools. The `config.json`
declares the graph genome view plugin, so the graph track and the launch menu
item work with nothing to install. It needs the same tools listed under
[What you need](#prerequisites).

The PAF sort and bigWig conversion spill temp files large enough to overflow a
tmpfs `/tmp`, so the script routes `TMPDIR` to a `tmp/` directory inside the
build output. Export your own `TMPDIR` to override it.

## See also

- [Pangenome graph view](/docs/user_guides/graph_genome_view), which draws this
  graph as a graph and covers the view's layouts and menus
- [Minigraph-Cactus pangenomes](/docs/tutorials/pangenome_cactus)
- [All-vs-all synteny](/docs/tutorials/allvsall_synteny)
- [](/docs/user_guides/maf_track)
- [Multi-sample variant track](/docs/user_guides/multivariant_track)
- [PIF format](/docs/developer_guides/pif_format)
- [JBrowse Jupyter / anywidget](/docs/jbrowse_jupyter), which stacks these same
  strains from the all-vs-all PAF in a notebook
- [](/docs/jbrowser), the same in R
- [pggb](https://github.com/pangenome/pggb)
