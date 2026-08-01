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

:::caution Experimental

The graph view is a beta plugin, and this tutorial covers experimental ideas. We
welcome your [feedback](/contact).

:::

## Prerequisites

- `docker`, for the pggb image, which also carries odgi
- the NCBI
  [`datasets`](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/download-and-install/)
  CLI
- `samtools`, `bedGraphToBigWig` (UCSC kentUtils)
- `python3`, htslib (`bgzip`, `tabix`), `unzip`
- `node`, for the [JBrowse CLI](/docs/cli)

## The linear projections

The graph is built here, not downloaded.

Most of what JBrowse draws are the graph's **linear projections**: the same
graph flattened onto one reference genome's coordinates. Every builder can emit
them, so a graph built with any of these tools lands on track types you already
have:

| Projection             | What it shows                                               | From the graph                                        | JBrowse track                                                      |
| ---------------------- | ----------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------ |
| Synteny                | The blocks each pair of genomes shares                      | `odgi untangle`, `halSynteny`                         | [synteny track](/docs/config_guides/synteny_track)                 |
| Pangenome variants     | Every difference the graph calls, across all samples        | `pggb -V`, `cactus-pangenome --vcf`, `vg deconstruct` | [multi-sample variant track](/docs/user_guides/multivariant_track) |
| Whole-genome alignment | The multiple alignment, column by column                    | `pggb -M`, `hal2maf`                                  | [](/docs/user_guides/maf_track)                                    |
| Pangenome depth        | How many genomes cover each reference base (core/accessory) | `odgi depth`, `odgi pav`                              | [quantitative track](/docs/config_guides/quantitative_track)       |
| Graph complexity       | How branched the graph is under each reference base         | `odgi degree`                                         | [quantitative track](/docs/config_guides/quantitative_track)       |

This tutorial builds a five-strain _E. coli_ pangenome with pggb, loads each
projection, and draws the graph itself. It uses the same five genomes as the
[all-vs-all synteny tutorial](/docs/tutorials/allvsall_synteny), which builds
the synteny projection alone from a plain minimap2 alignment.

## Building the graph with pggb

pggb takes one FASTA of all the genomes,
[PanSN](https://github.com/pangenome/PanSN-spec)-named
`sample#haplotype#contig`. The naming is load-bearing rather than cosmetic:
wfmash's `-Y '#'` (on by default) skips a mapping whose query and target share
the prefix before the last `#`, which is what stops a genome being aligned to
itself, and `-V` reads the same prefix to assign each VCF sample and phase.
Concatenate the five strains (haplotype `1`, since these are haploid bacterial
assemblies) and index the result. Chromosomes only here, so no plasmid reaches
the graph:

```bash
for strain in K12 Sakai CFT073 NCTC86 IAI39; do
  awk -v s="$strain" '/^>/{print ">" s "#1#chr"; next} {print}' "$strain.fa"
done > all.fa
bgzip all.fa
samtools faidx all.fa.gz
```

Then run pggb. `-V K12:10000` decomposes the graph into a VCF against the K12
path, and `-M` writes the multiple alignment as a MAF. The image also carries
[odgi](https://github.com/pangenome/odgi), which the untangle, depth, presence,
complexity and subgraph sections below reuse, so wrap the `docker run` once and
call it `in_pggb`:

```bash
in_pggb() {
  docker run --rm -u "$(id -u):$(id -g)" -w /data -v "$PWD":/data \
    ghcr.io/pangenome/pggb:202603141454453ade6b "$@"
}

in_pggb pggb -i /data/all.fa.gz -o /data/pggb \
  -n 5 -c 4 -p 90 -s 5000 -V K12:10000 -M -t "$(nproc)"
```

Pinning the image to a dated build tag (rather than `:latest`) keeps the graph
reproducible. Five bacterial chromosomes are minutes on a laptop; smoothxg's
partial-order alignment is the step that grows, and `-T` caps its threads
separately from `-t` if it runs you out of memory.

`-n` is the number of haplotypes, `-p` the minimum alignment identity, and `-s`
the segment length. `-p 90 -s 5000` suits a bacterial pangenome.

Two flags are easy to miss. `-c, --n-mappings` is separate from `-n` and
defaults to `1`, so `-n 5` alone keeps each segment's single best match and
builds an under-connected graph that crashes smoothxg. Set it to the haplotype
count minus one. `-n` is a smoothxg parameter and cannot influence mapping at
all, which is why the two have to be set together. The other flag is `-w /data`
in the wrapper, which gives the `-u` user a writable working directory. Without
it seqwish cannot write its temporary files.

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

## Synteny projection

Two files answer this, and the difference between them is worth a track each.

### The alignment the graph was induced from

pggb's first step is a wfmash all-vs-all PAF, exactly the input the
[all-vs-all synteny tutorial](/docs/tutorials/allvsall_synteny) loads. It is
pggb's **input**, not a readout of the finished graph, and it is here because it
is free. Index it once with `jbrowse make-pif` and load it with an
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

<Figure caption="The wfmash alignment pggb induced the graph from: the five strains stacked K12 to IAI39, a ribbon between each adjacent pair. Continuous diagonal ribbons are shared backbone, the crossings in the bottom band are IAI39's inversions, and the gaps are accessory sequence." src="/img/pangenome/pggb_synteny.png" />

The all-vs-all tutorial draws these same strains from a `minimap2 -c` PAF, and
the two pictures nearly agree. Two independent pairwise aligners place the
backbone and IAI39's inversions the same way. What differs is the grain: wfmash
merges each pair into a few dozen long segments where minimap2 leaves several
hundred, so the same `minAlignmentLength` cuts far less here.

One thing to know before reusing this file elsewhere: wfmash maps all-to-all in
both directions, so every pair is in the PAF twice, once as query and once as
target, over the same spans. A synteny view draws both, and the ribbons come out
twice as opaque as the same alignment from a one-directional file.

### The same picture read out of the graph

[`odgi untangle`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_untangle.html)
is the projection proper. It walks each query path and reports, segment by
segment, which stretch of the reference path that query is actually traversing,
so it states homology as the graph resolved it, after seqwish and smoothxg had
their say. Sequence that collapsed into one set of nodes comes back as several
query segments pointing at the same reference span, which is exactly the
paralogy a pairwise PAF has no way to express.

`-p` asks for PAF, so `make-pif` reads the output with nothing in between:

```bash
printf 'K12#1#chr\n' > target.txt
printf 'Sakai#1#chr\nCFT073#1#chr\nNCTC86#1#chr\nIAI39#1#chr\n' > query.txt
# resolve the graph on the host: a /data/*.og glob cannot expand inside docker
og=$(ls pggb/*.smooth.final.og)
in_pggb odgi untangle -i "/data/$og" \
  -R /data/target.txt -Q /data/query.txt -m 1000 -j 0.5 -p -t "$(nproc)" \
  > ecoli_pggb_untangle.paf
jbrowse make-pif ecoli_pggb_untangle.paf
```

`-m` merges runs shorter than it into the previous segment, since otherwise
every SNP node starts a new one, and `-j` keeps mappings at or above a jaccard.
untangle leaves PAF column 10 at 0 and writes no CIGAR, since it reports a
jaccard over graph steps rather than a base alignment, so fill column 10 from
its own `id:f:` tag before indexing or every block reads as 0% identity. The
build script does that in one `awk` pass.

Expect coarser blocks than the PAF gives. untangle starts a segment where the
graph stops agreeing, and on a near-colinear bacterial pangenome that is rare,
so a pair collapses to a handful of long blocks. `-e` forces a boundary every N
bp of the sorted graph if you want a finer grid; the
[Minigraph-Cactus tutorial](/docs/tutorials/pangenome_cactus#all-vs-all-synteny-projection)
hits the same limit from the other direction and uses `halSynteny` instead.

Load it exactly like the track above, with its own `trackId`. One difference
matters when you stack it: untangle projects queries onto a **target** path, so
every record has K12 on one side, where the wfmash PAF is genuinely all-vs-all.
Put the reference between the strains you want to compare rather than at the top
of the stack, or the bands between two non-reference rows have nothing to draw.

Whole-genome, the result is the near-colinear diagonals the wfmash figure
already shows. Where the two files part company is a repeat. Find one by looking
for a reference span that more than one segment of the same query lands on:

```bash
zcat ecoli_pggb_untangle.pif.gz | awk -F'\t' 'substr($1,1,1)=="q"' \
  | cut -f1,3,4,8,9 | sort -k4,4n
```

In this graph that is `chr:3,941,447-3,946,786` on K12 — the _rrnC_ operon —
where Sakai, NCTC86 and IAI39 each land twice.

<Figure caption="An rRNA operon in the graph, K12 between NCTC86 and Sakai. Each strain's window holds both of its copies, and both send a ribbon to the one K12 span carrying rrsC, rrlC and rrfC: seqwish collapsed the copies into one set of nodes, so the graph has one place where each genome has two." src="/img/pangenome/pggb_untangle.png" />

A pairwise PAF has no way to say this. Its records are one query interval
against one target interval, so a collapsed repeat is either dropped or
arbitrarily assigned to one copy.

Untangle is the slower of the two by a wide margin, because it indexes every
step of every path rather than reading an alignment off disk. On a base-level
graph budget for it accordingly, or restrict `-Q` to the paths you need.

## Pangenome variants projection

`pggb -V` writes a VCF of every variant the graph decomposes against the K12
path, genotyped across the other four strains. Its `CHROM` is the PanSN
reference path (`K12#1#chr`), so rename it to the K12 assembly's refName
(`chr`). `bcftools` rather than `sed`: a global substitution also rewrites
`INFO/AT` and `PS`, which happen not to contain the path name today and are not
guaranteed not to. It ships in the pggb image, so this needs no extra install:

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

<Figure caption="The decomposed variant tier over 120 kb of K12 in the matrix display: one column per site, one row per strain, colored by genotype, with the gene lane above. Each strain reads differently — IAI39 and CFT073 have long yellow stretches where they do not align to K12 at all, NCTC86 is almost all reference across the whole window, and Sakai differs at sites throughout it." src="/img/pangenome/pggb_variants.png" />

Stack the MAF alignment (below) in the same window and each variant row sits
above the per-strain alignment it was decomposed from.

### Why the reference path takes a length

A graph VCF is a snarl **tree**, which an ordinary callset is not.
`vg deconstruct` emits a record per snarl at every level, each carrying `LV`
(its level, `0` at the top) and `PS` (its parent), so the file holds both a
bubble and the variants nested inside it. Those wide records draw over the fine
layer they were decomposed from, painting a flat block across the rows that
carry them and hiding every SNP underneath.

That is a pangenome problem with a pangenome answer, which is why the `-V` spec
takes `REF:LEN` rather than a bare `REF`. With a length, pggb additionally runs
[`vcfbub`](https://github.com/pangenome/vcfbub) `-l 0 -a LEN` piped into
[`vcfwave`](https://github.com/vcflib/vcflib), and writes the result beside the
raw file as `*.decomposed.vcf`. That is what the track above loads.

What `vcfbub` does is worth stating precisely, because the name of the `-l` flag
suggests otherwise. It does not reduce the file to level 0. It **pops** any site
whose alleles run past `LEN`, emitting the nested sites inside it in its place,
so records with `LV` above 0 are still there, and are there by design. The
property that matters is the width cap: on this graph the longest reference
allele goes from hundreds of kilobases to under `LEN`. Nothing is left wide
enough to paint over the layer beneath it, which is why the track needs no
display filter. `vcfwave` then realigns what survives into primitive variants.

`LEN` is a cost knob as much as a filter, and the two pull in opposite
directions. vcfwave realigns every allele vcfbub keeps, so the step is dominated
by the longest ones: at HPRC's own `-a 100000` this graph had vcfwave running
for nineteen minutes without finishing, against about two at `-a 10000`. Six of
its alleles are over 50 kb. Structural variation that large is better read in
the graph view or the per-strain path track anyway, so the smaller cap costs the
browser nothing.

Keep the raw file too and load it as a second track. It is where the graph
structure lives: `LV`/`PS` give the snarl tree, and `AT` states each allele as
the segment ids it traverses (`AT=>2>4>5,>2>3>5`), which are the same ids the
graph view labels its nodes with. Filter it on `LV` in **Edit filters** to pick
one level of the tree.

The [multi-sample variant track guide](/docs/user_guides/multivariant_track)
covers the matrix versus the per-position display, genotype coloring, and
clustering samples by genotype.

## Whole-genome alignment (MAF) projection

`pggb -M` writes the multiple alignment as a MAF, which JBrowse reads as a
[](/docs/config_guides/maf_track). Its blocks are smoothxg's **POA blocks**, not
homology blocks, and two consequences follow.

The first is that pggb orders each block from its longest path, so the block's
reference row is not consistently the same genome, whereas a MAF track projects
onto a single reference. Re-root every block on K12 (drop blocks that lack it),
and rename the PanSN names to `sample.chr` so the MAF display can split each
row's species off on the `.`:

```bash
# reroot_maf.py keeps K12-containing blocks, puts K12 first (+ strand), sorts by
# K12 position, and gives each K12 row in a repeat-collapsed block its own block
python3 reroot_maf.py pggb/*.smooth.maf ecoli_pggb.maf
```

[`reroot_maf.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/reroot_maf.py)
ships with the reproducible build below. One block per reference row matters
because an index keys a block on its first row, so a repeat's second copy is
only queryable once it anchors a block of its own.

The second is a bug, and the script crops around it. smoothxg pads each sequence
before running POA and blanks the padding afterwards, but on the SPOA path (the
default; pggb does not pass `-A`) that loop compares an ASCII alignment against
abPOA's numeric gap code, so it removes a fixed number of columns rather than a
fixed number of bases per row. Padding survives wherever a row is gapped there,
and on a row antiparallel to the block's first row it lands at the opposite end,
where a consumer reading indels off the columns sees a phantom insertion at
every POA block boundary.
[pangenome/smoothxg#223](https://github.com/pangenome/smoothxg/pull/223) fixes
it upstream. No published pggb image carries it yet, so `reroot_maf.py` still
crops: check `smoothxg --version` in your image against that commit before
assuming the crop is dead code.

Then convert the MAF to the tabix-indexed BED the
[`MafTabixAdapter`](/docs/config/maftabixadapter) reads, one line per block
carrying that block's rows:

```bash
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

<Figure caption="The graph's whole-genome alignment projected onto K12 across 60 kb: the coverage band on top, then one row per strain (K12 first), each colored where it differs from K12, with the variant calls above. A blank row is a strain with no alignment to K12 there, so accessory structure and SNP divergence read in one picture. Numbered boxes are insertions, labeled with the bases the allele adds beyond K12." src="/img/pangenome/maf.png" />

`samples` still names and labels the rows, so a tree that fails to build leaves
the track working. The [MAF track guide](/docs/user_guides/maf_track) covers the
conservation band, per-row identity, and codon view, all derived from the
alignment with no extra files.

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

The troughs sit at depth 1 where no other strain traverses the graph. Those
stretches are K12's private sequence, and the gene lane names what is in them.

The peaks go the other way. `odgi depth` counts path **steps**, and the graph
collapses the rRNA operons into one copy that every strain then walks several
times, so those windows read well above the strain count. Read the signal as
relative rather than as an exact genome tally.

### Graph complexity

Depth says how many paths are present; degree says how **branched** the graph
is.
[`odgi degree`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_degree.html)
reports each window's mean node degree, which is 2 along a stretch every path
walks identically and rises wherever paths enter and leave. So it locates the
graph's tangles directly rather than by inferring them from a dip in coverage,
and it is the one curve here with no equivalent in an alignment-derived track.
Same windows, same conversion, same track type:

```bash
in_pggb odgi degree -i "/data/$og" -b /data/depth_windows.bed \
  | awk -v OFS='\t' '$1 == "K12#1#chr" && $4 + 0 == $4 {print "chr", $2, $3, $4}' \
  | sort -k1,1 -k2,2n > ecoli_pggb_degree.bedgraph
bedGraphToBigWig ecoli_pggb_degree.bedgraph chrom.sizes ecoli_pggb_degree.bw
```

<Figure caption="odgi depth across all 4.64 Mb of K12. The curve sits near the strain count where every strain traverses the graph, so the sequence is core, and drops toward 1 over the accessory stretches private to fewer strains. The peaks are the collapsed rRNA operons, which each path walks several times." src="/img/pangenome/depth.png" />

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

You have already run this. Unless you passed `-v`, pggb rendered the graph in 1D
with
[`odgi viz`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_viz.html)
and in 2D with
[`odgi layout`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_layout.html)
before it finished, and the output directory holds both: `*.viz_*.png` (one per
coloring, including position, depth and inversion) and `*.lay.draw.png`. The
figure below is `odgi viz` re-run only at a size worth printing.

It draws the graph the way the graph is stored, rather than projected onto a
reference.

<Figure caption="The same five-strain graph drawn by odgi viz: one row per strain, filled where the strain traverses the graph and white over accessory sequence. The axis is graph node order, not K12 coordinates, so nothing lines up with a gene or a chromosome position." src="/img/pangenome/graph.png" />

`odgi viz` gives one row per strain, as the MAF and per-strain-presence tracks
do, but its horizontal axis is the graph's node order (the "pangenome
sequence"), not any genome's coordinates. Sequence every strain walks is a
filled column across all rows; accessory sequence is a gap in the rows that skip
it. That is the graph's real structure, but no gene is numbered in node order,
and the axis counts pangenome bases rather than reference ones, so a locus takes
up more of it wherever the other strains carry sequence K12 lacks.

The JBrowse projections keep the one-row-per-strain idea and re-draw everything
on K12's coordinates. Depth is the raster's column coverage summed into one
curve, per-strain presence is its filled-vs-gap rows windowed, the MAF track is
those same rows at single-base resolution colored by mismatch, and the variant
track is the points where the rows branch, one column each.

The
[Minigraph-Cactus tutorial](/docs/tutorials/pangenome_cactus#compared-to-odgi-viz)
marks one 100 kb window on both axes on the same five strains, which shows how
much wider a locus is on the graph axis than on a reference one.

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

It produces `ecoli_pggb.segs.bed.gz` and `ecoli_pggb.links.bed.gz` with their
indexes. The reference argument names the path to treat as rank 0, and every
other path contributes the segments no earlier path reached, on its own
coordinates. The walk agrees with the `odgi extract` route
[below](#a-window-as-a-file): at that window every interval it derives matches
the ones `gfa_nodes_to_bed.py` derives from the extracted subgraph. It reads P
and W lines, so a graph carrying walks rather than paths indexes the same way.

Two decisions in that walk are worth knowing before you trust the output. When a
path reaches the same segment twice, **the first visit wins**: a node draws as
one tube at one x, so recording both would claim reference the segment does not
occupy, and a collapsed repeat stays visible as depth instead. And a segment the
reference path never visits is placed **on its own carrier's coordinates**,
which is the same asymmetry rGFA has, and is why a reference query reaches it
through the links file rather than directly.

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

<Figure caption="An IS5 element at K12 chr:1,299,499-1,300,693, cut from the index rather than from a file prepared beforehand. The 1.2 kb arm of the bubble is the element, which only K12 carries; the other arm is the edge the other four strains take straight past it. Both panels are colored by reference position, so a node's color says where in the window it sits." src="/img/pangenome/pggb_locus_graph.png" />

Switching **Layout** to **Sample rows** gives each strain its own row. On this
graph a row means carriage, since it names a path that actually walks the
segment. On an rGFA it means build order instead, because minigraph's `SR` names
the assembly that contributed the segment first.

Rows want a narrower window than the sweep above. A row draws what a strain
takes _instead of_ the reference, so it is read segment by segment, and at 17 bp
per segment a kilobase leaves each one a few pixels wide.

<Figure caption="460 bp of the same graph in Sample rows, at the ycbF/pyrD boundary, under the MAF lane in the same five rows and the same order. The graph's top row is the K12 backbone with each segment's length on it; below it each strain's marks are the segments it takes instead of the reference, tied by threads to where they attach. The MAF row above says the same thing base by base: CFT073 has columns only where its contig reaches." src="/img/pangenome/pggb_locus_sample_rows.png" />

#### Where this stops, and what to do instead

This gives browsing by locus rather than seamless browsing of any graph, and it
has four limits.

The index is built once, offline, and nothing reads the GFA live, so it has to
be rebuilt when the graph changes. It grows with total sequence rather than with
variation: a pggb graph runs about 17 bp per segment, so a five-strain bacterial
pangenome is a few hundred thousand segments and a human pangenome at base level
is orders of magnitude past that. That is also how pggb itself is run at that
scale, via
[`partition-before-pggb`](https://github.com/pangenome/pggb#partitioning), so
index a community or a chromosome at a time, and prefer the SV-resolution
minigraph graph for whole-genome browsing.

The window that draws is also small, because of the graph rather than the index.
At 17 bp per segment, 1 kb is around 150 nodes and 3 kb is a solid braid, and
the view declines past its node budget rather than drawing something unreadable.
Finally, a segment carried by several assemblies draws on one row: sample rows
put it on the first path that walks it, and the others are listed in the node
popup.

<Figure caption="The same 3 kb of K12 at the colanic acid cluster, banded on the ruler, cut from the two graphs this build produces. Left, the minigraph rGFA: one 4.4 kb backbone segment spans the whole band, four alternate segments of 6-154 bp hang off it, and the cyan 16.4 kb node is the next backbone segment along, which the one-hop cut reaches: it joins the backbone at the vertex beside the 88 bp bubble, and its other end is where the loaded subgraph stops. Right, the pggb graph: a node at every variant. Both lanes run over the whole cut rather than the band, and both are colored by reference position, so every node is its own block above it. The node and edge counts are in each header." src="/img/pangenome/graph_resolution.png" links="minigraph=pangenome/graph_resolution_minigraph,pggb=pangenome/graph_resolution_pggb" />

That is the trade in one picture, and it is why the two graphs are worth
building side by side: browse the rGFA whole-genome, and open the pggb graph
where you want every base.

When the graph is too large to index, cut a window offline and open that file
instead, [below](#a-window-as-a-file).

### A window as a file

With no index, **Add → Graph genome view** takes a GFA by file or URL. This is
the route for a graph too large to index, or for a window someone hands you.
Three odgi commands cut one: `extract -E` takes every node between the first and
last in the range, `sort -O` compacts the node ids, and `view -g` writes GFA.
`-E` is the aggressive option; `-c`/`-d` expand by a bounded number of steps or
bp instead, which is what the view's own **Graph context: N hops** setting does
when it cuts from an index:

```bash
# resolve the graph on the host, since a /data/*.og glob can't expand in docker
og=$(ls pggb/*.smooth.final.og)
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
K12 position, so they are absent from the linear track.

<Figure caption="One slice of the five-strain graph drawn both ways, under a linear view of the same locus. Left, anchored on the graph's K12 path: both panels share an axis and the Depth colors, so the backbone row is the node strip above it and the green-to-yellow step, where the fifth strain rejoins the shared sequence, is at the same x in both. Right, force-directed: the same nodes and colors with nothing holding them to the axis. The alternate alleles have no K12 coordinate either way, and their drawn width is a visibility floor rather than their length in bp, which the node tooltip gives." src="/img/pangenome/local_subgraph.png" links="Anchored=pangenome/local_subgraph_anchored,Force-directed=pangenome/local_subgraph_force" />

### Drawing the haplotype paths

A P line is a walk: the ordered list of segments one strain takes through the
graph. **View menu → Settings → Draw paths on edges** draws them, one stroke per
path across every edge the path crosses, with a color key naming the strain each
stroke belongs to. Set **Color** to **Grey** first, so the only colors in the
drawing are the paths.

This is carriage, which is the one thing the graph states and none of the
projections above can: an alternate allele has no reference coordinate, so
nothing that flattens onto K12 can say who carries it. A strain with no colored
arc is a result too, since it walks the window on the backbone.

The setting needs a graph with P or W records. An rGFA has neither, and neither
does a subgraph cut from the tabix index above, which rebuilds segments and
links only. So this is what the file route is still for: cut the IS5 bubble
[from earlier](#browsing-the-whole-graph-by-locus) as a file and the P lines
come with it.

```bash
og=$(ls pggb/*.smooth.final.og)
in_pggb bash -c "odgi extract -i /data/$og -r K12#1#chr:1299400-1300800 -E -o - \
  | odgi sort -i - -o - -O \
  | odgi view -i - -g" > ecoli_pggb_is5.gfa
```

<Figure caption="The IS5 bubble with the strain paths drawn, nodes grey. One arm is the 1.2 kb element and the other is the edge past it, labelled as the 1.2 kb deletion it is on the reference. Four strokes run along that arc; the missing one is K12, the strain that walks the element." src="/img/pangenome/pggb_haplotype_paths.png" />

### A collapsed repeat

Where a sequence repeats, the graph folds the copies onto one run of segments,
and a path walks that run once per copy. `odgi extract` then returns one path
interval per visit, named for where the visit starts, so the copies stay
distinguishable.

Cut the 16S rRNA gene `rrsB` with `-d`, which expands by bp, rather than the
`-E` used above. `-E` takes every node between the first and last in the range,
and these segments are shared by rRNA copies across all five chromosomes, so it
walks out to every one of them and returns tens of thousands of segments for a
500 bp window:

```bash
og=$(ls pggb/*.smooth.final.og)
in_pggb bash -c "odgi extract -i /data/$og -r K12#1#chr:4166800-4167300 -d 500 -o - \
  | odgi sort -i - -o - -O \
  | odgi view -i - -g" > ecoli_pggb_rrna.gfa
```

The cut is six segments, and `odgi paths -L` on it lists nine path intervals
over them: two copies each in Sakai, CFT073, NCTC86 and IAI39, one in K12. That
is the collapse stated directly — nine locations across five chromosomes are one
run of segments. The picture of it is
[the untangle figure above](#the-same-picture-read-out-of-the-graph), which is
the same operon in coordinate space; the graph drawing of a six-node chain adds
nothing to the list.

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
`odgi untangle`, both VCF tiers, the MAF, `odgi similarity`, `odgi depth`,
`odgi degree` and `odgi pav` into the projections above, downloads JBrowse, and
writes a `config.json` with the assemblies, per-strain gene tracks, the
graph-derived tracks, and a default session. It also writes the `odgi viz`
raster, the two graph-view subgraphs (`ecoli_pggb_subgraph.gfa` and
`ecoli_rgfa_slice.gfa`), and the rGFA tabix indexes behind the segments track,
all of which need the cactus image for minigraph and gfatools. The `config.json`
declares the graph genome view plugin, so the graph track and its launch menu
item work without adding the plugin by hand. It needs the same tools listed
under [Prerequisites](#prerequisites).

Everything downstream is derived from the strain table at the top of the script,
so adding genomes there is the only edit an expanded pangenome needs. Watch two
costs as that grows: wfmash is all-vs-all, so mapping scales with the square of
the genome count, and `odgi untangle` indexes every step of every path.

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
- [odgi](https://odgi.readthedocs.io/), whose `untangle`, `similarity`, `depth`,
  `degree` and `pav` commands produce most of the tracks on this page
