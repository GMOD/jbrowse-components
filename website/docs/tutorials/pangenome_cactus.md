---
title: Pangenome (Minigraph-Cactus)
description:
  Build a Minigraph-Cactus pangenome graph and load its linear projections in
  JBrowse
guide_category: Tutorials
tutorial_category: Pangenomes
---

We build a pangenome graph of five _E. coli_ strains with Minigraph-Cactus and
turn its outputs into JBrowse tracks on the K12 genome. One `cactus-pangenome`
run writes the graph, a VCF, an odgi file, a HAL alignment and short-read
indexes, and we:

- load synteny, variants, a whole-genome alignment (MAF), depth and per-strain
  presence as tracks
- map the reads of an isolate outside the graph through it
- index the graph and draw it as a track

:::caution Experimental

The graph view is a beta plugin. We welcome your [feedback](/contact).

:::

## Prerequisites

- `docker` or `singularity`, for the cactus image, which includes odgi,
  halSynteny, hal2maf, `vg` and `samtools`
- htslib (`bgzip`, `tabix`) and `python3`
- `node`, for the [JBrowse CLI](/docs/cli)
- the GraphGenomeView plugin, for
  [drawing the graph as a graph](#opening-the-graph-in-the-graph-genome-view)
- [`gfa-to-tabix`](https://github.com/GMOD/gfa-to-tabix) 0.11.0 or later and
  [`gfatools`](https://github.com/lh3/gfatools), for
  [indexing the graph](#indexing-the-graph)
- for the [whole build](#reproduce-it-end-to-end): the NCBI
  [`datasets`](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/download-and-install/)
  CLI, `bedGraphToBigWig` (UCSC kentUtils), `samtools`, `unzip` and `wget`

On Debian/Ubuntu, `apt install samtools tabix unzip wget python3` covers five of
those; `cargo install gfa-to-tabix` installs `gfa-to-tabix`, bioconda packages
`gfatools`, and `datasets` and `bedGraphToBigWig` are each a
[single-binary download](https://hgdownload.soe.ucsc.edu/admin/exe/).

## Where the data comes from

The five _E. coli_ RefSeq assemblies come from the NCBI datasets CLI by
accession. K12 is the `--reference` backbone the other four align onto.

The [build script](#reproduce-it-end-to-end) takes these files from their URLs,
so there is nothing to download by hand.

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

<details>
<summary>Read by URL (no download needed)</summary>

- the graph's segments, tabix-indexed, which the graph track below reads:
  https://jbrowse.org/demos/ecoli_pangenome/ecoli_cactus.segs.bed.gz
- the graph's links:
  https://jbrowse.org/demos/ecoli_pangenome/ecoli_cactus.links.bed.gz

</details>

## The Minigraph-Cactus pipeline

[Minigraph-Cactus](https://github.com/ComparativeGenomicsToolkit/cactus/blob/master/doc/pangenome.md)
(`cactus-pangenome`) builds a pangenome graph reference-first.
[minigraph](https://github.com/lh3/minigraph) lays down a backbone from the
reference you pick, and Cactus aligns every other sample onto it and normalizes
the result into a graph.

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

Every step runs in the same cactus image (Cactus also ships a
[binary release](https://github.com/ComparativeGenomicsToolkit/cactus/blob/master/BIN-INSTALL.md)
for a machine with no container runtime), so wrap the `docker run` once:

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

`--reference K12` makes K12 the minigraph backbone and the path every output is
decomposed against:

<!-- from: scripts/build_ecoli_pangenome_cactus.sh -->

```bash
in_cactus cactus-pangenome /data/js /data/seqfile.txt \
  --outDir /data/mc --outName ecoli --reference K12 \
  --vcf --gfa --gbz --odgi --viz --draw --giraffe --consCores 8
```

- `/data/js` is the [Toil](https://toil.readthedocs.io/) job store, and must not
  already exist on a fresh run.
- `--outName ecoli` prefixes every output file.
- `--vcf` deconstructs the graph into the variants track's input.
- `--odgi` writes the `.og` that the depth and presence tracks read.
- `--viz` writes the odgi raster shown at the end.
- `--giraffe` writes the indexes the read-mapping section needs
  (`mc/ecoli.d2.gbz` and its `.dist`/`.min`/`.zipcodes`), built over the graph
  filtered to sequence at least two haplotypes have.

## Load the genomes

Every projection is a track on a strain's assembly, and each strain's FASTA
holds one sequence named `chr`. We'll add K12, the reference the projections
land on, from a bgzip-compressed, indexed FASTA:

```json addassembly
{
  "name": "K12",
  "uri": "https://jbrowse.org/demos/ecoli_pangenome/K12.fa.gz"
}
```

Sakai, CFT073, NCTC86 and IAI39 load the same way, one assembly per strain,
named as in the `assemblyNames` of the tracks below.

## Synteny between all five strains (halSynteny)

[`halSynteny`](https://github.com/ComparativeGenomicsToolkit/hal) reads the
HAL's base-level alignment and emits synteny blocks per genome pair as PSL with
no sample tag in its sequence names, so the
[build script](#reproduce-it-end-to-end) runs it for all ten pairs and converts
each to PAF with PanSN `sample#0#chr` names.

Index the combined PAF so a range query fetches only the region in view:

<!-- from: scripts/build_ecoli_pangenome_cactus.sh -->

```bash
jbrowse make-pif ecoli_cactus_ava.paf   # -> ecoli_cactus_ava.pif.gz (+ .tbi)
```

Load it with an
[`MultiGenomeIndexedPAFAdapter`](/docs/config/multigenomeindexedpafadapter),
whose PanSN `sample#` prefix on every record is how it maps a record to its
strain:

```json addtrack
{
  "type": "SyntenyTrack",
  "trackId": "ecoli_cactus_ava",
  "name": "MC graph: all-vs-all synteny (halSynteny)",
  "assemblyNames": ["K12", "Sakai", "CFT073", "NCTC86", "IAI39"],
  "adapter": {
    "type": "MultiGenomeIndexedPAFAdapter",
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
  "levelHeights": [110, 110, 110, 110],
  "color": { "field": "strand" }
}
```

In grammar-of-graphics terms, `color` is a color scale that maps each ribbon's
`strand` to red where the two strains run the same way and blue where one is
inverted against the other.

<Figure caption="The Minigraph-Cactus graph's synteny projection: five strains stacked K12 to IAI39, a halSynteny ribbon between each adjacent pair, colored by strand. The top three bands run red throughout, and IAI39's large inversions are the blue ribbons crossing the bottom one." src="/img/pangenome_cactus/synteny.png" />

## Variants against K12 (vg deconstruct)

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
  "uri": "mc/ecoli.vcf.gz",
  "assemblyNames": ["K12"],
  "displays": [
    {
      "type": "LinearMultiSampleVariantDisplay",
      "variantLayout": "columns",
      "unit": "haplotype"
    }
  ]
}
```

Each strain is one haplotype, so `unit: "haplotype"` draws one row per strain,
colored by that strain's allele. The
[multi-sample variant track guide](/docs/user_guides/multivariant_track) covers
columns versus genomic positions, the genotype colors, and clustering samples by
genotype.

`vg deconstruct` writes a record per snarl (vg's word for a bubble) at every
nesting level, so wide records paint over finer ones. `cactus-pangenome` prunes
that tree with [`vcfbub`](https://github.com/pangenome/vcfbub) by default;
`--vcfbub 0` turns that off, and `--vcfwave` realigns the remaining records into
primitive variants.

## Whole-genome alignment onto K12 (MAF) {#whole-genome-alignment-maf-projection}

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
[`MafTabixAdapter`](/docs/config/maftabixadapter) reads. The streaming
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

<Figure caption="The Minigraph-Cactus HAL projected onto K12 as a MAF: the coverage band on top, then one row per strain, colored where each differs from K12. The four non-K12 rows stop at the edges of the cryptic prophage CPZ-55, which only K12 has." src="/img/pangenome_cactus/maf.png" />

A row with no colored columns shares its sequence with K12, and a row that stops
has no alignment to K12 there. The coverage band tells the two apart.

`samples` names the rows and fixes their order. To order them by shared graph
content instead, build a tree from
[`odgi similarity`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_similarity.html)
and point `nhLocation` at it, as the
[pggb tutorial's MAF track](/docs/tutorials/pangenome_ecoli#whole-genome-alignment-maf-projection)
does:

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/odgi_similarity_to_newick.py
# -D '#' -p 1: group the paths by sample, the first field of each PanSN name
in_cactus odgi similarity -i /data/mc/ecoli.full.og -D '#' -p 1 > ecoli_cactus_similarity.tsv
python3 odgi_similarity_to_newick.py ecoli_cactus_similarity.tsv ecoli_cactus.nh
```

## Pangenome depth and per-strain presence

[`odgi depth`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_depth.html)
counts how many paths traverse the graph under each K12 base, and
[`odgi pav`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_pav.html)
splits that per strain. Both run over `mc/ecoli.full.og` in 500 bp windows of
K12's path, which Cactus names `K12#0#chr`:

<!-- from: scripts/build_ecoli_pangenome_cactus.sh -->

```bash
# the windows, and the reference length bedGraphToBigWig needs
reflen=$(awk '!/^>/ { c += length($0) } END { print c }' K12.fa)
printf 'chr\t%s\n' "$reflen" > chrom.sizes
awk -v p="K12#0#chr" -v len="$reflen" -v w=500 \
  'BEGIN { for (s = 0; s < len; s += w) { e = s + w; if (e > len) e = len
           print p "\t" s "\t" e } }' > depth_windows.bed

in_cactus odgi depth -i /data/mc/ecoli.full.og -b /data/depth_windows.bed |
  awk -v p="K12#0#chr" -v OFS='\t' '$1 == p && $4 + 0 == $4 { print "chr", $2, $3, $4 }' |
  sort -k1,1 -k2,2n > ecoli_cactus_depth.bedgraph
bedGraphToBigWig ecoli_cactus_depth.bedgraph chrom.sizes ecoli_cactus_depth.bw
```

Each other strain's path name ends in a subpath tag (`Sakai#0#chr#0`), so the
per-strain filter matches the sample prefix:

<!-- from: scripts/build_ecoli_pangenome_cactus.sh -->

```bash
in_cactus odgi pav -i /data/mc/ecoli.full.og -b /data/depth_windows.bed > pav.tsv
for strain in Sakai CFT073 NCTC86 IAI39; do
  awk -F'\t' -v OFS='\t' -v s="$strain" \
    '$5 ~ "^" s "#" && $6 + 0 == $6 { print "chr", $2, $3, $6 }' pav.tsv |
    sort -k1,1 -k2,2n > "pav_${strain}.bedgraph"
  bedGraphToBigWig "pav_${strain}.bedgraph" chrom.sizes "ecoli_cactus_pav_${strain}.bw"
done
```

Each strain's presence bigWig loads as one row of a
[`MultiQuantitativeTrack`](/docs/config_guides/quantitative_track#many-signals-in-one-track),
the
[pggb page's presence track](/docs/tutorials/pangenome_ecoli#per-strain-presence)
with `ecoli_cactus_pav_` in each `uri`.

Depth counts path **steps**, so a repeat the graph folded onto one run of nodes
reads above the strain count. seqwish, pggb's graph builder, folds the rRNA
copies together; the reference-first graph keeps them apart.

To compare the two builders, load both depth curves as rows of one track on a
fixed axis, and type `chr:3,935,000-3,955,000`, the rrnC operon (a ribosomal RNA
gene copy):

```json addtrack
{
  "type": "MultiQuantitativeTrack",
  "trackId": "ecoli_depth_by_builder",
  "name": "Pangenome depth over K12, by builder (odgi depth)",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "MultiWiggleAdapter",
    "subadapters": [
      {
        "type": "BigWigAdapter",
        "name": "pggb",
        "uri": "https://jbrowse.org/demos/ecoli_pangenome/ecoli_pggb_depth.bw"
      },
      {
        "type": "BigWigAdapter",
        "name": "Minigraph-Cactus",
        "uri": "https://jbrowse.org/demos/ecoli_pangenome/ecoli_cactus_depth.bw"
      }
    ]
  },
  "displayDefaults": { "scales": { "y": { "domainMin": 0, "domainMax": 10 } } }
}
```

<Figure caption="odgi depth over the banded rrnC operon, the same command over the same K12 windows against each builder's graph, on one fixed axis. The pggb row doubles over the operon and the Minigraph-Cactus row does not move." src="/img/pangenome_cactus/builders.png" />

## Mapping a new isolate through the graph

We'll map the short reads of a sample outside the graph through the whole
pangenome and project the result onto K12. A read that follows another strain's
path through a variable region has no mismatches or soft clips and lands at that
region's K12 coordinates. A read over sequence K12 lacks has no K12 coordinate
and stays unmapped.

`--giraffe` wrote the indexes during the build. `vg giraffe` emits a GAM, and
`vg surject` projects it onto one path as a BAM. The reads are _E. coli_ KTa004
([ENA DRR063408](https://www.ebi.ac.uk/ena/browser/view/DRR063408), Illumina
MiSeq), a strain the graph has never seen:

<!-- from: scripts/build_ecoli_pangenome_cactus.sh -->

```bash
# -Z/-d/-m/-z are the graph and the three indexes --giraffe built; -f takes
# the paired FASTQs, one flag per mate; -p shows progress
in_cactus vg giraffe -p \
  -Z /data/mc/ecoli.d2.gbz -d /data/mc/ecoli.d2.dist \
  -m /data/mc/ecoli.d2.shortread.withzip.min -z /data/mc/ecoli.d2.shortread.zipcodes \
  -f /data/reads/sub_1.fastq.gz -f /data/reads/sub_2.fastq.gz > mapped.gam

# -x is the graph the GAM was mapped against; -b writes BAM instead of GAM;
# -p is the path to surject onto, so the BAM's one reference sequence is that
# PanSN name; -N/-R set the sample name and read group on every read
in_cactus vg surject -x /data/mc/ecoli.d2.gbz -b -p K12#0#chr \
  -N KTa004 -R KTa004 /data/mapped.gam > mapped.raw.bam
```

The BAM's one reference sequence is the PanSN path name, which matches no
assembly. Rename it to the assembly's refName (`chr`) in the header, drop the
unmapped reads, then sort and index:

<!-- from: scripts/build_ecoli_pangenome_cactus.sh -->

```bash
samtools view -H mapped.raw.bam | sed 's|SN:K12#0#chr|SN:chr|' > reads_hdr.sam
samtools reheader reads_hdr.sam mapped.raw.bam > reads_reheader.bam
samtools view -b -F 4 reads_reheader.bam > reads_mapped.bam
samtools sort -o ecoli_cactus_reads.bam reads_mapped.bam
samtools index ecoli_cactus_reads.bam
```

The [build script](#reproduce-it-end-to-end) also subsamples the reads. The
result loads as an ordinary alignments track:

```json addtrack
{
  "trackId": "ecoli_cactus_reads",
  "name": "KTa004 reads mapped through the graph (vs K12)",
  "uri": "ecoli_cactus_reads.bam",
  "assemblyNames": ["K12"]
}
```

`vg giraffe` rewrites `ecoli.d2.dist` as it runs, leaving it newer than the
`.min` and `.zipcodes` built from it, so a second run refuses to start. `touch`
the two derived files before re-mapping.

## Drawing the graph as a graph {#opening-the-graph-in-the-graph-genome-view}

The [graph genome view plugin](/docs/user_guides/graph_genome_view) draws the
graph as a track of the linear view. [](/docs/tutorials/pangenome_prepare_graph)
covers installing the plugin and the one command that indexes a graph for it.

### Indexing the graph

`cactus-pangenome` also wrote `mc/ecoli.sv.gfa.gz`, the graph its minigraph
stage built. This rGFA of the structural variation states each segment's place
on a genome in `SN`/`SO`/`SR` tags, so
[`gfa-to-tabix build`](https://github.com/GMOD/gfa-to-tabix#build) indexes it
with no further arguments:

```bash
# gfa-to-tabix build runs gfatools for the bubbles, so it has to be on PATH
gfa-to-tabix build mc/ecoli.sv.gfa.gz -o ecoli_cactus_sv
```

The command writes the segments and links, the bubbles, a coarse tier (one node
per bubble), the allele inventory (one row per alternative path),
`ecoli_cactus_sv.config.json`, whose graph track names the tier under `coarse`,
and `ecoli_cactus_sv.graph.json`, from which Add pangenome graph track picks up
the tier.

The figures below draw the base-level graph, where every SNP is a bubble. That
GFA has no rGFA tags, so `--reference` makes the command place segments by
following the reference's path lines:

```bash
gfa-to-tabix build mc/ecoli.gfa.gz -o ecoli_cactus --reference K12
```

Without `--snarls` the command writes no bubble file. Our hosted copy of the
index loads as one `GraphTrack` at the shared prefix:

```json addtrack
{
  "type": "GraphTrack",
  "trackId": "ecoli_cactus_segments",
  "name": "MC graph: segments (whole graph, by locus)",
  "assemblyNames": ["K12"],
  "adapter": {
    "type": "RgfaTabixAdapter",
    "uri": "https://jbrowse.org/demos/ecoli_pangenome/ecoli_cactus"
  },
  "displayDefaults": { "showLabels": "none" },
  "displays": [
    { "type": "LinearGraphDisplay" },
    { "type": "LinearBasicDisplay" }
  ]
}
```

Turned on, the track draws the window as a graph on K12's coordinates. In its
track menu, **Display types → Feature display** draws the same segments as a row
of blocks instead.

<Video src="/media/pangenome_cactus/subgraph_launch.mp4" caption="The Minigraph-Cactus graph put into an empty K12 session: the track added through Open track... → Add pangenome graph track, the window narrowed onto the IS1 element past flhD, and the track drawing the graph on K12's coordinates." />

Past the flagellar operon, K12 has an IS1 element (a short insertion sequence)
the other four skip. To see it:

- Type `chr:1,978,100-1,979,700`.
- Pick **Force-directed layout** under the **Layout** row of the graph track's
  menu.
- Add a second copy of the segments track, colored by how many strains the
  `SM:Z:` tag lists for each segment
  ([config on the pggb page](/docs/tutorials/pangenome_ecoli#strains-per-segment-as-a-track)).
- Show the [MAF track](#whole-genome-alignment-maf-projection) above the graph:
  the strains-per-segment track counts the strains, and the MAF's rows name
  them.

<Figure caption="1.6 kb of K12 past flhD, as tracks above and as the graph track below. The gene track names the IS1 transposase pair insA5 and insB5 in the shaded span, the strains-per-segment track paints that span as one strain where the rest of the window is all five, the four non-K12 MAF rows show it as a deletion, and in the graph it is the single long node the other four route around." src="/img/pangenome_cactus/graph_bubble.png" />

In the track menu, **Show... → Show deletion edges** hides the dashed link the
graph draws for the other four strains' route, which is labelled with the length
of the node it skips.

## Comparing odgi viz's node-order axis with K12's coordinates

Open `mc/ecoli.viz/chr.full.viz.png`, the
[`odgi viz`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_viz.html)
raster `--viz` wrote, with one row per strain and graph node order on the
horizontal axis.

<Figure caption="The five-strain Minigraph-Cactus graph drawn by odgi viz, one row per strain. The horizontal axis is graph node order, so its positions do not correspond to genes or coordinates. The gold band marks the locus the figure below opens." src="/img/pangenome_cactus/graph.png" />

The `odgi pav` track contains the same paths. Drawn on K12's coordinates, in the
raster's row order and colors, they differ only on the horizontal axis. The gold
band marks `chr:1,000,000-1,100,000` in both.

<Figure caption="The same paths and the same colors on K12's coordinates. The gold band is the same 100 kb in both figures, and takes up a visibly smaller share of this axis than of the graph axis above." src="/img/pangenome_cactus/graph_correspondence.png" />

The graph axis counts pangenome bases, so a locus where other strains have
sequence K12 lacks takes up more of it. The band contains Sakai's _stx2_
prophage and a second Sakai-only stretch.

## Reproduce it end to end

[`build_ecoli_pangenome_cactus.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_ecoli_pangenome_cactus.sh)
runs everything above in one shot. It:

1. downloads the five RefSeq genomes, keeping only each one's chromosome, and
   runs `cactus-pangenome`
2. converts the HAL, VCF, `odgi depth` and `odgi pav` into the projections
   above, and maps the KTa004 reads
3. indexes the base-level graph by following the reference's paths, as
   [the graph-hosting tutorial](/docs/tutorials/pangenome_prepare_graph#reproduce-it-end-to-end)
   describes
4. writes a `config.json` with the five assemblies, per-strain gene tracks, the
   projection and segments tracks, the plugin declaration and a default session

```bash
curl -fO https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts/build_ecoli_pangenome_cactus.sh
bash build_ecoli_pangenome_cactus.sh   # builds ./ecoli_cactus_build/jbrowse2
npx --yes serve ecoli_cactus_build/jbrowse2
```

The script needs the tools under [Prerequisites](#prerequisites); force a
container runtime with `CONTAINER=singularity`.

## See also

- [](/docs/tutorials/pangenome_ecoli)
- [](/docs/tutorials/pangenome_hprc)
- [](/docs/tutorials/allvsall_synteny)
- [](/docs/user_guides/graph_genome_view)
- [](/docs/user_guides/maf_track)

## External links

- [Minigraph-Cactus](https://github.com/ComparativeGenomicsToolkit/cactus/blob/master/doc/pangenome.md)
