---
title: Pangenome (Minigraph-Cactus)
description:
  Build a Minigraph-Cactus pangenome graph and load its linear projections in
  JBrowse
guide_category: Tutorials
tutorial_category: Synteny & comparative genomics
---

[Minigraph-Cactus](https://github.com/ComparativeGenomicsToolkit/cactus/blob/master/doc/pangenome.md)
(`cactus-pangenome`) is the Cactus toolkit's pangenome-graph builder. Like
[pggb](https://github.com/pangenome/pggb) it collapses many genomes into one
graph, but it works reference-first:
[minigraph](https://github.com/lh3/minigraph) lays down a backbone from the
chosen reference, every other sample is aligned onto it, and Cactus normalizes
the result into a graph.

This tutorial builds a graph from the **same five _E. coli_ strains** as the
[pggb tutorial](/docs/tutorials/pangenome_ecoli) and loads the same four linear
projections onto the K12 reference, so the two are a side-by-side comparison of
the builders on identical input. The pggb tutorial explains what each projection
_means_; this one focuses on producing them from Minigraph-Cactus. What differs:

| Step             | pggb                                        | Minigraph-Cactus                                                 |
| ---------------- | ------------------------------------------- | ---------------------------------------------------------------- |
| Build            | wfmash + seqwish + smoothxg, then `-V`/`-M` | one `cactus-pangenome` run emits the graph, VCF, odgi, and a HAL |
| Reference        | symmetric all-vs-all, `-V` picks a path     | explicit `--reference`; the minigraph backbone is that genome    |
| Variants         | `pggb -V`, CHROM is the PanSN path          | `--vcf` (vg deconstruct), CHROM already the reference contig     |
| Whole-genome MAF | `pggb -M`, re-rooted on the reference       | the HAL, `hal2maf --refGenome` (already reference-rooted)        |
| Synteny          | the wfmash all-vs-all PAF                   | `halSynteny` from the HAL (or `odgi untangle`)                   |
| Depth / presence | `odgi depth` / `odgi pav`                   | same (odgi ships in the cactus image)                            |

Every projection lands on a JBrowse track type you already have. The four are
laid out in the
[pggb tutorial's projection table](/docs/tutorials/pangenome_ecoli); the
sections below build each from the Cactus outputs.

## What you need

- `docker`, for the cactus image (which carries odgi, halSynteny, hal2maf, and
  `samtools`)
- the NCBI
  [`datasets`](https://www.ncbi.nlm.nih.gov/datasets/docs/v2/download-and-install/)
  CLI
- `bedGraphToBigWig` (UCSC kentUtils), htslib (`bgzip`, `tabix`), `unzip`,
  `wget`
- `node`, for the [JBrowse CLI](/docs/cli)

## Building the graph with cactus-pangenome

Minigraph-Cactus takes a **seqFile**: one `name<TAB>path` line per sample. Input
contigs stay simply named (`chr` here); Cactus applies
[PanSN](https://github.com/pangenome/PanSN-spec) `sample#haplotype#contig`
naming to the graph internally, so no pre-naming step is needed (unlike pggb,
which wants a PanSN-named concatenated FASTA).

```bash
cat > seqfile.txt <<'EOF'
K12     K12.fa
Sakai   Sakai.fa
CFT073  CFT073.fa
NCTC86  NCTC86.fa
IAI39   IAI39.fa
EOF
```

Then run it. `--reference K12` makes K12 the minigraph backbone and the path
every projection is decomposed against. Every later step runs in this same
image, so wrap the `docker run` once and call it `in_cactus`:

```bash
in_cactus() {
  docker run --rm -u "$(id -u):$(id -g)" -w /data -v "$PWD":/data \
    quay.io/comparative-genomics-toolkit/cactus:v3.2.1 "$@"
}

in_cactus cactus-pangenome /data/js /data/seqfile.txt \
  --outDir /data/mc --outName ecoli --reference K12 \
  --vcf --gfa --gbz --odgi --viz --draw --consCores 8
```

Pinning the image to a dated version tag (not `:latest`) keeps the graph
reproducible. `/data/js` is the [Toil](https://toil.readthedocs.io/) job store
(must not already exist on a fresh run); `--outName ecoli` prefixes every
output. The one flag that is easy to miss is `--vcf`: without it Cactus builds
the graph but never deconstructs it, so the variant projection has no input.
`--odgi` writes the `.og` the depth and presence projections read, and `--viz`
writes the odgi 1D raster shown at the end.

A single run emits everything the sections below use:

- `mc/ecoli.gfa.gz`, `mc/ecoli.full.og`: the graph (GFA and odgi)
- `mc/ecoli.vcf.gz`: the pangenome variants
- `mc/ecoli.full.hal`: the multiple alignment as a HAL (the synteny and MAF
  projections read this)
- `mc/ecoli.viz/chr.full.viz.png`: the odgi 1D graph raster

The cactus image also carries [odgi](https://github.com/pangenome/odgi),
`halSynteny`, and `hal2maf`, so no other tool is needed for the projections.

## Drawing this graph as a graph

`mc/ecoli.gfa.gz` carries no `SN`/`SO`/`SR` tags on its segments, so nothing can
query it by reference position and the graph genome view has no backbone to
anchor to. The projections below are unaffected, being already flattened onto
K12, but the graph itself needs one of the routes the
[pggb tutorial](/docs/tutorials/pangenome_ecoli#the-graph-itself-a-local-subgraph)
covers: `odgi extract` one window and open that GFA, or index a minigraph rGFA
of the same assemblies, which opens any locus on demand. An rGFA-tagged
`sv.gfa.gz`, as HPRC publishes, can be indexed directly.

## All-vs-all synteny projection

Cactus does not emit an all-vs-all alignment PAF the way pggb's wfmash step
does. Two graph outputs can stand in. `odgi untangle` projects the graph to a
synteny PAF, but on a near-colinear bacterial graph its cut points are sparse
and it collapses each pair to a few whole-chromosome blocks.
[`halSynteny`](https://github.com/ComparativeGenomicsToolkit/hal) instead reads
the HAL's base-level alignment and emits proper synteny blocks per genome pair,
so use it here.

`halSynteny` writes PSL and names every sequence `chr` (the HAL sequence name),
with no sample tag. The [build script](#reproduce-it-end-to-end) runs it for all
six strain pairs and converts each PSL to PAF, injecting the PanSN
`sample#0#chr` query/target names and decoding the strand (halSynteny keeps the
query on `+` and flips only the target, so the PAF strand is the second
character of the PSL strand field). Index the combined PAF for range queries:

```bash
jbrowse make-pif ecoli_cactus_ava.paf   # -> ecoli_cactus_ava.pif.gz (+ .tbi)
```

Load it with an
[`AllVsAllIndexedPAFAdapter`](/docs/config/allvsallindexedpafadapter) so a range
query fetches only the region in view. The PanSN `sample#` prefix on every
record is how the adapter maps a record to its strain:

```json
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

Stack the five strains in a linear synteny view: one panel per strain, and one
`tracks` entry per band, each band naming the same track. Put this in the view's
`init` (the launch settings a session applies once) or reach the same state from
the UI with **Add > Linear synteny view**, whose Quick start fills in a row per
assembly the track lists.

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

<Figure caption="The Minigraph-Cactus graph's synteny projection: the five strains stacked K12 to IAI39, a halSynteny ribbon between each adjacent pair drawn from the graph's HAL. The continuous diagonals of the top three bands are the backbone the four closest strains share. The bottom band crosses because IAI39 carries large inversions relative to the others, the same rearrangement the pggb graph reports." src="/img/pangenome_cactus/synteny.png" />

### The same view, a different alignment

This is the same view, the same five strains and the same row order as the
[all-vs-all tutorial's stack](/docs/tutorials/allvsall_synteny#stacking-the-genomes)
and the
[pggb one](/docs/tutorials/pangenome_ecoli#all-vs-all-synteny-projection), and
the three agree on the backbone and on IAI39's inversions. What differs is where
the blocks came from, and that is the reason to look at this one:

- minimap2 aligns each pair of assemblies directly, so its blocks are one
  aligner's opinion about two genomes at a time.
- These blocks are read out of the HAL with `halSynteny`, so they are the
  graph's own base-level alignment. Every other projection on this page, the
  variants, the MAF, the depth and PAV tracks, is a view of that same alignment,
  so a boundary here is the boundary those tracks report too.
- Cactus emits no all-vs-all PAF of its own, and `odgi untangle` on a
  near-colinear bacterial graph collapses each pair to a few whole-chromosome
  blocks, which is why `halSynteny` is the route rather than either of those.

A practical difference: `ecoli_cactus_ava` is indexed with `make-pif`, so each
screen is a tabix range query, while the all-vs-all tutorial's plain
`AllVsAllPAFAdapter` holds the whole PAF in memory.

## Pangenome variants projection

`--vcf` decomposes the graph against the K12 reference with
[`vg deconstruct`](https://github.com/vgteam/vg), genotyped across the other
four strains. Unlike `pggb -V`, its `CHROM` is already the reference contig
(`chr`) and its samples are the four non-reference strains, so it loads
unchanged: no rename, just the `.gz` and `.tbi` Cactus already wrote.

Load `mc/ecoli.vcf.gz` as a [`VariantTrack`](/docs/config_guides/variant_track)
on K12 and pick the matrix display (one column per variant, one row per sample):

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

<Figure caption="The graph's pangenome variants on K12, one row per non-reference strain and one column per variant vg deconstruct called, with the MAF alignment below and the K12 gene lane above. IAI39 goes no-call (yellow) over the last 6 kb, and the MAF row underneath it drops out across the same stretch: that is one strain leaving the alignment, seen twice." src="/img/pangenome_cactus/variant_matrix.png" />

The [multi-sample variant track guide](/docs/user_guides/multivariant_track)
covers the matrix versus the per-position display and clustering samples by
genotype.

## Whole-genome alignment (MAF) projection

`cactus-pangenome` writes `mc/ecoli.full.hal` by default. This is the Cactus
signature output and the cleanest route to a MAF: `hal2maf --refGenome K12`
roots every block on K12 directly, so there is no re-rooting step (pggb's `-M`
MAF has no fixed reference row and needs one). The HAL's `genome.sequence` rows
come out `K12.chr`, `Sakai.chr`, … which is exactly the `sample.contig` naming
the MAF display splits each species off on:

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

<Figure caption="The Minigraph-Cactus HAL projected onto K12 as a MAF: the coverage band on top, then one row per strain (K12 first), colored where each differs from K12. On this shared-backbone window all five align continuously, so the mismatch columns read as SNP divergence from K12." src="/img/pangenome_cactus/maf.png" />

The [MAF track guide](/docs/user_guides/maf_track) covers the conservation band,
per-row identity, and codon view, all derived from the alignment with no extra
files. Because the whole-genome alignment here comes from a HAL, the same
`hal2maf` route works for a
[progressiveCactus](https://github.com/ComparativeGenomicsToolkit/cactus) HAL of
more divergent species.

## Pangenome depth and per-strain presence

These two projections run the same commands as the pggb tutorial's
[depth](/docs/tutorials/pangenome_ecoli#pangenome-depth-projection-core-vs-accessory)
and [per-strain presence](/docs/tutorials/pangenome_ecoli#per-strain-presence)
sections, on the Cactus `.og` instead of the pggb GFA, because odgi ships in the
cactus image. Only the path names differ: the reference path is `K12#0#chr`, and
the non-reference strains carry a trailing subpath tag (`Sakai#0#chr#0`), so
filter on those.

[`odgi depth`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_depth.html)
counts how many paths traverse the graph under each K12 base (near 5 where all
strains are present, toward 1 over K12-private accessory sequence):

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
[`QuantitativeTrack`](/docs/config_guides/quantitative_track) on K12. On its own
the aggregate curve says how many strains cover a base but not which ones are
missing, so pair it with the per-strain split below.

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

<Figure caption="Both odgi projections over all 4.64 Mb of K12. On top, odgi depth: near 5 where every strain traverses the graph (core sequence), dropping toward 1 over accessory stretches. Below it, odgi pav, one row per non-K12 strain, each near 1 where that strain is present and 0 over its own accessory stretches, so every dip in the curve above resolves into which strain accounts for it." src="/img/pangenome_cactus/pav.png" />

## Compared to `odgi viz`

`--viz` already wrote `mc/ecoli.viz/chr.full.viz.png`, the same
[`odgi viz`](https://odgi.readthedocs.io/en/latest/rst/commands/odgi_viz.html)
graph raster the pggb tutorial contrasts against its projections: one row per
strain, but with the graph's node order on the horizontal axis instead of a
genome coordinate. The
[pggb tutorial's `odgi viz` section](/docs/tutorials/pangenome_ecoli#compared-to-odgi-viz)
explains that trade-off in full; it applies identically here, because both
builders produce the same kind of graph and the same odgi renders it.

<Figure caption="The five-strain Minigraph-Cactus graph drawn by odgi viz: one row per strain, colored where that strain traverses the graph and white where it does not. The horizontal axis is graph node order, not K12 position, so nothing lines up with a gene or coordinate. The gold band marks the locus carried over to the JBrowse figure below." src="/img/pangenome_cactus/graph.png" />

The two axes are easiest to tell apart by drawing the same rows twice. The
`odgi pav` track is `odgi viz`'s own picture, one row per path, painted where
the path is present and white where it is not, so putting it on K12's
coordinates in the raster's row order and colors leaves exactly one thing
different between the two figures: the horizontal axis. The gold band is the
same 100 kb of K12, `chr:1,000,000-1,100,000`, in both.

K12 itself has no row below because K12 is the axis there: the raster's
`K12#0#chr` row is the JBrowse figure's coordinate line.

<Figure caption="The same paths, the same colors, on K12's coordinates instead of the graph's. The gold band is 100 kb, 2.2% of the K12 axis, while the matching band above spans 5.1% of the graph axis, because the graph counts the other strains' accessory sequence through this locus as well and the linear view has nowhere to put it." src="/img/pangenome_cactus/graph_correspondence.png" />

The band is wider on the graph axis, by 2.4 times. That difference is the whole
distinction: the graph axis counts pangenome bases, so a locus where the other
strains carry sequence K12 lacks takes up more of it, while the JBrowse axis
counts K12 bases and holds every locus to its reference width. This is the 100
kb window where that gap is largest, which is also why it sits over a dip in the
depth track.

The mapping is not eyeballed. Node ids in a Cactus graph run `1..N` in node
order, so a node's pangenome offset is the cumulative length of every lower id,
and walking K12's own `P` line turns a K12 offset into a node and then into a
pangenome offset. `build_ecoli_pangenome_cactus.sh` does that walk and writes
the pixel span it implies, so both bands come from the same arithmetic.

## Opening the banded locus in a multi-way synteny view

The depth track says a locus is accessory and the graph raster says it is wide,
but neither says _what_ is there. The synteny projection does: stack the five
strains as above and zoom every row to that locus. In `chr:1,000,000-1,100,000`
it is Sakai's 66 kb stx2 prophage plus a second 84 kb Sakai-only stretch.

Each row needs its own window, because the same locus is at a different
coordinate (and a different length) in each strain. Read them off the synteny
PAF rather than guessing: the K12 window's end points fall in halSynteny blocks
that place it at Sakai `chr:1,128,000-1,459,000`, CFT073
`chr:1,044,000-1,243,500`, NCTC86 `chr:1,184,000-1,325,000`, and IAI39
`chr:2,163,000-2,255,000`. IAI39 is the one on the minus strand, so its is the
ribbon that crosses. The interactive equivalent is to navigate the K12 row, then
right-click a ribbon and pick **Center on feature**, which puts the row below on
the matching alignment.

Do not square the rows to a common width here. The span each row needs _is_ the
result: 100 kb of K12 costs 331 kb in Sakai, 200 kb in CFT073, 141 kb in NCTC86
and 92 kb in IAI39, the same 1 to 3 times spread the graph axis showed.

Stacked five deep the ribbons shear rather than run horizontal, which is the
result but is also most of what a reader can take from the picture. For what is
actually inside the band, the
[all-vs-all tutorial's stx2 figure](/docs/tutorials/allvsall_synteny) opens the
same locus two rows deep with the gene lane on, where the prophage reads as
genes rather than as a gap between ribbons.

The [all-vs-all tutorial](/docs/tutorials/allvsall_synteny) also covers the same
stack driven from the UI, and
[Synteny from ortholog tables](/docs/tutorials/multiway_synteny) covers the
gene-level version of this zoom.

## Reproduce it end to end

[`build_ecoli_pangenome_cactus.sh`](https://github.com/GMOD/jbrowse-components/blob/main/scripts/build_ecoli_pangenome_cactus.sh)
runs everything above in one shot:

```bash
bash scripts/build_ecoli_pangenome_cactus.sh   # builds ./ecoli_cactus_build/jbrowse2
npx --yes serve ecoli_cactus_build/jbrowse2
```

It downloads the same five RefSeq genomes as the pggb build, runs
`cactus-pangenome`, converts the HAL, VCF, `odgi depth`, and `odgi pav` into the
projections above, downloads JBrowse, and writes a `config.json` with the five
assemblies, per-strain gene tracks, the projection tracks above, and a default
session. It needs the same tools listed under [What you need](#what-you-need).

## See also

- [Pangenome graphs (pggb)](/docs/tutorials/pangenome_ecoli)
- [All-vs-all synteny](/docs/tutorials/allvsall_synteny)
- [MAF track](/docs/user_guides/maf_track)
- [Minigraph-Cactus](https://github.com/ComparativeGenomicsToolkit/cactus/blob/master/doc/pangenome.md)
