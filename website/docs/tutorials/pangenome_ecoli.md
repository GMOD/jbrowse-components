---
title: Pangenome (pggb)
description:
  Build a five-strain pggb pangenome graph and load its linear projections plus
  the graph itself in JBrowse
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
data: pipeline
---

**TL;DR:** build a five-strain _E. coli_ graph with pggb, then load its linear
projections (synteny, pangenome variants, whole-genome MAF, depth and per-strain
presence) as ordinary JBrowse tracks on the K12 axis, and draw the graph itself
beside them.

:::caution Experimental

The graph view is a beta plugin, and this tutorial covers experimental ideas. We
welcome your [feedback](/contact).

:::

## Prerequisites

- `docker` or `singularity`, for the pggb image, which also carries odgi
- the NCBI
  [`datasets`](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/download-and-install/)
  CLI
- `samtools`, `bedGraphToBigWig` (UCSC kentUtils)
- `python3`, htslib (`bgzip`, `tabix`), `unzip`
- `node`, for the [JBrowse CLI](/docs/cli)
- the GraphGenomeView plugin, for [the graph itself](#installing-the-plugin);
  every other track here is a built-in type

On Debian/Ubuntu, `apt install samtools tabix unzip python3` covers four of
those. Docker installs from
[docs.docker.com](https://docs.docker.com/engine/install/); the NCBI `datasets`
CLI and `bedGraphToBigWig` are each a
[single-binary download](https://hgdownload.soe.ucsc.edu/admin/exe/); and `node`
comes from [nodejs.org](https://nodejs.org/). Everything else runs inside the
pggb image.

## The linear projections

A pangenome graph collapses many genomes into one structure: shared sequence is
a single path that every sample walks, and where samples differ the path
branches. [pggb](https://github.com/pangenome/pggb),
[Minigraph-Cactus](https://github.com/ComparativeGenomicsToolkit/cactus/blob/master/doc/pangenome.md),
and [progressiveCactus](https://github.com/ComparativeGenomicsToolkit/cactus)
build these graphs, and [odgi](https://github.com/pangenome/odgi) manipulates
them.

Bacterial pangenomes are often built the other way, from annotations rather than
from sequence: [Panaroo](https://github.com/gtonkinhill/panaroo),
[Roary](https://sanger-pathogens.github.io/Roary/) and
[PPanGGOLiN](https://github.com/labgem/PPanGGOLiN) cluster genes across
assemblies into a core and an accessory set. Those give the gene table, these
tracks give where the sequence sits: a gene cluster no reference carries has no
reference coordinate and cannot be drawn on the K12 axis at all.

Most of what JBrowse draws are the graph's **linear projections**: the same
graph flattened onto one reference genome's coordinates. Every builder emits
them, so a graph built with any of these tools lands on track types you already
have:

| Projection             | What it shows                                               | From the graph                                        | JBrowse track                                                      |
| ---------------------- | ----------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------ |
| Synteny                | The blocks each pair of genomes shares                      | `odgi untangle`, `halSynteny`                         | [synteny track](/docs/config_guides/synteny_track)                 |
| Pangenome variants     | Every difference the graph calls, across all samples        | `pggb -V`, `cactus-pangenome --vcf`, `vg deconstruct` | [multi-sample variant track](/docs/user_guides/multivariant_track) |
| Whole-genome alignment | The multiple alignment, column by column                    | `pggb -M`, `hal2maf`                                  | [](/docs/user_guides/maf_track)                                    |
| Pangenome depth        | How many genomes cover each reference base (core/accessory) | `odgi depth`, `odgi pav`                              | [quantitative track](/docs/config_guides/quantitative_track)       |

This tutorial builds a five-strain _E. coli_ pangenome with pggb, loads each
projection, and draws the graph itself. It uses the same five genomes as the
[all-vs-all synteny tutorial](/docs/tutorials/allvsall_synteny), which builds
the synteny projection alone from a plain minimap2 alignment.

## Building the graph with pggb

pggb takes one FASTA of all the genomes,
[PanSN](https://github.com/pangenome/PanSN-spec)-named
`sample#haplotype#contig`. The naming is load-bearing: wfmash's `-Y '#'` (on by
default) skips a mapping whose query and target share the prefix before the last
`#`, which stops a genome being aligned to itself, and `-V` reads the same
prefix to assign each VCF sample and phase. Concatenate the five strains
(haplotype `1`, these being haploid bacterial assemblies) and index the result.
Chromosomes only, so no plasmid reaches the graph:

```bash
for strain in K12 Sakai CFT073 NCTC86 IAI39; do
  awk -v s="$strain" '/^>/{print ">" s "#1#chr"; next} {print}' "$strain.fa"
done > all.fa
bgzip all.fa
samtools faidx all.fa.gz
```

Then run pggb. The image pins all five tools the pipeline is made of at once;
pggb's
[installation docs](https://pggb.readthedocs.io/en/latest/rst/installation.html)
cover the alternatives. `-V K12:10000` decomposes the graph into a VCF against
the K12 path and `-M` writes the multiple alignment as a MAF. The image also
carries [odgi](https://github.com/pangenome/odgi), which the untangle, depth,
presence and subgraph sections reuse, so wrap the `docker run` once as
`in_pggb`:

```bash
in_pggb() {
  docker run --rm -u "$(id -u):$(id -g)" -w /data -v "$PWD":/data \
    ghcr.io/pangenome/pggb:202603141454453ade6b "$@"
}

in_pggb pggb -i /data/all.fa.gz -o /data/pggb \
  -n 5 -c 4 -p 90 -s 5000 -V K12:10000 -M -t "$(nproc)"
```

- `-n` is the number of haplotypes, `-p` the minimum alignment identity and `-s`
  the segment length; `-p 90 -s 5000` suits a bacterial pangenome.
- `-c` is the number of mappings wfmash keeps per segment and defaults to `1`,
  so it has to be raised alongside `-n` or the graph comes out under-connected.
- The dated build tag rather than `:latest` keeps the graph reproducible.
- Under singularity,
  `singularity exec --bind "$PWD":/data --pwd /data docker://<image>` replaces
  the wrapper body and leaves every call after it unchanged.

Five bacterial chromosomes are minutes on a laptop. The
[build script](#reproduce-it-end-to-end) picks the runtime off `PATH` and
carries the pggb flags that are easy to get wrong.

pggb runs [wfmash](https://github.com/waveygang/wfmash) (all-vs-all alignment),
[seqwish](https://github.com/ekg/seqwish) (induces the graph),
[smoothxg](https://github.com/pangenome/smoothxg) (normalizes it) and
[gfaffix](https://github.com/marschall-lab/GFAffix) (collapses shared prefixes),
then `odgi` for the visualizations and `vg deconstruct` for the `-V` step. The
output directory holds everything the sections below load: the graph
(`*.smooth.final.gfa` and its `.og`), the all-vs-all PAF, both VCF tiers, and
the MAF. It also already holds pggb's own 1D and 2D renderings of the graph
(`*.viz_*.png` from `odgi viz`, `*.lay.draw.png` from `odgi layout`), unless you
passed `-v`.

Resolve the graph's two spellings once. Every odgi command below refers to them,
and the glob has to expand on the host, since a `/data/*.gfa` inside the
container is passed through as a literal:

```bash
gfa=$(ls pggb/*.smooth.final.gfa)
og=$(ls pggb/*.smooth.final.og)
```

`.og` is odgi's own succinct serialization of that same graph, so every odgi
command below reads it rather than reparsing the GFA. The GFA is what the tabix
index is built from, since that walk reads P and W lines as text.

## Synteny projection

Two files answer this, and the difference between them is worth a track each.

### The alignment the graph was induced from

pggb's first step is a wfmash all-vs-all PAF, the same input the
[all-vs-all synteny tutorial](/docs/tutorials/allvsall_synteny) loads. It is
pggb's **input** rather than a readout of the finished graph, and it comes for
free. Index it once with `jbrowse make-pif` and load it with an
[`AllVsAllIndexedPAFAdapter`](/docs/config/allvsallindexedpafadapter), so a
range query fetches only the region in view:

```bash
cp pggb/*.alignments.wfmash.paf ecoli_pggb_ava.paf
jbrowse make-pif ecoli_pggb_ava.paf   # -> ecoli_pggb_ava.pif.gz (+ .tbi)
```

```json addtrack
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

<Figure caption="The wfmash alignment pggb induced the graph from: five strains stacked K12 to IAI39, a ribbon between each adjacent pair. The crossings in the bottom band are IAI39's inversions." src="/img/pangenome/pggb_synteny.png" />

The all-vs-all tutorial draws these same strains from a `minimap2 -c` PAF and
the two pictures nearly agree: two independent pairwise aligners place the
backbone and IAI39's inversions the same way. What differs is the grain, since
wfmash merges each pair into a few dozen long segments where minimap2 leaves
several hundred, so the same `minAlignmentLength` cuts far less here.

Before reusing this file elsewhere: wfmash maps in both directions, so every
pair is in the PAF twice, once as query and once as target, over the same spans.
A synteny view draws both, and the ribbons come out twice as opaque as the same
alignment from a one-directional file.

### The same picture read out of the graph

[`odgi untangle`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_untangle.html)
is the projection proper. It walks each query path and reports, segment by
segment, which stretch of the reference path that query traverses, so it states
homology as the graph resolved it, after seqwish and smoothxg had their say.
Sequence that collapsed into one set of nodes comes back as several query
segments pointing at the same reference span, the paralogy a pairwise PAF has no
way to express.

`-p` asks for PAF, so `make-pif` reads the output with nothing in between:

```bash
printf 'K12#1#chr\n' > target.txt
printf 'Sakai#1#chr\nCFT073#1#chr\nNCTC86#1#chr\nIAI39#1#chr\n' > query.txt
in_pggb odgi untangle -i "/data/$og" \
  -R /data/target.txt -Q /data/query.txt -m 1000 -j 0.5 -e 5000 -p -t "$(nproc)" \
  > ecoli_pggb_untangle.paf
jbrowse make-pif ecoli_pggb_untangle.paf
```

`-m` merges runs shorter than it into the previous segment, since otherwise
every SNP node starts a new one, and `-j` keeps mappings at or above a jaccard.
untangle leaves PAF column 10 at 0 and writes no CIGAR, since it reports a
jaccard over graph steps rather than a base alignment. It states its identity in
an `id:f:` tag instead, which is what a synteny track reads on a record carrying
no `de:f:`, so the blocks color by untangle's own number and nothing has to be
filled in.

`-e` is the one to think about. untangle starts a segment where the graph stops
agreeing, which on a near-colinear bacterial pangenome is rare, so without it
this graph gives a few dozen blocks per pair and every ribbon spans its frame.
`-e` forces a boundary every N bp of the sorted graph instead, which is what
makes both figures below readable. The cut is baked into the file and cannot be
undone downstream, so leave it off on a graph with many haplotypes, where
untangle finds plenty of boundaries by itself. The
[Minigraph-Cactus tutorial](/docs/tutorials/pangenome_cactus#all-vs-all-synteny-projection)
hits the same limit from the other direction and uses `halSynteny` instead.

Load it as its own `SyntenyTrack`, the same adapter as the wfmash track above:

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "ecoli_pggb_untangle",
  "name": "pggb graph: synteny from the graph (odgi untangle)",
  "assemblyNames": ["K12", "Sakai", "CFT073", "NCTC86", "IAI39"],
  "adapter": {
    "type": "AllVsAllIndexedPAFAdapter",
    "uri": "ecoli_pggb_untangle.pif.gz",
    "assemblyNames": ["K12", "Sakai", "CFT073", "NCTC86", "IAI39"]
  }
}
```

One difference matters when you stack it: untangle projects queries onto a
**target** path, so every record has K12 on one side, where the wfmash PAF is
genuinely all-vs-all. Put the reference between the strains you want to compare
rather than at the top of the stack, or the bands between two non-reference rows
have nothing to draw.

Whole-genome, the result is the near-colinear diagonals the wfmash figure
already shows. Where the two files part company is a repeat. Find one by looking
for a reference span that more than one segment of the same query lands on:

```bash
zcat ecoli_pggb_untangle.pif.gz | awk -F'\t' 'substr($1,1,1)=="q"' \
  | cut -f1,3,4,8,9 | sort -k4,4n
```

Two K12 spans come back that way, `chr:3,941,447-3,944,255` and
`chr:4,169,192-4,171,723`, and Sakai, NCTC86 and IAI39 each reach both of them
from two places. CFT073 reaches neither twice, which is the control. A pairwise
PAF has no way to say this: its records are one query interval against one
target interval, so a collapsed repeat is either dropped or arbitrarily assigned
to one copy.

A [dotplot](/docs/user_guides/dotplot_view) reads the same PIF and answers a
different question: how the two genomes are arranged relative to each other. A
stretch the strain traverses backwards descends instead of climbing, so every
inversion is visible at once without knowing where to look.

<Figure caption="The untangle projection as a dotplot, K12 against IAI39. The descending segments are inversions, and the boxed one is the 594 kb arm boxed again in the per-strain figure below." src="/img/pangenome/pggb_untangle_dotplot.png" />

Untangle is much the slower of the two, since it indexes every step of every
path rather than reading an alignment off disk. On a base-level graph, budget
for it or restrict `-Q` to the paths you need.

### One lane per strain, on the K12 axis

A dotplot takes two genomes at a time. The same records drawn as a
[multi-row feature track](/docs/config/linearmultirowfeaturedisplay) put every
strain on the reference at once, one row each, so orientation becomes something
you read down a column rather than pair by pair. PAF column 5 is the strand each
segment traverses the reference in, which is the only column here the variant
and MAF projections cannot state at all.

`untangle_to_bed.py` projects the PAF onto the per-strain BED schema
[`build_minigraph_paths.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_minigraph_paths.sh)
already defines, so `partitionField` and the colors carry across unchanged. The
bubble-decomposition columns untangle does not report (`class`, `delta`, `path`
and the rest) are left empty rather than dropped, so a consumer reading them
positionally does not pick up this file's `selfCov` as `class`. `lengthField`
has nothing to read here, because untangle reports no length change:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/untangle_to_bed.py
python3 untangle_to_bed.py ecoli_pggb_untangle.paf chr > ecoli_pggb_untangle_rows.bed
# keep the header first, sort the rest
(head -1 ecoli_pggb_untangle_rows.bed
 tail -n +2 ecoli_pggb_untangle_rows.bed | sort -k1,1 -k2,2n) \
  | bgzip > ecoli_pggb_untangle_rows.bed.gz
tabix -p bed ecoli_pggb_untangle_rows.bed.gz
```

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "ecoli_pggb_untangle_rows",
  "name": "pggb graph: untangle per strain (orientation, vs K12)",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "BedTabixAdapter",
    "uri": "ecoli_pggb_untangle_rows.bed.gz"
  },
  "displays": [
    {
      "type": "LinearMultiRowFeatureDisplay",
      "partitionField": "strain",
      "rowOrder": ["Sakai", "CFT073", "NCTC86", "IAI39"],
      "legend": [
        { "label": "Same orientation as K12", "color": "rgb(153,153,153)" },
        { "label": "Inverted", "color": "rgb(214,39,40)" }
      ]
    }
  ]
}
```

`partitionField` gives each strain its own row, and the colors are in the file's
own `itemRgb`, so nothing here can drift from what the file says. The white gaps
are where a strain has no untangle segment on that stretch of K12 at all, which
is the same accessory sequence the depth and presence projections below measure.

<Figure caption="odgi untangle over the whole K12 chromosome, one row per strain, red where the strain runs backwards and white where it has no segment at all. Only IAI39 is inverted at length." src="/img/pangenome/pggb_untangle_rows.png" />

A red band is one column of the untangle PAF and a descending run in the dotplot
is the same file read as coordinates rather than as a strand flag. The box marks
the same 594 kb arm in each: the dotplot says what the arm is, the per-strain
rows say who has it.

The same inversions are in the synteny figures above as ribbon crossings, but
only whole-genome and only between the two rows in view. `selfCov` in the popup
carries the other half: above 1 where a segment lands on a reference span the
same strain also lands on elsewhere, so `jexl:feature.selfCov>1` in **Edit
filters** cuts the lane to the collapsed repeats.

## Pangenome variants projection

`pggb -V` writes a VCF of every variant the graph decomposes against the K12
path, genotyped across the other four strains. Its `CHROM` is the PanSN
reference path (`K12#1#chr`), so rename it to the K12 assembly's refName
(`chr`), with `bcftools` rather than `sed` so the substitution cannot reach
`INFO/AT` or `PS`. It ships in the pggb image, so this needs no extra install:

```bash
printf 'K12#1#chr\tchr\n' > rename_chrs.tsv
in_pggb bash -c "bcftools annotate --rename-chrs /data/rename_chrs.tsv \
  /data/pggb/*.smooth.final.K12.decomposed.vcf \
  | bcftools sort -Oz -o /data/ecoli_pggb.vcf.gz && tabix -p vcf /data/ecoli_pggb.vcf.gz"
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

Stack the MAF alignment (below) in the same window and the calls sit over the
alignment they were decomposed from, which is the figure under
[Whole-genome alignment (MAF) projection](#whole-genome-alignment-maf-projection).
Read that figure down a column rather than across a row: the two lanes share
coordinates but not row order, since the variant lane follows the VCF's sample
columns and the MAF lane follows the tree the track loads. A strain's no-call
block and its gap in the alignment are the same event twice.

### Why the reference path takes a length

A graph VCF is a snarl **tree**, which an ordinary callset is not.
`vg deconstruct` emits a record per snarl at every level, each carrying `LV`
(its level, `0` at the top) and `PS` (its parent), so the file holds both a
bubble and the variants nested inside it. Those wide records draw over the fine
layer they were decomposed from, painting a flat block across the rows that
carry them and hiding every SNP underneath.

That is why the `-V` spec takes `REF:LEN` rather than a bare `REF`. With a
length, pggb also runs [`vcfbub`](https://github.com/pangenome/vcfbub)
`-l 0 -a LEN` piped into [`vcfwave`](https://github.com/vcflib/vcflib) and
writes the result beside the raw file as `*.decomposed.vcf`, which is what the
track above loads.

`vcfbub` **pops** any site whose alleles run past `LEN`, emitting the nested
sites inside it in its place, so records with `LV` above 0 survive by design.
The property that matters is the width cap: on this graph the longest reference
allele goes from hundreds of kilobases to under `LEN`, leaving nothing wide
enough to paint over the layer beneath it, which is why the track needs no
display filter. `vcfwave` then realigns what survives into primitive variants.

`LEN` is a cost knob as much as a filter: vcfwave realigns every allele vcfbub
keeps, so the step is dominated by the longest ones, and HPRC's own `-a 100000`
runs far longer on this graph than `-a 10000` does. Structural variation that
large reads better in the graph view or the per-strain path track anyway.

Keep the raw file too, through the same rename, and load it as a second track:

```bash
in_pggb bash -c "bcftools annotate --rename-chrs /data/rename_chrs.tsv \
  /data/pggb/*.smooth.final.K12.vcf \
  | bcftools sort -Oz -o /data/ecoli_pggb_snarls.vcf.gz && tabix -p vcf /data/ecoli_pggb_snarls.vcf.gz"
```

It is where the graph structure lives: `LV`/`PS` give the snarl tree, and `AT`
states each allele as the segment ids it traverses (`AT=>2>4>5,>2>3>5`), which
are the same ids the graph view labels its nodes with. Filter it on `LV` in
**Edit filters** to pick one level of the tree. The coarse tier below is built
from its `LV=0` records.

The [multi-sample variant track guide](/docs/user_guides/multivariant_track)
covers the matrix versus the per-position display, genotype coloring, and
clustering samples by genotype.

## Whole-genome alignment (MAF) projection

`pggb -M` writes the multiple alignment as a MAF, which JBrowse reads as a
[](/docs/config_guides/maf_track). Its blocks are smoothxg's **POA blocks**
rather than homology blocks, with two consequences.

**Block order.** pggb orders each block from its longest path, so the block's
reference row is not consistently the same genome, where a MAF track projects
onto a single reference. Re-root every block on K12 (dropping blocks that lack
it) and rename the PanSN names to `sample.chr`, so the MAF display can split
each row's species off on the `.`:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/reroot_maf.py
# reroot_maf.py keeps K12-containing blocks, puts K12 first (+ strand), sorts by
# K12 position, and gives each K12 row in a repeat-collapsed block its own block
python3 reroot_maf.py pggb/*.smooth.maf ecoli_pggb.maf K12#1#chr
```

[`reroot_maf.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/reroot_maf.py)
ships with the reproducible build below. One block per reference row matters
because an index keys a block on its first row, so a repeat's second copy is
only queryable once it anchors a block of its own.

**Block padding.** A smoothxg bug leaves its own block padding on some rows,
which a consumer reading indels off the columns sees as a phantom insertion at
every POA block boundary.
[pangenome/smoothxg#223](https://github.com/pangenome/smoothxg/pull/223) fixes
it upstream, and no published pggb image carries the fix yet, so `reroot_maf.py`
crops around it.

Then convert the MAF to the tabix-indexed BED the
[`MafTabixAdapter`](/docs/config/maftabixadapter) reads, one line per block
carrying that block's rows. The usual converter,
[maf2bed](https://github.com/cmdcolin/maf2bed), picks the reference row by
assembly name and emits one line per block, which would undo the split
`reroot_maf.py` just made. `maf_to_bed.py` takes row 0 as the reference and
keeps it:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/maf_to_bed.py
python3 maf_to_bed.py ecoli_pggb.maf ecoli_pggb.maf.bed
bgzip ecoli_pggb.maf.bed
tabix -p bed ecoli_pggb.maf.bed.gz
```

The row order comes from the graph rather than from the strain list.
[`odgi similarity`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_similarity.html)
reports how much of the graph each pair of samples shares, in seconds on a
bacterial pangenome, and UPGMA over `1 - estimated.identity` turns that into the
Newick the track reads as `nhLocation`:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/odgi_similarity_to_newick.py
in_pggb odgi similarity -i "/data/$og" -D '#' -p 1 > ecoli_pggb_similarity.tsv
python3 odgi_similarity_to_newick.py ecoli_pggb_similarity.tsv ecoli_pggb.nh
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
    "nhLocation": { "uri": "ecoli_pggb.nh" },
    "uri": "ecoli_pggb.maf.bed.gz"
  }
}
```

<Figure caption="The graph's whole-genome alignment projected onto K12, one row per strain in the tree's order, with the variant calls above. A blank row is a strain with no alignment to K12 there." src="/img/pangenome/maf.png" />

`samples` still names and labels the rows, so a tree that fails to build leaves
the track working.

A cell in the variant lane is grey where that strain matches K12, blue where it
carries the alternate allele, and olive where the site is uncalled. The numbered
purple boxes are insertion markers, the number being how many bases that
strain's allele adds beyond K12. They need a marker because an insertion
consumes no reference: the record spans a single base, so without one it would
draw at the width of a SNP whatever its length. Each strain carrying an
insertion here has its own record, of its own length, rather than all of them
sharing one.

The alignment below states the same insertions differently. A MAF carries one as
columns the reference row gaps through, and the display draws those with the
same marker; here the strains stop aligning to K12 at that coordinate, so the
inserted sequence falls between alignment blocks rather than inside one and
those rows are left blank.

The [MAF track guide](/docs/user_guides/maf_track) covers the conservation band,
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

<!-- from: scripts/build_ecoli_pangenome_graph.sh -->

```bash
reflen=$(awk -v p="K12#1#chr" '$1 == p {print $2}' all.fa.gz.fai)
awk -v p="K12#1#chr" -v len="$reflen" -v w=500 \
  'BEGIN { for (s = 0; s < len; s += w) { e = s + w; if (e > len) e = len
           print p "\t" s "\t" e } }' > depth_windows.bed

# -b gives one row per window instead of per base, so the window size above is
# the resolution of the curve; the awk drops the PanSN prefix for the plain
# refName the K12 assembly uses
in_pggb odgi depth -i "/data/$og" -b /data/depth_windows.bed |
  awk -v p="K12#1#chr" -v OFS='\t' '$1 == p && $4 + 0 == $4 { print "chr", $2, $3, $4 }' |
  sort -k1,1 -k2,2n > ecoli_pggb_depth.bedgraph

printf 'chr\t%s\n' "$reflen" > chrom.sizes
bedGraphToBigWig ecoli_pggb_depth.bedgraph chrom.sizes ecoli_pggb_depth.bw
```

`-b` is the whole trick: odgi reports one row per window rather than per base,
with the mean depth in column 4, so the window size is the resolution of the
curve. The awk in the middle does the renaming, dropping the PanSN `K12#1#chr`
for the `chr` the assembly uses, which is why `chrom.sizes` is written by hand
rather than cut from the `.fai`.

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
plateau near the strain count, spikes past it over the rRNA operons the graph
collapses into one copy, and troughs at 1 over K12's private sequence, which is
mostly cryptic prophages and IS elements. It is drawn
[at the end of this section](#per-strain-presence), under the per-strain rows
that say which strain each trough is missing. There is no gene lane at that
zoom, since 4.6 Mb of K12 is more features than a `FeatureTrack` will draw, so
zoom into one trough and the lane names it, which is what the figure below does
for the widest of them.

An unrelated isolate's long reads say the same thing without the graph. These
are nanopore reads from _E. coli_ E146
([ENA DRR193901](https://www.ebi.ac.uk/ena/browser/view/DRR193901)), a
carbapenem-resistant clinical isolate that is not one of the five, mapped
straight onto K12 with `minimap2 -ax map-ont`. The pileup is drawn with
supplementary segments linked, so a read split at the prophage boundary is
joined to its other half rather than read as two, and reads long enough to cross
the element carry it as a single labelled deletion.

<Figure caption="Nanopore reads from an unrelated E. coli isolate over one K12 depth trough, with the graph's depth curve and its MAF below. All four lanes break at the edges of the cryptic prophage CPZ-55." src="/img/pangenome/long_reads.png" />

Nothing in that picture came from the pangenome graph, and it shows the thing a
depth curve cannot: where the two sides are joined in a genome that lacks the
element.

The peaks go the other way. `odgi depth` counts path **steps**, and the graph
collapses the rRNA operons into one copy that every strain then walks several
times, so those windows read well above the strain count. Read the signal as
relative rather than as an exact genome tally. That is a property of this
builder rather than of the projection: the Minigraph-Cactus tutorial draws
[both graphs' curves over one of those operons](/docs/tutorials/pangenome_cactus#pangenome-depth-and-per-strain-presence),
and only this one steps up.

### Per-strain presence

The depth track sums every path into one curve.
[`odgi pav`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_pav.html)
splits it per strain: over the same K12 windows it reports the fraction of each
window that strain's path traverses, 1 where the strain is fully present and
toward 0 where the window is accessory in it. Slice each strain's rows into its
own bigWig and load the set as one
[`MultiQuantitativeTrack`](/docs/user_guides/multiquantitative_track):

<!-- from: scripts/build_ecoli_pangenome_graph.sh -->

```bash
in_pggb odgi pav -i "/data/$og" -b /data/depth_windows.bed > pav.tsv
# K12 omitted: it is present over its own windows by construction
for strain in Sakai CFT073 NCTC86 IAI39; do
  # column 5 is the PanSN path, column 6 the presence fraction
  awk -F'\t' -v OFS='\t' -v g="${strain}#1#chr" \
    '$5 == g && $6 + 0 == $6 { print "chr", $2, $3, $6 }' pav.tsv |
    sort -k1,1 -k2,2n > "pav_${strain}.bedgraph"
  bedGraphToBigWig "pav_${strain}.bedgraph" chrom.sizes "ecoli_pggb_pav_${strain}.bw"
done
```

Same windows as the depth curve, so the two lanes line up. The output is one row
per window per path (`chrom start end name group pav`), where `group` is the
PanSN path and `pav` the fraction, which is what the loop splits on. K12 is left
out because it is present over its own windows by construction.

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

Draw it under the aggregate curve rather than beside it. Where that curve dips,
these rows say which strain is missing: one falls to 0 over its own accessory
stretch while the others hold at 1. The windows where all four are absent at
once are the K12-private islands the depth curve bottoms out over.

<Figure caption="The aggregate depth curve over all of K12, with odgi pav on the same windows below it, one row per non-K12 strain, so each dip resolves into the strain that accounts for it." src="/img/pangenome/pav.png" />

## Compared to `odgi viz`

You have already run this. Unless you passed `-v`, pggb rendered the graph in 1D
with
[`odgi viz`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_viz.html)
and in 2D with
[`odgi layout`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_layout.html)
before it finished, and the output directory holds both: `*.viz_*.png` (one per
coloring) and `*.lay.draw.png`. The figure below is `odgi viz` re-run at a size
worth printing, drawing the graph the way it is stored rather than projected
onto a reference.

<Figure caption="The same five-strain graph drawn by odgi viz, one row per strain. The axis is graph node order rather than K12 coordinates, so nothing lines up with a gene or a chromosome position." src="/img/pangenome/graph.png" />

It gives one row per strain, as the MAF and per-strain-presence tracks do, but
its horizontal axis is the graph's node order (the "pangenome sequence") rather
than any genome's coordinates. The brackets under the rows are the graph's
links, each spanning the stretch of node order it jumps. All of it is the
graph's real structure, but no gene is numbered in node order.

The JBrowse projections keep the one-row-per-strain idea and redraw everything
on K12's coordinates:

- **Depth** is the raster's column coverage summed into one curve.
- **Per-strain presence** is its filled-vs-gap rows, windowed.
- **The MAF track** is those same rows at single-base resolution, colored by
  mismatch.
- **The variant track** is the points where the rows branch, one column each.

What the two axes cost each other is
[measured on the Minigraph-Cactus page](/docs/tutorials/pangenome_cactus#compared-to-odgi-viz),
which marks the same 100 kb of K12 on both.

`odgi layout`'s 2D drawing is the other comparison, and the closer one: it is
path-guided stochastic gradient descent over the whole graph, where the graph
view's force-directed layout is Bandage's FMMM over one cut window. Both put the
graph's shape on the page with no reference axis; the view adds the two anchored
layouts, which `odgi draw` has no equivalent of, and gives up whole-genome scope
to get them.

## The graph itself

The projections above flatten the graph onto K12. JBrowse can also draw it as a
graph, beside a linear view of the same window, through the
[graph genome view plugin](/docs/user_guides/graph_genome_view). That guide
covers the view itself, its layouts, and moving between the two panels. This
section covers the part specific to pggb: getting a base-level graph in.

### Installing the plugin

The plugin is beta and not in the [plugin store](/docs/user_guides/plugin_store)
yet, so it loads by URL. In JBrowse Web that means a `plugins` array at the top
level of `config.json`, beside `assemblies` and `tracks` (see
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

`RgfaTabixAdapter` ships in the same plugin, so the segment tracks below need it
as much as the view does. On [JBrowse Desktop](/docs/quickstart_desktop) there
is no config file to edit: install it once from the start screen at **Global
plugins... → Add custom plugin**, putting that `esmUrl` under **Advanced
options** in **ESM build URL** and leaving the two fields above it empty.

### Browsing the whole graph by locus

A plain GFA records no coordinates on its segments, but walking a P line in step
order gives every segment it visits an interval on that path's own sequence.
Doing that walk once, offline, and writing the result as the two tabix-indexed
BEDs `RgfaTabixAdapter` reads makes the whole graph queryable by locus:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_pggb_tabix.sh
bash build_pggb_tabix.sh "$gfa" ecoli_pggb K12
```

It produces `ecoli_pggb.segs.bed.gz` and `ecoli_pggb.links.bed.gz` with their
indexes. The
[graph view guide](/docs/user_guides/graph_genome_view#route-1-a-graph-track-browsable-by-locus)
covers the four choices that walk makes and what each one costs. It agrees with
the `odgi extract` route [below](#a-window-as-a-file): at that window every
interval it derives matches the ones `gfa_nodes_to_bed.py` derives from the
extracted subgraph.

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

<Video src="/media/pangenome/pggb_subgraph_launch.mp4" caption="The route, on 1.6 kb of K12 around the IS5 element: the segments lane's own menu, and the subgraph it cuts from the window on screen. The nodes that arrive below are the blocks the lane above draws, in the same colors." />

#### One node per bubble, when the window is wider than the graph can draw

The index above draws one node per GFA segment, and a pggb graph runs about 17
bp per segment, so the drawable window is a kilobase or so. Most of what a cut
that size draws is single-base alternatives, one small lens each.

A coarse tier draws one node per **bubble** instead, with the invariant
reference between bubbles as backbone. It needs no new adapter or renderer,
since a collapsed bubble is a reference span with an id and a rank, which is all
the segments and links files state. It needs a bubble decomposition, and
`pggb -V` already wrote one: the `LV=0` records of its `vg deconstruct` snarl
VCF are the top-level bubbles with their own reference spans, allele traversals
and allele sequences, so
[`snarls_to_bubble_bed.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/snarls_to_bubble_bed.py)
turns it into the bubble BED the tier builder reads:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/snarls_to_bubble_bed.py
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_bubble_tier.sh
python3 snarls_to_bubble_bed.py ecoli_pggb_snarls.vcf.gz ecoli_pggb.bubbles.bed
bash build_bubble_tier.sh ecoli_pggb.bubbles.bed ecoli_pggb.tier50 50
```

That is the raw snarl tree kept [above](#why-the-reference-path-takes-a-length),
not the decomposed file the variant track loads: vcfbub pops exactly the
top-level records a tier is built from.

`gfatools bubble` cannot do this job here: it places a bubble on a reference by
reading rGFA `SN`/`SO`/`SR` tags, and a pggb graph states the same information
in its paths instead, so on this GFA it reports nothing at all.

The third argument is the threshold, in bp of content, and it decides what the
picture is about. At 0 every single-base alternative is its own node, which over
20 kb is hundreds of them and reads worse than the fine tier. At 50 those are
absorbed into the backbone and every indel is kept, taking the whole 4.64 Mb
graph to about a thousand nodes, so a far wider window becomes drawable:

```json
{
  "type": "FeatureTrack",
  "trackId": "ecoli_pggb_tier50",
  "name": "pggb graph bubbles (coarse tier, one node per bubble)",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "uri": "https://jbrowse.org/demos/ecoli_pangenome/ecoli_pggb.tier50"
  }
}
```

Charcoal means something different in a tier than it does in the fine index
above. Every node here has K12 coordinates, backbone and bubble alike: the
builder ranks an invariant stretch 0 and a bubble 1, so the reference-position
ramp colors the stretches the strains agree on and paints charcoal on the sites
they differ at.

<Figure caption="100 kb of K12 around an IS5 element, one node per bubble, as a linear track above and the graph it indexes below. The arrowed bubble is the IS5 element, which K12 carries and the other four skip." src="/img/pangenome/pggb_bubble_tier.png" />

The tier is a feature track, so it draws in a linear view as well as in the
graph. A bubble is anchored on the reference span it replaces; the bubbles take
their own row only because at this width most of them are a pixel across.

Hover a node for the segments it collapsed, how many traversals cross it, and
its shortest and longest allele. The two tiers are read together, the coarse one
to find an event and the fine one to open it, which is why they are the same
adapter pointed at a different prefix.

One setting is doing work in that pane. A node's drawn length is proportional to
its sequence by default, and here one arm is 1,199 bp against neighbours of one
to seventy, wide enough to swallow the rest of the drawing. **Bubble spread →
Compress lengths** pulls the longest and shortest nodes towards the graph's
mean, which leaves the bubble legible as a bubble. Use it whenever a cut spans
kilobases and single bases at once; leave it off when one node has to _read_ as
long.

Switching **Layout** to **Sample rows** gives each strain its own row. On this
graph a row means carriage, since it names a path that actually walks the
segment. On an rGFA it means build order instead, because minigraph's `SR` names
the assembly that contributed the segment first.

Rows want a narrower window than the sweep above. A row draws what a strain
takes _instead of_ the reference, so it is read segment by segment, and at 17 bp
per segment a kilobase leaves each one a few pixels wide. The index says how
narrow: `tabix ecoli_pggb.segs.bed.gz` returns a few dozen backbone segments
over this 460 bp and over a thousand across 10 kb.

A row's bar is drawn over the **reference it replaces**, never over its own
sequence length, so an insertion's own length lives in the tooltip instead. That
is why CFT073's row carries one long bar labelled `7 kb deletion` running off
the left edge: its segment is 75 bp on CFT073's own contig, and its two links
land on `K12:1,004,667` inside the window and on `K12:997,574` 7.1 kb upstream,
so the bar is that 7.1 kb of K12 and most of it is outside the frame. `pggb -V`
writes the same event through `vg deconstruct`, one record at `chr:997,575`
genotyped in CFT073 and in none of the other three, and it is drawn again
[below](#out-of-the-graph-into-the-strain) from CFT073's own coordinates.

In **Sample rows** the lanes take the MAF's own rows and order: the top row is
the K12 backbone, and below it each strain's marks are the segments it takes
instead. The MAF row above says the same thing base by base.

<Figure caption="460 bp at the ycbF/pyrD boundary in both layouts, under the same MAF lane. Left, Sample rows. Right, the same nodes with the reference axis let go." src="/img/pangenome/pggb_locus_sample_rows.png" links="Sample rows=pangenome/pggb_locus_sample_rows_rows,Force-directed=pangenome/pggb_locus_sample_rows_force" />

Watching the dropdown redraw them says one thing the pair of pictures cannot,
which is that the two drawings hold the same nodes:

<Video src="/media/pangenome/pggb_layout_switch.mp4" caption="The same 460 bp through the Layout dropdown and back. Sample rows holds the nodes to the reference axis, one row per strain; the force drawing lets the axis go, and the alternate routes hang off the backbone where the rows had flattened them." />

#### Who carries a segment

Clicking a node opens its details, and on a graph indexed this way they include
**`carriedBy`**: every haplotype whose path walks that segment.
`build_pggb_tabix.sh` records them as an `SM:Z:` tag while it walks the paths,
so the answer travels with the index rather than being recomputed.

None of the projections above can state this: they flatten onto K12, and an
allele no reference carries has no K12 coordinate to be drawn at, so the variant
and alignment lanes answer what is here rather than who has it.

Read it against **`contributingAssembly`** in the same panel, which is the field
an rGFA has to use: there `SR` is build order, so it names whichever assembly
minigraph added the segment first and says nothing about the rest.

<Figure caption="A backbone segment clicked in the graph. carriedBy names the four strains whose paths walk it; contributingAssembly says only K12, which is all an rGFA could report." src="/img/pangenome/pggb_carriage.png" />

#### Carriage as a linear lane

The same tag reaches the segments track as feature attributes, so carriage can
be read along K12 rather than one node at a time. `samples` is the haplotype
list and `carriers` is its length, which is the one a color expression wants:

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "ecoli_pggb_carriage",
  "name": "pggb graph: segment carriage",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "uri": "https://jbrowse.org/demos/ecoli_pangenome/ecoli_pggb"
  },
  "displays": [
    {
      "type": "LinearBasicDisplay",
      "displayId": "ecoli_pggb_carriage-LinearBasicDisplay",
      "displayMode": "collapsed",
      "showLabels": false,
      "color": "jexl:feature.carriers==1?'#e31a1c':feature.carriers==2?'#fd8d3c':feature.carriers==3?'#feb24c':feature.carriers==4?'#fed976':feature.carriers==5?'#bdbdbd':'#eeeeee'",
      "legend": [
        { "label": "All 5 strains (core)", "color": "#bdbdbd" },
        { "label": "4 strains", "color": "#fed976" },
        { "label": "3 strains", "color": "#feb24c" },
        { "label": "2 strains", "color": "#fd8d3c" },
        { "label": "1 strain (private)", "color": "#e31a1c" }
      ]
    }
  ]
}
```

<Figure caption="Who carries the IS5 element at K12 chr:1,299,499-1,300,693. The carriage lane is a feature track colored by a jexl expression over the GFA SM:Z: tag, so the red box is a segment K12 alone walks." src="/img/pangenome/pggb_carriage_lane.png" />

Read it against the
[depth track](#pangenome-depth-projection-core-vs-accessory). Both answer core
versus accessory, and they differ in unit: depth is a mean over the windows
tiled above, so an accessory stretch shorter than one window is averaged into
its neighbours, while the lane is one box per segment, which is where the graph
states carriage in the first place.

The last color in the chain is the fallback. An rGFA has no tag column at all,
so `carriers` is absent rather than 0 and the whole lane comes out in that
color.

#### Out of the graph, into the strain

A segment the reference never visits sits on **its own carrier's coordinates**,
which is what lets the graph open the strain rather than a projection of it.
Right-click that 75 bp CFT073 segment → **Launch view → Linear genome view →
CFT073** and it opens CFT073 at `1,048,515`, its own offset, carrying CFT073's
gene track.

That is the deletion read from the donor's side, and it is checkable against
annotation neither the graph nor the index has seen. The two links bridge
`K12:997,574` to `K12:1,004,667`, and seven K12 genes sit inside that span
(`elfA`, `elfD`, `elfC`, `elfG`, `ycbU`, `ycbV`, `ycbF`, the _elf_ fimbrial
operon and its neighbours), with `ssuE` ending just before it and `pyrD`
starting just after. So if the graph is right, CFT073 should run `ssuE` straight
into `pyrD`. It does.

<Figure caption="The 75 bp CFT073 segment ringed in the graph, and the linear view its menu entry opens: CFT073 on its own coordinates, where ssuE runs into pyrD with nothing between them." src="/img/pangenome/pggb_strain_launch.png" />

The
[graph genome view guide](/docs/user_guides/graph_genome_view#from-a-node-back-to-a-genome)
covers the rest of that menu, including the synteny entry that opens every
contributing strain at once.

#### Where this stops, and what to do instead

This gives browsing by locus rather than seamless browsing of any graph. Three
limits:

- **The index is offline.** Nothing reads the GFA live, so it is rebuilt
  whenever the graph changes.
- **It grows with total sequence rather than with variation.** A pggb graph runs
  about 17 bp per segment, so a five-strain bacterial pangenome is a few hundred
  thousand segments and a human pangenome at base level is orders of magnitude
  past that. pggb itself is run that way at scale, via
  [`partition-before-pggb`](https://github.com/pangenome/pggb#partitioning), so
  index a community or a chromosome at a time and prefer the SV-resolution
  minigraph graph for whole-genome browsing.
- **The drawable window is small**, because of the graph rather than the index.
  At 17 bp per segment, 1 kb is around 150 nodes and 3 kb is a solid braid, and
  the view declines past its node budget rather than drawing something
  unreadable.

A segment carried by several assemblies draws on one row: sample rows put it on
the first path that walks it, and the rest are in the node popup under
[`carriedBy`](#who-carries-a-segment).

The [build script](#reproduce-it-end-to-end) also runs `minigraph -cxggs` over
the same five strains and indexes the rGFA it emits the same way, so the figure
below can put one locus through both graphs. The two panes are comparable but
two orders of magnitude apart in span: the minigraph side covers three whole
backbone segments, the pggb side the stretch banded on its ruler.

<Figure caption="One stretch of K12 at the colanic acid cluster through both graphs, each over the window it can draw. Left, the minigraph rGFA. Right, the pggb graph, with a node at every variant." src="/img/pangenome/graph_resolution.png" links="minigraph=pangenome/graph_resolution_minigraph,pggb=pangenome/graph_resolution_pggb" />

Both panes are colored by reference position over the same 28 kb, so a node and
the block it came from take one color, and each pane's header carries its node
and edge counts. Browse the rGFA whole-genome, and open the pggb graph where you
want every base.

### A window as a file

With no index, **Add → Graph genome view** takes a GFA by file or URL. This is
the route for a graph too large to index, or for a window someone hands you.
Three odgi commands cut one: `extract -E` takes every node between the first and
last in the range, `sort -O` compacts the node ids, and `view -g` writes GFA.
`-E` is the aggressive option; `-c`/`-d` expand by a bounded number of steps or
bp instead, which is what the view's own **Graph context** setting does when it
cuts from an index:

```bash
in_pggb bash -c "odgi extract -i /data/$og -r K12#1#chr:1004500-1004900 -E -o - \
  | odgi sort -i - -o - -O \
  | odgi view -i - -g" > ecoli_pggb_subgraph.gfa
```

Nothing in a plain GFA marks one path as the reference, so pick which to anchor
on under **View menu → Settings → Reference path**. `odgi extract` writes the
window into the path name (`K12#1#chr:1004500-1004961`), which is where the
offsets come from.

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
K12 position, so they are absent from the linear track, and in the graph their
drawn width is a visibility floor rather than their length in bp, which the node
tooltip gives.

A cut graph always has ends, and this one has a conspicuous one: the 93 bp node
at the green-to-yellow junction, ringed in the figure below, is where CFT073
rejoins. It is the near side of
[the same deletion](#out-of-the-graph-into-the-strain) drawn above, and its
second link falls 7 kb outside the window `odgi extract -E` was given, so it
draws with one end open. A one-sided node in an extracted subgraph means that
rather than a dead end in the graph.

Widening until it closes costs more than it looks. Both anchors are in view only
from `K12#1#chr:997,574-1,004,961`, and `-E` over a window that size returns
thousands of segments where this one returns 48, because a base-level graph
averages ~17 bp per segment. `-c 1` fetches the far anchor without everything
between, which moves the problem rather than solving it: that node's own two
ends are then open.

The same event is four nodes in the
[minigraph graph](/docs/user_guides/graph_genome_view) of these same five
strains, because a structural graph spends one segment on the 7 kb K12 stretch
instead of four hundred. Query its links index over the span and both routes are
one row each:

```bash
tabix https://jbrowse.org/demos/ecoli_pangenome/ecoli_minigraph.links.bed.gz \
  'K12#1#chr:997000-1005000'
```

`s378 → s379 → s380` is K12 through the deletion and `s378 → s2025 → s380` is
CFT073 around it, where `s2025` is this same CFT073 sequence. Which resolution
holds an event is a property of the graph, not of the window you asked for.

<Figure caption="The extracted file beside a linear view of the same locus, anchored on the graph's K12 path so both share an axis and the Depth colors. The ringed 93 bp node's second link falls outside the extracted window." src="/img/pangenome/local_subgraph.png" />

A collapsed repeat is where `-E` fails outright rather than merely growing, and
there `-d` is the answer. The graph folds a repeat's copies onto one run of
segments, so `-E` walks out of the window to every copy on every chromosome: at
the 16S rRNA gene `rrsB` it returns tens of thousands of segments for a 500 bp
cut, where `-d 500` returns six.

```bash
in_pggb bash -c "odgi extract -i /data/$og -r K12#1#chr:4166800-4167300 -d 500 -o - \
  | odgi sort -i - -o - -O \
  | odgi view -i - -g" > ecoli_pggb_rrna.gfa
```

`odgi paths -L` on that cut lists nine path intervals over those six segments,
one per visit and named for where the visit starts: two copies each in Sakai,
CFT073, NCTC86 and IAI39, one in K12. Nine locations across five chromosomes are
one run of segments, which is the collapse the depth curve reads as a spike and
[untangle draws in coordinate space](#the-same-picture-read-out-of-the-graph).

### Drawing the haplotype paths

A P line is a walk: the ordered list of segments one strain takes through the
graph. **View menu → Settings → Draw paths** draws them. Every node and every
connector is split lengthwise into one lane per path, in the order of the color
key beside the drawing, and a strain that does not walk a node leaves its lane
empty there. Set **Color** to **Grey** first, so the only colors in the drawing
are the paths.

One lane per path makes carriage legible on a node as short as a single base: an
absence lands at the same height on every node, so a missing strain is a gap in
a fixed place instead of a stroke that has to be found. A strain with no colored
arc is a result too, since it walks the window on the backbone.

The setting needs a graph with P or W records. An rGFA has neither, and neither
does a subgraph cut from the tabix index above, which rebuilds segments and
links only. So this is what the file route is still for: cut the IS5 bubble
[the coarse tier arrows](#one-node-per-bubble-when-the-window-is-wider-than-the-graph-can-draw)
as a file and the P lines come with it.

```bash
in_pggb bash -c "odgi extract -i /data/$og -r K12#1#chr:1299400-1300800 -E -o - \
  | odgi sort -i - -o - -O \
  | odgi view -i - -g" > ecoli_pggb_is5.gfa
```

The figure keeps the same interval in K12 coordinates above the graph, because a
force drawing has no axis of its own. The gene lane names the element (`insH21`,
the IS5 transposase) and the whole-genome alignment states the same carriage
through an alignment the graph had no part in.

The one broken line in the drawing is the deletion edge: sequence that is not
there. Weight and color could not carry it on their own, since an off-reference
node is already charcoal and the arc already near-black.

<Figure caption="The IS5 bubble cut as a file, so its P lines survive: the interval in K12 coordinates above, the bubble with the strain paths drawn below. Four strokes run along the broken deletion edge, and the missing one is K12." src="/img/pangenome/pggb_haplotype_paths.png" />

## Reproduce it end to end

[`build_ecoli_pangenome_graph.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_ecoli_pangenome_graph.sh)
runs everything above in one shot, fetching the helper scripts it needs beside
itself:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_ecoli_pangenome_graph.sh
bash build_ecoli_pangenome_graph.sh   # builds ./ecoli_pangenome_graph_build/jbrowse2
npx --yes serve ecoli_pangenome_graph_build/jbrowse2
```

It downloads the RefSeq genomes, runs pggb, converts the wfmash PAF,
`odgi untangle`, both VCF tiers, the MAF, `odgi similarity`, `odgi depth` and
`odgi pav` into the projections above, downloads JBrowse, and writes a
`config.json` with the assemblies, per-strain gene tracks, the graph-derived
tracks, and a default session. It also writes the `odgi viz` raster and every
cut GFA this page opens as a file: `ecoli_pggb_subgraph.gfa`,
`ecoli_pggb_is5.gfa` and `ecoli_pggb_rrna.gfa` out of odgi, then
`ecoli_rgfa_slice.gfa`, `ecoli_paa_subgraph.gfa` and the rGFA tabix indexes
behind the segments track out of the cactus image, which is where minigraph and
gfatools live. The `config.json` declares the graph genome view plugin, so the
graph track and its launch menu item work without adding the plugin by hand. It
needs the tools listed under [Prerequisites](#prerequisites), and picks its
container runtime off `PATH`, docker first and then singularity or apptainer.
Force one with `CONTAINER=singularity`.

[JBrowse Desktop](/docs/quickstart_desktop) opens that folder's `config.json` by
path, so the `npx serve` line is only for the web build.

Everything downstream is derived from the strain table at the top of the script,
so adding genomes there is the only edit an expanded pangenome needs. Watch two
costs as that grows: wfmash is all-vs-all, so mapping scales with the square of
the genome count, and `odgi untangle` indexes every step of every path.

## See also

- [](/docs/user_guides/graph_genome_view)
- [](/docs/tutorials/pangenome_cactus)
- [](/docs/tutorials/pangenome_hprc)
- [](/docs/tutorials/allvsall_synteny)
- [](/docs/user_guides/maf_track)
- [](/docs/user_guides/multivariant_track)
- [](/docs/developer_guides/pif_format)
- [](/docs/jbrowse_anywidget)
- [](/docs/jbrowser)
- [pggb](https://github.com/pangenome/pggb)
- [odgi](https://odgi.readthedocs.io/)
