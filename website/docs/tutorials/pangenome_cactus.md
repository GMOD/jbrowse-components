---
title: Pangenome (Minigraph-Cactus)
description:
  Build a Minigraph-Cactus pangenome graph and load its linear projections in
  JBrowse
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
---

**TL;DR:** one `cactus-pangenome` run over five _E. coli_ strains emits the
graph, a VCF, an odgi, a HAL and short-read indexes, which become JBrowse tracks
on the K12 axis: synteny, pangenome variants, a whole-genome MAF, depth,
per-strain presence, and a pileup of an isolate outside the graph, mapped
through it.

:::caution Experimental

The graph view is a beta plugin, and this tutorial covers experimental ideas. We
welcome your [feedback](/contact).

:::

## Prerequisites

- `docker` or `singularity`, for the cactus image (which carries odgi,
  halSynteny, hal2maf, `vg` and `samtools`)
- htslib (`bgzip`, `tabix`)
- `python3`
- `node`, for the [JBrowse CLI](/docs/cli), which the fences below run directly
- the NCBI
  [`datasets`](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/download-and-install/)
  CLI, additionally for the [whole build](#reproduce-it-end-to-end)
- `bedGraphToBigWig` (UCSC kentUtils), additionally for the
  [whole build](#reproduce-it-end-to-end)
- `samtools`, additionally for the [whole build](#reproduce-it-end-to-end)
- `unzip`, additionally for the [whole build](#reproduce-it-end-to-end)
- `wget`, additionally for the [whole build](#reproduce-it-end-to-end)
- the GraphGenomeView plugin, for
  [drawing the graph as a graph](#installing-the-plugin); every other track here
  is a built-in type

On Debian/Ubuntu, `apt install samtools tabix unzip wget python3` covers five of
those. Docker installs from
[docs.docker.com](https://docs.docker.com/engine/install/); the NCBI `datasets`
CLI and `bedGraphToBigWig` are each a
[single-binary download](https://hgdownload.soe.ucsc.edu/admin/exe/); and `node`
comes from [nodejs.org](https://nodejs.org/). Everything else runs inside the
cactus image.

## Where the data comes from

Five _E. coli_ RefSeq assemblies, fetched by accession with the NCBI datasets
CLI, K12 the `--reference` backbone the other four are aligned onto.

- K12:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/005/845/GCF_000005845.2_ASM584v2/
- Sakai:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/008/865/GCF_000008865.2_ASM886v2/
- CFT073:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/007/445/GCF_000007445.1_ASM744v1/
- NCTC86:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/002/007/705/GCF_002007705.1_ASM200770v1/
- IAI39:
  https://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/000/026/345/GCF_000026345.1_ASM2634v1/
- KTa004 short reads mapped through the finished graph, forward mate:
  https://ftp.sra.ebi.ac.uk/vol1/fastq/DRR063/DRR063408/DRR063408_1.fastq.gz
- KTa004 short reads, reverse mate:
  https://ftp.sra.ebi.ac.uk/vol1/fastq/DRR063/DRR063408/DRR063408_2.fastq.gz
- the graph's segments and links, tabix-indexed and rehosted so the graph genome
  view figures load with no local build:
  https://jbrowse.org/demos/ecoli_pangenome/

## The Minigraph-Cactus pipeline

[Minigraph-Cactus](https://github.com/ComparativeGenomicsToolkit/cactus/blob/master/doc/pangenome.md)
(`cactus-pangenome`) builds a pangenome graph reference-first.
[minigraph](https://github.com/lh3/minigraph) lays down a backbone from the
reference you pick, every other sample is aligned onto it, and Cactus normalizes
the result into a graph.

This tutorial builds a graph from five _E. coli_ strains, loads it as synteny,
variants, a whole-genome alignment, depth and presence, then maps a new
isolate's reads through it. The [HPRC tutorial](/docs/tutorials/pangenome_hprc)
is the same builder at human scale.

The [pggb tutorial](/docs/tutorials/pangenome_ecoli) uses the same five strains
and the same projections onto K12, so the two pages compare the builders on
identical input.
[What each projection is](/docs/tutorials/pangenome_ecoli#the-linear-projections)
is written up there; this page covers producing them from Cactus. What changes
between the two:

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
naming to the graph internally.

The image carries [odgi](https://github.com/pangenome/odgi), `halSynteny`,
`hal2maf` and `vg`, which the projections below need; Cactus also ships a
[binary release](https://github.com/ComparativeGenomicsToolkit/cactus/blob/master/BIN-INSTALL.md)
for a machine with no container runtime. Every step runs in the same image, so
wrap the `docker run` once:

```bash
in_cactus() {
  docker run --rm -u "$(id -u):$(id -g)" -w /data -v "$PWD":/data \
    quay.io/comparative-genomics-toolkit/cactus:v3.2.1 "$@"
}
```

Under singularity,
`singularity exec --bind "$PWD":/data --pwd /data docker://<image>` replaces the
wrapper body. The [build script](#reproduce-it-end-to-end) picks the runtime off
`PATH`.

`--reference K12` makes K12 the minigraph backbone and the path every projection
is decomposed against:

<!-- from: scripts/build_ecoli_pangenome_cactus.sh -->

```bash
in_cactus cactus-pangenome /data/js /data/seqfile.txt \
  --outDir /data/mc --outName ecoli --reference K12 \
  --vcf --gfa --gbz --odgi --viz --draw --giraffe --consCores 8
```

- `/data/js` is the [Toil](https://toil.readthedocs.io/) job store, and must not
  already exist on a fresh run.
- `--outName ecoli` prefixes every output file.
- `--vcf` deconstructs the graph into the variant projection's input.
- `--odgi` writes the `.og` that the depth and presence projections read.
- `--viz` writes the odgi raster shown at the end.
- `--giraffe` writes the indexes the read-mapping section needs.

One run produces everything the sections below use:

- `mc/ecoli.gfa.gz`, `mc/ecoli.full.og`: the graph (GFA and odgi)
- `mc/ecoli.vcf.gz`: the pangenome variants
- `mc/ecoli.full.hal`: the multiple alignment as a HAL, which the synteny and
  MAF projections read
- `mc/ecoli.d2.gbz` and its `.dist`/`.min`/`.zipcodes`: the `vg giraffe` indexes
  from `--giraffe`, built over the graph filtered to sequence at least two
  haplotypes carry
- `mc/ecoli.viz/chr.full.viz.png`: the odgi 1D graph raster

## All-vs-all synteny projection

[`halSynteny`](https://github.com/ComparativeGenomicsToolkit/hal) reads the
HAL's base-level alignment and emits synteny blocks per genome pair. It writes
PSL and names every sequence `chr` with no sample tag, so the
[build script](#reproduce-it-end-to-end) runs it for all six pairs and converts
each PSL to PAF, injecting the PanSN `sample#0#chr` names and decoding the
strand (halSynteny flips only the target, so the PAF strand is the second
character of the PSL strand field).

Index the combined PAF so a range query fetches only the region in view:

<!-- from: scripts/build_ecoli_pangenome_cactus.sh -->

```bash
jbrowse make-pif ecoli_cactus_ava.paf   # -> ecoli_cactus_ava.pif.gz (+ .tbi)
```

Load it with an
[`AllVsAllIndexedPAFAdapter`](/docs/config/allvsallindexedpafadapter), whose
PanSN `sample#` prefix on every record is how it maps a record to its strain:

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

To stack the five strains, a linear synteny view takes one panel per strain and
one `tracks` entry per band, each naming the same track. Put this in the
session's `views`, or use **Add → Linear synteny view**, whose Quick start fills
in a row per assembly the track lists.

```json
{
  "type": "LinearSyntenyView",
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
```

<Figure caption="The Minigraph-Cactus graph's synteny projection: five strains stacked K12 to IAI39, a halSynteny ribbon between each adjacent pair. The bottom band crosses where IAI39 carries large inversions relative to the others." src="/img/pangenome_cactus/synteny.png" />

Same five strains in the same row order as the
[all-vs-all tutorial's stack](/docs/tutorials/allvsall_synteny#stacking-the-genomes)
and the [pggb one](/docs/tutorials/pangenome_ecoli#synteny-projection). These
blocks are read out of the HAL, so they are the graph's own alignment.

## Pangenome variants projection

`--vcf` decomposes the graph against K12 with
[`vg deconstruct`](https://github.com/vgteam/vg), genotyped across the other
four strains. Its `CHROM` is already `chr`, so the `.gz` and `.tbi` Cactus wrote
load unchanged as a [`VariantTrack`](/docs/config_guides/variant_track) with the
matrix display, one column per variant and one row per sample:

```json addtrack
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
wide records paint over the fine layer under them. `cactus-pangenome` pops that
tree with [`vcfbub`](https://github.com/pangenome/vcfbub) by default;
`--vcfbub 0` turns it off, and `--vcfwave` realigns the survivors into primitive
variants. The pggb tutorial
[sets the same knob by hand](/docs/tutorials/pangenome_ecoli#why-the-reference-path-takes-a-length).

## Whole-genome alignment (MAF) projection

The MAF comes out of `mc/ecoli.full.hal`. `hal2maf --refGenome K12` roots every
block on K12, and the rows come out as `K12.chr`, `Sakai.chr`, and so on, the
`sample.contig` naming the MAF display splits species on:

<!-- from: scripts/build_ecoli_pangenome_cactus.sh -->

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/maf_to_bed.py
in_cactus hal2maf --refGenome K12 --noAncestors /data/mc/ecoli.full.hal /data/ecoli_cactus.maf
python3 maf_to_bed.py ecoli_cactus.maf ecoli_cactus.maf.bed
bgzip ecoli_cactus.maf.bed
tabix -p bed ecoli_cactus.maf.bed.gz
```

[`maf_to_bed.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/maf_to_bed.py)
writes one line per block, which a
[`MafTabixAdapter`](/docs/config/maftabixadapter) reads. Since every block is
already rooted on K12, the streaming
[maf2bed](https://github.com/cmdcolin/maf2bed) converts this MAF too; see
[producing the tabix BED](/docs/config_guides/maf_track#producing-the-tabix-bed-from-a-maf).

```json addtrack
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

<Figure caption="The Minigraph-Cactus HAL projected onto K12 as a MAF: the coverage band on top, then one row per strain, colored where each differs from K12. The four non-K12 rows stop at the edges of the cryptic prophage CPZ-55, which K12 alone carries." src="/img/pangenome_cactus/maf.png" />

A row reads blank two ways: no colored columns is sequence shared with K12, and
a row that stops is a strain with no alignment to K12 there. The coverage band
separates them.

`samples` names the rows and fixes their order. To order them by shared graph
content instead, run
[`odgi similarity`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_similarity.html)
on `mc/ecoli.full.og` and point `nhLocation` at the tree, as the
[pggb tutorial's MAF track](/docs/tutorials/pangenome_ecoli#whole-genome-alignment-maf-projection)
does.

The [MAF track guide](/docs/user_guides/maf_track) covers the conservation band,
per-row identity, and codon view. The same `hal2maf` route works for a
[progressiveCactus](https://github.com/ComparativeGenomicsToolkit/cactus) HAL of
more divergent species.

## Pangenome depth and per-strain presence

[`odgi depth`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_depth.html)
counts how many paths traverse the graph under each K12 base, and
[`odgi pav`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_pav.html)
splits that per strain. Both run as in the pggb tutorial's
[depth](/docs/tutorials/pangenome_ecoli#pangenome-depth-projection-core-vs-accessory)
and [per-strain presence](/docs/tutorials/pangenome_ecoli#per-strain-presence)
sections, over `mc/ecoli.full.og`, and load as the same
[`QuantitativeTrack`](/docs/config_guides/quantitative_track) and
[`MultiQuantitativeTrack`](/docs/user_guides/multiquantitative_track). Two names
change: the reference path is `K12#0#chr`, and each other strain carries a
trailing subpath tag (`Sakai#0#chr#0`), so the per-strain filter matches a
prefix. The [build script](#reproduce-it-end-to-end) runs both.

Depth counts path **steps** rather than strains, so a repeat the graph folded
onto one run of nodes reads above the strain count. seqwish folds the rRNA
copies together; the reference-first graph keeps them apart.

<Figure caption="odgi depth over the banded rrnC operon, the same command over the same K12 windows against each builder's graph, on one fixed axis. The pggb row doubles over the operon and the Minigraph-Cactus row does not move." src="/img/pangenome_cactus/builders.png" />

A collapsed repeat is where to look for variation _within_ an array; a
reference-anchored copy keeps each at its own coordinate, so the depth curve
here is a strain tally.

Under the aggregate curve, the pav rows say which strain accounts for each dip,
as in the pggb tutorial's
[per-strain presence](/docs/tutorials/pangenome_ecoli#per-strain-presence).

## Mapping a new isolate through the graph

This step takes a sample outside the graph, maps its short reads through the
whole pangenome, and flattens the result onto K12. A read over an allele K12
lacks places on another strain's path and has no K12 coordinate, so surjection
leaves it unmapped; the BAM holds reads over sequence K12 carries, where a
divergent read followed a non-reference path through a bubble and paid no
mismatches or soft clips for it.

`--giraffe` wrote the indexes during the build. `vg giraffe` emits a GAM, and
`vg surject` projects it onto one path as a BAM. The reads are _E. coli_ KTa004
([ENA DRR063408](https://www.ebi.ac.uk/ena/browser/view/DRR063408), Illumina
MiSeq), a strain the graph has never seen:

<!-- from: scripts/build_ecoli_pangenome_cactus.sh -->

```bash
in_cactus vg giraffe -p \
  -Z /data/mc/ecoli.d2.gbz -d /data/mc/ecoli.d2.dist \
  -m /data/mc/ecoli.d2.shortread.withzip.min -z /data/mc/ecoli.d2.shortread.zipcodes \
  -f /data/reads/sub_1.fastq.gz -f /data/reads/sub_2.fastq.gz > mapped.gam

in_cactus vg surject -x /data/mc/ecoli.d2.gbz -b -p K12#0#chr \
  -N KTa004 -R KTa004 /data/mapped.gam > mapped.raw.bam
```

`-p K12#0#chr` picks the path to surject onto, so the BAM's one reference
sequence is that PanSN name. Rename it to the assembly's refName in the header,
drop the unmapped reads, sort and index; the
[build script](#reproduce-it-end-to-end) does those `samtools` steps and
subsamples the reads. The result loads as an ordinary alignments track:

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

The [alignments track guide](/docs/user_guides/alignments_track) covers coloring
and sorting the pileup.

`vg giraffe` rewrites `ecoli.d2.dist` as it runs, leaving it newer than the
`.min` and `.zipcodes` built from it, so a second run refuses to start. `touch`
the two derived files before re-mapping.

## Opening the graph in the graph genome view

JBrowse can also draw the graph as a graph, through the
[graph genome view plugin](/docs/user_guides/graph_genome_view).

### Installing the plugin

The plugin is beta and not in the [plugin store](/docs/user_guides/plugin_store)
yet, so it loads by URL from a top-level `plugins` array in `config.json` (see
[configuring plugins](/docs/config_guides/plugins)):

<!-- GRAPH_PLUGIN_CONFIG START -->

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

<!-- GRAPH_PLUGIN_CONFIG END -->

`RgfaTabixAdapter` ships in the same plugin, so the segments track below needs
it too. On [JBrowse Desktop](/docs/quickstart_desktop), install it once from the
start screen at **Global plugins... → Add custom plugin**, putting that `esmUrl`
under **Advanced options** in **ESM build URL**.

### Indexing the graph

`mc/ecoli.gfa.gz` carries no `SN`/`SO`/`SR` tags, so `build_pggb_tabix.sh` walks
the path lines offline and writes the two tabix-indexed BEDs `RgfaTabixAdapter`
reads, making the whole graph queryable by locus.

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_pggb_tabix.sh
bash build_pggb_tabix.sh mc/ecoli.gfa.gz ecoli_cactus K12
```

The third argument anchors rank 0 on the K12 path. The pair loads as one
`FeatureTrack` pointed at the shared prefix; the `uri` below is our hosted copy,
and a local build swaps in the `ecoli_cactus` prefix written above.

```json addtrack
{
  "type": "FeatureTrack",
  "trackId": "ecoli_cactus_segments",
  "name": "MC graph: segments (whole graph, by locus)",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "uri": "https://jbrowse.org/demos/ecoli_pangenome/ecoli_cactus"
  },
  "displayDefaults": { "showLabels": false }
}
```

The segments draw as an ordinary track on K12, and **Track menu → Launch → Graph
genome view (this region)** cuts a subgraph at whatever is on screen.

<Video src="/media/pangenome_cactus/subgraph_launch.mp4" caption="The Minigraph-Cactus graph put into an empty K12 session and then cut: the config above pasted into Open track... → Add track from pasted JSON, the window narrowed onto the IS1 element past flhD, and Launch → Graph genome view (this region) on the segments lane's own menu." />

A kilobase or two is the width to open one at. Past the flagellar operon, K12
carries an IS1 element the other four skip. A second copy of the segments track,
colored by the `SM:Z:` carriage the walk recorded, says which segments those
are; the pggb page gives
[that track's config](/docs/tutorials/pangenome_ecoli#carriage-as-a-linear-lane).

<Figure caption="1.6 kb of K12 past flhD, as a linear view above and as a graph below, both reading the same two tabix indexes. The gene lane names the IS1 transposase pair insA5 and insB5 in the shaded span, the carriage lane paints that span as carried by one strain where the rest of the window is all five, and in the graph it is the single long node the other four route around." src="/img/pangenome_cactus/graph_bubble.png" />

Both halves run the reference position ramp over the cut's region, so a color in
the lane is that color in the graph. The dashed edge is the other four strains'
route. An edge carries no sequence, so its drawn length comes from the layout;
the label on it is the length of the node it skips.

The
[pggb tutorial](/docs/tutorials/pangenome_ecoli#browsing-the-whole-graph-by-locus)
covers what the walk can be trusted for, and the graph size past which
`odgi extract` is the better route.

## Compared to `odgi viz`

`--viz` wrote `mc/ecoli.viz/chr.full.viz.png`, the
[`odgi viz`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_viz.html)
raster the [pggb tutorial](/docs/tutorials/pangenome_ecoli#compared-to-odgi-viz)
also shows: one row per strain, graph node order on the horizontal axis.

<Figure caption="The five-strain Minigraph-Cactus graph drawn by odgi viz, one row per strain. The horizontal axis is graph node order, so nothing lines up with a gene or coordinate. The gold band marks the locus carried over to the figure below." src="/img/pangenome_cactus/graph.png" />

The `odgi pav` track carries the same information. Drawing it on K12's
coordinates in the raster's row order and colors leaves the horizontal axis as
the only difference. The gold band marks `chr:1,000,000-1,100,000` in both.

<Figure caption="The same paths and the same colors on K12's coordinates. The gold band is the same 100 kb in both figures, and takes up a visibly smaller share of this axis than of the graph axis above." src="/img/pangenome_cactus/graph_correspondence.png" />

The graph axis counts pangenome bases, so a locus where other strains carry
sequence K12 lacks takes up more of it. This is the 100 kb window where that gap
is largest, which is why it sits over a dip in the depth track. Node ids in a
Cactus graph run `1..N` in node order, so walking K12's `P` line turns a K12
offset into a pangenome offset; `build_ecoli_pangenome_cactus.sh` does that
walk.

The band contains Sakai's _stx2_ prophage and a second Sakai-only stretch. The
[all-vs-all tutorial's stx2 figure](/docs/tutorials/allvsall_synteny) opens the
locus two rows deep with the gene lane on, and
[Synteny from ortholog tables](/docs/tutorials/multiway_synteny_grape_peach_cacao)
covers the gene-level version.

## Reproduce it end to end

[`build_ecoli_pangenome_cactus.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_ecoli_pangenome_cactus.sh)
runs everything above in one shot, encoding the HAL's MAF with
[`maf_to_bed.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/maf_to_bed.py):

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_ecoli_pangenome_cactus.sh
bash build_ecoli_pangenome_cactus.sh   # builds ./ecoli_cactus_build/jbrowse2
npx --yes serve ecoli_cactus_build/jbrowse2
```

It downloads the five RefSeq genomes, runs `cactus-pangenome`, converts the HAL,
VCF, `odgi depth` and `odgi pav` into the projections above, maps the KTa004
reads, indexes the graph with `build_pggb_tabix.sh`, and writes a `config.json`
with the five assemblies, per-strain gene tracks, the projection and segments
tracks, the plugin declaration and a default session. It needs the tools under
[Prerequisites](#prerequisites), and picks its container runtime off `PATH`,
docker first; force one with `CONTAINER=singularity`.

## See also

- [](/docs/tutorials/pangenome_ecoli)
- [](/docs/tutorials/pangenome_hprc)
- [](/docs/tutorials/allvsall_synteny)
- [](/docs/user_guides/graph_genome_view)
- [](/docs/user_guides/maf_track)
- [Minigraph-Cactus](https://github.com/ComparativeGenomicsToolkit/cactus/blob/master/doc/pangenome.md)
