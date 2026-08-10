---
title: Pangenome (Minigraph-Cactus)
description:
  Build a Minigraph-Cactus pangenome graph and load its linear projections in
  JBrowse
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
data: pipeline
---

**TL;DR:** one `cactus-pangenome` run over five _E. coli_ strains emits the
graph, a VCF, an odgi, a HAL and short-read indexes, which become JBrowse tracks
on the K12 axis: synteny, pangenome variants, a whole-genome MAF, depth,
per-strain presence, and a pileup of an isolate that is not in the graph at all,
mapped through it.

:::caution Experimental

The graph view is a beta plugin, and this tutorial covers experimental ideas. We
welcome your [feedback](/contact).

:::

## Prerequisites

- `docker` or `singularity`, for the cactus image (which carries odgi,
  halSynteny, hal2maf, `vg` and `samtools`)
- the NCBI
  [`datasets`](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/download-and-install/)
  CLI
- `bedGraphToBigWig` (UCSC kentUtils), htslib (`bgzip`, `tabix`), `samtools`,
  `python3`, `unzip`, `wget`
- `node`, for the [JBrowse CLI](/docs/cli)

On Debian/Ubuntu, `apt install samtools tabix unzip wget python3` covers five of
those. Docker installs from
[docs.docker.com](https://docs.docker.com/engine/install/); the NCBI `datasets`
CLI and `bedGraphToBigWig` are each a
[single-binary download](https://hgdownload.soe.ucsc.edu/admin/exe/); and `node`
comes from [nodejs.org](https://nodejs.org/). Everything else runs inside the
cactus image.

## Cactus against pggb

[Minigraph-Cactus](https://github.com/ComparativeGenomicsToolkit/cactus/blob/master/doc/pangenome.md)
(`cactus-pangenome`) builds a pangenome graph reference-first.
[minigraph](https://github.com/lh3/minigraph) lays down a backbone from the
reference you pick, every other sample is aligned onto it, and Cactus normalizes
the result into a graph.

This tutorial builds a graph from five _E. coli_ strains and loads it in JBrowse
as synteny, variants, a whole-genome alignment, depth and presence, then maps a
new isolate's reads through the finished graph. The graph is built here, not
downloaded.

The [pggb tutorial](/docs/tutorials/pangenome_ecoli) uses the same five strains
and the same projections onto K12, so the two pages compare the builders on
identical input. That one explains what each projection means; this one covers
producing them from Cactus, and
[one figure](#pangenome-depth-and-per-strain-presence) puts the two graphs'
depth curves in a single frame. Here is what changes between the two:

| Step             | pggb                                        | Minigraph-Cactus                                                 |
| ---------------- | ------------------------------------------- | ---------------------------------------------------------------- |
| Build            | wfmash + seqwish + smoothxg, then `-V`/`-M` | one `cactus-pangenome` run emits the graph, VCF, odgi, and a HAL |
| Reference        | symmetric all-vs-all, `-V` picks a path     | explicit `--reference`; the minigraph backbone is that genome    |
| Variants         | `pggb -V`, CHROM is the PanSN path          | `--vcf` (vg deconstruct), CHROM already the reference contig     |
| Whole-genome MAF | `pggb -M`, re-rooted on the reference       | the HAL, `hal2maf --refGenome` (already reference-rooted)        |
| Synteny          | the wfmash all-vs-all PAF                   | `halSynteny` from the HAL (or `odgi untangle`)                   |
| Depth / presence | `odgi depth` / `odgi pav`                   | same (odgi ships in the cactus image)                            |
| Short reads      | no mapping index emitted                    | `--giraffe` writes the `vg giraffe` indexes                      |

## Building the graph with cactus-pangenome

Cactus takes a **seqFile**: one `name<TAB>path` line per sample.

```bash
cat > seqfile.txt <<'EOF'
K12     K12.fa
Sakai   Sakai.fa
CFT073  CFT073.fa
NCTC86  NCTC86.fa
IAI39   IAI39.fa
EOF
```

Contigs keep their plain names here (`chr`). Cactus applies
[PanSN](https://github.com/pangenome/PanSN-spec) `sample#haplotype#contig`
naming to the graph internally, so there is no pre-naming step. (pggb is
different: it wants a PanSN-named concatenated FASTA up front.)

The image is used here because the projections below need odgi, halSynteny,
hal2maf and `vg`, and it carries all four. On a machine with no container
runtime at all, Cactus also ships a statically linked
[binary release](https://github.com/ComparativeGenomicsToolkit/cactus/blob/master/BIN-INSTALL.md).
Every later step runs in the same image, so wrap the `docker run` once and call
it `in_cactus`:

```bash
in_cactus() {
  docker run --rm -u "$(id -u):$(id -g)" -w /data -v "$PWD":/data \
    quay.io/comparative-genomics-toolkit/cactus:v3.2.1 "$@"
}
```

Under singularity,
`singularity exec --bind "$PWD":/data --pwd /data docker://<image>` replaces the
wrapper body and every call after it is unchanged. The
[build script](#reproduce-it-end-to-end) picks the runtime off `PATH`.

Now build the graph. `--reference K12` makes K12 the minigraph backbone, and the
path every projection is decomposed against:

```bash
in_cactus cactus-pangenome /data/js /data/seqfile.txt \
  --outDir /data/mc --outName ecoli --reference K12 \
  --vcf --gfa --gbz --odgi --viz --draw --giraffe --consCores 8
```

`/data/js` is the [Toil](https://toil.readthedocs.io/) job store, and must not
already exist on a fresh run. `--outName ecoli` prefixes every output file.
Without `--vcf`, Cactus builds the graph but does not deconstruct it, and the
variant projection has no input. `--odgi` writes the `.og` that the depth and
presence projections read, `--viz` writes the odgi raster shown at the end, and
`--giraffe` writes the indexes the read-mapping section needs. Pinning the image
to a dated version tag rather than `:latest` keeps the graph reproducible.

One run produces everything the sections below use:

- `mc/ecoli.gfa.gz`, `mc/ecoli.full.og`: the graph (GFA and odgi)
- `mc/ecoli.vcf.gz`: the pangenome variants
- `mc/ecoli.full.hal`: the multiple alignment as a HAL, which the synteny and
  MAF projections read
- `mc/ecoli.d2.gbz` and its `.dist`/`.min`/`.zipcodes`: the `vg giraffe` indexes
  from `--giraffe`, built over the graph filtered to sequence at least two
  haplotypes carry
- `mc/ecoli.viz/chr.full.viz.png`: the odgi 1D graph raster

The image also carries [odgi](https://github.com/pangenome/odgi), `halSynteny`,
and `hal2maf`, so the projections need no other tool.

## All-vs-all synteny projection

Cactus emits no all-vs-all PAF of its own. `odgi untangle` can project one, but
on a near-colinear bacterial graph its cut points are sparse and it collapses
each pair to a few whole-chromosome blocks.
[`halSynteny`](https://github.com/ComparativeGenomicsToolkit/hal) reads the
HAL's base-level alignment instead, and emits synteny blocks per genome pair. It
is used here.

`halSynteny` writes PSL, and names every sequence `chr` with no sample tag. The
[build script](#reproduce-it-end-to-end) runs it for all six strain pairs and
converts each PSL to PAF, injecting the PanSN `sample#0#chr` names and decoding
the strand. (halSynteny keeps the query on `+` and flips only the target, so the
PAF strand is the second character of the PSL strand field.)

Index the combined PAF so a range query fetches only the region in view:

```bash
jbrowse make-pif ecoli_cactus_ava.paf   # -> ecoli_cactus_ava.pif.gz (+ .tbi)
```

Then load it with an
[`AllVsAllIndexedPAFAdapter`](/docs/config/allvsallindexedpafadapter). The PanSN
`sample#` prefix on every record is how the adapter maps a record to its strain:

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "ecoli_cactus_ava",
  "name": "MC graph: all-vs-all synteny (halSynteny)",
  "assemblyNames": ["K12", "Sakai", "CFT073", "NCTC86", "IAI39"],
  "adapter": {
    "type": "AllVsAllIndexedPAFAdapter",
    "uri": "ecoli_cactus_ava.pif.gz",
    "assemblyNames": ["K12", "Sakai", "CFT073", "NCTC86", "IAI39"]
  }
}
```

To stack the five strains, use a linear synteny view with one panel per strain
and one `tracks` entry per band, each band naming the same track. Put this in
the view's `init`, or reach the same state from the UI with **Add → Linear
synteny view**, whose Quick start fills in a row per assembly the track lists.

```json
{
  "type": "LinearSyntenyView",
  "init": {
    "views": [
      { "assembly": "K12" },
      { "assembly": "Sakai" },
      { "assembly": "CFT073" },
      { "assembly": "NCTC86" },
      { "assembly": "IAI39" }
    ],
    "tracks": [
      ["ecoli_cactus_ava"],
      ["ecoli_cactus_ava"],
      ["ecoli_cactus_ava"],
      ["ecoli_cactus_ava"]
    ],
    "minAlignmentLength": 10000,
    "levelHeights": [110, 110, 110, 110]
  }
}
```

<Figure caption="The Minigraph-Cactus graph's synteny projection: the five strains stacked K12 to IAI39, a halSynteny ribbon between each adjacent pair. The continuous diagonals of the top three bands are the shared backbone. The bottom band crosses where IAI39 carries large inversions relative to the others." src="/img/pangenome_cactus/synteny.png" />

This is the same five strains in the same row order as the
[all-vs-all tutorial's stack](/docs/tutorials/allvsall_synteny#stacking-the-genomes)
and the [pggb one](/docs/tutorials/pangenome_ecoli#synteny-projection), and all
three agree on the backbone and on IAI39's inversions. What differs is where the
blocks came from. minimap2 aligns each pair of assemblies directly, so its
blocks are one aligner's opinion about two genomes at a time. These are read out
of the HAL, so they are the graph's own base-level alignment, and so is every
other projection on this page.

## Pangenome variants projection

`--vcf` decomposes the graph against the K12 reference with
[`vg deconstruct`](https://github.com/vgteam/vg), genotyped across the other
four strains. Its `CHROM` is already the reference contig (`chr`), so the `.gz`
and `.tbi` Cactus wrote load unchanged, where the pggb VCF needs its PanSN path
renamed first.

Load `mc/ecoli.vcf.gz` as a [`VariantTrack`](/docs/config_guides/variant_track)
on K12 and pick the matrix display, one column per variant and one row per
sample:

```json
{
  "type": "VariantTrack",
  "trackId": "ecoli_cactus_variants",
  "name": "MC graph: pangenome variants (vs K12)",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "VcfTabixAdapter",
    "uri": "mc/ecoli.vcf.gz"
  },
  "displays": [{ "type": "LinearMultiSampleVariantMatrixDisplay" }]
}
```

The [multi-sample variant track guide](/docs/user_guides/multivariant_track)
covers the matrix versus the per-position display, the genotype colors, and
clustering samples by genotype.

`vg deconstruct` emits a snarl **tree**, one record per snarl at every level, so
its wide records paint over the fine layer they were decomposed from.
`cactus-pangenome` runs [`vcfbub`](https://github.com/pangenome/vcfbub) itself,
on by default, which is why nothing above has to pop that tree; `--vcfbub 0`
turns it off, and `--vcfwave` realigns the survivors into primitive variants.
The pggb tutorial
[sets the same knob by hand](/docs/tutorials/pangenome_ecoli#why-the-reference-path-takes-a-length),
and covers what the width cap costs.

## Whole-genome alignment (MAF) projection

`cactus-pangenome` writes `mc/ecoli.full.hal` by default, and that is the
cleanest route to a MAF. `hal2maf --refGenome K12` roots every block on K12
directly, so there is no re-rooting step. The HAL's `genome.sequence` rows come
out as `K12.chr`, `Sakai.chr`, and so on, which is exactly the `sample.contig`
naming the MAF display splits each species off on:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/maf_to_bed.py
in_cactus hal2maf --refGenome K12 --noAncestors /data/mc/ecoli.full.hal /data/ecoli_cactus.maf
python3 maf_to_bed.py ecoli_cactus.maf ecoli_cactus.maf.bed
bgzip ecoli_cactus.maf.bed
tabix -p bed ecoli_cactus.maf.bed.gz
```

[`maf_to_bed.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/maf_to_bed.py)
writes one line per block, carrying that block's rows, which a
[`MafTabixAdapter`](/docs/config/maftabixadapter) reads. Because `hal2maf` has
already rooted every block on K12,
[maf2bed](https://github.com/cmdcolin/maf2bed) converts this MAF just as well
and streams while it does it, which matters at whole-genome scale; see
[producing the tabix BED](/docs/config_guides/maf_track#producing-the-tabix-bed-from-a-maf).

```json
{
  "type": "MafTrack",
  "trackId": "ecoli_cactus_maf",
  "name": "MC graph: whole-genome alignment (MAF, vs K12)",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "MafTabixAdapter",
    "samples": ["K12", "Sakai", "CFT073", "NCTC86", "IAI39"],
    "uri": "ecoli_cactus.maf.bed.gz"
  }
}
```

<Figure caption="The Minigraph-Cactus HAL projected onto K12 as a MAF: the coverage band on top, then one row per strain (K12 first), colored where each differs from K12. All five align continuously across this window, so the blank stretch through the middle is sequence matching K12, not missing alignment." src="/img/pangenome_cactus/maf.png" />

A row can be blank for two reasons. A stretch with no colored columns is
sequence that strain shares with K12, which is the case in the window above. A
row that stops entirely is a strain with no alignment to K12 there, which is
what the same track shows on the
[pggb page's 60 kb window](/docs/tutorials/pangenome_ecoli#whole-genome-alignment-maf-projection).
The coverage band separates the two: it drops where rows drop out and holds
where they match.

`samples` both names the rows and fixes their order. To order them by how much
of the graph each pair of strains shares instead, run
[`odgi similarity`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_similarity.html)
on `mc/ecoli.full.og` and point `nhLocation` at the tree, which is what the
[pggb tutorial's MAF track](/docs/tutorials/pangenome_ecoli#whole-genome-alignment-maf-projection)
does.

The [MAF track guide](/docs/user_guides/maf_track) covers the conservation band,
per-row identity, and codon view, all derived from the alignment with no extra
files. The same `hal2maf` route works for a
[progressiveCactus](https://github.com/ComparativeGenomicsToolkit/cactus) HAL of
more divergent species.

## Pangenome depth and per-strain presence

[`odgi depth`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_depth.html)
counts how many paths traverse the graph under each K12 base, and
[`odgi pav`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_pav.html)
splits that aggregate per strain. Both run as they do in the pggb tutorial's
[depth](/docs/tutorials/pangenome_ecoli#pangenome-depth-projection-core-vs-accessory)
and [per-strain presence](/docs/tutorials/pangenome_ecoli#per-strain-presence)
sections, over `mc/ecoli.full.og` instead of the pggb GFA, and load as the same
[`QuantitativeTrack`](/docs/config_guides/quantitative_track) and
[`MultiQuantitativeTrack`](/docs/user_guides/multiquantitative_track). Two names
change: the reference path is `K12#0#chr`, and each non-reference strain carries
a trailing subpath tag (`Sakai#0#chr#0`), so the per-strain filter has to match
a prefix rather than the whole name. The
[build script](#reproduce-it-end-to-end) runs both.

What depth counts is path **steps**, not strains, so a repeat the graph folded
onto one run of nodes reads above the strain count: every path carrying several
copies walks that run several times. That is where the two builders part company
on identical input, and it is the one difference between them visible in a
single frame. seqwish folds the rRNA copies together, so the pggb curve runs
above the strain count there; the reference-first graph keeps them apart and its
curve never exceeds the strain count anywhere on the chromosome.

<Figure caption="odgi depth over the banded rrnC operon, the same command over the same K12 windows against each builder's graph, on one fixed axis. The pggb row doubles over the operon and the Minigraph-Cactus row does not move. Both are correct about their own graph: the callout on each row names the operation that decides it." src="/img/pangenome_cactus/builders.png" />

Neither curve is wrong, and neither builder is the correct one. They were asked
different questions: seqwish merges identical sequence wherever it occurs, while
a reference-anchored build keeps each copy at its own coordinate. A collapsed
repeat is where to look for variation _within_ an array, since every copy's
bases stack on the same nodes, and a reference-anchored one is where to ask
which copy a read came from. What follows for this projection is only that
`odgi depth` counts steps, so it is a strain tally on the Minigraph-Cactus graph
and not on the pggb one. The pggb tutorial reads the same operon the other way,
as
[several query segments landing on one reference span](/docs/tutorials/pangenome_ecoli#the-same-picture-read-out-of-the-graph).

Drawn under the aggregate curve, the pav rows say which strain accounts for each
dip: one falls to 0 over its own accessory stretch while the others hold at 1.
The picture is the one the pggb tutorial already shows
([per-strain presence](/docs/tutorials/pangenome_ecoli#per-strain-presence)),
because at this scale the two graphs give the same answer. Where they do not is
the rRNA operons, and that is the figure above rather than this one: the Cactus
depth curve holds at 5 across them where the pggb curve doubles.

## Mapping a new isolate through the graph

Every projection above re-plots a genome the graph was built from. This one does
not: it takes a sample that is not in the graph at all and maps its short reads
through the whole pangenome, then flattens the result onto K12.

That is what the graph buys over a plain K12 reference, and the surjection step
bounds how much of it a K12-anchored pileup can show. A read over an allele K12
lacks does place in the graph, on whichever strain's path carries it, but that
alignment has no K12 coordinate for `vg surject` to project onto, so it leaves
surjection unmapped and the filter below drops it. The depth and presence tracks
above are where that sequence is accounted for instead.

What reaches the BAM is the other half of the benefit: reads over sequence K12
does carry, where the graph let a divergent read follow a non-reference path
through a bubble rather than spend the difference on mismatches and soft clips.

`--giraffe` wrote the indexes for this during the build. `vg giraffe` maps
against the graph and emits a GAM, and `vg surject` projects that graph
alignment onto one path as an ordinary BAM. The reads here are _E. coli_ KTa004
([ENA DRR063408](https://www.ebi.ac.uk/ena/browser/view/DRR063408), Illumina
MiSeq), a strain the graph has never seen:

```bash
in_cactus vg giraffe -p \
  -Z /data/mc/ecoli.d2.gbz -d /data/mc/ecoli.d2.dist \
  -m /data/mc/ecoli.d2.shortread.withzip.min -z /data/mc/ecoli.d2.shortread.zipcodes \
  -f /data/reads/sub_1.fastq.gz -f /data/reads/sub_2.fastq.gz > mapped.gam

in_cactus vg surject -x /data/mc/ecoli.d2.gbz -b -p K12#0#chr \
  -N KTa004 -R KTa004 /data/mapped.gam > mapped.raw.bam
```

`-p K12#0#chr` picks the path to surject onto, so the BAM's one reference
sequence is that PanSN path name. Rename it to the assembly's refName in the
header, drop the unmapped reads, then sort and index; the
[build script](#reproduce-it-end-to-end) does those four `samtools` steps, and
downloads and subsamples the reads.

The result is a plain BAM, so it needs no pangenome-aware track type:

```json addtrack
{
  "type": "AlignmentsTrack",
  "trackId": "ecoli_cactus_reads",
  "name": "KTa004 reads mapped through the graph (vs K12)",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "BamAdapter",
    "uri": "ecoli_cactus_reads.bam"
  }
}
```

Stack it over the variant and MAF projections and the pileup reads against the
graph it came out of, at the loci where this isolate is far enough from K12 for
the difference to be worth a graph. The
[alignments track guide](/docs/user_guides/alignments_track) covers coloring and
sorting the pileup.

`vg giraffe` rewrites `ecoli.d2.dist` as it runs, leaving it newer than the
`.min` and `.zipcodes` built from it, so a second run refuses to start on an
index that only looks stale. `touch` the two derived files before re-mapping.

## Drawing this graph as a graph

Every projection above flattens the graph onto K12. JBrowse can also draw it as
a graph, through the
[graph genome view plugin](/docs/user_guides/graph_genome_view).

`mc/ecoli.gfa.gz` carries no `SN`/`SO`/`SR` tags, so it takes the plain-GFA
route: `build_pggb_tabix.sh` walks the path lines offline and writes the two
tabix-indexed BEDs `RgfaTabixAdapter` reads, which makes the whole graph
queryable by locus with no per-window extraction step.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_pggb_tabix.sh
bash build_pggb_tabix.sh mc/ecoli.gfa.gz ecoli_cactus K12
```

Cactus writes the reference as a `P` line and the haplotypes as `W` lines, and
the walk reads both in file order, so the third argument anchors rank 0 on the
K12 path. The non-reference paths carry a trailing subpath tag
(`Sakai#0#chr#0`), which changes nothing here, since PanSN still resolves the
sample.

The
[pggb tutorial](/docs/tutorials/pangenome_ecoli#browsing-the-whole-graph-by-locus)
covers the track config this produces, the decisions in the walk that decide
what it can be trusted for, and the graph size past which cutting one window
offline with `odgi extract` is the better route.

## Compared to `odgi viz`

`--viz` already wrote `mc/ecoli.viz/chr.full.viz.png`, the same
[`odgi viz`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_viz.html)
raster the [pggb tutorial](/docs/tutorials/pangenome_ecoli#compared-to-odgi-viz)
contrasts against its projections. It gives one row per strain, but puts the
graph's node order on the horizontal axis instead of a genome coordinate.

<Figure caption="The five-strain Minigraph-Cactus graph drawn by odgi viz: one row per strain, colored where that strain traverses the graph and white where it does not. The horizontal axis is graph node order, not K12 position, so nothing lines up with a gene or coordinate. The gold band marks the locus carried over to the JBrowse figure below." src="/img/pangenome_cactus/graph.png" />

The `odgi pav` track carries the same information as the raster, one row per
path painted where that path is present. Drawing it on K12's coordinates in the
raster's row order and colors leaves the horizontal axis as the only difference
between the two figures. The gold band marks the same 100 kb of K12,
`chr:1,000,000-1,100,000`, in both. K12 has no row of its own below because it
is the axis there.

<Figure caption="The same paths, the same colors, on K12's coordinates instead of the graph's. The gold band is the same 100 kb in both figures, and takes up a visibly smaller share of this axis than of the graph axis above." src="/img/pangenome_cactus/graph_correspondence.png" />

The band is about twice as wide on the graph axis. The graph axis counts
pangenome bases, so a locus where the other strains carry sequence K12 lacks
takes up more of it, while the JBrowse axis holds every locus to its reference
width. This is the 100 kb window where the gap is largest, which is why it sits
over a dip in the depth track.

Node ids in a Cactus graph run `1..N` in node order, so a node's pangenome
offset is the cumulative length of every lower id, and walking K12's `P` line
turns a K12 offset into a node and then a pangenome offset.
`build_ecoli_pangenome_cactus.sh` does that walk and writes the pixel span it
implies, so both bands come from the same arithmetic.

The band contains Sakai's stx2 prophage and a second Sakai-only stretch, so
crossing this 100 kb of K12 costs the other strains substantially more of their
own sequence. The
[all-vs-all tutorial's stx2 figure](/docs/tutorials/allvsall_synteny) opens the
locus two rows deep with the gene lane on, and
[Synteny from ortholog tables](/docs/tutorials/multiway_synteny_grape_peach_cacao)
covers the gene-level version of that zoom.

## Reproduce it end to end

[`build_ecoli_pangenome_cactus.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_ecoli_pangenome_cactus.sh)
runs everything above in one shot, encoding the HAL's MAF with
[`maf_to_bed.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/maf_to_bed.py):

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_ecoli_pangenome_cactus.sh
bash build_ecoli_pangenome_cactus.sh   # builds ./ecoli_cactus_build/jbrowse2
npx --yes serve ecoli_cactus_build/jbrowse2
```

It downloads the same five RefSeq genomes as the pggb build, runs
`cactus-pangenome`, converts the HAL, VCF, `odgi depth`, and `odgi pav` into the
projections above, maps the KTa004 reads through the graph, downloads JBrowse,
and writes a `config.json` with the five assemblies, per-strain gene tracks, the
projection tracks, and a default session. It needs the same tools listed under
[Prerequisites](#prerequisites).

It picks its container runtime from what is on `PATH`, docker first and then
singularity or apptainer. Force one with `CONTAINER=singularity`.

## See also

- [](/docs/tutorials/pangenome_ecoli)
- [](/docs/tutorials/pangenome_hprc)
- [](/docs/tutorials/allvsall_synteny)
- [](/docs/user_guides/graph_genome_view)
- [](/docs/user_guides/maf_track)
- [Minigraph-Cactus](https://github.com/ComparativeGenomicsToolkit/cactus/blob/master/doc/pangenome.md)
