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
| Whole-genome alignment | The multiple alignment, column by column                    | `pggb -M`, `hal2maf` + `taffy`                           | [MAF track](/docs/user_guides/maf_track)                           |
| Pangenome depth        | How many genomes cover each reference base (core/accessory) | `odgi depth`                                             | [quantitative track](/docs/config_guides/quantitative_track)       |

This tutorial builds a five-strain _E. coli_ pangenome with pggb and loads all
four projections. It uses the same five genomes as the
[all-vs-all synteny tutorial](/docs/tutorials/allvsall_synteny), which builds
the synteny projection alone from a plain minimap2 alignment. Here that same
projection falls out of the graph, alongside the variant and MAF projections a
graph additionally gives you.

The synteny projection alone also builds in a notebook: a `synteny_view` in
Python ([JBrowse Jupyter / anywidget](/docs/jbrowse_jupyter)) or R
([JBrowseR](/docs/jbrowser)) stacks these same strains from the all-vs-all PAF.

## What you need

- `docker`, for the pggb image (which also carries odgi), plus the cactus image
  if you build the rGFA graph below (it carries minigraph and gfatools)
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
segment length. `-p 90 -s 5000` suits a bacterial pangenome. `-c 4` is the one
easy flag to miss: pggb's separate `-c, --n-mappings` defaults to `1`, so `-n 5`
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
five-strain demo that way and loads the same four projections.
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

It is in **beta** and not in the [plugin store](/docs/user_guides/plugin_store)
yet, but it is a native ES module and loads from any config today (see
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

That is the build the graph figures on this page were captured with. Once it is
installed you get the **Add, then Graph genome view** menu item. The projection
tracks below need none of this.

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
between five _E. coli_ strains a few hundred bp already carries a dozen bubbles.
Node lengths are scaled the way Bandage scales them, derived per graph so the
mean drawn node lands at a usable size. That is what keeps a 1 bp SNP allele and
a 164 bp backbone segment on one picture, with the SNP alleles as the specks, in
proportion. A few hundred bp is what makes that structure legible, not what the
view can load.

<Figure caption="A 461 bp slice of the five-strain graph, 54 nodes over 5 paths, under the MAF alignment of the same locus. The graph's five paths and the MAF's five rows are the same five strains: IAI39 is the row that diverges, and the darker specks strung along the graph backbone are what it diverges by. A pggb GFA tags no segment with a position, so the two panels line up as a locus, not node by node; the only coordinates in the file are the ones inside the path names, which is where K12:1,004,500-1,004,961 comes from. Node color is depth, how many strains traverse that node." src="/img/pangenome/local_subgraph.png" />

### rGFA graphs carry their own coordinates

A pggb or Minigraph-Cactus GFA has no coordinates on its segments. The only
reference positions in the file live inside the P/W lines, which is why a
subgraph has to be cut with `odgi extract` and why the layout above has to
_infer_ a backbone by force simulation.

[rGFA](https://github.com/lh3/gfatools/blob/master/doc/rGFA.md), what minigraph
emits, is different: every segment carries the stable sequence it sits on, its
offset there, and its rank, so the graph states its own reference backbone. The
[HPRC tutorial](/docs/tutorials/pangenome_hprc#regular-gfa-vs-rgfa) shows those
three tags on a real segment line.

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
  /data/CFT073.pansn.fa /data/NCTC86.pansn.fa" > ecoli_minigraph.rgfa

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
backbone), 1 is sequence first added when Sakai was folded in, 2 when CFT073
was, 3 when NCTC86 was. So a rank-3 segment is sequence none of the three
assemblies before it had. Only rank 0 has reference coordinates, which is why it
is the only rank a linear view of K12 can show. A minigraph graph is also far
less fragmented than a pggb one, since it records structural variation rather
than every SNP, so a legible window is hundreds of kb rather than hundreds of
bp.

That rank-ladder layout is anchored to K12, so it lines up with a linear view of
the same window — the
[indexed figure below](#opening-any-locus-without-a-slice-per-locus) shows the
pair. The toolbar's **Layout** dropdown trades that correspondence for the
classic Bandage picture of the same subgraph (**Force-directed layout**), where
the backbone is placed by the force simulation rather than on the reference
axis, so alternate alleles fall out as bubbles off it rather than as rows
beneath it; the
[MHC figure](/docs/tutorials/pangenome_hprc#open-a-locus-as-a-graph) shows that
mode beside a linear view.

A third mode, **Sample rows**, gives each contributing assembly its own row on
the same reference axis, so an allele reads as "which strains carry it" rather
than "which rank it is". Like the anchored layout it reads the rGFA tags, so it
is unavailable for a plain GFA such as the pggb subgraph above.

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

`RgfaTabixAdapter` ships in the same plugin as the view, so this track needs it
too, not only the launch item.

The segments now draw as features in a linear view, and the graph for whatever
is on screen is one menu away, up to 100 kb:

<Figure caption="Track menu, then Launch view, then Graph genome view (this region), on the rGFA segments track. Offered only for a track whose adapter can cut a subgraph." src="/img/pangenome/rgfa_launch_menu.png" />

Right-clicking one segment cuts the graph around that segment instead:

<Figure caption="Right-click on backbone segment s1277 (glnA to yihN), then Launch view, then Graph genome view (this segment). The launched window, chr:4,053,156-4,067,028, is the segment plus half its length on each side: blue rank-0 backbone, two short rank-1 alleles, and the long purple rank-2 allele CFT073 carries there." src="/img/pangenome/rgfa_segment_neighbourhood.png" />

A `color` jexl on the segment's `rank` paints the track in the graph's own
Stable rank colors, so a segment is the same color in both panels:

```json
"displayDefaults": {
  "color": "jexl:get(feature,'rank')==0?'rgb(52,152,219)':'rgb(237,137,44)'"
}
```

<Figure caption="50 kb of K12 launched as a graph. Both panels read the same two tabix indexes, so the blue blocks above are the blue rank-0 backbone below, same ids at the same offsets. The orange, red and purple alleles have no K12 coordinates, which is why the linear track has nothing to show for them." src="/img/pangenome/rgfa_subgraph_launch.png" />

### Which strain takes which path

The two indexes above say what the graph contains, not who carries what: rGFA's
`SR` tag is build order, not sample. minigraph will recompute the walks anyway,
by aligning each assembly back to the graph (`minigraph -cxasm --call`), which
emits one line per bubble per sample, over the same bubbles `gfatools bubble`
lists and in the same order, each carrying the path that sample takes and its
length in the graph.
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

`partitionField` gives each strain its own row. `lengthField` is the one that
matters here: a block can only be as wide as the reference it covers, and an
allele that _inserts_ sequence covers almost none of it, so without this a 113
kb insertion and a 1 bp one draw the same box. Pointed at the BED's signed
`delta` column, it draws the insertion and deletion marks the
[alignments track](/docs/user_guides/alignments_track) uses, so the length is on
the glyph rather than hidden in a tooltip.

<Figure caption="One 3.4 kb bubble at K12 chr:1,094,197-1,097,573, read three ways: the genes above, the graph's segments in the middle, and each strain's path through the bubble below. Sakai and CFT073 replace those 3.4 kb with 113 kb and 110 kb of their own sequence, NCTC86 with 41 kb, and IAI39 deletes 3.2 kb of it. K12's row is the reference path, and is grey at all 601 bubbles." src="/img/pangenome/rgfa_strain_paths.png" />

The BED keeps the segment ids each strain traverses in a `path` column, so the
rows tie back to the graph panel: at that bubble Sakai and CFT073 differ only in
their first segment, which is why their alleles are within 3 kb of each other,
and IAI39's path opens with `<s2607`, a reverse traversal.

### Finding the sites worth looking at

601 bubbles is more than you want to scroll past, so each row also carries what
that bubble looks like across all the strains. Both are jexl filters from **Edit
filters** in the track menu:

| Column    | What it is                                     | Use it for                                                                            |
| --------- | ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| `alleles` | distinct paths anyone actually takes here      | `jexl:get(feature,'alleles')>2` cuts to the multi-allelic sites                       |
| `nonRef`  | how many strains leave the reference path      | `jexl:get(feature,'nonRef')==1` finds the singletons, `==4` the sites K12 alone lacks |
| `strand`  | the orientation the strain's contig aligned in | `jexl:get(feature,'strand')==-1` selects inverted alleles                             |

The five-strain graph splits 436 biallelic bubbles, 105 with three alleles, 37
with four, and **23 where all five strains carry something different**. That is
an allele-frequency spectrum, and the 23 are the hypervariable loci.

`alleles` counts alleles someone carries, which is not the path count
`gfatools bubble` reports: that one counts routes combinatorially and saturates
at `2147483647` on a real pangenome. `nonRef` is also a different question from
the
[depth and presence projections](#pangenome-depth-projection-core-vs-accessory)
below, which answer whether a haplotype is _present_ over a window, not whether
it _differs_ there.

Inversions come out of `strand`: 169 of IAI39's calls aligned reverse and none
of any other strain's, in long contiguous runs (1,671,139-1,870,074 is one),
which is what a large inversion looks like bubble by bubble. It is a separate
column rather than a `class` value because the two are independent, and the data
says so loudly: those 169 reverse calls split 60 reference-length, 57 deletions
and 52 insertions.

Rows can also be reordered by what they share: **Clustering, then Cluster rows
by similarity** groups strains by which alleles they carry at which bubbles, so
haplotypes with the same structural content sit together and the dendrogram
shows how they relate. On five strains that is a sanity check; on a few hundred
haplotypes it is the analysis.

### What this projection cannot show

`gfatools bubble` reports **top-level** bubbles only, and on this graph they
never overlap (0 of 601), which is what makes one flat lane per strain a
complete picture rather than a lossy one. The cost is that variation nested
_inside_ a bubble is invisible here: a 113 kb allele is one block, not the SNPs
and small indels within it. Graph browsers built for that view, like
[PangyPlot](https://github.com/ScottMastro/pangyplot), decompose the graph into
nested bubbles and chains (via
[BubbleGun](https://github.com/fawaz-dabbaghieh/bubble_gun)) so a bubble can be
expanded in place. In JBrowse the nested tier comes from the other direction:
the [pangenome variants projection](#pangenome-variants-projection) below is
`vg deconstruct` output, whose `LV` and `PS` fields carry exactly that snarl
nesting. Read the two together, the graph route for structure and the VCF route
for what is inside it.

This route needs the assemblies, but it does not need the graph to carry its
haplotypes: minigraph rGFA records no P or W lines. A graph that _does_ carry
them (pggb, odgi, the base-level Minigraph-Cactus graph) needs no re-mapping at
all, because `pggb -V` and `vg deconstruct` turn those same walks into the
variant projection below.

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
    "uri": "ecoli_pggb_ava.pif.gz",
    "assemblyNames": ["K12", "Sakai", "CFT073", "NCTC86"]
  }
}
```

Stack the five strains in a linear synteny view exactly as the
[all-vs-all tutorial](/docs/tutorials/allvsall_synteny#stacking-the-genomes)
describes. The PanSN `sample#` prefix on every PAF record is how the adapter
maps a record to its strain.

<Figure caption="The all-vs-all synteny projection: the five strains stacked K12 to IAI39, a ribbon between each adjacent pair drawn from the graph's wfmash PAF. Continuous diagonal ribbons are shared backbone, and the crossings and gaps are where the strains rearrange or carry accessory sequence." src="/img/multiway_synteny/ecoli_pangenome.png" />

## Pangenome variants projection

`pggb -V K12` writes a VCF of every variant the graph decomposes against the K12
path, genotyped across the other four strains, the pangenome as a table of
differences. Its `CHROM` is the PanSN reference path (`K12#1#chr`), so rename it
to match the K12 assembly's reference sequence name (`chr`), then bgzip and
tabix:

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

Stacking the MAF alignment (the whole-genome alignment projection, below) over
the same window turns the variant rows from a standalone summary into something
you can check: each band of shared or absent genotype sits directly above the
per-strain alignment it was decomposed from.

<Figure caption="The graph's pangenome variants on the K12 reference across the colanic-acid cluster (wca/wz), one row per strain, with the MAF alignment stacked below and the K12 gene lane above. Each column is a variant the graph called, colored by that strain's genotype (see the legend); a run of the same color across rows is a stretch those strains share." src="/img/pangenome/pangenome_variants.png" />

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
    "uri": "ecoli_pggb.taf.gz"
  }
}
```

<Figure caption="The graph's whole-genome alignment projected onto K12 across 60 kb spanning the fim, mcr and hsd loci: the coverage band on top, then one row per strain (K12 reference first), each colored where it differs from K12, with the variant calls above. Where a row goes blank the strain has no alignment to K12 at all, so the accessory structure and the SNP divergence read in the same picture." src="/img/pangenome/maf.png" />

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

Zoomed out, the track reads as the pangenome's core/accessory landscape along
K12: a mostly-flat plateau near the strain count, dropping over the accessory
stretches the variant and MAF projections zoom into. (Collapsed repeats can push
a window above the strain count, so read the signal as relative, not an exact
genome tally.)

<Figure caption="odgi depth across all 4.64 Mb of K12. The curve sits near 5 (every strain traverses the graph there, so the sequence is core) and drops toward 1 over the accessory stretches private to fewer strains." src="/img/pangenome/depth.png" />

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

<Figure caption="The same five-strain graph drawn by odgi viz: one row per strain, filled where the strain traverses the graph and white where it does not (accessory sequence). The axis is graph node order (the pangenome sequence), not K12 coordinates, so nothing lines up with a gene or a chromosome position. The four JBrowse projections re-plot this same presence/absence on K12's coordinates instead." src="/img/pangenome/graph.png" />

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
- the **variant track** is the points where the rows branch, one column each.

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
also writes the `odgi viz` graph raster (`ecoli_pggb_graph.png`), the two
graph-view subgraphs (`ecoli_pggb_subgraph.gfa` and `ecoli_rgfa_slice.gfa`), and
the rGFA tabix indexes behind the browsable segments track, all of which need
the cactus image for minigraph and gfatools. The `config.json` it writes
declares the graph genome view plugin, so the graph track and the launch menu
item work in that build with nothing to install. It needs the same tools listed
under [What you need](#what-you-need).

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
