---
title: Pangenome (pggb)
description:
  Build a four-strain pggb pangenome graph and load its linear projections plus
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
| Whole-genome alignment | The multiple alignment, column by column                    | `pggb -M`, `hal2maf` + `taffy`                           | [MAF track](/docs/user_guides/maf_track)                           |
| Pangenome depth        | How many genomes cover each reference base (core/accessory) | `odgi depth`                                             | [quantitative track](/docs/config_guides/quantitative_track)       |

This tutorial builds a four-strain _E. coli_ pangenome with pggb and loads all
four projections. It uses the same four genomes as the
[all-vs-all synteny tutorial](/docs/tutorials/allvsall_synteny), which builds
the synteny projection alone from a plain minimap2 alignment. Here that same
projection falls out of the graph, alongside the variant and MAF projections a
graph additionally gives you.

The synteny projection alone also builds in a notebook: a `synteny_view` in
Python ([JBrowse Jupyter / anywidget](/docs/jbrowse_jupyter)) or R
([JBrowseR](/docs/jbrowser)) stacks these same strains from the all-vs-all PAF.

## What you need

- `docker`, for the pggb image (which also carries odgi)
- the NCBI
  [`datasets`](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/download-and-install/)
  CLI
- `samtools`, [`taffy`](https://github.com/ComparativeGenomicsToolkit/taffy),
  `bedGraphToBigWig` (UCSC kentUtils)
- `python3`, htslib (`bgzip`, `tabix`), `unzip`
- `node`, for the [JBrowse CLI](/docs/cli)

## Building the graph with pggb

pggb takes one FASTA of all the genomes,
[PanSN](https://github.com/pangenome/PanSN-spec)-named `sample#haplotype#contig`
so it can tell them apart. Concatenate the four strains (haplotype `1`, since
these are haploid bacterial assemblies) and index the result:

```bash
for strain in K12 Sakai CFT073 NCTC86; do
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

in_pggb pggb -i /data/all.fa.gz -o /data/pggb -n 4 -c 3 -p 90 -s 5000 -V K12 -M -t 16
```

Pinning the image to a dated build tag (rather than `:latest`) keeps the graph
reproducible.

`-n` is the number of haplotypes, `-p` the minimum alignment identity, `-s` the
segment length. `-p 90 -s 5000` suits a bacterial pangenome. `-c 3` is the one
easy flag to miss: pggb's separate `-c, --n-mappings` defaults to `1`, so `-n 4`
alone keeps only each segment's single best match (one other genome), which
builds an under-connected all-vs-all graph that crashes smoothxg during graph
prep. Set `-c` to the number of haplotypes minus one so every segment maps to
every other genome. In the wrapper, `-w /data` is not optional when running the
container as your own user (`-u`): it gives that user a writable working
directory, without which seqwish cannot write its temporary files and the run
dies mid-graph.

pggb runs [wfmash](https://github.com/waveygang/wfmash) (all-vs-all alignment),
[seqwish](https://github.com/ekg/seqwish) (induces the graph), and
[smoothxg](https://github.com/pangenome/smoothxg) (normalizes it), then the `-V`
and `-M` steps. The output directory holds the graph (`*.smooth.final.gfa`), the
all-vs-all PAF, the VCF, and the MAF, the outputs the sections below load (the
depth projection reads the graph itself).

### Other builders

The projections are builder-agnostic. **Minigraph-Cactus** (`cactus-pangenome`)
emits a VCF with `--vcf`, a GFA with `--gfa`, and a HAL by default; the
[Minigraph-Cactus tutorial](/docs/tutorials/pangenome_cactus) builds this same
four-strain demo that way and loads the same four projections.
**progressiveCactus** produces a HAL. `hal2maf` turns it into the MAF and
`halSynteny` into a PSL/PAF for the synteny projection. **odgi** projects any
graph to the synteny PAF with `odgi untangle -i graph.og -r <ref> -p`.

## The graph itself: a local subgraph

:::info Requires the graph genome view plugin

The **Graph genome view** used in this section is a separate plugin,
[jbrowse-plugin-graphgenomeviewer](https://github.com/GMOD/jbrowse-plugin-graphgenomeviewer),
not bundled in JBrowse Web. Its force-directed layout is computed by the
[Bandage](https://github.com/rrwick/Bandage) engine (its
[OGDF](https://ogdf.github.io/) FMMM layout, both GPL-licensed), loaded at
runtime, which is why it ships on its own.

The plugin is still in **beta and not published yet**, so it is not in the
[plugin store](/docs/user_guides/plugin_store) or installable from a
`config.json` (see [configuring plugins](/docs/config_guides/plugins)); look for
it in both soon. Once it is installed you get the **Add, then Graph genome
view** menu item. The projection tracks below need none of this.

:::

The projections below flatten the graph onto K12. JBrowse can also draw the
graph _as a graph_, a Bandage-style 2-D view of one locus. The whole-genome
graph is far too large to lay out (500k nodes here, millions for a vertebrate
pangenome), so you cut a window out of it first and open that subgraph. Three
odgi commands do it: `extract -E` takes every node between the first and last in
the range, `sort -O` compacts the node ids, `view -g` writes GFA:

```bash
# resolve the graph on the host, since a /data/*.og glob can't expand in docker
og=$(ls pggb/*.smooth.final.og)
in_pggb bash -c "odgi extract -i /data/$og -r K12#1#chr:1004500-1004900 -E -o - \
  | odgi sort -i - -o - -O \
  | odgi view -i - -g" > ecoli_pggb_subgraph.gfa
```

(`vg chunk -x graph.xg -p K12#1#chr:1004500-1004900 -c 20` is the vg equivalent
if your graph came from Minigraph-Cactus.)

Open a **Graph genome view** (Add, then Graph genome view) and load
`ecoli_pggb_subgraph.gfa` by file or URL. For this demo the hosted copy is at
`https://jbrowse.org/demos/ecoli_pangenome/ecoli_pggb_subgraph.gfa`.

Keep the window small, because a pggb graph is fragmented at base resolution:
between four _E. coli_ strains a few hundred bp already carries a dozen bubbles.
Node lengths are scaled the way Bandage scales them, derived per graph so the
mean drawn node lands at a usable size. That is what keeps a 1 bp SNP allele and
a 164 bp backbone segment on one picture, with the SNP alleles as the specks, in
proportion. A few hundred bp is what makes that structure legible, not what the
view can load.

<Figure caption="A 400 bp slice of the four-strain graph in the Bandage force-directed layout: the axis is graph structure, not K12 coordinates. Node color is depth, how many of the four strains traverse that node, so the backbone runs yellow where all four share it and blue where only two do, and each eye-shaped bubble is one site where the strains diverge. This is the structure the projections below re-express as a variant column, a synteny break, or a coverage dip." src="/img/pangenome/local_subgraph.png" />

### rGFA graphs carry their own coordinates

A pggb or Minigraph-Cactus GFA has no coordinates on its segments. The only
reference positions in the file live inside the P/W lines, which is why a
subgraph has to be cut with `odgi extract` and why the layout above has to
_infer_ a backbone by force simulation.

[rGFA](https://github.com/lh3/gfatools/blob/master/doc/rGFA.md), what minigraph
emits, is different: every segment carries `SN` (stable sequence name), `SO`
(offset on it) and `SR` (rank, `0` on the reference). So the graph states where
each segment sits and which segments are the reference backbone:

```bash
minigraph -cxggs -t 8 K12.fa Sakai.fa CFT073.fa NCTC86.fa > ecoli_minigraph.rgfa
gfatools view -R "K12#1#chr:1000000-1300000" -r 1 ecoli_minigraph.rgfa \
  > ecoli_rgfa_slice.gfa
```

`gfatools view -R` takes a region in those stable coordinates, so unlike plain
GFA no graph-specific extraction step is needed. Load the result in a **Graph
genome view** and it lays out from the file rather than from a force simulation:
rank-0 segments at the reference offset they declare, each higher rank on its
own row. Pick **Stable rank (rGFA)** in the Color dropdown to color by rank. A
minigraph graph is also far less fragmented than a pggb one, since it records
structural variation rather than every SNP, so a legible window is hundreds of
kb rather than hundreds of bp.

<Figure caption="The same four-strain minigraph window in the Graph genome view's anchored layout, colored by stable rank. The blue line is rank 0, the K12 reference backbone, drawn at the offsets its segments declare; the orange, red and purple segments below are higher-rank alternate alleles, joined to the backbone by the edges that thread each strain's path through the graph. Compare the pggb figure above, where the backbone has to be inferred by a force layout." src="/img/pangenome/graph_rgfa.png" link="" />

The rank-ladder layout above is anchored to K12, so it lines up with a linear
view of the same window. The toolbar's **Layout** dropdown trades that
correspondence for the classic Bandage picture of the same subgraph
(**Force-directed layout**):

<Figure caption="A 50 kb K12 window of the minigraph graph in force-directed layout, over the segments track for the same window. The rank-ladder view above says where each alternate allele sits on K12; this one says what the graph looks like, with the alleles as bubbles off the backbone rather than bars on parallel rows." src="/img/pangenome/rgfa_bandage_ecoli.png" />

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
  "assemblyNames": ["K12", "Sakai", "CFT073", "NCTC86"],
  "adapter": {
    "type": "AllVsAllIndexedPAFAdapter",
    "pifGzLocation": { "uri": "ecoli_pggb_ava.pif.gz" },
    "index": { "location": { "uri": "ecoli_pggb_ava.pif.gz.tbi" } },
    "assemblyNames": ["K12", "Sakai", "CFT073", "NCTC86"]
  }
}
```

Stack the four strains in a linear synteny view exactly as the
[all-vs-all tutorial](/docs/tutorials/allvsall_synteny#stacking-the-genomes)
describes. The PanSN `sample#` prefix on every PAF record is how the adapter
maps a record to its strain.

<Figure caption="The all-vs-all synteny projection: the four strains stacked K12 to NCTC86, a ribbon between each adjacent pair drawn from the graph's wfmash PAF. Continuous diagonal ribbons are shared backbone, and the crossings and gaps are where the strains rearrange or carry accessory sequence." src="/img/multiway_synteny/ecoli_pangenome.png" />

## Pangenome variants projection

`pggb -V K12` writes a VCF of every variant the graph decomposes against the K12
path, genotyped across the other three strains, the pangenome as a table of
differences. Its `CHROM` is the PanSN reference path (`K12#1#chr`), so rename it
to match the K12 assembly's reference sequence name (`chr`), then bgzip and
tabix:

```bash
sed 's/K12#1#chr/chr/g' pggb/*.smooth.final.K12.vcf | bgzip > ecoli_pggb.vcf.gz
tabix -p vcf ecoli_pggb.vcf.gz
```

Load it as a [`VariantTrack`](/docs/config_guides/variant_track) on K12 and pick
the matrix display, which lays out one column per variant and one row per
sample:

```json
{
  "type": "VariantTrack",
  "trackId": "ecoli_pggb_variants",
  "name": "pggb graph: pangenome variants (vs K12)",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "vcfGzLocation": { "uri": "ecoli_pggb.vcf.gz" },
    "index": { "location": { "uri": "ecoli_pggb.vcf.gz.tbi" } }
  },
  "displays": [{ "type": "LinearMultiSampleVariantMatrixDisplay" }]
}
```

Stacking the MAF alignment (the whole-genome alignment projection, below) over
the same window turns the matrix from a standalone summary into something you
can check: each band of shared or absent genotype sits directly above the
per-strain alignment it was decomposed from.

<Figure caption="The graph's pangenome variants as a multi-sample matrix on the K12 reference, with the MAF alignment stacked below and the K12 gene lane (elfC, ycbU, pyrD…) above. Each matrix column is one variant the graph called, each row one of the other three strains, each cell that strain's genotype (see the legend)." src="/img/pangenome/variant_matrix.png" />

The [multi-sample variant track guide](/docs/user_guides/multivariant_track)
covers the matrix versus the per-position display, genotype coloring, and
clustering samples by genotype.

## Whole-genome alignment (MAF) projection

`pggb -M` writes the multiple alignment as a MAF, which JBrowse reads as a
[MAF track](/docs/config_guides/maf_track). One wrinkle: pggb orders each MAF
block from its longest path, so the block's reference row is not consistently
the same genome, whereas a MAF track projects onto a single reference. Re-root
every block on K12 (drop blocks that lack it), and rename the PanSN names to
`sample.chr` so the MAF display can split each row's species off on the `.`:

```bash
# reroot_maf.py keeps K12-containing blocks, puts K12 first (+ strand), and
# sorts by K12 position
python3 reroot_maf.py pggb/*.smooth.maf ecoli_pggb.maf
```

[`reroot_maf.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/reroot_maf.py)
is a short script that ships with the reproducible build below.

Then convert the MAF to the bgzipped-TAF the
[`BgzipTaffyAdapter`](/docs/config/bgziptaffyadapter) reads, with
[taffy](https://github.com/ComparativeGenomicsToolkit/taffy) from the Cactus
toolkit (the same tool that turns a `hal2maf` MAF into TAF):

```bash
taffy view -i ecoli_pggb.maf -o ecoli_pggb.taf.gz -c   # -c bgzips
taffy index -i ecoli_pggb.taf.gz                        # -> .taf.gz.tai
```

```json
{
  "type": "MafTrack",
  "trackId": "ecoli_pggb_maf",
  "name": "pggb graph: whole-genome alignment (MAF, vs K12)",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "BgzipTaffyAdapter",
    "samples": ["K12", "Sakai", "CFT073", "NCTC86"],
    "tafGzLocation": { "uri": "ecoli_pggb.taf.gz" },
    "taiLocation": { "uri": "ecoli_pggb.taf.gz.tai" }
  }
}
```

<Figure caption="The graph's whole-genome alignment projected onto K12: the coverage band on top, then one row per strain (K12 reference first), each colored where it differs from K12. This shared-backbone window has all four strains aligning continuously, so each strain's mismatch columns read as SNP divergence from K12. NCTC86 aligns on the opposite strand and carries small insertions relative to K12 (the boxed runs)." src="/img/pangenome/maf.png" />

The `samples` list fixes the row order and labels. Supply an `nhLocation` Newick
tree instead to draw the rows as a dendrogram. The
[MAF track guide](/docs/user_guides/maf_track) covers the conservation band,
per-row identity, and codon view, all derived from the alignment with no extra
files.

## Pangenome depth projection (core vs accessory)

The three projections above all show where the genomes _differ_. The one thing a
pangenome is really about, how much of the graph is _shared_, is depth:
[`odgi depth`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_depth.html)
counts how many paths traverse the graph nodes under each reference base. Where
every strain is present the depth sits near the strain count (core sequence).
Where a stretch is K12-private it falls toward 1 (accessory sequence). odgi
ships inside the pggb image, so no new tool is needed to run it.

Tile the K12 path into windows, ask odgi for each window's mean depth, rename
the PanSN path to the assembly's `chr`, and convert the result to bigWig (the
[`bedGraphToBigWig`](https://genome.ucsc.edu/goldenPath/help/bigWig.html) UCSC
tool):

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

```json
{
  "type": "QuantitativeTrack",
  "trackId": "ecoli_pggb_depth",
  "name": "pggb graph: pangenome depth (paths over K12)",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "BigWigAdapter",
    "bigWigLocation": { "uri": "ecoli_pggb_depth.bw" }
  }
}
```

Zoomed out, the track reads as the pangenome's core/accessory landscape along
K12: a mostly-flat plateau near the strain count, dropping over the accessory
stretches the variant and MAF projections zoom into. (Collapsed repeats can push
a window above the strain count, so read the signal as relative, not an exact
genome tally.)

<Figure caption="odgi depth across all 4.64 Mb of K12. The curve sits near 4 (all four strains traverse the graph there, so the sequence is core) and drops toward 1 over the accessory stretches private to fewer strains." src="/img/pangenome/depth.png" />

### Per-strain presence

The depth track sums every path into one curve.
[`odgi pav`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_pav.html)
splits that number per strain: over the same K12 windows it reports, for each
strain, the fraction of the window that strain's path traverses: 1 where the
strain is fully present, dropping toward 0 where the window is accessory in that
strain. Slice each strain's rows out of pav's table into its own bigWig and load
the set as one
[`MultiQuantitativeTrack`](/docs/user_guides/multiquantitative_track), a
subtrack per strain:

```bash
# cols: chrom start end name group pav
in_pggb odgi pav -i "/data/$gfa" -b /data/depth_windows.bed > pav.tsv
for strain in Sakai CFT073 NCTC86; do
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
        "bigWigLocation": { "uri": "ecoli_pggb_pav_Sakai.bw" }
      },
      {
        "type": "BigWigAdapter",
        "name": "CFT073",
        "bigWigLocation": { "uri": "ecoli_pggb_pav_CFT073.bw" }
      },
      {
        "type": "BigWigAdapter",
        "name": "NCTC86",
        "bigWigLocation": { "uri": "ecoli_pggb_pav_NCTC86.bw" }
      }
    ]
  }
}
```

Where the aggregate depth curve dips, this track shows _which_ strain is
missing: one row falls to 0 over its own accessory stretch while the others hold
at 1. It is the per-genome read of the same core/accessory signal the depth
curve summarizes.

<Figure caption="odgi pav over the same K12 windows, one row per non-K12 strain. Each row holds near 1 where that strain is present and drops to 0 over its own accessory stretches, and the gap patterns differ per strain, so a single dip in the aggregate depth curve resolves here into which strain accounts for it." src="/img/pangenome/pav.png" />

## Compared to `odgi viz`

odgi ships its own one-line renderer,
[`odgi viz`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_viz.html)
(`odgi viz -i graph.gfa -o graph.png`), and it is worth understanding next to
the four projections above, because it draws the graph the way the graph is
stored, which is exactly what makes a pangenome graph hard to read at first.

<Figure caption="The same four-strain graph drawn by odgi viz: one row per strain, filled where the strain traverses the graph and white where it does not (accessory sequence). The axis is graph node order (the pangenome sequence), not K12 coordinates, so nothing lines up with a gene or a chromosome position. The four JBrowse projections re-plot this same presence/absence on K12's coordinates instead." src="/img/pangenome/graph.png" />

`odgi viz` gives one row per strain, as the MAF and per-strain-presence tracks
do. But its horizontal axis is the graph's node order (the "pangenome sequence",
the order odgi lays the nodes out in), not any genome's coordinates. Sequence
every strain walks appears as a filled column across all rows, and accessory
sequence appears as a gap in the rows that skip it. That is the real structure
of the graph, but you cannot point at a gene on that axis, because no gene (and
no genome) is numbered in node order, and a locus can even sit in a different
left-to-right position than it occupies on any chromosome.

The four JBrowse projections keep the one-row-per-strain idea and throw the
node-order axis away, re-drawing everything on K12's actual coordinates:

- the **depth** track is `odgi viz`'s column coverage, summed into one curve.
- the **per-strain presence** track is its filled-vs-gap rows, windowed.
- the **MAF** track is those same rows at single-base resolution, colored by
  mismatch.
- the **variant matrix** is the points where the rows branch, one column each.

So `odgi viz` answers "what does the graph look like". JBrowse answers "what
does the graph say about this reference, here, beside the genes." The node-order
axis is what you trade away, and a real reference coordinate is what you get for
it.

## Reproduce it end to end

[`build_ecoli_pangenome_graph.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_ecoli_pangenome_graph.sh)
runs everything above in one shot:

```bash
bash scripts/build_ecoli_pangenome_graph.sh   # builds ./ecoli_pangenome_graph_build/jbrowse2
npx --yes serve ecoli_pangenome_graph_build/jbrowse2
```

It downloads the four RefSeq genomes, runs pggb, converts the wfmash PAF, VCF,
MAF, `odgi depth`, and `odgi pav` into the projections above, downloads JBrowse,
and writes a `config.json` with the four assemblies, per-strain gene tracks, the
five graph-derived tracks (synteny, variants, MAF, depth, per-strain presence),
and a default session (a stacked synteny view plus the K12 reference lane). It
also writes the `odgi viz` graph raster (`ecoli_pggb_graph.png`). It needs the
same tools listed under [What you need](#what-you-need).

The all-vs-all PAF sort and bigWig conversion spill large temp files. The
default `/tmp` is often a small in-memory tmpfs that they overflow, failing the
run mid-way. The script routes `TMPDIR` to a `tmp/` directory inside the build
output (on real disk) so a fresh run works out of the box. Export your own
`TMPDIR` before running to override it.

## See also

- [Minigraph-Cactus pangenomes](/docs/tutorials/pangenome_cactus)
- [All-vs-all synteny](/docs/tutorials/allvsall_synteny)
- [MAF track](/docs/user_guides/maf_track)
- [Multi-sample variant track](/docs/user_guides/multivariant_track)
- [PIF format](/docs/developer_guides/pif_format)
- [pggb](https://github.com/pangenome/pggb)
