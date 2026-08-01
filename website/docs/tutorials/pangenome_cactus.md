---
title: Pangenome (Minigraph-Cactus)
description:
  Build a Minigraph-Cactus pangenome graph and load its linear projections in
  JBrowse
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
---

[Minigraph-Cactus](https://github.com/ComparativeGenomicsToolkit/cactus/blob/master/doc/pangenome.md)
(`cactus-pangenome`) builds a pangenome graph reference-first.
[minigraph](https://github.com/lh3/minigraph) lays down a backbone from the
reference you pick, every other sample is aligned onto it, and Cactus normalizes
the result into a graph.

This tutorial builds a graph from five _E. coli_ strains and loads four views of
it in JBrowse: synteny, variants, a whole-genome alignment, and depth.

:::caution Experimental

This tutorial covers experimental ideas, and the graph view it links to is a
beta plugin. We welcome your [feedback](/contact).

:::

## Prerequisites

- `docker`, for the cactus image (which carries odgi, halSynteny, hal2maf, and
  `samtools`)
- the NCBI
  [`datasets`](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/download-and-install/)
  CLI
- `bedGraphToBigWig` (UCSC kentUtils), htslib (`bgzip`, `tabix`), `unzip`,
  `wget`
- `node`, for the [JBrowse CLI](/docs/cli)

## Cactus against pggb

The graph is built here, not downloaded.

The [pggb tutorial](/docs/tutorials/pangenome_ecoli) uses the same five strains
and the same four projections onto K12, so the two pages compare the builders on
identical input. That one explains what each projection means; this one covers
producing them from Cactus. Here is what changes between the two:

| Step             | pggb                                        | Minigraph-Cactus                                                 |
| ---------------- | ------------------------------------------- | ---------------------------------------------------------------- |
| Build            | wfmash + seqwish + smoothxg, then `-V`/`-M` | one `cactus-pangenome` run emits the graph, VCF, odgi, and a HAL |
| Reference        | symmetric all-vs-all, `-V` picks a path     | explicit `--reference`; the minigraph backbone is that genome    |
| Variants         | `pggb -V`, CHROM is the PanSN path          | `--vcf` (vg deconstruct), CHROM already the reference contig     |
| Whole-genome MAF | `pggb -M`, re-rooted on the reference       | the HAL, `hal2maf --refGenome` (already reference-rooted)        |
| Synteny          | the wfmash all-vs-all PAF                   | `halSynteny` from the HAL (or `odgi untangle`)                   |
| Depth / presence | `odgi depth` / `odgi pav`                   | same (odgi ships in the cactus image)                            |

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

Every later step runs in the same image, so wrap the `docker run` once and call
it `in_cactus`:

```bash
in_cactus() {
  docker run --rm -u "$(id -u):$(id -g)" -w /data -v "$PWD":/data \
    quay.io/comparative-genomics-toolkit/cactus:v3.2.1 "$@"
}
```

Now build the graph. `--reference K12` makes K12 the minigraph backbone, and the
path every projection is decomposed against:

```bash
in_cactus cactus-pangenome /data/js /data/seqfile.txt \
  --outDir /data/mc --outName ecoli --reference K12 \
  --vcf --gfa --gbz --odgi --viz --draw --consCores 8
```

`/data/js` is the [Toil](https://toil.readthedocs.io/) job store, and must not
already exist on a fresh run. `--outName ecoli` prefixes every output file.
Without `--vcf`, Cactus builds the graph but does not deconstruct it, and the
variant projection has no input. `--odgi` writes the `.og` that the depth and
presence projections read, and `--viz` writes the odgi raster shown at the end.
Pinning the image to a dated version tag rather than `:latest` keeps the graph
reproducible.

One run produces everything the sections below use:

- `mc/ecoli.gfa.gz`, `mc/ecoli.full.og`: the graph (GFA and odgi)
- `mc/ecoli.vcf.gz`: the pangenome variants
- `mc/ecoli.full.hal`: the multiple alignment as a HAL, which the synteny and
  MAF projections read
- `mc/ecoli.viz/chr.full.viz.png`: the odgi 1D graph raster

The image also carries [odgi](https://github.com/pangenome/odgi), `halSynteny`,
and `hal2maf`, so the projections need no other tool.

## Drawing this graph as a graph

`mc/ecoli.gfa.gz` carries no `SN`/`SO`/`SR` tags, so nothing can query it by
reference position and the graph genome view has no backbone to anchor to. The
projections below are unaffected, since they are already flattened onto K12. To
draw the graph itself, take one of the routes in the
[graph genome view guide](/docs/user_guides/graph_genome_view): `odgi extract`
on a single window, or a minigraph rGFA of the same assemblies.

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
four strains. Its `CHROM` is already the reference contig (`chr`) and its
samples are the four non-reference strains, so it loads unchanged. There is no
rename step, just the `.gz` and `.tbi` Cactus already wrote.

Load `mc/ecoli.vcf.gz` as a [`VariantTrack`](/docs/config_guides/variant_track)
on K12 and pick the matrix display, which draws one column per variant and one
row per sample:

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
covers the matrix versus the per-position display, and clustering samples by
genotype.

## Whole-genome alignment (MAF) projection

`cactus-pangenome` writes `mc/ecoli.full.hal` by default, and that is the
cleanest route to a MAF. `hal2maf --refGenome K12` roots every block on K12
directly, so there is no re-rooting step. The HAL's `genome.sequence` rows come
out as `K12.chr`, `Sakai.chr`, and so on, which is exactly the `sample.contig`
naming the MAF display splits each species off on:

```bash
in_cactus hal2maf --refGenome K12 --noAncestors /data/mc/ecoli.full.hal /data/ecoli_cactus.maf
python3 maf_to_bed.py ecoli_cactus.maf ecoli_cactus.maf.bed
bgzip ecoli_cactus.maf.bed
tabix -p bed ecoli_cactus.maf.bed.gz
```

[`maf_to_bed.py`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/maf_to_bed.py)
writes one line per block, carrying that block's rows, which a
[`MafTabixAdapter`](/docs/config/maftabixadapter) reads:

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

<Figure caption="The Minigraph-Cactus HAL projected onto K12 as a MAF: the coverage band on top, then one row per strain (K12 first), colored where each differs from K12. All five align continuously across this window, so the mismatch columns read as SNP divergence from K12." src="/img/pangenome_cactus/maf.png" />

The [MAF track guide](/docs/user_guides/maf_track) covers the conservation band,
per-row identity, and codon view, all derived from the alignment with no extra
files. The same `hal2maf` route works for a
[progressiveCactus](https://github.com/ComparativeGenomicsToolkit/cactus) HAL of
more divergent species.

## Pangenome depth and per-strain presence

These two projections run the same commands as the pggb tutorial's
[depth](/docs/tutorials/pangenome_ecoli#pangenome-depth-projection-core-vs-accessory)
and [per-strain presence](/docs/tutorials/pangenome_ecoli#per-strain-presence)
sections, on the Cactus `.og` instead of the pggb GFA. Only the path names
differ: the reference path is `K12#0#chr`, and the non-reference strains carry a
trailing subpath tag (`Sakai#0#chr#0`), so filter on those.

[`odgi depth`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_depth.html)
counts how many paths traverse the graph under each K12 base. It sits near the
strain count over shared sequence and drops toward 1 over K12-private accessory
sequence:

```bash
reflen=$(awk '!/^>/{c+=length($0)} END{print c}' K12.fa)
awk -v len="$reflen" 'BEGIN{for(s=0;s<len;s+=500){e=s+500; if(e>len)e=len; print "K12#0#chr\t"s"\t"e}}' \
  > depth_windows.bed
printf 'chr\t%s\n' "$reflen" > chrom.sizes

in_cactus odgi depth -i /data/mc/ecoli.full.og -b /data/depth_windows.bed \
  | awk -v OFS='\t' '$1=="K12#0#chr" && $4+0==$4 {print "chr",$2,$3,$4}' \
  | sort -k1,1 -k2,2n > ecoli_cactus_depth.bedgraph
bedGraphToBigWig ecoli_cactus_depth.bedgraph chrom.sizes ecoli_cactus_depth.bw
```

Load the bigWig as a
[`QuantitativeTrack`](/docs/config_guides/quantitative_track) on K12. The
aggregate curve says how many strains cover a base, but not which are missing,
so pair it with the per-strain split below.

[`odgi pav`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_pav.html)
splits that aggregate per strain. Slice each non-K12 strain's rows into its own
bigWig and load the set as one
[`MultiQuantitativeTrack`](/docs/user_guides/multiquantitative_track):

```bash
in_cactus odgi pav -i /data/mc/ecoli.full.og -b /data/depth_windows.bed > pav.tsv
for strain in Sakai CFT073 NCTC86 IAI39; do
  group=$(awk -F'\t' -v s="$strain" 'NR>1 && $5 ~ "^"s"#" {print $5; exit}' pav.tsv)
  awk -F'\t' -v OFS='\t' -v g="$group" '$5==g && $6+0==$6 {print "chr",$2,$3,$6}' \
    pav.tsv | sort -k1,1 -k2,2n > "ecoli_cactus_pav_$strain.bedgraph"
  bedGraphToBigWig "ecoli_cactus_pav_$strain.bedgraph" chrom.sizes "ecoli_cactus_pav_$strain.bw"
done
```

<Figure caption="Both odgi projections over all of K12. On top, odgi depth: near 5 where every strain traverses the graph, dropping toward 1 over accessory stretches. Below it, odgi pav, one row per non-K12 strain, near 1 where that strain is present and 0 over its own accessory stretches, so every dip in the curve above resolves into which strain accounts for it." src="/img/pangenome_cactus/pav.png" />

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
[Synteny from ortholog tables](/docs/tutorials/multiway_synteny) covers the
gene-level version of that zoom.

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
projections above, downloads JBrowse, and writes a `config.json` with the five
assemblies, per-strain gene tracks, the projection tracks, and a default
session. It needs the same tools listed under [Prerequisites](#prerequisites).

## See also

- [Pangenome graphs (pggb)](/docs/tutorials/pangenome_ecoli)
- [HPRC pangenome](/docs/tutorials/pangenome_hprc), a Minigraph-Cactus graph of
  464 human haplotypes, opened from hosted files rather than built here
- [All-vs-all synteny](/docs/tutorials/allvsall_synteny)
- [](/docs/user_guides/maf_track)
- [Minigraph-Cactus](https://github.com/ComparativeGenomicsToolkit/cactus/blob/master/doc/pangenome.md)
