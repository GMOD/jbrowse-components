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

Most of what JBrowse draws are the graph's **linear projections**: the same
graph flattened onto one reference genome's coordinates, in four complementary
views. Every builder can emit all four, so a graph built with any of these tools
lands on JBrowse track types you already have:

| Projection             | What it shows                                               | From the graph                                           | JBrowse track                                                      |
| ---------------------- | ----------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| All-vs-all synteny     | The blocks each pair of genomes shares                      | the wfmash all-vs-all PAF, `odgi untangle`, `halSynteny` | [synteny track](/docs/config_guides/synteny_track)                 |
| Pangenome variants     | Every difference the graph calls, across all samples        | `pggb -V`, `cactus-pangenome --vcf`, `vg deconstruct`    | [multi-sample variant track](/docs/user_guides/multivariant_track) |
| Whole-genome alignment | The multiple alignment, column by column                    | `pggb -M`, `hal2maf`                                     | [MAF track](/docs/user_guides/maf_track)                           |
| Pangenome depth        | How many genomes cover each reference base (core/accessory) | `odgi depth`                                             | [quantitative track](/docs/config_guides/quantitative_track)       |

This tutorial builds a five-strain _E. coli_ pangenome with pggb, loads all four
projections, and draws the graph itself. It uses the same five genomes as the
[all-vs-all synteny tutorial](/docs/tutorials/allvsall_synteny), which builds
the synteny projection alone from a plain minimap2 alignment; here that same
projection falls out of the graph, alongside the variant and MAF projections a
graph additionally gives you.

## What you need

- `docker`, for the pggb image (which also carries odgi), plus the cactus image
  if you build the rGFA graph below (it carries minigraph and gfatools)
- the NCBI
  [`datasets`](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/download-and-install/)
  CLI
- `samtools`, `bedGraphToBigWig` (UCSC kentUtils)
- `python3`, htslib (`bgzip`, `tabix`), `unzip`
- `node`, for the [JBrowse CLI](/docs/cli)

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

`-n` is the number of haplotypes, `-p` the minimum alignment identity, `-s` the
segment length; `-p 90 -s 5000` suits a bacterial pangenome. Two flags are easy
to miss. `-c, --n-mappings` is separate from `-n` and defaults to `1`, so `-n 5`
alone keeps each segment's single best match and builds an under-connected graph
that crashes smoothxg; set it to the haplotype count minus one. And `-w /data`
in the wrapper gives the `-u` user a writable working directory, without which
seqwish cannot write its temporary files.

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
the two pictures nearly agree: an independent pairwise aligner and the graph's
own input alignment place the backbone and IAI39's inversions the same way. Only
the grain differs, since wfmash emits shorter segments than minimap2's `asm20`
blocks, so the same `minAlignmentLength` leaves a denser band here.

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

<Figure caption="The graph's pangenome variants on the K12 reference across the colanic-acid cluster (wca/wz), one row per strain, with the MAF alignment stacked below and the K12 gene lane above. Each column is a variant the graph called, colored by that strain's genotype (see the legend); a run of the same color across rows is a stretch those strains share." src="/img/pangenome/pangenome_variants.png" />

The [multi-sample variant track guide](/docs/user_guides/multivariant_track)
covers the matrix versus the per-position display, genotype coloring, and
clustering samples by genotype.

### Two tiers in one file

A graph VCF is nested, which an ordinary callset is not. pggb decomposes a snarl
tree, so each record carries `LV` (its level, `0` at the top) and `PS` (its
parent), and the file holds both a bubble and the variants inside it. Of the
174,439 records here, 30,508 sit inside another one, and **178 span a kilobase
or more of K12**, 142 of those carrying three or more distinct alternate
alleles.

Those wide records draw over the fine layer decomposed from them: one record in
the MAF window below spans 20,639 bp at `chr:4,567,270`, painting a flat block
across the rows that carry it and hiding every SNP underneath. Both figures on
this page filter them out, with

```
jexl:get(feature,'end')-get(feature,'start') < 100
```

from **Edit filters** in the track menu. Invert that to read the bubble tier
instead, or filter on `LV` to pick a level of the snarl tree directly.

## Whole-genome alignment (MAF) projection

`pggb -M` writes the multiple alignment as a MAF, which JBrowse reads as a
[MAF track](/docs/config_guides/maf_track). One wrinkle: pggb orders each MAF
block from its longest path, so the block's reference row is not consistently
the same genome, whereas a MAF track projects onto a single reference. Re-root
every block on K12 (drop blocks that lack it), and rename the PanSN names to
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

The three projections above show where the genomes _differ_. Depth shows how
much of the graph is _shared_:
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

Both extremes are worth opening. Ten stretches of 5 kb or more, 157 kb in all,
sit at depth 1 because no other strain traverses them, the largest being
`chr:262,500-297,500`, then `chr:2,755,500-2,778,000` and
`chr:1,196,000-1,211,500`. Those are K12's private sequence, and the gene lane
names what is in them.

The peaks go the other way: depth reaches 10 at `chr:4,167,000-4,170,500` and
`chr:3,942,000-3,946,500`, twice the strain count, because those are rRNA
operons the graph collapses into a single path each strain then walks twice. So
read the signal as relative, not an exact genome tally.

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

Where the aggregate curve dips, this track shows _which_ strain is missing: one
row falls to 0 over its own accessory stretch while the others hold at 1. Over
the whole chromosome, CFT073 is absent from 14.0% of the windows, IAI39 11.6%,
Sakai 10.3% and NCTC86 5.8%; the windows where all four rows are absent at once
are the K12-private islands the depth track bottoms out over.

<Figure caption="odgi pav over the same K12 windows, one row per non-K12 strain, near 1 where that strain is present and 0 over its own accessory stretches. The gap patterns differ per strain, so a single dip in the aggregate depth curve resolves into which strain accounts for it." src="/img/pangenome/pav.png" />

## Compared to `odgi viz`

odgi ships its own one-line renderer,
[`odgi viz`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_viz.html)
(`odgi viz -i graph.gfa -o graph.png`), which draws the graph the way the graph
is stored. That is worth reading next to the four projections above.

<Figure caption="The same five-strain graph drawn by odgi viz: one row per strain, filled where the strain traverses the graph and white over accessory sequence. The axis is graph node order, not K12 coordinates, so nothing lines up with a gene or a chromosome position." src="/img/pangenome/graph.png" />

`odgi viz` gives one row per strain, as the MAF and per-strain-presence tracks
do, but its horizontal axis is the graph's node order (the "pangenome
sequence"), not any genome's coordinates. Sequence every strain walks is a
filled column across all rows; accessory sequence is a gap in the rows that skip
it. That is the graph's real structure, but no gene is numbered in node order,
and the axis counts pangenome bases rather than reference ones, so a locus takes
up more of it wherever the other strains carry sequence K12 lacks.

The four JBrowse projections keep the one-row-per-strain idea and throw the
node-order axis away, re-drawing everything on K12's coordinates:

- **depth** is `odgi viz`'s column coverage, summed into one curve.
- **per-strain presence** is its filled-vs-gap rows, windowed.
- the **MAF** track is those same rows at single-base resolution, colored by
  mismatch.
- the **variant track** is the points where the rows branch, one column each.

Node order is what you trade away; a reference coordinate beside the genes is
what you get for it. The
[Minigraph-Cactus tutorial](/docs/tutorials/pangenome_cactus#compared-to-odgi-viz)
measures that trade on the same five strains, marking one 100 kb window on both
axes to show how much wider it is on the graph's.

## The graph itself: a local subgraph

:::info Requires the graph genome view plugin

The **Graph genome view** is a separate plugin,
[jbrowse-plugin-graphgenomeviewer](https://github.com/GMOD/jbrowse-plugin-graphgenomeviewer),
not bundled in JBrowse Web, because its force-directed layout uses the
GPL-licensed [Bandage](https://github.com/rrwick/Bandage) engine (its
[OGDF](https://ogdf.github.io/) FMMM layout). It is in **beta** and not in the
[plugin store](/docs/user_guides/plugin_store) yet, but it is a native ES module
and loads from any config today (see
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

Installing it gives you the **Add → Graph genome view** menu item, and
`RgfaTabixAdapter` below ships in the same plugin. The projection tracks need
none of this.

:::

The four projections above flatten the graph onto K12. JBrowse can also draw the
graph _as a graph_, a Bandage-style 2-D view of one locus. The whole-genome
graph is far too large to lay out (606k nodes and 814k links here, millions for
a vertebrate pangenome), so you cut a window out of it first and open that
subgraph. Three odgi commands do it: `extract -E` takes every node between the
first and last in the range, `sort -O` compacts the node ids, `view -g` writes
GFA:

```bash
# resolve the graph on the host, since a /data/*.og glob can't expand in docker
og=$(ls pggb/*.smooth.final.og)
in_pggb bash -c "odgi extract -i /data/$og -r K12#1#chr:1004500-1004900 -E -o - \
  | odgi sort -i - -o - -O \
  | odgi view -i - -g" > ecoli_pggb_subgraph.gfa
```

(`vg chunk -x graph.xg -p K12#1#chr:1004500-1004900 -c 20` is the vg equivalent
if your graph came from Minigraph-Cactus.)

Open **Add → Graph genome view** and load `ecoli_pggb_subgraph.gfa` by file or
URL. For this demo the hosted copy is at
`https://jbrowse.org/demos/ecoli_pangenome/ecoli_pggb_subgraph.gfa`.

No segment in a pggb GFA carries a coordinate, but its paths do: walking one in
step order gives every node it visits an interval on that path's own sequence.
Pick which path to walk under **Settings → Reference path** — nothing in a
general GFA marks one of them as the reference, so the view cannot guess — and
the **Anchored** and **Sample rows** layouts draw against it, x in K12 bp. A
graph cut from a track skips the question, since it was cut against an assembly
already. With neither, the view has no axis to offer and draws force-directed.

Keep the window small, because a pggb graph is fragmented at base resolution:
between five _E. coli_ strains a few hundred bp already carries a dozen bubbles.
Node lengths are Bandage-scaled per graph, so a 1 bp SNP allele and a 164 bp
backbone segment stay on one picture in proportion, the SNP alleles as specks. A
few hundred bp is what makes that legible, not a limit on what the view loads.

The same walk outside the browser puts the nodes on a linear track, so the
segment under the cursor is the same segment in both panels. The reference
path's name states its span (`K12#1#chr:1004500-1004961`, the requested window
rounded out to whole nodes by `-E`), so walking it in order gives every node a
K12 start and end:

```bash
python3 scripts/gfa_nodes_to_bed.py ecoli_pggb_subgraph.gfa K12#1#chr chr \
  | sort -k1,1 -k2,2n | bgzip > ecoli_pggb_subgraph_nodes.bed.gz
tabix -p bed ecoli_pggb_subgraph_nodes.bed.gz
```

```json
{
  "type": "FeatureTrack",
  "trackId": "ecoli_pggb_subgraph_nodes",
  "name": "pggb subgraph: nodes on K12, colored by depth",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "ecoli_pggb_subgraph_nodes.bed.gz",
    "columnNames": [
      "chrom",
      "start",
      "end",
      "name",
      "depth",
      "strand",
      "thickStart",
      "thickEnd",
      "itemRgb"
    ]
  }
}
```

The BED's `itemRgb` is the view's own viridis Depth ramp sampled the same way,
so the track needs no color configuration and cannot drift from the graph;
`columnNames` only makes the tooltip say `depth` where it would otherwise say
`score`. Nodes the reference path never visits are the alternate alleles: no K12
position, so they are absent.

<Figure caption="A slice of the five-strain graph anchored on its K12 path, under a linear view of the same locus. Both panels are on the same axis and in the same Depth colors: the backbone row below is the node strip above, and the step from green to yellow is where the fifth strain rejoins the shared sequence, in both. The alternate alleles hang off the row below the backbone, having no K12 coordinate of their own." src="/img/pangenome/local_subgraph.png" />

### Build an rGFA with minigraph

Cutting a window per look is the price of a GFA with no coordinates on its
segments. [rGFA](https://github.com/lh3/gfatools/blob/master/doc/rGFA.md), what
minigraph emits, tags every segment with the stable sequence it sits on, its
offset there, and its rank, so the graph states its own reference backbone and
opens any locus directly (the
[HPRC tutorial](/docs/tutorials/pangenome_hprc#regular-gfa-vs-rgfa) shows those
tags on a real segment line).

Build one from the same five strains. minigraph takes its stable names from the
input FASTA headers, so give it the PanSN-named records rather than the
per-strain files (whose contig is called `chr` in all five), otherwise every
segment lands on an ambiguous `chr` that no later command can query by strain.
minigraph and `gfatools` are not in the pggb image but are in the cactus one
that the [Minigraph-Cactus tutorial](/docs/tutorials/pangenome_cactus) uses, so
wrap that and call it `in_cactus`:

```bash
in_cactus() {
  docker run --rm -u "$(id -u):$(id -g)" -w /data -v "$PWD":/data \
    quay.io/comparative-genomics-toolkit/cactus:v3.2.1 "$@"
}

for strain in K12 Sakai CFT073 NCTC86 IAI39; do
  in_cactus samtools faidx /data/all.fa.gz "$strain#1#chr" > "$strain.pansn.fa"
done

in_cactus bash -c "minigraph -cxggs -t 8 /data/K12.pansn.fa /data/Sakai.pansn.fa \
  /data/CFT073.pansn.fa /data/NCTC86.pansn.fa /data/IAI39.pansn.fa" \
  > ecoli_minigraph.rgfa

in_cactus gfatools view -R "K12#1#chr:1000000-1300000" -r 1 \
  /data/ecoli_minigraph.rgfa > ecoli_rgfa_slice.gfa
```

`gfatools view -R` takes a region in those stable coordinates, so unlike plain
GFA no graph-specific extraction step is needed. Load the result in a **Graph
genome view** and it lays out from the file rather than from a force simulation:
rank-0 segments at the reference offset they declare, each higher rank on its
own row. Pick **Stable rank (rGFA)** in the Color dropdown to color by rank.

Rank is the `SR` tag minigraph writes on every segment, and it counts build
order: 0 is the first assembly on the command line (K12 here, the reference
backbone), 1 is sequence first added when Sakai was folded in, and so on to 4
for IAI39. A rank-4 segment is sequence none of the four assemblies before it
had, and only rank 0 has reference coordinates, which is why it is the only rank
a linear view of K12 can show. A minigraph graph is also far less fragmented
than a pggb one, since it records structural variation rather than every SNP, so
a legible window is hundreds of kb rather than hundreds of bp.

That rank ladder is the **Anchored** layout, so it lines up with a linear view
of the same window (the
[indexed figure below](#opening-any-locus-without-a-slice-per-locus) shows the
pair). The toolbar's **Layout** dropdown offers two others, compared under
[Three layouts](#three-layouts).

### Opening any locus without a slice per locus

Cutting a slice per window is fine for one look at one region. To browse the
whole graph instead, index it once with
[`build_rgfa_tabix.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_rgfa_tabix.sh)
(98 kb of index for this five-strain graph) and load the two files as one
`FeatureTrack` on K12:

```bash
bash build_rgfa_tabix.sh ecoli_minigraph.rgfa ecoli_minigraph
```

```json
{
  "type": "FeatureTrack",
  "trackId": "ecoli_minigraph_segments",
  "name": "minigraph graph: rGFA segments",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "uri": "ecoli_minigraph"
  }
}
```

The `uri` is the shared prefix: the adapter resolves `.segs.bed.gz`,
`.links.bed.gz` and both `.tbi` files from it. The graph's stable names are
PanSN (`K12#1#chr`) and their sample prefix is already the assembly name, so
this needs no `assemblyNameToPanSN` mapping (the
[HPRC tutorial](/docs/tutorials/pangenome_hprc#load-the-graph) does, because its
graph calls the reference `GRCh38` while the assembly is `hg38`).

The segments now draw as features in a linear view, and the graph for whatever
is on screen is one menu away. Past the size the view will draw, the item greys
out and names its limit rather than disappearing:

<Figure caption="Track menu → Launch view → Graph genome view (this region), on the rGFA segments track above (an ordinary FeatureTrack, reading the two tabix indexes through RgfaTabixAdapter). Offered only for a track whose adapter can cut a subgraph." src="/img/pangenome/rgfa_launch_menu.png" />

Right-clicking one segment cuts the graph around that segment instead:

<Figure caption="Right-click on backbone segment s1277 (glnA to yihN) → Launch view → Graph genome view (this segment). The launched window, chr:4,053,156-4,067,028, is the segment plus half its length on each side: blue rank-0 backbone, three short rank-1 alleles hanging off it, and one rank-2 allele in purple." src="/img/pangenome/rgfa_segment_neighbourhood.png" />

A `color` jexl on the segment's `rank` paints the track in the graph's own
Stable rank colors, so a segment is the same color in both panels:

```json
"displayDefaults": {
  "color": "jexl:get(feature,'rank')==0?'rgb(52,152,219)':'rgb(237,137,44)'"
}
```

<Figure caption="50 kb of K12 launched as a graph. Both panels read the same two tabix indexes, so the blue blocks above are the blue rank-0 backbone below, same ids at the same offsets. The orange, red and purple alleles have no K12 coordinates, which is why the linear track has nothing to show for them." src="/img/pangenome/rgfa_subgraph_launch.png" />

### Three layouts

The **Layout** dropdown draws the same subgraph three ways, differing in what
the axes mean:

| Layout          | x              | y                       |
| --------------- | -------------- | ----------------------- |
| Anchored        | reference bp   | one row per stable rank |
| **Sample rows** | reference bp   | one row per assembly    |
| Force-directed  | nothing (FMMM) | nothing                 |

Both reference-anchored modes need a backbone. rGFA states one in its tags; a
plain GFA such as the pggb subgraph above gets one from its **Reference path**,
and the rows then mean the same thing in both. Only a GFA with neither leaves
them greyed out, and there force-directed is the honest picture: the classic
Bandage one, where alternate alleles fall out as bubbles rather than as rows
(the [MHC figure](/docs/tutorials/pangenome_hprc#open-a-locus-as-a-graph) shows
it beside a linear view).

Rank is a property of how the graph was built, not of any genome: at a dense
locus one rank holds alleles from many different haplotypes, so a rank row means
nothing biological. **Sample rows** rows by the assembly each allele came from
instead, so reading across a row says what that strain does to the reference.

What "came from" means depends on the format, and the difference matters when
reading a row. On rGFA it is the strain that _first contributed_ the sequence,
because `SR` is build order and nothing in the file records who else carries it.
On a path GFA every path that visits a segment is stated outright, so a node's
popup lists every strain that carries it — the row it draws on is the first of
them.

<Figure caption="The five-strain graph in the Sample rows layout, under the genes and the segments track it was launched from. Row K12 is the reference backbone and each row below it is one strain: a deletion leaves that strain's row empty across the span it removes, and an insertion is a mark where it attaches." src="/img/pangenome/rgfa_sample_rows.png" />

Both anchored layouts draw an allele across **the reference it replaces, never
its own sequence length**: an insertion consumes no reference, so it draws as a
mark where it attaches, with its size in the tooltip. The next two tracks put
the allele's own length on the glyph instead.

### Hovering one panel highlights the other

Hover a node in the graph and the reference interval it occupies is highlighted
in every linear view beside it; hover the linear view and the segment under the
cursor lights up in the graph. Nothing to configure, and it is what makes a
rank>0 allele locatable at all, since those have no reference coordinates.

<Figure caption="Hovering CFT073's allele in the graph (circled) highlights the reference interval it occupies in the linear view above, across both the gene track and the segments track. That interval is the span between the two backbone segments the allele detaches from and rejoins." src="/img/pangenome/rgfa_hover_correspondence.png" />

The reverse works from any track, not just the graph's own segments. A gene
gives only a coordinate, and that is enough: rGFA segments do not overlap on a
stable sequence, so one backbone segment covers it.

<Figure caption="Hovering the gene csgG in the linear view brightens the backbone segment covering it in the graph, and the graph reports that segment's span back as the band across the linear view. The tooltip names it: s406, 36,989 bp." src="/img/pangenome/rgfa_hover_from_linear.png" />

### From a node to the strains that carry it

Every rGFA segment carries the sequence it came from (`SN`) and its offset there
(`SO`). With only K12 loaded that gets you back to the reference; with all five
loaded as assemblies, the same five the
[all-vs-all projection](#all-vs-all-synteny-projection) uses, the graph's
**Launch view** menu gains two ways out:

- **one linear view per contributing strain**, framed on that strain's own
  coordinates for this locus. Right-clicking a single allele does it for that
  segment alone: a CFT073 allele opens CFT073 at the offset its `SO` states, not
  a projection onto K12.
- **a synteny view of all of them**, one panel per strain, each already at its
  own locus. Those panel coordinates come from the graph, so nothing is looked
  up in the PAF first; the alignment track only draws the ribbons between
  panels.

Only loaded strains are offered, so the menu never lists a view that cannot
open, and a location goes into the linear view already beside the graph rather
than stacking a pane.

<Figure caption="The graph's Launch view menu over a 50 kb K12 window in the sample-rows layout. Each strain's entry names the locus it contributes on its own coordinates, from CFT073's 46 kb to IAI39's 8 bp, and the synteny entry opens all four as panels against the graph's own all-vs-all track." src="/img/pangenome/rgfa_launch_out_menu.png" />

The [all-vs-all view](#all-vs-all-synteny-projection) shows five genomes and
where they align, the graph shows what the sequence does at one locus, and this
menu moves between the two without retyping a coordinate.

### Which strain takes which path

The two indexes say what the graph contains, not who carries what: rGFA's `SR`
tag is build order, not sample. minigraph can recompute the walks by aligning
each assembly back to the graph (`minigraph -cxasm --call`), emitting one line
per bubble per sample with the path that sample takes and its length.
[`build_minigraph_paths.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_minigraph_paths.sh)
runs that for every strain and projects the results into one tabix-indexed BED,
a row per bubble per strain:

```bash
bash build_minigraph_paths.sh ecoli_minigraph.rgfa ecoli_minigraph_paths \
  K12.pansn.fa Sakai.pansn.fa CFT073.pansn.fa NCTC86.pansn.fa IAI39.pansn.fa
```

The reference goes first, because its path through a bubble _is_ the reference
allele the others are scored against. Load the result with one row per strain:

```json
{
  "type": "FeatureTrack",
  "trackId": "ecoli_minigraph_paths",
  "name": "minigraph graph: per-strain path through each bubble",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "ecoli_minigraph_paths.bed.gz"
  },
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "partitionField": "strain",
      "lengthField": "delta",
      "rowOrder": ["K12", "Sakai", "CFT073", "NCTC86", "IAI39"]
    }
  ]
}
```

`partitionField` gives each strain its own row. `lengthField` is the length
channel: without it a 113 kb insertion and a 1 bp one draw the same box. Pointed
at the BED's signed `delta` column, it draws the insertion and deletion marks
the [alignments track](/docs/user_guides/alignments_track) uses.

<Figure caption="One 3.4 kb bubble at K12 chr:1,094,197-1,097,573, read three ways: genes above, the graph's segments in the middle, each strain's path through the bubble below. Sakai and CFT073 replace those 3.4 kb with 113 kb and 110 kb of their own, NCTC86 with 41 kb, and IAI39 deletes 3.2 kb. K12's row is the reference path, grey at all 601 bubbles." src="/img/pangenome/rgfa_strain_paths.png" />

The BED keeps the segment ids each strain traverses in a `path` column, so the
rows tie back to the graph panel: at that bubble Sakai and CFT073 differ only in
their first segment, which is why their alleles are within 3 kb of each other,
and IAI39's path opens with `<s2607`, a reverse traversal.

### Finding the sites worth looking at

601 bubbles is more than you want to scroll past, so each row also carries what
that bubble looks like across all the strains. All three are jexl filters from
**Edit filters** in the track menu:

| Column    | What it is                                     | Use it for                                                                            |
| --------- | ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| `alleles` | distinct paths anyone actually takes here      | `jexl:get(feature,'alleles')>2` cuts to the multi-allelic sites                       |
| `nonRef`  | how many strains leave the reference path      | `jexl:get(feature,'nonRef')==1` finds the singletons, `==4` the sites K12 alone lacks |
| `strand`  | the orientation the strain's contig aligned in | `jexl:get(feature,'strand')==-1` selects inverted alleles                             |

The graph splits 436 biallelic bubbles, 105 with three alleles, 37 with four,
and **23 where all five strains carry something different**: an allele-frequency
spectrum, whose tail is the hypervariable loci. `strand` picks out inversions,
169 of IAI39's calls and none of any other strain's, in long contiguous runs
(1,671,139-1,870,074 is one).

`alleles` counts alleles someone carries, not the path count `gfatools bubble`
reports (that one counts routes combinatorially and saturates at `2147483647`),
and `nonRef` is a different question from the
[depth and presence projections](#pangenome-depth-projection-core-vs-accessory)
above, which say whether a haplotype is _present_ over a window, not whether it
_differs_ there.

**Clustering → Cluster rows by similarity** reorders the rows by which alleles
each strain carries, so haplotypes with the same structural content sit together
under a dendrogram. On five strains that is a sanity check; on a few hundred
haplotypes it is the analysis.

`gfatools bubble` reports **top-level** bubbles only, and on this graph they
never overlap (0 of 601), which is what makes one flat lane per strain complete
rather than lossy. Variation nested _inside_ a bubble is the cost: a 113 kb
allele is one block, not the SNPs and small indels within it. The
[variants projection](#pangenome-variants-projection) carries that nested tier
instead, in `vg deconstruct`'s `LV`/`PS` snarl fields.

### When all you have is the graph

Someone else's rGFA usually arrives without the assemblies it was built from,
which rules out the re-mapping above. The two indexes still state every allele
the graph holds, because each L-line row carries both of its endpoints in full:
a link between two backbone segments that leaves a coordinate _gap_ is a
deletion, and a link from the backbone into a rank>0 segment enters an allele
whose length is the segments it walks before rejoining.
[`build_rgfa_alleles.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_rgfa_alleles.sh)
does that walk in awk and needs nothing but the two files:

```bash
bash build_rgfa_alleles.sh ecoli_minigraph   # -> ecoli_minigraph.alleles.bed.gz
```

Each row is an allele stated against the reference it replaces, which is an
alignment, so the BED carries a `CIGAR` column (`2062M63348I`) and an
[alignments track](/docs/user_guides/alignments_track) reads it directly:

```json
{
  "type": "AlignmentsTrack",
  "trackId": "ecoli_minigraph_alleles",
  "name": "minigraph graph: allele inventory (from the rGFA alone)",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "ecoli_minigraph.alleles.bed.gz"
  }
}
```

`AlignmentsTrack` over a BED looks like a mistake and is the point: the display
draws whatever carries a CIGAR, so the alleles pack into rows and each draws the
same insertion marker and deletion bar a read does, at its real size. That
matters more here than on the per-strain track, because these alleles overlap (a
nested site has several routes sharing an anchor). Without the CIGAR a 63 kb
allele is a 1 bp feature with the number hidden in its label.

The five-strain graph yields 847 alleles: 395 insertions, 441 deletions, 11
same-length substitutions. `altLen`, `discoveryRank` and the traversed
`segments` are in the popup, and `class`/`delta` drive the same **Edit filters**
jexl the per-strain track uses. Start from `jexl:get(feature,'delta')>10000` on
a graph this size; it is the only filter that scales to the 208,545 alleles the
464-haplotype HPRC graph yields.

**What it costs against the per-strain route above.** `minigraph --call` reports
842 alleles on this graph, and 747 of them come back here with the identical
length change in the same bubble. The 95 that do not are compound routes at 69
nested bubbles, where `--call` reports one strain's whole traversal and this
reports the individual alleles it is built from. So nesting costs exact compound
lengths, never a whole site, and the 55 alleles affected say so in a `nested`
column.

The real limit is whose allele it is. `discoveryRank` and `firstSeenIn` name the
**first** assembly to contribute a segment, because minigraph collapses: an
allele four strains share is credited to whichever was added first. That is
build order, not carriage, which is why this is a lane of alleles rather than
rows of haplotypes. Use the per-strain route when you have the assemblies, this
one when you do not.

## Reproduce it end to end

[`build_ecoli_pangenome_graph.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_ecoli_pangenome_graph.sh)
runs everything above in one shot:

```bash
bash scripts/build_ecoli_pangenome_graph.sh   # builds ./ecoli_pangenome_graph_build/jbrowse2
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
[What you need](#what-you-need).

The PAF sort and bigWig conversion spill temp files large enough to overflow a
tmpfs `/tmp`, so the script routes `TMPDIR` to a `tmp/` directory inside the
build output. Export your own `TMPDIR` to override it.

## See also

- [Minigraph-Cactus pangenomes](/docs/tutorials/pangenome_cactus)
- [All-vs-all synteny](/docs/tutorials/allvsall_synteny)
- [MAF track](/docs/user_guides/maf_track)
- [Multi-sample variant track](/docs/user_guides/multivariant_track)
- [PIF format](/docs/developer_guides/pif_format)
- [JBrowse Jupyter / anywidget](/docs/jbrowse_jupyter), which stacks these same
  strains from the all-vs-all PAF in a notebook
- [JBrowseR](/docs/jbrowser), the same in R
- [pggb](https://github.com/pangenome/pggb)
